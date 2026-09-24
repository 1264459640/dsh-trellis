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

/**
 * Shared config shape: plugin entry config and the user-settings form.
 *
 * DSH 0.1.7 settings are Loader-entry driven: the settings form for this
 * plugin IS the `Config` schema below, keyed by the loader entry id
 * (`trellis-workflow`). Only fields marked `.volatile()` are editable through
 * the Web settings form; at resolve time a volatile field wraps its value in a
 * cosmokit volatile (an object with a `get()` accessor), so consumers must
 * unwrap before use (see `unwrapVolatileConfig`).
 */
function configShape() {
  return {
    /** Project roots whose cwd should receive a Trellis breadcrumb. */
    allowlist: z.array(z.string()).default(DEFAULT_ALLOWLIST).volatile(),
    /** Only inject on this step index (1 = first step of each user message). */
    injectStep: z.number().default(1).volatile(),
    /** Standalone words that suppress injection for a turn. */
    skipKeywords: z.array(z.string()).default(['no-trellis']).volatile(),
    /** Assume codex-inline dispatch mode when resolving phase names. */
    inline: z.boolean().default(false).volatile(),
    /**
     * Read-only planning enforcement: when a session is in the undecided or
     * planning authorization state, TRIM only the specified tools from the
     * model's tool surface (denylist: generic write/edit plus the trellis
     * tools invalid for that state), keeping every other tool — including
     * tools registered by other plugins — intact.
     */
    enforceReadonlyPlanning: z.boolean().default(false).volatile(),
  }
}

export const SCHEMA = z.object(configShape())

/**
 * Resolve a config value produced by a `.volatile()` schema field. schemastery
 * wraps volatile values in a cosmokit volatile — a plain object exposing
 * `get()` — so `.get()` returns the underlying value. Non-volatile (already
 * plain) values pass through unchanged.
 * @param {unknown} value a config field value (possibly volatile-wrapped).
 * @returns {unknown} the unwrapped value.
 */
export function unwrapVolatile(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {
      return value
    }
  }
  return value
}

/**
 * Deep-unwrap a resolved config object whose `.volatile()` fields are wrapped
 * in cosmokit volatiles. Returns a plain config safe for the existing allowlist
 * / keyword / step reads. Non-object input passes through.
 * @param {unknown} config resolved config (e.g. from `SCHEMA(cfg)` or `ctx.config`).
 * @returns {object} the unwrapped config.
 */
export function unwrapVolatileConfig(config) {
  if (config === null || typeof config !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(config)) {
    out[key] = unwrapVolatile(value)
  }
  // Defensive: fields consumed as iterables must be arrays even if a volatile
  // wrapper resolved to something unexpected.
  if (!Array.isArray(out.allowlist)) out.allowlist = []
  if (!Array.isArray(out.skipKeywords)) out.skipKeywords = ['no-trellis']
  return out
}

/** @deprecated DSH 0.1.7 projects the Config schema directly; kept for backward imports. */
export function settingsSchema() {
  return SCHEMA
}
