# Mini 任务看板 — 设计（已批准）

**类型**: feat · **标题**: 精致小巧的 Trellis 任务看板

## 需求（第一性原理）

- Web 徽标（会话头部 `conversation.session.header.utilities` 槽位）点击展开一个小型任务看板浮层。
- 数据就是文件系统：`.trellis/tasks/*/task.json` 的 status 分列；浏览只读，激活/解绑是显式按钮操作。

## 布局（方案 A：Master-Detail）

- 左侧：**规划中 / 进行中** 两列活跃看板（已完成不铺开，量大）。
- 底部：**历史归档** 按月份父文件夹折叠（slug `MM-DD` 取月，无时间戳归「其他」），默认折叠。
- 右侧：**详情面板**（标题、类型、状态、阶段流水线、产物 ✔ 清单 + 显式操作按钮）。

## 交互

- 点卡片 = 选中查看（只读）；点击不会隐式改指针。
- 激活：「设为当前会话激活」按钮 → 写本会话专属指针文件（`<sessionFileBasename(sessionId)>.json`）。
- 解绑：「取消当前激活」→ 写 `current_task: null`（显式未绑定，不回退 canonical）。
- 已归档（completed）：只读，禁止激活。
- 多会话隔离：每个有 id 的会话写自己的指针文件，不覆盖他人；无 id 会话（CLI/默认）退化到 `dsh-session.json`。

## 解析规则

- `activeTaskForSession(sessions, preferName)`：本会话指针文件存在 → 以其为准（含 null=未绑定）；不存在 → 回退 canonical-preferring 项目级选择（legacy 会话）。
- 解析注入：面包屑 / trellis_state / chip 摘要全部按会话 id 解析，并行会话各绑各的。
