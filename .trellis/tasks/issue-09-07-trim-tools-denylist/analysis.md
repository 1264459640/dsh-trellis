# Analysis: 规划期只读保护把其他插件的工具也一并裁剪

## 1. 根因

`lib/readonly.js` 的裁剪语义是**白名单保留**（allowlist-keep），而非**按指定工具裁剪**
（denylist-trim）：

```js
// lib/readonly.js:83
return tools.filter((t) => t && typeof t.name === 'string' && allowed.has(t.name))
```

`allowedToolsFor(authorization)` 返回的是"保留集合"：

- `UNDECIDED_TOOLS` = READ_TOOLS + trellis_state + trellis_task_create + trellis_task_skip
- `PLANNING_TOOLS` = READ_TOOLS + trellis_state + trellis_task_update + trellis_artifact_update

`filter` 会把**不在保留集合内的一切工具**移除，包括其他插件注册的工具
（`web_search`、`generate_image`、`subagent`、`platform_search`、`skill` 等）。
`applyReadonlySections` 同理：`tool:<name>` 前缀的 section 若不在保留集合也一并剔除。

这与设计意图（README：「移除通用 `write` / `edit` 工具，仅放行受控的任务产物更新」）
不符——只读保护针对的是**代码写工具**，不应波及其他插件的只读/分析/搜索类工具。

## 2. 修复方案

把裁剪语义从"保留白名单"反转为"按指定工具裁剪（denylist）"：

- `undecided`（无任务）：裁剪 `write` / `edit`（代码写工具）+ 无任务时不适用/不允许的
  trellis 工具（`trellis_task_update` / `trellis_artifact_update` /
  `trellis_task_archive` / `trellis_ui_update`）。保留：read 系列、`skill`、
  `web_search` 等一切其他工具，以及 `trellis_state` / `trellis_task_create` /
  `trellis_task_skip`。
- `planning`（任务规划中）：裁剪 `write` / `edit` + 规划期不适用/不允许的 trellis 工具
  （`trellis_task_create` / `trellis_task_skip` / `trellis_task_archive` /
  `trellis_ui_update`）。保留：read 系列、其他插件工具、`trellis_state` /
  `trellis_task_update` / `trellis_artifact_update`。
- `authorized`（实施 / 已跳过）：不裁剪（与现状一致，返回 null）。

### 3.1 代码变更

`lib/readonly.js`：

- `UNDECIDED_TOOLS` / `PLANNING_TOOLS`（保留集合）→ `UNDECIDED_TRIM` /
  `PLANNING_TRIM`（裁剪集合，denylist）。
- `allowedToolsFor(authorization)` → `trimToolsFor(authorization)`，返回当前状态要
  **裁剪**的工具集合；`authorized` 返回 null。
- `applyReadonlyPolicy`：`tools.filter((t) => t && typeof t.name === 'string' && !trimmed.has(t.name))`。
- `applyReadonlySections`：`tool:<name>` section 仅在 `<name>` ∈ 裁剪集合时剔除；
  非 `tool:*` section 与其余 `tool:*` section 全部保留。
- `READ_TOOLS` 保留导出（仅作说明性常量，不再参与过滤），避免破坏既有引用。

### 3.2 测试变更

`test/readonly.test.js`：

- `allowedToolsFor('undecided')` → `trimToolsFor('undecided')`：断言集合是裁剪集
  （含 write/edit/trellis_task_update/trellis_artifact_update，不含 read/trellis_state/
  trellis_task_create/trellis_task_skip）。
- `applyReadonlyPolicy(FULL, 'no_task', false)`：新增断言 `skill` **保留**（原断言
  `!kept.includes('skill')` 反转），write/edit/trellis 写工具被裁剪。
- planning 用例同理：`skill` 保留，`trellis_task_create`/`trellis_task_skip` 被裁剪。
- `FULL_SECTIONS` 增加 `tool:web_search` 等第三方工具 section，断言其**保留**。

### 3.3 文档与文案

- `lib/client.js` zh/en `enforceReadonlyPlanningHint`：改为 denylist 描述。
- `lib/meta.js` `enforceReadonlyPlanning` 注释：改为 denylist 描述。
- `README.md` / `README_EN.md` 只读保护表格：改为"仅裁剪指定工具"的表述。
- `lib/index.js` 1010-1016 钩子注释：同步更新。

## 3. 影响面

- 行为变化仅发生在 `enforceReadonlyPlanning: true` 且授权状态为
  `undecided` / `planning` 时；`authorized` 路径完全不变。
- 裁剪集与原先"保留集"的差集（即原被裁剪的其他插件工具）现在恢复可用——
  这正是本 issue 的修复目标，非破坏性。
- 所有 `trellis_*` 工具的守卫逻辑（无任务报错、阶段校验等）不受影响。

## 4. 验证计划

1. `node --test test/readonly.test.js`：全部用例通过（含新 denylist 断言）。
2. `node --test`：全套测试回归通过。
3. 人工核对 `applyReadonlyPolicy` / `applyReadonlySections` 对 denylist 的过滤方向。
