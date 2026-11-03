import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, statSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  DOC_CONFIG_ERROR_INSTRUCTION,
  formatDocFilesInstruction,
  readProjectDocConfig,
  resolveSpecIndexInstruction,
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
