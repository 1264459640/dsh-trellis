# Feature Design Review: 原生执行步骤清单、验收门禁与规划期产物写入保护

status: passed

## 审查范围
- 需求文档：`.trellis/tasks/feat-09-05-native-steps-guard/prd.md`
- 架构设计文档：`.trellis/tasks/feat-09-05-native-steps-guard/design.md`
- 关联代码基线与契约：
  - `lib/task.js`（任务定义、状态流转与门禁拦截）
  - `lib/archive.js`（任务归档与完结校验）
  - `lib/breadcrumb.js`（面包屑注入与高信噪比调速）
  - `lib/state.js`（多工种 TRACKS 轨道定义）
  - `skills/_templates/`（各工作类型原生交付模版）

---

## 复审评估结论

在初审提出的 3 项关键问题后，设计负责人已对 `design.md` 完成了严密的修复与迭代：
1. **P0 白名单缺漏死锁修复**：已完整补齐 `report.md`、`refactor-design.md`、`apply-notes.md`，彻底解决了 `issue` 与 `refactor` 工种在规划期无法编写交付物的物理死锁；
2. **P0 步骤批量录入通道补齐**：`trellis_task_create` 与 `trellis_task_update` 均已正式支持 `steps: TaskStep[]` 批量入参，规划期可合规落盘步骤清单；
3. **P1 工种泛化修复**：规划期只读保护泛化为 `task.status === 'planning'`，执行期步骤注入泛化为 `task.status === 'in_progress'`，实现全工种通配；
4. **P2 内存级去重明确**：明确采用 `stepInjectedCache: Map<sessionId, string>` 纯内存判重，杜绝 `agent/pre-step` 频繁写盘。

---

## 结论
- [x] 通过，可进入实现 (passed)
- [ ] 阻塞，需改 design (blocking)
