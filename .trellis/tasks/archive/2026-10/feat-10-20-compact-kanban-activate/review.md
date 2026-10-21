# Code Review · v6（复审：F-v5-1 闭环验证）

status: passed
reviewer: 独立复审者（子代理，非实现者）
reviewed_at: 2026-10-21
scope: **极窄复审** —— 只验证 v5 唯一 🟡「F-v5-1（design B4/B6 声称的两条断言实缺）」与 G1 / 💡3 / 💡4 是否闭环；不重审全量实现，不重开已通过项，不提新议题（🟡 以上硬伤除外）
base: v5 结论 blocking（唯一原因 F-v5-1，纯测试补齐，lib/ 零改动）

> **结论先行：F-v5-1 已真正闭环，两条门禁都被验证为「真能红」。**
> 这次不是复刻断言自证：我把**仓库原样的** `test/client-theme.test.js` + `helpers/client-theme.js` + `lib/{client,state}.js` 复制到临时目录，直接对**变异后的** `lib/client.js` 跑**原用例**：
> - **M5**（给 ■ 分支加一行 `onSelect(task.slug);`）→ 原用例红：`stop click must not change the selected row`（31/32）
> - **M8b**（在 ■ 图标旁**另加**一个静态 brand 圆点，图标保留）→ 原用例红：`no static brand status dot in the compact row`（31/32）
> - 另补两类交叉变异：M8（图标换成静态点）被前置断言 `deactivate button must render the stop square` 拦住；M9（`active: false` 使 ■ 消失）报**可读断言** `expected the active row to keep its deactivate button` 而非 TypeError（G1 生效）。
> 我本人未改 `lib/`、`test/`、`prd.md`、`design.md`；临时目录已全部删除（`temp residue: 0`）。
> 注意：审查期间**另一会话**在同一工作区改了 `lib/index.js` / `lib/state.js` / `lib/task.js`（非本任务），故 `git status` 已不只本任务文件 —— 详见 §三末尾的并发改动警告。

---

## 一、闭环表

| 项 | v5 判定 | v6 复核 | 证据（回源） |
|---|---|---|---|
| **F-v5-1①**「■ 不调 `onSelect`」无门禁 | 🟡 | ✅ **闭环** | 用例 `test/client-theme.test.js:245-272`：`:252` 传入 `onSelect: () => { selectedCalls += 1 }`，`:262` 首次点击后断言 `selectedCalls === 0`，`:266` `undefined` event 点击后再次断言 `=== 0`；`:261` 同时守住 `deactivated === 1`、`:260` 守住 `stopPropagation`。代码侧 `lib/client.js:1101-1104` 的 ■ 分支确实只调 `onDeactivate()`。M5 实测变红。 |
| **F-v5-1②**「无静态 brand 圆点」无门禁 | 🟡 | ✅ **闭环** | `test/client-theme.test.js:175-182`：`staticDots(row)` 以 `width === 8 && style.background === TB.color.brand` 判定，并对 `[...selectedNotActive.rows, ...selectedActive.rows]` **全体行**断言命中数 0，失败消息 `no static brand status dot in the compact row`。M8b（图标保留 + 另加静态点）实测精确变红，证明该断言**独立可红**、不是被前置断言顺带拦住。 |
| **G1** ■ 分支裸取 `[0]` | 🟢 | ✅ **闭环** | `test/client-theme.test.js:239-243` 新增 `firstDeactivate(row)`（与 `firstActivate` 对称），用例 `:254`、`:268` 全部改用它；M9 实测报 `expected the active row to keep its deactivate button`，不再抛 TypeError。**残留一处**：`:164` 仍有 `deactivateButtons(activeRow)[0]`，但紧邻 `:163` 已断言 `length === 1`，不会 TypeError（🟢 见 §五）。 |
| **💡3** design 行号漂移 | 💡 | ✅ **已采纳** | `design.md:30` 改为「`KanbanBoard` 已解构（`function KanbanBoard` 首行）… 仅在 `activeTasks.map` 处补传」；`:41` 改为「`KanbanBoard`（`activeTasks.map`）」。grep `1891` / `1957` / `3177` 在 design.md 中**已 0 命中**。其余遗留硬行号见 §四（🟢 文档卫生）。 |
| **💡4** 风险条款「少一个蓝点」 | 💡 | ✅ **已采纳** | `design.md:209` 现为「选中行不再有行末聚焦点，改为恒有一个 ▶/■ 动作按钮」。 |

---

## 二、变异实测（对**仓库原用例**跑变异源码）

**方法**：`%TEMP%\trellis-v5b-repo` 下复制 `lib/client.js`（可变）、`lib/state.js`、`test/client-theme.test.js`、`test/helpers/client-theme.js`、`test/fixtures/theme-palettes.json`，`node --test test/client-theme.test.js`。**不碰工作区文件**，跑完整目录删除。

| 变异 | 改动 | 结果（原用例） | 判定 |
|---|---|---|---|
| 基线 | 未变异副本 | **32/32 pass** | 副本保真，可作对照 |
| **M5** | ■ 分支 `onDeactivate();` 前插入 `onSelect(task.slug);` | **1 fail / 31 pass** — `stop click must not change the selected row` | ✅ **F-v5-1① 真能红** |
| **M8** | `renderIcon('stop', …)` → 静态 8px brand 圆点 | **1 fail** — `deactivate button must render the stop square`（`:166-168` 前置断言先拦） | ✅ 图标缺失仍被守住 |
| **M8b** | 在 ■ 图标**旁另加**静态 brand 圆点（图标保留） | **1 fail** — `no static brand status dot in the compact row` | ✅ **F-v5-1② 独立真能红** |
| **M9** | map 里 `active: activeSlug === task.slug` → `active: false`（■ 永不渲染） | **2 fail** — `active row offers no activate` + `expected the active row to keep its deactivate button`（**无 TypeError**） | ✅ G1 守卫生效 |

> M8 与 M8b 的差别是本次复核的关键：只做 M8（把图标换掉）会被「stop 必须含 rect」提前拦住，无法证明「静态点」断言本身有效；补 M8b 后才真正证明 B4 第二条子句有独立门禁。

---

## 三、工具链（C 项）

| 项 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check lib/client.js` | ✅ OK |
| 全量 | `node --test` | **87 tests / 82 pass / 5 fail**（符合预期口径） |
| 5 个失败根因 | 逐个单跑取错因 | 全部 `ERR_MODULE_NOT_FOUND`：`index`→`@deepseek-ai/schemastery`、`mount`→`@deepseek-ai/cordis`、`native-steps`→`@deepseek-ai/dsh-tools`、`settings-projection`→`@deepseek-ai/schemastery`、`settings`→`@deepseek-ai/schemastery` ⇒ 仓库未 `pnpm install`，**非本任务回归，finish 时不得记为通过** |
| 未用 `git stash` | — | ✅ 按要求，基线沿用 v5 已核实数据；`git status` 全程未变 |
| 目标文件单跑 | `node --test test/client.test.js test/client-theme.test.js` | ✅ **37/37 pass**（v5 增 1 例后的新口径） |

> ⚠️ **并发改动警告（重要，非本任务）**：我在本轮审查进行中，另有会话同一工作区改动了 **`lib/index.js` / `lib/state.js` / `lib/task.js`**（mtime 10:26:45–10:27:00，属另一个任务 `feat-10-21-prune-design-review`：`TRACKS.feat.stages` 移除 `design-review`、`stagePhase` 加兼容分支）。
> - 上面的 **87/82/5 是本任务改动下的口径**（10:24–10:25 测得，含 5 个环境缺包失败）；
> - 并发改动落地后同一命令变成 **87/81/6**，新增失败是 `test/board.test.js: buildBoard passes inline through and keeps archive cache working`（期望旧 `TRACKS`，与 `state.js` 的轨道裁剪冲突），**属并发任务进行中的半成品状态，与本任务 `lib/client.js` 无关**；
> - 本任务两个目标测试文件在并发改动下仍 **37/37 全绿**。
> 建议 lead：提交/归档本任务时用 `modified_files` 仅限 `lib/client.js` + 两个测试文件 + spec 约定 18，**排除**这三个文件与 `package.json`(icon.svg)/`brand`/`icon.svg`。

---

## 四、文档一致性（D 项）

让"右槽恒有一个动作"在四处对齐：

| 断言 | prd.md | design.md | spec 约定 18 | 代码 | 一致 |
|---|---|---|---|---|---|
| 右槽每行恒有且仅有一个动作按钮 | `:36` | `:85`、`:95`、`:129`（DOM 注释） | `:129` | `client.js:1090-1134` | ✅ |
| 已激活 = ■（`t('deactivate')`，调 `onDeactivate()`） | `:21`、`:33-34` | `:91-92`、`:99`、`:109`、`:136` | `:129` | `client.js:1093-1119` | ✅ |
| 未激活 = ▶；selected 不吞按钮 | `:33`、`:36` | `:87-90`、`:98`、`:105-106`、`:146` | `:129` | `client.js:1121-1132` | ✅ |
| **不保留静态状态点** | `:21`、`:36`、`:37` | `:6`、`:81`、`:85`、`:100` | `:131` | 右槽无 `span` 点（M8b 门禁） | ✅ |
| **■ 不调 `onSelect`** | — | `:109`、`:193`（B6） | — | 代码符合 + **已有门禁** | ✅（v5 的 🟡 已消除） |
| 不新增 i18n key、`activeSessionHint` 已删 | `:41` | `:101`、`:164` | — | `client.js:98-100/182-184`；`client.test.js:151` 负向断言 | ✅ |

**遗留硬行号（🟢 文档卫生，不阻塞）**：`1891/1957-1966/3177` 已改符号锚点，但 design.md 仍有若干行号随本轮重构位移未更新，建议下次动该文件时一并换成符号名：

| design.md | 写的行号 | 实际 |
|---|---|---|
| `:14` | `lib/client.js:2924-2927`（bind 成功后 loadBoard+load） | **3041-3042** |
| `:26` | `KanbanTaskItem` 使用点 `1958` | **2071** |
| `:27` | `KanbanLaneCard` 1999 / 调用点 2424 | **2115 / 2540** |
| `:28` | `KanbanArchive` 1039 | **1152** |
| `:65` | `KANBAN_BODY_STYLE` padding `942` | **958** |
| `:83`、`:108` | bind 静默 catch `2929-2931` | **3045-3047** |
| `:110` | `setSelected` 保留 prev `2899-2904` | **3015-3020** |
| `:162` | bind POST `2917-2921` | **3033-3037** |
| `:173` | popover 宽 `914` | **930** |
| `:213` | `KanbanLaneCard` 2429 / 2000 | **2545 / 2115** |

> 行为事实均未变（已逐条回源核对），只是编号漂移；不影响实现与验收。

---

## 五、剩余非阻塞项

| 编号 | 级别 | 位置 | 内容 | 建议 |
|---|---|---|---|---|
| **H1** | 🟢 | `test/client-theme.test.js:164` | 唯一残留裸取 `deactivateButtons(activeRow)[0]`；`:163` 已断言 `length === 1` 故安全 | 可换 `firstDeactivate(activeRow)` 统一风格，纯一致性 |
| **H2** | 🟢 | `.trellis/tasks/feat-10-20-compact-kanban-activate/.dsh-ops-update-*.lock`（0 字节） | spec 目录下的同类锁已清干净，但任务目录里仍残留 1 个 | 提交前删除（否则会被 `git add .trellis/tasks/...` 带进版本库） |
| **H3** | 💡 | `design.md` 多处 | §四列的硬行号漂移 | 下次编辑该文件时改符号锚点 |
| **H4** | 💡 | v5 的 💡1（stop 图标 5.5px 略像复选框）、💡2（`onActivate/onDeactivate` 无默认值）、G2（未断言每行按钮数 === 2） | 均未采纳，属可选改进 | 保持现状可接受；如需更「实心」的 ■ 再按 v5 💡1 调 `rect` |

---

## 六、结论

- **status: passed** —— v5 的唯一 🟡 F-v5-1 两条门禁均以「对仓库原用例跑变异源码」的方式验证为**真能红**（M5 / M8b），G1 守卫实测把 TypeError 换成可读断言（M9），💡3 / 💡4 文档改动已落实。
- 无新增 🟡 及以上问题；剩余 4 项均为 🟢/💡（H1 风格、H2 待删锁文件、H3 行号漂移、H4 可选调优）。
- 全量 87/82/5，5 个失败为环境缺包（`@deepseek-ai/{schemastery,cordis,dsh-tools}`），**不可记为通过**。
- 放行：可进入 finish / 归档；提交前请先删掉 H2 的锁文件，并把 `package.json`（`icon.svg`）/ `brand/` / `icon.svg` 这些**非本任务改动**排除在提交或归档范围之外。

---

## 附录 · 历史轮次记录（v5 及之前，原文保留）

# Code Review · v5 增量（取消激活：■ 停止按钮）

status: blocking
reviewer: 独立代码审查者（子代理，非实现者）
reviewed_at: 2026-10-21（Asia/Shanghai）
scope: **v5 增量审查** —— 只审本轮 delta（右槽由「active ? 静态 brand 点 : ▶」改为「active ? ■ : ▶」、`case 'stop'`、`onDeactivate` 透传、删除 `activeSessionHint`、测试与文档同步）；不重审已 passed 的历史项
base: 上一轮结论 passed（F1–F3 闭环）；历史章节保留在文末附录

> **结论先行**：实现代码（`lib/client.js`）**无 🔴 / 🟡** —— 激活↔取消激活链路、图标契约、busy 禁用、i18n 清理、爆炸半径全部回源核实通过；
> M1/M2/M3/M4/M6/M7 六个变异全部精确变红，说明本轮新增门禁是真的。
> **但** `design.md` 验证计划 B4/B6 声称覆盖的两条断言实际不存在（「不调 onSelect」「无静态 brand 圆点」），
> 变异 M5/M8 证明这两条契约目前**无门禁**——这是本轮唯一 🟡（F-v5-1），补约 4 行断言即可，**不需要改 `lib/`**。

---

## 一、v5 闭环表（按派单 A–D 逐项）

| 项 | 结论 | 证据（文件:行号） |
|---|---|---|
| **A1 ■ 点击链真能清空绑定** | ✅ 链路通 | UI `client.js:1103-1106`（`stopPropagation` → `onDeactivate()`）→ popover `client.js:3308`（`onDeactivate: () => bind(null)`）→ `bind` `client.js:3030-3036`（POST `/trellis-workflow/api/bind`，body `{ sessionId, taskSlug }`，null 序列化为 `"taskSlug":null`）→ 宿主 `lib/index.js:955`（非 string ⇒ `taskSlug = null`）→ `lib/index.js:976-978`（`unbindTaskPointer`）→ `lib/task.js:669-673` → `writePointerFile(null)` `lib/task.js:483-494`（`current_task = null`，其余平台字段整份保留）。**字段无遗漏**：路由只认 `sessionId` + `taskSlug`，两者都由客户端显式带上 |
| **A2 ■ 不调 onSelect 会不会让选中行跳走** | ✅ 不会 | `loadBoard` 的 `setSelected`（`client.js:3015-3020`）第一分支即 `if (prev && tasks.some(t => t.slug === prev)) return prev` —— 取消绑定只把 `currentTask` 置 null，`prev` 仍在列表 ⇒ **选中行原地不动**；只有该任务从列表消失才回退 |
| **A3 stop 图标可见性 / 是否像复选框** | ✅ 可用（💡1 可选调优） | `client.js:814-818`：`rect x6 y6 w12 h12 rx2.5` + `size:11` + `strokeWidth:2.5` ⇒ 实绘约 5.5px 圆角方框、描边约 1.15px、内孔约 3.2px（按 `viewBox 24` 换算）。在 20×20 按钮 / 24×24 槽内**可见，且与 ▶（约 6×7px）视觉重量相当**。空心方框确实处在「■/停止」与「复选框」的歧义边缘，但 `title` + `aria-label` 已消歧，且 Lucide 系 `square`(stop) 就是这个画法 → **不判缺陷** |
| **A4 两分支样式一致性（行高抖动）** | ✅ 完全一致 | `client.js:1093-1110` 与 `:1113-1132`：两分支按钮均 `width:20/height:20/padding:0/background:'transparent'/border:'none'/color:brand/opacity:busy?0.5:1/cursor:busy?'not-allowed':'pointer'`；外层右槽固定 `24×24`（`:1086`）⇒ 按钮盒尺寸恒定，仅 glyph 尺寸不同（11 vs 12），**不会抖动** |
| **A5 删除 activeSessionHint 无遗漏引用** | ✅ 干净 | 全仓 `activeSessionHint` 仅命中 `test/client.test.js:151` 的 `doesNotMatch`（负向断言）；`git diff lib/client.js` 中该 key 的增删**净变化为 0**（v4 加、v5 删）故 diff 不出现。`deactivate`：zh `client.js:100`「取消当前激活」/ en `client.js:184`「Clear active for this session」，详情抽屉 `:1705` 复用同一 key，语义一致 |
| **A6 爆炸半径** | ✅ 未外溢 | `git diff` 仅三块：`case 'play'`/`case 'stop'`（`:802-818`）、`KanbanTaskItem`（`:1023-1136`）、map 透传（`:2071-2081`）。`KanbanTaskItem` 全库单点使用（`:2071`）、`KanbanBoard` 单点渲染（`:3293`）；`KanbanArchive`/`KanbanLaneCard`/大看板/详情抽屉/`bind` 均未触碰。`package.json` 的 diff 只有 `icon.svg`（上一会话遗留，非本任务） |
| **C 工具链** | ✅ | `node --check lib/client.js` OK；`node --test` = **87 tests / 82 pass / 5 fail**，5 个失败与基线集合完全一致，且全部是 `ERR_MODULE_NOT_FOUND`：`index`→`@deepseek-ai/schemastery`、`mount`→`@deepseek-ai/cordis`、`native-steps`→`@deepseek-ai/dsh-tools`、`settings-projection`→`@deepseek-ai/schemastery`、`settings`→`@deepseek-ai/schemastery`（仓库未 `pnpm install`）⇒ **非本任务回归，不可记为通过** |
| **D 文档一致性** | ✅ 三处一致（细节见 §五） | `prd.md:20-21/33-36/41`、`design.md:6/81-112/129-155/163-164/188-193`、`spec…/web-ui/index.md:126-131` 均表述「右槽恒有一个动作、不保留静态点、■ = 取消激活」，与代码一一对应；仅 3 处**行号漂移**（💡3） |

---

## 二、变异实验结果（B 项，内存注入，未落盘）

**方法**：用 `test/helpers/client-theme.js` 的 `loadClient(source)` 注入篡改后的源码字符串，逐条复刻仓库**当前**断言（matrix / play+busy / click ▶ / click ■）后执行。
**基线自校准**：未变异源码下 4 组全 PASS，才采信后续的「红」。临时脚本写在 `%TEMP%\trellis-v5-mut`，跑完已删除（`temp cleaned: True`），仓库零新增文件。

| 变异 | 改了什么 | matrix | play+busy | click ▶ | click ■ | 判定 |
|---|---|---|---|---|---|---|
| 基线 | — | PASS | PASS | PASS | PASS | 校准有效 |
| **M1** | 删掉 `onDeactivate();` 调用 | PASS | PASS | PASS | **FAIL**（`deactivate called once (got 0)`） | ✅ 守住 |
| **M2** | `active` 分支改回「静态 span 点」 | **FAIL**（`active offers stop (got 0)`） | PASS | PASS | **FAIL**（`expected stop button`） | ✅ 守住 |
| **M3** | map 里删 `onDeactivate,` | PASS | PASS | PASS | **FAIL**（`onDeactivate is not a function`） | ✅ 守住 |
| **M4** | 删 `renderIcon('stop', …)` | **FAIL**（`stop renders rect`） | PASS | PASS | PASS | ✅ 守住（`client.test.js` 源码断言亦红） |
| **M6** | map 里删 `busy,` | PASS | **FAIL**（`idle disabled (got undefined)`） | PASS | **FAIL**（busy stop disabled） | ✅ 守住 |
| **M7** | map 里删 `onActivate,` | PASS | PASS | **FAIL**（`onActivate is not a function`） | PASS | ✅ 守住 |
| **M5** | 在 ■ 分支加 `onSelect(task.slug);` | PASS | PASS | PASS | **PASS（无任何红）** | 🟡 **无门禁** → F-v5-1① |
| **M8** | 右槽重新插入静态 brand 圆点 | PASS | PASS | PASS | **PASS（无任何红）** | 🟡 **无门禁** → F-v5-1② |

> M5/M8 的复刻断言集与仓库用例等价（基线已校准），因此「PASS」= 仓库现有用例**不会**发现这两类回归。
> 交叉验证：把设计 B4 声称的「`width:8 && background===brand` 命中数 0」补进复刻后，M8 立刻变红（`static brand dot present: 1`）⇒ 该断言只是**没写**，不是写不出。

---

## 三、Findings

| 编号 | 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| **F-v5-1** | 🟡 | 声明：`design.md:191`（B4）、`design.md:193`（B6）；实缺：`test/client-theme.test.js:139-174`、`:231-253` | **验证计划声称的两条断言不存在**：① B6 要求「■ → `stopPropagation` + `onDeactivate`（**无 `onSelect`**）」，但 `:234-236` 只传了 `onDeactivate` spy，`onSelect` 用默认空函数 ⇒ M5 全绿；② B4 要求「同时断言**不存在**静态 brand 圆点」，但全文件 `brand` / `width: 8` / `dot` **0 命中** ⇒ M8 全绿。两者恰是本轮用户验收反馈的核心行为（「不要静态点」「■ 不该改当前查看行」），却零门禁 | 补约 4 行，`lib/` 不用动：<br>① `:234` 的 overrides 增加 `onSelect: () => { selectedCalls += 1 }`，并在 `:244` 后断言 `assert.equal(selectedCalls, 0, 'stop click must not change the selected row')`；<br>② 在 matrix 用例 `:163` 后加：`assert.equal(flat(activeRow).filter((n) => n.props.style && n.props.style.width === 8 && n.props.style.background === client.TB.color.brand).length, 0, 'no static status dot')` |
| **G1** | 🟢 | `test/client-theme.test.js:237`、`:249` | ■ 分支取按钮仍用裸 `[0]`（▶ 侧已升级为 `firstActivate()` 守卫），按钮消失时报 `Cannot read properties of undefined (reading 'props')` 而非「该行缺少 ■」。M2/M3 实测均抛这个 TypeError | 对称加 `firstDeactivate(row)` 守卫（3 行，与 `firstActivate` 同款） |
| **G2** | 🟢 | `test/client-theme.test.js:145-153` | 「无按钮嵌套」循环断言正确，但**未断言每行恰好 2 个按钮**（1 主 + 1 动作）；目前靠 activate/deactivate 计数间接保证，将来多出第三个按钮不会被发现 | 可选：`assert.equal(rowButtons(row).length, 2)` |
| **💡1** | 💡 | `lib/client.js:814-818`、`:1119` | 空心方框在 5.5px 上略偏「复选框」语义 | 如需更「实心」：改 `rect x7 y7 w10 h10 rx2` + `strokeWidth:3`（外沿约 16 单位、内孔约 1.8px，近实心且不引入 `fill`）——纯视觉调优，不阻塞 |
| **💡2** | 💡 | `lib/client.js:1024` | `onActivate` / `onDeactivate` 未给默认值；将来若有第二个调用点漏传，点击时抛 TypeError 而非静默 | 解构时给 `= () => {}` 兜底（非本任务必需） |
| **💡3** | 💡 | `design.md:30`、`:163` | 行号漂移：文中「`KanbanBoard` 已解构（1891）」「map 1957-1966」现实际为 **2004** / **2071-2081**（本轮重构后位移） | 下轮动 design 时改用符号名引用（「`KanbanBoard` 解构处」「`activeTasks.map`」），避免每次位移都要改文档 |
| **💡4** | 💡 | `design.md:209` | 风险条款仍写「少一个蓝点」，而 v5 是「完全不保留静态点」 | 顺手改为「少一个静态状态点」 |

---

## 四、已核实为非问题（附证据）

1. **两个动作按钮的 `stopPropagation` 都先执行再动作**，且都对 `undefined` event 安全（`client.js:1104-1105`、`:1120-1124`；用例 `:242-247` 覆盖）。
2. **`busy` 共享**导致 ■ 与 ▶ 同时禁用 —— 预期行为（popover 级 `setBusy`，`client.js:3032` 置位、`:3048` finally 复位）。
3. **`bind(null)` 不会误伤别的会话**：按 `sessionId` 定位 `<sessionFileBasename>.json`（`lib/task.js:652-654`、`:670-672`），不触碰 `dsh-session.json`。
4. **取消激活后 Chip 会回到无任务态**：路由尾调用 `refreshSummary`（`lib/index.js:988-989`）重解析并回写缓存；客户端 `bind` 成功后 `loadBoard() + load()`（`client.js:3041-3042`）。
5. **不存在第二个 ■**：右槽只在 `active === true` 时渲染停止键，`active` 来自唯一的 `board.currentTask`（`client.js:2077`）。
6. **`renderIcon` 契约未破坏**：两个新 case 都用 `baseProps`（`fill:'none'`），未传 `fill`；`client.test.js:140-141` 有 `doesNotMatch` 兜底，M4 证明 glyph 缺失会红。
7. **本轮未使用 `git stash`**：5 个失败是 `ERR_MODULE_NOT_FOUND`（缺包），与 `lib/client.js` 无关，无需基线对比；`git status` 全程与开始时一致。附带发现实现者留下了 1 个 `.dsh-ops-update-*.lock`（`.trellis/spec/trellis-workflow/web-ui/` 下），建议删除后提交。

---

## 五、文档一致性核对（D 项）

| 断言 | prd.md | design.md | spec 约定 18 | 代码 | 一致 |
|---|---|---|---|---|---|
| 右槽每行恒有一个动作按钮 | `:36` | `:85`、`:95` | `:129` | `client.js:1086-1134` | ✅ |
| 已激活 = ■ 取消激活（`t('deactivate')`） | `:21`、`:33` | `:91-92`、`:134-139` | `:129` | `client.js:1093-1119` | ✅ |
| 未激活 = ▶ 激活；selected 不吞按钮 | `:33`、`:36` | `:87-95`、`:141-152` | `:129` | `client.js:1113-1132` | ✅ |
| 不保留静态状态点 | `:21`、`:36` | `:6`、`:100` | `:131` | 右槽无 `span` 点 | ✅ |
| 不新增 i18n key、删 `activeSessionHint` | `:41` | `:38`、`:164` | — | `client.js:98-100/182-184`；grep 仅剩负向断言 | ✅ |
| ■ 不调 `onSelect` | — | `:109`、`:193`（B6） | — | 代码符合，**测试未覆盖** | 🟡 F-v5-1① |

---

## 六、结论

- **status: blocking（唯一原因：F-v5-1 🟡，纯测试补齐，`lib/` 零改动）**
- 实现质量：本轮 delta 与 design v5 逐条对齐，**无 🔴**；A1/A2/A4/A5/A6 均回源核实通过；M1–M4/M6/M7 六个变异精确变红，证明新增门禁有效。
- 建议顺序：补 F-v5-1 的两条断言（顺手处理 G1 守卫）→ 复跑 `node --test`（应 87/82/5，失败集合不变）→ 进入 finish；`finish` 时**不得**把 5 项环境失败记为通过。
- 派单更正两处：①「点击 ■ 不调 `onSelect`」目前**不在**测试里（F-v5-1①）；②`onDeactivate` 的实际生效路径只有 popover 调用点 `client.js:3308`（`() => bind(null)`）——`KanbanExpandedModal`（`:3324`）虽也传了 `onDeactivate`，但其不渲染 `KanbanBoard`，`KanbanTaskItem` 全库仅 1 处调用。

---

## 附录 · 历史轮次记录（v4 及之前，原文保留）

# Code Review（复审 · F1/F2/F3 闭环验证）

status: passed（v4 轮次结论）
reviewer: 独立复审者（子代理，非实现者）
reviewed_at: 2026-10-20（Asia/Shanghai）
scope: **复审**——只验证上一轮 `review.md`（status=blocking）留下的 F1（🟡 阻塞）+ F2/F3（🟢）是否闭环；
不复审全量实现，不重开已通过项，不提新议题（🟡 及以上硬伤除外）
base: 上一轮 `review.md`（F1–F5，13 项已验证非问题，结论 blocking 仅因 F1）
核对对象: `test/client-theme.test.js`、`test/client.test.js`、`design.md`、`lib/client.js`（只读，未改动）

> **结论先行**：F1 **已真正闭环**。三条新用例在内存变异下全部按预期变红——
> 删 `busy,` → 只红「glyph+busy」；删 `onActivate,` → 只红「click order」；
> 右槽改 `active || selected` → 三条同时红。旧矩阵用例的鉴别力保留。
> F2 的「删掉调用仍绿」恒真断言已升级为可红的正向断言（删调用/删 path/删 case 均红）。
> F3 的对比度数字经我独立重算，与 `design.md` 完全一致。**未发现 🟡 及以上问题 → passed。**

---

## 一、闭环表（原始 F1–F5）

| 原编号 | 原级别 | 原问题 | 修复内容 | 本轮复核证据 | 状态 |
|---|---|---|---|---|---|
| **F1** | 🟡 阻塞 | `busy` / `onActivate` 透传与「busy 禁用态」零门禁；`onActivate` 为 undefined 时点击抛 TypeError | `test/client-theme.test.js` 新增 2 条用例（`buildBoard` 增第三参 `overrides`）：`compact row activate button renders the play glyph and honours busy`（182-198）、`clicking the activate button selects first, then binds, and stops propagation`（201-222） | 三个变异全部变红（见 §二）；基线全绿；`[0]` 命中失败时错误信息可读性见 §三 | ✅ **闭环** |
| **F2** | 🟢 | `client.test.js` 两条无鉴别力断言：`/function KanbanTaskItem\(/` 改动前即成立；`doesNotMatch(...fill:)` 是「删掉调用即恒真」的负向断言 | 把 `case 'play'` 与 path 用 `/case 'play':[\s\S]{0,200}M7 4\.5v15l13-7\.5-13-7\.5Z/` 绑定；新增 `renderIcon('play', { size: 12, color: TB.color.brand, strokeWidth: 2 })` 正向断言；新增解构断言（含 `busy` / `onActivate`） | 源码断言矩阵：基线 8/8 绿；删 path → 红；删调用 → 红；删整个 `case 'play'` → 2 红（见 §五） | ✅ **闭环** |
| **F3** | 🟢 | 「三主题下 brand 与行底色 ≥4.27:1」只对未选中行底成立，最坏样本是选中行底 3.60:1 | `design.md:56` 改为实测值：未选中行底 4.23 / dark 4.39 / **选中行底 3.60**，并写明 ≥3:1 非文本图形阈值 + `brandText` 后备方案 | 用同一 `loadClient` + `fixtures/theme-palettes.json` 独立重算：light surface **4.23**、light selectBgPop **3.60**、dark selectBgPop **4.39**、fallback selectBgPop **5.31**；`brandText`(light) vs selectBgPop = **8.09**。与 design 数字逐位一致 | ✅ **闭环** |
| F4 | 💡 | 按钮 `color` 与 `renderIcon(color)` 重复 | 未处理（非阻塞，不在本轮修复范围） | — | 维持 💡（不要求） |
| F5 | 💡 | 同名 prop（行内吃 slug / 抽屉侧零参）两套语义 | 未处理（非阻塞） | — | 维持 💡（不要求） |

> F3 补充说明（非问题）：`design.md:56` 的「dark 4.39」实指 **dark 选中行底**，dark 未选中行底为 7.83。
> 表述把 dark 的最坏样本当作唯一数字来写，属**低报**而非高报，不构成风险，也无需返工。

---

## 二、F1 是否真能红：内存变异实验（A 项）

**方法**：用 `test/helpers/client-theme.js` 已导出的 `loadClient(source)` 注入篡改后的源码字符串（不落盘、不改工作区），
逐条复刻三条用例（`matrix` / `NEW glyph+busy` / `NEW click order`）的全部断言并执行。
临时脚本与产物写在系统临时目录 `%TEMP%\trellis-rev-*`，跑完已删除；仓库内未新增任何文件。
**基线自校准**：未变异源码下三条用例全部 PASS，证明复刻断言与实际用例等价（否则下面的"红"不可信）。

| 变异（仅改注入的字符串） | matrix（旧用例） | NEW glyph+busy | NEW click order | 失败信息 | 判定 |
|---|---|---|---|---|---|
| **BASELINE**（原样） | PASS | PASS | PASS | — | 复刻等价 ✅ |
| **M1**：删 `KanbanBoard` map 里的 `busy,`（`lib/client.js:2048`） | PASS | **FAIL** | PASS | `idle disabled=undefined`（busy 段 `disabled` 由 `true` 退化为 `undefined`） | **F1 闭环** ✅ |
| **M2**：删 `onActivate,`（`lib/client.js:2049`） | PASS | PASS | **FAIL** | `onActivate is not a function` | **F1 闭环** ✅ |
| **M3**：右槽 `active ?` → `(active \|\| selected) ?`（`lib/client.js:1086`） | **FAIL** | **FAIL** | **FAIL** | `selected && !active row lost its activate button` / `no activate button on idle row` | 旧矩阵鉴别力保留 ✅ |
| **M4**（F2 侧）：删 `renderIcon('play', …)` 整行调用（`lib/client.js:1117`） | PASS | **FAIL** | PASS | `activate button missing the play svg` | 图标缺失不再静默 ✅ |

要点：
1. **M1 / M2 精确命中**：每条新增断言的失败面与它所守护的透传一一对应，且**互不串扰**（M1 不牵连 click 用例，M2 不牵连 glyph 用例）——
   说明两条用例确实各自守住了 `busy` 与 `onActivate`，而非靠别的断言连带变红。
2. **M3 三连红**：上一轮唯一被证明有鉴别力的变异依然红，`selected` 与 `active` 的解耦没有被新用例弱化。
3. **M4 双保险**：即使只看 theme 用例（渲染树），删掉图标调用也已能红；`client.test.js` 的源码正向断言同时变红（§五）。

---

## 三、新用例自身质量（B 项）

| 检查 | 结论与证据 |
|---|---|
| `Object.assign(props, overrides)` 是否污染共享 `props` 字面量 | ✅ **不污染**。`props` 是 `buildBoard` 内每次调用新建的对象字面量（`100-112`），`Object.assign` 的 target 是该局部对象，函数返回后即弃。实测：`busy:true` 调用后 `props.busy===true`；紧接着无 overrides 的调用 `props.busy===false` 且按钮 `disabled===false`；两个 `props` 引用不同；`tasks` 数组无新增键（`every(t => !('busy' in t))` 为真）；甚至外部事后改写第一次调用的 `props.busy`，第三次调用的结果仍为 `disabled===false` |
| 两条新用例是否相互影响 | ✅ 无。二者只共享只读的 `tasks` 与 `client`；点击用例的 `calls` 是函数内局部数组；glyph 用例的 busy 分支独立 `buildBoard`。用 `node --test --test-name-pattern` 单独跑三条用例（含旧矩阵用例）**各 1/1 通过**，无顺序依赖 |
| `activateButtons(...)[0]` 缺失时的失败可读性 | 🟢 见 `G1`：当按钮整体消失时抛 `TypeError: Cannot read properties of undefined (reading 'props')`，而非「缺少激活按钮」这类可读断言信息。属**可读性**问题，不影响鉴别力（仍会红），不阻塞 |
| 新用例是否覆盖原 F1 三小项 | ✅ 全覆盖：a. busy 禁用态（`disabled` / `opacity 0.5` / `cursor not-allowed`）；b. `stopPropagation` 计数 + `select` 先于 `activate` 的顺序数组 + `undefined` event 不炸；c. `title === zh.activate` + 渲染树内 svg path `d` |

---

## 四、全量测试与基线对比（C 项）

| 场景 | tests | pass | fail | 失败集合 |
|---|---|---|---|---|
| 当前工作区（含本次测试补强） | **86** | **81** | **5** | `index` / `mount` / `native-steps` / `settings-projection` / `settings` |
| 基线（`git stash push lib/client.js test/client-theme.test.js test/client.test.js`） | **82** | **77** | **5** | 同上，**完全一致** |

- 差值为 **+4 tests / +4 pass**，失败集合逐文件一致 → 无回归。
- 失败根因全部是**环境依赖缺失**（`ERR_MODULE_NOT_FOUND`），与本次改动无关：
  `@deepseek-ai/cordis`（`test/mount.test.js`）、`@deepseek-ai/dsh-tools`（`lib/artifact.js`）、`@deepseek-ai/schemastery`（`lib/meta.js`）。
  → 更正上一轮 B11 的措辞：不止 `schemastery`，共缺 3 个包；结论不变（环境问题，非本任务回归，finish 时不得计为"已通过"）。
- 两个目标文件单独跑：**36/36 全绿**。
- `git stash pop` 已执行，`git stash list` 为空，工作区复原（完整性见 §六）。

---

## 五、F2 / F3 落实核对（D 项）

**F2（源码断言矩阵，`test/client.test.js` 的 `compact kanban row exposes an inline activate action`）**

| 变异 | 失败断言 | 判定 |
|---|---|---|
| BASELINE | 8/8 断言全绿 | ✅ |
| 删 `react.createElement('path', { d: 'M7 4.5v15l13-7.5-13-7.5Z' })` | `case play -> path bound` | **红** ✅ |
| 删 `renderIcon('play', { size: 12, color: TB.color.brand, strokeWidth: 2 })` | `renderIcon play call` | **红** ✅ |
| 删整个 `case 'play':` 块 | `case 'play': present` + `case play -> path bound` | **红 ×2** ✅ |

- 新增的 `/const \{ task, t, selected, active, busy, onSelect, onActivate \} = props;/` 还在源码层额外钉住两个 prop 的解构（与 F1 的运行时门禁互为双保险）。
- 遗留：`/function KanbanTaskItem\(/` 与 `doesNotMatch(...fill:)` 仍保留，但已由上述正向断言兜住"删掉即红"，不再是恒真断言——原 F2 的实质问题（图标消失无红灯）已消除。

**F3（`design.md:56`）**：表述已改为「`brand` 对未选中行底 4.23:1、dark 4.39:1，对**选中行底仅 3.60:1** —— 均 ≥ 3:1 非文本图形阈值（WCAG 1.4.11），但低于 4.5:1 正文阈值；因图标属图形非小字号文本，保留现设计；若日后需更稳，改 `TB.color.brandText`（混色版）即可」。数字与我的独立重算逐位一致（§一 F3 行），后备方案也可行（`brandText` 下 8.09:1）。

---

## 六、工作区完整性（我做了什么、没做什么）

- **未修改** `lib/`、`test/`、`design.md` 的任何内容；本轮唯一写入是 `review.md` 本身。
- `lib/client.js` 复核后 sha256 与本轮开始时一致（`b8ad868d…`），确认未被触碰。
- 按 C 项要求执行了 `git stash push` / `git stash pop`。**已知副作用**：本仓库 `core.autocrlf=true` 且无 `.gitattributes`，
  stash/pop 的 checkout 会把两个测试文件的混合行尾（LF/CRLF）统一成 CRLF。
  - `test/client-theme.test.js`：已**按原字节还原**（175 行 CRLF + 47 行 LF，10376 B），sha256 校验回到本轮开始时的 `13f9853f…`，**零差异**。
  - `test/client.test.js`：内容逐字符相同（已比对），行尾现为统一 CRLF；因 Git 在 `autocrlf` 下对 diff 做 EOL 归一，`git diff --numstat` 仍为 `29 0`（仅新增行，无整文件重写），**提交物与审查结论不受影响**。
- 全量 `git status` 与开始时一致（`lib/client.js` / `package.json` / 两个测试文件为 M，`brand/`、`icon.svg`、任务目录为未跟踪），无新增/删除文件。

---

## 七、结论

- **status: passed**
- **F1 闭环**：`busy` / `onActivate` 透传与「busy 禁用态」现由 3 条断言守住，三个针对性变异（M1/M2/M3）全部按预期变红，旧矩阵用例鉴别力未退化（M3 三连红）。
- **F2 闭环**：图标/提示由恒真断言升级为可红的正向断言（渲染树 + 源码双路）。
- **F3 闭环**：design 的对比度数字与独立重算一致，最坏样本（选中行底 3.60:1）已被明确写出并说明取舍。
- **新发现**：仅 1 项 🟢（`G1`，`[0]` 无守卫导致缺按钮时抛 TypeError，可读性；不影响红/绿，不阻塞）。
- **全量测试**：86/81/5，与 stash 基线 82/77/5 的失败集合完全一致，5 项均由未安装的 `@deepseek-ai/cordis|dsh-tools|schemastery` 导致，非本任务回归。
- 可以进入下一步（check / finish）；`finish` 时请勿把上述 5 项环境失败记为"已通过"。

### 新发现（🟢，非阻塞）

| 编号 | 级别 | 位置 | 内容 | 建议 |
|---|---|---|---|---|
| **G1** | 🟢 | `test/client-theme.test.js:182`、`:195`、`:208`、`:220` | `activateButtons(rowOf(...))[0]` 直接取 `[0].props`；当激活按钮整体消失（如 M3/M4 变异）时报 `TypeError: Cannot read properties of undefined (reading 'props')`，而非"该行缺少激活按钮"。已实测复现 | 加一行 `assert.ok(btn, 'selected && !active row must keep its activate button')` 再取 `.props`；纯可读性改进，不改变红绿 |

---

## 八、Check 阶段结果（trellis-check，feat-10-20）

| 项 | 命令/动作 | 结果 |
|---|---|---|
| 语法 | `node --check lib/client.js` | ✅ OK |
| 全量单测 | `node --test` | 86 tests / 81 pass / **5 fail（环境）** |
| 失败集合比对 | 与 `git stash push lib/client.js test/…` 基线（82/77/5）比对 | ✅ 失败集合完全一致：`index` / `mount` / `native-steps` / `settings-projection` / `settings`，根因是未安装 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`（本仓库未 `pnpm install`），**非本任务回归**；不记为通过 |
| 目标文件单跑 | `node --test test/client.test.js test/client-theme.test.js` | ✅ 36/36 |
| 变异校验 | M1 删 `busy,` / M2 删 `onActivate,` / M3 右槽 `active\|\|selected` / M4 删 play 图标 | ✅ 各自精确变红（见第七节） |
| 验收对照 | `prd.md` 9 条验收项 | ✅ 8 条离线可验项全部满足（见下表）；第 9 项「人工浏览器验收」= step-6，待人工 |
| code review 整改 | F1/F2 修复 + F3 数字校正 + G1 可读性 | ✅ G1 已补 `firstActivate()` 守卫（缺按钮时报「expected the row to keep its activate button」而非 TypeError） |

### 验收项逐条对照

| prd 验收 | 证据 |
|---|---|
| 未激活行有图标按钮 + tooltip | `KanbanTaskItem` 右槽 `title: t('activate')`；theme 用例断言 `title === zh.activate`、svg 存在 |
| 点击触发 `onActivate(slug)`、chip 联动 | 点击用例断言调用序 `select → activate`；`bind` 成功即 `loadBoard()+load()` |
| 无嵌套 button、不干扰 popover | 递归断言「按钮子树内无按钮」+ `stopPropagation` 断言 |
| 右槽二选一、恒有其一、selected 不影响 | 三格矩阵用例（selected&&!active / selected&&active / 都否） |
| 至多一个 brand 点 | 右槽仅 `active ? dot : button`，`active` 源自唯一 `board.currentTask` |
| 归档列表只读 | 未触碰 `KanbanArchive`（`git diff` 无相关 hunk） |
| busy 禁用 | busy 用例断言 `disabled / opacity 0.5 / cursor not-allowed` |
| 双语 key + 无硬编码 | `activeSessionHint:` 计数 ===2；`doesNotMatch` 旧硬编码 |
| 新增结构+渲染断言全绿 | 36/36 |

**check 结论：通过（离线门禁）；仅剩 step-6 人工浏览器验收（`scrollWidth===clientWidth`、Console 无 `validateDOMNesting`、双主题可见性、真机点击切换 chip）。**
