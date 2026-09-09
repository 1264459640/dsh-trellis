# Feature Design: 提升 modified_files 局部校验的可发现性

status: draft
execution_lane: quick

## 目标与非目标

### 目标
让 Agent 在"工作区存在无关未提交改动"时能主动通过 `modified_files` 完成/归档任务，而非只能 commit/stash：
1. 改写 `trellis_task_update` / `trellis_task_archive` 的 `modified_files` 参数描述，讲清局部校验语义；
2. `trellis-finish-work` 技能补"局部放行"指引；
3. work-types 模板补一条用法；
4. README / README_EN 补记 rc.8 行为。

### 非目标
- 不改 `lib/git.js` 逻辑，不加配置开关，不动 CHANGELOG。

## 方案

### 边界
- 纯文档/描述改动，挂载点：
  - `lib/index.js`（两处工具参数描述，`replace_all` 已应用）
  - `skills/trellis-finish-work/SKILL.md`（Confirm commit state 步骤下补充 Scoped relaxation 段）
  - `skills/_templates/work-types.md`（归档条目追加一句）
  - `README.md` / `README_EN.md`（Git 干净度校验条目改写）

### 数据流
```text
Agent 收尾时工作区有无关改动
  └─ tool schema.description 已说明 modified_files 局部校验
       → Agent 提交任务自身文件后传 modified_files
          → checkGitCleanliness 限缩校验，清单外放行（告警）
```

### 契约变更
- 无逻辑契约变更。工具参数 schema 不变（仍是 array of string，仍可选）；仅 description 文案变化。
- 风险位：若未来有测试对 description 做快照断言会破坏——当前已 grep 确认无此断言。

### 取舍
- 描述保持中英混合（与既有工具描述风格一致，主要在英文语义上补充）。

## 验证计划
1. `pnpm test` 全量通过（92 用例）。
2. 人工核对 4 个文件的改后文案语义准确、双语一致。

## 风险与回滚
- 无逻辑风险；回滚即 revert 本批文档改动（`git revert`）。

## 人审检查点
- [ ] 用户确认后进入实现收尾（本任务改动已就位，确认即走 review/check）。