# PRD：修复 Claude 主题下看板展开异常并提升兼容性

## 目标与用户价值

修复 Claude 主题下已有对话点击“展开大看板”后，展开层位置、尺寸或层级异常的问题，使 expanded modal 在不同宿主主题、会话状态和挂载座位下都能稳定覆盖可视窗口、居中展示并正常关闭。

用户无需改变操作习惯；紧凑看板、任务筛选、搜索、详情和绑定流程保持不变。

## 已确认事实

- 现象具有会话差异：Claude 主题下已有对话异常，新开对话正常。
- 已有对话与新对话分别使用 `conversation.session.header.utilities` 与 `conversation.input.dock` 两个不同宿主座位。
- `KanbanExpandedModal` 当前直接作为 `TaskChip` 根节点子树渲染。
- overlay 使用 `position: fixed; inset: 0`，但未脱离宿主 DOM 上下文；祖先的 `transform`、`filter`、`contain`、`perspective`、`overflow` 或 stacking context 会改变 fixed 元素的定位、裁切或层级表现。
- 现有 Node 测试覆盖主题颜色、文本对比度、组件结构及 bundle 契约，没有覆盖真实浏览器布局上下文。
- 展开流程已有两个必须保留的行为：展开时刷新 board；board 尚未返回时显示空值安全的 loading 状态。
- 当前 client bundle 直接依赖 `react` 和 UI primitives，未声明或使用 `react-dom`。

## 范围（In-scope）

1. 将 expanded modal 从 `TaskChip` 宿主座位的局部布局上下文中脱离，优先挂载到 `document.body` 的 React portal。
2. 对 portal 能力和 DOM 可用性做能力守卫，避免在测试、SSR/headless 或宿主未暴露 `react-dom` 时崩溃；无 portal 能力时保留现有内联渲染作为降级路径。
3. 保持 popover 继续挂在 `TaskChip` root 内，维持其外部点击关闭语义。
4. 保留 expanded modal 的 Esc、遮罩点击、关闭按钮、搜索、筛选、刷新和详情交互。
5. 增加静态/组件树测试，并尽可能增加真实 DOM 布局回归测试或可执行的 portal 契约测试。

## 非目标（Non-goals）

- 不重做 Claude 主题或宿主主题 token。
- 不修改看板 API、任务状态机、会话绑定协议或 board 数据格式。
- 不重构整个 client bundle，不引入通用 overlay 管理器、全局状态库或新的 UI 抽象层。
- 不改变紧凑 popover 的视觉布局和交互。
- 不解决与本次 modal 定位无关的历史 UI 遗留问题。

## 验收标准

- 在已有对话的 Claude 主题中展开：遮罩覆盖整个 viewport，modal 居中且未被宿主祖先裁切；搜索、筛选、详情、关闭、Esc 和遮罩点击均可用。
- 在新开对话、header seat 和 input dock seat 中展开：行为与已有对话一致。
- 给宿主祖先增加 `transform`、`contain: paint`、`overflow: hidden` 和局部 z-index 后，modal 仍保持 viewport 级定位与可点击层级。
- portal 能力不可用或 `document.body` 不存在时，bundle 不抛异常；组件仍能走明确的降级渲染路径。
- `board === null` 时不发生 `board.tasks` 解引用；展开仍触发刷新并显示 loading；已有的 board/主题回归测试全部通过。
- 不新增或改变任何服务端端点和任务写入语义。

## 阻塞性开放问题

无。技术方案采用最小改动：可用时使用 React portal，能力缺失时安全降级。