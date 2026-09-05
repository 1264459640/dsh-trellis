# Feature PRD: Trellis 原生执行步骤、验收门禁与规划期产物写入保护

## 背景
在大语言模型驱动的长程工程任务中，存在三大常见问题：
1. **执行跳步与注意力分散**：面对庞大需求，模型容易脱离主线、自回归跳步、在单步中修改无关文件；
2. **缺乏硬性验证门禁**：模型容易“假装已测试”、单方面声称任务完成并提前关闭状态；
3. **规划期无序盲改代码**：在需求调研和方案设计阶段，缺乏对工程代码库的写保护，模型容易在方案未明确时直接动用通用编辑工具篡改源码。

此前尝试引入外来独立项目（如 Governor）的概念，但带来了术语混乱（如 L1/L2、RedTeam）、状态机平行割裂以及外挂补丁感。
**本需求的目标是：完全遵照 Trellis 原生的设计哲学与术语体系，以内生、统一的方式将步骤细化、验收门禁与规划期写保护深度融入 `dsh-trellis`。**

---

## 范围

### In Scope
1. **任务步骤清单数据模型（Task Steps Model）**：
   - 在 `task.json` 中原生支持结构化 `steps` 数组，每个 step 包含 `id`, `title`, `acceptance`（验收断言列表）, `status` (`pending` | `in_progress` | `completed`), `verify` (是否必须经过验证), `verified` (验证是否已通过), `verificationNotes` (验证记录/测试依据)。
   - 保证 100% 向下兼容（未声明 `steps` 的任务按原有纯阶段推进）。
2. **统一的步骤推进与门禁校验（Unified Step Update & Gatekeeping）**：
   - 统一由 `trellis_task_update` 工具承载步骤更新（参数 `step: { id, status, verified, verificationNotes }`）；
   - **步骤验证门禁**：声明 `verify: true` 的步骤，在 `verified !== true` 时物理拦截标记为 `completed`；
   - **任务完结门禁**：主任务若包含未完成（non-completed）或未验证（unverified）的步骤，物理拦截更新主状态为 `completed` 或归档。
3. **当前步骤高信噪比注入（Active Step Breadcrumb & De-duplication）**：
   - 在 `agent/pre-step` 面包屑中，当任务处于 `impl` 阶段且包含 `steps` 时，动态注入当前聚焦 step 的规格与验收断言；
   - 具备同一步骤的提示词去重与防刷屏机制：同一步骤未发生状态改变时，避免重复倾泻完整断言，仅给出单行聚焦提示。
4. **受控产物更新工具（`trellis_artifact_update`）**：
   - 提供专用工具，用于模型编写和修改 `.trellis/tasks/<slug>/` 下的各阶段交付文档（`prd.md`, `design.md`, `check.md` 等）；
   - 严格物理沙箱限制：限制只能写入当前任务目录下的 Markdown 产物，禁止触碰任何项目源码。
5. **规划期只读保护（Read-only Planning Enforcement）**：
   - 新增配置项 `enforceReadonlyPlanning`（默认 `false`）；
   - 开启时，在 `prd`、`design` 等规划期自动从 Cordis `system-prompt/assemble` 工具面中屏蔽通用的 `write` 与 `edit` 工具，仅保留读工具与 `trellis_artifact_update`，实现“方案定稿前严禁碰业务源码”。

### Out of Scope
- 不引入平行的第二状态机，不引入 `governor.json`，不引入 `governor_*` 前缀工具。
- 不引入 `L1/L2`、`Redteam` 等外来生造术语。

---

## 验收标准
- [ ] 1. **数据契约**：`task.json` 规范定义 `steps` 数组格式，`lib/types/index.d.ts` 导出标准的 TypeScript 接口定义。
- [ ] 2. **受控产物工具 `trellis_artifact_update`**：
  - 只能写入当前任务目录下的合法产物文件（如 `prd.md`, `design.md` 等）；
  - 路径越权或修改项目源码时坚决报错拦截；
  - 写入后保持 UTF-8 编码与原子写盘。
- [ ] 3. **步骤状态流转与门禁**：
  - `trellis_task_update` 支持 `step: { id, status, verified, verificationNotes }`；
  - 步骤若 `verify: true` 且 `verified: false`，试图标记 `completed` 时抛出明确语义化错误；
  - 任务若有未完结步骤，试图标记任务 `completed` 时抛出阻断错误。
- [ ] 4. **单步骤高信噪比注入**：
  - 处于 `impl` 阶段时自动提取当前未完成步骤附入面包屑；
  - 同一步骤若已注入，后续轮次降级为单行轻量提示，避免上下文膨胀。
- [ ] 5. **规划期只读保护**：
  - 配置 `enforceReadonlyPlanning: true` 时，在任务规划阶段隐藏通用的 `write` / `edit`，只放行 `trellis_artifact_update` 与只读分析工具；推进到 `impl` 阶段后自动恢复放行通用写工具。
- [ ] 6. **代码清理与测试回归**：
  - 清理之前试验性生成的 `lib/governor/` 目录与无关文件；
  - 编写完整的原生测试套件，原有测试套件 100% 保持绿灯。

---

## 约束与风险
- **完全兼容性**：不能对原有的 `trellis_task_create`、`trellis_task_update` 产生破坏性变更；
- **沙箱隔离安全性**：所有文件写入必须经过 `ctx.fs` 与 `sandboxPolicy`。
