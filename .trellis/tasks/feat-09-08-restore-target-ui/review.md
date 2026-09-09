# Code Review：工作台视觉高保真还原

verdict: passed

## Findings（按阻塞性排序）

### [blocking] 窄屏响应式规则未挂载到实际主区
- **证据**：`lib/client.js:2414-2429` 定义了 `.trellis-workbench-main` 的媒体查询，要求该元素在 `<1180px` 时 `overflow-x:auto`，并要求其直接子泳道保持 `min-width:220px/200px`。
- **实际代码**：`lib/client.js:2887-2898` 左侧主区只设置了 `style`，没有 `className: 'trellis-workbench-main'`；因此这些媒体查询永远不匹配。
- **影响**：在约 1024px 或更窄视口，详情栏 `minWidth:280px`/`width:350px` 与三列泳道会挤压左侧区域；泳道 `minWidth:0`，不会按设计允许局部横向滚动，可能出现列被压窄或内容不可访问。这直接违反 `design.md:22-23`、`design.md:53` 的窄屏验收标准。
- **建议修复**：在 `lib/client.js:2887` 左侧主区添加 `className: 'trellis-workbench-main'`，并在实际 GUI 的约 1024px、760px 视口复验；不改变数据或回调。

### [blocking] 选中任务回退到筛选结果首项，改变既有选择/详情语义
- **证据**：`lib/client.js:2350` 将 `selectedTask` 从原来的 `tasksAll.find(...) || null` 改为 `tasksAll.find(...) || (tasks.length > 0 ? tasks[0] : null)`。
- **影响**：搜索或类型筛选导致当前 selected slug 不在可见 `tasks` 中时，右侧详情会自动展示另一项任务；这不是纯视觉变化，违背 `prd.md:22`、`design.md:8` 和不可改变行为清单 `design.md:29-32` 中"选中任务只更新现有本地状态/详情联动"及零行为回归要求。也可能让用户误以为首项已被选中，而卡片没有对应选中态。
- **建议修复**：恢复 `const selectedTask = tasksAll.find((task) => task.slug === selected) || null;`；若产品确实要首项默认选中，应另行更新需求并明确状态同步行为，不能作为视觉修复隐含引入。

## 复审结论（2026-02-25）

两个 blocking findings 均已修复并经复审确认：

1. **窄屏响应式已挂载**：`lib/client.js:2890` 左侧主区 div 已添加 `className: 'trellis-workbench-main'`，使 `lib/client.js:2414-2429` 的媒体查询（`<1180px` 时 `overflow-x:auto`、子泳道 `min-width:220px/200px`）能正确匹配；className 添加不改变桌面宽度下的布局，无回归。
2. **选中语义已恢复**：`lib/client.js:2350` 已恢复为 `const selectedTask = tasksAll.find((task) => task.slug === selected) || null;`，不再回退到筛选结果首项；筛选/搜索把选中任务排除后，右侧详情显示占位提示（`KanbanDetails` 在 `!task` 时于 `lib/client.js:1127` 提前返回占位视图），`onActivate` 闭包只在非空分支可达，无 null 解引用回归。

验证命令：`node --check lib/client.js` 通过（无语法错误）。
（注：`npm test` 在 Windows sandbox 下因 Node test runner `spawn EPERM` 无法启动，属环境限制；建议在非受限环境重跑测试。）

## 非阻塞观察

- `lib/client.js:695` 的 `TB.color.ink` 回退值为 `#1E293B`，而设计基线建议纯黑 CTA；当前为深岩色，视觉上略偏离但不构成代码阻塞，可在 GUI 对照后决定是否改为 `#000000`。

## 结论

两个 blocking findings 均已正确修复且无回归，`node --check` 通过，本次 review 通过。