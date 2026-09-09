# Feature PRD: 支持基于 modified_files 的局部 Git 校验 (Scoped Git Cleanliness Check)

## 背景
当前 Trellis 在完成任务（`trellis_task_update`）或归档任务（`trellis_task_archive`）时，强制要求 Git 工作区完全干净（无任何未提交变更）。这导致在并行开发、存在临时试验代码、或有其它任务改动时，开发者必须频繁执行 `git stash` 才能顺利完成或归档当前任务。
当用户或 Agent 在归档/完成时显式提供了 `modified_files`（任务修改文件清单）时，系统应当支持将 Git 干净度校验限制在声明的文件范围内，只要声明的文件均已干净提交，即放行任务完成与归档。

## 范围

### In Scope
1. **作用域校验（Scoped Cleanliness Check）**：
   - 在 `lib/git.js` 的 `checkGitCleanliness` 中：
     - 若未提供 `modifiedFiles`（或为空数组）：保持原有行为，强制要求工作区全局干净（无任何未提交变更）。
     - 若提供了非空的 `modifiedFiles` 列表：
       1. 检查工作区中与 `modifiedFiles` 匹配的文件：如果有任何声明的文件存在未提交的修改（dirty），坚决拦截并报错；
       2. 工作区中**不在** `modifiedFiles` 列表内的其他修改文件允许存在，不予阻塞；
       3. 校验 `modifiedFiles` 中的文件是否均已在最近的 Git 提交历史（`git log`）中出现；
       4. 若有被豁免的其他未提交文件，返回结构中附带 `warning` 提示。
2. **工具集成**：
   - 保证 `trellis_task_update` 和 `trellis_task_archive` 工具调用 `checkGitCleanliness` 时正确透传与反馈。
3. **单元测试与覆盖**：
   - 在 `test/git.test.js` 和 `test/index.test.js` 中补充基于 `modified_files` 局部放行与拦截的测试用例。

### Out of Scope
- 不修改 Trellis 内部自带的忽略路径（如 `.trellis/.runtime/`）。
- 不引入跨分支合并或自动提交行为（依然由开发者/Agent 主动 `git commit`）。

## 验收标准
- [ ] 当未传递 `modified_files` 时，工作区存在任何未提交文件均返回失败（`[trellis/git_dirty]`）。
- [ ] 当传递了 `modified_files` 时：
  - [ ] 若 `modified_files` 内的文件在工作区中存在未提交改动，返回失败（指示声明的文件未提交）；
  - [ ] 若 `modified_files` 内的文件在 Git 历史中未被提交，返回失败（`[trellis/git_uncommitted]`）；
  - [ ] 若 `modified_files` 内的文件均已提交且工作区相应文件干净，但工作区存在清单之外的未提交改动，**校验通过（clean: true）**，且返回 warning 提醒；
  - [ ] 若工作区全局干净且声明文件已提交，校验通过。
- [ ] `trellis_task_archive` 与 `trellis_task_update` 工具在传入 `modified_files` 时遵循上述作用域校验逻辑。
- [ ] 所有既有测试与新增测试全部通过。

## 约束与风险
- **路径规范化**：`modified_files` 的路径可能包含反斜杠或 `./` 前缀，必须经过 `normalizeRelPath` 统一处理后再进行匹配。
- **风险防范**：必须确保清单内文件的提交真实性（Git commit 倒查），防止漏提。
