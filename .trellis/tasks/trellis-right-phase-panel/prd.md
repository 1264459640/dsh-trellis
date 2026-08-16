# Trellis 会话头部阶段徽标 PRD

## 背景
用户希望 Trellis 插件在 DeepSeek Harness Web GUI 主会话页面提供可见 UI，用于持续展示当前**项目活动任务**的进行阶段，而不是只能从每轮注入的文本面包屑或诊断工具中得知状态。方案采用官方 additive 扩展点 `conversation.session.header.utilities`（会话标题行右侧的 list 槽）注册一枚**精致小巧的嵌入徽标**（用户明确否决悬浮 panel 形态），并让模型通过 `trellis_ui_update` 工具触发状态刷新。

## 范围
### In Scope
- 在会话标题行右侧以一枚嵌入徽标（`conversation.session.header.utilities`，list/additive，fresh id `trellis-workflow:task-chip`）展示当前项目活动任务；不占用或覆盖原生 `details` 工具详情栏、不影响 sidebar 与会话操作按钮，不修改 DSH Web shell。
- 徽标从 Trellis host 提供的、按 sessionId 校验且无路径泄露的只读状态接口读取任务标题、任务状态、`work.type` 与细粒度 `work.stage`；浏览器不读取项目文件或 agent prompt breadcrumb。
- 徽标紧凑呈现（一行高度：状态圆点 + 短标签，如 `feat · design`）；悬停/点击展开对应 `work.type` 的阶段轨道（feat / issue / refactor 各有轨道），未知 stage 有固定回退；突出当前阶段。
- 空态（映射为最小呈现，不报错）：请求失败（点击可重试）、无活动任务（浅灰点提示）、工作区未命中 allowlist（隐藏徽标）、首次尚无摘要（浅色点，点击刷新）、无当前会话（该座位为 session 作用域，天然不渲染）。
- 复用现有 Web client-plugin 模块格式、React 与 locale 机制；当前会话 id 由框架标准 prop `sessionId` 注入（session 作用域槽），无需订阅 `sessions.list`。

### Out of Scope
- 不创建、启动、暂停或修改 Trellis Task。
- 不改变现有面包屑注入、工作流状态解析或 Web 设置页行为。
- 不提供跨会话任务列表、持久化布局偏好或自动轮询。
- 不依赖任何第三方宿主；不采用 frame 级悬浮 panel 形态。

## 验收标准
- [ ] 在具备当前会话的主页面，用户能在会话标题行右侧看到一枚嵌入的“Trellis Task”阶段徽标（精致小巧、一行高度），且不覆盖原生工具详情栏、不影响 sidebar 与会话操作按钮。
- [ ] 活动任务存在时，徽标显示紧凑的任务类型与当前工作阶段，并在对应 `work.type` 的阶段轨道中醒目标示当前阶段（悬停/点击展开）。
- [ ] 尚未收到状态或没有活动任务时，徽标不报错且显示可理解的最小空态；工作区未命中 allowlist 时徽标隐藏。
- [ ] 模型调用 `trellis_ui_update`（或下一轮 pre-step 刷新缓存）后，徽标在刷新动作（点击刷新/页面焦点回归/会话切换）后显示刷新后的阶段。
- [ ] 无 web 服务的 profile（headless）下 Trellis 既有功能（面包屑、skills、`trellis_state`）不受影响。
- [ ] 中文与英文界面文本均可用；构建/静态检查通过。

## 约束与风险
- 客户端不能直接读取项目文件或调用未装配的 host RPC；状态只能来自 host 生成的会话级缓存摘要。
- 路由只读缓存：任何浏览器请求都不触发项目状态解析或 fs 读取；入参仅 sessionId，无路径；`trellis_ui_update` 不接受任何参数。
- `details` 是 DSH 布局预留的单占位工具详情栏，不能被本功能占用或覆盖；同样不得占用 `sidebar`/`conversation`/`conversation.session` 等单占位槽。
- 徽标必须保持一行高度内的精致紧凑形态；完整轨道信息只在悬停/点击时展开，不作为常驻 panel。
- host 侧 web 服务必须用 `ctx.inject` 动态注入，避免静态 inject 在 headless profile 拖垮整个插件。

## 相关代码/文档
- `lib/index.js` — host 状态解析、`trellis_state` 工具、`trellis_ui_update` 工具与 `/trellis-workflow/api/task-state` 路由。
- `lib/state.js` — phase/status 解析、按 work.type 的阶段轨道、确定性活动任务选择纯函数。
- `lib/trust.js` — 本地重实现的同源围栏。
- `lib/client.js` — 客户端插件模块、settings tab 与会话头部 `trellis-workflow:task-chip` 嵌入徽标。
- DSH 官方文档：extension-cookbook / client-modules（开发扩展形态参考）。
