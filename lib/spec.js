/**
 * Project spec discovery, index rendering, and section assembly.
 *
 * The plugin no longer creates or injects `.trellis/workflow.md`. That file used
 * to be the *only* runtime path that told the model a project carries
 * `.trellis/spec/` engineering rules, so dropping it silently dropped spec
 * awareness from the prompt. This module restores that awareness without
 * reintroducing the file and without inflating the context window:
 *
 *   doc.json files       -> injected as BODIES (bounded by a byte budget), so the
 *                           model sees the configured rules without a read round-trip
 *   legacy spec tree     -> index + read-first constraint only; bodies stay on disk
 *
 * Filesystem access is centralized in this module. Every failure mode
 * (missing dir, unreadable file, oversized file, aborted signal, hostile tree)
 * is fail-open and degrades gracefully, because a broken spec injection must
 * never break a turn.
 *
 * Entry modes (see skills/trellis-spec-bootstrap/SKILL.md):
 *
 *   no .trellis/doc.json        -> legacy scan of the .trellis/spec Markdown tree
 *   doc.json { files: [...] }   -> strict project-relative Markdown whitelist
 */

import path from 'node:path'
import { trellisPaths } from './resolve.js'

/** Prefix every rendered entry with the project-relative spec root. */
export const SPEC_ROOT_PREFIX = '.trellis/spec/'

/**
 * Fixed section `name` for the injected project-spec index. Must stay unique
 * and non-empty with a string `text` to satisfy the harness assembly invariant
 * (@deepseek-ai/dsh-system-prompt/lib/invariant.js) — same rule as
 * READONLY_SECTION in lib/readonly.js.
 */
export const SPEC_INDEX_SECTION = 'trellis:spec-index'

/**
 * Bounds that keep one assembly pass cheap even on a pathological tree. When
 * the cap is hit the index is a PREFIX, so the rendered text always tells the
 * model how to confirm it has seen everything (grep-style fallback line).
 */
const DEFAULT_MAX_ENTRIES = 40
const DEFAULT_MAX_DEPTH = 4
const DEFAULT_MAX_DIRS = 24

/** Bound the model-facing output of an explicit files whitelist. */
const DEFAULT_MAX_DOC_FILES = 40

/**
 * Byte budgets for body injection. `system-prompt/assemble` runs on EVERY model
 * request, so an unbounded dump would multiply by request count. Files are
 * injected in the configured order: each one is clamped to {@link MAX_DOC_FILE_BYTES},
 * and once {@link MAX_DOC_TOTAL_BYTES} is spent the rest degrade to path-only
 * markers so the model can still `read` them on demand.
 */
export const MAX_DOC_FILE_BYTES = 8 * 1024
export const MAX_DOC_TOTAL_BYTES = 32 * 1024

/**
 * Do not inject a sliver: when less than this many bytes remain, the file is
 * rendered as a path-only marker instead. A 100-byte fragment of a document
 * costs context without carrying any actionable rule.
 */
const MIN_DOC_SLICE_BYTES = 512

/**
 * Whether a probing `type` value names a directory. Backends and test doubles
 * disagree here ('directory' vs 'dir'), so accept both.
 * @param {string | undefined} type
 * @returns {boolean}
 */
function isDirType(type) {
  return type === 'directory' || type === 'dir'
}

/**
 * Classify one directory entry, preferring its advertised `type` and falling
 * back to a `stat` probe (test doubles and some backends omit `type`).
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {{ type?: string, target: any }} entry
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<'file' | 'directory' | 'other'>}
 */
async function kindOf(fs, entry, signal) {
  if (entry.type === 'file') return 'file'
  if (isDirType(entry.type)) return 'directory'
  if (typeof fs.stat !== 'function') return 'other'
  try {
    const info = await fs.stat(entry.target, signal)
    if (!info) return 'other'
    if (info.type === 'file') return 'file'
    if (isDirType(info.type)) return 'directory'
    return 'other'
  } catch {
    return 'other'
  }
}

/**
 * Whether a child target still lives inside the spec root. Guards against a
 * symlinked/junctioned directory (or any backend alias) dragging the index out
 * of `.trellis/spec`. Delegates to the backend's own `contains` when present,
 * and defaults to "inside" for backends/test doubles that do not implement it —
 * the walk is bounded either way, so this can only ever narrow the result.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {any} rootTarget
 * @param {any} childTarget
 * @returns {boolean}
 */
function insideRoot(fs, rootTarget, childTarget) {
  if (typeof fs.contains !== 'function') return true
  try {
    return fs.contains(rootTarget, childTarget) !== false
  } catch {
    return false
  }
}

/**
 * Walk order inside one directory: `index.md` first (it is the entry document
 * that carries the pre-dev checklist), then lexicographic. This is what makes a
 * capped index keep the *governing* files instead of crowding them out with
 * shallow sibling notes.
 * @param {{ name?: string }} a
 * @param {{ name?: string }} b
 * @returns {number}
 */
function compareEntries(a, b) {
  const ai = (a && a.name ? a.name : '').toLowerCase() === 'index.md' ? 0 : 1
  const bi = (b && b.name ? b.name : '').toLowerCase() === 'index.md' ? 0 : 1
  if (ai !== bi) return ai - bi
  const an = a && a.name ? a.name : ''
  const bn = b && b.name ? b.name : ''
  return an < bn ? -1 : an > bn ? 1 : 0
}

/**
 * Order spec paths for rendering: shallow entries first (the broad `guides/`
 * and package-level index files), then lexicographic within a depth.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareSpecPaths(a, b) {
  const ai = a.toLowerCase().endsWith('/index.md') ? 0 : 1
  const bi = b.toLowerCase().endsWith('/index.md') ? 0 : 1
  if (ai !== bi) return ai - bi
  const da = a.split('/').length
  const db = b.split('/').length
  if (da !== db) return da - db
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Walk `.trellis/spec/` and collect `.md` files as paths relative to that
 * directory (forward slashes, dot-directories skipped, bounded breadth/depth).
 * Returns [] for a missing/empty/unreadable/aborted spec root — never throws.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs ctx.fs.
 * @param {string} specDir absolute `.trellis/spec` path.
 * @param {{ maxEntries?: number, maxDepth?: number, maxDirs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<string[]>} sorted relative markdown paths (possibly a prefix).
 */
export async function listProjectSpecs(fs, specDir, options = {}) {
  const {
    maxEntries = DEFAULT_MAX_ENTRIES,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxDirs = DEFAULT_MAX_DIRS,
    signal,
  } = options
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.listDir !== 'function') return []
  if (typeof specDir !== 'string' || specDir === '') return []

  try {
    const rootTarget = await fs.resolve(specDir, signal ? { signal } : undefined)
    const rootInfo = typeof fs.stat === 'function' ? await fs.stat(rootTarget, signal) : undefined
    if (!rootInfo || !isDirType(rootInfo.type)) return []

    const found = []
    const queue = [{ target: rootTarget, segments: [] }]
    let dirsVisited = 0

    // Collect the whole bounded tree first: capping during the walk would let
    // shallow sibling notes crowd out a deeper `index.md`, which is the file
    // that actually governs the work. The breadth cap (maxDirs) still bounds
    // the cost; only the RANKED head is returned.
    while (queue.length > 0 && dirsVisited < maxDirs) {
      signal?.throwIfAborted?.()
      const current = queue.shift()
      dirsVisited += 1
      let entries
      try {
        entries = await fs.listDir(current.target, signal)
      } catch {
        continue
      }
      if (!Array.isArray(entries)) continue
      const ordered = [...entries].sort(compareEntries)

      for (const entry of ordered) {
        if (!entry || typeof entry.name !== 'string') continue
        if (entry.name.startsWith('.')) continue
        if (!insideRoot(fs, rootTarget, entry.target)) continue
        const kind = await kindOf(fs, entry, signal)
        if (kind === 'directory') {
          const segments = [...current.segments, entry.name]
          // `segments.length` counts directories descended; only descend while
          // a file inside would still fit within maxDepth.
          if (segments.length < maxDepth) queue.push({ target: entry.target, segments })
          continue
        }
        if (kind !== 'file') continue
        if (!entry.name.toLowerCase().endsWith('.md')) continue
        found.push([...current.segments, entry.name].join('/'))
      }
    }

    return found.sort(compareSpecPaths).slice(0, maxEntries)
  } catch {
    return []
  }
}

/**
 * Render the model-facing spec index section body, or null when the project
 * carries no specs (in which case the caller injects nothing at all).
 *
 * Deliberately an INDEX, not the bodies: the cost per turn stays a few hundred
 * characters regardless of how much spec text the project accumulates, and the
 * model still has to open the file that actually governs its change.
 *
 * `root` anchors the paths. The plugin matches allowlisted roots as ANCESTORS
 * (lib/resolve.js matchAllowlist subtree mode), so a session cwd can be a
 * package subdirectory — a bare `.trellis/spec/...` path would then resolve
 * against the wrong base and every read would miss.
 *
 * Chinese by design, mirroring READONLY_SECTION's wording policy (PRD: no
 * i18n), even though the builtin breadcrumbs default to English.
 *
 * @param {string[] | null | undefined} specPaths relative paths from listProjectSpecs.
 * @param {{ root?: string | null }} [options] project root used as the path anchor.
 * @returns {string | null}
 */
export function formatSpecIndexInstruction(specPaths, { root = null } = {}) {
  if (!Array.isArray(specPaths)) return null
  const paths = specPaths.filter((p) => typeof p === 'string' && p.trim() !== '')
  if (paths.length === 0) return null

  const anchor = typeof root === 'string' && root !== '' ? `；路径相对项目根 ${root}` : ''
  const lines = [`Trellis 工程规范索引（${SPEC_ROOT_PREFIX} 已沉淀本项目规范${anchor}）：`]
  for (const p of paths) {
    lines.push(`- ${SPEC_ROOT_PREFIX}${p.replace(/^\/+/, '')}`)
  }
  lines.push(
    '使用要求：出方案或动手改码前，先用 read 工具研读与本次改动相关的分层 index.md' +
      '（开发前检查清单 + 质量门禁），细则以它引用的同级文档为准；' +
      '若规范与本轮需求冲突，先向用户说明差异并确认，禁止擅自偏离或静默绕过。' +
      '本清单可能只是前缀，如需确认是否有未列出的规范，用 glob 查看 `.trellis/spec/**/*.md`。',
  )
  return lines.join('\n')
}

/**
 * Append the project-spec index section to an assembled section list.
 * Mirrors `appendReadonlyInstruction`'s conventions: returns null for non-array
 * input or an empty/absent index text (so the caller keeps the original list
 * untouched), otherwise a NEW array with the section at the tail and any
 * pre-existing same-name section dropped (idempotent across repeated
 * assembly passes).
 *
 * @param {Array<{ name?: string, text?: string } | null | undefined> | null | undefined} sections
 *   the section list to append to.
 * @param {string | null | undefined} specInstruction rendered index body.
 * @returns {Array | null} the extended sections list, or null when nothing is indexed.
 */
export function appendSpecInstruction(sections, specInstruction) {
  if (!Array.isArray(sections)) return null
  if (typeof specInstruction !== 'string' || specInstruction.trim() === '') return null
  const rest = sections.filter((s) => !(s && s.name === SPEC_INDEX_SECTION))
  return [...rest, { name: SPEC_INDEX_SECTION, text: specInstruction }]
}

/**
 * Fixed diagnostic injected when `.trellis/doc.json` exists but its `files`
 * whitelist cannot be trusted. It deliberately avoids filesystem details and
 * never falls back to the legacy `.trellis/spec` tree.
 */
export const DOC_CONFIG_ERROR_INSTRUCTION =
  'Trellis 项目文档配置无效：`.trellis/doc.json` 的 files 清单无法加载，当前不会回退读取旧 `.trellis/spec/`。' +
  '请修复该配置，或运行 `trellis-spec-bootstrap` 重新配置后再继续实现。'

/**
 * Normalize one configured project-relative Markdown path. Returns null for
 * anything that could escape the project or denote a non-Markdown target.
 * @param {unknown} value raw `files[]` entry.
 * @returns {string | null}
 */
function normalizeDocFile(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/\\/g, '/')
  if (raw === '' || raw.includes('\u0000')) return null
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return null
  if (raw.split('/').includes('..')) return null
  if (!raw.toLowerCase().endsWith('.md')) return null
  const normalized = path.posix.normalize(raw).replace(/^(\.\/)+/, '')
  if (normalized === '' || normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null
  return normalized
}

/**
 * Validate one normalized files[] entry against the real project tree.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {any} rootTarget resolved project-root target.
 * @param {string} rel normalized project-relative path.
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<string | null>} normalized relative path or null.
 */
async function validateDocFile(fs, projectRoot, rootTarget, rel, signal) {
  const absoluteRoot = path.resolve(projectRoot)
  const absoluteFile = path.resolve(absoluteRoot, rel)
  const within = path.relative(absoluteRoot, absoluteFile).replace(/\\/g, '/')
  if (within === '' || within.startsWith('../') || path.isAbsolute(within)) return null
  try {
    const target = await fs.resolve(absoluteFile, signal ? { signal } : undefined)
    const info = await fs.stat(target, signal)
    if (!info || info.type !== 'file') return null
    if (typeof fs.contains === 'function' && fs.contains(rootTarget, target) === false) return null
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error
    return null
  }
  return within
}

/**
 * Load `.trellis/doc.json` including its `root` metadata field.
 *
 * `files` entries are ALWAYS full project-relative Markdown paths. The optional
 * `root` field is used by Skills for their own document discovery/write paths;
 * it is intentionally ignored by injection and never prefixes or filters files.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {{ configPath?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<{ kind: 'absent' } | { kind: 'files', files: string[], root: string | null } | { kind: 'invalid' }>}
 */
async function loadProjectDocConfig(fs, projectRoot, { configPath, signal } = {}) {
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.stat !== 'function' || typeof fs.readText !== 'function') {
    return { kind: 'absent' }
  }
  if (typeof projectRoot !== 'string' || projectRoot === '') return { kind: 'absent' }
  if (signal?.aborted) return { kind: 'absent' }

  const cfgPath = configPath || trellisPaths(projectRoot).docConfig
  let rootTarget
  try {
    rootTarget = await fs.resolve(projectRoot, signal ? { signal } : undefined)
  } catch {
    return { kind: 'absent' }
  }

  let cfgTarget
  try {
    cfgTarget = await fs.resolve(cfgPath, signal ? { signal } : undefined)
  } catch {
    if (signal?.aborted) return { kind: 'absent' }
    return { kind: 'invalid' }
  }

  let info
  try {
    info = await fs.stat(cfgTarget, signal)
  } catch {
    if (signal?.aborted) return { kind: 'absent' }
    return { kind: 'invalid' }
  }
  if (!info) return { kind: 'absent' }
  if (info.type !== 'file') return { kind: 'invalid' }

  let raw
  try {
    raw = await fs.readText(cfgTarget, signal)
  } catch {
    if (signal?.aborted) return { kind: 'absent' }
    return { kind: 'invalid' }
  }
  if (typeof raw !== 'string' || raw.trim() === '') return { kind: 'invalid' }

  let parsed
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch {
    return { kind: 'invalid' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'invalid' }
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) return { kind: 'invalid' }

  const normalized = []
  const seen = new Set()
  try {
    for (const entry of parsed.files) {
      const rel = normalizeDocFile(entry)
      if (!rel) return { kind: 'invalid' }
      const valid = await validateDocFile(fs, projectRoot, rootTarget, rel, signal)
      if (!valid) return { kind: 'invalid' }
      const dedupeKey = process.platform === 'win32' ? valid.toLowerCase() : valid
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      normalized.push(valid)
    }
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') return { kind: 'absent' }
    return { kind: 'invalid' }
  }
  if (normalized.length === 0) return { kind: 'invalid' }
  const storedRoot = typeof parsed.root === 'string' && parsed.root.trim() !== '' ? parsed.root.trim() : null
  return { kind: 'files', files: normalized, root: storedRoot }
}

/**
 * Read and validate `.trellis/doc.json`.
 *
 * `files` entries are ALWAYS full project-relative Markdown paths. The optional
 * `root` field is used by Skills for their own document discovery/write paths;
 * it is intentionally ignored here and never prefixes or filters injection.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {{ configPath?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<{ kind: 'absent' } | { kind: 'files', files: string[] } | { kind: 'invalid' }>}
 */
export async function readProjectDocConfig(fs, projectRoot, options = {}) {
  const config = await loadProjectDocConfig(fs, projectRoot, options)
  return config.kind === 'files' ? { kind: 'files', files: config.files } : config
}

/**
 * Normalize the optional `root` metadata field. It is Skill metadata only —
 * never prefixes or filters `files` — but it is still stored project-relative
 * so a Skill can join it without escaping the project.
 * @param {unknown} value raw draft value.
 * @returns {{ root: string | null } | { error: 'bad-root' }}
 */
function normalizeDocRoot(value) {
  if (value === undefined || value === null) return { root: null }
  if (typeof value !== 'string') return { error: 'bad-root' }
  const raw = value.trim().replace(/\\/g, '/')
  if (raw === '') return { root: null }
  if (raw.includes('\u0000')) return { error: 'bad-root' }
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return { error: 'bad-root' }
  if (raw.split('/').includes('..')) return { error: 'bad-root' }
  const normalized = path.posix.normalize(raw).replace(/^(\.\/)+/, '').replace(/\/+$/, '')
  if (normalized === '' || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return { error: 'bad-root' }
  }
  return { root: normalized }
}

/**
 * Classify one draft `files[]` entry into a stable machine reason, sharing the
 * injection path rules with {@link normalizeDocFile}.
 * @param {unknown} value raw draft entry.
 * @returns {{ rel: string } | { reason: 'empty' | 'outside' | 'not-markdown' }}
 */
function classifyDocEntry(value) {
  if (typeof value !== 'string') return { reason: 'empty' }
  const raw = value.trim().replace(/\\/g, '/')
  if (raw === '') return { reason: 'empty' }
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || raw.split('/').includes('..')) return { reason: 'outside' }
  const rel = normalizeDocFile(raw)
  if (!rel) return { reason: 'not-markdown' }
  return { rel }
}

/**
 * Validate one draft `doc.json` and plan its injection without writing anything.
 *
 * This is the preview/validation entry point behind the Web editor: it returns
 * EVERY offending entry (not just the first) so the UI can mark each row, and
 * it reuses {@link planDocBudget} so the reported statuses are the ones the
 * prompt will actually produce.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {{ root?: unknown, files?: unknown }} draft
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ ok: true, value: { root: string | null, files: { path: string, bytes: number, status: string }[], budget: { fileMax: number, totalMax: number, usedBytes: number } } }
 *   | { ok: false, error: 'invalid', rootError: 'bad-root' | null, listError: 'empty' | null, details: { index: number, path: string, reason: string }[] }>}
 */
export async function evaluateDocConfig(fs, projectRoot, draft, { signal } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
  const root = normalizeDocRoot(draft ? draft.root : null)
  const rootError = root.error || null
  const rawFiles = draft && Array.isArray(draft.files) ? draft.files : []
  if (rawFiles.length === 0) {
    return { ok: false, error: 'invalid', rootError, listError: 'empty', details: [] }
  }

  const rootTarget = await fs.resolve(projectRoot, signal ? { signal } : undefined)
  const details = []
  const accepted = []
  const seen = new Set()
  for (let index = 0; index < rawFiles.length; index += 1) {
    const source = rawFiles[index]
    const classified = classifyDocEntry(source)
    if (classified.reason) {
      details.push({ index, path: typeof source === 'string' ? source : '', reason: classified.reason })
      continue
    }
    const valid = await validateDocFile(fs, projectRoot, rootTarget, classified.rel, signal)
    if (!valid) {
      details.push({ index, path: classified.rel, reason: 'missing' })
      continue
    }
    const dedupeKey = process.platform === 'win32' ? valid.toLowerCase() : valid
    if (seen.has(dedupeKey)) {
      details.push({ index, path: valid, reason: 'duplicate' })
      continue
    }
    seen.add(dedupeKey)
    accepted.push(valid)
  }

  if (rootError || details.length > 0) {
    return { ok: false, error: 'invalid', rootError, listError: null, details }
  }

  const plan = planDocBudget(await readDocEntries(fs, projectRoot, accepted, signal))
  return {
    ok: true,
    value: {
      root: root.root,
      files: plan.entries.map((entry) => ({ path: entry.path, bytes: entry.bytes, status: entry.status })),
      budget: { fileMax: MAX_DOC_FILE_BYTES, totalMax: MAX_DOC_TOTAL_BYTES, usedBytes: plan.usedBytes },
    },
  }
}

/**
 * Read the Web editor's snapshot of the current project config.
 *
 * Three states mirror {@link readProjectDocConfig}: `absent` also carries the
 * legacy `.trellis/spec` index so the editor can seed a first draft from it.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {{ configPath?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<{ state: 'absent' | 'configured' | 'invalid', root: string | null, files: { path: string, bytes: number, status: string }[], budget: { fileMax: number, totalMax: number, usedBytes: number }, legacy: string[] | null }>}
 */
export async function readDocConfigSnapshot(fs, projectRoot, options = {}) {
  const { signal } = options
  const budget = { fileMax: MAX_DOC_FILE_BYTES, totalMax: MAX_DOC_TOTAL_BYTES, usedBytes: 0 }
  const config = await loadProjectDocConfig(fs, projectRoot, options)
  if (config.kind === 'invalid') {
    return { state: 'invalid', root: null, files: [], budget, legacy: null }
  }
  if (config.kind === 'absent') {
    const legacy = await listProjectSpecs(fs, trellisPaths(projectRoot).specDir, { signal })
    return {
      state: 'absent',
      root: null,
      files: [],
      budget,
      legacy: legacy.map((rel) => `${SPEC_ROOT_PREFIX}${rel}`),
    }
  }
  const plan = planDocBudget(await readDocEntries(fs, projectRoot, config.files, signal))
  return {
    state: 'configured',
    root: config.root,
    files: plan.entries.map((entry) => ({ path: entry.path, bytes: entry.bytes, status: entry.status })),
    budget: { ...budget, usedBytes: plan.usedBytes },
    legacy: null,
  }
}

/**
 * Read the existing config object so unknown top-level fields survive a save.
 * Anything unparseable (the "invalid" state the editor is meant to repair)
 * starts from an empty object; the user is explicitly overwriting it.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} cfgPath absolute `.trellis/doc.json` path.
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<object>}
 */
async function readDocConfigObject(fs, cfgPath, signal) {
  try {
    const target = await fs.resolve(cfgPath, signal ? { signal } : undefined)
    const info = await fs.stat(target, signal)
    if (!info || info.type !== 'file') return {}
    const raw = await fs.readText(target, signal)
    const parsed = JSON.parse(String(raw).replace(/^\uFEFF/, ''))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error
    return {}
  }
}

/**
 * Validate a draft and write it to `.trellis/doc.json`.
 *
 * The write is a plain whole-file replace (UTF-8, no BOM, two-space indent,
 * trailing newline) — the format the Skills already produce. Validation runs
 * first through {@link evaluateDocConfig}, so a rejected draft never reaches
 * the disk.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root.
 * @param {{ root?: unknown, files?: unknown }} draft
 * @param {{ configPath?: string, signal?: AbortSignal, sandboxPolicy?: object }} [options]
 * @returns {Promise<{ ok: true, value: object } | { ok: false, error: 'invalid', rootError: string | null, listError: string | null, details: object[] }>}
 */
export async function saveProjectDocConfig(fs, projectRoot, draft, { configPath, signal, sandboxPolicy } = {}) {
  const evaluation = await evaluateDocConfig(fs, projectRoot, draft, { signal })
  if (!evaluation.ok) return evaluation

  const cfgPath = configPath || trellisPaths(projectRoot).docConfig
  const existing = await readDocConfigObject(fs, cfgPath, signal)
  const payload = { ...existing, files: evaluation.value.files.map((file) => file.path) }
  if (evaluation.value.root) payload.root = evaluation.value.root
  else delete payload.root

  const target = await fs.resolve(cfgPath, signal ? { signal } : undefined)
  await fs.writeText(target, `${JSON.stringify(payload, null, 2)}\n`, undefined, signal, sandboxPolicy)
  return { ok: true, value: await readDocConfigSnapshot(fs, projectRoot, { configPath: cfgPath, signal }) }
}
/**
 * Render a path-only file whitelist. This is the degradation path used when
 * bodies cannot be read at all (unsupported fs surface, every read failed);
 * normal `doc.json` projects get {@link renderDocBodies} instead. Only files
 * appear here; directories are never part of the injection contract.
 * @param {string[] | null | undefined} files project-relative Markdown paths.
 * @param {{ root?: string | null }} [options]
 * @returns {string | null}
 */
export function formatDocFilesInstruction(files, { root = null } = {}) {
  if (!Array.isArray(files)) return null
  const clean = files.filter((file) => typeof file === 'string' && file.trim() !== '')
  if (clean.length === 0) return null
  const anchor = typeof root === 'string' && root !== '' ? `；路径相对项目根 ${root}` : ''
  const lines = [`Trellis 项目文档文件清单（项目配置的注入范围${anchor}）：`]
  const shown = clean.slice(0, DEFAULT_MAX_DOC_FILES)
  for (const file of shown) lines.push(`- ${file.replace(/\\/g, '/')}`)
  if (clean.length > DEFAULT_MAX_DOC_FILES) {
    lines.push(
      `清单共 ${clean.length} 个文件，仅展示前 ${DEFAULT_MAX_DOC_FILES} 个；请缩小 files 或改读项目导航文档。`,
    )
  }
  lines.push(
    '使用要求：出方案或动手改码前，先用 read 工具打开与本次改动相关的文件；' +
      '若清单包含导航文档，先读导航并沿其链接读取具体权威文档。' +
      '若文档与本轮需求冲突，先向用户说明差异并确认，禁止擅自偏离或静默绕过。' +
      '未列入本清单的旧 Spec 不作为本次规范依据。',
  )
  return lines.join('\n')
}

/**
 * Clamp one document body to a UTF-8 byte budget, preferring a line boundary so
 * tables, fenced code blocks and multi-byte characters are not cut mid-token.
 * @param {string} text raw document body.
 * @param {number} maxBytes positive byte budget.
 * @returns {{ text: string, usedBytes: number, truncated: boolean }}
 */
function clampToBytes(text, maxBytes) {
  const fullBytes = Buffer.byteLength(text, 'utf8')
  if (fullBytes <= maxBytes) return { text, usedBytes: fullBytes, truncated: false }
  let cut = Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8')
  // A multi-byte character straddling the cut decodes to U+FFFD; drop it.
  cut = cut.replace(/\uFFFD+$/, '')
  const lastNewline = cut.lastIndexOf('\n')
  // Honour a line boundary only when it keeps most of the budget: one huge line
  // must still be cut instead of being dropped entirely.
  if (lastNewline >= Math.floor(cut.length / 2)) cut = cut.slice(0, lastNewline + 1)
  return { text: cut, usedBytes: Buffer.byteLength(cut, 'utf8'), truncated: true }
}

/**
 * Plan how one ordered document list spends the double byte budget.
 *
 * This is the ONLY budget implementation: the prompt renderer and the Web
 * config preview both consume it, so "what the preview promises" and "what the
 * prompt actually contains" cannot drift. Entries are consumed in order; once
 * fewer than {@link MIN_DOC_SLICE_BYTES} remain, the rest degrade to path-only
 * markers instead of injecting a context-costing sliver.
 *
 * @param {{ path: string, text: string | null }[]} entries document bodies in
 *   configured order; `text === null` marks an unreadable file.
 * @returns {{
 *   usedBytes: number,
 *   entries: { path: string, bytes: number, limit: number, injectedBytes: number,
 *              status: 'full' | 'truncated' | 'over-budget' | 'unreadable',
 *              text: string | null }[]
 * }} the plan; `text` is the clamped body for injectable entries.
 */
export function planDocBudget(entries) {
  const planned = []
  let usedBytes = 0
  for (const entry of Array.isArray(entries) ? entries : []) {
    const rel = entry && typeof entry.path === 'string' ? entry.path : ''
    const text = entry ? entry.text : null
    if (typeof text !== 'string') {
      planned.push({ path: rel, bytes: 0, limit: 0, injectedBytes: 0, status: 'unreadable', text: null })
      continue
    }
    const bytes = Buffer.byteLength(text, 'utf8')
    const remaining = MAX_DOC_TOTAL_BYTES - usedBytes
    if (remaining < MIN_DOC_SLICE_BYTES) {
      planned.push({ path: rel, bytes, limit: 0, injectedBytes: 0, status: 'over-budget', text: null })
      continue
    }
    const limit = Math.min(MAX_DOC_FILE_BYTES, remaining)
    const clamped = clampToBytes(text, limit)
    usedBytes += clamped.usedBytes
    planned.push({
      path: rel,
      bytes,
      limit,
      injectedBytes: clamped.usedBytes,
      status: clamped.truncated ? 'truncated' : 'full',
      text: clamped.text,
    })
  }
  return { usedBytes, entries: planned }
}

/**
 * Read one document per configured path, failing open per file: a missing or
 * unreadable file becomes `text: null` so the caller can render an explicit
 * "read this path" marker instead of dropping the entry silently.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root (path anchor).
 * @param {string[]} files normalized project-relative Markdown paths.
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<{ path: string, text: string | null }[]>}
 */
async function readDocEntries(fs, projectRoot, files, signal) {
  const absoluteRoot = path.resolve(projectRoot)
  const entries = []
  for (const rel of files) {
    let text = null
    try {
      const target = await fs.resolve(path.resolve(absoluteRoot, rel), signal ? { signal } : undefined)
      text = await fs.readText(target, signal)
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error
      text = null
    }
    entries.push({ path: rel, text: typeof text === 'string' ? text : null })
  }
  return entries
}

/**
 * Render configured `doc.json` files as BODIES, bounded by the module budgets.
 *
 * Order is the configured order (priority). Each block is headed by its
 * project-relative path; anything the budget or a read error keeps out of the
 * prompt becomes an explicit marker plus the path, so the model can always
 * `read` the remainder instead of silently assuming it saw everything.
 *
 * Fail-open: a missing/unreadable file degrades only that one entry, and when no
 * body could be read at all the path-only whitelist is rendered instead.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot absolute project root (path anchor).
 * @param {string[]} files normalized project-relative Markdown paths.
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string | null>}
 */
export async function renderDocBodies(fs, projectRoot, files, { signal } = {}) {
  if (!Array.isArray(files)) return null
  const clean = files.filter((file) => typeof file === 'string' && file.trim() !== '')
  if (clean.length === 0) return null
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.readText !== 'function') {
    return formatDocFilesInstruction(clean, { root: projectRoot })
  }

  const absoluteRoot = path.resolve(projectRoot)
  const safe = []
  for (const rel of clean) {
    const absoluteFile = path.resolve(absoluteRoot, rel)
    const within = path.relative(absoluteRoot, absoluteFile).replace(/\\/g, '/')
    if (within === '' || within.startsWith('../') || path.isAbsolute(within)) continue
    safe.push(rel)
  }

  const plan = planDocBudget(await readDocEntries(fs, projectRoot, safe, signal))
  const blocks = []
  let injected = 0

  for (const entry of plan.entries) {
    if (entry.status === 'unreadable') {
      blocks.push(`## 文件：${entry.path}\n（读取失败，未注入正文；请手动 read ${entry.path}）`)
      continue
    }
    if (entry.status === 'over-budget') {
      blocks.push(`## 文件：${entry.path}\n（超出注入预算，未注入正文；完整内容请 read ${entry.path}）`)
      continue
    }

    injected += 1
    let block = `## 文件：${entry.path}\n${entry.text}`
    if (entry.status === 'truncated') {
      const exact = entry.limit / 1024
      const kb = Number.isInteger(exact) ? `${exact}KB` : `${exact.toFixed(1)}KB`
      block +=
        entry.limit < MAX_DOC_FILE_BYTES
          ? `\n\n（超出剩余注入预算，正文已截断至前 ${kb}；完整内容请 read ${entry.path}）`
          : `\n\n（正文已截断，仅注入前 ${kb}；完整内容请 read ${entry.path}）`
    }
    blocks.push(block)
  }

  if (injected === 0) return formatDocFilesInstruction(clean, { root: projectRoot })

  const anchor =
    typeof projectRoot === 'string' && projectRoot !== '' ? `；路径相对项目根 ${projectRoot}` : ''
  return [
    `Trellis 项目文档正文（来自 .trellis/doc.json 的 files${anchor}；单文件上限 8KB，正文合计上限 32KB）：`,
    ...blocks,
    '使用要求：以上为注入时的正文副本，标注"已截断/超出预算/读取失败"的文件必须先 read 对应路径再下结论；文档与本轮需求冲突时先向用户说明差异并确认。',
  ].join('\n\n')
}


/**
 * Resolve the complete `trellis:spec-index` body for one project.
 *
 * No config keeps the legacy index scan. An explicit config renders the listed
 * files as bounded BODIES. Any explicit config error yields a diagnostic and
 * never scans the legacy tree.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} projectRoot
 * @param {{ configPath?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<string | null>}
 */
export async function resolveSpecIndexInstruction(fs, projectRoot, { configPath, signal } = {}) {
  const config = await readProjectDocConfig(fs, projectRoot, { configPath, signal })
  if (config.kind === 'invalid') return DOC_CONFIG_ERROR_INSTRUCTION
  if (config.kind === 'files') return renderDocBodies(fs, projectRoot, config.files, { signal })

  const specPaths = await listProjectSpecs(fs, trellisPaths(projectRoot).specDir, { signal })
  return formatSpecIndexInstruction(specPaths, { root: projectRoot })
}
