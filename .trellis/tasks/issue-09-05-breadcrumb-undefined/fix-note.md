# Issue Fix Note

## 改动摘要
- `lib/breadcrumb.js`：`buildBreadcrumbMessage` 的 `source` 由"写入 `undefined` 值"改为**条件展开省略可选字段**
  （`project` / `stepId` 缺省时键不存在，而非键值为 `undefined`）。
- `test/native-steps.test.js`：新增回归测试 **"buildBreadcrumbMessage omits absent source fields (lossless-JSON safe)"**，
  用与 harness 相同的 lossless-JSON 规则（`isLosslessJson`：拒绝 undefined/函数/符号/大整数/非有限数/-0/稀疏数组/循环引用）
  断言：无步骤时 `stepId` 键不存在、无 `projectRoot` 时 `project` 键不存在、有步骤时 `stepId` 正常且消息整体通过校验。

## 根因对应
- 旧代码 `stepId: stepInfo && stepInfo.step ? stepInfo.step.id : undefined` 在"无活动步骤"时产生 `undefined` 属性值；
  `structuredClone` 保留该键；`dsh-agent-loop` 把注入的面包屑整体 append 为 `user/message` 会话事件；
  `dsh-session` 的 `snapshotJsonValue` 拒绝任何 `undefined` → `session event "user/message" carries non-JSON-serializable data`。
- 修复后 source 只含真实存在的字段，事件数据全程 lossless-JSON，`append` 不再抛错。

## 验证
- 按 `.trellis/spec/trellis-workflow/task-engine/index.md` 质量门（单元测试套件）验证，全部通过：
  - `node test/native-steps.test.js` → 10/10（含新回归测试）
  - `node test/index.test.js` → 24/24
  - `node test/client.test.js` → 2/2
  - `node test/git.test.js` → 6/6
- 环境说明：沙箱对 `node --test` 运行器 spawn 子进程（管道 stdio）报 EPERM（文档化边界），改以
  `node test/*.test.js` 直跑（`node:test` 同进程模式）；GitHub Actions CI（Node 22）继续执行 `npm test`。

## 后续债务
- 需发布新插件版本（如 0.3.0-rc.3 / 0.3.0）并在 `homes\0.1.2-rc.1-2\profiles\web` 的安装副本上升级后复测
  （安装副本当前为 0.3.0-rc.2，仍含旧代码）。
- 建议把"可选字段一律条件展开、杜绝 `undefined` 落盘"写成 `lib/` 的约定，避免同类问题复发
  （可与 `dsh-agent-instructions` 的 `...(x === void 0 ? {} : {…})` 模式对齐）。