---
name: trellis-refactor
description: "Refactor workflow for behavior-preserving optimization, splitting, or cleanup: resume and advance scan -> design -> apply. When external observable behavior would change, route to trellis-feat or trellis-issue instead. Do not use for new features or primary bug fixes."
---

# trellis-refactor

行为等价重构流程，载体为 Trellis task（由 FTM/CodeStable 工作流通用化而来）。
对照：`_templates/work-types.md`；模板：`_templates/refactor/`。

## 启动

1. 恢复上下文：用 `trellis_state` 或读 `.trellis/.runtime/sessions/*.json` 的
   `current_task`；也可加载 `trellis-continue`。
2. 无 task 且用户同意：`trellis-start` → 用内置工具 **`trellis_task_create`** 建 task
   （`workType=refactor`；自动写 `.trellis/tasks/<slug>/task.json`（status=planning）、播种
   `scan.md` 等模板、并**同步写 `.trellis/.runtime/sessions/` 的 `current_task`**，面包屑/
   阶段/Web 徽标立即生效，无需手动写 session 文件）。slug=`<work-type>-<mm-dd>-<短名>`，
   如 `refactor-01-15-xxx`；工具会自动校验/推导。
3. 更新阶段或状态使用内置工具 **`trellis_task_update`**（如 `status=in_progress, stage=apply`；自动校验轨道并刷新 Web 徽标）：
   ```json
   "work": { "type": "refactor", "mode": "standard", "stage": "scan" }
   ```
4. 按产物恢复 stage。

## 模板初始化（首次使用）

若 `.trellis/templates/refactor/` 不存在，把本技能资源目录的 `_templates/refactor/*` 复制过去，
并把 `_templates/work-types.md` 复制到 `.trellis/templates/work-types.md`。已存在则跳过。

## 参数意图

| 信号 | 含义 |
|------|------|
| `--mode standard\|fastforward` | 模式 |
| `--stage scan\|design\|apply` | 偏好阶段 |
| 流程太重 / 范围极小 | 评估是否 ff |

## 行为等价底线（硬）

外部可观察行为包含但不限于：UI 展示结果、交互语义、网络契约、缓存生命周期、错误/Toast 语义、导航结果。
**任一会变 → 停止本流程，改 `trellis-feat` 或 `trellis-issue`。**

## 阶段机

| 条件 | stage | 下一步 |
|------|-------|--------|
| 无 `scan.md` 或用户未勾选纳入项 | scan | 写 `scan.md`，**等人勾选** |
| 已勾选；无 design 或 status≠approved | design | 写 `refactor-design.md` + `checklist.yaml`，**等人 approve** |
| design approved | 写 `status=in_progress` | apply |
| in_progress | apply | 按 checklist 逐步改；写 `apply-notes.md` |
| 步骤 verification=human 且未确认 | 暂停 | 等人确认该步 |
| 全部步骤验证完 | final | `trellis-check` + 全量验证记录 |
| 用户最终确认 | finish | `trellis-update-spec` → commit → `trellis-finish-work` / archive |

### fastforward

同时满足才允许：

- 范围单点、挂载点清晰
- 行为等价无疑问
- 可快速回滚
- 不改跨模块公开契约

ff：可压缩 scan/design 为短说明，但仍需 apply-notes + check；不确定则回 standard。

## 人卡点（硬）

1. **scan 未勾选** → 禁止 design 定案写码。
2. **design 未 approved**（standard）→ 禁止写 `status=in_progress`。
3. **HUMAN 验证步未确认** → 禁止把该步标 done / 进入依赖它的下一步。
4. **最终人审未过** → 禁止 archive。

## 产物

```text
scan.md
refactor-design.md
checklist.yaml
apply-notes.md
```

（从 `_templates/refactor/` 复制。）

## Apply 规则

- 小步提交式改动；每步可验证。
- 优先 characterization / 现有测试锁行为，再挪结构。
- 遵守 `.trellis/spec` 约束（模块目录、分层、准入等）。
- 实现前 `trellis-before-dev`；阶段末 `trellis-check`。

## 退出

| 结果 | 动作 |
|------|------|
| NeedsHuman | scan 勾选 / design 确认 / human 验证 |
| SwitchRequired | 发现行为变更 → 转 feat/issue |
| Completed | apply-notes 齐 + check 过 + 人审 + archive |

## 反模式

- 借重构改产品行为
- 无 checklist 的大爆炸改动
- 未批准就写 `status=in_progress`
