# trellis-workflow / web-ui — 质量检查与约定

> 本文件由 `feat` 任务 `trellis-right-phase-panel`（会话头部阶段徽标）沉淀。
> 证据：任务规划产物（prd/design/design-review/implement/review）与本包 `lib/` 源码。

## Web UI 扩展约定

1. **嵌入 UI 优先选 session 作用域加法座位**，而非 root 作用域浮层：
   - 会话头部右侧状态/徽标 → `conversation.session.header.utilities`（list / session scope /
     additive，fresh id；组件经框架标准 prop `sessionId` 拿当前会话 id，**无需订阅
     `sessions.list`**；会话切换由框架按 key=sessionId 重挂载自动重取）。
   - **blank 会话（新对话，首条消息前）header 整体隐藏**（harness `hideChrome =
     blank && composerPhase === 'blank'` → header children 不渲染），utilities 座位
     不可达 → 同一 chip 必须再注册 `conversation.input.dock`（list / session scope，
     composer 卡片上方独立行，hero 阶段同样渲染，goal bar 先例）；该 hero 座位组件
     （`HeroTaskChip`）以与 header 隐藏**完全相同的谓词**自隐藏（owner props
     `InputZone.session` 快照携带 `blank`/`composerPhase`），两座位互斥、徽标永不重复。
   - frame 级悬浮层（badge/toast/pill）才用 `shell.overlay`（root scope，需自行经
     `sessions` 服务取当前 id）。
   - 注册一律按 settings tab 先例包裹 `ctx.slots.inject('<slot>', () => ctx.slots.register(...))`：
     `package.json` 的 `dsh.client.inject` 不含声明方包时无加载顺序保证，裸 register 可能抛
     「registering into an undeclared slot throws」。
2. **模型工具输出必须是 lossless JSON**：可选字段缺失用 `null`，**禁止 `undefined`**——
   dsh-tools 的 `createSuccessResult → snapshotToolValue → snapshotJsonValue`
   （@deepseek-ai/dsh-session json.js）对任一 own enumerable 值为 undefined 的属性整体返回
   undefined 并抛 `ToolOutputError("value is not lossless JSON")`；工具 `output.schema`
   应声明 `oneOf:[string,null]` 与之一致。
3. **依赖 web 服务的功能用 `ctx.inject(['webServer','sessions'], cb)` 子 fiber 挂载**
   （先例 `lib/settings.js:40`）：headless（无 web 服务）profile 下该功能整体不激活，
   主 fiber 上的面包屑/skills/诊断工具不受影响；路由 disposer 交 `web.effect`，清理监听
   用 `web.on('session/disposed', ...)`。
4. **浏览器只读 API 路由契约**（`POST /trellis-workflow/api/task-state`）：
   - 本地 trust-fence 在前（`lib/trust.js`，dsh-client-connection 的 `isTrustedApiRequest`
     未从包公共入口导出，需本地重实现 ~40 行；**Node `URL.hostname` 对 IPv6 返回带括号的
     `[::1]`**，环回判断须同时含 `'::1'` 与 `'[::1]'`）；
   - 非 POST → 405；body 超限/非 JSON → 400；未知/不存活 session 与缓存缺失同态返回
     稳定 `no-summary`（避免探测差异）；**任何浏览器请求不触发项目解析或 fs 读取**；
   - 响应为 path-free 摘要（`{ kind, title?, status?, stage?, phase, workType? }`），
     绝不回传项目根/任务目录/runtime 路径或底层错误细节。
5. **项目活动任务选择是确定性纯函数**（`activeTaskPointer`）：精确文件名
   `dsh-session.json` 优先，否则 runtime 目录文件名字典序取首个含 `current_task` 的；
   不用 mtime（dsh-fs `FsInfo` 无 mtime）。
6. **阶段轨道单一词表**：`lib/state.js` 的 `TRACKS` 与
   `skills/_templates/work-types.md` 对齐（feat 末端 `finish` 为 completed 展示性节点，
   非可写 work.stage）；客户端 `CHIP_TRACKS` 为同一词表的展示副本。

## 已知坑（防复发）

- 工具 execute 返回对象含 undefined 可选字段 → `ToolOutputError`（见约定 2）。
- `slots.register` 裸调用在声明方未加载时抛错（见约定 1，用 `slots.inject` 包裹）。
- **徽标缓存刷新链路**：Web 徽标只消费 host 缓存；缓存写入点有 `trellis_ui_update`
  工具、`trellis_task_create`（建任务成功后即时刷新本会话摘要）与每轮 `agent/pre-step`
  顺带刷新（现已在 `lib/index.js` 的 pre-step 中实现，命中 allowlist 的会话每轮自动刷新
  缓存）。曾踩坑：仅靠模型自觉调用工具时，创建任务后 UI 长期不刷新——pre-step 刷新是
  兜底，模型在阶段切换/建任务后仍应调用 `trellis_ui_update` 以获得当轮即时刷新。
- Web UI 是否可见依赖 allowlist：`F:\dsh-plugins\dsh-trellis` 不在
  `C:\Users\12644\.dsh\settings.yaml` 的 `trellis-workflow.allowlist` 时，该会话徽标按
  `no-match` 隐藏（属配置，非缺陷）；验证 UI 需把项目根加入 allowlist 并**重启 DSH**
  （静态 Cordis 插件改动无热重载）。
- **新对话看不到徽标 → 无法激活任务**：blank 会话的 session header 被 harness 隐藏
  （`children: !hideChrome && ...`），只注册 utilities 座位时新对话（首条消息前）徽标
  完全不可达——必须补 `conversation.input.dock` hero 座位（见约定 1）。blank 会话在
  host 端真实存在（`connectWorkspace` 经 `session.create` 创建，cwd=workspace 路径），
  task-state/board/bind API 在首条消息前即可正常解析。
- **HeroTaskChip 谓词曾引用不存在的 `composerPhase`**：`conversation.input.dock` 的 owner
  props（`InputZone`）只暴露 `session: SessionSnapshot`，不含 `composerPhase`。曾用
  `session.composerPhase === 'blank'` 导致 `headerHidden` 恒为 `false`、chip 从不渲染；
  正确谓词为 `session.blank === true`（空白会话下与 `hideChrome` 等价）。

## Mini 任务看板约定（feat-08-17-trellis-kanban 沉淀）

7. **会话级活动任务解析**（`activeTaskForSession`）：本会话指针文件
   `<sessionFileBasename(sessionId)>.json` 存在时以其 `current_task` 为准（含显式
   `null` = 已解绑，**不回退** canonical）；文件不存在（legacy 会话）才回退
   `activeTaskPointer` 项目级选择。`resolveProjectState` 带 sessionId 解析——
   面包屑/trellis_state/chip 摘要三处一致，并行会话各绑各的任务互不覆盖。
8. **看板 API**：`POST /trellis-workflow/api/board`（读取，trust-fence + 会话存活 +
   header.cwd → allowlist；浏览器触发时允许直接 fs 读取，因其由用户显式打开、低频）；
   `POST /trellis-workflow/api/bind`（变更）：请求只带 `{sessionId, taskSlug|null}`；
   **项目 root 永远来自会话 header**，taskSlug 过白名单
   `/^[A-Za-z0-9._-]{1,120}$/` + 对 root 存在性校验；只写本会话指针文件，写后刷新
   chip 缓存（refreshSummary → lruSet）。浏览（board）绝不改状态；变更只有显式按钮。
9. **归档按月份折叠**：slug `MM-DD` 段（`monthKeyFromSlug`）分组；completed 任务只读，
   禁止激活；月份数字倒序、默认折叠、无时间戳 slug 归「其他」桶。
10. **Cordis `ctx.inject(services, cb)` 回调收到的是子 Context**：`cb` 内
    `web.fs`/`web.sessions`/`web.get('sandboxPolicy')` 均可直接使用（`web` = 子 ctx，
    非首个服务对象）；依赖该形态写路由，勿假设参数是单个服务。

## 看板双模态与对话联动约定（feat-04-18-kanban-overhaul 沉淀）

11. **阶段泳道单一事实源 = `lib/state.js` TRACKS，随 board 下发**：`buildBoard` 在 payload
    中携带 `tracks`（feat 含 `design-review` 共 6 阶段 + `finish` 显示终端；issue/refactor
    同理）；客户端**禁止维护第三份轨道常量**（曾删除 `CHIP_TRACKS`），泳道/阶段流一律从
    `board.tracks` 读取。`phase === 'completed'`（含 `archived: true`）一律归 Archive 泳道。
12. **看板 steps 聚合字段（lossless-JSON，可选字段 null 非 undefined）**：
    `totalSteps/completedSteps/hasBlocked/blockedReason（取数组顺序第一个 blocked 步骤，
    无则 null）/hasPendingVerification/activeStep`。`activeStep` 必须由宿主端 `findActiveStep`
    计算下发（blocked > in_progress > verifying > pending 优先级），客户端**只负责插入**，
    不得自行拼装推进 Prompt——否则丢失验证门禁（verification: human 人卡点）与 attention 优先级。
    畸形 steps（非对象元素）在 readTask 先过滤再聚合。
13. **克制交互（No Direct State Mutation）**：看板 UI 不提供任何修改任务状态的交互（不拖拽、
    不直接推进 stage）；唯一"推进"方式是「💬 推进任务」把指令**注入 Composer 输入框**，由
    Agent 遵循契约执行。产物预览不内置 Markdown 渲染器——点击产物生成 `@.trellis/tasks/...`
    原生文件 Token（**归档任务必须走 `@.trellis/tasks/archive/<month>/<slug>/<name>` 分支**，
    否则生成死引用），交 DSH 原生文件系统承载。
14. **Composer 注入手法（React 受控输入）**：直接赋 `.value` 不更新 React 受控状态——必须
    `Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text)` + 派发 `input`/`change`
    事件；contenteditable 用 `execCommand('insertText')`；全部失败降级剪贴板复制 + 提示。
    定位优先级：`textarea[data-testid]` → `textarea[placeholder]` → contenteditable。
15. **新增 UI 入口必须对异步数据做空值守卫**（P1 踩坑）：展开大看板时 board 可能尚未加载
    （fetch 进行中/失败），`board.tasks` 对 null 取值直接抛 TypeError 使渲染中断——组件在
    取值前检查 `!board` 并渲染加载占位；「展开」动作**恒触发 `loadBoard()`**（而非
    `if (!board)`），避免展示陈旧快照（设计契约：展开即重拉）。
16. **看板记录 `phase` 由宿主端 `phaseForTask` 解析并透传 inline**：`buildBoard(..., inline)`
    将 inline 传至 `readTask → phaseForTask(parsed, inline)`，看板与徽标 phase 一致
    （planning-inline / in_progress-inline）。

## 看板 UI 重设计与工匠系统规范（feat-09-07-kanban-ui-redesign 沉淀）

17. **统一设计系统常量对象 `TB`**：
    所有样式通过 `TB`（Tokens Bundle）引用，全面映射 `--dsw-alias-*` 并带稳健 fallback。
    圆角（`TB.R`）、阴影（`TB.S`）、字体栈（`TB.font`）分级严谨；禁止在子组件中硬编码裸色与散乱字号。
18. **紧凑浮层采用单列全宽列表（效果图 A）**：
    浮层空间有限，不再塞入右侧详情抽屉；采用单列高可读性任务流，活动项左侧设 `3.5px` 垂直粗蓝
    Accent Bar，行末为「会话激活态 / 激活动作」右槽，保障任务标题完全可读、杜绝单字省略号截断。
    > **更正记录（feat-10-20-compact-kanban-activate）**：本条原写作「Accent Bar **与蓝色弥散光晕**，
    > 行末显示**实心聚焦蓝灯**」，与实现不符且与新增能力冲突：
    > ① **无光晕**：行样式一直是 `boxShadow:'none'`（`KanbanTaskItem`），从未实现弥散光晕；
    > ② **行末聚焦蓝灯已取消**：右槽从「状态灯」改为**每行恒有一个动作按钮**——已激活行给 `■`（取消激活，`t('deactivate')`），其余行给 `▶`（激活，`t('activate')`）；若保留蓝灯，点行选中后蓝灯会占掉激活按钮，使按钮在最需要时不可用（design-review D4/T1 记录）；
    > ③ **选中态改由** `3.5px` Accent Bar + 选中底色（`TB.color.selectBgPop`）+ 标题加粗（`600`）+ 选中描边（`TB.color.brand`）表达，信息量不减；
    > ④ **不保留静态状态点**：v5 起「已激活」由 `■` 形状 + 顶部 Chip 标题共同表达（用户验收反馈：只有激活没有取消激活），页面至多一个 `■`（`board.currentTask` 唯一）。
19. **工作台大看板泳道与列表双模态（效果图 B/C）**：
    顶栏通过 Linear 风格分段控件在「工作台（3 泳道）」与「列表（单列高密度数据网格）」间无缝切换。
    泳道按状态分为「规划中 / 进行中 / 已完成·归档」，列内卡片按生命周期混排；已完成卡片统一呈现
    100% 满格鲜绿进度与绿色对勾图标。
20. **详情抽屉纯黑实心主 CTA（Vercel 风格）**：
    右侧详情面板使用纯黑背景（`TB.color.ink`）配全宽圆角矩形作为主操作按钮，与阶段流水线 5 节点
    Stepper 及双色步骤进度条建立统一的视觉层级。
    > **更正记录（feat-10-21-kanban-chip-polish）**：18/19/20 三条的视觉处方已被 v2 取代，仅保留
    > 其中仍然成立的结构约定（单列浮层无右侧抽屉、详情抽屉承载主操作、阶段用分段表示）：
    > ① **Accent Bar / 选中描边 / 选中底色全部取消**：选中态改为**一层很淡的前景混色底**
    > （列表行 `TB.color.hover`，大看板表格行 `TB.color.brandTint`），不用描边、竖条、圆点或浮起阴影；
    > ② **泳道与列表双模态已删除**：大看板改为一层分组表格（进行中 / 规划中 / 已完成）+ 右侧详情，
    > 阶段信息以分段条呈现（`board.tracks` 仍是唯一事实源，见第 11 条）；
    > ③ **`TB.color.ink` 已删除**：纯黑 CTA 在暗色主题下消失，主按钮改为固定深蓝 `TB.color.brandSolid`
    >    + 白字（与阶段节点同一显式配对，见第 23 条），不再依赖主题 token 反转。

## 目录选择服务调用约定（feat-09-11-allowlist-folder-picker 沉淀）

21. **设置面板需要「选择目录」时，优先用官方目录服务，不自绘浏览器**：
    - 调用链：客户端注入 `uiWorkspace` 服务（本插件 `lib/client.js` 的 `inject` 数组含
      `'uiWorkspace'`，与 `dsh-client-ui-directory-picker-native` 同款——后者为
      `inject = ["slots", "uiWorkspace"]` 并经 `ctx.uiWorkspace.pickDirectory()` 调用），
      在组件点击时经
      `clientCtx.uiWorkspace.pickDirectory(): Promise<string | null>` 唤起 Host 原生目录选择
      对话框（Windows 上即资源管理器风格窗口）；`null` 表示用户取消（静默返回，无副作用）。
      > **更正记录（issue-09-18-folder-picker-uiworkspace-mismatch）**：本条原写作
      > `workspaces` / `clientCtx.workspaces.pickDirectory()`，属**服务名笔误**。
      > `pickDirectory()` 实际由 `@deepseek-ai/dsh-client-ui-workspace` 注册的服务
      > `uiWorkspace`（`super(ctx, "uiWorkspace")`）提供；而 `workspaces` 是
      > `@deepseek-ai/dsh-api-workspace-controller` 注册的**另一个**服务
      > （`super(ctx, "workspaces")`，成员为 `create/rename/delete/insertBefore/archiveSession`），
      > **不含** `pickDirectory`。照旧文实现会因能力守卫 `typeof pickDirectory !== 'function'`
      > 恒为真而**稳定失败**（原生对话框从不被调用）。
    - **loopback 网关**：`host.pickDirectory` 在 `dsh-client-connection` 的
      `PRIVILEGED_METHODS` 中（与 settings/credentials 同级），仅 loopback 同源放行；
      本产品 Web GUI 即 127.0.0.1 天然满足；非 loopback（trustedHosts）部署会失败 →
      必须做能力守卫（`!uiWorkspace || typeof uiWorkspace.pickDirectory !== 'function'`）与 catch 分支，
      显示可读错误并保留手输通路，绝不静默吞错或崩面板。
    - **路径归一化**：原生对话框返回 OS 分隔符（Windows 反斜杠）；Host 端
      `lib/resolve.js normalizePath` 匹配前统一 `\`→`/` + 盘符大写，所以存储侧做一次
      轻量 `replace(/\\/g, '/')` 保持 UI 展示一致即可，无需引入 Node path API（client
      bundle 为 `window.__ModuleLoader__` 单文件，不能 require Node 模块）。
    - **降级边界**：应用内 Miller 浏览（`listDirectory`/`createDirectory`）由官方
      `dsh-client-ui-directory-picker-browse` 包负责（注册于
      `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow` slot），
      设置面板等低频页面不重复自绘，原生对话框不可用时用错误提示 + 手输兜底即可。

## 看板主题与对比度（issue-10-08-kanban-dark-contrast / GitHub #2）

22. **先核对宿主实际定义，再使用主题 token**：DSH 的基础表面是
    `--dsw-alias-bg-base`，不存在 `--dsw-alias-bg-layer-0`。不存在的变量即使写了
    白色 fallback，也不能与会随暗色主题变浅的文字 token 安全搭配。
23. **文字与背景成对设计**：主表面、选中行、徽章、阶段圆圈都需随宿主主题调整；
    不可只修主背景而保留固定浅色选中底。强调填充色不等于可读的小字号文字色，
    文字可向宿主 label-primary 混色；固定深色 CTA 与白字、固定深蓝阶段节点与白字
    可以作为明确的配对保留。使用 CSS 变量跟随宿主即时切换，不另建 OS 主题监听器。
24. **回归覆盖必须包含明暗主题和真实渲染数据**：`test/client-theme.test.js` 从当前
    bundle 获取组件树，使用有来源的真实主题子集，检查三种看板视图、三类选中任务、
    阶段数字、类型/状态徽章与步骤标题在 light/dark/无宿主 token 下至少 4.5:1。
    轻量测试中的 CSS 解析不是浏览器；变更主题表达式后，另用浏览器计算样式验证，
    尤其是 `color-mix()` 和同一 DOM 的 light→dark→light 切换。离线页面验证不等于
    已在用户现有 GUI 安装并验收；须明确区分。
    > **更正记录（feat-10-21）**：视图数量随第 19 条更正而变为 popover + 大看板两个；
    > 断言文本的**匹配式**需随展示文案同步（类型徽章已改为无彩文字，见下节）。

## 看板视觉语言 v2：单强调色 + 步骤可见（feat-10-21-kanban-chip-polish 沉淀）

25. **一个强调色原则**：品牌色只表示「当前会话 / 进行中 / 已完成步骤」；**类型不做彩色徽章**
    （功能 / 缺陷 / 重构 用无彩文字），红只表示阻塞、琥珀只表示待验证。旧实现里类型徽章
    与阶段状态点撞色（功能=蓝、缺陷=橙），是「看着廉价」的主要来源，禁止回退。
    > **更正记录（feat-10-22-board-type-done-fold）**：本条原要求类型「用无彩文字」，但实测
    > 大看板里类型列与相邻阶段列同为 12px 灰字，用户反馈「任务类型区分不明显」。现行口径：
    > **仍禁止彩色**，但允许**中性描边徽标（`TB.color.borderStrong` 描边 + `TB.color.textSecondary`
    > 文字）+ 每类一个单色图标**（feat=`sparkles` / issue=`bug` / refactor=`refresh`，见
    > `TYPE_ICON` / `TypeBadge`）提高辨识度；不得新增色相。`workType` 缺失时回退纯文字，
    > 不渲染空胶囊。英文 locale 下类型列需 ≥88px，否则 `Refactor` 被 ellipsis 截断。
26. **状态点只表达阶段，激活另有信号**：点色 = 阶段（灰环规划 / 蓝进行中 / 绿完成 / 红阻塞 /
    琥珀待验证）；「绑定到本会话」用**呼吸光晕 `.tw-live` + 「当前」标签**表达，不复用点色，
    二者正交可叠加。
27. **选中态 = 一层淡底，不叠装饰**：列表行用 `TB.color.hover`、大看板表格行用
    `TB.color.brandTint`（品牌色 9%）。禁止再叠加描边 / 竖条 / 角点 / 抬升阴影。
28. **行内动作按需显现，且一行只有一个**：`▶`（绑定）默认 `opacity:0`，在 hover / 选中 /
    focus-visible 时显现（由 `.tw-row:hover .tw-go` 控制，不在内联样式里写死）；
    **解绑**动作随「当前任务」移入当前任务卡，行内不再出现第二动作，避免把解绑按钮放在
    非激活行上造成语义混乱。
29. **当前任务置顶为卡片，其余分组列表**：浮层顶部固定一张当前会话任务卡（阶段 · 类型、
    标题、进度、**步骤清单**、主 CTA=推进任务 / 次 CTA=解除绑定），下方按「进行中 / 规划中」
    分组列出可切换任务；已归档只在页脚计数并作为大看板入口。浮层的用途是「我在做什么、
    要不要切」，不是全量浏览。
30. **步骤清单必须可见（v2 用户明确要求）**：`StepList` 渲染宿主下发的 `task.steps`，
    当前步骤 = 第一个非 completed；当前步骤加粗并内联**验收标准**（阻塞时改为阻塞原因），
    `verification === 'human'` 显示「人工」标签；浮层内默认 **compact**（已完成的折叠成一行
    「已完成 N 个步骤」，保留最后一个已完成步骤做上下文）并可展开全部，大看板详情**不折叠**。
    > 展示用索引与推进语义必须分开：清单高亮用 `currentStepIndex(steps)`，而「推进任务」
    > 的 prompt 仍只能用宿主算好的 `task.activeStep`（见第 12 条），客户端不得自行推导
    > 验证门禁与 attention 优先级。
31. **`ensureStyles()` 的边界**：交互态（hover / focus-visible / 入场动画 / 呼吸光晕 /
    reduced-motion）统一放在注入的 `.tw-*` 样式表里，颜色与结构仍写内联样式（对比度测试读的
    就是内联 `style.background`）；因为内联 `background:transparent` 会盖掉 CSS 的 hover 底色，
    hover 规则必须用 `!important`，并且**不要**把会被伪类改写的属性写死在内联样式里
    （例如 `▶` 的可见性交给 CSS，内联只给 `busy` 的 `opacity:0.5`）。

## 展开看板的宿主布局隔离（issue-10-22-claude-board-expand）

32. **全窗口 modal 不能依赖 slot 祖先的定位上下文**：Claude 主题会给 header actions 设置
    `transform: translateY(-50%)`，使内部 `position: fixed` 元素相对该容器而非 viewport 定位。
    `z-index` 再大也不能脱离 containing block 或祖先裁切。仅 expanded modal 经
    `renderExpandedModal` / `react-dom.createPortal` 挂到 `document.body`；popover 仍留在
    TaskChip root 内做锚定和 outside-click 判断。禁止用手工移动 React DOM 节点代替 portal。
33. **使用宿主 React 实例与能力守卫**：当前 Web shell 的 `staticModules` 已提供 `react-dom`
    平台 seed，无需插件 inject 或额外安装。最小 carrier 可能缺少它，同步 require 失败可捕获；
    portal 或 `document.body` 缺失时只保留旧的 inline 渲染（防崩溃降级，**不保证修复该 carrier
    的祖先定位问题**）。主题颜色仍通过 body 继承的全局 token 读取，不复制主题状态。
34. **颜色单测不能代替布局回归**：`test/client-portal.test.js` 覆盖 portal/fallback 和两座位
    的真实调用点；`scripts/verify-modal-browser.mjs` 是 opt-in Chromium 检查，需设置
    `DSH_BROWSER_TEST_TOOLS`（包含 playwright/esbuild/react/react-dom 的 package.json）和可选
    `DSH_BROWSER_EXECUTABLE`。断言 overlay 的 viewport 几何、modal 居中、点击命中、关闭交互、
    transform/overflow/contain 隔离。离线 fixture 通过不等于用户现有 GUI 已加载新版本或人工验收。

35. **大看板「已完成」分组默认折叠（feat-10-22-board-type-done-fold）**：大看板三层分组里
    「已完成 · 归档」默认折叠（只留 `aria-expanded=false` 的标题按钮 + 数量 + chevron），
    点击展开/收起；折叠状态**仅内存**（`doneOpen`），不持久化。搜索框有内容时**强制展开**
    （`doneExpanded = doneOpen || q !== ''`），且此时按钮点击必须早退、不得静默翻转内存态，
    否则清空搜索后会出现「莫名展开」。进行中 / 规划中分组保持非交互标题。折叠开关的
    `<button>` 内只能含 phrasing content（标题用 `SectionLabel` 的 `as: 'span'`），展开内容
    包一层带 `id` 的 `role="group"` 容器并由按钮 `aria-controls` 指向。
    > **测试有效性告警**：`useState` 桩若写成「丢初始值、只回测试传入值」，则「默认折叠」
    > 断言的是测试自己的入参而不是组件默认值（改 `useState(true)` 仍全绿 = 假绿灯）。桩必须
    > `init` 优先、仅在用例显式覆盖时替换；并必须补「再收起」方向断言，否则
    > `setDoneOpen(true)`（收不回来）同样测不出来。

## 插件设置的双座位与外层渲染（feat-10-24-bundle-settings-ui）

36. **插件的配置卡片要占两个座位，key 形态不同且写错是静默失败**：
    - `plugins.bundle.config`：key = **裸包名**（`readFileSync('package.json').name`，本项目
      `<scope>/<pkg>`）。宿主派发为 `renderSlot('plugins.bundle.config', { view: 'page' },
      { entryKey: pkg.name })`，并用 `ledger.bundles.has(pkg.name)` 判「是否已配置」——
      **key 带 `#<row id>` 就永不命中，整段配置区静默不渲染**（无报错、无日志）。
    - `plugins.row.config`：key = `<包名>#<patch 行 id>`（本项目 `#trellis-workflow`），由插件
      列表页对那一行派发；行详情页与 bundle 页是**互斥视图**，两处都拿 `view: 'page'`，
      因此不需要「靠 `view === 'summary'` 防重复渲染」这类防线。
    - 两个座位**必须共用同一个 controller / 同一个 store**（`inject: () => controller.inject()`
      各调一次，但返回同一 `hooks.<name>` 引用），否则两个入口的草稿与写通道会分叉。
    - 包名只能有一处字面量（`const PKG = ...`，两个 key 从它派生）：两份字面量漂移同样是
      静默失效。
37. **座位注册一律走 `ctx.slots.inject(name, cb)`**（回归第 1 条）：宿主未声明该座位时
    `inject` 静默不回调、其余座位照常注册；裸 `slots.register` 会抛
    「registering into an undeclared slot」。
38. **座位/卡片的行为测试要跑真 `apply()`，不要 grep 调用形状**：`test/client.test.js` 的
    `loadBundle()` 用 `vm.runInNewContext` 执行真实 bundle，stub 出与 shell 同语义的
    `ctx.slots`（`register` 对未声明座位 **throw**、`inject` 只对已声明座位回调）、
    `locale`、`configForms`（`describe()` 返回空 namespaces 让 controller 停在 unavailable，
    `get()` 一旦被调就 `assert.fail`）、`effect`；再断言两座位的 `options.key` 精确值、
    `component` 同一引用、两次 `inject().hooks.*` 同一引用、同座位 `registrations.length === 1`。
    字符串切片/计数类断言（如「`indexOf` 自己 < `indexOf(register)`」）恒真，属假绿灯，
    实测会漏掉「裸 register / 第二 controller / 座位名写错」三类退化。
    渲染完整性用 **id 集合精确断言**，不用 `children.length >= N`：卡片实际 child 数多于字段数
    （字段外面还有容器节点），少渲染一个字段仍能通过 `>= N`。

