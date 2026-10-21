# Design Review

status: passed
reviewer: 第四轮独立设计审查者（独立子代理）
reviewed_at: 2026-10-20
scope: 第四轮 · 窄范围复核（仅复核 v3 遗留 5 项 N2 / T1 / T2 / T3 / T4 是否真正闭环 + N1 因果措辞与人工验收第 3 条自洽性；不重新全量审查，不引入新议题）

> 依据：`prd.md`（50 行）、`design.md`（200 行，v3）、`task.json`（7 步）与 `lib/client.js` 实物回源核对。
> 口径：本轮只判「上一轮 5 项是否闭环」，闭环=文档间不互斥 + 与源码事实不矛盾 + 下游（task.json / 测试）沿同一口径。

---

## 一、5 项闭环表

| # | v3 遗留项 | 判定 | 证据 | 结论 |
|---|---|---|---|---|
| **N2** | PRD 内「绿色指示点」与 brand 蓝点冲突 | **已修复** | `prd.md:21` 已改为「右槽显示 **brand 蓝色实心点**（`TB.color.brand`，`lib/client.js:840`）+ `title` 提示，不显示激活按钮；**明确不用** `TB.color.success` 绿点（绿色在本项目专指已完成/归档，见 `phaseDotColor` 894）」。全文 grep `绿色/绿点`：**仅** 21 行这一处，且是否定式排除；`prd.md:34`（验收：`active` → brand 蓝点 + `title`）与 design 的 `brandDot`（`design.md:90-94`、`125`）口径一致。回源：`brand` 在 `lib/client.js:840`；`success` 在 `844`，其使用点 `894`（completed 相位点）/`1770`（100% 进度条）/`2129/2138/2159`（已完成卡与对勾）**全部**是「已完成」语义 → 「专指已完成/归档」的排除理由成立 | ✅ 闭环 |
| **T1** | PRD 验收未排除 `bind` 失败分支，与 design 失败态冲突 | **已修复** | `prd.md:36` 现为：「**成功路径**：点击激活后 `selected` 同步跟随，不出现「A 高亮 + B 激活」的双重强调；失败路径（`bind` 静默失败）：`selected` 已切、旧行 brand 点仍在、按钮仍可原地重试，不弹错误提示」。与 `design.md:101-106`（D4 时序）逐句对齐：成功 → `loadBoard()`，`currentTask` 跟上（`design.md:104`）；失败 → 静默、`selected` 已切但 brand 点留旧行、按钮可重试、不弹 toast（`design.md:105`）。回源核验与实现不矛盾：`bind` 无返回值（`lib/client.js:2914-2935`），成功分支才 `loadBoard()/load()`（`2924-2927`），失败 `catch` 空实现并注释 `the user can retry`（`2929-2931`），`finally` 复位 `busy`（`2932`）→ 失败后按钮必可重试；成功时 `loadBoard` 的 `setSelected(prev)` 在 slug 仍存在时保留选中（`2899-2904`），`selected` 与 `currentTask` 必然一致 | ✅ 闭环 |
| **T2** | design 承诺「蓝色弥散光晕」但 D3 钉死 `boxShadow:'none'` | **已修复** | `design.md:99` 已改为「选中态改为『3.5px Accent Bar + 选中底色 + 标题加粗』表达（**不加弥散光晕**：D3 已钉死 `boxShadow:'none'`，与现网 1024 行一致…）」；D3 表 `design.md:69` 仍为恒值 `boxShadow:'none'`，与 `lib/client.js:1024`（现状行 `boxShadow:'none'`）一致。`prd.md:45` 同样为「**不加光晕**」的否定式。两文件 grep `光晕`：design:99 / prd:45 **均为否定式**，无任何"会呈现光晕"的承诺；D3 表也无条件 `boxShadow` 值 | ✅ 闭环 |
| **T3** | 内层主 button 的 `outline:'none'` 抹掉键盘焦点环 | **已修复** | `design.md:74` 已改为「**不写 `outline:'none'`**：会抹掉键盘焦点环（现状 `1017-1026` 无 outline，UA 焦环可见；popover 侧无 `<style>` 通道…）」；`design.md:110-141` DOM 最终形态与 `ACTIVATE_BTN_STYLE` 注释里**无** `outline` 键；`prd.md:45`「不写 `outline:'none'`」；`task.json:39` 验收「内层主 button 无 border、**无 outline:'none'**」。三处口径统一，且与 `lib/client.js:1017-1026`（现状无 outline）行为对齐，焦点环回归 | ✅ 闭环 |
| **T4** | `task.json` steps 口径未随 v3 同步（4 处） | **已修复（4/4）** | ① `task.json:17`：断言改「用带冒号形式 `/activeSessionHint:/g` 计数 === 2」，与 `design.md:165-166`（含"调用点会让裸 key 计数 >2"的解释）一致，且与既有同款写法 `test/client.test.js:112-115`（`'browse:'` 计数 2）同构；② `task.json:61` 已无「selected 蓝灯断言」，改为「无 button 嵌套 / 未激活行有按钮 / selected && !active 行仍有按钮 / active 行无按钮且有 brand 8px 点 / 外层 boxSizing=border-box」五项，与 `design.md:174-178`（B1–B5）逐一对应；③ `task.json:59` 改为「不新增 helper 导出 + `client.KanbanBoard` 直呼 + `node.children` 遍历 + 就地自建 props」，与 `design.md:170-172` 一致，并已核 `test/helpers/client-theme.js:33` 本来就导出 `KanbanBoard` 与 `zh`（无需新导出）；④ `task.json:77-87` 新增 `step-7-spec`（`verification: ai`）回写 `web-ui/index.md` 约定 18，与 `design.md:99`、`prd.md:45` 呼应；约定 18 实物存在（`.trellis/spec/trellis-workflow/web-ui/index.md:123-125`，原文确含「蓝色弥散光晕，行末显示实心聚焦蓝灯」）→ 该回写步骤是必要的，非空转 | ✅ 闭环 |

---

## 二、附带确认（N1 因果措辞 / 人工验收第 3 条）

| 项 | 判定 | 证据与说明 |
|---|---|---|
| **N1 因果改写** | **自洽** | `design.md:64` 现写：`<button>`→`<div>` 会失去 UA 的 `border-box`，`width:100%` + 1px 边框使行宽多出 2px；**修正因果**为 `KANBAN_BODY_STYLE` 自带 `padding:'14px 22px 22px 22px'`（`lib/client.js:942`）吸收这 2px，**不会**产生横向滚动条或裁切；补 `boxSizing` 是为像素对齐。回源：滚动容器的 scrollport 是 padding box（`939-947`，`overflowY:'auto'`），2px 落在 22px 右侧 padding 内 → 不构成 scrollable overflow，结论成立；补 `boxSizing:'border-box'` 后行宽恰为 100%，是正确且必要的加固 |
| **人工验收第 3 条** | **自洽** | `design.md:184`「行宽无溢出（外层 `box-sizing:border-box` 已生效，可在 DevTools 量行 `scrollWidth === clientWidth`）」与 `task.json:72`（step-6 acceptance 同文案）一致；与 N1 的「补 boxSizing 的目的」因果闭环（补了才严格相等），与「padding 吸收 → 无滚动条」不冲突（前者是像素级验收，后者是兜底解释） |

---

## 三、新发现（全部 💡，**不阻塞**）

1. **💡 `prd.md:45` 错字**：「与**网现** 1024 一致」应为「与**现网** 1024 一致」（`design.md:99` 写法正确）。纯笔误，不影响语义，可在下次触碰该文件时顺手改。
2. **💡 `design.md:6-7` 版本头仍是 v3**：本轮 N2/T1/T2/T3/T4 的修订未记入版本说明，正文内容已是最新。建议把首两行升为「v4：按第三轮窄范围复核（N2/T1/T2/T3/T4）修订」，避免后来者按 v3 语义回溯 diff。
3. **💡 N1 的类比引用不构成证据**：`design.md:64` 括注「现网大看板列表行 2479-2503 同构且无滚动条」——该行是 `<button>`（`lib/client.js:2479-2483`），UA 默认 `border-box`，**不会**触发这 2px 问题，因此不是本机制的"同构"样本。「padding 吸收」这一主论据本身独立成立（见上表），建议删掉类比或改写为「大看板列表行是 `<button>`，天然 border-box，故本行需显式补」。
4. **💡 `step-7` 措辞可再精确一格**：`web-ui/index.md:123-125` 的约定 18 原文同时含「**蓝色弥散光晕**」与「行末显示实心聚焦蓝灯」；`task.json:83` 的 acceptance 只点名「行末实心聚焦蓝灯已取消」，未点名划掉「光晕」。实现虽已无光晕（`boxShadow:'none'`），回写时若不删该短语，spec 会留下与实现相反的描述。建议 step-7 验收补一句「同时删除『蓝色弥散光晕』表述」。
5. **💡 `task.json:59` props 清单里的 `tracks` 位置**：`tracks` 实际在 `board.tracks`（`test/helpers/client-theme.js:60`），而 `KanbanBoard` 解构（`lib/client.js:1891`）不含它。作为顶层多余 prop 传入无害，不影响断言，仅提示实现者别去 `props.tracks` 取值。

> 以上 5 条均不改变实现路径与断言口径，无需回到 design 阶段；建议由 lead 在写 step 或 finish 时顺手吸收。

---

## 四、结论

**status: passed。**

v3 遗留的 5 项（N2 / T1 / T2 / T3 / T4）**全部真正闭环**：文档之间不再互斥，且逐条与 `lib/client.js` 源码事实对得上（`brand` 840 / `success` 894 / `bind` 2914-2935 / 行样式 1017-1026 / 弹层宽 914 与 padding 942）。N1 的因果改写与人工验收第 3 条均自洽，无新增 🟡。

**给 lead 的两个流程提醒（非审查结论，不阻塞本 pass）：**
1. `design.md:3` 仍是 `status: draft`、`prd.md` 验收框未勾；按 feat 轨道的人卡 1/2，进入 impl（`status=in_progress`）前需**用户明确确认并把 design 置为 `approved`**，本轮 pass ≠ 实现批准。
2. 派 code review 时按 `design.md:99` 末句点名「约定 18 已修订」，并确认 `step-7-spec` 已执行（否则 finish 门禁会漏 spec 回写）。
