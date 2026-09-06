import test from 'node:test'
import assert from 'node:assert/strict'
import { stagePhase, phaseForTask } from '../lib/state.js'

test('stagePhase classifies stages per work-types.md status↔stage mapping', () => {
  // refactor: scan/design → planning；apply → in_progress
  assert.equal(stagePhase('refactor', 'scan'), 'planning')
  assert.equal(stagePhase('refactor', 'design'), 'planning')
  assert.equal(stagePhase('refactor', 'apply'), 'in_progress')
  // issue: report/analyze → planning；fix/fix-note → in_progress
  assert.equal(stagePhase('issue', 'report'), 'planning')
  assert.equal(stagePhase('issue', 'analyze'), 'planning')
  assert.equal(stagePhase('issue', 'fix'), 'in_progress')
  assert.equal(stagePhase('issue', 'fix-note'), 'in_progress')
  // feat: prd/design/design-review → planning；impl/review/check → in_progress
  assert.equal(stagePhase('feat', 'prd'), 'planning')
  assert.equal(stagePhase('feat', 'design'), 'planning')
  assert.equal(stagePhase('feat', 'design-review'), 'planning')
  assert.equal(stagePhase('feat', 'impl'), 'in_progress')
  assert.equal(stagePhase('feat', 'review'), 'in_progress')
  assert.equal(stagePhase('feat', 'check'), 'in_progress')
})

test('stagePhase returns null for unknown work type or stage', () => {
  assert.equal(stagePhase('nope', 'scan'), null)
  assert.equal(stagePhase('refactor', 'nope'), null)
  assert.equal(stagePhase('refactor', null), null)
  assert.equal(stagePhase(null, 'scan'), null)
})

test('phaseForTask keeps a refactor scan task in planning even when status drifted to in_progress', () => {
  // the reported defect: status=in_progress at scan must STILL resolve to planning
  assert.equal(
    phaseForTask({ status: 'in_progress', work: { type: 'refactor', stage: 'scan' } }),
    'planning',
  )
  assert.equal(
    phaseForTask({ status: 'in_progress', work: { type: 'refactor', stage: 'design' } }),
    'planning',
  )
  assert.equal(
    phaseForTask({ status: 'planning', work: { type: 'refactor', stage: 'scan' } }),
    'planning',
  )
  assert.equal(
    phaseForTask({ status: 'in_progress', work: { type: 'refactor', stage: 'apply' } }),
    'in_progress',
  )
})

test('phaseForTask covers issue and feat tracks end to end', () => {
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'issue', stage: 'report' } }), 'planning')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'issue', stage: 'analyze' } }), 'planning')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'issue', stage: 'fix' } }), 'in_progress')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'issue', stage: 'fix-note' } }), 'in_progress')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'feat', stage: 'design' } }), 'planning')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'feat', stage: 'impl' } }), 'in_progress')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'feat', stage: 'check' } }), 'in_progress')
})

test('phaseForTask lets completed status win over the stage', () => {
  assert.equal(phaseForTask({ status: 'completed', work: { type: 'refactor', stage: 'done' } }), 'completed')
  assert.equal(phaseForTask({ status: 'completed', work: { type: 'feat', stage: 'finish' } }), 'completed')
})

test('phaseForTask falls back to the status-based phase for unknown/legacy tasks', () => {
  assert.equal(phaseForTask({ status: 'planning' }), 'planning')
  assert.equal(phaseForTask({ status: 'in_progress' }), 'in_progress')
  assert.equal(phaseForTask({ status: 'in_progress', work: { type: 'feat', stage: 'weird' } }), 'in_progress')
  assert.equal(phaseForTask({ status: 'planning', work: { type: 'unknown', stage: 'x' } }), 'planning')
  assert.equal(phaseForTask(null), 'no_task')
  assert.equal(phaseForTask({}), 'no_task')
  assert.equal(phaseForTask('not-an-object'), 'no_task')
})

test('phaseForTask honors the inline dispatch variants', () => {
  assert.equal(
    phaseForTask({ status: 'in_progress', work: { type: 'refactor', stage: 'scan' } }, true),
    'planning-inline',
  )
  assert.equal(
    phaseForTask({ status: 'in_progress', work: { type: 'refactor', stage: 'apply' } }, true),
    'in_progress-inline',
  )
})
