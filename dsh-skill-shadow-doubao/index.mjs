// dsh-skill-shadow-doubao
//
// 在 DSH harness 进程内注册一个同名的 runtime skill `doubao-multimodal`，
// 靠 SkillRegistry 的 layer 覆盖规则盖掉 .cc-switch/skills 里那个 custom 同名 skill
// （runtime rank 250 < custom rank 300，collectLayer 先收 runtime，custom 同名被忽略）。
// invocation 全 false：模型 catalog 与用户命令都看不到它。
//
// 效果：DSH harness 识图/生图改走多模态插件（vision / generate_image / show_image）。
// 只在本 harness 进程内生效，不改动共享 skill 目录，其他 agent（claude/codex 等）不受影响。

export const name = 'dsh-skill-shadow-doubao'
export const inject = ['skills']

export function apply(ctx) {
  ctx.skills.register({
    name: 'doubao-multimodal',
    description: 'disabled in this harness via shadow registration; use the multimodal plugin instead',
    content: '# disabled\nThis skill is intentionally shadowed in the DeepSeek Harness profile. Use the multimodal plugin tools (vision / generate_image / show_image) for image recognition and generation.\n',
    whenToUse: undefined,
    invocation: { modelInvocable: false, userInvocable: false },
    source: 'runtime',
    provider: 'runtime',
    resourceBase: { kind: 'opaque', description: 'shadowed in this harness' },
  })
}
