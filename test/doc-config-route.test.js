import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'

import plugin from '../lib/index.js'
import { SPEC_INDEX_SECTION } from '../lib/spec.js'

const DOC_CONFIG_PATH = '/trellis-workflow/api/doc-config'

/** dsh-fs stand-in over a real temp directory. */
function mockFs() {
  const target = (p) => ({ targetKey: path.resolve(p), displayPath: p })
  return {
    sandboxMode: undefined,
    async resolve(p) {
      return target(p)
    },
    async stat(t) {
      try {
        const s = statSync(t.targetKey)
        return s.isFile() ? { type: 'file' } : s.isDirectory() ? { type: 'directory' } : { type: 'other' }
      } catch {
        return undefined
      }
    },
    async readText(t) {
      return statSync(t.targetKey).isFile() ? readFileSync(t.targetKey, 'utf8') : ''
    },
    async writeText(t, content) {
      mkdirSync(path.dirname(t.targetKey), { recursive: true })
      writeFileSync(t.targetKey, content, 'utf8')
      return { operation: 'update' }
    },
    async listDir(t) {
      return readdirSync(t.targetKey, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        target: target(path.join(t.targetKey, entry.name)),
      }))
    },
    contains(parent, child) {
      const p = path.resolve(parent.targetKey)
      const c = path.resolve(child.targetKey)
      return c === p || c.startsWith(p + path.sep)
    },
  }
}

/**
 * Mount the plugin with a stub web server, capture the doc-config handler and
 * return a caller that performs one real HTTP-shaped request against it.
 * @param {{ cwd: string, allowlist?: string[], sessionId?: string }} options
 */
async function mountRoute({ cwd, allowlist = [cwd], sessionId = 'sess-1' }) {
  const root = new Context()
  let handler = null
  root.provide('fs', mockFs())
  root.provide('skills', {})
  root.provide('tools', { register: () => () => {} })
  root.provide('agents', { currentInitiator: () => ({ session: { id: sessionId, header: { cwd } } }) })
  root.provide('sessions', {
    get(id) {
      return id === sessionId ? { id, header: { cwd } } : undefined
    },
  })
  root.provide('webServer', {
    register(definition) {
      if (definition.path === '/trellis-workflow/api') handler = definition.handler
      return () => {
        handler = null
      }
    },
  })
  root.plugin(plugin, { allowlist })
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.ok(handler, 'the API prefix route was not registered')
  return { root, call: (request) => invoke(handler, request) }
}

function invoke(handler, { body, headers, method = 'POST', path: urlPath = DOC_CONFIG_PATH }) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter()
    req.method = method
    req.url = urlPath
    req.headers = headers || { host: '127.0.0.1:60666' }
    req.destroy = () => {}
    const res = {
      statusCode: 0,
      writeHead(code) {
        this.statusCode = code
      },
      end(text) {
        resolve({ status: this.statusCode, body: text ? JSON.parse(text) : null })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
    process.nextTick(() => {
      if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)))
      req.emit('end')
    })
  })
}

function seed(root, rel, content = '# doc\n') {
  const abs = path.join(root, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), 'trellis-doc-route-'))
}

test('doc-config rejects cross-site and non-POST requests before touching the project', async () => {
  const root = tempRoot()
  try {
    const { call } = await mountRoute({ cwd: root })
    const crossSite = await call({
      body: { sessionId: 'sess-1', action: 'read' },
      headers: { host: '127.0.0.1:60666', 'sec-fetch-site': 'cross-site' },
    })
    assert.equal(crossSite.status, 403)

    const wrongMethod = await call({ method: 'GET' })
    assert.equal(wrongMethod.status, 405)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('doc-config rejects unknown sessions (404) and projects outside the allowlist (403)', async () => {
  const root = tempRoot()
  try {
    const { call } = await mountRoute({ cwd: root, allowlist: ['E:/somewhere-else'] })
    const unknown = await call({ body: { sessionId: 'nope', action: 'read' } })
    assert.equal(unknown.status, 404)

    const forbidden = await call({ body: { sessionId: 'sess-1', action: 'read' } })
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.ok, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('read reports the absent state with the legacy .trellis/spec index', async () => {
  const root = tempRoot()
  try {
    seed(root, '.trellis/spec/guides/index.md')
    const { call } = await mountRoute({ cwd: root })
    const response = await call({ body: { sessionId: 'sess-1', action: 'read' } })
    assert.equal(response.status, 200)
    assert.equal(response.body.ok, true)
    assert.equal(response.body.value.state, 'absent')
    assert.deepEqual(response.body.value.legacy, ['.trellis/spec/guides/index.md'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('preview reports every offending entry without writing .trellis/doc.json', async () => {
  const root = tempRoot()
  try {
    const { call } = await mountRoute({ cwd: root })
    const response = await call({
      body: { sessionId: 'sess-1', action: 'preview', root: 'docs', files: ['docs/missing.md', '../escape.md'] },
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.ok, false)
    assert.deepEqual(
      response.body.details.map((detail) => detail.reason),
      ['missing', 'outside'],
    )
    assert.equal(existsSync(path.join(root, '.trellis', 'doc.json')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('doc-config rejects a non-string root instead of treating it as absent', async () => {
  const root = tempRoot()
  try {
    const { call } = await mountRoute({ cwd: root })
    const response = await call({
      body: { sessionId: 'sess-1', action: 'preview', root: 42, files: ['docs/a.md'] },
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.ok, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('save writes doc.json and the next assembly reads it without waiting for the TTL', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', '# A body\n')
    const { root: ctx, call } = await mountRoute({ cwd: root })

    // Prime the per-root memo with "no spec at all" before the save.
    const before = await ctx.waterfall('system-prompt/assemble', { tools: [], sections: [] }, {}, (base) => base)
    assert.equal(before.sections.some((section) => section.name === SPEC_INDEX_SECTION), false)

    const saved = await call({
      body: { sessionId: 'sess-1', action: 'save', root: 'docs', files: ['docs/a.md'] },
    })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.ok, true)
    assert.equal(saved.body.value.state, 'configured')

    const text = readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8')
    assert.ok(text.endsWith('\n'))
    assert.deepEqual(JSON.parse(text), { root: 'docs', files: ['docs/a.md'] })

    const after = await ctx.waterfall('system-prompt/assemble', { tools: [], sections: [] }, {}, (base) => base)
    const section = after.sections.find((item) => item.name === SPEC_INDEX_SECTION)
    assert.ok(section, 'the saved config must be injected on the very next assembly')
    assert.match(section.text, /# A body/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
