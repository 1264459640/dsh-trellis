# dsh-trellis

<!-- Hero -->
<div align="center">
  <b style="font-size: 1.35em;">Trellis 工作流深度集成 · DeepSeek Harness 官方扩展</b><br />
  <sub>先规划后动手 · 单一真理源 · 原生 5 态步骤状态机 · AI/Human 多主体验证门禁 · 阶段可视可控</sub><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Node Version" src="https://img.shields.io/badge/Node.js-≥20-green.svg" />
  <img alt="5-State Machine" src="https://img.shields.io/badge/Steps-5--State%20Machine-blue.svg" />
  <img alt="Two-Phase Gates" src="https://img.shields.io/badge/Gate-Two--Phase%20Commit-success.svg" />
  <img alt="Readonly Planning" src="https://img.shields.io/badge/Security-Readonly%20Planning-red.svg" />
  <br /><br />
  <b>为复杂大模型工程编码而生的确定性约束引擎。</b><br />
  无缝接入 DSH 运行时，提供按轮次状态注入、物理工具面裁剪、步骤级两阶段验证门禁、会话级物理隔离与全生命周期 Web 监控看板。
</div>

<div align="center">
  🌏 <a href="./README.md"><b>中文</b></a> · <a href="./README_EN.md">English</a>
</div>

<br />

<p align="center">
  <img src="./docs/images/web-phase-chip.png" width="49%" alt="Web 阶段徽标与阶段轨道" />
  <img src="./docs/images/web-kanban.png" width="49%" alt="Mini 任务看板与归档折叠" />
</p>

---

## 💡 为什么需要 dsh-trellis？大模型工程化困境与解法

在驱动大语言模型（LLM）进行长程、复杂的现实工程开发时，传统的自由对话式编程会迅速遭遇三大**结构性失控**：

```text
┌───────────────────────────┐    传统模式弊端     ┌───────────────────────────┐
│     注意力衰减与迷航      │ ──────────────────► │  多轮对话后脱离主线、跳步  │
│ Context Signal Decay      │                     │  擅自修改无关业务代码      │
├───────────────────────────┤                     ├───────────────────────────┤
│     方案未定、盲目写码    │ ──────────────────► │  无调研无设计直接动用写工具 │
│ Premature Implementation  │                     │  破坏架构契约、制造大量 Bug│
├───────────────────────────┤                     ├───────────────────────────┤
│     缺乏硬性质量防线      │ ──────────────────► │  模型自言自语“已测试通过”  │
│ Absence of Hard Gates     │                     │  单方面宣布任务完成并关单  │
└───────────────────────────┘                     └───────────────────────────┘
```

**`dsh-trellis` 把成熟的 [Trellis](https://github.com/mindfold-ai/trellis) 结构化工程范式与工业级状态机机制完整带入 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)。**

它不仅是一个提示词集合，而是一套**具有强制约束力的工程运行环境**：
- 🛡️ **物理级权限受控**：在方案获批前，工具层直接剔除写代码能力，杜绝“提前盲改”；
- 🎯 **单一真理源（Single Source of Truth）**：彻底消灭多重待办清单的双写地狱，以原生 `steps` 唯一调度执行；
- 🚦 **两阶段硬门禁**：步骤级与任务级双重阻断，严防模型自证自签，强制人类介入卡点；
- 🧠 **高信噪比注意力聚焦**：动态计算当前最紧迫步骤，过滤海量上下文冗余，保持模型最高推理水准。

---

## 🏗️ 系统工程架构（System Engineering Architecture）

`dsh-trellis` 深度挂载于 DSH 插件生命周期，基于事件瀑布流（Waterfall Hooks）与底层文件沙箱构建：

```text
                               DeepSeek Harness Host
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  [system-prompt/assemble]                     [agent/pre-step]              │
  │            │                                         │                      │
  │            ▼                                         ▼                      │
  │  ┌────────────────────┐                     ┌─────────────────────┐         │
  │  │ 规划期物理只读裁剪 │                     │ 活跃步骤精准提取器  │         │
  │  │ Readonly Policy    │                     │ Active Step Locator │         │
  │  └─────────┬──────────┘                     └──────────┬──────────┘         │
  │            │ (剔除 write/edit)                         │ (按优先级决策)     │
  │            ▼                                           ▼                    │
  │   Model Tool Surface Payload                Breadcrumb Context Block        │
  │   - read / glob / grep                      [trellis/in_progress]           │
  │   - trellis_artifact_update                 [当前执行步骤] [#step-2] ...    │
  │   - trellis_task_update                     - 验收断言 / 验证指令 / 阻塞说明│
  │                                                                             │
  │  ─────────────────────────────────────────────────────────────────────────  │
  │  [Tool Execution Layer]                                                     │
  │   ├── trellis_task_create  ──► 任务创建、自动播种产物、同步 Session 独占指针│
  │   ├── trellis_task_update  ──► 状态流转、5 态推进、AI/Human 双层验证门禁拦截│
  │   ├── trellis_artifact_update► 受控产物通道（严格白名单 + 路径穿越硬拦截）  │
  │   └── trellis_task_archive ──► 归档移库、Git 干净度校验、解除会话指针       │
  │                                                                             │
  │  ─────────────────────────────────────────────────────────────────────────  │
  │  [Storage & File Boundary]                                                  │
  │   ├── ctx.fs (DSH Sandboxed FS) ──► 遵循 workspace-write / read-only 策略   │
  │   ├── node:fs (Tightly-Bounded) ──► 归档原子迁移、废弃模板自愈清理(fail-closed)│
  │   └── .trellis/tasks/<slug>/    ──► 机器状态 (task.json) + 人类产物 (*.md) │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 核心工程机制深度解析

### 1. 原生 5 态步骤状态机与多主体验证（5-State Engine & Multi-Party Gates）

任务步骤数据契约（`TaskStep`）放弃了简陋的“未做/已做”二元模型，扩展为反映真实工程周期的完整 5 态状态机：

```text
               ┌──────────────┐
               │   pending    │ ◄── 步骤已规划，等待前序依赖就绪
               └──────┬───────┘
                      │ (认领开工)
                      ▼
               ┌──────────────┐      (遇到阻塞/依赖缺失)     ┌──────────────┐
               │ in_progress  │ ──────────────────────────► │   blocked    │ (强制记录 blockedReason,
               └──────┬───────┘ ◄────────────────────────── └──────────────┘  面包屑置顶暴露排查)
                      │                                        (依赖解决)
           ┌──────────┴──────────┐
(无需验证) │                      │ (声明了验证要求: verification in ['ai', 'human'])
           ▼                      ▼
┌──────────────────┐    ┌──────────────────┐
│    completed     │    │    verifying     │ ◄── 代码已实施完成，处于验证中
└──────────────────┘    └────────┬─────────┘     (AI: 运行自测; Human: 等待人审)
           ▲                     │
           │ (verified === true) │
           └─────────────────────┘
```

#### ① AI 自动化验证门禁（`verification: 'ai'`，兼容历史 `verify: true`）
- **两阶段提交（Two-Phase Commit）**：大模型**严禁**在单次工具调用中同时将状态改为 `verified: true` 且 `status: 'completed'`；
- 实施完成后必须先切入 `verifying`，执行在 `design.md` 中指定的自动化测试命令，调用 `trellis_task_update` 固化 `verified: true` 与 `verificationNotes`（测试输出/日志证据），下一轮才允许置为 `completed`。

#### ② Human 步骤级人工验收卡点（`verification: 'human'`）
- **物理防御自证自签**：针对高风险重构、外部行为变更、涉及金额/权限的核心步骤，声明 `verification: 'human'`；
- 工具层底层死锁拦截：模型若试图将该步骤标记 `completed`，系统严格校验必须满足 `current.verified === true && current.verifiedBy === 'human'`。
- 模型无法单方面假冒人工签名，必须在对话中向人类清晰汇报改动要点，等待用户明确批准后方能闭环。

#### ③ 任务完结与归档硬防线
当任务试图置为主状态 `status: 'completed'` 或调用 `trellis_task_archive` 时，底层触发全量闭环审计：
- 任一步骤处于 `blocked`：物理拒绝（`[trellis/steps_blocked]`）；
- 任一步骤未完成：物理拒绝（`[trellis/steps_incomplete]`）；
- 任一步骤未通过质量验证（含 Human 卡点未放行）：物理拒绝（`[trellis/steps_unverified]`）；
- Git 工作区存在未提交的业务代码修改：物理拒绝（`[trellis/git_dirty]`）。

---

### 2. 单一真理源与架构双写彻底消除（Single Source of Truth）

在过去的工作流演进中，普遍存在“双写地狱（The Two Lists Problem）”：
- `feat` 任务在 `implement.md` 中写了一份 `## 有序步骤`；
- `refactor` 任务在 `checklist.yaml` 中维护了一份私有步骤（携带平行的 `done/blocked` 状态）；
- 根目录 `task.json.steps` 又有一套步骤清单。
三个清单字段不一、状态脱节，大模型往往不知道该更新谁，最终退化为无序修改。

#### 方案 C 架构收敛（Architecture Convergence）

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        单一真理源职责划分                              │
├──────────────────┬──────────────────┬──────────────────────────────────┤
│ 文件载体         │ 承载内容性质     │ 核心职责与消费方                 │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ task.json.steps  │ 结构化机器状态契约│ 唯一执行清单，由 task 工具驱动， │
│                  │ (Machine State)  │ 承载 5 态状态流转与两阶段硬门禁  │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ design.md        │ 非结构化工程思考 │ 方案全貌、数据流、边界契约、     │
│                  │ (Architecture)   │ 验证计划（命令集）、全局风险回滚 │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ prd.md           │ 业务需求与基准   │ 业务背景、用户价值、需求范围、   │
│                  │ (Requirements)   │ 任务级宏观验收准则（AC）         │
└──────────────────┴──────────────────┴──────────────────────────────────┘
```

- **全面物理废弃**：彻底移除 `implement.md` 与 `checklist.yaml` 模板；
- **自愈式存量修剪（Self-Healing Pruning）**：
  在 `ensureProjectSkills` 中内置安全修剪机制。无论旧项目何时由新版插件加载，引擎会在每轮 pre-step 静默、安全地清除历史项目中的 4 处废弃模板残余（严格限定在硬编码相对路径内，采用 fail-closed 沙箱保护，**绝对不触碰任何 tasks/ 历史任务数据**）。

---

### 3. 规划期只读保护机理（Read-only Planning Enforcement）

为什么仅在 System Prompt 中告诫大模型“方案批准前不要写代码”是注定脆弱的？
因为在长上下文或复杂目标刺激下，大模型的自回归倾向会强行猜测实现细节，动用 `write`/`edit` 工具破坏源码。

`dsh-trellis` 实现了三态授权状态机（Authorization State Machine）：

```text
                    ┌────────────────────────┐
                    │       undecided        │ (无活跃任务且未跳过)
                    │  工具面：只读 + 建任务 │
                    └───────────┬────────────┘
                                │ (trellis_task_create)
                                ▼
                    ┌────────────────────────┐
                    │        planning        │ (阶段处于 prd/design/review/scan 等规划期)
                    │  工具面：只读 + 方案产物更新 (trellis_artifact_update)
                    │  ❌ 通用写工具 (write/edit) 被物理剔除
                    └───────────┬────────────┘
                                │ (方案批准，切入 impl/fix/apply)
                                ▼
                    ┌────────────────────────┐
                    │       authorized       │ (执行期或已明确跳过)
                    │  工具面：恢复全量写入  │
                    └────────────────────────┘
```

- **物理裁剪机制**：在 DSH 调度 `system-prompt/assemble` 时，直接从发往大模型 API 请求体中将 `write` 与 `edit` 的 Schema 抹除；模型在心理认知上根本“看不见”写代码工具，全部计算预算（Reasoning Budget）被强制锁定在调研、设计与严密步骤拆解上；
- **受控产物通道（`trellis_artifact_update`）**：作为规划期唯一合法写通道，它内置全工种白名单（`prd.md`、`design.md` 等），并结合 `path.relative` 执行直接子路径穿越断言，严防模型借写文档之名修改项目业务代码。

---

### 4. 上下文注意力管理与高信噪比注入（High-SNR Attention Management）

随着对话轮次增加，大模型有效注意力会以指数级衰减。如果每轮都向模型灌入全量步骤清单与庞大产物，会直接引发上下文污染与注意力分散。

#### ① 活跃步骤优先队列决策算法（`findActiveStep`）
执行阶段，引擎根据状态优先级提取出**唯一的关键聚焦步骤**：
$$\text{Priority: } \mathbf{blocked} \succ \mathbf{in\_progress} \succ \mathbf{verifying} \succ \mathbf{pending}$$
- 若某一步阻塞（`blocked`），全系统立即置顶暴露阻断原因，引导模型排查依赖；
- 若无阻塞，优先暴露正在实施或等待验证的步骤，过滤全部已完成或远期步骤。

#### ② 分级表现层注入（Tiered Breadcrumbs）
- **`in_progress`**：注入交付规格与量化验收断言（Acceptance Criteria）；
- **`verifying (AI)`**：提示执行 `design.md` 验证命令并补充测试凭证；
- **`verifying (Human)`**：高亮抛出 `[人工验收卡点 - 👤 等待用户确认]`，明确声明严禁擅自推进；
- **`blocked`**：高亮抛出 `[⚠️ 步骤已阻塞]` 与阻塞原因。

#### ③ 内存级去重与防刷屏（In-Memory Deduplication）
维护每会话内存快照键 `Map<sessionId, 'stepId:status:verified'>`。同一步骤在状态未发生变化时，后续轮次降级为极简单行提醒，**零磁盘 I/O 损耗**，保证模型上下文窗口的高信噪比。

#### ④ Lossless-JSON 规约兼容
注入消息的 `source` 结构严格执行条件展开（`...(x ? { k: x } : {})`），杜绝在会话事件载荷中写入任何 `undefined` 值，根治了 DSH 底层 `snapshotJsonValue` 校验崩溃风险。

---

### 5. 多会话并发与严格物理隔离（Per-Session Pointer Isolation）

在现代 AI IDE 与 Web 客户端中，用户通常会打开多个窗口或并行派生子代理。

- **弃用全局单例绑定**：彻底抛弃全局单一当前任务指针的设计；
- **会话级指针绑定**：会话与任务的绑定关系持久化在 `.trellis/.runtime/sessions/<session-safe-id>.json` 中；
- **零交叉污染**：会话 A 推进 `feat-A`，会话 B 处理 `issue-B`，两者的阶段徽标、注入面包屑与状态推进完全物理隔离，互不干扰。

---

## ⚡ 极速上手指南

### 1. 安装插件

确保 Node.js ≥ 20 且 DSH 正常运行，执行：

```sh
# 安装稳定版本
dsh plugin --profile web add @banana-peeljj12/dsh-trellis

# 更新到最新版本
dsh plugin --profile web add @banana-peeljj12/dsh-trellis@latest

# 本地源码开发接入
dsh plugin --profile web add link:/abs/path/to/dsh-trellis
```

安装完成后，**重启一次 DSH 服务**。

### 2. 配置项目白名单 (Allowlist)

插件秉持安全最小化原则，默认不拦截未授权的项目。只需在 Web 界面配置一次：
1. 打开 DSH Web 客户端，进入左下角 **设置 → 插件 → Trellis 工作流**；
2. 在 **白名单项目 (allowlist)** 中添加项目根目录绝对路径（如 `D:/code/my-project` 或 `/home/user/project`），点击保存**即刻热生效**。

> 💡 亦可直接写入 `~/.dsh/settings.yaml` 中的 `trellis-workflow.allowlist`。

### 3. 开工体验

像平时一样向 AI 描述需求：
> *“帮我设计并实现用户权限系统，增加基于角色的访问控制（RBAC）”*

AI 将启动标准工程生命周期：
1. 识别意图并征询同意创建 `feat-09-06-rbac-auth` 任务；
2. 开启规划期只读保护，研读仓库既有架构，产出 `prd.md` 与 `design.md`；
3. 将执行方案拆解为包含 AI 自测与 Human 验收卡点的 `steps` 步骤清单；
4. 获得人类明确批准后推进至 `impl` 阶段，逐步编写代码、执行自动化测试、呈报人审卡点，最终安全归档！

---

## 🧭 三大内置标准工程流

| 工作类型 | 推荐入口技能 | 标准推进全阶段 | 适用场景与约束 |
|---|---|---|---|
| **新功能特性** (`feat`) | `trellis-feat` | `prd` → `design` → `design-review` → `impl` → `review` → `check` | 新特性或大幅改动。支持 `quick`（轻量速通）与 `standard`（含独立审查与双层人卡） |
| **缺陷修复** (`issue`) | `trellis-issue` | `report` → `analyze` → `fix` → `fix-note` | 缺陷定位与修复。根因明显可跳过 `analyze`；遇复杂震荡可调用 `trellis-break-loop` 斩断死循环 |
| **行为等价重构** (`refactor`) | `trellis-refactor` | `scan` → `design` → `apply` → `done` | **绝对保证外部行为等价**。清单由 `steps` 驱动；任何涉及业务变更立即转出至 feat/issue |

---

## ⚙️ 核心配置项参考

| 配置字段 | 类型 | 默认值 | 作用说明 |
|---|---|---|---|
| `allowlist` | `string[]` | `[]` | **核心安全白名单**：生效的项目根目录绝对路径列表。为空时不拦截任何项目 |
| `enforceReadonlyPlanning` | `boolean` | `false` | **规划期只读保护主开关**：开启后，在 planning 阶段物理裁剪通用写工具面，仅放行只读工具与方案更新通道 |
| `injectStep` | `number` | `1` | 面包屑注入步数（默认 1，即在新提问的首步注入指引） |
| `skipKeywords` | `string[]` | `['no-trellis']` | **逃生短语**：用户消息中只要包含该关键字，该轮对话彻底绕过任何工作流拦截与注入 |
| `inline` | `boolean` | `false` | 是否开启 codex-inline 风格的阶段解析模式 |

---

## 🛠️ 模块职责划分与源码导读

```text
dsh-trellis/
├── lib/
│   ├── index.js            # 核心注册器：挂载 pre-step 拦截、assemble 权限裁剪、生命周期及 RPC Remote
│   ├── task.js             # 任务执行引擎：5 态流转契约、AI/Human 双层验证门禁、checkStepsCompletion 审计
│   ├── skills.js           # 技能供给与自愈：ensureProjectSkills 按需补齐技能、pruneDeprecatedProjectTemplates 安全修剪
│   ├── breadcrumb.js       # 提示词构建器：findActiveStep 优先队列决断、formatStepPrompt 分级渲染、内存去重
│   ├── readonly.js         # 权限判定机：根据任务阶段派生三态授权（undecided / planning / authorized）
│   ├── state.js            # 状态机解析：阶段感知相位转换（phaseForTask）、跨会话指针解析、月度归档槽推导
│   ├── artifact.js         # 交付物通道：trellis_artifact_update 受控写入、白名单与路径穿越防御
│   ├── archive.js          # 归档机：任务完成态校验、node:fs 原子迁移受控例外、Git 干净度校验
│   ├── board.js            # 看板数据聚合：轻量汇总活动任务与月度归档树，零额外 I/O 开销
│   ├── client.js           # 前端 Web 扩展：阶段微标展示、Mini 看板组件、可视化设置面板
│   └── types/index.d.ts    # 完整 TypeScript 接口契约定义
├── skills/                 # 15 个经过精细工程调优的随包权威工作流技能与产物模板
└── test/                   # 72+ 项纯原生自动化测试套件（覆盖状态机、门禁拦截、路径沙箱与自愈修剪）
```

---

## 📄 开源许可证与致谢

- 本项目基于 [MIT 许可证](./LICENSE) 开源发布。
- 致谢 [Trellis](https://github.com/mindfold-ai/trellis)（Mindfold）：感谢其开创性的工程工作流思路；本项目对其工作流语义进行了基于 DSH 原生机制的完全自主重构（纯 ESM 实现，无 AGPL 代码）。
- 致谢 [CodeStable](https://github.com/codestable/CodeStable)：优秀的三大工作流设计哲学启发。
- 致谢 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：卓越且强大的现代 Agent 底座。
