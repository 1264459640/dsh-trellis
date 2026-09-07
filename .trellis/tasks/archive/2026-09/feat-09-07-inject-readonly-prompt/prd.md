# Feature PRD — 规划期只读保护：注入显式系统提示词

## 背景

当前 `enforceReadonlyPlanning` 只做"减法"：在 `system-prompt/assemble`（`lib/index.js:1020`）里按授权状态 denylist 裁剪工具列表（`applyReadonlyPolicy`）并移除对应的 `tool:<name>` 提示段（`applyReadonlySections`，`lib/readonly.js`）。`readonly.js` 是纯 filter，**从不向系统提示追加任何新文本**。

后果：no_task / planning 阶段模型虽然看不到 `write`/`edit` 工具，但系统提示里没有任何"你现在处于只读阶段、方案获批前禁止改代码"之类的显式指令。只读语义完全依赖工具面裁剪，缺少一条让模型明确理解自身状态的规则。

用户诉求：在 no_task 与 planning 阶段**注入显式的只读系统提示词**，而不是仅裁剪工具列表。

## 范围

### In Scope

1. 在 `lib/readonly.js` 新增纯函数，按授权状态产出只读指令文本：
   - `undecided`（无任务、未跳过）：说明当前无 Trellis 任务、工作区只读、应先分类需求并询问用户是否建任务，经用户确认后再动手。
   - `planning`（任务在规划类阶段）：说明方案获批前禁止修改源码，应先产出计划（prd/design 等）供用户确认。
2. 在 `lib/index.js` 的 `system-prompt/assemble` 处理器中，完成工具/工具段裁剪后，把指令文本以**新增 section** 形式追加进 `assembled.sections`（沿用 harness section 契约：非空唯一 `name` + 字符串 `text`）。
3. 注入条件与裁剪条件一致：`enforceReadonlyPlanning: true`、命中 allowlist、且授权状态为 `undecided`/`planning`；`authorized` 状态不注入（保留现有工具面行为不变）。
4. 补充单元测试，覆盖注入/不注入矩阵。

### Out of Scope

- 不改变现有 denylist 工具裁剪语义（裁剪集不变）。
- 不改 `agent/pre-step` 面包屑注入逻辑（user 角色消息，维持现状）。
- 不新增 `session/create` 一类的一次性会话钩子；注入跟随 `system-prompt/assemble` 每轮装配。
- 指令文本暂为中文硬编码（与现有面包屑/README 文案语言一致），不做 i18n。
- 不做运行时可配置文案（不做新设置项）。

## 验收标准

- [ ] `enforceReadonlyPlanning: true` + 命中 allowlist + `no_task`（未跳过）时，装配后的系统提示包含一段显式只读指令（如"当前无 Trellis 任务，工作区只读，先分类需求并询问用户是否建任务"）。
- [ ] 同上条件 + `planning` 阶段时，系统提示包含"方案获批前禁止修改源码，先产出计划供用户确认"的指令段。
- [ ] `authorized`（in_progress/completed 或已跳过）时不注入该指令段，系统提示与现状一致。
- [ ] 关闭 `enforceReadonlyPlanning` 或未命中 allowlist 时，完全不注入、也不裁剪（现状行为不回归）。
- [ ] 新增 section 的 `name` 唯一且非空、`text` 为字符串，不与既有 section（如 `harness:identity`、persona）冲突，装配校验通过。
- [ ] `node --test` 全量通过，新增用例覆盖上述矩阵。

## 约束与风险

- harness `system-prompt/assemble` 的装配校验（`dsh-system-prompt/lib/invariant.js`）要求 section `name` 非空唯一、`text` 必须为字符串：新增段必须满足，否则整条装配报错。
- `complete` section 语义：装配后若存在 complete section，最终只保留它（`assemble` 末尾 `sections: completeSection === void 0 ? transformed.sections : [completeSection]`）。若宿主部署了 complete section，我们追加的段会被丢弃——这是 harness 既定行为，接受；不为此绕过。
- section 顺序（`order`）：追加到列表尾部即可，不强行插队；persona 仍是模型读到的第一段。
- 只读保护是"防呆不防骗"：工具面裁剪 + 指令提示是软约束，模型仍可能通过保留的工具（如 `pwsh`）尝试写盘；文件系统沙箱（workspace-write 等）才是硬边界，本特性不替代沙箱。

## 相关代码/文档

- `lib/readonly.js` — `applyReadonlyPolicy` / `applyReadonlySections` / `authorizationOf` / `trimToolsFor`（现有纯 filter，本特性在其上扩展指令文本函数）。
- `lib/index.js:1009-1043` — `system-prompt/assemble` 处理器（注入点）。
- `lib/state.js:99-111` — `FALLBACK_BREADCRUMBS`（no_task/planning 文案风格参照）。
- `node_modules/.pnpm/@deepseek-ai+dsh-system-pro_*/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js` — section 契约与装配流程。
- 历史提交：`1ebe077`（issue-09-06 裁剪 tool 段）、`7a1af2f`（issue-09-07 denylist 语义）。
