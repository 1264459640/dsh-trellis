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

    // Slash normalize
    filePath = filePath.replace(/\\/g, '/')

    results.push({ code, path: filePath })
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
 * Check if the workspace under project root has uncommitted git changes.
 *
 * @param {string} root project root directory
 * @param {object} [options]
 * @param {string[]} [options.ignorePatterns] ignore path prefixes
 * @param {boolean} [options.force] bypass check if true
 * @param {number} [options.timeout] child process timeout in ms (default 2000)
 * @returns {Promise<{ clean: boolean, isGitRepo: boolean, dirtyFiles: string[], error?: string }>}
 */
export function checkGitCleanliness(root, options = {}) {
  if (options.force === true) {
    return Promise.resolve({ clean: true, isGitRepo: true, dirtyFiles: [] })
  }

  const timeout = typeof options.timeout === 'number' ? options.timeout : 2000
  const ignorePatterns = Array.isArray(options.ignorePatterns) ? options.ignorePatterns : DEFAULT_GIT_IGNORES

  return new Promise((resolve) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'],
      { cwd: root, timeout, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          // If not a git repository or git not found, degrade gracefully
          const errStr = String((err && err.message) || '') + String(stderr || '')
          if (
            err.code === 'ENOENT' ||
            errStr.includes('not a git repository') ||
            errStr.includes('fatal: not a git repository') ||
            err.code === 128
          ) {
            return resolve({ clean: true, isGitRepo: false, dirtyFiles: [] })
          }
          // On timeout or unexpected error, resolve with error message but do not hard crash
          if (err.killed || err.signal === 'SIGTERM') {
            return resolve({ clean: true, isGitRepo: true, dirtyFiles: [], warning: 'git status 检查超时，已跳过' })
          }
          return resolve({ clean: true, isGitRepo: false, dirtyFiles: [], warning: `git status 失败: ${errStr}` })
        }

        const entries = parsePorcelainOutput(stdout)
        const dirty = filterDirtyEntries(entries, ignorePatterns)

        if (dirty.length > 0) {
          const dirtyFiles = dirty.map((e) => `${e.code} ${e.path}`)
          return resolve({
            clean: false,
            isGitRepo: true,
            dirtyFiles,
            error:
              `[trellis/git_dirty] 项目工作区存在未提交的修改文件：\n` +
              dirty.map((e) => `  - ${e.code} ${e.path}`).join('\n') +
              `\n\n请先使用 git add / git commit 提交上述修改（或使用 force: true 强制跳过），再完成或归档任务。`,
          })
        }

        return resolve({ clean: true, isGitRepo: true, dirtyFiles: [] })
      },
    )
  })
}
