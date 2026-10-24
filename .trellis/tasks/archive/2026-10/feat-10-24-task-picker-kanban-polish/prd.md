# Feature PRD：打磨任务选取下拉与看板 UI

## 背景
v2（feat-10-21「安静列表 · 当前任务置顶」）的结构用户认可，但整体观感「差点意思，不够精致和稳重」。
用户希望在视觉层次、配色与状态色、字体排版、交互细节四个方向都做一轮打磨。
不推翻 v2 结构，只做质感层面的收敛。

## 现状诊断（读 `lib/client.js` 得出）
1. **字号碎**：10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 14.5 / 15 / 16 共 9 档，大量半像素，层级不清。
2. **圆角与阴影偏「软」**：圆角 4–16 共 9 档；popover 14px + `0 24px 56px` 大阴影、chip 是透明胶囊，整体显得飘、轻。
3. **卡中卡**：当前任务卡（well 底）里再嵌一张带内描边的白色步骤子卡，层次繁杂。
4. **状态色偏艳**：成功绿 `#3BAF62`、琥珀、红都是高饱和填充；大看板里已完成行一排满格绿进度条，视觉噪音大。
5. **动效偏活泼**：绑定任务的点无限呼吸光晕；popover 入场带 scale。
6. **大看板表格无表头**：列含义靠猜，信息密度高但不「稳」。
7. **交互细节缺口**：popover 打开不聚焦列表、关闭不把焦点还给 chip；大看板表格不能用 ↑↓ 选择。

## 范围
### In Scope
- `TB` 设计 token 收敛：字号阶梯、圆角阶梯、阴影、状态色降饱和。
- TaskChip、迷你看板 popover（当前任务卡、分组列表、页脚）、展开大看板（顶栏、表格、详情栏）的样式调整。
- 大看板表格新增表头行；筛选 tab 改为分段控件样式。
- 交互：popover 焦点管理、大看板 ↑↓ 选行、动效收敛（含 reduced-motion）。
- 相应测试更新与新增。

### Out of Scope
- 不改信息结构（仍是当前任务卡 + 分组列表 / 分组表格 + 详情栏）。
- 不改后端（`lib/board.js`、`lib/index.js`、`lib/state.js`）与任何 API。
- 不新增色相；不恢复彩色类型徽章、竖条、选中描边（spec 第 25/27 条）。
- 不改设置页 `TrellisConfigCard`。

## 验收标准
- [ ] 看板相关组件只使用 `TB.T` 中定义的 4 档字号，不再出现散落的半像素字号字面量。
- [ ] 圆角只用 `TB.R` 的 ≤5 档；popover / modal 阴影更收敛。
- [ ] 当前任务卡内不再有嵌套子卡片（步骤清单直接排在卡内，以分隔线区分）。
- [ ] 状态色（成功/警告/危险）的点与图标为降饱和版本；已完成行进度条改为中性色，绿色只保留在状态点和完成勾。
- [ ] 绑定中的任务不再无限呼吸，改为静态光环；入场动画只做淡入 + 轻位移。
- [ ] 大看板表格有表头（任务 / 类型 / 阶段 / 进度 / 步骤），中英文案齐全。
- [ ] popover 打开后焦点落在列表（或当前卡主按钮）上，Esc 关闭后焦点回到 chip；大看板中 ↑↓ 可在可见行间移动选择。
- [ ] light / dark / 无宿主 token 三种主题下对比度测试（≥4.5:1）全部通过；`npm test` 全绿。
- [ ] 用户在真实 GUI 中验收观感（人工步骤）。

## 约束与风险
- 颜色必须继续写内联 style（对比度测试读内联值，spec 第 31 条）。
- `color-mix()` 降饱和需在浏览器中复核（spec 第 24 条）。
- 观感是主观判断，最终以用户人工验收为准。

## 相关代码/文档
- `lib/client.js` `#region lib/types/client/trellis-kanban.js`（`TB`、`TW_CSS`、`KanbanBoard`、`CurrentTaskCard`、`KanbanTaskItem`、`KanbanExpandedModal`、`KanbanDetails`、`TaskChip`）
- `test/client-theme.test.js`、`test/client.test.js`、`test/client-portal.test.js`
- `.trellis/spec/trellis-workflow/web-ui/index.md` 第 17、22–31 条
- 前序设计：`.trellis/tasks/archive/2026-10/feat-10-21-kanban-chip-polish/design.md`
