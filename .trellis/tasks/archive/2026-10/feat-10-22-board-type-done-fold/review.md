# Feature Code Review

status: passed        # passed | blocking

（第二轮：lead 已按首轮 blocking + minor 修复，本表在原发现基础上标注复核结果。）

## Diff 范围
- `lib/client.js`：`TYPE_ICON` + `TypeBadge`（L945-980，含无图标时回退纯文字）；`renderIcon` 新增 `bug`/`refresh` 单色字形（L852-876）；`SectionLabel` 新增 `as` 选项（L1259-1262）；大看板行内类型列改徽标、类型列 56px→**88px**（L2383、L2409）；`KanbanExpandedModal` 的 `doneOpen` / `doneExpanded = doneOpen || q !== ''` / 折叠开关（`type=button` + `aria-expanded` + `aria-controls` + `as:'span'` 标题 + `id/role=group` 内容容器）（L2282-2284、L2326-2332、L2481-2525）。
- `test/client-theme.test.js`：`renderModal` 桩改为「只覆盖显式传入值、其余吃组件初始值」（L278-297）；4 条用例：每类型独立徽标（含 border 中性断言）、无 workType 回退纯文字、默认折叠 + 双向切换、搜索自动展开（L299-352）。
- 越界：`injectSpecIndex` / `SPEC_INDEX_SECTION` / `lib/spec.js` / `test/spec.test.js` / `test/assemble.test.js` / `lib/readonly.js` / `lib/breadcrumb.js` / `lib/meta.js` / `lib/state.js` 等并行任务改动仍未审、未评。

## 发现

| 级别 | 问题 | 文件:行 | 复核状态 |
|------|------|---------|---------|
| blocking（测试假绿灯） | `renderModal` 的 `useState` 桩丢弃组件初始值，「默认折叠」断言的是测试传入的 `false` 而非组件默认值 | test/client-theme.test.js:282-283 | **已修复·已复验**：桩改为 `overrides[idx] === undefined ? init : overrides[idx]`（L282-290）。独立变异 `useState(false)→useState(true)`（默认展开，违反验收 2）→ **34 pass / 1 fail**（命中 `completed group is folded by default and toggles both ways`），假绿灯已消除。 |
| minor（覆盖缺口） | 「再收起」无断言，`setDoneOpen(!doneOpen)→setDoneOpen(true)`（永远收不回来）此前全绿 | test/client-theme.test.js:304-316 | **已修复·已复验**：新增 `collapse.sets === [[1,false]]`（L339-341）。同变异 → **34 pass / 1 fail**。 |
| minor（列宽） | 类型列固定 72px，英文 `Refactor`（≈46px）被省略号截断 | lib/client.js:2383 | **已修复**：列宽 88px（L2383），徽标自身占 32px，文字可用 56px > `Refactor` ≈46px，算术上不再截断；仍只做算术核对，未跑浏览器 en 目视（见"验证证据"末条）。 |
| minor（可访问性） | 搜索态 `aria-expanded` 挂在 `disabled` 按钮上（不可聚焦、语义矛盾） | lib/client.js:2496 | **已修复·已复验**：`disabled` 已移除，探针确认搜索态 `props.disabled === undefined`、按钮可聚焦可点；`doneExpanded = doneOpen \|\| q !== ''` 保证搜索时视觉恒展开。 |
| minor（HTML/ARIA） | `SectionLabel` 渲染 `div` 被塞进 `button`（内容模型不合法）；`aria-expanded` 孤立无 `aria-controls` | lib/client.js:2490-2515 | **已修复·已复验**：按钮内改用 `as:'span'`，探针确认开关子树类型仅 `button/svg/polyline/span`、**无 div**；展开时 `aria-controls='trellis-kanban-done-group'` 且对应容器带 `id` + `role=group` + `aria-label`（等于分组标题），折叠时 `aria-controls` 缺省、内容不渲染（合规写法）。 |
| minor（仍存在·测试缺口） | 上述 a11y 修复本身无断言兜住：删 `aria-controls`、删 `role='group'/aria-label'`、把 `as:'span'` 去掉（div 回到 button 内）三个变异下 `node --test test/client-theme.test.js` 均 **35 pass / 0 fail** | test/client-theme.test.js（缺断言）；lib/client.js:2496、2521-2523 | 建议补一条结构断言：`flat(doneToggle(tree)).every(n => n.type !== 'div')` + 展开态 `toggle.props['aria-controls'] === 内容容器 props.id`。不阻断（属 a11y 属性回归防护，非功能正确性）。 |
| nit（已修复） | `workType` 未知/缺失时渲染空描边胶囊 | lib/client.js:952-955 | **已修复·已复验**：无图标时回退 `span` 纯文字（无 `data-work-type`、无边框），新增用例覆盖；独立变异（取消回退、保留胶囊）→ **34 pass / 1 fail**。 |
| nit（已修复） | 徽标「中性」此前只断言文字色 | test/client-theme.test.js:322-325 | **已修复**：追加 `style.border === '1px solid ' + TB.color.borderStrong`，改成品牌色即红。 |
| nit（新发现） | 搜索态去掉 `disabled` 后，点击标题仍会执行 `setDoneOpen(!doneOpen)`：视觉无变化，但**内存状态被静默翻转**——用户搜索时点两下再清空搜索框，已完成分组会意外展开/收起 | lib/client.js:2501 | 建议 `onClick: () => { if (q !== '') return; setDoneOpen(!doneOpen) }`，语义更诚实；不阻断。 |

Spec 轴：无阻断发现。三类任务渲染 3 个互不相同图标（sparkles/bug/refresh，探针确认徽标 `data-work-type` = feat/issue/refactor）；徽标纯中性（`textSecondary` + `borderStrong`，无新色相，v2 单强调色成立）；默认折叠、标题保留数量、双向点击、`aria-expanded` 与状态一致、搜索自动展开、状态仅内存；紧凑浮层与进行中/规划中分组不变（探针确认全树仅 1 个带 `aria-expanded` 的按钮，另两组仍是非交互 `SectionLabel` + 行）。

Standards 轴：无阻断发现。复用 `renderIcon` / `SectionLabel` / `TB.color` / `TB.R` / `.tw-ghost + .tw-focus`，无硬编码颜色、无不存在 token（`borderStrong`/`textSecondary`/`textMuted`/`R.pill`/`R.row` 均已在 `TB` 定义），11.5px 与该文件既有字号档位一致；`as` 选项、`aria-controls` 都是最小改动，无多余抽象。

## 验证证据

- `node --test test/client-theme.test.js test/client.test.js test/client-portal.test.js` → **tests 52 / pass 52 / fail 0**。
- `npm test` → **tests 198 / pass 198 / fail 0**（无并行任务失败遗留；上一轮出现的 `test/tmp-revert-check.mjs` 已被并行任务删除）。
- 结构探针（`loadClient` 真实默认 hook 渲染，非改仓库文件）：
  - 折叠态：`aria-expanded=false`、`aria-controls=undefined`、内容容器不在 DOM 中；`texts(toggle)` 含「已完成 · 归档」+「1」。
  - 展开态（搜索驱动）：`aria-controls='trellis-kanban-done-group'`、容器 `role=group` + `aria-label` 等于分组标题、内部 1 行；按钮无 `disabled`。
  - 开关子树类型 = `button/svg/polyline/span`，**无 div**（div-in-button 已消除）；`gridTemplateColumns = '14px minmax(0, 1fr) 88px 56px 120px 64px'`。
  - 无 workType 任务：行内徽标数 = 0（回退纯文字）。
- 变异验证（**不改仓库文件**：把 `lib/client.js` 与 `test/client-theme.test.js` 复制到 `%TEMP%\mutre\*`，只对副本做替换后 `node --test`；复核点 `lib/client.js` SHA256 = `E2004632…58CDAB`，前后一致，未被本次复核修改）：
  | 变异 | 结果 | 判定 |
  |------|------|------|
  | baseline | 35 pass / 0 fail | — |
  | `useState(false)→useState(true)`（默认展开，违反验收 2） | **34 pass / 1 fail** | 原 blocking 已转有效 |
  | `setDoneOpen(!doneOpen)→setDoneOpen(true)`（收不回来） | **34 pass / 1 fail** | 已兜住 |
  | 三类共用 `sparkles` 字形 | **34 pass / 1 fail** | 已兜住 |
  | `doneExpanded = doneOpen`（去掉 `\|\| q !== ''`） | **34 pass / 1 fail** | 已兜住 |
  | `aria-expanded` 恒 `false` | 33 pass / 2 fail | 已兜住 |
  | 取消无 workType 回退（仍渲染胶囊） | 34 pass / 1 fail | 已兜住 |
  | 删 `aria-controls` | **35 pass / 0 fail** | **未兜住 → minor** |
  | 删 `role='group'`+`aria-label` | **35 pass / 0 fail** | **未兜住 → minor** |
  | 去掉 `SectionLabel` 的 `as:'span'`（div 回到 button 内） | **35 pass / 0 fail** | **未兜住 → minor** |
- 未做浏览器计算样式/目视验收：en 列宽（88px）与折叠动效仍只经算术与 DOM 结构核对；按 `.trellis/spec/trellis-workflow/web-ui/index.md` 第 24/34 条，如需闭环可用 `scripts/verify-modal-browser.mjs`（opt-in，需 `DSH_BROWSER_TEST_TOOLS`）或用户 GUI 目视一次。

## 结论

verdict: passed

首轮 blocking（测试桩丢弃组件初始值造成的「默认折叠」假绿灯）与 4 条 minor 均已修复并独立复验（变异全部转红）；生产代码行为符合 PRD 与 v2 单强调色约束，全量 198 项测试通过。仅剩 1 条 minor（`aria-controls` / `role=group` / `as:'span'` 三处 a11y 修复无断言兜底）与 2 条 nit（搜索态点击静默翻转 `doneOpen`、en 列宽未做浏览器目视），均不影响功能正确性，不阻断合入。

## 复验后补强（lead，2026-10-22）

上面剩余的 1 minor + 1 nit 已补掉，均经变异验证有效：

| 项 | 处理 | 变异验证 |
|---|---|---|
| minor｜a11y 无断言兜底 | 新增用例 `the done toggle is accessible: phrasing content only, aria-controls wired`：按钮子树不含 `div`、展开时 `aria-controls` 指向带 `id`+`role=group`+`aria-label` 的容器、折叠时无 `aria-controls` | 删 `aria-controls` → 35/1 ✖；去 `as:'span'` → 35/1 ✖；删 `role`+`aria-label` → 35/1 ✖ |
| nit｜搜索态点击静默翻转 `doneOpen` | `onClick` 改为 `if (q !== '') return; setDoneOpen(!doneOpen)`；用例补「搜索态点击 → `sets` 为空」断言 | 删该早退行 → 35/1 ✖ |
| nit｜en 列宽无浏览器目视 | 保留 88px 未变，仍为遗留风险（未跑 `scripts/verify-modal-browser.mjs`，需 `DSH_BROWSER_TEST_TOOLS`） | — |

最终验证：`node --test test/client-theme.test.js` → 36 pass / 0 fail；`npm test` → 199 pass / 0 fail。

