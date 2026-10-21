---
name: trellis-session-insight
description: "解读运行时会话与任务状态：深度诊断 Trellis 工作流当前所处位置，包括活跃任务、状态、相位及诊断信息。"
---

# trellis-session-insight

在采取行动前，使用本技能通过对磁盘运行时资产的精准探测，掌握 Trellis 工作流的准确当前状态。

## 状态存储位置（事实源）

| 事实源维度 | 对应文件 / 工具 | 重点检查内容 |
|---|---|---|
| **会话运行时文件** | `.trellis/.runtime/sessions/*.json` | 记录当前会话绑定的 `current_task` 路径（哪个任务处于活跃状态） |
| **任务定义元数据** | `.trellis/tasks/<slug>/task.json` | 宏观 `status`（planning / in_progress / completed）、`work.type` / `work.stage`，以及原生步骤清单 `steps` |
| **步骤推进详情** | `task.json.steps` | 步骤状态（pending / in_progress / verifying / blocked / completed）与验证模式（ai / human） |
| **规划与交付产物** | `.trellis/tasks/<slug>/` 目录 | `prd.md`、`design.md`、`review.md`、`report.md` 及 `research/` 资料 |
| **工作流每轮面包屑** | 系统自动注入的 `[workflow-state:STATUS]` 块 | 当前会话注入的运行时工作流提示 |

## 相位推导映射表

| 宏观状态 / 运行时事实 | 对应相位 (Phase) | 含义与行动准则 |
|---|---|---|
| 无绑定任务 / session 指针为空 | `no_task` | 当前无任务；只能做轻量问答或征得用户同意建新任务 |
| 任务已建，处于规划阶段 | `planning` | 规划方案期；只读保护已开启，需完善方案等用户批准，禁止改业务代码 |
| 任务方案已获批，进入实施 | `in_progress` | 编码阶段；按步骤清单单步推进实现与测试验证 |
| 任务全部实施完毕并已归档 | `completed` | 完工收口；准备或已完成归档 |

## 结合产物事实做综合判断

在做出状态判断时必须结合产物事实：
- 若复杂任务标记为 `planning` 但缺少 `design.md` 或步骤清单，说明方案尚未就绪；
- 若处于 `in_progress` 且业务代码改动尚未提交，则必须先完成提交方能标记完成或归档。

## 硬性卡点

1. **会话文件是“哪个任务活跃”的绝对事实源**：即使磁盘存在任务目录，只要会话指针未绑定，就属于 `no_task`。
2. **拒绝孤立看待面包屑字符串**：在关键决策时务必通过 `trellis_state` 或直接查阅任务元数据与磁盘产物事实予以确证。
