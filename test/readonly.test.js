import test from 'node:test'
import assert from 'node:assert/strict'
import {
  READ_TOOLS,
  UNDECIDED_TOOLS,
  PLANNING_TOOLS,
  AUTHORIZATIONS,
  authorizationOf,
  allowedToolsFor,
  applyReadonlyPolicy,
} from '../lib/readonly.js'

const FULL = [
  { name: 'read' },
  { name: 'write' },
  { name: 'edit' },
  { name: 'pwsh' },
  { name: 'trellis_state' },
  { name: 'trellis_task_create' },
  { name: 'trellis_task_skip' },
  { name: 'trellis_task_update' },
  { name: 'trellis_artifact_update' },
  { name: 'skill' },
]

function names(list) {
  return list.map((t) => t.name)
}

test('read tools shared by both read-only levels', () => {
  for (const name of ['read', 'glob', 'grep', 'read_image', 'inspect_image', 'pwsh', 'bash']) {
    assert.ok(READ_TOOLS.includes(name), `${name} should be in READ_TOOLS`)
  }
})

test('authorizationOf maps phases + skip flag to authorization states', () => {
  assert.equal(authorizationOf('no_task', false), 'undecided')
  assert.equal(authorizationOf('no_task', true), 'authorized')
  assert.equal(authorizationOf('planning', false), 'planning')
  assert.equal(authorizationOf('planning-inline', false), 'planning')
  assert.equal(authorizationOf('in_progress', false), 'authorized')
  assert.equal(authorizationOf('completed', false), 'authorized')
  assert.equal(authorizationOf(null, false), 'authorized')
})

test('undecided allows investigate + create + skip, prunes write/edit and artifacts', () => {
  const allowed = allowedToolsFor('undecided')
  assert.ok(allowed)
  assert.ok(allowed.has('read'))
  assert.ok(allowed.has('trellis_state'))
  assert.ok(allowed.has('trellis_task_create'))
  assert.ok(allowed.has('trellis_task_skip'))
  assert.ok(!allowed.has('write'))
  assert.ok(!allowed.has('edit'))
  assert.ok(!allowed.has('trellis_artifact_update'))
  assert.ok(!allowed.has('trellis_task_update'))
})

test('planning allows artifacts channel, still prunes write/edit and skip/create', () => {
  const allowed = allowedToolsFor('planning')
  assert.ok(allowed)
  assert.ok(allowed.has('trellis_artifact_update'))
  assert.ok(allowed.has('trellis_task_update'))
  assert.ok(!allowed.has('trellis_task_create'))
  assert.ok(!allowed.has('trellis_task_skip'))
  assert.ok(!allowed.has('write'))
  assert.ok(!allowed.has('edit'))
})

test('authorized is freely writable (no pruning)', () => {
  assert.equal(allowedToolsFor('authorized'), null)
})

test('applyReadonlyPolicy prunes a full tool list for undecided (no skip)', () => {
  const pruned = applyReadonlyPolicy(FULL, 'no_task', false)
  assert.ok(pruned)
  const kept = names(pruned)
  assert.ok(kept.includes('read'))
  assert.ok(kept.includes('trellis_task_create'))
  assert.ok(kept.includes('trellis_task_skip'))
  assert.ok(kept.includes('trellis_state'))
  assert.ok(!kept.includes('write'))
  assert.ok(!kept.includes('edit'))
  assert.ok(!kept.includes('trellis_artifact_update'))
  assert.ok(!kept.includes('skill'))
})

test('applyReadonlyPolicy keeps write/edit for a skipped no_task session', () => {
  assert.equal(applyReadonlyPolicy(FULL, 'no_task', true), null)
})

test('applyReadonlyPolicy prunes write/edit but keeps artifact channel in planning', () => {
  const pruned = applyReadonlyPolicy(FULL, 'planning', false)
  assert.ok(pruned)
  const kept = names(pruned)
  assert.ok(kept.includes('trellis_artifact_update'))
  assert.ok(kept.includes('trellis_task_update'))
  assert.ok(!kept.includes('write'))
  assert.ok(!kept.includes('trellis_task_create'))
  assert.ok(!kept.includes('trellis_task_skip'))
})

test('applyReadonlyPolicy returns null (no pruning) for authorized phases', () => {
  assert.equal(applyReadonlyPolicy(FULL, 'in_progress', false), null)
  assert.equal(applyReadonlyPolicy(FULL, 'completed', false), null)
})

test('applyReadonlyPolicy tolerates non-array / nullish tool lists', () => {
  assert.equal(applyReadonlyPolicy(null, 'undecided'), null)
  assert.equal(applyReadonlyPolicy(undefined, 'planning'), null)
  assert.equal(applyReadonlyPolicy('not-an-array', 'planning'), null)
  const pruned = applyReadonlyPolicy([null, { name: 'write' }, { name: 'read' }, {}], 'planning')
  assert.deepEqual(names(pruned), ['read'])
})

test('tool sets are the expected export surfaces', () => {
  assert.ok(UNDECIDED_TOOLS instanceof Set)
  assert.ok(PLANNING_TOOLS instanceof Set)
  assert.deepEqual(AUTHORIZATIONS, ['undecided', 'planning', 'authorized'])
  assert.ok(UNDECIDED_TOOLS.has('trellis_task_create'))
  assert.ok(UNDECIDED_TOOLS.has('trellis_task_skip'))
  assert.ok(PLANNING_TOOLS.has('trellis_artifact_update'))
  assert.ok(!PLANNING_TOOLS.has('trellis_task_create'))
  assert.ok(!PLANNING_TOOLS.has('trellis_task_skip'))
})
