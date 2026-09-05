# 验证评审 — 0.3.0 规划期只读保护重设计（授权状态机 + trellis_task_skip）

## 任务来源与演进

原始任务「验证 0.3.0 插件新能力」，验证过程中发现的缺陷驱动了两次
范围升级：
1. **设置面板缺控件**：`enforceReadonlyPlanning` 在 schema（lib/meta.js）
   已定义、宿主侧裁剪逻辑已实现，但 `lib/client.js` 的 TrellisSettingsTab
   未渲染该字段——用户在 GUI 无法开关。→ 方案 B 补控件（v1 修复）。
2. **no_task 裸奔 + 相位语义冲突**（重设计，v2）：旧实现仅在
   `st.phase==='planning'` 裁剪，新对话（no_task）完全不设防——恰恰是最该
   只读的阶段；且 no_task 同时承载「未表态」与「已跳过任务」两种授权态。
   → 采纳用户提议的第一性原理重设计：授权状态机 + 显式跳过工具
   `trellis_task_skip`。

## 通过项（验证矩阵 v2，逐项核实）

| 能力 | 结果 | 证据 |
|---|---|---|
| undecided 只读（新对话） | ✅ | authorizationOf('no_task',false)='undecided'；工具面=读+state+create+skip，无 write/edit/artifact/update/archive |
| planning 只读 | ✅ | authorizationOf('planning')='planning'；工具面=读+state+update+artifact，无 write/edit/skip |
| authorized 全量（in_progress/完成） | ✅ | allowedToolsFor('authorized')=null，不裁剪 |
| skip 授权 | ✅ | skipTaskPointer 写 skipped:true 且 current_task=null；bind 任务后清 skipped（互斥双向）；有活动任务时 skip 被拒 |
| 开关语义 | ✅ | enforceReadonlyPlanning=false 时 hook 直接 return assembled（全阶段不裁剪） |
| 单测 | ✅ | test/readonly.test.js 11 用例全过；全量 53/53 通过无回归 |
| 发布链路 | ✅ | pnpm pack 产物 rc.4 tgz 含 lib/readonly.js 与 trellis_task_skip |

## 缺陷清单（验证发现，处理结果）

| # | 缺陷 | 级别 | 处理 |
|---|---|---|---|
| D1 | Web 设置面板缺 `enforceReadonlyPlanning` 控件（UI 与 schema 不同步） | 中 | 就地修复：lib/client.js 新增复选框 + zh/en 文案（已提交） |
| D2 | 新对话（no_task）不受只读保护，且相位同时承载两种授权语义 | 高 | 重设计：授权状态机（lib/readonly.js）+ 显式 `trellis_task_skip` 工具（已提交） |
| D3 | 同版本号 tgz 用 `dsh plugin add` 覆盖安装可能不生效（rc.3→rc.3 同名） | 中 | 用户手动卸载重装（方案 B）验证成功；正式发布随版本号 bump 到 rc.4 规避；本任务 release 流程即体现 |
| D4 | 验证时机错位：任务推进到 impl 后才发现开关语义问题，旧功能从未在 planning 阶段被真正激活过 | 低 | 记录为流程教训：验证「阶段相关行为」应在该阶段内进行；已列入 check 报告 |
| D5 | node --test 在 DSH 文件沙箱（受限模式）下因 runner spawn 管道 EPERM 无法直接运行 | 低 | 沙箱边界，非插件缺陷；CI/无沙箱环境可跑 npm test |

## 结论

v2 设计满足 prd.md 的 AC1–AC7 可观察验收标准（AC1 新对话只读、AC2 skip
授权、AC3 planning 只读、AC4 authorized 全量、AC5 开关、AC6 单测、AC7
产物）。验证期间未发现授权状态机的逻辑缺陷；D1–D5 均已就地修复或有明确
处理依据。规划期只读保护从「planning 一刀切」升级为「按授权等级逐级
放行」，并补上了跳过任务的显式旁路。

## 遗留 / 后续

- 真机 GUI 验证（用户已用方案 B 安装并确认工具面行为）建议在 rc.4 安装后
  复验一轮：新对话工具面、skip 授权、planning 只读。
- 本任务按用户指示推进 rc.4 发布（bump + tag + push）。