# 验收报告 — 统一执行步骤清单与多主体验证状态机

## 验收范围
对照 `prd.md` 验收标准逐项核验 `feat-09-06-unified-steps-engine` 实现。

## 逐项验收

### AC1 — 数据契约与类型定义 ✅
- [x] `lib/types/index.d.ts` 导出 5 态 `TaskStepStatus`、`StepVerificationType` 与扩展后的 `TaskStep`；
- [x] `validateSteps` / `validateStepUpdate` 完整覆盖 `verifying`/`blocked`/`verification`/`verifiedBy`/`blockedReason` 校验；
- [x] 非法状态/非法验证模式被拒绝（测试覆盖）。

### AC2 — 门禁与流转契约 ✅
- [x] `verification: 'ai'`（或 `verify: true`）步骤在 `verified !== true` 前禁止 `completed`（`[trellis/verification_gate]`）；
- [x] `verification: 'human'` 步骤模型无法自证自签（`[trellis/human_gate]`，须 `verified: true && verifiedBy: 'human'`）；
- [x] `checkStepsCompletion` 拦截 `blocked`（`[trellis/steps_blocked]`）、未完成（`[trellis/steps_incomplete]`）、未验证（`[trellis/steps_unverified]`）；
- [x] `blocked` 状态必须携带 `blockedReason`（工具层强制）。

### AC3 — 动态面包屑注入 ✅
- [x] `formatStepPrompt` 正确格式化 `verifying`（AI 自测 vs 👤 人工验收等待卡点）与 `blocked`（阻塞原因+处理指引）；
- [x] `findActiveStep` 优先级 `blocked > in_progress > verifying > pending`（测试覆盖）。

### AC4 — 模板与技能清理 ✅
- [x] `skills/_templates/feat/implement.md` 物理移除（含项目副本）；
- [x] `skills/_templates/refactor/checklist.yaml` 物理移除（含项目副本）；
- [x] `feat/design.md` 强化验证计划与风险/回滚；`refactor/refactor-design.md` 改为 steps 承载指引；
- [x] `work-types.md`、6 个技能 SKILL.md、README 双版本全面同步；
- [x] `ensureProjectSkills` 自愈修剪接入（`DEPRECATED_PROJECT_TEMPLATES` + 沙箱 fail-closed）；
- [x] `lib/artifact.js` 白名单保留旧文件名（历史任务兼容）。

### AC5 — 回归测试套件 ✅
- [x] `test/native-steps.test.js` 新增 12 用例（5 态校验、AI/Human 门禁、blocked、优先级、分级渲染、修剪、provision 集成）；
- [x] 全量回归 **72/72 通过、0 失败**；
- [x] 全部 lib 文件 `node --check` 通过。

## 验证记录
| 项目 | 结果 |
|------|------|
| 语法检查（node --check × 7） | 通过 |
| 全量测试（6 个测试文件） | 72/72 通过，0 失败 |
| 沙箱限制 | `node --test` runner 受 spawn EPERM 限制，采用直接执行测试文件验证；待正常环境 `pnpm test` 复核（与历史 journal 一致） |

## 遗留说明
1. `npm test`（`node --test`）在沙箱内受 spawn 限制，已在正常环境复核为收尾项；
2. 版本发布（bump rc、打包、发布）不在本任务范围。

## 结论
**check 通过**，可进入收尾（commit → archive）。
