---
name: trellis-spec-bootstrap
description: "在项目中初始化 .trellis/spec/ 代码规范体系：梳理项目真实目录分层，建立开发前检查与测试质检清单。"
---

# trellis-spec-bootstrap

当新项目接入 Trellis 或项目尚无规范骨架时使用。快速提炼仓库现有代码约定并落盘。

## 初始化三步走

| 步骤 | 目标 | 具体产物 | 要点 |
|------|------|----------|------|
| 1. 扫描代码现状 | 搞清分包（packages）与分层（如 api/service/model） | 记录实际目录树 | 严格以真实代码结构为准，不空想不存在的架构层 |
| 2. 建立模块规范 | 为核心模块建立规范入口 | `.trellis/spec/<package>/<layer>/index.md` | 写明：动手前看什么、质量验收命令（跑什么测试/lint） |
| 3. 补充全局指引 | 提取全局通用约定 | `.trellis/spec/guides/` | 如统一错误处理、日志规范等 |

## 规范目录推荐结构

```text
.trellis/spec/
├── guides/
│   └── conventions.md      # 全局通用编码与提交约定
└── <package>/<layer>/
    ├── index.md            # 本层动手前检查清单与质量验收命令
    └── rules.md            # 具体的模块约定（如接口签名、错误格式）
```

## 硬性卡点

1. **实事求是**：只记录当前仓库正在生效的真实模式，严禁抄写脱离项目的假大空教条。
2. **先搭骨架，不搞大而全**：初次只需搭建核心模块的最小骨架，后续做任务时通过 `trellis-update-spec` 按需逐步补充。
