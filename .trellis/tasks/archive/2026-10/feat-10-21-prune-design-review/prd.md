# Feature PRD: 裁剪 trellis-feat 中的 design-review 环节并简化流程链路

## 背景
在原有的 Trellis `feat` 轨道中，任务推进流程为：
`prd` → `design` → `design-review` → `impl` → `review` → `check`

在实践中，独立的 `design-review` 环节存在明显的系统性负反馈：
1. **滋生过度设计与防御性架构**：独立的设计评审极易诱导评审者（或独立审查子代理）为了自证价值提出“前瞻性”或“泛化”需求，迫使设计者加入大量不必需的抽象层与扩展点，违背了 YAGNI 与加尔定律（Gall's Law）。
2. **脱离真实摩擦力**：在写代码之前反复进行纯书面的架构拉锯，容易陷入纸面乌托邦，增加上下文消耗与轮次开销。
3. **流程冗余沉重**：对于大多数特性开发，`prd` 明确问题与边界、`design` 给出关键方案与 Non-goals 即可进入实现，在实现后由代码级 `review` 和 `check` 把关实效。额外的 `design-review` 阶段卡点降低了整体交付吞吐率。

因此，需要重构 `feat` 轨道，将独立的 `design-review` 阶段从主干状态机中剔除，使流程精简平滑为：
`prd` → `design` → `impl` → `review` → `check`。

## 范围

### In Scope
1. **工作流状态机改造 (`lib/state.js`)**：
   - 将 `feat` 的阶段序列从 `['prd', 'design', 'design-review', 'impl', 'review', 'check']` 精简为 `['prd', 'design', 'impl', 'review', 'check']`。
   - 确保 `planning` phase 映射准确对应 `prd` 和 `design`，`impl` 及之后进入 `in_progress`。
2. **任务初始化与产物模板 (`lib/task.js`, `lib/artifact.js`)**：
   - 新建 `feat` 任务不再预先种入 `design-review.md`。
   - 保留对历史已存在的 `design-review.md` 的安全兼容，确保老任务在归档/查看时不崩溃。
3. **工具描述与客户端看板映射 (`lib/index.js`, `lib/client.js`)**：
   - 更新工具文档与错误提示中关于阶段流转的描述。
   - 调整前端/看板阶段显示，移除冗余的 `design-review` 泳道/标签。
4. **技能与规则文档 (`skills/`, `README.md`, `README_EN.md`)**：
   - 更新 `skills/trellis-feat/SKILL.md`，移除要求强制派发独立子代理写 `design-review.md` 的硬性阻塞规则。
   - 同步更新 `skills/_templates/work-types.md` 及中英文 README 中关于 `feat` 生命周期的图表和说明。
5. **单元测试与回归 (`test/`)**：
   - 适配 `test/state.test.js`、`test/board.test.js` 等用例，确保全部通过。

### Out of Scope
- 修改 `issue` 或 `refactor` 轨道的阶段定义。
- 移除代码实现后的 `review`（代码评审）或 `check`（自动化验证）阶段。
- 破坏或删除已有历史归档任务中的 `design-review.md` 产物。

## 验收标准
- [ ] `lib/state.js` 中 `feat` 的 valid stages 准确为 `['prd', 'design', 'impl', 'review', 'check']`。
- [ ] 任务处于 `design` 阶段批准后，可直接合法转换至 `impl` 阶段，不再要求 `design-review`。
- [ ] 新建 `feat` 任务时，seeded 文件仅包含 `prd.md`、`design.md`、`review.md`，不再生成冗余的 `design-review.md`。
- [ ] `skills/trellis-feat` 及中英文 README 说明与实际阶段保持完全一致。
- [ ] 项目现有测试套件（`npm test`）执行全部通过。

## 约束与风险
- **历史任务兼容性**：需要确保已有历史任务（包含 `design-review` 阶段或 `design-review.md`）在加载、展示或归档时不会因为 stage 不在当前列表中而抛出未捕获异常。
- **只读保护规则**：方案在设计并获得确认之前，严格遵守 Trellis 工作区只读规则，禁止提前修改源码。

## 相关代码/文档
- `lib/state.js`
- `lib/task.js`
- `lib/artifact.js`
- `lib/client.js`
- `lib/index.js`
- `skills/trellis-feat/SKILL.md`
- `skills/_templates/work-types.md`
- `README.md`
- `README_EN.md`
- `test/state.test.js`
- `test/board.test.js`
