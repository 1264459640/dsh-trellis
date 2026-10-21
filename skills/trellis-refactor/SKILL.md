---
name: trellis-refactor
description: "行为等价重构工作流：代码优化、模块拆分与清理，推进 scan -> design -> apply。若改动影响外部可观察行为，转由 trellis-feat 或 trellis-issue 处理。"
---

# trellis-refactor

行为等价重构流程，载体为 Trellis task。
对照规则：`_templates/work-types.md`；产物模板：`_templates/refactor/`。

## 启动

1. **恢复上下文**：用 `trellis_state` 或读取 `.trellis/.runtime/sessions/*.json` 的 `current_task`；也可加载 `trellis-continue`。
2. **无 task 且用户同意**：加载 `trellis-start` $\to$ 用内置工具 **`trellis_task_create`** 创建任务：
   - 参数：`workType=refactor`，自动写入 `.trellis/tasks/<slug>/task.json`（status=planning）、播种 `scan.md` 等模板，并同步写入 `.trellis/.runtime/sessions/` 的 `current_task`，面包屑与 Web 徽标立即生效；
   - slug 格式严格为 `refactor-<mm-dd>-<短名>`，由工具自动推导校验。
3. **状态与阶段更新**：使用内置工具 **`trellis_task_update`**（如 `status="in_progress", stage="apply"`）：
   ```json
   "work": { "type": "refactor", "mode": "standard", "stage": "scan" }
   ```
4. **按产物事实恢复 stage**。

## 模板初始化（首次使用）

若 `.trellis/templates/refactor/` 不存在，把本技能资源目录的 `_templates/refactor/*` 复制过去，并将 `_templates/work-types.md` 复制到 `.trellis/templates/work-types.md`。已存在则跳过。

## 参数意图

| 信号 | 含义 |
|---|---|
| `--mode standard\|fastforward` | 执行模式选择（默认 standard） |
| `--stage scan\|design\|apply` | 偏好阶段（仍以产物事实为准） |
| 流程太重 / 范围极小 | 评估是否符合 fastforward 准入条件 |

## 行为等价底线（硬）

外部可观察行为包含但不限于：
- UI 渲染展示结果与样式交互；
- API 网络请求/响应契约与状态码；
- 缓存生命周期与存储格式；
- 错误与 Toast 提示文案；
- 页面导航与路由跳转结果。

**只要有任何一项会改变 $\to$ 立即停止重构流程，改走 `trellis-feat`（新需求）或 `trellis-issue`（修 Bug）。**

## 阶段机与执行流

| 条件 | stage | 核心动作与产物 | 下一步 |
|---|---|---|---|
| 无 `scan.md` 或用户未勾选纳入项 | scan | 编写 `scan.md`：扫描现状、列出坏味道与候选范围，**停住等用户勾选确认** | design |
| 已勾选确认；无 design 或 status≠approved | design | 编写 `refactor-design.md`：设计重构目标结构与测试保护策略，**停住等用户批准** | apply |
| design 获批；规划产物齐备 | 准备开工 | 用 `trellis_task_update` 录入 `steps` 清单（含验收与 `verification`）；切 `status=in_progress` | apply |
| in_progress | apply | 加载 `trellis-before-dev` $\to$ 按 `task.json.steps` 逐步改造；编写 `apply-notes.md` | finish |
| 步骤标记 verification=human 且未确认 | 暂停 | 等待用户人工确认该步骤生效 | 确认后继续 |
| 全部步骤实施与验证完毕 | final | 加载 `trellis-check` 运行全量回归验证，记录验证结果 | finish |
| 用户最终确认 | finish | 必要时 `trellis-update-spec` $\to$ commit $\to$ `trellis-finish-work` / archive | 完成 |

### 快速通道（fastforward）准入条件
必须同时满足以下条件才允许启用 fastforward：
- 范围单点且局限在单一文件或函数；
- 行为等价确定无疑问；
- 现有单元测试完整覆盖且可一秒回滚；
- 不改动任何跨模块公开契约。

在 fastforward 模式下，可将 scan 与 design 压缩为简短说明，但仍需编写 `apply-notes.md` 并通过 `trellis-check`；若有任何不确定性，立刻回退到 standard 模式。

## Apply 核心规则

- **小步快跑，每步可验证**：按照 `task.json.steps` 分步改造，禁止大爆炸式整体替换。
- **测试锁行为优先**：在移动代码结构前，优先编写或确认既有测试能够锁定原有行为（Characterization Tests）。
- **遵守规范约束**：严格遵循 `.trellis/spec/` 声明的模块依赖与分层规则。
- **阶段衔接**：实现前加载 `trellis-before-dev`；每阶段完成加载 `trellis-check`。

## 人卡点与退出条件

### 人卡点（硬）
1. **scan 范围未确认** $\to$ 禁止开始 design 设计或动手写码。
2. **design 未获批准**（standard 模式） $\to$ 禁止将状态改为 `status=in_progress`。
3. **HUMAN 验证步骤未确认** $\to$ 严禁将该步骤标为 done，严禁进入依赖它的后续步骤。
4. **最终验证未通过** $\to$ 禁止 archive 归档。

### 退出路由表
| 退出状态 | 触发条件 | 后续动作 |
|---|---|---|
| **NeedsHuman** | scan 范围勾选 / design 确认 / human 步骤验证 | 输出说明并停住等待用户回复 |
| **SwitchRequired** | 发现重构涉及外部行为或接口契约变动 | 终止重构，转为 `trellis-feat` 或 `trellis-issue` |
| **Completed** | `apply-notes.md` 齐备 + `trellis-check` 全绿 + 人审通过 | 提交代码并安全归档 |

## 产物清单

所有产物落在 `.trellis/tasks/<slug>/`：
- `scan.md`：现状扫描、技术债务盘点、纳入范围与排除范围。
- `refactor-design.md`：目标结构设计、依赖抽离方式、测试保护方案。
- `apply-notes.md`：分步改动记录、前后对比证据与回归测试输出。
- `task.json.steps`：由 `trellis_task_update` 维护的执行步骤清单。

## 反模式（严厉禁止）

- ❌ 借重构名义擅自改动产品业务逻辑或外部接口；
- ❌ 没有测试保护就大面积挪动代码结构；
- ❌ 缺少 `task.json.steps` 规划就搞“大爆炸”一次性修改；
- ❌ 方案未获用户确认前就擅自写 `status=in_progress` 并修改代码。
