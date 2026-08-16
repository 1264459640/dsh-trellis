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

const here = path.dirname(fileURLToPath(import.meta.url))
/** Absolute directory of the packaged `skills/` folder (the copy source). */
export const skillsRoot = path.resolve(here, '..', 'skills')

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
 * Presence check first (the harness filesystem provider already watches this
 * root): a single listing of `.agents/skills/` decides what is already there;
 * missing skill directories and the shared `_templates/` tree are copied from
 * the package. Cheap enough to run every matched turn, and self-healing — a
 * skill deleted from the project is re-provisioned on the next turn. All
 * writes go through the caller's `ctx.fs` with the per-call sandbox policy,
 * so the harness's filesystem skill provider discovers the copied skills as
 * project-level (`source: "project-agents"`).
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} [opts] { signal?, sandboxPolicy? } forwarded to writes.
 * @returns {Promise<{ copied: string[], present: string[] }>} skill ids copied this call / already present.
 */
export async function ensureProjectSkills(dshFs, root, { signal, sandboxPolicy } = {}) {
  const targetRoot = path.join(root, '.agents', 'skills')
  const copied = []
  const present = []

  // One listing decides presence; absent dir → empty (nothing present yet).
  let existing = new Set()
  try {
    const dirTarget = await dshFs.resolve(targetRoot)
    const entries = await dshFs.listDir(dirTarget)
    existing = new Set(entries.map((entry) => entry.name))
  } catch {
    /* .agents/skills absent — treat as empty */
  }

  // 1. Skill directories (directory present → skip; else copy the whole dir).
  for (const id of SKILL_DIRS) {
    const srcDir = path.join(skillsRoot, id)
    if (!fs.existsSync(srcDir)) continue
    if (existing.has(id)) {
      present.push(id)
      continue
    }
    for (const rel of collectFiles(srcDir)) {
      const t = await dshFs.resolve(path.join(targetRoot, id, rel))
      const content = fs.readFileSync(path.join(srcDir, rel), 'utf8')
      await dshFs.writeText(t, content, undefined, signal, sandboxPolicy)
    }
    copied.push(id)
  }

  // 2. Shared artifact templates (`_templates/`), copied file-by-file.
  const tplSrc = path.join(skillsRoot, '_templates')
  if (fs.existsSync(tplSrc)) {
    for (const rel of collectFiles(tplSrc)) {
      const t = await dshFs.resolve(path.join(targetRoot, '_templates', rel))
      const info = await dshFs.stat(t)
      if (info) continue
      const content = fs.readFileSync(path.join(tplSrc, rel), 'utf8')
      await dshFs.writeText(t, content, undefined, signal, sandboxPolicy)
    }
  }

  return { copied, present }
}
