# PRD：Trellis 设置页 UI 对齐效果图（纵向 Tab + 卡片式表单）

## 目标与用户价值

用户反馈"目前的 UI 实现和效果图差距有点大"，要求把 Trellis 插件设置页的视觉与结构对齐效果图
`.dsh/generated/dsh-auxiliary-1788782790255-1.png`（同系列：`dsh-auxiliary-1788773587554-1.png`、`dsh-auxiliary-1788782242019-1.png`，均为纵向 Tab 设计，前两张展示 Worktree 卡片形态）。

价值：设置页从"横向 pill Tab + 盒装裸字段"升级为效果图的"纵向 Tab + header 卡片 + 一体化 Project 行 + 大留白"结构，与 DSH 蓝色品牌语言一致，配置浏览效率更高。

## 已确认事实（证据）

### 图像取证（客观）
- 用户附件 image.png（1447×945，2026-09-10 10:11 上传）：PNG 结构为 IHDR→IDAT（zlib 78 01），无元数据块，与已知真实截屏（.dsh/user-screen-1.png）指纹一致 → **真实截屏**。
- 三张 .dsh/generated 效果图（1536×1024，2026-09-07 生成，创建后未被修改）：IHDR 后含 caBX/jumb/**c2pa** 内容凭证块 → **AI 生成图**。
- 色彩：两图主强调色均为**蓝色**（色相直方图：截屏 蓝1951/紫109，效果图 蓝2176/紫12；紫计数为抗锯齿边缘）。**用户已纠正：不存在紫色 UI**；本文统一使用"品牌蓝"。

### 效果图设计语言（目标态）
- 分节标签：小号大写、加字距、灰色（`PROJECT` / `PLUGIN SETTINGS`）。
- Project Path：一体化卡片行 = 左字段名 + 中浅灰圆角输入框 + 右描边 `Browse...` 按钮，同排同容器。
- Plugin Settings：左右两栏 = 左侧纵向无边框 Tab 列表（选中 = 浅蓝底+蓝字+圆角）+ 右侧大圆角卡片（浅灰 header 栏含 Tab 名 + 下边框）。
- 字段三层排布：粗体键名 → 灰色描述 → 全宽控件；复选行 = 左 checkbox + 右粗体名称与灰色说明；radio 组为卡片式选项；留白充裕。
- 效果图字段（官方 Trellis schema）：`enabled`、`mode`（quick/standard/spec）、`spec_path`（默认 `.trellis/spec`）、`projectPath`；Tab 组：General / Phases / Workflow / Hooks / Skills / Agents / Commands / Worktree / Session / Sandbox / Other；Worktree 组含 `root`（默认 `./.trellis/worktrees`）、`branchTemplate`（`trellis/{work_type}/{slug}`）、`defaultBaseBranch`、`merge.noFastForward/noCommit`、`mergeMode`（merge|squash）。

### 当前实现（截屏）
- 同一官方 schema 页面，布局为：横向带边框 pill Tab（选中=蓝描边+浅蓝底、会换行）、每个字段各自套宽边框盒、`Browse...` 脱离输入行悬于右下、分节标签为普通粗体句首大写、字段留白紧凑。
- 截屏环境特征：侧栏版本 chip "1.0.0-rc.1"、projectPath=`C:/Users/12644/Desktop/trellis`。

### 代码归属排查（本机穷尽，均无渲染截屏页面的代码）
- 本仓库 `F:\dsh-plugins\dsh-trellis`（@banana-peeljj12/dsh-trellis 0.3.0-rc.9）：schema 仅 `allowlist / injectStep / skipKeywords / inline / enforceReadonlyPlanning`（lib/meta.js:26-52）；全仓 grep 无 `spec_path|projectPath|Browse`。
- 已安装旧版 @banana-peeljj12/dsh-trellis 0.1.0-rc.5（主 DSH web profile）：同样无上述字段。
- 官方移植包 `@trellis-dsh/trellis-workflow`：主 profile 中为 junction → `F:\dsh-plugins\trellis-dsh`，**目标目录已删除（链接断裂）**；npm registry 无此包（404）→ 未发布，源码仅存在于原本地目录。
- 全部 launcher homes（0.1.2-alpha.3 ~ 0.1.3-alpha.2、standard 等）web profile 仅装 @banana-peeljj12/dsh-trellis；本机所有 DSH 版本为 0.1.1-rc.2 / 0.1.2-rc.1 / 0.1.3-alpha.2，**均非截屏中的 1.0.0-rc.1**；`C:\Users\12644\Desktop\trellis` 与 OneDrive 桌面均不存在。
- 全局 npm：@deepseek-ai/dsh 0.1.1-rc.2、@mindfoldhq/trellis 0.6.10（官方 CLI，AGPL-3.0，非 DSH Web 插件；其模板含 `specPath = ".trellis/spec"`，证实截屏 schema 概念源自官方 Trellis CLI）；无 scope 的 `dsh-trellis`（npm v0.1.3）为第三方 SajoLuo 发布，描述不符。
- 结论：**截屏页面来自本机之外的环境（或已删除的 trellis-dsh 本地移植插件）**，其源码在本机不可得。

### 历史任务线索
- `feat-09-08-restore-target-ui`（已完成，commit 2f324a1）：其 prd/design 把**同一张** 790255 效果图记录为"三泳道工作台"视觉基线并据此重设计了看板（KanbanExpandedModal）。但该文件自 09-07 生成后从未变化，实际内容是设置页 → **09-08 任务对参考图的绑定有误**（看板被按想象中的参考图重设计）。本任务不自动继承其结论。
- 本插件 Web UI 基础设施成熟：`lib/client.js` 为 client bundle（window.__ModuleLoader__），贡献 `settings.plugins.tab` 自定义 Tab（TrellisSettingsTab），含看板/任务芯片与 `TB` 设计令牌（DSW 变量 + 圆角/阴影/字体，lib/client.js:679-728）。

## 需求（草案，待 Q1 决策后细化）

- R1：设置页采用效果图布局骨架：大写灰色分节标签；Project 区一体化行；Plugin Settings 区 = 左侧纵向 Tab + 右侧 header 卡片。
- R2：字段排布遵循"粗体键名 → 灰色描述 → 全宽控件"，复选行左 checkbox 右文案，radio 组卡片化。
- R3：颜色全部走 DSW 语义变量（品牌蓝），禁止硬编码紫色；复用/扩展 lib/client.js 的 TB 令牌。
- R4：（范围待定，随 Q1）字段集合：仅本插件现有 schema，还是补齐效果图官方字段（enabled/mode/spec_path/projectPath/worktree/session/sandbox…，需同步 host 端 schema 与行为）。

## 验收标准（草案）

- A1：DSH Web GUI Settings > Plugins > Trellis 设置页布局结构与效果图一致（纵向 Tab、header 卡片、一体化 Project 行、大写分节标签）。
- A2：像素抽样主强调色为品牌蓝系（色相 200–240°），无紫色主导元素。
- A3：所有配置项可读写，保存后下一轮生效，不回退现有行为（allowlist/injectStep/skipKeywords/inline/enforceReadonlyPlanning 及看板、芯片功能无回归）。
- A4：zh/en locale 字典同步完整。

## 范围外（草案）

- 不引入 @mindfoldhq/trellis 的 AGPL 代码（本仓库为 MIT 重写）。
- 看板/任务芯片既有 UI 不在本次范围（除非用户要求统一风格）。
- 不修改 DSH harness 通用渲染器（除非 Q1 选择该方向）。

## 阻塞性开放问题

- Q1（唯一，用户决策）：截屏设置页的源码不在本机（trellis-dsh 已删、npm 无包、截屏环境版本 1.0.0-rc.1 本机不存在）。效果图要落地到哪里、字段范围多大？
  - A) 本仓库 dsh-trellis：按效果图设计语言重做本插件设置页（lib/client.js），字段先用本插件真实 schema（推荐——本机唯一可改、可构建、可在当前 GUI 验证的落点）。
  - B) 本仓库 1:1 对齐：在 A 基础上补齐官方 Trellis 配置面（11 个 Tab 组 + host 端 schema/行为/迁移），页面内容与效果图完全一致（范围大，需分阶段）。
  - C) 改官方移植插件：用户提供 trellis-dsh 源码位置（另一台机器/目录/git 仓库），在其源码上按效果图改设置页。
  - D) 改 DSH harness 通用插件设置渲染器：对所有插件生效，需在 harness 源码改动并重建 Web 产物。
