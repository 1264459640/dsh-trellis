import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSource, loadClient, palettes, renderViews, tasks } from './helpers/client-theme.js'

// This is deliberately a small evaluator for the color expressions the bundle
// uses, not a CSS engine. Unknown syntax fails closed; browser validation covers
// actual computed styles and live theme switching separately.
function color(value, palette) {
  value = value.replace(/var\((--[\w-]+),\s*([^()]+)\)/g,
    (_, name, fallback) => palette[name] || fallback).trim()
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%\s*,\s*(.+)\)$/.exec(value)
  if (mix) {
    const a = color(mix[1], palette), b = color(mix[3], palette), weight = Number(mix[2]) / 100
    return a.map((channel, i) => channel * weight + b[i] * (1 - weight))
  }
  if (value === 'transparent') return [0, 0, 0, 0]
  if (value.startsWith('#')) {
    let hex = value.slice(1)
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    assert.match(hex, /^(?:[a-f\d]{6}|[a-f\d]{8})$/i)
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .concat(hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1)
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value)
  assert.ok(rgb, 'Unsupported color: ' + value)
  const channels = rgb[1].split(',').map(Number)
  return channels.slice(0, 3).map((n) => n / 255).concat(channels[3] ?? 1)
}
function over(fg, bg) {
  return fg.slice(0, 3).map((n, i) => n * fg[3] + bg[i] * (1 - fg[3])).concat(1)
}
function luminance(rgb) {
  return rgb.slice(0, 3).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)
}
function contrast(fg, bg) {
  const a = luminance(over(fg, bg)), b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
function textColors(node, palette, background, foreground, result = []) {
  if (node == null || typeof node === 'boolean') return result
  if (typeof node !== 'object') {
    result.push({ text: String(node), background, foreground })
    return result
  }
  if (node.type === 'style' || node.type === 'svg') return result
  const style = node.props.style || {}
  const bg = style.background && style.background !== 'none'
    ? over(color(style.background, palette), background) : background
  const fg = style.color ? color(style.color, palette) : foreground
  for (const child of node.children) textColors(child, palette, bg, fg, result)
  return result
}

const client = loadClient()
test('kanban uses real host surface aliases, never nonexistent layer zero', () => {
  assert.doesNotMatch(clientSource, /--dsw-alias-bg-layer-0/)
  for (const key of ['surface', 'selectBg', 'selectBgPop', 'chipBg', 'featBg', 'issueBg', 'refactorBg']) {
    const light = color(client.TB.color[key], palettes.light)
    const dark = color(client.TB.color[key], palettes.dark)
    assert.notDeepEqual(dark, light, key + ' must follow host theme')
    assert.ok(luminance(dark) < 0.15, key + ' must stay dark in dark mode')
  }
})

// No host tokens exercises standalone fallbacks. Literal strings from the
// rendered tree ensure titles, type/stage badges, step counts and stage numbers
// are checked on their actual ancestor backgrounds, including selected rows.
for (const [mode, palette] of Object.entries({ fallback: {}, light: palettes.light, dark: palettes.dark })) {
  for (const selected of tasks.map((task) => task.slug)) {
    for (const [view, tree] of Object.entries(renderViews(client, selected))) {
      test(`${mode} ${view} selected=${selected}: primary text and badges are readable`, () => {
        const base = color(palette['--dsw-alias-bg-base'] || '#ffffff', palette)
        const text = color(palette['--dsw-alias-label-primary'] || '#0f172a', palette)
        const entries = textColors(tree, palette, base, text).filter(({ text }) =>
          tasks.some((task) => text === task.title || text === task.stage) ||
          ['功能', '缺陷', '重构'].includes(text) ||
          /(?:Current|Completed|Pending) step$/.test(text) ||
          /^\d+(?:\/\d+ 步骤)?$/.test(text))
        assert.ok(entries.length >= 8, 'Expected titles, badges and stage/step numbers')
        for (const { text, foreground, background } of entries) {
          const ratio = contrast(foreground, background)
          assert.ok(ratio >= 4.5, `${text}: contrast ${ratio.toFixed(2)} < 4.5:1`)
        }
      })
    }
  }
}

// ---- Compact popover row: inline activate action (feat-10-20) -------------
// renderViews pins board.currentTask to `selected`, so the selected × active
// matrix cannot be built through it; call KanbanBoard directly instead.
const flat = (node, out = []) => {
  if (node == null || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) flat(child, out)
  return out
}
const buildBoard = (selected, currentTask, overrides = {}) => {
  const props = {
    board: { tasks, currentTask },
    selected,
    t: (key) => client.zh[key] || key,
    filter: 'all',
    busy: false,
    expanded: new Set(),
    onToggle: () => {},
    onSelect: () => {},
    onActivate: () => {},
    onDeactivate: () => {},
    onFilterChange: () => {},
  }
  const tree = client.KanbanBoard(Object.assign(props, overrides))
  const rows = flat(tree).filter(
    (node) => node.type === 'div' && node.props.style && node.props.style.position === 'relative',
  )
  return { tree, rows }
}
const texts = (node, out = []) => {
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (node == null || typeof node !== 'object') return out
  for (const child of node.children || []) texts(child, out)
  return out
}
const rowOf = (rows, task) => {
  const row = rows.find((node) => texts(node).includes(task.title))
  assert.ok(row, 'missing row for ' + task.slug)
  return row
}
const rowButtons = (row) => flat(row).filter((node) => node.type === 'button')
const buttonsLabelled = (row, label) =>
  rowButtons(row).filter((node) => String(node.props['aria-label'] || '').startsWith(label))
const activateButtons = (row) => buttonsLabelled(row, client.zh.activate)
const deactivateButtons = (row) => buttonsLabelled(row, client.zh.deactivate)

test('compact row never nests buttons and always keeps exactly one row action', () => {
  const [first, second] = tasks

  // selected && !active: the row stays actionable (regression: an earlier
  // design hid the button as soon as the row became selected).
  const selectedNotActive = buildBoard(first.slug, second.slug)
  for (const row of selectedNotActive.rows) {
    for (const button of rowButtons(row)) {
      assert.equal(
        flat(button).filter((node) => node.type === 'button').length, 1,
        'row actions must not be nested inside another button',
      )
    }
    assert.equal(row.props.style.boxSizing, 'border-box', 'row must set border-box')
  }
  assert.equal(activateButtons(rowOf(selectedNotActive.rows, first)).length, 1)
  assert.equal(deactivateButtons(rowOf(selectedNotActive.rows, first)).length, 0)
  assert.equal(activateButtons(rowOf(selectedNotActive.rows, second)).length, 0, 'active row offers no activate')
  assert.equal(deactivateButtons(rowOf(selectedNotActive.rows, second)).length, 1, 'active row offers deactivate')

  // selected && active: still exactly one action, and it is the stop button.
  const selectedActive = buildBoard(first.slug, first.slug)
  const activeRow = rowOf(selectedActive.rows, first)
  assert.equal(activateButtons(activeRow).length, 0)
  assert.equal(deactivateButtons(activeRow).length, 1)
  assert.equal(deactivateButtons(activeRow)[0].props.title, client.zh.deactivate)
  assert.ok(
    flat(deactivateButtons(activeRow)[0]).some((node) => node.type === 'rect'),
    'deactivate button must render the stop square',
  )

  // neither selected nor active: plain play button, no stop button.
  const neighbour = rowOf(selectedActive.rows, tasks[2])
  assert.equal(activateButtons(neighbour).length, 1)
  assert.equal(deactivateButtons(neighbour).length, 0)

  // No row may carry a static status dot any more: "active" is expressed by the
  // stop button only, so a stray 8px brand dot would be a silent regression.
  const staticDots = (row) =>
    flat(row).filter((node) => node.props && node.props.style &&
      node.props.style.width === 8 && node.props.style.background === client.TB.color.brand)
  for (const row of [...selectedNotActive.rows, ...selectedActive.rows]) {
    assert.equal(staticDots(row).length, 0, 'no static brand status dot in the compact row')
  }
})

// These assertions are the gate for the prop pass-through and the busy guard:
// without them `busy` / `onActivate` could be dropped from KanbanBoard's map and
// every other test would still pass (verified by in-memory mutation).
test('compact row activate button renders the play glyph and honours busy', () => {
  const [first] = tasks
  const idle = firstActivate(rowOf(buildBoard(first.slug, tasks[1].slug).rows, first))
  assert.equal(idle.props.disabled, false)
  assert.equal(idle.props.style.opacity, 1)
  assert.equal(idle.props.style.cursor, 'pointer')
  assert.equal(idle.props.title, client.zh.activate)
  const glyph = flat(idle).find((node) => node.type === 'svg')
  assert.ok(glyph, 'activate button must contain the play svg')
  assert.ok(
    flat(glyph).some((node) => node.props && node.props.d === 'M7 4.5v15l13-7.5-13-7.5Z'),
    'play glyph must use the stroke path',
  )

  const busyRow = rowOf(buildBoard(first.slug, tasks[1].slug, { busy: true }).rows, first)
  const busyButton = firstActivate(busyRow)
  assert.equal(busyButton.props.disabled, true)
  assert.equal(busyButton.props.style.opacity, 0.5)
  assert.equal(busyButton.props.style.cursor, 'not-allowed')
})

test('clicking the activate button selects first, then binds, and stops propagation', () => {
  const [first] = tasks
  const calls = []
  const board = buildBoard(first.slug, tasks[1].slug, {
    onSelect: (slug) => calls.push(['select', slug]),
    onActivate: (slug) => calls.push(['activate', slug]),
  })
  const button = firstActivate(rowOf(board.rows, first))
  let stopped = 0
  button.props.onClick({ stopPropagation: () => { stopped += 1 } })

  assert.equal(stopped, 1, 'row click must not bubble to the popover')
  assert.deepEqual(calls, [['select', first.slug], ['activate', first.slug]])

  // The handler must also survive a synthetic event without stopPropagation.
  const noEvent = buildBoard(first.slug, tasks[1].slug, {
    onSelect: () => calls.push(['select2', first.slug]),
    onActivate: () => calls.push(['activate2', first.slug]),
  })
  firstActivate(rowOf(noEvent.rows, first)).props.onClick(undefined)
  assert.deepEqual(calls.slice(2), [['select2', first.slug], ['activate2', first.slug]])
})

// Guarded accessor: a missing button should read as "row lost its action",
// not as a TypeError on undefined.props.
const firstActivate = (row) => {
  const button = activateButtons(row)[0]
  assert.ok(button, 'expected the row to keep its activate button')
  return button
}
const firstDeactivate = (row) => {
  const button = deactivateButtons(row)[0]
  assert.ok(button, 'expected the active row to keep its deactivate button')
  return button
}

test('active row stop button clears the session binding and honours busy', () => {
  const [first] = tasks
  let deactivated = 0
  let selectedCalls = 0
  const board = buildBoard(first.slug, first.slug, {
    onDeactivate: () => { deactivated += 1 },
    // Clearing the binding must not move the row the user is looking at.
    onSelect: () => { selectedCalls += 1 },
  })
  const stop = firstDeactivate(rowOf(board.rows, first))
  assert.equal(stop.props.disabled, false)
  assert.equal(stop.props.style.cursor, 'pointer')

  let stopped = 0
  stop.props.onClick({ stopPropagation: () => { stopped += 1 } })
  assert.equal(stopped, 1, 'stop click must not bubble to the popover')
  assert.equal(deactivated, 1)
  assert.equal(selectedCalls, 0, 'stop click must not change the selected row')
  // A synthetic event without stopPropagation must still work.
  stop.props.onClick(undefined)
  assert.equal(deactivated, 2)
  assert.equal(selectedCalls, 0)

  const busyStop = firstDeactivate(rowOf(buildBoard(first.slug, first.slug, { busy: true }).rows, first))
  assert.equal(busyStop.props.disabled, true)
  assert.equal(busyStop.props.style.opacity, 0.5)
  assert.equal(busyStop.props.style.cursor, 'not-allowed')
})
