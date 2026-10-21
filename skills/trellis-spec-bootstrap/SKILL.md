---
name: trellis-spec-bootstrap
description: "初始化或扩展项目工程规范（Spec）：分析代码仓库架构，按包与分层组织规范，并规划任务。适用于新项目或尚无 Trellis spec 的既有项目。"
---

# Trellis Spec Bootstrap（工程规范体系初始化）

使用本技能在项目中搭建或扩充 `.trellis/spec/` 规范体系，为工作流中的 `trellis-before-dev`、`trellis-check` 和 `trellis-update-spec` 提供权威规则基准。

## 执行步骤

1. **深入剖析代码仓库**：
   - 识别系统分包、逻辑分层与核心代码热点：系统入口、错误处理机制、既有编码风格、README 与既有开发文档。
2. **建立分层规范结构**：
   - `.trellis/spec/<package>/<layer>/index.md`：核心入口，承载**开发前检查清单（Pre-Development Checklist）**与**质量验收门禁（Quality Check）**；具体细则以同级引用的 Markdown 文件呈现（如 `error-handling.md`、`conventions.md` 等）。
   - `.trellis/spec/guides/index.md`：跨模块的全局工程思维与指导手册。
3. **沉淀实事求是的初始约定**：
   - 严格从仓库当前真实运转的代码事实出发，切忌空想假大空的规则；让规则在后续具体任务中自然演进与积累（参见 `trellis-update-spec`）。
4. **基于新架构规划后续任务**：
   - 确立清晰的分层边界，为后续功能迭代打下坚实的地基。

## 守则与红线

- 严禁凭空捏造与实际代码脱节的虚假架构层级；规范组织必须严格映射真实的目录与代码结构。
- 工程规范是鲜活演进的资产：先搭建最小骨架，通过真实任务不断打磨淬炼。
- 明确记录架构层级的决策理由，确保后续扩充保持风格统一。
