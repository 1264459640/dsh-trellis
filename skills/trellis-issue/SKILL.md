---
name: trellis-issue
description: "Issue workflow for bugs, anomalies, and regressions: resume and advance report -> analyze -> fix -> fix-note. Do not use for new features (trellis-feat) or behavior-preserving refactor (trellis-refactor)."
---

# trellis-issue

Bug 修复流程，载体为 Trellis task（由 FTM/CodeStable 工作流通用化而来）。
对照：`_templates/work-types.md`；模板：`_templates/issue/`。

## 启动

1. 恢复上下文：用 `trellis_state` 或读 `.trellis/.runtime/sessions/*.json` 的
   `current_task`；也可加载 `trellis-continue`。
2. 无 task 且用户同意：`trellis-start` → 用内置工具 **`trellis_task_create`** 建 task
   （`workType=issue`；自动写 `.trellis/tasks/<slug>/task.json`（status=planning）、播种
   `report.md` 等模板、并**同步写 `.trellis/.runtime/sessions/` 的 `current_task`**，面包屑/
   阶段/Web 徽标立即生效，无需手动写 session 文件）。slug=`<work-type>-<mm-dd>-<短名>`，
   如 `issue-01-15-xxx`；工具会自动校验/推导。
3. 更新阶段或状态使用内置工具 **`trellis_task_update`**（如 `status=in_progress, stage=fix`；自动校验轨道并刷新 Web 徽标）：
   ```json
   "work": { "type": "issue", "mode": "standard", "stage": "report" }
   ```
4. 按产物恢复 stage。

## 模板初始化（首次使用）

若 `.trellis/templates/issue/` 不存在，把本技能资源目录的 `_templates/issue/*` 复制过去，
并把 `_templates/work-types.md` 复制到 `.trellis/templates/work-types.md`。已存在则跳过。

## 参数意图

| 信号 | 含义 |
|------|------|
| `--stage report\|analyze\|fix` | 偏好阶段 |
| 根因很明显 / 快速通道 | 可跳过 analyze |

## 阶段机

| 条件 | stage | 下一步 |
|------|-------|--------|
| 无 `report.md`（或 prd 未写清复现） | report | 写 `report.md`：现象、复现、期望/实际、证据 |
| 有 report；根因不显然且无 analysis | analyze | 写 `analysis.md`；先查代码再问人 |
| 根因已确认（analysis 或报告内已写清） | → 写 `status=in_progress` | fix |
| in_progress；修复未完成 | fix | `trellis-before-dev` → 最小修复 |
| 修复完成 | fix-note | 写 `fix-note.md`（改动、验证、债务） |
| fix-note 完成 | finish | `trellis-check` → 必要 `trellis-update-spec` → commit → `trellis-finish-work` / archive |

### 跳过 analyze

仅当根因一眼确定且能在 report/fix-note 写清证据。在 `analysis.md` 或 fix-note 注明"跳过 analyze 的理由"。
若同一问题修了多次仍复发 → 加载 `trellis-break-loop`，补全 analyze。

## 人卡点

1. **复现信息不足** → 停在 report，一次只问最高价值澄清（能靠仓库证据的不要问）。
2. **高风险修复**（数据/权限/缓存生命周期/热更边界等）→ 修复方案先简短确认再写 `status=in_progress`。
3. **无 fix-note** → 禁止 archive。

## 产物

```text
report.md
analysis.md
fix-note.md
```

（从 `_templates/issue/` 复制。）可用 `prd.md` 承载简短 repro，但推荐独立 `report.md` 以免与需求型 PRD 混淆。

## 修复规则

- 根因修复优先于表象补丁。
- 不借修 bug 夹带重构；重构走 `trellis-refactor`。
- 行为变更超出 bug 定义 → 转 `trellis-feat` 或拆 task。
- 验证遵循项目 `.trellis/spec/` 质量门（`trellis-check`）。

## 退出

| 结果 | 动作 |
|------|------|
| NeedsHuman | 等待复现/确认 |
| Routed | 转 feat/refactor |
| Completed | fix-note 齐 + check 过 + archive |

## 反模式

- 无复现步骤就改代码
- 修完不写 fix-note
- 只打表象补丁，不修数据流/生命周期闭环
