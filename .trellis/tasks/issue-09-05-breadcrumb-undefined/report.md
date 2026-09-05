# Issue Report

## 现象
- 启用 `@banana-peeljj12/dsh-trellis` 0.3.0-rc.x（"原生融合执行步骤"特性所在版本）后，对话首轮即失败，报错：
  `session event "user/message" carries non-JSON-serializable data`（本轮运行失败）。

## 复现步骤
1. 在 DSH 0.1.2-rc.1 环境（`homes\0.1.2-rc.1-2`）启用 trellis-workflow 0.3.0-rc.1 / rc.2。
2. `allowlist` 包含会话 cwd（如 `F:\dsh-plugins\dsh-trellis` 或 `F:\Projects\FordProject`）。
3. 在匹配项目内发送任意消息（"无活动任务/无执行步骤"的常态即可，无需任务）。
4. `agent/pre-step` 注入面包屑消息后，`dsh-agent-loop` 将该消息写入会话事件时抛错，本轮运行失败。

## 期望 vs 实际
- 期望：会话正常推进，面包屑作为 `user/message` 事件写入会话日志（与 `dsh-agent-instructions` 相同）。
- 实际：`session.append("user/message", …)` 抛 `session event "user/message" carries non-JSON-serializable data`，本轮运行失败。

## 影响范围
- 插件版本：0.3.0-rc.1 与 0.3.0-rc.2（`stepId` 字段新增后）。
- harness 版本：仅 DSH 0.1.2-rc.1 起（`dsh-session` 引入 lossless-JSON 字段级校验）显式报错；
  `0.1.2-alpha.x` 不校验事件数据，问题被掩盖（本会话所在 alpha.5 环境即不报错）。

## 证据
- 旧实现 `lib/breadcrumb.js:129`：`stepId: stepInfo && stepInfo.step ? stepInfo.step.id : undefined`
- `dsh-agent-loop/lib/index.js:559`：`for (const message of decision.messages) this.session.append("user/message", message, { surfaceOp: "append" })`
- `dsh-session/lib/index.js:1409-1410`：`dataSnapshot === undefined` 即抛错
- git 历史：`stepId` 由 commit `96ac3e0`（feat: native execution steps…）引入，旧版 `source` 无此字段
- 安装实例核对：`homes\0.1.2-rc.1-2\profiles\web\node_modules\@banana-peeljj12\dsh-trellis` 为 0.3.0-rc.2，含同样缺陷代码
- 回归测试：`test/native-steps.test.js` → "buildBreadcrumbMessage omits absent source fields (lossless-JSON safe)"