/**
 * Breadcrumb message construction for the trellis trigger.
 *
 * Follows the exact shape used by @deepseek-ai/dsh-agent-instructions: a
 * user-role message whose content is a single text block, produced via
 * `createUserMessage` from @deepseek-ai/dsh-llm. The `source` identifies where
 * the breadcrumb came from so the trigger can dedupe (and so the model/user can
 * tell a real project state from a builtin fallback).
 */

/**
 * Whether to skip injecting breadcrumb for this turn.
 * The Trellis prompt_injection escape hatch is the standalone word "no-trellis".
 * @param {string | undefined} lastUserText the latest user text in this turn.
 * @param {string[]} skipKeywords configured skip words (default: ['no-trellis']).
 * @returns {boolean}
 */
export function shouldSkip(lastUserText, skipKeywords = ['no-trellis']) {
  if (!lastUserText) return false
  const m = new RegExp(`(^|[^A-Za-z0-9_-])(${skipKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})([^A-Za-z0-9_-]|$)`, 'i')
  return m.test(lastUserText)
}

/**
 * Pick the active step to focus on, by attention priority:
 *   1. blocked   — highest priority: surface the blocker so the model resolves it first;
 *   2. in_progress — the step being implemented right now;
 *   3. verifying — the step awaiting verification (AI test run or human approval);
 *   4. pending   — the next step to start.
 * Returns null if steps is empty or all steps are completed.
 * @param {Array<object> | undefined} steps
 * @returns {{ step: object, index: number, total: number } | null}
 */
export function findActiveStep(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const total = steps.length
  const order = ['blocked', 'in_progress', 'verifying']
  for (const status of order) {
    const idx = steps.findIndex((s) => s.status === status)
    if (idx !== -1) {
      return { step: steps[idx], index: idx, total }
    }
  }
  const pendingIdx = steps.findIndex((s) => s.status === 'pending' || !s.status)
  if (pendingIdx !== -1) {
    return { step: steps[pendingIdx], index: pendingIdx, total }
  }
  return null
}

/**
 * Format the single active step prompt block with high signal-to-noise ratio.
 * @param {{ step: object, index: number, total: number }} stepInfo
 * @returns {string}
 */
export function formatStepPrompt(stepInfo) {
  if (!stepInfo || !stepInfo.step) return ''
  const { step, index, total } = stepInfo
  const verification = step.verification || (step.verify === true ? 'ai' : 'none')
  const stateTag =
    step.status === 'blocked'
      ? ' [⚠️ 步骤已阻塞]'
      : step.status === 'verifying'
        ? verification === 'human'
          ? ' [人工验收卡点 - 👤 等待用户确认]'
          : ' [验证阶段 - 自动化测试]'
        : step.status === 'in_progress'
          ? ' [实施中]'
          : ''
  const lines = [
    `[当前执行步骤] [#${step.id}] ${step.title}${stateTag} (步骤进度: ${index + 1}/${total})`,
  ]
  if (step.spec) {
    lines.push(`- 交付规格：${step.spec}`)
  }
  if (Array.isArray(step.acceptance) && step.acceptance.length > 0) {
    lines.push('- 验收标准（必须严格逐项达标）：')
    for (let i = 0; i < step.acceptance.length; i++) {
      lines.push(`  ${i + 1}. ${step.acceptance[i]}`)
    }
  }
  if (step.status === 'blocked') {
    lines.push(`- 阻塞原因：${step.blockedReason || '（未记录）'}`)
    lines.push('- 处理指引：请优先评估解决方案；如需调整方案，请知会用户后再推进。')
  } else if (step.status === 'verifying') {
    if (verification === 'human') {
      lines.push(
        '- 人卡点要求：本步骤涉及关键改动/外部观察行为，必须向用户清晰汇报改动要点并等待用户明确批准。',
      )
      lines.push(
        '- 严禁行为：在用户给出明确确认回复前，严禁自作主张推进至完成或开始后续步骤！',
      )
    } else {
      lines.push(
        '- 验证任务：代码实施已完成，请执行 design.md 中声明的验证命令并检查测试输出。',
      )
      lines.push(
        '- 通过要求：测试通过后调用 trellis_task_update 提交 verificationNotes 并置 verified: true。',
      )
    }
  } else if (verification !== 'none') {
    lines.push(
      verification === 'human'
        ? '- 验证要求：本步骤声明了人工验收要求 (verification: human)，完成后须向用户汇报并等待用户确认（verifiedBy: human）。'
        : '- 验证要求：本步骤声明了独立测试验证要求 (verification: ai)，完成后请提交测试依据并调用 trellis_task_update 记录 verified: true。',
    )
  }
  // Spec pointer: the plugin no longer injects workflow.md, so the per-step
  // prompt is what connects a step to the spec corpus. Kept to one line, and
  // TIMING-AWARE: a blocked/verifying step has already been worked on, so it
  // gets the follow-up rule instead of a stale "before you start" instruction.
  // `step.spec` is the step's DELIVERY spec (task-engine convention), so its
  // presence escalates the wording rather than gating the line.
  const specLine =
    step.status === 'blocked'
      ? '- 规范落点：修复须对齐 `.trellis/spec/` 对应分层的既有约定（见 `trellis:spec-index`）。'
      : step.status === 'verifying'
        ? '- 规范核对：验收时对照 `.trellis/spec/` 对应分层的质量门，确认无偏离后再置 verified。'
        : step.spec
          ? '- 规范前置（必须）：动手前先 read 与本次改动相关的 `.trellis/spec/` 分层 index.md（开发前检查清单 + 质量门禁），汇报时说明对齐情况。'
          : '- 规范前置：若改动涉及分层边界、错误处理或既有公开契约，先 read 对应 `.trellis/spec/` index.md 再动手。'
  lines.push(specLine)
  lines.push('[执行规约] 请严格保持注意力聚焦在当前步骤，完成且验证通过后再推进下一项。严禁跨步骤跳项修改无关代码。')
  return lines.join('\n')
}

/**
 * Build the one-line reminder for an already-injected step (dedup mode).
 * @param {object} step the active step
 * @returns {string}
 */
export function formatStepReminder(step) {
  if (!step) return ''
  return `[当前执行步骤] 步骤 [#${step.id}] 正在推进中，请保持专注并在完成后更新进度。`
}

/**
 * Return core engineering practices and discipline rules for the current workType and stage.
 * @param {string | null | undefined} workType feat | issue | refactor
 * @param {string | null | undefined} stage current stage
 * @param {{ isBlocked?: boolean }} [options] context options (e.g. step is blocked)
 * @returns {string[]} list of discipline rules
 */
export function getStagePractices(workType, stage, { isBlocked = false } = {}) {
  const rules = []

  if (workType === 'issue') {
    if (stage === 'report') {
      rules.push('【精准复现与断言】写清稳定复现步骤与错误现场日志；优先提供用户真实症状的判定标准。')
    } else if (stage === 'analyze') {
      rules.push('【反馈闭环硬门禁】严禁看代码盲猜！必须先构造一条能针对用户真实症状稳定跑红（Go Red）的单行测试/命令。')
      rules.push('【可证伪假说矩阵】列出 2~4 个可证伪假说（若 X 为真因，改动 Y 会消除，改动 Z 会恶化），低成本向用户确认后再验证。')
      rules.push('【警惕测试水泥效应】审查现有测试是否只是照抄旧实现内部细节（刻舟求剑）；若旧架构有缺陷，准备推翻旧设计。')
    } else if (stage === 'fix') {
      rules.push('【接缝不变量测试】回归测试必须对准模块外部接缝，验证不可妥协的业务不变量；严禁写仅测内部字段的浅层测试。')
      rules.push('【最小根因修复】修复数据流与生命周期源头漏洞，严禁在出错点套 try-catch 或无脑加判空。')
      rules.push('【坏味道自查】若修复需要引入第 3 个临时 flag 或跨层透传参数，立即停手，触发 trellis-break-loop 重新设计接缝。')
    } else if (stage === 'fix-note') {
      rules.push('【修复归档与复盘】记录修改文件清单、跑绿测试依据与潜在技术债务；确保不留隐藏补丁。')
    }
  } else if (workType === 'feat') {
    if (stage === 'prd' || stage === 'design') {
      rules.push('【简洁与接缝】遵循 YAGNI 原则与深模块设计（小接口、大实现），明确核心不变量与验收断言。')
    } else if (stage === 'impl' || stage === 'review' || stage === 'check') {
      rules.push('【测试先行与审查】编写针对模块接缝的契约测试；验证通过不仅看退出码，更要对照 PRD 验收标准。')
    }
  } else if (workType === 'refactor') {
    if (stage === 'scan' || stage === 'design') {
      rules.push('【识别假接缝】运用删除测试（The Deletion Test）判断复杂度是否真被隐藏；采用 Replace, Don\'t Layer 原则。')
    } else if (stage === 'apply') {
      rules.push('【行为等价保证】保持外部可观察行为严格等价；不变量测试必须全程绿灯。')
    }
  }

  if (isBlocked) {
    rules.push('【⚠️ 升阶警告】检测到当前步骤阻塞或多次修复未果。严禁盲目继续打补丁！请反思现有架构是否存在缺陷、旧测试是否在刻舟求剑，必要时加载 trellis-break-loop 推翻旧设计。')
  }

  return rules
}

/**
 * Format stage practices into prompt text.
 * @param {string[]} practices
 * @param {boolean} [isReminder]
 * @returns {string}
 */
export function formatPracticesPrompt(practices, isReminder = false) {
  if (!Array.isArray(practices) || practices.length === 0) return ''
  if (isReminder) {
    return '[当前阶段工程规范] 当前阶段工程规范（见上文）正在生效，请保持遵循核心纪律。'
  }
  const lines = ['[当前阶段工程规范]']
  for (const rule of practices) {
    lines.push(`- ${rule}`)
  }
  return lines.join('\n')
}

/**
 * Build the user-role breadcrumb message.
 * @param {object} params
 * @param {string} params.sourceKind the merge-extensible message source kind (see meta.js).
 * @param {string} params.text the breadcrumb body.
 * @param {'project' | 'builtin'} params.source project-derived or builtin fallback.
 * @param {string} [params.projectRoot] when known, the project root for the breadcrumb.
 * @param {string} [params.activeTask] the active task dir, when one is set.
 * @param {string} [params.phase] the phase id.
 * @param {{ step: object, index: number, total: number } | null} [params.stepInfo] the active step.
 * @param {string} [params.stepPromptOverride] pre-rendered step prompt (dedup reminder or full text).
 * @param {string} [params.practicesPrompt] formatted stage practices block.
 * @param {unknown} createUserMessage the createUserMessage function.
 * @returns {ReturnType<typeof createUserMessage>}
 */
export function buildBreadcrumbMessage(
  { sourceKind, text, source, projectRoot, activeTask, phase, stepInfo, stepPromptOverride, practicesPrompt },
  createUserMessage,
) {
  const tag = source === 'project'
    ? `Workflow state from ${projectRoot || 'the current project'}`
    : `Workflow state (builtin phase guidance; no project .trellis/workflow.md override at ${projectRoot || 'the working dir'})`
  const headerLines = [
    `[trellis/${phase}] ${tag}`,
    activeTask ? `Active task: ${activeTask}` : 'No active task.',
  ]
  let body = text
  if (practicesPrompt) {
    body = `${body}\n\n${practicesPrompt}`
  }
  const stepText =
    stepPromptOverride !== undefined
      ? stepPromptOverride
      : stepInfo
        ? formatStepPrompt(stepInfo)
        : ''
  if (stepText) {
    body = `${body}\n\n${stepText}`
  }
  const fullText = `${headerLines.join('\n')}\n\n${body}`
  // Optional source fields are OMITTED (conditional spread), never written as
  // `undefined`: the injected message is appended to the session as a
  // `user/message` event, and dsh-session's lossless-JSON contract
  // (snapshotJsonValue in @deepseek-ai/dsh-util-values) rejects any
  // `undefined` value nested in the payload — see issue-09-05-breadcrumb-undefined.
  return createUserMessage({
    content: [{ type: 'text', text: fullText }],
    source: {
      kind: sourceKind,
      form: 'trellis-breadcrumb',
      phase,
      ...(projectRoot ? { project: projectRoot } : {}),
      ...(stepInfo && stepInfo.step ? { stepId: stepInfo.step.id } : {}),
    },
  })
}
