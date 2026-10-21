---
name: trellis-continue
description: "恢复中断或既有的 Trellis 任务：根据当前任务的 stage 和产物状态，判断下一步该做什么并继续执行。"
---

# trellis-continue

当会话重启、用户说“继续”、“恢复任务”或已有活跃任务时使用。

## 恢复步骤与路由

1. **查当前任务**：调内置工具 `trellis_state` 或读取 `.trellis/.runtime/sessions/*.json` 获取 `current_task`。
2. **查进度与产物**：打开任务目录 `.trellis/tasks/<slug>/task.json` 查看 `work.type`、`status`、`work.stage` 及各文件。
3. **对照下表接续**：

| 任务状态与产物现状 | 当前所处阶段 | 下一步动作 | 推荐加载技能 |
|---|---|---|---|
| 无活跃任务（`current_task: null`） | `no_task` | 征求用户意见是否建新任务 | `trellis-start` |
| `planning`，无 prd 或 prd 未完善 | prd | 补齐需求与验收标准 | `trellis-brainstorm` |
| `planning`，有 prd，无 design 或未确认 | design | 补充方案，汇报并等用户批准 | `trellis-feat` 或 `trellis-refactor` |
| `in_progress`，代码未写完 | impl / fix / apply | 看步骤清单写代码 | `trellis-before-dev` |
| `in_progress`，代码已写完未验证 | review / check | 跑测试和 lint，就地修复 | `trellis-check` |
| 所有验证已通过，准备提交/收工 | finish | 规范沉淀、git commit、任务归档 | `trellis-finish-work` |

## 硬性卡点

1. **已有任务绝不重复新建**：顺着未完成的任务继续做，不要重新开新任务。
2. **以磁盘产物事实为准**：不要只凭上一句话记忆，以 `task.json` 和目录下的 markdown 真实内容为准。
