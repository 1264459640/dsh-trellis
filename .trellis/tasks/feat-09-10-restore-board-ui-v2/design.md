# Feature Design

status: approved   # draft | approved（用户于本会话明确批准，含两处解读：分段控件左钮恒中性'工作台'标签、详情面板单黑 CTA 状态机）
execution_lane: standard   # quick | standard

## 目标与非目标
- 目标：将 `lib/client.js` 的三种看板形态（工作台看板 / 工作台列表 / 侧栏紧凑列表）与右侧详情面板还原到三张效果图（`.dsh/generated/dsh-auxiliary-1788773587554-1.png` 列表、`...-1788782242019-1.png` 紧凑、`...-1788782790255-1.png` 看板），含结构、样式、文案三层对齐。
- 非目标：不改数据契约 / task.json schema / 三个 HTTP 端点行为；不新增交互；归档月份分组结构不变（效果图未覆盖，仅套新 token）；设置页不动。

## 方案
### 边界
单文件 `lib/client.js`（3388 行）。挂载点（行号为盘点锚点）：TB 令牌 L679–728；zh/en 字典 L41–199；KanbanTaskItem L867–896；KanbanArchive L897–983；KanbanDetails L1114–1963；KanbanBoard L1965–2094；KanbanLaneCard L2100–2280；scrollbarStyles L2413–2445；renderLaneColumn L2448–2539；renderListView L2542–2706；filterChip 模态 L2368–2411 / 弹窗 L1993–2036；模态顶栏 L2720–2882；主体 L2896–2909；弹窗头部 L3152–3222。

### 逐区还原映射（现状 → 目标）
**A. 设计令牌 TB（L679–728）与字典（L41–199）**
- `ink` #1E293B → **#0B0C0D**（黑胶囊 / 分段激活 / 主 CTA；效果图采样 #0B0C0D、#101010）。
- `brand` #2563EB → **#185DDD**（选中点 / 选中边框 / 列表尾点）；新增 `brandBar` **#216AE2**（进行中进度条填充）；新增 `accentBright` **#146BFE**（弹窗左竖条 / 弹窗右点）。
- `success` #10B981 → **#3BAF62**；新增完成勾环边 **#61BD7E**、refactor/完成 tint 底 **#EEFBF1**。
- issue 类型色：danger 红 → **橙 #F77032**、tint 底 **#FEF3E9**（typePillBg L740–745、workTypeColor L856–861；顺手修正 L852–855 注释与代码不符）。feat tint 底 → **#EFF4FD**。
- 新增选中底 `selectBg` **#EFF6FE**（看板卡 / 列表行）、弹窗选中底 **#F2F6FC**；中性 chip 底 **#F1F2F3** / 字 **#626471**（泳道计数、步骤 chip 基色）。
- 圆角：`R.popover` 24→**16**、`R.modal` 20→**16**；其余保持。选中态移除 `S.glow` 辉光，改 1px 蓝边。
- 字典：colArchive zh L75 '历史归档'→'**已完成 · 归档**'；detailsTitle zh L76 '任务详情'→'**激活任务**'；boardHint zh L115 →'**仅展示，不直接改状态**'；新增 viewBoard zh='看板'/en='Board'、activateCta zh='激活任务'/en='Activate task'、stepsCaption 模板（'已完成 n 个步骤，共 m 个步骤'）。

**B. 模态顶栏（L2720–2882）**
- filterChip（模态 L2368–2411 + 弹窗 L1993–2036 两处）：**删除计数 span**（L2398–2409、L2023–2034）；选中=ink 底白字 radius pill、padding '5px 14px'；未选中=白底+border。
- 分段控件 L2804–2856 → 两个独立圆角按钮 gap 8：**左='工作台' 恒中性**（白底+border，静态标签、cursor default）；**右=黑底按钮显示当前模式名**（lanes→'看板'、list→'列表'），点击切换 viewMode。此为对效果图的唯一自洽读法（两图中左钮恒白、右钮恒黑且名字=当前视图）。
- 关闭按钮 L2857–2880 → 去边框 ghost 32×32。

**C. 看板泳道（L2448–2539、L2100–2280、L2905–2907）**
- 泳道头计数胶囊 → 中性 chip token（底 #F1F2F3 / 字 #626471）。
- 卡片：**删除 stage 文本**（L2179–2191）；进度行重构 L2223–2277 = [进度条 flex][右槽：未完成→`N/M 步骤` 10.5px muted 同行右对齐；完成→18px 白底绿环(#61BD7E)绿勾圆]；完成卡片另在进度条下左对齐显示 `N/M 步骤`。
- 选中卡 L2130–2131 → 底 selectBg + 1px brand 边（去 glow）；选中点 L2135–2149 → 右缘垂直居中 8px brand。

**D. 列表模式（L2542–2706）**
- 选中行 L2602–2604 → 底 selectBg + 1px brand 边 + radius ctrl；保留右尾点。
- 阶段徽章 L2660–2676 → 文案改 `stageDisplayName(stage)+'（'+stage+'）'`（如「实现（impl）」，替换 phaseLabelOf L845–850 用法）；样式=带 border 中性 chip。
- 步骤 chip L2677–2697 → 带 border 中性 chip 基色（blocked/verifying 红黄语义保留）。

**E. 侧栏紧凑弹窗（L747–763、L867–896、L2041–2048、L3152–3222、L2079–2092）**
- 头部：**筛选药丸移入头部行**（标题后、图标前）；图标组=**展开 + 关闭(新，setOpen(false))**；**删除刷新按钮** L3163–3189（打开弹窗恒 loadBoard 已有，spec 约定 15 不受影响）。
- 行 KanbanTaskItem：**删除左 7px 状态点**（L890）；选中=底 #F2F6FC + 左 3.5px accentBright 竖条 + 右 8px accentBright 点 + 1px 蓝边（去 glow）；右槽规则：选中→accentBright 点；否则会话激活→brand 点(title='当前会话激活')；否则无占位。
- 底部提示 → 新 boardHint 文案。月份分组 KanbanArchive 结构保留、套新 token。

**F. 右侧详情面板（L1114–1963）**
- 容器 L788–799：width 350→**376**、minWidth 280→300。
- 操作区 L1343–1450 → **单一黑色全宽 CTA 状态机**：非归档未激活→'激活任务'(bind)；已激活→'推进任务'(injectToComposer，保留 spec 约定 13/14)；归档→灰只读块(zh L84)。删除双按钮堆叠；busy 禁用保留。
- 流水线 L1181–1336：去 surfaceMuted 外框；**删除蓝色进度线** L1222–1242，保留单一灰轴线；节点：done=白底+1.5px 深边+深色勾；current=brand 实心+**白色序号**（替换白点）；未达=白底+灰边+灰序号；标签行保留。
- 产物 L1530–1690：标题 '产物交付'→'**产物**'、**删计数胶囊** L1540–1555；行简化=16px 灰 fileText 图标 + mono 文件名 + 右侧白底带 border '打开' 按钮；删除彩色图标块 / 中文标题 / tag（artifactMeta L400–447 保留供 tooltip）。
- 步骤清单 L1693–1961：头=`N/M 步骤` 15px/600（替换 '执行步骤清单'+mono 计数）；保留 h4 总进度条；新增 caption '已完成 n 个步骤，共 m 个步骤'；列表=简行：16px 圆图标（done=brand 实心白勾 / pending=白底灰边 / in_progress=白底 brand 边+brand 内点 / blocked=danger 实心白三角 / verifying=warn 实心白时钟）+ `i. title`；**删除步骤卡/徽章/副文本/时间轴连接线**；状态与 blockedReason 移入行 title tooltip（信息不丢失）。

**G. 死代码清理**（grep 验证零引用后删）：KANBAN_LEFT_STYLE L786、ACTION_BUTTON_STYLE L801–814、locale noTasksInType/collapseBoard、renderIcon 无调用分支（spinner/loader、circleDashed、history、minimize、play/send、checkCircle）。

### 数据流
```text
不变：POST /api/task-state、/api/board、/api/bind + TaskChip 本地 state（inventory §9）。
本任务仅渲染层：board payload -> 既有 state -> 新模板/新 token -> DOM。
```

### 契约变更
- 无公开接口 / 事件 / 协议 / 序列化变更。仅 client 内部 locale 字典新增键（viewBoard/activateCta/stepsCaption），zh/en 同步。

### 取舍
- 分段控件读法（左恒'工作台'中性 + 右黑钮=当前模式名可点切换）：唯一同时吻合两张效果图的方案；代价=失去"直接点目标视图"的一次点击（仍一次点击切换）。
- 单一 CTA 状态机合并激活/推进：吻合效果图采样态（非激活→'激活任务'），且保留 Composer 注入推进路径。
- 步骤清单去卡片化：blocked/verifying 信息改由图标色 + tooltip 承载，视觉密度对齐效果图。
- 归档/月份区效果图未覆盖：结构不动，仅 token 化，避免臆造。

## 验证计划
1. `node --check lib/client.js`
2. `npm test`（sandbox spawn EPERM 时按 feat-09-08 先例一次性提权重跑）
3. 视觉闭环：现有 GUI 刷新后对三形态截图，与效果图 `vision_pixel_diff`（grid 6, top 8）；worst region 用 `vision_glance region` 复核；收敛标准=worst region 无结构级差异（色差以采样 token 为准）
4. 交互回归清单（人工）：搜索/⌘K、筛选、视图切换、点选联动、打开产物、激活/取消、推进注入、展开/关闭、Esc/外点
- 步骤验证标注：区域还原步骤 verification=ai（含 pixel-diff 证据）；最终 GUI 回归 verification=human。

## 风险与回滚
- 风险：单文件 3388 行改动面大 → implement.md 按 9 步分区推进、每步独立可验证；分段控件/单 CTA 两处解读误读 → 列入人审检查点。
- 回滚：以本任务对 `lib/client.js` 的提交为界 git revert；无数据迁移、无 runtime 文件触碰。

## 人审检查点
- [x] 设计已获用户确认（status=approved）后再进入实现
- [x] 分段控件读法与单一 CTA 状态机两处解读获确认
