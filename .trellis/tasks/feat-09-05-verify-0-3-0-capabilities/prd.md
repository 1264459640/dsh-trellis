# Feature PRD — 规划期只读保护重设计（授权状态机 + 跳过任务工具）

## 背景

dsh-trellis 0.3.0 的规划期只读保护（`enforceReadonlyPlanning`）原设计仅在
任务处于 planning 阶段时裁剪 write/edit 工具。真实验证暴露两个缺陷：

1. **新对话（no_task）不受保护**——恰恰是最该只读的阶段（连要做什么都没
   说清，不该有 write/edit）。
2. **no_task 相位语义冲突**：它同时承载「尚未表态」和「用户已明确跳过任务」
   两种完全不同的授权状态。

由此确立重设计目标：用「授权状态机」取代「phase 裁剪」，并新增显式的
跳过任务工具，作为新对话获得写权限的唯一旁路。

## 已确认事实（证据）

- 原裁剪 hook：`lib/index.js:921-959`，仅 `st.phase==='planning'` 时把工具面
  过滤到 PLANNING_SAFE_TOOLS（read/glob/grep/inspect_image/read_image/pwsh/
  bash/trellis_state/trellis_task_update/trellis_artifact_update）。
- phase 解析：`lib/state.js phaseFor()`——status=planning→planning；
  status=in_progress→in_progress；无任务→no_task。**no_task 无裁剪**。
- 配置：`enforceReadonlyPlanning` 默认 false（lib/meta.js:41）。
- 会话指针：`lib/task.js writePointerFile` 写 `<session>.json` 的
  `current_task`；`activeTaskForSession` 读取。skip 标记需在此层扩展。
- 设置面板 `lib/client.js TrellisSettingsTab` 原本无该字段控件（已修复补充
  checkbox，见 lib/client.js 改动）。
- 验证时机错位：本会话建任务后即进入 planning 十余轮，但当时开关为 false；
  开关打开时任务已推进到 impl——旧功能从未在正确阶段被激活过。

## 范围

### In Scope
- **重设计**：新增 `lib/readonly.js` 授权状态机纯函数（undecided / planning /
  authorized）+ 工具集白名单。
- **新工具** `trellis_task_skip`：undecided 态经用户确认后落盘 skip 指针，
  会话升 authorized；与 current_task 互斥；已有任务时拒绝；单向。
- **plumbing**：lib/index.js 的 system-prompt/assemble 改用授权态裁剪；
  lib/task.js 指针落盘扩展 skip 字段；lib/state.js 解析 skipped。
- **开关语义**：enforceReadonlyPlanning 从「仅 planning」重构为总开关
  （false 全不裁 / true 授权状态机生效）。
- **设置面板**：enforceReadonlyPlanning 复选框（已完成）+ 新语义文案。
- 单测：test/readonly.test.js 覆盖三授权态正向 + 防御反例。
- 验证：新对话只读、skip 授权、planning 只读、authorized 全量。

### Out of Scope
- 不 bump version、不 npm 发布。
- 不改 steps/artifact/步骤注入既有能力行为（仅验证）。
- 不引入 skip 之外的其它授权态（如 per-step 授权）。

## 验收标准

- [ ] AC1 undecided 只读：新对话(no_task,未跳过)工具面=读+state+create+skip，
      无 write/edit/artifact/update/archive。
- [ ] AC2 skip 授权：undecided 经用户确认调 trellis_task_skip → authorized
      （write/edit 恢复）；已有 active 任务时 skip 被拒；未确认不落盘。
- [ ] AC3 planning 只读：planning 任务工具面=读+state+update+artifact，
      无 write/edit/skip。
- [ ] AC4 authorized 全量：in_progress 或 skipped 会话含 write/edit。
- [ ] AC5 开关：enforceReadonlyPlanning=false 全阶段不裁剪；allowlist 外不裁剪。
- [ ] AC6 授权态纯函数单测通过；现有测试不回归。
- [ ] AC7 项目产物齐备（prd/design/implement/review/check），review 汇总，
      check 产出验收报告。

## 约束与风险

- 工具 schema：output.schema 必须 additionalProperties 显式。
- skip 指针与 current_task 互斥的持久化需向后兼容（旧指针文件无 skipped 字段）。
- 发布仍需同步 profile 安装副本（已改 tgz 打包方案，用户手动安装）。

## 相关代码/文档

- lib/index.js、lib/meta.js、lib/state.js、lib/task.js、lib/resolve.js、
  lib/client.js、scripts/install.mjs、
  .trellis/spec/trellis-workflow/task-engine/index.md、
  .trellis/spec/trellis-workflow/web-ui/index.md。