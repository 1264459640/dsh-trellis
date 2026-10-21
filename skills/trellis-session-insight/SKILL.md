---
name: trellis-session-insight
description: "解读运行时会话与任务状态：深度诊断 Trellis 工作流当前所处位置，包括活跃任务、状态、相位及诊断信息。"
---

# Trellis Session Insight（会话状态诊断与洞察）

在采取行动前，使用本技能通过对磁盘运行时资产的精准探测，掌握 Trellis 工作流的准确当前状态。

## 状态存储位置（事实源）

- **会话运行时文件**：`.trellis/.runtime/sessions/*.json`；记录当前会话绑定的 `current_task` 路径。
- **任务定义元数据**：`.trellis/tasks/<slug>/task.json`；包含宏观 `status`（`planning` / `in_progress` / `completed`）、轨道 `work.type` / `work.stage`，以及原生步骤清单 `steps`（支持 `pending` / `in_progress` / `verifying` / `blocked` / `completed` 状态与 `verification` 验证模式）。
- **规划与交付产物**：任务目录下的 `prd.md`、`design.md`（如有）、`review.md` 及 `research/` 资料。
- **工作流每轮面包屑**：系统自动探测并注入的 `[workflow-state:STATUS]` 块。

## 相位推导映射

| 宏观状态 / 运行时事实 | 对应相位（Phase） |
|---|---|
| 无绑定任务 / session 指针为空 | `no_task` |
| 任务已建，处于规划阶段 | `planning` |
| 任务已获批，开始实施写码 | `in_progress` |
| 任务归档完结 | `completed` |

在做出判断时必须结合产物事实：若复杂任务标记为 `planning` 但缺少 `design.md` 或步骤清单，则方案尚未就绪；若处于 `in_progress` 且代码改动未提交，则必须先完成提交方能完工。

## 守则与红线

- **会话文件是“哪个任务活跃”的绝对事实源**：即使磁盘存在任务目录，只要会话指针未绑定，就属于 `no_task`。
- 绝不要仅仅孤立地看待 `<workflow-state>` 字符串，在关键决策时务必通过 `trellis_state` 或直接查阅任务元数据确证产物。
