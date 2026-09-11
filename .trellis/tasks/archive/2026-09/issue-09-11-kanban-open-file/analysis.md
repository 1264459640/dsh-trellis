# Analysis

## 根因

`lib/client.js` 的 `KanbanDetails` 产物区「打开」按钮使用了错误的交互通道：

- `artifactToken(task, name)`（L938-943）生成 `@.trellis/tasks/<slug>/<name>`（或归档 `@.trellis/tasks/archive/<month>/<slug>/<name>`）——这是**输入框 @-mention 语法**的 token，设计意图是「在 Composer 里输入 `@` 时被解析为文件引用」。
- 但按钮 `onClick`（L1339）把它交给 `push(...)` → `injectToComposer(text)`（L836-884），即**主动把文本写入输入框**：找 `textarea[data-testid="composer-input"]` 等、写入 value、派发 input/change、`el.focus()`。这等于把「打开文件」错误地实现成了「把引用塞进输入框」。
- 这既污染了用户正在编辑的输入内容，也没有真正打开文件——与 README「原生文件引用交给 DSH 原生查看」的设计约定相悖。

> 注：`injectToComposer` 原本是为「推进任务」（`pushPromptFor`，L898-927）设计的正确通道——把推进指令填入输入框让 Agent 执行。产物「打开」复用了它，属于接口误用。

## DSH 原生打开文件的正确机制（宿主能力调研）

在 DSH Web 宿主（`@deepseek-ai/dsh-web-app` 0.1.5-rc.2）中，「通过 DSH 打开文件链接」的标准实现是右侧**文档预览**（sidebar-right + sidebar-documentpreview）：

- **服务**：`ctx.sidebarRight`（`SidebarRightController`，由 `dsh-client-ui-sidebar-right` 通过 `ctx.reflect.provide('sidebarRight', controller)` 提供）。
- **方法**：`openResource(address, options)` / `openResourceIn(sessionId, address, options)` —— 打开一个 `dsh-resource://<type>/…` 地址为右侧标签页。
- **文件地址格式**（`dsh-client-ui-sidebar-files` 的 `fileAddressFor` / `sessionFileAddress`）：
  - `dsh-resource://file/session/<sessionId>/<path>` —— session 作用域，`<path>` 为**相对工作区**路径（如 `.trellis/tasks/<slug>/<name>`）。
  - 分段 `encodeURIComponent`，保留 `:`（盘符）。
- **官方对照实现**：`dsh-client-ui-chat` 的 `openFile`（L8319-8325）：
  ```js
  const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
  const url = fileAddressFor(sessionId, cwd, path);
  ctx.sidebarRight.openResource(url);
  ```
  打开后右侧文档预览按扩展名渲染（markdown/html/text/image/pdf）。

因此正确修复方向：产物「打开」应构造 `dsh-resource://file/session/<sessionId>/<path>` 并调用 `ctx.sidebarRight.openResource(url)`；`<path>` 直接取 token 去掉前导 `@` 的 `.trellis/tasks/...`（相对工作区路径，无需 cwd）。

## 服务可达性

- trellis 客户端当前 `inject = ['slots', 'locale', 'settingsScope']`（L39）。访问 `ctx.sidebarRight` 需要把它加入 inject（chat 插件正是 `inject` 含 `'sidebarRight'`，L8242）。
- 组件树：`TaskChip`（持有 `sessionId` prop，slot 框架注入）→ `KanbanBoard`/`KanbanExpandedModal` → `KanbanDetails`。需要把 `openArtifact` 能力以 prop 形式逐层传入，或在 `apply(ctx)` 中捕获 `ctx.sidebarRight` 后以模块级回调注入组件。
- 稳妥做法：在 `apply(ctx)` 里一次性获取 `ctx.sidebarRight`（inject 加入后 `ctx.sidebarRight` 直接可用），构造 `openArtifactFile(sessionId, token)` 回调，随 props 传入看板组件树；组件内点击时调用。

## 修复方案

### 改动点（全部在 `lib/client.js`）

1. `inject` 数组追加 `'sidebarRight'`（必要时还有 `'sessions'`）。
2. 新增模块级函数 `artifactResourceUrl(sessionId, token)`：token 去前导 `@` → 分段 encode → 拼 `dsh-resource://file/session/<sessionId>/<path>`。
3. 在 `apply(ctx)` 中（或模块闭包）暴露 `openArtifact = (sessionId, token) => ctx.sidebarRight.openResource(artifactResourceUrl(sessionId, token))`。
4. `TaskChip` 把 `openArtifact` 传入 `KanbanBoard` 与 `KanbanExpandedModal`，二者再传给 `KanbanDetails`。
5. `KanbanDetails` 产物「打开」按钮 `onClick` 由 `() => push(artifactToken(task, name))` 改为 `() => onOpenArtifact(artifactToken(task, name))`（prop 透传）。
6. 兜底：若 `ctx.sidebarRight` 不可用（极端环境），退化为复制 token 到剪贴板（不写输入框），保持「不污染输入框」的预期。
7. 「推进任务」（`pushPromptFor`）通道保持不变——那是唯一应注入输入框的入口。

### 非目标

- 不改看板布局/样式/其他交互。
- 不改 host 端 / 服务端逻辑；纯客户端行为修正。
- 不引入 `open-in-app`（那是打开工作目录到外部应用，与本 issue 的「DSH 原生查看文件」不同）。

## 验证方式

- 手动：点击产物「打开」→ 右侧文档预览打开对应文件；输入框内容不变、不聚焦。
- 手动：归档任务产物路径正确（archive 分支）。
- 回归：迷你看板与展开大看板两路径均验证。
- 若可跑 `node --test` 则不涉及（纯 client DOM 逻辑，无单测覆盖预期）。
