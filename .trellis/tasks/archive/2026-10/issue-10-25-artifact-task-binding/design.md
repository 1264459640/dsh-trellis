# 技术方案：修复产物写入目标的会话绑定解析

## 方案概述

采用最小改动：在 `lib/artifact.js` 的 `createArtifactUpdateTool.execute` 边界，将宿主执行上下文中的 `exec.agent.session.id` 归一化为 `updateTaskArtifact` 已使用的 `exec.sessionId`；同时让底层函数本身兼容两种上下文形态，避免直接调用测试/调用方因上下文字段不同再次踩坑。

推荐的解析优先级：

```js
const sessionId =
  typeof exec.sessionId === 'string'
    ? exec.sessionId
    : exec.agent && exec.agent.session && typeof exec.agent.session.id === 'string'
      ? exec.agent.session.id
      : undefined
```

实际实现保持简洁，避免引入新的 session resolver 模块。`args.slug` 显式传入时继续优先使用显式目标，不读取会话 pointer。

## 数据流

1. `trellis_task_create`：从 `exec.agent.session.id` 获取 session ID，写入 `.trellis/.runtime/sessions/<session>.json`，其 `current_task` 指向新任务。
2. `trellis_artifact_update`：接收同一宿主执行上下文，归一化 session ID。
3. `updateTaskArtifact`：未传 slug 时调用 `findActiveTaskSlug(root, sessionId)`，读取当前会话 pointer。
4. 通过安全路径校验并写入 `.trellis/tasks/<新 slug>/prd.md`。

## 修改边界

- 预计修改：`lib/artifact.js`。
- 新增/修改测试：优先放入 `test/task-binding.test.js`，通过已注册工具验证真实外部接缝；如测试结构更适合，也可在 `test/native-steps.test.js` 增加 artifact 工具测试。
- 不修改 `lib/task.js` 的 pointer 写入和解析规则。

## 回归测试设计

测试场景：

- 当前会话为 `session-current`。
- canonical `dsh-session.json` 指向 `issue-10-20-old`。
- 当前会话 pointer 指向 `issue-10-21-new`。
- 通过真实注册的 `trellis_artifact_update` 工具调用 `{ artifact: 'prd.md', content: '# PRD' }`，不传 slug。
- 断言返回的 `slug === 'issue-10-21-new'`，新任务目录存在内容，旧任务目录没有本次产物。

保留已有覆盖：

- 显式 slug 写入指定任务。
- 无 session ID 的底层调用仍按 canonical pointer 解析。
- `assertSafeArtifactPath` 的路径安全约束不回退。

## 验证命令

```text
node --test test/task-binding.test.js
node --test test/native-steps.test.js
node --test
```

若宿主 PowerShell 执行器仍不可用，需使用可用的本机 Node 入口执行同样命令；在未获得跑红/跑绿证据前不得宣称修复完成。

## 风险与回滚

- 风险：调用方传入了与 `exec.agent.session.id` 不同的 `exec.sessionId`。因此保留 `exec.sessionId` 优先级，兼容已有直接调用方；宿主工具路径可使用 agent session ID。
- 风险：无 session ID 的调用行为变化。方案明确保留 undefined，继续走 canonical fallback。
- 回滚：仅回滚 `lib/artifact.js` 的 session ID 归一化和新增回归测试即可，不影响任务数据格式。
