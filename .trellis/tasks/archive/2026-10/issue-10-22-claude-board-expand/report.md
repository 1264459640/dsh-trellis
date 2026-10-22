# Issue Report

## 现象
使用 Claude 主题时，在已有对话的会话看板中点击“展开/展开大看板”，展开层显示位置或层级异常（截图表现为浮层被挤到右上方并与宿主界面重叠，无法按预期占据可视区域）。同一操作在新开对话中可正常展开。

## 复现步骤
1. 在 DeepSeek Harness Web GUI 中切换到 Claude 主题。
2. 打开一个已有消息、已有会话状态的对话，并等待顶部 Trellis 任务徽标/看板加载。
3. 点击徽标打开紧凑看板，再点击“展开大看板”（或页脚进入大看板）。
4. 观察展开层的位置、遮罩、尺寸及是否被宿主容器裁切。
5. 新建一个空白对话，重复第 2–4 步，对比展开结果。

## 期望 vs 实际
- 期望：展开看板以 viewport 为基准居中显示，遮罩覆盖整个窗口，内容在 Claude/其他宿主主题和已有/新会话中一致；Esc、遮罩点击和关闭按钮均可用。
- 实际：Claude 主题的已有对话中展开层布局异常；新对话正常，说明问题与挂载座位/宿主容器上下文及主题样式交互有关，而非看板数据本身。

## 影响范围
- 会话级 Trellis 看板的 expanded modal。
- 重点影响 Claude 主题下已有对话；可能波及任何为宿主座位建立 transform、contain、overflow 或 stacking context 的主题/布局。
- 紧凑 popover 与看板数据 API 未见同类现象。

## 证据
- `lib/client.js` 当前将 `KanbanExpandedModal` 直接渲染为 `TaskChip` 根节点的子树；overlay 使用 `position: fixed` 和 `zIndex: 2000`（`KANBAN_MODAL_OVERLAY_STYLE`）。在 CSS containing block/stacking context 的宿主容器中，fixed 元素可能不再相对 viewport 定位，并可能被祖先 `overflow` 裁切或被宿主 stacking context 压制。
- `TaskChip` 同时把紧凑 popover 和 expanded modal 挂在 `rootRef` 内；已有对话与 blank/new 对话使用不同宿主座位（header utilities vs input dock），因此两者祖先布局上下文不同。
- 既有规范明确 expanded modal 当前“渲染在 rootRef 内”（`.trellis/spec/trellis-workflow/web-ui/index.md` 及历史 review），该设计正是跨宿主主题兼容性的高风险点。
- 当前测试覆盖主题色和组件树，但未覆盖 modal 在不同挂载座位、祖先 transform/overflow/stacking context 下的几何与层级行为。