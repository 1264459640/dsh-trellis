---
name: trellis-feat
description: "Feature workflow for new functionality or feature rework: resume and advance prd -> design -> design-review -> impl -> review -> check on quick/standard lanes. Do not use for bug fixes (trellis-issue) or behavior-preserving refactor (trellis-refactor)."
---

# trellis-feat

在 Trellis task 上运行的 Feature 流程（由 FTM/CodeStable 工作流通用化而来）。
路由表与阶段机对照：`_templates/work-types.md`；产物模板：`_templates/feat/`。

## 启动

1. 若无 active task：加载 `trellis-start`，**先征得用户同意**再建任务。建任务用内置工具
   **`trellis_task_create`**（`workType=feat`，自动写 `.trellis/tasks/<slug>/task.json`
   （status=planning）、播种 `prd.md` 等产物模板、并**同步写 `.trellis/.runtime/sessions/`
   的 `current_task`**，面包屑/阶段/Web 徽标立即生效；不要手动写 session 文件）。
   slug 必须为 `<work-type>-<mm-dd>-<短名>`，如 `feat-01-15-xxx`；工具会自动校验/推导。
2. 若有 active task：用 `trellis_state` 或读 `.trellis/.runtime/sessions/*.json` 的
   `current_task` 恢复；也可加载 `trellis-continue`。
3. 更新阶段或状态使用内置工具 **`trellis_task_update`**（如 `status=in_progress, stage=impl`；自动校验轨道并刷新 Web 徽标）：
   ```json
   "work": { "type": "feat", "mode": "standard", "stage": "prd", "execution_lane": "standard" }
   ```
4. 从 task 目录**产物事实**恢复 stage（优先于聊天历史与参数）。

## 模板初始化（首次使用）

若 `.trellis/templates/feat/` 不存在，把本技能资源目录的 `_templates/feat/*` 复制过去，
并把 `_templates/work-types.md` 复制到 `.trellis/templates/work-types.md`。已存在则跳过。

## 参数意图（可选）

| 信号 | 含义 |
|------|------|
| `--mode quick` / 小改 / 流程太重且确实局部 | `execution_lane=quick` |
| `--mode standard` | `execution_lane=standard` |
| `--stage design\|design-review\|impl\|review\|check` | 偏好阶段（仍以产物为准） |

## Lane 选择

```text
quickEligible 需同时满足：
- 需求与验收行为明确
- 改动局部且挂载点已知
- 复用既有公开契约，不新增/改变跨系统协议
- 验证入口已知
- 不涉及 ADR/迁移/权限安全/高风险数据语义

否则 standard。
epic/多交付物 → parent + child tasks（父任务管集成验收）。
```

用户反馈"太重/是小改"时：重新评估；满足 quick 则降级并写回 design/prd；不满足则逐条说明原因。

## 阶段机（仓库事实优先）

| 条件 | stage | 下一步 |
|------|-------|--------|
| 无/空 `prd.md` | prd | 写 prd（可 `trellis-brainstorm`） |
| 有 prd；standard 且无 design 或 design.status≠approved | design | 写/改 `design.md`，**等人确认** |
| design approved；standard 且 design-review 非 passed | design-review | **派独立子代理**写 `design-review.md`（独立审查；主会话不自审自批） |
| planning 产物齐 + 人卡通过 | 写 `task.json.status=in_progress` | 进入 impl |
| in_progress；代码未完成 | impl | `trellis-before-dev` → 实现（可派实现子代理）；可维护 `implement.md` |
| 实现完成；review 非 passed | review | **派独立子代理**写 `review.md`；机械自修可另用 `trellis-check` |
| review 过；check 未通过 | check | 派 `trellis-check`，按项目 `.trellis/spec/` 质量门验证；将结果写入 `review.md` 或 `implement.md` |
| check 通过 | finish | `trellis-update-spec`（如有）→ commit → `trellis-finish-work` / archive |

**Quick 路径**：prd（可轻）→（可选极简 design）→ 写 `status=in_progress` → impl → check/review 精简 → finish。
仍禁止无验收标准就开写。

## 人卡点（硬）

1. **design 未 approved**（standard）→ 禁止写 `status=in_progress`、禁止改业务代码。
2. **design-review = blocking**（或尚未由独立审查产出 passed）→ 禁止 start/继续 impl。
3. **code review = blocking**（`review.md`）→ 禁止 archive；应回到 impl 修复后重审。
4. **`trellis-check` 或任务要求的验证未通过** → 禁止宣称完成 / archive。
5. 用户对 design 的确认必须是**本回合之后**的明确回复；创建 task ≠ 批准实现。

## 产物

从 `_templates/feat/` 复制（若 task 目录不存在）：

```text
prd.md
design.md
design-review.md
implement.md
review.md
```

## 子代理调度

| 阶段 | 子代理 | 写入 | 说明 |
|------|--------|------|------|
| design-review | 独立子代理（`trellis-channel` 或 subagent） | `design-review.md` | 独立设计审查；只读代码 + 写审查产物，不实现功能 |
| impl | 实现子代理（可选） | 业务代码 | 按 prd/design 实现 |
| review | 独立子代理 | `review.md` | 独立代码审查（findings-first） |
| 自修/验证 | `trellis-check` | 可改代码 | 对照 spec 自修 + 项目验证门；与独立审查互补，不互相替代 |

调度要求：
1. dispatch prompt 必须以 `Active task: <task 目录路径>` 开头。
2. design-review / code-review **必须由主会话派发**，实现主会话不得"自己写个 review 冒充独立审查"。
3. reviewer 返回 `blocking` → 停在该 stage，修复/改 design 后重派。

## 实现期规则

- 实现前：`trellis-before-dev`（读项目 spec 与已评审产物）。
- 实现后：`trellis-check`（对照 prd 验收 + 相关 spec）。
- 新约定：`trellis-update-spec`，写入 `.trellis/spec/`（含 `decisions/`）。

## 退出

| 结果 | 动作 |
|------|------|
| NeedsHuman | 停在当前 stage，只提 1 个最高价值问题或等待确认 |
| Routed | 若实为 bug/重构 → 转 `trellis-issue` / `trellis-refactor` |
| Completed | review/check 通过、已 archive |

## 反模式

- 未批准 design 就写 `status=in_progress`
- Quick 名义下改跨模块契约
- 用实现细节充当验收标准，跳过 prd 验收
