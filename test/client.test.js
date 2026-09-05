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
