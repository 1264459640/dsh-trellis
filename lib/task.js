/**
 * Task creation for the trellis workflow trigger (`trellis_task_create`).
 *
 * The model-facing create-task tool's write half: builds the task.json content
 * from the plugin's own conventions (`work-types.md` + `lib/state.js` tracks),
 * seeds the bundled artifact templates into the task dir, initializes the
 * project-level `.trellis/templates/` on first use, and — the piece most
 * hand-rolled task creation forgets — synchronously writes the runtime session
 * pointer(s) with `current_task`, so the per-turn breadcrumb, phase resolution
 * and Web chip see the new task immediately.
 *
 * Pure helpers here are unit-testable; every IO goes through the caller's
 * `ctx.fs` so sandbox / observation policy applies to each write.
 */

import fs from 'node:fs'
import path from 'node:path'
import { skillsRoot } from './skills.js'
import {
  todayMmDd,
  validateSlug,
  fallbackStage,
  stageOnTrack,
  TRACKS,
  activeTaskFromSession,
  activeTaskForSession,
} from './state.js'

/** The three work types the plugin routes (see skills/_templates/work-types.md). */
export const WORK_TYPES = ['feat', 'issue', 'refactor']

/** Statuses a fresh task may start in (planning is the workflow default). */
export const TASK_STATUSES = ['planning', 'in_progress', 'completed']

/** Runtime session pointer file the deterministic picker prefers (lib/state.js activeTaskPointer). */
export const CANONICAL_SESSION_FILE = 'dsh-session.json'

/**
 * Slugify free text into a short-name fragment for slug derivation.
 * @param {string} value raw name / title.
 * @param {number} [max] max fragment length.
 * @returns {string} lowercase, hyphen-joined, filesystem-safe fragment.
 */
export function slugifyName(value, max = 32) {
  const out = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
  return out || 'task'
}

/**
 * Derive today's slug `<work-type>-<mm-dd>-<name>`.
 * @param {string} workType feat | issue | refactor.
 * @param {string} name short name (or title) to slugify.
 * @param {string} [today] today's mm-dd (injected for tests).
 * @returns {string} e.g. "feat-08-15-billing-export".
 */
export function deriveSlug(workType, name, today = todayMmDd()) {
  return `${workType}-${today}-${slugifyName(name)}`
}

/**
 * Build the task.json content following the plugin's extension convention
 * (native `status` + `work` block, see skills/_templates/work-types.md).
 * @param {object} args { title, workType, mode?, status?, stage?, description? }.
 * @returns {object} serializable task.json body.
 */
export function buildTaskJson({ title, workType, mode = 'standard', status = 'planning', stage, description }) {
  const task = {
    title: String(title || '').trim(),
    status,
    work: {
      type: workType,
      mode,
      stage: stage || fallbackStage(workType, status) || 'prd',
      execution_lane: mode,
    },
  }
  if (description && typeof description === 'string' && description.trim()) {
    task.description = description.trim()
  }
  return task
}

/**
 * List the bundled artifact template file names for a work type.
 * @param {string} workType feat | issue | refactor.
 * @returns {string[]} file names (never directories), empty when unknown type.
 */
export function artifactTemplateNames(workType) {
  const dir = path.join(skillsRoot, '_templates', workType)
  try {
    return fs.readdirSync(dir).filter((name) => {
      const full = path.join(dir, name)
      try {
        return fs.statSync(full).isFile()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

/**
 * Read a bundled artifact template's text.
 * @param {string} workType feat | issue | refactor.
 * @param {string} name template file name.
 * @returns {string} raw template content.
 */
export function readBundledTemplate(workType, name) {
  return fs.readFileSync(path.join(skillsRoot, '_templates', workType, name), 'utf8')
}

/**
 * Validate a task-creation request's shape: work type, status, stage, slug.
 * Pure decision — no IO. Returns either a normalized args object or an error.
 * @param {object} args the tool's raw arguments.
 * @returns {{ ok: true, args: object } | { ok: false, error: string }}
 */
export function validateCreateArgs(args) {
  const workType = typeof args.workType === 'string' ? args.workType.trim() : ''
  if (!WORK_TYPES.includes(workType)) {
    return { ok: false, error: `workType 必须是 ${WORK_TYPES.join(' | ')} 之一（当前：${workType || '（空）'}）` }
  }
  const status = typeof args.status === 'string' && args.status ? args.status : 'planning'
  if (!TASK_STATUSES.includes(status)) {
    return { ok: false, error: `status 必须是 ${TASK_STATUSES.join(' | ')} 之一（当前：${status}）` }
  }
  const mode = typeof args.mode === 'string' && args.mode ? args.mode : 'standard'
  if (!['quick', 'standard'].includes(mode)) {
    return { ok: false, error: `mode 必须是 quick | standard（当前：${mode}）` }
  }
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  if (!title) {
    return { ok: false, error: 'title 不能为空' }
  }
  const stage = typeof args.stage === 'string' && args.stage ? args.stage : undefined
  if (stage && !stageOnTrack(workType, stage)) {
    const track = TRACKS[workType]
    const allowed = track ? track.stages.join(' | ') : ''
    return { ok: false, error: `stage 不在 ${workType} 轨道上（允许：${allowed}；当前：${stage}）` }
  }
  const today = todayMmDd()
  const slug = typeof args.slug === 'string' && args.slug.trim() ? args.slug.trim() : undefined
  const resolvedSlug = slug || deriveSlug(workType, args.name || title, today)
  const check = validateSlug(resolvedSlug, workType, today)
  if (!check.valid) {
    return { ok: false, error: `slug 不合规：${check.reason}；建议 ${check.expected}` }
  }
  return {
    ok: true,
    args: { ...args, workType, status, mode, title, stage, slug: resolvedSlug },
  }
}

/**
 * Read an existing runtime session pointer file (or null) via ctx.fs.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} absPath absolute pointer file path.
 * @returns {Promise<object | null>} parsed JSON, or null when absent/unreadable.
 */
export async function readPointerFile(dshFs, absPath) {
  try {
    const target = await dshFs.resolve(absPath)
    const info = await dshFs.stat(target)
    if (!info) return null
    const parsed = JSON.parse((await dshFs.readText(target)).replace(/^\uFEFF/, ''))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Write one runtime session pointer file, preserving any existing fields
 * (platform, last_seen_at, current_run, …) and setting `current_task`.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} absPath pointer file path.
 * @param {string} currentTask the task dir reference (".trellis/tasks/<slug>").
 * @param {object} opts { signal?, sandboxPolicy? } forwarded to writeText.
 * @returns {Promise<void>}
 */
export async function writePointerFile(dshFs, absPath, currentTask, { signal, sandboxPolicy } = {}) {
  const existing = await readPointerFile(dshFs, absPath)
  const next = existing ? { ...existing, current_task: currentTask } : { current_task: currentTask }
  const target = await dshFs.resolve(absPath)
  await dshFs.writeText(target, JSON.stringify(next, null, 2), undefined, signal, sandboxPolicy)
}

/**
 * Sanitize a DSH session id into a filesystem-safe pointer file basename.
 * @param {string | undefined} sessionId live session id.
 * @returns {string} safe basename (without .json).
 */
export function sessionFileBasename(sessionId) {
  if (!sessionId) return 'dsh-session'
  const safe = String(sessionId).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return safe || 'dsh-session'
}

/**
 * Create a Trellis task end-to-end: task dir + task.json, seeded artifact
 * templates, project-level `.trellis/templates/` init (first use), and the
 * runtime session pointer(s) bound to the new task. All writes go through the
 * caller's `ctx.fs` (sandbox/observation policy applies per write).
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} args normalized create args (see validateCreateArgs).
 * @param {object} [exec] tool execution context { signal?, sessionId? }.
 * @param {object} [sandboxPolicy] per-call policy from ctx.sandboxPolicy.resolve(exec).
 * @returns {Promise<{ ok: true, slug: string, taskDir: string, taskJson: object, sessionFiles: string[], seeded: string[], initialized: string[] } | { ok: false, error: string }>}
 */
export async function createTaskRecord(dshFs, root, args, exec = {}, sandboxPolicy) {
  const { slug, title, workType, status, mode, stage } = args
  const p = { tasksDir: path.join(root, '.trellis', 'tasks') }
  const taskDir = path.join(p.tasksDir, slug)
  const taskDirRel = `.trellis/tasks/${slug}`
  const signal = exec.signal

  // Refuse to clobber an existing task.
  const taskJsonAbs = path.join(taskDir, 'task.json')
  const taskJsonTarget = await dshFs.resolve(taskJsonAbs)
  const existing = await dshFs.stat(taskJsonTarget)
  if (existing) {
    return { ok: false, error: `任务已存在：${taskDirRel}/ — 请用 trellis-continue 恢复，不要重建` }
  }

  const taskJson = buildTaskJson({ title, workType, mode, status, stage, description: args.description })

  // 1. task.json (writeText creates parent dirs atomically).
  await dshFs.writeText(taskJsonTarget, JSON.stringify(taskJson, null, 2), undefined, signal, sandboxPolicy)

  // 2. Seed bundled artifact templates into the task dir (skip present files).
  const seeded = []
  for (const name of artifactTemplateNames(workType)) {
    const target = await dshFs.resolve(path.join(taskDir, name))
    const info = await dshFs.stat(target)
    if (info) continue
    await dshFs.writeText(target, readBundledTemplate(workType, name), undefined, signal, sandboxPolicy)
    seeded.push(name)
  }

  // 3. Project-level template init on first use (.trellis/templates/<type>/ + work-types.md).
  const initialized = []
  const tplTypeDir = path.join(root, '.trellis', 'templates', workType)
  for (const name of artifactTemplateNames(workType)) {
    const target = await dshFs.resolve(path.join(tplTypeDir, name))
    const info = await dshFs.stat(target)
    if (info) continue
    await dshFs.writeText(target, readBundledTemplate(workType, name), undefined, signal, sandboxPolicy)
    initialized.push(name)
  }
  const workTypesSrc = path.join(skillsRoot, '_templates', 'work-types.md')
  const workTypesTarget = await dshFs.resolve(path.join(root, '.trellis', 'templates', 'work-types.md'))
  if (fs.existsSync(workTypesSrc) && !(await dshFs.stat(workTypesTarget))) {
    await dshFs.writeText(workTypesTarget, fs.readFileSync(workTypesSrc, 'utf8'), undefined, signal, sandboxPolicy)
    initialized.push('work-types.md')
  }

  // 4. Runtime session pointer: write ONLY the creating session's own pointer file
  //    when a session id is known. Do NOT dual-write to CANONICAL_SESSION_FILE,
  //    so other sessions are never cross-pollinated or hijacked.
  const runtimeDir = path.join(root, '.trellis', '.runtime', 'sessions')
  const sessionFiles = []
  if (exec.sessionId) {
    const perSession = path.join(runtimeDir, `${sessionFileBasename(exec.sessionId)}.json`)
    await writePointerFile(dshFs, perSession, taskDirRel, { signal, sandboxPolicy })
    sessionFiles.push(`${sessionFileBasename(exec.sessionId)}.json`)
  } else {
    const canonical = path.join(runtimeDir, CANONICAL_SESSION_FILE)
    await writePointerFile(dshFs, canonical, taskDirRel, { signal, sandboxPolicy })
    sessionFiles.push(CANONICAL_SESSION_FILE)
  }

  return { ok: true, slug, taskDir: taskDirRel, taskJson, sessionFiles, seeded, initialized }
}

/**
 * Bind a session to a task by writing ONLY that session's own pointer file
 * (`<sessionFileBasename(sessionId)>.json`). Other sessions' pointer files and
 * the canonical `dsh-session.json` are never touched — unless the session has
 * no id, in which case the canonical file IS this session's pointer. The
 * caller must verify the task exists before calling (the route does).
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root.
 * @param {string | undefined} sessionId live session id.
 * @param {string} taskDirRel the task dir reference (".trellis/tasks/<slug>").
 * @param {object} [opts] { signal?, sandboxPolicy? } forwarded to writeText.
 * @returns {Promise<string>} the pointer file basename written.
 */
export async function bindTaskPointer(dshFs, root, sessionId, taskDirRel, opts = {}) {
  const runtimeDir = path.join(root, '.trellis', '.runtime', 'sessions')
  const name = `${sessionFileBasename(sessionId)}.json`
  await writePointerFile(dshFs, path.join(runtimeDir, name), taskDirRel, opts)
  return name
}

/**
 * Unbind a session from its task by writing `current_task: null` to the
 * session's own pointer file. The file stays (platform fields like
 * last_seen_at are preserved) but no longer carries an active-task pointer,
 * so `activeTaskForSession` treats it as an explicit unbound state.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root.
 * @param {string | undefined} sessionId live session id.
 * @param {object} [opts] { signal?, sandboxPolicy? } forwarded to writeText.
 * @returns {Promise<string>} the pointer file basename written.
 */
export async function unbindTaskPointer(dshFs, root, sessionId, opts = {}) {
  const runtimeDir = path.join(root, '.trellis', '.runtime', 'sessions')
  const name = `${sessionFileBasename(sessionId)}.json`
  await writePointerFile(dshFs, path.join(runtimeDir, name), null, opts)
  return name
}

/**
 * Find the active task slug for a session (or project-wide deterministic pick when no sessionId).
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root.
 * @param {string | undefined} sessionId live session id.
 * @returns {Promise<string | null>} active task slug or null.
 */
export async function findActiveTaskSlug(dshFs, root, sessionId) {
  const runtimeDir = path.join(root, '.trellis', '.runtime', 'sessions')
  try {
    const dirTarget = await dshFs.resolve(runtimeDir)
    const entries = await dshFs.listDir(dirTarget)
    const parsed = []
    for (const entry of entries) {
      if (!entry.name || !entry.name.endsWith('.json')) continue
      try {
        const text = await dshFs.readText(entry.target)
        const { taskDir } = activeTaskFromSession(JSON.parse(text.replace(/^\uFEFF/, '')))
        parsed.push({ name: entry.name, taskDir: taskDir || null })
      } catch {
        parsed.push({ name: entry.name, taskDir: null })
      }
    }
    const picked = activeTaskForSession(parsed, sessionId ? `${sessionFileBasename(sessionId)}.json` : undefined)
    if (!picked) return null
    return picked.replace(/\\/g, '/').split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

/**
 * Validate a task-update request's shape: status, stage, mode, title, description, slug.
 * Pure decision — no IO. Returns either a normalized args object or an error.
 * @param {object} args the tool's raw arguments.
 * @returns {{ ok: true, args: object } | { ok: false, error: string }}
 */
export function validateUpdateArgs(args) {
  if (!args || typeof args !== 'object') {
    return { ok: false, error: '参数必须是对象' }
  }
  const slug = typeof args.slug === 'string' && args.slug.trim() ? args.slug.trim() : undefined
  const status = typeof args.status === 'string' && args.status.trim() ? args.status.trim() : undefined
  if (status && !TASK_STATUSES.includes(status)) {
    return { ok: false, error: `status 必须是 ${TASK_STATUSES.join(' | ')} 之一（当前：${status}）` }
  }
  const mode = typeof args.mode === 'string' && args.mode.trim() ? args.mode.trim() : undefined
  if (mode && !['quick', 'standard'].includes(mode)) {
    return { ok: false, error: `mode 必须是 quick | standard（当前：${mode}）` }
  }
  const title = typeof args.title === 'string' ? args.title.trim() : undefined
  if (title !== undefined && !title) {
    return { ok: false, error: 'title 不能为空字符串' }
  }
  const stage = typeof args.stage === 'string' && args.stage.trim() ? args.stage.trim() : undefined
  const description = typeof args.description === 'string' ? args.description : undefined

  if (!slug && !status && !mode && !title && !stage && description === undefined) {
    return { ok: false, error: '至少需要指定一项要更新的字段（status、stage、mode、title、description）' }
  }

  return {
    ok: true,
    args: { ...args, slug, status, mode, title, stage, description },
  }
}

/**
 * Update an existing Trellis task's task.json, validate stage against workType track,
 * and ensure the current session is bound to it.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} args normalized update args (see validateUpdateArgs).
 * @param {object} [exec] tool execution context { signal?, sessionId? }.
 * @param {object} [sandboxPolicy] per-call policy from ctx.sandboxPolicy.resolve(exec).
 * @returns {Promise<{ ok: true, slug: string, taskDir: string, taskJson: object, boundSessionFile?: string } | { ok: false, error: string }>}
 */
export async function updateTaskRecord(dshFs, root, args, exec = {}, sandboxPolicy) {
  const signal = exec.signal
  let slug = args.slug
  if (!slug) {
    slug = await findActiveTaskSlug(dshFs, root, exec.sessionId)
    if (!slug) {
      return { ok: false, error: '未指定 slug 且当前 session 未绑定任何活动任务' }
    }
  }

  const taskDir = path.join(root, '.trellis', 'tasks', slug)
  const taskDirRel = `.trellis/tasks/${slug}`
  const taskJsonAbs = path.join(taskDir, 'task.json')
  const taskJsonTarget = await dshFs.resolve(taskJsonAbs)
  const stat = await dshFs.stat(taskJsonTarget)
  if (!stat) {
    return { ok: false, error: `任务不存在：${taskDirRel}/task.json` }
  }

  let taskJson
  try {
    const raw = await dshFs.readText(taskJsonTarget)
    taskJson = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch (err) {
    return { ok: false, error: `读取或解析 task.json 失败：${err.message}` }
  }

  if (!taskJson || typeof taskJson !== 'object') {
    taskJson = {}
  }

  // Work type determination
  const workType =
    (taskJson.work && typeof taskJson.work.type === 'string' && taskJson.work.type) ||
    slug.split('-')[0] ||
    'feat'

  // If stage is provided, validate against workType track
  if (args.stage) {
    if (!stageOnTrack(workType, args.stage)) {
      const track = TRACKS[workType]
      const allowed = track ? track.stages.join(' | ') : ''
      return { ok: false, error: `stage 不在 ${workType} 轨道上（允许：${allowed}；当前：${args.stage}）` }
    }
  }

  // Apply updates
  if (args.title !== undefined) {
    taskJson.title = args.title
  }
  if (args.status !== undefined) {
    taskJson.status = args.status
  }
  if (!taskJson.work || typeof taskJson.work !== 'object') {
    taskJson.work = { type: workType }
  }
  if (args.mode !== undefined) {
    taskJson.work.mode = args.mode
    taskJson.work.execution_lane = args.mode
  }
  if (args.stage !== undefined) {
    taskJson.work.stage = args.stage
  }
  if (args.description !== undefined) {
    if (args.description.trim()) {
      taskJson.description = args.description.trim()
    } else {
      delete taskJson.description
    }
  }

  // Write updated task.json
  await dshFs.writeText(taskJsonTarget, JSON.stringify(taskJson, null, 2), undefined, signal, sandboxPolicy)

  // Ensure current session is bound to this task if sessionId is provided
  let boundSessionFile
  if (exec.sessionId) {
    boundSessionFile = await bindTaskPointer(dshFs, root, exec.sessionId, taskDirRel, { signal, sandboxPolicy })
  }

  return {
    ok: true,
    slug,
    taskDir: taskDirRel,
    taskJson,
    boundSessionFile,
  }
}
