# Trellis 会话头部阶段徽标 — 独立设计审查（第四轮修订版）

> **本文件为第四轮修订版审查**，取代第三轮已通过的 shell.overlay 悬浮 panel 版结论
> （第三轮结论与两轮 review 记录在 git 历史中；注意：`F:\dsh-plugins\dsh-trellis` 工作副本
> 当前**不是 git 仓库**（`F:\dsh-plugins`、`F:\dsh-plugins\dsh-trellis`、`F:\` 均无 `.git`），
> 若需真历史保留请另行备份第三轮 `design-review.md` 原文）。
>
> 修订动因：用户否决第三轮已通过的 shell.overlay 悬浮 panel 形态，改为**会话头部精致小巧的
> 嵌入徽标**（官方 additive 座位 `conversation.session.header.utilities`）。

status: passed

## 审查范围与证据

- 规划产物：`prd.md`（修订版）、`design.md`（修订版，status=draft）、`implement.md`（已重写）。
- 插件源码：`lib/index.js`、`lib/state.js`、`lib/resolve.js`、`lib/client.js`、`lib/settings.js`、`lib/meta.js`、`package.json`。
- 本机已装依赖实证（`node_modules/@deepseek-ai/`）：
  - `dsh-client-ui-conversation`：座位声明与渲染点；
  - `dsh-client-runtime`：`SessionStandardProps.sessionId` merge；
  - `dsh-client-ui-slots`：`KindOptions` / `register` / `ctx.slots.inject` 契约；
  - `dsh-host-webserver`：`webServer.register({kind:'prefix',...})`；
  - `dsh-session`：`sessions.get` / `SessionHeader.cwd` / `session/disposed`；
  - `dsh-client-connection`：`isTrustedApiRequest` 导出面核查；
  - `dsh-fs`：`FsInfo` 字段核查；`dsh-tools`：`defineTool` 契约。
- 模板对齐：`skills/_templates/work-types.md` 阶段表。

## 结论摘要

**passed。** 第四轮修订方向正确且契约全部可实证：新座位 `conversation.session.header.utilities`
是 list / session scope / additive 槽，由本机已装 `dsh-client-ui-conversation` 真实渲染；会话 id
由框架标准 prop `sessionId` 注入，上一轮 m5「client inject 增加 'sessions'」结论随作用域变更作废
成立；`ctx.slots.inject` 动态注入、`webServer.register`、空参数工具 + 必填 `output.schema`、
本地 trust-fence（不可 import）、只读缓存 + LRU + `session/disposed` 清理、确定性文件名选择
（`FsInfo` 无 mtime）等支柱与第三轮一致复核通过；阶段轨道与 `work-types.md` 对齐；prd/design/
implement 三者语义一致，无残留 shell.overlay/better-sidebar 主形态措辞。浮层（悬停/点击展开）
判定为符合 tooltip 型交互，不违背用户「嵌入 UI」意图（见 §3）。

无阻塞项。发现 3 项次要 + 2 项观察（见「发现」），均不阻止进入实现，但其中「客户端注册建议按
settings tab 先例包裹 `ctx.slots.inject`」建议实现前采纳。

## 逐项验证记录

### 1. 新座位 `conversation.session.header.utilities` —— 通过

- 类型声明：`dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:66-70`
  （design 引 62-70，含 62-65 行 JSDoc）：
  `'conversation.session.header.utilities': { kind: 'list'; scope: 'session'; owner: ConversationHeaderActionOwnerProps }`。
  **list / session scope / additive 三要素成立**；owner share 为空接口（该座位条目自给自足，
  一切来自框架 session kit 与注册方 inject，见 JSDoc 行 47-56 对 `header.actions` 的说明）。
- 真实渲染：`dsh-client-ui-conversation/lib/client.js:6991-6994`（design 引 6992-6994，偏移 1 行）：
  `div.headerUtilities > renderSlot("conversation.session.header.utilities", {})`。
  渲染点在 `ConversationSessionHeader` 组件内，紧随 `headerActions`（6987-6990）之后，
  属于「title 右侧、action 组之外」的独立区块（与声明 JSDoc「kept outside the title-adjacent
  action group」一致）。
- 子座位声明：`lib/client.js:9611-9614`（design 引 9607-9611，覆盖 actions 声明 9607-9610 与
  utilities 声明起点）：`"conversation.session.header.utilities": { kind: "list", scope: "session" }`，
  由 `conversation.session.header` 注册（9603-9623）的 children 表声明（declaring is claiming）。
- **fresh id = add 而非 replace**：list 槽按 `id` 分 cell（ui-slots `index.d.ts:542-548` 阴影语义），
  新 id `trellis-workflow:task-chip` 与既有条目（若有）并列渲染，按 `order` 升序排列
  （`index.d.ts:49-50` 对 actions 的说明；`KindOptions` list 形 `{ id; order?; label?; priority? }`，
  `index.d.ts:382-387`）。不占用 `details` / `sidebar` / `conversation` / `conversation.session` 等
  单占位槽（未注册任何 single 座位，注册目标是 list 槽内的一个 cell）。

### 2. 框架注入 sessionId —— 通过

- `dsh-client-runtime/lib/types/client/index.d.ts:70-76`（design 引 70-74）：
  `SessionStandardProps` merge 注入 `useSession` / `sessionId: SessionId` / `useProjection`；
  ui-slots 侧 `PropsRuntime` 对 `scope='session'` 的槽位并入 `SessionStandardProps`
  （`dsh-client-ui-slots/lib/types/index.d.ts:190`），故 session 作用域条目组件**必然收到框架
  sessionId**，无需自行订阅 `sessions.list`。
- 会话切换重挂载：`SessionAreaProps` 文档明言「the framework remounts it per session
  (key=sessionId)」（ui-slots `index.d.ts:262-263`），design「会话切换由框架按 key=sessionId
  重挂载该作用域槽，自动重新取数」成立。
- **m5 结论作废成立**：上一轮 root 作用域 shell.overlay 方案需以 `ctx.sessions.list` 自跟踪当前
  会话；session 作用域由框架直注 sessionId，故「client inject 增加 'sessions'」不再需要。
  `exports.inject` 维持现状即可（仅注意措辞，见发现 F2）。

### 3. list 槽注册契约与 `ctx.slots.inject` 包裹模式 —— 通过（附建议）

- `KindOptions`（list → `{ id, order?, label?, priority? }`）与 `register` 签名实证于
  ui-slots `index.d.ts:382-387, 562-577`；`ctx.slots.register({ name, id, order }, Comp)` 契约合法。
- 现有 settings tab 先例（`lib/client.js:218-230`）：`ctx.slots.inject('settings.plugins.tab',
  () => ctx.slots.register({...}, TrellisSettingsTab))`。`SlotRegistry.inject` 语义
  （runtime `slots.d.ts:76-90`）：声明已存在时同步执行回调；否则在声明提交后立即执行——
  即「等待座位声明再注册」，避免「registering into an undeclared slot throws」
  （ui-slots `index.d.ts:535-537`）。
- **建议（发现 F1）**：TaskChip 注册宜按同一先例包裹 `ctx.slots.inject('conversation.session.header.utilities', ...)`。
  `package.json` 的 `dsh.client.inject` 未列出 `@deepseek-ai/dsh-client-ui-conversation`
  （仅有 api-remotes / client-runtime / client-ui-settings / client-locale），故 trellis client
  bundle 与 conversation 包之间**无声明加载顺序保证**；裸 `ctx.slots.register` 在极端顺序下可能
  先于座位声明执行而抛错。此非阻塞（座位由已装 conversation 包启动期声明），但一行包裹即消除风险。

### 4. 支柱复核（与第三轮一致）—— 通过

- `webServer.register({ kind: 'prefix', path, handler })`：`dsh-host-webserver/lib/types/index.d.ts:19-28`
  （`WebRouteKind = 'exact' | 'prefix'`、`WebRoute` 形）与 `register` 签名（行 72，返回 disposer）。
  路由 handler 拥有完整响应生命周期，405/400/JSON body 校验与「绝不回传路径」约束可落地。
- `ctx.inject` 子 fiber 动态注入先例：`lib/settings.js:40` 的 `ctx.inject(['settings'], cb)` 实证；
  design「webServer/sessions 一律 `ctx.inject([...], cb)` 动态注入」与 implement B.7 一致，
  避免 headless profile 静态 inject 拖垮插件。
- `defineTool` 空 parameters + 必填 output.schema：`dsh-tools/lib/types/schema.d.ts:183-188`
  （`parameters: S` 必填、`output.schema: O` 必填）；`index.d.ts:107-108` 明言
  「Mandatory canonical output declaration」。`parameters: {}`（空 implicit-open object root）合法。
- 本地 trust-fence 不可 import：`isTrustedApiRequest` 仅存在于
  `dsh-client-connection/lib/types/api-request-trust.d.ts:41`，包公共入口 `lib/types/index.d.ts`
  **未 re-export**（仅行 29 文档注释提及），`./client` 入口亦未导出；`src/` 未随包发布
  （package.json `files` 仅 lib/invariant.js/lib/client.js/lib/types/**），`./src/*` 导出在已装
  包内不可解析；且该包不在本插件 peerDependencies 中。design「不可 import，本地重实现约 40 行」成立。
- 路由只读缓存 + LRU + `session/disposed` 清理：`dsh-session/lib/types/index.d.ts:54`
  声明 `'session/disposed'(this: Scoped<Session>, session: Session)`；实现 `ctx.on('session/disposed', ...)`
  按 `session.id` 清理缓存可行。「任何浏览器请求都不触发 fs 解析」由设计 B.7 路由仅读缓存保证。
- 确定性文件名选择：`dsh-fs/lib/types/types.d.ts:67-74` 实证 `FsInfo` 仅含
  `version` / `type` / `size?`，**无 mtime**（`FsVersion` 为不透明新鲜度令牌，不可排序语义）；
  implement A.1「`dsh-session.json` 优先 + 文件名字典序、禁止 mtime 排序、调用方注入文件列表保持
  纯函数可测」正确且可实现。
- 阶段轨道对齐 `skills/_templates/work-types.md`：
  feat `prd→design→design-review→impl→review→check`（+展示性 `finish`，模板 39 行路由表与
  47-58 行 stage 表一致；`finish` 为 completed 回退的展示末端，非可写 stage，与「status 仍只用
  planning/in_progress/completed」约定 3 不冲突）；issue `report→analyze→fix→fix-note`
  （模板 62-67）；refactor `scan→design→apply→done`（模板 75-78）。回退规则（planning→轨道首阶段、
  in_progress→in_progress 段首 stage、completed→finish）与模板 84-88 行相位映射一致。
- `sessions.get(id)` 与 `SessionHeader.cwd?`：`dsh-session/lib/types/index.d.ts:393`
  `get(id): Session | undefined`；`types.d.ts:40-52` `SessionHeader` 含 `readonly cwd?: string`；
  `Session.header`（`index.d.ts:120`）。design「`ctx.sessions.get(sessionId)?.header.cwd` 受信来源」
  成立。工具侧 `exec.agent.session.header.cwd` 与现有 `trellis_state` 执行路径（`lib/index.js:185`）
  同构。

### 5. 语义一致性（prd / design / implement）—— 通过

- 形态：prd「嵌入徽标，否决悬浮 panel」↔ design「不注册 shell.overlay；非目标显式声明」↔
  implement C.9 徽标注册；三处一致。
- 契约：`trellis_ui_update` 空参数（prd:30 ↔ design:37 ↔ implement B.8 `parameters: {}`）；
  路由只读缓存 + 稳定空态（prd:30 ↔ design:40-42 ↔ implement B.7）；确定性选择（prd 隐含 ↔
  design:13 ↔ implement A.1）；sessionId 框架注入、免 `sessions.list`（prd:12 ↔ design:43/61）。
- 空态枚举：`no-match→隐藏` / `no-task→浅灰点` / `no-summary→浅色点可刷新` / `失败→感叹号可重试`
  （design:53 ↔ implement C.9 ↔ prd 验收 3/4）。
- 刷新策略：模型工具触发 + pre-step 顺带刷新 + 挂载/会话切换/focus 回归读缓存，无自动轮询
  （prd:24 ↔ design:54/60 ↔ implement C.9）。
- 里程碑：design `status: draft`（design.md:3）+ 人审检查点未勾（design.md:88）为**正常预审状态**；
  implement D.10 将「design status=approved、task status=in_progress/stage=impl」安排在
  design-review 通过 + 用户确认之后，时序正确。
- 残留措辞：prd/design/implement 均无 better-sidebar 作为宿主、无 shell.overlay 作为主形态的
  旧措辞。design 中 shell.overlay 仅出现在「不注册/放弃/作废」语境；better-sidebar 仅作
  trust-fence 模式参考（design:14, 67，明言本机未安装、不 import）；implement.md 已重写，
  无 mtime 排序条款（仅存「禁止 mtime 排序」的正确约束句，implement.md:8）。

## 3. 「悬停/点击展开锚定小浮层」设计判断

**判定：符合标准 tooltip 型交互，不违背用户「不要 panel 形态、要嵌入 UI」的要求。**

依据：
1. **主形态是嵌入的**：常驻呈现为一枚一行高度的嵌入徽标（状态圆点 + 短标签），注册在官方
   additive list 座位内，不改变任何现有布局，不覆盖任何内容，不占用 shell.overlay / details /
   sidebar / conversation 座位。这正是用户要求的「会话头部精致小巧的嵌入徽标」。
2. **浮层是瞬态、用户发起、锚定的**：仅悬停/点击时出现、锚定徽标本身、失焦/离开即消失；这是
   tooltip/popover 的标准语义，而非常驻 frame 级悬浮 panel。prd 验收 2 与约束 4（「完整轨道信息
   只在悬停/点击时展开，不作为常驻 panel」）本身就是修订后由用户确认过的范围表述。
3. **两者互补**：徽标承载「紧凑可读的当前阶段」；浮层承载「完整轨道 + 标题 + 状态 + 刷新」这一
   无法在一行内呈现的细节。渐进披露（progressive disclosure）是嵌入式 UI 的推荐做法，不构成形态回退。

更优呈现建议（可选，不阻塞）：
- 浮层保持克制：单卡（标题 + 状态标签 + 阶段 chip 高亮当前 stage + 刷新按钮），右对齐徽标下方，
  宽度上限约 260-320px；失焦 / Esc / 外部点击关闭，避免「大浮层」观感。
- 双触发：hover 快捷预览 + click/键盘 focus 固定展开（触屏无 hover，click 必须可用）。
- 更进一步的嵌入式替代：在徽标内直接渲染细粒度阶段轨道小圆点（如 feat 7 点、当前点高亮），仍保持
  一行高度，进一步减少对浮层的依赖；浮层只承载标题/状态/刷新。

## 发现

| 级别 | 编号 | 描述 | 证据 | 处理建议 |
|------|------|------|------|----------|
| 次要 | F1 | TaskChip 注册未按 settings tab 先例显式包裹 `ctx.slots.inject('conversation.session.header.utilities', ...)`；`package.json` `dsh.client.inject` 未含 `dsh-client-ui-conversation`，与座位声明方之间无加载顺序保证，裸 `ctx.slots.register` 在极端顺序下可能因「registering into an undeclared slot throws」而使整个 client 插件 apply 失败（含 settings tab）。 | `design.md:47`、`implement.md` C.9（裸 register）；`lib/client.js:218-230`（先例）；runtime `slots.d.ts:76-90`（inject 语义）；ui-slots `index.d.ts:535-537`（未声明即注册抛错）；`package.json:13-18`（inject 列表）。 | 实现时按先例包裹：`ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name, id: 'trellis-workflow:task-chip', order: 100 }, TaskChip))`；或向 `dsh.client.inject` 增加 conversation 包以保证顺序。 |
| 次要 | F2 | design.md:43「`exports.inject` 维持 `['slots','locale']`」与实际现状不符：现为 `['slots','locale','settingsScope']`（settings tab 依赖 `ctx.settingsScope`）。若字面执行（去掉 settingsScope）将破坏既有 settings tab。 | `lib/client.js:39`（现 inject）；`design.md:43`。 | 措辞改为「维持现有 inject（`['slots','locale','settingsScope']`）不变，仅不新增 'sessions'」。 |
| 次要 | F3 | `trellis_ui_update` 无参数，缓存键 sessionId 的来源未在 implement.md 显式钉死（应为执行工具的 agent 会话 id，`exec.agent.session.id`；agent 与 Web session 共享同一 wire id）。 | `implement.md` B.6/B.8（refreshSummary(ctx, sessionId, ...) 但未指明 sessionId 取自 exec）；`dsh-client-runtime/lib/types/client/index.d.ts:56-60`（agent 与 session 同一 wire id）。 | implement B.8 注明 `sessionId = exec.agent.session.id`，与 Web 端持有的 sessionId 一致。 |
| 观察 | O1 | 工作副本非 git 仓库（`F:\dsh-plugins\dsh-trellis` 及上级均无 `.git`），「历史保留在 git」在当前副本不成立；第三轮 review 结论仅由本文件头部说明承担替代记录。 | `F:\dsh-plugins`、`F:\dsh-plugins\dsh-trellis`、`F:\` 均无 `.git`。 | 如需保留第三轮原文，请另行备份；不影响本审查结论。 |
| 观察 | O2 | design.md 引用行号存在 ±1~4 行轻微漂移（渲染点 6992-6994 vs 实际 6991-6994；子座位声明 9607-9611 vs 实际 9611-9614；runtime merge 70-74 vs 实际 70-76；slots.d.ts 62-70 含 JSDoc 实际成立）。均为实质成立的行号漂移，不影响任何结论。 | 见 §1、§2 实证。 | 无需处理；实现阶段以本文件实证行号为准。 |

## 通过条件（实现前必须满足）

- [ ] **design 用户确认置 approved**：本审查通过后，由用户对修订后的设计（嵌入徽标 + 悬停小浮层
      形态）做最终确认，`design.md` status 由 draft 置为 approved、人审检查点勾选；在此之前
      implement.md D.10 不得把 task 置入 impl 阶段。
- [ ] **implement.md 已无 mtime / better-sidebar 条款**：已确认——仅存「禁止 mtime 排序」的正确
      约束句（implement.md:8）与 trust-fence 模式参考（design.md:14/67），无旧轮宿主/排序条款。
- [ ] **客户端注册契约正确**：list/additive/fresh id 契约已实证正确；实现时按 F1 建议以
      `ctx.slots.inject` 包裹注册（或显式保证加载顺序）。
- [ ] **浮层不违背用户意图**：已判定为符合 tooltip 型交互（§3），主形态为嵌入徽标，浮层仅瞬态承载
      完整轨道细节；实现时按 §3 建议控制浮层尺寸与双触发交互。

## 最终结论

- [x] **passed**（无阻塞项；3 项次要发现 + 2 项观察，F1 建议实现前采纳，F2/F3 为措辞/细节钉死）
- [ ] blocking

审查人：独立设计审查子代理（第四轮）
