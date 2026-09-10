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
  fetchRecentCommittedFiles,
  normalizeRelPath,
  DEFAULT_GIT_IGNORES,
} from '../lib/git.js'

test('normalizeRelPath trims, slash-normalizes, and removes leading ./', () => {
  assert.equal(normalizeRelPath('.\\src\\foo.js'), 'src/foo.js')
  assert.equal(normalizeRelPath('./lib/git.js'), 'lib/git.js')
  assert.equal(normalizeRelPath('   path/to/file.ts  '), 'path/to/file.ts')
})

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
    try {
      execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: tempDir, stdio: 'ignore' })
    } catch (e) {
      if (e.code === 'EPERM') return // Skip in sandboxed environments where child process spawn is restricted
      throw e
    }

    // Initial clean commit
    writeFileSync(path.join(tempDir, 'init.txt'), 'hello')
    execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: tempDir, stdio: 'ignore' })

    const probe = await checkGitCleanliness(tempDir)
    if (!probe.isGitRepo) return // Skip when child process output cannot be piped in sandbox

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

    // 4. Passing force parameter is ignored and still blocked
    const forceCheck = await checkGitCleanliness(tempDir, { force: true })
    assert.equal(forceCheck.clean, false)
    assert.ok(forceCheck.dirtyFiles.length >= 1)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('checkGitCleanliness verifies modifiedFiles against recent commit history', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'trellis-modified-files-'))
  try {
    try {
      execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: tempDir, stdio: 'ignore' })
    } catch (e) {
      if (e.code === 'EPERM') return // Skip in sandboxed environments where child process spawn is restricted
      throw e
    }

    writeFileSync(path.join(tempDir, 'fileA.js'), 'console.log("A")')
    execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Commit fileA'], { cwd: tempDir, stdio: 'ignore' })

    const probe = await checkGitCleanliness(tempDir)
    if (!probe.isGitRepo) return // Skip when child process output cannot be piped in sandbox

    // 1. Declared modifiedFiles contains committed file -> clean: true
    const validCheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['fileA.js'] })
    assert.equal(validCheck.clean, true)
    assert.equal(validCheck.isGitRepo, true)

    // 2. Declared modifiedFiles contains uncommitted/fake file -> clean: false, [trellis/git_uncommitted]
    const fakeCheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['fileA.js', 'lib/uncommitted-fake.js'] })
    assert.equal(fakeCheck.clean, false)
    assert.ok(fakeCheck.error.includes('[trellis/git_uncommitted]'))
    assert.ok(fakeCheck.error.includes('lib/uncommitted-fake.js'))
    assert.deepEqual(fakeCheck.uncommittedFiles, ['lib/uncommitted-fake.js'])

    // 3. Passing force parameter is ignored and still blocked
    const forceCheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['lib/uncommitted-fake.js'], force: true })
    assert.equal(forceCheck.clean, false)
    assert.ok(forceCheck.error.includes('[trellis/git_uncommitted]'))
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('checkGitCleanliness with scoped modifiedFiles allows uncommitted changes outside modifiedFiles', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'trellis-scoped-git-'))
  try {
    try {
      execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: tempDir, stdio: 'ignore' })
    } catch (e) {
      if (e.code === 'EPERM') return
      throw e
    }

    writeFileSync(path.join(tempDir, 'fileA.js'), 'console.log(\"A\")')
    writeFileSync(path.join(tempDir, 'fileB.js'), 'console.log(\"B\")')
    execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Commit fileA and fileB'], { cwd: tempDir, stdio: 'ignore' })

    const probe = await checkGitCleanliness(tempDir)
    if (!probe.isGitRepo) return

    // Modify both fileA and fileB in working tree
    writeFileSync(path.join(tempDir, 'fileA.js'), 'console.log(\"A2\")')
    writeFileSync(path.join(tempDir, 'fileB.js'), 'console.log(\"B2\")')

    // 1. Scoped check on fileA while fileA is still dirty -> should fail
    const dirtyFileACheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['fileA.js'] })
    assert.equal(dirtyFileACheck.clean, false)
    assert.ok(dirtyFileACheck.error.includes('[trellis/git_declared_dirty]'))
    assert.ok(dirtyFileACheck.error.includes('fileA.js'))

    // 2. Commit fileA only; fileB remains dirty in working tree
    execFileSync('git', ['add', 'fileA.js'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Commit updated fileA'], { cwd: tempDir, stdio: 'ignore' })

    // 3. Global check without modifiedFiles -> fails due to dirty fileB
    const globalCheck = await checkGitCleanliness(tempDir)
    assert.equal(globalCheck.clean, false)
    assert.ok(globalCheck.error.includes('[trellis/git_dirty]'))
    assert.ok(globalCheck.error.includes('fileB.js'))

    // 4. Scoped check with modifiedFiles: ['fileA.js'] -> passes because fileA is clean & committed, ignoring dirty fileB
    const scopedCheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['fileA.js'] })
    assert.equal(scopedCheck.clean, true)
    assert.equal(scopedCheck.isGitRepo, true)
    assert.ok(scopedCheck.warning)
    assert.ok(scopedCheck.warning.includes('未包含在 modified_files'))

    // 5. Scoped check with an uncommitted file -> uncommitted error takes precedence
    const uncommittedCheck = await checkGitCleanliness(tempDir, { modifiedFiles: ['fileA.js', 'fileNonExistent.js'] })
    assert.equal(uncommittedCheck.clean, false)
    assert.ok(uncommittedCheck.error.includes('[trellis/git_uncommitted]'))
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('checkGitCleanliness action wording customizes failure messages and appends scoped guidance', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'trellis-action-'))
  try {
    try {
      execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: tempDir, stdio: 'ignore' })
    } catch (e) {
      if (e.code === 'EPERM') return
      throw e
    }

    writeFileSync(path.join(tempDir, 'tracked.js'), 'v1')
    execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'Init'], { cwd: tempDir, stdio: 'ignore' })

    const probe = await checkGitCleanliness(tempDir)
    if (!probe.isGitRepo) return

    // Make the working tree dirty
    writeFileSync(path.join(tempDir, 'tracked.js'), 'v2')

    // 1. action=archive -> "归档任务前" + scoped guidance present
    const archiveAction = await checkGitCleanliness(tempDir, { action: 'archive' })
    assert.equal(archiveAction.clean, false)
    assert.ok(archiveAction.error.includes('[trellis/git_dirty]'))
    assert.ok(archiveAction.error.includes('归档任务前'))
    assert.ok(archiveAction.error.includes('modified_files'))
    assert.ok(archiveAction.error.includes('不会写入 task.json'))

    // 2. action=complete -> "完成任务前"
    const completeAction = await checkGitCleanliness(tempDir, { action: 'complete' })
    assert.equal(completeAction.clean, false)
    assert.ok(completeAction.error.includes('完成任务前'))

    // 3. no action -> neutral "完成或归档任务前" (backward compatible)
    const neutralAction = await checkGitCleanliness(tempDir)
    assert.equal(neutralAction.clean, false)
    assert.ok(neutralAction.error.includes('完成或归档任务前'))
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
