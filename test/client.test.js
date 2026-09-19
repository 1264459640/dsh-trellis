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

test('allowlist folder picker browses via the official directory service (feat-09-11, issue-09-18)', () => {
  const source = readFileSync(clientPath, 'utf8')

  // The browse button lives in the settings tab and calls the Host's native
  // directory picker through the official `uiWorkspace` service (the same call
  // the DSH directory-picker packages use: `inject = ["slots", "uiWorkspace"]`).
  //
  // Regression guard (issue-09-18-folder-picker-uiworkspace-mismatch): the
  // service MUST be `uiWorkspace`. `workspaces` is a different service
  // (dsh-api-workspace-controller's WorkspaceController) that has no
  // `pickDirectory`, so consuming it makes the capability guard below fail
  // unconditionally and the picker never opens.
  assert.match(source, /uiWorkspace\.pickDirectory\(\)/)
  assert.doesNotMatch(source, /workspaces\.pickDirectory\(\)/)
  assert.match(source, /'uiWorkspace'/)
  assert.match(source, /onClick: browsePath/)

  // Capability guard: missing/broken uiWorkspace service must NOT throw —
  // it surfaces browseFailed and keeps the manual input path usable.
  assert.match(source, /typeof workspaces\.pickDirectory !== 'function'/)

  // Picked paths are normalized (backslashes → forward slashes) before they
  // join the allowlist, matching the UI's existing forward-slash display.
  assert.match(source, /replace\(/, {})
  assert.match(source, /\\\/g, '\/'/)

  // Cancel (null) is a silent no-op; errors are surfaced, never swallowed.
  assert.match(source, /picked === null \|\| picked === undefined/)
  assert.match(source, /onError|browseFailed/)

  // Locale dictionaries carry all three browse keys in BOTH languages.
  for (const key of ['browse:', 'browseBusy:', 'browseFailed:']) {
    const count = source.split(key).length - 1
    assert.equal(count, 2, `expected exactly 2 occurrences of ${key} (zh + en), got ${count}`)
  }
})
