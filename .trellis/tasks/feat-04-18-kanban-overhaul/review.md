# Code Review: feat-04-18-kanban-overhaul

审查对象：lib/board.js、lib/client.js、lib/types/index.d.ts、test/board.test.js、test/client.test.js（对照 prd.md / design.md(approved) / design-review.md）

## 结论
- **Verdict**: blocking

阻塞项：1 个 P1（展开大看板在 board 尚未加载完成或加载失败后点击会直接崩溃，属旗舰功能主交互路径的功能错误）。其余为 7 个 P2 可优化项。测试 78/78 全通过，后端 steps 聚合与状态机语义、inline 透传、归档缓存复用、artifactToken 归档分支、克制交互边界均核对无误。

## Findings（按严重度排序）

- **[P1] KanbanExpandedModal 在 board === null 时崩溃（TypeError），展开大看板功能存在确定性故障路径**
  - 位置：`lib/client.js:1265`（`const tasksAll = Array.isArray(board.tasks) ? board.tasks : []`，board 无空值保护）；入口 `lib/client.js:1808-1809`（展开按钮 `if (!board) loadBoard(); setExpandedBoard(true)`）。
  - 复现路径：popover 打开后 board fetch 尚未返回（弹层显示「看板加载中…」时）点击「⛶ 展开大看板」，或 board fetch 失败后（`boardFailed=true` 但 `board` 仍为 null）点击展开 → `board.tasks` 对 null 取值抛 `TypeError: Cannot read properties of null`，React 渲染中断，展开流程整体失效。已用最小复现确认该表达式必然抛错。
  - 建议修复：`const tasksAll = Array.isArray(board && board.tasks) ? board.tasks : []`，且 modal 在 `!board` 时渲染「boardLoading」占位（或直接返回 null 等待 `loadBoard()` 落地）；并把展开动作改为**无条件** `loadBoard()`（见 P2#1），使「展开」天然等待新数据。

- **[P2] 「展开」只在 board 为 null 时才刷新，违背 design.md「展开动作触发一次 loadBoard() 刷新」的契约，常见路径下大看板展示陈旧数据**
  - 位置：`lib/client.js:1808`（`if (!board) loadBoard();`）。
  - 事实核对：design.md 交互实现细节 3 与 design-review P2#6 均要求展开即重拉；注释也声称「re-fetches the board so the full view never shows stale data」。但典型流程是 popover 已加载 board → Agent 在对话中推进了步骤 → 用户稍后点展开，此时 `board` 非空，**不会**重拉，modal 展示的是展开前的旧快照（modal 自身也无刷新按钮）。`loadBoard` 仅在 popover 打开与 bind 成功后触发。
  - 建议修复：展开 onClick 中恒调用 `loadBoard()`（配合 P1 的 `!board` 占位避免空态崩溃）。

- **[P2] readTask 的 activeStep 对畸形 steps 会产生 undefined 字段，违反「可选字段 null 而非 undefined」的 lossless-JSON 契约**
  - 位置：`lib/board.js:113-126`（`findActiveStep` 的 pending 分支匹配 `!s.status`（lib/breadcrumb.js:44），且对非对象元素无守卫）；d.ts:64 注释明确承诺该契约。
  - 复现（已用真实 readTask 验证）：`steps: ['not-an-object', { title: 'NoIdNoStatus' }]` → `activeStep` 含 `id/title/status === undefined`；经 `JSON.stringify`（index.js:240-241）后键被静默丢弃，客户端 `pushPromptFor` 渲染出「当前执行步骤 [undefined] undefined（步骤进度 1/2）」。
  - 影响面：引擎写入的步骤恒带 id/title/status（已核对 feat-09-06 样本），仅畸形/手工 task.json 命中，且 HTTP 路径的 JSON.stringify 只丢键不抛错，故不升 P1；但契约违反属实。
  - 建议修复：readTask 组装 activeStep 时对 `id/title/status` 做 `|| null` 收敛（或先过滤非对象步骤）。

- **[P2] 展开大看板的阶段泳道未按 workType 过滤，共享 stage 名导致任务跨类型重复出现在两条泳道**
  - 位置：`lib/client.js:1290-1293`（`laneItems` 仅匹配 `task.stage === stage`，未闭合外层 `workTypes.map((wt) => ...)` 的 wt）。
  - 事实核对：`feat.stages` 与 `refactor.stages` 共享 `'design'`（state.js TRACKS）。一个处于 design 阶段的 feat 任务会同时出现在 feat 的 design 泳道**和** refactor 的 design 泳道（archived 泳道反而按 wt 过滤，`client.js:1517-1518`）。类型过滤为 all 时必现，属展示层重复。
  - 建议修复：`laneItems` 增加 `task.workType === wt` 条件。

- **[P2] workType 未知或 stage 离轨的任务在展开大看板中不可见（紧凑列表可见而大看板消失）**
  - 位置：`lib/client.js:1290-1296`（泳道匹配 `task.stage === stage` 且无兜底泳道）。
  - 事实核对：readTask 对无 work 块的任务产出 `workType: null`、`stage: null`（board.js:133-134），此类任务在紧凑列表按 phase 分列可见，但在大看板无任何泳道可落，直接消失。legacy 任务命中此路径。
  - 建议修复：为 off-track/未知类型任务提供兜底泳道（如「其他」列），或至少与大看板搜索空态保持一致的处理。

- **[P2] KanbanDetails 的只读/推进按钮门禁用 `task.status === 'completed'` 而非 `task.archived`**
  - 位置：`lib/client.js:840`。
  - 事实核对：当前与归档不变式一致（archive.js:182 只允许 completed 任务归档），且 artifactToken 用的是 `task.archived`（client.js:811），两处判断口径不同属脆性耦合——若未来归档门槛放宽（如允许 blocked 任务归档以冻结现场），未 completed 的归档任务会同时显示「推进」按钮（产物 token 却走归档分支）。
  - 建议修复：统一为 `const archived = task.archived === true || task.status === 'completed'`。

- **[P2] 展开 modal 的 Esc 监听依赖内联 `onClose`，每次 TaskChip 重渲染都重建监听（churn）**
  - 位置：`lib/client.js:1271-1277`（`useEffect(..., [onClose])`，`onClose` 为 `() => setExpandedBoard(false)`，每次渲染新引用）。
  - 影响：modal 打开期间 TaskChip 每次重渲染（loadBoard/bind/selected/filter 变化）都先 remove 再 add document keydown；无功能错误，属资源抖动。与 popover Esc 的互斥已正确（展开时 `setOpen(false)`，popover 的 effect cleanup 先于 modal effect 挂载执行，同 commit 内不并存，已核对）。
  - 建议修复：`onClose` 用 `useCallback` 稳定化，或 effect 依赖改为空数组 + ref 持有最新回调。

- **[P2] 前端对 steps 聚合字段缺少 `?? 0 / ?? false` 缺省兜底（design-review P2#5 建议未采纳）**
  - 位置：`lib/client.js:469-474`、`1133-1139`（`task.totalSteps > 0`、`task.hasBlocked`、`task.hasPendingVerification` 直接读取）。
  - 事实核对：归档缓存为进程内存、重启即清空，board 恒带全字段，当前无实际破坏路径；但按 design-review 建议对 dev 热更/部分 payload 场景做 `(task.totalSteps || 0)` 级兜底更稳。
  - 建议修复：读字段处补 `?? 0 / ?? false`。

## 验证确认

- **测试全量通过（直接执行，spawn-EPERM 降级路径）**：`node test/board.test.js` 5/5、`node test/client.test.js` 3/3、`state` 7、`git` 6、`readonly` 11、`native-steps` 20、`index` 26，合计 78/78，0 失败。
- **语法**：`node --check lib/board.js` / `lib/client.js` / `lib/index.js` 全部通过。
- **steps 聚合语义**（board.js:89-126 对照 task.js/breadcrumb.js）：`completedSteps` 计 `status==='completed'`；`hasBlocked` 用步骤级 `status==='blocked'`，与 `checkStepsCompletion` 拦截口径一致（task.js:278）；`blockedReason` 锁定数组顺序第一个 blocked 步骤的 reason（无则 null，测试覆盖「首 blocked 无 reason 不取第二个」）；`hasPendingVerification` 计 `verifying`；`activeStep` 复用 `findActiveStep` 的 blocked > in_progress > verifying > pending 优先级（breadcrumb.js:34-49），全 completed/无 steps 为 null（旧任务 0/0/false/null/null/null 兜底，测试覆盖）。
- **inline 透传完整**：活跃路径（board.js:179）与归档路径（board.js:212）均把 inline 传入 readTask → phaseForTask；归档任务 status='completed' 恒落 'completed'（state.js:89 status 优先），测试断言 `in_progress-inline` 与归档 `completed` 均正确。
- **归档缓存复用**：`archiveBucketsCache` 只缓存完整记录（含新字段），进程内存、`invalidateArchiveBucket` 已接入归档操作（index.js:783）；第二次 buildBoard 命中缓存（测试断言 2 任务不变），无新字段破坏。
- **tracks 收敛**：`CHIP_TRACKS` 已删除，board payload 下发 `tracks`（board.js:284-288，源自 state.js TRACKS，feat 含 design-review；completed 显示终端 exposure 正确），客户端无第三份轨道常量；KanbanDetails/KanbanExpandedModal 均从 `board.tracks` 读取。
- **Esc / popover 互斥**：展开处理器同批 `setOpen(false)` + `setExpandedBoard(true)`，popover 的 document keydown/mousedown 在其 effect cleanup 中先于 modal 的 keydown effect 卸载，两监听不并存；modal 自持 Esc + 遮罩点击关闭（overlay `e.target === e.currentTarget` 判定），渲染在 rootRef 内（position:fixed）不会触发 popover outside 关闭。
- **KanbanDetails hooks 顺序**：`useState(notice)` 与 `useEffect` 均在 `if (!task)` 提前 return 之前声明，React 规则合规（空 task 时 return 发生在全部 hooks 之后）。
- **filter/expanded 状态链路**：filter 提升至 TaskChip（client.js:1565），KanbanBoard（popover）与 KanbanExpandedModal 双入口均接收 `filter/onFilterChange`；两表层互斥渲染（展开即关 popover；modal 打开时 chip 点击关闭 modal 而非开 popover）；`selectedTask` 均从全量 `tasksAll` 取（过滤/搜索不丢详情）。
- **artifactToken 归档分支**：`@.trellis/tasks/archive/<month>/<slug>/<name>` 与 archive.js 目录布局一致（archive.js:45-67，`other` 桶名亦适用）；活跃分支 `@.trellis/tasks/<slug>/<name>` 不变。归档任务 `month` 恒为桶名（测试断言 '2025-07'）。
- **克制交互边界**：无新增写端点（/board、/bind、/task-state 均未增删写行为）；「推进」只注入 Composer 文本（原生 value setter + input/change 事件 → contenteditable execCommand → 剪贴板兜底，三级降级齐全）与产物 Token 文本，不触碰 task.json 状态机。
- **lossless-JSON 现状**：board 经 `respondJson` 的 `JSON.stringify`（index.js:240-241）传输，undefined 会被静默丢弃（不抛错），故无 P0；但 activeStep 的 undefined 边角确认为 P2#3（已复现）。
- **回归**：hero seat（conversation.input.dock）与 header seat 结构断言通过（client.test.js）；bind/unbind 流程未改；归档月折叠、选中态、阶段徽章保留。
- **杂项（非 finding）**：`chipPhaseColor/chipTypeLabel` 在 client.js:322-346 重复定义——git 核对为 HEAD 既有问题，非本任务引入；新增 `boardHint`/`pendingVerification` 词条暂未被渲染代码引用（dead locale，可顺手清理）。

## 复审（第二轮）

**Verdict: passed**（1 个 P1 + 5 项 P2 修复到位，无新 P0/P1；board 6/6、client 3/3、state 7/7、git 6/6、readonly 11/11、native-steps 20/20、index 26/26，合计 79/79 全通过，`node --check` 语法通过）

### 逐项核对（均已读码核实，非表面改动）

- **[P1] KanbanExpandedModal board===null 崩溃 — 已修复 ✅**
  - 空值守卫位于 `lib/client.js:1291-1310`：`useState('')`（1276）与 Esc `useEffect`（1280-1286）全部声明于 `if (!board)` 提前 return **之前**，所有 board 取值（`board.tasks` 1311、`board.tracks` 1312、`board.currentTask` 1313）均在守卫**之后**，hooks 顺序合规；`!board` 时渲染居中「boardLoading」占位（overlay + 文本），不再对 null 解引用。
  - 展开按钮（`client.js:1842-1850`）无条件 `setOpen(false); loadBoard(); setExpandedBoard(true)`——P1/P2#1 一体修复。
  - 重复 fetch / 闪烁评估：board 已存在时展开，modal 立即用现有数据渲染、新 fetch 落地后静默更新，无闪烁；board 为 null 时短暂 loading 占位，属 review 建议的既定行为，可接受。无 fetch 死循环：popover 的 open 触发 effect（1729-1731）要求 `open===true`，展开时已 `setOpen(false)`；modal 自身无任何触发 loadBoard 的 effect。
- **[P2#1] 展开恒刷新 — 已修复 ✅**：`client.js:1848` 展开 onClick 恒调用 `loadBoard()`（注释 1843-1846 明示 design.md 契约），不再 `if (!board)` 短路。
- **[P2#2] activeStep lossless-JSON 收敛 — 已修复 ✅**：`lib/board.js:91-93` 先 `.filter((s) => s && typeof s === 'object')` 过滤非对象 steps（计数器与 findActiveStep 共用同一有效列表）；activeStep 组装（118-132）对 `id/title/status` 用 `typeof === 'string' ? ... : null` 收敛，`blockedReason` 亦为 null 收敛，字段恒不为 undefined。新增测试 `test/board.test.js:170-201`「readTask activeStep converges malformed steps to null fields」实测：非对象被过滤（totalSteps=1）、id/status 为 null、title 保留、`JSON.parse(JSON.stringify())` 往返后键不丢失（'id' in roundtrip 等断言），测试通过。
- **[P2#3] 泳道按 workType 过滤 — 已修复 ✅**：`client.js:1326-1333` `laneItems` 增加 `task.workType === wt`（1311 行闭合外层 `workTypes.map` 的 wt），feat 任务不再落入 refactor 的共享 'design' 泳道（archived 泳道 1334-1336 本就按 phase/archived 过滤，无此问题）。
- **[P2#5] archived 口径统一 — 已修复 ✅**：`client.js:847` `const archived = task.archived === true || task.status === 'completed'`，并以该 const 门控「推进」按钮（887 `pushButton = archived ? null : ...`），与 artifactToken 归档分支（816 `task.archived && task.month`）口径一致，脆性耦合消除。
- **[P2#6] onClose useCallback 稳定化 — 已修复 ✅**：`client.js:1908` `const closeExpanded = react.useCallback(() => setExpandedBoard(false), [])`，作为 onClose 传入 modal（1921）；modal 的 Esc effect 依赖 `[onClose]`（1286）不再随 TaskChip 重渲染重建监听。
- **[P2#7] 前端 steps 字段兜底 — 已修复 ✅**：KanbanTaskCard（469-472）与 KanbanLaneCard（1141-1144）均 `totalSteps || 0`、`completedSteps || 0`、`hasBlocked === true`、`hasPendingVerification === true`，stepBrief 文本分支全部走收敛后的局部 const。注：徽章颜色表达式（540/542、1227/1229）仍直接读 `task.hasBlocked`/`task.hasPendingVerification` 做 truthy 判断——undefined 为 falsy 落入默认色，功能等价、无崩溃路径，仅属风格小瑕疵，不阻塞。

### 测试与回归

- `node test/board.test.js` 6/6（含新增 malformed-steps 用例）、`node test/client.test.js` 3/3、`node test/state.test.js` 7/7 通过；另跑 git 6、readonly 11、native-steps 20、index 26 全通过，合计 **79/79，0 失败**（较首轮 78/78 多出的 1 项即 P2#2 新增测试）。`node --check lib/client.js` / `lib/board.js` 通过。
- 抽查无回归面：state 状态机、client 双 seat 结构断言、index 读写/归档路径、native-steps 步骤门禁均未受影响。

### 遗留（明确不阻塞，可后续打磨）

- P2#4（off-track/未知 workType 任务的兜底泳道）：未改，仍为「紧凑列表可见、大看板消失」，按约定列为打磨项。
- modal 在 `!board` 占位态下：若本次 fetch 失败（boardFailed=true 且 board 为 null），占位会持续显示「看板加载中…」且无 modal 内错误/重试（Esc、✕、chip 点击均可退出，popover 有刷新重试路径）；占位态 overlay 点击不关闭（无 onMouseDown）。均为非崩溃级 UX 细节，建议后续在占位态补 boardFailed 提示与重试。
- dead locale（boardHint/pendingVerification）与首轮「杂项」保持一致，未清理。

## Check 最终验证（主会话，trellis-check）

对照 PRD 验收标准逐项核对，全部满足：

- [x] **后端 steps 聚合**：`readTask` 输出 `totalSteps/completedSteps/hasBlocked/blockedReason/hasPendingVerification/activeStep`（宿主端 `findActiveStep` 派生，blocked>in_progress>verifying>pending），经 `/trellis-workflow/api/board` 正常返回；board.test.js 6 用例覆盖（5 态聚合、first-blocked-reason 锁定、legacy 零值、inline 透传、畸形 steps null 收敛、归档缓存复用 + tracks 下发）。
- [x] **紧凑列表**：常态 Popover 单行极简（类型色点 + 标题 + 步骤简标 + 阶段徽章），类型过滤条 + 「⛶ 展开大看板」入口。
- [x] **大看板**：`KanbanExpandedModal` 全屏泳道（feat 含 `design-review` 共 6 阶段，completed/archived 归 Archive 泳道），实时搜索 + 类型筛选，Esc/遮罩关闭，展开恒刷新，空 board 守卫。
- [x] **交互克制**：无新增写端点；「💬 推进任务」注入 activeStep 渲染的指令（客户端不自行拼装）；产物点击生成 `@.trellis/tasks/...` 原生 Token（归档分支正确），完全委托 DSH 原生处理。
- [x] **回归**：只读模式、归档折叠、会话指针绑定/解绑、hero seat 均完好。

验证命令（沙箱 spawn-EPERM 降级直跑）：全部 7 个测试文件 **79/79 通过，0 失败**；`node --check` 全部 lib 文件通过；README 双模态描述已同步；`.trellis/spec/trellis-workflow/web-ui/index.md` 已沉淀约定 11-16（泳道单一事实源、steps 聚合契约、克制交互、Composer 注入手法、异步数据空值守卫、inline 透传）。
