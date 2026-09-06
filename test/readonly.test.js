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
  applyReadonlySections,
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

const FULL_SECTIONS = [
  { name: 'persona', text: 'You are an AI assistant.' },
  { name: 'workspace:policy', text: 'Current policy...' },
  { name: 'tool:read', text: 'Use the read tool...' },
  { name: 'tool:write', text: 'Use the write tool...' },
  { name: 'tool:edit', text: 'Use the edit tool...' },
  { name: 'tool:glob', text: 'Use the glob tool...' },
  { name: 'tool:grep', text: 'Use the grep tool...' },
  { name: 'tool:trellis_task_create', text: 'Create task...' },
  { name: 'tool:trellis_task_skip', text: 'Skip task...' },
  { name: 'tool:trellis_artifact_update', text: 'Update artifact...' },
]

test('applyReadonlySections prunes tool:write and tool:edit in undecided phase', () => {
  const pruned = applyReadonlySections(FULL_SECTIONS, 'no_task', false)
  assert.ok(pruned)
  const names = pruned.map((s) => s.name)
  assert.ok(names.includes('persona'))
  assert.ok(names.includes('workspace:policy'))
  assert.ok(names.includes('tool:read'))
  assert.ok(names.includes('tool:glob'))
  assert.ok(names.includes('tool:grep'))
  assert.ok(names.includes('tool:trellis_task_create'))
  assert.ok(names.includes('tool:trellis_task_skip'))
  assert.ok(!names.includes('tool:write'), 'tool:write section must be pruned')
  assert.ok(!names.includes('tool:edit'), 'tool:edit section must be pruned')
  assert.ok(!names.includes('tool:trellis_artifact_update'), 'artifact update must not be allowed in undecided')
})

test('applyReadonlySections preserves artifact channel and prunes write/edit in planning phase', () => {
  const pruned = applyReadonlySections(FULL_SECTIONS, 'planning', false)
  assert.ok(pruned)
  const names = pruned.map((s) => s.name)
  assert.ok(names.includes('persona'))
  assert.ok(names.includes('tool:read'))
  assert.ok(names.includes('tool:trellis_artifact_update'))
  assert.ok(!names.includes('tool:write'), 'tool:write must be pruned in planning')
  assert.ok(!names.includes('tool:edit'), 'tool:edit must be pruned in planning')
  assert.ok(!names.includes('tool:trellis_task_create'))
  assert.ok(!names.includes('tool:trellis_task_skip'))
})

test('applyReadonlySections returns null (no pruning) for authorized / skipped sessions', () => {
  assert.equal(applyReadonlySections(FULL_SECTIONS, 'no_task', true), null)
  assert.equal(applyReadonlySections(FULL_SECTIONS, 'in_progress', false), null)
  assert.equal(applyReadonlySections(FULL_SECTIONS, 'completed', false), null)
})

test('applyReadonlySections tolerates non-array and malformed entries', () => {
  assert.equal(applyReadonlySections(null, 'planning'), null)
  assert.equal(applyReadonlySections(undefined, 'planning'), null)
  assert.equal(applyReadonlySections('not-an-array', 'planning'), null)
  const pruned = applyReadonlySections([null, { name: 'tool:write' }, { name: 'tool:read' }, {}], 'planning')
  assert.deepEqual(pruned.map((s) => s.name), ['tool:read'])
})

