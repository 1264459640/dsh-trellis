# Issue Report

## 现象

用户在 `E:/Project/FordProject` 增加 `.trellis/doc.json`（自定义文档位置：`root: "docs"` + 8 个 `files`，创建于 2026-11-02 21:07）后，怀疑 Trellis 的自动注入能力（"面包屑" / `trellis:spec-index`）丢失。

用户核心问题：**现在会自动注入 `files` 里的文件吗？**

## 复现步骤

1. 打开 FordProject 任意一轮会话（该轮请求会生成 `system/message` 事件，内含完整 system prompt）。
2. 在其中检索 `Trellis` 相关注入段，确认 `trellis:spec-index` 是否存在、内容是什么。
3. 对照组：打开没有 `.trellis/doc.json` 的项目（本仓库 `E:/dsh_plugins/dsh-trellis`）同一位置，确认旧 `.trellis/spec/**` 扫描是否仍工作。

## 期望 vs 实际

- 期望（用户）：`files` 里列出的文件被自动注入。
- 实际：注入的是 `files` 的**项目根相对路径清单 + 先读约束**，**不注入文件正文**。注入能力本身正常，未丢失。
- 对照：无 `doc.json` 的项目仍注入 `.trellis/spec/**` 索引，说明"无配置兼容"分支也正常。

## 影响范围

- 仅影响 `trellis:spec-index` 段的**内容来源**：`doc.json` 生效后，由 `.trellis/spec/**` 全树扫描切换为 `files` 白名单。这是 `feat-11-02-custom-doc-index-setup-spec` 的既定设计（PRD 决策 4/7，AC2/AC3）。
- 不影响每轮 `[trellis/...] Workflow state` 面包屑：该消息走 `lib/index.js` 的 `agent/pre-step`，不读取 `doc.json`。
- 未发现报错或降级：两个项目均未出现 `Trellis 项目文档配置无效` 诊断。

## 证据

- FordProject `session-5b3fcabd-d2b9-4403-8d49-4b16b7110ff7`，`system/message` @ 2026-11-03T01:20:54Z，含：

  ```
  Trellis 项目文档文件清单（项目配置的注入范围；路径相对项目根 E:/Project/FordProject）：
  - GLOSSARY.md
  - docs/README.md
  - docs/agents/domain.md
  - docs/architecture/README.md
  - docs/adr/README.md
  - docs/domain/README.md
  - docs/quality/README.md
  - docs/ui/prefab-naming-hierarchy.md
  使用要求：出方案或动手改码前，先用 read 工具打开与本次改动相关的文件……
  ```

- 本仓库 `session-cf0cc6f7-2825-4ef1-8dd6-36e175045b77`，`system/message` @ 2026-11-03T01:33:15Z，含：

  ```
  Trellis 工程规范索引（.trellis/spec/ 已沉淀本项目规范；路径相对项目根 E:/dsh_plugins/dsh-trellis）：
  - .trellis/spec/trellis-workflow/task-engine/index.md
  - .trellis/spec/trellis-workflow/web-ui/index.md
  ```

- FordProject `session-5b3fcabd…` 共 10 条 `[trellis/...]` 面包屑，最后一轮 @ 2026-11-03T01:20:18Z 仍正常注入，内容为 `[trellis/planning] Workflow state from E:/Project/FordProject`。

## 结论

- 不是回归：`files` 清单在注入，面包屑也在注入。
- 差异只在"注入什么"：**注入路径，不注入正文**（README 与 PRD 第 7 条均明确）。
- 若诉求是"把文件正文也塞进上下文"，属于行为扩展，应走 `feat` 轨道，不按 Bug 修复处理。
