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

file:// 挂载（host 唯一支持的安装方式）：

把 `index.mjs` + `multimodal-helper.cjs` 放到 `~/.dsh/plugins/dsh-multimodal/`，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加：

```yaml
- id: multimodal-host
  name: file:///C:/Users/<you>/.dsh/plugins/dsh-multimodal/index.mjs
```

重启 `dsh web` 生效。

> 不走 pnpm 依赖安装是有意的：运行时配置 `global-multimodal-config.json` 写在插件目录，放 `~/.dsh/plugins/` 才不会被 profile 重装清掉。host 侧的服务依赖由 `index.mjs` 的 `export const inject` 声明，无需 package.json 元数据。

## 必需的 harness 补丁：modality guard 豁免

官方 harness 的 api-proxy 有模态守卫：纯文本模型的会话里粘贴/发送图片会被直接拒绝（提示「当前模型不支持图片，请切换支持图片的模型」），图片进不了会话，vision 也就读不到它。要启用「贴图 → vision 自动识别」链路，需给 harness 源码树打上本仓库附带的小补丁：

```sh
# 在 harness 源码树根（packages/ 的上级）执行
git apply <本仓库路径>/patches/apiproxy-modality-guard.patch
```

补丁做的事：api-proxy 在图片准入守卫（两处：prompt 提交与模型切换）追加 `ctx.get('globalMultimodal').visionEnabled()` 检查——本插件挂载且视觉通道启用时放行图片进入会话；图片随后由插件的 llm/stream 适配替换为文字提示，不会真的发给文本模型。守卫其余行为不变（未挂载本插件时与原版完全一致）。

- **不打补丁的降级行为**：贴图被 harness 拒绝；`vision` 仍可通过 `images` 参数识别本地路径 / URL / data URI 的图片；文生图与 `show_image` 完全不受影响。
- 补丁基于上游 master（2026-08-20）验证。harness 升级后若 `git apply` 因上下文漂移失败，手动改法：在 `packages/host/apiproxy/src/api-proxy.ts` 找到两处 `inputModalities !== undefined && !…includes('image')` 守卫条件，各追加 `&& !multimodalVisionActive(ctx)`，再把 patch 文件里的 `multimodalVisionActive` 函数复制到该文件顶部。

## 配置

- **凭据**：视觉与生图两个通道各一个 API Key，写在 `~/.dsh/.credentials.yaml`：
  - `DSH_VISION_API_KEY` — 视觉模型
  - `DSH_GENERATION_API_KEY` — 生图模型
- **模型/端点**：两个通道的模型 ID 与 Base URL 均可配置，支持任何 OpenAI 兼容端点（Gemini、GPT、豆包等），**不预置任何默认值**——首次使用需先在设置页（或配置文件）填写，填好前工具调用会提示未配置。运行时配置写在插件目录的 `global-multimodal-config.json`（首次运行自动生成空配置）。
- 本开源包**不含** `global-multimodal-config.json` 与凭据。

## 依赖

- **helper 子进程**：`multimodal-helper.cjs` 由 `index.mjs` 用 node 子进程调用，向所配置的 OpenAI 兼容端点发 `chat/completions`（vision）与 `images/generations`（generate_image）请求。无需额外依赖，标准 Node 内置 `fetch`。
- **配套 client 插件**：同仓库的 [`dsh-multimodal-client`](../dsh-multimodal-client/) 渲染 `generate_image`/`show_image` 的工具卡内联图与 turn-tail 图集，并提供「设置 → 多模态」设置页。可选：未安装时 `vision` 的文本结果不受影响，工具结果中的图片以通用卡片显示（附件引用完整，模型可正常引用），配置需手编文件。

## 已知问题

- 参考图尺寸解析覆盖 PNG/JPEG/GIF；WebP 参考图读不到尺寸时 fallback 回档位（保持原行为）。

## harness 附件尺寸上限（重要）

新版 harness 的附件存储默认限制**单边 2000px**（`attachment-local` 服务的 `maxImageDimension`，引入原因是模型路由会拒绝多图请求中超 2000px 的历史图片；旧版 harness 无此限制）。本插件默认生成 2K/3K 尺寸，必然超过该上限，因此：

- **generate_image**：生成照常成功、文件照常写入 `<workspace>/imgs/`；超限图片无法内联展示时，结果降级为返回文件路径（`files` 字段）并附配置提示——**不会**让工具调用失败，模型也不会因此重试。
- **show_image**：展示超限图片时报错并给出实际尺寸、上限值与配置方法。
- 贴图本身也受此限制（harness 层行为）：单边超 2000px 的图会被拒入会话。

要内联展示 2K/3K 原尺寸，把 `~/.dsh/settings.yaml` 里 `attachment-local` 的上限调大后重启 `dsh web`：

```yaml
attachment-local:
  maxImageDimension: 4096   # 3K 档最大单边 4704，需全覆盖可设 4800
```

> 注意：调大后，会话中携带多张大图时可能触发模型路由的图片尺寸限制（该上限存在的原始原因），单图或少量图场景一般无碍。

## License

MIT
