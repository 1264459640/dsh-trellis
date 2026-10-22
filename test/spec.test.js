import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, realpathSync, statSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  SPEC_ROOT_PREFIX,
  SPEC_INDEX_SECTION,
  compareSpecPaths,
  listProjectSpecs,
  formatSpecIndexInstruction,
  appendSpecInstruction,
} from '../lib/spec.js'
import { READONLY_SECTION, appendReadonlyInstruction } from '../lib/readonly.js'

/** Minimal dsh-fs stand-in over a real directory (resolve/stat/listDir only). */
function mockFs(root) {
  const target = (p) => ({ targetKey: path.resolve(p), displayPath: p })
  return {
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
    async listDir(t) {
      return readdirSync(t.targetKey, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        target: target(path.join(t.targetKey, entry.name)),
      }))
    },
    // Mirrors dsh-fs FileSystem.contains: a junction/symlink that resolves
    // outside the parent is NOT contained.
    contains(parent, child) {
      const real = (p) => {
        try {
          return realpathSync(p)
        } catch {
          return path.resolve(p)
        }
      }
      const p = real(parent.targetKey)
      const c = real(child.targetKey)
      return c === p || c.startsWith(p + path.sep)
    },
  }
}

/** A backend that forgets `entry.type`, forcing kindOf's stat fallback. */
function typelessFs(root) {
  const base = mockFs(root)
  return {
    resolve: base.resolve,
    stat: base.stat,
    contains: base.contains,
    async listDir(t) {
      const entries = await base.listDir(t)
      return entries.map(({ name, target }) => ({ name, target }))
    },
  }
}

function seedSpec(root) {
  const spec = path.join(root, '.trellis', 'spec')
  mkdirSync(path.join(spec, 'guides'), { recursive: true })
  writeFileSync(path.join(spec, 'guides', 'index.md'), '# guides\n')
  writeFileSync(path.join(spec, 'guides', 'conventions.md'), '# conventions\n')
  mkdirSync(path.join(spec, 'core', 'task-engine'), { recursive: true })
  writeFileSync(path.join(spec, 'core', 'task-engine', 'index.md'), '# engine\n')
  writeFileSync(path.join(spec, 'core', 'task-engine', 'notes.txt'), 'not markdown\n')
  mkdirSync(path.join(spec, '.hidden'), { recursive: true })
  writeFileSync(path.join(spec, '.hidden', 'index.md'), '# hidden\n')
  return spec
}

test('listProjectSpecs lists markdown specs shallow-first, skipping non-md and dot dirs', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-'))
  try {
    const spec = seedSpec(root)
    const paths = await listProjectSpecs(mockFs(root), spec)
    // Ranked: every index.md first (shallow before deep), then the other docs.
    assert.deepEqual(paths, [
      'guides/index.md',
      'core/task-engine/index.md',
      'guides/conventions.md',
    ])
    assert.ok(!paths.some((p) => p.includes('.hidden')), 'dot directories must be skipped')
    assert.ok(!paths.some((p) => p.endsWith('.txt')), 'non-markdown files must be skipped')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listProjectSpecs falls back to stat when entries carry no type', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-typeless-'))
  try {
    const spec = seedSpec(root)
    const paths = await listProjectSpecs(typelessFs(root), spec)
    assert.deepEqual(paths, ['guides/index.md', 'core/task-engine/index.md', 'guides/conventions.md'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listProjectSpecs returns [] when the spec root is missing or empty', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-empty-'))
  try {
    const fsMock = mockFs(root)
    assert.deepEqual(await listProjectSpecs(fsMock, path.join(root, '.trellis', 'spec')), [])
    mkdirSync(path.join(root, '.trellis', 'spec'), { recursive: true })
    assert.deepEqual(await listProjectSpecs(fsMock, path.join(root, '.trellis', 'spec')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listProjectSpecs is fail-open on hostile or incomplete fs surfaces', async () => {
  assert.deepEqual(await listProjectSpecs(undefined, '/x'), [])
  assert.deepEqual(await listProjectSpecs({}, '/x'), [])
  assert.deepEqual(await listProjectSpecs({ resolve: () => Promise.reject(new Error('boom')) }, '/x'), [])
  assert.deepEqual(await listProjectSpecs({ resolve: async () => ({}), listDir: async () => [] }, ''), [])
  assert.deepEqual(
    await listProjectSpecs({ resolve: async () => ({}), stat: async () => ({ type: 'file' }), listDir: async () => [] }, '/x'),
    [],
    'a non-directory spec root must not be walked',
  )
  assert.deepEqual(
    await listProjectSpecs({ resolve: async () => ({}), listDir: async () => { throw new Error('nope') } }, '/x'),
    [],
  )
})

test('listProjectSpecs bounds the walk by maxEntries and maxDepth', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-bounds-'))
  try {
    const spec = seedSpec(root)
    mkdirSync(path.join(spec, 'a', 'b', 'c', 'd'), { recursive: true })
    writeFileSync(path.join(spec, 'a', 'b', 'c', 'd', 'deep.md'), '# deep\n')
    const fsMock = mockFs(root)

    // index.md wins the budget over sibling notes at the same depth.
    const capped = await listProjectSpecs(fsMock, spec, { maxEntries: 2 })
    assert.deepEqual(capped, ['guides/index.md', 'core/task-engine/index.md'])

    // maxDirs bounds the WALK itself: one visited directory sees no .md yet.
    const noWalk = await listProjectSpecs(fsMock, spec, { maxDirs: 1 })
    assert.deepEqual(noWalk, [], 'the breadth cap must stop the walk, not just trim the output')

    const shallow = await listProjectSpecs(fsMock, spec, { maxDepth: 2 })
    assert.ok(!shallow.includes('core/task-engine/index.md'), 'depth 2 must not reach core/task-engine/index.md')
    assert.ok(shallow.includes('guides/index.md'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('formatSpecIndexInstruction renders the index plus the read-first constraint', () => {
  const text = formatSpecIndexInstruction(['guides/index.md', 'core/task-engine/index.md'])
  assert.ok(text)
  assert.ok(text.includes(`${SPEC_ROOT_PREFIX}guides/index.md`))
  assert.ok(text.includes(`${SPEC_ROOT_PREFIX}core/task-engine/index.md`))
  assert.ok(text.includes('read'))
  assert.ok(text.includes('禁止擅自偏离'))
  assert.ok(text.length < 900, 'the index must stay compact')
})

test('formatSpecIndexInstruction returns null when there is nothing to index', () => {
  assert.equal(formatSpecIndexInstruction([]), null)
  assert.equal(formatSpecIndexInstruction(null), null)
  assert.equal(formatSpecIndexInstruction(undefined), null)
  assert.equal(formatSpecIndexInstruction('guides/index.md'), null)
  assert.equal(formatSpecIndexInstruction(['', '   ', 42]), null)
})

test('formatSpecIndexInstruction tolerates mixed junk entries', () => {
  const text = formatSpecIndexInstruction([null, 'guides/index.md', undefined, ''])
  assert.ok(text)
  assert.ok(text.includes(`${SPEC_ROOT_PREFIX}guides/index.md`))
})

test('compareSpecPaths ranks index.md first, then depth, then lexicographically', () => {
  const sorted = ['b/index.md', 'a/deep/x.md', 'a/index.md'].sort(compareSpecPaths)
  assert.deepEqual(sorted, ['a/index.md', 'b/index.md', 'a/deep/x.md'])
})

test('listProjectSpecs stops when the signal is already aborted', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-abort-'))
  try {
    const spec = seedSpec(root)
    const controller = new AbortController()
    controller.abort()
    const paths = await listProjectSpecs(mockFs(root), spec, { signal: controller.signal })
    assert.deepEqual(paths, [], 'an aborted walk must fail open to no specs, not throw')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listProjectSpecs never follows a symlinked directory out of the tree', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trellis-spec-link-'))
  const outside = mkdtempSync(path.join(tmpdir(), 'trellis-spec-outside-'))
  try {
    const spec = seedSpec(root)
    writeFileSync(path.join(outside, 'leaked.md'), '# leaked\n')
    let linked = true
    try {
      symlinkSync(outside, path.join(spec, 'linked'), 'junction')
    } catch {
      linked = false // unprivileged Windows without developer mode
    }
    if (!linked) {
      // Junction creation needs privileges on Windows; the containment guard is
      // still exercised below via a fake fs that reports "not contained".
      const guarded = await listProjectSpecs(
        { ...mockFs(root), contains: () => false },
        spec,
      )
      assert.deepEqual(guarded, [], 'a non-contained child must not be indexed')
      return
    }
    const paths = await listProjectSpecs(mockFs(root), spec)
    assert.ok(!paths.some((p) => p.includes('leaked')), 'a spec index must not leak outside the spec root')
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test('formatSpecIndexInstruction anchors relative paths to the project root', () => {
  const rooted = formatSpecIndexInstruction(['guides/index.md'], { root: 'E:/proj' })
  assert.match(rooted, /E:\/proj/, 'subdirectory sessions need an explicit anchor')
  assert.match(rooted, /\.trellis\/spec\/guides\/index\.md/)
  // Without a root the line still renders (never undefined/null in the prompt).
  const bare = formatSpecIndexInstruction(['guides/index.md'])
  assert.ok(bare)
  assert.doesNotMatch(bare, /undefined|null/)
  // A prefix index must not read like a complete one.
  assert.match(bare, /glob/)
})

test('SPEC_INDEX_SECTION is harness-safe and appendSpecInstruction appends once', () => {
  assert.equal(typeof SPEC_INDEX_SECTION, 'string')
  assert.ok(SPEC_INDEX_SECTION.length > 0)

  const input = [{ name: 'persona', text: 'p' }]
  const once = appendSpecInstruction(input, 'INDEX TEXT')
  assert.equal(input.length, 1, 'input must not be mutated')
  assert.equal(once.length, 2)
  const section = once.at(-1)
  // The harness assembly invariant: non-empty unique name + string text.
  assert.equal(section.name, SPEC_INDEX_SECTION)
  assert.equal(typeof section.text, 'string')

  const twice = appendSpecInstruction(once, 'V2')
  assert.equal(twice.filter((s) => s.name === SPEC_INDEX_SECTION).length, 1)
  assert.equal(twice.at(-1).text, 'V2')
})

test('appendSpecInstruction returns null when there is nothing to index', () => {
  assert.equal(appendSpecInstruction([], null), null)
  assert.equal(appendSpecInstruction([], undefined), null)
  assert.equal(appendSpecInstruction([], ''), null)
  assert.equal(appendSpecInstruction([], '   '), null)
  assert.equal(appendSpecInstruction(null, 'X'), null)
  assert.equal(appendSpecInstruction(undefined, 'X'), null)
})

test('spec index coexists with the read-only section in every authorization phase', () => {
  for (const phase of ['no_task', 'planning', 'planning-inline', 'in_progress', 'completed']) {
    const withSpec = appendSpecInstruction([{ name: 'persona', text: 'p' }], 'INDEX')
    const assembled = appendReadonlyInstruction(withSpec, phase, false) ?? withSpec
    const names = assembled.map((s) => s.name)
    assert.equal(names.filter((n) => n === SPEC_INDEX_SECTION).length, 1, `${phase}: spec index must appear once`)
    const expectedReadonly = phase === 'no_task' || phase === 'planning' || phase === 'planning-inline'
    assert.equal(
      names.filter((n) => n === READONLY_SECTION).length,
      expectedReadonly ? 1 : 0,
      `${phase}: unexpected read-only section count`,
    )
  }
})
