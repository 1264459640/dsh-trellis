---
name: trellis-spec-bootstrap
description: "初始化或扩展项目工程规范（Spec）：分析代码仓库架构，按包与分层组织规范，并规划任务；也支持把已有 Docs/ADR/Domain/Quality 体系迁移接入 Trellis。适用于新项目、尚无 Trellis spec 的既有项目，或需要配置 `.trellis/doc.json` 的项目。"
---

# trellis-spec-bootstrap

使用本技能在项目中搭建或扩充项目规范体系，为工作流中的 `trellis-before-dev`、`trellis-check` 和 `trellis-update-spec` 提供权威规则基准。

## 分支选择

- **初始化分支**：项目没有可复用文档体系，或用户明确要新建规范 → 按下面的“初始化三步走”建立最小 Spec。
- **迁移分支**：项目已有权威 Docs/ADR/Domain/Quality → 只写 `.trellis/doc.json` 接入现有文档，不搬运、不改写正文。
- 两类项目同时存在且用户未说明时，只问一个“迁移既有 Docs 还是初始化新 Spec”的选择题。

## 文档入口配置

`.trellis/doc.json` 统一描述运行时注入与 Skill 使用的文档位置：

```json
{
  "root": ".trellis/spec",
  "files": [
    ".trellis/spec/guides/index.md"
  ]
}
```

这里要区分两种写法：`$root/guides/index.md` 是 **Skill 查找文档时的路径模板**，默认 root 下解析为 `.trellis/spec/guides/index.md`；而 `files` 中必须写实际的完整项目相对路径，不能写 `$root/...`。

- `files` 是运行时注入白名单：每项为项目根相对的 Markdown 完整路径，支持多个，按配置顺序展示并去重。只注入文件，不注入目录或正文。
- `root` 是 Skill 元数据：默认 `.trellis/spec`，供本技能和 `trellis-update-spec` 作为文档发现与沉淀的默认根目录；root 不拼接、不限制 files，也不改变运行时注入。
- 未配置 `.trellis/doc.json` 时按默认 root 扫描；显式配置后未列入 files 的旧 Spec 不再作为注入依据。
- 显式配置无效时不会静默回退旧 Spec，而是提示修复。新增需要注入的文档时，必须同步加入 files。

## 初始化三步走

| 步骤 | 目标 | 具体产物 | 核心要求与注意事项 |
|---|---|---|---|
| 1. 深入剖析代码仓库 | 识别系统真实分包（packages）、分层逻辑（api/service/model）与核心入口 | 记录当前真实的目录与代码事实 | 严格以代码事实为准，**严禁凭空捏造不存在的虚假架构层** |
| 2. 建立分层规范结构 | 为核心分层建立入口规范与开发前检查清单 | `$root/<package>/<layer>/index.md` | 承载**开发前检查清单**与**质量验收门禁**；细则以同级 md 呈现 |
| 3. 沉淀通用约定 | 提取跨模块的通用规则与错误处理 | `$root/guides/index.md` | 记录通用编码与提交约定 |
| 4. 登记注入清单 | 写 `.trellis/doc.json`，让新建规范真正进入上下文 | 默认 `root: ".trellis/spec"`，files 列出实际创建且需注入的 Markdown | 只写文件路径；已有配置先报告并征得确认，不静默覆盖 |

## 推荐的 Spec 规范目录树

```text
$root/
├── guides/
│   ├── index.md            # 共享工程指引索引
│   └── conventions.md      # 命名、代码风格与 Git 规范
└── <package>/<layer>/
    ├── index.md            # 核心入口：开发前检查清单 (Pre-dev) 与质量门 (Check)
    ├── error-handling.md   # 该层错误处理与返回结构约定
    └── rules.md            # 具体的业务或分层调用约束
```

## 迁移分支：接入既有 Docs

目标：让 Trellis 读取项目已有的权威文档，不修改业务文档正文。

1. **有界发现**：查看 `docs/agents/`、`docs/README.md`、`docs/index.md`、`docs/adr/`、`docs/domain/`、`docs/quality/`、项目 `README.md` 和 `GLOSSARY.md` 等常见入口；跳过依赖、构建产物、归档与依赖目录。
2. **区分文档站首页与 Agent 入口**：人类 Docs 首页不一定包含 Agent 的读取顺序；优先选择能导航到 ADR、Domain、Architecture、Quality、UI 的入口，并展示导航缺口。
3. **确认多文件清单**：支持用户确认一个或多个实际 Markdown 文件。`root` 写主文档体系根目录；`files` 写每个文件的项目根相对完整路径，可跨目录。
4. **只写配置**：只更新 `.trellis/doc.json`；不要移动旧 Spec、复制 Docs 或生成映射表。
5. **写后验证**：读回 JSON，逐个确认文件存在且为 Markdown，并说明实际注入文件；不静默回退旧 Spec。

## 硬性卡点

1. **规范必须严格映射真实代码结构**：严禁凭空空想假大空的规则；让规则在后续具体任务中自然演进与积累。
2. **先搭骨架，不搞大而全**：初次只需搭建核心模块的最小骨架，后续通过真实任务打磨淬炼。
3. **明确记录架构层级的决策理由**：确保后续团队或 Agent 扩充时保持一致的风格。
4. **不修改业务文档正文**：迁移只改配置；初始化只创建最小规范骨架。
5. **files 是唯一注入范围**：新增需要注入的文档必须同步加入 files；目录、通配符和隐式扫描都不算配置。
6. **root 只用于 Skill 路径拼接**：不要把 root 用于运行时 files 的拼接或过滤，也不要让 root 改变注入结果。
7. **显式配置失败不降级**：坏配置应报告并修复，不能悄悄回退旧 Spec。
