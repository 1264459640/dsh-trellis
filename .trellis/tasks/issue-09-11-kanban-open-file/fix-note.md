# Issue Fix Note

## 改动摘要

`lib/client.js`（唯一改动文件）：

1. **`inject` 服务声明**（L47）：追加 `'sidebarRight'` —— 与官方 chat 客户端一致，使插件客户端可访问 DSH 右侧栏文档预览控制器（`ctx.sidebarRight.openResource`）。
2. **新增模块级 `clientCtx`**（L36）：`apply(ctx)` 时捕获客户端根上下文（L2969），供 slot 组件在点击时访问宿主服务。
3. **新增 `artifactResourceUrl(sessionId, token)`**（L967-976）：把产物 token（`@.trellis/tasks/<slug>/<name>` 或归档分支）映射为 DSH 原生文件地址 `dsh-resource://file/session/<sessionId>/<path>`（分段 encode，保留 `:`；镜像官方 `fileAddressFor`/`sessionFileAddress` 契约）。
4. **新增 `openArtifactFile(ctx, sessionId, token)`**（L990-1017）：调用 `ctx.sidebarRight.openResource(...)` 在右侧文档预览原生打开；`sidebarRight` 不可用或打开失败时降级为**复制 token 到剪贴板**（绝不回填输入框）。
5. **`KanbanDetails`**（L1020、L1413-1423）：产物「打开」按钮由 `push(artifactToken(...))`（→ `injectToComposer` 回填输入框）改为 `onOpenArtifact(token)`（→ 原生打开）；失败时显示 `openFailed` 提示文案，成功不弹 toast（右侧栏已可见）。
6. **`KanbanExpandedModal` / `TaskChip`**（L1911、L2513、L2911）：透传 `sessionId` 与 `onOpenArtifact` 回调。
7. **新增 zh/en 文案 `openFailed`**：`打开失败，文件引用已复制到剪贴板` / `Failed to open — file reference copied to clipboard`。

「推进任务」按钮（L1247 `push(pushPromptFor(...))`）保持不变 —— 按 spec 约定 13/14，这是唯一应注入输入框的入口。

## 根因对应

- 根因（analysis.md）：产物「打开」误用了为「推进任务」设计的 Composer 注入通道（`injectToComposer`），把 `@.trellis/tasks/...` 引用回填进输入框并聚焦，而非交给 DSH 原生查看。
- 修复：改用 DSH 官方文件打开机制 `ctx.sidebarRight.openResource(dsh-resource://file/session/...)`（chat 客户端 `openFile` 同款实现），输入框不再被触碰；兜底剪贴板复制而非输入框回填。

## 验证

- `node --check lib/client.js` 通过（语法校验）。
- `node -e` 验证 `artifactResourceUrl` 输出与官方 `sessionFileAddress` 格式一致（活动任务/归档/含空格路径均正确分段编码，`:` 保留）。
- `import('./lib/board.js')` 加载通过，构建看板逻辑无回归。
- 单元测试 `node --test` 在当前沙箱下因 `spawn EPERM` 无法运行（环境限制，非代码问题）；本次改动仅涉及客户端 DOM/宿主服务交互，不触碰 host 端逻辑与现有测试覆盖面。
- **待人工验证（需重启 DSH 加载新 bundle）**：点击产物「打开」→ 右侧文档预览打开对应文件；输入框内容不变、不聚焦；归档任务路径正确；失败场景提示「已复制到剪贴板」。

## 后续债务

- 若 DSH 后续版本变更 `sidebarRight` 服务契约（如 `openResource` 签名），需同步此调用点；当前已用 try/catch + 剪贴板降级兜底，不会抛错影响看板。
- 产物打开成功未做 toast/视觉反馈（依赖右侧栏可见性）；如需更强反馈可后续加轻提示。
