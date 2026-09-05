# Feature Code Review（复审）: 原生融合执行步骤清单、验收门禁与规划期产物写入保护

status: passed   # missing | passed | blocking

## 复审范围
对上轮 `blocking` 结论中列出的 1 处 BLOCKING、3 处 MEDIUM、3 处 LOW 进行修复后的复审。以开发者在会话中声明的五项修复为复核主线，并重现运行测试与死代码 grep。

## 逐项核验

### 1. BLOCKING：`assertSafeArtifactPath` 的 slug 路径穿越 — 已修复
- `lib/artifact.js:49-66` 现对 `slug` 先做 `trim()` 与 `SLUG_CHARSET`（`/^[A-Za-z0-9._-]{1,120}$/`）校验，再以「belt-and-suspenders」方式强制 slug 必须是 `tasks/` 的直接子段：
  `const taskRel = path.relative(tasksDir, taskDir)`，并要求 `taskRel === safeSlug` 且非 `..` 前缀、非绝对路径。
- 攻击向量逐一确认：
  - `slug='../../src'`：含 `/`，被 `SLUG_CHARSET` 拦截（`非法的任务 slug`）。
  - `slug='..'`：通过字符集但 `taskRel` 得到 `'..'`，被 `startsWith('..')` 拦截。
  - `slug='a/b'`：含 `/`，被 `SLUG_CHARSET` 拦截。
  - 附带的 `.`（`taskRel === ''` 导致 `'' !== '.'`）与 artifact 名（`ALLOWED_ARTIFACTS` 白名单 + `name.includes('/'/'\\ '…')` + `rel !== name`）双重闭合亦保持。
- 单测覆盖：`test/native-steps.test.js:206-210` 明确断言 `'../../src'`、`'..'`、`'a/b'` 三类 slug 均抛 `非法的任务 slug`。

**判定：通过。**

### 2. 门禁闭合 — 已修复（归档门禁 + 严格两阶段提交）
- 归档门禁：`lib/archive.js:166-191` 已改为在 `status === 'completed'` 之后读取 `parsed.steps` 并调用 `checkStepsCompletion(taskSteps)`，未完成/未验证步骤在归档前被拦截，对齐 design「归档也 gate」。
- 两阶段提交：`lib/task.js:152-167` 中 `applyStepUpdate` 的 completed 放行条件已成为 `current.verify === true && current.verified !== true` 时拒绝——即要求已持久化的 `current.verified === true`（上一轮调用写入）才放行，单次 `{ status:'completed', verified:true }` 原子折叠被阻断。
- 严格类型校验：`validateStepUpdate`（`lib/task.js:119`）与 `validateSteps`（`lib/task.js:84-89`）均仅接受 `typeof === 'boolean'`，字符串 `"false"` 不会再被 `Boolean()` 强制转为 `true`。
- 测试：`test/native-steps.test.js:79-97`（verify-before-complete 顺序）与 `:233-287`（端到端先 verify 再 complete、任务级 completed 在 step 未完成时被拦）均通过。

**判定：通过。**

### 3. 只读工具面 — 已对齐 design
- `lib/index.js:891-906` 的 `PLANNING_SAFE_TOOLS` 已移除 `trellis_task_create`、`trellis_ui_update`，现为：
  `read / glob / grep / inspect_image / read_image / pwsh / bash / trellis_state / trellis_task_update / trellis_artifact_update`。
- 与开发者声明的目标白名单逐字一致；仅保留 `trellis_artifact_update` 作为唯一受控写通道。`pwsh`/`bash` 仍被保留，属于将 shell 视为「受信任只读语义」的显式假设（上轮 MEDIUM「只读可被 shell 绕过」据此收敛为约定而非物理只读）。

**判定：通过。**

### 4. 死代码清理 — 已确认无残留
- 上轮 LOW 项中的 `SUBTASK_STATUSES`、`validateSubtaskArray`、`validateSubtaskUpdate`、`applySubtaskUpdate`、`checkSubtasksCompletion`、`findActiveSlice` 均已从源码移除。
- 全库 grep（`lib/`、`test/`、`skills/`、`*.md`）对 `governor`、`subtask`/`SUBTASK`、`needsVerification`、`findActiveSlice`、`toolPruning` 均返回 **No matches**。
- 隐藏输入别名 `subtasks`/`subtask_update`/`needsVerification` 亦无残留引用；类型声明 `lib/types/index.d.ts` 已收敛为 `TaskStep`/`TaskStepUpdateInput` 等本任务契约。

**判定：通过。**

### 5. 内存去重会话回收 — 已修复
- `lib/index.js:825-830` 的 `web.on('session/disposed')` 现同时 `summaries.delete(session.id)` 与 `stepInjectedCache.delete(session.id)`，会话销毁时清理该去重缓存，修复了原「只清理 summaries、不清理 stepInjectedCache」的泄漏。

**判定：通过。**

## 验证证据
- `node test/native-steps.test.js`：**9/9 pass**，exit 0。
- `node test/index.test.js`：**24/24 pass**，exit 0。
- 全库死代码 grep：无 `governor` / `subtask` / `needsVerification` / `findActiveSlice` / `toolPruning` 残留。

## 遗留观察（非阻塞，建议后续跟进）
1. **已完成任务的批量 `steps` 替换不重跑门禁**（原 MEDIUM 的次要分支，未闭合）：`lib/task.js:693-716` 中 `checkStepsCompletion` 仅在 `args.status === 'completed'` 分支触发；若任务已处于 `completed`，再以 `steps: [...]` 批量替换为未完成/未验证步骤且不携带 `status`，task.json 会出现 `status=completed` 与未完成 steps 并存的窗口不一致（得益于修复 2，该状态在归档时会被 `checkStepsCompletion` 二次拦截，但中间态仍可见）。建议：当 `args.steps !== undefined && taskJson.status === 'completed'` 时同样重跑门禁，或拒绝在 completed 任务上重置 steps。
2. **`stepInjectedCache` 缓存键仍不含验收内容指纹**：本轮仅补齐会话回收（见项 5）；原「同一 id 的 acceptance/spec 被替换且状态未变时不会重新注入新断言」的键指纹建议仍开放（`lib/index.js:999` 的 `snapshotKey` 为 `${stepId}:${status}:${verified}`）。
3. **顶部注释文档漂移**：`lib/index.js:17-20` 的插件职责注释仍只列 `trellis_state/create/update/archive`，未补 `trellis_artifact_update` / `trellis_ui_update` 与仅规划期只读钩子。

以上三项均为一致性/文档层面，不触及沙箱越界、门禁绕过或数据损坏，不影响本轮通过结论。

## 最终结论
- [x] 通过（含上轮 BLOCKING 与全部已声明修复项的核验）
- [ ] 需修复后重审

上轮唯一 BLOCKING（slug 路径穿越）已正确根治并有三向量单测兜底；归档门禁与两阶段提交已闭合、严格 boolean 校验生效；只读工具面与死代码清理达标；缓存回收已补。测试 9/9 与 24/24 全绿。遗留三项为低危一致性/文档项，建议记录并择机处理，不阻塞放行。