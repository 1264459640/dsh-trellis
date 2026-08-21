/**
 * Task archiving for the trellis workflow trigger (`trellis_task_archive`).
 *
 * The archive half of the create/archive pair (see `lib/task.js`): moves a
 * completed task directory from `.trellis/tasks/<slug>` to
 * `.trellis/tasks/archive/<yyyy-mm>/<slug>`, where `<yyyy-mm>` is the slug's
 * `mm` under the current year — the SAME key `ymKeyFromSlug` (lib/state.js)
 * the kanban board reader (lib/index.js buildBoard) uses, so writing and
 * reading always agree. Legacy slugs without an `mm-dd` segment fall into the
 * `other` bucket (the client's "其他" fallback group).
 *
 * The directory move is performed with `node:fs` (mkdir + atomic rename), NOT
 * `ctx.fs`: the `@deepseek-ai/dsh-fs` FileSystem contract has no
 * move/delete/copy primitive in any released rc (only resolve/stat/lstat/
 * read/stream/list/writeText/editText), and the harness's own model file tools
 * (dsh-tool-fs) expose none either. Copying via ctx.fs would leave a visible
 * duplicate window and break the one-call symmetry with `trellis_task_create`.
 * This is therefore a deliberate, tightly-bounded exception:
 *
 *  - the slug is regex-validated (no path traversal possible) and both source
 *    and target always sit inside `root/.trellis/tasks/` (same drive, so the
 *    rename cannot EXDEV);
 *  - the root comes from the session header cwd matched against the plugin's
 *    allowlist (trusted source, same as create/bind);
 *  - under a confining backend the caller resolves the standing session policy
 *    exactly like the create tool, and `archiveTaskRecord` fail-closes with an
 *    `FS_SANDBOX_DENIED` when the policy would not allow the mutation (read-only
 *    mode, or workspace-write with source/target outside the policy's
 *    workspaceRoot);
 *  - every OTHER write in the operation (session pointer cleanup) still goes
 *    through `ctx.fs` with the per-call sandbox policy.
 *
 * Practically: a task that leaves the active board must also leave the session
 * pointers, so archiving unbinds every `.runtime/sessions/*.json` whose
 * `current_task` referenced the task (archived tasks are read-only and must
 * never stay bound), mirroring create's synchronous pointer bookkeeping.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ymKeyFromSlug } from './state.js'
import { readPointerFile, writePointerFile } from './task.js'
import { checkGitCleanliness } from './git.js'

/** Fallback archive bucket for legacy slugs without an `mm-dd` segment. */
export const ARCHIVE_OTHER_BUCKET = 'other'

/** Slug charset guard shared by validation and the move (filesystem-safe set, no separators). */
export const SLUG_CHARSET = /^[A-Za-z0-9._-]{1,120}$/

/**
 * Build the archive target paths for a task slug. Pure path handling — no IO.
 * @param {string} root normalized project root.
 * @param {string} slug task directory basename (already validated).
 * @param {string | null} ymKey `yyyy-mm` bucket key, or null → `other`.
 * @returns {{ source: string, sourceRel: string, target: string, targetRel: string, bucket: string }}
 */
export function archiveTargetOf(root, slug, ymKey) {
  const bucket = ymKey || ARCHIVE_OTHER_BUCKET
  const source = path.join(root, '.trellis', 'tasks', slug)
  const target = path.join(root, '.trellis', 'tasks', 'archive', bucket, slug)
  return {
    source,
    sourceRel: `.trellis/tasks/${slug}`,
    target,
    targetRel: `.trellis/tasks/archive/${bucket}/${slug}`,
    bucket,
  }
}

/**
 * Validate a task-archive request's shape. Pure decision — no IO. Returns
 * either a normalized args object or an error (mirrors `validateCreateArgs`).
 * @param {object} args the tool's raw arguments.
 * @returns {{ ok: true, args: { slug: string } } | { ok: false, error: string }}
 */
export function validateArchiveArgs(args) {
  const slug = typeof args.slug === 'string' ? args.slug.trim() : ''
  if (!slug) {
    return { ok: false, error: 'slug 不能为空' }
  }
  if (!SLUG_CHARSET.test(slug)) {
    return {
      ok: false,
      error: `slug 仅允许字母数字 . _ - 且 ≤120 字符（当前：${slug}）`,
    }
  }
  const modifiedFiles = Array.isArray(args.modified_files)
    ? args.modified_files.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : undefined
  const { force: _droppedForce, ...safeArgs } = args || {}
  return { ok: true, args: { ...safeArgs, slug, modified_files: modifiedFiles } }
}

/**
 * Canonical containment check (path prefix on normalized separators), mirroring
 * the harness's fs-sandbox `isPathUnder`. `parent` may or may not end with a
 * separator; the comparison is on the whole-segment boundary and both sides are
 * slash-normalized so mixed OS separators (path.join on Windows) cannot break
 * the containment verdict.
 * @param {string} parent normalized parent path.
 * @param {string} child normalized candidate child path.
 * @returns {boolean}
 */
export function isPathUnder(parent, child) {
  const p = String(parent).replace(/\\/g, '/').replace(/[\\/]+$/, '')
  const c = String(child).replace(/\\/g, '/').replace(/[\\/]+$/, '')
  if (c === p) return true
  return c.startsWith(p + '/')
}

/**
 * Fail-closed policy fence for the node:fs move, mirroring the harness's
 * fs-sandbox mutation rules: `read-only` denies every mutation;
 * `workspace-write` allows only when the path canonicalizes under the policy's
 * `workspaceRoot`; `danger-full-access` (or an undefined policy) delegates
 * unfenced. Throws an error carrying `code: 'FS_SANDBOX_DENIED'` so the caller
 * maps it exactly like the harness editor tools.
 * @param {{ mode?: string, workspaceRoot?: string } | undefined} sandboxPolicy
 *   the resolved per-call policy (or undefined for an unsandboxed backend).
 * @param {string} relPath the `.trellis/...` relative path being written.
 * @param {string} root normalized project root (to build the absolute path).
 */
export function assertPolicyAllowsWrite(sandboxPolicy, relPath, root) {
  if (!sandboxPolicy || sandboxPolicy.mode === 'danger-full-access') return
  if (sandboxPolicy.mode === 'read-only') {
    throw Object.assign(
      new Error(`cannot write "${relPath}": file access denied under read-only mode`),
      { code: 'FS_SANDBOX_DENIED' },
    )
  }
  if (sandboxPolicy.mode === 'workspace-write' && typeof sandboxPolicy.workspaceRoot === 'string') {
    const abs = path.join(root, relPath)
    if (!isPathUnder(sandboxPolicy.workspaceRoot, abs)) {
      throw Object.assign(
        new Error(`cannot write "${relPath}": file access denied under workspace-write mode`),
        { code: 'FS_SANDBOX_DENIED' },
      )
    }
  }
}

/**
 * Archive a completed task end-to-end: existence/completion guard, atomic
 * move into `.trellis/tasks/archive/<bucket>/<slug>` (node:fs, policy-fenced
 * above), then unbind every session pointer that referenced the task. All
 * pointer writes go through the caller's `ctx.fs` (sandbox/observation policy
 * applies per write), and the move itself is fail-closed on the session policy.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root (allowlist-matched).
 * @param {object} args normalized archive args (see validateArchiveArgs).
 * @param {object} [exec] tool execution context { signal? }.
 * @param {object} [sandboxPolicy] resolved per-call policy (see assertPolicyAllowsWrite).
 * @param {object} [opts] { now?: Date, year?: number } injected for tests.
 * @returns {Promise<{ ok: true, slug: string, taskDir: string, month: string | null, bucket: string, archivedAt: string, unbound: string[] } | { ok: false, error: string }>}
 */
export async function archiveTaskRecord(dshFs, root, args, exec = {}, sandboxPolicy, opts = {}) {
  const { slug } = args
  const year =
    opts.year !== undefined ? opts.year : (opts.now instanceof Date ? opts.now : new Date()).getFullYear()
  const ymKey = ymKeyFromSlug(slug, year)
  const { source, sourceRel, target, targetRel, bucket } = archiveTargetOf(root, slug, ymKey)

  // 1. Existence + completion guard (mirror create's refuse-to-clobber style).
  let status = null
  try {
    const taskJsonTarget = await dshFs.resolve(path.join(source, 'task.json'))
    const info = await dshFs.stat(taskJsonTarget)
    if (info) {
      const parsed = JSON.parse((await dshFs.readText(taskJsonTarget)).replace(/^\uFEFF/, ''))
      status = parsed && typeof parsed.status === 'string' ? parsed.status : null
    }
  } catch {
    /* absent / unreadable → handled below */
  }
  if (!status) {
    return { ok: false, error: `任务不存在或无 task.json：${sourceRel}/（请先 trellis_task_create）` }
  }
  if (status !== 'completed') {
    return { ok: false, error: `只有 completed 任务才能归档（当前 status=${status}）：${sourceRel}/` }
  }

  // Enforce git cleanliness check before archiving
  const gitCheck = await checkGitCleanliness(root, { modifiedFiles: args.modified_files })
  if (!gitCheck.clean && gitCheck.error) {
    return { ok: false, error: gitCheck.error }
  }

  // 2. Policy fence for the node:fs mutation (fail-closed), then the move.
  assertPolicyAllowsWrite(sandboxPolicy, `${targetRel}`, root)
  assertPolicyAllowsWrite(sandboxPolicy, sourceRel, root)
  const signal = exec.signal
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (fs.existsSync(target)) {
      return { ok: false, error: `归档目标已存在，请勿重复归档：${targetRel}/` }
    }
    fs.renameSync(source, target)
  } catch (error) {
    if (error && error.code === 'FS_SANDBOX_DENIED') throw error
    return {
      ok: false,
      error: `归档移动失败：${error && error.message ? error.message : String(error)}`,
    }
  }
  signal?.throwIfAborted()

  // 3. Unbind every runtime session pointer referencing the archived task
  //    (archived tasks are read-only — never leave them bound).
  const unbound = await unbindPointersTo(dshFs, root, sourceRel, { signal, sandboxPolicy })

  return {
    ok: true,
    slug,
    taskDir: targetRel,
    month: ymKey,
    bucket,
    archivedAt: (opts.now instanceof Date ? opts.now : new Date()).toISOString(),
    unbound,
  }
}

/**
 * Clear `current_task` in every `.runtime/sessions/*.json` whose pointer equals
 * `tasksRel` (the task being archived). Uses the same pointer-file merge
 * semantics as lib/task.js; a broken/absent runtime dir is a no-op.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs ctx.fs.
 * @param {string} root normalized project root.
 * @param {string} tasksRel the archived task's old reference (`.trellis/tasks/<slug>`).
 * @param {object} [opts] { signal?, sandboxPolicy? } forwarded to the pointer write.
 * @returns {Promise<string[]>} the rewritten pointer file basenames.
 */
async function unbindPointersTo(dshFs, root, tasksRel, { signal, sandboxPolicy } = {}) {
  const runtimeDir = path.join(root, '.trellis', '.runtime', 'sessions')
  let entries = []
  try {
    const dirTarget = await dshFs.resolve(runtimeDir)
    entries = await dshFs.listDir(dirTarget)
  } catch {
    return [] // no runtime dir → nothing to unbind
  }
  const unbound = []
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || !entry.name.endsWith('.json')) continue
    try {
      const abs = path.join(runtimeDir, entry.name)
      const parsed = await readPointerFile(dshFs, abs)
      if (!parsed || parsed.current_task !== tasksRel) continue
      await writePointerFile(dshFs, abs, null, { signal, sandboxPolicy })
      unbound.push(entry.name)
    } catch {
      /* keep going: a broken pointer file is left as-is */
    }
  }
  return unbound
}