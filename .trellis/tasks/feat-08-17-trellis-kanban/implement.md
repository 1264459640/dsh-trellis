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

## 修复（08-18）— 归档布局统一为 `.trellis/tasks/archive/yyyy-mm`

用户验收发现：归档动作无任何实现/约定（收工落点随意）、看板只平铺读 `tasks/`（归档树不可见）、
月份键只有 `mm`。统一决策：归档目标 `.trellis/tasks/archive/<yyyy-mm>/<slug>/`，月份键 =
slug 的 `mm` + 当年 —— 写入与读取共用 `ymKeyFromSlug`，写读永远一致；无 `mm-dd` 的遗留 slug
归 `other` 桶。

### 新增
- `trellis_task_archive` 模型工具（对照 `trellis_task_create` 的结构/沙箱/输出）：
  completed 校验 → 原子移动 → 解绑指向该任务的会话指针。
- `lib/archive.js`：`validateArchiveArgs` / `archiveTargetOf` / `archiveTaskRecord` /
  `assertPolicyAllowsWrite`（+ `isPathUnder`）。
- `ymKeyFromSlug(slug, year)`（state.js，写读共用）。
- 迁移手段说明：dsh-fs 无 move/delete 原语，移动为**受控 node:fs 例外** —— slug 正则
  `^[A-Za-z0-9._-]{1,120}$`、源/目标恒在 `root/.trellis/tasks/` 内（同盘 rename）、root 只取
  会话 header allowlist 命中结果、对会话沙箱策略 fail-closed（read-only / workspace-write 越出
  workspaceRoot 拒绝）；指针清理仍走 ctx.fs。

### 修改
- `buildBoard`：递归读活动树 `tasks/*`（跳过 `archive`，month=`ymKeyFromSlug`，archived:false）+
  归档树 `tasks/archive/<bucket>/*`（month=桶名，archived:true）；同 slug 归档副本优先。
- `KanbanArchive`（client.js）：键为 `yyyy-mm`/`other`，按 (年,月) 倒序、键即标签（中文仍显示桶名
  如 `2025-08`），兜底 `其他` 不变。
- 技能/文档：`trellis-finish-work` 改用 `trellis_task_archive` 收工；`work-types.md`、README 明示
  布局与受控例外。

### 验证
- `npm test`：17/17 全绿 —— 含 `archiveTaskRecord` 端到端（原子移动 + 产物随迁 + 会话指针解绑 +
  completed 守卫 + legacy → other 桶）与 `assertPolicyAllowsWrite` 失败闭合。
