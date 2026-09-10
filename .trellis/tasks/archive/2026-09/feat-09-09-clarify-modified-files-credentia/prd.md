# Feature PRD: 澄清 modified_files 语义 + 报错信息可操作化

## 背景
rc.8 引入 scoped git check 后，`trellis_task_update` / `trellis_task_archive` 的 `modified_files` 仅作为**本次调用的 Git 局部校验凭据**（传给 `checkGitCleanliness` 后即弃），**不写入 task.json**。由此暴露三类问题：

1. **语义不可见**：Agent 调用 `trellis_task_update(modified_files=[3 个代码文件])` 返回 `ok: true`，但检查 task.json 找不到该字段，误判为"参数被吞"——工具描述从未说明它不落盘。
2. **失败无引导**：update 阶段的放行不延续到 archive。归档时未再传 `modified_files`，工作区无关改动导致失败，错误仅说"请先提交这些文件"，未提示可传 `modified_files` 局部放行。
3. **报错无法程序化区分**（用户本轮确认需调整）：
   - "声明清单内文件本身未提交"（`lib/git.js:199`）与"工作区整体脏"（`lib/git.js:215`）**共用同一错误码 `[trellis/git_dirty]`**，但两者补救动作完全不同；
   - 两处都笼统写"再**完成或归档**任务"，而 `checkGitCleanliness` 不知道调用方是 update 还是 archive。

## 范围

### In Scope
1. **区分两类 git_dirty 错误码**（`lib/git.js`）：
   - scoped 失败（清单内文件本身未提交，`:191-203`）→ 新错误码 `[trellis/git_declared_dirty]`，措辞明确"你声明的文件本身未提交"；
   - 全局脏（未传清单，`:207-219`）→ 保持 `[trellis/git_dirty]`。
2. **按调用点定制措辞**（`lib/git.js` + 两个调用方）：
   - `checkGitCleanliness` 新增 `options.action`（`'complete' | 'archive'`，缺省时保持中性"完成或归档"以兼容直接调用者/测试）；
   - `lib/task.js:907` 传 `action: 'complete'`，`lib/archive.js:194` 传 `action: 'archive'`；
   - 报错据此输出"完成任务前…"/"归档任务前…"。
3. **失败引导段**（`lib/git.js` 全局脏分支）：
   - 追加提示：若未提交改动与任务无关，可传 `modified_files` 声明任务实际改动文件做局部校验（清单内须已提交、清单外放行仅告警）；该参数为调用期凭据、不写入 task.json，需在完成/归档时**再次传入**。
4. **参数描述澄清**（`lib/index.js:610` / `:726`）：
   - 明确 `modified_files` 是一次性调用期校验凭据，**不会写入 task.json、不改变任务元数据**；保留既有 scoped 语义说明。
5. **返回值回显**（两工具 output schema `lib/index.js:613-634` / `:729-747`）：
   - 新增 `gitCheck: { scoped: boolean, warning?: string | null }`，仅在校验成功路径附带；`lib/task.js` / `lib/archive.js` record 函数透传。
6. **类型同步**（`lib/types/index.d.ts:166` `TrellisTaskUpdateResult` / `:186` `TrellisTaskArchiveResult`）增加 `gitCheck`。
7. **测试**：
   - 更新 `test/git.test.js:180`（scoped 失败断言改为新错误码）；
   - 新增：action 措辞断言、引导段关键词断言、`gitCheck` 回显断言、描述关键短语断言；
   - 确认不受影响的既有断言保持原样：`test/git.test.js:190`、`test/index.test.js:732` / `:753` / `:811`（全局脏）、`:792`、`test/git.test.js:140` / `:147` / `:203`（uncommitted）。

### Out of Scope
- 不改 `lib/git.js` 的**判定逻辑**（仅错误码、措辞、文案）。
- 不改参数名（避免破坏 rc.8/rc.9 已发布用法）。
- 不做 `modified_files` 持久化、不做跨调用自动复用（用户已明确选"增强提示文案"，未选自动复用）。
- 不细化 `[trellis/git_uncommitted]`（`:233`）成因说明、不做三段式结构统一（本轮未选）。

## 验收标准
- [ ] 清单内文件未提交时报 `[trellis/git_declared_dirty]`，且文案指向"声明的文件本身未提交"；工作区整体脏时仍报 `[trellis/git_dirty]`。
- [ ] `trellis_task_update(status=completed)` 失败文案含"完成任务前"；`trellis_task_archive` 失败文案含"归档任务前"；直接调用 `checkGitCleanliness` 不传 action 时保持中性措辞。
- [ ] 全局脏失败文案含引导段（可传 `modified_files` 局部校验 + 调用期凭据不落盘 + 需再次传入）。
- [ ] 两工具 `modified_files` 描述含"不写入 task.json"语义。
- [ ] 两工具成功返回含 `gitCheck`（`scoped` 正确反映是否走局部校验）。
- [ ] `pnpm test` 全量通过（既有 92 + 新增，其中 `test/git.test.js:180` 已更新）。

## 约束与风险
- 错误码变更属**面向 Agent 的文本契约**：新码 `[trellis/git_declared_dirty]` 不影响既有 `[trellis/git_dirty]` 消费方（scoped 分支原本就少见），但需同步唯一受影响断言 `test/git.test.js:180`。
- `options.action` 为可选参数，缺省中性措辞 → 对测试与任何直接调用者零破坏。
- output schema 新增 `gitCheck` 为 additive，不删既有字段。
- 回滚：`git revert` 本批改动即可（无数据迁移、无持久化字段）。