/**
 * Project spec discovery, index rendering, and section assembly.
 *
 * The plugin no longer creates or injects `.trellis/workflow.md`. That file used
 * to be the *only* runtime path that told the model a project carries
 * `.trellis/spec/` engineering rules, so dropping it silently dropped spec
 * awareness from the prompt. This module restores that awareness without
 * reintroducing the file and without inflating the context window:
 *
 *   index + constraints  -> injected into the system prompt (trellis:spec-index)
 *   spec bodies          -> never injected; the model reads them on demand
 *
 * `listProjectSpecs` is the one place that touches fs. Every failure mode
 * (missing dir, unreadable dir, aborted signal, hostile tree) is fail-open and
 * degrades to "no specs", because a broken spec index must never break a turn.
 *
 * Layout it expects (see skills/trellis-spec-bootstrap/SKILL.md):
 *
 *   .trellis/spec/guides/index.md
 *   .trellis/spec/<package>/<layer>/index.md
 */

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
