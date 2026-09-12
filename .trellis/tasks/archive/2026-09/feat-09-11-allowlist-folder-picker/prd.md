# PRD — 设置面板白名单支持文件夹选择器

- slug: `feat-09-11-allowlist-folder-picker`
- workType: feat
- date: 2026-09-11

## 背景与问题

插件的 Web 设置面板（插件配置 → Trellis 工作流）中，「注入白名单」目前只能手动输入
项目根路径（文本框 + 添加按钮）。手输绝对路径容易出现：

- 拼写错误 / 大小写不一致（Host 端 `normalizePath` 只做斜杠与盘符归一化，目录名拼写错了匹配不上）；
- 需要在资源管理器里复制路径再粘贴，操作割裂。

DSH 客户端运行时已经提供了官方的目录选择能力（`ctx.workspaces.pickDirectory()` 等），
本任务把这些能力接入设置面板，让用户可以弹出系统「文件夹选择对话框」直接选择项目根。

## 目标

1. 设置面板「注入白名单」区域新增 **浏览…** 按钮：
   - 点击后调用 Host 原生目录选择对话框（Windows 上即资源管理器风格的文件夹选择窗口）；
   - 选中目录后自动填入路径草稿 / 或直接加入白名单（见范围决策），避开手输路径。
2. 添加逻辑复用现有 `write('allowlist', ...)` 通道，不做路径语义变更（Host 端已有归一化与匹配）。
3. 面板视觉与既有风格一致（沿用 TB token / btnStyle）。

## 非目标

- 不做应用内文件浏览器（`listDirectory` Miller 列）——原生对话框不可用时的降级提示即可。
  （理由：设置面板是低频页面，原生对话框在本产品的 loopback 部署下总是可用；
  应用内浏览由 DSH 官方 "directory-picker-browse" 包负责，属于工作台/工作区场景。）
- 不改动 Host 端 allowlist 配置结构、校验或匹配逻辑。
- 不改动其它设置字段（injectStep / skipKeywords / inline / enforceReadonlyPlanning）。

## 方案要点（调研结论）

- 官方调用链：`dsh-client-ui-directory-picker-native` 把 `NativeDirectoryFlow` 注册到
  `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow` 两个 slot；
  组件内直接调 `ctx.workspaces.pickDirectory()`（`inject: ['slots', 'workspaces']`）。
- `pickDirectory(): Promise<string|null>`：返回所选绝对路径，用户取消返回 `null`，失败 reject。
  RPC 方法 `host.pickDirectory` 属于 loopback 优先方法集（本产品 Web GUI 即 127.0.0.1，可用）。
- 本插件 client 已有 `clientCtx`（apply 时捕获的 ctx），可在任意组件运行时取 `ctx.workspaces`。
- 路径格式：Windows 上 `pickDirectory` 返回反斜杠绝对路径；Host 端 `normalizePath` 会统一为
  正斜杠再匹配，所以**原样入库即可**，客户端不做分隔符转换。

## 用户故事

- 作为用户，我在设置面板点击「浏览…」，弹出系统文件夹选择窗口，
  选中 `F:\Projects\FordProject` 后，该路径立即加入注入白名单并显示"已保存"。

## 验收标准

1. 面板渲染一个「浏览…」按钮（位于路径输入框旁或添加按钮旁，i18n zh/en 双语）。
2. 点击「浏览…」→ 弹出原生目录选择对话框；选中后路径写入白名单（去重：已存在则不重复添加）；
   取消 / 关闭对话框则不改动白名单、无报错。
3. `pickDirectory` 调用失败（如 harness 不支持）时：按钮展示失败态文案（i18n），不静默、不崩面板。
4. `node --test` 全绿；`test/client.test.js` 增加结构断言（浏览按钮与 pickDirectory 调用存在）。
5. 行为不回归：原手输路径 + 添加按钮通路保持原样。

## 风险

- `ctx.workspaces` 在极旧 harness 版本上可能不存在 → 代码里做 capability 检测
  （`clientCtx && clientCtx.workspaces && typeof pickDirectory === 'function'`），
  不满足时隐藏浏览按钮或走失败文案。
- 原生对话框被安全策略拒绝（非 loopback 访问）→ 错误经 catch 显示 `pickFailed` 文案。

## 待定决策

- D1：选中路径后「直接加入白名单」还是「回填输入框等用户点添加」？
  建议：直接加入白名单（少一步；输入框保留手输通路）。
