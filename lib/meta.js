/**
 * Plugin identity, config schema, and the default allowlist.
 */

import z from '@deepseek-ai/schemastery'

export const NAME = 'trellis-workflow'

/** Message source kind tag used for breadcrumbs this plugin injects. */
export const SOURCE_KIND = 'trellis'

/** Default project roots the trigger is allowed to inject into (empty: configure per deployment). */
export const DEFAULT_ALLOWLIST = []

/** Settings namespace shown in the Web GUI when a settings provider is mounted. */
export const SETTINGS_NAMESPACE = 'trellis-workflow'

/**
 * Prefix for the Web UI's same-origin read-only API (route:
 * `/trellis-workflow/api/task-state`). Responses are path-free summaries or
 * stable empty kinds; the route never triggers project resolution or fs reads.
 */
export const API_PREFIX = '/trellis-workflow/api'

/** Shared config shape: plugin entry config and the user-settings namespace. */
function configShape() {
  return {
    /** Project roots whose cwd should receive a Trellis breadcrumb. */
    allowlist: z.array(z.string()).default(DEFAULT_ALLOWLIST),
    /** Only inject on this step index (1 = first step of each user message). */
    injectStep: z.number().default(1),
    /** Standalone words that suppress injection for a turn. */
    skipKeywords: z.array(z.string()).default(['no-trellis']),
    /** Assume codex-inline dispatch mode when resolving phase names. */
    inline: z.boolean().default(false),
  }
}

export const SCHEMA = z.object(configShape())

/** Schema for the user-settings namespace; mirrors SCHEMA so the Web Settings page can edit the same fields. */
export function settingsSchema() {
  return z.object(configShape())
}
