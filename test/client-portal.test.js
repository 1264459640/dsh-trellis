import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSource, loadClient, renderViews, tasks } from './helpers/client-theme.js'

const noop = () => {}
const flat = (node, out = []) => {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) flat(child, out)
  return out
}
const t = (key) => key

test('expanded modal portals to body, not a transformed or clipped seat', () => {
  const body = { name: 'body' }
  const calls = []
  const client = loadClient(clientSource, {
    globals: { document: { body } },
    dom: { createPortal: (node, target) => {
      calls.push({ node, target })
      return { type: 'portal', target, children: [node] }
    } },
  })
  const node = renderViews(client).board
  const portal = client.renderExpandedModal(node)
  assert.equal(portal.type, 'portal')
  assert.equal(portal.target, body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].node, node)
  assert.equal(node.props.style.position, 'fixed')
  assert.equal(node.props.style.inset, 0)
  assert.equal(node.props.style.pointerEvents, 'auto')
  assert.equal(node.props.style.boxSizing, 'border-box')
  assert.equal(node.props.style.isolation, 'isolate')
  assert.equal(client.renderExpandedModal(null), null)
  assert.equal(calls.length, 1, 'closed modal must not create an empty portal')
})

for (const [name, options] of Object.entries({
  'missing react-dom': { globals: { document: { body: {} } } },
  'no portal function': { globals: { document: { body: {} } }, dom: {} },
  'null module': { globals: { document: { body: {} } }, dom: null },
  'non-function export': { globals: { document: { body: {} } }, dom: { createPortal: true } },
  'no document': { dom: { createPortal: () => assert.fail('no DOM') } },
  'no body': { globals: { document: {} }, dom: { createPortal: () => assert.fail('no body') } },
})) {
  test('inline fallback is safe with ' + name, () => {
    const client = loadClient(clientSource, options)
    const node = renderViews(client).board
    assert.equal(client.renderExpandedModal(node), node)
    assert.equal(client.renderExpandedModal(null), null)
  })
}

// Exercise the real TaskChip call site, not only the helper: a helper-only test
// would pass if the modal accidentally returned to the slot root on a refactor.
function chipFixture({ open = false, expanded = false } = {}) {
  const body = {}
  const state = [
    { loading: false, summary: { kind: 'no-task' }, failed: false },
    open,
    { tasks, currentTask: tasks[0].slug },
    false, tasks[0].slug, false, 'all', false, expanded,
  ]
  let index = 0
  return loadClient(clientSource, {
    globals: { document: { body } },
    dom: { createPortal: (node, target) => ({ type: 'portal', target, children: [node] }) },
    react: { useState: (initial) => [index < state.length ? state[index++] : initial, noop] },
  })
}
for (const seat of ['header', 'hero']) {
  test(seat + ': TaskChip routes expanded modal through portal', () => {
    const client = chipFixture({ expanded: true })
    const props = { session: { blank: true }, sessionId: 'fixture', t }
    const tree = seat === 'hero' ? client.HeroTaskChip(props) : client.TaskChip(props)
    const portals = flat(tree).filter((n) => n.type === 'portal')
    assert.equal(portals.length, 1)
    assert.equal(flat(portals[0]).filter((n) => n.props?.className === 'tw-overlay').length, 1)
    assert.equal(flat(tree).filter((n) => n.props?.className === 'tw-pop').length, 0)
  })
  test(seat + ': compact popover stays anchored and never uses portal', () => {
    const client = chipFixture({ open: true })
    const props = { session: { blank: true }, sessionId: 'fixture', t }
    const tree = seat === 'hero' ? client.HeroTaskChip(props) : client.TaskChip(props)
    assert.equal(flat(tree).filter((n) => n.type === 'portal').length, 0)
    assert.equal(flat(tree).filter((n) => n.props?.className === 'tw-pop').length, 1)
  })
}

test('modal loading frame and backdrop dismissal remain safe', () => {
  const client = loadClient()
  let closed = 0
  const tree = client.KanbanExpandedModal({ board: null, t, onClose: () => closed++ })
  const dialog = flat(tree).find((n) => n.props?.role === 'dialog')
  assert.ok(dialog, 'loading still renders a dialog')
  assert.ok(flat(tree).some((n) => n.props?.className === 'tw-skeleton'))
  const overlay = {}
  tree.props.onMouseDown({ target: dialog, currentTarget: overlay })
  assert.equal(closed, 0, 'content interaction must not dismiss the modal')
  tree.props.onMouseDown({ target: overlay, currentTarget: overlay })
  assert.equal(closed, 1)
})
