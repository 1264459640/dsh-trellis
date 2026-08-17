# Mini 任务看板 — 真实实现记录

## 后端（host）

### lib/state.js（纯函数）
- `activeTaskForSession(sessions, preferName)`：本会话指针文件优先（显式 null = 未绑定，不回退），缺失时回退 `activeTaskPointer`（canonical-first、字典序）。返回 `taskDir` 字符串或 null。
- `monthKeyFromSlug(slug)`：`/^[^-]+-(\d{2})-\d{2}-/` 提取月，无时间戳 → null（归档归「其他」）。

### lib/task.js（指针读写）
- `bindTaskPointer(fs, root, sessionId, taskDirRel)`：仅写本会话指针文件 `<sessionFileBasename(sessionId)>.json`（合并既有字段）。
- `unbindTaskPointer(fs, root, sessionId)`：写 `current_task: null`，保留既有字段。

### lib/index.js（路由 + 解析）
- `resolveProjectState` 增加 `sessionId` 参数 → `activeTaskForSession` 按会话解析（pre-step / trellis_state / refreshSummary 三处传 id）。
- `buildBoard(fs, root, sessionId)`：列出全部任务（slug/title/status/workType/stage/artifacts/month）+ 本会话 currentTask（slug 形式）。
- 新增 `POST /trellis-workflow/api/board`：trust-fence → 会话存活 → header.cwd → allowlist → buildBoard。
- 新增 `POST /trellis-workflow/api/bind`：`{sessionId, taskSlug|null}`；root 只来自会话 header（信任源），slug 白名单校验 `/^[A-Za-z0-9._-]{1,120}$/` + 存在性校验；只写本会话指针；写后刷新 chip 缓存。

## 前端（client）

### lib/client.js — TaskChip 升级
- 点击徽标打开看板浮层（不再 hover 自动展开）。
- `KanbanBoard`：左列两列（规划中/进行中）+ 底部 `KanbanArchive` 月份树 + 右列 `KanbanDetails`。
- `KanbanArchive`：按 `month` 分组、数字月份倒序、默认折叠、`otherMonth` 兜底、只读选中。
- `KanbanDetails`：元信息 + 阶段流水线（CHIP_TRACKS）+ 产物 ✔ + 显式激活/解绑按钮（completed 只读提示）。
- 绑定后刷新 board + chip 摘要；busy 防重入。

## 安全

- 绑定路由的 taskSlug 严格格式校验；目标 task.json 存在性校验；root 永远来自会话 header（请求只带 sessionId + taskSlug）。
- 浏览（board）不改任何状态；变更只在显式按钮触发。
