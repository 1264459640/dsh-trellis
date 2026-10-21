# Feature PRD: 小看板支持列表项快捷激活任务

## 背景
用户在 DeepSeek Harness Web 界面中使用 Trellis 插件时，经常需要切换活跃任务。目前点击顶部任务 Chip 会弹出紧凑浮层（小看板 Popover），展示规划中与进行中的任务列表。
但当前小看板中的任务项点击仅能改变高亮选中（`selected`），没有任何操作按钮来消费外层已传入的 `onActivate` 回调；用户若想切换激活任务，必须点击右上角“展开大看板”，在大模态窗的右侧抽屉中点击“激活任务”，路径较长。
用户希望在小看板的未激活任务项上直接提供轻量快捷的激活图标按钮，点击后即可直接绑定为当前会话激活任务。

## 范围

### In Scope
1. **小看板列表项快捷激活图标按钮**：
   - 在 `KanbanTaskItem` 右侧（阶段徽章后方）为未激活任务提供激活图标按钮（方案 A）。
   - 图标使用内联轻量 SVG 图标（如 `play` 或 `zap`），保持与现有设计风格一致。
   - 带有悬浮提示文案 `t('activate')`（“设为当前会话激活” / “Set as active for session”）。
2. **事件与状态处理**：
   - 点击激活按钮直接调用 `onActivate(task.slug)`，设置当前会话激活任务。
   - 阻止与外层卡片选择的冒泡冲突。
   - 处理 DOM 嵌套规范：避免 `<button>` 内部嵌套 `<button>`，采用容器分离或规范的语义化交互结构。
   - 处理防重与禁用态：在 `busy` 处理中时禁用按钮，防止连击。
3. **激活 / 取消激活成对出现（v2 追加，用户验收反馈）**：
   - 当前已激活任务：右槽显示 **■ 停止按钮**（`renderIcon('stop')`，`title`/`aria-label` = `t('deactivate')`「取消当前激活」），点击调用 `onDeactivate()` 清空会话绑定（`bind(null)`），**不再保留静态 brand 状态点**（用户选择：蓝点换成 ■ 停止按钮）。
   - 「已激活」由此 ■ 按钮 + 顶部 Chip 标题共同表达；未激活行仍是 ▶ 激活按钮。
   - **明确不用** `TB.color.success` 绿点（绿色在本项目专指已完成/归档，见 `phaseDotColor`）。
   - 归档列表中的任务：归档只读，不显示任何动作。
4. **组件层级透传**：
   - `KanbanBoard` 将已有的 `onActivate`、`onDeactivate` 与 `busy` 向下传递给 `KanbanTaskItem`。

### Out of Scope
1. 不修改大看板（`KanbanExpandedModal`）右侧抽屉的原有行为与设计。
2. 不在小看板中增加复杂的直接状态流转或编辑功能，保持看板克制。

## 验收标准
- [ ] 未激活任务项右侧展示 ▶ 激活图标按钮，悬停提示「设为当前会话激活」（i18n key `activate`）；已激活任务项右侧展示 ■ 停止按钮，悬停提示「取消当前激活」（i18n key `deactivate`，zh/en 均存在）。
- [ ] 点击 ▶ 触发 `onActivate(task.slug)` 绑定当前会话任务；点击 ■ 触发 `onDeactivate()` 清空绑定；两者成功后顶部 Chip 均联动刷新。
- [ ] 点击任一按钮不会产生 HTML 规范警告（无嵌套 button），且不会干扰外部的 Popover 行为。
- [ ] 行末右槽**每行恒有且仅有一个动作按钮**：`active` → ■ 取消激活；否则 → ▶ 激活（**即使该行已 selected 也仍有按钮**）。不保留静态状态点，因此不存在「两种蓝点并存」或「点选中后按钮消失」。
- [ ] 页面上至多一个 ■ 按钮（对应唯一 `currentTask`）。
- [ ] **成功路径**：点击激活后 `selected` 同步跟随，不出现「A 高亮 + B 激活」的双重强调；失败路径（`bind` 静默失败）：`selected` 已切、原激活行仍是 ■ 按钮、按钮仍可原地重试，不弹错误提示。
- [ ] 归档任务列表保持纯只读，不展示任何动作。
- [ ] 在 `busy` 状态下 ▶ 与 ■ 按钮均呈现禁用样式，避免重复并发请求。
- [ ] `deactivate` 双语 key 齐备（zh+en），源码不再残留硬编码 `'当前会话激活'`，且不遗留无用的 `activeSessionHint` 死键。
- [ ] 新增渲染树断言（无 button 嵌套 / 未激活行有 ▶ / 激活行有 ■ 且无 ▶ / busy 禁用 / 点击时序）与全套单元测试 100% 通过。

## 约束与风险
- **HTML 规范约束**：`KanbanTaskItem` 原本为 `<button>`，若直接在内层放 `<button>` 会导致不合法的 DOM 树结构。需重构为包含卡片主体与操作按钮的组合容器，或外层容器 + 内部各自独立的无障碍元素。
- **视觉紧凑度**：小看板实宽 **580px**（`KANBAN_POPOVER_STYLE.width`，`lib/client.js:914`），列表区内宽约 536px；右侧 24px 动作槽不挤压标题，省略号文本（`textOverflow: 'ellipsis'`）需保持正常。
- **spec 约定 18 的显式修订**：取消「行末实心聚焦蓝灯」（右槽让位给激活/取消激活动作）；选中态改由「3.5px Accent Bar + 选中底色 + 标题加粗」表达（**不加光晕**：D3 已钉死 `boxShadow:'none'`，与现网 1024 一致；需保持键盘焦点环可见，不写 `outline:'none'`）；已在 `web-ui/index.md` 约定 18 写入更正记录。
- **`renderIcon` 不支持 `fill`**（`baseProps.fill` 硬编码 `'none'`，`lib/client.js:722`）：图标必须用描边图元，调用处不得传 `fill`。

## 相关代码/文档
- `lib/client.js`：`KanbanBoard`、`KanbanTaskItem`、`renderIcon`
- `test/board.test.js`：看板数据与状态测试
