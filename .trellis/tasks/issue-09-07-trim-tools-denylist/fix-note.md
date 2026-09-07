# Fix Note: 规划期只读保护误裁剪其他插件的工具（白名单改 denylist）

## 1. 修复摘要

`enforceReadonlyPlanning` 开启时，`lib/readonly.js` 原先用**白名单保留**语义裁剪工具面
（只保留 read 系列 + 少量 trellis 工具，其余全部移除），导致其他插件注册的工具
（`web_search`、`generate_image`、`subagent`、`skill` 等）在 `undecided` / `planning`
状态下被连带裁剪。本次修复反转为 **denylist** 语义：仅裁剪指定的代码写工具与当前授权状态
不适用的 trellis 工具，其余所有工具（含其他插件的工具）原样保留。

## 2. 代码变更点

1. `lib/readonly.js`：
   - `UNDECIDED_TOOLS` / `PLANNING_TOOLS`（保留集合）→ `UNDECIDED_TRIM` /
     `PLANNING_TRIM`（裁剪集合，denylist）。
   - `allowedToolsFor(authorization)` → `trimToolsFor(authorization)`：返回当前授权状态要
     **裁剪**的工具集合；`authorized` 返回 null（不裁剪）。
   - `applyReadonlyPolicy`：过滤方向反转为 `!trimmed.has(t.name)` —— 只移除 denylist 内工具。
   - `applyReadonlySections`：`tool:<name>` section 仅在 `<name>` ∈ denylist 时剔除；
     非 `tool:*` section 与其余 `tool:*` section（含其他插件工具的）全部保留。
   - `READ_TOOLS` 保留导出（说明性常量，不再参与过滤）。
2. `test/readonly.test.js`：全部断言改为 denylist 语义；新增 `skill` / `web_search` /
   `generate_image` 等第三方工具及其 `tool:*` section 在 undecided/planning 下**保留**的断言。
3. 文档与文案同步：`lib/client.js`（zh/en `enforceReadonlyPlanningHint`）、`lib/meta.js`
   配置注释、`lib/index.js` 钩子注释、`README.md` / `README_EN.md` 只读保护表格、
   `.trellis/spec/trellis-workflow/task-engine/index.md` 约定 4 三态授权描述。

## 3. 裁剪矩阵（修复后）

| 授权状态 | 裁剪（denylist） | 保留（示例） |
|---|---|---|
| `undecided` | `write` / `edit` + `trellis_task_update` / `trellis_artifact_update` / `trellis_task_archive` / `trellis_ui_update` | read 系列、`skill`、`web_search`、`generate_image`、`trellis_state` / `trellis_task_create` / `trellis_task_skip` |
| `planning` | `write` / `edit` + `trellis_task_create` / `trellis_task_skip` / `trellis_task_archive` / `trellis_ui_update` | read 系列、`skill`、`web_search`、`generate_image`、`trellis_state` / `trellis_task_update` / `trellis_artifact_update` |
| `authorized` | 无（不裁剪） | 完整工具面 |

## 4. 验证结果

- `node --test --test-isolation=none test/readonly.test.js`：15 项只读测试 100% 通过
  （含 denylist 语义与第三方工具保留断言）。
- `node --test --test-isolation=none`：全套 83 项测试 100% 通过，无回归。

## 5. 影响评估与兼容性

- 仅影响 `enforceReadonlyPlanning: true` 且授权状态为 `undecided` / `planning` 的会话；
  `authorized`（实施 / 已跳过）路径完全不变。
- 修复方向为"恢复被误裁剪的工具"，属纯放行，无安全降级：规划期仍裁剪 `write` / `edit`
  代码写工具与不适用的 trellis 工具，`trellis_artifact_update` 仍是规划期唯一受控写通道。
- 测试在沙箱下需用 `--test-isolation=none` 单进程运行（node --test 默认子进程管道受沙箱
  EPERM 限制），此为本环境限制，非代码回归。
