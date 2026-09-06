# Issue Analysis: 规划期只读保护下 System Prompt 工具文本未同步修剪问题

## 1. 根因分析（Root Cause）

### 1.1 DSH System Prompt 装配机制
在 `@deepseek-ai/dsh-system-prompt` 中，系统提示词的组装流程如下：
1. **收集 Sections**：各个插件（如 `dsh-tool-fs`）通过 `ctx.systemPrompt.section({ name: "tool:xxx", text: "..." })` 注册独立的说明片段。例如：
   - `tool:write`: `"Use the write tool to create files or completely replace file contents..."`
   - `tool:edit`: `"Use the edit tool for targeted changes to existing UTF-8 text files..."`
2. **收集 Tools**：各个插件通过 `ctx.tools.register(...)` 注册 tool call schema。
3. **调用 Waterfall Hook**：触发 `'system-prompt/assemble'`，传入 `assembly` 对象：
   ```typescript
   const assembly = {
     sections: [...], // Array<{ name: string, text: string }>
     contexts: [...],
     tools: [...],    // Array<{ name: string, description: string, parameters: object }>
     variables: {...}
   };
   ```
4. **渲染输出**：DSH 最终给大模型的自然语言 System Prompt，直接由 `assembly.sections` 拼接渲染生成，而 `assembly.tools` 则作为 OpenAI-compatible tool declarations 传入请求参数。

### 1.2 当前 Trellis 只读保护实现的盲区
在 `dsh-trellis` 的 `lib/index.js`（行 1017）和 `lib/readonly.js` 中：
```javascript
const tools = applyReadonlyPolicy(assembled.tools, st.phase, st.skipState)
if (tools) {
  return {
    ...assembled,
    tools,
  }
}
```
**致命盲区**：`applyReadonlyPolicy` 只对 `assembled.tools` 数组进行了过滤，返回了裁剪后的工具列表，但**完全没有处理 `assembled.sections`**。

导致的结果：
1. Tool declarations 列表里确实没有了 `write` 和 `edit`（GUI 侧边栏的工具栏正确显示已裁剪）。
2. 但 `assembled.sections` 里的 `tool:write` 和 `tool:edit` 片段依然原封不动地被拼装进最终的 System Prompt 纯文本中。
3. 模型从自然语言说明中看到了完整的写工具使用指南（且在 `workspace-write` 沙箱下底层系统未硬阻拦该工具的执行），从而误以为自己拥有修改权限并调用了工具。

## 2. 解决方案设计（Solution Design）

### 2.1 方案选型：同步修剪 `sections`
扩展只读策略，使其对 `assembled.sections` 执行联动修剪：
- DSH 工具插件注册的 section 名称均严格遵循 `tool:<toolName>` 规范（例如 `tool:write`、`tool:edit`、`tool:glob`、`tool:pwsh` 等）。
- 当当前处于 `undecided` 或 `planning` 授权状态时：
  1. 得到允许的工具白名单 `allowed = allowedToolsFor(authorization)`。
  2. 过滤 `assembled.tools`：保留 `allowed.has(tool.name)`。
  3. **过滤 `assembled.sections`**：
     - 若 section 名称匹配 `tool:<name>`，检查 `name` 是否在 `allowed` 中；若不在，则剔除该 section。
     - 非 `tool:` 开头的常规 section（如角色设定、工作区上下文等）一律予以保留。

### 2.2 防御性加固
- 当处于只读状态时，在 sections 中追加一段明确的系统提示约束（例如 `[trellis:readonly]` 提示当前处于规划/只读保护阶段，严禁发起代码和工程文件变更），形成 Tool Declaration + Prompt Sections + Prompt Reminder 的三重防护。

## 3. 验收标准（Acceptance Criteria）
1. `applyReadonlyPolicy` 支持同时裁剪 `tools` 与 `sections`（或导出专门的 `prunePromptSections`）。
2. 在 `no_task` 或 `planning` 阶段且 `enforceReadonlyPlanning` 为 true 时：
   - `assembled.tools` 不包含 `write`、`edit`。
   - `assembled.sections` 不包含 `tool:write`、`tool:edit`。
   - `session.jsonl` 中生成的系统提示词文本中不再出现 `Use the write tool` 和 `Use the edit tool`。
3. 单元测试覆盖：测试在只读阶段 `sections` 与 `tools` 是否同步被正确剔除。
