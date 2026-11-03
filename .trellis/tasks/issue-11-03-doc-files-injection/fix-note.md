# Fix Note

## 结论

非缺陷。`files` 注入与每轮面包屑都正常工作，实际行为符合 `feat-11-02` 的既定设计：**只注入路径 + 先读约束，不注入正文**。

证据见 `report.md`：FordProject 2026-11-03T01:20:54Z 的 system prompt 含「Trellis 项目文档文件清单」+ 8 个路径；本仓库同日的 system prompt 含「Trellis 工程规范索引」+ 2 个 spec 路径；FordProject 该会话 10 条 `[trellis/...]` 面包屑均在。

## 代码改动

无。未修改任何业务代码。

## 后续

用户要求改为「注入正文而不是路径」，属于行为变更，已转 `feat-11-03-doc-body-injection` 承接（预算：总量 32KB / 单文件 8KB，超出截断并保留路径）。

## 验证证据

- FordProject `session-5b3fcabd-…`：`system/message` @ 2026-11-03T01:20:54Z，含 8 个 files 路径。
- `E:/dsh_plugins/dsh-trellis` `session-cf0cc6f7-…`：`system/message` @ 2026-11-03T01:33:15Z，含 2 个 spec 索引路径。
- 两个项目均无 `Trellis 项目文档配置无效` 诊断。
