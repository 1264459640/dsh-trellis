# trellis-workflow / web-ui — 质量检查与约定

> 本文件由 `feat` 任务 `trellis-right-phase-panel`（会话头部阶段徽标）沉淀。
> 证据：任务规划产物（prd/design/design-review/implement/review）与本包 `lib/` 源码。

## Web UI 扩展约定

1. **嵌入 UI 优先选 session 作用域加法座位**，而非 root 作用域浮层：
   - 会话头部右侧状态/徽标 → `conversation.session.header.utilities`（list / session scope /
     additive，fresh id；组件经框架标准 prop `sessionId` 拿当前会话 id，**无需订阅
     `sessions.list`**；会话切换由框架按 key=sessionId 重挂载自动重取）。
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
