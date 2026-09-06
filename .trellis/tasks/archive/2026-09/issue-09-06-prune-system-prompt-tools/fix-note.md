# Fix Note: 规划期只读保护下 System Prompt 工具文本未同步修剪问题

## 1. 修复摘要
解决当开启 `enforceReadonlyPlanning` 且会话处于未建任务（`no_task`）或规划中（`planning`）状态时，Tool Declarations 已被裁剪但自然语言 System Prompt 中仍残留 `edit`、`write` 等写工具指南导致模型误以为有写权限的问题。

## 2. 代码变更点
1. `lib/readonly.js`：
   - 增加导出 `applyReadonlySections(sections, phase, skipState)`。
   - 对遵循 `tool:<name>` 规范的 section，检查 `<name>` 是否属于当前授权状态允许的工具集合；不在允许集合中的 section（例如 `tool:write`、`tool:edit`）被自动剔除；非 `tool:*` 前缀的 section（如 persona、instructions、workspace policy 等）完整保留。
2. `lib/index.js`：
   - 在 `system-prompt/assemble` 钩子中，同步调用 `applyReadonlySections(assembled.sections, st.phase, st.skipState)`。
   - 当 `tools` 或 `sections` 任一被裁剪时，合并返回修剪后的完整 `assembly` 对象。
3. `test/readonly.test.js`：
   - 增加 4 组针对 `applyReadonlySections` 的全面单测：覆盖 `no_task` 阶段裁剪、`planning` 阶段裁剪、授权/跳过状态不修剪、异常容错等场景。

## 3. 验证结果
- `node -e "import('./test/readonly.test.js')"`：15 项只读测试 100% 通过。
- 核心测试集（`git`、`state`、`native-steps`、`board`）：39 项既有测试 100% 通过。

## 4. 影响评估与兼容性
- 纯向前兼容。只读保护未开启或处于 `in_progress`/`completed`/`skipped` 状态时不触发任何修剪。
- 根除了自然语言提示词中遗留写工具指南引发的模型幻觉与越权尝试。
