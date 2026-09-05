/**
 * Git repository and workspace cleanliness verification for Trellis workflow guardrails.
 *
 * Provides non-invasive, read-only git status inspection before completing or archiving tasks.
 * Fails gracefully (clean: true, isGitRepo: false) when run outside a git repository or
 * in environments without git.
 */

import { execFile } from 'node:child_process'
import path from 'node:path'

/**
 * Standard paths ignored during git cleanliness checks (Trellis dynamic runtime state).
 */
export const DEFAULT_GIT_IGNORES = [
  '.trellis/.runtime/',
]

/**
 * Normalize a relative file path for stable set comparison (trim, slash, remove leading ./).
 * @param {string} p
 * @returns {string}
 */
export function normalizeRelPath(p) {
  if (!p || typeof p !== 'string') return ''
  let out = p.trim().replace(/\\/g, '/')
  while (out.startsWith('./')) {
    out = out.slice(2)
  }
  return out
}

/**
 * Parse raw `git status --porcelain` output into parsed file changes.
 * Handles paths with quotation marks, spaces, and renaming ("R foo -> bar").
 *
 * @param {string} stdout raw porcelain text
 * @returns {{ code: string, path: string }[]}
 */
export function parsePorcelainOutput(stdout) {
  if (!stdout || typeof stdout !== 'string') return []
  const lines = stdout.split(/\r?\n/)
  const results = []

  for (const line of lines) {
    if (!line || line.length < 3) continue
    const code = line.slice(0, 2)
    let filePath = line.slice(3).trim()

    // Handle renamed files: "R  orig -> new"
    if (filePath.includes(' -> ')) {
      const parts = filePath.split(' -> ')
      filePath = parts[parts.length - 1].trim()
    }

    // Strip wrapping quotes if git returned quoted paths
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1).replace(/\\"/g, '"')
    }

    filePath = normalizeRelPath(filePath)
    if (filePath) {
      results.push({ code, path: filePath })
    }
  }

  return results
}

/**
 * Filter out ignored files (e.g. .trellis/.runtime/**) from the detected dirty files.
 *
 * @param {{ code: string, path: string }[]} entries
 * @param {string[]} [ignorePatterns]
 * @returns {{ code: string, path: string }[]}
 */
export function filterDirtyEntries(entries, ignorePatterns = DEFAULT_GIT_IGNORES) {
  const normalizedIgnores = ignorePatterns.map((p) => p.replace(/\\/g, '/'))
  return entries.filter((entry) => {
    for (const pattern of normalizedIgnores) {
      if (entry.path.startsWith(pattern) || entry.path.includes(pattern)) {
        return false
      }
    }
    return true
  })
}

/**
 * Fetch recently committed changed files from Git history (up to maxCommits).
 * @param {string} root project root directory
 * @param {number} [maxCommits] number of recent commits to inspect (default 20)
 * @param {number} [timeout]
 * @returns {Promise<{ isGitRepo: boolean, committedFiles: Set<string> }>}
 */
export function fetchRecentCommittedFiles(root, maxCommits = 20, timeout = 2000) {
  return new Promise((resolve) => {
    try {
      execFile(
        'git',
        ['-c', 'core.quotepath=false', 'log', `-n`, String(maxCommits), '--name-only', '--format='],
        { cwd: root, timeout, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            const errStr = String((err && err.message) || '') + String(stderr || '')
            if (
              err.code === 'ENOENT' ||
              err.code === 'EPERM' ||
              errStr.includes('not a git repository') ||
              errStr.includes('fatal: not a git repository') ||
              err.code === 128
            ) {
              return resolve({ isGitRepo: false, committedFiles: new Set() })
            }
            return resolve({ isGitRepo: true, committedFiles: new Set() })
          }

          const lines = String(stdout || '').split(/\r?\n/)
          const committedFiles = new Set()
          for (const line of lines) {
            let p = line.trim()
            if (!p) continue
            if (p.startsWith('"') && p.endsWith('"')) {
              p = p.slice(1, -1).replace(/\\"/g, '"')
            }
            p = normalizeRelPath(p)
            if (p) committedFiles.add(p)
          }
          return resolve({ isGitRepo: true, committedFiles })
        },
      )
    } catch {
      return resolve({ isGitRepo: false, committedFiles: new Set() })
    }
  })
}

/**
 * Check if the workspace under project root has uncommitted git changes,
 * and verify that declared modifiedFiles actually exist in recent git commit history.
 *
 * @param {string} root project root directory
 * @param {object} [options]
 * @param {string[]} [options.ignorePatterns] ignore path prefixes
 * @param {string[]} [options.modifiedFiles] list of modified files claimed by the model/task
 * @param {number} [options.timeout] child process timeout in ms (default 2000)
 * @returns {Promise<{ clean: boolean, isGitRepo: boolean, dirtyFiles: string[], uncommittedFiles?: string[], error?: string }>}
 */
export function checkGitCleanliness(root, options = {}) {
  const timeout = typeof options.timeout === 'number' ? options.timeout : 2000
  const ignorePatterns = Array.isArray(options.ignorePatterns) ? options.ignorePatterns : DEFAULT_GIT_IGNORES
  const declaredFiles = Array.isArray(options.modifiedFiles)
    ? options.modifiedFiles.map(normalizeRelPath).filter(Boolean)
    : undefined

  return new Promise((resolve) => {
    try {
      execFile(
        'git',
        ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'],
        { cwd: root, timeout, windowsHide: true },
        async (err, stdout, stderr) => {
          if (err) {
            // If not a git repository or git not found, degrade gracefully
            const errStr = String((err && err.message) || '') + String(stderr || '')
            if (
              err.code === 'ENOENT' ||
              err.code === 'EPERM' ||
              errStr.includes('not a git repository') ||
              errStr.includes('fatal: not a git repository') ||
              err.code === 128
            ) {
              return resolve({ clean: true, isGitRepo: false, dirtyFiles: [], uncommittedFiles: [] })
            }
            // On timeout or unexpected error, resolve with error message but do not hard crash
            if (err.killed || err.signal === 'SIGTERM') {
              return resolve({ clean: true, isGitRepo: true, dirtyFiles: [], uncommittedFiles: [], warning: 'git status 检查超时，已跳过' })
            }
            return resolve({ clean: true, isGitRepo: false, dirtyFiles: [], uncommittedFiles: [], warning: `git status 失败: ${errStr}` })
          }

          // 1. Check workspace uncommitted changes (dirty files)
          const entries = parsePorcelainOutput(stdout)
          const dirty = filterDirtyEntries(entries, ignorePatterns)

          if (dirty.length > 0) {
            const dirtyFiles = dirty.map((e) => `${e.code} ${e.path}`)
            return resolve({
              clean: false,
              isGitRepo: true,
              dirtyFiles,
              uncommittedFiles: [],
              error:
                `[trellis/git_dirty] 项目工作区存在未提交的修改文件：\n` +
                dirty.map((e) => `  - ${e.code} ${e.path}`).join('\n') +
                `\n\n请先使用 git add / git commit 提交上述修改后再完成或归档任务。`,
            })
          }

          // 2. If modifiedFiles was provided and non-empty, verify they were actually committed in git history
          if (declaredFiles && declaredFiles.length > 0) {
            const { isGitRepo, committedFiles } = await fetchRecentCommittedFiles(root, 30, timeout)
            if (isGitRepo) {
              const missingInCommits = declaredFiles.filter((f) => !committedFiles.has(f))
              if (missingInCommits.length > 0) {
                return resolve({
                  clean: false,
                  isGitRepo: true,
                  dirtyFiles: [],
                  uncommittedFiles: missingInCommits,
                  error:
                    `[trellis/git_uncommitted] 声明的修改文件在最近的 Git 提交记录中未找到修改或提交记录：\n` +
                    missingInCommits.map((f) => `  - ${f}`).join('\n') +
                    `\n\n请确认这些文件是否已真正保存并执行 git commit 提交。`,
                })
              }
            }
          }

          return resolve({ clean: true, isGitRepo: true, dirtyFiles: [], uncommittedFiles: [] })
        },
      )
    } catch {
      return resolve({ clean: true, isGitRepo: false, dirtyFiles: [], uncommittedFiles: [] })
    }
  })
}
