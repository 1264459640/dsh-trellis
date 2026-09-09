# 任务看板面板 UI 重设计 — 实现备忘（Implementation Plan）

## 改动文件清单
- `lib/client.js` — 包含所有前端组件渲染与样式

## 步骤拆解（Step Breakdown）

### 步骤 1：抽取并定义统一的现代工匠风设计 Tokens
- 在 `lib/client.js` 的 `KANBAN_*_STYLE` 常量区块，重构并整理设计常量：
  - `DESIGN_TOKENS`：背景层级、边框色、圆角分级、阴影层级、字阶与字重。
  - 主操作按钮 `PRIMARY_CTA_STYLE`（Vercel 纯黑实心按键风格）。
  - 任务状态语义颜色映射函数与状态点样式。

### 步骤 2：重构会话头部徽标 `TaskChip` 与 `HeroTaskChip`
- 优化尺寸、胶囊圆角（Pill 9999px）、发丝微边框。
- 增强悬停动效和激活态反馈。

### 步骤 3：重构紧凑浮层 `KanbanBoard` 架构与样式
- 恢复「规划中（Planning）」与「进行中（In Progress）」双列泳道容器布局。
- 顶部 Header 重构：项目名、简洁 FilterChip 药丸组、全屏与关闭按钮。
- 泳道头部与空态展示美化。

### 步骤 4：重构任务卡片 `KanbanLaneCard` 与列表项 `KanbanTaskItem`
- 纯白卡片底色（`#FFFFFF`）+ 1px Hairline 边框 + 微环境阴影。
- 标题层级提升至 12px Semibold，搭配微型元数据胶囊标签。
- 进度条与状态微点优化。

### 步骤 5：重构任务详情面板 `KanbanDetails`
- 顶部纯黑高对比实体主 CTA 按钮（「激活任务」）。
- 阶段流水线（Stage Pipeline）微型化、连线与激活节点精致化。
- 产物列表（Artifacts）卡片化与一键填入快捷按钮样式升级。
- 步骤清单（Steps）状态与图标对齐。

### 步骤 6：重构展开大看板 `KanbanExpandedModal`
- 1120px 宽屏工作台布局与 Linear 风格搜索框。
- 三大列泳道（规划中 / 进行中 / 已归档）对齐新设计系统。
- 归档列表 `KanbanArchive` 折叠树视觉精致化。

### 步骤 7：全面回归验证与测试
- 语法检查：`node --check lib/client.js`
- 单元测试：`node test/client.test.js`、`node test/board.test.js`
- 比对效果图验收视觉还原度。
