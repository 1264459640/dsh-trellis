/**
 * Trellis workflow-phase resolution, rewritten on DSH-native primitives.
 *
 * The original Trellis CLI (`task.py`, `get_context.py`) is AGPL; this module
 * re-implements the observable behaviour — resolve the active task from a
 * runtime session file, read its status, derive the workflow phase, and pick
 * the matching `[workflow-state:*]` breadcrumb from workflow.md if present.
 * No Trellis source is copied.
 */

/**
 * Parse a resolved runtime session file into its active-task pointer.
 * @param {any} json the parsed session JSON.
 * @returns {{ taskDir?: string | null }} the current_task path, when present.
 */
export function activeTaskFromSession(json) {
  if (!json || typeof json !== 'object') return {}
  const task = json.current_task
  if (typeof task === 'string' && task.length > 0) {
    return { taskDir: task }
  }
  return {}
}

/** The phases the trigger can name. Order matters for display only. */
export const PHASES = [
  'no_task',
  'planning',
  'planning-inline',
  'in_progress',
  'in_progress-inline',
  'completed',
] // prettier-ignore

/**
 * Map a task status + inline flag to a phase id.
 * @param {string | null | undefined} status task.status, e.g. 'planning' | 'in_progress'.
 * @param {boolean} inline true when the active task is in codex-inline dispatch mode.
 * @returns {string} one of PHASES.
 */
export function phaseFor(status, inline = false) {
  if (status === 'in_progress') return inline ? 'in_progress-inline' : 'in_progress'
  if (status === 'planning') return inline ? 'planning-inline' : 'planning'
  if (status === 'completed') return 'completed'
  return 'no_task'
}

const FALLBACK_BREADCRUMBS = {
  no_task:
    'No active Trellis task. Classify this turn and ask the user whether it should create a task before doing work.',
  planning:
    'Trellis planning phase. Load the project skill `trellis-brainstorm` (.agents/skills/trellis-brainstorm); stay in planning until the final planning summary is approved.',
  'planning-inline':
    'Trellis planning phase (inline). Same as planning, but Phase 2 will load `trellis-before-dev` instead of JSONL curation.',
  in_progress:
    'Trellis in_progress. Flow: trellis-implement/trellis-check dispatch -> trellis-update-spec -> commit -> trellis-finish-work.',
  'in_progress-inline':
    'Trellis in_progress (inline). Flow: trellis-before-dev -> edit -> trellis-check -> update-spec -> commit -> finish-work.',
  completed: 'Trellis task committed. Run trellis-finish-work; if dirty, return to Phase 3.4 first.',
}

/** Regex for the Trellis workflow-state tag blocks: `[workflow-state:STATUS] ... [/workflow-state:STATUS]`. */
const STATE_BLOCK_OPEN = /\[workflow-state:([A-Za-z0-9_-]+)\]/g

/**
 * Extract the body of a `[workflow-state:STATUS]` block from workflow.md.
 * Returns the trimmed inner text, or undefined when the block is absent.
 * @param {string} workflowText the workflow.md content.
 * @param {string} status the phase id to look up.
 * @returns {string | undefined}
 */
export function breadcrumbFromWorkflow(workflowText, status) {
  if (!workflowText) return undefined
  // Re-scan each open tag and pair with the next close tag. Reference-ish
  // mentions in explanatory comments may open tags without a close; the real
  // per-turn block always has a matching close, so the LAST complete
  // open/close pair for the status wins.
  const open = [...workflowText.matchAll(STATE_BLOCK_OPEN)]
  let best = undefined
  for (let i = 0; i < open.length; i++) {
    if (open[i][1] !== status) continue
    const bodyStart = open[i].index + open[i][0].length
    const rest = workflowText.slice(bodyStart)
    const end = rest.indexOf(`[/workflow-state:${status}]`)
    if (end === -1) continue
    const body = rest.slice(0, end).trim()
    if (!body) continue
    best = body
  }
  return best
}

/**
 * Format a Date as a zero-padded `mm-dd` string (local time).
 * @param {Date} [date] defaults to now.
 * @returns {string} e.g. "01-15".
 */
export function todayMmDd(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

/**
 * Strict task-slug convention shared by the plugin's validation and the
 * workflow skills: `<work-type>-<mm-dd>-<name>` — e.g. `feat-01-15-billing`.
 * Work types follow the routing table in `skills/_templates/work-types.md`.
 */
const SLUG_PATTERN = /^(feat|issue|refactor)-(\d{2})-(\d{2})-(.+)$/

/**
 * Validate a task slug (the task directory basename) against the strict
 * convention `<work-type>-<mm-dd>-<name>`. `workType` comes from the task's
 * `task.json` extension block (`work.type`); when it is known the type segment
 * must match it exactly. `today` is only used to build concrete suggestions.
 * @param {string | null | undefined} slug the task directory basename.
 * @param {string | null | undefined} [workType] task.json work.type (feat|issue|refactor), when present.
 * @param {string} [today] today's mm-dd, for concrete suggestions.
 * @returns {{ valid: boolean, expected: string | null, reason: string | null }}
 */
export function validateSlug(slug, workType = null, today = todayMmDd()) {
  const mmdd = today || todayMmDd()
  if (!slug || typeof slug !== 'string') {
    return {
      valid: false,
      expected: `${workType || '<work-type>'}-${mmdd}-<name>`,
      reason: '任务目录缺少 slug（目录名）',
    }
  }
  const match = SLUG_PATTERN.exec(slug)
  if (!match) {
    return {
      valid: false,
      expected: `${workType || '<work-type>'}-${mmdd}-${slug}`,
      reason:
        'slug 必须以「类型-时间戳」前缀开头（类型 ∈ feat|issue|refactor），形如 ' +
        `feat-${mmdd}-<短名>`,
    }
  }
  const [, type, month, day, name] = match
  if (workType && type !== workType) {
    return {
      valid: false,
      expected: `${workType}-${month}-${day}-${name}`,
      reason: `task.json 的 work.type=${workType} 与 slug 前缀 ${type} 不一致`,
    }
  }
  const mo = Number(month)
  const dd = Number(day)
  // Real calendar check (year 2000 is leap, so Feb 29 stays valid): rejects 02-30 etc.
  const probe = new Date(2000, mo - 1, dd)
  const dateOk = probe.getFullYear() === 2000 && probe.getMonth() === mo - 1 && probe.getDate() === dd
  if (!dateOk) {
    return {
      valid: false,
      expected: `${type}-${mmdd}-${name}`,
      reason: `slug 时间戳 ${month}-${day} 不是合法的 mm-dd`,
    }
  }
  return { valid: true, expected: null, reason: null }
}

/**
 * Compose the breadcrumb text for a phase, preferring the project's workflow.md
 * block and falling back to the bundled defaults. Prefixes a mardown source note
 * so the model knows whether this reflects a real project state or a builtin.
 * @param {string} phase one of PHASES.
 * @param {{ workflow?: string, fallback?: string, sourceProject?: string | null }} sources
 * @returns {{ text: string, source: 'project' | 'builtin' }}
 */
export function composeBreadcrumb(phase, { workflow, fallback = FALLBACK_BREADCRUMBS, sourceProject = null } = {}) {
  const preferred = phase === 'no_task' ? 'no_task' : phase
  const projectText = breadcrumbFromWorkflow(workflow || '', preferred)
  if (projectText) {
    return {
      text: projectText,
      source: 'project',
    }
  }
  return {
    text: fallback[preferred] || fallback.no_task,
    source: 'builtin',
  }
}

/**
 * Deterministically pick the runtime session file that owns the active-task
 * pointer. Rule: the exact filename `dsh-session.json` wins when it carries a
 * `current_task`; otherwise the lexically-first (by file name) entry that
 * carries one; no hit yields null. No mtime anywhere — dsh-fs's FsInfo
 * exposes none, so ordering is purely filename-based.
 * @param {Array<{ name: string, taskDir: string | null }>} sessions parsed runtime session files.
 * @returns {{ name: string, taskDir: string } | null} the winning entry, or null.
 */
export function activeTaskPointer(sessions) {
  if (!Array.isArray(sessions)) return null
  const withTask = sessions.filter(
    (s) => s && typeof s.name === 'string' && typeof s.taskDir === 'string' && s.taskDir.length > 0,
  )
  if (withTask.length === 0) return null
  const preferred = withTask.find((s) => s.name === 'dsh-session.json')
  if (preferred) return preferred
  withTask.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return withTask[0]
}

/**
 * Resolve the active-task pointer for ONE session, preferring that session's
 * own pointer file when it exists and falling back to the canonical-preferring
 * project-wide pick (activeTaskPointer) when the session has no pointer file
 * yet (legacy sessions created before per-session pointers).
 *
 * The per-session file is authoritative even when its `current_task` is null
 * (an explicit unbind) — a session that deliberately released its task must
 * NOT resurrect the project-wide canonical pointer.
 * @param {Array<{ name: string, taskDir: string | null }>} sessions parsed runtime session files.
 * @param {string | null | undefined} preferName exact pointer filename for this session (e.g. 'sess_abc123.json').
 * @returns {string | null} the winning task dir reference, or null.
 */
export function activeTaskForSession(sessions, preferName = null) {
  if (!Array.isArray(sessions)) return null
  const own = preferName ? sessions.find((s) => s && s.name === preferName) : undefined
  if (own) return own.taskDir // string | null — explicit state wins (null = unbound)
  const picked = activeTaskPointer(sessions)
  return picked ? picked.taskDir : null
}

/**
 * Extract the month key from a task slug following the convention
 * `<work-type>-<mm-dd>-<name>` (e.g. `feat-08-15-billing` → `'08'`). Returns
 * null when the slug carries no `mm-dd` timestamp segment (the archive tree
 * groups those under a fallback bucket).
 * @param {string | null | undefined} slug task directory basename.
 * @returns {string | null} zero-padded month, or null.
 */
export function monthKeyFromSlug(slug) {
  if (typeof slug !== 'string') return null
  const match = /^[^-]+-(\d{2})-\d{2}-/.exec(slug)
  return match ? match[1] : null
}

/**
 * Per-work-type stage tracks and status fallbacks, aligned with
 * `skills/_templates/work-types.md`. `finish` is a display-only terminal for
 * completed feat tasks (not a writable work.stage); the issue/refactor tracks
 * use their last stage for the completed display.
 */
export const TRACKS = {
  feat: {
    stages: ['prd', 'design', 'design-review', 'impl', 'review', 'check'],
    planning: 'prd',
    in_progress: 'impl',
    completed: 'finish',
  },
  issue: {
    stages: ['report', 'analyze', 'fix', 'fix-note'],
    planning: 'report',
    in_progress: 'fix',
    completed: 'fix-note',
  },
  refactor: {
    stages: ['scan', 'design', 'apply', 'done'],
    planning: 'scan',
    in_progress: 'apply',
    completed: 'done',
  },
}

/**
 * The deterministic display stage for a task whose work.stage is unknown or
 * missing: the status fallback of its work.type track (planning -> track head,
 * in_progress -> the type's first in-progress stage, completed -> the display
 * terminal). Undefined when the work.type is unknown.
 * @param {string | null | undefined} workType task.json work.type.
 * @param {string | null | undefined} status task.json status.
 * @returns {string | undefined}
 */
export function fallbackStage(workType, status) {
  const track = TRACKS[workType]
  if (!track) return undefined
  if (status === 'in_progress') return track.in_progress
  if (status === 'completed') return track.completed
  return track.planning
}

/**
 * Whether a stage is a member of its work.type track (including the display
 * terminal for the completed state).
 * @param {string | null | undefined} workType task.json work.type.
 * @param {string | null | undefined} stage task.json work.stage.
 * @returns {boolean}
 */
export function stageOnTrack(workType, stage) {
  const track = TRACKS[workType]
  if (!track || typeof stage !== 'string') return false
  return track.stages.includes(stage) || stage === track.completed
}

/**
 * Build the path-free task summary the Web UI consumes. The payload never
 * contains a path — browsers only ever see this object or a stable empty kind.
 * Optional fields are `null` (never `undefined`): the model tool's output is
 * snapshotted as lossless JSON, which rejects own properties whose value is
 * undefined.
 * @param {any} taskJson the parsed task.json (null when absent/unparsable).
 * @param {{ matched: boolean, phase: string }} args matched = allowlist hit; phase = phaseFor(status).
 * @returns {{ kind: 'no-match'|'no-task'|'task', title?: string|null, status?: string|null, stage?: string|null, phase: string, workType?: string|null }}
 */
export function taskSummaryOf(taskJson, { matched, phase }) {
  if (!matched) return { kind: 'no-match', phase: 'no_task' }
  const task = taskJson && typeof taskJson === 'object' ? taskJson : null
  const status = task && typeof task.status === 'string' ? task.status : null
  if (!task || !status) return { kind: 'no-task', phase: phase || 'no_task' }
  const workType = task.work && typeof task.work.type === 'string' ? task.work.type : null
  const rawStage = task.work && typeof task.work.stage === 'string' ? task.work.stage : null
  const stage =
    rawStage && stageOnTrack(workType, rawStage) ? rawStage : fallbackStage(workType, status)
  return {
    kind: 'task',
    title: typeof task.title === 'string' && task.title ? task.title : null,
    status,
    stage: stage || null,
    phase,
    workType: workType || null,
  }
}
