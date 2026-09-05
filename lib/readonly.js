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
 * Pure module — no fs, no config. The caller (lib/index.js
 * system-prompt/assemble) gates the whole policy behind
 * `enforceReadonlyPlanning: true` and an allowlist match.
 */

/** Read/analysis + shell tools shared by every read-only level. */
export const READ_TOOLS = ['read', 'glob', 'grep', 'read_image', 'inspect_image', 'pwsh', 'bash']

/** undecided: investigate + create a task + ask to skip. No write/edit yet. */
export const UNDECIDED_TOOLS = new Set([
  ...READ_TOOLS,
  'trellis_state',
  'trellis_task_create',
  'trellis_task_skip',
])

/** planning: investigate + advance the task + write task-dir artifacts only. */
export const PLANNING_TOOLS = new Set([
  ...READ_TOOLS,
  'trellis_state',
  'trellis_task_update',
  'trellis_artifact_update',
])

/** The three authorization states a session can be in. */
export const AUTHORIZATIONS = ['undecided', 'planning', 'authorized']

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
 * The tool-name allowlist for an authorization state, or null when the state
 * is freely writable (no pruning).
 * @param {string} authorization one of AUTHORIZATIONS.
 * @returns {Set<string> | null}
 */
export function allowedToolsFor(authorization) {
  if (authorization === 'undecided') return UNDECIDED_TOOLS
  if (authorization === 'planning') return PLANNING_TOOLS
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
  const allowed = allowedToolsFor(authorization)
  if (!allowed) return null
  return tools.filter((t) => t && typeof t.name === 'string' && allowed.has(t.name))
}
