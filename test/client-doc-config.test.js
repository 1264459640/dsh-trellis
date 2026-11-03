import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clientSource, loadClient } from './helpers/client-theme.js'
import { MAX_DOC_FILE_BUDGET_KB, MAX_DOC_TOTAL_BUDGET_KB } from '../lib/spec.js'

const noop = () => {}

/** Collect every node in a rendered tree. */
function flat(node, out = []) {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) flat(child, out)
  return out
}

/** Collect every literal text child of a rendered tree. */
function textOf(node) {
  return flat(node)
    .flatMap((item) => (item.children || []).filter((child) => typeof child === 'string'))
    .join(' ')
}

/**
 * Render DocConfigView with scripted hook state.
 *
 * The bundle is executed for real; only React's hook plumbing is scripted, so
 * the assertions read the component's actual render output for a given state.
 * Hook order: snapshot, draft, preview, errors, status, busy, notice, input,
 * reloadKey.
 */
function renderDoc(state) {
  const script = [
    state.snapshot === undefined ? null : state.snapshot,
    state.draft || { root: '', files: [], budgets: { fileKb: '', totalKb: '' } },
    state.preview === undefined ? null : state.preview,
    state.errors || { root: null, list: null, rows: {}, budget: { file: null, total: null } },
    state.status || 'ready',
    state.busy === true,
    state.notice || null,
    state.input || '',
    0,
  ]
  let index = 0
  const client = loadClient(clientSource, {
    react: { useState: (initial) => [index < script.length ? script[index++] : initial, noop] },
  })
  const t = (key) => client.zh[key] || key
  return { client, tree: client.DocConfigView({ sessionId: 'sess-1', t }), t }
}

test('the doc editor registers as a top-level conversation view, not a settings seat', () => {
  const client = loadClient()
  const registrations = []
  const injected = []
  const declared = new Set([
    'conversation.view',
    'plugins.bundle.config',
    'conversation.session.header.utilities',
    'conversation.input.dock',
  ])
  const ctx = {
    effect: () => () => {},
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(name, register) {
        injected.push(name)
        if (!declared.has(name)) return () => {}
        return register()
      },
      register(options, component) {
        if (!declared.has(options.name)) throw new Error('undeclared slot: ' + options.name)
        registrations.push({ options, component })
        return () => {}
      },
    },
    configForms: {
      describe: () => ({
        subscribe: () => () => {},
        ensure: () => {},
        getSnapshot: () => ({ view: { namespaces: [] } }),
      }),
      get: () => assert.fail('no entry should be fetched while nothing is served'),
    },
  }
  client.apply(ctx)

  const view = registrations.find((registration) => registration.options.name === 'conversation.view')
  assert.ok(view, 'the project document view must register on conversation.view')
  assert.equal(view.options.id, 'trellis-workflow:docs')
  assert.equal(view.options.order, 20)
  assert.equal(view.options.locale, 'settings.trellisWorkflow')
  assert.equal(typeof view.options.label, 'function')
  assert.equal(view.options.label(), 'viewDocs')
  assert.equal(typeof view.component, 'function')
  assert.ok(injected.includes('conversation.view'), 'apply() must inject the view seat')

  // It must NOT add a second settings surface: the only settings registration
  // stays the bundle config card.
  assert.equal(registrations.filter((registration) => registration.options.name === 'plugins.bundle.config').length, 1)
})

test('package.json declares the conversation package that owns the view seat', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'))
})

test('the locale dictionaries carry the view label in both languages', () => {
  const client = loadClient()
  assert.equal(client.zh.viewDocs, '项目文档')
  assert.equal(client.zh.docTitle, '项目文档注入')
  for (const key of ['docSave', 'docStateInvalid', 'docStatusTruncated', 'docErrMissing']) {
    assert.ok(client.zh[key], 'zh dictionary is missing ' + key)
  }
})

test('docStatusMeta maps planned states to copy and colour', () => {
  const { client } = renderDoc({})
  const t = (key) => key
  assert.equal(client.docStatusMeta('full', t).label, 'docStatusFull')
  // The truncation badge carries the CONFIGURED per-file cap, not a constant.
  assert.equal(client.docStatusMeta('truncated', t, '16 KB').label, 'docStatusTruncated 16 KB')
  assert.equal(client.docStatusMeta('over-budget', t).label, 'docStatusOver')
  assert.equal(client.docStatusMeta('unreadable', t).label, 'docStatusUnreadable')
  assert.equal(client.docStatusMeta(null, t).label, 'docStatusFull')
})

test('docBudgetInputError mirrors the server rules without a round-trip', () => {
  const { client } = renderDoc({})
  const t = (key) => key
  assert.equal(client.docBudgetInputError('', 'file', t), null, 'blank inherits the default')
  assert.equal(client.docBudgetInputError('16', 'file', t), null)
  assert.equal(client.docBudgetInputError('128', 'file', t), null)
  assert.equal(client.docBudgetInputError('129', 'file', t), 'docErrBudgetTooLargeFile')
  assert.equal(client.docBudgetInputError('512', 'total', t), null)
  assert.equal(client.docBudgetInputError('513', 'total', t), 'docErrBudgetTooLargeTotal')
  assert.equal(client.docBudgetInputError('0', 'file', t), 'docErrBudgetNumber')
  assert.equal(client.docBudgetInputError('abc', 'file', t), 'docErrBudgetNumber')
  assert.equal(client.docBudgetInputError('-3', 'total', t), 'docErrBudgetNumber')
})

test('docBudgetErrorRows maps the server codes onto locale text', () => {
  const { client } = renderDoc({})
  const t = (key) => key
  const rows = client.docBudgetErrorRows({ file: 'too-large', total: 'bad-number' }, t)
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), {
    file: 'docErrBudgetTooLargeFile',
    total: 'docErrBudgetNumber',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(client.docBudgetErrorRows(null, t))), { file: null, total: null })
})

test('docErrorRows maps every server reason onto its draft index', () => {
  const { client } = renderDoc({})
  const t = (key) => key
  const rows = client.docErrorRows(
    [
      { index: 0, reason: 'empty' },
      { index: 1, reason: 'outside' },
      { index: 2, reason: 'not-markdown' },
      { index: 3, reason: 'duplicate' },
      { index: 4, reason: 'missing' },
    ],
    t,
  )
  // The bundle runs in a vm realm: normalize before a strict comparison
  // (cross-realm object prototypes are not reference-equal; web-ui spec 20f).
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), {
    0: 'docErrEmpty',
    1: 'docErrOutside',
    2: 'docErrNotMarkdown',
    3: 'docErrDuplicate',
    4: 'docErrMissing',
  })
})

test('absent state explains the legacy scan and offers the one-click seed', () => {
  const { tree } = renderDoc({
    snapshot: { state: 'absent', root: null, files: [], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 0 }, legacy: ['.trellis/spec/guides/index.md'] },
  })
  const text = textOf(tree)
  assert.match(text, /尚未配置/)
  const loadButton = flat(tree).find(
    (node) => node.type === 'button' && (node.children || []).includes('载入这些文件'),
  )
  assert.ok(loadButton, 'the absent state must offer loading the legacy index')
  assert.equal(typeof loadButton.props.onClick, 'function')
})

test('configured state renders one row per file with the planned budget status', () => {
  const { tree } = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 0 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md', 'docs/big.md'], budgets: { fileKb: '', totalKb: '' } },
    preview: {
      root: 'docs',
      files: [
        { path: 'docs/a.md', bytes: 100, status: 'full' },
        { path: 'docs/big.md', bytes: 9000, status: 'truncated' },
      ],
      budget: { fileMax: 8192, totalMax: 32768, usedBytes: 8192 },
    },
  })
  const rows = flat(tree).filter((node) => node.props && node.props['data-doc-row'] === 'true')
  assert.equal(rows.length, 2)
  const text = textOf(tree)
  assert.match(text, /docs\/a\.md/)
  assert.match(text, /docs\/big\.md/)
  assert.match(text, /将截断至 8 KB/)
  assert.match(text, /完整/)
})

test('invalid config warns without claiming the legacy fallback', () => {
  const { tree } = renderDoc({
    snapshot: { state: 'invalid', root: null, files: [], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 0 }, legacy: null },
  })
  const text = textOf(tree)
  assert.match(text, /现有配置无法解析/)
  assert.match(text, /不会回退旧 Spec/)
})

test('an allowlist miss renders the unmanaged explanation instead of the editor', () => {
  const { tree } = renderDoc({ status: 'unmanaged' })
  const text = textOf(tree)
  assert.match(text, /未纳入注入白名单/)
  const inputs = flat(tree).filter((node) => node.type === 'input')
  assert.equal(inputs.length, 0, 'an unmanaged project must not offer an editable list')
})

test('the save button stays disabled without unsaved changes and hides while unmanaged', () => {
  const clean = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md'], budgets: { fileKb: '', totalKb: '' } },
    preview: { files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 } },
  })
  const cleanSave = flat(clean.tree).find((node) => node.props && node.props['data-doc-save'] === 'true')
  assert.ok(cleanSave)
  assert.equal(cleanSave.props.disabled, true)

  const dirty = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md', 'docs/b.md'], budgets: { fileKb: '', totalKb: '' } },
    preview: { files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 } },
  })
  const dirtySave = flat(dirty.tree).find((node) => node.props && node.props['data-doc-save'] === 'true')
  assert.equal(dirtySave.props.disabled, false)

  const blocked = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 0 }, legacy: null },
    draft: { root: 'docs', files: ['docs/missing.md'], budgets: { fileKb: '', totalKb: '' } },
    errors: { root: null, list: null, rows: { 0: 'docErrMissing' }, budget: { file: null, total: null } },
  })
  const blockedSave = flat(blocked.tree).find((node) => node.props && node.props['data-doc-save'] === 'true')
  assert.equal(blockedSave.props.disabled, true)
})

test('an out-of-range budget input blocks the save and marks its own row', () => {
  const over = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budgets: { fileKB: 8, totalKB: 32 }, budgetDefaults: { fileKB: 8, totalKB: 32 }, budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md'], budgets: { fileKb: '129', totalKb: '' } },
    preview: { files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 } },
  })
  const save = flat(over.tree).find((node) => node.props && node.props['data-doc-save'] === 'true')
  assert.equal(save.props.disabled, true, 'an over-cap per-file budget must block saving')
  assert.match(textOf(over.tree), /不能超过 128KB/)

  const ok = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budgets: { fileKB: 8, totalKB: 32 }, budgetDefaults: { fileKB: 8, totalKB: 32 }, budget: { fileMax: 8192, totalMax: 32768, usedBytes: 10 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md'], budgets: { fileKb: '16', totalKb: '' } },
    preview: { files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 16384, totalMax: 32768, usedBytes: 10 } },
  })
  const okSave = flat(ok.tree).find((node) => node.props && node.props['data-doc-save'] === 'true')
  assert.equal(okSave.props.disabled, false, 'a valid override is dirty and saveable')
})

test('the budget block shows the effective caps and inherits placeholder defaults', () => {
  const { tree } = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budgets: { fileKB: 16 }, budgetDefaults: { fileKB: 8, totalKB: 32 }, budget: { fileMax: 16384, totalMax: 32768, usedBytes: 10 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md'], budgets: { fileKb: '16', totalKb: '' } },
    preview: { files: [{ path: 'docs/a.md', bytes: 10, status: 'full' }], budget: { fileMax: 16384, totalMax: 32768, usedBytes: 10 } },
  })
  const nodes = flat(tree)
  const fileInput = nodes.find((node) => node.props && node.props['data-doc-budget'] === 'file')
  const totalInput = nodes.find((node) => node.props && node.props['data-doc-budget'] === 'total')
  assert.ok(fileInput, 'the per-file budget input must render')
  assert.ok(totalInput, 'the total budget input must render')
  assert.equal(fileInput.props.value, '16')
  assert.equal(totalInput.props.value, '', 'a cleared field means "inherit"')
  assert.equal(totalInput.props.placeholder, '默认 32')
  assert.equal(typeof fileInput.props.onChange, 'function')
  const text = textOf(tree)
  assert.match(text, /注入预算/)
  assert.match(text, /\/ 32 KB/, 'the header progress renders the effective total budget')
})

test('the editor talks to the doc-config route with read / preview / save actions', () => {
  const source = clientSource
  assert.match(source, /const DOC_CONFIG_API = '\/trellis-workflow\/api\/doc-config'/)
  assert.match(source, /action: 'read'/)
  // The draft's budget inputs travel with every preview/save so the server can
  // answer with the same numbers the prompt will use.
  assert.match(source, /action: 'preview'[\s\S]{0,160}budgets: \{ fileKB: draft\.budgets\.fileKb, totalKB: draft\.budgets\.totalKb \}/)
  assert.match(source, /action: 'save'[\s\S]{0,160}budgets: \{ fileKB: draft\.budgets\.fileKb, totalKB: draft\.budgets\.totalKb \}/)
  // The preview is debounced; a request per keystroke would hammer the host.
  assert.match(source, /setTimeout\(/)
  assert.match(source, /\}, 400\)/)
})

test('docBudgetDraft turns a snapshot into input text, blank meaning "inherit"', () => {
  const { client } = renderDoc({})
  const norm = (value) => JSON.parse(JSON.stringify(value))
  assert.deepEqual(norm(client.docBudgetDraft({ budgets: { fileKB: 16 } })), { fileKb: '16', totalKb: '' })
  assert.deepEqual(norm(client.docBudgetDraft({ budgets: { fileKB: 4, totalKB: 64 } })), {
    fileKb: '4',
    totalKb: '64',
  })
  assert.deepEqual(norm(client.docBudgetDraft({ budgets: null })), { fileKb: '', totalKb: '' })
  assert.deepEqual(norm(client.docBudgetDraft(null)), { fileKb: '', totalKb: '' })
  // Junk never reaches the input as text: the row must read as "inherit".
  assert.deepEqual(norm(client.docBudgetDraft({ budgets: { fileKB: 'x', totalKB: Number.NaN } })), {
    fileKb: '',
    totalKb: '',
  })
})

test('the truncation badge shows the limit the plan applied, not the configured cap', () => {
  const { tree } = renderDoc({
    snapshot: { state: 'configured', root: 'docs', files: [], budget: { fileMax: 8192, totalMax: 10240, usedBytes: 0 }, legacy: null },
    draft: { root: 'docs', files: ['docs/a.md', 'docs/b.md'], budgets: { fileKb: '', totalKb: '10' } },
    preview: {
      files: [
        { path: 'docs/a.md', bytes: 6000, status: 'full', limit: 6000, injectedBytes: 6000 },
        // Cut by what was left of the TOTAL budget, not by the 8KB per-file cap.
        { path: 'docs/b.md', bytes: 6000, status: 'truncated', limit: 4240, injectedBytes: 4240 },
      ],
      budget: { fileMax: 8192, totalMax: 10240, usedBytes: 10240 },
    },
  })
  assert.match(textOf(tree), /将截断至 4\.1 KB/)
  assert.doesNotMatch(textOf(tree), /将截断至 8 KB/)
})

test('the client budget hints stay in sync with the server hard caps', () => {
  const { client } = renderDoc({})
  const t = (key) => key
  assert.equal(client.docBudgetInputError(String(MAX_DOC_FILE_BUDGET_KB), 'file', t), null)
  assert.equal(
    client.docBudgetInputError(String(MAX_DOC_FILE_BUDGET_KB + 1), 'file', t),
    'docErrBudgetTooLargeFile',
    'the client must not block at a stale cap',
  )
  assert.equal(client.docBudgetInputError(String(MAX_DOC_TOTAL_BUDGET_KB), 'total', t), null)
  assert.equal(client.docBudgetInputError(String(MAX_DOC_TOTAL_BUDGET_KB + 1), 'total', t), 'docErrBudgetTooLargeTotal')
})
