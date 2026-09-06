# Feature PRD: Trellis 看板双模态重构与 DSH 体验对齐

## 背景
现有 Trellis Web 看板采用固定的 Popover 弹窗（640x480）与规划中/进行中双列卡片平铺形态。随着项目演进，暴露出以下痛点：
1. **信息密度与结构失衡**：卡片并排占用空间大，但仅展示标题与阶段，缺乏对底层 `steps`（步骤状态机、验收进度、阻塞原因）的直观感知；
2. **缺乏宏观管理视野**：任务较多时在小浮层中滚动局促，无法在大屏幕上按生命周期阶段（`prd` -> `design` -> `design-review` -> `impl` -> `review` -> `check`）进行全景泳道透视；
3. **交互与边界需要对齐**：
   - 交互需保持极度克制，严禁人工在 UI 上直接拖拽或篡改状态，避免破坏 Agent 执行契约；
   - 产物预览不应在插件内重复造轮子，应完全委托 DSH 原生文件与对话机制处理。

## 核心设计原则
1. **交互克制（No Direct State Mutation）**：
   - 用户在 UI 上不手动拖拽更改阶段，统一通过将推进提示“发送到对话输入框（Composer）”，由 Agent 遵循契约自动化推进。
2. **能力委托（Delegate to DSH Native）**：
   - 产物预览不引入第三方 Markdown 解析器或多余代码，点击产物后以 `@.trellis/tasks/...` 原生文件 Token 注入，由 DSH 原生文件系统与预览层承载。
3. **双模态呈现（Dual-mode Experience）**：
   - **常态（Compact List）**：轻量收敛为极简紧凑列表，只展现工单徽标、标题、阶段与步骤简标；
   - **大看板（Expanded Modal）**：居中全宽全高大视图，支持阶段细分泳道（Stage Lanes）、实时搜索与类型过滤。

## 范围
### In Scope
1. **后端步骤契约与聚合（Subtask 1: `feat-04-18-kanban-backend-steps`）**：
   - `lib/board.js` 解析 `task.json` 的 `steps`，输出 `totalSteps`、`completedSteps`、`hasBlocked`、`blockedReason`、`hasPendingVerification`、`activeStep`（宿主端 `findActiveStep` 派生）；
   - 保持只读归档缓存（archive cache）与零 I/O 机制不受影响，兼容无 steps 的旧任务；`buildBoard` 的 inline 参数透传 `readTask`/`phaseForTask`。
2. **常态极简列表重构（Subtask 2: `feat-04-18-kanban-compact-list`）**：
   - 改造现有 Popover 视图为单列/双列紧凑列表，显示类型徽章、标题、阶段、步骤小进度；
   - 右上角提供「⛶ 展开大看板」按钮。
3. **全屏大看板与阶段泳道（Subtask 3: `feat-04-18-kanban-expanded-lanes`）**：
   - 居中模态/全宽大看板组件 `KanbanExpandedModal`；
   - 按工作类型生命周期细分泳道（以 `lib/state.js` TRACKS 为唯一事实源：`feat` 含 `design-review` 共 6 阶段；`phase==='completed'` 一律归 Archive 泳道）；
   - 顶部提供标题/Slug 实时搜索与 WorkType 快速过滤。
4. **对话联动与原生文件委托（Subtask 4: `feat-04-18-kanban-chat-composer`）**：
   - 详情面板增加“发送到对话（💬 推进）”按钮，将推进 Prompt 注入 DSH 输入框；
   - 产物列表项点击生成原生 `@.trellis/tasks/<slug>/<file>` 引用。

### Out of Scope
1. 手动在看板中拖拽卡片更改阶段或状态；
2. 插件内置 Markdown 渲染器或富文本代码查看器；
3. 本任务不修改底层 5 态步骤状态机执行逻辑（仅读取展示）。

## 验收标准
- [ ] 后端：`readTask` 正确提取 steps 聚合指标（含 `activeStep`/`hasPendingVerification`）并在 `/trellis-workflow/api/board` 正常返回；
- [ ] 紧凑列表：常态 Popover 列表呈现清爽紧凑，仅展示标题与阶段徽标，卡顿与多余滚动消除；
- [ ] 大看板：支持展开全尺寸弹窗，正确按阶段（feat 含 design-review；completed 归 Archive）细分泳道，搜索与筛选实时响应；
- [ ] 交互：支持将任务推进指令一键填入输入框，产物点击自动委托 DSH 原生处理；
- [ ] 回归：现有只读模式、归档折叠、会话指针绑定/解绑功能完好无损，测试套件 100% 通过。

## 约束与风险
- **前端 Bundle 限制**：`lib/client.js` 为 Web 模块格式，不可随意引入巨大外部三方库，需复用既有 React + DSW 变量体系。
- **DOM 注入安全**：注入输入框（Composer）需通过安全的 DOM 事件或 Harness 原生机制，保证兼容性与稳定性。
