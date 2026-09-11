# Issue Report

## 现象

看板（迷你看板弹窗 / 展开大看板）详情面板中，产物（artifact）行的「打开」按钮行为与预期不一致：点击后把 `@.trellis/tasks/<slug>/<name>`（或归档路径）**回填进输入框（Composer）** 并聚焦，而不是**通过 DSH 原生打开该文件链接**进行查看。

与项目 README 中声明的设计约定不符：
> 产物点击生成 `@.trellis/tasks/...` 原生文件引用交给 DSH 原生查看。

## 复现步骤

1. 在任一 Trellis 匹配项目中打开会话，点击顶部阶段徽标打开迷你看板（或展开大看板）。
2. 点击任意任务，右侧详情面板出现「产物」区，产物行右侧有「打开」按钮（externalLink 图标）。
3. 点击「打开」。

实际结果：输入框（Composer）被填入 `@.trellis/tasks/<slug>/<name>` 文本并自动聚焦，输入框内容被污染；文件并未直接打开。

## 期望 vs 实际

| | 行为 |
|---|---|
| **期望** | 点击「打开」后，DSH 在原生查看面（右侧文档预览）中打开该文件链接；不触碰输入框 |
| **实际** | 点击后把 `@.trellis/tasks/...` 原生引用回填进 Composer 输入框（`injectToComposer`），输入框内容被修改并聚焦 |

## 影响范围

- `lib/client.js`：`KanbanDetails` 组件产物区「打开」按钮（约 L1339 `onClick: () => push(artifactToken(task, name))`）。
- 覆盖两个渲染路径：迷你看板弹窗（`TaskChip` → `KanbanBoard` → `KanbanDetails`）与展开大看板（`KanbanExpandedModal` → 工作台 → `KanbanDetails`）。
- 全部产物类型（feat/issue/refactor；活动任务与已归档任务）均受影响。

## 证据

- 代码证据：`lib/client.js` L938-943 `artifactToken()` 生成 `@` 前缀 token；L945-957 `KanbanDetails` 中 `push = (text) => injectToComposer(text)`；L1339 产物按钮 `onClick: () => push(artifactToken(task, name))`。
- `injectToComposer`（L836-884）把文本写入 `textarea[data-testid="composer-input"]` 等输入框并派发 input/change 事件、聚焦 —— 即「回填输入框」。
- 对照证据：DSH 官方聊天客户端 `@deepseek-ai/dsh-client-ui-chat` 的 `openFile`（L8319-8325）用 `ctx.sidebarRight.openResource(fileAddressFor(sessionId, cwd, path))` 打开 `dsh-resource://file/session/<sessionId>/<path>` 地址，在右侧文档预览中原生查看 —— 这是「通过 DSH 打开文件链接」的标准机制。
