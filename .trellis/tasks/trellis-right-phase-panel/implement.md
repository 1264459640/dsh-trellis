# Trellis 会话头部阶段徽标 — 实现计划

## 有序步骤

### A. Host：任务摘要与确定性的活动任务选择（`lib/state.js`）
1. `lib/state.js` 新增 `activeTaskPointer(runtimeFiles)` 选择纯函数：优先精确文件名
   `dsh-session.json`；否则对 runtime 目录条目按 `entry.name` **字典序**取第一个含
   `current_task` 的（`FsInfo` 无 mtime，禁止 mtime 排序；调用方注入文件列表保持纯函数可测）。
2. `lib/state.js` 新增 `taskSummaryOf(taskJson, { matched, phase })`：仅读取可公开字段
   （`title`、`status`、`work.type`、`work.stage`），输出 path-free 摘要
   `{ kind: 'no-match' | 'no-task' | 'task', title?, status?, stage?, phase, workType? }`；
   未知 `work.stage` 按 status 回退（planning→轨道首阶段、in_progress→该 type 的
   in_progress 段首 stage、completed→finish），非轨道 stage 标记“进行中”而非空白。
3. `lib/state.js` 导出 `TRACKS`（feat/issue/refactor 阶段表 + 回退位置）供摘要解析与客户端
   呈现共用同一词表来源（`skills/_templates/work-types.md` 对齐）。

### B. Host：工具 + 同源只读路由 + 缓存（`lib/meta.js`、`lib/trust.js`、`lib/index.js`）
4. `lib/meta.js` 新增 `API_PREFIX = '/trellis-workflow/api'` 与摘要响应约定注释。
5. 新增 `lib/trust.js`：本地 trust-fence（~40 行，同构自 dsh-client-connection
   `isTrustedApiRequest` 语义：loopback/受信 authority + `sec-fetch-site !== 'cross-site'`
   + 同源 `origin`）；不 import 任何第三方实现。
6. `lib/index.js`：新增 host 侧 `Map<sessionId, summary>` 缓存（LRU 上限 128）与
   `refreshSummary(ctx, sessionId, inline)`：用 `ctx.sessions.get(sessionId)?.header.cwd`
   （受信来源，不信任请求/模型输入）匹配 allowlist → 解析活动任务 → 写缓存并返回摘要；
   `ctx.on('session/disposed', ...)` 清理对应缓存。
7. 注册 `POST /trellis-workflow/api/task-state`：`ctx.inject(['webServer','sessions'], cb)`
   动态注入子 fiber（先例 `lib/settings.js:40`），`ctx.webServer.register({ kind: 'prefix',
   path: API_PREFIX, handler })` 的 disposer 交 `ctx.effect`：
   - 先过本地 trust fence；非 POST → 405；body 超限/非 JSON → 400（错误不泄露路径）；
   - body 仅接受 `{ sessionId }`；session 不存活（`sessions.get` 未命中）或缓存缺失 →
     稳定 `{ ok: true, value: { kind: 'no-summary' } }`（与未知 session 同态）；
   - 响应 `{ ok: true, value: summary }` 或稳定错误枚举；绝不回传路径/底层错误详情。
8. 新增模型工具 `trellis_ui_update`：`defineTool({ name: 'trellis_ui_update', parameters: {},
   output: { schema: <摘要 schema> }, execute })`；execute 以 `exec.agent.session.header.cwd`
   匹配 allowlist 调 `refreshSummary`，**缓存键 sessionId = `exec.agent.session.id`**，写缓存
   并返回摘要。注册包进 `ctx.effect`。

### C. Client：会话头部嵌入徽标（`lib/client.js`）
9. `lib/client.js`：保留 settings tab；新增 `TaskChip` 组件并注册（按 settings tab 先例
   `lib/client.js:218-230` 包裹 `ctx.slots.inject`，消除加载顺序依赖）：
   `ctx.slots.inject('conversation.session.header.utilities', () =>
   ctx.slots.register({ name: 'conversation.session.header.utilities',
   id: 'trellis-workflow:task-chip', order: 100 }, TaskChip))`
   （list/session/additive，不替换任何单占位槽；组件经框架标准 prop `sessionId` 取当前会话 id）。
   - 取数：挂载 / 会话切换（框架按 key=sessionId 重挂载）/ 页面 focus-visible 回归时
     `POST /trellis-workflow/api/task-state { sessionId }`（同源，带 fetch 错误处理）；
   - 渲染：一行高度精致徽标（状态圆点按 phase 着色 + 短标签 `feat · design`）；
     悬停/点击展开锚定徽标的小浮层（任务标题、状态标签、`work.type` 阶段轨道高亮当前
     stage、刷新按钮）；空态映射：no-match→隐藏、no-task→浅灰点提示、no-summary→浅色点
     可点击刷新、请求失败→感叹号点可重试；
   - 样式用 DSH token CSS variables 与内联 styles；新增 `zh`/`en` 文案到现有 locale 字典。

### D. 文档与任务状态
10. 更新 `README.md`（如需）；`design.md` status=approved；`task.json` status=in_progress、
    stage=impl（在人卡与 design-review 通过后）。

## 验证
1. 静态验证：`node --check` 全部改动 JS；`import` 冒烟（host ESM 可加载）；client module
   可被 loader 解析。
2. 行为验证：`trellis_ui_update` 在 allowlist 项目会话返回任务摘要；非 allowlist 返回
   no-match；route 在浏览器同源请求返回缓存摘要；跨站/非 POST/非 JSON 请求被围栏与校验
   拦截；未知 sessionId 返回稳定 no-summary。
3. UI 验证：刷新 `http://127.0.0.1:59749`（当前 Web GUI）→ 会话标题行右侧出现 Trellis
   徽标；空态 → 会话中调用工具后刷新显示任务；悬停展开轨道；原生工具详情栏与 sidebar
   不受影响。
4. 阶段映射：用当前 feature task（planning/design）与不同 `work.stage` 值验证轨道分支与
   回退；用临时 `.trellis` fixture 验证确定性选择规则。

## Review / 验证门
- [x] 已按项目质量门验证（`trellis-check`）：独立代码审查（review.md）passed（B1 lossless-JSON null 契约、M1 IPv6 分支、M2 校验顺序已修复并复跑；43/43 单测通过）；`node --check lib\*.js` 9/9 通过；host ESM import 冒烟通过；taskSummaryOf 六例无 undefined 值、`snapshotJsonValue` 全放行；trust-fence 全用例（含 IPv6 `[::1]`）。
- [ ] 运行时 UI 验证待部署后执行：静态 Cordis 插件改动需重启 DSH 生效；重启后按「验证」节核对 http://127.0.0.1:59749 徽标（空态/轨道/刷新/无冲突），并把 `F:\dsh-plugins\dsh-trellis`（或上层）加入 `trellis-workflow.allowlist`（settings.yaml 或 Web 设置）——当前 allowlist 不含本路径，该会话徽标按 no-match 隐藏，属配置而非缺陷。

## 回滚点
- 移除 `trellis_ui_update` 工具注册、`/trellis-workflow/api` 路由、`task-chip` 徽标注册；
  既有 breadcrumb、settings tab、`trellis_state` 保持独立，可单独回退。
