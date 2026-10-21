---
name: trellis-meta
description: "定制 Trellis 工作流自身：修改 workflow.md 面包屑提示、增加自定义状态、挂载生命周期勾子或调整技能与代理配置。当用户需要改变工作流运作机制时使用。"
---

# Trellis Meta（工作流元定制）

使用本技能直接对 Trellis 工作流机制本身进行定制或扩展（而非在工作流内执行具体业务任务）。

## 允许定制的维度

- **每轮面包屑提示文本**：编辑 `.trellis/workflow.md` 中对应的 `[workflow-state:STATUS]` 块，`STATUS` 字符集保持 `[A-Za-z0-9_-]+`。
- **扩展自定义状态**：增加新的 `[workflow-state:my-status]` 块，并通过生命周期勾子写入 `task.json.status`。
- **挂载生命周期勾子**：在任务配置中声明 `hooks` 字段：
  ```json
  { "hooks": { "after_finish": ["your-command-here"] } }
  ```
  支持的生命周期事件包括：`after_create / after_start / after_finish / after_archive`。
- **调整技能、代理与上下文加载**：在项目共享技能目录与代理配置中进行灵活扩充。

## 守则与红线

- 面包屑是每轮对话精准识别工作流相位的唯一事实通道；必须确保所有 `[required · once]` 步骤在对应相位的 `[workflow-state:*]` 块中均可到达。
- 无论如何定制流程，Phase 1 永远必须严格遵守“创建任务前征得用户同意”的铁律。
- 规划阶段必须清晰区分轻量 PRD 任务与需要完整架构方案拆解的复杂任务。
- 必须清晰记录对元工作流的任何修改，确保对状态块的增删改查透明可见。
