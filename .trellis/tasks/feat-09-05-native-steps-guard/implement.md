# Feature Implement Plan

## 有序步骤
1. 清理实验性外挂代码：删除 `lib/governor/`、`test/governor.test.js`、`test/subtasks.test.js`。
2. 新增 `lib/artifact.js`：`trellis_artifact_update` 工具与 `assertSafeArtifactPath` 沙箱校验，覆盖 feat/issue/refactor 全工种标准产物。
3. 重构 `lib/task.js`：原生 `steps` 数据契约（`validateSteps` / `validateStepUpdate` / `applyStepUpdate` / `checkStepsCompletion`），支持批量 `steps` 与增量 `step` 更新，内嵌步骤验证门禁与任务完结门禁。
4. 重构 `lib/breadcrumb.js`：`findActiveStep` / `formatStepPrompt` / `formatStepReminder` 单步骤高信噪比注入。
5. 升级 `lib/index.js`：注册 `trellis_artifact_update`、`enforceReadonlyPlanning` 规划期只读保护钩子、`agent/pre-step` 步骤注入与内存级去重（`stepInjectedCache`）。
6. 升级 `lib/meta.js` 与 `lib/types/index.d.ts`：新增 `enforceReadonlyPlanning` 配置与 `TaskStep`/`TaskStepStatus`/`TrellisArtifactUpdateResult` 类型。
7. 同步更新中英双语 README。

## 验证
- 全部 4 个测试套件共 41 个测试用例通过（最终 check 全量复核）：
  - `test/index.test.js`（24 通过）
  - `test/git.test.js`（6 通过）
  - `test/client.test.js`（2 通过）
  - `test/native-steps.test.js`（9 通过）

- 独立代码审查（design-review 与 code review）均已 passed，重点修复：
  1. `assertSafeArtifactPath` 增加 slug 路径穿越校验（`SLUG_CHARSET` + `path.relative` 强制直接子段）；
  2. `archiveTaskRecord` 增加步骤完结门禁；
  3. `applyStepUpdate` 严格两阶段提交 + 严格布尔类型;
  4. 清理全部遗留黑话（`governor`/`subtask`/`needsVerification` 等全库零残留）；
  5. `stepInjectedCache` 增加 `session/disposed` 回收。

证据见本会话运行输出与 `review.md`。

## Review / 验证门

- [x] 已按项目质量门验证（`node --test` 全量通过），证据记录在本文件与 review.md。
- [x] code review 已由独立子代理审查并 passed。

## 回滚点
- `lib/governor/` 已物理删除；如需查看历史实现可在 git 历史中检索。