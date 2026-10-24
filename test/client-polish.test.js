// feat-10-24-task-picker-kanban-polish: token discipline, calmer status
// colors, the single-card current task, the table header, keyboard selection
// in the expanded board and popover focus management. Every assertion runs
// the real bundle (loadClient), never a copy of the components.
import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSource, loadClient, renderViews, tasks } from './helpers/client-theme.js'

const flat = (node, out = []) => {
  if (node == null || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) flat(child, out)
  return out
}
const texts = (node) => flat(node).flatMap((n) => (n.children || []).filter((c) => typeof c === 'string' || typeof c === 'number').map(String))
const styleOf = (n) => (n && n.props && n.props.style) || {}

const client = loadClient()
const zh = client.zh
const t = (key) => zh[key] || key
const kanban = (() => {
  const a = clientSource.indexOf('// #region lib/types/client/trellis-kanban.js')
  const b = clientSource.indexOf('function apply(ctx)')
  assert.ok(a > 0 && b > a, 'kanban region markers')
  return clientSource.slice(a, b)
})()

// ---- tokens ---------------------------------------------------------------

test('type and radius scales are small and whole-pixel', () => {
  assert.deepEqual(Object.values(client.TB.T), [11, 12, 13, 15])
  assert.ok(Object.keys(client.TB.R).length <= 5)
  for (const gone of ['popover', 'modal', 'card', 'row', 'ctrl']) assert.equal(client.TB.R[gone], undefined, 'old radius ' + gone)
  assert.equal(client.TB.S.inset, undefined, 'card-in-card inset shadow is gone')
})

test('kanban components use tokens, not scattered size literals', () => {
  assert.doesNotMatch(kanban, /fontSize: \d/, 'fontSize must reference TB.T')
  assert.doesNotMatch(kanban, /borderRadius: \d/, 'borderRadius must reference TB.R')
  assert.doesNotMatch(kanban, /'(?:\d{3} )?\d+\.5px/, 'no half-pixel font shorthands')
})

// Every rendered node in both views: font sizes come from the scale.
test('every rendered font size is on the scale', () => {
  const scale = new Set(Object.values(client.TB.T))
  for (const [view, tree] of Object.entries(renderViews(client, tasks[1].slug))) {
    for (const n of flat(tree)) {
      const fs = styleOf(n).fontSize
      if (fs !== undefined) assert.ok(scale.has(fs), `${view}: off-scale fontSize ${fs}`)
    }
  }
})

// ---- calmer state colors --------------------------------------------------

test('completed progress is neutral in the table row and the details pane', () => {
  const done = { ...tasks[0], slug: 'p-done', title: 'Done', status: 'completed', phase: 'completed', archived: true }
  // Script useState(query='', doneOpen=true) so the completed group renders its table row.
  let i = 0
  const c = loadClient(undefined, { react: { useState: (init) => [['', true][i++] ?? init, () => {}] } })
  const tree = c.KanbanExpandedModal({
    board: { tasks: [done], currentTask: null }, t: (k) => c.zh[k] || k, selected: 'p-done', filter: 'all', busy: false,
    onSelect() {}, onActivate() {}, onDeactivate() {}, onFilterChange() {}, onClose() {},
  })
  const fill = (n) => flat(n).filter((x) => styleOf(x).transition === 'width .25s ease')
  const row = flat(tree).find((n) => n.props && n.props['data-slug'] === 'p-done')
  const aside = flat(tree).find((n) => n.type === 'aside')
  assert.ok(row && aside)
  for (const [where, node] of [['row', row], ['details', aside]]) {
    const fills = fill(node)
    assert.equal(fills.length, 1, where + ' renders one progress fill')
    assert.equal(styleOf(fills[0]).background, c.TB.color.doneFill, where + ' completed bar is neutral')
  }
  // Green survives only on the status dot.
  const dot = flat(row).find((n) => n.type === 'span' && styleOf(n).borderRadius === '50%')
  assert.equal(styleOf(dot).background, c.TB.color.successSoft)
})

test('the bound task gets a static halo, never an infinite pulse', () => {
  assert.doesNotMatch(client.TW_CSS, /infinite;?\s*}\s*\n?\s*\.tw-skeleton|tw-live[^}]*infinite/, '.tw-live must not loop')
  assert.match(client.TW_CSS, /\.tw-live \{ animation: tw-live \.6s ease-out 1; \}/)
  const tree = renderViews(client, tasks[0].slug).board
  const live = flat(tree).filter((n) => n.props && n.props['data-live'] === 'true')
  assert.equal(live.length, 1, 'exactly the bound task carries the halo')
  assert.match(styleOf(live[0]).boxShadow, /^0 0 0 2px color-mix\(/)
  // reduced-motion still disables it.
  assert.match(client.TW_CSS, /prefers-reduced-motion[\s\S]*\.tw-live[\s\S]*animation: none !important/)
})

test('entry animations fade and nudge, never scale', () => {
  assert.doesNotMatch(client.TW_CSS, /scale\(/)
})

// ---- popover current card -------------------------------------------------

const popoverCard = (overrides = {}) => {
  const tree = client.KanbanBoard({
    board: { tasks, currentTask: tasks[0].slug }, t, selected: tasks[1].slug, filter: 'all', busy: false,
    stepsOpen: false, onToggleSteps() {}, onSelect() {}, onActivate() {}, onDeactivate() {}, ...overrides,
  })
  return flat(tree).find((n) => n.props && n.props['data-current-card'] === 'true')
}

test('current card is one surface: no nested sub-card around the steps', () => {
  const card = popoverCard()
  assert.ok(card)
  const section = flat(card).find((n) => n.props && n.props['data-step-section'] === 'true')
  assert.ok(section, 'step section renders')
  assert.ok(texts(section).includes('Current step'))
  const s = styleOf(section)
  for (const k of ['background', 'boxShadow', 'border', 'borderRadius']) assert.equal(s[k], undefined, 'step section has no ' + k)
  assert.equal(flat(card).filter((n) => n.props && n.props['data-divider'] === 'true').length, 2, 'hairlines separate steps and actions')
  assert.equal(styleOf(card).border, '1px solid ' + client.TB.color.border)
})

test('primary card action trails an arrow instead of the sparkles glyph', () => {
  const card = popoverCard()
  const primary = flat(card).find((n) => n.type === 'button' && /tw-primary/.test(n.props.className || ''))
  assert.ok(primary)
  const children = primary.children
  assert.equal(children[children.length - 1].type, 'svg', 'icon follows the label')
  assert.equal(children.filter((c) => c && c.type === 'svg').length, 1)
})

// ---- expanded board: header + segmented filter -----------------------------

const modal = (overrides = {}) =>
  client.KanbanExpandedModal({
    board: { tasks, currentTask: tasks[0].slug }, t, selected: tasks[0].slug, filter: 'all', busy: false,
    onSelect() {}, onActivate() {}, onDeactivate() {}, onFilterChange() {}, onClose() {}, ...overrides,
  })

test('table has a column header that shares the row grid', () => {
  const tree = modal()
  const head = flat(tree).find((n) => n.props && n.props['data-table-head'] === 'true')
  assert.ok(head, 'header renders')
  for (const key of ['colHeadTask', 'colHeadType', 'colHeadStage', 'colHeadProgress', 'colHeadSteps']) {
    assert.ok(texts(head).includes(zh[key]), 'zh ' + key)
    assert.ok(typeof client.zh[key] === 'string' && client.zh[key].length > 0)
  }
  const row = flat(tree).find((n) => n.props && /tw-tr/.test(n.props.className || ''))
  assert.equal(styleOf(head).gridTemplateColumns, styleOf(row).gridTemplateColumns)
  assert.equal(styleOf(head).position, 'sticky')
})

test('en locale carries the header labels too', () => {
  const en = clientSource.slice(clientSource.indexOf('const en = {'))
  for (const [key, value] of [['colHeadTask', 'Task'], ['colHeadType', 'Type'], ['colHeadStage', 'Stage'], ['colHeadProgress', 'Progress'], ['colHeadSteps', 'Steps']]) {
    assert.match(en.slice(0, en.indexOf('};')), new RegExp(key + ": '" + value + "'"))
  }
})

test('no header when no row is visible (empty, or only a folded done group)', () => {
  const head = (tree) => flat(tree).filter((n) => n.props && n.props['data-table-head'] === 'true').length
  assert.equal(head(modal({ board: { tasks: [], currentTask: null } })), 0)
  const done = { ...tasks[0], slug: 'h-done', status: 'completed', phase: 'completed', archived: true }
  assert.equal(head(modal({ board: { tasks: [done], currentTask: null } })), 0, 'folded-only table shows no header')
  assert.equal(head(modal()), 1)
})

test('arrow selection is exposed through aria-activedescendant', () => {
  const tree = modal({ selected: tasks[1].slug })
  const list = listOf(tree)
  const id = list.props['aria-activedescendant']
  assert.ok(id, 'list points at the selected row')
  const target = flat(tree).find((n) => n.props && n.props.id === id)
  assert.ok(target, 'the id resolves to a rendered row')
  assert.equal(target.props['data-slug'], tasks[1].slug)
  const ids = flat(tree).filter((n) => n.props && /tw-tr/.test(n.props.className || '')).map((n) => n.props.id)
  assert.equal(new Set(ids).size, ids.length, 'row ids are unique')
  // A selection that is not visible (folded / filtered out) is not referenced.
  assert.equal(listOf(modal({ selected: 'nope' })).props['aria-activedescendant'], undefined)
  assert.equal(listOf(modal({ selected: tasks[0].slug, filter: 'issue' })).props['aria-activedescendant'], undefined)
})

test('filter is a segmented control: pressed segment is a raised surface', () => {
  const tree = modal({ filter: 'issue' })
  const group = flat(tree).find((n) => n.props && n.props['data-segmented'] === 'true')
  assert.ok(group)
  assert.equal(styleOf(group).background, client.TB.color.well)
  const tabs = flat(group).filter((n) => n.type === 'button')
  assert.equal(tabs.length, 4)
  const pressed = tabs.filter((b) => b.props['aria-pressed'] === true)
  assert.equal(pressed.length, 1)
  assert.equal(styleOf(pressed[0]).background, client.TB.color.surfaceRaised)
  for (const b of tabs) if (b !== pressed[0]) assert.equal(styleOf(b).background, 'transparent')
})

// ---- expanded board: ↑↓ selection -----------------------------------------

const listOf = (tree) => flat(tree).find((n) => n.props && n.props.role === 'list' && typeof n.props.onKeyDown === 'function')
const press = (list, key, scrolled = []) => {
  let prevented = 0
  list.props.onKeyDown({
    key,
    preventDefault: () => { prevented++ },
    currentTarget: { querySelector: (sel) => ({ scrollIntoView: (o) => scrolled.push([sel, o]) }) },
  })
  return prevented
}

test('↑↓ in the expanded table moves selection over visible rows only', () => {
  const done = { ...tasks[0], slug: 'k-done', title: 'Done', status: 'completed', phase: 'completed', archived: true }
  const board = { tasks: [...tasks, done], currentTask: null }
  const picks = []
  const at = (selected) => listOf(modal({ board, selected, onSelect: (s) => picks.push(s) }))
  const list = at(tasks[0].slug)
  assert.equal(list.props.tabIndex, 0, 'the table is focusable')
  const scrolled = []
  assert.equal(press(list, 'ArrowDown', scrolled), 1)
  assert.deepEqual(picks, [tasks[1].slug])
  assert.equal(JSON.stringify(scrolled), JSON.stringify([['[data-slug="' + tasks[1].slug + '"]', { block: 'nearest' }]]))
  press(at(tasks[0].slug), 'ArrowUp')
  assert.equal(picks.at(-1), tasks[0].slug, 'clamps at the top')
  // The folded completed group is not reachable by keyboard.
  const last = tasks.at(-1).slug
  press(at(last), 'ArrowDown')
  assert.equal(picks.at(-1), last, 'clamps at the last visible row, skipping folded rows')
  // Unknown selection starts from the first visible row.
  press(at(null), 'ArrowDown')
  assert.equal(picks.at(-1), tasks[0].slug)
  // Other keys are ignored and not prevented.
  const before = picks.length
  assert.equal(press(list, 'Enter'), 0)
  assert.equal(picks.length, before, 'Enter does not bind from the table (binding lives in the details pane)')
})

test('a filter narrows keyboard navigation to the filtered rows', () => {
  const picks = []
  const list = listOf(modal({ filter: 'refactor', selected: null, onSelect: (s) => picks.push(s) }))
  press(list, 'ArrowDown')
  press(list, 'ArrowDown')
  assert.deepEqual([...new Set(picks)], ['theme-refactor'])
})

// ---- popover focus management ---------------------------------------------

// Hook harness for TaskChip: scripted state, real refs, collected effects.
// fetch/window are stubbed so every effect runs to completion; any throw fails the test.
function chipHarness({ open, board }) {
  const effects = []
  const refs = []
  const state = [
    { loading: false, summary: { kind: 'task', title: 'T', stage: 'impl', phase: 'in_progress' }, failed: false },
    open, board, false, board && board.tasks[1] ? board.tasks[1].slug : null, false, 'all', false, false,
  ]
  let i = 0
  const listeners = {}
  const document = {
    activeElement: null,
    body: {},
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) },
    removeEventListener() {},
  }
  const pending = { then() { return pending }, catch() { return pending }, finally() { return pending } }
  const fetch = () => pending
  const win = { addEventListener() {}, removeEventListener() {} }
  const c = loadClient(clientSource, {
    globals: { document, fetch },
    window: win,
    react: {
      useState: (init) => [i < state.length ? state[i++] : init, () => {}],
      useEffect: (fn) => effects.push(fn),
      useRef: (current) => { const r = { current }; refs.push(r); return r },
    },
  })
  const tree = c.TaskChip({ sessionId: 's', t: (k) => c.zh[k] || k })
  const run = () => effects.forEach((fn) => fn())
  return { tree, effects, refs, document, listeners, run }
}
// Options objects come from the vm realm; normalise them so deepEqual compares values.
const focusable = (name, log) => ({ name, focus: (opts) => log.push([name, opts === undefined ? undefined : JSON.parse(JSON.stringify(opts))]) })

test('opening the popover focuses the task list once the board is in', () => {
  const log = []
  const h = chipHarness({ open: true, board: { tasks, currentTask: tasks[0].slug } })
  const [, chipRef, popRef] = h.refs
  const list = focusable('list', log)
  popRef.current = { contains: () => false, querySelector: (sel) => (sel === '.tw-list' ? list : null) }
  chipRef.current = focusable('chip', log)
  h.run()
  assert.deepEqual(log, [['list', { preventScroll: true }]])
})

test('without other tasks, focus lands on the card primary action', () => {
  const log = []
  const h = chipHarness({ open: true, board: { tasks: [tasks[0]], currentTask: tasks[0].slug } })
  const [, , popRef] = h.refs
  const primary = focusable('primary', log)
  popRef.current = { contains: () => false, querySelector: (sel) => (sel === '.tw-primary' ? primary : null) }
  h.run()
  assert.deepEqual(log, [['primary', { preventScroll: true }]])
})

test('focus is not stolen when it is already inside the popover', () => {
  const log = []
  const h = chipHarness({ open: true, board: { tasks, currentTask: tasks[0].slug } })
  const [, , popRef] = h.refs
  popRef.current = { contains: () => true, querySelector: () => focusable('list', log) }
  h.run()
  assert.deepEqual(log, [])
})

test('Escape from inside the popover returns focus to the chip', () => {
  const log = []
  const h = chipHarness({ open: true, board: { tasks, currentTask: tasks[0].slug } })
  const [rootRef, chipRef, popRef] = h.refs
  let inside = true
  popRef.current = { contains: () => inside, querySelector: () => null }
  chipRef.current = focusable('chip', log)
  // A real root so the outside-click branch is exercised, not skipped by a null ref.
  const rootEl = { contains: (el) => el === 'in-root' }
  rootRef.current = rootEl
  h.run()
  const keydowns = h.listeners.keydown || []
  assert.ok(keydowns.length >= 1)
  keydowns.forEach((fn) => fn({ key: 'ArrowDown' }))
  assert.deepEqual(log, [], 'other keys leave focus alone')
  keydowns.forEach((fn) => fn({ key: 'Escape' }))
  assert.deepEqual(log, [['chip', undefined]])
  // Escape while focus is elsewhere does not yank it to the chip.
  log.length = 0
  inside = false
  keydowns.forEach((fn) => fn({ key: 'Escape' }))
  assert.deepEqual(log, [])
  // Outside clicks close without moving focus.
  const downs = h.listeners.mousedown || []
  assert.ok(downs.length >= 1)
  downs.forEach((fn) => fn({ target: 'outside' }))
  assert.deepEqual(log, [])
})

test('chip is a grounded control: hairline at rest, chip ref wired', () => {
  const h = chipHarness({ open: false, board: null })
  const chip = flat(h.tree).find((n) => n.type === 'button' && /tw-chip/.test(n.props.className || ''))
  assert.ok(chip)
  assert.equal(styleOf(chip).boxShadow, 'inset 0 0 0 1px ' + client.TB.color.border)
  assert.equal(styleOf(chip).borderRadius, client.TB.R.sm)
  assert.equal(chip.props.ref, h.refs[1], 'chip button carries the focus-return ref')
})
