# Fix Note — 重构模式 scan 阶段被视为执行中

任务：`issue-09-06-refactor-scan-readonly`
报告：见 `report.md`（现象、复现、根因证据链；本任务跳过 analyze 的理由已记录于报告）。

## 根因（一句话）

相位/授权/展示的解析链路只认 `task.status`、完全忽略 `task.work.stage`，且 `trellis_task_create` /
`trellis_task_update` 不校验 status↔stage 耦合，因此 refactor 落在 `status=in_progress, stage=scan`
时被当作执行中：只读授权放开、徽标/看板显示执行中。

## 改动清单

| 文件 | 改动 |
|------|------|
| `lib/state.js` | 新增 `stagePhase(workType, stage)`（按 `TRACKS` 把规划型/写码型阶段分类）与 `phaseForTask(task, inline)`（阶段感知相位，`completed` 恒胜，未知回退 `phaseFor`） |
| `lib/index.js` | `resolveProjectState`、`trellis_task_create`/`trellis_task_update` 返回与 Web 徽标缓存统一改用 `phaseForTask`；移除死变量 `status` |
| `lib/task.js` | 写路径加固：`validateCreateArgs` 拒绝「规划型阶段 + status=in_progress」；`updateTaskRecord` 按合并后的 status/stage 校验同一约束 |
| `lib/board.js` | board 记录新增解析后的 `phase` 字段（客户端分列/标色不再读裸 status） |
| `lib/client.js` | `statusLabelOf` → `phaseLabelOf`（兼容 -inline 相位）；看板三列改按 `task.phase`/`archived` 过滤；详情「状态」行显示解析相位 |
| `test/state.test.js` | 新增：`stagePhase` 全轨道分类、`phaseForTask` 状态漂移自愈、inline 变体、回退、completed 恒胜 |
| `test/index.test.js` | 新增：`validateCreateArgs` 拒绝组合、`updateTaskRecord` 合并态拒绝；`readTask`/`buildBoard` 断言 `phase` 字段 |
| `.trellis/spec/trellis-workflow/task-engine/index.md` | 重述只读保护为「授权状态机 + 阶段感知相位」；新增已知坑「status 与 work.stage 必须强耦合」 |

## 验证

- 单进程断言 29 项全部通过（覆盖 state/readonly/task/board 全链路）：
  - refactor `scan`/`design` + `status=in_progress` → 相位 `planning`（缺陷修复核心）；
  - `apply` + `in_progress` → `in_progress`；issue/feat 轨道逐阶段断言；
  - 只读授权链：scan 相位 → `planning` 授权 → 工具面保留 `read`/`pwsh`/`trellis_artifact_update`，
    剔除 `write`/`edit`；
  - 写路径：create 拒绝 `scan+in_progress`；update 仅翻 status 或仅翻 stage 均拒绝；`scan→apply`
    推进放行；
  - board 记录与 `buildBoard` 携带 `phase`。
- 变更文件 `node --check` 语法检查全部通过。
- 沙箱限制说明：`node --test` 在本会话沙箱下因子进程 spawn EPERM 无法运行，已用单进程断言
  等价覆盖；完整测试套件请在正常环境执行 `pnpm test`。

## 兼容性与自愈

- 存量任务无需迁移：读路径阶段感知，磁盘上残留的 `status=in_progress + stage=scan` 组合会自动按
  planning 解析；后续任何写操作会被一致性校验拦截纠正。
- `authorizationOf` / `allowedToolsFor` 授权策略本体未改，仅输入相位改为阶段感知，`readonly.test.js`
  既有用例不受影响。

## 债务 / 后续

- README 的 `enforceReadonlyPlanning` 段落仍为高层描述（规划期裁剪 write/edit），语义未失真，暂不改；
  若未来细化文档可补充「阶段感知」说明。
- `lib/types/index.d.ts` 未涉及新相位值，无需变更。
