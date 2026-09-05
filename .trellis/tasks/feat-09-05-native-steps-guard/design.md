# Feature Design: Trellis 原生执行步骤、验收门禁与规划期产物写入保护

status: approved
execution_lane: standard

## 目标与非目标

### 目标
1. 在 `task.json` 中原生支持工程执行步骤清单（`steps`），提供步骤级量化验收标准（`acceptance`）与强制验证标记（`verify`）；
2. 统一由 `trellis_task_create` 与 `trellis_task_update` 承载步骤清单的批量初始化/替换（`steps: TaskStep[]`）以及单步流转（`step: { id, status, verified, verificationNotes }`）；
3. 内置“未验证禁止标记 completed”与“未全完成禁止完结主任务”的双重硬门禁；
4. 提供安全的任务专属产物文档写入工具 `trellis_artifact_update`，完整覆盖 `feat`、`issue`、`refactor` 全部工种产物，物理限制只允许写当前任务目录下的指定 Markdown 交付文档；
5. 基于参考项目 `dsh-routing-suite` 的机制，实现规划期只读保护（`enforceReadonlyPlanning`）：在任何工种的 `planning` 阶段物理裁剪通用写工具，仅暴露读分析工具与 `trellis_artifact_update`；
6. 在 `agent/pre-step` 面包屑中，在任何工种的 `in_progress` 实施阶段对当前活跃步骤进行高信噪比注入与内存级去重防刷屏保护。

### 非目标
- 坚决不引入平行的第二状态机，不引入 `governor.json`，不引入 `governor_*` 前缀工具；
- 坚决不引入任何非通用的黑话术语（如 L1/L2、RedTeam、Governor 等）。

---

## 方案与机理解析

### 1. 规划期工具面只读控制机理（参考 dsh-routing-suite 实践）

#### 1.1 为什么通过 `system-prompt/assemble` 能确保“只暴露读工具”？
在 DeepSeek Harness (DSH) 运行时中，向大模型暴露工具的生命周期如下：
1. 模型推理前，DSH 调度 `system-prompt/assemble` Waterfall（瀑布流事件），汇集所有已注册工具的 JSON Schema；
2. 监听器执行 `const assembled = await next()` 获取组装结果，其中的 `assembled.tools` 是最终组装完毕并准备发送给大模型服务端的 API 请求载荷（即 OpenAI/DeepSeek API 格式的 `tools: [...]`）；
3. **物理裁剪机制**：当任务处于规划阶段（泛化判定：`task.status === 'planning'`）且开启了 `enforceReadonlyPlanning` 时，我们将 `assembled.tools` 进行过滤，仅放行规划期白名单工具；
4. **模型行为结果**：在发给模型的 HTTP 请求体中，通用的 `write`、`edit` 工具 Schema 被物理剔除，模型视野中根本不存在通用写工具的元数据，无法发起写代码的工具调用，全部注意力（Reasoning Budget）将被强制引导在阅读调研、架构设计与步骤分解上。

#### 1.2 规划期安全工具白名单 (`PLANNING_SAFE_TOOLS`)
规划期允许且仅允许暴露以下工具：
* **读与检索工具**：`read`、`glob`、`grep`、`inspect_image`、`read_image`；
* **工作流诊断与推进工具**：`trellis_state`、`trellis_task_update`；
* **终端命令（只读分析用）**：`pwsh`、`bash`；
* **唯一的受控写入通道**：`trellis_artifact_update`（物理限定只能写任务交付产物）。

---

### 2. 专用受控产物更新工具：`trellis_artifact_update`

为防止模型在规划期因通用写工具被裁剪而“无法写方案文档”，同时防止模型“借写文档之名修改项目代码”，专门设计 `trellis_artifact_update`。

#### 2.1 契约规范与全工种白名单
* **工具名称**：`trellis_artifact_update`
* **工具描述**：`更新当前 Trellis 任务的阶段交付文档（PRD、设计方案、问题分析、实现备忘、验收报告等）。受安全沙箱保护，仅允许写入任务目录内的合法 Markdown 产物，严禁修改任何项目源代码。`
* **参数定义**：
  * `artifact`: `string`，合法文件名白名单（覆盖 feat / issue / refactor 全部工种）：
    - **通用/新特性 (feat)**：`prd.md` | `design.md` | `design-review.md` | `implement.md` | `review.md` | `check.md`
    - **缺陷排查 (issue)**：`report.md` | `analysis.md` | `fix-note.md`
    - **重构治理 (refactor)**：`scan.md` | `refactor-design.md` | `apply-notes.md` | `checklist.yaml`
  * `content`: `string`，文档完整 UTF-8 Markdown 正文；
  * `slug`: `string`（可选，默认绑定当前会话的活动任务）；
  * `cwd`: `string`（可选项目根目录）。

#### 2.2 路径防越权安全断言（`assertSafeArtifactPath`）
* 目标路径计算：`path.join(root, '.trellis', 'tasks', slug, artifact)`；
* 安全检查：
  1. `artifact` 必须命中上述全工种合法白名单，且不得包含路径分隔符（`/`、`\`）或路径遍历片段（`..`）；
  2. 计算出的目标绝对路径必须严格以当前任务目录 `.trellis/tasks/<slug>` 绝对路径为前缀；
  3. 违反上述规则直接拒绝执行并抛错。

---

### 3. 执行清单数据契约与双重硬门禁

#### 3.1 `task.json` 的 `steps` 数据契约
```typescript
export type TaskStepStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskStep {
  id: string;                 // 步骤唯一标识，如 "step-1"
  title: string;              // 步骤标题
  acceptance: string[];       // 至少 1 条量化验收标准
  status: TaskStepStatus;     // 推进状态
  verify?: boolean;           // 是否要求独立测试/复核验证
  verified?: boolean;         // 独立验证是否通过
  verificationNotes?: string; // 验证依据、测试用例或复核日志
}
```

#### 3.2 规划期批量录入与执行期单步流转接口契约
统一由 `trellis_task_create` 与 `trellis_task_update` 处理：
1. **规划期步骤清单录入/重置（批量接口）**：
   * `trellis_task_create({ ..., steps: TaskStep[] })`
   * `trellis_task_update({ ..., steps: TaskStep[] })`
   * 解决规划期通用 `write` 被禁用时，模型无法落盘初始步骤清单的死锁问题。
2. **执行期单步流转与验证（增量接口）**：
   * `trellis_task_update({ step: { id, status?, verified?, verificationNotes? } })`
   * **两阶段合并语义（`applyStepUpdate`）**：合并现有步骤状态，若某步已处于 `verified: true`，后续单独调用 `status: 'completed'` 依然合法放行。
3. **步骤验证硬门禁**：
   * 步骤若声明 `verify: true`，在合并后状态 `verified !== true` 的情况下，标记 `completed` 物理抛错：`[trellis/verification_gate] 步骤声明了独立测试验证要求 (verify: true)，在通过验证并记录 verified: true 前禁止标记为 completed`。
4. **任务完结硬门禁**：
   * 当调用 `trellis_task_update({ status: "completed" })` 或 `trellis_task_archive` 时；
   * 底层检查：若 `steps` 数组存在任何项满足 `status !== 'completed'` 或 `(verify === true && !verified)`，物理拒绝完结，输出未完成步骤清单。

---

### 4. 当前步骤高信噪比注入与内存级防刷屏（Breadcrumb Active Step）

#### 4.1 注入时机与格式
当任务进入执行期（泛化判定：`task.status === 'in_progress'`）且包含 `steps` 时，在 `agent/pre-step` 面包屑末尾附带：
```text
[当前执行步骤] [#step-2] 3D 场景数据绑定与渲染刷新 (步骤进度: 2/5)
- 验收标准（必须严格逐项达标）：
  1. 帧率稳定 60FPS
  2. 无内存泄漏
- 验证要求：本步骤声明了独立测试验证要求 (verify: true)，完成后请提交测试依据并调用 trellis_task_update 记录 verified: true。
```

#### 4.2 内存级去重与信噪比保护
* 维护当前活跃步骤的内存快照键映射：`stepInjectedCache = new Map<sessionId, string>()`（值如 `step-2:in_progress:v`）；
* 若当前会话当前步骤状态已在内存快照中存在，本轮面包屑仅保留一行提示：
  `[当前执行步骤] 步骤 [#step-2] 正在推进中，请保持专注并在完成后更新进度。`
  **严禁写盘**，纯内存 O(1) 判定，保护上下文信噪比且零 I/O 开销。

---

### 5. 模块划分与落地边界

* `lib/artifact.js`（新增）：实现 `trellis_artifact_update` 工具体与 `assertSafeArtifactPath` 校验（包含全工种白名单）；
* `lib/task.js`：实现 `validateSteps`、`validateStepUpdate`、`applyStepUpdate`、`checkStepsCompletion` 与批量/增量更新；
* `lib/breadcrumb.js`：实现 `findActiveStep`、`formatStepPrompt` 与步骤面包屑组装；
* `lib/index.js`：挂载 `trellis_artifact_update` 工具、`system-prompt/assemble` 规划期通用只读裁剪、`agent/pre-step` 步骤注入与内存去重；
* `lib/meta.js`：新增配置项 `enforceReadonlyPlanning: z.boolean().default(false)`；
* `lib/types/index.d.ts`：导出 `TaskStep`、`TaskStepStatus`、`TrellisArtifactUpdateResult`；
* **彻底清理**：移除之前实验性的 `lib/governor/` 目录及冗余测试。
