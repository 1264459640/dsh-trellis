# 修复记录：创建任务后 PRD 写入其他任务

## 根因

`trellis_task_create` 从 `exec.agent.session.id` 获取会话 ID，并把新任务绑定到当前会话 pointer；而 `trellis_artifact_update` 在未显式传 `slug` 时只读取 `exec.sessionId`。宿主执行上下文中没有该顶层字段时，产物解析退回项目级 canonical pointer，可能命中旧任务。

## 修改

- 修改 `lib/artifact.js`：未传 `slug` 时兼容解析 `exec.sessionId` 和 `exec.agent.session.id`，再按会话 pointer 查找活动任务。
- 修改 `test/task-binding.test.js`：增加真实注册工具接缝回归测试，覆盖旧 canonical 任务与当前会话新任务并存、无 slug 写 PRD、显式 slug 仍优先且不改变绑定。

## 验证

1. 修复前跑红：
   - `node --test --test-name-pattern="artifact tool writes PRD" test/task-binding.test.js`
   - 实际返回旧任务 `issue-10-20-old`，期望当前会话任务 `issue-10-21-new`。
2. 修复后目标相关测试通过：4/4。
3. 全量测试通过：
   - `node --test`
   - `223` passed，`0` failed。

## 范围说明

未修改任务创建、绑定、看板摘要、canonical pointer 语义，也未迁移历史上已经写错的产物文件。

## 规范检查

- 回归测试通过真实注册的 `trellis_artifact_update` 工具，断言用户可观察的写入目录和会话绑定，不依赖内部函数调用次数。
- 未引入调试日志、配置项或额外抽象。
- `package.json` 未定义单独 lint/type-check 脚本；本项目可用的质量门为全量 `node --test`，已通过。