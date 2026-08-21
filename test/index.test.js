import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  validateSlug,
  todayMmDd,
  monthKeyFromSlug,
  ymKeyFromSlug,
  TRACKS,
  activeTaskForSession,
  activeTaskPointer,
} from '../lib/state.js'
import { isTrustedApiRequest } from '../lib/trust.js'
import {
  archiveTargetOf,
  validateArchiveArgs,
  isPathUnder,
  assertPolicyAllowsWrite,
  ARCHIVE_OTHER_BUCKET,
} from '../lib/archive.js'
import { archiveTaskRecord } from '../lib/archive.js'
import {
  NAME,
  SOURCE_KIND,
  DEFAULT_ALLOWLIST,
  SETTINGS_NAMESPACE,
  API_PREFIX,
} from '../lib/meta.js'
import {
  deriveSlug,
  slugifyName,
  WORK_TYPES,
  TASK_STATUSES,
  artifactTemplateNames,
  createTaskRecord,
  validateUpdateArgs,
  updateTaskRecord,
  findActiveTaskSlug,
  CANONICAL_SESSION_FILE,
} from '../lib/task.js'
import {
  buildBoard,
  readTask,
  invalidateArchiveBucket,
  clearArchiveCache,
} from '../lib/board.js'

test('meta constants', () => {
  assert.equal(NAME, 'trellis-workflow')
  assert.equal(SOURCE_KIND, 'trellis')
  assert.deepEqual(DEFAULT_ALLOWLIST, [])
  assert.equal(SETTINGS_NAMESPACE, 'trellis-workflow')
  assert.equal(API_PREFIX, '/trellis-workflow/api')
})

test('validateSlug - valid patterns', () => {
  assert.equal(validateSlug('feat-08-17-kanban').valid, true)
  assert.equal(validateSlug('issue-01-02-fix-bug').valid, true)
  assert.equal(validateSlug('refactor-12-31-cleanup').valid, true)
})

test('validateSlug - invalid patterns and type mismatches', () => {
  assert.equal(validateSlug('invalid-slug').valid, false)
  assert.equal(validateSlug(null).valid, false)
  assert.equal(validateSlug('').valid, false)
  assert.equal(validateSlug('feat-99-99-invalid-date').valid, false)
  // Type mismatch with work.type
  assert.equal(validateSlug('feat-08-17-kanban', 'issue').valid, false)
  assert.equal(validateSlug('feat-08-17-kanban', 'feat').valid, true)
})

test('todayMmDd returns formatted date', () => {
  const fixedDate = new Date(2026, 7, 18) // Month is 0-indexed (7 = Aug)
  assert.equal(todayMmDd(fixedDate), '08-18')
})

test('deriveSlug and slugifyName generate correct format', () => {
  assert.equal(slugifyName('My Feature Name!'), 'my-feature-name')
  const slug = deriveSlug('feat', 'My Feature', '08-18')
  assert.equal(slug, 'feat-08-18-my-feature')
  assert.deepEqual(WORK_TYPES, ['feat', 'issue', 'refactor'])
  assert.deepEqual(TASK_STATUSES, ['planning', 'in_progress', 'completed'])
  assert.ok(artifactTemplateNames('feat').includes('prd.md'))
})

test('monthKeyFromSlug extracts month correctly', () => {
  assert.equal(monthKeyFromSlug('feat-08-17-kanban'), '08')
  assert.equal(monthKeyFromSlug('issue-12-01-test'), '12')
  assert.equal(monthKeyFromSlug('legacy-task-no-date'), null)
})

test('ymKeyFromSlug builds yyyy-mm from slug month + injected year', () => {
  assert.equal(ymKeyFromSlug('feat-08-17-kanban', 2025), '2025-08')
  assert.equal(ymKeyFromSlug('issue-12-01-test', 2024), '2024-12')
  // No mm-dd segment → null (the `other` archive bucket).
  assert.equal(ymKeyFromSlug('legacy-task-no-date', 2025), null)
  assert.equal(ymKeyFromSlug(null, 2025), null)
})

test('archiveTargetOf resolves active and archive paths', () => {
  const ym = archiveTargetOf('/proj', 'feat-08-17-kanban', '2025-08')
  assert.equal(ym.source, '/proj/.trellis/tasks/feat-08-17-kanban')
  assert.equal(ym.target, '/proj/.trellis/tasks/archive/2025-08/feat-08-17-kanban')
  assert.equal(ym.sourceRel, '.trellis/tasks/feat-08-17-kanban')
  assert.equal(ym.targetRel, '.trellis/tasks/archive/2025-08/feat-08-17-kanban')
  assert.equal(ym.bucket, '2025-08')
  // Legacy slug without mm-dd → the `other` bucket.
  const other = archiveTargetOf('/proj', 'legacy-x', null)
  assert.equal(other.bucket, ARCHIVE_OTHER_BUCKET)
  assert.equal(other.target, '/proj/.trellis/tasks/archive/other/legacy-x')
})

test('validateArchiveArgs rejects empty/illegal slugs', () => {
  assert.equal(validateArchiveArgs({ slug: 'feat-08-17-kanban' }).ok, true)
  assert.equal(validateArchiveArgs({}).ok, false)
  assert.equal(validateArchiveArgs({ slug: '' }).ok, false)
  assert.equal(validateArchiveArgs({ slug: '../escape' }).ok, false)
  assert.equal(validateArchiveArgs({ slug: 'a/b' }).ok, false)
})

test('isPathUnder is a whole-segment containment check', () => {
  assert.equal(isPathUnder('/proj', '/proj'), true)
  assert.equal(isPathUnder('/proj', '/proj/.trellis/tasks'), true)
  assert.equal(isPathUnder('/proj', '/proj2/.trellis/tasks'), false)
  assert.equal(isPathUnder('/proj/.trellis', '/proj/.trellis/tasks/x'), true)
  assert.equal(isPathUnder('/proj', 'C:/proj/.trellis'), false)
})

test('assertPolicyAllowsWrite fail-closes under confined modes', () => {
  // read-only denies
  assert.throws(
    () => assertPolicyAllowsWrite({ mode: 'read-only', workspaceRoot: '/ws' }, '.trellis/tasks/x', '/proj'),
    (error) => error.code === 'FS_SANDBOX_DENIED',
  )
  // workspace-write outside the workspaceRoot denies
  assert.throws(
    () => assertPolicyAllowsWrite({ mode: 'workspace-write', workspaceRoot: '/ws' }, '.trellis/tasks/x', '/proj'),
    (error) => error.code === 'FS_SANDBOX_DENIED',
  )
  // workspace-write inside the workspaceRoot passes
  assert.doesNotThrow(() =>
    assertPolicyAllowsWrite({ mode: 'workspace-write', workspaceRoot: '/proj' }, '.trellis/tasks/x', '/proj'),
  )
  // danger-full-access / undefined pass
  assert.doesNotThrow(() =>
    assertPolicyAllowsWrite({ mode: 'danger-full-access', workspaceRoot: '/ws' }, '.trellis/tasks/x', '/proj'),
  )
  assert.doesNotThrow(() => assertPolicyAllowsWrite(undefined, '.trellis/tasks/x', '/proj'))
})

/**
 * A minimal dsh-fs stand-in over a real temp directory, implementing just the
 * surface lib/task.js + lib/archive.js use (resolve/stat/readText/listDir/
 * writeText) — enough to exercise the archive move + pointer unbind end to end.
 */
function mockFs(root) {
  const target = (p) => ({ targetKey: path.resolve(p), displayPath: p })
  return {
    async resolve(p) {
      return target(p)
    },
    async stat(t) {
      try {
        const s = statSync(t.targetKey)
        return s.isFile() ? { type: 'file' } : s.isDirectory() ? { type: 'dir' } : { type: 'other' }
      } catch {
        return undefined
      }
    },
    async readText(t) {
      return readFileSync(t.targetKey, 'utf8')
    },
    async listDir(t) {
      return readdirSync(t.targetKey, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        target: target(path.join(t.targetKey, entry.name)),
      }))
    },
    async writeText(t, content) {
      mkdirSync(path.dirname(t.targetKey), { recursive: true })
      writeFileSync(t.targetKey, content)
    },
  }
}

test('archiveTaskRecord moves a completed task into the yyyy-mm bucket and unbinds its pointers', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-archive-'))
  const slug = 'feat-08-17-kanban'
  try {
    mkdirSync(path.join(root, '.trellis', 'tasks', slug), { recursive: true })
    writeFileSync(
      path.join(root, '.trellis', 'tasks', slug, 'task.json'),
      JSON.stringify({ title: 'Kanban', status: 'completed', work: { type: 'feat', stage: 'check' } }),
    )
    writeFileSync(path.join(root, '.trellis', 'tasks', slug, 'prd.md'), '# prd')
    const sessionsDir = path.join(root, '.trellis', '.runtime', 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    writeFileSync(path.join(sessionsDir, 'dsh-session.json'), JSON.stringify({ current_task: `.trellis/tasks/${slug}` }))
    writeFileSync(
      path.join(sessionsDir, 'sess_other.json'),
      JSON.stringify({ current_task: '.trellis/tasks/other-task' }),
    )

    const res = await archiveTaskRecord(mockFs(root), root, { slug }, {}, undefined, { now: new Date(2025, 7, 18) })
    assert.equal(res.ok, true)
    assert.equal(res.taskDir, `.trellis/tasks/archive/2025-08/${slug}`)
    assert.equal(res.month, '2025-08')
    assert.equal(res.bucket, '2025-08')
    // Moved, not copied: the active-tree dir is gone, the archive copy holds
    // the task.json AND the artifact files.
    assert.equal(existsSync(path.join(root, '.trellis', 'tasks', slug)), false)
    assert.equal(existsSync(path.join(root, '.trellis', 'tasks', 'archive', '2025-08', slug, 'task.json')), true)
    assert.equal(existsSync(path.join(root, '.trellis', 'tasks', 'archive', '2025-08', slug, 'prd.md')), true)
    // Only the pointer that referenced the archived task was unbound.
    assert.deepEqual(res.unbound.sort(), ['dsh-session.json'])
    const unbound = JSON.parse(readFileSync(path.join(sessionsDir, 'dsh-session.json'), 'utf8'))
    assert.equal(unbound.current_task, null)
    const untouched = JSON.parse(readFileSync(path.join(sessionsDir, 'sess_other.json'), 'utf8'))
    assert.equal(untouched.current_task, '.trellis/tasks/other-task')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('archiveTaskRecord refuses non-completed tasks without moving', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-archive-'))
  const slug = 'feat-08-17-wip'
  try {
    mkdirSync(path.join(root, '.trellis', 'tasks', slug), { recursive: true })
    writeFileSync(
      path.join(root, '.trellis', 'tasks', slug, 'task.json'),
      JSON.stringify({ title: 'WIP', status: 'in_progress', work: { type: 'feat' } }),
    )
    const res = await archiveTaskRecord(mockFs(root), root, { slug })
    assert.equal(res.ok, false)
    assert.match(res.error, /completed/)
    assert.equal(existsSync(path.join(root, '.trellis', 'tasks', slug, 'task.json')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('archiveTaskRecord sends legacy slugs without mm-dd to the other bucket', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-archive-'))
  const slug = 'legacy-task-no-date'
  try {
    mkdirSync(path.join(root, '.trellis', 'tasks', slug), { recursive: true })
    writeFileSync(
      path.join(root, '.trellis', 'tasks', slug, 'task.json'),
      JSON.stringify({ title: 'Legacy', status: 'completed' }),
    )
    const res = await archiveTaskRecord(mockFs(root), root, { slug }, {}, undefined, { now: new Date(2025, 7, 18) })
    assert.equal(res.ok, true)
    assert.equal(res.month, null)
    assert.equal(res.bucket, ARCHIVE_OTHER_BUCKET)
    assert.equal(res.taskDir, `.trellis/tasks/archive/${ARCHIVE_OTHER_BUCKET}/${slug}`)
    assert.equal(existsSync(path.join(root, '.trellis', 'tasks', 'archive', ARCHIVE_OTHER_BUCKET, slug, 'task.json')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('TRACKS contains feat, issue, refactor lanes', () => {
  assert.ok(Array.isArray(TRACKS.feat.stages))
  assert.ok(Array.isArray(TRACKS.issue.stages))
  assert.ok(Array.isArray(TRACKS.refactor.stages))
  assert.ok(TRACKS.feat.stages.includes('prd'))
  assert.ok(TRACKS.feat.stages.includes('design'))
  assert.ok(TRACKS.feat.stages.includes('impl'))
})

test('isTrustedApiRequest - loopback verification', () => {
  // IPv4 loopback
  assert.equal(isTrustedApiRequest({ host: '127.0.0.1:3080' }), true)
  assert.equal(isTrustedApiRequest({ host: 'localhost:3080' }), true)
  assert.equal(isTrustedApiRequest({ host: '127.0.0.2:8080' }), true)
  // IPv6 loopback
  assert.equal(isTrustedApiRequest({ host: '[::1]:3080' }), true)
  // Remote host without trusted entry
  assert.equal(isTrustedApiRequest({ host: 'example.com' }), false)
  assert.equal(isTrustedApiRequest({ host: '192.168.1.100:3080' }), false)
  // Missing or empty host
  assert.equal(isTrustedApiRequest({}), false)
  assert.equal(isTrustedApiRequest(null), false)
})

test('isTrustedApiRequest - trusted hosts allowlist', () => {
  assert.equal(
    isTrustedApiRequest(
      { host: 'dsh.internal.net:3080' },
      ['dsh.internal.net:3080']
    ),
    true
  )
  assert.equal(
    isTrustedApiRequest(
      { host: 'other.net:3080' },
      ['dsh.internal.net:3080']
    ),
    false
  )
})

test('readTask parses task metadata and artifacts correctly', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-readtask-'))
  try {
    const taskDir = path.join(root, '.trellis', 'tasks', 'feat-08-18-test')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(
      path.join(taskDir, 'task.json'),
      JSON.stringify({
        title: 'Test Feature',
        status: 'in_progress',
        work: { type: 'feat', stage: 'impl' },
      })
    )
    writeFileSync(path.join(taskDir, 'prd.md'), '# PRD')
    writeFileSync(path.join(taskDir, 'design.md'), '# Design')

    const fs = mockFs(root)
    const dirEntry = {
      name: 'feat-08-18-test',
      target: { targetKey: taskDir, displayPath: taskDir },
    }
    const res = await readTask(fs, dirEntry, { month: '2025-08', archived: false })
    assert.ok(res)
    assert.equal(res.slug, 'feat-08-18-test')
    assert.equal(res.title, 'Test Feature')
    assert.equal(res.status, 'in_progress')
    assert.equal(res.workType, 'feat')
    assert.equal(res.stage, 'impl')
    assert.equal(res.month, '2025-08')
    assert.equal(res.archived, false)
    assert.ok(res.artifacts.includes('prd.md'))
    assert.ok(res.artifacts.includes('design.md'))

    // Missing task.json -> null
    const emptyDir = path.join(root, '.trellis', 'tasks', 'empty-dir')
    mkdirSync(emptyDir, { recursive: true })
    const resEmpty = await readTask(fs, { name: 'empty-dir', target: { targetKey: emptyDir } }, { month: null, archived: false })
    assert.equal(resEmpty, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('buildBoard resolves active tasks, archive buckets, and session pointers with caching', async () => {
  clearArchiveCache()
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-board-'))
  try {
    const activeDir = path.join(root, '.trellis', 'tasks', 'feat-08-18-active')
    mkdirSync(activeDir, { recursive: true })
    writeFileSync(
      path.join(activeDir, 'task.json'),
      JSON.stringify({
        title: 'Active Task',
        status: 'planning',
        work: { type: 'feat', stage: 'prd' },
      })
    )

    const archiveDir = path.join(root, '.trellis', 'tasks', 'archive', '2025-07', 'feat-07-10-archived')
    mkdirSync(archiveDir, { recursive: true })
    writeFileSync(
      path.join(archiveDir, 'task.json'),
      JSON.stringify({
        title: 'Archived Task',
        status: 'completed',
        work: { type: 'feat', stage: 'completed' },
      })
    )

    const sessionsDir = path.join(root, '.trellis', '.runtime', 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    writeFileSync(
      path.join(sessionsDir, 'session-abc.json'),
      JSON.stringify({ current_task: '.trellis/tasks/feat-08-18-active' })
    )

    const fs = mockFs(root)
    const board = await buildBoard(fs, root, 'session-abc')
    assert.equal(board.kind, 'board')
    assert.equal(board.currentTask, 'feat-08-18-active')
    assert.equal(board.tasks.length, 2)

    const activeItem = board.tasks.find((t) => t.slug === 'feat-08-18-active')
    assert.ok(activeItem)
    assert.equal(activeItem.status, 'planning')
    assert.equal(activeItem.archived, false)

    const archivedItem = board.tasks.find((t) => t.slug === 'feat-07-10-archived')
    assert.ok(archivedItem)
    assert.equal(archivedItem.status, 'completed')
    assert.equal(archivedItem.archived, true)
    assert.equal(archivedItem.month, '2025-07')

    // Second run should use in-memory archive cache
    const boardCached = await buildBoard(fs, root, 'session-abc')
    assert.equal(boardCached.tasks.length, 2)

    // Invalidation test
    invalidateArchiveBucket(root, '2025-07')
    const boardRevalidated = await buildBoard(fs, root, 'session-abc')
    assert.equal(boardRevalidated.tasks.length, 2)
  } finally {
    clearArchiveCache()
    rmSync(root, { recursive: true, force: true })
  }
})

test('activeTaskForSession enforces strict per-session isolation without cross-session bleeding', () => {
  const sessions = [
    { name: 'dsh-session.json', taskDir: '.trellis/tasks/global-task' },
    { name: 'sess_a.json', taskDir: '.trellis/tasks/task-a' },
    { name: 'sess_b.json', taskDir: '.trellis/tasks/task-b' },
    { name: 'sess_unbound.json', taskDir: null },
  ]

  // Session A resolves task-a
  assert.equal(activeTaskForSession(sessions, 'sess_a.json'), '.trellis/tasks/task-a')
  // Session B resolves task-b
  assert.equal(activeTaskForSession(sessions, 'sess_b.json'), '.trellis/tasks/task-b')
  // Session C (no file) must resolve to null, NOT fallback to global or another session
  assert.equal(activeTaskForSession(sessions, 'sess_c.json'), null)
  // Unbound session resolves to null
  assert.equal(activeTaskForSession(sessions, 'sess_unbound.json'), null)
  // No session specified (fallback/headless) picks global canonical
  assert.equal(activeTaskForSession(sessions, null), '.trellis/tasks/global-task')
})

test('createTaskRecord with sessionId writes ONLY the session file and does not clobber other sessions', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-create-session-'))
  try {
    const fs = mockFs(root)
    const sessionsDir = path.join(root, '.trellis', '.runtime', 'sessions')
    mkdirSync(sessionsDir, { recursive: true })

    // Session A already working on Task A
    writeFileSync(
      path.join(sessionsDir, 'sess_a.json'),
      JSON.stringify({ current_task: '.trellis/tasks/feat-08-18-task-a' }),
    )

    // Session B creates Task B
    const res = await createTaskRecord(
      fs,
      root,
      {
        workType: 'feat',
        title: 'Task B',
        mode: 'standard',
        status: 'planning',
        slug: 'feat-08-18-task-b',
      },
      { sessionId: 'sess_b' },
    )

    assert.equal(res.ok, true)
    // Only sess_b.json should be written
    assert.deepEqual(res.sessionFiles, ['sess_b.json'])
    assert.equal(existsSync(path.join(sessionsDir, 'sess_b.json')), true)
    assert.equal(existsSync(path.join(sessionsDir, 'dsh-session.json')), false)

    // Session A pointer must NOT be affected
    const sessionAContent = JSON.parse(readFileSync(path.join(sessionsDir, 'sess_a.json'), 'utf8'))
    assert.equal(sessionAContent.current_task, '.trellis/tasks/feat-08-18-task-a')

    const sessionBContent = JSON.parse(readFileSync(path.join(sessionsDir, 'sess_b.json'), 'utf8'))
    assert.equal(sessionBContent.current_task, '.trellis/tasks/feat-08-18-task-b')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('validateUpdateArgs validates status, mode, title and rejects empty updates', () => {
  // Empty arguments
  assert.equal(validateUpdateArgs({}).ok, false)
  assert.equal(validateUpdateArgs(null).ok, false)

  // Valid updates
  const valid1 = validateUpdateArgs({ status: 'in_progress', stage: 'impl' })
  assert.equal(valid1.ok, true)
  assert.equal(valid1.args.status, 'in_progress')
  assert.equal(valid1.args.stage, 'impl')

  const valid2 = validateUpdateArgs({ mode: 'quick', title: 'New Title', description: 'Updated desc' })
  assert.equal(valid2.ok, true)
  assert.equal(valid2.args.mode, 'quick')
  assert.equal(valid2.args.title, 'New Title')
  assert.equal(valid2.args.description, 'Updated desc')

  // Invalid status
  const invalidStatus = validateUpdateArgs({ status: 'invalid_status' })
  assert.equal(invalidStatus.ok, false)
  assert.match(invalidStatus.error, /status 必须是/)

  // Invalid mode
  const invalidMode = validateUpdateArgs({ mode: 'ultra' })
  assert.equal(invalidMode.ok, false)
  assert.match(invalidMode.error, /mode 必须是/)

  // Empty title string
  const emptyTitle = validateUpdateArgs({ title: '   ' })
  assert.equal(emptyTitle.ok, false)
  assert.match(emptyTitle.error, /title 不能为空字符串/)
})

test('updateTaskRecord updates fields, validates stage on track, and handles session active task resolution', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-update-test-'))
  try {
    const fs = mockFs(root)
    const taskDir = path.join(root, '.trellis', 'tasks', 'feat-08-19-demo')
    mkdirSync(taskDir, { recursive: true })
    writeFileSync(
      path.join(taskDir, 'task.json'),
      JSON.stringify({
        title: 'Initial Title',
        status: 'planning',
        work: {
          type: 'feat',
          mode: 'standard',
          stage: 'prd',
          execution_lane: 'standard',
        },
      }),
    )

    const sessionsDir = path.join(root, '.trellis', '.runtime', 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    writeFileSync(
      path.join(sessionsDir, 'sess_test.json'),
      JSON.stringify({ current_task: '.trellis/tasks/feat-08-19-demo' }),
    )

    // 1. Update with invalid stage for feat track -> fail
    const resInvalidStage = await updateTaskRecord(
      fs,
      root,
      { slug: 'feat-08-19-demo', stage: 'invalid_stage' },
      { sessionId: 'sess_test' },
    )
    assert.equal(resInvalidStage.ok, false)
    assert.match(resInvalidStage.error, /stage 不在 feat 轨道上/)

    // 2. Update status and stage with explicit slug
    const resValid = await updateTaskRecord(
      fs,
      root,
      {
        slug: 'feat-08-19-demo',
        status: 'in_progress',
        stage: 'impl',
        title: 'Updated Title',
        mode: 'quick',
        description: 'New Description',
      },
      { sessionId: 'sess_test' },
    )
    assert.equal(resValid.ok, true)
    assert.equal(resValid.slug, 'feat-08-19-demo')
    assert.equal(resValid.taskJson.title, 'Updated Title')
    assert.equal(resValid.taskJson.status, 'in_progress')
    assert.equal(resValid.taskJson.work.stage, 'impl')
    assert.equal(resValid.taskJson.work.mode, 'quick')
    assert.equal(resValid.taskJson.work.execution_lane, 'quick')
    assert.equal(resValid.taskJson.description, 'New Description')

    // Verify task.json written on disk
    const saved = JSON.parse(readFileSync(path.join(taskDir, 'task.json'), 'utf8'))
    assert.equal(saved.title, 'Updated Title')
    assert.equal(saved.status, 'in_progress')
    assert.equal(saved.work.stage, 'impl')

    // 3. Update with omitted slug (resolves from session pointer)
    const resAutoSlug = await updateTaskRecord(
      fs,
      root,
      { stage: 'review' },
      { sessionId: 'sess_test' },
    )
    assert.equal(resAutoSlug.ok, true)
    assert.equal(resAutoSlug.slug, 'feat-08-19-demo')
    assert.equal(resAutoSlug.taskJson.work.stage, 'review')

    // 4. Update non-existent task
    const resNotFound = await updateTaskRecord(
      fs,
      root,
      { slug: 'feat-08-19-nonexistent', status: 'completed' },
      { sessionId: 'sess_test' },
    )
    assert.equal(resNotFound.ok, false)
    assert.match(resNotFound.error, /任务不存在/)

    // 5. Update with omitted slug when session has no active task
    const resNoActive = await updateTaskRecord(
      fs,
      root,
      { status: 'completed' },
      { sessionId: 'sess_other' },
    )
    assert.equal(resNoActive.ok, false)
    assert.match(resNoActive.error, /未指定 slug 且当前 session 未绑定任何活动任务/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('updateTaskRecord and archiveTaskRecord enforce git cleanliness in git repo', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-guard-test-'))
  const { execFileSync } = await import('node:child_process')
  try {
    execFileSync('git', ['init'], { cwd: root, stdio: 'pipe' })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' })
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: root, stdio: 'pipe' })

    const fs = mockFs(root)
    const resCreate = await createTaskRecord(fs, root, {
      title: 'Git Guard Test',
      workType: 'feat',
      slug: 'feat-08-20-git-test',
    })
    assert.equal(resCreate.ok, true)

    // Initial commit so repo has a HEAD
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' })
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: root, stdio: 'pipe' })

    // 1. Create a dirty file in working tree
    writeFileSync(path.join(root, 'dirty.js'), 'console.log(1)')

    // 2. updateTaskRecord with status=completed should fail (even if force=true is passed)
    const updateFail = await updateTaskRecord(fs, root, {
      slug: 'feat-08-20-git-test',
      status: 'completed',
      force: true,
    })
    assert.equal(updateFail.ok, false)
    assert.match(updateFail.error, /\[trellis\/git_dirty\]/)
    assert.match(updateFail.error, /dirty\.js/)

    // 3. Commit dirty file so task can be legally completed
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' })
    execFileSync('git', ['commit', '-m', 'Commit dirty file'], { cwd: root, stdio: 'pipe' })

    const updateValid = await updateTaskRecord(fs, root, {
      slug: 'feat-08-20-git-test',
      status: 'completed',
    })
    assert.equal(updateValid.ok, true)
    assert.equal(updateValid.taskJson.status, 'completed')

    // 4. Create another dirty file; archiveTaskRecord on dirty repo should fail (even if force=true)
    writeFileSync(path.join(root, 'dirty2.js'), 'console.log(2)')
    const archiveFail = await archiveTaskRecord(fs, root, {
      slug: 'feat-08-20-git-test',
      force: true,
    })
    assert.equal(archiveFail.ok, false)
    assert.match(archiveFail.error, /\[trellis\/git_dirty\]/)

    // 5. Commit dirty2 file; archiveTaskRecord succeeds
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' })
    execFileSync('git', ['commit', '-m', 'Commit dirty2'], { cwd: root, stdio: 'pipe' })

    const archiveSuccess = await archiveTaskRecord(fs, root, {
      slug: 'feat-08-20-git-test',
    })
    assert.equal(archiveSuccess.ok, true)

    // 6. Test modified_files verification in updateTaskRecord & archiveTaskRecord
    const root2 = mkdtempSync(path.join(tmpdir(), 'trellis-modified-verify-'))
    try {
      execFileSync('git', ['init'], { cwd: root2, stdio: 'pipe' })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root2, stdio: 'pipe' })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: root2, stdio: 'pipe' })
      const fs2 = mockFs(root2)
      await createTaskRecord(fs2, root2, {
        title: 'Task 2',
        workType: 'feat',
        slug: 'feat-08-20-task2',
      })
      writeFileSync(path.join(root2, 'real-committed.js'), 'hello')
      execFileSync('git', ['add', '.'], { cwd: root2, stdio: 'pipe' })
      execFileSync('git', ['commit', '-m', 'Commit real file'], { cwd: root2, stdio: 'pipe' })

      // Fails when claiming uncommitted file
      const updateUncommitted = await updateTaskRecord(fs2, root2, {
        slug: 'feat-08-20-task2',
        status: 'completed',
        modified_files: ['not-in-git.js'],
      })
      assert.equal(updateUncommitted.ok, false)
      assert.match(updateUncommitted.error, /\[trellis\/git_uncommitted\]/)
      assert.match(updateUncommitted.error, /not-in-git\.js/)

      // Succeeds when claiming real committed file
      const updateCommitted = await updateTaskRecord(fs2, root2, {
        slug: 'feat-08-20-task2',
        status: 'completed',
        modified_files: ['real-committed.js'],
      })
      assert.equal(updateCommitted.ok, true)
      assert.equal(updateCommitted.taskJson.status, 'completed')
    } finally {
      rmSync(root2, { recursive: true, force: true })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
