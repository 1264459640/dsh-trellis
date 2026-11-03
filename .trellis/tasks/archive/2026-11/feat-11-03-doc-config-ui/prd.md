# Feature PRD

## 背景

`.trellis/doc.json` 的文档注入（`files` 白名单 + 正文 8KB/32KB 预算）已经上线（feat-11-03-doc-body-injection），但配置入口只有「手改 JSON」：

1. 用户不知道 `root` / `files` 各自的语义（`root` 只是 Skill 元数据，不参与注入；`files` 才是唯一注入范围）。
2. 写错时没有任何即时反馈：只会在下一轮注入里变成一句固定的「配置无效」诊断，既没有具体条目，也没有修法。
3. 预算不可见：不知道哪个文件被截断到 8KB、累计是否已经超过 32KB（超出的文件实际只剩路径）。

因此需要一个项目级可视化配置界面：在会话顶部的一级视图里查看、编辑 `doc.json`，保存前就能看到逐条校验结果与真实注入效果，保存后立刻生效。

## 范围

### In Scope

- **入口**：会话顶部视图栏新增一级视图（与「对话 / 轨迹 / Git」同级），经宿主 `conversation.view` 座位注册。
- **三态展示**：未配置（走 `.trellis/spec` 兼容扫描）/ 已配置 / 配置无效，判定与 `readProjectDocConfig` 完全一致；项目不在 allowlist 时给出明确说明。
- **files 编辑**：添加（项目相对路径输入）、删除、上移/下移排序；重复项就地提示。
- **root 编辑**：可留空（留空即不写该字段）。
- **就地校验**：绝对路径、`..`、非 `.md`、文件不存在、越出项目根 —— 阻止保存并标出具体条目。
- **预算预览**：每个文件的字节数；超 8KB 标「将截断至 8KB」；累计超 32KB（含剩余不足 512B 的边界）标「仅保留路径」；与 `renderDocBodies` 的实际行为一致。
- **保存**：写当前项目的 `.trellis/doc.json`；保存后下一次提示词装配立即使用新配置（不需要重启，也不用等 5s TTL）。
- **未配置时的迁移辅助**：展示当前 `.trellis/spec` 扫描到的文件，可一键载入为 `files` 初稿。
- 未保存改动提示、放弃修改、重新加载；中英双语文案。

### Out of Scope

- 不放进主设置页（`settings.section`），也不放进插件配置卡片或看板弹窗。
- 不做 Markdown 正文编辑器（正文仍由原生编辑器 / Agent 技能维护）。
- 不支持目录、通配符、隐式扫描（`files` 仍是显式文件清单）。
- 不做撤销历史、多人协作、冲突合并。
- 不改注入预算常量，不改 `doc.json` 的结构与语义。

## 验收标准

- [ ] **AC1 入口**：会话顶部视图栏出现「项目文档」标签，与「对话 / 轨迹 / Git」同级；点击切到该视图且不破坏其它标签；主设置页、插件配置卡片、看板弹窗均无新增入口。
- [ ] **AC2 状态准确**：未配置 / 已配置 / 无效 / 未纳入 allowlist 四态展示正确；无效态给出修复指引。
- [ ] **AC3 编辑校验**：非法条目（绝对路径、`..`、非 `.md`、不存在、重复）就地报错并阻止保存，错误信息带具体相对路径。
- [ ] **AC4 预算预览**：预览状态与 `renderDocBodies` 实际输出一致（8KB 单文件、32KB 总量、剩余 <512B 边界）。
- [ ] **AC5 保存生效**：保存写出合法 `doc.json`（UTF-8 无 BOM、2 空格缩进、末尾换行），且下一次装配立即使用新配置。
- [ ] **AC6 安全边界**：写接口先过 trust-fence，再按会话 header 的 cwd 命中 allowlist；只允许写当前项目的 `.trellis/doc.json`；拒绝时返回稳定错误码且不泄露绝对路径。
- [ ] **AC7 兼容**：无 `doc.json` 的项目注入行为与现在完全一致；`node --test` 全绿。
- [ ] **AC8 文档**：README 中英与 `.trellis/spec` 约定同步 UI 入口、写接口契约。

## 约束与风险

- **缓存**：`trellis:spec-index` 有 5 秒 TTL 缓存，保存后必须主动失效，否则用户会认为「保存没生效」。
- **规则单一来源**：校验、去重、预算必须复用 `lib/spec.js` 的既有实现，不能在路由或客户端复制一份。
- **首次浏览器写项目文件**：此前只有 `bind` 写会话指针；本次必须复用同一套信任栅栏与 sandbox policy。
- **视图可见性**：`conversation.view` 只在非 blank 会话存在（宿主意定），新会话首条消息前看不到该标签；这是宿主行为，本期不额外补入口。
- **包加载顺序**：注册座位前必须把声明方 `@deepseek-ai/dsh-client-ui-conversation` 加进 `package.json` 的 `dsh.client.inject`，否则可能抛「registering into an undeclared slot」。

## 相关代码 / 文档

- `lib/spec.js`：`readProjectDocConfig`、`normalizeDocFile`、`renderDocBodies`、`MAX_DOC_FILE_BYTES`、`MAX_DOC_TOTAL_BYTES`、`listProjectSpecs`
- `lib/index.js`：`API_PREFIX` 路由、`specIndexCache`
- `lib/client.js`：`conversation.view` 注册、`TB` tokens、locale 字典
- `package.json`：`dsh.client.inject`
- `test/doc-config.test.js`、`test/spec.test.js`、`test/client-doc-config.test.js`、`test/mount.test.js`
- `README.md` / `README_EN.md`、`.trellis/spec/trellis-workflow/web-ui/index.md`、`.trellis/spec/trellis-workflow/task-engine/index.md`
