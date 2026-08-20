# dsh-multimodal（DeepSeek Harness 多模态插件）

DeepSeek Harness 的多模态 host 插件：给文本模型补全视觉与生图能力，不改动 harness 源码。

| 插件 | 作用 |
|------|------|
| `dsh-multimodal` | vision 识图 + generate_image 生图/改图（含参考图比例匹配）+ show_image 展示（支持多张）+ 纯文本模型 image-strip 适配 |

## 目录结构

```
dsh-multimodal/
├── dsh-multimodal/
│   ├── index.mjs              # host 插件主逻辑（工具注册、llm/stream 适配、参考图比例匹配）
│   ├── multimodal-helper.cjs  # node 子进程：发火山方舟 vision/generation 请求
│   ├── package.json
│   └── README.md
├── .gitignore
├── LICENSE
└── README.md
```

## 安装

把 `dsh-multimodal/` 放到 `~/.dsh/plugins/` 下，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加挂载行：

```yaml
- insert:
    - id: multimodal-host
      name: file:///C:/Users/<you>/.dsh/plugins/dsh-multimodal/index.mjs
```

重启 `dsh web` 生效（PowerShell，从 harness 树 `corepack pnpm dsh web`）。

> 待 `package.json` 的 `dsh` 元数据字段按 dsh 插件规范确认后，也可用 `corepack pnpm dsh plugin --profile web add <github-url>` 安装。

## 配置凭据

火山方舟 API Key 分两个，写在 `~/.dsh/.credentials.yaml`：

- `DSH_VISION_API_KEY` — 视觉模型
- `DSH_GENERATION_API_KEY` — 生图模型

本开源包不含凭据与运行时配置（`global-multimodal-config.json`），首次运行用默认配置；需要换模型/端点时直接编辑插件目录下自动生成的 `global-multimodal-config.json`。

## 与其他多模态 skill 冲突？

本插件不干预任何已有 skill。如果你的环境里另有同用途的多模态 skill（例如经 cc-switch 共享 skill 目录挂进来的 `doubao-multimodal`），模型会同时看到两套入口。DSH 没有配置级的 per-skill 禁用开关；如需只在 DSH harness 内禁用某个 skill，可写一个 host 插件用 `ctx.skills.register` 注册同名 runtime skill 并设 `invocation: { modelInvocable: false, userInvocable: false }`——同 layer 内 runtime（rank 250）先于 custom（rank 300）被收集，同名 custom skill 会被忽略，其他 agent（claude/codex 等）不受影响。

## 配套 client 组件（不在本仓库）

`generate_image`/`show_image` 的工具卡内联图（`GenerateImageRow`）与 turn-tail 图集（`TurnImages`）由配套 client 插件渲染（注册 `tool.call.toolview` 与 `conversation.chat.turnTail`），该组件目前未随本仓库发布。未安装时 `vision` 的文本结果不受影响，工具结果中的图片以通用卡片显示（附件引用完整，模型可正常引用）。turn-tail 图集留白修复（`.image` 加 `align-self: flex-start`）也在该组件内。

## License

MIT
