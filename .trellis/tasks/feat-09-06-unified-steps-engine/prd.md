# Feature PRD: 统一执行步骤清单与多主体验证状态机（收编 checklist 并收拢 implement 模板）

## 背景

在 `dsh-trellis` 当前版本中，工程任务的执行清单存在以下架构痛点：
1. **执行清单双写与状态割裂**：
   - `refactor` 工种在 `checklist.yaml` 中维护了一套私有的执行清单，其状态（`pending/done/blocked`）与验证模式（`verification: ai|human`）与 `task.json.steps` 相互平行且语义冲突；
   - `feat` 工种在 `implement.md` 中维护了 `## 有序步骤`，导致任务同时存在两套待办列表，真理源混乱；
2. **步骤验证阶段与责任主体缺失**：
   - 原生 `TaskStep` 仅支持 `pending | in_progress | completed` 三态，缺乏从“写完代码”到“完成验证”的中间缓冲态；
   - 原生模型只有 `verify: boolean`，无法区分“AI 自动化验证/测试”与“Human 人工验收卡点”，使高风险步骤无法形成原生的人卡拦截。
3. **产物职责发散**：
   - `implement.md` 承载的验证命令与风险回滚本质上是任务级/阶段级的元数据指引，与 `design.md` 已有的 `## 验证计划` 及 `## 风险与回滚` 重复，增加了文件冗余度。

## 目标与范围

### In Scope
1. **步骤状态机升级（5 态模型）**：
   - `TaskStepStatus` 扩充为：`pending` | `in_progress` | `verifying` | `blocked` | `completed`；
   - 允许步骤进入显式的 `verifying`（待验证）与 `blocked`（阻塞）状态；
   - 向下兼容既有任务数据（仅包含 3 态的任务正常流转）。
2. **多主体验证机制（AI vs Human）**：
   - 引入 `verification?: 'none' | 'ai' | 'human'`；
   - 向下兼容 `verify?: boolean`（`verify: true` 自动等价于 `verification: 'ai'`）；
   - 增加 `verifiedBy?: 'ai' | 'human'` 确认字段与 `verificationNotes` 证据记录；
   - 步骤声明 `verification: 'human'` 时，工具层强校验拦截模型单方面置 `verified: true`，构建步骤级原生人卡点。
3. **高信噪比表现层适配**：
   - `agent/pre-step` 面包屑精准适配 `verifying`（AI 自动化验证提示 vs 👤 人工验收等待卡点）与 `blocked` 提示。
4. **产物精简与收编（方案 C 落地）**：
   - **收编并废弃 `checklist.yaml`**：将 `skills/_templates/refactor/checklist.yaml` 移出模板，重构流程统一使用 `task.json.steps`；
   - **收拢并废弃 `implement.md`**：移除 `skills/_templates/feat/implement.md`，将验证计划与风险回滚说明统一定位在 `design.md`；
   - 更新技能文档（`trellis-feat`、`trellis-refactor`、`trellis-before-dev`、`trellis-brainstorm`）及 `work-types.md`。

### Out of Scope
- 不引入平行的第二状态机文件；
- 不在 `steps` JSON 内部存储长篇大论的非结构化风险日志，非结构化思考依然由 `design.md` 承载。

## 验收标准

- [ ] 1. **数据契约与类型定义**：
  - `lib/types/index.d.ts` 导出标准的 5 态 `TaskStepStatus`、`StepVerificationType` 及扩展后的 `TaskStep` 接口；
  - `lib/task.js` 的 `validateSteps` 与 `validateStepUpdate` 完整覆盖新状态与新字段的校验。
- [ ] 2. **门禁与流转契约（Hard Gates）**：
  - 声明 `verification: 'ai'`（或 `verify: true`）的步骤，在 `verified !== true` 前禁止标记为 `completed`；
  - 声明 `verification: 'human'` 的步骤，物理拦截模型自证自签为 `verified: true`，且禁止跳步完成；
  - 任务完结门禁（`checkStepsCompletion`）校验：凡包含未完成（非 `completed`）或处于 `blocked`/`verifying` 的步骤，一律物理拦截完结。
- [ ] 3. **动态面包屑注入**：
  - `lib/breadcrumb.js` 的 `formatStepPrompt` 正确格式化 `verifying`（区别 AI 自测与 Human 审核）与 `blocked` 状态。
- [ ] 4. **模板与技能清理**：
  - `skills/_templates/feat/` 移除 `implement.md`；`skills/_templates/refactor/` 移除 `checklist.yaml`；
  - 阶段机与工作流文档（`work-types.md` 等）全面同步，消除对双写清单的依赖。
- [ ] 5. **回归测试套件**：
  - 补充 `test/task.test.js` 与 `test/breadcrumb.test.js`，保证新状态机、Human 门禁及向后兼容性 100% 覆盖并绿灯。

## 约束与风险
- **向后兼容性（Backward Compatibility）**：必须确保旧任务只包含 `pending/in_progress/completed` 及 `verify: boolean` 时不受影响，能够无缝加载并流转；
- **沙箱写入安全**：所有模板清理和代码修改遵循安全规范。
