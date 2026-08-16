# Trellis 会话头部阶段徽标设计

status: approved   # draft | approved
execution_lane: standard   # quick | standard

## 目标与非目标
- 目标：在 DeepSeek Harness Web GUI 会话标题行右侧，以一枚**精致小巧的嵌入徽标**（官方 additive 座位 `conversation.session.header.utilities`）展示当前**项目活动任务**的阶段；模型在关键阶段通过 `trellis_ui_update` 工具触发刷新，Web 只消费 host 发布的会话级、无路径摘要。
- 非目标：不采用 frame 级悬浮 panel 形态（本方案不注册 `shell.overlay`）；不依赖任何第三方宿主；不占用/替换原生 `details` 工具详情栏、sidebar、conversation 等单占位槽；不修改 DSH Web shell；浏览器不读取项目文件、agent 消息或任意路径；不提供工作流写操作。

## 方案
### 边界
- `lib/index.js`（host）：复用 `resolveProjectState()`；注册 `trellis_ui_update` 模型工具（**空 parameters schema，不接受任何参数**）与同源只读路由 `POST /trellis-workflow/api/task-state`；维护 sessionId → 无路径摘要缓存（LRU 上限 + session disposed 清理）。
- `lib/state.js`（host）：解析 task.json 的可公开字段（title、status、work.type、work.stage），提供按 work.type 分支的阶段轨道与固定回退，并实现确定性的“项目活动任务”选择纯函数。
- `lib/trust.js`（host）：本地重实现约 40 行 DNS-rebinding/跨站围栏（不可 import dsh-client-connection 的 `isTrustedApiRequest`，其未导出；模式同 dsh-client-connection / better-sidebar trust-fence）。
- `lib/client.js`（Web client）：保留 settings tab；在 `conversation.session.header.utilities`（list / session scope / additive）注册嵌入徽标 `trellis-workflow:task-chip`；组件经框架标准 prop `sessionId` 取当前会话 id（session 作用域由框架注入，**无需订阅 `sessions.list`**），查询 host 路由渲染。
- host 侧 **webServer/sessions 服务一律用 `ctx.inject([...], cb)` 动态注入**（同仓先例 `lib/settings.js:40`），不写入静态 `inject`，避免无 web 服务的 profile（如 headless）驻留整个插件 fiber 而丢失面包屑/skills/`trellis_state`。

### 数据流
```text
模型在阶段切换/任务创建/检查完成时调用 trellis_ui_update（无参数）
  -> host 用当前 agent/session 的可信 cwd（exec.agent.session.header.cwd）匹配 allowlist
  -> host 解析项目活动任务（确定性选择规则，见下）
  -> 生成 path-free 摘要 { kind, title?, status?, stage?, phase, workType? }
  -> 写入 sessionId -> 摘要缓存并返回给模型

（可选）agent/pre-step 注入点在既有 resolveProjectState 路径上顺带刷新缓存。

Web 客户端：
  -> 会话头部的徽标组件（session 作用域）持框架注入的 sessionId
  -> POST /trellis-workflow/api/task-state { sessionId }
  -> host 校验：session 存活（sessions.get 命中）且缓存存在 -> 返回缓存摘要
  -> 路由只读缓存，绝不由浏览器请求触发 fs 解析
  -> 徽标紧凑渲染当前阶段；悬停/点击展开完整轨道或最小空态
```

### 契约变更
- 新增模型工具 `trellis_ui_update`：**空 parameters**（不接受任何参数；不得学 `trellis_state` 留可选 cwd），触发 host 重新解析并刷新缓存，返回摘要；`output.schema` 用摘要 schema 声明。
- 新增同源只读路由 `POST /trellis-workflow/api/task-state`（`webServer.register({ kind: 'prefix', path: '/trellis-workflow/api', handler })`，注册包进 `ctx.effect`）：
  - 先过本地 trust fence；非 POST → 405；body 超限/非 JSON → 400（错误不泄露路径）；
  - 入参仅 `{ sessionId }`；校验 = 存活 session（`sessions.get(id)` 命中）且缓存存在；任一不满足 → 稳定空态 `no-summary`（与未知 session 同态，避免探测差异）；
  - **任何浏览器请求都不触发项目状态解析或 fs 读取**；响应为 path-free 摘要或稳定空态，不返回项目根、任务目录、runtime 文件路径或底层错误详情；
  - 缓存：LRU 上限（如 128 条），session 关闭（disposed）时清理。
- 客户端：`conversation.session.header.utilities` 嵌入徽标注册（list / session scope / additive，fresh id `trellis-workflow:task-chip`）。组件经框架标准 prop `sessionId`（`SessionStandardProps.sessionId: SessionId`，由 `dsh-client-runtime` merge 注入）取当前会话 id；会话切换由框架按 key=sessionId 重挂载该作用域槽，自动重新取数。`exports.inject` 维持现状（`['slots', 'locale', 'settingsScope']`），仅不新增 `'sessions'`（session 作用域无需注入）。
- 不变更 `trellis_state` 工具响应与现有面包屑文本。

### 呈现与状态规则
- 注册：`ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'trellis-workflow:task-chip', order: 100 }, TaskChip))`——按 settings tab 先例（`lib/client.js:218-230`）包裹 `slots.inject`，消除加载顺序依赖（package.json 的 dsh.client.inject 未含 dsh-client-ui-conversation，裸 register 在极端顺序下可能抛「registering into an undeclared slot throws」）。该座位由已装 `dsh-client-ui-conversation` 真实渲染（`lib/client.js:6991-6994` 的 `headerUtilities` 行，声明于 `lib/client.js:9611-9614`）；list/additive，fresh id 与既有条目并列，不替换任何单占位槽。
- 徽标形态（一行高度，精致紧凑）：状态圆点（按 phase 着色）+ 短标签（如 `feat · design`）；悬停/点击展开**锚定徽标的小浮层**（非 frame 级 panel）显示任务标题、状态与按 `work.type` 分支的阶段轨道：
  - feat：`prd → design → design-review → impl → review → check → finish`（`finish` 为 completed 回退的展示性末端节点，非任务可写 stage）；
  - issue：`report → analyze → fix → fix-note`；
  - refactor：`scan → design → apply → done`；
  - 未知 work.type / work.stage：按 status 回退（planning→轨道首阶段、in_progress→该 type 的 in_progress 段首 stage、completed→finish），非轨道 stage 显示为“进行中”徽标而非空白。
- 空态（稳定 kind 枚举，映射为最小呈现）：`no-match`（工作区未启用 Trellis）→ **隐藏徽标**（避免非 Trellis 项目噪音）；`no-task`（无活动任务）→ 浅灰点 + “无活动任务”提示；`no-summary`（首次尚无摘要/会话不存活）→ 浅色点 + “点击刷新”提示；请求失败 → 感叹号点，点击重试。
- 刷新策略（无自动轮询）：挂载时、会话切换（框架重挂载）时、页面 focus/visibility 回归时各取一次缓存；浮层内提供手动刷新按钮。
- 无当前会话时不渲染（该座位本身为 session 作用域）。
- 使用 DSH token CSS variables 与内联 styles。

### 取舍
- 放弃 frame 级悬浮 panel 形态（`shell.overlay`）：用户明确要求**精致小巧的嵌入 UI**；`conversation.session.header.utilities` 是官方 additive list 槽，会话内常驻、不改变任何现有布局，零替换风险。
- 放弃浏览器主动轮询/读取消息：改为“模型工具触发（+ pre-step 顺带刷新）→ host 缓存 → 徽标在挂载/会话切换/focus 回归/手动点击时读缓存”，授权面最小。
- session 作用域省去 `sessions.list` 订阅：框架标准 prop 直接注入 `sessionId`，比 root 作用域（shell.overlay 方案）更简单；上一版“client inject 增加 'sessions'”的结论随作用域变更作废。
- host 用 `ctx.inject` 动态注入 web 服务：保证 headless/无 web profile 下插件其余功能不受影响。

## 参考实现
- DSH 官方文档：[extension-cookbook](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/extension-cookbook)（工具/钩子/UI 插件形态）、[client-modules](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules)（静态 client bundle 机制）。
- 本机已装模块实证：`dsh-client-ui-conversation` 的 `conversation.session.header.utilities` 座位声明（`lib/types/client/contract/slots.d.ts:62-70`）与渲染点（`lib/client.js:6992-6994`、`9607-9611`）；`dsh-client-runtime` 的 `SessionStandardProps.sessionId` merge（`lib/types/client/index.d.ts:70-74`）；`dsh-host-webserver` 的 `webServer.register`（`lib/types/index.d.ts:72`）。
- DSH-better-sidebar 本机未安装，仅作 trust-fence 模式参考，不 import。

## 外部前置条件（已验证）
- Web profile 含 `dsh-pulse`、`@anionex/dsh-vision-toolkit`、`dsh-trellis`（自用，与本功能无关）。
- `conversation.session.header.utilities`：list / session scope / additive，本机已装 `dsh-client-ui-conversation` 真实渲染；`SessionStandardProps.sessionId` 由框架注入。
- `ctx.sessions.get(id)`、`SessionHeader.cwd?`、`ctx.webServer.register({kind:'prefix'|'exact'})` 已在本机模块中验证存在。
- 当前 Web GUI：`http://127.0.0.1:59749`。

## 风险与回滚
- 风险：任务状态在模型未调用工具且未进入下一轮前不更新 → 徽标显示时效性提示（刷新按钮/焦点回归重取）。
- 风险：路由 session 校验失败 → 返回空态，不泄露信息。
- 风险：headless profile 无 web 服务 → `ctx.inject` 回调不触发，路由/工具缓存不激活，但面包屑/skills/`trellis_state` 不受影响。
- 回滚：移除 `trellis_ui_update`、路由注册与 `conversation.session.header.utilities` 徽标注册；既有 settings、面包屑与 `trellis_state` 相互独立、可单独回退。

## 验证计划
- 静态检查：`node --check` 全部改动 JS；host ESM 可加载；client module 可被 loader 解析。
- 运行中 `http://127.0.0.1:59749`：会话标题行右侧出现精致小巧的 Trellis 徽标；空态 → 会话中调用 `trellis_ui_update` 后点击刷新/焦点回归显示项目活动任务；悬停展开轨道；原生工具详情栏与 sidebar 不受影响。
- 用当前 feature task（work.type=feat、work.stage=design）与 issue/refactor 样例验证轨道分支与回退；用临时 `.trellis` fixture 验证确定性选择规则（`dsh-session.json` 优先、文件名字典序、无命中 → no-task）。
- 无 web 服务的 profile（headless）验证插件仍可加载、面包屑可用。

## 人审检查点
- [x] 独立 UI 设计（含用户对形态的确认：嵌入徽标 + 悬停小浮层）已获用户确认（status=approved）后再进入实现
