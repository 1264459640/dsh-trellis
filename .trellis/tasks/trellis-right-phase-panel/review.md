# Feature Code Review

status: passed   # missing | passed | blocking

> **本文件为修复后重审版**：第一轮审查结论 blocking（B1 阻塞 + M1/M2 次要 + 5 项观察），
> 主会话已修复 B1/M1/M2，本版复跑全部验证后判定 **passed**。原发现与修复状态留档见「发现」表。

## Diff 范围

本任务实现的全部改动（只读审查，未修改任何代码）：

- `lib/state.js` — 新增 `activeTaskPointer`（dsh-session.json 优先 + 文件名字典序）、`TRACKS`（feat/issue/refactor 阶段表 + 回退位置）、`fallbackStage`、`stageOnTrack`、`taskSummaryOf`（path-free 摘要，可选字段输出 `null` 而非 `undefined`）。
- `lib/meta.js` — 新增 `API_PREFIX = '/trellis-workflow/api'`。
- `lib/trust.js` — 新文件：本地同源/防 DNS-rebinding 围栏 `isTrustedApiRequest(headers, trustedHosts = [])`（loopback 判定含 `localhost`/`127.0.0.1`/`::1`/`[::1]`/`0.0.0.0`/`127.0.0.0/8`）。
- `lib/index.js` — `resolveProjectState` 改为确定性选择并返回 `task`；新增 `readJsonBody` / `respondJson` / `lruSet`；新增 `ctx.inject(['webServer','sessions'])` 子 fiber：`refreshSummary`、只读路由 `POST /trellis-workflow/api/task-state`（**trust fence 在前、method 检查在后**，与 design.md:39 一致）、`trellis_ui_update` 空参工具、`session/disposed` 缓存清理。
- `lib/client.js` — 新增 zh/en 徽标文案（chipTitle/chipNoTask/chipNoSummary/chipFailed/chipRefresh/phase*/workType*）、`TaskChip` 组件（含 `CHIP_TRACKS` 与浮层）、`conversation.session.header.utilities` 注册（`ctx.slots.inject` 包裹，fresh id `trellis-workflow:task-chip`，order 100）。
- 文档（implement.md D.10）：`README.md` 已新增 Web 徽标功能段与 `trust.js` 目录项；`design.md` status=approved；`task.json` status=in_progress/stage=impl。

审查依据：`prd.md`（验收标准）、`design.md`（approved）、`design-review.md`（第四轮 passed，F1-F3 必做项）、`implement.md`。

## 发现

| 级别 | 问题 | 文件 | 状态与处理 |
|------|------|------|------|
| 阻塞 | B1：`trellis_ui_update` 对含 `undefined` 可选字段的任务摘要抛 `ToolOutputError("value is not lossless JSON")`——`taskSummaryOf` 对缺失的 `title`/`stage`/`workType` 输出 `undefined`，而 dsh-tools 的 `snapshotJsonValue` 拒绝任何 own enumerable 值为 undefined 的对象；工具声明的 `output.schema` 是 `oneOf:[string,null]`，null 才是与 schema 一致的缺失表示。触发面：task.json 缺 title/空 title（work-types.md 文档形状不要求 title）、work.type 未知/缺失（legacy task）。 | `lib/state.js:282/284/286`（原）；`lib/index.js:400-408` | **已修复（重审通过）**：`taskSummaryOf` 现输出 `title: ... ? title : null`、`stage: stage \|\| null`、`workType: workType \|\| null`（state.js:285/287/289），task 态 `status` 恒为 string（state.js:278 前置保证），no-match/no-task 分支本无 undefined；JSDoc 同步更新（state.js:264-273）。实测 no-match / task-full / task-no-title / task-empty-title / task-legacy-no-work / no-task 六例均无 undefined 值，`snapshotJsonValue` 全部通过；客户端处理链对 `null` 安全（`chipTypeLabel`/`buildPopover`/`summary.title` 均按 falsy 处理），route 侧 `JSON.stringify(null)` 保留键亦无害。 |
| 次要 | M1：`isLoopbackHostname` 的 `'::1'` 分支永不命中——Node `URL.hostname` 对 IPv6 返回带方括号的 `"[::1]"`（实测 `new URL('http://[::1]:59749').hostname === '[::1]'`），`hostname === '::1'` 恒为 false，IPv6 回环请求被拒（403）。 | `lib/trust.js:16`（原） | **已修复（重审通过）**：新增 `hostname === '[::1]'` 分支（trust.js:18），与 `'::1'` 分支并存以兼容不同解析实现。实测 `host:'[::1]:59749'` + 同源 origin → true；裸 `'::1:59749'`（非标准 Host 头，浏览器不会发送）→ false（正确拒绝）。实际影响原本为零（webserver 仅绑 IPv4），现死分支消除。 |
| 次要 | M2：路由校验顺序与 design.md:39 字面不一致——design 要求"先过本地 trust fence；非 POST → 405"，实现为先判 method→405 再 trust fence→403。安全等价（未受信 GET 得 405 而非 403，不泄露会话/摘要信息），仅顺序偏差。 | `lib/index.js:330-336`（原） | **已修复（重审通过）**：校验顺序改为 trust fence 在前（403，index.js:331-334）、method 检查在后（405，index.js:335-338），与 design.md:39 字面一致；trust fence 先行使未受信请求不会进入 pathname/body 处理，攻击面更小。 |
| 观察 | O1：当前部署 allowlist（`C:\Users\12644\.dsh\settings.yaml`）只含 `F:\Projects\*`，不含 `F:\dsh-plugins\dsh-trellis` → 本会话徽标按 no-match 隐藏。属配置而非缺陷。 | 部署配置 | 留档：如需在本仓库会话看到徽标，向 allowlist 增加 `F:\dsh-plugins\dsh-trellis`。 |
| 观察 | O2：`trellis_ui_update` 始终以 `inline=false` 调 `refreshSummary`（index.js:406）。当前行为恰好保证 `chipPhaseColor` 颜色映射正确（inline phase 会落 warn 色），影响为零。 | `lib/index.js:406` | 留档：可读 `effectiveConfig.get().inline` 传入（需同步保证 `chipPhaseColor` 对 inline phase 映射正确）；非必须。 |
| 观察 | O3：页面 focus/visibility 回归重取会并发发起多次 `load()`，旧响应可能覆盖新响应；`load` 的 cancel 闭包仅首个 `useEffect` 使用。同 sessionId 同缓存内容几乎一致，竞态影响可忽略；无循环。 | `lib/client.js:384-395` | 留档：可选在 `load` 内做单飞行去重。 |
| 观察 | O4：路由接受任意 `sessionId`（缓存命中 + 会话存活即返回摘要），未限定为调用方自身会话。与 design 契约一致，trust fence + 同源下无跨站泄露，摘要不含路径等敏感信息。 | `lib/index.js:355-363` | 留档：无需处理。 |
| 观察 | O5：`isTrustedApiRequest(req.headers)` 未传 `trustedHosts`，非回环部署（绑定 0.0.0.0、经局域网 IP 访问）时 chip 请求会被 403 拒绝。design 未要求配置 trustedHosts，当前部署为回环（127.0.0.1:59749）。 | `lib/trust.js:31-59`；`lib/index.js:331` | 留档：未来若需非回环访问，可从 config 增加 trustedHosts 并传入。 |

## 验证证据

命令均在 `F:\dsh-plugins\dsh-trellis` 下运行。**以下为修复后重审复跑结果**（第一轮证据见本文件上一版本，B1/M1/M2 均已按修复后状态复验）。

1. **静态检查**：`node --check lib\*.js` → 9 个文件（breadcrumb/client/index/meta/resolve/settings/skills/state/trust）全部通过，0 失败。
2. **import 冒烟**：`node --input-type=module -e "const m = await import('./lib/index.js'); console.log(m.default.name)"` → `trellis-workflow`。
3. **纯函数单测 + B1 快照模拟（自写断言脚本，43/43 通过）**：
   - activeTaskPointer：dsh-session.json 优先 / 空列表→null / 字典序首胜 / 非数组→null —— 通过。
   - fallbackStage / stageOnTrack / TRACKS：feat planning→prd、issue in_progress→fix、refactor completed→done、未知→undefined、feat completed→finish、feat finish on-track；三表与 work-types.md 对齐 —— 通过。
   - **B1 修复验证**：递归检查 `taskSummaryOf` 六例（no-match / task-full / task-no-title / task-empty-title / task-legacy-no-work / no-task）**均无 own enumerable 值为 undefined**；`taskSummaryOf` 缺 title → `title === null`、legacy 无 work → `workType === null && stage === null`、空 title → `title === null` —— 通过。
   - **B1 工具输出快照模拟**：`snapshotJsonValue(taskSummaryOf(...))` 对正常任务 / 缺 title / 空 title / 无 work.type / no-match / no-task **全部返回非 undefined**（修复前缺 title/空 title/无 work.type 三例失败）—— 通过。
   - **M1 修复验证**：`isTrustedApiRequest({host:'[::1]:59749', origin:'http://[::1]:59749'})` → true（修复前 false）；`host:'[::1]:59749'` 无 origin → true；裸 `'::1:59749'` → false（正确拒绝非标准 Host 头）—— 通过。
   - isTrustedApiRequest 其余用例：loopback+同源→true、loopback 无 origin→true、cross-site→false、异源 origin→false、异源 host→false、无 host→false、坏 host→false、trustedHosts 命中→true、localhost→true、127.0.0.0/8→true —— 通过。
4. **client 工厂冒烟**（vm + mock react/ModuleLoader 执行 `lib/client.js`）：factory 正常执行，`exports = { apply, inject: ["slots","locale","settingsScope"] }`——未新增 `'sessions'`（F2 要求满足）。
5. **契约核对（node_modules 实证，与第一轮一致，修复未触及）**：
   - `dsh-client-ui-slots` index.d.ts:64-65/425-428：注册项声明 `locale:` 时框架注入 `t` prop；:190：session 作用域槽位并入 `SessionStandardProps`（含 `sessionId`）。
   - `dsh-client-runtime` slots.d.ts:90：`ctx.slots.inject` 存在；`conversation.session.header.utilities` 声明（ui-conversation slots.d.ts:66-68：list/session scope）与渲染点（ui-conversation client.js:6992）实证；F1（slots.inject 包裹）已落实。
   - `cordis` registry.d.ts:111：`ctx.inject` = `ctx.plugin({inject, apply})` 简写，回调按 fiber 管理（服务变化先卸后重跑）→ `web.effect`/`web.on` 生命周期正确。
   - `dsh-host-webserver` index.d.ts:19-28/72：`register({kind:'prefix', path, handler})` 返回 disposer。
   - `dsh-session` index.d.ts:393 `get(id)`、types.d.ts:40-52 `SessionHeader.cwd?`、index.d.ts:54 `'session/disposed'(this: Scoped<Session>, session)`；emit 载荷为 session 对象（index.js:1761-1772）；`dsh-scope` scopeTarget 语义（未打 tag 的监听器全局放行）→ 清理对所有会话生效。
   - `dsh-agent` runtime-types.d.ts:66：`Agent.session: Session` → `exec.agent.session.id` / `header.cwd` 合法（F3 满足：缓存键 = 执行工具代理的会话 id）。
   - `dsh-tools`：`createSuccessResult → snapshotToolValue`（lib/index.js:2458-2461）→ `snapshotJsonValue`（@deepseek-ai/dsh-session json.js:109-110）——B1 根因路径，修复后经快照模拟验证放行。
6. **allowlist 核查**：`C:\Users\12644\.dsh\settings.yaml` 的 `trellis-workflow.allowlist` = `F:\Projects\FordProject`、`F:\Projects\PolarBuildingDigitalTwinSystem`、`F:\Projects\PlateauHealthManagementSystem\PlateauHealthManagementSystem`；不含 `F:\dsh-plugins\dsh-trellis`（O1）。
7. **prd 验收逐条核对（修复后）**：① 嵌入徽标/一行高度/additive list 槽/不占 details·sidebar·conversation——成立（静态）；② 紧凑类型+阶段、悬停/点击展开轨道高亮当前 stage——成立；③ 空态映射与 no-match 隐藏——成立；④ 模型调用 `trellis_ui_update` 后徽标刷新——**成立**（B1 修复后工具对正常任务与缺 title/未知 work.type 的边界任务均不再抛错，缓存写入路径一致）；⑤ headless 下既有功能不受影响（ctx.inject 动态注入）——成立（静态）；⑥ zh/en 文案齐全、`node --check` 全过——成立。

## 结论

- [x] 通过（含 `trellis-check` 与任务要求的验证）
- [ ] 需修复后重审

**重审结论：passed。** 阻塞项 B1 已修复（`taskSummaryOf` 可选字段输出 `null`，与 `trellis_ui_update` 声明的 `output.schema`（`oneOf:[string,null]`）一致，六例摘要快照全部通过）；次要项 M1（trust.js 增加 `'[::1]'` 分支，IPv6 回环用例通过）与 M2（路由校验顺序改为 trust fence 在前，与 design.md:39 一致）均已修复；5 项观察（O1 当前会话 allowlist 未命中属配置、O2-O5 低影响记录）留档无需处理。修复未引入新问题：43/43 单测通过、`node --check` 9 文件全过、import 冒烟与 client 工厂冒烟正常。
