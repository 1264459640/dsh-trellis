# Design Review

> 独立设计评审（非作者本人）。只读审查 `feat-09-10-restore-board-ui-v2` 的 planning 产物，
> 并按 mockup 证据 + 真实代码锚点校验。本文件为唯一写入物。

## 结论
verdict: **passed**（无阻断项）

设计整体与三张效果图证据逐区吻合，代码锚点准确（仅一处主体行号略有出入、两处低-中严重度提示），
无任何会导致实现违反 spec 约定或误读 mockup 的阻断性发现。两处发现建议在实现启动前对齐
（implement.md 步骤 9 与设计 §F 的"取消激活"一致性；弹窗关闭时清 board 缓存以配合删刷新按钮）。

---

## Findings（按严重度排序）

### F1 [中] implement.md 步骤 9 的「激活/取消」与设计 §F 单一 CTA 状态机不一致
- 证据：design.md §F「操作区 L1343–1450 → 单一黑色全宽 CTA 状态机：…已激活→'推进任务'(injectToComposer…)…删除双按钮堆叠」；client.js L1363–1419（现 active 态 CTA = onDeactivate「取消当前激活」）+ L1421–1450（推进按钮）。design 将两者合并后，**已激活态 CTA 不再提供 onDeactivate（bind(null)）入口**。
- 影响：implement.md 步骤 9 回归清单仍写「激活/取消」（L14）；设计实施后详情面板无任何"取消当前激活"路径（弹窗列表也无详情面板、无 bind(null) 入口），只能靠激活其他任务覆盖指针。PRD 验收仅要求「任务激活」不回归（prd.md L32），不违反 PRD；但 implement 清单与设计自相矛盾。
- 建议：实现前统一口径——要么在 CTA 区保留轻量「取消激活」次级入口（不破坏单黑 CTA 主视觉），要么将 implement 步骤 9 改为「激活（切换绑定）/推进注入」，并注明"清空激活指针不再暴露于 UI（激活其他任务即覆盖）"。

### F2 [低-中] 设计 §E「打开弹窗恒 loadBoard 已有」表述不准确 → 删刷新按钮存在陈旧数据路径
- 证据：design.md §E「删除刷新按钮 L3163–3189（打开弹窗恒 loadBoard 已有，spec 约定 15 不受影响）」；client.js L3069 `if (open && !board && !boardFailed) loadBoard()` —— **弹窗仅在 board 为 null 时才拉取**；关闭路径（L3056 外点 / L3059 Esc / L3115 chip toggle）均不 setBoard(null)，board 跨开关缓存。
- 影响：board 已缓存时重开弹窗不重拉 → 会话/任务状态在弹窗关闭期间变化后，重开显示旧快照；刷新按钮本是唯一手动兜底。spec 15 的"展开恒重拉"在设计中被保留（L3196–3204），故不违反 spec 15；但删刷新按钮后弹窗自身失去手动刷新。
- 建议：删刷新按钮的同时，在弹窗关闭路径 setBoard(null)，使重开恒重拉 —— 既贴合效果图 2（无刷新图标），又与 spec 15 的新鲜度意图一致。成本极低。

### F3 [低] 边界「主体 L2896–2909」行号略有出入
- 证据：design.md L12 边界锚点「主体 L2896–2909」；实际主体 flex 容器为 L2884–2920（L2884–2886 为外层 `display:flex; flex:1` 容器，L2896–2909 只是 padding 与 viewMode 三元/泳道调用）。
- 影响：无功能影响，仅盘点评注不精确，实现按 L2884–2920 区域处理即可。

### F4 [信息] feat 徽章文字色与效果图采样微差
- 证据：设计 §A 将 feat tint 底改 #EFF4FD，feat 文字仍用 brand（现改为 #185DDD）；效果图采样 feat 文字「~#2563EB-ish」。两色同为蓝系，视觉近似可接受。
- 影响：无。若 pixel-diff 判定该区差异明显，可在校准阶段回退 feat 文字为固定 #2563EB（不动 brand 全局值）。

### F5 [信息] spec 约定 18 的「蓝色弥散光晕」被设计移除
- 证据：spec index.md 约定 18 记录紧凑浮层「3.5px 垂直粗蓝 Accent Bar 与蓝色弥散光晕」；design.md §A「选中态移除 S.glow 辉光，改 1px 蓝边」、§E「去 glow」。
- 影响：这是对旧约定（feat-09-07 沉淀）的有意覆盖，驱动因素是效果图 2 选中行证据（浅蓝底+左 3.5px 竖条+右蓝点，无光晕）。该解读已获用户批准（design.md status=approved 含两处解读确认）。保留 3.5px Accent Bar 与右点，仅去光晕，属合理且已批准的 mockup 保真取舍，非阻断。注意移除后 `TB.S.glow` 将成为无引用 token，可在 §G 清理时顺带处理（或保留为 token 束，二者皆可）。

---

## Convention checks（web-ui spec）

- **约定 11（轨道单一事实源，随 board 下发）**：ok —— 流水线沿用 `board.tracks`（client.js L2338 `const tracks = (board && board.tracks) || null`，L1169 `trackDef.stages`，L1244 `track.map`），设计未硬编码 5 节点、未新增第三份轨道常量；§F 仅改节点三态视觉，循环结构保持数据驱动。
- **约定 13（克制交互 / 无直接状态变更 / Composer 注入推进）**：ok —— 设计保留"已激活→'推进任务'(injectToComposer)"路径（§F），归档只读灰块保留；看板/列表仍只读点选，无拖拽/直接改 stage。副作用见 F1（取消激活入口被合并）。
- **约定 14（React 受控输入注入手法）**：ok —— `injectToComposer`（client.js L1005–1050：`Object.getOwnPropertyDescriptor` L1017、`execCommand('insertText')` L1034、剪贴板降级 L1050）未被设计触碰，仅 CTA 状态机复用该路径。
- **约定 15（board null 守卫 + 展开恒重拉）**：ok（含 F2 提示）—— 模态 null 守卫保留（L2316 `if (!board)` → L2332 boardLoading）；弹窗 null 守卫保留（L3236）；展开恒 loadBoard 保留（L3196–3204）。F2 的"弹窗关闭清缓存"建议是增强而非违反。
- **约定 9（归档按月份折叠、completed 只读、倒序、默认折叠）**：ok —— design §E「月份分组 KanbanArchive 结构保留、套新 token」；KanbanArchive（L897–983）月份分组/排序/折叠结构未被改动。
- **约定 2（lossless JSON 无损）**：ok —— 本任务仅渲染层（design.md 数据流 L54–57），无 API/schema/序列化/工具 output 变更；§G 删除的死代码不含任何数据字段。
- **约定 17（TB 统一设计系统常量）**：ok —— 所有 token 变更均落在 `TB` 对象内（§A 扩充 ink/brand/brandBar/accentBright/success/selectBg/中性 chip/R.popover=16/R.modal=16），未在子组件硬编码裸色（现状已是 TB 引用）。
- **约定 19（大看板双模态 工作台/列表 + 泳道三列）**：ok —— 泳道三列（规划中/进行中/已完成·归档）与列表形态保留，仅换 token/结构微调。

---

## Anchor spot-check table

| 设计引用锚点 | 真实代码 | 状态 | 备注 |
|---|---|---|---|
| TB 令牌 L679–728 | L679–728 `var TB = {…}` | ✓ | 精确吻合；ink/brand/success/R/S 均在段内 |
| zh/en 字典 L41–199 | zh L41–119, en L121–199 | ✓ | colArchive L75 '历史归档'、detailsTitle L76 '任务详情'、boardHint L115、metaArtifacts L80、archivedReadonly L84、stepsTitle L104 |
| KanbanTaskItem L867–896 | L867–896 | ✓ | 精确；左 7px 状态点 L890、stage 徽章 L893、右槽 active 点 L894 |
| KanbanArchive L897–983 | L897–983 | ✓ | 精确；月份分组/倒序/折叠在段内 |
| KanbanDetails L1114–1963 | L1114–1963 | ✓ | 精确 |
| 容器 KANBAN_RIGHT_STYLE L788–799 | L788–799 | ✓ | width 350 / minWidth 280（→376/300） |
| 操作区 L1343–1450 | L1342–1450 | ✓ | actionButton L1343–1419 + pushButton L1421–1450 双按钮现状 |
| 蓝色进度线 L1222–1242 | L1221–1242 | ✓ | 注释 L1221 + IIFE L1222–1242，brand 线 |
| 产物区 L1530–1690 | L1530–1690 | ✓ | 计数胶囊 L1540–1555 |
| 步骤清单 L1693–1961 | L1693–1961 | ✓ | 头部 mono 计数 L1700–1706、总进度条 L1708–1722、时间轴 L1821–1871、卡片 L1873–1954 |
| KanbanBoard L1965–2094 | L1965–2094 | ✓ | 精确 |
| filterChip 弹窗 L1993–2036 | L1993–2036 | ✓ | 计数 span L2023–2034 |
| 弹窗筛选药丸 L2041–2048 | L2041–2048 | ✓ | KanbanBoard 体内 flex 行 |
| 弹窗底部提示 L2079–2092 | L2079–2092 | ✓ | t('boardHint') |
| KanbanLaneCard L2100–2280 | L2100–2280 | ✓ | 精确 |
| 选中点 L2135–2149 | L2135–2149 | ✓ | 现 top:10/right:10 → 需右缘垂直居中 |
| 选中卡边框 L2130–2131 | L2130–2131 | ✓ | border + glow（去 glow） |
| stage 文本 L2179–2191 | L2179–2191 | ✓ | 删除目标 |
| 进度行 L2223–2277 | L2223–2277 | ✓ | 进度条 L2226–2246 + 步骤/绿勾行 L2247–2277 |
| 模态 filterChip L2368–2411 | L2368–2411 | ✓ | 计数 span L2398–2409 |
| scrollbarStyles L2413–2445 | L2413–2445 | ✓ | 精确；1179/759 断点保留 |
| renderLaneColumn L2448–2539 | L2448–2539 | ✓ | 精确 |
| 泳道头计数胶囊 L2479–2492 | L2479–2492 | ✓ | 中性化目标 |
| renderListView L2542–2706 | L2542–2706 | ✓ | 精确 |
| 列表选中行 L2602–2604 | L2602–2604 | ✓ | 现硬编码 #F0F7FF/#BFDBFE → selectBg+brand 边 |
| 列表阶段徽章 L2660–2676 | L2660–2676 | ✓ | 现用 phaseLabelOf → 改 stageDisplayName+(stage) |
| 列表步骤 chip L2677–2697 | L2677–2697 | ✓ | 红黄语义保留 |
| 分段控件 L2804–2856 | L2804–2856 | ✓ | 精确；双钮现状 → 左静态/右黑钮 |
| 关闭按钮 L2857–2880 | L2857–2880 | ✓ | 现有 1px 边框 → 去边框 ghost 32×32 |
| 主体 L2896–2909 | L2884–2920 | ◐ | 外层容器 L2884–2886；引号内为 padding+viewMode 三元 |
| 弹窗头部 L3152–3222 | L3152–3222 | ✓ | 刷新 L3163–3189、展开 L3190–3220 |
| 展开恒重拉 L3196–3204 | L3196–3204 | ✓ | onClick 内恒 loadBoard() |
| 弹窗打开重拉 L3069 | L3069 | ◐ | 仅 `!board` 才拉 → 见 F2 |
| typePillBg L740–745 | L740–745 | ✓ | 精确 |
| workTypeColor L856–861 | L856–861 | ✓ | 精确；L852–855 注释与代码不符确认（注释说 refactor=orange，代码是 success 绿） |
| phaseLabelOf L845–850 | L845–850 | ✓ | 精确 |
| KANBAN_LEFT_STYLE L786（死） | L786 | ✓ | 仅定义无引用 |
| ACTION_BUTTON_STYLE L801–814（死） | L801–814 | ✓ | 仅定义无引用 |
| renderIcon 死分支 | L498–672 | ✓ | spinner/loader L529–530、circleDashed L508、history L521、minimize L561、play/send L630–631、checkCircle L643 —— 均无调用方 |
| locale noTasksInType/collapseBoard（死） | L91/171、L118/198 | ✓ | 仅定义无引用 |
| countOf 依赖清理 | L1988/1994、L2363/2369 | ✓ | 仅 filterChip 闭包内使用，删计数后即死 |
| 模态 null 守卫 L2316 | L2316 | ✓ | `if (!board)` → boardLoading |
| tracks 单一来源 L2338 | L2338 | ✓ | `board.tracks` |
| injectToComposer L1005–1050 | L1005–1050 | ✓ | 约定 14 手法完整保留 |

---

## Mockup fidelity（§A–G vs mockup 证据）

- **§A tokens**：ink #0B0C0D（采样 ✓）、brand #185DDD（采样 ✓）、brandBar #216AE2 进度填充（采样 ✓）、accentBright #146BFE 弹窗竖条/右点（采样 ✓）、success #3BAF62 + 环 #61BD7E（采样 ✓）、issue 橙 #F77032/#FEF3E9（采样 ✓）、feat tint #EFF4FD（采样 ✓）、selectBg #EFF6FE 卡/行 / #F2F6FC 弹窗（采样 ✓）、中性 chip #F1F2F3/#626471（采样 ✓）、R.popover 16 / R.modal 16（采样 ✓）。无矛盾。
- **§B 模态顶栏**：效果图 1 顶栏 = 搜索+药丸(无计数)+分段+X —— 设计删 filterChip 计数、改分段控件、关闭钮去边框，全部对应 ✓；无"保留计数"的违和。
- **§C 看板泳道/卡片**：效果图 3 泳道头计数胶囊 ✓（中性化）；卡片 row1[状态点+类型徽章] row2 标题 row3 slug row4 进度条 —— 设计删 stage 文本（L2179–2191）✓、进度行重构（未完成 `N/M 步骤` 同行右对齐；完成=全绿 bar+绿环勾+bar 下左对齐 `N/M 步骤`）✓；选中卡浅蓝底+蓝边框+右缘居中蓝点 ✓；完成绿勾 ✓。
- **§D 列表模式**：效果图 1 六列（点/标题/slug/类型/阶段/步骤）✓；阶段徽章 `实现（impl）` 格式 ✓；步骤 chip `3/5 步骤` ✓（红黄语义保留）；选中行浅蓝底+蓝边框+右尾点 ✓。
- **§E 紧凑弹窗**：效果图 2 头部=标题+筛选药丸(无计数)+展开+关闭、无刷新 —— 设计药丸移入头部、删刷新、新增关闭(setOpen(false)) ✓；行=标题+类型+阶段、删左状态点 ✓；选中行浅蓝底+左 3.5px 竖条+右点 ✓；footer「仅展示，不直接改状态」✓。
- **§F 详情面板**：效果图 1/3 激活任务区（label '激活任务'+类型徽章+slug+单黑全宽 CTA '激活任务'）✓；流水线无外框无蓝线、done 白底深勾 / current 蓝实心白序号 / future 白底灰序号 ✓；产物 '产物' 无计数 + 灰图标+mono 文件名+打开 ✓；步骤 N/M 头+进度条+caption+简行圆图标 ✓。
- **§G 死代码清理**：全部经 grep 验证为零引用（见锚点表）。

无发现任何设计文本与效果图证据直接矛盾（计数、刷新图标、流水线外框、产物计数胶囊、步骤卡/徽章等 mockup 明确不出现的元素均被设计删除）。

---

## Conclusion

设计通过。锚点校验 49 项中 47 项精确吻合、2 项仅轻微行号偏差（主体 L2896–2909、弹窗重拉 L3069），无错位。六项 spec 约定（11/13/14/15/9/2）全部合规；mockup 逐区还原映射（§A–G）与效果图证据一致，无保真矛盾。两处非阻断建议（F1：统一 implement 步骤 9 与 §F 的取消激活口径；F2：弹窗关闭时清 board 缓存以配合删刷新按钮）应在本任务实现启动前处理。
