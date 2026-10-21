---
name: trellis-continue
description: "恢复已暂停或已归档的 Trellis 会话：根据活跃任务与运行时状态判断当前所处阶段，并自动加载匹配的工作流技能继续推进。"
---

# trellis-continue

当会话重启、用户说“继续”、“恢复任务”或工作区已有活跃任务时，精准恢复既有上下文，避免脱离状态盲目从头开始。

## 执行步骤与路由速查

1. **识别当前活跃任务**：
   - 查阅项目运行时会话状态文件 `.trellis/.runtime/sessions/*.json` 获取 `current_task` 路径；
   - 或直接调用内置工具 `trellis_state` 获取当前活跃任务 slug。
2. **推导当前所处阶段 (Phase) 与下一步**：
   - 打开任务元数据文件 `.trellis/tasks/<slug>/task.json` 查看 `work.type`、`status`、`work.stage` 及当前文件。
   - 对照下表精准衔接下一步动作：

| 任务状态与产物现状 | 对应相位 (Phase) | 下一步动作 | 推荐加载技能 |
|---|---|---|---|
| 无绑定任务 / session 指针为空 | `no_task` | 评估用户诉求，征求同意是否新建任务 | `trellis-start` |
| `status: "planning"` 且无 prd 或 prd 未完善 | `planning` | 补齐需求事实、验收标准与 Non-goals | `trellis-brainstorm` |
| `status: "planning"` 有 prd，无 design 或未确认 | `planning` | 补充技术设计，汇报总结并等用户明确批准 | `trellis-feat` 或 `trellis-refactor` |
| `status: "in_progress"`，代码未写完 | `in_progress` | 研读规范与步骤，按 `task.json.steps` 写代码 | `trellis-before-dev` |
| `status: "in_progress"`，代码已完成但未全体验证 | `in_progress` | 运行 lint、类型检查和自动化测试，就地修复 | `trellis-check` |
| 测试全绿通过，准备提交与收口 | `completed` | 沉淀新经验到 spec、规范提交代码并归档 | `trellis-finish-work` |

## 硬性卡点

1. **已有活跃任务绝不重复新建**：顺着既有任务继续推进，除非用户明确要求放弃当前任务。
2. **以磁盘产物事实为准**：恢复判断必须建立在 `task.json` 和任务目录下的实际文件内容之上，严禁仅凭单轮回话凭空猜想。
3. **重大诉求变更退回规划**：若用户的核心诉求发生重大变化，必须退回 `trellis-brainstorm` 重新评审规划，绝不能基于过时产物强行施工。
4. **保留历史资产**：任务归档仅移动目录，严禁物理删除历史任务数据。
