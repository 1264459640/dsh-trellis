import test from 'node:test'
import assert from 'node:assert/strict'
import {
  READ_TOOLS,
  UNDECIDED_TRIM,
  PLANNING_TRIM,
  AUTHORIZATIONS,
  authorizationOf,
  trimToolsFor,
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
  { name: 'web_search' },
  { name: 'generate_image' },
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

test('undecided trims write/edit and task-write trellis tools, keeps everything else', () => {
  const trimmed = trimToolsFor('undecided')
  assert.ok(trimmed)
  assert.ok(trimmed.has('write'))
  assert.ok(trimmed.has('edit'))
  assert.ok(trimmed.has('trellis_artifact_update'))
  assert.ok(trimmed.has('trellis_task_update'))
  assert.ok(trimmed.has('trellis_task_archive'))
  assert.ok(!trimmed.has('read'))
  assert.ok(!trimmed.has('trellis_state'))
  assert.ok(!trimmed.has('trellis_task_create'))
  assert.ok(!trimmed.has('trellis_task_skip'))
  assert.ok(!trimmed.has('skill'))
  assert.ok(!trimmed.has('web_search'))
})

test('planning trims write/edit and lifecycle trellis tools, keeps artifact channel', () => {
  const trimmed = trimToolsFor('planning')
  assert.ok(trimmed)
  assert.ok(trimmed.has('write'))
  assert.ok(trimmed.has('edit'))
  assert.ok(trimmed.has('trellis_task_create'))
  assert.ok(trimmed.has('trellis_task_skip'))
  assert.ok(trimmed.has('trellis_task_archive'))
  assert.ok(!trimmed.has('trellis_artifact_update'))
  assert.ok(!trimmed.has('trellis_task_update'))
  assert.ok(!trimmed.has('read'))
  assert.ok(!trimmed.has('skill'))
  assert.ok(!trimmed.has('web_search'))
})

test('authorized is freely writable (no pruning)', () => {
  assert.equal(trimToolsFor('authorized'), null)
})

test('applyReadonlyPolicy trims only the denylist tools for undecided, keeps other plugins tools', () => {
  const pruned = applyReadonlyPolicy(FULL, 'no_task', false)
  assert.ok(pruned)
  const kept = names(pruned)
  assert.ok(kept.includes('read'))
  assert.ok(kept.includes('trellis_task_create'))
  assert.ok(kept.includes('trellis_task_skip'))
  assert.ok(kept.includes('trellis_state'))
  // other plugins' tools must survive the trim
  assert.ok(kept.includes('skill'), 'skill from another plugin must be kept')
  assert.ok(kept.includes('web_search'), 'web_search from another plugin must be kept')
  assert.ok(kept.includes('generate_image'), 'generate_image from another plugin must be kept')
  assert.ok(!kept.includes('write'))
  assert.ok(!kept.includes('edit'))
  assert.ok(!kept.includes('trellis_artifact_update'))
  assert.ok(!kept.includes('trellis_task_update'))
})

test('applyReadonlyPolicy keeps everything for a skipped no_task session', () => {
  assert.equal(applyReadonlyPolicy(FULL, 'no_task', true), null)
})

test('applyReadonlyPolicy trims write/edit and lifecycle tools, keeps artifact channel in planning', () => {
  const pruned = applyReadonlyPolicy(FULL, 'planning', false)
  assert.ok(pruned)
  const kept = names(pruned)
  assert.ok(kept.includes('trellis_artifact_update'))
  assert.ok(kept.includes('trellis_task_update'))
  assert.ok(kept.includes('skill'), 'skill from another plugin must be kept in planning')
  assert.ok(kept.includes('web_search'), 'web_search from another plugin must be kept in planning')
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
  const pruned = applyReadonlyPolicy([null, { name: 'write' }, { name: 'read' },], 'planning')
  assert.deepEqual(names(pruned), ['read'])
})

test('trim sets are the expected export surfaces', () => {
  assert.ok(UNDECIDED_TRIM instanceof Set)
  assert.ok(PLANNING_TRIM instanceof Set)
  assert.deepEqual(AUTHORIZATIONS, ['undecided', 'planning', 'authorized'])
  assert.ok(UNDECIDED_TRIM.has('write'))
  assert.ok(UNDECIDED_TRIM.has('trellis_task_update'))
  assert.ok(!UNDECIDED_TRIM.has('trellis_task_create'))
  assert.ok(!UNDECIDED_TRIM.has('trellis_task_skip'))
  assert.ok(PLANNING_TRIM.has('write'))
  assert.ok(PLANNING_TRIM.has('trellis_task_create'))
  assert.ok(PLANNING_TRIM.has('trellis_task_skip'))
  assert.ok(!PLANNING_TRIM.has('trellis_artifact_update'))
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
  { name: 'tool:web_search', text: 'Search the web...' },
]

test('applyReadonlySections trims only denylist tool sections in undecided phase, keeps others', () => {
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
  assert.ok(names.includes('tool:web_search'), 'tool:web_search section from another plugin must be kept')
  assert.ok(!names.includes('tool:write'), 'tool:write section must be pruned')
  assert.ok(!names.includes('tool:edit'), 'tool:edit section must be pruned')
  assert.ok(!names.includes('tool:trellis_artifact_update'), 'artifact update must not be allowed in undecided')
})

test('applyReadonlySections preserves artifact channel and trims denylist sections in planning phase', () => {
  const pruned = applyReadonlySections(FULL_SECTIONS, 'planning', false)
  assert.ok(pruned)
  const names = pruned.map((s) => s.name)
  assert.ok(names.includes('persona'))
  assert.ok(names.includes('tool:read'))
  assert.ok(names.includes('tool:trellis_artifact_update'))
  assert.ok(names.includes('tool:web_search'), 'tool:web_search section from another plugin must be kept')
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
  const pruned = applyReadonlySections([null, { name: 'tool:write' }, { name: 'tool:read' },], 'planning')
  assert.deepEqual(pruned.map((s) => s.name), ['tool:read'])
})
