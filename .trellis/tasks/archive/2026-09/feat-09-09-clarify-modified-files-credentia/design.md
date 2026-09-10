# Feature Design: 澄清 modified_files 语义 + 报错信息可操作化

status: approved
execution_lane: quick

## 目标与非目标

### 目标
1. 两类 git_dirty 失败用**不同错误码**，让 Agent 能程序化区分补救动作。
2. 失败措辞**按调用点定制**（完成任务前 / 归档任务前）。
3. 全局脏失败追加 **`modified_files` 引导段**。
4. 工具描述澄清 `modified_files` 为**调用期凭据、不落盘**。
5. 成功返回回显 `gitCheck`，同步 d.ts 与测试。

### 非目标
不改判定逻辑、不改参数名、不持久化、不跨调用复用；本轮不细化 `[trellis/git_uncommitted]` 成因、不做三段式结构统一。

## 方案

### 边界与挂载点
| 文件 | 位置 | 改动 |
|------|------|------|
| `lib/git.js` | `:149` `checkGitCleanliness(root, options)` | 新增 `options.action`；JSDoc 同步 |
| `lib/git.js` | `:191-203` scoped 失败分支 | 错误码 → `[trellis/git_declared_dirty]`；措辞定制 |
| `lib/git.js` | `:207-219` 全局脏分支 | 措辞定制 + 追加引导段 |
| `lib/task.js` | `:907` | 传 `action: 'complete'`；成功返回透传 `gitCheck` |
| `lib/archive.js` | `:194` | 传 `action: 'archive'`；成功返回透传 `gitCheck` |
| `lib/index.js` | `:610` / `:726` | 参数描述增补"不落盘"语义 |
| `lib/index.js` | `:613-634` / `:729-747` | output schema 增 `gitCheck`；execute 返回构造带上 |
| `lib/types/index.d.ts` | `:166` / `:186` | 两个 Result 增 `gitCheck` |
| `test/git.test.js` | `:180` | 断言改新错误码（**唯一需改的既有断言**） |
| `test/git.test.js` / `test/index.test.js` | 新增用例 | action 措辞、引导段、`gitCheck`、描述短语 |

### 数据流
```text
trellis_task_archive(slug, modified_files?)
  → validateArchiveArgs 清洗清单
  → checkGitCleanliness(root, { modifiedFiles, action: 'archive' })
      ├─ 清单内文件脏 → error [trellis/git_declared_dirty] + "归档任务前…"
      ├─ 未传清单且工作区脏 → error [trellis/git_dirty] + "归档任务前…" + 引导段
      ├─ 清单内文件不在最近提交历史 → error [trellis/git_uncommitted]（不变）
      └─ 通过 → { clean: true, warning? }
  → 归档移动 + 解绑指针
  → 返回 { …, gitCheck: { scoped, warning } }
```

### 契约变更

**1. 错误码**
| 场景 | 旧 | 新 |
|------|-----|-----|
| 清单内文件本身未提交 | `[trellis/git_dirty]` | `[trellis/git_declared_dirty]` |
| 未传清单、工作区脏 | `[trellis/git_dirty]` | `[trellis/git_dirty]`（不变） |
| 清单文件不在提交历史 | `[trellis/git_uncommitted]` | 不变 |

**2. `options.action` 措辞映射**（缺省保持中性，兼容直接调用者与既有测试）
```js
const ACTION_PHRASE = { complete: '完成任务前', archive: '归档任务前' }
// 缺省 → '完成或归档任务前'
```

**3. 目标文案**
- scoped 失败：
  ```
  [trellis/git_declared_dirty] modified_files 中声明的文件本身存在未提交修改：
    - M lib/foo.js

  请先 git add / git commit 提交上述声明文件，再{action短语}。
  （清单内文件必须已提交；与任务无关的改动无需列入，也不会阻塞。）
  ```
- 全局脏（含引导段）：
  ```
  [trellis/git_dirty] 项目工作区存在未提交的修改文件：
    - M unrelated.js

  请先使用 git add / git commit 提交上述修改后再{action短语}。

  提示：若上述改动与本次任务无关，可传 modified_files 声明本任务实际改动的文件做局部校验
  （清单内文件须已提交；清单外改动放行并告警）。该参数是调用期凭据、不会写入 task.json，
  需在完成任务（trellis_task_update status=completed）或归档（trellis_task_archive）时再次传入。
  ```

**4. output schema 新增 `gitCheck`**（additive）
```json
"gitCheck": {
  "oneOf": [
    { "type": "null" },
    { "type": "object", "additionalProperties": false,
      "properties": { "scoped": { "type": "boolean" },
                      "warning": { "oneOf": [{ "type": "string" }, { "type": "null" }] } } }
  ]
}
```
- 仅"做了 git 校验且成功"的路径附带；失败路径为 `null`（error 已表达）。
- `scoped=true` ⇔ 本次传了非空 `modified_files`。
- `update` 工具在 `status !== 'completed'` 时不做校验 → `gitCheck: null`。

**5. 描述增补**（`lib/index.js` 两处，接在 rc.9 文本后）
> It is a one-shot, call-time credential used only for this call's Git check — it is NOT persisted into `task.json` and does not alter task metadata; pass it again on each completing/archiving call that needs scoped relaxation.

### 取舍
- 引导段放在**共享层** `lib/git.js`（而非两个 record 函数各写一遍）：两调用方自动受益、文案单点维护；代价是措辞需 action 参数化以适配场景。
- 新错误码命名 `git_declared_dirty` 而非 `git_scoped_dirty`：直指"声明的文件脏"这一根因，避免与"scoped 模式"概念混淆。
- `gitCheck` 用对象而非裸字符串：可扩展，且 `scoped` 便于 Agent 判断本次是否走了局部校验。

## 验证计划
1. `pnpm test` 全量（既有 92 + 新增）——**必须确认 `test/git.test.js:180` 已随错误码更新**。
2. 定向断言：
   - `checkGitCleanliness(root, { modifiedFiles: ['dirty.js'] })` → `[trellis/git_declared_dirty]`；
   - `checkGitCleanliness(root, { action: 'archive' })` 脏工作区 → 含"归档任务前" + 含引导段关键词 `modified_files`；
   - `checkGitCleanliness(root, { action: 'complete' })` → 含"完成任务前"；
   - 不传 action → 含"完成或归档任务前"（中性回退）；
   - `archiveTaskRecord(..., { modified_files })` 成功返回 `gitCheck.scoped === true`；
   - `updateTaskRecord(status:'completed')` 无清单成功 → `gitCheck.scoped === false`；
   - 工具描述含 `NOT persisted`。
3. 人工核对：描述 / schema / d.ts / 三类文案四处一致。

## 风险与回滚
- **文本契约变更**：`[trellis/git_declared_dirty]` 是新码；若有外部脚本按 `git_dirty` 前缀匹配 scoped 场景会失配——本仓库内仅 `test/git.test.js:180` 一处，已列入更新清单。
- `options.action` 可选、缺省中性 → 既有调用与测试零破坏。
- `gitCheck` 为 additive 字段 → JSON 消费方无破坏。
- 回滚：`git revert` 单批提交；无数据迁移、无持久化字段、无缓存失效需求。

## 人审检查点
- [x] 设计已获用户确认（status=approved）后进入实现
