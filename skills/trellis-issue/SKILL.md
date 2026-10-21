---
name: trellis-issue
description: "Bug 修复工作流：处理缺陷、异常与回归问题，推进 report -> analyze -> fix -> fix-note。不可用于新功能（使用 trellis-feat）或行为等价重构（使用 trellis-refactor）。"
---

# trellis-issue

Bug 修复流程，载体为 Trellis task。
对照规则：`_templates/work-types.md`；产物模板：`_templates/issue/`。

## 启动

1. **恢复上下文**：用 `trellis_state` 或读取 `.trellis/.runtime/sessions/*.json` 的 `current_task`；也可加载 `trellis-continue`。
2. **无 task 且用户同意**：加载 `trellis-start` $\to$ 用内置工具 **`trellis_task_create`** 创建任务：
   - 参数：`workType=issue`，自动写入 `.trellis/tasks/<slug>/task.json`（status=planning）、播种 `report.md` 等模板，并同步写入 `.trellis/.runtime/sessions/` 的 `current_task`，面板状态与 Web 徽标立即生效；
   - slug 格式严格为 `issue-<mm-dd>-<短名>`，由工具自动推导校验。
3. **状态与阶段更新**：使用内置工具 **`trellis_task_update`**（如 `status="in_progress", stage="fix"`；自动校验轨道并刷新状态）：
   ```json
   "work": { "type": "issue", "mode": "standard", "stage": "report" }
   ```
4. **按产物事实恢复 stage**：以磁盘文件事实优先于聊天历史。

## 模板初始化（首次使用）

若 `.trellis/templates/issue/` 不存在，把本技能资源目录的 `_templates/issue/*` 复制过去，并将 `_templates/work-types.md` 复制到 `.trellis/templates/work-types.md`。已存在则跳过。

## 参数意图

| 信号 | 含义 |
|---|---|
| `--stage report\|analyze\|fix` | 偏好阶段（仍以磁盘产物事实为准） |
| 根因很明显 / 快速通道 | 在证据充分的情况下可跳过 analyze 阶段 |

## 阶段机与执行流

| 条件 | stage | 核心动作与产物 | 下一步 |
|---|---|---|---|
| 无 `report.md`（或未写清复现） | report | 编写 `report.md`：错误现象、稳定复现步骤、期望表现、实际表现、日志证据 | analyze 或 fix |
| 有 report；根因不显然且无 analysis | analyze | 编写 `analysis.md`：顺着数据流与调用栈深查根本原因；先查代码再问人 | 确认根因后进 fix |
| 根因已确认（analysis 或 report 内已确证） | report/analyze | 确认修复思路；调 `trellis_task_update(status: 'in_progress')` | fix |
| in_progress；修复未完成 | fix | 加载 `trellis-before-dev` $\to$ 遵循最小改动原则修复根因 | fix-note |
| 修复完成 | fix-note | 编写 `fix-note.md`：记录具体改动、验证证据（单测/抓包）与技术债务 | finish |
| fix-note 齐备 | finish | 加载 `trellis-check` 验证 $\to$ 必要时 `trellis-update-spec` $\to$ commit $\to$ `trellis-finish-work` / archive | 完成 |

### 跳过 analyze 的准入条件
仅当根因一眼能确定（例如明显的拼写错误、少传已知参数），且能在 `report.md` 或 `fix-note.md` 中写清确凿代码证据时才允许跳过。在产物中必须注明“跳过 analyze 的理由”。
若同一问题修了多次仍复发 $\to$ 必须加载 `trellis-break-loop`，严格补全 analyze。

## 修复核心规则

- **根因修复优先于表象补丁**：必须找到数据流或状态机的源头漏洞，严禁仅在出错点套 try-catch 或无脑加判空。
- **严禁借修 Bug 夹带私货**：不借修 Bug 顺手大改无关代码；重构走 `trellis-refactor`。
- **行为变更超出 Bug 定义**：若修复需要改变正常业务逻辑，立即转为 `trellis-feat` 或拆分任务。
- **严格遵循质量门**：通过 `trellis-check` 执行回归测试。

## 人卡点与退出条件

### 人卡点（硬）
1. **复现信息不足** $\to$ 停留在 report 阶段，一次只问一个最高价值问题（能靠仓库证据查证的严禁发问）。
2. **高风险修复**（涉及资金交易、鉴权安全、数据迁移、核心缓存生命周期） $\to$ 修复方案必须先向用户简短确认，再写 `status=in_progress`。
3. **无 `fix-note.md`** $\to$ 禁止 archive 归档。

### 退出路由表
| 退出状态 | 触发条件 | 后续动作 |
|---|---|---|
| **NeedsHuman** | 复现信息不足 / 高风险方案待审 | 提出澄清问题或方案说明，停住等待用户回复 |
| **SwitchRequired** | 发现超出缺陷范畴，涉及新需求或结构重构 | 转为 `trellis-feat` 或 `trellis-refactor` 处理 |
| **Completed** | `fix-note.md` 齐备 + `trellis-check` 绿灯通过 | 提交代码并安全归档 |

## 产物清单

所有产物落在 `.trellis/tasks/<slug>/`：
- `report.md`：现象、复现步骤、期望与实际表现、证据。
- `analysis.md`：根因剖析、调用栈追踪、失效机制说明。
- `fix-note.md`：修改文件清单、验证结果、残留债务。

## 反模式（严厉禁止）

- ❌ 无复现步骤与证据就凭盲猜改代码；
- ❌ 修复完成后不写 `fix-note.md`；
- ❌ 只打表象补丁（如局部判空），不修复数据流与生命周期闭环；
- ❌ 借修 Bug 的名义进行大面积不相干的代码重构。
