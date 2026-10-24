# Feature PRD: 将插件设置移动到设置页外层

## 背景
用户在 DSH Web UI 的插件详情页查看 `@banana-peeljj12/dsh-trellis` 时，目前的设置卡片注册在组件行级插槽 `plugins.row.config`，导致设置项被折叠在「包含的组件 > trellis-workflow」内部，入口层级较深，操作不便。
用户希望参考 `dsh-claude-style` 等主流插件的交互设计，将设置面板直接移到插件详情页外层（Bundle 级别），使得打开插件即可直接配置白名单、注入步数等核心选项。

## 范围
### In Scope
1. 注册 `plugins.bundle.config` 插槽，绑定 Bundle 包名 `@banana-peeljj12/dsh-trellis`。
2. 将 `TrellisConfigCard` 挂载到 `plugins.bundle.config`，实现设置在插件详情页外层直接展示。
3. 同时保留 `plugins.row.config` 插槽（作为子组件展开时的兜底/兼容显示），保证两处访问均可正常读写与同步。
4. 更新相关文档与注释中的插槽说明。

### Out of Scope
1. 不修改后端 Cordis 插件的配置模型与配置字段定义（`Config` schema / `registerTrellisSettings` 保持完全一致）。
2. 不重构表单项字段语义或新建复杂的 Tab 拆分页（当前 6 项设置直接渲染，精简高效）。

## 验收标准
- [ ] 在 DSH Web 客户端中，`plugins.bundle.config` 插槽成功注册，key 为 `@banana-peeljj12/dsh-trellis`。
- [ ] 打开 `@banana-peeljj12/dsh-trellis` 插件详情页时，外层（标题/图标下方）直接渲染 Trellis 设置表单（包含注入白名单、注入步数、跳过关键词等）。
- [ ] 设置项的读取、修改、重置、浏览选择文件夹、保存与回退均正常工作。
- [ ] 自动化测试全部跑通，无语法错误或运行时异常。

## 约束与风险
- 插槽注册必须使用 `ctx.slots.inject('plugins.bundle.config', ...)` 进行安全注入，避免在插槽未声明时直接 register 抛出异常。
- Bundle 级 key 必须精准匹配 package.json 的 `name` 字段，即 `@banana-peeljj12/dsh-trellis`。

## 相关代码/文档
- `lib/client.js`: 客户端入口与插槽注册逻辑
- `package.json`: 插件包声明信息
- `.trellis/spec/trellis-workflow/web-ui/index.md`: Web UI 扩展与质量门禁规范
