# Feature Design: 将插件设置移动到设置页外层

status: approved   # 用户已确认
execution_lane: quick

## 目标与非目标
- **目标**：
  1. 将插件设置注册到 Bundle 级插槽 `plugins.bundle.config`，key 设为 `@banana-peeljj12/dsh-trellis`。
  2. 进入插件详情页时，直接在外层呈现 Trellis 配置表单（白名单、注入步数、只读保护等），无需展开下方的组件列表。
  3. 保留已有的 `plugins.row.config` 注册，兼顾向后兼容性与组件层级访问。
- **非目标**：
  1. 不引入新的第三方依赖或框架。
  2. 不修改 Cordis 后端服务逻辑及配置存储结构。
  3. 不做冗余的 Tab 标签页分割（当前 6 项设置在单页下清晰紧凑）。

## 方案设计
### 1. 挂载点与插槽规范
根据 DSH 0.1.7+ 的插件插槽规范：
- `plugins.bundle.config`:
  - 触发时机：进入插件管理器详情页（Bundle 视图）。
  - 注册 key：Bundle 的 package name，即 `@banana-peeljj12/dsh-trellis`。
  - 传入 props：包含 `{ view: 'page' }`，以及通过 `inject` 注入的表单控制器方法。
- `plugins.row.config`:
  - 触发时机：展开「包含的组件」列表中的组件行。
  - 注册 key：`<package name>#<entry id>`，即 `@banana-peeljj12/dsh-trellis#trellis-workflow`。
  - 保持保留，保证双入口均可访问。

### 2. 代码实现细节 (`lib/client.js`)
1. 声明 Bundle 级别 key：
   ```js
   const BUNDLE_CONFIG_KEY = '@banana-peeljj12/dsh-trellis';
   ```
2. 注册 `plugins.bundle.config`：
   ```js
   ctx.slots.inject('plugins.bundle.config', () =>
     ctx.slots.register(
       {
         name: 'plugins.bundle.config',
         key: BUNDLE_CONFIG_KEY,
         locale: LOCALE_NS,
         inject: () => controller.inject(),
       },
       TrellisConfigCard,
     ),
   );
   ```
3. 组件 `TrellisConfigCard` 渲染逻辑对齐：
   - 现有的 `TrellisConfigCard` 已支持 `props.view === 'summary'` 时输出简要描述，而在 `props.view === 'page'` 或普通展开时渲染完整的 `SettingsForm`。
   - 两个插槽共用同一个 `controller` 实例与 `controller.inject()` 状态，共享一份表单草稿与保存逻辑，无状态分裂。

### 3. 数据流
```text
DSH Web Plugins 页面 (打开 @banana-peeljj12/dsh-trellis 详情)
  │
  ├─► 查询 slots: 'plugins.bundle.config' (key: '@banana-peeljj12/dsh-trellis')
  │     └─► 渲染 TrellisConfigCard (view: 'page')
  │           └─► 绑定 TrellisConfigController 状态 (与 configForms 同步)
  │                 └─► 用户直接在外层修改、测试浏览目录、保存
  │
  └─► 下方「包含的组件」列表
        └─► 展开 trellis-workflow -> 查询 'plugins.row.config' -> 同样可用
```

## 验证计划
1. **静态与语法检查**：
   运行 `node --check lib/client.js`，确保脚本无语法错误。
2. **自动化测试**：
   运行 `npm test`，确保既有单元测试全部绿灯通过。
3. **交互验证（人工体验/UI观察）**：
   - 打开 DSH Web 界面中的「设置 -> 插件 -> @banana-peeljj12/dsh-trellis」。
   - 确认外层（标题与图标下方、组件列表上方）直接展现 Trellis 配置表单。
   - 修改白名单等配置项，测试保存与生效行为。

## 风险与回滚
- **风险**：低。仅在前端注册了一个新的安全插槽，且通过 `ctx.slots.inject` 防御性包装。
- **回滚策略**：直接 Git 还原 `lib/client.js` 改动即可。

## 人审检查点
- [x] 方案获用户明确确认后，更新 `status: approved` 并切换任务状态为 `in_progress` 进入实现。
