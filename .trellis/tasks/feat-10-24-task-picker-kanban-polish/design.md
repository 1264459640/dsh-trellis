# Feature Design：任务选取下拉与看板质感打磨

status: approved   # draft | approved
execution_lane: standard

## 目标与非目标
### 目标
- 用更少的 token 档位、更紧的圆角阴影、更低的饱和度，让界面从「轻、飘」变成「稳、精」。
- 补齐表头和键盘/焦点细节。

### 非目标
- 不改结构、不改后端、不加色相、不加新组件抽象层。

## 1. Token 收敛（`TB`）

| 项 | 现在 | 改为 |
|---|---|---|
| 字号 `TB.T`（新增） | 9 档散落 | `xs 11` / `sm 12` / `md 13` / `lg 15`，行高对应 16/18/20/22 |
| 圆角 `TB.R` | popover 14、modal 16、card 12、row 9、ctrl 8、7/6/5/4 散落 | `lg 10`（popover/modal）、`md 8`（卡片）、`sm 6`（行/按钮/输入框）、`xs 4`（Kbd/小标签）、`pill` |
| popover 阴影 | `0 24px 56px -12px .28` | `0 0 0 1px border-l2, 0 4px 12px -2px .08, 0 12px 32px -8px .16` |
| modal 阴影 | `0 32px 80px -16px .35` | 同结构加一档：`…, 0 24px 64px -16px .24` |
| 成功/警告/危险 | 原色填充 | 新增 `successSoft / warnSoft / dangerSoft` = 原色 80% 混 `label-secondary`，用于点、图标、步骤环；文字色维持现有 `*Text` 混色 |

所有新 token 继续走 `--dsw-alias-*` + fallback。字号/圆角字面量统一替换为 token 引用。

## 2. TaskChip
- 由透明胶囊改为 `sm 6` 圆角 + 1px `border` 发丝描边，高 26，静止态即有边界，显得「落地」。
- hover / 展开：底色 `hover`，描边 `borderStrong`。
- 绑定中的点：去掉 `.tw-live` 无限呼吸，改为静态 2px 品牌色 20% 光环（`boxShadow`）。`.tw-live` 类保留但只做一次 0.6s 入场脉冲，避免长期闪动。

## 3. 迷你看板 popover
- 宽 400 → 384；圆角 `lg 10`；入场动画：`opacity 0→1 + translateY(-2px→0)`，120ms，去掉 scale。
- 头部：小标题 `xs 11 / 600`，加 1px 底分隔线，与内容分层。
- **当前任务卡**：去掉 well 底色内的嵌套白卡；卡片本身用 `surfaceRaised` + 1px `border` 描边 + `md 8` 圆角。结构：
  - 元信息行（`xs`）：状态点 + 阶段状态 · 类型 · 阶段，右侧异常标记
  - 标题 `lg 15 / 600`
  - 进度行
  - 1px 分隔线
  - 步骤清单直接排列（compact 规则不变）
  - 1px 分隔线 + 操作行：主按钮「推进任务」（去掉 sparkles 图标，改用右箭头放在文字后），次按钮「解除绑定」
- 分组列表：组标题 `xs 11 / 600` + 计数；行高从约 50 收到 44，标题 `md 13 / 500`，meta `xs 11`；▶ 显现规则不变。
- 页脚：底色 `well`，与主体分区；Kbd 统一 `xs 4` 圆角。

## 4. 展开大看板
- modal 圆角 `lg 10`；顶栏高度固定 52，标题 `lg 15 / 600`。
- 筛选 tab → 分段控件：外层 `well` 底 + `sm 6` 圆角 + 2px 内边距，选中项 `surfaceRaised` 底 + 轻阴影 `0 1px 2px rgba(0,0,0,.08)`；计数 tabular-nums。
- **表头行**（新增）：sticky，`xs 11 / 600 / textMuted`，列同表格 grid：`任务 · 类型 · 阶段 · 进度 · 步骤`，下接 1px 分隔线。新增 locale：`colHeadTask/colHeadType/colHeadStage/colHeadProgress/colHeadSteps`（zh/en）。
- 表格行：内边距 `8px 10px`，行间无分隔线（保持安静）；slug 字号 `xs 11`，颜色 `textMuted`。已完成行进度条用中性色（`textMuted` 30%），不再满格亮绿。
- 详情栏：宽 360 不变；段落间距 20 → 24，段标题统一 `xs 11 / 600`；阶段分段条高 4 → 3。
- 键盘：表格列表容器 `tabIndex=0`，↑↓ 在当前可见（已过滤、已展开）行间移动选择并 `scrollIntoView({block:'nearest'})`；不改变「行只选择，绑定在详情栏」的契约。

## 5. 交互与焦点
- popover 打开：board 就绪后把焦点放到列表容器（`.tw-list`）；无可选行时放到当前卡主按钮。
- popover 经 Esc 关闭时焦点回到 chip（外部点击关闭不抢焦点）。
- 所有 transition 统一 120ms ease；`prefers-reduced-motion` 下全部关闭（沿用现有规则并补上新增类）。

## 6. 涉及文件
- `lib/client.js`（仅 kanban region 与 locale 字典）
- `test/client-theme.test.js`（对比度矩阵覆盖新表头、新卡片结构）
- `test/client.test.js`（表头存在、无嵌套步骤子卡、done 行进度条非 success 色、键盘导航）

## 契约变更
- 无 API / 存储变更。新增 5 个 locale key。spec 第 26 条「呼吸光晕」完成后更正为「静态光环 + 一次入场脉冲」。

## 验证计划
1. `npm test`（含对比度矩阵 light/dark/无 token）。
2. `node scripts/verify-modal-browser.mjs`（需 `DSH_BROWSER_TEST_TOOLS`，环境不具备时注明未跑）。
3. 人工：重启 DSH 后在真实 GUI 中查看 chip、popover、大看板的明暗两套主题。

## 风险与回滚
- 风险：观感主观，可能需要再迭代一轮；`color-mix` 降饱和在暗色下偏灰需实测。
- 回滚：改动集中在 `lib/client.js` kanban region 与测试，直接 revert。

## 人审检查点
- [x] 需求拆解完整，实现方案清晰
- [x] 设计已获用户确认（status=approved）后再进入实现
