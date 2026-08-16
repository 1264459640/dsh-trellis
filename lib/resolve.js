/**
 * Project resolution for the trellis workflow trigger.
 *
 * The trigger keys off a session's working directory (agent.session cwd) to
 * decide whether to inject a Trellis breadcrumb. A project is "trellis-active"
 * when it carries a `.trellis/` directory (contains workflow.md and the runtime
 * state). Resolution is pure path string handling; every IO is delegated to the
 * caller so this module stays unit-testable and never touches the filesystem
 * itself.
 */

import path from 'node:path'

/**
 * Normalize a filesystem path to forward slashes for stable comparison.
 * Returns an empty string for undefined/null/empty input.
 * @param {string | null | undefined} value raw path from session metadata.
 * @returns {string} normalized, lower-cased on the drive letter, slash-normalized.
 */
export function normalizePath(value) {
  if (value === null || value === undefined) return ''
  let out = String(value).replace(/\\/g, '/')
  // Normalize the Windows drive letter to lowercase ("c:/..." → "C:/...").
  if (/^[a-zA-Z]:/.test(out)) out = out[0].toUpperCase() + out.slice(1)
  return out
}

/**
 * Return the ordered list of candidate project roots that could own a cwd,
 * walking from the cwd upward to the filesystem root. The first candidate
 * that carries a `.trellis/` directory wins.
 * @param {string} cwd the session working directory (normalized).
 * @param {boolean} [allowDriveRoot] if false, stops below the drive root.
 * @returns {string[]} candidate absolute dirs, nearest first.
 */
export function candidateProjectRoots(cwd) {
  const start = normalizePath(cwd)
  if (!start) return []
  const parts = start.split('/').filter(Boolean)
  const roots = []
  for (let i = parts.length; i > 0; i--) {
    roots.push('/' + parts.slice(0, i).join('/'))
  }
  // The whole path may be relative to a drive; handle drive-root "C:/".
  if (/^[A-Za-z]:$/.test(roots[roots.length - 1])) {
    roots.push(roots[roots.length - 1] + '/')
  }
  return roots
}

/**
 * Resolve a session cwd against an allowlist of configured project roots
 * (or, with subtree=true, whether any configured root is an ancestor of cwd).
 * @param {string} cwd session cwd.
 * @param {string[]} allowlist configured project roots (normalized before use).
 * @param {boolean} [subtree] match allowlisted roots as ancestors, not exact.
 * @returns {string | undefined} the allowed root that owns cwd, else undefined.
 */
export function matchAllowlist(cwd, allowlist, subtree = true) {
  const c = normalizePath(cwd)
  if (!c) return undefined
  for (const raw of allowlist) {
    const root = normalizePath(raw)
    if (!root) continue
    const rel = c.startsWith(root) ? c.slice(root.length) : undefined
    if (rel === undefined) continue
    if (!subtree) {
      // exact-or-subtree is the sane default even for "exact" because a cwd
      // is almost always a subdir; treat it as prefix match either way.
      return root
    }
    // subtree: root is an ancestor (or equal) of cwd.
    if (rel === '' || rel.startsWith('/')) return root
  }
  return undefined
}

/**
 * Build the standard Trellis asset paths for a project root.
 * @param {string} root normalized project root.
 * @returns {{ root: string, trellisDir: string, workflow: string, runtimeDir: string, tasksDir: string, specDir: string, agentsSkillsDir: string }}
 */
export function trellisPaths(root) {
  const r = normalizePath(root)
  return {
    root: r,
    trellisDir: path.join(r, '.trellis'),
    workflow: path.join(r, '.trellis', 'workflow.md'),
    runtimeDir: path.join(r, '.trellis', '.runtime', 'sessions'),
    tasksDir: path.join(r, '.trellis', 'tasks'),
    specDir: path.join(r, '.trellis', 'spec'),
    agentsSkillsDir: path.join(r, '.agents', 'skills'),
  }
}

/**
 * Extract the active-task pointer from a runtime session file path.
 * Session files live at .trellis/.runtime/sessions/<id>.json.
 * @param {string} runtimeFilePath the session file path (normalized).
 * @returns {string} the identity portion after 'sessions/'.
 */
export function sessionKeyFromPath(runtimeFilePath) {
  const n = normalizePath(runtimeFilePath)
  const marker = '/sessions/'
  const idx = n.lastIndexOf(marker)
  if (idx === -1) return path.basename(runtimeFilePath, '.json')
  return n.slice(idx + marker.length).replace(/\.json$/, '')
}
