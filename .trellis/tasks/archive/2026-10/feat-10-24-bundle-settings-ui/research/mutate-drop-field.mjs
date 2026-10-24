// One-shot mutation probe (not shipped): drop one configuration field from the
// card and expect the client test suite to go RED. Restore the file afterwards.
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'lib/client.js'
const source = readFileSync(file, 'utf8')
const anchor = "id: 'trellis-config-spec-index'"
const at = source.indexOf(anchor)
if (at < 0) throw new Error('anchor not found: ' + anchor)
const start = source.lastIndexOf('react.createElement(', at)
const closeMark = "onToggle: (next) => props.edit('injectSpecIndex', next ? 'true' : 'false'),"
const closeAt = source.indexOf(closeMark, at)
if (start < 0 || closeAt < 0) throw new Error('block bounds not found')
const end = source.indexOf('}),', closeAt) + 3
writeFileSync(file, source.slice(0, start) + 'null' + source.slice(end))
console.log('mutated: injectSpecIndex field removed')
