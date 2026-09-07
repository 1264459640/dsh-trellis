# Issue Report: 规划期只读保护把其他插件的工具也一并裁剪

## 1. 缺陷概述

开启「规划期只读保护（`enforceReadonlyPlanning`）」且会话处于 `undecided`（未建任务）或
`planning`（规划中）授权状态时，`lib/readonly.js` 的 `applyReadonlyPolicy` /
`applyReadonlySections` 采用**白名单保留**语义：只保留 `READ_TOOLS`（read/glob/grep/
read_image/inspect_image/pwsh/bash）+ 少量 trellis 工具，**其余工具全部移除**。

后果：DSH 会话中由其他插件注册的工具（如 `web_search`、`generate_image`、`subagent`、
`platform_search`、`skill` 等）在规划期全部消失，模型在规划调研阶段失去搜索/绘图/子代理等
能力，与「只读保护仅针对代码写工具」的设计意图不符。

## 2. 影响范围

- **受影响模块**：`lib/readonly.js`（`applyReadonlyPolicy` / `applyReadonlySections` /
  `allowedToolsFor` 及其常量集 `UNDECIDED_TOOLS` / `PLANNING_TOOLS`）
- **受影响场景**：
  - 会话处于 `no_task` 且未 `trellis_task_skip`
  - 会话处于 `planning` / `planning-inline`
  - 勾选了 `enforceReadonlyPlanning` 且项目命中 allowlist
- **受影响用户**：所有开启规划期只读保护的多插件部署

## 3. 复现路径

1. 在 DSH 设置中开启 `enforceReadonlyPlanning`，项目根加入 allowlist。
2. 在该项目新开对话（无 Trellis 任务）。
3. 检查 `system-prompt/assemble` 输出的 `assembled.tools`：
   - 实际行为：只剩 `read/glob/grep/read_image/inspect_image/pwsh/bash` +
     `trellis_state/trellis_task_create/trellis_task_skip`，`web_search`、`generate_image`、
     `subagent`、`skill` 等全部消失。
   - 期望行为：仅 `write`/`edit` 等代码写工具与不适用的 trellis 工具被裁剪，
     `web_search` 等其它插件的工具保留。

## 4. 证据

`lib/readonly.js` 第 83 行：

```js
return tools.filter((t) => t && typeof t.name === 'string' && allowed.has(t.name))
```

`allowed` 来自 `allowedToolsFor(authorization)`，返回 `UNDECIDED_TOOLS`（read +
trellis_state/create/skip）或 `PLANNING_TOOLS`（read + trellis_state/update/artifact_update），
即"保留集合"。凡不在此集合内的工具——包括其它插件注册的工具——一律被 `filter` 丢弃。

## 5. 期望行为

裁剪语义应为**按指定工具裁剪（denylist）**：

- `undecided`：仅裁剪 `write` / `edit`（代码写工具）及无任务时不适用/不允许的
  trellis 工具（`trellis_task_update` / `trellis_artifact_update` / `trellis_task_archive`）。
- `planning`：仅裁剪 `write` / `edit` 及规划期不适用的 trellis 工具
  （`trellis_task_create` / `trellis_task_skip` / `trellis_task_archive`）。
- 其余工具（含其它插件的工具、`skill`、`web_search` 等）原样保留。
- `authorized`（任务进入实施 / 已 skip）：不裁剪。

## 6. 下一步行动

推进至 `analyze`：确认 DSH `assembled.tools` 的装配来源与 section 命名规范，确定 denylist
集合与测试改造方案。
