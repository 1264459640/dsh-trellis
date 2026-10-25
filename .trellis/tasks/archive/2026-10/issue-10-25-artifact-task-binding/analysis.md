# Root Cause Analysis

## 当前结论

最可能的根因是**执行上下文的会话 ID 没有传入产物写入逻辑**：

- 任务创建工具在 `lib/index.js` 中从 `exec.agent.session.id` 提取会话 ID，并把它传给 `createTaskRecord`。
- 产物工具在 `lib/artifact.js` 中直接把 `exec` 传给 `updateTaskArtifact`。
- `updateTaskArtifact` 在未显式传 `slug` 时只读取 `exec.sessionId`。
- 实际宿主执行上下文使用的是 `exec.agent.session.id`，所以这里可能拿不到当前会话 ID。
- `findActiveTaskSlug` 在缺少会话 ID 时会退回项目级 canonical 指针；当 canonical 指针仍指向旧任务时，PRD 就会写入旧任务目录。

这与“创建完任务后，写 PRD 写到另一个任务”完全吻合，也符合项目规范中关于“产物默认 slug 必须跟随会话绑定任务”的约定。

## 可证伪假设

1. **H1（首选）：artifact 工具未归一化 `exec.agent.session.id`。**
   - 预测：构造同时存在 canonical 旧任务和当前会话新任务的内存文件系统，调用未传 `slug` 的 artifact 工具；写入结果会落到旧任务。将会话 ID 显式放入 `exec.sessionId` 后，结果会落到新任务。

2. **H2：创建工具和 artifact 工具使用了不同的 session pointer 文件命名或解析规则。**
   - 预测：即使 artifact 获得正确的 `sessionId`，仍然无法读取创建工具刚写入的会话指针；对比 `sessionFileBasename` 和 `findActiveTaskSlug` 的路径会发现不一致。

3. **H3：创建完成后的异步摘要刷新覆盖了绑定。**
   - 预测：当前会话指针实际已经指向新任务，但摘要刷新或旧读回写把指针/默认目标改回旧任务；直接读取指针文件应能观察到新任务仍被绑定，因此该假设可排除。

4. **H4：模型实际调用时没有显式传递 slug，属于调用契约问题而非宿主 bug。**
   - 预测：所有无 slug 调用都稳定依赖当前会话绑定；若工具执行上下文确实只提供 `exec.agent.session.id`，则工具实现必须负责兼容该宿主契约，不能要求模型重复传递本可确定的 slug。

## 反馈闭环与当前阻塞

应新增一个外部接缝回归测试：通过已注册 `trellis_artifact_update` 工具，先创建旧任务，再创建当前会话新任务，同时保留 canonical 指针指向旧任务，然后无 slug 写入 `prd.md`，断言返回 slug 和实际文件均为新任务。

已尝试运行回归入口：

```text
node --test test/task-binding.test.js
```

但当前执行器无法启动 PowerShell（`spawn ...\\Microsoft\\WindowsApps\\pwsh.exe ENOENT`），因此尚未取得跑红输出。该环境问题不改变代码证据，但在进入 fix 前仍需恢复可运行的测试命令并先看到红灯。

## 修复方向（待批准后实施）

1. 在 artifact 工具边界统一归一化 session ID：优先使用宿主执行上下文的 `exec.agent.session.id`，兼容已有直接调用方传入的 `exec.sessionId`。
2. 让无 slug 的 artifact 写入始终调用当前会话级 `findActiveTaskSlug`，只有没有会话 ID 时才使用 canonical 解析。
3. 增加回归测试，验证旧任务更新/项目 canonical 指针不会影响当前会话新任务的 PRD 写入。
4. 运行目标测试与全量测试，确认无跨会话回归。
