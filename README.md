# 多模态插件（DeepSeek Harness）

DeepSeek Harness 的多模态 host 插件：给文本模型补全视觉与生图能力，不改动 harness 源码。

| 插件 | 作用 |
|------|------|
| `dsh-global-multimodal` | vision 识图 + generate_image 生图/改图（含参考图比例匹配）+ show_image 展示（支持多张）+ 纯文本模型 image-strip 适配 |

## 目录结构

```
多模态插件/
├── dsh-global-multimodal/
│   ├── index.mjs              # host 插件主逻辑（工具注册、llm/stream 适配、参考图比例匹配）
│   ├── multimodal-helper.cjs  # node 子进程：发火山方舟 vision/generation 请求
│   ├── package.json
│   └── README.md
├── .gitignore
├── LICENSE
└── README.md
```

## 安装

把 `dsh-global-multimodal/` 放到 `~/.dsh/plugins/` 下，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加挂载行：

```yaml
- insert:
    - id: global-multimodal-host
      name: file:///C:/Users/<you>/.dsh/plugins/dsh-global-multimodal/index.mjs
```

重启 `dsh web` 生效（PowerShell，从 harness 树 `corepack pnpm dsh web`）。

> 待 `package.json` 的 `dsh` 元数据字段按 dsh 插件规范确认后，也可用 `corepack pnpm dsh plugin --profile web add <github-url>` 安装。

## 配置凭据

火山方舟 API Key 分两个，写在 `~/.dsh/.credentials.yaml`：

- `DSH_VISION_API_KEY` — 视觉模型
- `DSH_GENERATION_API_KEY` — 生图模型

也可在 web UI「设置 → 多模态」填。本开源包不含凭据与运行时配置（`global-multimodal-config.json`），首次运行用默认配置。

## 与其他多模态 skill 冲突？

本插件不干预任何已有 skill。如果你的环境里另有同用途的多模态 skill（例如经 cc-switch 共享 skill 目录挂进来的 `doubao-multimodal`），模型会同时看到两套入口。DSH 没有配置级的 per-skill 禁用开关；如需只在 DSH harness 内禁用某个 skill，可写一个 host 插件用 `ctx.skills.register` 注册同名 runtime skill 并设 `invocation: { modelInvocable: false, userInvocable: false }`——同 layer 内 runtime（rank 250）先于 custom（rank 300）被收集，同名 custom skill 会被忽略，其他 agent（claude/codex 等）不受影响。

## 上游待办

- **turn-tail 图集留白修复**在 harness 官方 client 包 `@deepseek-ai/dsh-client-ui-doubao-multimodal`（`packages/client/ui-doubao-multimodal/src/client/GenerateImageRow.module.css`）内，**不在本仓库**。修复为 `.image` 加 `align-self: flex-start`。建议提 PR 给 `deepseek-ai/deepseek-harness` 上游；合并前用户需手动应用补丁或等上游。

## License

MIT
