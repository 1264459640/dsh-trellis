# Feature Design: 裁剪 trellis-feat 中的 design-review 环节并重构设计边界

status: approved   # draft | approved
execution_lane: standard   # quick | standard

## 目标与非目标
### 目标（Goals）
1. 从 `feat` 任务轨道的正式生命周期中移除独立的 `design-review` 阶段，简化阶段序列为：
   `prd` → `design` → `impl` → `review` → `check`。
2. 当设计方案（`design.md`）经用户确认批准（status=approved）后，任务可直接从 `design` 流转至 `impl`，无需再强制卡在 `design-review` 阶段。
3. 职责严格解耦：
   - **产物模板（`skills/_templates/feat/design.md`）** 专注于对需求的工程拆解与实现方案（边界、数据流、契约、关键取舍、可执行测试验证计划）。
   - **设计哲学与思维准则（YAGNI/KISS/防过度设计）** 沉淀在 **技能指引（`skills/trellis-brainstorm/SKILL.md`）** 内部，指导模型在推演方案时保持务实紧凑，不污染模板正文。
4. 清理冗余的 `design-review.md` 模板文件，新任务不再默认生成该占位文件。
5. 调整技能规范（`trellis-feat` SKILL.md）、文档与看板展示，消除“强制派发独立子代理做书面设计审查”的死板规定。
6. 保证向后兼容：已存在的历史任务或包含 `design-review` 的旧数据可平稳读取与兼容展示，不崩溃。

### 非目标（Non-goals）
1. 不变动 `issue`（`report` → `analyze` → `fix` → `fix-note`）或 `refactor`（`scan` → `design` → `apply`）轨道的流程。
2. 不取消代码实现阶段之后的 `review`（代码评审）和 `check`（自动化与质量检查）阶段。

## 需求拆解与实现方案

### 涉及模块与边界
1. **状态机与流转定义 (`lib/state.js`)**：
   - 更新 `WORK_TYPES.feat.stages` 为 `['prd', 'design', 'impl', 'review', 'check']`。
   - `stagePhase` 保持对旧任务 `design-review` 阶段返回 `'planning'` 的向后兼容。
2. **工具契约描述 (`lib/index.js`, `lib/task.js`)**：
   - 更新 `trellis_task_update` 工具描述与注释中关于 stage 流转的合法列表。
3. **职责解耦与模板净化 (`skills/_templates/feat/design.md`, `skills/trellis-brainstorm/SKILL.md`)**：
   - 彻底净化 `design.md` 模板：移除说教式的“哲学宣言”，专注于“需求拆解与实现方案”。
   - 将 YAGNI/KISS 等工程权衡原则收敛在 `trellis-brainstorm` 技能中，指导模型在思考时保持简单直接、可测试优先。
4. **模板文件清理 (`skills/_templates/feat/design-review.md`)**：
   - 移除模板文件，新建任务不再种入无用占位。
5. **工作流技能与文档 (`skills/trellis-feat/SKILL.md`, `skills/_templates/work-types.md`, `README.md`, `README_EN.md`)**：
   - 删除“强制派发独立子代理写 design-review.md”规则；更新中英文 README。
6. **看板与单测回归 (`test/board.test.js`, `test/state.test.js`)**：
   - 看板单一事实源自然同步为 5 个阶段，140 项自动化测试全量通过。

### 核心数据流与逻辑拆解
```text
用户提出需求 
  -> prd.md（明确背景、范围与验收标准）
  -> design.md（对需求的工程拆解、模块边界、数据流、契约与验证计划）
  -> [用户人卡批准 approved]
  -> 进入 impl（编码实现）
  -> review.md（代码级审查）
  -> check.md（自动化验证门禁）
  -> 归档完成
```

### 契约变更
- `trellis_task_update` 的 `stage` 参数校验支持新的 5 阶段序列。

### 关键技术选型与取舍
- 模板不放说教内容，保持作为干净工程文档的属性；
- 哲学与思维边界留在 Skill 指令里，真正起到提示模型思考的作用。

## 验证计划
- 执行 `pnpm test`（`node --test`），确保全量测试 100% 通过。

## 风险与回滚
- 回滚策略：单 commit 管理，git revert 即可还原。

## 人审检查点
- [x] 需求拆解完整，实现方案清晰
- [x] 设计已获用户确认（status=approved）后再进入实现
