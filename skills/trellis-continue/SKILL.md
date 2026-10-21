---
name: trellis-continue
description: "恢复已暂停或已归档的 Trellis 会话：根据活跃任务与运行时状态判断当前所处阶段，并自动加载匹配的工作流技能继续推进。"
---

# Trellis Continue（工作流断点续接）

使用本技能干净利落地恢复既有的 Trellis 任务会话，避免脱离上下文盲目从头开始。

## 执行步骤

1. **识别当前活跃任务**：
   - 查阅项目运行时会话状态文件（`.trellis/.runtime/sessions/`），获取 `current_task` 路径，或调用 `trellis_state` 工具获取当前活跃 slug。
2. **推导当前所处相位（Phase）**：
   - 无活跃任务（`no_task`） $\to$ 需求分流，加载 `trellis-start`；
   - 处于规划期（`planning`）且产物尚未获批 $\to$ 加载 `trellis-brainstorm` 执行规划门禁；
   - 处于实施中（`in_progress`） $\to$ 按流程加载 `trellis-before-dev`（编码前）或 `trellis-check`（检验中）；
   - 处于已完成（`completed`）或有未提交脏改动 $\to$ 加载 `trellis-finish-work` 执行收尾。
3. **加载匹配的技能并续接**：
   - 从该相位对应的下一步骤精准继续，顺畅承接上下文。

## 守则与红线

- 除非用户明确要求，严禁将卡住或已归档的任务作为全新任务重复创建。
- 妥善保留任务目录资产——归档仅移动目录，绝不物理删除历史记录。
- 若用户的核心诉求发生重大变化，必须退回 `trellis-brainstorm` 重新评审规划，不可基于过时产物强行施工。
