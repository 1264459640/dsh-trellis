# Issue Report

## 现象
创建新任务后，调用 `trellis_artifact_update` 撰写 PRD，PRD 偶尔被写入同一项目中的另一个旧任务目录，而不是刚创建并绑定到当前会话的新任务。

## 复现步骤
1. 在同一项目中先存在旧任务，并让项目级 canonical runtime 指针（`dsh-session.json`）指向旧任务。
2. 在当前会话创建新任务；创建逻辑会把新任务写入当前会话专属指针文件。
3. 不显式传 `slug`，调用 `trellis_artifact_update` 写入 `prd.md`。
4. 观察返回的 `slug` 与文件实际写入目录：预期为当前会话新任务，实际可能解析为 canonical 指针中的旧任务。

## 期望 vs 实际
- 期望：未显式指定 `slug` 时，产物写入目标必须从执行该工具的当前会话绑定任务解析。
- 实际：`createArtifactUpdateTool.execute` 将 `exec` 原样传入 `updateTaskArtifact`，而 `updateTaskArtifact` 读取的是 `exec.sessionId`；宿主执行上下文中的会话 ID 位于 `exec.agent.session.id`。因此默认解析拿不到会话 ID，退回项目级 canonical 指针，导致跨任务写入。

## 影响范围
- 主要影响创建任务后同一会话撰写 PRD/阶段产物且未显式传 `slug` 的流程。
- 显式传入正确 `slug` 的写入不受该问题影响。
- 可能污染旧任务产物，且不会修改任务绑定本身，问题表现为产物目标解析错误。

## 证据
- `lib/index.js` 创建工具显式从 `exec.agent.session.id` 提取 `sessionId` 后传给 `createTaskRecord`。
- `lib/artifact.js` 的工具执行路径直接调用 `updateTaskArtifact(ctx.fs, root, args, exec, sandboxPolicy)`，没有做同样的会话 ID 归一化。
- `lib/artifact.js:updateTaskArtifact` 在未传 `args.slug` 时调用 `findActiveTaskSlug(dshFs, root, exec.sessionId)`。
- 项目规范明确要求：产物默认 slug 跟随会话绑定任务；会话绑定任务与写入目标不一致时应显式传 slug，且工具实现必须避免默认解析到其他任务。
