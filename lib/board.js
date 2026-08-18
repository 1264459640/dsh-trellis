/**
 * Path-free Trellis kanban board payload builder and archive cache.
 *
 * Scans the active task tree `.trellis/tasks/*` and the archive tree
 * `.trellis/tasks/archive/<yyyy-mm>/*` concurrently, caching immutable
 * archive buckets in memory for zero-I/O subsequent reads.
 */

import path from 'node:path'
import { trellisPaths } from './resolve.js'
import {
  ymKeyFromSlug,
  stageOnTrack,
  fallbackStage,
  activeTaskFromSession,
  activeTaskForSession,
} from './state.js'
import { sessionFileBasename } from './task.js'

/**
 * In-memory cache for archived task records:
 * Map<projectRoot, Map<bucketName, TaskRecord[]>>
 *
 * Archived tasks are immutable (read-only). Once parsed, bucket records
 * remain cached until explicitly invalidated via `invalidateArchiveBucket`.
 */
const archiveBucketsCache = new Map()

/**
 * Invalidate the archive cache for a specific bucket (or the entire project root).
 * @param {string} root project root.
 * @param {string} [bucket] bucket name (e.g. "2025-08" or "other"). If omitted, all buckets for root are cleared.
 */
export function invalidateArchiveBucket(root, bucket) {
  if (!root) return
  if (!bucket) {
    archiveBucketsCache.delete(root)
    return
  }
  const rootCache = archiveBucketsCache.get(root)
  if (rootCache) {
    rootCache.delete(bucket)
  }
}

/**
 * Clear the entire in-memory archive cache.
 */
export function clearArchiveCache() {
  archiveBucketsCache.clear()
}

/**
 * Read one task dir entry into the path-free board record.
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {object} dirEntry a listDir child (has .name and .target).
 * @param {{ month: string | null, archived: boolean }} meta month key + archive flag.
 * @returns {Promise<object | null>} board task record, or null (skip).
 */
export async function readTask(fs, dirEntry, meta) {
  if (!dirEntry || typeof dirEntry.name !== 'string' || !dirEntry.target) return null
  try {
    const taskJsonTarget = await fs.resolve(path.join(dirEntry.target.targetKey, 'task.json'))
    const text = await fs.readText(taskJsonTarget)
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
    const status = parsed && typeof parsed.status === 'string' ? parsed.status : null
    if (!status) return null

    const workType = parsed.work && typeof parsed.work.type === 'string' ? parsed.work.type : null
    const rawStage = parsed.work && typeof parsed.work.stage === 'string' ? parsed.work.stage : null
    const stage = rawStage && stageOnTrack(workType, rawStage) ? rawStage : fallbackStage(workType, status)

    let artifacts = []
    try {
      const files = await fs.listDir(dirEntry.target)
      artifacts = files.map((f) => (f && typeof f.name === 'string' ? f.name : '')).filter(Boolean)
    } catch {
      /* no artifacts readable */
    }

    return {
      slug: dirEntry.name,
      title:
        parsed.title && typeof parsed.title === 'string' && parsed.title ? parsed.title : dirEntry.name,
      status,
      workType: workType || null,
      stage: stage || null,
      month: meta.month,
      archived: meta.archived,
      artifacts,
    }
  } catch {
    return null
  }
}

/**
 * Build the path-free task-board payload for the Web kanban: every task
 * under the active tree `.trellis/tasks/*` plus the archive tree
 * `.trellis/tasks/archive/<yyyy-mm>/*` concurrently, with in-memory caching
 * for archive buckets. Paths never reach the browser.
 *
 * @param {import('@deepseek-ai/dsh-fs').FileSystem} fs
 * @param {string} root normalized project root.
 * @param {string | undefined} sessionId live session id.
 * @param {boolean} [inline] codex-inline dispatch flag.
 * @returns {Promise<object>} board payload (kind: 'board') or a stable empty kind.
 */
export async function buildBoard(fs, root, sessionId, inline = false) {
  const p = trellisPaths(root)

  // 1. Concurrently scan active tasks
  const activeTasksPromise = (async () => {
    try {
      const tasksDirTarget = await fs.resolve(p.tasksDir)
      const entries = await fs.listDir(tasksDirTarget)
      const readPromises = []
      for (const entry of entries) {
        if (!entry || typeof entry.name !== 'string') continue
        if (entry.name === 'archive' || entry.name.startsWith('.')) continue
        readPromises.push(readTask(fs, entry, { month: ymKeyFromSlug(entry.name), archived: false }))
      }
      const results = await Promise.all(readPromises)
      return results.filter(Boolean)
    } catch {
      return []
    }
  })()

  // 2. Concurrently scan archive buckets with in-memory bucket cache
  const archivedTasksPromise = (async () => {
    try {
      const archiveDirTarget = await fs.resolve(path.join(p.tasksDir, 'archive'))
      const buckets = await fs.listDir(archiveDirTarget)
      let rootCache = archiveBucketsCache.get(root)
      if (!rootCache) {
        rootCache = new Map()
        archiveBucketsCache.set(root, rootCache)
      }

      const bucketPromises = []
      for (const bucket of buckets) {
        if (!bucket || typeof bucket.name !== 'string' || bucket.name.startsWith('.')) continue
        bucketPromises.push(
          (async () => {
            const cached = rootCache.get(bucket.name)
            if (cached) return cached

            try {
              const taskEntries = await fs.listDir(bucket.target)
              const readPromises = []
              for (const taskEntry of taskEntries) {
                if (!taskEntry || typeof taskEntry.name !== 'string' || taskEntry.name.startsWith('.')) continue
                readPromises.push(readTask(fs, taskEntry, { month: bucket.name, archived: true }))
              }
              const parsedTasks = (await Promise.all(readPromises)).filter(Boolean)
              rootCache.set(bucket.name, parsedTasks)
              return parsedTasks
            } catch {
              return []
            }
          })(),
        )
      }

      const bucketResults = await Promise.all(bucketPromises)
      return bucketResults.flat()
    } catch {
      return []
    }
  })()

  // 3. Concurrently scan runtime session pointers
  const currentTaskPromise = (async () => {
    try {
      const runtimeDirTarget = await fs.resolve(p.runtimeDir)
      const entries = await fs.listDir(runtimeDirTarget)
      const sessionFiles = entries.filter((e) => e && typeof e.name === 'string' && e.name.endsWith('.json'))

      const sessionPromises = sessionFiles.map(async (entry) => {
        try {
          const parsed = JSON.parse((await fs.readText(entry.target)).replace(/^\uFEFF/, ''))
          const { taskDir } = activeTaskFromSession(parsed)
          return { name: entry.name, taskDir: taskDir || null }
        } catch {
          return { name: entry.name, taskDir: null }
        }
      })

      const sessions = await Promise.all(sessionPromises)
      const picked = activeTaskForSession(
        sessions,
        sessionId ? sessionFileBasename(sessionId) + '.json' : undefined,
      )
      if (picked) {
        return String(picked).replace(/\\/g, '/').split('/').filter(Boolean).pop() || null
      }
      return null
    } catch {
      return null
    }
  })()

  // Await all 3 concurrent branches
  const [activeTasks, archivedTasks, currentTask] = await Promise.all([
    activeTasksPromise,
    archivedTasksPromise,
    currentTaskPromise,
  ])

  // Merge tasks into bySlug Map
  const bySlug = new Map()
  for (const task of activeTasks) {
    if (task) bySlug.set(task.slug, task)
  }
  for (const task of archivedTasks) {
    if (!task) continue
    const prev = bySlug.get(task.slug)
    if (!prev || (task.archived && !prev.archived)) bySlug.set(task.slug, task)
  }

  const tasks = [...bySlug.values()]
  return { kind: 'board', currentTask, tasks }
}
