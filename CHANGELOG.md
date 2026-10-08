# Changelog

dsh-trellis 各版本发布日志汇总，同时作为后续 Release Notes 的**格式模板**。

## 格式约定（Release Notes 模板）

- **语言**：中文 + 英文双语，中文在上、英文在下，之间以 `---` 分隔。
- **分组标题**：中文 `## 功能` / `## 修复` / `## 文档`（按需补充 `## 性能` / `## 构建` / `## 兼容性` 等）；英文对应 `## Features` / `## Fixed` / `## Docs`。
- **条目**：`- **要点**：说明`——要点加粗，说明陈述变更价值、影响范围与关键行为。
- **代码标识**：工具名 / 函数名 / 路径等用反引号包裹。
- **同步**：tag 推送后 GitHub Release 的 body 由管道自动提取本文件对应条目（`scripts/extract-changelog.mjs <tag>`，见 `.github/workflows/release.yml`）；未找到条目时回退到 GitHub 自动生成。每个版本发布前，先在文件头部新增 `## <tag> — <日期>` 条目。

---

## v0.3.7 — 2026-10-08

## 修复

- **修复暗色模式下任务看板浅底白字、标题与徽章难以辨认的问题**（[#2](https://github.com/1264459640/dsh-trellis/issues/2)）：将不存在的 `--dsw-alias-bg-layer-0` 改为宿主实际定义的 `--dsw-alias-bg-base`，并让选中行、类型徽章、步骤计数及阶段圆圈跟随宿主主题。区分强调填充色与文字色，保留深色按钮与白字的明确配对；紧凑看板、泳道、列表和详情在明暗主题间切换时均保持可读，不改变布局与任务交互。

## 测试

- **新增 28 项主题回归测试**：覆盖三类选中任务、三种看板视图及明亮、暗色、无宿主变量三种配色环境；全量 `node --test` 共 135 项通过。另以隔离浏览器验证真实 CSS 计算与同一 DOM 的明暗切换，受检文字最低对比度为 **5.19:1**，高于普通文本 4.5:1 标准。

---

## Fixed

- **Fix unreadable kanban titles and badges in dark mode** ([#2](https://github.com/1264459640/dsh-trellis/issues/2)): replace the nonexistent `--dsw-alias-bg-layer-0` with the host-defined `--dsw-alias-bg-base`, and make selected rows, type badges, step counts, and stage circles follow the host theme. Separate accent fills from readable text colors while keeping explicit dark-button/white-label pairs. The compact board, lanes, list, and details remain readable across light/dark switches without changing layout or task interactions.

## Tests

- **Add 28 theme regression tests**: cover three selected task types, three board views, and light, dark, and no-host-token palettes; all 135 `node --test` checks pass. Isolated-browser checks also verify computed CSS colors and theme switching on the same mounted DOM, with a minimum measured text contrast of **5.19:1**, above the 4.5:1 threshold for normal text.

---

## v0.3.6 — 2026-10-05

## 兼容性

- **适配 DSH 0.2.0-rc.2 运行时**：`peerDependencies` / `devDependencies` 的 6 个 `@deepseek-ai/dsh-*` 由 `^0.1.7-rc.1` 提升到 `^0.2.0-rc.2`（`@deepseek-ai/cordis` 仍 `^4.0.4`、`@deepseek-ai/schemastery` 仍 `^3.18.4`，两者在两版运行时间均未变）。这是本次适配的**承重改动**：DSH 会强制校验插件声明的 DSH peer 范围——`dsh-app-boot` 的 `evaluatePluginCompatibility()` 对每个 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer 执行 `semver.satisfies(运行时版本, 范围, { includePrerelease: true })`，不匹配时 `dsh-plugin-manager` 会在 pnpm 运行**之前**直接拒绝安装（`installation rejected`），并在 profile 启动时拒绝加载该插件。旧的 `^0.1.7-rc.1` 在 semver 上不覆盖 `0.2.0-rc.2`（`>=0.1.7-rc.1 <0.2.0-0`），因此 6 个 peer 全部不满足，插件在当前桌面版中**既装不上也起不来**；提升后恢复正常。
- **`lib/` 零改动：两版之间无破坏性 API 变更**（逐字节审计结论）。host 侧插件用到的全部 API 面——`agent/pre-step` 的 payload 与 `PreStepDecision`、`system-prompt/assemble` 的 3 参契约与 `AssembleContext`（仍不含 `agent`）、`ctx.fs` 全部成员（含 5 参 `writeText` 与 `sandboxMode`）、`ctx.tools.register`、`defineTool`/`ToolRunContext`、`ctx.skills`、`ctx.agents.currentInitiator`、`ctx.webServer.register`、`ctx.sessions.get`/`Session.header.cwd`/`session/disposed`、`ctx.get('sandboxPolicy')` + `resolve({ session })`、`createUserMessage` 与 `ContentBlock`、`dsh-settings` 的 `describe()`/`configure()`/volatile 语义、cordis 4.0.4 的 `effect`/`inject`/`on`/`fiber.config`——在两版之间**逐字节相同**。client 侧穷举全部外部标识符（6 个 `dsh.client.inject` 包、5 个服务名、3 个席位、4 个 primitive 导出、locale 命名空间、14 个 CSS token、`/trellis-workflow/api` 下的 3 条子路径、`dsh-resource://` 地址语法）后确认：`plugins.row.config` 席位的 `slot-contract.d.ts`、`configForms` 的 `dsh-client-ui-settings/lib/client.js`、`SettingsFormModel` 的 `form-model.d.ts`（214 行）等关键契约文件逐字节相同，`rowConfigKey(<包名>, <行 id>)` 的 key 格式与「`rowId` 取 patch 裸 id、`include:` 前缀只进 `entryId`」的分工均未变，主题 token **零删除**（377 → 408，仅新增 `--dsw-radius-*`、`--dsw-focus-ring-*` 等）。
- **真正有代码改动的 8 个包均为纯增量或插件不调用**：`dsh-tools`（`PreToolDecision.ask` 新增可选 `displayReason`）、`dsh-llm`（新增 `ToolUpdate` / `ToolHistory` / `projectToolUpdates` 与 `ACCOUNT_QUOTA_EXCEEDED_CODE`）、`dsh-session`（新增 `toolHistory()` 投影与失败路径的 `ToolCallRecovery`）、`dsh-agent-loop`（失败回合补记 `tool/result`；`startsSeries` 新增一道仅在路由声明 `toolUpdate` 时生效的门）、`dsh-sandbox`、`dsh-user-approval`、`dsh-util-values`（`hasIntrinsicConstructor` realm 加固；插件依赖的 `snapshotJsonValue` 未变）、`dsh-workspace`。其中唯一**破坏性签名变更**是 `dsh-workspace.WorkspaceRegistry.initializeDefault`（`resolveDirectory` 由 `Promise<{path,title}>` 收窄为 `Promise<string>`）——该服务属 host 包，本插件使用 client 包 `dsh-client-ui-workspace` 提供的 `uiWorkspace` 服务，**不受影响**。

## 文档

- **新增 `docs/ref/dsh-0.2.0-rc.2-audit.md`**：记录本次适配的双版本审计方法与证据（含包级变更面、逐字节比对清单、以及仍需真实 GUI 才能确认的运行期项）。
- **`README.md` / `README_EN.md` 补充安装与兼容性说明**：新增「桌面版请用自带 carrier CLI」一节（普通 `dsh` CLI 会以 `profile "desktop" is managed exclusively by the Electron application` 拒绝操作 desktop profile，须改用 `resources\runtime\cli\bin\dsh.cmd`，且安装后须完整退出并重启桌面版），并说明 DSH 会强校验 `@deepseek-ai/dsh-*` peer 范围、升级 DSH 后若插件失效应先核对 peer 声明。

---

## Compatibility

- **Adapt to the DSH 0.2.0-rc.2 runtime**: the six `@deepseek-ai/dsh-*` entries in `peerDependencies` / `devDependencies` move from `^0.1.7-rc.1` to `^0.2.0-rc.2` (`@deepseek-ai/cordis` stays `^4.0.4`, `@deepseek-ai/schemastery` stays `^3.18.4`; neither changed between the two runtimes). This is the **load-bearing change** of the adaptation: DSH enforces the DSH peer ranges a plugin declares — `dsh-app-boot`'s `evaluatePluginCompatibility()` runs `semver.satisfies(runtimeVersion, range, { includePrerelease: true })` for every `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer, and on a mismatch `dsh-plugin-manager` rejects the installation **before pnpm runs** (`installation rejected`) and profile startup denies the plugin. The old `^0.1.7-rc.1` does not cover `0.2.0-rc.2` (`>=0.1.7-rc.1 <0.2.0-0`), so all six peers were unsatisfied and the plugin could neither install nor start on the current desktop build; raising the range restores both.
- **No `lib/` changes: no breaking API change between the two versions** (byte-level audit). On the host the complete API surface the plugin uses — the `agent/pre-step` payload and `PreStepDecision`, the 3-argument `system-prompt/assemble` contract and its `AssembleContext` (still without `agent`), every `ctx.fs` member (including the 5-argument `writeText` and `sandboxMode`), `ctx.tools.register`, `defineTool`/`ToolRunContext`, `ctx.skills`, `ctx.agents.currentInitiator`, `ctx.webServer.register`, `ctx.sessions.get`/`Session.header.cwd`/`session/disposed`, `ctx.get('sandboxPolicy')` + `resolve({ session })`, `createUserMessage` and `ContentBlock`, `dsh-settings`' `describe()`/`configure()`/volatile semantics, and cordis 4.0.4's `effect`/`inject`/`on`/`fiber.config` — is **byte-identical** across the two versions. On the client, after enumerating every external identifier (six `dsh.client.inject` packages, five service names, three slots, four primitive exports, the locale namespace, fourteen CSS tokens, the three sub-paths under `/trellis-workflow/api`, the `dsh-resource://` address syntax), the contracts that matter are byte-identical too: the `plugins.row.config` slot contract (`slot-contract.d.ts`), `configForms` (`dsh-client-ui-settings/lib/client.js`), `SettingsFormModel` (`form-model.d.ts`, 214 lines); `rowConfigKey(<package>, <row id>)` keeps its format and the split where `rowId` comes from the bare patch id while the `include:` prefix appears only in `entryId`; and theme tokens have **zero removals** (377 → 408, additions only, such as `--dsw-radius-*` and `--dsw-focus-ring-*`).
- **All eight packages with real code changes are additive or unreachable by this plugin**: `dsh-tools` (optional `displayReason` added to `PreToolDecision.ask`), `dsh-llm` (new `ToolUpdate` / `ToolHistory` / `projectToolUpdates` and `ACCOUNT_QUOTA_EXCEEDED_CODE`), `dsh-session` (new `toolHistory()` projection, plus `ToolCallRecovery` on failure paths), `dsh-agent-loop` (failed turns now record a conservative `tool/result`; `startsSeries` gained a gate that only applies when a route declares `toolUpdate`), `dsh-sandbox`, `dsh-user-approval`, `dsh-util-values` (`hasIntrinsicConstructor` realm hardening; the `snapshotJsonValue` this plugin relies on is unchanged), and `dsh-workspace`. The only **breaking signature change** is `dsh-workspace.WorkspaceRegistry.initializeDefault` (`resolveDirectory` narrows from `Promise<{path,title}>` to `Promise<string>`); that service belongs to the host package, while this plugin consumes the `uiWorkspace` service of the client package `dsh-client-ui-workspace`, so it is **unaffected**.

## Docs

- **Added `docs/ref/dsh-0.2.0-rc.2-audit.md`**: records the two-version audit method and evidence for this adaptation (package-level change surface, the byte-identical comparison list, and the runtime-only items that still need a real GUI to confirm).
- **Expanded `README.md` / `README_EN.md` with install and compatibility notes**: a new "desktop app — use the bundled carrier CLI" section (the ordinary `dsh` CLI refuses the `desktop` profile with `profile "desktop" is managed exclusively by the Electron application`, so use `resources\runtime\cli\bin\dsh.cmd`, and fully quit and relaunch the desktop app afterwards), plus an explanation that DSH strictly validates `@deepseek-ai/dsh-*` peer ranges and that a plugin failing right after a DSH upgrade should have its peer declarations checked first.

---

## v0.3.5 — 2026-09-24

## 兼容性

- **适配 DSH 0.1.7-rc.1 运行时**：settings 服务在 0.1.7 被重写为 Loader 条目驱动——`ctx.settings.register()` 移除、命名空间改为 Loader 条目 id、Web 表单由条目 `Config` schema 的 volatile 字段投影。host 侧 `lib/settings.js` 不再注册或 opt-in 任何命名空间（0.1.7 的 `autoGenerate` 默认即 `true`；且在 inject 回调里调 `configure()` 会报 `cannot create effect on inactive context`），live 值改读 `ctx.fiber.config`——`ctx.config` 被 cordis 的 inject 守卫拦截（`cannot get property "config" without inject`），原写法会让整个 entry 激活失败；`lib/meta.js` 给全部可配置字段加 `.volatile()` 并把解析出的 cosmokit volatile 包装解包为纯值（`unwrapVolatileConfig`）。
- **设置面板迁移到新的插件列表页**（`lib/client.js`）：原 `settings.plugins.tab` 页签（连同已删除的 `settingsScope` 服务）改为注册到插件列表页的 `plugins.row.config` 席位，key 为 `@banana-peeljj12/dsh-trellis#trellis-workflow`（即 `rowConfigKey(<包名>, <patch 行 id>)`）。表单改用官方 `@deepseek-ai/dsh-client-ui-primitives` 的 `SettingsFormModel` + `SettingsForm` + `SettingsValueField`，读写宿主共享的 `configForms`，条目 id 由 describe 镜像**动态解析**——bundle 的 `insert:` 行会被加载成 `include:trellis-workflow` 这类带前缀的 id，硬编码裸 id 会让门控永不开启、卡片渲染为空白（实测 `occupants: []`）；编辑暂存、单次保存、支持「已覆盖/恢复默认」。client 依赖改为真实存在的 0.1.7 包（移除已不存在的 `@deepseek-ai/dsh-client-runtime`，补 `dsh-client-ui-plugin-manager`/`dsh-client-ui-workspace`/`dsh-client-ui-sidebar-right`）。
- **插件配置 schema 必须以 `Config`（大写）声明**（`lib/index.js`）：cordis 只把插件 schema 暴露在 `runtime.Config`，而 dsh-settings 的 `describe()` 正是读 `entry.fiber.runtime.Config`。原先的小写 `config: SCHEMA` 使该条目**永远不会被 settings 收录**——插件其余功能全部正常，唯独插件列表页的配置表单静默消失（渲染为「暂不可配置」）。改为 `Config: SCHEMA` 后条目被正常收录，volatile 字段也真正参与解析（默认值生效；值以 cosmokit volatile 包装到达 `apply`，由 `unwrapVolatileConfig` 解包）。
- **`system-prompt/assemble` 取会话方式修正**：0.1.7 的 `AssembleContext` 不再携带 `agent`，`enforceReadonlyPlanning` 改从 `ctx.agents.currentInitiator()` 解析当前会话 cwd，只读规划强制恢复生效。
- **安装器去除过时 harness 白名单补丁**（`scripts/install.mjs`）：0.1.7 下 Web 设置经 `remote.settings` 到达，不再需要补丁 `dsh-host-apiproxy` 的 `WEB_SETTINGS_NAMESPACES`。
- **peer/dev 依赖对齐 0.1.7-rc.1**：`@deepseek-ai/dsh-*` 升至 `^0.1.7-rc.1`，`@deepseek-ai/cordis` 升至 `^4.0.4`，`@deepseek-ai/schemastery` 升至 `^3.18.4`。

## 修复

- **只读规划强制（`enforceReadonlyPlanning`）恢复生效**：此前因 `context.agent` 为空，cwd 解析恒失败、工具面裁剪从未执行；改为 `currentInitiator()` 后按授权状态正确裁剪 write/edit 与对应 trellis 工具。

---

## Compatibility

- **Adapt to the DSH 0.1.7-rc.1 runtime**: the settings service was rewritten to be Loader-entry driven in 0.1.7 — `ctx.settings.register()` is gone, namespaces are now loader entry ids, and the Web form auto-projects the volatile fields of the entry's `Config` schema. On the host, `lib/settings.js` registers/opt-ins nothing at all (0.1.7's `autoGenerate` defaults to `true`, and calling `configure()` from an inject callback fails with "cannot create effect on inactive context"), and reads live values from `ctx.fiber.config` — `ctx.config` is guard-blocked by cordis ("cannot get property \"config\" without inject") and the original read made the whole entry fail to activate; `lib/meta.js` marks every configurable field `.volatile()` and unwraps the cosmokit volatile wrappers into plain values (`unwrapVolatileConfig`).
- **The plugin config schema must be declared as `Config` (capital)** (`lib/index.js`): cordis only exposes a plugin's schema at `runtime.Config`, which is exactly what dsh-settings' `describe()` reads (`entry.fiber.runtime.Config`). With the original lowercase `config: SCHEMA` the entry was never listed by settings — every other feature kept working, and only the Plugins-page form silently vanished ("not available"). Declaring `Config: SCHEMA` makes the entry listable, and the volatile fields then really take part in resolution (defaults apply; values reach `apply` as cosmokit volatile wrappers, unwrapped by `unwrapVolatileConfig`).
- **Migrate the settings page into the new Plugins list** (`lib/client.js`): the former `settings.plugins.tab` tab (along with the removed `settingsScope` service) now registers into the plugin list page's `plugins.row.config` seat, keyed `@banana-peeljj12/dsh-trellis#trellis-workflow` (= `rowConfigKey(<package name>, <patch row id>)`). The form uses the official `@deepseek-ai/dsh-client-ui-primitives` `SettingsFormModel` + `SettingsForm` + `SettingsValueField`, reading and writing the shared `configForms`; the entry id is resolved dynamically from the describe mirror — a bundle-inserted row is loaded as `include:trellis-workflow`, so a hard-coded bare id left the gate permanently closed and the card rendered blank (observed `occupants: []`). Edits are staged, written on one save, with "overridden / reset to default" support. Client dependencies switch to real 0.1.7 packages (drop the non-existent `@deepseek-ai/dsh-client-runtime`; add `dsh-client-ui-plugin-manager` / `dsh-client-ui-workspace` / `dsh-client-ui-sidebar-right`).
- **Fix how `system-prompt/assemble` resolves the session**: the 0.1.7 `AssembleContext` no longer carries `agent`; `enforceReadonlyPlanning` now resolves the current session cwd from `ctx.agents.currentInitiator()`, restoring read-only planning enforcement.
- **Drop the obsolete harness allowlist patch from the installer** (`scripts/install.mjs`): on 0.1.7 the Web settings form is reached via `remote.settings`, so patching `dsh-host-apiproxy`'s `WEB_SETTINGS_NAMESPACES` is no longer required.
- **Align peer/dev dependencies to 0.1.7-rc.1**: `@deepseek-ai/dsh-*` to `^0.1.7-rc.1`, `@deepseek-ai/cordis` to `^4.0.4`, `@deepseek-ai/schemastery` to `^3.18.4`.

## Fixed

- **Read-only planning enforcement (`enforceReadonlyPlanning`) works again**: it previously never ran because `context.agent` was always undefined, so cwd resolution failed and the tool-surface trim never applied; with `currentInitiator()` it now trims write/edit and the matching trellis tools per authorization state.

---

## v0.3.4 — 2026-09-19

## 修复

- **设置面板「浏览…」文件夹选择器修复**（`lib/client.js`）：修复点击「浏览…」后提示「调用文件夹选择器失败，请手动输入路径」的问题。根因是客户端注入并调用了错误的宿主服务名 `workspaces`（该服务是工作区列表/会话存储，不含 `pickDirectory`），导致能力守卫 `typeof pickDirectory !== 'function'` 恒为真、原生目录对话框从未被唤起；现改为官方目录服务 `uiWorkspace`（与 `dsh-client-ui-directory-picker-native` 同款用法），并同步更正 `.trellis/spec/trellis-workflow/web-ui/index.md` 目录选择服务调用约定，消除笔误传播源。选中目录后仍按原逻辑归一化为正斜杠并去重写入白名单；取消（`null`）无副作用；手输路径 + 「添加」通路保持不变。

---

## Fixed

- **Fix the settings-panel "Browse…" folder picker** (`lib/client.js`): fixes the "Could not open the directory picker — enter the path manually" error when clicking "Browse…". The root cause was the client injecting and consuming the wrong host service name `workspaces` (a workspace-list/session-store service that has no `pickDirectory`), which made the capability guard `typeof pickDirectory !== 'function'` always true so the native directory dialog was never opened. It now uses the official `uiWorkspace` service (same usage as `dsh-client-ui-directory-picker-native`), and the directory-picker call convention in `.trellis/spec/trellis-workflow/web-ui/index.md` is corrected in sync to remove the typo propagation source. Picked directories are still normalized to forward slashes and deduped into the allowlist; cancel (`null`) stays a silent no-op; the manual input + "Add" path is unchanged.

---

## v0.3.3 — 2026-09-12

## 功能

- **设置面板白名单支持「浏览…」文件夹选择器**（`lib/client.js`）：注入白名单新增 **浏览…** 按钮，点击后经 DSH 官方目录服务 `ctx.workspaces.pickDirectory()` 唤起系统原生目录选择对话框（Windows 资源管理器风格），选中目录后自动归一化为正斜杠并直接加入白名单（去重，取消无副作用）；原生选择器不可用（如非 loopback 部署）时显示可读错误提示并保留手动输入通路，面板不崩、手输不受影响。

---

## Features

- **Allowlist "Browse…" folder picker in the settings panel** (`lib/client.js`): the injection allowlist gains a **Browse…** button that opens the Host's native directory picker via the official `ctx.workspaces.pickDirectory()` service (Explorer-style dialog on Windows); the picked directory is normalized to forward slashes and appended straight into the allowlist (deduped; cancelling is a silent no-op). When the native picker is unavailable (e.g. non-loopback deployment) a readable error surfaces and the manual input path stays fully functional.

---

## v0.3.2 — 2026-09-11

## 修复

- **看板产物「打开」改为 DSH 原生文档预览打开文件链接**（`lib/client.js`）：此前点击产物「打开」把 `@.trellis/tasks/...` 原生文件引用**回填进输入框**并聚焦，与「原生文件引用交给 DSH 原生查看」的设计约定相悖；现改为调用 `ctx.sidebarRight.openResource`（`dsh-resource://file/session/<sessionId>/<path>` 地址，与官方聊天客户端打开 `@file` 引用同机制），在右侧文档预览中原生打开，输入框不再被触碰；右侧栏服务不可用时降级为复制文件引用到剪贴板并提示。活动与归档任务路径均正确处理。

---

## Fixed

- **Kanban artifact "Open" now opens the file link in DSH's native document preview** (`lib/client.js`): clicking "Open" on an artifact previously backfilled the `@.trellis/tasks/...` native file reference into the composer input and focused it, contradicting the "hand the native file reference to DSH for native viewing" design convention. It now calls `ctx.sidebarRight.openResource` (a `dsh-resource://file/session/<sessionId>/<path>` address, the same mechanism the official chat client uses to open `@file` references), opening the file in the right-sidebar document preview without touching the input box; when the right-sidebar service is unavailable it falls back to copying the file reference to the clipboard with a notice. Active and archived task paths are both handled correctly.

---

## v0.3.1 — 2026-09-10

## 功能

- **任务看板 UI 三形态按效果图高保真还原**（`lib/client.js` 渲染层重写）：工作台看板（三泳道卡片）、工作台列表（高密度数据网格）、侧栏紧凑弹窗（紧凑列表）与右侧详情面板均逐区域对齐参考图——结构、配色、排版密度、间距与文案三层一致。
- **统一设计令牌（TB Token）并对齐效果图取色**：新增/校准选中蓝 `#185DDD`、进度蓝 `#216AE2`、弹窗强调蓝 `#146BFE`、黑胶囊 `#0B0C0D`、完成绿 `#3BAF62`/环 `#61BD7E`、选中浅蓝底 `#EFF6FE`/`#F2F6FC`、缺陷类型橙 `#F77032`；圆角 popover/modal 收敛为 16px。
- **顶栏与筛选控件重排**：筛选胶囊去除计数、形状由全圆胶囊改为 8px 圆角矩形（与效果图一致）、并左对齐紧跟搜索框；视图切换改为「工作台」静态标签 + 黑底当前模式钮（看板/列表可切）；关闭按钮去边框化。
- **看板卡片/列表行/弹窗行结构与选中态还原**：卡片四行结构（状态点+类型徽章 / 标题 / slug / 进度条+步骤同行）、完成卡满绿条+绿环勾；列表行阶段徽章显示「实现（impl）」；弹窗头部胶囊+展开/关闭图标、选中行左蓝竖条+右蓝点；footer「仅展示，不直接改状态」。
- **详情面板重构**：单一黑色主 CTA 状态机（未激活「激活任务」/已激活「推进任务」+轻量取消入口/归档只读）；阶段流水线改单色克制风（无外框、贯通轴线、白底圆节点+深色字形、当前节点蓝环→最终定稿为品牌蓝实心+白序号、节点放大至 20/24px）；产物区简化为图标+mono 文件名+打开按钮；执行步骤清单简行化并新增「已完成 n 个步骤，共 m 个步骤」说明。
- **死代码清理**：删除未引用的样式常量、locale 键与 `renderIcon` 无调用分支（`artifactMeta`/`phaseLabelOf`/`ensureAnimationStyles` 等），净减约 450 行。
- **首个稳定版**：版本号自 `0.3.0-rc.10` 升至 `0.3.1`，收敛此前多轮视觉还原迭代。

---

## Features

- **High-fidelity restoration of the task-board UI to the reference mockups** (`lib/client.js` render layer rework): the workbench kanban (three swimlanes), workbench list (dense data grid), sidebar compact popover, and the right-side details panel are each aligned region-by-region to the effect images — matching structure, colors, typography/density, spacing, and copy.
- **Unified design tokens (TB) aligned to sampled mockup colors**: added/calibrated selected blue `#185DDD`, progress blue `#216AE2`, popover accent blue `#146BFE`, ink `#0B0C0D`, completion green `#3BAF62`/ring `#61BD7E`, selected light-blue backgrounds `#EFF6FE`/`#F2F6FC`, and the orange issue badge `#F77032`; popover/modal radii converge to 16px.
- **Toolbar and filter controls reworked**: filter pills no longer show counts, their shape changed from stadium capsules to 8px rounded rectangles (matching the mockups), and they sit left-aligned right after the search box; the view switch became a static "Workbench" label plus a black current-mode button (Kanban/List); the close button is now borderless.
- **Kanban card / list-row / popover-row structure and selection states restored**: cards use a four-row layout (status dot + type badge / title / slug / progress bar with step text on the same row), completed cards show a full green bar with a green ring check; list stage badges display "实现（impl）"; the popover header holds pills plus expand/close icons and selected rows get a left blue accent bar and right blue dot; footer reads "Display only — no direct state changes".
- **Details panel rebuilt**: a single black primary-CTA state machine (not active → "Activate Task" / active → "Push Task" with a lightweight deactivate entry / archived → read-only); the stage pipeline uses a restrained monochrome style (no outer frame, through-axis line, white round nodes with dark glyphs, current node finally pinned as a brand-blue filled circle with a white index, nodes enlarged to 20/24px); artifacts simplified to icon + monospace filename + open button; the execution-step checklist flattened with a new "Completed n of m steps total" caption.
- **Dead-code cleanup**: removed unreferenced style constants, locale keys, and unused `renderIcon` branches (`artifactMeta`/`phaseLabelOf`/`ensureAnimationStyles`, etc.), netting ~450 fewer lines.
- **First stable release**: version bumped from `0.3.0-rc.10` to `0.3.1`, consolidating several rounds of visual-restoration iterations.

---

## 功能

- **澄清 `modified_files` 为调用期校验凭据（不落盘）**：`trellis_task_update`（任务完成）与 `trellis_task_archive`（任务归档）的 `modified_files` 参数描述明确其为一次性调用期 Git 校验凭据——仅供本次调用的局部干净度/提交校验使用，**不会写入 `task.json`、不改变任务元数据**，需在完成/归档时再次传入。
- **区分两类 Git 脏错误码**：声明清单内文件本身未提交时返回新错误码 `[trellis/git_declared_dirty]`（原与全局脏共用 `[trellis/git_dirty]`，现可程序化区分补救动作）；未传清单的工作区整体脏仍为 `[trellis/git_dirty]`；清单文件不在最近提交历史仍为 `[trellis/git_uncommitted]`。
- **失败报错按调用点定制措辞**：`trellis_task_update` 失败提示"完成任务前…"，`trellis_task_archive` 失败提示"归档任务前…"；未指定调用点时保持中性"完成或归档任务前"（向后兼容）。
- **全局脏失败追加引导段**：报错末尾提示——若未提交改动与任务无关，可传 `modified_files` 声明任务实际改动文件做局部校验（清单内须已提交、清单外放行并告警）；并重申该参数是调用期凭据、不写入 task.json、需再次传入。
- **成功返回回显 `gitCheck`**：两工具成功返回新增 `gitCheck: { scoped, warning }`，`scoped=true` 表示本次走了 `modified_files` 局部校验（清单外放行时 `warning` 非空），便于 Agent 确认校验结果。

---

## Features

- **`modified_files` clarified as a call-time credential (not persisted)**: the `modified_files` parameter descriptions of `trellis_task_update` (completing a task) and `trellis_task_archive` (archiving a task) now state it is a one-shot, call-time Git-check credential used only for this call — it is **NOT persisted into `task.json`** and does not alter task metadata; pass it again on each completing/archiving call that needs scoped relaxation.
- **Distinct dirty error codes**: when a declared file in `modified_files` is itself uncommitted, the new `[trellis/git_declared_dirty]` code is returned (previously shared `[trellis/git_dirty]` with the global case, making remedies indistinguishable programmatically); the no-list global-dirty case keeps `[trellis/git_dirty]`, and declared files missing from recent commit history keep `[trellis/git_uncommitted]`.
- **Call-site-specific failure wording**: `trellis_task_update` failures say "完成任务前…" while `trellis_task_archive` failures say "归档任务前…"; a neutral "完成或归档任务前" is used when no action is specified (backward compatible).
- **Scoped-relaxation guidance on global-dirty failures**: the error now appends a hint that unrelated uncommitted changes can be allowed by declaring the task's real files via `modified_files` (listed files must be committed; outside changes are allowed with a warning), and reiterates the credential is call-time, not persisted, and must be passed again.
- **`gitCheck` echoed on success**: both tools now return `gitCheck: { scoped, warning }` on success (`scoped=true` when `modified_files` was used; `warning` non-null when out-of-list changes were allowed), letting agents confirm the check outcome.

---

## v0.3.0-rc.9 — 2026-09-09

## 功能

- **提升 `modified_files` 局部校验的可发现性**：`trellis_task_update`（任务完成）与 `trellis_task_archive`（任务归档）的 `modified_files` 参数描述现明确说明其语义——传入后 Git 干净度校验限缩到清单内文件（清单内文件必须已提交），工作区中清单之外的其他未提交改动不再阻塞完成/归档，仅给出告警；省略该参数则保持全局严格校验（工作区必须整体干净）。收尾技能 `trellis-finish-work` 新增 "Scoped relaxation" 指引，推荐"先提交任务自身文件、再以 `modified_files` 声明以放行无关改动"，替代盲目 `git stash`；README / README_EN 的 Git 干净度校验条目同步补记该行为。

---

## Features

- **Improved discoverability of the scoped `modified_files` git check**: the `modified_files` parameter descriptions of `trellis_task_update` (completing a task) and `trellis_task_archive` (archiving a task) now spell out the semantics — providing the list scopes the Git cleanliness check to those files (the listed files must themselves be committed), and uncommitted changes outside the list no longer block completion or archival, only emitting a warning; omitting the parameter keeps the global strict check (fully clean working tree). The `trellis-finish-work` wrap-up skill adds a "Scoped relaxation" step recommending "commit the task's own files first, then declare them via `modified_files` to allow unrelated changes" instead of blind `git stash`; README / README_EN Git Cleanliness Check bullets are updated accordingly.

---

## v0.3.0-rc.8 — 2026-09-09

## 功能

- **看板工作台全面重构与视觉参考复原**：
  - **统一设计系统（TB Token）**：建立统一的变量与设计 Token 系统，适配浅色/深色主题，收敛颜色、圆角、阴影与排版规则。
  - **双模式工作台交互**：提供紧凑气泡列表模式（Popover）与全屏扩展工作台（Expanded Workbench），支持多泳道视图（Lanes View）与紧凑列表视图（List View）一键无缝切换。
  - **桌面级尺度还原**：全屏容器扩展至 `min(1450px, 100vw - 64px)`，采用深木炭半透明遮罩与 350px 宽度的任务详情抽屉（Inspector），高反差黑色推进 CTA 按钮；窄屏下泳道支持弹性横向平滑滚动。
  - **任务卡片与进度状态准确呈现**：已完成（completed）与已归档（archived）任务卡片强制展示 100% 绿色完成进度条，并保持准确的步骤计数；优化任务切换与过滤状态，避免切换视图时意外重置选中项。
  - **产物树与步骤追踪器**：详情抽屉中全面增强原生步骤追踪流水线（Step Tracker Pipeline）、任务产物树（Artifact Tree）及胶囊属性标签，支持一键将产物原生引用推入对话框。
- **支持基于 `modified_files` 的局部 Git 校验**：在 `trellis_task_update`（任务完成）与 `trellis_task_archive`（任务归档）中，当显式传入 `modified_files`（任务修改文件清单）时，系统只校验清单内文件的工作区干净度与提交历史；若工作区存在清单之外的其他未提交修改，予以放行并给出 warning 提示，避免因并行开发或无关未提交文件阻塞当前任务的正常交付与归档。未传 `modified_files` 时保持原有的全局纯净度严格校验。

## 构建

- **GitHub Release 发布日志自动提取**：新增 `scripts/extract-changelog.mjs`，CI 发布工作流（`.github/workflows/release.yml`）在推送 tag 时自动从 `CHANGELOG.md` 提取对应版本的双语 Release Notes 并生成 GitHub Release。

## 文档

- **建立标准化 CHANGELOG.md 体系**：汇编自 `v0.1.0-rc.3` 至 `v0.3.0-rc.7` 全部 16 个历史版本的发布日志，确立统一的双语 Release Notes 规范模板。

---

## Features

- **Kanban workbench redesign and reference visual restoration**:
  - **Unified design tokens (TB System)**: introduced a cohesive design token system for colors, radii, shadows, and elevation, seamlessly adapting to light/dark themes.
  - **Dual-mode workbench**: supports compact popover list mode and full expanded workbench with instant lane view / list view switching.
  - **Desktop-scale visual alignment**: modal expanded to `min(1450px, 100vw - 64px)` with deep charcoal translucent overlay, 350px task inspector drawer, and high-contrast black primary advance button; smooth horizontal scrolling for lane columns on narrower viewports.
  - **Truthful task progress and card states**: completed and archived task cards consistently render a 100% solid green progress bar with truthful step count metrics; selection state preserved without unexpected reset during filtering.
  - **Step tracker & artifact tree**: enhanced the native step tracker pipeline, artifact tree, and capsule metadata tags in the inspector drawer, with instant push-to-chat file references.
- **Scoped Git cleanliness check based on `modified_files`**: when `modified_files` is explicitly provided to `trellis_task_update` (completing a task) or `trellis_task_archive` (archiving a task), cleanliness verification is scoped to the declared files. Uncommitted changes outside `modified_files` no longer block completion or archival, emitting a warning instead. Global cleanliness check is preserved when `modified_files` is omitted.

## Build

- **Automated GitHub Release notes extraction**: added `scripts/extract-changelog.mjs`, enabling the release workflow (`.github/workflows/release.yml`) to automatically parse bilingual release notes from `CHANGELOG.md` upon pushing tags.

## Docs

- **Standardized CHANGELOG.md archive**: aggregated all historical release notes across 16 prior releases (`v0.1.0-rc.3` to `v0.3.0-rc.7`), formalizing the bilingual release format template.

---

## v0.3.0-rc.7 — 2026-09-07

## 功能

- **规划期只读保护注入显式指令**：`enforceReadonlyPlanning` 开启且命中 allowlist 时，`undecided`（无任务）与 `planning`（规划阶段）授权状态下，`system-prompt/assemble` 会向装配后的系统提示追加 `trellis:readonly` 指令段，让模型在提示词文本中明确读到"当前只读、方案获批前禁止修改源码或业务文件"，而不只是面对裁剪后的工具面；`authorized` 状态下行为与现状逐字节一致（零回归）。
- **规划产物写通道指引**：planning 指令文本显式指向 `trellis_artifact_update` 作为规划期唯一受控写通道，避免模型因"禁止修改任何文件"的字面禁令而不敢产出 prd/design。

## 修复

- **只读裁剪从白名单改为 denylist**：`applyReadonlyPolicy` / `applyReadonlySections` 原先使用白名单保留语义，会把其他插件注册的工具与 `tool:*` section（`web_search` / `generate_image` / `subagent` / `skill` 等）一并裁剪；改为 denylist 后仅裁剪 `write` / `edit` 与当前授权状态不适用的 trellis 工具，其余工具原样保留。

## 文档

- README / README_EN 更新为重构后看板 UI 截图（泳道视图 / 列表视图）。

---

## Features

- **Explicit read-only instruction injection during planning**: with `enforceReadonlyPlanning` enabled and the allowlist matched, the `system-prompt/assemble` handler now appends a `trellis:readonly` instruction section for `undecided` (no task) and `planning` authorization states, so the model explicitly reads "read-only, no source/business-file changes before approval" in the prompt text instead of facing only a pruned tool surface; `authorized` remains byte-identical to the previous behavior.
- **Planning artifact write-channel guidance**: the planning instruction text explicitly points to `trellis_artifact_update` as the only controlled write channel during planning, so the model is not deterred from producing prd/design artifacts by a literal "no file changes" ban.

## Fixed

- **Readonly trimming switched from allowlist to denylist**: `applyReadonlyPolicy` / `applyReadonlySections` previously used allowlist-keep semantics that swept away tools and `tool:*` sections registered by other plugins (`web_search` / `generate_image` / `subagent` / `skill`, ...); they now trim only `write` / `edit` plus the trellis tools invalid for the current authorization state, preserving everything else.

## Docs

- README / README_EN updated with the redesigned kanban UI screenshots (lanes view / list view).

---

## v0.3.0-rc.6 — 2026-09-06

## 功能

- **看板双模态布局**：小看板彻底解耦为高密度垂直任务列表（Master-Detail），消灭 400px 内双列看板导致的标题截断；大看板按工作流泳道专注展示，并智能折叠 0 任务泳道，消除三条原生横向滚动条并发问题；展开时自动选中第一个任务，并注入自定义细滚动条样式。
- **自包含内联 SVG 图标体系**：refresh / maximize / close / search / file / folder / check / clock / alert 等矢量图标全面替换 Emoji 与汉字按钮，展开/收起彻底纯图标化（保留 `title` 可访问性）。
- **详情面板升级**：横向 Step Tracker 流水线指示器、IDE 风格文件树产物行、胶囊化属性标签（类型/状态/阶段）、实心品牌色主按钮「推进任务」。
- **空列与空状态**：空列不再打印 `(空)` 汉字，改为微透留白插槽；弹窗锁定舒适比例。

## 修复

- **只读规划期 System Prompt 工具修剪**：Web 端开启 `enforceReadonlyPlanning` 后，调试栏工具列表虽已过滤，但发送给模型的自然语言 System Prompt 仍残留 `write`、`edit` 等写工具指南，诱发模型越权调用；现 `system-prompt/assemble` 钩子同步修剪各插件注册的 `tool:*` sections，并导出 `applyReadonlySections` 精准过滤白名单。
- **React Hooks 顺序修复**：`lib/client.js` 中 `closeExpanded` 的 `useCallback` 位于条件 return 之后导致 Hooks 顺序异常，已移至条件 return 之前。

## 文档

- `.trellis/spec/trellis-workflow/web-ui/index.md` 新增「看板双模态与对话联动约定」：泳道单一事实源（`board.tracks`）、steps 聚合字段、克制交互（禁止直接改状态，唯一推进方式为注入 Composer）、React 受控输入注入手法、异步数据空值守卫、`phase` 宿主端透传等 6 条约定。
- `.gitignore` 忽略 `npm pack` 产生的 tgz 构建产物。

---

## Features

- **Dual-mode kanban layout**: small boards are decoupled into a dense vertical task list (master–detail), eliminating the title truncation caused by dual-column boards within 400px; large boards focus on workflow lanes and smartly collapse lanes with zero tasks, removing the three concurrent native horizontal scrollbars; expanding auto-selects the first task and injects a custom slim scrollbar style.
- **Self-contained inline SVG icon system**: vector icons (refresh / maximize / close / search / file / folder / check / clock / alert) replace all Emoji and CJK-character buttons; expand/collapse is now purely icon-based while keeping `title` for accessibility.
- **Details inspector upgrade**: horizontal Step Tracker pipeline indicator, IDE-style file-tree artifact rows, capsule-style property tags (type / status / phase), and a solid brand-color primary button to advance the task via Composer.
- **Empty lane & empty states**: empty lanes no longer print `(空)` text, replaced by subtle blank slots; dialogs lock to a comfortable aspect ratio.

## Fixed

- **Readonly-planning System Prompt tool pruning**: with `enforceReadonlyPlanning` enabled, the debug-bar tool list was filtered but the natural-language System Prompt still contained `write` / `edit` write-tool guidance, tempting out-of-scope calls; the `system-prompt/assemble` hook now prunes `tool:*` sections registered by plugins, and `applyReadonlySections` is exported for precise whitelist filtering.
- **React Hooks order fix**: `closeExpanded`'s `useCallback` in `lib/client.js` sat after a conditional return, violating Hooks rules; it now sits before the conditional return.

## Docs

- `.trellis/spec/trellis-workflow/web-ui/index.md` gains a "dual-mode kanban & conversation-linking conventions" section: single source of truth for lanes (`board.tracks`), steps aggregation fields, restrained interaction (no direct state mutation; the only advance path is Composer injection), React controlled-input injection technique, async-data null guards, and host-side `phase` propagation.
- `.gitignore` now ignores `npm pack` tgz build artifacts.

---

## v0.3.0-rc.5 — 2026-09-06

## 功能

- **统一 5 态步骤引擎**：步骤状态机扩展为 `pending / in_progress / verifying / blocked / completed` 五态，新增验证模式 `none / ai / human`（`verify: true` 保留为 `ai` 的旧别名，兼容既有数据）。
- **AI 验证门禁**：标记步骤 `completed` 前必须先在独立调用中运行测试并录入 `verified: true` 与验证证据，禁止单次调用跳过验证。
- **人工验收卡点**：高风险步骤须用户明确确认并记录 `verifiedBy: 'human'` 才能完成，工具层阻止模型自证自签。
- **阻塞步骤约束**：步骤进入 `blocked` 必须提供 `blockedReason`。
- **完结审计**：任务完结/归档时校验所有步骤均已通过验证，并检查 Git 工作区干净度。
- **单一执行清单**：移除 `feat/implement.md` 与 `refactor/checklist.yaml` 模板，验证计划与风险/回滚预案归入 `design.md`；`task.json.steps` 成为跨工作流类型的唯一执行依据，历史项目中的废弃模板在初始化时自动清理（不触碰任务历史数据）。
- **焦点步骤提示**：面包屑按 `blocked > in_progress > verifying > pending` 优先级聚焦当前步骤，并区分 AI 验证与人工验收两种 `verifying` 状态。

## 修复

- **阶段感知的只读授权**：此前 refactor 任务处于 `scan`（规划类阶段）时，若任务状态漂移为 `in_progress` 会被误判为执行阶段并放开写工具；现按 `work.stage` 解析相位（`completed` 优先），并拒绝「规划类阶段 + `in_progress` 状态」的合并写入，确保规划期只读窗口不被状态漂移绕过。

## 文档

- 重写中英文 README，收敛为简洁、准确的工程规范说明，新增系统架构图 `docs/images/architecture.drawio.png`。

---

## Features

- **Unified 5-state step engine**: steps now support `pending / in_progress / verifying / blocked / completed`, with a new verification mode `none / ai / human` (`verify: true` remains a legacy alias for `ai`, keeping existing data compatible).
- **AI verification gate**: a step cannot be marked `completed` until tests have been run and `verified: true` with verification evidence is recorded in a separate call, preventing verification from being skipped in a single call.
- **Human approval gate**: steps requiring human sign-off can only complete after explicit user confirmation is persisted with `verifiedBy: 'human'`; the tool layer blocks model self-certification.
- **Blocked step constraint**: entering `blocked` requires a `blockedReason`.
- **Completion audit**: closing or archiving a task verifies that every step is verified, and checks the Git working tree is clean.
- **Single execution contract**: the `feat/implement.md` and `refactor/checklist.yaml` templates are removed; verification plans and risk/rollback guidance move into `design.md`; `task.json.steps` becomes the only execution list across work types, and deprecated templates in existing projects are pruned on initialization (never touching task history).
- **Focused step prompts**: breadcrumbs focus on the active step by `blocked > in_progress > verifying > pending` priority, and render `verifying` distinctly for AI verification vs. human approval.

## Fixed

- **Stage-aware read-only authorization**: a refactor task at `scan` (a planning stage) was previously treated as executing whenever its status drifted to `in_progress`, opening full write tools; phase is now derived from `work.stage` (`completed` wins), and writes merging a planning-type stage with `status: in_progress` are rejected, so the read-only planning window cannot be bypassed by status drift.

## Docs

- Rewrote the Chinese/English READMEs into concise, accurate engineering documentation and added the system architecture diagram `docs/images/architecture.drawio.png`.

---

## v0.3.0-rc.4 — 2026-09-05

## 新增

- 只读规划改为授权状态机（undecided / planning / authorized）：新会话默认只读，任务进入规划后放开规划工具，批准或显式跳过后恢复全部写入工具。
- `trellis_task_skip` 跳过工具：无参数、需用户确认，将会话从「未决定」移至「已授权」。

## Added

- Read-only planning is now driven by an authorization state machine (undecided / planning / authorized): a fresh conversation is read-only by default, planning tools open once a task enters planning, and full write tools return after approval or an explicit skip.
- The consent-driven, no-arg `trellis_task_skip` tool that moves the session from undecided to authorized.

---

## v0.3.0-rc.3 — 2026-09-05

## 修复

- 面包屑消息不再携带值为 undefined 的来源字段。

## Fixed

- Breadcrumb messages no longer carry undefined source fields.

---

## v0.3.0-rc.2 — 2026-09-05

## 修复

- 为原生 `step`/`steps` 工具参数声明 `additionalProperties`，使 DSH 能正确接受其 Schema。

## Fixed

- Declared `additionalProperties` for the native `step`/`steps` tool parameters so DSH accepts their schemas correctly.

---

## v0.3.0-rc.1 — 2026-09-05

## 新增

- Trellis 工作流原生执行步骤与验证关卡。
- 只读规划：规划路径获得授权前，写入工具保持不可用。

## Added

- Native execution steps and verification gates to the Trellis workflow.
- Read-only planning: write tools remain unavailable until the planning path is authorized.

---

## v0.2.2 — 2026-09-05

## 修复

- 空白新会话的任务徽标不再缺失：其显示条件此前引用了不存在的 `composerPhase` 字段。

## Fixed

- The missing task chip on blank new conversations: its predicate previously referenced a nonexistent `composerPhase` field.

---

## v0.2.1 — 2026-09-04

## 兼容性

- 移除已废弃的 `settingsNamespace` 导入，恢复对 DSH `0.1.2-rc.1` 的兼容。

## Compatibility

- Removed the retired `settingsNamespace` import to restore compatibility with DSH `0.1.2-rc.1`.

## 构建

- 依赖安装改用 Corepack；测试矩阵精简为受支持的 Node.js 版本。

## Build

- Switched dependency setup to Corepack and trimmed the test matrix to supported Node.js versions.

---

## v0.2.0 — 2026-08-30

## 修复

- 恢复空白新会话 Hero 区域中的 Trellis 任务徽标渲染。

## Fixed

- Restored the Trellis task chip rendering in the blank new-conversation hero area.

---

## v0.1.0-rc.9 — 2026-08-21

## 修改

- 移除任务更新与归档操作上的强制绕过参数，工作流保护不可绕过。

## Changed

- Removed the force-bypass parameter from task update and archive operations; workflow safeguards can no longer be bypassed.

---

## v0.1.0-rc.8 — 2026-08-21

## 新增

- 更新或归档任务时的 Git 工作区洁净性检查。

## Added

- Git-cleanliness checks when updating or archiving tasks.

## 修改

- `modified_files` 现在会与 Git 提交历史核对。

## Changed

- `modified_files` is now validated against Git commit history.

## 文档

- 优化 README 上手体验。

## Documentation

- Refreshed the README onboarding experience.

---

## v0.1.0-rc.6 — 2026-08-19

## 新增

- `trellis_task_update` 工具：更新任务状态并推进经校验的工作流阶段。

## Added

- The `trellis_task_update` tool for updating task status and advancing validated workflow stages.

---

## v0.1.0-rc.5 — 2026-08-19

## 修复

- 强制执行严格的会话级任务隔离，移除全局黑板回退，防止任务上下文跨会话泄漏。

## Fixed

- Enforced strict per-session task isolation and removed the global blackboard fallback to prevent task context from leaking across sessions.

---

## v0.1.0-rc.4 — 2026-08-18

## 性能

- 并行化看板任务 I/O，并为已归档任务引入内存缓存。

## Performance

- Parallelized kanban task I/O and introduced in-memory caching for archived tasks.

## 构建

- 修正测试命令，使其在受支持的 Node.js 版本间稳定运行。

## Build

- Fixed the test command to run consistently across supported Node.js versions.

---

## v0.1.0-rc.3 — 2026-08-18

## 新增

- Trellis 任务归档工具 `trellis_task_archive`，迷你看板支持归档树。
- 会话头部迷你看板，支持展开看板浮层。
- 自动化测试、npm 包 tarball 生成与 GitHub 发布工作流。

## Added

- The `trellis_task_archive` tool, with archive-tree support in the mini kanban.
- A session-header mini kanban with an expandable board overlay.
- Automated tests, package tarball generation, and a GitHub release workflow.

## 修复

- 看板徽标点击无响应、看板任务列表恒为空的问题。
- 重启后徽标点击再次无响应（no-summary 死状态）的问题。

## Fixed

- The kanban badge not responding to clicks and the task list always appearing empty.
- The badge becoming unresponsive again after restart (no-summary dead state).

## 改进

- 安装更可靠：提交锁文件、CI 改用 pnpm 安装依赖、移除不存在的 peer 依赖。

## Improved

- More reliable installation: committed the lockfile, switched CI installs to pnpm, and removed an unavailable peer dependency.

## 文档

- 新增 Web UI/看板截图，并将 README 重写为与项目无关的上手指南。

## Documentation

- Added Web UI/kanban screenshots and rewrote the README as a project-agnostic onboarding guide.
