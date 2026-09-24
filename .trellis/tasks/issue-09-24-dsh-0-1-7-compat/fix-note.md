# Issue Fix Note

## 改动摘要
适配 DSH 0.1.7-rc.1 运行时，唯一根因是 `settings` 服务被重写为 Loader 条目驱动：

- `lib/meta.js`：Config 全部字段加 schemastery `.volatile()`（0.1.7 内置，经 `extra("volatile", true)` 实现）；新增 `unwrapVolatile`/`unwrapVolatileConfig` 把解析出的 cosmokit volatile 包装（`{get()}` 对象）还原为纯值，并对 `allowlist`/`skipKeywords` 做数组兜底。
- `lib/settings.js`：`settings.register()`（已删）→ `ctx.settings.configure({ auto: true })` 启用原生表单；live 值回退到 Cordis `fiber.config` 并解包 volatile。
- `lib/index.js`：`system-prompt/assemble` 的 cwd 改从 `ctx.agents.currentInitiator()` 取（0.1.7 `AssembleContext` 无 `agent`），`inject` 增加 `agents`。
- `lib/client.js`：`settingsScope.bind({namespace})`（已废）→ `createSettingsStore(clientCtx)`，经 `ctx.apiRemotes.settings` 的 `describe`/`update` 按 Loader 条目 id 读写；inject 换 `settingsScope`→`apiRemotes`；订阅 `settings/document-updated` + 30s 轮询保持表单 live。
- `scripts/install.mjs`：去掉 `--patch-harness` 对 `dsh-host-apiproxy` 的 `WEB_SETTINGS_NAMESPACES` 打补丁（0.1.7 不再需要）。
- `package.json`：版本 → 0.3.5；`@deepseek-ai/dsh-*` → `^0.1.7-rc.1`，`cordis` → `^4.0.4`，`schemastery` → `^3.18.4`，并新增对应 devDependencies。
- `CHANGELOG.md`：新增 v0.3.5 双语条目。

## 根因对应
0.1.0-rc.6 → 0.1.7-rc.1 之间 `dsh-settings` 从 `SettingsProvider.register(ns, schema, options)` 重写为 `SettingsForms`（`configure`/`describe`/`update`/`replace`/`mutate`），命名空间从插件自定义改为 Loader 条目 id、表单由 Config 的 volatile 字段投影、客户端经 `remote.settings` 访问。旧 API 全部失效导致设置面板与只读规划强制静默失效。

## 验证
- 对照活运行时 checkout（`versions/0.1.7-rc.1`）逐一核实事件/服务/类型契约：`agent/pre-step` payload 不变、`dsh-fs` 类型逐字节相同、`Agent.session` 运行时仍在、`settings`/`sandboxPolicy`/`sessions`/`tools`/`webServer` 契约稳定、相关 slot 仍存在。
- 冒烟测试（真实 0.1.7 模块）：`defineTool` 接受插件各工具的嵌套参数/输出 spec（含数组对象、`oneOf`、空参数，均带 `additionalProperties`）；`createUserMessage` 接受面包屑 source（`kind:'trellis'`、`form:'trellis-breadcrumb'`）；`z` volatile schema 解析并解包正确。
- `node --test`：95/95 通过。

## 后续债务
- client 设置面板改为 `remote.settings` 后，底层 host settings 写路径（`settings.update` → `configEditor.edit`）未经真实 Web UI 端到端点击验证（当前 profile 未挂插件）；安装到 0.1.7 profile 后建议手动开设置页确认读值/保存/重启持久化。
- `.trellis/spec/` 的 web-ui 约定文档（目录选择器服务、`settingsScope` 等）仍是旧 API 描述，待随安装验证一并更新。
