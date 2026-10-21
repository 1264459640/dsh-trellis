/**
 * Bundled trellis skill provisioning for the trellis workflow trigger.
 *
 * The 15 `trellis-*` skills ship with the package as the authoritative copy,
 * but are NOT registered through `ctx.skills` anymore. Instead the per-turn
 * breadcrumb injection (see lib/index.js) detects whether the project's
 * `.agents/skills/` already carries them — the harness's built-in
 * `dsh-skill-filesystem` provider discovers skills from that project root —
 * and copies the missing skill directories (plus the shared `_templates/`)
 * from the package on first use. Projects with their own copies are left
 * untouched (presence check → skip).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPolicyAllowsWrite } from './archive.js'

const here = path.dirname(fileURLToPath(import.meta.url))
/** Absolute directory of the packaged `skills/` folder (the copy source). */
export const skillsRoot = path.resolve(here, '..', 'skills')

let packageVersion = '0.0.0'
try {
  const pkgPath = path.resolve(here, '..', 'package.json')
  const raw = fs.readFileSync(pkgPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (typeof parsed.version === 'string' && parsed.version) {
    packageVersion = parsed.version
  }
} catch {
  /* fallback */
}
export const PACKAGE_VERSION = packageVersion
export const VERSION_FILE_NAME = '.trellis-version'

/**
 * Project-level template files that are deprecated in this release and must be
 * pruned from existing projects when the plugin runs there (self-healing).
 *
 * Two locations mirror the two copy/init paths:
 *  - `.agents/skills/_templates/...` — copied by ensureProjectSkills below;
 *  - `.trellis/templates/...`        — initialized by createTaskRecord on first
 *    use of a work type (lib/task.js).
 *
 * The list is deliberately hard-coded and relative: pruning NEVER touches any
 * `tasks/` directory (historical artifacts stay intact) and never scans
 * user content — only these exact relative paths are unlinked when present.
 */
export const DEPRECATED_PROJECT_TEMPLATES = [
  path.join('.agents', 'skills', '_templates', 'feat', 'implement.md'),
  path.join('.agents', 'skills', '_templates', 'refactor', 'checklist.yaml'),
  path.join('.trellis', 'templates', 'feat', 'implement.md'),
  path.join('.trellis', 'templates', 'refactor', 'checklist.yaml'),
]

/**
 * Prune deprecated project template files (self-healing migration).
 *
 * The harness fs (ctx.fs) has no delete primitive, so this uses node:fs
 * unlink — a tightly-bounded exception like the archive move: paths are
 * hard-coded relative, validated to sit inside the project root, and fenced by
 * `assertPolicyAllowsWrite` (fail-closed on read-only / outside-workspace
 * policies). Failures never throw into the turn: a prune that cannot run
 * (e.g. read-only sandbox) is skipped silently so breadcrumb injection keeps
 * working; the next writable turn retries.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} [opts] { sandboxPolicy? } resolved per-call policy.
 * @returns {{ pruned: string[], skipped: string[] }}
 */
export async function pruneDeprecatedProjectTemplates(dshFs, root, { sandboxPolicy } = {}) {
  const pruned = []
  const skipped = []
  for (const rel of DEPRECATED_PROJECT_TEMPLATES) {
    const abs = path.join(root, rel)
    try {
      const target = await dshFs.resolve(abs)
      const info = await dshFs.stat(target)
      if (!info) continue
      // Policy fence for the node:fs mutation (fail-closed, mirrors archive).
      try {
        assertPolicyAllowsWrite(sandboxPolicy, rel.replace(/\\/g, '/'), root)
      } catch (err) {
        skipped.push(rel)
        continue
      }
      // unlink takes the real path string, not the resolved fs target object.
      fs.unlinkSync(abs)
      pruned.push(rel)
      console.log(`[trellis] pruned deprecated template: ${rel}`)
    } catch {
      /* absent or unreadable — nothing to prune */
    }
  }
  return { pruned, skipped }
}

/** Bundle id → subdirectory name under skillsRoot (the copy units). */
const SKILL_DIRS = [
  'trellis-start',
  'trellis-brainstorm',
  'trellis-before-dev',
  'trellis-check',
  'trellis-update-spec',
  'trellis-finish-work',
  'trellis-continue',
  'trellis-break-loop',
  'trellis-channel',
  'trellis-meta',
  'trellis-session-insight',
  'trellis-spec-bootstrap',
  'trellis-feat',
  'trellis-issue',
  'trellis-refactor',
]

/**
 * Recursively collect relative file paths under a source directory (node fs —
 * the source is the package's own bundled assets, not the project).
 * @param {string} dir absolute source directory.
 * @param {string} [prefix] accumulated relative prefix.
 * @returns {string[]} relative file paths (forward-slash free; platform sep).
 */
function collectFiles(dir, prefix = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? path.join(prefix, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...collectFiles(path.join(dir, entry.name), rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

/**
 * Ensure the project's `.agents/skills/` carries every bundled trellis skill.
 *
 * Checks the `.trellis-version` marker in the project's `.agents/skills/`:
 *  - Same version: presence check skips existing skills (zero write overhead).
 *  - New version / upgrade / force: overwrites official `SKILL_DIRS` and templates
 *    with the package's latest version (self-updating).
 * Custom skills created by users in `.agents/skills/` remain untouched.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} [opts] { signal?, sandboxPolicy?, force? } forwarded to writes.
 * @returns {Promise<{ copied: string[], updated: string[], present: string[], version: string }>}
 */
export async function ensureProjectSkills(dshFs, root, { signal, sandboxPolicy, force = false } = {}) {
  const targetRoot = path.join(root, '.agents', 'skills')
  const copied = []
  const updated = []
  const present = []

  // Check version record in project
  let installedVersion = null
  try {
    const versionTarget = await dshFs.resolve(path.join(targetRoot, VERSION_FILE_NAME))
    const info = await dshFs.stat(versionTarget)
    if (info) {
      const raw = await dshFs.readText(versionTarget, signal)
      if (typeof raw === 'string') installedVersion = raw.trim()
    }
  } catch {
    /* absent or unreadable */
  }

  const isUpgrade = force || (installedVersion !== PACKAGE_VERSION)

  // One listing decides presence; absent dir → empty (nothing present yet).
  let existing = new Set()
  try {
    const dirTarget = await dshFs.resolve(targetRoot)
    const entries = await dshFs.listDir(dirTarget)
    existing = new Set(entries.map((entry) => entry.name))
  } catch {
    /* .agents/skills absent — treat as empty */
  }

  // 1. Skill directories
  for (const id of SKILL_DIRS) {
    const srcDir = path.join(skillsRoot, id)
    if (!fs.existsSync(srcDir)) continue
    const alreadyExists = existing.has(id)

    if (alreadyExists && !isUpgrade) {
      present.push(id)
      continue
    }

    for (const rel of collectFiles(srcDir)) {
      const t = await dshFs.resolve(path.join(targetRoot, id, rel))
      const content = fs.readFileSync(path.join(srcDir, rel), 'utf8')
      await dshFs.writeText(t, content, undefined, signal, sandboxPolicy)
    }

    if (alreadyExists) {
      updated.push(id)
    } else {
      copied.push(id)
    }
  }

  // 2. Shared artifact templates (`_templates/`), copied file-by-file.
  const tplSrc = path.join(skillsRoot, '_templates')
  if (fs.existsSync(tplSrc)) {
    for (const rel of collectFiles(tplSrc)) {
      const t = await dshFs.resolve(path.join(targetRoot, '_templates', rel))
      if (!isUpgrade) {
        const info = await dshFs.stat(t)
        if (info) continue
      }
      const content = fs.readFileSync(path.join(tplSrc, rel), 'utf8')
      await dshFs.writeText(t, content, undefined, signal, sandboxPolicy)
    }
  }

  // 3. Write/update .trellis-version marker if anything was provisioned or version changed
  if (copied.length > 0 || updated.length > 0 || isUpgrade) {
    try {
      const versionTarget = await dshFs.resolve(path.join(targetRoot, VERSION_FILE_NAME))
      await dshFs.writeText(versionTarget, PACKAGE_VERSION, undefined, signal, sandboxPolicy)
    } catch (err) {
      console.warn(`[${'trellis'}] failed to write .trellis-version:`, err && err.message)
    }
  }

  // 4. Self-healing prune of deprecated templates (implement.md / checklist.yaml)
  try {
    await pruneDeprecatedProjectTemplates(dshFs, root, { sandboxPolicy })
  } catch (error) {
    console.warn(`[${'trellis'}] deprecated-template prune skipped:`, error && error.message)
  }

  return { copied, updated, present, version: PACKAGE_VERSION }
}
