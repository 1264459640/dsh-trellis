---
name: trellis-finish-work
description: "收尾已完成或已归档的 Trellis 任务：确认 Git 工作区干净、执行规范提交、归档任务目录并沉淀研发日志与索引。"
---

# Trellis Finish Work（任务完结与收口归档）

当任务实施验证完毕、准备标记完成或归档时运行本技能。

## 执行步骤

1. **确认 Git 提交状态**：
   - 若工作区存在未提交的改动，必须先完成业务代码的提交——绝不要将簿记/日志提交与实际业务改动混在一起。
   - 注意：`trellis_task_update(status: 'completed')` 与 `trellis_task_archive` 内置了严格的 Git 干净度硬门禁；若工作区存在未提交的代码改动，操作将被拒绝。
   - **作用域放宽机制（Scoped relaxation）**：若工作区存在与当前任务无关的未提交改动（如并行任务、临时实验等），可在调用上述工具时通过 `modified_files` 参数传入本任务实际涉及的文件列表。门禁将只校验这些文件是否已干净提交，允许列表外的改动以告警形式通过。
2. **执行标准提交流**：
   - 顺序为：业务实现提交（Work commit） $\to$ 任务归档提交（Archive commit） $\to$ 研发日志提交（Journal commit）。
   - 除非用户明确要求，否则绝不擅自执行 `git push`。
3. **安全归档已完成的任务**：
   - 处于 `status=completed` 的任务应从活跃看板移出。
   - 必须通过 `trellis_task_archive` 工具执行归档：它会自动将 `.trellis/tasks/<slug>/` 移动至对应月份的归档桶 `.trellis/tasks/archive/<yyyy-mm>/<slug>/`，并自动解绑会话指针。
   - 归档是**移动目录并持久化存储**，严禁直接物理删除任务目录。严禁手动搬运文件夹或手写 session 文件。
4. **沉淀研发日志与索引**：
   - 在研发月报 `.trellis/journal/<yyyy-mm>.md` 中追加本次任务交付摘要，更新索引文件。
5. **正式完结汇报**：
   - 告知用户任务已成功收口，并明确指出归档记录与代码提交的落脚点。

## 守则与红线

- 严禁执行 `git commit --amend` 篡改历史。
- 先提交业务代码，再提交工作流簿记文件，顺序绝对不能颠倒。
- 若用户选择手动自行执行 git commit，在用户确认后直接跳到收尾汇报，不要强行重复提出提交计划。
