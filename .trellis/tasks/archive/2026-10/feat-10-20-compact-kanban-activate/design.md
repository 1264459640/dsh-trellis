# Feature Design: 小看板支持列表项快捷激活任务

status: approved
execution_lane: standard

> v5（用户验收反馈追加）：右槽从「已激活 = 静态 brand 蓝点」改为「已激活 = ■ 停止按钮」，把**取消激活**也做进行内（用户选择：蓝点换成 ■ 停止按钮，不保留状态点）。改动点见 D4 / DOM 结构 / 契约表 / 验证计划 B4。
> v4：按第二轮 design-review（v2 → blocking）重写 D4 状态语义，修 N1/N2/N3/N4/N5 与 D2/D5 断言可执行性；按第三轮（v3 → blocking）修正 T1–T4 口径；第四轮窄范围复核已 passed。
> 历史：v1 blocking（D1–D8）→ v2 部分闭环 → v3 结构性闭环 → v4 口径一致。

## 目标与非目标

### 目标
- 在顶部 Chip 弹出的 Popover（小看板）紧凑列表行中，为**未激活**任务提供一键激活图标按钮。
- 点击调用既有 `bind(taskSlug)`；成功后 `loadBoard()` + `load()`（`lib/client.js:2924-2927`），Chip 与看板自动重取，**无需新增调用**。
- 遵守 HTML 语义（杜绝 `<button>` 嵌套）与 spec 约定 13 / 17 / 24；**对约定 18 的行末样式做显式修订**（见 D4）。

### 非目标
- 不改大看板（`KanbanExpandedModal`）泳道卡、列表行、右侧详情抽屉的既有行为与 CTA。
- 不改归档列表（`KanbanArchive`）——归档只读。
- 不发新 API、不改 `lib/board.js` / `lib/state.js` 的宿主侧数据契约、不改 `bind` 签名。

## 影响面（爆炸半径）

| 项目 | 事实 | 结论 |
|---|---|---|
| `KanbanTaskItem` 使用点 | 全库仅 `lib/client.js:1958` 一处 | 仅影响 popover 紧凑列表行 |
| `KanbanLaneCard`（1999，调用点 2424） | 独立实现 | 不动 |
| `KanbanArchive`（1039） | 独立实现 | 不动 |
| 大看板列表模式内联行（约 2479） | 独立实现 | 不动 |
| 上层调用点 | `KanbanBoard` 已解构 `busy/onActivate/onDeactivate`（`function KanbanBoard` 首行）但未使用；popover 调用点传参已就位 | **上层零改动**，仅在 `activeTasks.map` 处补传三个 prop |

## 方案

### 改动点清单（全部在 `lib/client.js`，另含 2 个测试文件）

| # | 位置 | 改动 |
|---|---|---|
| 1 | i18n `zh`（55-136）/ `en`（138-**220**） | **不新增 key**（复用既有 `activate` / `deactivate`）；删除 v4 试加的 `activeSessionHint` |
| 2 | `renderIcon`（707-823） | 新增 `case 'play'` 与 `case 'stop'`（均为**描边**图元，不改 `fill` 契约） |
| 3 | `KanbanTaskItem`（1007-1038） | 重构为「外层 div + 主 button + 右槽动作按钮（▶ / ■）」 |
| 4 | `KanbanBoard`（`activeTasks.map`） | map 内补传 `busy` / `onActivate` / `onDeactivate` |
| 5 | 硬编码（1035） | `title: '当前会话激活'` 随静态状态点一并删除（该元素已由 ■ 按钮取代） |

### D1 图标：`renderIcon` 无 `fill` 透传，必须描边

事实：`renderIcon` 只读 `size/color/strokeWidth/style`（707-718），`baseProps.fill` 硬编码 `'none'`（722）；调用处传 `fill` 是死参数。

```js
case 'play':
  return react.createElement(
    'svg',
    baseProps,
    react.createElement('path', { d: 'M7 4.5v15l13-7.5-13-7.5Z' }),
  );
```
- 调用：`renderIcon('play', { size: 12, color: TB.color.brand, strokeWidth: 2 })`，**不传 fill**。
- 形态已核：三角形 bbox ≈ 13×15（viewBox 24 网格）→ 12px 下约 6.5×7.5px 实绘，60° 顶点由 `strokeLinejoin:'round'`（baseProps）兜住，不会出现尖刺。**对比度实测**（代码审查 F3）：`brand` 对未选中行底 4.23:1、dark 4.39:1，对**选中行底仅 3.60:1** —— 均 ≥ 3:1 非文本图形阈值（WCAG 1.4.11），但低于 4.5:1 正文阈值；因图标属图形非小字号文本，保留现设计；若日后需更稳，改 `TB.color.brandText`（混色版）即可。
- 不新增 `p.fill` 透传（避免扩大公共图元契约）。

### D3 样式归属表（15 个原属性逐一指派，含 N1 必补项）

| 属性 | 归属层 | 值 |
|---|---|---|
| `position:'relative'` | 外层 div | 恒 |
| **`boxSizing:'border-box'`**（**N1 必补**） | 外层 div | 恒 —— `<button>`→`<div>` 会失去 UA 的 `border-box`，`width:100%` + 1px 边框使行宽多出 2px。**修正因果**：`KANBAN_BODY_STYLE` 自带 `padding:'14px 22px 22px 22px'`（942）会吸收这 2px，**不会**产生横向滚动条或裁切；补它是为了像素对齐（补后才能严格满足人工验收的 `scrollWidth === clientWidth`）。 |
| `display:'flex'` / `alignItems:'center'` / `width:'100%'` / `margin:'1px 0'` / `borderRadius:TB.R.card` | 外层 div | 恒 |
| `background` | 外层 div | `selected ? TB.color.selectBgPop : 'transparent'` |
| `border` | 外层 div | `selected ? '1px solid ' + TB.color.brand : '1px solid transparent'` |
| `borderBottom`（行分隔线） | 外层 div | `selected ? undefined : '1px solid ' + TB.color.border` |
| `boxShadow:'none'` | 外层 div | 恒（显式覆盖宿主/父级可能的阴影） |
| `transition:'background 0.12s ease'` | 外层 div | 恒（背景过渡随背景一起搬走） |
| 左侧 Accent Bar（绝对定位子节点，`left:0, top:'15%', bottom:'15%', width:3.5, borderRadius:TB.R.pill`） | 外层 div 的子节点 | 仅 `selected`；**必须 `pointerEvents:'none'`**（N4：否则 3.5px 宽度会吞掉主按钮左缘点击） |
| `flex:1` / `minWidth:0` / `display:'flex'` / `alignItems:'center'` / `gap:8` | 内层主 button | 恒 |
| `padding:'12px 1px 12px 14px'` / `textAlign:'left'` / `font:'inherit'` / `cursor:'pointer'` | 内层主 button | 恒 |
| `background:'transparent'` / `border:'none'` | 内层主 button | 恒（视觉全部由外层承担，**杜绝双边框**）。**不写 `outline:'none'`**：会抹掉键盘焦点环（现状 1017-1026 无 outline，UA 焦环可见；popover 侧无 `<style>` 通道，inline 也无法表达 `:focus-visible`） |
| 右槽 `flex:'none'` / `width:24` / `height:24` / `display:'flex'` / `alignItems:'center'` / `justifyContent:'center'` / `marginRight:10` | 右槽 div | 恒 |

- 分隔线与边框只在外层 → 右槽下方不断线；左竖条以整行为基准，不因右槽高度错位。
- 右槽内边距不可点击：**明确声明的可接受行为**（避免行选中语义与激活动作混淆）；外层 div **不加** `onClick`。

### D4 行末动作语义（v5：激活 / 取消激活成对，动作槽恒可用，不含静态状态点）

v2 的致命缺陷：`onClick` 先 `onSelect`，被点中的未激活行立刻变 `selected` → 按旧矩阵右槽变蓝灯、**激活按钮消失**；`bind` 静默失败（2929-2931）后同样没有按钮可点，与「用户可重试」自相矛盾。另：`brand`（light `#4176E6` / fallback `#185DDD`）与 `accentBright`（`#146BFE`）色相差 ≤3°，8px 圆点无法区分「已激活 / 仅聚焦」。

**v5 唯一规则：右槽每行恒有且仅有一个动作按钮——已激活给 ■（取消激活），其余给 ▶（激活）。** 不再有静态状态点：`active` 由 ■ 图标形状 + 顶部 Chip 标题共同表达（用户明确选择「蓝点换成 ■ 停止按钮」）。

| selected | active | 右槽内容 |
|---|---|---|
| ✗ | ✗ | ▶ 激活按钮（`title`/`aria-label` = `t('activate')`） |
| ✓ | ✗ | **▶ 激活按钮**（选中态由 Accent Bar + 底色 + 加粗表达，不占用动作槽） |
| ✗ | ✓ | **■ 取消激活按钮**（`title`/`aria-label` = `t('deactivate')`，glyph 为描边方框） |
| ✓ | ✓ | **■ 取消激活按钮**（同左） |

```
active ? deactivateButton : activateButton    // 只有这一条判定
```

- **未激活行恒有 ▶**（无论是否 selected）→ 点击选中后仍可立即激活；`bind` 失败后按钮仍在，用户可原地重试，与「静默失败、可重试」描述一致。
- **已激活行恒有 ■** → 点击调用 `onDeactivate()`（即 `bind(null)`，清空 `currentTask`），`bind` 成功后 `loadBoard()+load()` 重取，该行回到 ▶、Chip 回到无任务态。
- 页面上**至多一个 ■**（`currentTask` 唯一）；不存在「两种蓝点并存」或「纯状态点不可点」的可辨性问题。
- **i18n**：`activate` / `deactivate` 两 key 在 zh 与 en 中**均已存在**（`deactivate`：zh「取消当前激活」/ en「Clear active for this session」），本任务**不新增 key**；v4 曾新增的 `activeSessionHint` 随静态状态点一并删除（避免死键）。
- **规范 18 修订（显式）**：原「行末显示实心聚焦蓝灯」**取消**，选中态改为「3.5px Accent Bar + 选中底色 + 标题加粗」表达（**不加弥散光晕**：D3 已钉死 `boxShadow:'none'`，与现网 1024 行一致；也不写 `outline:'none'`，保留键盘焦点环）。信息量不减，且不再与激活动作抢同一格。本任务在 `trellis-update-spec` 阶段（已登记为 step-7）把该修订写进 `web-ui/index.md` 约定 18 的括注，**不让实现者现场决定**；code review 派单时需点名「约定 18 已修订」。

#### 点击时序
- 激活（▶）：`stopPropagation()` → `onSelect(task.slug)` → `onActivate(task.slug)`。
  - 先同步本地选中用于即时视觉反馈；因右槽恒为按钮（选中不改变右槽），不存在「点了按钮就消失」。
  - `bind` 成功 → `loadBoard()` 重取，`currentTask` = 新 slug，与 `selected` 一致。
  - `bind` 失败 → 静默（2929-2931），`selected` 已切但原激活行仍是 ■；按钮仍可重试。**不弹 toast**（延续克制风格）。
- 取消激活（■）：`stopPropagation()` → `onDeactivate()`（**不调用 `onSelect`**，取消绑定不应改动当前查看的行）。
  - `bind(null)` 成功 → `loadBoard()+load()`，该行回到 ▶、Chip 回到无任务态；`setSelected` 保留 `prev`（2899-2904），选中行不变。
  - 失败同上：静默、保持原状、可重试。
- `busy` 期间 ▶ 与 ■ 均 `disabled`（`busy` 为 popover 级共享状态）：短暂禁用，避免并发 bind。

### DOM 结构（最终形态）

```jsx
react.createElement('div', { style: ROW_STYLE /* 含 boxSizing:'border-box'、边框/底色/分隔线/圆角/阴影/过渡 */ },
  selected ? react.createElement('span', { style: ACCENT_BAR_STYLE /* pointerEvents:'none' */ }) : null,
  react.createElement('button', {                          // 主区域：行选中
    type: 'button',
    onClick: () => onSelect(task.slug),
    title: task.title + ' (' + task.slug + ')',
    style: MAIN_BTN_STYLE,
  },
    react.createElement('span', { style: TITLE_STYLE }, task.title),
    wtLabel ? react.createElement('span', { style: TYPE_PILL }, wtLabel) : null,
    react.createElement('span', { style: STAGE_PILL }, task.stage || '—'),
  ),
  react.createElement('div', { style: RIGHT_SLOT_STYLE },   // 右槽：恒有一个动作
    active
      ? react.createElement('button', {
          type: 'button',
          disabled: busy,
          title: t('deactivate'),
          'aria-label': t('deactivate') + ': ' + task.title,
          onClick: (e) => { e.stopPropagation(); onDeactivate(); },
          style: ACTION_BTN_STYLE,                 // 同 ▶ 按钮的 20x20 规格
        },
          renderIcon('stop', { size: 11, color: TB.color.brand, strokeWidth: 2.5 }),
        )
      : react.createElement('button', {
          type: 'button',
          disabled: busy,
          title: t('activate'),                    // 只写动作，不拼标题（避免与主按钮 tooltip 打架）
          'aria-label': t('activate') + ': ' + task.title,
          onClick: (e) => { e.stopPropagation(); onSelect(task.slug); onActivate(task.slug); },
          style: ACTION_BTN_STYLE /* 20x20, background:'transparent', border:'none', padding:0,
                                      color: TB.color.brand, cursor: busy?'not-allowed':'pointer',
                                      opacity: busy?0.5:1, display:'inline-flex',
                                      alignItems:'center', justifyContent:'center' */,
        },
          renderIcon('play', { size: 12, color: TB.color.brand, strokeWidth: 2 }),
        ),
  ),
)
```

### 契约变更

| 项 | 结论 |
|---|---|
| 网络/宿主 API | 无。复用 `POST /trellis-workflow/api/bind`，body `{ sessionId, taskSlug }`（`lib/client.js:2917-2921`，spec `web-ui/index.md:79`） |
| 组件 props | `KanbanTaskItem` 新增 `onActivate`(fn) / `onDeactivate`(fn) / `busy`(bool)；`KanbanBoard` 已持有三者（解构处），仅补传 |
| i18n | **不新增 key**：复用既有 `activate`（zh「设为当前会话激活」/ en「Set active for this session」）与 `deactivate`（zh「取消当前激活」/ en「Clear active for this session」） |
| `bind` 签名 | **不变**（改 `Promise<boolean>` 会波及详情抽屉调用点 1548/1578，属扩大范围） |
| 数据文件 | 无。仍写 `.trellis/.runtime/sessions/<sid>.json` 的 `currentTask` |

#### 与 spec 约定 13（克制交互）的边界
约定 13 禁止**修改任务状态**（stage / status / steps）。本功能只写**会话级绑定** `currentTask`，与详情抽屉既有「激活任务 / 取消当前激活」同一能力，仅多一处入口，**不触碰 `task.json`**；归档行不提供入口。
取舍声明（N5）：小看板直连激活 = 缩短高频路径（当前需「展开大看板 → 选中 → 右下 CTA」三步），详情抽屉 CTA **保留不动**，两条路径共存。

### 取舍
- 24px 右槽而非文字按钮：popover 实宽 **580px**（`KANBAN_POPOVER_STYLE.width`，`lib/client.js:914`），内宽约 536px，24px 槽不挤压标题，保持高密度单列观感。
- 不加 hover 态：bundle 无 `onMouseEnter/Leave`、无 `:hover`（grep 0 命中）；用原生 `title` tooltip 满足 PRD，不引入 hover state。
- 右槽按钮 `title` 只写动作文案，任务标识走 `aria-label`。

## 验证计划（可执行，逐条可跑）

### A. 静态/结构断言 —— `test/client.test.js` 新增 case
1. **双语 key 齐备**：`assert.equal(source.match(/deactivate:/g).length, 2)`（zh + en）；并断言不再残留 v4 的 `activeSessionHint` 死键。
2. **硬编码已清算**：`assert.doesNotMatch(source, /title:\s*'当前会话激活'/)`（原 1035 行写法即 `title: '当前会话激活'`）。
3. **图标契约**：`case 'play'` 配 `M7 4.5v15l13-7.5-13-7.5Z`、`case 'stop'` 配 `rect`；两处调用均不得传 `fill`（`assert.doesNotMatch`）。

### B. 渲染树断言 —— `test/client-theme.test.js`（用已导出的 `KanbanBoard` 覆盖 props，**不新增导出**）
> `renderViews` 把 `board.currentTask` 写死为 `selected`（helper 61），**无法构造** 2×2 矩阵；改为直接调用 `client.KanbanBoard({ ...props, selected, board: { ...board, currentTask: active } })`。
> 遍历必须用 `node.children`（桩 `createElement` 已 `flat(Infinity)` 且含 `null`），**不是** `props.children`。

1. **无 button 嵌套**：递归断言不存在「`type === 'button'` 的子树内再出现 `type === 'button'`」。
2. **(✗ selected, ✗ active) 行有 ▶**：该行存在 `type==='button'` 且 `aria-label` 以 `zh.activate` 开头。
3. **(✓ selected, ✗ active) 行仍有 ▶**（v3 关键回归）：`selected` = 行、`board.currentTask` = 另一任务。
4. **(active) 行有 ■、无 ▶**（v5 关键回归）：该行 `aria-label` 以 `zh.deactivate` 开头、`title === zh.deactivate`、子树含 `rect`（stop 方框）；同时断言**不存在** ▶ 按钮与任何静态 brand 圆点（`width:8 && background===brand` 命中数 0）。
5. **`busy` 禁用**：`busy:true` 时 ▶ 与 ■ 均 `disabled`、`opacity 0.5`、`cursor 'not-allowed'`。
6. **点击时序**：▶ → `stopPropagation` + `[select, activate]`；■ → `stopPropagation` + `onDeactivate`（无 `onSelect`）；两者传入 `undefined` event 不抛错。
7. **boxSizing**：外层行容器 `style.boxSizing === 'border-box'`。
8. 复用既有 3 视图 × 3 任务 × 3 主题对比度断言（`client-theme.test.js:69-88`）。注意 `textColors` 跳过 `svg`（46 行），**图标不受对比度覆盖**，故必须保留下面的人工项。

### C. 人工浏览器验收（`verification: human`）
1. 打开 Chip → 小看板：未激活行出现 ▶；悬停 tooltip 为「设为当前会话激活」（英文环境为英文）。
2. 点击某行正文 → 该行高亮（Accent Bar + 底色 + 加粗），**右槽按钮仍在**；再点 ▶ → **该行变 ■**、Chip 文案切换。
3. **点 ■ → 该行回到 ▶、Chip 回到「无激活任务」态**（本步是本轮用户反馈的核心验收点）。
4. DevTools Console **无** `validateDOMNesting` 告警；行宽无溢出（`box-sizing:border-box` 生效，量 `scrollWidth === clientWidth`）。
5. light / dark 主题下 ▶ / ■ 图标均清晰可见。
> 离线 DOM 断言 ≠ 浏览器计算样式验收（spec 约定 24 末段）。

## 风险与回滚
1. 样式迁移遗漏（分隔线断裂/双边框/竖条错位/溢出）→ D3 表逐属性指派，实现时逐行对照 + B5 断言。
2. `play` 小尺寸视觉过粗/糊 → 12px + `strokeWidth:2`；不佳则退 `size:11`，不动图元契约。
3. i18n 漏 key → 渲染字面量（测试桩 `zh[key] || key`，helper 61）→ A1 断言兜住。
4. 取消行末蓝灯 → 观感变化（选中行不再有行末聚焦点，改为恒有一个 ▶/■ 动作按钮）→ 需人工确认；已在 D4 显式声明并纳入 spec 修订。
5. 回滚：`lib/client.js` + 2 个测试文件，`git checkout`/`git revert` 即可；无数据迁移、无配置变更。

## 未纳入本任务（follow-up）
- `KanbanLaneCard` 收到 `active`（调用点 2429）却未解构使用（2000）→ 大看板泳道内无激活标识，另开 issue。
- `renderIcon` 无 `fill` 透传（未来需要实心图元时再补）。

## 人审检查点
- [x] 设计已获用户确认（2026-10-20，用户选择「批准 v4，取消行末蓝灯」），可进入实现
