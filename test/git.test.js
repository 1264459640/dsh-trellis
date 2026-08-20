import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  parsePorcelainOutput,
  filterDirtyEntries,
  checkGitCleanliness,
  DEFAULT_GIT_IGNORES,
} from '../lib/git.js'

test('parsePorcelainOutput parses standard git status lines', () => {
  const sample = ` M lib/task.js\n?? new-file.txt\nD  deleted.js\n R old.js -> new.js\n?? "with space.js"\n`
  const entries = parsePorcelainOutput(sample)
  assert.equal(entries.length, 5)
  assert.deepEqual(entries[0], { code: ' M', path: 'lib/task.js' })
  assert.deepEqual(entries[1], { code: '??', path: 'new-file.txt' })
  assert.deepEqual(entries[2], { code: 'D ', path: 'deleted.js' })
  assert.deepEqual(entries[3], { code: ' R', path: 'new.js' })
  assert.deepEqual(entries[4], { code: '??', path: 'with space.js' })
})

test('filterDirtyEntries excludes default runtime paths', () => {
  const entries = [
    { code: ' M', path: '.trellis/.runtime/sessions/s1.json' },
    { code: '??', path: '.trellis/.runtime/sessions/s2.json' },
    { code: ' M', path: 'src/index.js' },
    { code: '??', path: 'README.md' },
  ]
  const filtered = filterDirtyEntries(entries, DEFAULT_GIT_IGNORES)
  assert.equal(filtered.length, 2)
  assert.deepEqual(filtered.map((e) => e.path), ['src/index.js', 'README.md'])
})

test('checkGitCleanliness in non-git directory returns clean: true, isGitRepo: false', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'trellis-non-git-'))
  try {
    const result = await checkGitCleanliness(tempDir)
    assert.equal(result.clean, true)
    assert.equal(result.isGitRepo, false)
    assert.deepEqual(result.dirtyFiles, [])
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('checkGitCleanliness in git repo: clean, dirty, runtime ignored, force=true', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'trellis-git-repo-'))
  try {
    // Initialize git repo
    execFileSync('git', ['init'], { cwd: tempDir, stdio: 'pipe' })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'pipe' })
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: tempDir, stdio: 'pipe' })

    // Initial clean commit
    writeFileSync(path.join(tempDir, 'init.txt'), 'hello')
    execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'pipe' })
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: tempDir, stdio: 'pipe' })

    // 1. Should be clean
    const cleanCheck = await checkGitCleanliness(tempDir)
    assert.equal(cleanCheck.clean, true)
    assert.equal(cleanCheck.isGitRepo, true)
    assert.deepEqual(cleanCheck.dirtyFiles, [])

    // 2. Add dynamic .trellis/.runtime file (should still be clean because ignored)
    mkdirSync(path.join(tempDir, '.trellis', '.runtime', 'sessions'), { recursive: true })
    writeFileSync(path.join(tempDir, '.trellis', '.runtime', 'sessions', 'session.json'), '{"current_task":"x"}')

    const runtimeCheck = await checkGitCleanliness(tempDir)
    assert.equal(runtimeCheck.clean, true)
    assert.deepEqual(runtimeCheck.dirtyFiles, [])

    // 3. Modify a code file (becomes dirty)
    writeFileSync(path.join(tempDir, 'init.txt'), 'modified content')
    const dirtyCheck = await checkGitCleanliness(tempDir)
    assert.equal(dirtyCheck.clean, false)
    assert.ok(dirtyCheck.dirtyFiles.length >= 1)
    assert.ok(dirtyCheck.error.includes('[trellis/git_dirty]'))
    assert.ok(dirtyCheck.error.includes('init.txt'))

    // 4. force: true bypasses dirty check
    const forceCheck = await checkGitCleanliness(tempDir, { force: true })
    assert.equal(forceCheck.clean, true)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
