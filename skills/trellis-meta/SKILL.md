---
name: trellis-meta
description: "修改 Trellis 工作流机制：定制 workflow.md 状态提示、配置生命周期钩子（hooks）、调整阶段流转逻辑。"
---

# trellis-meta

用于修改 Trellis 自身工作方式、面包屑提示或扩展流程钩子。

## 定制项与操作方法

| 想改什么 | 怎么改 | 配置示例 / 文件位置 |
|----------|--------|----------------------|
| 1. 每轮提示词（面包屑） | 编辑项目 `.trellis/workflow.md` 里的状态块 | `[workflow-state:STATUS]` 内容支持针对项目自定义 |
| 2. 增加自定义状态 | 在 `workflow.md` 中追加新的状态块 | 如 `[workflow-state:qa_testing]`，标识符只用英文字母、数字和横杠 |
| 3. 配置自动化钩子 | 在 `task.json` 中配置 `hooks` 字段 | `"hooks": { "after_finish": ["pnpm run notify"] }` |
| 4. 任务产物模板 | 修改 `.trellis/templates/` 下的模板文件 | 定制项目专属的 `prd.md`、`design.md` 格式 |

## 支持的生命周期钩子事件

- `after_create`：建任务完成后触发
- `after_start`：任务切入 `in_progress` 时触发
- `after_finish`：标记 `completed` 时触发
- `after_archive`：归档完成后触发

## 硬性卡点

1. **不能破坏核心安全机制**：任何定制都不能绕过“未经用户同意禁止自动改代码”的原则。
2. **状态标识符限制**：自定义状态名只能包含字母、数字、下划线和连字符（`[A-Za-z0-9_-]+`）。
