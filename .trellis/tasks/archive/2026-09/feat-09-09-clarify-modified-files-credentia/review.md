# Feature Code Review

status: passed   # missing | passed | blocking

## Diff 范围
- `lib/git.js`（action 措辞、新错误码、引导段）
- `lib/task.js` / `lib/archive.js`（传 action + 透传 gitCheck）
- `lib/index.js`（两工具参数描述 + output schema + execute 返回）
- `lib/types/index.d.ts`（TrellisGitCheck + 两 Result 类型）
- `test/git.test.js` / `test/index.test.js`（断言更新 + 新增用例）

## 发现
| 级别 | 问题 | 文件 | 建议 |
|------|------|------|------|
| Info | 病态 `modified_files` 输入如 `"./"` 会被 `normalizeRelPath` 丢弃（校验退化为全局），而 task/archive 仍报 `scoped: true`——纯理论失配，真实文件路径无害 | `lib/git.js` / `lib/task.js` / `lib/archive.js` | 保持现状，非必改 |

## 验证证据
- 独立子代理审查：判定 `passed`，无 blocking 发现；5 项契约逐条核对成立。
- 错误码：scoped 失败 → `[trellis/git_declared_dirty]`（git.js:207）；全局脏 → `[trellis/git_dirty]`（:224）；未提交历史 → `[trellis/git_uncommitted]`（:243）。
- action 措辞：git.js:158 计算；task.js:908 传 `'complete'`、archive.js:194 传 `'archive'`；缺省中性回退。
- 引导段：git.js:160-162 构建、:227 追加（含 `modified_files`、`不会写入 task.json`、`再次传入`）。
- 描述澄清：index.js:610 / :740 两处一致（NOT persisted）。
- gitCheck：schemas（index.js:629-641 / :757-769）、record 透传（task.js:929 / archive.js:230-233）、d.ts（:184 / :192-195 / :211）；失败路径均 `gitCheck: null`。
- 向后兼容：既有全局脏 `[trellis/git_dirty]` 断言全部保留有效；仅 `git.test.js:180`（scoped 脏）改为新错误码。
- `pnpm test` 全量 94/94 通过（92 既有 + 2 新增）。

## 结论
- [x] 通过（含 `trellis-check` 与任务要求的验证）
- [ ] 需修复后重审
