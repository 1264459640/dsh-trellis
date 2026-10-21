---
name: trellis-session-insight
description: "排查当前 Trellis 状态：看绑定了哪个活跃任务、处于规划还是编码阶段、步骤推进到哪里。"
---

# trellis-session-insight

当不确定当前会话到底绑定了哪个任务、卡在什么阶段时使用。

## 状态文件与事实源

| 要查的信息 | 看哪个文件 / 调什么工具 | 怎么看 |
|------------|-------------------------|--------|
| 当前绑定了哪个任务 | 调 `trellis_state` 或读 `.trellis/.runtime/sessions/*.json` | 看 `current_task` 字段（null 表示无活跃任务） |
| 任务类型与大状态 | 打开对应 `.trellis/tasks/<slug>/task.json` | 看 `status`（planning / in_progress / completed） |
| 当前具体阶段 | 同上 `task.json` | 看 `work.stage`（如 prd、design、impl、fix 等） |
| 执行步骤推进情况 | 同上 `task.json` | 看 `steps` 数组中每一步的 `status` |
| 任务方案与文档产物 | 对应 `.trellis/tasks/<slug>/` 目录 | 查看 `prd.md`、`design.md`、`report.md` 等文件 |

## 状态与下一步速查

| 状态组合 | 当前局面 | 应该做的事 |
|----------|----------|------------|
| `current_task: null` | 无活跃任务 | 征求用户意见是否建新任务 |
| `status: "planning"` | 方案规划中（只读保护） | 写 prd / design，等用户确认方案，禁止改业务代码 |
| `status: "in_progress"` | 编码实施中 | 按照 `steps` 逐步写代码、做测试 |
| `status: "completed"` | 任务已完结 | 准备归档 `trellis_task_archive` |

## 硬性卡点

1. **以会话 session 文件为准**：即使 tasks 目录下有历史任务，只要 session 未绑定，当前就是 `no_task`。
2. **状态必须与文件产物对齐**：若标记为 `in_progress` 但根本没有 prd/design，说明状态错乱，应补齐产物。
