# Feature Design Review

status: passed

## 审查范围
- `prd.md` 需求基线与验收标准；
- `design.md` 架构方案、数据契约、状态流转图、门禁机理、自动修剪机制与测试策略。

## 发现
| 级别 | 问题 | 建议 |
| :--- | :--- | :--- |
| Suggestion | `blockedReason` 字段在 `applyStepUpdate` 中建议作为可选字段但强提示，避免模型切至 `blocked` 时漏记原因 | 在 `validateStepUpdate` 中支持 `blockedReason` 字符串校验，并在面包屑高亮展示 |
| Info | 运行时自动修剪废弃模板使用 `fs.unlinkSync`，需确保严格受控在当前项目 allowlist 范围内 | 复用 `isPathUnder` / `assertPolicyAllowsWrite` 进行沙箱越权与路径穿越双重防御，保持与 `archive.js` 同等的安全强度 |
| Info | 向后兼容性方面，旧任务既有的 `verify: true` 需在所有读取和判断处透明映射为 `verification: 'ai'` | 已在 `design.md` §1.2 明确定义判定逻辑：`st.verification === 'ai' || st.verify === true`，无缝兼容 |

## 审查检查点核验
- [x] **数据模型契约**：5 态状态机（`pending/in_progress/verifying/blocked/completed`）与验证主体（`none/ai/human`）正交解耦，状态转移图完整，无不可逆死锁；
- [x] **硬门禁设计**：
  - AI 验证门禁：未置 `verified: true` 物理拦截标记 `completed`；
  - Human 验证门禁：未经人工确认（`verifiedBy === 'human'`）物理拦截标记 `completed`；
  - 完结门禁：任何未 `completed` 步骤阻止完结主任务；
- [x] **架构正交性**：彻底消灭清单双写，移除 `implement.md`（收拢入 `design.md`）与 `checklist.yaml`（收编入 `steps`）；
- [x] **自动修剪安全性**：硬编码 4 个模板相对路径，仅作用于模板目录，严格保护历史任务与项目源码；
- [x] **测试策略完备**：覆盖单测、门禁、注入、修剪与全量回归。

## 结论
- [x] 通过，可进入实现
- [ ] 阻塞，需改 design
