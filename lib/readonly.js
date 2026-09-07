/**
 * Read-only planning — authorization state machine and tool-surface policy.
 *
 * Redesigned from "prune during planning only" to a first-principles
 * authorization model: the model may write product code ONLY once a task
 * exists AND its plan is approved, or the user has explicitly authorized
 * skipping the task workflow. Tool surface follows the authorization state,
 * decoupled from the display phase (lib/state.js phaseFor).
 *
 * State transitions:
 *
 *   undecided ──trellis_task_create──▶ planning ──批准──▶ authorized
 *       │                                                  ▲
 *       └────────── trellis_task_skip (人确认后) ───────────┘
 *
 * Tool-surface policy is DENYLIST-based: each read-only authorization state
 * trims a specific, explicit set of tools (generic code write tools plus the
 * trellis tools invalid for that state) and keeps everything else — including
 * tools registered by OTHER plugins (web_search, generate_image, subagent,
 * skill, ...). This is the opposite of an allowlist, which would silently
 * strip every unlisted tool (issue-09-07-trim-tools-denylist).
 *
 * Pure module — no fs, no config. The caller (lib/index.js
 * system-prompt/assemble) gates the whole policy behind
 * `enforceReadonlyPlanning: true` and an allowlist match.
 */

/** Read/analysis + shell tools shared by every read-only level (informational). */
export const READ_TOOLS = ['read', 'glob', 'grep', 'read_image', 'inspect_image', 'pwsh', 'bash']

/**
 * Tools trimmed in the `undecided` state (no task yet, not skipped):
 * generic code write tools plus trellis task tools that require an existing
 * task / bind a task. Everything else — read tools, other plugins' tools,
 * trellis_state / trellis_task_create / trellis_task_skip — stays available.
 */
export const UNDECIDED_TRIM = new Set([
  'write',
  'edit',
  'trellis_task_update',
  'trellis_artifact_update',
  'trellis_task_archive',
  'trellis_ui_update',
])

/**
 * Tools trimmed in the `planning` state (task exists, plan not yet approved):
 * generic code write tools plus trellis lifecycle tools invalid while a task
 * is being planned (create would rebind, skip is only valid without a task).
 * Everything else — read tools, other plugins' tools, trellis_state /
 * trellis_task_update / trellis_artifact_update — stays available.
 */
export const PLANNING_TRIM = new Set([
  'write',
  'edit',
  'trellis_task_create',
  'trellis_task_skip',
  'trellis_task_archive',
  'trellis_ui_update',
])

/** The three authorization states a session can be in. */
export const AUTHORIZATIONS = ['undecided', 'planning', 'authorized']

/**
 * Fixed section `name` for the injected read-only instruction. Must stay
 * unique and non-empty with a string `text` to satisfy the harness assembly
 * invariant (@deepseek-ai/dsh-system-prompt/lib/invariant.js).
 */
export const READONLY_SECTION = 'trellis:readonly'

/**
 * Resolve the authorization state from the display phase plus the session's
 * skip flag. Pure decision.
 * @param {string | null | undefined} phase one of lib/state.js PHASES.
 * @param {boolean} [skipState] true when the session pointer carries skipped:true.
 * @returns {string} one of AUTHORIZATIONS.
 */
export function authorizationOf(phase, skipState = false) {
  if (phase === 'planning' || phase === 'planning-inline') return 'planning'
  if (phase === 'no_task') return skipState === true ? 'authorized' : 'undecided'
  // in_progress / completed / unknown → full write access.
  return 'authorized'
}

/**
 * The tools to TRIM (remove) for an authorization state, or null when the
 * state is freely writable (no pruning). Denylist semantics: only these named
 * tools are removed; every other tool (including other plugins') is kept.
 * @param {string} authorization one of AUTHORIZATIONS.
 * @returns {Set<string> | null}
 */
export function trimToolsFor(authorization) {
  if (authorization === 'undecided') return UNDECIDED_TRIM
  if (authorization === 'planning') return PLANNING_TRIM
  return null
}

/**
 * Apply the read-only tool filter to an assembled tool list.
 * @param {Array<{ name?: string } | null | undefined> | null | undefined} tools
 *   the assembled tool surface (items carry a `.name`).
 * @param {string | null | undefined} phase resolved Trellis phase.
 * @param {boolean} [skipState] session skip flag.
 * @returns {Array | null} the pruned tool list, or null when no pruning applies
 *   (caller keeps the original list untouched).
 */
export function applyReadonlyPolicy(tools, phase, skipState = false) {
  if (!Array.isArray(tools)) return null
  const authorization = authorizationOf(phase, skipState)
  const trimmed = trimToolsFor(authorization)
  if (!trimmed) return null
  return tools.filter((t) => t && typeof t.name === 'string' && !trimmed.has(t.name))
}

/**
 * Apply the read-only section filter to an assembled system-prompt section list.
 * Sections following the standard `tool:<name>` convention are pruned ONLY when
 * <name> is one of the tools trimmed for the authorization state (denylist).
 * Non-tool sections (persona, instructions, environment, workspace) and tool
 * sections of every other tool — including other plugins' — are preserved.
 *
 * @param {Array<{ name?: string, text?: string } | null | undefined> | null | undefined} sections
 *   the assembled prompt sections.
 * @param {string | null | undefined} phase resolved Trellis phase.
 * @param {boolean} [skipState] session skip flag.
 * @returns {Array | null} the pruned sections list, or null when no pruning applies.
 */
export function applyReadonlySections(sections, phase, skipState = false) {
  if (!Array.isArray(sections)) return null
  const authorization = authorizationOf(phase, skipState)
  const trimmed = trimToolsFor(authorization)
  if (!trimmed) return null
  return sections.filter((s) => {
    if (!s || typeof s.name !== 'string') return false
    const match = /^tool:(.+)$/.exec(s.name)
    if (!match) return true
    const toolName = match[1]
    return !trimmed.has(toolName)
  })
}

/**
 * Explicit read-only instruction text for an authorization state, or null
 * when the state is freely writable (no instruction is injected).
 * Chinese by design (PRD: no i18n; style mirrors the README wording), even
 * though the default English fallback breadcrumbs may sit alongside it.
 * @param {string} authorization one of AUTHORIZATIONS.
 * @returns {string | null}
 */
export function readonlyInstructionFor(authorization) {
  if (authorization === 'undecided') {
    return (
      'Trellis 只读保护：当前无活跃任务，工作区处于只读状态。' +
      '禁止修改任何源码或业务文件；请先分类本轮需求并询问用户是否需要创建 Trellis 任务，' +
      '仅在用户明确同意后才能创建任务进入规划。'
    )
  }
  if (authorization === 'planning') {
    return (
      'Trellis 只读保护：当前处于规划阶段，方案获批前工作区只读，禁止修改任何源码或业务文件。' +
      '请先产出计划（prd/design 等）供用户确认——规划产物请通过 Trellis 任务工具 ' +
      '（trellis_artifact_update）写入；仅当用户批准进入实施阶段后，才可开始编写代码。'
    )
  }
  return null
}

/**
 * Append the read-only instruction section to an assembled section list.
 * Mirrors `applyReadonlyPolicy`'s "null means untouched" convention: returns
 * null for non-array input and for the `authorized` state, so the caller keeps
 * the original list. For `undecided`/`planning` it returns a NEW array with the
 * instruction appended at the tail, deduplicating any pre-existing section
 * with the same name (only sections already present at assembly time — or
 * appended by an earlier handler — can be deduplicated here).
 *
 * @param {Array<{ name?: string, text?: string } | null | undefined> | null | undefined} sections
 *   the section list to append to (typically already pruned by applyReadonlySections).
 * @param {string | null | undefined} phase resolved Trellis phase.
 * @param {boolean} [skipState] session skip flag.
 * @returns {Array | null} the extended sections list, or null when no injection applies.
 */
export function appendReadonlyInstruction(sections, phase, skipState = false) {
  if (!Array.isArray(sections)) return null
  const authorization = authorizationOf(phase, skipState)
  const text = readonlyInstructionFor(authorization)
  if (text === null) return null
  const rest = sections.filter((s) => !(s && s.name === READONLY_SECTION))
  return [...rest, { name: READONLY_SECTION, text }]
}
