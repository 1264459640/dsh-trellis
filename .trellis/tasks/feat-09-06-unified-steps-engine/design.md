# Feature Design: 统一执行步骤清单与多主体验证状态机

status: approved
execution_lane: standard

## 目标与非目标

### 目标
1. **数据模型升级**：在 `task.json.steps` 中原生支持 5 态步骤状态机（`pending` | `in_progress` | `verifying` | `blocked` | `completed`）以及多主体验证区分（`verification: 'none' | 'ai' | 'human'`）；
2. **消灭清单双写（方案 C）**：
   - 彻底废弃 `skills/_templates/feat/implement.md`，将任务级验证命令与风险回滚收拢到 `design.md`；
   - 彻底废弃 `skills/_templates/refactor/checklist.yaml`，重构步骤统一使用原生 `steps` 承载，消灭平行词表；
3. **原生人卡点与双层硬门禁**：
   - 工具层硬拦截：`verification: 'ai'` 步骤必须先通过验证（`verified: true`）方可 `completed`；
   - 人卡点硬拦截：`verification: 'human'` 步骤必须由人工明确确认（`verifiedBy: 'human'`）方可闭环；
   - 任务完结门禁：任何步骤未处于 `completed` 或存在未验证项，物理拒绝任务完结或归档；
4. **原项目废弃模板自动修剪（Self-Healing Pruning）**：
   - 在 `ensureProjectSkills` 自愈机制中加入对原项目残留的 `implement.md` 与 `checklist.yaml` 模板的自动安全清理；
5. **高信噪比注入升级**：`lib/breadcrumb.js` 精确识别 `blocked`、`verifying (AI)`、`verifying (Human)` 并注入针对性提示词。

### 非目标
- 不引入新的中间层配置文件；
- 不在 `task.json` 内部存放自由格式的复杂日志，保持机器状态契约精简；
- 绝对不触碰任何历史已归档或存量任务目录内的数据。

---

## 系统方案与机理解析

### 1. 步骤状态机契约 (`TaskStep`)

#### 1.1 数据结构定义 (`lib/types/index.d.ts`)
```typescript
export type TaskStepStatus =
  | 'pending'     // 待推进
  | 'in_progress' // 实施中（编写代码）
  | 'verifying'   // 验证阶段（代码实施完成，正在执行自动化测试或等待人工验收）
  | 'blocked'     // 阻塞（依赖缺失、外部卡点或验证不通过）
  | 'completed';  // 已完成

export type StepVerificationType = 'none' | 'ai' | 'human';

export interface TaskStep {
  id: string;                          // 步骤唯一标识（如 "step-1"）
  title: string;                       // 步骤标题
  spec?: string;                       // 交付规格
  acceptance?: string[];               // 量化验收标准
  status: TaskStepStatus;              // 推进状态
  verification?: StepVerificationType; // 验证模式
  verify?: boolean;                    // 向后兼容：true 等价于 verification='ai'
  verified?: boolean;                  // 是否已通过验证
  verifiedBy?: 'ai' | 'human';         // 验证确认主体
  verificationNotes?: string;          // 验证依据、命令输出或人审记录
  blockedReason?: string;              // 阻塞原因（status === 'blocked' 时有效）
}
```

#### 1.2 向后兼容性保证
- 若旧任务仅有 `verify: true` 且无 `verification` 字段：运行时自动将其等同于 `verification: 'ai'`；
- 若旧任务仅包含 `pending/in_progress/completed`：旧状态完整兼容，不强制升级至 `verifying`；
- 若 `verification === 'none'` 或未声明：允许从 `in_progress` 直接进入 `completed`。

---

### 2. 工具层硬门禁机制 (`lib/task.js`)

#### 2.1 步骤更新门禁 (`applyStepUpdate`)
1. **完成门禁（Completion Gate）**：
   - 试图将步骤更新为 `status: 'completed'` 时：
     - 若 `verification === 'ai'`（或 `verify === true`），检查 `current.verified === true`，不满足则物理报错：
       `[trellis/verification_gate] 步骤声明了自动化测试验证要求 (ai)，请先在 verifying 阶段记录验证通过 (verified: true) 后再标记 completed`；
     - 若 `verification === 'human'`，检查 `current.verified === true && current.verifiedBy === 'human'`，不满足则物理报错：
       `[trellis/human_gate] 步骤声明了人工验收要求 (human)，在获得用户明确确认并记录 verifiedBy: 'human' 前禁止标记为 completed`；
2. **两阶段提交强化**：
   - 不允许在单次调用中同时由 `verified: false` 变更为 `verified: true` 且 `status: 'completed'`；
3. **阻塞状态联动**：
   - 步骤标记为 `blocked` 时，要求记录 `blockedReason`。

#### 2.2 任务完结门禁 (`checkStepsCompletion`)
- 遍历所有 `steps`：
  - 若存在任意步骤 `status !== 'completed'`：报错 `[trellis/steps_incomplete]`；
  - 若存在任意步骤要求验证但 `verified !== true`：报错 `[trellis/steps_unverified]`；
  - 若存在步骤处于 `blocked`：报错 `[trellis/steps_blocked]`。

---

### 3. 高信噪比注入器 (`lib/breadcrumb.js`)

#### 3.1 活跃步骤决断算法 (`findActiveStep`)
按优先级提取最需要关注的步骤：
1. 首个 `status === 'blocked'` 的步骤（最高优先级：暴露阻断，引导排查）；
2. 首个 `status === 'in_progress'` 的步骤（实施中）；
3. 首个 `status === 'verifying'` 的步骤（验证中）；
4. 首个 `status === 'pending'` 的步骤。

#### 3.2 表现层模版分级 (`formatStepPrompt`)
- **`in_progress` 状态**：
  输出实施规格与量化验收标准；
- **`verifying` 且 `verification === 'ai'`**：
  ```text
  [当前执行步骤] [#step-1] XXX [验证阶段 - 自动化测试] (进度: 1/3)
  - 验证任务：代码实施已完成，请执行 design.md 中声明的验证命令并检查测试输出。
  - 通过要求：测试通过后调用 trellis_task_update 提交 verificationNotes 并置 verified: true。
  ```
- **`verifying` 且 `verification === 'human'`**：
  ```text
  [当前执行步骤] [#step-2] YYY [人工验收卡点 - 👤 等待用户确认] (进度: 2/3)
  - 人卡点要求：本步骤涉及关键改动/外部观察行为，必须向用户清晰汇报改动要点并等待用户明确批准。
  - 严禁行为：在用户给出明确确认回复前，严禁自作主张推进至完成或开始后续步骤！
  ```
- **`blocked` 状态**：
  ```text
  [当前执行步骤] [#step-1] XXX [⚠️ 步骤已阻塞]
  - 阻塞原因：<blockedReason>
  - 处理指引：请优先评估解决方案，如需调整方案请知会用户。
  ```

---

### 4. 废弃模板自动修剪机制 (`lib/skills.js`)

在每轮运行的 `ensureProjectSkills` 中接入安全修剪通道：
```javascript
export const DEPRECATED_PROJECT_TEMPLATES = [
  path.join('.agents', 'skills', '_templates', 'feat', 'implement.md'),
  path.join('.agents', 'skills', '_templates', 'refactor', 'checklist.yaml'),
  path.join('.trellis', 'templates', 'feat', 'implement.md'),
  path.join('.trellis', 'templates', 'refactor', 'checklist.yaml'),
]
```
- **安全性防御**：
  - 仅修剪严格硬编码的 4 个模板相对路径；
  - 执行 `assertPolicyAllowsWrite`（沙箱越权 fail-closed 检查）；
  - 存在则安全调用 `fs.unlinkSync`，在 `console.log` 记录清理事件；
  - 绝不扫描或删除任何 `tasks/` 目录下的业务文档。

---

### 5. 产物精简与迁移矩阵（方案 C）

| 原产物文件 | 变更动作 | 职责归宿 |
| :--- | :--- | :--- |
| `skills/_templates/feat/implement.md` | **物理删除 + 运行时修剪** | 1. 验证命令与测试用例 -> `design.md` 的 `## 验证计划`；<br>2. 风险点与回滚策略 -> `design.md` 的 `## 风险与回滚`；<br>3. 步骤清单 -> `task.json.steps`。 |
| `skills/_templates/refactor/checklist.yaml` | **物理删除 + 运行时修剪** | 步骤与状态机 100% 收编至 `task.json.steps`；人工审核步骤直接使用 `verification: 'human'`。 |
| `skills/_templates/feat/design.md` | **增强** | 强化“验证计划”（要求写明可执行验证命令）与“风险与回滚”章节指引。 |
| `skills/_templates/refactor/refactor-design.md` | **调整** | 移除“步骤与验证 owner”Markdown 表格，改为指导在规划期通过 `trellis_task_update({ steps })` 录入。 |

---

## 边界与风险控制

1. **白名单兼容性**：
   `lib/artifact.js` 中 `ALLOWED_ARTIFACTS` 暂时保留 `implement.md` 与 `checklist.yaml` 在只读/更新白名单中，防止旧历史任务在查看或归档时发生意外拦截；仅在模板脚手架和技能指引中予以移除。
2. **工具 Schema 同步**：
   同步更新 `lib/index.js` 中 `trellis_task_create` 和 `trellis_task_update` 工具对 `steps` 及 `step` 的 parameters schema 描述，使大模型明确知晓新状态与验证模式。

---

## 验证计划与测试策略

1. **单测覆盖（`test/`）**：
   - 验证 5 态状态合法性与非法状态拦截；
   - 验证 `verification: 'ai'` 与 `verification: 'human'` 的门禁拦截与放行；
   - 验证旧任务无 `verification` 字段的平滑向下兼容；
   - 验证 `findActiveStep` 对 `blocked`、`verifying` 的优先级决策；
   - 验证 `formatStepPrompt` 对 AI 验证与 Human 验收卡点的注入文案；
   - 验证 `ensureProjectSkills` 能够安全、准确地将原项目中滞留的废弃模板移除。
2. **回归测试**：
   - 全量运行既有测试套件，确保 0 回归。
