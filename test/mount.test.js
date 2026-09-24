import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'

import plugin from '../lib/index.js'

/**
 * Mount the host half on a real cordis Context with stub services.
 *
 * This is the check that catches activation failures: the 0.1.7 break came
 * from `apply` throwing (`cannot get property "config" without inject`), which
 * left the loader entry un-activated while every unit test still passed.
 * It also proves the real `defineTool` accepts every tool spec.
 *
 * @returns {Promise<{ registered: string[] }>} the tool names registered.
 */
async function mountPlugin() {
  const root = new Context()
  const registered = []

  // The services the plugin injects. `ctx.fs` is the real surface it uses.
  root.provide('fs', {
    sandboxMode: undefined,
    async resolve(p) {
      return { path: p }
    },
    async stat() {
      return undefined
    },
    async readText() {
      return ''
    },
    async listDir() {
      return []
    },
    async writeText() {
      return { ok: true }
    },
  })
  root.provide('skills', {})
  root.provide('tools', {
    register(definition) {
      registered.push(definition.name)
      return () => {}
    },
  })
  root.provide('agents', { currentInitiator: () => undefined })

  const fork = root.plugin(plugin, { allowlist: [] })
  // Let the injection graph settle.
  await new Promise((resolve) => setTimeout(resolve, 250))
  return { registered, fork }
}

/**
 * dsh-settings' `describe()` reads `entry.fiber.runtime.Config` and skips any
 * entry whose schema it cannot find. Cordis only exposes the schema under the
 * capitalised `Config` key — with a lowercase `config: SCHEMA` the entry was
 * never listed, so the Plugins-page form silently vanished (rendered the
 * "unavailable" line) while everything else kept working.
 */
test('the schema is exposed at runtime.Config, which dsh-settings reads', async () => {
  const { fork } = await mountPlugin()
  const runtime = fork && fork.runtime
  assert.ok(runtime, 'the plugin fiber has no runtime')
  assert.ok(runtime.Config, 'runtime.Config is missing — the Plugins-page form would never be listed')
  assert.equal(typeof runtime.Config.toJSON, 'function', 'runtime.Config must be a schemastery schema')
  assert.equal(plugin.config, undefined, 'a lowercase `config` key is not read as the schema')
})

test('host plugin mounts on a real cordis context and registers its tools', async () => {
  const { registered } = await mountPlugin()
  assert.ok(registered.length > 0, 'no tools were registered — apply likely threw')
  for (const name of ['trellis_state', 'trellis_task_create', 'trellis_task_update', 'trellis_task_archive']) {
    assert.ok(registered.includes(name), `missing tool ${name} (registered: ${registered.join(', ')})`)
  }
})

test('the mounted plugin exposes a working effective config', async () => {
  // Re-mount and drive the registered diagnostic tool end-to-end: it resolves
  // the project state through `effectiveConfig.get()`, so a throwing config
  // getter surfaces here rather than only in a live DSH session.
  const root = new Context()
  const tools = new Map()
  root.provide('fs', {
    sandboxMode: undefined,
    async resolve(p) {
      return { path: p }
    },
    async stat() {
      return undefined
    },
    async readText() {
      return ''
    },
    async listDir() {
      return []
    },
    async writeText() {
      return { ok: true }
    },
  })
  root.provide('skills', {})
  root.provide('tools', {
    register(definition) {
      tools.set(definition.name, definition)
      return () => {}
    },
  })
  root.provide('agents', { currentInitiator: () => undefined })

  root.plugin(plugin, { allowlist: ['F:/proj'] })
  await new Promise((resolve) => setTimeout(resolve, 250))

  const stateTool = tools.get('trellis_state')
  assert.ok(stateTool, 'trellis_state was not registered')

  const value = await stateTool.execute(
    { cwd: 'F:/proj/sub' },
    { agent: { session: { id: 's1', header: { cwd: 'F:/proj/sub' } } } },
  )
  assert.equal(value.project, 'F:/proj', 'the allowlist from config did not resolve')
  assert.equal(value.matched, true)
})
