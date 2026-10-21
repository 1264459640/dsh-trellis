import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { Readable } from 'node:stream'
import plugin from '../lib/index.js'
import { createTaskRecord, updateTaskRecord, findActiveTaskSlug, unbindTaskPointer } from '../lib/task.js'

const ROOT = 'F:/binding-repro'
const OLD = 'issue-10-20-old'
const NEW = 'issue-10-21-new'
const SESSION = 'session-current'
const exec = { agent: { session: { id: SESSION, header: { cwd: ROOT } } } }
const recordExec = { sessionId: SESSION }
const createArgs = (slug) => ({ slug, title: slug, workType: 'issue', status: 'planning', mode: 'standard', stage: 'report' })

// Deterministic gates, not timers: each test controls exactly when the captured
// read or pending write completes. The deadline only detects a broken harness.
function gate() {
  let arrived, release
  const reached = new Promise((resolve) => { arrived = resolve })
  const resumed = new Promise((resolve) => { release = resolve })
  return { reached, release, async pause() { arrived(); await resumed } }
}

function memoryFs() {
  const files = new Map()
  const fs = {
    sandboxMode: undefined,
    beforeWrite: null,
    afterWrite: null,
    afterRead: null,
    async resolve(p) { return { path: p.replaceAll('\\', '/') } },
    async stat(target) { return files.has(target.path) ? { type: 'file' } : undefined },
    async readText(target) {
      if (!files.has(target.path)) throw new Error('ENOENT')
      const text = files.get(target.path)
      await fs.afterRead?.(target.path)
      return text
    },
    async writeText(target, text) {
      await fs.beforeWrite?.(target.path)
      files.set(target.path, text)
      await fs.afterWrite?.(target.path, text)
    },
    async listDir(target) {
      const prefix = target.path + '/'
      return [...files.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map((p) => ({ name: p.slice(prefix.length), target: { path: p } }))
    },
  }
  return fs
}

async function seed(fs) {
  assert.equal((await createTaskRecord(fs, ROOT, createArgs(OLD), recordExec)).ok, true)
}

async function active(fs, sessionId = SESSION) {
  return findActiveTaskSlug(fs, ROOT, sessionId)
}

// Exercises the registered host tools AND task-state route, not a duplicated
// cache implementation. All IO stays in memory; no real task/session is touched.
async function mount(t, fs, config = {}) {
  const ctx = new Context()
  const tools = new Map()
  let handler, markReady
  const ready = new Promise((resolve) => { markReady = resolve })
  ctx.provide('fs', fs)
  ctx.provide('skills', {})
  ctx.provide('tools', {
    register(definition) {
      tools.set(definition.name, definition)
      if (definition.name === 'trellis_ui_update') markReady()
      return () => tools.delete(definition.name)
    },
  })
  ctx.provide('agents', { currentInitiator: () => undefined })
  ctx.provide('sessions', { get: (id) => id === SESSION ? exec.agent.session : undefined })
  ctx.provide('webServer', {
    register(route) { handler = route.handler; return () => {} },
  })
  const fork = ctx.plugin(plugin, { allowlist: [ROOT], ...config })
  t.after(() => fork.dispose())
  await ready
  assert.ok(handler)
  const call = (name, args = {}) => tools.get(name).execute(args, exec)
  const request = async (endpoint, body) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: SESSION, ...body }))])
    req.method = 'POST'
    req.url = '/trellis-workflow/api/' + endpoint
    req.headers = { host: '127.0.0.1:50846' }
    let response, status
    await handler(req, {
      writeHead(code) { status = code },
      end(text) { response = JSON.parse(text) },
    })
    assert.equal(status, 200)
    assert.equal(response.ok, true)
    return response.value
  }
  const summary = () => request('task-state')
  return { call, summary, request }
}

test('explicit old-task update does not change the newly-created binding or another session', async () => {
  const fs = memoryFs()
  await seed(fs)
  await createTaskRecord(fs, ROOT, createArgs(NEW), recordExec)
  await createTaskRecord(fs, ROOT, createArgs('issue-10-21-other'), { sessionId: 'other' })
  const result = await updateTaskRecord(fs, ROOT, { slug: OLD, title: 'Old updated' }, recordExec)
  assert.equal(result.ok, true)
  assert.equal(result.taskJson.title, 'Old updated')
  assert.equal(await active(fs), NEW)
  assert.equal(await active(fs, 'other'), 'issue-10-21-other')
  assert.equal(result.boundSessionFile, null)
})

test('in-flight implicit old update cannot overwrite a newer create binding', { timeout: 5000 }, async () => {
  const fs = memoryFs()
  await seed(fs)
  const pendingWrite = gate()
  fs.beforeWrite = (p) => p.endsWith(`/${OLD}/task.json`) ? pendingWrite.pause() : undefined
  const pending = updateTaskRecord(fs, ROOT, { title: 'Delayed old update' }, recordExec)
  await pendingWrite.reached
  try {
    await createTaskRecord(fs, ROOT, createArgs(NEW), recordExec)
    assert.equal(await active(fs), NEW)
  } finally { pendingWrite.release() }
  assert.equal((await pending).ok, true)
  assert.equal(await active(fs), NEW)
})

test('updating an unbound task does not implicitly activate it', async () => {
  const fs = memoryFs()
  await seed(fs)
  await unbindTaskPointer(fs, ROOT, SESSION)
  assert.equal((await updateTaskRecord(fs, ROOT, { slug: OLD, title: 'Still unbound' }, recordExec)).ok, true)
  assert.equal(await active(fs), null)
  const noTask = await updateTaskRecord(fs, ROOT, { title: 'No default target' }, recordExec)
  assert.equal(noTask.ok, false)
})

test('host update keeps the active summary when modifying another task', { timeout: 5000 }, async (t) => {
  const fs = memoryFs()
  const { call, summary } = await mount(t, fs)
  assert.equal((await call('trellis_task_create', createArgs(OLD))).ok, true)
  assert.equal((await call('trellis_task_create', createArgs(NEW))).ok, true)
  const result = await call('trellis_task_update', { slug: OLD, title: 'Old updated' })
  assert.equal(result.ok, true)
  assert.equal((await summary()).title, NEW)
  assert.equal((await call('trellis_task_update', { title: 'New updated' })).ok, true)
  assert.equal((await summary()).title, 'New updated')
  assert.equal(await active(fs), NEW)
})

test('host late old update cannot replace the newer binding or summary', { timeout: 5000 }, async (t) => {
  const fs = memoryFs()
  const { call, summary } = await mount(t, fs)
  await call('trellis_task_create', createArgs(OLD))
  const pendingWrite = gate()
  fs.beforeWrite = (p) => p.endsWith(`/${OLD}/task.json`) ? pendingWrite.pause() : undefined
  const pending = call('trellis_task_update', { title: 'Late update' })
  await pendingWrite.reached
  try { await call('trellis_task_create', createArgs(NEW)) } finally { pendingWrite.release() }
  assert.equal((await pending).ok, true)
  assert.equal((await summary()).title, NEW)
  assert.equal(await active(fs), NEW)
})

for (const taskSlug of [NEW, null]) {
  test(`explicit bind(${taskSlug}) survives a captured old refresh`, { timeout: 5000 }, async (t) => {
    const fs = memoryFs()
    const { call, summary, request } = await mount(t, fs)
    await call('trellis_task_create', createArgs(NEW))
    await call('trellis_task_create', createArgs(OLD))
    const oldRead = gate()
    fs.afterRead = (p) => p.endsWith(`/${OLD}/task.json`) ? oldRead.pause() : undefined
    const pending = call('trellis_ui_update')
    await oldRead.reached
    try {
      const bound = await request('bind', { taskSlug })
      assert.equal(bound.bound, taskSlug)
    } finally { oldRead.release() }
    await pending
    const current = await summary()
    assert.equal(taskSlug ? current.title : current.kind, taskSlug || 'no-task')
    assert.equal(await active(fs), taskSlug)
  })
}

for (const taskSlug of [OLD, null]) {
  test(`late create completion respects newer bind(${taskSlug})`, { timeout: 5000 }, async (t) => {
    const fs = memoryFs()
    const { call, summary, request } = await mount(t, fs)
    await call('trellis_task_create', createArgs(OLD))
    const committed = gate()
    fs.afterWrite = (p, text) => p.endsWith(`/sessions/${SESSION}.json`) && JSON.parse(text).current_task === `.trellis/tasks/${NEW}`
      ? committed.pause() : undefined
    const pending = call('trellis_task_create', createArgs(NEW))
    await committed.reached
    try { await request('bind', { taskSlug }) } finally { committed.release() }
    assert.equal((await pending).ok, true)
    assert.equal(await active(fs), taskSlug)
    const current = await summary()
    assert.equal(taskSlug ? current.title : current.kind, taskSlug || 'no-task')
  })
}

test('late skip completion does not hide a newer explicit binding', { timeout: 5000 }, async (t) => {
  const fs = memoryFs()
  const { call, summary, request } = await mount(t, fs)
  await call('trellis_task_create', createArgs(OLD))
  await request('bind', { taskSlug: null })
  const committed = gate()
  fs.afterWrite = (p, text) => p.endsWith(`/sessions/${SESSION}.json`) && JSON.parse(text).skipped === true
    ? committed.pause() : undefined
  const pending = call('trellis_task_skip')
  await committed.reached
  try { await request('bind', { taskSlug: OLD }) } finally { committed.release() }
  assert.equal((await pending).ok, true)
  assert.equal(await active(fs), OLD)
  assert.equal((await summary()).title, OLD)
})

test('cache miss uses actual session binding and configured inline phase', { timeout: 5000 }, async (t) => {
  const fs = memoryFs()
  await seed(fs)
  const { call, summary } = await mount(t, fs, { inline: true })
  const initial = await summary()
  assert.equal(initial.title, OLD)
  assert.equal(initial.phase, 'planning-inline')
  assert.equal((await call('trellis_task_update', { title: 'Current updated' })).ok, true)
  assert.equal((await summary()).title, 'Current updated')
  assert.equal((await summary()).phase, 'planning-inline')
})

test('a captured old summary read cannot repopulate cache after create', { timeout: 5000 }, async (t) => {
  const fs = memoryFs()
  const { call, summary } = await mount(t, fs)
  await call('trellis_task_create', createArgs(OLD))
  const oldRead = gate()
  fs.afterRead = (p) => p.endsWith(`/${OLD}/task.json`) ? oldRead.pause() : undefined
  const pending = call('trellis_ui_update')
  await oldRead.reached
  try { await call('trellis_task_create', createArgs(NEW)) } finally { oldRead.release() }
  await pending
  assert.equal((await summary()).title, NEW)
  assert.equal(await active(fs), NEW)
})
