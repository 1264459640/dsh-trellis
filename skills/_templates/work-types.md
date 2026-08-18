# Work Type Workflows (feat / issue / refactor)

通用化的三类工作流（源自 FTM/CodeStable，随 trellis-workflow 插件分发，MIT）。
**载体**：`.trellis/tasks/{slug}/`
**入口**：由工作流路由表驱动，复用原生 Trellis skill（`trellis-feat` / `trellis-issue` / `trellis-refactor`）
**模板**：`.trellis/templates/{feat,issue,refactor}/`（首次使用时由对应技能自动初始化）

> **slug 严格格式**（插件会在 breadcrumb / `trellis_state` 校验并提示）：
> `<work-type>-<mm-dd>-<短名>`，如 `feat-01-15-billing-export`。`<mm-dd>` 为创建日期，
> `<work-type>` 取自 `work.type`（feat|issue|refactor）。不合规的目录名会收到警告。

## 通用约定

1. 新工作只建 Trellis task，各类产物只落 `.trellis/tasks/`。
2. **建 task 用内置工具 `trellis_task_create`**：它会写 `.trellis/tasks/<slug>/task.json`
   （status=planning）、播种产物模板，并**同步写 `.trellis/.runtime/sessions/` 的
   `current_task`**，让面包屑/阶段/Web 徽标立即生效。不要手动建目录或手写 session 文件。
2. `task.json` 扩展字段（手写维护，不破坏原生 status）：
   ```json
   {
     "work": {
       "type": "feat",
       "mode": "standard",
       "stage": "design",
       "execution_lane": "standard"
     }
   }
   ```
3. 原生 `status` 仍只用：`planning` → `in_progress` → `completed`（archive）。
4. **归档用内置工具 `trellis_task_archive`**：把 `.trellis/tasks/<slug>/` 原子移入
   `.trellis/tasks/archive/<yyyy-mm>/<slug>/`——月份键 `<yyyy-mm>` = slug 的 `mm` + 当年
   （与看板读取共用同一逻辑，写读永远一致；无 `mm-dd` 的遗留 slug 归 `other/`），并自动解绑
   指向该任务的会话指针（归档任务只读，不再可激活）。归档**只移动、不删除**记录。
5. 细阶段用 `work.stage` + 产物文件恢复；**仓库产物优先于聊天历史**。
6. 写代码前读 `.trellis/spec/`（对应分层 + `guides/` 思考指南）。
7. 规划/需求澄清加载 `trellis-brainstorm`；实现前 `trellis-before-dev`；质量门 `trellis-check`；
   收工走原生 Trellis 生命周期（commit → `trellis-finish-work` / `trellis_task_archive`）；沉淀 `trellis-update-spec`。
8. 人卡点未通过时，禁止写 `status=in_progress`（或禁止进入写码阶段）。
9. **slug 规范**：新任务目录名必须为 `<work-type>-<mm-dd>-<短名>`（如 `feat-01-15-billing-export`，
   mm-dd 为创建日期）；插件每轮在 breadcrumb / `trellis_state` 校验，不合规会提示。

## 路由

| 用户意图 | 入口 skill | 说明 | slug 前缀建议 |
|----------|------------|------|----------------|
| 新功能 / 功能改造 | `trellis-feat` | 按 quick/standard 推进 prd→design→design-review→impl→review→check | `feat-<mm-dd>-...` |
| Bug / 异常 / 回归 | `trellis-issue` | 推进 report→analyze→fix→fix-note；反复调试时配合 `trellis-break-loop` | `issue-<mm-dd>-...` |
| 行为等价重构 / 拆分 / 优化 | `trellis-refactor` | 推进 scan→design→apply；行为变更转 feat/issue | `refactor-<mm-dd>-...` |
| 会话开工 / 恢复上下文 | 原生 Trellis（Active Task） | `trellis_state` / `trellis-continue` | — |
| 需求澄清（feat/issue 规划期） | `trellis-brainstorm` | 由对应流程在规划期加载 | — |

## Feature 阶段

`mode/lane`：`quick` | `standard`（goal/长程用 parent+child task）

| stage | 产物 | 人卡点 |
|-------|------|--------|
| prd | `prd.md` | Quick 可较轻 |
| design | `design.md` | Standard：用户 approve |
| design-review | `design-review.md`（独立子代理） | Standard：reviewer passed |
| impl | 代码 + 可选 `implement.md` | 需先写 `status=in_progress` |
| review | `review.md`（独立子代理） | blocking 需修复；可选 `trellis-check` 自修 |
| check | `trellis-check` 结果与验证证据（写入 `review.md` 或 `implement.md`） | 必须通过后 archive |

Quick：`prd` 清晰且局部、无新跨系统契约时可跳过 design-review；仍建议最小 prd + 实现后 check。

## Issue 阶段

| stage | 产物 | 人卡点/跳过 |
|-------|------|-------------|
| report | `report.md` | |
| analyze | `analysis.md` | 根因一眼确定可跳过 |
| fix | 代码 | 写 `status=in_progress` 后 |
| fix-note | `fix-note.md` | archive 前必需 |

## Refactor 阶段

底线：**行为等价**。会改外部可观察行为 → 转 feat/issue。

| stage | 产物 | 人卡点 |
|-------|------|--------|
| scan | `scan.md` | 用户勾选纳入项 |
| design | `refactor-design.md` | 用户 approve |
| apply | 代码 + `checklist.yaml` + `apply-notes.md` | human 验证步需确认 |
| done | 全量验证 | 用户最终确认后 archive |

`mode: fastforward`：范围极小、可回滚、行为等价；可压缩 scan/design，但仍需 apply-notes + check。

## 与原生 Trellis 相位映射

| Trellis status | 典型 work.stage |
|----------------|-----------------|
| planning | feat: prd/design/design-review；issue: report/analyze；refactor: scan/design |
| in_progress | feat: impl/review/check；issue: fix/fix-note；refactor: apply |
| completed | archived（`.trellis/tasks/archive/<yyyy-mm>/<slug>`） |

## 子代理

| 角色 | 派发方式 | 用途 |
|------|----------|------|
| 设计审查 | 主会话派独立子代理（`trellis-channel` 或 subagent） | 设计审查 → `design-review.md` |
| 代码审查 | 主会话派独立子代理 | 代码审查 → `review.md` |
| 实现 | 主会话派实现子代理（可选） | 按 prd/design 实现 |
| 规范自修/验证 | `trellis-check` | 规范对照 + 自修/验证 |

派发协议：每个派发 prompt 以 `Active task: <task 目录路径>` 开头；reviewer 返回 `blocking` 时停在该 stage。
