# Review

> **评审来源说明**：本轮先后派出两个独立评审子代理，均在 10 分钟以上未返回任何产物（唯一落盘的是第一个代理导出的 `_diff-*.txt` 快照与 `_test-output.txt`），已被中断。本文件由主会话基于这些 diff 快照、规划产物与全量测试结果做结构化审查；**独立第三方评审仍建议在合并前补做一次**（`review.md` 不应被当作独立审查的证据）。

## Finding 清单

### P0
无。

### P1
无。安全边界（trust-fence → 会话 cwd → allowlist → sandboxPolicy）、写入路径固定为 `.trellis/doc.json`、响应只含项目相对路径、缓存失效 key 与 `resolveSpecIndex` 一致，均有代码与测试证据。

### P2

1. **客户端交互未做行为级覆盖**（`test/client-doc-config.test.js`）
   `DocConfigView` 的渲染用脚本化 `useState` 驱动，只断言四态渲染与保存按钮禁用条件；`addFile` / `moveFile` / `removeFile` / `save` 的点击行为没有真实状态推演。路由层测试覆盖了请求语义，所以风险有限，但「上移下移写反」「保存漏传 root」这类回归测不出来。
   建议：补一个带真实 `useState` 队列的轻量 hook stub，至少覆盖一次「添加 → 上移 → 保存」的 payload。

2. **invalid 态无法一键载入旧索引**
   `readDocConfigSnapshot` 在 `state:'invalid'` 时返回 `legacy: null`，用户只能手动输入路径或整份覆盖。PRD 只要求「给出修复指引」，属可接受取舍，但和 absent 态的能力不对称。
   建议：必要时在 invalid 态也返回 `legacy`（复用 `listProjectSpecs`），让「修复」也能从现有索引起步。

3. **`readDocConfigObject` 读失败时静默返回 `{}`**
   保存前若旧配置暂时不可读（权限/占用），未知顶层字段会被丢弃（仅在草稿本身校验通过后发生）。不会破坏注入语义，但可能丢注释性字段。
   建议：读取失败与「配置无法解析」区分开；不可读时拒绝覆盖并返回可读错误。

4. ~~**路由对 `root` 的类型宽松**~~（**已修**）
   `lib/index.js` 现在对 `root !== undefined && root !== null && typeof root !== 'string'` 直接返回 400；`doc-config-route.test.js` 增加对应用例。

### P3

5. **`conversation.view` 的 `order: 20` 与 Git 视图可能并列**
   若 Git 也使用 20，标签顺序取决于注册顺序。视觉影响，无功能影响；需要固定顺序时改成更大/更小的显式值。

## 验证证据

- `node --test`：**291 / 291 通过**（含新增 `doc-config.test.js` 34 项、`doc-config-route.test.js` 6 项、`client-doc-config.test.js` 11 项）。
- 预算一致性：`planDocBudget` 覆盖 8192 / 32768 / 剩余 511 与 512 边界；`renderDocBodies` 原有 5 条断言在重构后逐字节通过。
- 安全：路由测试覆盖 cross-site 403、非 allowlist 403、未知会话 404、preview 400 且不写盘、非字符串 root 400。
- 缓存：保存后立刻 `ctx.waterfall('system-prompt/assemble')` 读到新正文（先缓存 `null`，保存后立即出现 section），证明 `specIndexCache.delete(root)` 生效。
- 规范对齐：`web-ui` 第 39–42 条与 `task-engine` 第 7 条已记录本次契约。

## Check（trellis-check）

| 检查项 | 命令 / 方式 | 结果 |
|---|---|---|
| 语法检查 | `node --check lib/spec.js lib/index.js lib/client.js` | 0 errors |
| 类型检查 | 仓库无 `type-check` / `tsc` 脚本（纯 ESM JS） | 不适用 |
| Lint | 仓库无 lint 脚本 | 不适用 |
| 全量测试 | `node --test` | 291 / 291 通过，0 失败 |
| 测试有效性 | 人工复核新增用例 | 路由/预算/写盘为真实行为断言；客户端交互覆盖见 P2-1 |
| PRD AC1–AC8 | 逐条核对 | 全部满足（AC1 顶部视图、AC2 四态、AC3 校验、AC4 预算、AC5 立即生效、AC6 安全、AC7 兼容、AC8 文档） |
| 规范门禁 | `web-ui` 39–42 / `task-engine` 7 | 已对齐并记录 |

## 结论

无 blocking 问题，可进入人工验收。P2 的 1、3 建议后续迭代处理；2、5 属产品取舍。
