---
name: trellis-issue
description: "Bug 修复工作流：处理缺陷、异常与回归问题，推进 report -> analyze -> fix -> fix-note。不可用于新功能（使用 trellis-feat）或重构（使用 trellis-refactor）。"
---

# trellis-issue

处理 Bug 修复、异常排查与回归缺陷的工作流。

## 启动

1. **若无活跃任务**：征得用户同意后，用内置工具 `trellis_task_create` 创建：
   ```json
   trellis_task_create({
     "workType": "issue",
     "title": "修复 xxx 报错",
     "name": "简短英文名",
     "mode": "standard"
   })
   ```
2. **若已有活跃任务**：加载 `trellis-continue` 恢复上下文。
3. **状态与阶段流转**：使用内置工具 `trellis_task_update`（如 `status="in_progress", stage="fix"`）。

## 阶段机与执行步骤

| 条件 | 当前阶段 (stage) | 核心动作 | 产物与工具 | 下一步 |
|------|------------------|----------|------------|--------|
| 无 `report.md` | report | 记录复现步骤、报错日志、期望行为与实际行为 | `report.md` | analyze 或 fix |
| 根因复杂/不明确 | analyze | 顺着调用栈和数据流追查根本原因，写明佐证代码 | `analysis.md` | 确认根因后进 fix |
| 根因已明确 | report/analyze | 确认修复思路；调 `trellis_task_update` 将状态切为 `in_progress` | `task.json.status="in_progress"` | fix |
| 正在修复代码 | fix | 依最小改动原则修复根因，加载 `trellis-before-dev` | 修改代码 | fix-note |
| 修复完成 | fix-note | 记录改动点、验证方式（测试命令/抓包截图）与潜在影响 | `fix-note.md` | finish |
| fix-note 齐备 | finish | 跑测试验证 `trellis-check` → 规范沉淀 `trellis-update-spec` → 归档 `trellis-finish-work` | commit / archive | 完成 |

> **关于跳过 analyze**：仅当问题原因一眼看清（如拼写错误、少传一个已知参数）且在 `report.md` 中已有完整代码证据时，才可跳过 analyze 直接进入 fix。若同一个 Bug 修复两次以上仍复发，必须停下加载 `trellis-break-loop` 彻底复盘。

## 产物清单

所有产物落在 `.trellis/tasks/<slug>/` 目录下：
- `report.md`：Bug 现象、稳定复现步骤、错误堆栈与环境。
- `analysis.md`：根因定位、数据流断点、为什么之前会出错（简单问题可省）。
- `fix-note.md`：实际改了哪些文件、如何验证通过、残留风险。

## 硬性卡点

1. **没有稳定复现步骤或确凿日志前，禁止盲猜改代码**。
2. **严禁借修 Bug 夹带大面积重构**：若改动超出 Bug 范畴，转由 `trellis-feat` 或 `trellis-refactor` 处理。
3. **高风险修复（涉及支付、鉴权、数据迁移、核心缓存）必须先与用户简短确认方案**，再切入 `in_progress`。
4. **未写 `fix-note.md` 或未通过 `trellis-check` 测试前，禁止归档任务**。
