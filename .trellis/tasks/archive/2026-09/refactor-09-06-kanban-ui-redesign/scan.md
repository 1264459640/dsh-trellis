# Refactor Scan: 看板UI重构（列表与看板解耦及图标化）

## 目标范围
- 前端交互组件：`lib/client.js`
- 国际化文案：`lib/client.js` 内的 `zh` 和 `en` 词条配置
- 涉及视图：
  1. 小看板气泡窗（TaskChip Popover）
  2. 大看板弹窗（KanbanExpandedModal）
  3. 任务卡片与列表项（KanbanTaskCard / KanbanLaneCard）
  4. 任务详情面板（KanbanDetails）
  5. 顶部工具栏与过滤控制

## 候选项
| ID | 位置 | 问题 | 建议 | 选中 |
|----|------|------|------|:---:|
| 1 | `lib/client.js` (TaskChip Popover) | 小窗仅 400px 宽却硬分规划中/进行中两列，导致任务标题被严重截断省略，列表与看板职责不清 | 解耦为高密度垂直任务列表（单列流动布局），每项展示完整标题、slug、工作流彩色标记与紧凑进度，保留归档分组折叠 | [x] |
| 2 | `lib/client.js` (KanbanExpandedModal) | 大看板把功能/缺陷/重构分成三整行，每一行都挂载一条原生横向滚动条，三条滚动条并发视觉混乱且空间利用率极低 | 顶部类型筛选器与看板容器联动：单工作流专注看板视图；统一单滚动容器并优化自定义滚动条样式 | [x] |
| 3 | `lib/client.js` (全模块组件) | 缺乏现代矢量图标体系，满屏依赖汉字按钮（“刷新”、“展开大看板”、“收起大看板”）和简陋 Emoji（`💬`、`⛶`、`✕`、`✔`、`📦`、`⚠`、`⏳`） | 封装轻量内联 SVG 图标集（Refresh, Maximize, Close, Search, File, Folder, Play/Send, CheckCircle, Clock, Alert 等），全面替换纯文字与 Emoji 按钮 | [x] |
| 4 | `lib/client.js` (KanbanDetails) | 详情面板缺少视觉重心；操作按钮均为粗暴的线框描边；阶段流转指示 `scan design apply done` 只是纯文本带下划线 | 1. 按钮区分主次（推进任务为主色实心高亮按钮，激活为次级微弱边框按钮）；2. 阶段指示重构为极简水平步骤条（Step Tracker）；3. 产物升级为带文件小图标的列表行 | [x] |
| 5 | `lib/client.js` (KanbanLaneCard) | 大看板卡片边框呆板，高亮态只有粗蓝线框，排版松散 | 增加柔和 elevation 投影与 Hover 微动效，优化状态点对齐，采用左侧强调条与浅底色区分选中态 | [x] |

## 明确不做
- 不改变后端与 Client 之间的 API 通信协议（`/trellis-workflow/api/board`, `/trellis-workflow/api/bind`, `/trellis-workflow/api/task-state` 保持原样）。
- 不破坏会话激活（bind）与输入框自动填入（injectToComposer）的核心逻辑与降级剪贴板行为。
- 不引入重型第三方 npm 图标库，直接在 client.js 内部自包含轻量 SVG 渲染函数，确保零打包配置与单文件即开即用。

## 人审
- [x] 用户已勾选本次纳入项
