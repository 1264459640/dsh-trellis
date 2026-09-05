/**
 * Trellis Artifact Update Tool (`trellis_artifact_update`).
 *
 * Provides a secure, controlled channel for models to write planning and verification
 * markdown documents (PRD, design, review, check, etc.) directly into the active
 * task's directory (.trellis/tasks/<slug>/).
 *
 * Enforces strict sandbox boundaries:
 *  - Only pre-whitelisted standard workflow artifact file names are permitted.
 *  - Path traversal (..) or subdirectories are strictly forbidden.
 *  - Modifying project source code or files outside the task directory is physically impossible.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import path from 'node:path'
import { normalizePath, matchAllowlist } from './resolve.js'
import { findActiveTaskSlug } from './task.js'
import { SLUG_CHARSET } from './archive.js'

/**
 * Standard artifact file names allowed across feat, issue, and refactor workflows.
 */
export const ALLOWED_ARTIFACTS = new Set([
  // feat workflow artifacts
  'prd.md',
  'design.md',
  'design-review.md',
  'implement.md',
  'review.md',
  'check.md',
  // issue workflow artifacts
  'report.md',
  'analysis.md',
  'fix-note.md',
  // refactor workflow artifacts
  'scan.md',
  'refactor-design.md',
  'apply-notes.md',
  'checklist.yaml',
])

/**
 * Assert that the target artifact path is strictly within the specified task directory.
 * @param {string} root normalized project root
 * @param {string} slug task slug
 * @param {string} artifact base file name
 * @returns {string} resolved target absolute path
 */
export function assertSafeArtifactPath(root, slug, artifact) {
  if (typeof slug !== 'string' || !slug.trim()) {
    throw new Error('任务 slug 不能为空')
  }
  const safeSlug = slug.trim()
  if (!SLUG_CHARSET.test(safeSlug)) {
    throw new Error(`非法的任务 slug：包含路径分隔符或越权字符 (${safeSlug})`)
  }

  // Belt-and-suspenders: the slug must resolve to a DIRECT child of the tasks
  // dir (rejects `.`, `..`, and any dotted/pathological segment that slips past
  // the charset guard).
  const tasksDir = path.resolve(root, '.trellis', 'tasks')
  const taskDir = path.resolve(tasksDir, safeSlug)
  const taskRel = path.relative(tasksDir, taskDir)
  if (taskRel !== safeSlug || taskRel.startsWith('..') || path.isAbsolute(taskRel)) {
    throw new Error(`非法的任务 slug：路径越权 (${safeSlug})`)
  }

  if (typeof artifact !== 'string' || !artifact.trim()) {
    throw new Error('artifact 名称不能为空')
  }
  const name = artifact.trim()
  if (!ALLOWED_ARTIFACTS.has(name)) {
    throw new Error(
      `不允许更新非标准产物文件 "${name}"；合法产物仅限：${[...ALLOWED_ARTIFACTS].join(', ')}`,
    )
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`非法的文件名包含路径穿越或分隔符: "${name}"`)
  }

  const targetPath = path.resolve(taskDir, name)

  // Ensure targetPath is strictly inside taskDir
  const rel = path.relative(taskDir, targetPath)
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel !== name) {
    throw new Error(`路径越权：产物写入必须局限在当前任务目录内 (${name})`)
  }

  return targetPath
}

/**
 * Update a task artifact file end-to-end.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} dshFs
 * @param {string} root project root
 * @param {object} args { artifact, content, slug?, cwd? }
 * @param {object} [exec] { signal?, sessionId? }
 * @param {object} [sandboxPolicy]
 * @returns {Promise<{ ok: true, slug: string, artifact: string, filePath: string, bytesWritten: number } | { ok: false, error: string }>}
 */
export async function updateTaskArtifact(dshFs, root, args, exec = {}, sandboxPolicy) {
  let slug = args.slug && typeof args.slug === 'string' ? args.slug.trim() : undefined
  if (!slug) {
    slug = await findActiveTaskSlug(dshFs, root, exec.sessionId)
    if (!slug) {
      return { ok: false, error: '未指定 slug 且当前会话未绑定任何活动任务' }
    }
  }

  const content = typeof args.content === 'string' ? args.content : ''
  if (!content.trim()) {
    return { ok: false, error: 'content 不能为空' }
  }

  let targetPath
  try {
    targetPath = assertSafeArtifactPath(root, slug, args.artifact)
  } catch (err) {
    return { ok: false, error: err.message }
  }

  const taskJsonPath = path.join(root, '.trellis', 'tasks', slug, 'task.json')
  const taskJsonTarget = await dshFs.resolve(taskJsonPath)
  const stat = await dshFs.stat(taskJsonTarget)
  if (!stat) {
    return { ok: false, error: `任务目录不存在：.trellis/tasks/${slug}/` }
  }

  const resolvedTarget = await dshFs.resolve(targetPath)
  await dshFs.writeText(resolvedTarget, content, undefined, exec.signal, sandboxPolicy)

  return {
    ok: true,
    slug,
    artifact: args.artifact.trim(),
    filePath: `.trellis/tasks/${slug}/${args.artifact.trim()}`,
    bytesWritten: Buffer.byteLength(content, 'utf8'),
  }
}

/**
 * Create the defineTool instance for trellis_artifact_update.
 * @param {object} deps { ctx, effectiveConfig }
 */
export function createArtifactUpdateTool({ ctx, effectiveConfig }) {
  return defineTool({
    name: 'trellis_artifact_update',
    description:
      '更新当前 Trellis 任务的阶段交付文档（PRD、设计方案、实现备忘、验收报告等）。受安全沙箱保护，仅允许写入任务目录内的合法 Markdown 产物，严禁修改任何项目源代码。',
    parameters: {
      artifact: {
        type: 'string',
        description: `产物文件名。允许项：${[...ALLOWED_ARTIFACTS].join(' | ')}`,
      },
      content: {
        type: 'string',
        description: '产物完整 UTF-8 Markdown 正文内容。',
      },
      slug: {
        type: 'string',
        description: '可选 explicit task slug；默认绑定当前会话的活动任务。',
      },
      cwd: {
        type: 'string',
        description: '可选项目根目录绝对路径。默认使用当前会话 cwd。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          error: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          slug: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          artifact: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          filePath: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          bytesWritten: { oneOf: [{ type: 'number' }, { type: 'null' }] },
        },
      },
      render(args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
    },
    async execute(args, exec) {
      const cwd = normalizePath(
        args.cwd || (exec.agent && exec.agent.session && exec.agent.session.header && exec.agent.session.header.cwd),
      )
      const root = matchAllowlist(cwd, effectiveConfig.get().allowlist)
      if (!root) {
        return {
          ok: false,
          error: '项目不在 allowlist 内；请先在 Web 设置或配置里把项目根加入 trellis-workflow.allowlist',
          slug: null,
          artifact: null,
          filePath: null,
          bytesWritten: null,
        }
      }

      const policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get('sandboxPolicy')
      const sandboxPolicy = policy
        ? policy.resolve({ ...(exec.agent === void 0 ? {} : { session: exec.agent.session }) })
        : void 0

      const result = await updateTaskArtifact(ctx.fs, root, args, exec, sandboxPolicy)
      if (!result.ok) {
        return {
          ok: false,
          error: result.error,
          slug: null,
          artifact: null,
          filePath: null,
          bytesWritten: null,
        }
      }
      return {
        ok: true,
        error: null,
        slug: result.slug,
        artifact: result.artifact,
        filePath: result.filePath,
        bytesWritten: result.bytesWritten,
      }
    },
  })
}
