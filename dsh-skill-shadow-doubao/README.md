# dsh-skill-shadow-doubao

在 DeepSeek Harness 进程内把 `doubao-multimodal` skill 禁用（模型与用户都不可调用），让识图/生图任务改走多模态插件（`dsh-global-multimodal` 的 vision/generate_image/show_image）。

## 为什么需要

`doubao-multimodal` skill 是 cc-switch 共享 skill 仓库（`~/.cc-switch/skills/`）里的一份完整多模态入口（vision.js + gen.js）。DSH harness 通过 web profile 的 `skill-filesystem.customSkillDirs` 直接读这个目录，**绕过 cc-switch 的 per-app 启用开关**（cc-switch 的 `skills` 表只有 claude/codex/gemini/opencode/hermes/grokbuild 列，没有 DSH 列）。所以：

- 没法在 cc-switch UI 里只给 DSH 关掉这个 skill；
- skill-filesystem 的 config 也没有 per-skill 黑名单；
- 改 SKILL.md 的 `disable-model-invocation` 会全局生效（连其他 agent 一起禁）。

本插件用 **runtime skill 覆盖**实现"只 DSH harness 禁用、其他 agent 照常"。

## 机制

在 `apply(ctx)` 里 `ctx.skills.register` 一个同名 `doubao-multimodal` runtime skill，`invocation: { modelInvocable: false, userInvocable: false }`。SkillRegistry 的 layer 覆盖规则：同一 layer 内 runtime rank=250 < custom rank=300，`collectLayer` 按 rank 升序收，runtime 先入 `seen`，custom 同名被跳过并 log `ignored because a higher-priority skill already exists`。结果：DSH 的 skill catalog 里 `doubao-multimodal` 是这个被禁用的占位，模型和用户都看不到、调不动，识图/生图落到多模态插件。

## 边界

- 只影响 **DSH harness 进程内**的 global skill layer，不写共享 skill 目录、不改 cc-switch.db、不动其他 agent（claude/codex/... 照常从 `~/.cc-switch/skills/` 加载真的 `doubao-multimodal`）。
- 回滚：删 `cordis.patch.yml` 里 `skill-shadow-doubao` 那行 + 删插件目录 + 重启 `dsh web`，即恢复。

## 安装

把 `index.mjs` 放到 `~/.dsh/plugins/dsh-skill-shadow-doubao/`，在 web profile 的 `~/.dsh/profiles/web/cordis.patch.yml` 的 `- insert:` 数组加：

```yaml
- id: skill-shadow-doubao
  name: file:///C:/Users/<you>/.dsh/plugins/dsh-skill-shadow-doubao/index.mjs
```

重启 `dsh web` 生效。覆盖在 agent 首次拉 skill catalog 时生效（`collectLayer` 是 lazy 的，启动日志不一定有 ignored warning）。

## License

MIT
