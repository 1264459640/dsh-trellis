import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const clientPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'client.js')

/**
 * The client bundle is browser-only (window.__ModuleLoader__.load), so it is
 * guarded with structural assertions instead of imports: it must compile, and
 * the task chip must occupy BOTH seats — the session-header utilities seat
 * (hidden by the harness while a session is blank) and the input-dock hero
 * seat that covers brand-new conversations before the first message.
 */
test('client bundle compiles', () => {
  const source = readFileSync(clientPath, 'utf8')
  vm.compileFunction(source, [], { parsingContext: vm.createContext({}) })
})

test('task chip occupies header utilities AND input dock hero seats', () => {
  const source = readFileSync(clientPath, 'utf8')

  // Header seat (active sessions).
  assert.match(source, /ctx\.slots\.inject\('conversation\.session\.header\.utilities'/)

  // Hero seat (blank sessions): the header hides its whole chrome while a
  // session is blank, so the same chip must also render on the input dock.
  assert.match(source, /ctx\.slots\.inject\('conversation\.input\.dock'/)
  assert.match(source, /id: 'trellis-workflow:task-chip-hero'/)

  // The hero seat self-hides with `session.blank === true`, the same effective
  // predicate the harness header uses to hide its chrome (for a blank session
  // activeTargets is empty, running is false, and promptAttempted is false, so
  // conversationPhase always returns "blank"), so the two seats are mutually
  // exclusive and the chip never duplicates.
  assert.match(source, /session\.blank === true/)
  // conversatio.input.dock owner props (InputZone) expose only SessionSnapshot,
  // which does NOT carry composerPhase — the old predicate was a bug.
  assert.doesNotMatch(source, /session\.composerPhase/)
})

test('push-to-chat and artifact token contracts are present (Subtask 4)', () => {
  const source = readFileSync(clientPath, 'utf8')

  // Artifact token must branch on the archive path (design review P1): archived
  // tasks live under .trellis/tasks/archive/<month>/<slug>/ — a flat template
  // would produce dead references for archived tasks.
  assert.match(source, /task\.archived && task\.month/)
  assert.match(source, /\.trellis\/tasks\/archive\/' \+ task\.month/)

  // Push prompt must be built from the HOST-computed activeStep (never
  // re-derived on the client) and reference the task slug.
  assert.match(source, /function pushPromptFor\(task\)/)
  assert.match(source, /task\.activeStep/)
  assert.match(source, /'请继续推进 Trellis 任务 ' \+ task\.slug/)

  // Composer injection: React-controlled textarea via native value setter +
  // input event (plain .value= does not update React state), contenteditable
  // execCommand fallback, and clipboard fallback.
  assert.match(source, /getOwnPropertyDescriptor\(proto, 'value'\)/)
  assert.match(source, /new Event\('input', \{ bubbles: true \}\)/)
  assert.match(source, /execCommand\('insertText'/)
  assert.match(source, /navigator\.clipboard && navigator\.clipboard\.writeText/)
})

test('settings card lives on the Plugins page and browses via uiWorkspace (0.1.7)', () => {
  const source = readFileSync(clientPath, 'utf8')

  // 0.1.7 migration: the entry's configuration registers into the Plugins
  // page's OUTER `plugins.bundle.config` seat, keyed by the bare package name.
  // The removed `settings.plugins.tab` seat and the removed `settingsScope`
  // service must not come back, and neither may the per-component
  // `plugins.row.config` seat: it repeated the same form one level deeper
  // (feat-10-24-remove-component-settings).
  assert.match(source, /ctx\.slots\.inject\('plugins\.bundle\.config'/)
  assert.match(source, /key: BUNDLE_CONFIG_KEY/)
  assert.doesNotMatch(source, /(?:inject|register)\(\s*['"]plugins\.row\.config['"]/)
  assert.doesNotMatch(source, /ROW_CONFIG_KEY/)
  // The package-name literal must be the single source for the seat key: a
  // drifted copy fails silently in the plugin manager (nothing renders, no
  // error).
  assert.match(source, /const PKG = '@banana-peeljj12\/dsh-trellis'/)
  assert.match(source, /const BUNDLE_CONFIG_KEY = PKG/)
  assert.doesNotMatch(source, /settings\.plugins\.tab/)
  assert.doesNotMatch(source, /settingsScope/)

  // The shared host-owned configuration form is the read/write channel. The
  // entry id is resolved from the describe mirror rather than assumed: a
  // bundle-inserted row is loaded as `include:trellis-workflow`, so the old
  // `whileServed([NS])` gate never opened and the card rendered blank.
  assert.match(source, /new TrellisConfigController\(ctx\.configForms\)/)
  assert.match(source, /function entryIdOf\(served\)/)
  assert.match(source, /endsWith\(':' \+ NS\)/)
  assert.match(source, /this\.mirror\.getSnapshot\(\)\.view/)
  assert.doesNotMatch(source, /whileServed/)
  assert.match(source, /'configForms'/)
  assert.match(source, /SettingsFormModel/)
  assert.match(source, /SettingsForm\b/)

  // Folder picker: the official `uiWorkspace` service, never `workspaces`
  // (issue-09-18 regression guard: `workspaces` has no pickDirectory).
  assert.match(source, /clientCtx && clientCtx\.uiWorkspace/)
  assert.match(source, /\.pickDirectory\(\)/)
  assert.doesNotMatch(source, /workspaces\.pickDirectory\(\)/)
  assert.match(source, /'uiWorkspace'/)

  // Capability guard: a missing/broken uiWorkspace service must NOT throw —
  // it surfaces browseFailed and keeps the manual input path usable.
  assert.match(source, /typeof ws\.pickDirectory !== 'function'/)

  // Picked paths are normalized (backslashes → forward slashes) before they
  // join the allowlist, and cancel (null) stays a silent no-op.
  assert.ok(source.includes(".replace(/\\\\/g, '/')"), 'backslash normalization missing')
  assert.match(source, /picked === null \|\| picked === undefined/)
  assert.match(source, /browseFailed/)

  // Locale dictionaries carry the browse keys in BOTH languages.
  for (const key of ['browse:', 'browseFailed:']) {
    const count = source.split(key).length - 1
    assert.equal(count, 2, `expected exactly 2 occurrences of ${key} (zh + en), got ${count}`)
  }
})

/**
 * Run the real client bundle and hand back its internals.
 *
 * The slots service is modelled the way the shell behaves: `inject` fires its
 * callback only for a slot the host DECLARED, and `register` throws on an
 * undeclared slot name (the shell's own "registering into an undeclared slot"
 * error). Structural string matches cannot see either behaviour, so the seat
 * tests below drive `apply()` instead of grepping for call shapes.
 */
function loadBundle({ primitives = {}, react = {} } = {}) {
  const source = readFileSync(clientPath, 'utf8')
  const registrations = []
  const injected = []
  const declared = new Set([
    'plugins.bundle.config',
    'plugins.row.config',
    'conversation.session.header.utilities',
    'conversation.input.dock',
  ])
  const makeReact = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      if (typeof type === 'function') return type({ ...(props || {}), children })
      return { type, props: props || {}, children: children.flat(Infinity) }
    },
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect() {},
    useMemo: (fn) => fn(),
    useRef: (current) => ({ current }),
    useCallback: (fn) => fn,
    ...react,
  }
  const ctx = {
    effect(fn) {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: {
      inject(name, register) {
        // Every attempt is recorded, declared or not: the single-entry invariant
        // must hold even when the bundle seat is unavailable, and a non-empty
        // list proves `apply()` actually reached `ctx.slots.inject`.
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
      // Empty namespaces: the entry is not served, so the controller stops at
      // its "unavailable" state and no SettingsFormModel is built.
      describe: () => ({
        subscribe: () => () => {},
        ensure: () => {},
        getSnapshot: () => ({ view: { namespaces: [] } }),
      }),
      get: () => assert.fail('no entry should be fetched while nothing is served'),
    },
  }
  let client
  const window = {
    __ModuleLoader__: {
      load({ factory }) {
        client = factory((id) => {
          if (id === 'react') return makeReact
          if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
          if (id === 'react-dom') return {}
          throw new Error('Unexpected client dependency: ' + id)
        })
      },
    },
  }
  const marker = 'exports.apply = apply;'
  if (!source.includes(marker)) throw new Error('client export marker missing')
  vm.runInNewContext(
    source.replace(marker, 'exports.__test = { TrellisConfigCard };\n' + marker),
    { window },
  )
  return { client, ctx, registrations, injected, declare: (name) => declared.add(name), undeclare: (name) => declared.delete(name) }
}

const configSeat = (bundle, name) => bundle.registrations.find((r) => r.options.name === name)
const configSeats = (bundle, name) => bundle.registrations.filter((r) => r.options.name === name)

test('config form takes exactly ONE seat — the bundle page (outer) — off one controller', () => {
  const bundle = loadBundle()
  bundle.client.apply(bundle.ctx)

  // Exactly one registration on the bundle seat: a duplicated seat would paint
  // the form twice (and, with two controllers, diverge in staged edits), so a
  // `find` here could not tell the correct wiring from a doubled one.
  assert.equal(configSeats(bundle, 'plugins.bundle.config').length, 1)
  // The per-component seat must stay EMPTY. `plugins.row.config` is declared by
  // the stub shell above, so a stray registration would be accepted silently —
  // only the count catches the "two settings pages" regression
  // (feat-10-24-remove-component-settings).
  assert.equal(configSeats(bundle, 'plugins.row.config').length, 0)
  // Same invariant on the inject attempts: a registration that never gets a
  // `slots.inject` wrapper would be dead code, and an attempt on the row seat
  // means the component entry is still wired in some branch.
  assert.ok(bundle.injected.includes('plugins.bundle.config'), 'apply() must inject the bundle seat')
  assert.ok(!bundle.injected.includes('plugins.row.config'), 'the component seat must not be injected at all')

  const outer = configSeat(bundle, 'plugins.bundle.config')
  assert.ok(outer, 'the bundle seat must be registered')

  // Host contract: the bundle seat is keyed by the BARE package name
  // (`renderSlot(..., { entryKey: pkg.name })`, `ledger.bundles.has(pkg.name)`).
  // A `#` on the bundle key silently renders nothing, so the exact string is
  // asserted, not a regex shape.
  assert.equal(outer.options.key, '@banana-peeljj12/dsh-trellis')

  // The injected face is the read/write channel: dropping a seat must not drop
  // any of the actions, or saving would silently stop working.
  const outerFace = outer.options.inject()
  assert.ok(outerFace.hooks.trellisConfig, 'the shared config store must be injected')
  for (const action of ['edit', 'resetField', 'save', 'discard']) {
    assert.equal(typeof outerFace[action], 'function', action + ' must be injected')
  }
})

test('an undeclared bundle seat degrades silently and registers no fallback seat', () => {
  const bundle = loadBundle()
  bundle.undeclare('plugins.bundle.config')
  // The stub is the shell's rule: registering into an undeclared slot throws.
  // Assert it here so the guard below cannot pass for the wrong reason.
  assert.throws(
    () => bundle.ctx.slots.register({ name: 'plugins.bundle.config' }, () => {}),
    /undeclared slot/,
  )
  // Must not throw: the shell only declares this seat from 0.1.7 on, and a
  // bare `slots.register` would throw "registering into an undeclared slot".
  bundle.client.apply(bundle.ctx)

  assert.equal(configSeat(bundle, 'plugins.bundle.config'), undefined)
  // No silent fallback onto the component seat: the single-entry decision must
  // not be undone by a defensive "register the other one too" branch.
  assert.equal(configSeat(bundle, 'plugins.row.config'), undefined)
  // Non-vacuous: the bundle seat WAS attempted (only unregistered because the
  // host declared nothing), and the component seat was never even attempted.
  assert.ok(bundle.injected.includes('plugins.bundle.config'), 'apply() must still try the bundle seat')
  assert.ok(!bundle.injected.includes('plugins.row.config'), 'no fallback seat may be attempted')
})

test('the shipped card renders the form for a page and the one-liner for a summary', () => {
  const bundle = loadBundle({ primitives: { SettingsForm: 'SettingsForm', SettingsValueField: 'SettingsValueField' } })
  const empty = { text: '', overridden: false, invalid: false }
  const state = {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    served: ['trellis-workflow'],
    allowlist: empty,
    injectStep: empty,
    skipKeywords: empty,
    inline: empty,
    enforceReadonlyPlanning: empty,
    injectSpecIndex: empty,
  }
  const props = {
    t: (key) => key,
    useTrellisConfig: (select) => select(state),
    edit() {},
    resetField() {},
    save() {},
    discard() {},
  }

  // The bundle page asks for `view: 'page'`; a row summary asks for
  // `view: 'summary'` and must not paint the whole form inline.
  const page = bundle.client.__test.TrellisConfigCard({ ...props, view: 'page' })
  assert.equal(page.type, 'SettingsForm')

  // Every configuration field must be on the page, BY NAME. A count would let
  // a dropped field pass (the card renders seven nodes for six fields), so the
  // ids are compared as a set: dropping or renaming any field fails here.
  const fieldIds = []
  const collect = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.props?.id === 'string' && node.props.id.startsWith('trellis-config-')) fieldIds.push(node.props.id)
    for (const child of node.children || []) collect(child)
  }
  collect(page)
  assert.deepEqual(fieldIds.sort(), [
    'trellis-config-allowlist',
    'trellis-config-inject-step',
    'trellis-config-inline',
    'trellis-config-readonly',
    'trellis-config-skip-keywords',
    'trellis-config-spec-index',
  ])

  const summary = bundle.client.__test.TrellisConfigCard({ ...props, view: 'summary' })
  assert.equal(summary, 'desc')

  // An entry the host has not served yet must explain itself instead of
  // rendering an empty form.
  const unavailable = bundle.client.__test.TrellisConfigCard({
    ...props,
    view: 'page',
    useTrellisConfig: (select) => select({ ...state, available: false, served: [] }),
  })
  assert.notEqual(unavailable.type, 'SettingsForm')
})

test('kanban keeps inline bind and an explicit unbind action (feat-10-20, design v2)', () => {
  const source = readFileSync(clientPath, 'utf8')

  // The row is not a single <button>: an inline action would nest a button
  // inside a button. Guard the split-wrapper contract.
  assert.match(source, /function KanbanTaskItem\(/)
  assert.match(source, /const \{ task, t, selected, busy, onSelect, onActivate \} = props;/)

  // Rows offer ▶ (bind this task to the session). Design v2 moved the bound
  // task into the current-task card, which carries the single unbind action
  // (stop glyph, still labelled `deactivate: <title>`).
  assert.match(source, /aria-label': t\('activate'\) \+ ': ' \+ task\.title/)
  assert.match(source, /ariaLabel: t\('deactivate'\) \+ ': ' \+ task\.title/)
  assert.match(source, /function CurrentTaskCard\(/)
  assert.match(source, /icon: 'stop'/)

  // renderIcon hardcodes fill:'none', so both glyphs must be stroke shapes;
  // passing `fill` at the call site would be a dead argument.
  assert.match(source, /case 'play':/)
  assert.match(source, /case 'play':[\s\S]{0,200}M7 4\.5v15l13-7\.5-13-7\.5Z/)
  assert.match(source, /renderIcon\('play', \{ size: 12, color: TB\.color\.brand, strokeWidth: 2 \}\)/)
  assert.match(source, /case 'stop':[\s\S]{0,200}rect/)
  assert.doesNotMatch(source, /renderIcon\('play',\s*\{[^}]*fill:/)
  assert.doesNotMatch(source, /renderIcon\('stop',\s*\{[^}]*fill:/)

  // Locale dictionaries carry the deactivate label in BOTH languages; a key
  // added only to zh renders the raw key in the English UI.
  for (const key of ['deactivate:']) {
    const count = source.split(key).length - 1
    assert.equal(count, 2, `expected exactly 2 occurrences of ${key} (zh + en), got ${count}`)
  }
  // The status dot's own hint key was dropped with the dot — no dead i18n keys,
  // and the old hardcoded Chinese tooltip is still gone.
  assert.doesNotMatch(source, /activeSessionHint/)
  assert.doesNotMatch(source, /title:\s*'当前会话激活'/)
})
