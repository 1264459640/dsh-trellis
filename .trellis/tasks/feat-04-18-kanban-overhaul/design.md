# Feature Design: Trellis 看板双模态重构与 DSH 体验对齐

status: approved
execution_lane: standard

## 目标与非目标
### 目标
1. 建立克制交互：看板提供只读宏观呈现与对话推进（Prompt 发送至输入框），不侵入状态机；
2. 委托 DSH 原生：产物点击转化为 `@.trellis/tasks/...` 引用，由 DSH 原生文件系统处理，不自造 Markdown 预览轮子；
3. 双模态体验：
   - 常态：小巧单列/双列极简紧凑列表（Compact List），仅展示标题、阶段、工单徽标与步骤简标；
   - 展开：全尺寸大看板（Expanded Modal），支持按工作类型细分阶段泳道（Stage Lanes）与实时搜索/过滤；
4. 数据层对齐：`lib/board.js` 解析聚合 steps 进度（总数、已完成数、阻塞状态）。

### 非目标
- 不支持在看板中手动拖拽卡片更改阶段或强制修改 `task.json` 状态；
- 不在前端插件包中内置独立的 Markdown 渲染器或富文本代码查看器；
- 不改变底层 task-engine 的 5 态状态机与门禁流转机制。

## 方案

### 边界
- **后端聚合层**：`lib/board.js` (`readTask`, `buildBoard`)
- **前端组件层**：`lib/client.js` (`TaskChip`, `KanbanListView`, `KanbanExpandedModal`, `KanbanDetails`)
- **类型定义**：`lib/types/index.d.ts`
- **测试用例**：`test/board.test.js`

### 数据流
```text
.trellis/tasks/*/task.json (含 steps[])
             │
             ▼
   lib/board.js: readTask(fs, entry, meta, inline)
   - 派生 totalSteps, completedSteps, hasBlocked, blockedReason,
     hasPendingVerification
   - 复用宿主端 findActiveStep 计算 activeStep（blocked > in_progress
     > verifying > pending；无 steps 或全 completed 时为 null）
   - phase = phaseForTask(parsed, inline)  ← inline 透传
             │
             ▼
   GET/POST /trellis-workflow/api/board
   - 输出扩展后的 TaskRecord（含 track 泳道事实源）
             │
             ▼
   lib/client.js: TaskChip
   ┌───────────────────────────────┐
   │ 常态 Popover 浮层 (Compact)   │
   │ 极简紧凑列表 + 核心元信息      │
   └───────────────┬───────────────┘
                   │ 点击「⛶ 展开」（触发 loadBoard 刷新）
                   ▼
   ┌───────────────────────────────┐
   │ 全屏大看板模态 (Expanded)     │
   │ 阶段细分泳道 + 搜索/类型筛选   │
   │ (rootRef 内渲染 / 挂起 outside │
   │  Esc 处理器，自带关闭语义)     │
   └───────────────┬───────────────┘
                   │ 点击「💬 推进任务」 / 点击产物
                   ▼
      DSH 输入框 (Composer)
   - 注入 activeStep 渲染的推进 Prompt（客户端不自行拼装）
   - 产物按 archived 分支注入 @.trellis/... 原生文件 Token
```

### 契约变更
1. **Board Task Record 扩展 (`lib/board.js`)**：
   ```ts
   interface BoardTaskRecord {
     slug: string;
     title: string;
     status: string;
     workType: string | null;
     stage: string | null;
     phase: string;
     month: string | null;
     archived: boolean;
     artifacts: string[];
     // 新增字段
     totalSteps: number;          // steps.length；无 steps 时为 0
     completedSteps: number;      // status === 'completed' 的步骤数（与引擎完结口径一致）
     hasBlocked: boolean;         // steps.some(s => s.status === 'blocked')（与 checkStepsCompletion 语义一致）
     blockedReason: string | null; // 步骤顺序中第一个 blocked 步骤的 blockedReason；无则 null（客户端对 null 兜底显示「（未记录）」）
     hasPendingVerification: boolean; // steps.some(s => s.status === 'verifying')：人工验收/验证等待卡点可见
     activeStep: {               // 宿主端格式化活跃步骤（由 readTask 复用 findActiveStep 计算），
       id: string;               // 客户端只负责插入，不自行拼装推进 Prompt（避免丢失验证门禁与
       title: string;            // blocked > in_progress > verifying > pending 的 attention 优先级）
       status: string;
       index: number;            // 0-based 在 steps 中的位置
       total: number;
       blockedReason: string | null;
     } | null;
   }
   ```
   - 聚合规则显式定义：
     - `totalSteps`/`completedSteps`/`hasBlocked`/`hasPendingVerification` 均为纯派生计数，与 `phaseForTask`/`stageOnTrack`/`fallbackStage` 正交；
     - `activeStep` 复用宿主端 `findActiveStep`（优先级 blocked > in_progress > verifying > pending），无 steps 或全部 completed 时为 `null`；
     - **兼容性**：无 steps 的旧任务 → `totalSteps: 0, completedSteps: 0, hasBlocked: false, blockedReason: null, hasPendingVerification: false, activeStep: null`。
   - **inline 透传**：`buildBoard(fs, root, sessionId, inline)` 将 inline 参数透传 `readTask` → `phaseForTask(parsed, inline)`，使看板 phase 与会话徽标一致（带 `-inline` 后缀）。
2. **阶段泳道唯一事实源 (`lib/state.js` TRACKS，禁止在 client.js 维护第三份轨道常量)**：
   - `feat` = `prd / design / design-review / impl / review / check`（含 `design-review`）；
   - `issue` = `report / analyze / fix / fix-note`；
   - `refactor` = `scan / design / apply / done`；
   - `phase === 'completed'`（含 `archived: true`）一律归 **Archive 泳道**，不按 stage 归类；
   - 现有 `CHIP_TRACKS`（client.js）与 `TRACKS`（state.js）双份常量在本次重构中收敛为单一来源（由后端 board 记录携带 track，或前端仅依赖阶段字符串）。
3. **多语言字典扩充 (`lib/client.js`)**：
   - 增加大看板相关词条：`expandBoard` (展开大看板), `collapseBoard` (收起), `searchPlaceholder` (搜索任务...), `filterAll` (全部), `sendToChat` (推进任务), `sendToChatSuccess` (已填入输入框), `pendingVerification` (待验证) 等。

### 交互实现细节
1. **注入 Composer**（Subtask 4）：
   - 定位策略（按优先级尝试）：`data-testid` → `textarea[placeholder]` → contenteditable 输入框；
   - React 受控 textarea 直接赋 `.value` 无效，需**原生 value setter**（`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text)`）+ 派发 `input` 事件；
   - contenteditable 需 `document.execCommand('insertText')` 或合成 `beforeinput`/`InputEvent`；
   - 若全部注入失败：优雅降级为**复制到剪贴板** + 浮层提示用户手动粘贴；
   - 注入内容不自行拼装：推进 Prompt 直接使用后端下发的 `activeStep` 字段渲染（见契约变更 1）。
2. **产物点击联动**（Subtask 4，归档分支）：
   - Token 生成按 `task.archived` 分支：
     - 活跃任务：`@.trellis/tasks/<slug>/<name>`
     - 归档任务：`@.trellis/tasks/archive/<task.month>/<slug>/<name>`（`month` 已存在于 board 记录；legacy `other` 桶同样适用）
   - 插入到当前输入框后，DSH 自动识别为文件 Chip/卡片，点击即可原生查看（不自造预览器）。
3. **展开模态的渲染位置与关闭语义**（Subtask 3）：
   - 全屏 Modal 渲染在 `rootRef` 容器内，或展开时**挂起** Popover 的 outside/Esc 处理器（避免渲染在 rootRef 之外被 `mousedown` outside 处理器立刻关闭）；
   - Modal 自带 Esc / 遮罩点击关闭语义，与 Popover 关闭互不干扰；
   - 「展开」动作触发一次 `loadBoard()` 刷新，避免大看板展示陈旧数据（Agent 推进步骤后重拉）。

### 取舍
- **为何放弃卡片横排而采用极简列表**：Popover 弹窗受限于 640px 宽度，双列大卡片让视觉极为拥挤。收拢为单列/双列纯行（Row）列表，仅展示标题与阶段，呼吸感更强、信息信噪比更高。
- **为何采用模态弹窗大看板而非新页面**：Trellis 作为客户端插件，全屏 Modal 可以在当前会话中即开即关，不会打断正在进行的对话上下文。

## 验证计划
1. **测试用例（交付物 `test/board.test.js`，Subtask 1 新建）**：
   - 无 steps 旧任务 → `0/0`、`hasBlocked=false`、`activeStep=null`；
   - 5 态任务（含 blocked/verifying/completed）→ 计数正确、`blockedReason` 取第一个 blocked 步骤、`hasPendingVerification` 正确；
   - 归档桶缓存复用（第二次 buildBoard 不重读归档文件）、归档任务聚合与 blockedReason 兜底；
   - inline 透传：`buildBoard(..., inline=true)` 时活跃任务 phase 带 `-inline` 后缀。
   - 执行：`node --test test/board.test.js`；**本沙箱 `node --test` runner 受 spawn-EPERM 限制时，降级为直接执行测试文件**（`node test/board.test.js` 直跑，历史 journal 有记载）。
2. **代码规范与编译检查**：
   - 执行 `node --check lib/board.js` 与 `node --check lib/client.js` 确保语法无误；
3. **界面联调验证**：
   - 在 DSH Web 客户端中验证（需确认 client bundle 已被重建并被既有 URL 服务）：
     - 常态紧凑列表渲染；
     - 展开全屏大看板与阶段泳道排布（feat 含 design-review 泳道；completed 归 Archive）；
     - 搜索与分类过滤功能；
     - 点击推进任务（activeStep 渲染）与产物文件引用（含归档分支 Token）的输入框注入效果。

## 风险与回滚
- **风险 1**：DSH 输入框（Composer）DOM 结构在不同 Harness 版本间微调。
  - **规避**：采用多策略选择器（data-testid → textarea → contenteditable），React 受控输入用原生 value setter + `input` 事件派发，若注入失败优雅降级为复制到剪贴板并浮层提示。
- **风险 2**：大看板渲染任务数量过多导致卡顿。
  - **规避**：归档数据维持已有的月度折叠设计，泳道内仅渲染活跃任务。
- **回滚策略**：改动完全向后兼容；回滚同样需要**重建 client bundle（dev:web watcher）/ 重启宿主进程**使 `lib/board.js` 生效，并验证既有看板 URL。

## 人审检查点
- [ ] 设计已获用户确认（status=approved）后再进入实现
