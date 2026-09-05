# trellis-workflow / task-engine — 质量检查与约定

> 本文件由 `feat` 任务 `feat-09-05-native-steps-guard`（原生执行步骤、验证门禁与规划期产物写入保护）沉淀。
> 证据：任务规划产物（prd/design/design-review/implement/review）与本包 `lib/` 源码（task.js / artifact.js / breadcrumb.js / index.js）。

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
4. **规划期只读保护（`enforceReadonlyPlanning`）**：当任务处于 `planning` 阶段且开启该配置时，
   经 `system-prompt/assemble` Waterfall 物理裁剪工具面为 `PLANNING_SAFE_TOOLS`（读/检索 +
   `pwsh`/`bash` + `trellis_state`/`trellis_task_update` + `trellis_artifact_update`），
   `write`/`edit` 从发往模型的工具 Schema 中被剔除。**但必须保留 `trellis_artifact_update`
   作为唯一写通道**，否则规划期"想写方案却无工具"会死锁。
5. **当前步骤高信噪比注入**：`impl`/`in_progress` 阶段经 `agent/pre-step` 注入当前活跃步骤
   （`findActiveStep` + `formatStepPrompt`），并用**内存级** `stepInjectedCache`（`Map<sessionId, key>`，
   key = `stepId:status:verified`）防刷屏——同一步骤未变化时降级为 `formatStepReminder` 单行提示；
   **禁止在 pre-step 内写盘**；`session/disposed` 时清理该缓存。

## 已知坑（防复发）

- 工具 `output.schema` 必须声明 `additionalProperties: false`，否则 `defineTool` 抛
  `UNSUPPORTED_SCHEMA`（见 web-ui 约定 2 的 lossless JSON 配对要求）。
- 安全边界别只信"文件名/字符集"校验：路径穿越要结合 `path.relative` 强约束为直接子段。