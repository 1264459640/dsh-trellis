# Code Review — feat-10-24-bundle-settings-ui

verdict: pass

第二轮复审。范围：`git diff` 的 `lib/client.js`（+76 / −16）与 `test/client.test.js`（+182 / −4）。
第一轮的 P1-1（恒真断言）与 P2-1~P2-4 已在实现侧修复；本轮不重复叙述第一轮已核对的宿主契约，重点回答一个问题：
**修复后的用例是否真的能抓住退化 —— 还存在「改了实现仍全绿」的路径吗？** 答案：绝大部分已覆盖，仍剩 3 条存活变异，
其中 1 条有实质意义（见 P1-1），另 2 条属加固项。

## 验证证据（第二轮实测）

环境与命令（在仓库根目录执行）：

| 命令 | 结果 |
|---|---|
| `node --check lib/client.js` | exit 0 |
| `npm test` | **202 pass / 0 fail / 0 cancelled / 0 skipped**（含 3 条新增行为用例，见 `test/client.test.js:205/235/252`） |

变异测试（**不在仓库里改代码**：把 `lib/` + `test/` 复制到 `%TEMP%\trellis-mut`，逐条写入变异 → 跑
`node --test test/client.test.js` → 从 pristine 还原；仓库全程未被改动，本轮结束时 `git diff --stat` 仍为
`lib/client.js 76` / `test/client.test.js 182`）：

| # | 变异 | 结果 |
|---|---|---|
| M1 | 卡片少渲染一个字段（删掉 `injectSpecIndex` 那段 `BooleanRow`） | **GREEN — 存活** |
| M2 | 删掉 `view === 'summary'` 早返回 | RED |
| M3 | 删掉 row 座位 | RED |
| M4 | bundle 座位改成裸 `ctx.slots.register`（inject 回调返回 undefined） | RED |
| M5 | bundle 座位改用第二个 `TrellisConfigController` 实例 | RED |
| M6 | bundle 座位 `register` 的 `name` 写成 `plugins.row.config` | RED |
| M7 | bundle key 改成 `PKG + '#trellis-workflow'` | RED |
| M8 | `PKG` 与 `package.json` 的 `name` 漂移 | RED |
| M9 | row key 丢掉 `#trellis-workflow` | RED |
| M10 | 同一座位重复注册两次 | **GREEN — 存活** |
| M11 | 删掉 `ctx.effect(() => () => controller.dispose(), ...)`（`lib/client.js:2970`） | **GREEN — 存活** |
| M12 | bundle 座位的 `inject()` face 少一个 `save` | RED |

补充实测：真实的 `TrellisConfigCard({ view:'page' })` 渲染出的 `children.length` 是 **7**，`trellis-config-*` 的
id 恰好是 PRD 点名的六项（allowlist / inject-step / skip-keywords / inline / readonly / spec-index）。这是 P1-1 的依据，
也是 P1-1 修法的验证前提（该修法在副本上实测：基线 GREEN、M1 变 RED）。

## 第三轮收尾确认（本轮）

只确认一件事：上一轮唯一有实质意义的存活变异是否已被新断言抓住。改动仅在 `test/client.test.js`（`lib/` 未动）。

复核过的命令与结果（仓库根目录）：

| 命令 / 操作 | 结果 |
|---|---|
| `node --check lib/client.js` | exit 0 |
| `npm test` | **202 pass / 0 fail** |
| `git diff --stat` | `lib/client.js 76` / `test/client.test.js 207`（`lib/` 与开审时逐字一致） |
| 副本基线 `node --test test/client.test.js` | 8 pass / 0 fail |

独立变异验证（在 `%TEMP%\trellis-mut3` 副本上做，逐条写入 → 跑 `node --test test/client.test.js` → 从 pristine 还原；
仓库文件全程未改）：

| 变异 | 结果 | 失败的用例 |
|---|---|---|
| 删掉 `injectSpecIndex` 那段 `BooleanRow`（整块置 `null`，child 数仍为 7） | **RED — 已抓住** | `the shipped card renders the form for a page and the one-liner for a summary` |
| 同一字段块整段删除（child 数变 6） | **RED — 已抓住** | 同上 |
| 字段 id 改名（`trellis-config-spec-index` → `trellis-config-spec`） | **RED — 已抓住** | 同上 |
| bundle 座位重复注册两次 | **RED — 已抓住** | `config form takes BOTH seats — bundle page (outer) and row — off one controller` |

结论：上一轮 3 条存活变异里，**M1（掉字段）与 M10（重复注册）均已关闭**；仅剩 M11（`lib/client.js:2970` 的
`controller.dispose()` 未接线不被抓），该行非本 diff 引入，按既有技术债保留（P2-2）。

## Findings

### P0（阻断）

无。

### P1（应修）

无。第二轮的 P1-1（六项设置只被 `children.length >= 6` 松散约束）已在 `test/client.test.js` 修复并经本轮独立变异验证关闭 —— 见下方「第三轮收尾确认」与「上轮 findings 关闭核对」最后两行。

### P2（可选）

（第二轮的 P2-1「同一座位重复注册不被抓」已关闭，见「上轮 findings 关闭核对」。P2-3~P2-5 为可选项，P2-2 为保留的既有技术债。）

**P2-2（已知技术债，保留）`controller.dispose()` 未被接线也不被抓（M11 存活）。** 删掉 `lib/client.js:2970` 那行 `ctx.effect` 后测试仍全绿。
该行非本 diff 引入，属既有测试欠账；若要覆盖，`loadBundle` 的 `ctx.effect` stub 里收集 disposer（`effects.push`），
断言 `apply()` 后 disposer 数量 ≥ 2（字典 + config form），成本一行。

**P2-3 两套跑真 bundle 的加载器并存。** 新增的 `loadBundle`（`test/client.test.js:131-203`）与
`test/helpers/client-theme.js#loadClient`（第 10-38 行）职责重叠，长期要双维护（后者已服务
`client-portal.test.js` / `client-theme.test.js`）。建议后续把能力更强的 `loadBundle` 挪进 helpers；
本任务不做也不影响正确性。

**P2-4 期望值仍是测试里的硬编码包名（`test/client.test.js:218-219`）。** M8 证明它能抓 lib 侧漂移，但若
`package.json` 的 `name` 变更，lib 与测试会一起过期而无人报警；可在用例里 `readFileSync('package.json')` 派生期望（2 行）。

**P2-5（维持第一轮判断，信息，非缺陷）** README（`README.md:78` / `README_EN.md:81`）仍写"设置 → 插件 → Trellis 工作流"：
改动后该路径点进去即在外层看到表单，文案变准而非变错，且不在本任务范围。保留 row 座位会使 bundle 页的该行仍出现
Configure 按钮（宿主 `client.js:2415-2421`），属 PRD In Scope 3 的明确要求。

## 上轮 findings 关闭核对

| 上轮条目 | 处理 | 复核结论（证据） |
|---|---|---|
| P1-1 恒真切片断言 + `split('inject: ...')` 计数代理 | 已删，改为行为测试 | **关闭**。原 `test/client.test.js:144-148`、`136-140` 在文件中已不存在。行为用例真调 `apply(ctx)`（`205-234`），stub 的 `register` 对未声明槽位 throw、`inject` 只对已声明槽位回调 —— M4（裸 register）、M5（第二 controller）、M6（座位名写错）实测全 RED，说明它自称要拦的三类退化真的被拦住了。 |
| P2-1 头注释与宿主不符 | 已改（`lib/client.js:9-22`） | **关闭**。新文案"bundle 页与行详情页是互斥视图，两个座位都拿 `view:'page'`，因此不需要额外防线"与宿主一致（bundle 座位唯一渲染点 `view:'page'`；行座位在 `RowDetail` 的 `detailSections` 也是 `view:'page'`）。不再把 `view === 'summary'` 说成防重复机制。 |
| P2-2 `controller` 上方旧注释 | 已改（`lib/client.js:2964-2968`） | **关闭**。已写明"shared by the bundle seat (outer page) and the row seat (component row detail page)"。 |
| P2-3 包名字面量两份 | 已改（`lib/client.js:292/295/298` 的 `PKG` + 两个派生 key） | **关闭**。M7 / M8 / M9 实测 RED，key 形态退化都会被抓住。 |
| P2-4 冗余断言 | 已消除（原 124/131 行随重写消失） | **关闭**。新用例不再重复既有 `test/client.test.js:78` 那两条。 |
| P1-1（第二轮）六项字段只被 `children.length >= 6` 约束 | 已按建议改为 id 集合精确断言 | **关闭**。现为「递归收集 `trellis-config-*` 的 `props.id`，排序后 `deepEqual` 六项」。本轮独立变异（字段块置 `null` / 整块删除 / 字段 id 改名）三种写法**全部 RED**，失败的正是 `the shipped card renders the form for a page and the one-liner for a summary`；还原后 8 pass 全绿。 |
| P2-1（第二轮）同一座位重复注册不被抓 | 已补 `configSeats(...).length === 1`（两座位各一条） | **关闭**。把 bundle 座位注册两次做变异 → `config form takes BOTH seats …` 用例 RED。 |
| P2-5 / P2-6 | 维持现状 | 同 P2-5 说明。 |

## 验收标准对照

| # | 验收标准（prd.md） | 结论 | evidence |
|---|---|---|---|
| 1 | `plugins.bundle.config` 插槽成功注册，key 为 `@banana-peeljj12/dsh-trellis` | 满足 | 代码 `lib/client.js:292/295`（`PKG` + `BUNDLE_CONFIG_KEY`）+ `2974-2984`（`slots.inject` 包裹的 register）；行为用例 `test/client.test.js:218` 断言裸包名精确相等，M7/M8 变异实测 RED。宿主侧契约（keyed/root 只需 key、`renderSlot(..., {entryKey: pkg.name})`、`ledger.bundles.has(pkg.name)`）第一轮已按 `app.asar` 源码核对。 |
| 2 | 打开插件详情页时，外层（标题/图标下方）直接渲染设置表单 | 满足（代码层 + 渲染用例）；真机未验证 | 宿主把 bundle 座位放在 `detailSections` 首位、`RowsSection`（包含的组件）之前，固定 `view:'page'`；卡片用例 `test/client.test.js:282-286` 断言 `view:'page'` → `SettingsForm`、`view:'summary'` → `'desc'`，`:295` 断言未 serve 时不渲染空表单。字段完整性由 id 集合精确断言守护（六项全在，少一个/改名即失败，本轮变异实测 RED）。真机需重启 DSH 后人工确认。 |
| 3 | 设置项的读取、修改、重置、浏览选择文件夹、保存与回退均正常 | 未验证（读写路径零改动） | diff 未触碰 `TrellisConfigController`（425-518）与 `TrellisConfigCard`（555-696）。行为用例断言两座位 face 的 `hooks.trellisConfig` 是**同一对象引用**（`test/client.test.js:228`）、四个 action 齐全（`229-232`，M12 证明这条守护有效）。但用例把 controller 故意停在 unavailable（`configForms.get()` 一旦被调用即 `assert.fail`），`SettingsFormModel` 侧的 save/discard 仍无自动化覆盖（既有欠账）。真机人工确认待办。 |
| 4 | 自动化测试全部跑通，无语法错误或运行时异常 | 满足 | `node --check lib/client.js` exit 0；`npm test` 202 pass / 0 fail。新用例有效性：第二轮 12 条变异 11 条被抓，唯一存活的 `dispose` 欠账见 P2-2；本轮追加的 4 条变异（字段块置 `null` / 整块删除 / 字段 id 改名 / 同一座位注册两次）全部 RED。 |

## 总结

- **结论：pass**（无 P0）。三轮下来的结论一致：实现正确（第一轮按宿主 `app.asar` 源码逐条核对），
  测试判别力经三轮变异验证收敛 —— 第二轮 12 条变异中 11 条被抓，本轮把最后一条有实质意义的存活变异（掉一个配置字段）
  关闭，并顺带关闭重复注册；唯一保留的是 `dispose` 未接线的既有欠账（P2-2，非本 diff 引入）。
- **直接回答 lead 的问题**：P1-1 的原意（"裸 register / 状态分裂 / key 写错不会被发现"）在第二轮就已被行为测试覆盖并实测能拦住；
  第二轮残留的"渲染完整性约束过松"（`>= 6` vs 实际 7）已在第三轮修复并经独立变异复验关闭（字段块置 `null` / 整块删除 /
  字段 id 改名全部 RED）。当前**没有已知的"改了实现仍全绿"路径**，除 P2-2 那一行既有 `dispose` 欠账。
- 未新增风险项：两座位仍共用一个 controller / 一个 `store`，无第二写通道；降级（宿主未声明 bundle 座位）行为已由
  `test/client.test.js:235-250` 显式覆盖（并先自证 stub 的 throw 语义，避免用例为错误原因通过）。
- 三轮审查**均未改动任何代码**：变异与修法验证全部在 `%TEMP%` 下的 `lib/`+`test/` 副本完成（第二轮 `trellis-mut`、第三轮 `trellis-mut3`），
  逐条还原。收尾状态：`git diff --stat` = `lib/client.js 76` / `test/client.test.js 207`，其中 `lib/client.js` 与开审时逐字一致。
---

## trellis-check 验证记录（实现侧自检，阶段门）

对照 `trellis-check` 检查矩阵与 `.trellis/spec/trellis-workflow/web-ui/index.md`：

| 维度 | 检查方式 | 结果 |
|---|---|---|
| 1. 类型检查 | 仓库无 `type-check`/`tsc` 脚本（纯 ESM JS + JSDoc，`lib/types/*.d.ts` 手写） | N/A |
| 2. 代码风格 | 仓库无 `lint` 脚本（CI 只跑 `npm test` + `npm pack`） | N/A |
| 3. 测试有效性 | 三轮共 16 条变异（reviewer 独立执行，副本完成），15 条被抓；`dispose` 未接线属既有欠账（P2-2） | 通过 |
| 4. 单元 / 集成测试 | `node --check lib/client.js` exit 0；`npm test` **202 pass / 0 fail**；`npm pack --dry-run` 通过（51 files） | 通过 |
| 5. PRD 验收标准 | 4/4：①座位注册与 key（用例 + M7/M8 变异）②外层渲染（用例 + 用户真机确认）③读写路径零改动 + face 同一引用断言 + 真机保存确认 ④测试与语法全绿 | 通过 |
| 6. 模块规范门禁 | 约定 1（`slots.inject` 包裹、座位加法注册）、约定 36–38（本次新增：双座位 key 形态 / 静默失效 / 行为测试跑真 `apply()`） | 通过 |

跨模块一致性：本次 diff 只触碰 `lib/client.js` 与 `test/client.test.js`；host 半边
（`lib/index.js`、`meta.js` 的 Config schema、`settings.js`）零改动，故 host 侧质量门与
`plugins.` 路由契约不受影响（`git diff --stat` 可证）。

规范沉淀：新增 `.trellis/spec/trellis-workflow/web-ui/index.md` 第 36–38 条（双座位 key 形态与静默
失效、`slots.inject` 强制、行为测试要跑真 `apply()` 且用 id 集合断言渲染完整性）。

人工验收（用户已确认）：重启 DSH 后「设置 → 插件 → @banana-peeljj12/dsh-trellis」外层直接显示设置
表单，无需展开「包含的组件」；组件行未重复渲染完整表单；保存正常。

## 结论

- **pass**：无 P0 / 无 P1；P2 均为可选项或既有欠账。
- 允许进入 commit / archive 阶段。
