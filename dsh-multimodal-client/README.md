# dsh-multimodal-client

DeepSeek Harness 的多模态 client 插件（`dsh-multimodal` host 插件的配套 UI），把工具产出的图片渲染成真正的图片，而不是一坨 JSON。

## 功能

- **工具卡内联图**（`GenerateImageRow`）— `generate_image` / `show_image` 的工具调用卡里直接渲染生成的图片（读 `block.meta.images` 的附件引用）。
- **turn-tail 图集**（`TurnImages`）— 一轮对话结束时，把本轮产出的**所有**图片汇成画廊，渲染在结尾消息下方（经 `ConversationNodeDefinition` 从 `tool/result` 事件累积）。
- **设置页**（`MultimodalSettingsSection`）— web UI「设置 → 多模态」：视觉/生图两个通道的启用开关、模型 ID、Base URL、API Key（写入 harness 本机凭据，不落明文文件）、连接测试。数据走 host 插件的 `/global-multimodal/*` 路由。

## 前置

必须先安装 host 插件 [`dsh-multimodal`](../dsh-multimodal/)（提供 vision / generate_image / show_image 工具与 `/global-multimodal/*` 路由）。本 client 包只做渲染与设置 UI。

## 安装

### 方式 A：dsh plugin add

```sh
corepack pnpm dsh plugin --profile web add github:SCT192221/dsh-multimodal#path:/dsh-multimodal-client
```

包内 `cordis.patch.yml`（`dsh.bundle.patch`）会让命令自动把它加入 `dsh.profile.bundles` 并挂载。

### 方式 B：手动安装

在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加：

```json
"dsh-multimodal-client": "github:SCT192221/dsh-multimodal#path:/dsh-multimodal-client"
```

在 `dsh.profile.bundles` 数组加 `"dsh-multimodal-client"`，然后在 profile 目录跑 `corepack pnpm install`，重启 `dsh web`。

> 包内已提交构建产物 `lib/`，无 prepare 脚本，不会触发 pnpm 11 的 git-allowBuilds 闸门。

## 从源码构建

本包是 deepseek-harness 仓库树内的 client 包（tsconfig 引用 workspace 兄弟包），**必须在 harness checkout 内构建**：

1. 把本目录复制到 harness 树 `packages/client/ui-multimodal/`；
2. 在 harness 根目录 `corepack pnpm install --no-frozen-lockfile`；
3. `corepack pnpm --filter dsh-multimodal-client exec tsc -b tsconfig.json --force`；
4. `corepack pnpm --filter dsh-multimodal-client exec tsdown --env.DSH_BUILD_FACE client`。

产物在 `lib/`（`client.js` 是浏览器 bundle，CSS Modules 已内联）。

## 与 host 插件的契约

本 client 包与 host 插件之间只有三个稳定契约，其余互不感知：

| 契约 | 方向 |
|---|---|
| 工具名 `generate_image` / `show_image`（toolview 槽 key） | host 注册工具，client 注册视图 |
| 工具结果 `meta.images[].attachmentId` | host 产出，client 读取并经 sessions 鉴权拉图 |
| `/global-multimodal/config|credential|test` 路由 | host 提供，设置页调用 |

## License

MIT
