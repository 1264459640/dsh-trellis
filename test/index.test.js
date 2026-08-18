import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateSlug,
  todayMmDd,
  monthKeyFromSlug,
  TRACKS,
} from '../lib/state.js'
import { isTrustedApiRequest } from '../lib/trust.js'
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
