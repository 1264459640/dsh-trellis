import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  validateSteps,
  validateStepUpdate,
  applyStepUpdate,
  checkStepsCompletion,
  createTaskRecord,
  updateTaskRecord,
} from '../lib/task.js'
import {
  findActiveStep,
  formatStepPrompt,
  formatStepReminder,
  buildBreadcrumbMessage,
} from '../lib/breadcrumb.js'
import { assertSafeArtifactPath, ALLOWED_ARTIFACTS, updateTaskArtifact } from '../lib/artifact.js'

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

// ---------------------------------------------------------------------------
// 1. Steps data contract & validation
// ---------------------------------------------------------------------------

test('validateSteps normalizes a full step list and rejects invalid items', () => {
  assert.equal(validateSteps(null).ok, false)
  assert.equal(validateSteps({}).ok, false)
  assert.equal(validateSteps([null]).ok, false)
  assert.equal(validateSteps([{ title: 'no-id' }]).ok, false)
  assert.equal(validateSteps([{ id: 'dup', title: 'A' }, { id: 'dup', title: 'B' }]).ok, false)

  const res = validateSteps([
    {
      id: 'step-1',
      title: '接入数据采集',
      spec: 'OPC-UA 订阅',
      acceptance: ['心跳监听', '断线重连'],
      verify: true,
    },
  ])
  assert.equal(res.ok, true)
  assert.equal(res.steps[0].id, 'step-1')
  assert.equal(res.steps[0].status, 'pending')
  assert.equal(res.steps[0].verify, true)
  assert.deepEqual(res.steps[0].acceptance, ['心跳监听', '断线重连'])
})

test('applyStepUpdate enforces verify gate before completion', () => {
  const steps = [
    { id: 'step-1', title: '核心数据层', status: 'in_progress', verify: true, verified: false, acceptance: ['x'] },
  ]

  // completion without verification fails
  const fail = applyStepUpdate(steps, { id: 'step-1', status: 'completed' })
  assert.equal(fail.ok, false)
  assert.match(fail.error, /verification_gate/)

  // verify then complete (two-phase) passes
  const verified = applyStepUpdate(steps, { id: 'step-1', verified: true, verificationNotes: 'test ok' })
  assert.equal(verified.ok, true)
  assert.equal(verified.steps[0].verified, true)

  const completed = applyStepUpdate(verified.steps, { id: 'step-1', status: 'completed' })
  assert.equal(completed.ok, true)
  assert.equal(completed.steps[0].status, 'completed')
})

test('checkStepsCompletion gates incomplete and unverified steps', () => {
  assert.equal(checkStepsCompletion(undefined).ok, true)
  assert.equal(checkStepsCompletion([]).ok, true)

  const incomplete = checkStepsCompletion([
    { id: 's1', title: 'a', status: 'completed' },
    { id: 's2', title: 'b', status: 'in_progress' },
  ])
  assert.equal(incomplete.ok, false)
  assert.match(incomplete.error, /steps_incomplete/)

  const unverified = checkStepsCompletion([
    { id: 's1', title: 'a', status: 'completed', verify: true, verified: false },
  ])
  assert.equal(unverified.ok, false)
  assert.match(unverified.error, /steps_unverified/)

  assert.equal(
    checkStepsCompletion([
      { id: 's1', title: 'a', status: 'completed', verify: true, verified: true },
      { id: 's2', title: 'b', status: 'completed' },
    ]).ok,
    true,
  )
})

// ---------------------------------------------------------------------------
// 2. Active step breadcrumb & SNR dedup primitives
// ---------------------------------------------------------------------------

test('findActiveStep prefers in_progress then first pending', () => {
  const steps = [
    { id: 's1', title: 'a', status: 'completed' },
    { id: 's2', title: 'b', status: 'pending' },
    { id: 's3', title: 'c', status: 'in_progress' },
  ]
  const active = findActiveStep(steps)
  assert.equal(active.step.id, 's3')
  assert.equal(active.index, 2)
  assert.equal(active.total, 3)

  const pendingOnly = findActiveStep([
    { id: 's1', title: 'a', status: 'completed' },
    { id: 's2', title: 'b', status: 'pending' },
  ])
  assert.equal(pendingOnly.step.id, 's2')

  assert.equal(findActiveStep([{ id: 's1', title: 'a', status: 'completed' }]), null)
})

test('formatStepPrompt and formatStepReminder produce concise, native guidance', () => {
  const prompt = formatStepPrompt({
    step: {
      id: 'step-2',
      title: '3D 场景数据绑定',
      spec: '渲染刷新管线',
      acceptance: ['帧率 60FPS', '无内存泄漏'],
      verify: true,
    },
    index: 1,
    total: 5,
  })
  assert.match(prompt, /\[当前执行步骤\] \[#step-2\] 3D 场景数据绑定 \(步骤进度: 2\/5\)/)
  assert.match(prompt, /帧率 60FPS/)
  assert.match(prompt, /verify: true/)
  assert.match(prompt, /\[执行规约\]/)

  const reminder = formatStepReminder({ id: 'step-2', title: '3D 场景数据绑定' })
  assert.match(reminder, /\[当前执行步骤\] 步骤 \[#step-2\] 正在推进中/)
  assert.ok(reminder.length < prompt.length)
})

test('buildBreadcrumbMessage embeds stepInfo', () => {
  const fake = (msg) => msg
  const msg = buildBreadcrumbMessage(
    {
      sourceKind: 'trellis',
      text: 'Original text',
      source: 'project',
      projectRoot: '/proj',
      activeTask: '.trellis/tasks/feat-01-01-demo',
      phase: 'in_progress',
      stepInfo: { step: { id: 's1', title: 'step one' }, index: 0, total: 1 },
    },
    fake,
  )
  assert.equal(msg.source.stepId, 's1')
  assert.match(msg.content[0].text, /当前执行步骤/)
  assert.match(msg.content[0].text, /Original text/)
})

// ---------------------------------------------------------------------------
// 3. Artifact update tool sandbox safety
// ---------------------------------------------------------------------------

test('assertSafeArtifactPath confines writes to the task directory', () => {
  const ok = assertSafeArtifactPath('/proj', 'feat-01-01-demo', 'prd.md')
  assert.ok(ok.endsWith(path.join('.trellis', 'tasks', 'feat-01-01-demo', 'prd.md')))

  assert.ok(ALLOWED_ARTIFACTS.has('report.md'))
  assert.ok(ALLOWED_ARTIFACTS.has('refactor-design.md'))
  assert.ok(ALLOWED_ARTIFACTS.has('apply-notes.md'))

  assert.throws(() => assertSafeArtifactPath('/proj', 'x', 'not-allowed.md'), /不允许更新非标准产物/)
  assert.throws(() => assertSafeArtifactPath('/proj', 'x', '../src/main.cs'), /不允许|路径越权/)
  assert.throws(() => assertSafeArtifactPath('/proj', 'x', 'a/b.md'), /不允许|路径越权/)

  // slug traversal is blocked (security boundary for the sandbox)
  assert.throws(() => assertSafeArtifactPath('/proj', '../../src', 'prd.md'), /非法的任务 slug/)
  assert.throws(() => assertSafeArtifactPath('/proj', '..', 'prd.md'), /非法的任务 slug/)
  assert.throws(() => assertSafeArtifactPath('/proj', 'a/b', 'prd.md'), /非法的任务 slug/)
})

test('updateTaskArtifact writes a sanctioned artifact end-to-end', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-artifact-'))
  try {
    const fs = mockFs(root)
    const slug = 'feat-01-01-artifact'
    mkdirSync(path.join(root, '.trellis', 'tasks', slug), { recursive: true })
    writeFileSync(path.join(root, '.trellis', 'tasks', slug, 'task.json'), JSON.stringify({ title: 'x' }))

    const res = await updateTaskArtifact(fs, root, { artifact: 'prd.md', slug, content: '# PRD\nhello' }, { sessionId: undefined })
    assert.equal(res.ok, true)
    const written = readFileSync(path.join(root, '.trellis', 'tasks', slug, 'prd.md'), 'utf8')
    assert.match(written, /# PRD/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 4. End-to-end: create with steps, advance, gate completion
// ---------------------------------------------------------------------------

test('createTaskRecord and updateTaskRecord drive native steps with gates', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-native-steps-'))
  try {
    const fs = mockFs(root)

    const created = await createTaskRecord(fs, root, {
      title: 'Native steps demo',
      workType: 'feat',
      slug: 'feat-08-20-native',
      steps: [
        { id: 'step-1', title: '准备数据层', acceptance: ['表结构正确'], verify: true },
        { id: 'step-2', title: '接入服务层', acceptance: ['接口可调'] },
      ],
    })
    assert.equal(created.ok, true)
    assert.equal(created.taskJson.steps.length, 2)

    const readBack = JSON.parse(readFileSync(path.join(root, '.trellis', 'tasks', 'feat-08-20-native', 'task.json'), 'utf8'))
    assert.equal(readBack.steps.length, 2)

    // Premature completion of step-1 (verify gate) fails
    const failVerify = await updateTaskRecord(fs, root, {
      slug: 'feat-08-20-native',
      step: { id: 'step-1', status: 'completed' },
    })
    assert.equal(failVerify.ok, false)
    assert.match(failVerify.error, /verification_gate/)

    // Verify step-1, then complete it
    const verify = await updateTaskRecord(fs, root, {
      slug: 'feat-08-20-native',
      step: { id: 'step-1', verified: true, verificationNotes: 'column check passed' },
    })
    assert.equal(verify.ok, true)

    const completeStep1 = await updateTaskRecord(fs, root, {
      slug: 'feat-08-20-native',
      step: { id: 'step-1', status: 'completed' },
    })
    assert.equal(completeStep1.ok, true)

    // Task-level completion should still fail (step-2 pending)
    const premature = await updateTaskRecord(fs, root, { slug: 'feat-08-20-native', status: 'completed' })
    assert.equal(premature.ok, false)
    assert.match(premature.error, /steps_incomplete/)

    // Complete step-2 then task
    await updateTaskRecord(fs, root, { slug: 'feat-08-20-native', step: { id: 'step-2', status: 'completed' } })
    const done = await updateTaskRecord(fs, root, { slug: 'feat-08-20-native', status: 'completed' })
    assert.equal(done.ok, true)
    assert.equal(done.taskJson.status, 'completed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})