# dsh-multimodal

DeepSeek Harness 的多模态 host 插件：给文本模型补全视觉与生图能力，不改动 harness 源码。

## 功能

- **vision** — 识图 / OCR / 图表理解 / 多图比较 / 视觉问答。省略 `images` 时自动读取本会话最近一次粘贴或发送的图片（跨轮可读）。
- **generate_image** — 文生图 / 参考图编辑（P图）。省略 `references` 时自动用本会话最近一次图片作参考。
  - **参考图比例匹配**：有参考图且未显式传 `WIDTHxHEIGHT` 时，读参考图宽高比，从豆包 Seedream 该档（2K/3K）官方推荐像素表里按对数距离选最近的 `WIDTHxHEIGHT` 传 API——新图严格匹配参考图比例，不再固定 2K 出方图。
- **show_image** — 把本地图片文件（脚本生成的图表、截图等）直接展示在对话输出里。传 `path`（单张）或 `paths`（多张列表）。对纯文本模型也可用（无 `read_image` 的 image-capable 闸）。
- **llm/stream text-only 适配** — 纯文本模型收到带图消息时，在 adapter 边界把图片替换为内联提示（`[本条消息含 N 张图片，请调用 vision 工具]`），仅改模型请求、不碰 durable 日志，图片在浏览器照常显示。

## 工具

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| `vision` | 识图/问答 | `prompt`（必填）、`images`（可省，自动读最近图）、`detail`、`max_tokens` |
| `generate_image` | 生图/改图 | `prompt`（必填）、`references`（可省，自动用最近图）、`size`（默认 2K）、`count`（1-4） |
| `show_image` | 展示本地图 | `path`（单张，本地绝对路径）、`paths`（多张列表，二选一或同时） |

## 安装

### 方式 A：dsh plugin add（推荐，待 package.json 的 dsh 字段按规范确认后）

```sh
corepack pnpm dsh plugin --profile web add <github-url-of-this-repo>
```

### 方式 B：file:// 挂载（当前可用）

把 `index.mjs` + `multimodal-helper.cjs` 放到 `~/.dsh/plugins/dsh-multimodal/`，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加：

```yaml
- id: multimodal-host
  name: file:///C:/Users/<you>/.dsh/plugins/dsh-multimodal/index.mjs
```

重启 `dsh web` 生效。

## 配置

- **凭据**：视觉与生图两个通道各一个 API Key，写在 `~/.dsh/.credentials.yaml`：
  - `DSH_VISION_API_KEY` — 视觉模型
  - `DSH_GENERATION_API_KEY` — 生图模型
- **模型/端点**：两个通道的模型 ID 与 Base URL 均可配置，支持任何 OpenAI 兼容端点（Gemini、GPT、豆包等）。默认为火山方舟豆包（vision `doubao-seed-2-1-pro-260628`、generation `doubao-seedream-5-0-260128`、baseUrl `https://ark.cn-beijing.volces.com/api/v3`），见 `index.mjs` 的 `DEFAULT_CONFIG`。运行时配置写在插件目录的 `global-multimodal-config.json`（首次运行自动用默认生成），需要换模型/端点时直接编辑该文件。
- 本开源包**不含** `global-multimodal-config.json` 与凭据，首次运行用默认配置。

## 依赖

- **helper 子进程**：`multimodal-helper.cjs` 由 `index.mjs` 用 node 子进程调用，向所配置的 OpenAI 兼容端点发 `chat/completions`（vision）与 `images/generations`（generate_image）请求，默认火山方舟豆包，可在配置中替换。无需额外依赖，标准 Node 内置 `fetch`。
- **配套 client 插件**：同仓库的 [`dsh-multimodal-client`](../dsh-multimodal-client/) 渲染 `generate_image`/`show_image` 的工具卡内联图与 turn-tail 图集，并提供「设置 → 多模态」设置页。可选：未安装时 `vision` 的文本结果不受影响，工具结果中的图片以通用卡片显示（附件引用完整，模型可正常引用），配置需手编文件。

## 已知问题

- 参考图尺寸解析覆盖 PNG/JPEG/GIF；WebP 参考图读不到尺寸时 fallback 回档位（保持原行为）。

## License

MIT
