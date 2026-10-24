# Review — feat-10-24-remove-component-settings

## 结论
`passed`（初判 blocking，2 项阻断已全部修复并复验）

独立审查由子代理执行（`a32973e2`，未改任何仓库文件），实现会话按 findings 修复。

## 已修复的阻断问题

1. **CHANGELOG 改写了已发布的 v0.4.5 条目** —— 事实核对：`git tag v0.4.5` = `b907ef3`（2026-10-24 13:35），`npm view` 返回 0.4.5 已发布，而发布产物仍是双座位。原改法会让 `scripts/extract-changelog.mjs v0.4.5` 生成与产物不符的 Release Notes。
   - 修复：v0.4.5 条目恢复为「双座位」史实（仅加一句「该组件座位已在 v0.4.6 移除」）；新增 `## v0.4.6 — 2026-10-24`（`## 修复` / `## Fixed`）记录本次移除；`package.json` 版本 0.4.5 → 0.4.6。

2. **`docs/ref/dsh-0.2.0-rc.2-audit.md` 仍要求保留已删符号** —— 原文 `:110` 写「`ROW_CONFIG_KEY`（裸 id）……必须保持原样」，未来按此实现会把组件座位加回来（违反 spec 36）。
   - 修复：`:110` 改为只约束仍存在的 `entryIdOf` 与现有席位 key，并加 v0.4.6 更新说明；`:147` 席位改为 `plugins.bundle.config`；`:95` 表格改为两个席位并存、注明插件自 v0.4.6 只占外层。

## 已采纳的非阻断建议

3. `test/client.test.js` 源码断言从 `assert.doesNotMatch(source, /plugins\.row\.config'/)`（只挡单引号形态）改为 `/(?:inject|register)\(\s*['"]plugins\.row\.config['"]/`。
4. stub 的 `slots.inject` 现在记录**每一次注入尝试**到 `injected`（声明与否都记），两个用例都断言：必须尝试 `plugins.bundle.config`、**从未尝试** `plugins.row.config` —— 让「不得回退组件座位」成为非空断言，不再依赖 stub 的 `declared` 集合兜底。
5. spec 36 措辞限定为「**座位 key 的**包名只能一处字面量」，并说明 loader `id:` / `package.json name` 属必然存在的同名字面量，避免按 grep 误报。
6. spec 36 关于未声明外层座位的描述改为 `configSeats()` 计数 + `injected` 注入尝试双断言，与实现同词。

## 已验证

- `npm test`：**tests 222 / pass 222 / fail 0**（改动前后各跑，review 修复后再跑）。
- 语法/信封：`vm.Script` 解析 `lib/client.js` 通过（136,653 字节）；`test/client.test.js` 内的 `vm.compileFunction` 即主检查。
- 变异复验（本轮自行执行，改后立即还原）：在 `lib/client.js` 重新插入 `plugins.row.config` 注册 → **3 个用例变红**，其中包含新增的 `injected` 断言与两个单入口行为用例；还原后 `git diff --stat` 与变异前一致、`npm test` 复归 222 全绿。
- review 子代理的独立变异矩阵（仓库零改动，`%TEMP%` 副本）：重加 row 座位 3 红；同变异 + stub 去掉 row 声明只剩 grep 红（印证 spec 38「stub 必须声明该座位」告警承重）；删 `discard` 红；bundle key 加 `#trellis-workflow` 红；register name 写成 row 2 红。
- 残留检查：`ROW_CONFIG_KEY` 仅出现在测试 `doesNotMatch` 与审计文档的更正说明中；座位 key 仍派生自唯一 `const PKG`；`lib/types/index.d.ts`、`cordis.patch.yml` 无座位引用；`README.md:78` / `README_EN.md:81` 本就描述外层单一入口，无需改动。
- 历史产物未触碰：`tasks/archive/2026-10/feat-10-24-bundle-settings-ui/*` 与 CHANGELOG 中 v0.3.x/v0.4.5 段落保留双座位史实（按 task-engine 约定 3，归档产物不可改写）。

## 未覆盖 / 待人工确认

- **真实 GUI 未验证**：本仓库无热重载，静态 Cordis 插件改动需重启 DSH 后才会加载新 bundle；离线测试通过**不等于**用户当前 GUI 里已无组件设置页。需用户重启后打开「插件 → @banana-peeljj12/dsh-trellis」确认只剩外层表单，且组件行详情页无 Trellis 配置。
- 版本号已推至 0.4.6（尚未打 tag / 发布），发布流程属人工决定。
