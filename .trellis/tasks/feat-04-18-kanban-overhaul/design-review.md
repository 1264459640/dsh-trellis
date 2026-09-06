# Design Review: Trellis 看板双模态重构与 DSH 体验对齐

审查日期：2026-04-18（实际以会话时间戳为准）
审查对象：`design.md`（approved）+ `prd.md` + 只读代码（lib/board.js、lib/client.js、lib/types/index.d.ts、lib/state.js、lib/task.js、lib/breadcrumb.js、lib/index.js、skills/_templates/work-types.md、test/）

## 结论
- **Verdict**: passed（附条件：下述 2 个 P1 必须在对应 Subtask 开始前并入 design.md；若按文档字面实现，Subtask 3 的泳道模型会漏掉 design-review 阶段、Subtask 4 的归档产物联动会生成死 Token。两项修复均为一处小改动，不改变架构方向与数据契约，故不判 blocking）

## Findings（按严重度排序）

### P1

- **[P1] 阶段泳道清单与权威轨道定义不一致：文档遗漏 `design-review` 阶段，且完成态去向未定义**
  - 事实核对：`design.md` 目标 3 与 `prd.md` 验收标准写 feat 泳道为 "PRD ➔ Design ➔ Impl ➔ Review ➔ Check ➔ Archive"，均遗漏 `design-review`；而 feat 真实轨道含该阶段（`skills/_templates/work-types.md` 路由表 `prd→design→design-review→impl→review→check`；`lib/state.js` TRACKS.feat.stages = `['prd','design','design-review','impl','review','check']`；`lib/client.js` CHIP_TRACKS.feat 一致）。另外 feat 显示终端 `finish`、refactor 的 `done` 不在 stages 数组内（state.js:316-335），完成态任务经 `phaseForTask` 直接落 `completed`（state.js:86-97），没有泳道归属。
  - 影响：若按文档字面实现，design-review 阶段任务在大看板中无泳道可归；completed/archived 任务（含 stage=finish/done 的任务）落入 Archive 泳道的规则缺失。
  - 建议修复（一处改动）：design.md 契约部分补充「泳道以 `lib/state.js` TRACKS 为唯一事实源：feat = prd/design/design-review/impl/review/check；issue = report/analyze/fix/fix-note；refactor = scan/design/apply/done；`phase === 'completed'`（含 archived）一律归 Archive 泳道，不按 stage 归类」。实现时禁止在 client.js 再维护第三份轨道常量（现有 CHIP_TRACKS 与 TRACKS 已双份，需收敛）。

- **[P1] 产物原生 Token 模板未区分归档路径，归档任务产物点击会生成死引用**
  - 事实核对：`design.md` 交互实现细节 2 写死模板 `@.trellis/tasks/<slug>/<name>`；但归档任务实际位于 `.trellis/tasks/archive/<yyyy-mm>/<slug>/`（work-types.md:31-34；board 记录已带 `archived: boolean` 与 `month: string|null`，board.js:93-94）。归档任务是看板一等公民：`KanbanArchive` 可选中归档任务、`KanbanDetails` 同样渲染其产物（client.js:509-594, 633-721），故这是会真实命中的路径。
  - 影响：点击归档任务产物 → Token 指向不存在的路径，DSH 无法解析为文件 Chip。
  - 建议修复：Token 生成分支——`task.archived ? @.trellis/tasks/archive/<task.month>/<slug>/<name> : @.trellis/tasks/<slug>/<name>`。`month` 已存在于记录（legacy 归档任务的 `other` 桶同样适用，bucket.name 即 month）。

### P2

- **[P2] 「推进任务」Prompt 的生成来源未定义：浏览器 bundle 无法复用宿主端 `formatStepPrompt`**
  - 事实核对：`lib/client.js` 是 Web bundle（`dsh.client.inject: slots/locale/settingsScope`，client.js:39），运行在浏览器，无法 require 宿主端 `lib/breadcrumb.js` 的 `findActiveStep`/`formatStepPrompt`（breadcrumb.js:34-110）。`design.md` 数据流只承诺把 `totalSteps/completedSteps/hasBlocked/blockedReason` 送到前端，未说明注入的「格式化推进 Prompt」由谁生成。
  - 影响：若用这 4 个字段在客户端拼 Prompt，将丢失验收标准列表、验证门禁（`verification: human` 人卡点提示）与 attention 优先级（blocked > in_progress > verifying，breadcrumb.js:34-49），注入文本与状态机语义脱节。
  - 建议修复：契约层面为 BoardTaskRecord 增加宿主端格式化字段（推荐 `activeStep: { id, title, status, index, total, blockedReason } | null`，由 readTask 复用 `findActiveStep` 计算；或直接 `stepPrompt: string`），客户端只负责插入，不自行拼装。

- **[P2] blockedReason 聚合规则未定义（多步骤阻塞取哪个；blockedReason 与 blocked 状态解耦）**
  - 事实核对：`applyStepUpdate` 允许仅更新 blockedReason 而不改状态（task.js:234-236）；`checkStepsCompletion` 判定阻塞只看 `st.status === 'blocked'`（task.js:278）。legacy 手工写入的步骤可能 blocked 但无 reason。
  - 建议修复：显式定义——`hasBlocked = steps.some(s => s.status === 'blocked')`（与 checkStepsCompletion 语义一致）；`blockedReason = 步骤顺序中第一个 blocked 步骤的 blockedReason，无则 null`；客户端对 null 兜底显示「（未记录）」（与 breadcrumb.js:83 一致）。

- **[P2] `verifying` 状态在聚合中不可见：人工验收卡点无法表达**
  - 事实核对：5 态机中 `verifying` 是独立等待态，`findActiveStep` 优先级第三（breadcrumb.js:37）；它既不算 completed 也不算 blocked，紧凑列表「步骤简标 3/5」无法表达「卡在人工验收」。
  - 建议：聚合可选增加 `hasPendingVerification: boolean`（或随 P2#1 的 activeStep 一并携带 status），大看板卡片对含 verifying 步骤的任务打「待验证」角标。不阻塞：状态机本体的等待提示已由面包屑承载。

- **[P2] 归档缓存复用不会被新增字段破坏，但建议前端缺省兜底**
  - 事实核对：`archiveBucketsCache` 仅缓存归档桶记录（board.js:136-176），为进程内存、插件升级即随进程重启清空；活跃任务每次 buildBoard 重读不缓存；归档操作后已调用 `invalidateArchiveBucket`（index.js:783）。因此旧形状缓存跨版本存活的可能性极低，不构成缓存破坏。
  - 建议：前端对 `totalSteps ?? 0`、`completedSteps ?? 0`、`hasBlocked ?? false`、`blockedReason ?? null` 做缺省兜底，防御 dev 热更等极端场景。

- **[P2] buildBoard 的 inline 参数未透传 readTask，看板 phase 永不带 -inline 后缀**
  - 事实核对：`buildBoard(fs, root, sessionId, inline)` 收到 inline 但 readTask 内恒调 `phaseForTask(parsed, false)`（board.js:92, 114）；而会话徽标 summary 的 phase 可带 `-inline`。当前客户端列判定两端都判（client.js:732-737），无害。
  - 建议：顺手把 inline 传入 readTask/phaseForTask，保持看板与徽标 phase 一致。

- **[P2] 展开模态的关闭语义与数据新鲜度未定义**
  - 事实核对：全屏 Modal 若渲染在 rootRef 之外，Popover 的 `mousedown` outside 处理器会立刻关闭它（client.js:916-930）；Esc 当前直接关闭 popover。board 在 popover 打开时只 fetch 一次（client.js:931-933），大看板打开期间 Agent 推进步骤会显示陈旧数据。
  - 建议：design.md 明确 Modal 渲染位置（rootRef 内，或展开时挂起 popover 的 outside/Esc 处理器）；定义 Modal 自己的 Esc/遮罩关闭；「展开」动作触发一次 `loadBoard()` 刷新。

- **[P2] Composer 注入技术细节需补充：React 受控输入框与 contenteditable**
  - 事实核对：当前 client.js 无任何注入代码（Subtask 4 为全新 DOM 代码）。React 受控 textarea 直接赋 `.value` 无效，需原生 value setter + 派发 `input` 事件；contenteditable 需 `execCommand('insertText')`/beforeinput 合成。
  - 建议：设计已有多策略选择器 + 剪贴板降级（design.md 风险 1），补充上述两种具体手法，并优先尝试 `data-testid` 定位（比 `textarea[placeholder]` 稳定）；实现前可先确认 dsh-web 是否暴露 composer 注入服务（比 DOM 戳更稳）。

- **[P2] 验证计划可执行性：`node --test` 在本环境受限，且 test/board.test.js 尚不存在**
  - 事实核对：`test/board.test.js` 不存在（为 Subtask 1 交付物）；本沙箱 spawn-EPERM 曾阻断 `node --test` runner，历史采用直接执行测试文件方式验证（feat-09-06-unified-steps-engine verificationNotes 有记载）。
  - 建议：验证计划补充降级路径（`node test/board.test.js` 直跑），并要求 Subtask 1 的测试覆盖：无 steps 旧任务（0/0、hasBlocked=false）、5 态任务（blocked/verifying/completed 计数）、归档桶缓存复用、归档任务聚合与 blockedReason 兜底。

- **[P2] 回滚策略需包含重建/重启步骤**
  - 事实核对：lib/board.js 为宿主进程代码，改动需重建 + 重启 harness 生效；lib/client.js 为 Web bundle，需重建（dev:web watcher）并刷新既有 URL 验证。
  - 建议：design.md 回滚段补充「回滚同样需要重建 bundle / 重启宿主进程，并验证既有看板 URL」。

## 验证确认
- **数据契约**：`readTask`（board.js:61-100）现仅解析 status/work.type/work.stage/artifacts，`phase = phaseForTask(parsed, false)`；新增 totalSteps/completedSteps/hasBlocked/blockedReason 与现有解析无字段冲突，`/trellis-workflow/api/board` 路由（index.js:885-901）直接透传 readTask 结果，无中间层需要改。
- **steps 结构**：`task.json` 的 steps 元素结构 = `{id, title, spec?, acceptance?, status, verification?, verify?, verified?, verifiedBy?, verificationNotes?, blockedReason?}`（feat-09-06-unified-steps-engine/task.json + lib/types/index.d.ts:24-36）；5 态确认于 task.js:38 `['pending','in_progress','verifying','blocked','completed']`。
- **聚合与状态机一致性**：`hasBlocked` 用 `status === 'blocked'` 判定与 `checkStepsCompletion` 拦截逻辑一致（task.js:278）；`completedSteps` 计 `status === 'completed'` 与引擎完结判定口径一致；聚合逻辑与 `phaseForTask`/`stageOnTrack`/`fallbackStage`（state.js:66-365）正交，无冲突。
- **归档缓存**：`archiveBucketsCache`（board.js:28, 136-176）只缓存归档桶、进程内存、随进程重启清空、归档操作后 `invalidateArchiveBucket` 已接入（index.js:783）；活跃任务每次重读——新增字段不破坏缓存复用。
- **前端结构**：TaskChip 集中持有 open/board/selected/expanded/busy 状态（client.js:801-1080），KanbanBoard 按 phase 分列（planning/in_progress）+ KanbanArchive 按月折叠；拆分为 KanbanListView/KanbanExpandedModal 后共享状态与 props 流动（board, t, selected, onSelect, expanded, onToggle, busy, onActivate, onDeactivate）清晰可沿用。
- **轨道对齐**：`CHIP_TRACKS`（client.js:293-297）与 `TRACKS`（state.js:316-335）、work-types.md 路由表三方一致（feat 含 design-review；finish/done 为显示终端）。
- **克制交互边界**：看板新增交互均只读 + 注入 Composer，无新增写端点；既有的「设为当前会话激活/取消」经 `/api/bind` 写的是会话指针文件（非任务状态机），属既有功能且与「不侵入状态机」声明不冲突。产物当前为纯文本渲染（client.js:714-720），Subtask 4 改为可点击 Token 无历史包袱。
- **DSH 原生委托**：`@.trellis/tasks/<slug>/<name>` 与 lib/task.js 使用的 taskDir 相对引用（".trellis/tasks/<slug>"）同构，是既有权威引用形态，委托方式合理；唯一缺陷是归档路径分支缺失（P1#2）。相比内置 Markdown 预览器，Token 委托明显更轻，且无 bundle 体积风险（PRD 约束：不可引入大三方库）。
- **Locale 模式**：zh/en 双字典 + `ctx.locale.register` 模式（client.js:41-141, 1124）与新增 expandBoard/searchPlaceholder/sendToChat 等词条完全兼容。
- **验证可行性**：`node --check lib/board.js` / `node --check lib/client.js` 语法校验路径可行；`node --test test/board.test.js` 需注意沙箱 runner 限制（P2#8）；「界面联调验证」需确认 client bundle 已重建并被既有 URL 服务（非仅 dev server）。

## 附注
- 模板中 status 字段按父代理指定格式改为 Verdict 判定；原模板表格保留于 git 历史。
