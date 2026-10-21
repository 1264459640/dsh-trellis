---
name: trellis-refactor
description: "行为等价重构工作流：代码优化、模块拆分与清理，推进 scan -> design -> apply。若改动影响外部可观察行为，转由 trellis-feat 或 trellis-issue 处理。"
---

# trellis-refactor

用于纯内部代码优化、拆分提取、消除坏味道的工作流。**核心铁律：行为严格等价，不改变任何对外业务逻辑与可观察表现。**

## 底线原则：行为等价

- 外部表现（UI 显示、用户交互、API 响应字段、报错提示、路由跳转）**一律不准改变**。
- 一旦重构过程中需要改动业务逻辑或外部接口契约：**立即停止，转为 `trellis-feat`（新需求）或 `trellis-issue`（修 Bug）**。

## 启动

1. **若无活跃任务**：征得用户同意后，用内置工具 `trellis_task_create` 创建：
   ```json
   trellis_task_create({
     "workType": "refactor",
     "title": "重构 xxx 模块",
     "name": "简短英文名",
     "mode": "standard"
   })
   ```
2. **若已有活跃任务**：加载 `trellis-continue` 恢复。
3. **状态流转**：使用内置工具 `trellis_task_update`。

## 阶段机与执行步骤

| 条件 | 当前阶段 (stage) | 核心动作 | 产物与工具 | 下一步 |
|------|------------------|----------|------------|--------|
| 无 `scan.md` | scan | 梳理待清理项、风险点，列出本次重构范围与坚决不动的模块 | `scan.md` | 等用户确认范围 |
| 范围已确认，无 design | design | 制定重构方案与测试保护策略；录入执行步骤清单 | `refactor-design.md`、`task.json.steps` | 等用户批准方案 |
| 方案已获批 | 准备开工 | 调 `trellis_task_update` 将任务状态切为 `in_progress` | `task.json.status="in_progress"` | apply |
| 正在重构中 | apply | 依据步骤单小步改造，加载 `trellis-before-dev`，记录改动与对比证据 | `apply-notes.md` | finish |
| 全部步骤实施完毕 | finish | 运行全量测试 `trellis-check` 验证行为等价 → 必要时 `trellis-update-spec` → 归档 `trellis-finish-work` | commit / archive | 完成 |

> **关于轻量重构（fastforward）**：仅当重构范围局限在单一函数/局部文件、测试完全覆盖且能一秒回滚时，可将 scan 与 design 合并为极简说明。

## 产物清单

所有产物落在 `.trellis/tasks/<slug>/` 目录下：
- `scan.md`：现状分析、坏味道盘点、本次纳入范围与排除范围。
- `refactor-design.md`：目标结构、抽离方式、测试覆盖与保护措施。
- `apply-notes.md`：每一步的具体代码变动记录与回归验证结果。
- `task.json.steps`：由 `trellis_task_update` 维护的执行步骤清单。

## 硬性卡点

1. **先加测试保护再动手重构**：若原逻辑没有单测覆盖，重构前尽量先补关键行为测试，锁住预期结果。
2. **方案未获用户确认前，严禁切 `in_progress` 并修改代码**。
3. **步骤中标记为 `verification: human` 的，必须等待用户确认后才能标记完成**。
4. **全量测试未全部绿灯前，禁止归档任务**。
