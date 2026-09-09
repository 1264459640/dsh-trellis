# 实施备忘：工作台视觉高保真还原

## 前置条件
- 用户已明确批准 `prd.md` 与 `design.md` 的最终摘要。
- 独立设计审查已通过（`design-review.md` status: passed）。
- 独立代码审查已通过（`review.md` status: passed，两个阻塞项均已修复并复核）。
- 不覆盖当前工作区中与本任务无关的未提交改动。

## 已完成实施（lib/client.js）
1. **展开工作台外壳与遮罩**：模态宽度 `min(1450px, calc(100vw - 64px))`、高度 `min(92vh, 960px)`；遮罩改为深炭半透明 `rgba(18,19,22,0.72)`；圆角 token 微调（popover 24px / card 10px / ctrl 8px）。
2. **详情栏**：宽度 336 → 350px，新增 `minWidth: 280`，保留独立纵向滚动与左侧发丝分隔。
3. **泳道**：列最小宽度 240 → 0（桌面由 flex 均分，不再强制撑宽）。
4. **完成语义**：`KanbanLaneCard` 当 `phase==='completed' || archived || status==='completed'` 时进度视觉强制 100%，步骤计数文案保持真实（零步骤任务不再出现空轨+对勾矛盾）。
5. **响应式**：注入 `.trellis-workbench-main` 媒体查询——≤1179px 左侧主区 `overflow-x:auto`（泳道 `min-width:220px !important`），≤759px 降为 200px；左侧主容器已挂载 `className`。
6. **行为回归修复（code review 阻塞项）**：`selectedTask` 恢复为 `tasksAll.find(...) || null`，筛选/搜索隐藏选中项时不再自动改选第一个任务。

## 验证命令与结果
- `node --check lib/client.js`：通过。
- `npm test`：受限沙箱下 Node test runner 触发 spawn EPERM；以更宽权限执行后 **91/91 全部通过**。
- GUI 人工验证：待用户在现有 DSH 界面刷新后确认（宽屏/窄屏布局、交互回归）。

## 待办
- 用户刷新 GUI 并确认视觉与交互后，将 `validate-gui` 步骤标记为 human 验证通过。
- 之后进入 finish：视情况更新 spec（`trellis-update-spec`）、提交并收尾。

## 高风险文件与回滚点
- `lib/client.js`：单文件打包式 client 源，须避免无关格式化和 API 行为改动。
- `.trellis/.runtime/*`：仅由任务工具维护，不手写编辑。
- 回滚以本任务对 `lib/client.js` 的精确 diff 或后续单独提交为界。