---
name: trellis-spec-bootstrap
description: "初始化或扩展项目工程规范（Spec）：分析代码仓库架构，按包与分层组织规范，并规划任务。适用于新项目或尚无 Trellis spec 的既有项目。"
---

# trellis-spec-bootstrap

使用本技能在项目中搭建或扩充 `.trellis/spec/` 规范体系，为工作流中的 `trellis-before-dev`、`trellis-check` 和 `trellis-update-spec` 提供权威规则基准。

## 初始化三步走

| 步骤 | 目标 | 具体产物 | 核心要求与注意事项 |
|---|---|---|---|
| 1. 深入剖析代码仓库 | 识别系统真实分包（packages）、分层逻辑（api/service/model）与核心入口 | 记录当前真实的目录与代码事实 | 严格以代码事实为准，**严禁凭空捏造不存在的虚假架构层** |
| 2. 建立分层规范结构 | 为核心分层建立入口规范与开发前检查清单 | `.trellis/spec/<package>/<layer>/index.md` | 承载**开发前检查清单**与**质量验收门禁**；细则以同级 md 呈现 |
| 3. 沉淀全局通用约定 | 提取跨模块的通用规则与错误处理 | `.trellis/spec/guides/index.md` | 记录全局通用编码与提交约定 |

## 推荐的 Spec 规范目录树

```text
.trellis/spec/
├── guides/
│   ├── index.md            # 全局跨模块工程指引索引
│   └── conventions.md      # 命名、代码风格与 Git 规范
└── <package>/<layer>/
    ├── index.md            # 核心入口：开发前检查清单 (Pre-dev) 与质量门 (Check)
    ├── error-handling.md   # 该层错误处理与返回结构约定
    └── rules.md            # 具体的业务或分层调用约束
```

## 硬性卡点

1. **规范必须严格映射真实代码结构**：严禁凭空空想假大空的规则；让规则在后续具体任务中自然演进与积累。
2. **先搭骨架，不搞大而全**：初次只需搭建核心模块的最小骨架，后续通过真实任务打磨淬炼。
3. **明确记录架构层级的决策理由**：确保后续团队或 Agent 扩充时保持一致的风格。
