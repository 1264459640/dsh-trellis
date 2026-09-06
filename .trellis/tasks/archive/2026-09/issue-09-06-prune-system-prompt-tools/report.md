# Issue Report: 规划期只读保护下 System Prompt 工具说明文本未随裁剪工具同步修剪

## 1. 缺陷概述
当在设置中开启「规划期只读保护（`enforceReadonlyPlanning`）」且当前会话处于 `no_task`（未建任务）或 `planning`（规划中）阶段时，Trellis 插件通过 `system-prompt/assemble` 钩子成功裁剪了 `assembled.tools`（Tool Declarations / API 工具定义列表），但下发给模型的自然语言 **System Prompt 文本说明中依然残留了 `edit`、`write` 等工具的使用指南**。

导致后果：模型在阅读 System Prompt 时误以为自己拥有完整的写操作权限并尝试直接调用/修改文件。

## 2. 影响范围
- **受影响模块**：`lib/index.js`（`system-prompt/assemble` 钩子处理）、`lib/readonly.js`
- **受影响场景**：
  - 会话处于未建任务（`no_task`）且未执行 `trellis_task_skip`
  - 会话处于规划阶段（`planning`）
  - 勾选了 `enforceReadonlyPlanning`

## 3. 复现环境与证据
1. **环境**：
   - DSH Web GUI (`@deepseek-ai/dsh-web-app@0.1.2-rc.1`)
   - 插件：`@banana-peeljj12/dsh-trellis@0.3.0-rc.5`
   - 会话模式：`workspace-write`
2. **证据**：
   - **截图证据**：Web GUI 侧边栏/调试面板中的「工具」标签页仅展示了 `read`、`glob`、`grep`、`trellis_*` 等只读工具，证明 `assembled.tools` 已被正确过滤。
   - **日志证据**（`session.jsonl` 第 14 行 `request/header.system`）：
     实际下发给模型的 System Prompt 纯文本中明确包含：
     ```text
     Use the write tool to create files or completely replace file contents. Existing files are overwritten...
     Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string...
     ```

## 4. 预期行为 vs 实际行为
- **预期行为**：当 `applyReadonlyPolicy` 对 `assembled.tools` 执行裁剪后，System Prompt 的自然语言说明部分应与被裁剪后的工具集严格对齐，或者在 Prompt 层面注入明确的强约束/剔除写工具段落。
- **实际行为**：`assembled.tools` 被裁剪，但 System Prompt 的工具指令文本未同步剔除，产生断层。

## 5. 下一步行动
推进至 `analyze` 阶段，深入排查 DSH 的 `system-prompt/assemble` 接口规范中，系统提示词各个 section / instructions 的装配与裁剪机制。
