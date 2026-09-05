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
 * Pick the active step to focus on.
 * Prefers the first 'in_progress' step; falls back to the first 'pending' step.
 * Returns null if steps is empty or all steps are completed.
 * @param {Array<object> | undefined} steps
 * @returns {{ step: object, index: number, total: number } | null}
 */
export function findActiveStep(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return null
  const total = steps.length
  // 1. Try finding in_progress
  const inProgIdx = steps.findIndex((s) => s.status === 'in_progress')
  if (inProgIdx !== -1) {
    return { step: steps[inProgIdx], index: inProgIdx, total }
  }
  // 2. Try finding first pending
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
  const lines = [
    `[当前执行步骤] [#${step.id}] ${step.title} (步骤进度: ${index + 1}/${total})`,
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
  if (step.verify === true) {
    lines.push(
      `- 验证要求：本步骤声明了独立测试验证要求 (verify: true)，完成后请提交测试依据并调用 trellis_task_update 记录 verified: true。`,
    )
  }
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
 * @param {unknown} createUserMessage the createUserMessage function.
 * @returns {ReturnType<typeof createUserMessage>}
 */
export function buildBreadcrumbMessage(
  { sourceKind, text, source, projectRoot, activeTask, phase, stepInfo, stepPromptOverride },
  createUserMessage,
) {
  const tag = source === 'project'
    ? `Workflow state from ${projectRoot || 'the current project'}`
    : `Workflow state (builtin default, no .trellis/ detected at ${projectRoot || 'the working dir'})`
  const headerLines = [
    `[trellis/${phase}] ${tag}`,
    activeTask ? `Active task: ${activeTask}` : 'No active task.',
  ]
  let body = text
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
  return createUserMessage({
    content: [{ type: 'text', text: fullText }],
    source: {
      kind: sourceKind,
      form: 'trellis-breadcrumb',
      phase,
      project: projectRoot || undefined,
      stepId: stepInfo && stepInfo.step ? stepInfo.step.id : undefined,
    },
  })
}
