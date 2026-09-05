# Issue Analysis

status: confirmed

## 根因

`buildBreadcrumbMessage` 往面包屑消息的 `source` 里写入 `stepId: … : undefined`（无活动步骤时必然为 `undefined`）。
`createUserMessage` → `freezeMessage` → `structuredClone` **保留** `undefined` 属性值（只有 `JSON.stringify` 才会丢键）。
该消息经 `agent/pre-step` 注入 `decision.messages` 后，被 `dsh-agent-loop` 整体 `append` 为 `user/message` 会话事件；
`dsh-session` 的 `snapshotJsonValue`（`walkJsonValue`）对 `undefined`（`typeof !== "object"` 且非 null/boolean/string/number）直接返回 `undefined`，
`append` 即抛 `session event "user/message" carries non-JSON-serializable data`。

## 证据链

1. `lib/breadcrumb.js:129`（旧）写 `stepId: undefined` —— git 确认该行由 `96ac3e0` 新增；
   旧版（≤0.2.0）`source` 仅有 `kind/form/phase/project`，且 `project` 在注入路径恒为非空字符串（allowlist 匹配后才注入），旧版实际不触发。
2. `createUserMessage` → `freezeMessage(structuredClone(message))` 保留 `undefined` 键值。
3. `dsh-agent-loop/lib/index.js:559` 将 `decision.messages` 逐条 `append("user/message", message, { surfaceOp: "append" })`。
4. `dsh-session/lib/index.js:1409-1410`：`dataSnapshot === undefined` 时抛错；
   `dsh-util-values` 的 `walkJsonValue` 对 `undefined` 值返回 `undefined`。
5. 参考实现 `dsh-agent-instructions` 用条件展开 `...(x === void 0 ? {} : {…})`，从不落 `undefined` —— 本插件未对齐（插件注释声称"镜像该 shape"）。

## 修复方向

`source` 改为条件展开，缺省即省略字段（与参考实现同款模式）：

```js
source: {
  kind: sourceKind,
  form: 'trellis-breadcrumb',
  phase,
  ...(projectRoot ? { project: projectRoot } : {}),
  ...(stepInfo && stepInfo.step ? { stepId: stepInfo.step.id } : {}),
}
```

补回归测试：断言无活动步骤时 `source` 不含 `stepId` 键、整体消息通过 lossless-JSON 校验
（用与 harness 相同的拒绝规则：undefined/函数/符号/大整数/非有限数/-0/稀疏数组/循环引用）。

## 回归风险

低。

- `project`/`stepId` 均为可选展示字段，省略后不改变面包屑正文（`headerLines`/`fullText`）与注入/去重逻辑（去重只比对 `source.kind === SOURCE_KIND`）。
- 消息 `source` 形状更接近 `dsh-agent-instructions` 的既有约定。

## 是否可跳过本文件

- 根因已由对话内静态证据链确认（git 历史、harness 源码 `dsh-session`/`dsh-agent-loop`/`dsh-util-values`、安装实例 `homes\0.1.2-rc.1-2` 三方核对），
  无需要"修了又复发"的歧义，故任务直接以 `stage=fix` 创建，未单开 analyze 阶段；本文件记录完整证据链备查。