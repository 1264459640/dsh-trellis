import test from 'node:test'
import assert from 'node:assert/strict'
import z from '@deepseek-ai/schemastery'

import { SCHEMA } from '../lib/meta.js'

/**
 * The plugin's Config must stay *describable* by dsh-settings.
 *
 * `SettingsForms.describe()` skips any entry whose `volatileForm(schema)` is
 * undefined, and `SettingsForms.write()` refuses a path that
 * `isVolatilePath()` rejects. So dropping a `.volatile()` from a config field
 * silently removes the whole page from the Plugins list — the failure looks
 * like a blank card, not an error.
 *
 * Both helpers are replicated exactly from dsh-settings@0.1.7-rc.1
 * lib/index.js (they are module-private there).
 */

/** @param {object} schema a schemastery node. @returns {object | undefined} */
function volatileForm(schema) {
  if (schema.meta.volatile) return schema
  if (schema.type === 'object') {
    const dict = Object.fromEntries(
      Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
        const field = volatileForm(child)
        return field === undefined ? [] : [[key, field]]
      }),
    )
    return Object.keys(dict).length === 0 ? undefined : z.object(dict)
  }
  return undefined
}

/**
 * @param {object} schema a schemastery node.
 * @param {string[]} path field path.
 * @returns {boolean} whether the path can be edited live.
 */
function isVolatilePath(schema, path) {
  if (schema.meta.volatile) return true
  const [key, ...rest] = path
  const child = key === undefined ? undefined : schema.dict?.[key]
  return child !== undefined && isVolatilePath(child, rest)
}

/** Every field the Plugins-page card renders. */
const FIELDS = ['allowlist', 'injectStep', 'skipKeywords', 'inline', 'enforceReadonlyPlanning']

test('the entry carries a Config schema describe() can read', () => {
  assert.equal(typeof SCHEMA.toJSON, 'function', 'dsh-settings requires schema.toJSON')
})

test('every config field is volatile, so describe() lists the entry', () => {
  const form = volatileForm(SCHEMA)
  assert.notEqual(form, undefined, 'volatileForm(SCHEMA) undefined — the page would vanish from the Plugins list')
  assert.deepEqual(Object.keys(form.dict).sort(), [...FIELDS].sort())
  for (const field of FIELDS) {
    assert.ok(isVolatilePath(SCHEMA, [field]), `${field} is not a volatile path — settings.update would refuse it`)
  }
})

test('the schema survives the plainSchema reconstruction describe() performs', () => {
  assert.equal(new z(SCHEMA.toJSON()).type, 'object')
})
