# Feat 09-11 allowlist folder picker — Design

## Task

feat-09-11-allowlist-folder-picker

## Goal

为设置面板注入白名单添加「浏览选择」路径的目录选取能力，复用 DSH 客户端官方目录服务
`ctx.workspaces.pickDirectory()`，把选中的项目根直接写入 allowlist。

## Research (updated after code reading)

1. **调用链可行性**：
   - `lib/client.js` 的 `TrellisSettingsTab` 由 `apply(ctx)` 注册到
     `settings.plugins.tab` slot，owner 配置里 `inject: () => ({ scope })` 目前只传了
     settings scope。DSH 槽位机制通过 `inject` 把服务传给组件 props。
   - 目录服务按 `dsh-cordis-client-runner` 文档以 `ctx.workspaces` 注入（见其
     `workspaces` 键文档：`pickDirectory(): Promise<string | null>`、`listDirectory(path?): Promise<DirectoryListing>`、
     `createDirectory(path, name)`、`openPath(path)` 等方法是官方 surface），官方
     vacuum 包 `dsh-client-ui-directory-picker-native` 正是 `inject: ["slots", "workspaces"]` 后调用
     `ctx.workspaces.pickDirectory()`。
2. **注入约束**：此仓库 `package.json` 的 `dsh.client.inject` 白名单包含
   `@deepseek-ai/dsh-api-remotes`、`@deepseek-ai/dsh-client-runtime`、
   `@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-locale`。
   注意：这份列表是**客户端 bundle 依赖**（require 可用的包），不是服务注入清单；
   `plug["inject"]` 是 cordis 层面的服务注入清单（代码内 `const inject = [...]`）。
   我们需要在 TrellisSettingsTab 的 slot 注册项和插件 `exports.inject` 中加入
   `workspaces`。
3. **归一化规则确认**：`lib/resolve.js#normalizePath` 仅在匹配时做
   反斜杠→正斜杠、盘符小写两步转换，不改写存储值本身。平台默认输出反斜杠
   路径（原生对话框返回 `F:\Projects\FordProject`），因此：
   - 若用户甘愿存储混合风格，匹配不受影响（Host 与 client 端共用 normalizePath）。
   - 为 UI 展示一致性，pick 结果仍作一次轻量归一化（`\` → `/`）后入库。
4. **错误分支**：`pickDirectory()` 返回 `null` 表示用户取消—— silently 退出（无 toast）；
   抛错时在按钮右侧/下方显示错误提示。`dsh-client-connection` 源码确认 `host.pickDirectory`
   属于 loopback 特权方法（PRIVILEGED_METHODS），本插件 Web GUI (127.0.0.1) 天然满足；
   非回环部署（trustedHosts 模式）下该调用会失败，需显示明确错误，引导用户手输路径
   （手动输入框保留）。

## Requirement (requirements check)

- [x] R1 点击「浏览…」按钮调起原生目录选择对话框
- [x] R2 选中后路径追加进 allowlist 列表并持久化
- [x] R3 取消选择不产生任何副作用
- [x] R4 服务不可用时显示可读错误，手输路径功能保留
- [x] R5 选中的路径做 `\` → `/` 归一化后写入 allowlist
- [x] R6 en/zh 语言文案齐全

## Acceptance Criteria

- AC1: 点击「浏览…」 → 原生对话框弹出；选一个目录后立即出现在 allowlist 列表
  且 toast/提示「已保存」。
- AC2: 对话框取消（Esc / 取消按钮）→ allowlist 不变。
- AC3: 非 loopback（trusted-hosts）部署下点击「浏览…」按钮显示错误提示，allowlist 不变，
  手动输入条目依然可用。
- AC4: 选中 `F:\Projects\FordProject` 时 allowlist 中存储 `F:/Projects/FordProject`。
- AC5: Locale 字典 zh / en 双语齐全（`browse`、`browseFailed` 等 key）。

## Out of scope

- 不改 Host 端 allowlist 匹配语义。
- 不新增 Host IPC / RPC（复用 `host.pickDirectory` / `host.listDirectory`）。
- 白名单移除按钮、手输添加功能保持不变。

## File changes

- `lib/client.js`: 主要变更文件 —
  `TrellisSettingsTab` 增加 browse 状态、错误提示与内部 `pickDirectory` 调用；
  `TrellisSettingsTab` 的 slot 注册 `inject` 加入 `workspaces`；
  增加 zh/en 文案 key；
  顶部 `exports.inject` 数组加入 `workspaces`。
- `test/client.test.js`: 结构断言补充（见下）。

## Test strategy

沿用既有 client bundle 结构断言（vm 解析 + 正则）：
- bundle 仍可编译（`vm.compileFunction`）。
- 断言 `pickDirectory` 调用存在且接入 TrellisSettingsTab。
- 断言 zh/en 字典增补 key 存在。
- 断言 `exports.inject` / slot 注册 `inject` 含 `workspaces`。
- 断言 `\` → `/` 归一化正则存在。

## Note

早先把 prd/design 写到过旧 slug（feat-09-07-kanban-ui-redesign）目录——工具 slug
推导绑定会话活动任务时序问题，已重写到正确 slug 目录。两处内容同步，
不影响实现。
