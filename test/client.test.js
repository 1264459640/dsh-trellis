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
