# Review：看板与徽标视觉及交互体验升级

## 验收（人工，步骤 6）

- 用户 2026-10-21 在现有 GUI 中验收通过，方案为「原型 A · 安静列表 · 当前任务置顶 + 步骤清单」。

## 检查矩阵

| 维度 | 命令 / 方式 | 结论 |
|---|---|---|
| 类型检查 | 本包无 `tsc`/type-check 脚本（`package.json` 仅有 `test` / `install:trellis`），`lib/types/index.d.ts` 为手写声明 | N/A |
| 代码风格 | 本包无 lint 脚本 / 配置文件 | N/A |
| 单元测试 | `node --test` | **152 / 152 通过**（3.0s） |
| PRD 验收标准 | 逐条对照 prd.md | 全部满足（见下） |
| 模块规范门禁 | `.trellis/spec/trellis-workflow/web-ui/index.md` | 遵循；旧条目 18/19/20 已补更正记录 |

## PRD 验收对照

| 验收标准 | 结果 |
|---|---|
| `node --test` 全绿、对比度矩阵 3 主题 × 3 选中 × 2 视图 ≥ 4.5:1 | 通过 |
| 行内动作约束（不嵌套 / 每行恰好一个 ▶ / busy 禁用 / stopPropagation / 先 select 再 activate） | 通过（`client-theme.test.js`） |
| 解绑入口唯一且在当前任务卡上 | 通过（行内不再出现解绑按钮） |
| 选中态只有一种信号、无品牌描边 / 竖条 / 绝对定位装饰 | 通过（新增断言） |
| 徽标保留中文阶段名 + 截断标题 + chevron，四态区分 | 通过（离线渲染核对） |
| 步骤清单：当前步骤加粗 + 验收标准 / 阻塞原因 + 人工标签 + compact 折叠 | 通过（4 条 StepList 断言） |
| 大看板详情显示完整步骤 | 通过 |
| 不改后端接口（board/index/state） | 通过（仅 lib/client.js + 测试） |
| 键盘 ↑/↓/Enter、Esc、focus-visible | 通过（Enter 仅在列表容器自身聚焦时绑定，避免与按钮冲突） |

## 变更范围

- `lib/client.js`：TB token 重写；`ensureStyles` + `.tw-*` 样式表；新增 `Dot` / `ProgressBar` /
  `AnomalyFlag` / `TextButton` / `Kbd` / `EmptyState` / `SkeletonRows` / `SectionLabel` /
  `StepIcon` / `StepList` / `CurrentTaskCard`；重写 `KanbanTaskItem`、`KanbanBoard`、
  `KanbanDetails`、`KanbanExpandedModal`、`TaskChip`；删除 v1 的 `KanbanLaneCard`、
  `KanbanArchive`、`Segmented`、`stateStyle` 及死代码 `formatStepTitle` / `formatStepDesc`
  与 11 个失效 i18n key。
- `test/client-theme.test.js`：视图对象改为 `popover` / `board`；新增 v2 视觉规则、当前任务卡、
  行内动作、选中态、StepList 五组断言。
- `test/client.test.js`：结构契约断言按 v2 更新（解绑动作移至当前任务卡）。
- `test/helpers/client-theme.js`：导出台词与 `StepList`；fixture 步骤补 `acceptance` /
  `verification: human`。
- 后端 `lib/board.js`、`lib/index.js`、`lib/state.js`、`lib/types/index.d.ts` 未改动。

## 已知取舍

- 原三泳道视图与「看板 / 列表」切换被删除，由方案 A 的表格形态替代（用户已确认）。
- 原型文件 `prototype/kanban-chip.prototype.html` 只做留档，不进入主分支。

## 遗留（与本任务解耦）

- `feat-10-21-switch-task-type/prd.md` 曾被误覆盖，待用户决定重写方式。
