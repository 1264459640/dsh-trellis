# PRD：修复创建任务后 PRD 写入其他任务

## 目标与用户价值

修复创建新 Trellis 任务后，当前会话撰写 PRD/阶段产物却写入旧任务目录的问题，确保默认产物写入目标始终是执行该工具的当前会话所绑定任务，避免任务文档污染和后续流程错乱。

## 已确认事实

- `trellis_task_create` 从 `exec.agent.session.id` 获取当前会话 ID，并将新任务绑定到该会话的 pointer 文件。
- `trellis_artifact_update` 的底层 `updateTaskArtifact` 在未传 `slug` 时读取 `exec.sessionId`。
- 工具执行上下文的会话 ID 位于 `exec.agent.session.id`；两条路径的字段口径不一致。
- 缺少会话 ID 时，`findActiveTaskSlug` 会回退项目级 canonical pointer；该 pointer 可能仍指向旧任务。
- 项目规范要求：产物默认 slug 必须跟随会话绑定任务；更新任务数据不能隐式切换会话绑定。

## 纳入范围

1. 在产物工具边界统一解析会话 ID，优先兼容宿主执行上下文 `exec.agent.session.id`，同时保留已有 `exec.sessionId` 直接调用兼容性。
2. 增加外部接缝回归测试：旧 canonical 任务 + 当前会话新任务并存时，无 slug 写入 `prd.md` 必须落到新任务。
3. 运行目标测试和相关全量测试，确认不破坏显式 slug、无会话 canonical fallback 及跨会话隔离。

## 不纳入范围

- 不改变任务创建、绑定、看板摘要或 canonical pointer 的既有语义。
- 不要求模型必须显式传 slug；默认目标解析仍由宿主负责。
- 不新增抽象层、配置项、迁移脚本或批量修复历史上已错误写入的文件。
- 不修改 PRD 内容模板或任务阶段状态机。

## 验收标准

- 当前会话已绑定新任务、项目 canonical pointer 指向旧任务时，调用 artifact 工具且不传 slug：返回 `slug` 为新任务，`prd.md` 只存在于新任务目录。
- 显式传入 slug 时，仍写入显式目标，且不会改变任何会话绑定。
- 没有 session ID 的底层调用仍保留既有 canonical fallback 语义。
- 相关测试全部通过，且没有未清理的调试日志。

## 阻塞性开放问题

无。