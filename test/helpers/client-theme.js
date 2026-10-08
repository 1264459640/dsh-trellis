import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { TRACKS } from '../../lib/state.js'

export const clientSource = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
export const palettes = JSON.parse(readFileSync(new URL('../fixtures/theme-palettes.json', import.meta.url), 'utf8'))

// Execute the current bundle, not a hand-maintained copy of its components.
// Only hooks/element creation are stubbed: these tests inspect initial render styles.
export function loadClient(source = clientSource) {
  const react = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      if (typeof type === 'function') return type({ ...props, children })
      return { type, props: props || {}, children: children.flat(Infinity) }
    },
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect() {},
    useMemo: (fn) => fn(),
    useRef: (current) => ({ current }),
  }
  let client
  const window = { __ModuleLoader__: { load({ factory }) {
    client = factory((id) => {
      if (id === 'react') return react
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
      throw new Error('Unexpected client dependency: ' + id)
    })
  } } }
  const marker = 'exports.apply = apply;'
  if (!source.includes(marker)) throw new Error('Client export marker missing')
  vm.runInNewContext(source.replace(marker,
    'exports.themeTest = { TB, KanbanBoard, KanbanExpandedModal, KANBAN_POPOVER_STYLE, zh };\n' + marker), { window })
  return client.themeTest
}

const noop = () => {}
export const tasks = ['feat', 'issue', 'refactor'].map((workType, i) => ({
  slug: 'theme-' + workType,
  title: 'Theme task ' + workType,
  workType,
  status: 'in_progress',
  phase: 'in_progress',
  stage: TRACKS[workType].stages[2],
  archived: false,
  artifacts: ['report.md'],
  totalSteps: 3,
  completedSteps: i,
  hasBlocked: i === 1,
  hasPendingVerification: i === 2,
  steps: [
    { id: 'a', title: 'Completed step', status: 'completed' },
    { id: 'b', title: 'Current step', status: 'in_progress' },
    { id: 'c', title: 'Pending step', status: 'pending' },
  ],
}))

export function renderViews(client, selected = tasks[0].slug) {
  const props = {
    board: { tasks, tracks: TRACKS, currentTask: selected },
    selected, t: (key) => client.zh[key] || key, filter: 'all', busy: false,
    expanded: new Set(), onToggle: noop, onSelect: noop, onActivate: noop,
    onDeactivate: noop, onFilterChange: noop, onClose: noop,
  }
  return {
    popover: { type: 'div', props: { style: client.KANBAN_POPOVER_STYLE }, children: [client.KanbanBoard(props)] },
    lanes: client.KanbanExpandedModal({ ...props, initialViewMode: 'lanes' }),
    list: client.KanbanExpandedModal({ ...props, initialViewMode: 'list' }),
  }
}
