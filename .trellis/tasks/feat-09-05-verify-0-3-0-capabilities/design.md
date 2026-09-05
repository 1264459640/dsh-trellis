# 设计方案 v2（已定案）— 授权状态机 + 跳过任务工具

> 取代「仅 planning 阶段裁剪」的 v1。三条设计决策已由产品确认（下述 ⚖️）。

## 1. 背景与第一性原理

模型有权写产品代码的唯一时刻，是「存在任务且方案已批准」或「用户已明确
授权跳过任务」。v1 只在 `st.phase === 'planning'` 裁剪，导致：
- 新对话（`no_task`）裸奔——最该只读的阶段没有保护；
- `no_task` 同时承载「尚未表态」和「用户已跳过任务」两种态，不可混淆。

## 2. 授权状态机（authorization，与 phase 解耦）

| 授权态 | 含义 | 工具面 |
|---|---|---|
| `undecided` | 新对话/无任务/未表态 | 读 + `trellis_state` + `trellis_task_create` + `trellis_task_skip` |
| `planning` | 已建任务，status=planning | 读 + `trellis_state` + `trellis_task_update` + `trellis_artifact_update` |
| `authorized` | 任务批准进 in_progress，**或已跳过任务** | 全量（含 write/edit） |

```
undecided ──trellis_task_create──▶ planning ──批准──▶ authorized(in_progress)
    │                                                   ▲
    └─────────── trellis_task_skip（人确认后）──────────┘
```

读工具基线：`read glob grep read_image inspect_image pwsh bash`

## 3. 新工具 `trellis_task_skip`（跳过任务）——定案

- **交互**：模型在只读态判断「无需正式任务」→ 用提问（ask_user_question
  或普通对话）向人类确认 → 人类同意后调用本工具落盘。**无参**——确认走
  「模型提问 → 人类普通回复 → 再调用」，与 `trellis_task_create` 的
  consent 模式一致（⚖️ 决策 1）。
- **落盘**：写入本会话指针文件 `<sessionFileBasename(sessionId)>.json` 的
  `skipped: true` 字段；**与 `current_task` 互斥**。
- **门禁**：仅 `undecided` 态放行；已有活跃 planning/in_progress 任务时拒绝
  （提示先 `trellis_task_update` 解绑或走正常轨道）。
- **单向**：跳过后不能退回 undecided，只能经 `trellis_task_create` 重回
  task 轨道（⚖️ 决策 2）。

## 4. authorizationOf —— 纯函数契约

```
authorizationOf(phase, skipState):
  phase == 'no_task' && !skipState → 'undecided'
  phase == 'planning' | 'planning-inline' → 'planning'
  phase == 'no_task' && skipState  → 'authorized'
  phase ∈ {in_progress, completed}  → 'authorized'
```

工具面裁剪由该授权态决定；面包屑/芯片仍展示 phase（不随 skip 变）。

## 5. 开关语义

`enforceReadonlyPlanning`（默认 false）重构为**规划期只读保护总开关**：

- `false`：不裁剪任何阶段（兼容升级）。
- `true`：授权状态机生效——`undecided`、`planning` 只读，`authorized` 全量。
- `undecided` 只读同样受总开关控制，**不强制**（⚖️ 决策 3）。

## 6. 验证矩阵 v2

| 能力 | 正向用例 | 防御性反例 |
|---|---|---|
| undecided 只读 | 新对话工具面 = 读 + state + create + skip，无 write/edit/artifact | 不含 task 轨道专属工具（update/archive） |
| trellis_task_skip | undecided 确认后跳过 → authorized 全量 | 已有任务时 skip 被拒；未确认不落盘 |
| planning 只读 | planning 任务 → 读 + artifact + update | artifact 外写（源码）被拒 |
| authorized 全量 | in_progress / skip 会话含 write/edit | — |
| 开关 | false 全阶段不裁剪 | allowlist 外不裁剪 |

## 7. 相关文件

- lib/readonly.js（新增：authorizationOf 纯函数 + 工具集）
- lib/index.js（assemble 改用授权态；新增 trellis_task_skip 工具）
- lib/task.js（skip 指针落盘/互斥 + writePointerFile 扩展）
- lib/state.js（session 指针解析出 skipped 字段）
- lib/client.js（设置面板复选框 + 新语义文案）
- test/readonly.test.js（新增单测）

## 8. 开放问题

（无——三个决策均已定案，见 ⚖️ 标记。）