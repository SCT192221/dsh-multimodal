/** Multimodal settings: independent visual and image-generation channels. */
import { useEffect, useState } from 'react'
import css from './MultimodalSettingsSection.module.css'

type Channel = 'vision' | 'generation'

interface CredentialInfo {
  configured: boolean
  source?: string
  writable: boolean
}

interface PublicConfig {
  visionEnabled: boolean
  visionModel: string
  visionBaseUrl: string
  generationEnabled: boolean
  generationModel: string
  generationBaseUrl: string
  credentials?: { vision: CredentialInfo; generation: CredentialInfo }
}

interface Draft extends Omit<PublicConfig, 'credentials'> {
  visionApiKey: string
  generationApiKey: string
}

type Operation = 'save' | 'test' | 'clear' | null

// No vendor defaults: model and base URL start empty and must be filled in
// with any OpenAI-compatible endpoint before the channel is usable.
const DEFAULTS: Omit<PublicConfig, 'credentials'> = {
  visionEnabled: true,
  visionModel: '',
  visionBaseUrl: '',
  generationEnabled: true,
  generationModel: '',
  generationBaseUrl: '',
}

const EMPTY_DRAFT: Draft = { ...DEFAULTS, visionApiKey: '', generationApiKey: '' }
const EMPTY_CREDENTIAL: CredentialInfo = { configured: false, writable: true }

function channelLabel(channel: Channel): string {
  return channel === 'vision' ? '视觉模型' : '生图模型'
}

function getErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
  return body
}

/** Render two independent multimodal channel cards. */
export function MultimodalSettingsSection(): React.ReactNode {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [credentials, setCredentials] = useState<Required<PublicConfig>['credentials']>({
    vision: EMPTY_CREDENTIAL,
    generation: EMPTY_CREDENTIAL,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [operations, setOperations] = useState<Record<Channel, Operation>>({ vision: null, generation: null })
  const [messages, setMessages] = useState<Record<Channel, { kind: 'success' | 'error'; text: string } | null>>({ vision: null, generation: null })

  useEffect(() => {
    let cancelled = false
    requestJson('/global-multimodal/config')
      .then((value) => {
        if (cancelled) return
        const config = value as PublicConfig
        setDraft({
          visionEnabled: config.visionEnabled,
          visionModel: config.visionModel,
          visionBaseUrl: config.visionBaseUrl,
          generationEnabled: config.generationEnabled,
          generationModel: config.generationModel,
          generationBaseUrl: config.generationBaseUrl,
          visionApiKey: '',
          generationApiKey: '',
        })
        setCredentials({
          vision: config.credentials?.vision ?? EMPTY_CREDENTIAL,
          generation: config.credentials?.generation ?? EMPTY_CREDENTIAL,
        })
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(`读取多模态配置失败：${getErrorMessage(error)}`)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function update(channel: Channel, field: keyof Draft, value: string | boolean): void {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setMessages((previous) => ({ ...previous, [channel]: null }))
  }

  function setOperation(channel: Channel, operation: Operation): void {
    setOperations((previous) => ({ ...previous, [channel]: operation }))
  }

  function syncPublicConfig(value: PublicConfig): void {
    setCredentials({
      vision: value.credentials?.vision ?? EMPTY_CREDENTIAL,
      generation: value.credentials?.generation ?? EMPTY_CREDENTIAL,
    })
    setDraft((previous) => ({
      ...previous,
      visionEnabled: value.visionEnabled,
      visionModel: value.visionModel,
      visionBaseUrl: value.visionBaseUrl,
      generationEnabled: value.generationEnabled,
      generationModel: value.generationModel,
      generationBaseUrl: value.generationBaseUrl,
    }))
  }

  async function save(channel: Channel): Promise<void> {
    setOperation(channel, 'save')
    setMessages((previous) => ({ ...previous, [channel]: null }))
    try {
      const model = (channel === 'vision' ? draft.visionModel : draft.generationModel).trim()
      const baseUrl = (channel === 'vision' ? draft.visionBaseUrl : draft.generationBaseUrl).trim()
      const enabled = channel === 'vision' ? draft.visionEnabled : draft.generationEnabled
      if (enabled && (model === '' || baseUrl === '')) {
        throw new Error('已启用的通道需填写模型 ID 与 Base URL')
      }
      const saved = await requestJson('/global-multimodal/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visionEnabled: draft.visionEnabled,
          visionModel: draft.visionModel,
          visionBaseUrl: draft.visionBaseUrl,
          generationEnabled: draft.generationEnabled,
          generationModel: draft.generationModel,
          generationBaseUrl: draft.generationBaseUrl,
        }),
      }) as PublicConfig
      const key = channel === 'vision' ? draft.visionApiKey.trim() : draft.generationApiKey.trim()
      if (key) {
        await requestJson('/global-multimodal/credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, apiKey: key }),
        })
      }
      const refreshed = key ? await requestJson('/global-multimodal/config') as PublicConfig : saved
      syncPublicConfig(refreshed)
      setDraft((previous) => ({
        ...previous,
        [channel === 'vision' ? 'visionApiKey' : 'generationApiKey']: '',
      }))
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'success', text: '已保存，下一次调用立即生效。' } }))
    } catch (error: unknown) {
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'error', text: `保存失败：${getErrorMessage(error)}` } }))
    } finally {
      setOperation(channel, null)
    }
  }

  async function test(channel: Channel): Promise<void> {
    setOperation(channel, 'test')
    setMessages((previous) => ({ ...previous, [channel]: null }))
    try {
      const apiKey = channel === 'vision' ? draft.visionApiKey.trim() : draft.generationApiKey.trim()
      const payload = channel === 'vision'
        ? { channel, apiKey, model: draft.visionModel, baseUrl: draft.visionBaseUrl }
        : { channel, apiKey, model: draft.generationModel, baseUrl: draft.generationBaseUrl }
      const result = await requestJson('/global-multimodal/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }) as { message?: string }
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'success', text: result.message || '连接正常。' } }))
    } catch (error: unknown) {
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'error', text: `连接失败：${getErrorMessage(error)}` } }))
    } finally {
      setOperation(channel, null)
    }
  }

  async function clearCredential(channel: Channel): Promise<void> {
    setOperation(channel, 'clear')
    setMessages((previous) => ({ ...previous, [channel]: null }))
    try {
      await requestJson('/global-multimodal/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, clear: true }),
      })
      setCredentials((previous) => ({ ...previous, [channel]: EMPTY_CREDENTIAL }))
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'success', text: '已清除该通道的 API Key。' } }))
    } catch (error: unknown) {
      setMessages((previous) => ({ ...previous, [channel]: { kind: 'error', text: `清除失败：${getErrorMessage(error)}` } }))
    } finally {
      setOperation(channel, null)
    }
  }

  function renderChannel(channel: Channel): React.ReactNode {
    const vision = channel === 'vision'
    const enabled = vision ? draft.visionEnabled : draft.generationEnabled
    const model = vision ? draft.visionModel : draft.generationModel
    const baseUrl = vision ? draft.visionBaseUrl : draft.generationBaseUrl
    const key = vision ? draft.visionApiKey : draft.generationApiKey
    const operation = operations[channel]
    const message = messages[channel]
    const info = credentials[channel]
    return (
      <article className={css.card} data-enabled={enabled ? 'true' : 'false'}>
        <header className={css.cardHeader}>
          <div>
            <h3 className={css.cardTitle}>{channelLabel(channel)}</h3>
            <p className={css.cardSubtitle}>{vision ? '图片识别、OCR、图表与界面分析' : '文生图、参考图编辑与图片生成'}</p>
          </div>
          <label className={css.switchLabel}>
            <input
              className={css.switchInput}
              type="checkbox"
              checked={enabled}
              onChange={(event) => { update(channel, vision ? 'visionEnabled' : 'generationEnabled', event.target.checked) }}
              aria-label={`${channelLabel(channel)}${enabled ? '已启用' : '已停用'}`}
            />
            <span className={css.switchTrack} aria-hidden="true"><span className={css.switchThumb} /></span>
            <span className={css.switchText}>{enabled ? '已启用' : '已停用'}</span>
          </label>
        </header>

        <div className={css.fields}>
          <label className={css.field}>
            <span className={css.fieldLabel}>模型 ID</span>
            <input className={css.input} value={model} spellCheck={false} placeholder="填写模型 ID" onChange={(event) => { update(channel, vision ? 'visionModel' : 'generationModel', event.target.value) }} />
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>Base URL</span>
            <input className={css.input} value={baseUrl} spellCheck={false} placeholder="填写 Base URL（OpenAI 兼容端点，如 https://api.example.com/v3）" onChange={(event) => { update(channel, vision ? 'visionBaseUrl' : 'generationBaseUrl', event.target.value) }} />
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>API Key</span>
            <input
              className={css.input}
              type="password"
              value={key}
              autoComplete="new-password"
              placeholder={info.configured ? '已配置，留空保持不变' : '填写后保存到本机凭据'}
              onChange={(event) => { update(channel, vision ? 'visionApiKey' : 'generationApiKey', event.target.value) }}
            />
          </label>
        </div>

        {info.configured && info.writable ? (
          <button className={css.clearButton} type="button" disabled={operation !== null} onClick={() => { void clearCredential(channel) }}>
            清除已保存 API Key
          </button>
        ) : null}
        <footer className={css.actions}>
          <button className={css.secondaryButton} type="button" disabled={operation !== null || loading || model.trim() === '' || baseUrl.trim() === ''} title={model.trim() === '' || baseUrl.trim() === '' ? '请先填写模型 ID 与 Base URL' : undefined} onClick={() => { void test(channel) }}>
            {operation === 'test' ? '测试中…' : '测试连接'}
          </button>
          <button className={css.primaryButton} type="button" disabled={operation !== null || loading} onClick={() => { void save(channel) }}>
            {operation === 'save' ? '保存中…' : '保存配置'}
          </button>
        </footer>
        {message ? <p className={css.message} data-state={message.kind} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      </article>
    )
  }

  if (loading) return <div className={css.section}><p className={css.loading}>正在读取多模态配置…</p></div>
  if (loadError) return <div className={css.section}><p className={css.message} data-state="error" role="alert">{loadError}</p></div>
  return (
    <section className={css.section}>
      <div className={css.headingBlock}>
        <h2 className={css.heading}>多模态</h2>
        <p className={css.intro}>视觉与生图工具可在所有会话模式中使用。两种模型分别配置 API Key，密钥仅保存在 Harness 本机凭据中。</p>
      </div>
      <div className={css.grid}>
        {renderChannel('vision')}
        {renderChannel('generation')}
      </div>
    </section>
  )
}
