/**
 * trellis-workflow — self-contained Trellis workflow trigger for DSH.
 *
 * A static Cordis plugin (loaded by the profile's plugin loader, not the
 * dynamic-cordis sandbox). It:
 *
 *  1. subscribes to the per-turn `agent/pre-step` waterfall, resolves the
 *     session's project by cwd, reads that project's `.trellis` runtime state
 *     (session file → active task → status → phase) and workflow.md breadcrumb,
 *     and injects a user-role breadcrumb message into the turn — the same shape
 *     `@deepseek-ai/dsh-agent-instructions` uses, scoped to an allowlist so it
 *     is effectively workspace-level;
 *  2. provisions the 15 `trellis-*` skills into the project's `.agents/skills/`
 *     on session start (presence check → skip, absent → copy from the package);
 *     skills are NOT registered through `ctx.skills` — the harness's built-in
 *     `dsh-skill-filesystem` provider loads them from the project root;
 *  3. registers diagnostic and task management tools (`trellis_state`,
 *     `trellis_task_create`, `trellis_task_update`, `trellis_task_archive`);
 *  4. validates the active task slug (`<work-type>-<mm-dd>-<name>`, see
 *     `skills/_templates/work-types.md`) and surfaces a warning in both the
 *     per-turn breadcrumb and `trellis_state` when it does not conform.
 *
 * No Trellis AGPL source is vendored; workflow semantics are rewritten.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import path from 'node:path'
import { NAME, SCHEMA, SOURCE_KIND, API_PREFIX } from './meta.js'
import { normalizePath, matchAllowlist, trellisPaths } from './resolve.js'
import {
  activeTaskFromSession,
  activeTaskForSession,
  activeTaskPointer,
  taskSummaryOf,
  phaseFor,
  composeBreadcrumb,
  validateSlug,
  ymKeyFromSlug,
  stageOnTrack,
  fallbackStage,
} from './state.js'
import { shouldSkip, buildBreadcrumbMessage } from './breadcrumb.js'
import { ensureProjectSkills } from './skills.js'
import { registerTrellisSettings } from './settings.js'
import { isTrustedApiRequest } from './trust.js'
import {
  validateCreateArgs,
  createTaskRecord,
  validateUpdateArgs,
  updateTaskRecord,
  bindTaskPointer,
  unbindTaskPointer,
  sessionFileBasename,
} from './task.js'
import { validateArchiveArgs, archiveTaskRecord } from './archive.js'
import { buildBoard, invalidateArchiveBucket, clearArchiveCache } from './board.js'

/**
 * Extract the plain text from a message's content blocks (or a plain string)
 * so escape-hatch matching sees the user's actual words.
 * @param {unknown} message the last message of the turn.
 * @returns {string}
 */
function extractMessageText(message) {
  if (!message) return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b.text === 'string' ? b.text : ''))
      .join('\n')
      .trim()
  }
  return ''
}

/**
 * Read an absolute-path UTF-8 text file that may not exist.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs ctx.fs.
 * @param {string} absPath absolute file path.
 * @returns {Promise<string | undefined>}
 */
async function readOptionalText(fs, absPath) {
  try {
    const target = await fs.resolve(absPath)
    const info = await fs.stat(target)
    if (!info) return undefined
    return await fs.readText(target)
  } catch {
    return undefined
  }
}

/**
 * Resolve the Trellis phase + breadcrumb for a project root.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} root normalized project root.
 * @param {boolean} inline codex-inline dispatch flag.
 * @param {string | undefined} [sessionId] live session id; when present the
 *   active task resolves through THAT session's own pointer file first
 *   (explicit bind/unbind state), falling back to the canonical-preferring
 *   project-wide pick for legacy sessions without a pointer file.
 */
async function resolveProjectState(fs, root, inline = false, sessionId = undefined) {
  const p = trellisPaths(root)

  // 1. Deterministic runtime session pick: the exact `dsh-session.json` wins
  //    when it carries a current_task; otherwise the lexically-first file that
  //    does. No mtime anywhere — FsInfo exposes none (see lib/state.js).
  //    With a session id, that session's own pointer file is authoritative
  //    when present (activeTaskForSession), so parallel sessions can each bind
  //    their own task without clobbering one another.
  let activeTask = null
  try {
    const dirTarget = await fs.resolve(p.runtimeDir)
    const entries = await fs.listDir(dirTarget)
    const parsed = []
    for (const entry of entries) {
      if (!entry.name || !entry.name.endsWith('.json')) continue
      try {
        const text = await fs.readText(entry.target)
        const { taskDir } = activeTaskFromSession(JSON.parse(text))
        parsed.push({ name: entry.name, taskDir: taskDir || null })
      } catch {
        parsed.push({ name: entry.name, taskDir: null })
      }
    }
    const picked = activeTaskForSession(parsed, sessionId ? sessionFileBasename(sessionId) + '.json' : undefined)
    if (picked) activeTask = picked
  } catch {
    /* no runtime dir */
  }
  let status = null
  let workType = null
  let task = null
  if (activeTask) {
    const norm = activeTask.replace(/\\/g, '/')
    const base = norm.startsWith('.trellis')
      ? root + '/' + norm.replace(/^\.?\//, '')
      : norm
    const taskJson = base.endsWith('/task.json') ? base : base + '/task.json'
    const taskText = await readOptionalText(fs, taskJson)
    if (taskText) {
      try {
        const parsed = JSON.parse(taskText)
        status = typeof parsed.status === 'string' ? parsed.status : null
        workType = parsed && parsed.work && typeof parsed.work.type === 'string' ? parsed.work.type : null
        task = parsed
      } catch {
        /* ignore malformed task.json */
      }
    }
  }

  // 3. Phase + breadcrumb text (project workflow.md → bundled fallback).
  const phase = phaseFor(status, inline)
  const workflow = await readOptionalText(fs, p.workflow)
  const crumb = composeBreadcrumb(phase, { workflow, sourceProject: root })

  // 4. Strict slug check: the task dir must follow `<work-type>-<mm-dd>-<name>`
  //    (see skills/_templates/work-types.md). On failure the warning is
  //    appended to the breadcrumb text so the model sees it every turn.
  let slug = null
  let slugCheck = null
  if (activeTask) {
    slug = activeTask.replace(/\\/g, '/').split('/').filter(Boolean).pop() || null
    slugCheck = slug ? validateSlug(slug, workType) : null
  }
  let text = crumb.text
  if (slugCheck && !slugCheck.valid) {
    text +=
      `\n\n⚠️ Trellis task slug 不合规：当前任务目录为 \`.trellis/tasks/${slug}/\`。` +
      `${slugCheck.reason}；建议 slug 改为 \`${slugCheck.expected}\`。`
  }
  return { phase, activeTask, slug, slugCheck, text, source: crumb.source, task }
}

/**
 * Read a JSON request body with a size cap. Resolves with the parsed value
 * (or null for an empty body); rejects with an Error carrying `statusCode`
 * for oversized / invalid JSON.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit max body bytes.
 * @returns {Promise<any | null>}
 */
function readJsonBody(req, limit = 16384) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn, value) => {
      if (!settled) {
        settled = true
        fn(value)
      }
    }
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        done(reject, Object.assign(new Error('body too large'), { statusCode: 400 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) {
        done(resolve, null)
        return
      }
      try {
        done(resolve, JSON.parse(text))
      } catch {
        done(reject, Object.assign(new Error('invalid json'), { statusCode: 400 }))
      }
    })
    req.on('error', (err) => done(reject, err))
  })
}

/**
 * Write a JSON response. Errors returned by the task-state route never carry
 * paths or underlying error details — only stable status words.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status HTTP status code.
 * @param {object} payload JSON-safe body.
 */
function respondJson(res, status, payload) {
  const text = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

/**
 * Insert-or-bump an entry in a Map, evicting the oldest key past `cap` (LRU).
 * @param {Map<string, unknown>} map
 * @param {string} key
 * @param {unknown} value
 * @param {number} cap
 */
function lruSet(map, key, value, cap) {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  if (map.size > cap) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
}

/** The Cordis plugin. */
export default {
  name: NAME,
  inject: ['fs', 'skills', 'tools'],
  config: SCHEMA,
  apply(ctx, config) {
    // --- effective config: Web Settings namespace layered over entry config ---
    const effectiveConfig = registerTrellisSettings(ctx, config)

    // --- skill provisioning (project-level, not bundled registration) -------
    // Skills ship with the package as the copy source but are NOT registered
    // through ctx.skills: the harness's built-in dsh-skill-filesystem provider
    // discovers skills from the project's `.agents/skills/`. Every matched
    // turn (breadcrumb injection) checks that root with one cheap directory
    // listing and copies any missing trellis-* skill dirs from the package —
    // presence → skip, absent → copy (self-healing: a deleted skill is
    // re-provisioned). Runs inside the pre-step hook so it happens at session
    // start before the model plans a turn.

    // --- diagnostic tool ---------------------------------------------------
    const stateTool = defineTool({
      name: 'trellis_state',
      description:
        'Report the Trellis workflow phase for a project. Reads the project .trellis runtime (active task, status) and workflow.md, like the per-turn breadcrumb. Also validates the active task slug follows `<work-type>-<mm-dd>-<name>` (e.g. feat-01-15-<short-name>).',
      // defineTool expects a ParameterSchemaSpec: an implicit-open property map.
      parameters: {
        cwd: { type: 'string', description: 'Optional absolute project dir. Defaults to the calling session cwd.' },
        inline: { type: 'boolean', description: 'Assume codex-inline dispatch mode. Default false.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project: { type: 'string' },
            phase: { type: 'string' },
            activeTask: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            breadcrumbSource: { type: 'string' },
            matched: { type: 'boolean' },
            slug: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            slugValid: { oneOf: [{ type: 'boolean' }, { type: 'null' }] },
            slugExpected: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            slugReason: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
        render(args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        },
      },
      async execute(args, exec) {
        const cwd = normalizePath(
          args.cwd || (exec.agent && exec.agent.session && exec.agent.session.header.cwd),
        )
        const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
        if (!root) {
          return { project: '', phase: 'no_task', activeTask: null, breadcrumbSource: 'outside-allowlist', matched: false, slug: null, slugValid: null, slugExpected: null, slugReason: null }
        }
        const st = await resolveProjectState(
          ctx.fs,
          root,
          args.inline === true,
          exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
            ? exec.agent.session.id
            : undefined,
        )
        return {
          project: root,
          phase: st.phase,
          activeTask: st.activeTask,
          breadcrumbSource: st.source,
          matched: true,
          slug: st.slug,
          slugValid: st.slugCheck ? st.slugCheck.valid : null,
          slugExpected: st.slugCheck ? st.slugCheck.expected : null,
          slugReason: st.slugCheck ? st.slugCheck.reason : null,
        }
      },
    })
    const disposeTool = ctx.tools.register(stateTool)
    ctx.effect(() => disposeTool)

    // --- task creation tool ------------------------------------------------
    // `trellis_task_create`: create a task AND synchronously bind the runtime
    // session pointer(s) to it, so the breadcrumb / phase / Web chip see the
    // new task immediately without the model hand-writing .runtime session
    // files (the failure mode this tool fixes). Writes go through ctx.fs with
    // the per-call sandbox policy, mirroring the harness's own editor tools.
    const createTool = defineTool({
      name: 'trellis_task_create',
      description:
        'Create a Trellis task in the current project and synchronously bind this session to it: writes `.trellis/tasks/<slug>/task.json` (status=planning), seeds the bundled artifact templates for the work type, initializes `.trellis/templates/` on first use, and updates `.trellis/.runtime/sessions/` `current_task` so the breadcrumb/phase/Web chip resolve the new task immediately. Slug must follow `<work-type>-<mm-dd>-<name>` (e.g. feat-08-15-billing-export); when omitted it is derived from workType + today + name/title. Ask for user consent before creating.',
      parameters: {
        title: { type: 'string', description: 'Task title (required).' },
        workType: { type: 'string', description: 'feat | issue | refactor (required).' },
        slug: { type: 'string', description: 'Optional explicit task slug `<work-type>-<mm-dd>-<name>`; defaults to workType + today + name/title.' },
        name: { type: 'string', description: 'Optional short name used when deriving the slug (defaults to title).' },
        mode: { type: 'string', description: 'quick | standard (default standard).' },
        status: { type: 'string', description: 'planning (default) | in_progress | completed.' },
        stage: { type: 'string', description: 'Optional initial work.stage; defaults to the track head (feat→prd, issue→report, refactor→scan).' },
        description: { type: 'string', description: 'Optional task description.' },
        cwd: { type: 'string', description: 'Optional absolute project dir. Defaults to the calling session cwd.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            error: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            project: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            slug: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            taskDir: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            title: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            status: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            workType: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            stage: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            phase: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            sessionFiles: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
            seeded: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
            initialized: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
          },
        },
        render(args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        },
      },
      async execute(args, exec) {
        const cwd = normalizePath(
          args.cwd || (exec.agent && exec.agent.session && exec.agent.session.header.cwd),
        )
        const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
        if (!root) {
          return { ok: false, error: '项目不在 allowlist 内；请先在 Web 设置或配置里把项目根加入 trellis-workflow.allowlist', project: null, slug: null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, sessionFiles: null, seeded: null, initialized: null }
        }

        const validated = validateCreateArgs(args)
        if (!validated.ok) {
          return { ok: false, error: validated.error, project: root, slug: null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, sessionFiles: null, seeded: null, initialized: null }
        }

        // Per-call sandbox policy, like the harness editor tools (a sandboxing
        // fs needs the session policy so writes fence against the right root).
        const policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get('sandboxPolicy')
        if (ctx.fs.sandboxMode !== void 0 && policy === void 0) {
          throw new Error('trellis_task_create: the mounted filesystem confines but ctx.sandboxPolicy is missing')
        }
        const sandboxPolicy = policy
          ? policy.resolve({ ...(exec.agent === void 0 ? {} : { session: exec.agent.session }) })
          : void 0
        const sessionId =
          exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
            ? exec.agent.session.id
            : void 0

        try {
          const result = await createTaskRecord(ctx.fs, root, validated.args, { signal: exec.signal, sessionId }, sandboxPolicy)
          if (!result.ok) {
            return { ok: false, error: result.error, project: root, slug: null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, sessionFiles: null, seeded: null, initialized: null }
          }
          // Refresh the Web chip cache for this session immediately.
          if (sessionId) {
            const phase = phaseFor(result.taskJson.status, effectiveConfig.get().inline === true)
            lruSet(summaries, sessionId, taskSummaryOf(result.taskJson, { matched: true, phase }), CACHE_LIMIT)
          }
          return {
            ok: true,
            error: null,
            project: root,
            slug: result.slug,
            taskDir: result.taskDir,
            title: result.taskJson.title,
            status: result.taskJson.status,
            workType: result.taskJson.work.type,
            stage: result.taskJson.work.stage,
            phase: phaseFor(result.taskJson.status, effectiveConfig.get().inline === true),
            sessionFiles: result.sessionFiles,
            seeded: result.seeded,
            initialized: result.initialized,
          }
        } catch (error) {
          // Map sandbox denials to the model-facing marker (like the harness
          // editor tools) so the escalation flow stays recognizable.
          if (error && error.code === 'FS_SANDBOX_DENIED') {
            const mode = sandboxPolicy && sandboxPolicy.mode !== void 0 ? sandboxPolicy.mode : 'unknown'
            throw new Error(`[sandbox: file access denied under ${mode} mode]`)
          }
          throw error
        }
      },
    })
    const disposeCreateTool = ctx.tools.register(createTool)
    ctx.effect(() => disposeCreateTool)

    // --- task update tool ----------------------------------------------------
    // `trellis_task_update`: update an existing task's status, stage, mode,
    // title, or description, validate against work type tracks, and refresh
    // the Web UI chip cache immediately.
    const updateTool = defineTool({
      name: 'trellis_task_update',
      description:
        'Update an existing Trellis task in the current project (status, stage, mode, title, description) and synchronously refresh the Web chip cache. If slug is omitted, updates the active task bound to this session. Stage transitions are validated against the task workType track (feat: prd->design->design-review->impl->review->check; issue: report->analyze->fix->fix-note; refactor: scan->design->apply->done).',
      parameters: {
        slug: { type: 'string', description: 'Optional explicit task slug `<work-type>-<mm-dd>-<name>`. Defaults to the active task bound to this session.' },
        status: { type: 'string', description: 'Optional new status: planning | in_progress | completed.' },
        stage: { type: 'string', description: 'Optional new work.stage (validated against the task workType track).' },
        mode: { type: 'string', description: 'Optional execution mode: quick | standard.' },
        title: { type: 'string', description: 'Optional new task title.' },
        description: { type: 'string', description: 'Optional new task description (empty string removes it).' },
        modified_files: { type: 'array', items: { type: 'string' }, description: 'Optional list of modified files for this task.' },
        cwd: { type: 'string', description: 'Optional absolute project dir. Defaults to the calling session cwd.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            error: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            project: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            slug: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            taskDir: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            title: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            status: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            workType: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            stage: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            phase: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            boundSessionFile: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
        render(args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        },
      },
      async execute(args, exec) {
        const cwd = normalizePath(
          args.cwd || (exec.agent && exec.agent.session && exec.agent.session.header.cwd),
        )
        const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
        if (!root) {
          return { ok: false, error: '项目不在 allowlist 内；请先在 Web 设置或配置里把项目根加入 trellis-workflow.allowlist', project: null, slug: null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, boundSessionFile: null }
        }

        const validated = validateUpdateArgs(args)
        if (!validated.ok) {
          return { ok: false, error: validated.error, project: root, slug: null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, boundSessionFile: null }
        }

        const policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get('sandboxPolicy')
        if (ctx.fs.sandboxMode !== void 0 && policy === void 0) {
          throw new Error('trellis_task_update: the mounted filesystem confines but ctx.sandboxPolicy is missing')
        }
        const sandboxPolicy = policy
          ? policy.resolve({ ...(exec.agent === void 0 ? {} : { session: exec.agent.session }) })
          : void 0
        const sessionId =
          exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
            ? exec.agent.session.id
            : void 0

        try {
          const result = await updateTaskRecord(ctx.fs, root, validated.args, { signal: exec.signal, sessionId }, sandboxPolicy)
          if (!result.ok) {
            return { ok: false, error: result.error, project: root, slug: validated.args.slug || null, taskDir: null, title: null, status: null, workType: null, stage: null, phase: null, boundSessionFile: null }
          }
          // Refresh the Web chip cache for this session immediately.
          if (sessionId) {
            const phase = phaseFor(result.taskJson.status, effectiveConfig.get().inline === true)
            lruSet(summaries, sessionId, taskSummaryOf(result.taskJson, { matched: true, phase }), CACHE_LIMIT)
          }
          return {
            ok: true,
            error: null,
            project: root,
            slug: result.slug,
            taskDir: result.taskDir,
            title: result.taskJson.title || null,
            status: result.taskJson.status || null,
            workType: (result.taskJson.work && result.taskJson.work.type) || null,
            stage: (result.taskJson.work && result.taskJson.work.stage) || null,
            phase: phaseFor(result.taskJson.status, effectiveConfig.get().inline === true),
            boundSessionFile: result.boundSessionFile || null,
          }
        } catch (error) {
          if (error && error.code === 'FS_SANDBOX_DENIED') {
            const mode = sandboxPolicy && sandboxPolicy.mode !== void 0 ? sandboxPolicy.mode : 'unknown'
            throw new Error(`[sandbox: file access denied under ${mode} mode]`)
          }
          throw error
        }
      },
    })
    const disposeUpdateTool = ctx.tools.register(updateTool)
    ctx.effect(() => disposeUpdateTool)

    // --- Web UI task-phase chip: read-only cache route + refresh tool -------
    // Mounted via ctx.inject (sub-fiber) so a profile without webServer /
    // sessions (e.g. headless) leaves the breadcrumb, skills and trellis_state
    // on the main fiber untouched — see design.md risk section.
    const summaries = new Map()
    const CACHE_LIMIT = 128
    const TASK_STATE_PATH = `${API_PREFIX}/task-state`
    const BOARD_PATH = `${API_PREFIX}/board`
    const BIND_PATH = `${API_PREFIX}/bind`

    // --- task archive tool --------------------------------------------------
    // `trellis_task_archive` is the archive half of `trellis_task_create`:
    // one call moves a completed task dir into `.trellis/tasks/archive/
    // <yyyy-mm>/` (month key = slug month + current year, the SAME helper the
    // board reader uses) and unbinds every session that had it bound. The
    // directory move itself is a documented node:fs exception (dsh-fs has no
    // move/delete primitive — see lib/archive.js); it is fail-closed on the
    // session's sandbox policy and every other write stays on ctx.fs.
    const archiveTool = defineTool({
      name: 'trellis_task_archive',
      description:
        'Archive a completed Trellis task in the current project: moves `.trellis/tasks/<slug>` to `.trellis/tasks/archive/<yyyy-mm>/<slug>` (month key = the slug\'s `mm` + the current year, shared with the kanban board reader so writing and reading always agree; legacy slugs without an `mm-dd` segment go to the `other` bucket), and unbinds every session that had the task bound (archived tasks are read-only). The task must exist and have `status=completed`. Ask for user consent before archiving.',
      parameters: {
        slug: { type: 'string', description: 'Task slug `<work-type>-<mm-dd>-<name>` to archive (must be completed).' },
        modified_files: { type: 'array', items: { type: 'string' }, description: 'Optional list of modified files for this task.' },
        cwd: { type: 'string', description: 'Optional absolute project dir. Defaults to the calling session cwd.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            error: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            project: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            slug: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            taskDir: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            month: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            bucket: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            archivedAt: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            unbound: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
          },
        },
        render(args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        },
      },
      async execute(args, exec) {
        const cwd = normalizePath(
          args.cwd || (exec.agent && exec.agent.session && exec.agent.session.header.cwd),
        )
        const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
        if (!root) {
          return { ok: false, error: '项目不在 allowlist 内；请先在 Web 设置或配置里把项目根加入 trellis-workflow.allowlist', project: null, slug: null, taskDir: null, month: null, bucket: null, archivedAt: null, unbound: null }
        }

        const validated = validateArchiveArgs(args)
        if (!validated.ok) {
          return { ok: false, error: validated.error, project: root, slug: null, taskDir: null, month: null, bucket: null, archivedAt: null, unbound: null }
        }

        // Per-call sandbox policy, identical to the create tool; the archive
        // move is node:fs so the policy fence lives in lib/archive.js.
        const policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get('sandboxPolicy')
        if (ctx.fs.sandboxMode !== void 0 && policy === void 0) {
          throw new Error('trellis_task_archive: the mounted filesystem confines but ctx.sandboxPolicy is missing')
        }
        const sandboxPolicy = policy
          ? policy.resolve({ ...(exec.agent === void 0 ? {} : { session: exec.agent.session }) })
          : void 0
        const sessionId =
          exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
            ? exec.agent.session.id
            : void 0

        try {
          const result = await archiveTaskRecord(ctx.fs, root, validated.args, { signal: exec.signal }, sandboxPolicy)
          if (!result.ok) {
            return { ok: false, error: result.error, project: root, slug: validated.args.slug, taskDir: null, month: null, bucket: null, archivedAt: null, unbound: null }
          }
          // The archived task is read-only and may no longer be bound — drop
          // the session's cached chip summary so the next fetch resolves fresh
          // (the task-state route refetches on cache miss), and invalidate
          // the bucket's archive cache.
          if (sessionId) summaries.delete(sessionId)
          if (result.bucket) invalidateArchiveBucket(root, result.bucket)
          return {
            ok: true,
            error: null,
            project: root,
            slug: result.slug,
            taskDir: result.taskDir,
            month: result.month,
            bucket: result.bucket,
            archivedAt: result.archivedAt,
            unbound: result.unbound,
          }
        } catch (error) {
          // Map sandbox denials to the model-facing marker (like the harness
          // editor tools) so the escalation flow stays recognizable.
          if (error && error.code === 'FS_SANDBOX_DENIED') {
            const mode = sandboxPolicy && sandboxPolicy.mode !== void 0 ? sandboxPolicy.mode : 'unknown'
            throw new Error(`[sandbox: file access denied under ${mode} mode]`)
          }
          throw error
        }
      },
    })
    const disposeArchiveTool = ctx.tools.register(archiveTool)
    ctx.effect(() => disposeArchiveTool)

    ctx.inject(['webServer', 'sessions'], (web) => {
      /**
       * Resolve the current project summary for a session. The cwd comes from
       * the session header (trusted source) — never from the request or the
       * model. Writes nothing; the caller caches the result.
       * @param {string} sessionId live session id.
       * @param {boolean} [inline] codex-inline dispatch flag.
       * @returns {Promise<object>} path-free summary.
       */
      const refreshSummary = async (sessionId, inline = false) => {
        const session = web.sessions.get(sessionId)
        const cwd = normalizePath(session && session.header ? session.header.cwd : undefined)
        const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
        if (!root) return { kind: 'no-match', phase: 'no_task' }
        const st = await resolveProjectState(web.fs, root, inline, sessionId)
        return taskSummaryOf(st.task, { matched: true, phase: st.phase })
      }

      // Same-origin read-only route: reads the cache only, never touches the
      // filesystem or re-resolves project state on a browser request.
      const disposeRoute = web.webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: async (req, res) => {
          try {
            // Trust fence first (design contract), then method + shape checks.
            if (!isTrustedApiRequest(req.headers)) {
              respondJson(res, 403, { ok: false, error: 'forbidden' })
              return
            }
            if (req.method !== 'POST') {
              respondJson(res, 405, { ok: false, error: 'method not allowed' })
              return
            }
            let pathname = '/'
            try {
              pathname = new URL(req.url || '/', 'http://localhost').pathname
            } catch {
              /* fall through with '/' */
            }
            if (pathname !== TASK_STATE_PATH && pathname !== BOARD_PATH && pathname !== BIND_PATH) {
              respondJson(res, 404, { ok: false, error: 'not found' })
              return
            }
            let body = null
            try {
              body = await readJsonBody(req)
            } catch {
              respondJson(res, 400, { ok: false, error: 'bad request' })
              return
            }

            if (pathname === TASK_STATE_PATH) {
              const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
              const live = sessionId ? web.sessions.get(sessionId) : undefined
              let value
              if (live && sessionId) {
                const cached = summaries.get(sessionId)
                // Cache hit serves without touching the filesystem. A miss
                // (fresh process, or a session that has not run a turn yet)
                // resolves once on demand and caches, so the chip never sits
                // in the dead 'no-summary' state after a restart.
                value = cached || await refreshSummary(sessionId)
                if (!cached) lruSet(summaries, sessionId, value, CACHE_LIMIT)
              } else {
                value = { kind: 'no-summary', phase: 'no_task' }
              }
              respondJson(res, 200, { ok: true, value })
              return
            }

            if (pathname === BOARD_PATH) {
              const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
              const live = sessionId ? web.sessions.get(sessionId) : undefined
              if (!live) {
                respondJson(res, 200, { ok: true, value: { kind: 'no-summary', phase: 'no_task' } })
                return
              }
              const cwd = normalizePath(live.header ? live.header.cwd : undefined)
              const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
              if (!root) {
                respondJson(res, 200, { ok: true, value: { kind: 'no-match', phase: 'no_task' } })
                return
              }
              const board = await buildBoard(web.fs, root, sessionId, effectiveConfig.get().inline === true)
              respondJson(res, 200, { ok: true, value: board })
              return
            }

            // BIND_PATH: explicit activate (taskSlug) / deactivate (null) for
            // THIS session only. The project root comes from the live session
            // header cwd (trusted) — never from the request; the task slug is
            // format-checked and existence-checked against that root.
            const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
            const live = sessionId ? web.sessions.get(sessionId) : undefined
            if (!live) {
              respondJson(res, 404, { ok: false, error: 'session not found' })
              return
            }
            const cwd = normalizePath(live.header ? live.header.cwd : undefined)
            const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
            if (!root) {
              respondJson(res, 403, { ok: false, error: 'forbidden' })
              return
            }
            const taskSlug = body && typeof body.taskSlug === 'string' ? body.taskSlug.trim() : null
            if (taskSlug !== null && !/^[A-Za-z0-9._-]{1,120}$/.test(taskSlug)) {
              respondJson(res, 400, { ok: false, error: 'bad task slug' })
              return
            }
            let sandboxPolicy
            try {
              const policy = web.fs.sandboxMode === void 0 ? void 0 : web.get('sandboxPolicy')
              sandboxPolicy = policy ? policy.resolve({ session: live }) : void 0
            } catch {
              sandboxPolicy = void 0
            }
            try {
              if (taskSlug !== null) {
                const taskJsonTarget = await web.fs.resolve(path.join(root, '.trellis', 'tasks', taskSlug, 'task.json'))
                const info = await web.fs.stat(taskJsonTarget)
                if (!info) {
                  respondJson(res, 404, { ok: false, error: 'task not found' })
                  return
                }
                await bindTaskPointer(web.fs, root, sessionId, `.trellis/tasks/${taskSlug}`, { sandboxPolicy })
              } else {
                await unbindTaskPointer(web.fs, root, sessionId, { sandboxPolicy })
              }
            } catch (error) {
              if (error && error.code === 'FS_SANDBOX_DENIED') {
                respondJson(res, 403, { ok: false, error: 'sandbox denied' })
                return
              }
              respondJson(res, 500, { ok: false, error: 'write failed' })
              return
            }
            // Keep the chip cache coherent with the new bind state.
            const summary = await refreshSummary(sessionId)
            lruSet(summaries, sessionId, summary, CACHE_LIMIT)
            respondJson(res, 200, { ok: true, value: { bound: taskSlug, summary } })
          } catch {
            respondJson(res, 500, { ok: false, error: 'internal error' })
          }
        },
      })
      web.effect(() => disposeRoute)

      web.on('session/disposed', (session) => {
        if (session && typeof session.id === 'string') summaries.delete(session.id)
      })

      // Model-facing refresh trigger: empty parameters; the session and cwd
      // come from exec.agent (trusted host context), never from the model.
      const disposeUiTool = web.tools.register(
        defineTool({
          name: 'trellis_ui_update',
          description:
            'Refresh the Web UI Trellis task-phase chip cache for the current session. No parameters. Call after a Trellis stage switch, task creation, or check completion so the session-header chip shows the new phase; returns the refreshed summary.',
          parameters: {},
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string' },
                title: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                status: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                stage: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                phase: { type: 'string' },
                workType: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              },
            },
            render(args, value) {
              return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
            },
          },
          async execute(args, exec) {
            const sessionId =
              exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
                ? exec.agent.session.id
                : undefined
            if (!sessionId) return { kind: 'no-summary', phase: 'no_task' }
            const summary = await refreshSummary(sessionId)
            lruSet(summaries, sessionId, summary, CACHE_LIMIT)
            return summary
          },
        }),
      )
      web.effect(() => disposeUiTool)
    })

    // --- per-turn breadcrumb injection -------------------------------------
    ctx.on('agent/pre-step', async ({ agent, messages, step, signal }, next) => {
      const decision = await next()
      if (decision.kind === 'reject') return decision

      const cwd = normalizePath(agent && agent.session && agent.session.header ? agent.session.header.cwd : undefined)
      const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
      if (!root) return decision

      const effective = effectiveConfig.get()
      if (effective.injectStep !== undefined && step !== effective.injectStep) return decision

      const lastUser = extractMessageText(messages[messages.length - 1])
      if (shouldSkip(lastUser, effective.skipKeywords)) return decision

      signal?.throwIfAborted()

      const inline = effective.inline === true

      // --- skill provisioning (session-start, once per project root) --------
      // Detect whether the project's .agents/skills carries the trellis skills;
      // copy the missing ones from the package when absent, skip when present.
      // Never throws into the turn: a provisioning failure only warns and the
      // breadcrumb still injects (skills remain copyable on a later turn).
      let provisionedNote = ''
      try {
        const policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get('sandboxPolicy')
        const sandboxPolicy = policy
          ? policy.resolve({ ...(agent === void 0 ? {} : { session: agent.session }) })
          : void 0
        const provisioned = await ensureProjectSkills(ctx.fs, root, {
          signal: signal ?? undefined,
          sandboxPolicy,
        })
        if (provisioned.copied.length > 0) {
          provisionedNote =
            `\n\n（已把 trellis-* 技能复制到项目 .agents/skills/：` +
            `${provisioned.copied.join(', ')}；harness 将从项目目录加载，无需重启）`
        }
      } catch (error) {
        console.warn(`[${NAME}] skill provisioning failed for ${root}:`, error && error.message)
      }

      const st = await resolveProjectState(
        ctx.fs,
        root,
        inline,
        agent && agent.session && typeof agent.session.id === 'string' ? agent.session.id : undefined,
      )
      if (provisionedNote) st.text += provisionedNote

      // Keep the Web UI chip cache fresh without model discipline: every turn
      // in a matched project already resolves state for the breadcrumb, so
      // mirror it into the session cache. The chip picks it up on its next
      // fetch (mount / session switch / focus return / manual click); the
      // trellis_ui_update tool still covers same-turn immediate refresh.
      if (agent && agent.session && typeof agent.session.id === 'string') {
        lruSet(
          summaries,
          agent.session.id,
          taskSummaryOf(st.task, { matched: true, phase: st.phase }),
          CACHE_LIMIT,
        )
      }

      const desired = buildBreadcrumbMessage(
        {
          sourceKind: SOURCE_KIND,
          text: st.text,
          source: st.source,
          projectRoot: root,
          activeTask: st.activeTask,
          phase: st.phase,
        },
        createUserMessage,
      )

      // Dedupe: a breadcrumb (or any of this plugin's injected context) already
      // present this turn — skip rather than stack copies.
      if (decision.messages.some((message) => message.source && message.source.kind === SOURCE_KIND)) {
        return decision
      }

      const lastClaimedIndex = decision.messages.findLastIndex((message) => messages.includes(message))
      return {
        kind: 'enter',
        messages: decision.messages.toSpliced(lastClaimedIndex + 1, 0, desired),
      }
    })

    console.log(`[${NAME}] mounted; allowlist=`, JSON.stringify(effectiveConfig.get().allowlist))
  },
}
