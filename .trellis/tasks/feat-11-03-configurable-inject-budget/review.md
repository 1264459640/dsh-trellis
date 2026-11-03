# Code Review

verdict: pass

独立审查由主会话派发的子代理完成（未参与实现），基线为工作区未提交改动（lib/spec.js、lib/meta.js、lib/index.js、lib/client.js、test/*、README 中英）。审查时的 `node --test`：310 tests / 310 pass / 0 fail；修复后复跑 317 / 317。

## Findings 与处置

| # | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| 1 | minor | `lib/spec.js` `saveProjectDocConfig` | 接受 `configPath` 却未转传给 `evaluateDocConfig`，自定义路径下校验读的是默认 `.trellis/doc.json`，且多一次 fs 读 | **已修**：`evaluateDocConfig(fs, projectRoot, draft, { signal, budget, configPath })` |
| 2 | minor | `lib/client.js` 截断徽章 | 「将截断至 N KB」用配置的单文件上限，而非该文件真实生效的 `entry.limit`；被**剩余合计**截断的文件标签偏大 | **已修**：`files[]` 增加 `limit` / `injectedBytes`，徽章改用 `planned.limit`（旧快照回退配置上限）；新增两条测试 |
| 3 | minor | `lib/spec.js` `usableBudgetOverrides` + `lib/client.js` `docBudgetDraft` | 快照回显**原始** KB 而生效值是夹紧后的：手写 `fileKB:1024`（生效 128KB）会让输入框显示 1024、被自身校验判红并永久禁用保存，输入框与进度条不一致（违背 AC7） | **已修**：回显夹紧后的值（且单文件不超过合计上限），并断言「回显值必须能通过 `parseBudgetDraft`」 |
| 4 | minor | `lib/spec.js` `resolveDocBudget` | 无跨字段约束，`fileKB > totalKB` 会渲染自相矛盾的头部「单文件上限 128KB，正文合计上限 8KB」 | **已修**：`fileBytes = min(fileBytes, totalBytes)`；视图提示补充「单文件上限不会超过合计上限」；新增测试 |
| 5 | minor | `test/helpers/client-theme.js` + 文档视图测试 | `docBudgetDraft` 导出却无人断言，且 harness 把 `useEffect` 打桩为 noop，快照→输入框预填这条路径从未被执行（回归会假绿） | **已修**：新增 `docBudgetDraft` 直接用例（有值/单字段/null/垃圾值）；夹紧回显由服务端测试覆盖同一不变量 |
| 6 | nit | `.trellis/spec/trellis-workflow/task-engine/index.md` | 仍记载已删除的 `MAX_DOC_FILE_BYTES` / `MAX_DOC_TOTAL_BYTES` | **已修**：§7 与「项目文档入口」改为 KB 词表 + 优先级 + 硬顶；`web-ui` spec 新增第 43 条 |
| 7 | nit | `lib/client.js` `DOC_BUDGET_MAX_KB` | 与服务端硬顶常量重复且无同步校验 | **已修（部分）**：新增测试用服务端导出的 `MAX_DOC_*_BUDGET_KB` 对齐客户端边界；客户端仍持有自己的字面量（bundle 不能 import 服务端模块） |
| 8 | nit | `lib/index.js` `SPEC_INDEX_CACHE_CAP` | 键变为 (root, budget) 后同一项目多预算会挤占 8 个槽位 | **接受现状**：TTL 仅 5s、单项目预算种类极少；改容量属独立优化，不在本期范围 |
| 9 | nit | `lib/spec.js` `formatBudgetKB` | `toFixed(1)` 向上取整（1000B → "1.0KB"），标记可能声称注入多于实际 | **已修**：改为向下取整，<1KB 直接以字节呈现，并补测试 |
| 10 | nit | `lib/spec.js` `saveProjectDocConfig` | 草稿带 `budgets` 时是**整对象替换**而非逐字段合并，JSDoc 未说明 | **已修**：JSDoc 明确「缺省=保持磁盘值；出现=整体替换；两项皆空=删键」 |

## Verified（审查确认无误）

- `node --test` 全量绿（审查时 310/310；修复后 317/317）。
- `resolveDocBudget` 优先级、逐字段独立、夹紧、垃圾值回退且不抛错。
- 字节换算只在 `resolveDocBudget`；`MIN_DOC_SLICE_BYTES` 与行边界截断未动；`planDocBudget(entries)` 与旧常量行为逐字节一致。
- 五处一致：snapshot / preview / 真实注入的 header KB 恒等于 `budget.fileMax/totalMax`；`budgetDefaults` 恒等于设置级。
- 非法 `budgets` 不会让 `files` 变无效。
- 保存语义：两项留空删键、只填一项只写该项、仅改 files 既不删也不复活覆盖、未知顶层字段保留。
- 缓存：键为 `root\0fileKB:totalKB`；`invalidateSpecIndex` 前缀匹配删全部预算变体；跨挂载不同预算各自渲染。
- 路由：`budgets` 类型校验 400、`budgetErrors` 形状一致、未新增写路径、trust-fence/allowlist/sandbox 未动。
- 客户端：`setDraft` 全路径保留 budgets、`baseline`/`dirty`/`discard` 正确、`errors.budget` 形状齐全、zh/en 无残留硬编码。
- 向后兼容（AC9）：不配置预算时 header 逐字节复现旧文案。

# Check（trellis-check）

## 检查矩阵

| 维度 | 方式 | 结果 |
|---|---|---|
| 1. 类型检查 | 本包为 ESM JS + 手写 `.d.ts`，无 `type-check` 脚本；`node --check` 逐个校验 `lib/spec.js` / `lib/index.js` / `lib/meta.js` / `lib/client.js` | 4/4 通过 |
| 2. 代码风格 | 仓库无 lint 脚本；沿用既有风格（JSDoc、fail-open、无裸色值，样式只走 `TB.*`） | 人工核对通过 |
| 3. 测试有效性 | 逐条核对新用例是否断言外部行为：均为「传入配置 → 观察渲染文本 / 返回值 / 写盘结果」，未断言内部私有实现；`docBudgetDraft`、徽章 `limit`、夹紧回显、缓存键分别有独立用例；`test/spec.test.js` 原有断言**未改**仍通过（证明向后兼容非靠改断言） | 通过 |
| 4. 单元/集成测试 | `node --test` | 317 tests / 317 pass / 0 fail |
| 5. PRD 验收 | 逐条对照 AC1–AC10（见下） | 10/10 满足 |
| 6. 规范门禁 | `.trellis/spec/trellis-workflow/web-ui/index.md`（座位注册用 `slots.inject`、路由契约、唯一预算实现、缓存失效、settings 投影四处同步）与 `task-engine/index.md`（注入通道、fail-open、KB 词表） | 通过，且两份 spec 已同步新契约 |

## 验收标准核对（PRD AC1–AC10）

| AC | 证据 |
|---|---|
| AC1 设置字段 | `lib/meta.js` 两个 `.volatile()` 数字字段默认 8/32；`test/settings-projection.test.js` 默认值与 `FIELDS` 全等；`test/client.test.js` 断言卡片渲染 `trellis-config-doc-file-budget` / `-doc-total-budget` |
| AC2 设置生效 | 冒烟渲染：设置 16/64 → header「单文件上限 16KB，正文合计上限 64KB」且正文变长 |
| AC3 项目覆盖（手写） | 冒烟渲染：`budgets: {fileKB:4}` + 设置 16/64 → header「4KB / 16KB 合计 64KB」；`test/doc-config.test.js` 覆盖单字段与仅合计 |
| AC4 视图可编辑 | `test/client-doc-config.test.js`「the budget block shows the effective caps…」断言两个 `data-doc-budget` 输入、初值来自快照、空值占位「默认 32」；preview/save 载荷含 budgets（源断言 + 路由测试） |
| AC5 视图校验与留空 | 「an out-of-range budget input blocks the save…」断言 129 → 行内报错 + 保存禁用；`test/doc-config.test.js`「saveProjectDocConfig … drops the key」断言两项留空后 `budgets` 键消失 |
| AC6 夹紧与回退 | `resolveDocBudget` 用例（10240 → 128/512、0/负数/字符串/NaN/Infinity 回退）+ 冒烟「10240 & total 8 → 8/8」 |
| AC7 五处一致 | 快照/预览/注入 header 一致性用例；`limit` 徽章用例；夹紧回显用例（输入框与进度条同值） |
| AC8 缓存正确 | 路由测试：保存后立即生效；两次不同预算挂载各自渲染（键含预算）；仍保留 `invalidateSpecIndex` |
| AC9 兼容 | `test/spec.test.js` 未改断言全绿；`planDocBudget` 默认预算逐字节复现旧文案 |
| AC10 文档 | README.md / README_EN.md 配置表 + doc.json 示例 + 优先级/硬顶/视图编辑说明；两份 spec 已同步 |

## 结论

review 无 blocking，check 六项全通过，AC 10/10 满足，可进入 finish（提交 + 归档）。
