# dsh-trellis 适配审计：DSH 0.1.7-rc.1 → 0.2.0-rc.2

**对象**：`@banana-peeljj12/dsh-trellis`（本仓库）
**目标运行时**：`@deepseek-ai/dsh-*@0.2.0-rc.2` / `@deepseek-ai/dsh-desktop-runtime@0.2.0-rc.2`（DeepSeek Harness 桌面版 44.0.0，Electron）
**原目标运行时**：`@deepseek-ai/dsh-*@0.1.7-rc.1`
**结论**：**代码零改动；本次适配的承重改动是 DSH peer 范围声明。**

---

## 1. 为什么"适配"是必要的：DSH 会拒绝不兼容的 peer 声明

即使插件源码在两个运行时之间完全兼容，只要它声明的 DSH peer 范围不覆盖当前运行时，DSH 就会**主动拒绝**它。

判定与拒绝路径（均可复核）：

| 环节 | 位置 | 行为 |
|---|---|---|
| 判定 | `@deepseek-ai/dsh-app-boot/lib/index.js` 的 `evaluatePluginCompatibility(manifest, exemptions, runtimeVersion)` | 遍历 `peerDependencies`，对每个名字等于 `@deepseek-ai/dsh` 或以 `@deepseek-ai/dsh-` 开头的 peer，执行 `semver.satisfies(runtimeVersion, range, { includePrerelease: true })` |
| 安装拒绝 | `@deepseek-ai/dsh-plugin-manager/lib/index.js`（`preflight` 分支，约 `506-514`） | 在 **pnpm 运行之前**拒绝：`dsh: installation rejected: …`，"nothing was installed" |
| 管理面拒绝 | 同上，`ManagementFailure("incompatible-version", …)`（约 `1491` / `1788` / `1987`） | 向调用方返回 `incompatible-version` + 每个被拒包的 `name` / `version` / `runtimeVersion` / 未满足的 `peers` |
| 启动拒绝 | 同上，启动检查独立执行 | 已在 profile 中的不兼容依赖会被启动期拒绝加载 |

注意：`@deepseek-ai/cordis`、`@deepseek-ai/schemastery` **不在**该检查范围内（不匹配 `@deepseek-ai/dsh*` 前缀），只有 `dsh-*` 家族参与。

实测（`semver` 7.8.5，`runtimeVersion = 0.2.0-rc.2`）：

```
false  ^0.1.7-rc.1     ← 旧声明：6 个 dsh-* peer 全部不满足
true   ^0.2.0-rc.2     ← 新声明
```

`^0.1.7-rc.1` 展开为 `>=0.1.7-rc.1 <0.2.0-0`，把 `0.2.0-rc.2` 排除在外——这就是"插件在当前版本里装不上也起不来"的根因。

**改动**：`package.json` 的 `peerDependencies` 与 `devDependencies` 中 6 个 `@deepseek-ai/dsh-*` 同步提升到 `^0.2.0-rc.2` / `0.2.0-rc.2`。

---

## 2. 审计方法

为避免"看文档猜行为"，审计按三层证据做：

1. **双版本参照源码**：对每个相关包分别取 `0.1.7-rc.1` 与 `0.2.0-rc.2` 的 npm 发布物，对 `lib/` 全树做**逐文件 SHA-256 / 逐字节**比对（而非只读 README 或版本号）。
2. **发布运行时对拍**：把桌面版 `app.asar` 按 asar 索引解出文件字节，与 npm `0.2.0-rc.2` 对比。受检的 16 个核心包 **75/75 个 `.js` 与 npm 发布物逐字节相同** ⇒ npm 证据可代表真实发布运行时。同时确认 `@deepseek-ai` 根不存在重复包造成的版本遮蔽（两处 `cordis` 均为 4.0.4）。
3. **运行时实测**：用仓库内已安装的真实 `0.2.0-rc.2` + `cordis 4.0.4`、裸 `Context` + stub 服务挂载 `lib/index.js`，实跑注册与事件路径（见 §5）。

> 方法学提醒（本次踩过的坑）：桌面版 `app.asar` 会**剥掉 `.d.ts`**，且**不是**每个 `@deepseek-ai/*` 包都被解包到可检索的位置；早期只解出 19 个包，曾据此误判某些 client 包"不存在"。同样地，按需补包时若只补了 host 包，"缺 client UI 包"也只是抽样偏差。结论：**签名比对用 npm 发布物的 `.d.ts`，存在性判定用完整的 npm 闭包（或对 `app.asar` 做内容扫描）**，不要用任何局部解包目录当权威。

---

## 3. host 侧：零破坏性变更

### 3.1 插件用到的 API 面（逐条双版本核验）

| API | 结论 | 备注 |
|---|---|---|
| `agent/pre-step` 事件与 `PreStepDecision` | 无变化 | `dsh-agent` 整包 `lib/` 逐字节相同；发射点 `dsh-agent-loop` 该段未改动 |
| `system-prompt/assemble`（3 参）与 `AssembleContext` | 无变化 | owner 包 `dsh-system-prompt` 逐字节相同；`AssembleContext` **仍不含 `agent`**，`ctx.agents.currentInitiator()` 兜底写法依然必要 |
| `ctx.fs.*`（含 5 参 `writeText`、`sandboxMode`、`listDir`/`stat`/`resolve`/`readText`） | 无变化 | `dsh-fs` 整包逐字节相同 |
| `ctx.tools.register` / `defineTool` / `ToolRunContext` / `exec.agent` / `exec.signal` | 无变化 | `defineTool` 所在的 `dsh-tools/lib/types/schema.d.ts` 逐字节相同 |
| `ctx.skills`（`inject: ['fs','skills','tools','agents']` 中的 `skills`） | 无变化 | owner 包 `dsh-skill` 逐字节相同；消费者 `dsh-skill-filesystem` 的 `inject = ["skills"]` 原样保留 |
| `ctx.agents.currentInitiator()` | 无变化 | `dsh-agent` 逐字节相同 |
| `ctx.webServer.register` | 无变化 | `dsh-host-webserver` 逐字节相同 |
| `ctx.sessions.get` / `Session.header.cwd` / `session/disposed` | 无变化 | `dsh-session` 有改动，但这三处签名与文本不变（仅行号位移） |
| `ctx.get('sandboxPolicy')` + `resolve({ session })` | 无变化 | `dsh-sandbox-policy` 逐字节相同 |
| `createUserMessage` / `UserMessage.source` / `ContentBlock` | 无变化 | 定义文件 `dsh-llm/lib/types/message.d.ts` 逐字节相同 |
| `dsh-settings` 的 `describe()` / `configure()` / volatile 语义 | 无变化 | `dsh-settings` 整包逐字节相同 |
| cordis `effect` / `inject` / `on` / `get` / `fiber.config` / `config` inject 守卫 | 无变化 | cordis 两版同为 4.0.4 |

### 3.2 真正有 `.js` 改动的 8 个包：逐条判定

| 包 | 改动性质 | 对本插件 |
|---|---|---|
| `dsh-tools` | `PreToolDecision.ask` 新增可选 `displayReason`；一处提示文案 | 纯增量，无影响 |
| `dsh-llm` | 新增 `ToolUpdate` / `ToolHistory` / `projectToolUpdates`、`ACCOUNT_QUOTA_EXCEEDED_CODE`；若干文档措辞放宽 | 纯增量，无影响 |
| `dsh-session` | 新增 `toolHistory()` 投影；失败路径重写（`ToolCallRecovery`）；新增 `lib/types/tool-history.*` | 插件用到的三处签名未变 |
| `dsh-agent-loop` | 失败回合补记保守 `tool/result`；`startsSeries` 增加一道**仅在路由声明 `toolUpdate` 时生效**的门；`request/header` 派生 `tool-addition`/`tool-removal` developer 消息 | 行为变化、非破坏。插件裁剪工具面会触发 `toolsChanged`，但未声明 `toolUpdate` 时语义与旧版相同；插件注入的是 **user** 角色消息，不参与 developer 消息投影 |
| `dsh-sandbox` | 新增 `sandboxPermissionsDescription`、`displayReason` 透传 | 插件不直接 import |
| `dsh-user-approval` | `ApprovalRequestEvent.displayReason?` | 纯增量 |
| `dsh-util-values` | `hasIntrinsicConstructor` realm 校验加固 | 插件依赖的 `snapshotJsonValue` 逐字未变 |
| `dsh-workspace` | **`WorkspaceRegistry.initializeDefault` 签名收窄**：`resolveDirectory` 由 `Promise<{path,title}>` 变为 `Promise<string>`，且 title 语义改为"请求路径末段" | host 包；插件使用 client 包的 `uiWorkspace` 服务，**不受影响** |

### 3.3 逐字节相同的包（可直接排除）

`dsh-agent`、`dsh-fs`、`dsh-settings`、`dsh-sandbox-policy`、`dsh-scope`、`dsh-skill`、`dsh-skill-filesystem`、`dsh-system-prompt`、`dsh-host-webserver`、`dsh-base`、`dsh-agent-instructions`、`dsh-invariants`、`dsh-session-persistence`、`dsh-session-projection`、`dsh-typert-protocol`、`dsh-brand`、`dsh-home-paths`、`dsh-ptc-runtime` —— 这些包在两版之间仅 `package.json` / `README.i18n.yaml` 变化，`lib/` 全树 SHA-256 相同。

---

## 4. client 侧：零必须改动

穷举 `lib/client.js` 中出现的**全部**外部标识符后逐项核对：

| 面 | 结论 | 关键证据 |
|---|---|---|
| `dsh.client.inject` 的 6 个包 | 全部存在，包名无需替换 | 两版 `exports` 映射一致；`dsh.client` 的 `inject` / `platform` 契约未变 |
| `plugins.row.config` 席位 | 未变 | `dsh-client-ui-plugin-manager/lib/types/client/slot-contract.d.ts` **整文件逐字节相同**；仍 `keyed` / `scope: root` / `{ view, form? }` |
| `conversation.session.header.utilities` | 未变 | `slots.d.ts` 对应段与 owner props 双版本相同；`sessionId` 标准套件所在包逐字节相同 |
| `conversation.input.dock` | 未变 | `InputZone = { session, input }` 未变；header 在 blank 时自隐藏的断言逐行相同 ⇒ hero 双席位互斥仍成立 |
| `rowConfigKey(<包名>, <行 id>)` | 未变 | 实现逐字节相同；`declaredRows` 的 `rowId: row.id` 逐行相同，`include:` 前缀只进 `entryId` |
| `SettingsFormModel` / `SettingsForm` / `SettingsValueField` / `settingsNumberField` | 全部存在且签名未变 | `form-model.d.ts`（214 行）与 `SettingsForm.d.ts` 逐字节相同；`fields.d.ts` 仅一行注释迁移 |
| `configForms.describe()` / `.get()` / `.ensure()` | 未变 | `dsh-client-ui-settings/lib/client.js` 逐字节相同 |
| `locale.register` / `locale.bind` | 未变 | 该包 0.2.0 只新增字典键与一处 CSS |
| `uiWorkspace.pickDirectory()` | 未变 | 双版本同为 `Promise<string \| null>`，实现逐行相同；服务名仍为 `uiWorkspace` |
| 席位注册 API（`ctx.slots.register` / `inject`） | 未变 | `dsh-client-ui-slots` 整包仅元数据变化；`dsh-client-store`、`dsh-client-ui-renderer` 的 slots 服务未变 |
| `sidebarRight.openResource(address, options?)` 与 `dsh-resource://file/...` | 未变 | 签名与地址语法、`encodeSegment` 的 `:` 保留规则均一致 |
| 主题 token | **零删除**（377 → 408） | 插件用到的 14 个中 13 个仍存在；`--dsw-alias-bg-layer-0` 两版都不由主题定义，插件本就带 `#FFFFFF` 兜底 |
| shell 种子模块表 | 一致（9 个 specifier） | 解释了为何 `dsh-client-ui-primitives` 不在 `inject` 里也能 `require`（它在种子表中，且该包没有 `dsh.client` 字段） |

### 与上一版（v0.3.5）的两条"踩坑"关系

v0.3.5 记录过两个 id 体系：席位 key 用 patch 的**裸 id**，而配置表单的 `entryId` 是带 `include:` 前缀的合成 id。本次审计确认 0.2.0-rc.2 中该分工**完全未变**，因此 `lib/client.js` 的 `ROW_CONFIG_KEY`（裸 id）与 `entryIdOf`（后缀匹配）都必须**保持原样**——不要为了"适配"而改动它们。

---

## 5. 运行时实测证据

用真实 `0.2.0-rc.2` + `cordis 4.0.4`、裸 `Context` 与 stub 服务挂载 `lib/index.js`：

- 插件正常挂载，无激活错误；`mounted; allowlist=[...]` 正常打印。
- 7 个工具全部注册：`trellis_state`、`trellis_task_create`、`trellis_task_skip`、`trellis_task_update`、`trellis_task_archive`、`trellis_artifact_update`、`trellis_ui_update`。
- `webServer.register` 被调用（`prefix:/trellis-workflow/api`）。
- `agent/pre-step` 瀑布实跑：**breadcrumb 真的注入了**（消息数 1 → 2，`user` 角色，内容以 `[trellis/no_task] Workflow state (...)` 开头），`decision.messages.toSpliced` 插入路径可用。
- 置 `fs.sandboxMode = 'workspace-write'` 后：`policy.resolve` 收到的参数恰为 `{ session }`，解析结果作为 `writeText` 第 5 参透传（实测 26 次调用来自技能置备）⇒ `ctx.get('sandboxPolicy') → resolve({session}) → writeText` 全链路打通。

---

## 6. 验证状态

审计完成后，另有一轮**独立验证**（验证者不属于任何实现者）在真实 `0.2.0-rc.2` 上完成复现与对抗性检查。以下区分「已验证」与「仍需真实 GUI / LLM 回合」。

### 6.1 已在真实 0.2.0-rc.2 上验证通过

| 项 | 结论 |
|---|---|
| 兼容性声明是决定性变量 | 同一真实 CLI、同一命令，仅 peer 范围不同：`^0.2.0-rc.2` 通过（exit 0），`^0.1.7-rc.1` 被拒（`installation rejected` + `nothing was installed`） |
| 插件在真实 host 中加载 | 无 activation 错误；6 个 `trellis_*` 工具注册；`apply()` 执行到末句 |
| `trellis_state` 真实代码路径 | fixture 返回 `matched=true / phase=planning / activeTask=.trellis/tasks/feat-01-15-demo / slugValid=true`；allowlist 外返回 `source=outside-allowlist` |
| **`enforceReadonlyPlanning` 工具面裁剪**（审计中最薄的环节） | 在**真实 undecided / planning / authorized / skipped** 相位下实测：`write`/`edit` 与对应 trellis 工具被裁、其它插件工具（`web_search`、`read`）保留、只读提示段按相位增删、breadcrumb 每相位恰好 1 条 —— 21/21 PASS |
| 配置表单与 volatile 字段 | `describe()` 收录该条目（`applies: "live"`），4 个 schema 默认值全部行为化验证（`injectStep=1` 只注入第 1 步、`inline=false` → `planning`、`skipKeywords` 按词匹配等） |
| 写路径 | `ctx.fs.writeText`（5 参含 sandboxPolicy）往返成功；`task_create → task_update → artifact_update → git 门禁 → completed → archive → task_skip` 端到端全部可用 |
| skills 置备 | 15 个技能目录 + `_templates` 全量真实落盘，废弃模板被自愈修剪 |
| Web API | 外部可观测面为**1 次 `prefix` 路由注册**（`/trellis-workflow/api`）+ handler 内 **3 条子路径**（`task-state` / `board` / `bind`）；真实 HTTP 实测 200，且 404 / 405 / 403（跨站与非同源 Origin）/ 400（畸形 JSON）均按设计 |
| 反例与降级 | 空 allowlist、无 config 块、畸形 config（该条目不激活但宿主其余部分照常启动）、allowlist 外 cwd、损坏 session/task JSON、3 MB task.json、多会话并发绑定、缺失 `webServer`、9 项非法工具参数 —— 全部为结构化拒绝或优雅降级，无一抛入回合 |

### 6.2 仍需真实 GUI 或真实 LLM 回合（当前未验证）

1. 桌面版**真实 entry 激活**（L3）：安装后需完整退出并重启桌面版才发生；重启前只能确认到 L1（文件就位）与 L2（`--dump-config` 合成树已含该行并按 id 合入用户 config）。
2. 设置卡片在真实 GUI 中的**渲染与保存**（`plugins.row.config` 席位 + `SettingsForm`）。
3. 「浏览…」文件夹选择按钮（`uiWorkspace.pickDirectory` → Electron 目录对话框）。
4. 会话头部 chip 与 hero chip **恰好各出现一次**（依赖 `session.blank` / `conversationPhase` 运行时状态）。
5. kanban 弹窗 `sidebarRight.openResource` 的 store 前置条件（0.2.0 对「无 on-screen session / store 未铸造」会 fail loud）。
6. artifact token 以 `./` 开头时，与官方 `sessionFileAddress`（会剥 `./`）的归一化差异；插件实现只剥 `@`。
7. `dsh-agent-loop` 0.2.0 新增的 `ToolCallRecovery`（失败回合补写 `tool/result`）：插件不读 tool results，判定低风险，但未在真实失败回合中触发。
8. `bind` 路由的**写绑定成功**路径（仅验证到结构化信封）。
9. 深色模式下 `--dsw-alias-bg-layer-0` 兜底底色是否观感异常（既有问题，非 0.2.0 引入）。


---

## 7. 一句话总结

> 0.1.7-rc.1 → 0.2.0-rc.2 之间，本插件所用的 host 与 client API **没有任何破坏性变更**（关键契约逐字节相同，8 个有代码改动的包全为纯增量或不可达）；真正让它无法在当前版本运行的，是 peer 声明 `^0.1.7-rc.1` 不覆盖 `0.2.0-rc.2`，被 DSH 的 `evaluatePluginCompatibility` 前置检查与启动检查拒绝。适配因此落在声明层：把 6 个 `@deepseek-ai/dsh-*` peer 提升到 `^0.2.0-rc.2`。
