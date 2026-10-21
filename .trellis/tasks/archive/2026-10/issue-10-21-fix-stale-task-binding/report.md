# Bug 报告：创建任务后偶发绑定过去任务

## 用户报告

创建任务后有概率绑定到过去的 task。尚未取得发生问题的具体会话、旧/新 slug 或操作日志，因此不能把下面已复现的缺陷等同于用户现场的唯一原因。

## 期望行为

创建新任务 B 成功后，当前会话绑定 B。单纯更新另一任务 A 的标题、阶段、步骤等，不应隐式切换当前会话绑定；先前开始的旧任务更新也不得覆盖新绑定。

## 当前会话核对

2026-10-21 创建本 issue，创建工具返回绑定到本 issue 的会话指针；随后 trellis_state 确认 activeTask 为 `.trellis/tasks/issue-10-21-fix-stale-task-binding`，phase=planning。本次创建本身未复现绑定错误。

## 已稳定复现的路径

在 PowerShell 中通过 `node --input-type=module -` 执行内存文件系统脚本，调用真实的 `createTaskRecord`、`updateTaskRecord`、`findActiveTaskSlug`。未改动源码、业务文件或真实会话指针。

### 场景一：更新旧任务隐式切换绑定

1. 同一 session 创建旧任务 A。
2. 同一 session 创建新任务 B。
3. 读取绑定并断言为 B，断言通过。
4. 显式传 A 的 slug 更新 A 的标题。
5. 再次读取绑定，实际为 A，期望仍为 B。

实测输出：

```text
PASS: create(new) binds this session to new task
{"afterExplicitOldTaskUpdate":"issue-10-20-old","expected":"issue-10-21-new"}
AssertionError: Updating an old task must not silently rebind the current session away from the newly-created task
[exit code: 1]
```

### 场景二：在途旧更新晚完成

1. 创建 A；开始不传 slug 的更新，让更新从当前绑定解析到 A。
2. 用 Promise 门闩暂停在 A 的 task.json 写入处，不依赖 sleep 或随机时间。
3. 创建 B 并确认当前绑定 B。
4. 放行旧更新。
5. 当前绑定被改回 A。

实测输出：

```text
{"sequence":["start update(old), slug omitted","create(new) succeeds","old update completes"],"actual":"issue-10-20-old","expected":"issue-10-21-new"}
AssertionError: An in-flight old update must not overwrite a newer binding
[exit code: 1]
```

这两个非零退出都是预期的复现断言失败，不是环境错误。

## 范围和约束

- 当前仅调查并制定方案，用户仅批准创建任务，尚未批准实施。
- 不清理历史任务，不手写真实 runtime 指针，不改动既有未提交内容。
- 修复后需同时核对真实绑定与 Web 摘要，避免只修磁盘而界面仍显示旧任务。
- 缺少 sessionId 的兼容回退以及前端过期响应仍属其他候选路径，尚未证明与用户现场相关。
