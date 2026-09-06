# trellis-workflow / task-engine — 质量检查与约定

> 本文件由 `feat` 任务 `feat-09-05-native-steps-guard`（原生执行步骤、验证门禁与规划期产物写入保护）沉淀。
> 证据：任务规划产物（prd/design/design-review/implement/review）与本包 `lib/` 源码（task.js / artifact.js / breadcrumb.js / index.js）。
> 补充：`issue-09-05-breadcrumb-undefined` 沉淀"注入消息 source 不得含 undefined"反模式（见已知坑 3）。

## 任务执行引擎约定

1. **执行步骤清单用 `steps`，不用外来术语**：`task.json` 的步骤分解统一为
   `steps: TaskStep[]`（`id/title/acceptance/status/verify/verified/verificationNotes`）。
   不引入 `subtask`/`needsVerification`/`L1/L2`/`RedTeam` 等旁路词表——单一原生词表，
   向下兼容（无 `steps` 的旧任务仍按原有阶段推进）。
2. **步骤双层硬门禁（先验证后完结，先校验后写盘）**：
   - **步骤验证门禁**：`applyStepUpdate` 只在 `current.verified === true`（已持久化的状态）时
     放行 `status: 'completed'`，强制**两阶段提交**，杜绝单次调用自证自测；
   - **任务完结门禁**：`updateTaskRecord` 置 `status: 'completed'` 与 `archiveTaskRecord`
     归档前都必须过 `checkStepsCompletion`——任一步骤 `status !== 'completed'` 或
     `verify===true && verified!==true` 均拒绝；
   - 布尔字段必须严格类型校验（`typeof === 'boolean'`），`Boolean()` 会把字符串 `"false"`
     强制转成 `true`，是历史旁路点。
3. **产物写入走专属受控工具 `trellis_artifact_update`**：
   - 只允许写入当前任务目录 `.trellis/tasks/<slug>/` 下的标准交付文档（全工种白名单，见
     `lib/artifact.js` `ALLOWED_ARTIFACTS`），禁止触碰项目源码；
   - **slug 必须做穿越校验**：`SLUG_CHARSET` 之外还要 `path.relative(tasksDir, taskDir) === safeSlug`
     强制 slug 是 `tasks/` 的直接子段（拒绝 `.`、`..`、含分隔符）——仅靠文件名字符集校验
     会放过 `..`（点号在合法字符集内）。
4. **规划期只读保护（`enforceReadonlyPlanning`）＝授权状态机 + 阶段感知相位**（issue-09-06 重述）：
   - **相位必须由细粒度 `work.stage` 派生（`lib/state.js` `stagePhase`/`phaseForTask`），不能只看 `status`**。
     status↔stage 耦合（`skills/_templates/work-types.md`）：planning ↔ feat prd/design/design-review；
     issue report/analyze；refactor scan/design；in_progress ↔ feat impl/review/check；issue fix/fix-note；
     refactor apply。`completed` 状态恒胜（展示终态）。未知/遗留 stage 回退到基于 status 的粗粒度相位。
   - 三态授权（`lib/readonly.js` `authorizationOf`）：`undecided`（无任务且未跳过）→ 读工具 +
     `trellis_state` + `trellis_task_create` + `trellis_task_skip`；`planning`（规划型阶段）→ 读工具 +
     `trellis_state` + `trellis_task_update` + `trellis_artifact_update`；`authorized`（写码阶段 /
     completed / 已跳过）→ 完整工具面（不裁剪）。经 `system-prompt/assemble` 按会话 cwd 命中 allowlist
     后物理裁剪工具 Schema。
   - **写路径必须拒绝状态漂移**：`trellis_task_create` / `trellis_task_update` 校验合并后的
     status↔stage，拒绝「规划型阶段 + `status=in_progress`」（`lib/task.js`），保证只读窗口不被
     模型纪律失误打开；`write`/`edit` 从规划期工具面剔除，但 `trellis_artifact_update` 必须保留
     为唯一写通道，否则规划期"想写方案却无工具"会死锁。
   - Web 看板/徽标同样消费解析后的 `phase`（`lib/board.js` 记录携带 `phase` 字段），不直接按裸
     `status` 分列/标色。
5. **当前步骤高信噪比注入**：`impl`/`in_progress` 阶段经 `agent/pre-step` 注入当前活跃步骤
   （`findActiveStep` + `formatStepPrompt`），并用**内存级** `stepInjectedCache`（`Map<sessionId, key>`，
   key = `stepId:status:verified`）防刷屏——同一步骤未变化时降级为 `formatStepReminder` 单行提示；
   **禁止在 pre-step 内写盘**；`session/disposed` 时清理该缓存。

## 已知坑（防复发）

- **status 与 work.stage 必须强耦合，相位/授权/展示一律吃阶段感知相位**（issue-09-06-refactor-scan-readonly）：
  只按 `status` 派生相位会让 refactor 的 scan（规划型阶段）在 `status=in_progress` 时被当作执行中，
  只读授权直接放开。禁止新增"只看 status 不看 stage"的相位/授权/分列逻辑。
- 工具 `output.schema` 必须声明 `additionalProperties: false`，否则 `defineTool` 抛
  `UNSUPPORTED_SCHEMA`（见 web-ui 约定 2 的 lossless JSON 配对要求）。
- 注入消息的 `source` 可选字段必须**条件展开省略**（`...(x ? { key: x } : {})`），**禁止写 `undefined` 值**：
  `createUserMessage` 经 `structuredClone`/`deepFreeze` 会保留 `undefined` 键值（只有 `JSON.stringify` 丢键）；
  `agent/pre-step` 注入的面包屑会被 `dsh-agent-loop` 整体 append 为 `user/message` 会话事件，
  而 `dsh-session` 的 lossless-JSON 校验（`snapshotJsonValue`）拒绝任何 `undefined`，
  直接抛 `session event "user/message" carries non-JSON-serializable data` 使本轮运行失败
  （证据：issue-09-05-breadcrumb-undefined；参考实现 `dsh-agent-instructions` 即用条件展开）。
- 安全边界别只信"文件名/字符集"校验：路径穿越要结合 `path.relative` 强约束为直接子段。