import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const HELPER_PATH = join(PLUGIN_DIR, 'multimodal-helper.cjs')
const CONFIG_PATH = join(PLUGIN_DIR, 'global-multimodal-config.json')

const VISION_CREDENTIAL_REF = 'DSH_VISION_API_KEY'
const GENERATION_CREDENTIAL_REF = 'DSH_GENERATION_API_KEY'

// No vendor defaults: both channels start unconfigured (empty model and base
// URL) and must be filled in — via the settings page or by editing the config
// file — before the tools can call anything. Any OpenAI-compatible endpoint
// works.
const DEFAULT_CONFIG = Object.freeze({
  visionEnabled: true,
  visionModel: '',
  visionBaseUrl: '',
  generationEnabled: true,
  generationModel: '',
  generationBaseUrl: '',
})

// Doubao rejects tiny placeholder images; keep the connection probe at 16x16.
const TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR4nGP4TyFgGDVg1IBRA4aLAQBdePwur/3haQAAAABJRU5ErkJggg=='

function mimeForPath(path) {
  const lower = String(path || '').toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

// Read pixel dimensions from a data: URL by parsing image headers. Returns
// { width, height } or null. Covers PNG/JPEG/GIF (the common paste and
// screenshot formats); WebP and others fall back to null so the caller keeps
// the default size tier instead of guessing wrong.
function readImageSizeFromDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null
  const comma = dataUrl.indexOf(',')
  if (comma < 0 || !/^\s*data:image\//i.test(dataUrl)) return null
  let buf
  try { buf = Buffer.from(dataUrl.slice(comma + 1), 'base64') } catch { return null }
  if (!buf || buf.length < 16) return null
  // PNG: IHDR width/height at bytes 16..23 (big-endian uint32).
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    if (buf.length < 24) return null
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return width > 0 && height > 0 ? { width, height } : null
  }
  // JPEG: scan SOF markers (0xC0..0xCF except DHT/DAC/JPG) for height/width.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 8 < buf.length) {
      if (buf[i] !== 0xff) break
      const marker = buf[i + 1]
      if (marker === 0xd8 || marker === 0xd9) break
      const length = buf.readUInt16BE(i + 2)
      if (length < 2) break
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(i + 5)
        const width = buf.readUInt16BE(i + 7)
        if (width > 0 && height > 0) return { width, height }
      }
      i += 2 + length
    }
  }
  // GIF: logical screen width/height at bytes 6..9 (little-endian uint16).
  const sig = buf.length >= 10 ? buf.subarray(0, 6).toString('ascii') : ''
  if (sig === 'GIF87a' || sig === 'GIF89a') {
    const width = buf.readUInt16LE(6)
    const height = buf.readUInt16LE(8)
    return width > 0 && height > 0 ? { width, height } : null
  }
  return null
}

// Doubao Seedream recommended pixel sizes per aspect ratio (official size
// table). The API always accepts these values; a reference image's ratio is
// snapped to the nearest preset so an edit matches the reference's
// proportions instead of the model's default square 2K.
const GEN_SIZE_PRESETS = {
  '2K': [
    { ratio: 1, w: 2048, h: 2048 },
    { ratio: 4 / 3, w: 2304, h: 1728 },
    { ratio: 3 / 4, w: 1728, h: 2304 },
    { ratio: 3 / 2, w: 2496, h: 1664 },
    { ratio: 2 / 3, w: 1664, h: 2496 },
    { ratio: 16 / 9, w: 2848, h: 1600 },
    { ratio: 9 / 16, w: 1600, h: 2848 },
    { ratio: 21 / 9, w: 3136, h: 1344 },
  ],
  '3K': [
    { ratio: 1, w: 3072, h: 3072 },
    { ratio: 4 / 3, w: 3456, h: 2592 },
    { ratio: 3 / 4, w: 2592, h: 3456 },
    { ratio: 16 / 9, w: 4096, h: 2304 },
    { ratio: 9 / 16, w: 2304, h: 4096 },
    { ratio: 3 / 2, w: 3744, h: 2496 },
    { ratio: 2 / 3, w: 2496, h: 3744 },
    { ratio: 21 / 9, w: 4704, h: 2016 },
  ],
}

function pickPresetSize(referenceRatio, presets) {
  let best = presets[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const preset of presets) {
    const dist = Math.abs(Math.log(referenceRatio) - Math.log(preset.ratio))
    if (dist < bestDist) { bestDist = dist; best = preset }
  }
  return `${best.w}x${best.h}`
}

// Resolve the generation `size` argument. An explicit WIDTHxHEIGHT is kept
// as-is. When references are present and the size is a tier preset (2K/3K),
// snap to the preset entry whose aspect ratio is closest to the first
// reference image — so edits keep the reference's proportions instead of
// falling back to a square default. Reference dimensions come from the
// attachment metadata if available, otherwise by parsing the data URL.
function resolveGenSize(sizeArg, references) {
  const size = typeof sizeArg === 'string' ? sizeArg.trim() : ''
  if (/^\d{3,5}x\d{3,5}$/i.test(size)) return size
  const tier = /^3k$/i.test(size) ? '3K' : '2K'
  if (Array.isArray(references) && references.length > 0) {
    const ref = references[0]
    let width = Number(ref?.width)
    let height = Number(ref?.height)
    if (!(width > 0 && height > 0)) {
      const dim = readImageSizeFromDataUrl(ref?.dataUrl)
      width = dim?.width
      height = dim?.height
    }
    if (width > 0 && height > 0) {
      return pickPresetSize(width / height, GEN_SIZE_PRESETS[tier])
    }
  }
  return tier
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(value) {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

function collectImageRefs(content) {
  const refs = []
  if (!Array.isArray(content)) return refs
  for (const block of content) {
    if (block && block.type === 'image' && block.attachment) refs.push(block.attachment)
  }
  return refs
}

/** Like {@link collectImageRefs} but also descends into tool-result content. */
function collectImageRefsDeep(content) {
  const refs = []
  if (!Array.isArray(content)) return refs
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'image' && block.attachment) {
      refs.push(block.attachment)
    } else if (block.type === 'tool-result' && Array.isArray(block.content)) {
      refs.push(...collectImageRefsDeep(block.content))
    }
  }
  return refs
}

function collectSpliceImageRefs(data) {
  const refs = []
  if (!data || !Array.isArray(data.inserted)) return refs
  for (const message of data.inserted) {
    if (message && Array.isArray(message.content)) refs.push(...collectImageRefs(message.content))
  }
  return refs
}

function contentHasImageDeep(blocks) {
  if (!Array.isArray(blocks)) return false
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'image') return true
    if (block.type === 'tool-result' && contentHasImageDeep(block.content)) return true
  }
  return false
}

function requestMessagesHaveImage(messages) {
  for (const message of Array.isArray(messages) ? messages : []) {
    if (contentHasImageDeep(message?.content)) return true
  }
  return false
}

function stripImagesFromBlocks(blocks, noteText) {
  let removed = 0
  const kept = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') { kept.push(block); continue }
    if (block.type === 'image') { removed += 1; continue }
    if (block.type === 'tool-result' && contentHasImageDeep(block.content)) {
      const inner = stripImagesFromBlocks(block.content, noteText)
      removed += inner.removed
      kept.push({ ...block, content: inner.blocks })
      continue
    }
    kept.push(block)
  }
  if (removed > 0) kept.push({ type: 'text', text: noteText(removed) })
  return { removed, blocks: kept }
}

function cleanText(value, fallback, maxLength = 512) {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback).slice(0, maxLength)
}

function cleanBaseUrl(value, fallback) {
  const text = cleanText(value, fallback, 2048).replace(/\/+$/, '')
  // Empty means "not configured yet"; call sites enforce presence when needed.
  if (text === '') return ''
  let parsed
  try {
    parsed = new URL(text)
  } catch {
    throw new Error('Base URL 必须是有效的绝对地址')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Base URL 仅支持 http(s) 地址')
  }
  return text
}

// A channel is callable only when both its model id and base URL are set;
// anything else gets a actionable message pointing at the two config paths.
function requireChannelConfig(channel, config) {
  const label = channel === 'vision' ? '视觉模型' : '生图模型'
  if (!config[`${channel}Model`] || !config[`${channel}BaseUrl`]) {
    throw new Error(`${label}未配置：请前往「设置 → 多模态」，或编辑插件目录的 global-multimodal-config.json，填写模型 ID 与 Base URL`)
  }
}

function normalizeConfig(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    visionEnabled: typeof source.visionEnabled === 'boolean' ? source.visionEnabled : DEFAULT_CONFIG.visionEnabled,
    visionModel: cleanText(source.visionModel, DEFAULT_CONFIG.visionModel),
    visionBaseUrl: cleanBaseUrl(source.visionBaseUrl, DEFAULT_CONFIG.visionBaseUrl),
    generationEnabled: typeof source.generationEnabled === 'boolean' ? source.generationEnabled : DEFAULT_CONFIG.generationEnabled,
    generationModel: cleanText(source.generationModel, DEFAULT_CONFIG.generationModel),
    generationBaseUrl: cleanBaseUrl(source.generationBaseUrl, DEFAULT_CONFIG.generationBaseUrl),
  }
}

function loadConfig() {
  try {
    return normalizeConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf8')))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfig(value) {
  const config = normalizeConfig(value)
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return config
}

function readBody(req, maxBytes = 128 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function safeError(error, secret) {
  let message = error instanceof Error ? error.message : String(error)
  if (secret) message = message.split(secret).join('[已隐藏]')
  return message.slice(0, 1500)
}

function channelInfo(channel) {
  if (channel === 'vision') return { ref: VISION_CREDENTIAL_REF, label: '视觉模型' }
  if (channel === 'generation') return { ref: GENERATION_CREDENTIAL_REF, label: '生图模型' }
  throw new Error('未知的多模态通道')
}

export const name = 'multimodal'
export const inject = [
  'tools',
  'subprocess',
  'fs',
  'attachments',
  'sessionQuery',
  'webServer',
  'credentials',
  'systemPrompt',
  'llm',
]

export function apply(ctx) {
  const sandboxPolicy = ctx.get('sandboxPolicy')
  const imageRefsByAgent = new Map()

  // Expose this plugin's vision-channel state on the shared host context so
  // other host components (notably the api-proxy prompt admission guard) can
  // tell that a text-only model may still accept image prompts: this plugin's
  // agent/pre-step hook strips image blocks and routes them through the
  // `vision` tool, so the model never receives raw image input. Without this
  // signal, the api-proxy rejects image prompts before the agent turn runs and
  // the vision tool never gets a chance to read the pasted image.
  ctx.provide('globalMultimodal', {
    visionEnabled: () => loadConfig().visionEnabled,
    config: () => loadConfig(),
  })

  function workspaceBase(exec) {
    const cwd = exec?.agent?.session?.header?.cwd
    if (typeof cwd === 'string' && cwd) return cwd
    if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot) {
      return sandboxPolicy.workspaceRoot
    }
    return '.'
  }

  async function describeCredentials() {
    const [vision, generation] = await Promise.all([
      ctx.credentials.describe(VISION_CREDENTIAL_REF),
      ctx.credentials.describe(GENERATION_CREDENTIAL_REF),
    ])
    return { vision, generation }
  }

  async function publicConfig() {
    return { ...loadConfig(), credentials: await describeCredentials() }
  }

  async function resolveCredential(channel, temporaryValue) {
    const { ref, label } = channelInfo(channel)
    const temporary = typeof temporaryValue === 'string' ? temporaryValue.trim() : ''
    if (temporary) return temporary
    const resolved = await ctx.credentials.resolve(ref)
    if (!resolved || !resolved.value) throw new Error(`${label} API Key 尚未配置，请前往“设置 → 多模态”填写`)
    return resolved.value
  }

  async function runHelper(request, signal) {
    const tempDir = await mkdtemp(join(tmpdir(), 'dsh-global-mm-'))
    const requestPath = join(tempDir, 'request.json')
    const responsePath = join(tempDir, 'response.json')
    const normalized = request.kind === 'gen' && !request.outDir
      ? { ...request, outDir: tempDir }
      : request
    try {
      await writeFile(requestPath, JSON.stringify(normalized), { encoding: 'utf8', mode: 0o600 })
      let nodePath
      try {
        nodePath = await ctx.subprocess.resolveExecutable('node')
      } catch {
        throw new Error('找不到 Node.js 可执行文件，无法调用多模态 API')
      }
      const handle = ctx.subprocess.spawn({
        argv: [nodePath, HELPER_PATH, requestPath, responsePath],
        cwd: tempDir,
        stdio: { stdin: 'ignore', stdout: 'ignore', stderr: { maxBytes: 200000 } },
        graceMs: 30000,
        ...(signal ? { signal } : {}),
      })
      let outcome
      try {
        outcome = await handle.done
      } catch (error) {
        throw new Error(`多模态辅助进程启动失败: ${safeError(error, request.apiKey)}`)
      }
      let parsed
      try {
        parsed = JSON.parse(await readFile(responsePath, 'utf8'))
      } catch {
        parsed = undefined
      }
      if (!parsed || parsed.ok !== true) {
        let stderr = ''
        try {
          stderr = handle.collected?.stderr?.readFrom(0)?.text || ''
        } catch {}
        const detail = parsed?.error || `Node.js 退出码 ${outcome?.exitCode ?? '?'}${stderr ? `；${stderr}` : ''}`
        throw new Error(`多模态 API 调用失败: ${safeError(detail, request.apiKey)}`)
      }
      return parsed.result
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  async function handleConfig(req, res) {
    try {
      if (req.method === 'GET') {
        json(res, 200, await publicConfig())
        return
      }
      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req))
        saveConfig(body)
        json(res, 200, await publicConfig())
        return
      }
      json(res, 405, { error: '仅支持 GET/POST' })
    } catch (error) {
      json(res, 400, { error: safeError(error) })
    }
  }

  async function handleCredential(req, res) {
    let temporarySecret = ''
    try {
      if (req.method !== 'POST') {
        json(res, 405, { error: '仅支持 POST' })
        return
      }
      const body = JSON.parse(await readBody(req))
      const { ref } = channelInfo(body.channel)
      if (body.clear === true) {
        await ctx.credentials.unset(ref)
      } else {
        temporarySecret = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
        if (!temporarySecret) throw new Error('API Key 不能为空')
        if (temporarySecret.length > 65536) throw new Error('API Key 过长')
        await ctx.credentials.set(ref, temporarySecret)
      }
      json(res, 200, { credential: await ctx.credentials.describe(ref) })
    } catch (error) {
      json(res, 400, { error: safeError(error, temporarySecret) })
    }
  }

  async function handleTest(req, res) {
    let temporarySecret = ''
    try {
      if (req.method !== 'POST') {
        json(res, 405, { error: '仅支持 POST' })
        return
      }
      const body = JSON.parse(await readBody(req))
      const channel = body.channel
      channelInfo(channel)
      temporarySecret = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
      const apiKey = await resolveCredential(channel, temporarySecret)
      const config = loadConfig()
      if (channel === 'vision') {
        const model = cleanText(body.model, config.visionModel)
        const baseUrl = cleanBaseUrl(body.baseUrl, config.visionBaseUrl)
        if (!model) throw new Error('请先填写视觉模型 ID')
        if (!baseUrl) throw new Error('请先填写视觉通道 Base URL')
        const result = await runHelper({
          kind: 'vision',
          apiKey,
          baseUrl,
          model,
          prompt: '这是连接测试。请只回答“视觉连接正常”。',
          images: [{ dataUrl: TEST_IMAGE, label: 'connection-test.png' }],
          detail: 'low',
          maxTokens: 32,
          timeoutMs: 90000,
        })
        json(res, 200, { ok: true, message: '视觉模型连接正常', model: result.model || model })
        return
      }
      const model = cleanText(body.model, config.generationModel)
      const baseUrl = cleanBaseUrl(body.baseUrl, config.generationBaseUrl)
      if (!model) throw new Error('请先填写生图模型 ID')
      if (!baseUrl) throw new Error('请先填写生图通道 Base URL')
      const result = await runHelper({
        kind: 'gen',
        apiKey,
        baseUrl,
        model,
        prompt: '连接测试：白色背景中央的一个简洁蓝色圆点图标。',
        references: [],
        size: '2K',
        count: 1,
        timeoutMs: 180000,
      })
      json(res, 200, {
        ok: true,
        message: `生图模型连接正常，已成功生成 ${Array.isArray(result.images) ? result.images.length : 0} 张测试图`,
        model,
      })
    } catch (error) {
      json(res, 400, { error: safeError(error, temporarySecret) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/global-multimodal/config', handler: handleConfig }))
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/global-multimodal/credential', handler: handleCredential }))
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/global-multimodal/test', handler: handleTest }))

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    const agentId = payload?.agent?.id === undefined ? '' : String(payload.agent.id)
    if (agentId) {
      const refs = []
      if (Array.isArray(payload.messages)) {
        for (const message of payload.messages) refs.push(...collectImageRefs(message?.content))
      }
      if (refs.length > 0) imageRefsByAgent.set(agentId, refs)
      else if (payload.step === 1) imageRefsByAgent.delete(agentId)
    }
    // Image blocks now STAY in the durable user/message events (the browser
    // renders the sent bubble from that log); the text-only model request is
    // adapted at the llm/stream boundary below instead.
    return decision
  })

  // Text-only model adaptation at the adapter boundary. The agent loop logs
  // pre-step messages verbatim, so stripping there would erase the image from
  // the durable history and the chat display. Instead, every LLM request that
  // carries image blocks and targets a text-only model is re-dispatched with
  // images replaced by an inline note; image-capable models receive the
  // original request untouched.
  const strippedRequests = new WeakSet()
  const modalityCache = new Map()
  const MODALITY_CACHE_TTL_MS = 60000

  async function modelAcceptsImages(provider, model) {
    const key = `${provider}:${model}`
    const cached = modalityCache.get(key)
    if (cached !== undefined && Date.now() - cached.at < MODALITY_CACHE_TTL_MS) return cached.accepts
    let accepts = false
    try {
      const info = await ctx.llm.resolveModelInfo(provider, model)
      accepts = Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')
    } catch {
      accepts = false
    }
    modalityCache.set(key, { at: Date.now(), accepts })
    return accepts
  }

  ctx.on('llm/stream', (options, next) => {
    if (strippedRequests.has(options) || !requestMessagesHaveImage(options?.messages)) return next()
    return (async function* () {
      const provider = typeof options.provider === 'string' ? options.provider : ''
      const model = typeof options.model === 'string' ? options.model : ''
      if (provider !== '' && model !== '' && await modelAcceptsImages(provider, model)) {
        yield* next()
        return
      }
      const visionOn = loadConfig().visionEnabled
      const noteText = (count) => visionOn
        ? `\n\n[本条消息包含 ${count} 张图片，请调用 vision 工具查看图片内容]`
        : `\n\n[本条消息包含 ${count} 张图片，当前模型不支持图片输入]`
      const messages = options.messages.map((message) => {
        if (!message || !Array.isArray(message.content)) return message
        const stripped = stripImagesFromBlocks(message.content, noteText)
        if (stripped.removed === 0) return message
        return { ...message, content: stripped.blocks }
      })
      const adapted = { ...options, messages }
      strippedRequests.add(adapted)
      yield* ctx.llm.stream(adapted)
    })()
  }, { global: true })

  async function findPastedImageRefs(exec) {
    const agent = exec?.agent
    if (!agent) return []
    // Scan the whole session log for the most recently produced image —
    // whether from a user paste (user/message event) or a tool output
    // (generate_image/show_image tool/result event). Without the tool-result
    // scan, an edit loop would keep re-feeding the ORIGINAL pasted image
    // instead of the just-generated edit, so the model sees the edit never
    // took effect and loops forever.
    const collectToolResultRefs = (event) => {
      const message = event?.data?.message
      if (!message) return []
      const refs = []
      // Image blocks the render emitted into the tool-result content (top-level
      // and nested inside {type:'tool-result', content:[...]} wrappers).
      refs.push(...collectImageRefsDeep(message.content))
      // presentationMeta images (generate_image/show_image carry refs here too).
      const meta = message.meta
      if (meta && Array.isArray(meta.images)) {
        for (const image of meta.images) {
          if (image && typeof image.attachmentId === 'string') refs.push(image)
        }
      }
      // Deduplicate by attachmentId: the render block and meta both carry the
      // same ref, so a generate_image result would otherwise feed the image
      // twice to the downstream vision/generate call.
      const seen = new Set()
      const unique = []
      for (const ref of refs) {
        const id = String(ref.attachmentId)
        if (seen.has(id)) continue
        seen.add(id)
        unique.push(ref)
      }
      return unique
    }
    const scan = (events) => {
      if (!Array.isArray(events)) return []
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]
        if (event?.type === 'user/message') {
          const refs = collectImageRefs(event.data?.content)
          if (refs.length > 0) return refs
        } else if (event?.type === 'tool/result') {
          const refs = collectToolResultRefs(event)
          if (refs.length > 0) return refs
        }
      }
      return []
    }
    try {
      const liveRefs = scan(agent.session?.events)
      if (liveRefs.length > 0) return liveRefs
      const snapshot = await ctx.sessionQuery.readSession(agent.id)
      return scan(snapshot?.events)
    } catch {
      return []
    }
  }

  async function attachmentToDataUrl(ref) {
    const stored = await ctx.attachments.readImage(ref)
    const mediaType = stored?.ref?.mediaType || ref.mediaType || 'image/png'
    const width = stored?.ref?.width ?? ref.width
    const height = stored?.ref?.height ?? ref.height
    const out = { dataUrl: `data:${mediaType};base64,${bytesToBase64(stored.data)}`, label: ref.name || String(ref.attachmentId || '') }
    if (Number.isInteger(width) && width > 0) out.width = width
    if (Number.isInteger(height) && height > 0) out.height = height
    return out
  }

  async function fileToDataUrl(path) {
    const target = await ctx.fs.resolve(path)
    const info = await ctx.fs.stat(target)
    if (!info) throw new Error(`图片文件不存在: ${path}`)
    const bytes = await ctx.fs.readBytes(target, undefined, 20 * 1024 * 1024)
    return { dataUrl: `data:${mimeForPath(path)};base64,${bytesToBase64(bytes)}`, label: path }
  }

  async function resolveExplicitSources(sources) {
    const images = []
    for (const value of Array.isArray(sources) ? sources : []) {
      const source = String(value || '').trim()
      if (!source) continue
      if (source.startsWith('data:image/')) images.push({ dataUrl: source, label: 'data URI' })
      else if (/^https?:\/\//i.test(source)) images.push({ dataUrl: source, label: source })
      else images.push(await fileToDataUrl(source))
    }
    return images
  }

  async function resolveVisionSources(args, exec) {
    const explicit = await resolveExplicitSources(args.images)
    if (explicit.length > 0) return explicit
    const refs = await findPastedImageRefs(exec)
    if (refs.length === 0) throw new Error('没有找到可识别的图片：请在对话框中直接粘贴/发送图片，或通过 images 参数给出本地绝对路径或 http(s) URL。')
    return Promise.all(refs.map(attachmentToDataUrl))
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'global-multimodal',
    order: 200,
    text: [
      '多模态能力（所有会话模式可用）：',
      '- 识图/OCR/图片问答使用 vision。省略 images 时，它会自动读取本会话最近一次粘贴或发送的图片（跨轮次可读）。',
      '- 生图/改图使用 generate_image。省略 references 时，它会自动使用本会话最近一次粘贴/发送的图片作为参考；没有图片时执行文生图。',
      '- 在原生/标准工具模式中可直接调用这两个工具。若当前只有 run_code 可直接调用（Code Mode），必须在 run_code 程序内使用 await tools.vision({...}) 或 await tools.generate_image({...})；不要直接发起 vision/generate_image 工具调用。',
      '- 一次成功调用后直接使用结果，不要反复识别、重试或额外验收。',
      '- 脚本生成图表、截图等本地图片文件，用 show_image(path) 把图片直接展示在对话输出里（多张用 paths 列表一次展示）；不要只描述文件路径。',
    ].join('\n'),
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'vision',
    description: '使用全局视觉模型识别、OCR、分析或比较图片。省略 images 时自动读取当前轮用户最新粘贴/发送的图片；也可传本地绝对路径、data URI 或 http(s) URL。',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '用户对图片的真实问题。' },
        images: { type: 'array', items: { type: 'string' }, description: '可选图片来源列表。省略时自动读取本会话最近一次粘贴或发送的图片（跨轮次可读）。' },
        detail: { type: 'string', enum: ['auto', 'low', 'high'], description: '图片细节级别；OCR/图表建议 high。' },
        max_tokens: { type: 'integer', minimum: 1, maximum: 8192, description: '最大输出 token，默认 2048。' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { content: { type: 'string' }, model: { type: 'string' } }, required: ['content', 'model'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: value?.content || '' }],
    },
    timeoutMs: 360000,
    async execute(args, exec) {
      const config = loadConfig()
      if (!config.visionEnabled) throw new Error('视觉通道已停用，请前往“设置 → 多模态”启用')
      requireChannelConfig('vision', config)
      const apiKey = await resolveCredential('vision')
      const images = await resolveVisionSources(args, exec)
      const result = await runHelper({ kind: 'vision', apiKey, baseUrl: config.visionBaseUrl, model: config.visionModel, prompt: args.prompt, images, detail: args.detail || '', maxTokens: args.max_tokens || 2048, timeoutMs: 300000 }, exec?.signal)
      return { content: result.content, model: result.model || config.visionModel }
    },
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'generate_image',
    description: '使用全局生图模型生成或编辑图片。省略 references 时自动使用本会话最近一次粘贴/发送的图片作为参考；没有图片时执行文生图。',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '简洁明确的生图或改图提示词。' },
        references: { type: 'array', items: { type: 'string' }, description: '可选参考图列表：本地绝对路径、data URI 或 URL。' },
        size: { type: 'string', description: '输出尺寸，默认 2K。' },
        count: { type: 'integer', minimum: 1, maximum: 4, description: '生成数量，默认 1，最多 4。' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { attachmentId: { type: 'string' }, mediaType: { type: 'string' }, name: { type: 'string' }, width: { type: 'integer' }, height: { type: 'integer' }, bytes: { type: 'integer' } },
              required: ['attachmentId', 'mediaType', 'name'],
              additionalProperties: false,
            },
          },
          prompt: { type: 'string' },
        },
        required: ['images', 'prompt'],
        additionalProperties: false,
      },
      render: (_args, value) => {
        const blocks = [{ type: 'text', text: `已生成 ${Array.isArray(value?.images) ? value.images.length : 0} 张图片。` }]
        for (const image of Array.isArray(value?.images) ? value.images : []) {
          blocks.push({ type: 'image', attachment: { attachmentId: image.attachmentId, mediaType: image.mediaType, ...image.width !== undefined ? { width: image.width } : {}, ...image.height !== undefined ? { height: image.height } : {}, ...image.bytes !== undefined ? { bytes: image.bytes } : {}, ...image.name !== undefined ? { name: image.name } : {} } })
        }
        return blocks
      },
      presentationMeta: (_args, value) => ({ images: Array.isArray(value?.images) ? value.images : [] }),
    },
    timeoutMs: 360000,
    async execute(args, exec) {
      const config = loadConfig()
      if (!config.generationEnabled) throw new Error('生图通道已停用，请前往“设置 → 多模态”启用')
      requireChannelConfig('generation', config)
      const apiKey = await resolveCredential('generation')
      let references = await resolveExplicitSources(args.references)
      if (references.length === 0) references = await Promise.all((await findPastedImageRefs(exec)).map(attachmentToDataUrl))
      const outputTarget = await ctx.fs.resolve(`${workspaceBase(exec)}/imgs`)
      const result = await runHelper({ kind: 'gen', apiKey, baseUrl: config.generationBaseUrl, model: config.generationModel, prompt: args.prompt, references, size: resolveGenSize(args.size, references), count: Math.min(Math.max(args.count || 1, 1), 4), outDir: ctx.fs.processPath(outputTarget), timeoutMs: 180000 }, exec?.signal)
      const images = []
      for (let index = 0; index < result.images.length; index += 1) {
        const generated = result.images[index]
        const ref = await ctx.attachments.saveImage({ data: base64ToBytes(generated.base64), mediaType: generated.mime, name: `generated-${index + 1}` })
        const image = { attachmentId: String(ref.attachmentId), mediaType: ref.mediaType, name: ref.name || `generated-${index + 1}` }
        if (Number.isInteger(ref.width)) image.width = ref.width
        if (Number.isInteger(ref.height)) image.height = ref.height
        if (Number.isInteger(ref.bytes)) image.bytes = ref.bytes
        images.push(image)
      }
      return { images, prompt: args.prompt }
    },
  }))

  // show_image: surface a local image file (e.g. a script-generated chart, a
  // screenshot) inline in the assistant output. Unlike the harness read_image
  // tool, this carries no image-capability gate, so a text-only model can
  // display images it produced during the turn. The presentationMeta carries
  // the attachment refs so the multimodal client's GenerateImageRow
  // renders them inline under the tool call.
  ctx.effect(() => ctx.tools.register({
    name: 'show_image',
    description: '把本地图片文件（如脚本生成的图表、截图）直接展示在对话输出里。传入本地绝对路径；多张图片用 paths 列表一次展示。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '本地图片文件的绝对路径，支持 PNG/JPEG/WebP/GIF。与 paths 可同时使用。' },
        paths: { type: 'array', items: { type: 'string' }, description: '可选：多张本地图片的绝对路径列表，一次展示多图。' },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { attachmentId: { type: 'string' }, mediaType: { type: 'string' }, name: { type: 'string' }, width: { type: 'integer' }, height: { type: 'integer' }, bytes: { type: 'integer' } },
              required: ['attachmentId', 'mediaType', 'name'],
              additionalProperties: false,
            },
          },
          paths: { type: 'array', items: { type: 'string' } },
        },
        required: ['images', 'paths'],
        additionalProperties: false,
      },
      render: (_args, value) => {
        const blocks = [{ type: 'text', text: `已展示 ${Array.isArray(value?.images) ? value.images.length : 0} 张图片。` }]
        // Also emit the image block into the tool-result content so the
        // api-proxy attachment-read authorization (imageInEvent) can see the
        // ref — meta.images alone is not scanned for authorization, so the
        // client's readAttachment would otherwise hang on "loading".
        for (const image of Array.isArray(value?.images) ? value.images : []) {
          blocks.push({ type: 'image', attachment: { attachmentId: image.attachmentId, mediaType: image.mediaType, ...image.width !== undefined ? { width: image.width } : {}, ...image.height !== undefined ? { height: image.height } : {}, ...image.bytes !== undefined ? { bytes: image.bytes } : {}, ...image.name !== undefined ? { name: image.name } : {} } })
        }
        return blocks
      },
      presentationMeta: (_args, value) => ({ images: Array.isArray(value?.images) ? value.images : [] }),
    },
    timeoutMs: 60000,
    async execute(args, exec) {
      // Collect paths from both `path` (single) and `paths` (list); dedupe
      // while keeping the original order.
      const sources = []
      if (typeof args.path === 'string' && args.path.trim() !== '') sources.push(args.path.trim())
      for (const value of Array.isArray(args.paths) ? args.paths : []) {
        const source = String(value || '').trim()
        if (source !== '') sources.push(source)
      }
      const unique = [...new Set(sources)]
      if (unique.length === 0) throw new Error('请提供 path（单张）或 paths（多张）本地图片路径')
      const images = []
      for (const source of unique) {
        const mediaType = mimeForPath(source)
        const target = await ctx.fs.resolve(source)
        const info = await ctx.fs.stat(target)
        if (!info) throw new Error(`图片文件不存在: ${source}`)
        const bytes = await ctx.fs.readBytes(target, exec?.signal, 20 * 1024 * 1024)
        const ref = await ctx.attachments.saveImage({ data: bytes, mediaType, name: source.replace(/^.*[\\\/]/, '') })
        const image = { attachmentId: String(ref.attachmentId), mediaType: ref.mediaType, name: ref.name || source.replace(/^.*[\\\/]/, '') }
        if (Number.isInteger(ref.width)) image.width = ref.width
        if (Number.isInteger(ref.height)) image.height = ref.height
        if (Number.isInteger(ref.bytes)) image.bytes = ref.bytes
        images.push(image)
      }
      return { images, paths: unique }
    },
  }))}
