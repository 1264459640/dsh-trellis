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
 * Build the user-role breadcrumb message.
 * @param {object} params
 * @param {string} params.sourceKind the merge-extensible message source kind (see meta.js).
 * @param {string} params.text the breadcrumb body.
 * @param {'project' | 'builtin'} params.source project-derived or builtin fallback.
 * @param {string} [params.projectRoot] when known, the project root for the breadcrumb.
 * @param {string} [params.activeTask] the active task dir, when one is set.
 * @param {string} [params.phase] the phase id.
 * @param {unknown} createUserMessage the createUserMessage function.
 * @returns {ReturnType<typeof createUserMessage>}
 */
export function buildBreadcrumbMessage({ sourceKind, text, source, projectRoot, activeTask, phase }, createUserMessage) {
  const tag = source === 'project'
    ? `Workflow state from ${projectRoot || 'the current project'}`
    : `Workflow state (builtin default, no .trellis/ detected at ${projectRoot || 'the working dir'})`
  const headerLines = [
    `[trellis/${phase}] ${tag}`,
    activeTask ? `Active task: ${activeTask}` : 'No active task.',
  ]
  const fullText = `${headerLines.join('\n')}\n\n${text}`
  return createUserMessage({
    content: [{ type: 'text', text: fullText }],
    source: {
      kind: sourceKind,
      form: 'trellis-breadcrumb',
      phase,
      project: projectRoot || undefined,
    },
  })
}
