/**
 * Board steps-aggregation tests (Subtask 1: feat-04-18-kanban-backend-steps).
 *
 * Covers the extended BoardTaskRecord contract from design.md:
 *   totalSteps / completedSteps / hasBlocked / blockedReason /
 *   hasPendingVerification / activeStep  plus inline phase passthrough.
 *
 * NOTE: `node --test` runner is spawn-restricted inside this sandbox (EPERM);
 * run directly with `node test/board.test.js` when the runner is unavailable.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { readTask, buildBoard, invalidateArchiveBucket, clearArchiveCache } from '../lib/board.js'

/**
 * Minimal dsh-fs stand-in over a real temp directory (same surface the
 * existing tests use: resolve/stat/readText/listDir/writeText).
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

function taskDir(root, slug) {
  const dir = path.join(root, '.trellis', 'tasks', slug)
  mkdirSync(dir, { recursive: true })
  return dir
}

function dirEntry(dir) {
  return { name: path.basename(dir), target: { targetKey: dir, displayPath: dir } }
}

test('readTask aggregates steps for a 5-state task (blocked/verifying/completed)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-steps-'))
  try {
    const dir = taskDir(root, 'feat-04-18-steps')
    writeFileSync(
      path.join(dir, 'task.json'),
      JSON.stringify({
        title: 'Steps Task',
        status: 'in_progress',
        work: { type: 'feat', stage: 'impl' },
        steps: [
          { id: 'a', title: 'Step A', status: 'completed' },
          { id: 'b', title: 'Step B', status: 'in_progress', spec: 'do b' },
          { id: 'c', title: 'Step C', status: 'verifying', verification: 'human' },
          { id: 'd', title: 'Step D', status: 'blocked', blockedReason: 'design conflict' },
          { id: 'e', title: 'Step E', status: 'pending' },
        ],
      })
    )

    const res = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false })
    assert.ok(res)
    assert.equal(res.totalSteps, 5)
    assert.equal(res.completedSteps, 1)
    assert.equal(res.hasBlocked, true)
    assert.equal(res.blockedReason, 'design conflict')
    assert.equal(res.hasPendingVerification, true)
    // findActiveStep priority: blocked > in_progress > verifying > pending
    assert.deepEqual(res.activeStep, {
      id: 'd',
      title: 'Step D',
      status: 'blocked',
      index: 3,
      total: 5,
      blockedReason: 'design conflict',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readTask blockedReason defaults to first blocked step and null when reason missing', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-blockreason-'))
  try {
    const dir = taskDir(root, 'feat-04-18-blocked')
    writeFileSync(
      path.join(dir, 'task.json'),
      JSON.stringify({
        title: 'Blocked Task',
        status: 'in_progress',
        work: { type: 'issue', stage: 'fix' },
        steps: [
          { id: 'x', title: 'First', status: 'blocked' }, // no reason
          { id: 'y', title: 'Second', status: 'blocked', blockedReason: 'waiting on user' },
        ],
      })
    )
    const res = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false })
    assert.equal(res.hasBlocked, true)
    // First blocked step has no reason -> null (the rule: first blocked step's
    // reason, so the second step's reason is NOT picked up).
    assert.equal(res.blockedReason, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readTask legacy task without steps yields zero aggregates and null activeStep', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-legacy-'))
  try {
    const dir = taskDir(root, 'feat-04-18-legacy')
    writeFileSync(
      path.join(dir, 'task.json'),
      JSON.stringify({ title: 'Legacy', status: 'completed', work: { type: 'feat', stage: 'check' } })
    )
    const res = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false })
    assert.equal(res.totalSteps, 0)
    assert.equal(res.completedSteps, 0)
    assert.equal(res.hasBlocked, false)
    assert.equal(res.blockedReason, null)
    assert.equal(res.hasPendingVerification, false)
    assert.equal(res.activeStep, null)
    // completed status still resolves phase to completed
    assert.equal(res.phase, 'completed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readTask phase carries -inline suffix when inline flag is set', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-inline-'))
  try {
    const dir = taskDir(root, 'feat-04-18-inline')
    writeFileSync(
      path.join(dir, 'task.json'),
      JSON.stringify({ title: 'Inline', status: 'in_progress', work: { type: 'feat', stage: 'impl' } })
    )
    const plain = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false }, false)
    const inlined = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false }, true)
    assert.equal(plain.phase, 'in_progress')
    assert.equal(inlined.phase, 'in_progress-inline')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readTask activeStep converges malformed steps to null fields (lossless JSON)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-malformed-'))
  try {
    const dir = taskDir(root, 'feat-04-18-malformed')
    writeFileSync(
      path.join(dir, 'task.json'),
      JSON.stringify({
        title: 'Malformed',
        status: 'in_progress',
        work: { type: 'feat', stage: 'impl' },
        steps: ['not-an-object', { title: 'NoIdNoStatus' }],
      })
    )
    const res = await readTask(mockFs(root), dirEntry(dir), { month: null, archived: false })
    // Non-object entries are filtered out of the effective step list.
    assert.equal(res.totalSteps, 1)
    // findActiveStep's pending branch matches the object without status; the
    // record must carry nulls, never undefined (lossless-JSON contract).
    assert.ok(res.activeStep)
    assert.equal(res.activeStep.id, null)
    assert.equal(res.activeStep.title, 'NoIdNoStatus')
    assert.equal(res.activeStep.status, null)
    assert.equal(res.activeStep.index, 0)
    assert.equal(res.activeStep.total, 1)
    // JSON.stringify must not drop keys silently.
    const roundtrip = JSON.parse(JSON.stringify(res.activeStep))
    assert.ok('id' in roundtrip && 'title' in roundtrip && 'status' in roundtrip)
    assert.equal(roundtrip.id, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('buildBoard passes inline through and keeps archive cache working', async () => {
  clearArchiveCache()
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-boardsteps-'))
  try {
    const activeDir = taskDir(root, 'feat-04-18-active')
    writeFileSync(
      path.join(activeDir, 'task.json'),
      JSON.stringify({
        title: 'Active',
        status: 'in_progress',
        work: { type: 'feat', stage: 'impl' },
        steps: [{ id: 's1', title: 'One', status: 'completed' }, { id: 's2', title: 'Two', status: 'in_progress' }],
      })
    )

    const archiveTask = path.join(root, '.trellis', 'tasks', 'archive', '2025-07', 'feat-07-10-old')
    mkdirSync(archiveTask, { recursive: true })
    writeFileSync(
      path.join(archiveTask, 'task.json'),
      JSON.stringify({
        title: 'Old',
        status: 'completed',
        work: { type: 'issue', stage: 'fix-note' },
        steps: [{ id: 'a', title: 'Fixed', status: 'blocked', blockedReason: 'legacy' }],
      })
    )

    const sessionsDir = path.join(root, '.trellis', '.runtime', 'sessions')
    mkdirSync(sessionsDir, { recursive: true })
    writeFileSync(
      path.join(sessionsDir, 'session-abc.json'),
      JSON.stringify({ current_task: '.trellis/tasks/feat-04-18-active' })
    )

    const fs = mockFs(root)
    const boardInline = await buildBoard(fs, root, 'session-abc', true)
    assert.equal(boardInline.kind, 'board')
    // Stage-lane tracks are shipped with the board (single source of truth):
    // feat contains design-review; completed display terminals are exposed.
    assert.deepEqual(boardInline.tracks, {
      feat: { stages: ['prd', 'design', 'design-review', 'impl', 'review', 'check'], completed: 'finish' },
      issue: { stages: ['report', 'analyze', 'fix', 'fix-note'], completed: 'fix-note' },
      refactor: { stages: ['scan', 'design', 'apply', 'done'], completed: 'done' },
    })
    const active = boardInline.tasks.find((t) => t.slug === 'feat-04-18-active')
    assert.ok(active)
    assert.equal(active.phase, 'in_progress-inline') // inline passthrough
    assert.equal(active.totalSteps, 2)
    assert.equal(active.completedSteps, 1)
    assert.equal(active.hasBlocked, false)
    assert.deepEqual(active.activeStep, { id: 's2', title: 'Two', status: 'in_progress', index: 1, total: 2, blockedReason: null })

    const archived = boardInline.tasks.find((t) => t.slug === 'feat-07-10-old')
    assert.ok(archived)
    assert.equal(archived.archived, true)
    assert.equal(archived.month, '2025-07')
    assert.equal(archived.hasBlocked, true)
    assert.equal(archived.blockedReason, 'legacy')
    assert.equal(archived.phase, 'completed') // completed status wins over inline

    // Archive bucket is cached: second build reuses the in-memory records
    // (no fs re-read), and invalidation still works.
    const boardCached = await buildBoard(fs, root, 'session-abc', true)
    assert.equal(boardCached.tasks.length, 2)
    invalidateArchiveBucket(root, '2025-07')
    const boardRevalidated = await buildBoard(fs, root, 'session-abc', false)
    assert.equal(boardRevalidated.tasks.length, 2)
    const activePlain = boardRevalidated.tasks.find((t) => t.slug === 'feat-04-18-active')
    assert.equal(activePlain.phase, 'in_progress') // inline=false now
  } finally {
    clearArchiveCache()
    rmSync(root, { recursive: true, force: true })
  }
})
