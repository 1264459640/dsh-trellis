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
import { ensureProjectSkills, pruneDeprecatedProjectTemplates, DEPRECATED_PROJECT_TEMPLATES } from '../lib/skills.js'

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
  assert.match(prompt, /verification: ai/)
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

test('buildBreadcrumbMessage omits absent source fields (lossless-JSON safe)', () => {
  // Regression for issue-09-05-breadcrumb-undefined: the injected breadcrumb is
  // appended to the session as a `user/message` event, and dsh-session rejects
  // ANY `undefined` value in the payload (snapshotJsonValue). Missing fields
  // must be ABSENT keys, never keys holding `undefined`.
  const fake = (msg) => msg

  // No active step -> stepId must not exist as a key.
  const noStep = buildBreadcrumbMessage(
    {
      sourceKind: 'trellis',
      text: 'Plain text',
      source: 'project',
      projectRoot: '/proj',
      activeTask: '.trellis/tasks/feat-01-01-demo',
      phase: 'no_task',
    },
    fake,
  )
  assert.equal(Object.hasOwn(noStep.source, 'stepId'), false)
  assert.equal(Object.hasOwn(noStep.source, 'project'), true)
  assert.equal(noStep.source.project, '/proj')
  assert.ok(isLosslessJson(noStep))

  // Missing projectRoot -> project is omitted too, never `undefined`.
  const noProject = buildBreadcrumbMessage(
    {
      sourceKind: 'trellis',
      text: 'Plain text',
      source: 'builtin',
      phase: 'no_task',
    },
    fake,
  )
  assert.equal(Object.hasOwn(noProject.source, 'project'), false)
  assert.equal(Object.hasOwn(noProject.source, 'stepId'), false)
  assert.ok(isLosslessJson(noProject))

  // Active step -> stepId present, message still lossless.
  const withStep = buildBreadcrumbMessage(
    {
      sourceKind: 'trellis',
      text: 'Text',
      source: 'project',
      projectRoot: '/proj',
      activeTask: '.trellis/tasks/feat-01-01-demo',
      phase: 'in_progress',
      stepInfo: { step: { id: 's1', title: 't' }, index: 0, total: 1 },
    },
    fake,
  )
  assert.equal(withStep.source.stepId, 's1')
  assert.ok(isLosslessJson(withStep))
})

/**
 * Mirror the harness lossless-JSON contract (@deepseek-ai/dsh-session
 * snapshotJsonValue in @deepseek-ai/dsh-util-values): reject undefined,
 * function, symbol, bigint, non-finite / -0 numbers, sparse arrays, and
 * circular references nested anywhere in the value.
 * @param {unknown} value
 * @returns {boolean}
 */
function isLosslessJson(value) {
  const ancestors = new Set()
  const walk = (node) => {
    if (node === null) return true
    const t = typeof node
    if (t === 'boolean' || t === 'string') return true
    if (t === 'number') return Number.isFinite(node) && !Object.is(node, -0)
    if (t !== 'object') return false // undefined | function | symbol | bigint
    if (ancestors.has(node)) return false
    ancestors.add(node)
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (!Object.hasOwn(node, i) || !walk(node[i])) return false
      }
    } else {
      for (const key of Object.keys(node)) {
        if (!walk(node[key])) return false
      }
    }
    ancestors.delete(node)
    return true
  }
  return walk(value)
}

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

// ---------------------------------------------------------------------------
// 5. Unified 5-state machine, AI/Human verification gates, blocked linkage
// ---------------------------------------------------------------------------

test('validateSteps accepts 5-state statuses and verification modes', () => {
  const res = validateSteps([
    { id: 's1', title: 'a', status: 'verifying', verification: 'ai' },
    { id: 's2', title: 'b', status: 'blocked', blockedReason: '依赖缺失' },
    { id: 's3', title: 'c', status: 'completed', verification: 'human', verified: true, verifiedBy: 'human' },
  ])
  assert.equal(res.ok, true)
  assert.equal(res.steps[0].status, 'verifying')
  assert.equal(res.steps[0].verification, 'ai')
  assert.equal(res.steps[1].blockedReason, '依赖缺失')
  assert.equal(res.steps[2].verifiedBy, 'human')

  assert.equal(validateSteps([{ id: 's1', title: 'a', status: 'bogus' }]).ok, false)
  assert.equal(validateSteps([{ id: 's1', title: 'a', verification: 'robot' }]).ok, false)
})

test('validateStepUpdate accepts new fields and rejects unknown verification', () => {
  const ok = validateStepUpdate({ id: 's1', status: 'verifying', verification: 'human', blockedReason: 'x' })
  assert.equal(ok.ok, true)
  assert.equal(ok.update.status, 'verifying')
  assert.equal(ok.update.verification, 'human')

  const bad = validateStepUpdate({ id: 's1', verification: 'robot' })
  assert.equal(bad.ok, false)
  assert.match(bad.error, /verification 必须是/)
})

test('applyStepUpdate enforces AI gate and Human self-certification guard', () => {
  // AI: completed requires verified: true already persisted (two-phase commit).
  const aiSteps = [
    { id: 's1', title: 'ai step', status: 'in_progress', verification: 'ai', verified: false },
  ]
  const aiFail = applyStepUpdate(aiSteps, { id: 's1', status: 'completed' })
  assert.equal(aiFail.ok, false)
  assert.match(aiFail.error, /verification_gate/)

  const aiVerified = applyStepUpdate(aiSteps, { id: 's1', verified: true, verificationNotes: 'tests pass' })
  assert.equal(aiVerified.ok, true)
  assert.equal(aiVerified.steps[0].verifiedBy, 'ai')

  const aiDone = applyStepUpdate(aiVerified.steps, { id: 's1', status: 'completed' })
  assert.equal(aiDone.ok, true)
  assert.equal(aiDone.steps[0].status, 'completed')

  // Human: model cannot self-certify; verified: true requires verifiedBy: 'human'.
  const humanSteps = [
    { id: 's2', title: 'human step', status: 'verifying', verification: 'human', verified: false },
  ]
  const humanSelfCert = applyStepUpdate(humanSteps, { id: 's2', verified: true })
  assert.equal(humanSelfCert.ok, false)
  assert.match(humanSelfCert.error, /human_gate/)
  assert.match(humanSelfCert.error, /verifiedBy/)

  const humanVerified = applyStepUpdate(humanSteps, { id: 's2', verified: true, verifiedBy: 'human', verificationNotes: 'user approved' })
  assert.equal(humanVerified.ok, true)

  const humanDone = applyStepUpdate(humanVerified.steps, { id: 's2', status: 'completed' })
  assert.equal(humanDone.ok, true)
  assert.equal(humanDone.steps[0].status, 'completed')

  // Human completion without persisted human verification still fails.
  const humanPremature = applyStepUpdate(
    [{ id: 's3', title: 'h', status: 'verifying', verification: 'human', verified: true, verifiedBy: 'ai' }],
    { id: 's3', status: 'completed' },
  )
  assert.equal(humanPremature.ok, false)
  assert.match(humanPremature.error, /human_gate/)
})

test('applyStepUpdate requires blockedReason when moving to blocked', () => {
  const steps = [{ id: 's1', title: 'a', status: 'in_progress' }]
  const noReason = applyStepUpdate(steps, { id: 's1', status: 'blocked' })
  assert.equal(noReason.ok, false)
  assert.match(noReason.error, /blockedReason/)

  const ok = applyStepUpdate(steps, { id: 's1', status: 'blocked', blockedReason: '外部接口未就绪' })
  assert.equal(ok.ok, true)
  assert.equal(ok.steps[0].status, 'blocked')
  assert.equal(ok.steps[0].blockedReason, '外部接口未就绪')
})

test('checkStepsCompletion rejects blocked steps and human-unverified completion', () => {
  const blocked = checkStepsCompletion([
    { id: 's1', title: 'a', status: 'blocked', blockedReason: 'x' },
  ])
  assert.equal(blocked.ok, false)
  assert.match(blocked.error, /steps_blocked/)

  const humanUnconfirmed = checkStepsCompletion([
    { id: 's1', title: 'a', status: 'completed', verification: 'human', verified: true, verifiedBy: 'ai' },
  ])
  assert.equal(humanUnconfirmed.ok, false)
  assert.match(humanUnconfirmed.error, /steps_unverified/)

  const clean = checkStepsCompletion([
    { id: 's1', title: 'a', status: 'completed', verification: 'human', verified: true, verifiedBy: 'human' },
    { id: 's2', title: 'b', status: 'completed', verification: 'ai', verified: true },
    { id: 's3', title: 'c', status: 'completed' },
  ])
  assert.equal(clean.ok, true)
})

test('findActiveStep priority: blocked > in_progress > verifying > pending', () => {
  const mixed = [
    { id: 's1', title: 'a', status: 'pending' },
    { id: 's2', title: 'b', status: 'verifying', verification: 'ai' },
    { id: 's3', title: 'c', status: 'in_progress' },
    { id: 's4', title: 'd', status: 'blocked', blockedReason: 'x' },
  ]
  assert.equal(findActiveStep(mixed).step.id, 's4')

  const verifyingOnly = [
    { id: 's1', title: 'a', status: 'pending' },
    { id: 's2', title: 'b', status: 'verifying' },
  ]
  assert.equal(findActiveStep(verifyingOnly).step.id, 's2')

  const inProgressFirst = [
    { id: 's1', title: 'a', status: 'in_progress' },
    { id: 's2', title: 'b', status: 'verifying' },
  ]
  assert.equal(findActiveStep(inProgressFirst).step.id, 's1')
})

test('formatStepPrompt renders verifying and blocked states distinctly', () => {
  const aiVerifying = formatStepPrompt({
    step: { id: 's1', title: '引擎重构', status: 'verifying', verification: 'ai', acceptance: ['x'] },
    index: 0,
    total: 2,
  })
  assert.match(aiVerifying, /验证阶段 - 自动化测试/)
  assert.match(aiVerifying, /design\.md 中声明的验证命令/)

  const humanVerifying = formatStepPrompt({
    step: { id: 's2', title: '数据迁移', status: 'verifying', verification: 'human', acceptance: ['x'] },
    index: 1,
    total: 2,
  })
  assert.match(humanVerifying, /人工验收卡点/)
  assert.match(humanVerifying, /严禁自作主张推进至完成/)

  const blocked = formatStepPrompt({
    step: { id: 's3', title: '接口联调', status: 'blocked', blockedReason: '网关未开' },
    index: 0,
    total: 3,
  })
  assert.match(blocked, /⚠️ 步骤已阻塞/)
  assert.match(blocked, /网关未开/)
})

// ---------------------------------------------------------------------------
// 6. Deprecated template pruning (self-healing migration)
// ---------------------------------------------------------------------------

test('DEPRECATED_PROJECT_TEMPLATES covers both legacy template locations', () => {
  const rels = DEPRECATED_PROJECT_TEMPLATES.map((p) => p.replace(/\\/g, '/'))
  assert.ok(rels.includes('.agents/skills/_templates/feat/implement.md'))
  assert.ok(rels.includes('.agents/skills/_templates/refactor/checklist.yaml'))
  assert.ok(rels.includes('.trellis/templates/feat/implement.md'))
  assert.ok(rels.includes('.trellis/templates/refactor/checklist.yaml'))
})

test('pruneDeprecatedProjectTemplates removes legacy templates and keeps other files', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-prune-'))
  try {
    for (const rel of DEPRECATED_PROJECT_TEMPLATES) {
      const abs = path.join(root, rel)
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, '# legacy\n')
    }
    // A non-deprecated template must survive.
    const keep = path.join(root, '.agents', 'skills', '_templates', 'feat', 'design.md')
    mkdirSync(path.dirname(keep), { recursive: true })
    writeFileSync(keep, '# design\n')

    const fs = mockFs(root)
    const { pruned, skipped } = await pruneDeprecatedProjectTemplates(fs, root)
    assert.equal(pruned.length, DEPRECATED_PROJECT_TEMPLATES.length)
    assert.equal(skipped.length, 0)
    for (const rel of DEPRECATED_PROJECT_TEMPLATES) {
      assert.throws(() => statSync(path.join(root, rel)))
    }
    assert.equal(readFileSync(keep, 'utf8'), '# design\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ensureProjectSkills prunes deprecated templates after provisioning', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-provision-'))
  try {
    const fs = mockFs(root)
    // Simulate a stale project copy of the deprecated skill template.
    const stale = path.join(root, '.agents', 'skills', '_templates', 'refactor', 'checklist.yaml')
    mkdirSync(path.dirname(stale), { recursive: true })
    writeFileSync(stale, 'steps:\n')

    const res = await ensureProjectSkills(fs, root)
    assert.ok(Array.isArray(res.copied))
    assert.throws(() => statSync(stale))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})