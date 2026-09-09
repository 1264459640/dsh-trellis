# Feature PRD: 提升 modified_files 局部校验的可发现性

## 背景
rc.8 引入了基于 `modified_files` 的局部 Git 校验：调用 `trellis_task_update(status: 'completed')` 或 `trellis_task_archive` 时显式传入 `modified_files`，干净度校验就限缩到清单内文件，清单外未提交改动放行（仅告警）。但实际使用中 Agent 几乎从不主动传 `modified_files`，因为：
1. 工具参数描述只有一句 "Optional list of modified files for this task."，完全没有说明"传入即启用局部校验、可放行清单外改动"的行为；
2. 收尾技能（`trellis-finish-work`）明确声称是 "hard git cleanliness guardrail"、工作区不允许未提交改动——反向强化"必须全提交/stash"的认知，从不提 `modified_files` 通道；
3. README / README_EN 未记录 rc.8 的局部校验行为，文档断代。

目标：让 Agent 在工作区存在无关未提交改动时，能主动调用 `modified_files` 完成/归档任务，而不是只能依赖 commit 或 stash。

## 范围

### In Scope
1. **工具参数描述改写**（`lib/index.js`）：
   - `trellis_task_update` 与 `trellis_task_archive` 的 `modified_files` 参数描述改为说明：传入后 Git 干净度校验限缩到清单内文件；清单外未提交改动不再阻塞，仅告警；未传时保持全局严格校验（工作区必须干净）。
2. **收尾技能补充指引**：
   - `skills/trellis-finish-work/SKILL.md`：在"Confirm commit state"步骤补充——若工作区存在与任务无关的未提交改动，可传 `modified_files` 声明任务文件完成局部校验；任务文件本身仍必须先提交。
   - `skills/_templates/work-types.md`：在归档/收工条目处补一句 `modified_files` 局部校验用法。
3. **README 文档补记**：
   - `README.md` 与 `README_EN.md`：在 Git 干净度校验功能说明处补记 rc.8 的局部校验行为（传 `modified_files` 限缩校验范围，清单外放行仅告警）。

### Out of Scope
- 不改动 `lib/git.js` 的校验逻辑本身（rc.8 已实现并验收）。
- 不新增配置开关（该功能是行为驱动的，无需开关）。
- 不更新 CHANGELOG（版本发布流程另行处理）。

## 验收标准
- [ ] `lib/index.js` 中两个工具的 `modified_files` 描述包含"局部校验/放行清单外改动"语义。
- [ ] `skills/trellis-finish-work/SKILL.md` 包含推荐 `modified_files` 局部校验的做法。
- [ ] `skills/_templates/work-types.md` 归档条目提及 `modified_files` 用法。
- [ ] `README.md` 与 `README_EN.md` 记录 rc.8 局部校验行为。
- [ ] 全量测试 `pnpm test` 通过（不破坏既有行为）。

## 约束与风险
- 纯文档/描述改动，无逻辑变更风险；工具描述改写后需确认既有测试（若有 description 快照断言）不破坏。
- 技能与 README 为多文件协同，注意中英文双语一致性。