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
} from '../lib/task.js'

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
