# Feature Design: 支持基于 modified_files 的局部 Git 校验 (Scoped Git Cleanliness Check)

status: approved
execution_lane: quick

## 目标与非目标

### 目标
- 在 `lib/git.js` 的 `checkGitCleanliness(root, options)` 中支持当提供 `modifiedFiles` 且非空时，进行局部作用域过滤校验：
  1. 若 `modifiedFiles` 内的文件存在未提交的修改，报错拒绝。
  2. 若 `modifiedFiles` 内的文件均已提交且工作区相应文件干净，但存在清单外的脏文件，**允许放行并附带 warning**。
  3. `modifiedFiles` 中的文件必须在最近 Git 提交记录中存在（现有逻辑保持）。
- 当未提供 `modifiedFiles` 或为空时，完全保持原有的全局纯净度严格检查。

### 非目标
- 不变更 `trellis_task_update` 和 `trellis_task_archive` 的对外 API 参数签名（均已支持可选的 `modified_files`）。
- 不改变 `.trellis/.runtime/` 的内置忽略策略。

## 方案

### 边界
- 挂载点：`lib/git.js` 中的 `checkGitCleanliness` 函数。
- 调用方：`lib/task.js` (updateTaskRecord) 和 `lib/archive.js` (archiveTaskRecord)。调用方无需修改，自动享受新逻辑。
- 测试覆盖：`test/git.test.js` 与 `test/index.test.js`。

### 校验流程
```text
调用 checkGitCleanliness(root, { modifiedFiles })
  │
  ├─ 1. git status --porcelain -uall 获取工作区 dirty 文件列表 (过滤内部 .trellis/.runtime/)
  │
  ├─ 2. 检查是否有 dirty 文件？
  │     ├─ 无 dirty 文件 ───> 进入提交历史核验
  │     └─ 有 dirty 文件：
  │           ├─ 未提供 modifiedFiles (或为空) ───> 拒绝！返回 [trellis/git_dirty]
  │           └─ 提供了 modifiedFiles：
  │                 ├─ 将 dirty 文件与 normalized modifiedFiles 比对
  │                 ├─ 清单内有文件 dirty ───> 拒绝！返回清单内文件未提交错误
  │                 └─ 清单内所有文件均 clean (只有清单外文件 dirty) ───>
  │                       记录 warning: "工作区存在未包含在 modified_files 中的其他未提交修改，已基于声明列表放行"
  │                       继续进入提交历史核验
  │
  └─ 3. 提交历史核验（若提供 modifiedFiles）
        ├─ 检查 modifiedFiles 是否均在 git log 最近提交历史中
        ├─ 有缺失 ───> 拒绝！返回 [trellis/git_uncommitted]
        └─ 全部存在 ───> 通过！返回 { clean: true, warning: ... }
```

### 契约变更
- 无破坏性变更。
- `checkGitCleanliness` 返回对象：
  - 当因为作用域放行时，返回 `{ clean: true, isGitRepo: true, dirtyFiles: [], uncommittedFiles: [], warning: string }`。

## 验证计划
1. 单元测试 `test/git.test.js`：
   - 测试当工作区存在 dirty 文件且传入包含该 dirty 文件的 `modifiedFiles` 时，拦截失败。
   - 测试当工作区存在 dirty 文件 A，但传入 `modifiedFiles: ['B']`（B 已提交且无未提交修改）时，放行通过，并返回包含 warning 的结果。
   - 测试未传入 `modifiedFiles` 时，工作区存在 dirty 文件 A，依然拦截失败。
2. 集成测试 `test/index.test.js`：
   - 在已存在的 `updateTaskRecord and archiveTaskRecord enforce git cleanliness in git repo` 用例后，追加 scoped 模式下的测试场景。
3. 运行完整测试套件：
   `pnpm test` 或 `node --test test/git.test.js`

## 风险与回滚
- **风险**：路径匹配因大小写或斜杠差异导致误判。
- **对策**：统一使用既有的 `normalizeRelPath` 处理 `entry.path` 与 `modifiedFiles` 中的每一个路径。
- **回滚**：仅修改 `lib/git.js` 内部逻辑，通过 Git 即可直接无副作用还原。

## 人审检查点
- [x] 设计已获用户确认（status=approved）后再进入实现
