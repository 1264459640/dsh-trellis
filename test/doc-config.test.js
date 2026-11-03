import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, statSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  DOC_CONFIG_ERROR_INSTRUCTION,
  DEFAULT_DOC_BUDGET,
  evaluateDocConfig,
  formatBudgetKB,
  formatDocFilesInstruction,
  parseBudgetDraft,
  planDocBudget,
  readDocConfigSnapshot,
  readProjectDocConfig,
  renderDocBodies,
  resolveDocBudget,
  resolveSpecIndexInstruction,
  saveProjectDocConfig,
} from '../lib/spec.js'

/** Built-in (unconfigured) byte budget — what the old constants used to be. */
const DEFAULT_FILE_BYTES = DEFAULT_DOC_BUDGET.fileBytes
const DEFAULT_TOTAL_BYTES = DEFAULT_DOC_BUDGET.totalBytes

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
  const big = 'x'.repeat(DEFAULT_FILE_BYTES + 10)
  const plan = planDocBudget([{ path: 'big.md', text: big }])
  assert.equal(plan.entries[0].status, 'truncated')
  assert.equal(plan.entries[0].limit, DEFAULT_FILE_BYTES)
  assert.ok(Buffer.byteLength(plan.entries[0].text, 'utf8') <= DEFAULT_FILE_BYTES)
  assert.equal(plan.entries[0].bytes, DEFAULT_FILE_BYTES + 10)
})

test('planDocBudget degrades to path-only once fewer than 512B remain', () => {
  const chunk = 'y'.repeat(DEFAULT_FILE_BYTES)
  const full = planDocBudget([
    { path: '1.md', text: chunk },
    { path: '2.md', text: chunk },
    { path: '3.md', text: chunk },
    { path: '4.md', text: chunk },
    { path: '5.md', text: 'z'.repeat(100) },
  ])
  assert.deepEqual(full.entries.map((entry) => entry.status), ['full', 'full', 'full', 'full', 'over-budget'])
  assert.equal(full.usedBytes, DEFAULT_TOTAL_BYTES)

  // Exactly 512B left: the next file still gets a 512B slice.
  const edge = planDocBudget([
    { path: '1.md', text: chunk },
    { path: '2.md', text: chunk },
    { path: '3.md', text: chunk },
    { path: '4.md', text: 'w'.repeat(DEFAULT_FILE_BYTES - 512) },
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
    { path: '4.md', text: 'w'.repeat(DEFAULT_FILE_BYTES - 511) },
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
    seed(root, 'docs/big.md', 'b'.repeat(DEFAULT_FILE_BYTES + 50))
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

// --- injection budgets (feat-11-03-configurable-inject-budget) -------------

test('resolveDocBudget prefers the doc.json override, then settings, then the built-in default', () => {
  assert.deepEqual(resolveDocBudget(), { fileBytes: 8192, totalBytes: 32768 })
  assert.deepEqual(resolveDocBudget({ fileKB: 16, totalKB: 64 }), { fileBytes: 16384, totalBytes: 65536 })
  // Each field falls through independently.
  assert.deepEqual(resolveDocBudget({ fileKB: 16, totalKB: 64 }, { fileKB: 4 }), {
    fileBytes: 4096,
    totalBytes: 65536,
  })
  assert.deepEqual(resolveDocBudget({ totalKB: 64 }, { fileKB: 4 }), { fileBytes: 4096, totalBytes: 65536 })
  assert.deepEqual(resolveDocBudget(null, { totalKB: 128 }), { fileBytes: 8192, totalBytes: 131072 })
})

test('resolveDocBudget clamps to the hard caps and treats junk as "not configured"', () => {
  // 10MB-ish inputs clamp to the hard caps instead of blowing the prompt up.
  assert.deepEqual(resolveDocBudget({ fileKB: 10240, totalKB: 10240 }), {
    fileBytes: 128 * 1024,
    totalBytes: 512 * 1024,
  })
  // Junk in the override falls back to the settings value ...
  assert.deepEqual(resolveDocBudget({ fileKB: 16 }, { fileKB: 0 }), { fileBytes: 16384, totalBytes: 32768 })
  // ... and junk in the settings value falls back to the built-in default.
  for (const junk of [0, -5, '16', Number.NaN, Number.POSITIVE_INFINITY, null]) {
    assert.deepEqual(resolveDocBudget({ fileKB: junk, totalKB: junk }), { fileBytes: 8192, totalBytes: 32768 })
  }
  // Below the floor clamps up; fractional KB floors to whole KB.
  assert.deepEqual(resolveDocBudget({ fileKB: 0.5 }), { fileBytes: 1024, totalBytes: 32768 })
  assert.deepEqual(resolveDocBudget({ fileKB: 16.9 }), { fileBytes: 16384, totalBytes: 32768 })
})

test('parseBudgetDraft accepts blank as inherit and reports bad or oversized input', () => {
  assert.deepEqual(parseBudgetDraft(null), { ok: true, budgets: {} })
  assert.deepEqual(parseBudgetDraft({ fileKB: '', totalKB: '   ' }), { ok: true, budgets: {} })
  assert.deepEqual(parseBudgetDraft({ fileKB: '16' }), { ok: true, budgets: { fileKB: 16 } })
  assert.deepEqual(parseBudgetDraft({ fileKB: 16, totalKB: 64 }), { ok: true, budgets: { fileKB: 16, totalKB: 64 } })
  assert.deepEqual(parseBudgetDraft({ fileKB: '128', totalKB: '512' }), {
    ok: true,
    budgets: { fileKB: 128, totalKB: 512 },
  })
  assert.deepEqual(parseBudgetDraft({ fileKB: '129' }), { ok: false, errors: { file: 'too-large', total: null } })
  assert.deepEqual(parseBudgetDraft({ totalKB: '513' }), { ok: false, errors: { file: null, total: 'too-large' } })
  for (const bad of ['0', 'abc', '-1', '1.5', '']) {
    const result = parseBudgetDraft({ fileKB: bad })
    if (bad === '') assert.equal(result.ok, true, 'blank inherits')
    else assert.deepEqual(result.errors, { file: 'bad-number', total: null }, `fileKB=${bad} must be rejected`)
  }
})

test('planDocBudget honours an explicit budget', () => {
  const text = 'x'.repeat(6000)
  const plan = planDocBudget([{ path: 'a.md', text }], { fileBytes: 2048, totalBytes: 1024 * 1024 })
  assert.equal(plan.entries[0].limit, 2048)
  assert.equal(plan.entries[0].status, 'truncated')
  assert.equal(plan.usedBytes, 2048)

  const totalOnly = planDocBudget(
    [
      { path: 'a.md', text: 'a'.repeat(1200) },
      { path: 'b.md', text: 'b'.repeat(1000) },
    ],
    { fileBytes: 8192, totalBytes: 2000 },
  )
  assert.equal(totalOnly.entries[1].status, 'truncated')
  assert.equal(totalOnly.usedBytes, 2000)
})

test('renderDocBodies echoes the effective budget in its header and markers', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/big.md', 'x'.repeat(9000) + '\n')
    const text = await renderDocBodies(mockFs(), root, ['docs/big.md'], { budget: { fileBytes: 4096, totalBytes: 65536 } })
    assert.match(text, /单文件上限 4KB，正文合计上限 64KB/)
    assert.match(text, /正文已截断，仅注入前 4KB/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('evaluateDocConfig applies the draft budget and reports budget errors', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(5000))
    const overridden = await evaluateDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '4' },
    })
    assert.equal(overridden.ok, true)
    assert.deepEqual(overridden.value.budgets, { fileKB: 4 })
    assert.equal(overridden.value.budget.fileMax, 4096)
    assert.equal(overridden.value.files[0].status, 'truncated')
    assert.deepEqual(overridden.value.budgetDefaults, { fileKB: 8, totalKB: 32 })

    const inherited = await evaluateDocConfig(mockFs(), root, { root: 'docs', files: ['docs/a.md'] })
    assert.equal(inherited.value.budgets, null, 'blank budgets are not persisted')
    assert.equal(inherited.value.budget.fileMax, 8192)

    const settingsBudget = await evaluateDocConfig(
      mockFs(),
      root,
      { root: 'docs', files: ['docs/a.md'] },
      { budget: { fileKB: 16, totalKB: 64 } },
    )
    assert.equal(settingsBudget.value.budget.fileMax, 16384)
    assert.deepEqual(settingsBudget.value.budgetDefaults, { fileKB: 16, totalKB: 64 })

    const badBudget = await evaluateDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '129' },
    })
    assert.equal(badBudget.ok, false)
    assert.deepEqual(badBudget.budgetErrors, { file: 'too-large', total: null })
    assert.deepEqual(badBudget.details, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readDocConfigSnapshot echoes the stored budget and the settings default', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(5000))
    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 4 } })
    const snapshot = await readDocConfigSnapshot(mockFs(), root, { budget: { fileKB: 16, totalKB: 64 } })
    assert.deepEqual(snapshot.budgets, { fileKB: 4 })
    assert.deepEqual(snapshot.budgetDefaults, { fileKB: 16, totalKB: 64 })
    assert.equal(snapshot.budget.fileMax, 4096, 'the project override wins over the setting')
    assert.equal(snapshot.budget.totalMax, 65536, 'the untouched total inherits the setting')
    assert.equal(snapshot.files[0].status, 'truncated')

    // A junk stored budget is reported as "not overridden", matching what the
    // resolver will honour.
    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 'huge', totalKB: 0 } })
    const junk = await readDocConfigSnapshot(mockFs(), root, { budget: { fileKB: 16 } })
    assert.equal(junk.budgets, null)
    assert.equal(junk.budget.fileMax, 16384)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('saveProjectDocConfig writes a single override and drops the key when both fields are blank', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', '# A\n')
    const first = await saveProjectDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '16' },
    })
    assert.equal(first.ok, true)
    const firstParsed = JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8'))
    assert.deepEqual(firstParsed.budgets, { fileKB: 16 })
    assert.deepEqual(first.value.budgets, { fileKB: 16 })

    const second = await saveProjectDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '16', totalKB: '64' },
    })
    assert.equal(second.ok, true)
    assert.deepEqual(JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8')).budgets, {
      fileKB: 16,
      totalKB: 64,
    })

    const cleared = await saveProjectDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '', totalKB: '' },
    })
    assert.equal(cleared.ok, true)
    const clearedParsed = JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8'))
    assert.equal('budgets' in clearedParsed, false, 'blank inputs must remove the override')
    assert.deepEqual(clearedParsed.files, ['docs/a.md'])
    assert.equal(cleared.value.budgets, null)

    const rejected = await saveProjectDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { totalKB: '513' },
    })
    assert.equal(rejected.ok, false)
    assert.deepEqual(rejected.budgetErrors, { file: null, total: 'too-large' })
    assert.equal('budgets' in JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a files-only save neither drops nor resurrects a stored budget override', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', '# A\n')
    seed(root, 'docs/b.md', '# B\n')
    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 4 } })

    // No `budgets` key in the draft at all = "not decided" → keep the override.
    const saved = await saveProjectDocConfig(mockFs(), root, { root: 'docs', files: ['docs/b.md'] })
    assert.equal(saved.ok, true)
    const parsed = JSON.parse(readFileSync(path.join(root, '.trellis', 'doc.json'), 'utf8'))
    assert.deepEqual(parsed.budgets, { fileKB: 4 })
    assert.deepEqual(parsed.files, ['docs/b.md'])
    assert.equal(saved.value.budget.fileMax, 4096, 'the preserved override stays in effect')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a preview that says nothing about budgets mirrors the stored override', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(5000))
    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 4 } })

    const silent = await evaluateDocConfig(mockFs(), root, { root: 'docs', files: ['docs/a.md'] })
    assert.equal(silent.ok, true)
    assert.equal(silent.value.budget.fileMax, 4096, 'preview must match the injection, not the setting')
    assert.equal(silent.value.budgets, null, 'but it must not claim the override as its own draft')

    // An explicit clear switches the preview to the settings default.
    const cleared = await evaluateDocConfig(mockFs(), root, {
      root: 'docs',
      files: ['docs/a.md'],
      budgets: { fileKB: '', totalKB: '' },
    })
    assert.equal(cleared.value.budget.fileMax, 8192)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolveDocBudget never lets the per-file cap exceed the total cap', () => {
  // 128/8 would otherwise render 「单文件上限 128KB，正文合计上限 8KB」.
  assert.deepEqual(resolveDocBudget({ fileKB: 128, totalKB: 8 }), { fileBytes: 8192, totalBytes: 8192 })
  assert.deepEqual(resolveDocBudget({ fileKB: 64, totalKB: 16 }), { fileBytes: 16384, totalBytes: 16384 })
  assert.deepEqual(resolveDocBudget({ fileKB: 16, totalKB: 64 }), { fileBytes: 16384, totalBytes: 65536 })
})

test('the snapshot echoes a CLAMPED override so the editor cannot prefill an invalid row', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(5000))
    // Hand-written values the resolver honours but the input validator would
    // otherwise reject: 1024KB clamps to the 128KB hard cap AND to the 64KB
    // total; 4.5KB floors. The echo must be the value actually injected.
    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 1024 } })
    const clamped = await readDocConfigSnapshot(mockFs(), root, { budget: { fileKB: 16, totalKB: 64 } })
    assert.deepEqual(clamped.budgets, { fileKB: 64 })
    assert.equal(clamped.budget.fileMax, 64 * 1024)
    assert.equal(parseBudgetDraft({ fileKB: String(clamped.budgets.fileKB) }).ok, true, 'the prefill must validate')

    writeConfig(root, { root: 'docs', files: ['docs/a.md'], budgets: { fileKB: 4.5 } })
    const floored = await readDocConfigSnapshot(mockFs(), root)
    assert.deepEqual(floored.budgets, { fileKB: 4 })
    assert.equal(floored.budget.fileMax, 4096)
    assert.equal(parseBudgetDraft({ fileKB: String(floored.budgets.fileKB) }).ok, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('file entries carry the limit that was actually applied', async () => {
  const root = tempRoot()
  try {
    seed(root, 'docs/a.md', 'a'.repeat(6000))
    seed(root, 'docs/b.md', 'b'.repeat(6000))
    writeConfig(root, { root: 'docs', files: ['docs/a.md', 'docs/b.md'], budgets: { totalKB: 10 } })
    const snapshot = await readDocConfigSnapshot(mockFs(), root)
    assert.deepEqual(snapshot.files.map((file) => file.status), ['full', 'truncated'])
    assert.equal(snapshot.files[1].limit, 10240 - 6000, 'the second file is cut by what is left of the total')
    assert.equal(snapshot.files[1].injectedBytes, 4240)

    const preview = await evaluateDocConfig(mockFs(), root, { root: 'docs', files: ['docs/a.md', 'docs/b.md'] })
    assert.equal(preview.value.files[1].limit, snapshot.files[1].limit, 'preview and snapshot agree on the applied limit')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('formatBudgetKB floors instead of rounding up and keeps sub-KB in bytes', () => {
  assert.equal(formatBudgetKB(8192), '8KB')
  assert.equal(formatBudgetKB(4096), '4KB')
  assert.equal(formatBudgetKB(5000), '4.8KB')
  assert.equal(formatBudgetKB(1000), '1000B')
  assert.equal(formatBudgetKB(1100), '1KB')
  assert.equal(formatBudgetKB(0), '0B')
})
