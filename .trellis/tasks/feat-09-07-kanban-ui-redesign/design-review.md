# Feature Design Review

status: passed   # missing | passed | blocking

## 审查范围

- **设计产物**：`prd.md`（需求/验收）、`design.md`（status: approved，09-07 用户批准进入 impl step-1-tokens）、`implement.md`（7 步拆解）。
- **效果图基线（3 张）**：
  - A `.dsh/generated/dsh-auxiliary-1788771806932-1.png`（紧凑浮层双泳道 Popover）
  - B `.dsh/generated/dsh-auxiliary-1788771689490-1.png`（桌面展开三列大看板）
  - C `.dsh/generated/dsh-auxiliary-1788771726474-1.png`（任务详情面板特写）
- **现状代码（只读）**：`lib/client.js` `#region lib/types/client/trellis-kanban.js`（498–2535）——`KANBAN_*_STYLE` 常量（500–591）、`KanbanTaskItem`（621）、`KanbanArchive`（758）、`KanbanDetails`（975）、`KanbanBoard`（1337）、`KanbanLaneCard`（1469）、`KanbanExpandedModal`（1612）、`TaskChip`（2140）、`HeroTaskChip`（2510）；以及 `lib/board.js`（board 载荷结构）、`lib/state.js` 引用（TRACKS/phase）、中英词典（client.js 60–173）。

## 发现

| 级别 | 问题 | 建议 |
|------|------|------|
| P1-1 | **效果图基线含越界交互元素**：图 A 两泳道底部有「+ Add task」按钮；图 B 各列底部有「Add new task / Drag and drop a task here」虚线拖放区、右下「+ New task」FAB、列头「…」菜单、项目切换器；而 PRD 硬约束为零新增交互。design.md 正文（B/C 节）正确未含这些元素，但 PRD 验收标准「效果图与最终实现逐项对齐」会诱导实现阶段照图加交互，直接违反硬约束。（design.md B/C；prd.md 验收） | 在 design.md 增补「效果图中不实现项（纯装饰）清单」：+ Add task、拖放虚线区、+ New task FAB、…列菜单、项目切换器、⌘K 快捷键（仅静态徽章，不绑定按键）、详情页作者/日期脚注。实现以 design.md 文字为准，效果图仅作风格基线。 |
| P1-2 | **图 C「步骤 / Steps」逐步骤状态列表无数据支撑**：board 载荷（lib/board.js `readTask` 134–155）只含 totalSteps/completedSteps/hasBlocked/hasPendingVerification/activeStep（单个），**无逐步骤 title/status 数组**；当前 KanbanDetails（975–1335）也不渲染 Steps 区。若照图实现需改后端（违反零后端硬约束）或伪造数据。（lib/board.js:86-132；client.js:975） | 明确图 C 的 Steps 区与「Created by Alex Kim / May 12, 2025」脚注为装饰性、不实现；详情面板仅保留 design.md B 节列出的三块：纯黑 CTA、阶段流水线（来自 tracks+currentIndex，数据可得）、产物列表（来自 task.artifacts）。 |
| P1-3 | **展开大看板三列重构说明不足**：design.md C「三大列泳道（规划中/进行中/已归档）」将替换现状按 workType 分组的 stage 泳道结构（KanbanExpandedModal 1865–2117，泳道来自 tracks[wt].stages）。数据自洽（phase/archived 可从载荷派生，与 KanbanBoard 1349–1355 同源），但 design 未说明：① 列内卡片排序（按 stage 序？slug？）；② In Progress 列内是否保留 stage 子分组；③ 空 workType 的「折叠单行 → 点击切换筛选」行为（1875–1918）去留；④ 模态是否保留右侧共享 KanbanDetails（图 B 只有三列无检查器，但现状代码 2119 与 design.md 数据流图均要求保留）。 | 在 design.md C 节补一段「三列布局细则」：列 = phase（planning/planning-inline、in_progress/in_progress-inline、completed||archived）；列内按 stage 在 track 中的顺序排（无 track 则按 slug）；In Progress 列建议按 stage 做轻量子分组（不改数据只分组渲染）；明确 KanbanDetails 检查器保留在模态右侧（4 列：3 泳道 + 检查器），图 B 仅为风格基线。 |
| P1-4 | **归档树位置三处不一致**：design.md C 说展开大看板含「归档树 KanbanArchive：按月折叠分组」；图 B 的 Archived 列是**扁平卡片**（无月份分组）；现状展开大看板用扁平 per-wt 归档列（KanbanLaneCard，2048–2114），按月折叠树仅用于浮层（KanbanArchive 758–844）。同时 design.md B（浮层）完全没提归档树位置，而 PRD 范围与行为契约（expanded Set 展开/折叠、t('otherMonth')）要求浮层必须保留按月归档树。（design.md B/C；client.js 758、1444、2048） | 明确：按月折叠 KanbanArchive **仅放浮层**，位于双泳道下方整宽区（推荐）或独立折叠区；展开大看板的 Archived 列保持扁平（与图 B 一致）。浮层归档树位置需在 design.md B 补一句，防止实现时丢失归档展开契约。 |
| P2-1 | design.md 内部圆角数值矛盾：圆角层级图示（59 行）写 Popover/Modal 外壳 20px，B 节（91 行）写浮层 16px；现状代码 borderRadius 12（513 行）、模态 12（588 行）。 | 统一数值：浮层 16px、模态 20px（与图 A/B 一致），并同步进 DESIGN_TOKENS。 |
| P2-2 | 细节面板宽度：design.md 写 240px，现状 KANBAN_RIGHT_STYLE 为 236（543 行）。680px 浮层 + 240px 检查器下双泳道各约 190px，与图 A（泳道各约 30%）一致，可行。 | 落地 DESIGN_TOKENS 时统一为 240px；卡片内容按窄宽设计（标题 2 行截断，slug 省略号）。 |
| P2-3 | 浮层头部新增「关闭（✕）」图标按钮：现状浮层仅 Esc/外部点击关闭（TaskChip 2261–2275），无关闭按钮。属新点击目标，但复用 setOpen(false) 同一语义，非新行为类型。 | 实现时关闭按钮仅调用既有 setOpen(false)，不新增任何关闭逻辑；确认与「零新增交互」口径一致（用户已批准含关闭按钮的设计，可接受）。 |
| P2-4 | 浮层卡片底部元数据拥挤：状态点 + 2 行标题 + slug + 类型药丸 + steps 进度 + 激活标记在 ~190px 宽内放不下；图 A 卡片只显示 id + 类型药丸。 | 浮层卡片优先级：状态点 > 标题（2 行）> 类型药丸 > steps（条件显示）> slug（可选省略）；展开大看板卡片可保留完整信息（图 B 卡片含 slug+steps）。 |
| P2-5 | 相位匹配遗漏 inline 变体：design.md 写 `phase === 'planning'` / `phase === 'in_progress'`，现状代码兼容 `planning-inline` / `in_progress-inline`（1349–1354，codex-inline 派发）。 | design.md 泳道划分说明中显式包含 `-inline` 变体，避免扫描态/内联态任务落入错误泳道。 |
| P2-6 | 混用字面量色与 alias 变量：design.md 多处写 `#FFFFFF`/`#2563EB` 等裸值。宿主主题切换时裸值不与 alias 联动。 | 统一用双参形式 `var(--dsw-alias-xxx, #hex)`（现状代码已是此风格），字面量仅作 fallback。 |
| P2-7 | 双语效果图（图 C「激活任务 / Activate Task」）与实际单 locale 文案（t('activate')，client.js 82/149）不一致。 | 接受为装饰性差异，验收比对时以 t() 文案为准，不强求双语。 |
| P2-8 | token 命名/落位：implement.md step-1 要求 `DESIGN_TOKENS` + `PRIMARY_CTA_STYLE` 放入 KANBAN_*_STYLE 常量区（500–591），与现状结构吻合；设计 token 数值（12/10.5/10 字阶、10/14/20 圆角、阴影 0 1px 2px/0 4px 12px/0 20px 48px）与现状代码量级一致。 | 建议状态点颜色抽为函数（如 phaseDotColor，类比 workTypeColor 610–615）供 TaskChip/KanbanTaskItem/KanbanLaneCard 复用；PRIMARY_CTA_STYLE 复用 t('activate')/t('deactivate') 文案。 |

## 结论

- [x] 通过，可进入实现（P0=0，无硬约束违反；P1 需作为 design.md 增补说明随实现推进，建议在 step-1 tokens 落地前由主会话将 P1-1/2/3/4 四条结论并入 design.md）
- [ ] 阻塞，需改 design