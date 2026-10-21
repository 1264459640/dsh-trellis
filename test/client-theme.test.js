import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSource, loadClient, palettes, renderViews, tasks } from './helpers/client-theme.js'

// This is deliberately a small evaluator for the color expressions the bundle
// uses, not a CSS engine. Unknown syntax fails closed; browser validation covers
// actual computed styles and live theme switching separately.
function color(value, palette) {
  value = value.replace(/var\((--[\w-]+),\s*([^()]+)\)/g,
    (_, name, fallback) => palette[name] || fallback).trim()
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)$/.exec(value)
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
const flat = (node, out = []) => {
  if (node == null || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) flat(child, out)
  return out
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

const client = loadClient()
const zh = client.zh
const t = (key) => zh[key] || key

test('kanban uses real host surface aliases, never nonexistent layer zero', () => {
  assert.doesNotMatch(clientSource, /--dsw-alias-bg-layer-0/)
  for (const key of ['surface', 'surfaceRaised', 'well']) {
    const light = color(client.TB.color[key], palettes.light)
    const dark = color(client.TB.color[key], palettes.dark)
    assert.notDeepEqual(dark, light, key + ' must follow host theme')
    assert.ok(luminance(dark) < 0.15, key + ' must stay dark in dark mode')
  }
})

// Design v2 visual rule: one accent. No colored type badges, no hardcoded
// near-black CTA that vanishes in dark mode, no v1 selection leftovers.
test('design v2 drops colored type badges and v1 selection tokens', () => {
  for (const gone of ['featBg', 'issueBg', 'refactorBg', 'raised', 'ink', 'selectBg', 'selectBgPop', 'accentBright', 'brandBar', 'ring']) {
    assert.equal(client.TB.color[gone], undefined, gone + ' must not come back')
  }
  assert.doesNotMatch(clientSource, /#0B0C0D/i)
})

// No host tokens exercises standalone fallbacks. Literal strings from the
// rendered tree ensure titles, type/stage text, step counts and step titles
// are checked on their actual ancestor backgrounds, including selected rows.
const readable = (text) =>
  tasks.some((task) => text === task.title) ||
  ['功能', '缺陷', '重构', '当前', '阻塞', '待验证', '解除绑定', '推进任务', '激活任务', '人工'].includes(text) ||
  /(?:Completed|Current|Pending) step$/.test(text) ||
  /^验收：/.test(text) ||
  /^\d+\/\d+(?: 步骤)?$/.test(text) ||
  / · /.test(text)
for (const [mode, palette] of Object.entries({ fallback: {}, light: palettes.light, dark: palettes.dark })) {
  for (const selected of tasks.map((task) => task.slug)) {
    for (const [view, tree] of Object.entries(renderViews(client, selected))) {
      test(`${mode} ${view} selected=${selected}: text is readable`, () => {
        const base = color(palette['--dsw-alias-bg-base'] || '#ffffff', palette)
        const text = color(palette['--dsw-alias-label-primary'] || '#0f172a', palette)
        const entries = textColors(tree, palette, base, text).filter(({ text }) => readable(text))
        assert.ok(entries.length >= 8, 'Expected titles, meta and step text, got ' + entries.length)
        for (const { text, foreground, background } of entries) {
          const ratio = contrast(foreground, background)
          assert.ok(ratio >= 4.5, `${text}: contrast ${ratio.toFixed(2)} < 4.5:1`)
        }
      })
    }
  }
}

// ---- Popover: current-task card + grouped rows ---------------------------
const buildBoard = (selected, currentTask, overrides = {}) => {
  const props = {
    board: { tasks, currentTask },
    selected,
    t,
    filter: 'all',
    busy: false,
    stepsOpen: false,
    onToggleSteps: () => {},
    onSelect: () => {},
    onActivate: () => {},
    onDeactivate: () => {},
  }
  const tree = client.KanbanBoard(Object.assign(props, overrides))
  const rows = flat(tree).filter((node) => node.type === 'div' && node.props.role === 'listitem')
  const card = flat(tree).find((node) => node.props && node.props['data-current-card'] === 'true') || null
  return { tree, rows, card }
}
const rowOf = (rows, task) => rows.find((node) => texts(node).includes(task.title)) || null
const buttons = (node) => flat(node).filter((n) => n.type === 'button')
const labelled = (node, label) => buttons(node).filter((n) => String(n.props['aria-label'] || '').startsWith(label))

test('current task lives in the card (with steps), not in the row list', () => {
  const [first, second] = tasks
  const { rows, card } = buildBoard(second.slug, first.slug)
  assert.ok(card, 'current-task card must render when a task is bound')
  assert.ok(texts(card).includes(first.title))
  assert.equal(rowOf(rows, first), null, 'the bound task must not be repeated as a row')
  assert.ok(rowOf(rows, second) && rowOf(rows, tasks[2]), 'every other open task gets a row')
  // Steps are kept visible on the card.
  assert.ok(texts(card).includes('Current step'), 'card shows the step checklist')
  // Exactly one unbind action, on the card, labelled with the task title.
  assert.equal(labelled(card, zh.deactivate).length, 1)
  for (const row of rows) assert.equal(labelled(row, zh.deactivate).length, 0, 'rows never carry the unbind action')
})

test('no bound task: the card becomes a pick-one prompt and every open task is a row', () => {
  const { rows, card, tree } = buildBoard(tasks[0].slug, null)
  assert.equal(card, null)
  assert.ok(texts(tree).includes(zh.noCurrentTask))
  assert.equal(rows.length, tasks.length)
})

test('rows never nest buttons and keep exactly one ▶ action', () => {
  const { rows } = buildBoard(tasks[1].slug, tasks[0].slug)
  assert.ok(rows.length >= 2)
  for (const row of rows) {
    assert.equal(row.props.style.boxSizing, 'border-box', 'row must set border-box')
    for (const b of buttons(row)) {
      assert.equal(buttons(b).length, 1, 'row actions must not be nested inside another button')
    }
    const play = labelled(row, zh.activate)
    assert.equal(play.length, 1, 'each row has exactly one activate action')
    assert.ok(flat(play[0]).some((n) => n.props && n.props.d === 'M7 4.5v15l13-7.5-13-7.5Z'), 'play glyph uses the stroke path')
  }
})

test('row ▶ selects first, then binds, stops propagation and honours busy', () => {
  const [first, second] = tasks
  const calls = []
  const { rows } = buildBoard(second.slug, first.slug, {
    onSelect: (slug) => calls.push(['select', slug]),
    onActivate: (slug) => calls.push(['activate', slug]),
  })
  const play = labelled(rowOf(rows, second), zh.activate)[0]
  assert.equal(play.props.disabled, false)
  assert.equal(play.props.style.cursor, 'pointer')
  let stopped = 0
  play.props.onClick({ stopPropagation: () => { stopped += 1 } })
  assert.equal(stopped, 1, 'row click must not bubble to the popover')
  assert.deepEqual(calls, [['select', second.slug], ['activate', second.slug]])
  play.props.onClick(undefined) // synthetic event without stopPropagation
  assert.equal(calls.length, 4)

  const busy = labelled(rowOf(buildBoard(second.slug, first.slug, { busy: true }).rows, second), zh.activate)[0]
  assert.equal(busy.props.disabled, true)
  assert.equal(busy.props.style.opacity, 0.5)
  assert.equal(busy.props.style.cursor, 'not-allowed')
})

test('card unbind clears the binding, stops propagation and honours busy', () => {
  const [first] = tasks
  let deactivated = 0
  let selectCalls = 0
  const { card } = buildBoard(first.slug, first.slug, {
    onDeactivate: () => { deactivated += 1 },
    onSelect: () => { selectCalls += 1 },
  })
  const stop = labelled(card, zh.deactivate)[0]
  let stopped = 0
  stop.props.onClick({ stopPropagation: () => { stopped += 1 } })
  assert.equal(stopped, 1)
  assert.equal(deactivated, 1)
  assert.equal(selectCalls, 0, 'unbinding must not move the selection')
  const busyStop = labelled(buildBoard(first.slug, first.slug, { busy: true }).card, zh.deactivate)[0]
  assert.equal(busyStop.props.disabled, true)
})

// v2 selection model: a quiet tint only. No brand border, no accent bar, no
// absolute decoration inside rows.
test('selected rows carry no border, bar or absolutely positioned decoration', () => {
  const views = renderViews(client, tasks[1].slug)
  const { rows } = buildBoard(tasks[1].slug, tasks[0].slug)
  const tableRows = flat(views.board).filter((n) => n.props && /tw-tr/.test(n.props.className || ''))
  assert.ok(tableRows.length >= tasks.length)
  const selectedTable = tableRows.find((n) => n.props['data-selected'] === 'true')
  assert.equal(selectedTable.props.style.background, client.TB.color.brandTint)
  for (const row of [...rows, ...tableRows]) {
    for (const n of flat(row)) {
      const s = (n.props && n.props.style) || {}
      assert.ok(!Object.entries(s).some(([k, v]) => /^border/.test(k) && String(v).includes(client.TB.color.brand)), 'no brand border')
      if (n !== row) assert.notEqual(s.position, 'absolute', 'no absolutely positioned bar/dot')
    }
  }
})

// ---- Step checklist --------------------------------------------------------
const step = (title, status, extra = {}) => ({ id: title, title, status, ...extra })
const stepRows = (tree) => flat(tree).filter((n) => n.type === 'li')

test('StepList emphasises the current step with acceptance and the human tag', () => {
  const tree = client.StepList({
    t,
    steps: [step('A', 'completed'), step('B', 'in_progress', { acceptance: ['x', 'y'], verification: 'human' }), step('C', 'pending')],
  })
  const lis = stepRows(tree)
  assert.equal(lis.length, 3)
  const cur = lis.find((li) => li.props['data-step-current'] === 'true')
  assert.ok(cur && texts(cur).includes('B'))
  assert.ok(texts(cur).includes(zh.acceptanceLabel + '：x；y'))
  assert.ok(texts(cur).includes(zh.humanTag))
  assert.ok(texts(cur).includes(zh.stepInProgress))
})

test('StepList shows the blocked reason on a blocked current step', () => {
  const tree = client.StepList({ t, steps: [step('A', 'completed'), step('B', 'blocked', { blockedReason: 'waiting' })] })
  assert.ok(texts(tree).includes(zh.blocked + '：waiting'))
})

test('StepList compact folds earlier completed steps but keeps the last one', () => {
  const steps = [step('A', 'completed'), step('B', 'completed'), step('C', 'completed'), step('D', 'verifying'), step('E', 'pending')]
  const compact = client.StepList({ t, steps, compact: true })
  const all = texts(compact)
  assert.ok(all.includes(zh.stepsFolded.replace('{n}', '2')))
  assert.ok(!all.includes('A') && !all.includes('B'))
  assert.ok(all.includes('C') && all.includes('D') && all.includes('E'))
  const full = texts(client.StepList({ t, steps }))
  for (const s of 'ABCDE') assert.ok(full.includes(s))
})

test('StepList renders an empty hint without steps', () => {
  assert.ok(texts(client.StepList({ t, steps: [] })).includes(zh.noSteps))
})

test('expanded board details show the full step checklist for the selection', () => {
  const tree = renderViews(client, tasks[0].slug).board
  const aside = flat(tree).find((n) => n.type === 'aside')
  assert.ok(aside)
  for (const s of ['Completed step', 'Current step', 'Pending step']) assert.ok(texts(aside).includes(s))
})
