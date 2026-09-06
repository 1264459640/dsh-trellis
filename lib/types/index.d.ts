/**
 * Public types for dsh-trellis.
 *
 * The implementation is plain JavaScript (JSDoc-typed); these declarations give
 * external consumers and the Cordis loader a stable shape regardless of their
 * own TypeScript setup.
 */

/**
 * Phase ids the trigger and `trellis_state` can report.
 */
export type TrellisPhase =
  | 'no_task'
  | 'planning'
  | 'planning-inline'
  | 'in_progress'
  | 'in_progress-inline'
  | 'completed'

export type TaskStepStatus = 'pending' | 'in_progress' | 'verifying' | 'blocked' | 'completed'

export type StepVerificationType = 'none' | 'ai' | 'human'

export interface TaskStep {
  id: string
  title: string
  spec?: string
  acceptance?: string[]
  status: TaskStepStatus
  verification?: StepVerificationType
  verify?: boolean
  verified?: boolean
  verifiedBy?: 'ai' | 'human'
  verificationNotes?: string
  blockedReason?: string
}

export interface TaskStepUpdateInput {
  id: string
  status?: TaskStepStatus
  verification?: StepVerificationType
  verified?: boolean
  verifiedBy?: 'ai' | 'human'
  verificationNotes?: string
  blockedReason?: string
}

/**
 * Host-formatted active step carried on board records: the Web client inserts
 * this verbatim when composing a "send to chat" prompt — it never re-derives
 * step semantics (verification gates / attention priority) on its own.
 */
export interface BoardActiveStep {
  id: string
  title: string
  status: TaskStepStatus
  /** 0-based position within the steps array. */
  index: number
  total: number
  blockedReason: string | null
}

/**
 * A path-free task record the Web kanban consumes. Optional fields are `null`
 * (never `undefined`) so the payload survives lossless-JSON snapshotting.
 */
export interface BoardTaskRecord {
  slug: string
  title: string
  status: string
  workType: string | null
  stage: string | null
  phase: TrellisPhase
  /** `yyyy-mm` archive bucket (or `other`), null for active tasks. */
  month: string | null
  archived: boolean
  artifacts: string[]
  /** Steps aggregation — zero/empty for legacy tasks without `steps`. */
  totalSteps: number
  completedSteps: number
  hasBlocked: boolean
  blockedReason: string | null
  hasPendingVerification: boolean
  activeStep: BoardActiveStep | null
}

/** Stage-lane track definition shipped with the board (from lib/state.js TRACKS). */
export interface BoardTrack {
  stages: string[]
  completed: string
}

/** Shape of the `/trellis-workflow/api/board` payload. */
export interface TrellisBoard {
  kind: 'board'
  /** Slug of the task bound to the requesting session, or null. */
  currentTask: string | null
  tasks: BoardTaskRecord[]
  /** Single source of truth for stage lanes keyed by work type. */
  tracks: Record<'feat' | 'issue' | 'refactor', BoardTrack>
}

/** Shape returned by the `trellis_artifact_update` tool. */
export interface TrellisArtifactUpdateResult {
  ok: boolean
  error: string | null
  slug: string | null
  artifact: string | null
  filePath: string | null
  bytesWritten: number | null
}

/** Shape returned by the `trellis_state` diagnostic tool. */
export interface TrellisState {
  project: string
  phase: TrellisPhase
  activeTask: string | null
  breadcrumbSource: 'project' | 'builtin' | 'outside-allowlist'
  matched: boolean
  /** Active task directory basename (the slug), when an active task exists. */
  slug: string | null
  /** Whether the slug follows `<work-type>-<mm-dd>-<name>` (e.g. feat-01-15-xxx). */
  slugValid: boolean | null
  /** Concrete suggested slug when invalid, else null. */
  slugExpected: string | null
  /** Human-readable reason when invalid, else null. */
  slugReason: string | null
}

/** Shape returned by the `trellis_task_create` tool. */
export interface TrellisTaskCreateResult {
  ok: boolean
  /** Human-readable error when ok=false, else null. */
  error: string | null
  /** Allowlist-matched project root (empty when outside the allowlist). */
  project: string | null
  /** Created task slug (`<work-type>-<mm-dd>-<name>`), null on failure. */
  slug: string | null
  /** Task dir reference (".trellis/tasks/<slug>"), null on failure. */
  taskDir: string | null
  title: string | null
  status: string | null
  workType: string | null
  stage: string | null
  phase: TrellisPhase | null
  /** Runtime session pointer files written/updated (e.g. "dsh-session.json"). */
  sessionFiles: string[] | null
  /** Artifact templates seeded into the task dir (prd.md, …), null on failure. */
  seeded: string[] | null
  /** Project template files initialized on first use (`.trellis/templates/`). */
  initialized: string[] | null
}

/** Shape returned by the `trellis_task_update` tool. */
export interface TrellisTaskUpdateResult {
  ok: boolean
  /** Human-readable error when ok=false, else null. */
  error: string | null
  /** Allowlist-matched project root (empty when outside the allowlist). */
  project: string | null
  /** Updated task slug (`<work-type>-<mm-dd>-<name>`), null on failure. */
  slug: string | null
  /** Task dir reference (".trellis/tasks/<slug>"), null on failure. */
  taskDir: string | null
  title: string | null
  status: string | null
  workType: string | null
  stage: string | null
  phase: TrellisPhase | null
  /** Bound runtime session file (e.g. "sess_abc.json"), null on failure or unbound. */
  boundSessionFile: string | null
}

/** Shape returned by the `trellis_task_archive` tool. */
export interface TrellisTaskArchiveResult {
  ok: boolean
  /** Human-readable error when ok=false, else null. */
  error: string | null
  /** Allowlist-matched project root. */
  project: string | null
  slug: string | null
  taskDir: string | null
  month: string | null
  bucket: string | null
  archivedAt: string | null
  unbound: string[] | null
}

/** Plugin configuration. */
export interface TrellisWorkflowConfig {
  /** Project roots allowed to receive a breadcrumb. */
  allowlist: string[]
  /** Only inject on this step index (default 1). */
  injectStep: number
  /** Standalone words that suppress injection for a turn. */
  skipKeywords: string[]
  /** Assume codex-inline dispatch mode when resolving phase names. */
  inline: boolean
  /** Prune generic write/edit tools during the planning phase; only read tools and trellis_artifact_update remain. */
  enforceReadonlyPlanning?: boolean
}

declare const plugin: import('@deepseek-ai/cordis').Plugin<any, TrellisWorkflowConfig>
export default plugin
