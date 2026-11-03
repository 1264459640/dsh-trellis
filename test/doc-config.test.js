import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, statSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  DOC_CONFIG_ERROR_INSTRUCTION,
  MAX_DOC_FILE_BYTES,
  MAX_DOC_TOTAL_BYTES,
  evaluateDocConfig,
  formatDocFilesInstruction,
  planDocBudget,
  readDocConfigSnapshot,
  readProjectDocConfig,
  resolveSpecIndexInstruction,
  saveProjectDocConfig,
} from '../lib/spec.js'

function mockFs() {
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

function seed(root, rel, content = '# doc\n') {
  const abs = path.join(root, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function writeConfig(root, value) {
  seed(root, '.trellis/doc.json', typeof value === 'string' ? value : JSON.stringify(value))
}

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), 'trellis-doc-config-'))
}

test('no doc.json keeps the legacy .trellis/spec scan', async () => {
  const root = tempRoot()
  try {
    seed(root, '.trellis/spec/guides/index.md')
    seed(root, '.trellis/spec/core/task-engine/index.md')
    assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'absent' })
    const text = await resolveSpecIndexInstruction(mockFs(), root)
    assert.match(text, /\.trellis\/spec\/guides\/index\.md/)
    assert.match(text, /\.trellis\/spec\/core\/task-engine\/index\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('valid files keep order with exact duplicates removed and root is ignored', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/b.md', '# B body\n')
    seed(root, 'docs/a.md', '# A body\n')
    seed(root, '.trellis/spec/legacy.md')
    writeConfig(root, { root: 'docs', files: ['docs/b.md', 'docs/a.md', 'docs/b.md'] })
    assert.deepEqual(await readProjectDocConfig(mockFs(), root), {
      kind: 'files',
      files: ['docs/b.md', 'docs/a.md'],
    })
    const text = await resolveSpecIndexInstruction(mockFs(), root)
    assert.ok(text.indexOf('## 文件：docs/b.md') < text.indexOf('## 文件：docs/a.md'))
    assert.equal(text.split('## 文件：docs/b.md').length - 1, 1)
    assert.match(text, /# B body/)
    assert.match(text, /# A body/)
    assert.doesNotMatch(text, /\.trellis\/spec\/legacy\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('root is Skill-only metadata: changing it does not alter files or allow root filtering', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', '# A\n')
    seed(root, 'other/a.md', '# other\n')
    seed(root, 'GLOSSARY.md', '# glossary\n')
    const files = ['docs/a.md', 'GLOSSARY.md']
    writeConfig(root, { root: 'docs', files })
    const first = await resolveSpecIndexInstruction(mockFs(), root)
    assert.match(first, /## 文件：docs\/a\.md/)
    assert.match(first, /## 文件：GLOSSARY\.md/)

    writeConfig(root, { root: 42, files })
    const second = await resolveSpecIndexInstruction(mockFs(), root)
    assert.equal(second, first)
    assert.doesNotMatch(second, /## 文件：other\/a\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
const invalidCases = [
  ['malformed JSON', 'not json'],
  ['empty files', { files: [] }],
  ['files is not an array', { files: 'a.md' }],
  ['files entry is not a string', { files: [42] }],
  ['absolute file path', { root: 'docs', files: ['C:/outside.md'] }],
  ['file path traversal', { root: 'docs', files: ['../escape.md'] }],
  ['non-Markdown target', { root: 'docs', files: ['docs/a.txt'] }],
  ['missing target', { root: 'docs', files: ['docs/missing.md'] }],
  ['one valid and one missing target', { root: 'docs', files: ['docs/a.md', 'docs/missing.md'] }],




]

for (const [name, config] of invalidCases) {
  test(`invalid explicit config: ${name}`, async () => {
    const root = tempRoot()
    try {
      seed(root, 'docs/a.md')
      seed(root, 'docs/a.txt')
      writeConfig(root, config)
      assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'invalid' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

test('a directory at .trellis/doc.json is invalid, not absent', async () => {
  const root = tempRoot()
  try {
    mkdirSync(path.join(root, '.trellis', 'doc.json'), { recursive: true })
    assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'invalid' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a UTF-8 BOM on doc.json is tolerated', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    seed(root, '.trellis/doc.json', '\uFEFF' + JSON.stringify({ root: 'docs', files: ['docs/a.md'] }))
    assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'files', files: ['docs/a.md'] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an explicitly invalid config yields a diagnostic and never falls back to legacy Specs', async () => {
  const root = tempRoot()
  try {
    seed(root, '.trellis/spec/guides/index.md')
    writeConfig(root, { root: 'docs', files: ['docs/missing.md'] })
    const text = await resolveSpecIndexInstruction(mockFs(), root)
    assert.equal(text, DOC_CONFIG_ERROR_INSTRUCTION)
    assert.match(text, /配置无效/)
    assert.doesNotMatch(text, /\.trellis\/spec\/guides\/index\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a symlinked file escaping the project is rejected', async () => {
  const root = tempRoot()
  const outside = tempRoot()
  try {
    seed(root, '.trellis/doc.json', JSON.stringify({ root: 'docs', files: ['docs/link.md'] }))
    seed(outside, 'secret.md', '# secret\n')
    mkdirSync(path.join(root, 'docs'), { recursive: true })
    try {
      symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'docs', 'link.md'), 'file')
      assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'invalid' })
    } catch {
      const guarded = { ...mockFs(), contains: () => false }
      assert.deepEqual(await readProjectDocConfig(guarded, root), { kind: 'invalid' })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test('formatDocFilesInstruction is the path-only fallback, not document bodies', () => {
  const text = formatDocFilesInstruction(['docs/a.md', 'GLOSSARY.md'], { root: 'E:/proj' })
  assert.ok(text)
  assert.match(text, /- docs\/a\.md/)
  assert.match(text, /- GLOSSARY\.md/)
  assert.match(text, /E:\/proj/)
  assert.match(text, /未列入本清单的旧 Spec/)
  assert.ok(text.length < 800)
  assert.equal(formatDocFilesInstruction([]), null)
  assert.equal(formatDocFilesInstruction(null), null)
})

test('formatDocFilesInstruction bounds large whitelists with an explicit notice', () => {
  const files = Array.from({ length: 45 }, (_, i) => `docs/file-${i}.md`)
  const text = formatDocFilesInstruction(files)
  assert.equal(text.split('\n').filter((line) => line.startsWith('- ')).length, 40)
  assert.match(text, /清单共 45 个文件，仅展示前 40 个/)
  assert.ok(text.length < 1600)
})

test('an aborted signal yields no injection, not a config diagnostic', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    writeConfig(root, { root: 'docs', files: ['docs/a.md'] })
    const controller = new AbortController()
    controller.abort()
    assert.equal(await resolveSpecIndexInstruction(mockFs(), root, { signal: controller.signal }), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a stat failure on an existing doc.json is invalid, not a legacy fallback', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    writeConfig(root, { root: 'docs', files: ['docs/a.md'] })
    const base = mockFs()
    const fs = {
      ...base,
      async stat(target) {
        if (String(target.targetKey).endsWith('doc.json')) throw new Error('EACCES')
        return base.stat(target)
      },
    }
    assert.deepEqual(await readProjectDocConfig(fs, root), { kind: 'invalid' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Windows path-case variants dedupe to one injected file', async () => {
  if (process.platform !== 'win32') return
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    writeConfig(root, { root: 'docs', files: ['docs/a.md', 'Docs/A.md'] })
    assert.deepEqual(await readProjectDocConfig(mockFs(), root), { kind: 'files', files: ['docs/a.md'] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the invalid-config diagnostic is fixed and contains no filesystem detail', () => {
  assert.match(DOC_CONFIG_ERROR_INSTRUCTION, /\.trellis\/doc\.json/)
  assert.doesNotMatch(DOC_CONFIG_ERROR_INSTRUCTION, /E:\/|C:\//)
})

// --- budget planning: the single source of truth for prompt + preview -------

test('planDocBudget keeps full bodies under both budgets in configured order', () => {
  const a = 'a'.repeat(1000)
  const b = 'b'.repeat(2000)
  const plan = planDocBudget([
    { path: 'a.md', text: a },
    { path: 'b.md', text: b },
  ])
  assert.equal(plan.usedBytes, 3000)
  assert.deepEqual(plan.entries.map((entry) => entry.status), ['full', 'full'])
  assert.equal(plan.entries[0].text, a)
  assert.equal(plan.entries[1].bytes, 2000)
})

test('planDocBudget clamps one file to the per-file budget', () => {
  const big = 'x'.repeat(MAX_DOC_FILE_BYTES + 10)
  const plan = planDocBudget([{ path: 'big.md', text: big }])
  assert.equal(plan.entries[0].status, 'truncated')
  assert.equal(plan.entries[0].limit, MAX_DOC_FILE_BYTES)
  assert.ok(Buffer.byteLength(plan.entries[0].text, 'utf8') <= MAX_DOC_FILE_BYTES)
  assert.equal(plan.entries[0].bytes, MAX_DOC_FILE_BYTES + 10)
})

test('planDocBudget degrades to path-only once fewer than 512B remain', () => {
  const chunk = 'y'.repeat(MAX_DOC_FILE_BYTES)
  const full = planDocBudget([
    { path: '1.md', text: chunk },
    { path: '2.md', text: chunk },
    { path: '3.md', text: chunk },
    { path: '4.md', text: chunk },
    { path: '5.md', text: 'z'.repeat(100) },
  ])
  assert.deepEqual(full.entries.map((entry) => entry.status), ['full', 'full', 'full', 'full', 'over-budget'])
  assert.equal(full.usedBytes, MAX_DOC_TOTAL_BYTES)

  // Exactly 512B left: the next file still gets a 512B slice.
  const edge = planDocBudget([
    { path: '1.md', text: chunk },
    { path: '2.md', text: chunk },
    { path: '3.md', text: chunk },
    { path: '4.md', text: 'w'.repeat(MAX_DOC_FILE_BYTES - 512) },
    { path: '5.md', text: 'q'.repeat(1024) },
  ])
  assert.equal(edge.entries[3].status, 'full')
  assert.equal(edge.entries[4].status, 'truncated')
  assert.equal(edge.entries[4].limit, 512)

  // 511B left: a sliver is not worth injecting.
  const sliver = planDocBudget([
    { path: '1.md', text: chunk },
    { path: '2.md', text: chunk },
    { path: '3.md', text: chunk },
    { path: '4.md', text: 'w'.repeat(MAX_DOC_FILE_BYTES - 511) },
    { path: '5.md', text: 'q'.repeat(10) },
  ])
  assert.equal(sliver.entries[4].status, 'over-budget')
})

test('planDocBudget marks unreadable files without spending budget', () => {
  const plan = planDocBudget([
    { path: 'gone.md', text: null },
    { path: 'ok.md', text: 'ok' },
  ])
  assert.deepEqual(plan.entries.map((entry) => entry.status), ['unreadable', 'full'])
  assert.equal(plan.usedBytes, 2)
})

// --- Web config snapshot / validation / write ------------------------------

test('readDocConfigSnapshot reports absent with the legacy index to seed from', async () => {
  const root = tempRoot()
  try {
    seed(root, '.trellis/spec/guides/index.md')
    seed(root, '.trellis/spec/core/task-engine/index.md')
    const snapshot = await readDocConfigSnapshot(mockFs(), root)
    assert.equal(snapshot.state, 'absent')
    assert.deepEqual(snapshot.files, [])
    assert.deepEqual(snapshot.legacy, [
      '.trellis/spec/guides/index.md',
      '.trellis/spec/core/task-engine/index.md',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readDocConfigSnapshot reports configured files, statuses and budget', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(100))
    seed(root, 'docs/big.md', 'b'.repeat(MAX_DOC_FILE_BYTES + 50))
    writeConfig(root, { root: 'docs', files: ['docs/a.md', 'docs/big.md'] })
    const snapshot = await readDocConfigSnapshot(mockFs(), root)
    assert.equal(snapshot.state, 'configured')
    assert.equal(snapshot.root, 'docs')
    assert.deepEqual(snapshot.files.map((file) => file.status), ['full', 'truncated'])
    assert.equal(snapshot.files[0].bytes, 100)
    assert.ok(snapshot.budget.usedBytes > 100)
    assert.equal(snapshot.legacy, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readDocConfigSnapshot reports invalid without falling back to the legacy scan', async () => {
  const root = tempRoot()
  try {
    seed(root, '.trellis/spec/guides/index.md')
    writeConfig(root, '{not json')
    const snapshot = await readDocConfigSnapshot(mockFs(), root)
    assert.equal(snapshot.state, 'invalid')
    assert.equal(snapshot.root, null)
    assert.equal(snapshot.legacy, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('evaluateDocConfig rejects every offending entry with its own reason', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    const result = await evaluateDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['', 'C:/abs.md', '../escape.md', 'docs/a.txt', 'docs/missing.md', 'docs/a.md', 'docs/a.md'],
    })
    assert.equal(result.ok, false)
    assert.equal(result.rootError, null)
    assert.deepEqual(
      result.details.map((detail) => detail.reason),
      ['empty', 'outside', 'outside', 'not-markdown', 'missing', 'duplicate'],
    )
    assert.deepEqual(
      result.details.map((detail) => detail.index),
      [0, 1, 2, 3, 4, 6],
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('evaluateDocConfig validates the root field and rejects an empty list', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    const badRoot = await evaluateDocConfig(mockFs(), root, { root: '../outside', files: ['docs/a.md'] })
    assert.equal(badRoot.ok, false)
    assert.equal(badRoot.rootError, 'bad-root')

    const empty = await evaluateDocConfig(mockFs(), root, { root: '', files: [] })
    assert.equal(empty.ok, false)
    assert.equal(empty.listError, 'empty')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('evaluateDocConfig normalizes a valid draft and plans the real budget', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(4096))
    const result = await evaluateDocConfig(mockFs(), root, { root: ' docs/ ', files: ['./docs/a.md'] })
    assert.equal(result.ok, true)
    assert.equal(result.value.root, 'docs')
    assert.equal(result.value.files[0].path, 'docs/a.md')
    assert.equal(result.value.files[0].status, 'full')
    assert.equal(result.value.budget.usedBytes, 4096)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('saveProjectDocConfig writes stable JSON and preserves unknown fields', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', '# A\n')
    seed(root, '.trellis/doc.json', JSON.stringify({ root: 'old', files: ['docs/a.md'], extra: { keep: true } }))
    const result = await saveProjectDocConfig(mockFs(), root, { root: 'docs', files: ['docs/a.md'] })
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'configured')
    assert.equal(result.value.root, 'docs')

    const text = readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8')
    assert.ok(!text.startsWith('\uFEFF'), 'the saved file must not carry a BOM')
    assert.ok(text.endsWith('\n'), 'the saved file must end with a newline')
    assert.match(text, /"files": \[\n\s+"docs\/a\.md"\n\s+\]/)
    const parsed = JSON.parse(text)
    assert.deepEqual(parsed.extra, { keep: true })
    assert.equal(parsed.root, 'docs')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('saveProjectDocConfig omits an empty root and never writes a rejected draft', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md')
    const saved = await saveProjectDocConfig(mockFs(), root, { root: '', files: ['docs/a.md'] })
    assert.equal(saved.ok, true)
    const parsed = JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8'))
    assert.equal('root' in parsed, false)

    const rejected = await saveProjectDocConfig(mockFs(), root, { root: '', files: ['docs/missing.md'] })
    assert.equal(rejected.ok, false)
    assert.deepEqual(rejected.details.map((detail) => detail.reason), ['missing'])
    const after = JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8'))
    assert.deepEqual(after.files, ['docs/a.md'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
