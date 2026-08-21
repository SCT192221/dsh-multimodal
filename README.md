# dsh-multimodal（DeepSeek Harness 多模态插件）

给 DeepSeek Harness 的文本模型补全视觉与生图能力，不改动 harness 源码。两个包配套使用：

| 包 | 类型 | 作用 |
|------|------|------|
| `dsh-multimodal` | host 插件 | vision 识图 + generate_image 生图/改图（含参考图比例匹配、超限自动缩放预览）+ show_image 展示（支持多张）+ 纯文本模型 image-strip 适配 + `/global-multimodal/*` 配置路由 |
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
├── patches/                     # harness 补丁（贴图识别所需，见安装第 3 步）
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

### 3. harness 补丁（贴图识别所需）

官方 harness 的模态守卫会在纯文本模型的会话里拒绝图片输入（「当前模型不支持图片，请切换支持图片的模型」），需再打一个小补丁才能贴图识图：

```sh
# 在 harness 源码树根（packages/ 的上级）执行
git apply <本仓库路径>/patches/apiproxy-modality-guard.patch
```

不打补丁时贴图会被拒，但 `vision` 传显式路径/URL、文生图、`show_image` 均正常。原理与手动改法详见 `dsh-multimodal/README.md`。

> **新版 harness 用户注意**：附件存储默认限制单边 2000px（`maxImageDimension`），2K/3K 生成图会超限。插件已做优雅降级（生成照常、原图照存，超限图自动等比缩放为预览内联展示，原图路径在 `files` 里返回；缩放不可用时退回纯路径交付）。想要 2K/3K 原图无损内联展示，可调大 `~/.dsh/settings.yaml` 里 `attachment-local` 的 `maxImageDimension`（如 4096）——调与不调的取舍详见 `dsh-multimodal/README.md` 的「harness 附件尺寸上限与你的选择」。旧版 harness（rc.7 及更早）无此限制，行为不变。

## 配置凭据

视觉与生图两个通道各配一个 API Key，写在 `~/.dsh/.credentials.yaml`：

- `DSH_VISION_API_KEY` — 视觉模型
- `DSH_GENERATION_API_KEY` — 生图模型

两个通道的模型 ID 与 Base URL 均可配置，支持任何 OpenAI 兼容端点（Gemini、GPT、豆包等），**不预置任何默认值**。装了 client 插件后在 web UI「设置 → 多模态」里填即可；没装 client 手编 `~/.dsh/.credentials.yaml` 与插件目录下的 `global-multimodal-config.json`。首次使用需先填好模型 ID 与 Base URL，填好前工具调用会提示未配置。本开源包不含凭据与运行时配置。

## License

MIT
