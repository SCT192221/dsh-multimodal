# dsh-multimodal（DeepSeek Harness 多模态插件）

给 DeepSeek Harness 的文本模型补全视觉与生图能力，不改动 harness 源码。两个包配套使用：

| 包 | 类型 | 作用 |
|------|------|------|
| `dsh-multimodal` | host 插件 | vision 识图 + generate_image 生图/改图（含参考图比例匹配）+ show_image 展示（支持多张）+ 纯文本模型 image-strip 适配 + `/global-multimodal/*` 配置路由 |
| `dsh-multimodal-client` | client 插件 | 工具卡内联图 + turn-tail 图集 + 「设置 → 多模态」设置页（模型/端点/API Key/连接测试） |

> 只装 host 也能用：工具全部可用，图片以通用卡片显示、配置走手编文件；装上 client 才有图片渲染和设置页。

## 目录结构

```
dsh-multimodal/
├── dsh-multimodal/              # host 插件（file:// 挂载）
│   ├── index.mjs
│   ├── multimodal-helper.cjs
│   ├── package.json
│   └── README.md
├── dsh-multimodal-client/       # client 插件（pnpm 依赖安装，lib/ 已构建）
│   ├── src/                     # 源码（TS + CSS Modules）
│   ├── lib/                     # 构建产物（已提交，装完即用）
│   ├── package.json
│   └── README.md
├── .gitignore
├── LICENSE
└── README.md
```

## 安装

### 1. host 插件（`dsh-multimodal`）

把 `dsh-multimodal/` 目录放到 `~/.dsh/plugins/` 下，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加挂载行：

```yaml
- insert:
    - id: multimodal-host
      name: file:///C:/Users/<you>/.dsh/plugins/dsh-multimodal/index.mjs
```

> host 走 file:// 挂载而非 pnpm 依赖，是为了让运行时配置 `global-multimodal-config.json` 稳定存在插件目录（node_modules 里的依赖每次重装会被清掉）。

### 2. client 插件（`dsh-multimodal-client`）

```sh
corepack pnpm dsh plugin --profile web add github:SCT192221/dsh-multimodal#path:/dsh-multimodal-client
```

或手动：在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加 `"dsh-multimodal-client": "github:SCT192221/dsh-multimodal#path:/dsh-multimodal-client"`，`dsh.profile.bundles` 数组加 `"dsh-multimodal-client"`，profile 目录跑 `corepack pnpm install`。

> 包内已提交构建产物 `lib/` 且无 prepare 脚本，不会触发 pnpm 11 的 git-allowBuilds 闸门。

两步都完成后重启 `dsh web` 生效。

## 配置凭据

火山方舟 API Key 分两个，写在 `~/.dsh/.credentials.yaml`：

- `DSH_VISION_API_KEY` — 视觉模型
- `DSH_GENERATION_API_KEY` — 生图模型

装了 client 插件后在 web UI「设置 → 多模态」里填即可；没装 client 手编 `~/.dsh/.credentials.yaml`。本开源包不含凭据与运行时配置（`global-multimodal-config.json`），首次运行用默认配置；需要换模型/端点时在设置页改，或直接编辑插件目录下自动生成的 `global-multimodal-config.json`。

## 与其他多模态 skill 冲突？

本插件不干预任何已有 skill。如果你的环境里另有同用途的多模态 skill（例如经 cc-switch 共享 skill 目录挂进来的 `doubao-multimodal`），模型会同时看到两套入口。DSH 没有配置级的 per-skill 禁用开关；如需只在 DSH harness 内禁用某个 skill，可写一个 host 插件用 `ctx.skills.register` 注册同名 runtime skill 并设 `invocation: { modelInvocable: false, userInvocable: false }`——同 layer 内 runtime（rank 250）先于 custom（rank 300）被收集，同名 custom skill 会被忽略，其他 agent（claude/codex 等）不受影响。

## License

MIT
