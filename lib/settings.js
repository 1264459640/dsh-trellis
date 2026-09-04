/**
 * Optional user-settings integration for the trellis trigger.
 *
 * When a settings provider is mounted (`ctx.get('settings')`), the plugin's
 * config (allowlist, injectStep, skipKeywords, inline) is exposed in the Web
 * GUI Settings page under the `trellis-workflow` namespace, layered as:
 *
 *   schema defaults <- composition entry config (base) <- user document
 *
 * `scope.get()` re-resolves live, so an edit made in the GUI applies to the
 * next turn without a restart. Without a provider, resolution falls back to
 * the entry config unchanged, so every composition works with or without
 * settings (same rule as the rest of the harness).
 */

import { SETTINGS_NAMESPACE, SCHEMA, settingsSchema } from './meta.js'

/**
 * Register the settings namespace for this plugin's config.
 *
 * Registration goes through `ctx.inject(['settings'], …)` rather than a
 * one-shot `ctx.get('settings')` probe: plugin activation order is
 * service-availability driven, so the settings service may not be mounted yet
 * when this plugin's `apply` runs. The inject callback fires once settings is
 * available (or never, when a composition mounts no settings provider), so the
 * namespace is registered whenever the host can serve it. Without a provider,
 * resolution falls back to the entry config unchanged.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {object} config the plugin's entry config (composition `base`).
 * @returns {{ get: () => object }} a live getter for the effective config.
 */
export function registerTrellisSettings(ctx, config) {
  // Normalize the entry config through the schema so the returned getter is
  // never undefined: a plugin bundle loaded without an explicit config gives
  // `apply(ctx, config)` an undefined `config`, and schemastery fills in the
  // field defaults (allowlist, injectStep, ...) for us.
  const base = SCHEMA(config ?? {})
  let scope = null
  ctx.inject(['settings'], (settingsCtx) => {
    try {
      scope = settingsCtx.settings.register(
        SETTINGS_NAMESPACE,
        settingsSchema(),
        { base },
      )
    } catch (error) {
      console.warn(
        `[trellis-workflow] settings namespace unavailable (${error && error.message}); using entry config`,
      )
    }
  })
  return { get: () => (scope ? scope.get() ?? base : base) }
}
