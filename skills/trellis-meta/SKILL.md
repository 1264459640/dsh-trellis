---
name: trellis-meta
description: "定制 Trellis 工作流自身：修改 workflow.md 面包屑提示、增加自定义状态、挂载生命周期勾子或调整技能与代理配置。当用户需要改变工作流运作机制时使用。"
---

# trellis-meta

使用本技能直接对 Trellis 工作流机制本身进行定制或扩展（而非在工作流内执行具体业务任务）。

## 允许定制的维度与配置方法

| 定制目标 | 怎么修改 | 配置示例 / 文件位置 | 核心约束 |
|---|---|---|---|
| **1. 每轮提示词（面包屑）** | 编辑项目 `.trellis/workflow.md` 中对应的 `[workflow-state:STATUS]` 块 | 修改状态说明与指导文字 | `STATUS` 字符集必须保持 `[A-Za-z0-9_-]+` |
| **2. 扩展自定义状态** | 在 `workflow.md` 中增加新的 `[workflow-state:my-status]` 块 | 通过内置工具或钩子写入 `task.json.status` | 确保状态在会话生命周期中可到达 |
| **3. 挂载自动化生命周期钩子** | 在任务配置中声明 `hooks` 字段 | `"hooks": { "after_finish": ["pnpm run notify"] }` | 见下方支持的事件清单 |
| **4. 产物模板个性化** | 修改 `.trellis/templates/` 下的模板文件 | 定制项目专属的 `prd.md`、`design.md` 或 `review.md` 格式 | 保持必要的核心段落结构 |
| **5. 调整技能与代理配置** | 在项目共享技能目录与代理配置中灵活扩充 | `.agents/skills/` 与环境配置 | 保持团队与 Agent 上下文一致 |

## 支持的生命周期钩子事件

- `after_create`：任务创建完成后触发；
- `after_start`：任务切入 `in_progress` 时触发；
- `after_finish`：任务标记为 `completed` 时触发；
- `after_archive`：任务移动至归档目录后触发。

## 硬性卡点

1. **不能绕过核心安全准则**：无论如何定制工作流，创建任务前必须先征得用户明确同意，方案未获批准严禁改动业务代码。
2. **面包屑完整性**：必须确保所有 `[required · once]` 步骤在对应相位的 `[workflow-state:*]` 块中均可到达。
3. **规划深度区分**：定制时必须清晰区分轻量 PRD 任务与需要完整架构方案拆解的复杂任务。
4. **修改透明留痕**：必须清晰记录对元工作流的任何修改，确保对状态块的增删改查透明可见。
