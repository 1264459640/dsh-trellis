# Feature Code Review

status: passed

## Diff 范围
`feat-09-06-unified-steps-engine` 实现阶段全部改动：
- `lib/types/index.d.ts`：`TaskStepStatus` 5 态（pending/in_progress/verifying/blocked/completed）、新增 `StepVerificationType`（none/ai/human）、`TaskStep` 与 `TaskStepUpdateInput` 扩展（verification/verifiedBy/blockedReason）；
- `lib/task.js`：`STEP_STATUSES` 5 态、`STEP_VERIFICATION_TYPES`、`validateSteps`/`validateStepUpdate` 新字段校验、`applyStepUpdate` AI/Human 双层门禁与 blockedReason 联动、`checkStepsCompletion` blocked/未验证拦截；
- `lib/breadcrumb.js`：`findActiveStep` 优先级重构（blocked > in_progress > verifying > pending）、`formatStepPrompt` 分级渲染（blocked/verifying+human/verifying+ai/in_progress）；
- `lib/index.js`：`trellis_task_create`/`trellis_task_update` 工具 schema 声明新字段；
- `lib/skills.js`：`DEPRECATED_PROJECT_TEMPLATES` + `pruneDeprecatedProjectTemplates`（`assertPolicyAllowsWrite` 沙箱 fail-closed、node:fs unlink 真实路径）、`ensureProjectSkills` 接入自愈修剪；
- 模板与技能：物理移除 `skills/_templates/feat/implement.md` 与 `refactor/checklist.yaml`；更新 `feat/design.md`（验证计划+风险回滚）、`refactor/refactor-design.md`（steps 承载）、`work-types.md`、6 个技能 SKILL.md、README 双版本；
- 测试：`test/native-steps.test.js` 新增 12 用例；
- 规范：`.trellis/spec/trellis-workflow/task-engine/index.md` 固化 5 态状态机、多主体验证与修剪约定。

## 发现
| 级别 | 问题 | 文件 | 建议 |
|------|------|------|------|
| Info | `verify: true` 作为遗留别名在读取处统一映射为 `verification: 'ai'`，两处判定（applyStepUpdate/checkStepsCompletion）已覆盖 | lib/task.js | 保持现状；`formatStepPrompt` 也做了 `step.verification || (verify ? 'ai' : 'none')` 归一 |
| Info | 模板修剪对只读沙箱 fail-closed 跳过（skipped 记录），不会抛错中断注入 | lib/skills.js | 符合"自愈失败不破坏会话"的设计；下次可写会话自动重试 |
| Info | `lib/artifact.js` 白名单保留 `implement.md`/`checklist.yaml` 以兼容历史任务只读/归档 | lib/artifact.js | 符合 design.md 边界条款，勿移除 |

## 验证证据
- `node --check` 全部 lib 文件语法通过；
- 全量回归：**72/72 通过、0 失败**（client 2 + git 6 + index 26 + native-steps 20 + readonly 11 + state 7）；
- 沙箱说明：`node --test` runner 受 spawn EPERM 限制，采用直接执行测试文件方式验证（与历史 journal 一致），待正常环境 `pnpm test` 复核。

## 结论
- [x] 通过（含全量测试与任务要求验证）
- [ ] 需修复后重审
