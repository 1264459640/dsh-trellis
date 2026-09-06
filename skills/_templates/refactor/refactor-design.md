# Refactor Design

status: draft   # draft | approved
mode: standard   # standard | fastforward

## 行为等价声明
本重构 **不改变** 外部可观察行为（UI 结果、协议、缓存语义、错误语义）。若会改变 → 转 feat/issue。

## 方案
-

## 执行步骤
- 重构执行步骤清单由 `task.json.steps` 唯一承载（规划期通过 `trellis_task_update` 的 `steps` 参数录入），
  每步标注 `acceptance`（量化验收标准）与 `verification`：
  - `verification: 'ai'` → 该步由模型/自动化验证（`verified: true` + `verifiedBy: 'ai'`）；
  - `verification: 'human'` → 该步必须经用户明确确认（`verifiedBy: 'human'`）才能完成，是人卡点。
- 验证命令按项目 `.trellis/spec/` 质量门记录；纯文档改动注明无需运行验证。

## 验证计划
- 可执行验证命令（行为等价断言 / 测试入口）：
  1.

## 风险与回滚
-

## 人审
- [ ] 设计已获用户确认（status=approved）
