import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'

import plugin from '../lib/index.js'
import { SPEC_INDEX_SECTION } from '../lib/spec.js'
import { READONLY_SECTION } from '../lib/readonly.js'

/** Counts every fs call so the spec-index memo can be proven. */
const fsCalls = { n: 0 }

/** dsh-fs stand-in over a real temp directory (resolve/stat/readText/listDir). */
function mockFs() {
  const target = (p) => ({ targetKey: path.resolve(p), displayPath: p })
  return {
    sandboxMode: undefined,
    async resolve(p) {
      fsCalls.n += 1
      return target(p)
    },
    async stat(t) {
      fsCalls.n += 1
      try {
        const s = statSync(t.targetKey)
        return s.isFile() ? { type: 'file' } : s.isDirectory() ? { type: 'directory' } : { type: 'other' }
      } catch {
        return undefined
      }
    },
    async readText(t) {
      try {
        return statSync(t.targetKey).isFile() ? readFileSync(t.targetKey, 'utf8') : ''
      } catch {
        return ''
      }
    },
    async listDir(t) {
      fsCalls.n += 1
      return readdirSync(t.targetKey, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        target: target(path.join(t.targetKey, entry.name)),
      }))
    },
    async writeText() {
      return { ok: true }
    },
  }
}

/**
 * Mount the plugin and return a helper that drives one real
 * `system-prompt/assemble` waterfall pass.
 *
 * The terminator listener is registered AFTER the plugin so the plugin's
 * handler runs first and its `next()` resolves to `base` — exactly the
 * composition the harness performs.
 */
async function mountAssembler({ cwd, allowlist = [cwd], config = {} }) {
  const root = new Context()
  fsCalls.n = 0
  root.provide('fs', mockFs())
  root.provide('skills', {})
  root.provide('tools', { register: () => () => {} })
  root.provide('agents', {
    currentInitiator: () => ({ session: { id: 'sess-1', header: { cwd } } }),
  })

  root.plugin(plugin, { allowlist, ...config })
  await new Promise((resolve) => setTimeout(resolve, 250))

  const base = {
    tools: [{ name: 'read' }, { name: 'write' }, { name: 'trellis_artifact_update' }],
    sections: [{ name: 'persona', text: 'you are helpful' }],
  }
  // cordis' waterfall takes the innermost `next` as its LAST argument
  // (cordis/lib/index.js waterfall) — the exact shape dsh-agent-loop uses.
  // Routing the base assembly back through that `next` reproduces the harness
  // composition instead of hand-feeding the plugin's own `next()`.

  return async function assemble() {
    return root.waterfall('system-prompt/assemble', base, {}, () => base)
  }
}

function seedSpec(root, files) {
  for (const rel of files) {
    const abs = path.join(root, '.trellis', 'spec', rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, `# ${rel}\n`)
  }
}

test('assemble injects the spec index section for a project that carries .trellis/spec', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-spec-'))
  try {
    seedSpec(root, ['guides/index.md', 'core/task-engine/index.md'])
    const assemble = await mountAssembler({ cwd: root })
    const out = await assemble()

    const specSection = out.sections.find((s) => s.name === SPEC_INDEX_SECTION)
    assert.ok(specSection, 'trellis:spec-index must be injected')
    assert.match(specSection.text, /\.trellis\/spec\/guides\/index\.md/)
    assert.match(specSection.text, /\.trellis\/spec\/core\/task-engine\/index\.md/)
    assert.match(specSection.text, /read/)
    // The index is an index: bodies are never dumped into the prompt.
    assert.ok(specSection.text.length < 900)
    // Untouched neighbours survive; the section is appended, not replacing.
    assert.ok(out.sections.some((s) => s.name === 'persona'))
    assert.equal(out.tools.length, 3, 'spec injection must not touch the tool surface')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('assemble injects nothing extra when the project has no .trellis/spec', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-nospec-'))
  try {
    mkdirSync(path.join(root, '.trellis', 'tasks'), { recursive: true })
    const assemble = await mountAssembler({ cwd: root })
    const out = await assemble()
    assert.equal(out.sections.some((s) => s.name === SPEC_INDEX_SECTION), false)
    assert.deepEqual(
      out.sections.map((s) => s.name),
      ['persona'],
      'assembly must stay byte-identical without specs',
    )
    // The tool surface is part of "identical": the spec branch must never touch it.
    assert.deepEqual(out.tools, [
      { name: 'read' },
      { name: 'write' },
      { name: 'trellis_artifact_update' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('assemble ignores projects outside the allowlist', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-allow-'))
  const other = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-other-'))
  try {
    seedSpec(root, ['guides/index.md'])
    // The session cwd is NOT the allowlisted root, so `matchAllowlist` misses.
    // Keeping the project real (it really has specs) is what makes this test
    // able to fail if the `if (!root) return assembled` guard disappears.
    const assemble = await mountAssembler({ cwd: other, allowlist: [root] })
    const out = await assemble()
    assert.equal(out.sections.some((s) => s.name === SPEC_INDEX_SECTION), false)
    assert.deepEqual(out.sections.map((s) => s.name), ['persona'])
    assert.deepEqual(out.tools, [
      { name: 'read' },
      { name: 'write' },
      { name: 'trellis_artifact_update' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(other, { recursive: true, force: true })
  }
})

test('spec index coexists with the read-only section under enforceReadonlyPlanning', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-ro-'))
  try {
    seedSpec(root, ['guides/index.md'])
    mkdirSync(path.join(root, '.trellis', '.runtime', 'sessions'), { recursive: true })
    writeFileSync(path.join(root, '.trellis', '.runtime', 'sessions', 'dsh-session.json'), JSON.stringify({}))

    const assemble = await mountAssembler({ cwd: root, config: { enforceReadonlyPlanning: true } })
    const out = await assemble()
    const names = out.sections.map((s) => s.name)
    assert.ok(names.includes(READONLY_SECTION), 'undecided state must still inject trellis:readonly')
    assert.ok(names.includes(SPEC_INDEX_SECTION), 'the spec index must not be gated behind the readonly switch')
    assert.equal(names.filter((n) => n === SPEC_INDEX_SECTION).length, 1)
    assert.equal(names.filter((n) => n === READONLY_SECTION).length, 1)
    assert.ok(!out.tools.some((t) => t.name === 'write'), 'denylist trimming still applies')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('injectSpecIndex: false disables the section even when specs exist', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-off-'))
  try {
    seedSpec(root, ['guides/index.md'])
    const assemble = await mountAssembler({ cwd: root, config: { injectSpecIndex: false } })
    const out = await assemble()
    assert.equal(out.sections.some((s) => s.name === SPEC_INDEX_SECTION), false)
    assert.deepEqual(out.sections.map((s) => s.name), ['persona'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the injected index is anchored to the project root, not to the session cwd', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-sub-'))
  try {
    seedSpec(root, ['guides/index.md'])
    const sub = path.join(root, 'packages', 'app')
    mkdirSync(sub, { recursive: true })
    // Subtree allowlist match: cwd lives INSIDE the allowlisted project root.
    const assemble = await mountAssembler({ cwd: sub, allowlist: [root] })
    const out = await assemble()
    const specSection = out.sections.find((s) => s.name === SPEC_INDEX_SECTION)
    assert.ok(specSection, 'a subdirectory session must still receive the index')
    assert.ok(
      specSection.text.includes(root.replace(/\\/g, '/')) || specSection.text.includes(root),
      'the index must name the project root so relative paths resolve',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the spec index is memoized: a second assembly does no fs work', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-assemble-memo-'))
  try {
    seedSpec(root, ['guides/index.md', 'core/task-engine/index.md'])
    const assemble = await mountAssembler({ cwd: root })

    const first = await assemble()
    const afterCold = fsCalls.n
    assert.ok(afterCold > 0, 'the first assembly must hit the fs')
    assert.ok(first.sections.some((s) => s.name === SPEC_INDEX_SECTION))

    const second = await assemble()
    assert.equal(fsCalls.n, afterCold, 'assemble is per request — a repeat must not re-walk the tree')
    assert.deepEqual(
      second.sections.find((s) => s.name === SPEC_INDEX_SECTION).text,
      first.sections.find((s) => s.name === SPEC_INDEX_SECTION).text,
      'a memo hit must return the same rendered index',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
