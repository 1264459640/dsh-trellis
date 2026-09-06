# Issue Report

## 现象

启用 `enforceReadonlyPlanning` 时，只读授权与阶段展示的相位仅由 `task.status` 派生、完全忽略 `task.work.stage`，导致：

- refactor 任务的 **scan** 阶段（规划型/只读阶段）一旦 `status` 为 `in_progress`，就被当作「执行中」：面包屑 `[trellis/in_progress]`、Web 徽标圆点蓝色、看板落入 in-progress 列、状态标签显示「执行中」，同时只读授权直接放开（`write`/`edit` 回到工具面）。
- 反向同样失守：refactor 处于 **apply**（写码阶段）而 `status` 仍是 `planning` 时，工具面被错误裁剪，合法编码被阻塞。

## 复现步骤

1. 创建 refactor 任务时传 `status=in_progress, stage=scan`（`trellis_task_create` 参数说明将 status 暴露为 `planning | in_progress | completed` 自由选择，未做一致性校验）；
2. 或恢复一个历史任务，其 `task.json` 因模型纪律失守 / 会话中断处于 `status=in_progress, stage=scan`；
3. 观察：breadcrumb 与 Web 徽标/看板显示「执行中」，且只读裁剪失效。

纯逻辑复现（无需 UI）：对 `phaseFor('in_progress')` 与 `stageOnTrack('refactor','scan')` 的既有实现，`authorizationOf(phaseFor('in_progress'))` 返回 `authorized`；没有任何函数把 `work.stage='scan'` 参与相位/授权判定。

## 期望 vs 实际

- 期望：按 `skills/_templates/work-types.md` 的 status↔stage 映射——refactor: scan/design → planning（只读）；apply → in_progress（可写）。issue: report/analyze → planning；fix/fix-note → in_progress。feat: prd/design/design-review → planning；impl/review/check → in_progress。相位与授权由细粒度 stage 决定，status 与 stage 的一致性由运行时保证（读路径阶段感知 + 写路径拒绝漂移）。
- 实际：相位仅由 status 决定；stage 只用于展示标签与轨道校验；status↔stage 无耦合约束。

## 影响范围

- `lib/state.js`（`phaseFor`/`taskSummaryOf` 的相位来源）
- `lib/readonly.js`（`authorizationOf` 的输入相位）
- `lib/index.js`（`resolveProjectState`、`trellis_task_create`/`trellis_task_update` 返回与徽标缓存）
- `lib/board.js`（board 记录暴露裸 status/stage）
- `lib/client.js`（看板分列 `task.status === 'planning'`、状态标签、徽标圆点颜色）
- 三种 work.type 的规划期/执行期边界全部受影响。

## 证据

- `lib/state.js:44` `phaseFor(status)` — 相位映射仅 status。
- `lib/index.js:164` `resolveProjectState` 仅传 status 到 `phaseFor`。
- `lib/readonly.js:50` `authorizationOf(phase)` — `in_progress` → `authorized`（不裁剪）。
- `lib/task.js:291/593` `validateCreateArgs` / `validateUpdateArgs` — 仅校验 stage 在轨道上，不校验 status↔stage 耦合。
- `lib/client.js:730` 看板分列按裸 `task.status === 'planning'`；`statusLabelOf` 直接映射「执行中」。
- 对照规范：`skills/_templates/work-types.md`「与原生 Trellis 相位映射」表。

## 跳过 analyze 的理由

根因在本次调研阶段已确认并写清证据链（status↔stage 解耦，见上）；修复方案已与用户确认（读路径阶段感知相位 + 写路径一致性校验 + 看板/徽标按解析相位展示）。按 trellis-issue 的「跳过 analyze」通道执行，证据将同步写入 fix-note。
