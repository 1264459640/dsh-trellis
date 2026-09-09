# Changelog

dsh-trellis 各版本发布日志汇总，同时作为后续 Release Notes 的**格式模板**。

## 格式约定（Release Notes 模板）

- **语言**：中文 + 英文双语，中文在上、英文在下，之间以 `---` 分隔。
- **分组标题**：中文 `## 功能` / `## 修复` / `## 文档`（按需补充 `## 性能` / `## 构建` / `## 兼容性` 等）；英文对应 `## Features` / `## Fixed` / `## Docs`。
- **条目**：`- **要点**：说明`——要点加粗，说明陈述变更价值、影响范围与关键行为。
- **代码标识**：工具名 / 函数名 / 路径等用反引号包裹。
- **同步**：tag 推送后 GitHub Release 的 body 由管道自动提取本文件对应条目（`scripts/extract-changelog.mjs <tag>`，见 `.github/workflows/release.yml`）；未找到条目时回退到 GitHub 自动生成。每个版本发布前，先在文件头部新增 `## <tag> — <日期>` 条目。

---

## v0.3.0-rc.9 — 2026-09-09

## 功能

- **提升 `modified_files` 局部校验的可发现性**：`trellis_task_update`（任务完成）与 `trellis_task_archive`（任务归档）的 `modified_files` 参数描述现明确说明其语义——传入后 Git 干净度校验限缩到清单内文件（清单内文件必须已提交），工作区中清单之外的其他未提交改动不再阻塞完成/归档，仅给出告警；省略该参数则保持全局严格校验（工作区必须整体干净）。收尾技能 `trellis-finish-work` 新增 "Scoped relaxation" 指引，推荐"先提交任务自身文件、再以 `modified_files` 声明以放行无关改动"，替代盲目 `git stash`；README / README_EN 的 Git 干净度校验条目同步补记该行为。

---

## Features

- **Improved discoverability of the scoped `modified_files` git check**: the `modified_files` parameter descriptions of `trellis_task_update` (completing a task) and `trellis_task_archive` (archiving a task) now spell out the semantics — providing the list scopes the Git cleanliness check to those files (the listed files must themselves be committed), and uncommitted changes outside the list no longer block completion or archival, only emitting a warning; omitting the parameter keeps the global strict check (fully clean working tree). The `trellis-finish-work` wrap-up skill adds a "Scoped relaxation" step recommending "commit the task's own files first, then declare them via `modified_files` to allow unrelated changes" instead of blind `git stash`; README / README_EN Git Cleanliness Check bullets are updated accordingly.

---

## v0.3.0-rc.8 — 2026-09-09

## 功能

- **看板工作台全面重构与视觉参考复原**：
  - **统一设计系统（TB Token）**：建立统一的变量与设计 Token 系统，适配浅色/深色主题，收敛颜色、圆角、阴影与排版规则。
  - **双模式工作台交互**：提供紧凑气泡列表模式（Popover）与全屏扩展工作台（Expanded Workbench），支持多泳道视图（Lanes View）与紧凑列表视图（List View）一键无缝切换。
  - **桌面级尺度还原**：全屏容器扩展至 `min(1450px, 100vw - 64px)`，采用深木炭半透明遮罩与 350px 宽度的任务详情抽屉（Inspector），高反差黑色推进 CTA 按钮；窄屏下泳道支持弹性横向平滑滚动。
  - **任务卡片与进度状态准确呈现**：已完成（completed）与已归档（archived）任务卡片强制展示 100% 绿色完成进度条，并保持准确的步骤计数；优化任务切换与过滤状态，避免切换视图时意外重置选中项。
  - **产物树与步骤追踪器**：详情抽屉中全面增强原生步骤追踪流水线（Step Tracker Pipeline）、任务产物树（Artifact Tree）及胶囊属性标签，支持一键将产物原生引用推入对话框。
- **支持基于 `modified_files` 的局部 Git 校验**：在 `trellis_task_update`（任务完成）与 `trellis_task_archive`（任务归档）中，当显式传入 `modified_files`（任务修改文件清单）时，系统只校验清单内文件的工作区干净度与提交历史；若工作区存在清单之外的其他未提交修改，予以放行并给出 warning 提示，避免因并行开发或无关未提交文件阻塞当前任务的正常交付与归档。未传 `modified_files` 时保持原有的全局纯净度严格校验。

## 构建

- **GitHub Release 发布日志自动提取**：新增 `scripts/extract-changelog.mjs`，CI 发布工作流（`.github/workflows/release.yml`）在推送 tag 时自动从 `CHANGELOG.md` 提取对应版本的双语 Release Notes 并生成 GitHub Release。

## 文档

- **建立标准化 CHANGELOG.md 体系**：汇编自 `v0.1.0-rc.3` 至 `v0.3.0-rc.7` 全部 16 个历史版本的发布日志，确立统一的双语 Release Notes 规范模板。

---

## Features

- **Kanban workbench redesign and reference visual restoration**:
  - **Unified design tokens (TB System)**: introduced a cohesive design token system for colors, radii, shadows, and elevation, seamlessly adapting to light/dark themes.
  - **Dual-mode workbench**: supports compact popover list mode and full expanded workbench with instant lane view / list view switching.
  - **Desktop-scale visual alignment**: modal expanded to `min(1450px, 100vw - 64px)` with deep charcoal translucent overlay, 350px task inspector drawer, and high-contrast black primary advance button; smooth horizontal scrolling for lane columns on narrower viewports.
  - **Truthful task progress and card states**: completed and archived task cards consistently render a 100% solid green progress bar with truthful step count metrics; selection state preserved without unexpected reset during filtering.
  - **Step tracker & artifact tree**: enhanced the native step tracker pipeline, artifact tree, and capsule metadata tags in the inspector drawer, with instant push-to-chat file references.
- **Scoped Git cleanliness check based on `modified_files`**: when `modified_files` is explicitly provided to `trellis_task_update` (completing a task) or `trellis_task_archive` (archiving a task), cleanliness verification is scoped to the declared files. Uncommitted changes outside `modified_files` no longer block completion or archival, emitting a warning instead. Global cleanliness check is preserved when `modified_files` is omitted.

## Build

- **Automated GitHub Release notes extraction**: added `scripts/extract-changelog.mjs`, enabling the release workflow (`.github/workflows/release.yml`) to automatically parse bilingual release notes from `CHANGELOG.md` upon pushing tags.

## Docs

- **Standardized CHANGELOG.md archive**: aggregated all historical release notes across 16 prior releases (`v0.1.0-rc.3` to `v0.3.0-rc.7`), formalizing the bilingual release format template.

---

## v0.3.0-rc.7 — 2026-09-07

## 功能

- **规划期只读保护注入显式指令**：`enforceReadonlyPlanning` 开启且命中 allowlist 时，`undecided`（无任务）与 `planning`（规划阶段）授权状态下，`system-prompt/assemble` 会向装配后的系统提示追加 `trellis:readonly` 指令段，让模型在提示词文本中明确读到"当前只读、方案获批前禁止修改源码或业务文件"，而不只是面对裁剪后的工具面；`authorized` 状态下行为与现状逐字节一致（零回归）。
- **规划产物写通道指引**：planning 指令文本显式指向 `trellis_artifact_update` 作为规划期唯一受控写通道，避免模型因"禁止修改任何文件"的字面禁令而不敢产出 prd/design。

## 修复

- **只读裁剪从白名单改为 denylist**：`applyReadonlyPolicy` / `applyReadonlySections` 原先使用白名单保留语义，会把其他插件注册的工具与 `tool:*` section（`web_search` / `generate_image` / `subagent` / `skill` 等）一并裁剪；改为 denylist 后仅裁剪 `write` / `edit` 与当前授权状态不适用的 trellis 工具，其余工具原样保留。

## 文档

- README / README_EN 更新为重构后看板 UI 截图（泳道视图 / 列表视图）。

---

## Features

- **Explicit read-only instruction injection during planning**: with `enforceReadonlyPlanning` enabled and the allowlist matched, the `system-prompt/assemble` handler now appends a `trellis:readonly` instruction section for `undecided` (no task) and `planning` authorization states, so the model explicitly reads "read-only, no source/business-file changes before approval" in the prompt text instead of facing only a pruned tool surface; `authorized` remains byte-identical to the previous behavior.
- **Planning artifact write-channel guidance**: the planning instruction text explicitly points to `trellis_artifact_update` as the only controlled write channel during planning, so the model is not deterred from producing prd/design artifacts by a literal "no file changes" ban.

## Fixed

- **Readonly trimming switched from allowlist to denylist**: `applyReadonlyPolicy` / `applyReadonlySections` previously used allowlist-keep semantics that swept away tools and `tool:*` sections registered by other plugins (`web_search` / `generate_image` / `subagent` / `skill`, ...); they now trim only `write` / `edit` plus the trellis tools invalid for the current authorization state, preserving everything else.

## Docs

- README / README_EN updated with the redesigned kanban UI screenshots (lanes view / list view).

---

## v0.3.0-rc.6 — 2026-09-06

## 功能

- **看板双模态布局**：小看板彻底解耦为高密度垂直任务列表（Master-Detail），消灭 400px 内双列看板导致的标题截断；大看板按工作流泳道专注展示，并智能折叠 0 任务泳道，消除三条原生横向滚动条并发问题；展开时自动选中第一个任务，并注入自定义细滚动条样式。
- **自包含内联 SVG 图标体系**：refresh / maximize / close / search / file / folder / check / clock / alert 等矢量图标全面替换 Emoji 与汉字按钮，展开/收起彻底纯图标化（保留 `title` 可访问性）。
- **详情面板升级**：横向 Step Tracker 流水线指示器、IDE 风格文件树产物行、胶囊化属性标签（类型/状态/阶段）、实心品牌色主按钮「推进任务」。
- **空列与空状态**：空列不再打印 `(空)` 汉字，改为微透留白插槽；弹窗锁定舒适比例。

## 修复

- **只读规划期 System Prompt 工具修剪**：Web 端开启 `enforceReadonlyPlanning` 后，调试栏工具列表虽已过滤，但发送给模型的自然语言 System Prompt 仍残留 `write`、`edit` 等写工具指南，诱发模型越权调用；现 `system-prompt/assemble` 钩子同步修剪各插件注册的 `tool:*` sections，并导出 `applyReadonlySections` 精准过滤白名单。
- **React Hooks 顺序修复**：`lib/client.js` 中 `closeExpanded` 的 `useCallback` 位于条件 return 之后导致 Hooks 顺序异常，已移至条件 return 之前。

## 文档

- `.trellis/spec/trellis-workflow/web-ui/index.md` 新增「看板双模态与对话联动约定」：泳道单一事实源（`board.tracks`）、steps 聚合字段、克制交互（禁止直接改状态，唯一推进方式为注入 Composer）、React 受控输入注入手法、异步数据空值守卫、`phase` 宿主端透传等 6 条约定。
- `.gitignore` 忽略 `npm pack` 产生的 tgz 构建产物。

---

## Features

- **Dual-mode kanban layout**: small boards are decoupled into a dense vertical task list (master–detail), eliminating the title truncation caused by dual-column boards within 400px; large boards focus on workflow lanes and smartly collapse lanes with zero tasks, removing the three concurrent native horizontal scrollbars; expanding auto-selects the first task and injects a custom slim scrollbar style.
- **Self-contained inline SVG icon system**: vector icons (refresh / maximize / close / search / file / folder / check / clock / alert) replace all Emoji and CJK-character buttons; expand/collapse is now purely icon-based while keeping `title` for accessibility.
- **Details inspector upgrade**: horizontal Step Tracker pipeline indicator, IDE-style file-tree artifact rows, capsule-style property tags (type / status / phase), and a solid brand-color primary button to advance the task via Composer.
- **Empty lane & empty states**: empty lanes no longer print `(空)` text, replaced by subtle blank slots; dialogs lock to a comfortable aspect ratio.

## Fixed

- **Readonly-planning System Prompt tool pruning**: with `enforceReadonlyPlanning` enabled, the debug-bar tool list was filtered but the natural-language System Prompt still contained `write` / `edit` write-tool guidance, tempting out-of-scope calls; the `system-prompt/assemble` hook now prunes `tool:*` sections registered by plugins, and `applyReadonlySections` is exported for precise whitelist filtering.
- **React Hooks order fix**: `closeExpanded`'s `useCallback` in `lib/client.js` sat after a conditional return, violating Hooks rules; it now sits before the conditional return.

## Docs

- `.trellis/spec/trellis-workflow/web-ui/index.md` gains a "dual-mode kanban & conversation-linking conventions" section: single source of truth for lanes (`board.tracks`), steps aggregation fields, restrained interaction (no direct state mutation; the only advance path is Composer injection), React controlled-input injection technique, async-data null guards, and host-side `phase` propagation.
- `.gitignore` now ignores `npm pack` tgz build artifacts.

---

## v0.3.0-rc.5 — 2026-09-06

## 功能

- **统一 5 态步骤引擎**：步骤状态机扩展为 `pending / in_progress / verifying / blocked / completed` 五态，新增验证模式 `none / ai / human`（`verify: true` 保留为 `ai` 的旧别名，兼容既有数据）。
- **AI 验证门禁**：标记步骤 `completed` 前必须先在独立调用中运行测试并录入 `verified: true` 与验证证据，禁止单次调用跳过验证。
- **人工验收卡点**：高风险步骤须用户明确确认并记录 `verifiedBy: 'human'` 才能完成，工具层阻止模型自证自签。
- **阻塞步骤约束**：步骤进入 `blocked` 必须提供 `blockedReason`。
- **完结审计**：任务完结/归档时校验所有步骤均已通过验证，并检查 Git 工作区干净度。
- **单一执行清单**：移除 `feat/implement.md` 与 `refactor/checklist.yaml` 模板，验证计划与风险/回滚预案归入 `design.md`；`task.json.steps` 成为跨工作流类型的唯一执行依据，历史项目中的废弃模板在初始化时自动清理（不触碰任务历史数据）。
- **焦点步骤提示**：面包屑按 `blocked > in_progress > verifying > pending` 优先级聚焦当前步骤，并区分 AI 验证与人工验收两种 `verifying` 状态。

## 修复

- **阶段感知的只读授权**：此前 refactor 任务处于 `scan`（规划类阶段）时，若任务状态漂移为 `in_progress` 会被误判为执行阶段并放开写工具；现按 `work.stage` 解析相位（`completed` 优先），并拒绝「规划类阶段 + `in_progress` 状态」的合并写入，确保规划期只读窗口不被状态漂移绕过。

## 文档

- 重写中英文 README，收敛为简洁、准确的工程规范说明，新增系统架构图 `docs/images/architecture.drawio.png`。

---

## Features

- **Unified 5-state step engine**: steps now support `pending / in_progress / verifying / blocked / completed`, with a new verification mode `none / ai / human` (`verify: true` remains a legacy alias for `ai`, keeping existing data compatible).
- **AI verification gate**: a step cannot be marked `completed` until tests have been run and `verified: true` with verification evidence is recorded in a separate call, preventing verification from being skipped in a single call.
- **Human approval gate**: steps requiring human sign-off can only complete after explicit user confirmation is persisted with `verifiedBy: 'human'`; the tool layer blocks model self-certification.
- **Blocked step constraint**: entering `blocked` requires a `blockedReason`.
- **Completion audit**: closing or archiving a task verifies that every step is verified, and checks the Git working tree is clean.
- **Single execution contract**: the `feat/implement.md` and `refactor/checklist.yaml` templates are removed; verification plans and risk/rollback guidance move into `design.md`; `task.json.steps` becomes the only execution list across work types, and deprecated templates in existing projects are pruned on initialization (never touching task history).
- **Focused step prompts**: breadcrumbs focus on the active step by `blocked > in_progress > verifying > pending` priority, and render `verifying` distinctly for AI verification vs. human approval.

## Fixed

- **Stage-aware read-only authorization**: a refactor task at `scan` (a planning stage) was previously treated as executing whenever its status drifted to `in_progress`, opening full write tools; phase is now derived from `work.stage` (`completed` wins), and writes merging a planning-type stage with `status: in_progress` are rejected, so the read-only planning window cannot be bypassed by status drift.

## Docs

- Rewrote the Chinese/English READMEs into concise, accurate engineering documentation and added the system architecture diagram `docs/images/architecture.drawio.png`.

---

## v0.3.0-rc.4 — 2026-09-05

## 新增

- 只读规划改为授权状态机（undecided / planning / authorized）：新会话默认只读，任务进入规划后放开规划工具，批准或显式跳过后恢复全部写入工具。
- `trellis_task_skip` 跳过工具：无参数、需用户确认，将会话从「未决定」移至「已授权」。

## Added

- Read-only planning is now driven by an authorization state machine (undecided / planning / authorized): a fresh conversation is read-only by default, planning tools open once a task enters planning, and full write tools return after approval or an explicit skip.
- The consent-driven, no-arg `trellis_task_skip` tool that moves the session from undecided to authorized.

---

## v0.3.0-rc.3 — 2026-09-05

## 修复

- 面包屑消息不再携带值为 undefined 的来源字段。

## Fixed

- Breadcrumb messages no longer carry undefined source fields.

---

## v0.3.0-rc.2 — 2026-09-05

## 修复

- 为原生 `step`/`steps` 工具参数声明 `additionalProperties`，使 DSH 能正确接受其 Schema。

## Fixed

- Declared `additionalProperties` for the native `step`/`steps` tool parameters so DSH accepts their schemas correctly.

---

## v0.3.0-rc.1 — 2026-09-05

## 新增

- Trellis 工作流原生执行步骤与验证关卡。
- 只读规划：规划路径获得授权前，写入工具保持不可用。

## Added

- Native execution steps and verification gates to the Trellis workflow.
- Read-only planning: write tools remain unavailable until the planning path is authorized.

---

## v0.2.2 — 2026-09-05

## 修复

- 空白新会话的任务徽标不再缺失：其显示条件此前引用了不存在的 `composerPhase` 字段。

## Fixed

- The missing task chip on blank new conversations: its predicate previously referenced a nonexistent `composerPhase` field.

---

## v0.2.1 — 2026-09-04

## 兼容性

- 移除已废弃的 `settingsNamespace` 导入，恢复对 DSH `0.1.2-rc.1` 的兼容。

## Compatibility

- Removed the retired `settingsNamespace` import to restore compatibility with DSH `0.1.2-rc.1`.

## 构建

- 依赖安装改用 Corepack；测试矩阵精简为受支持的 Node.js 版本。

## Build

- Switched dependency setup to Corepack and trimmed the test matrix to supported Node.js versions.

---

## v0.2.0 — 2026-08-30

## 修复

- 恢复空白新会话 Hero 区域中的 Trellis 任务徽标渲染。

## Fixed

- Restored the Trellis task chip rendering in the blank new-conversation hero area.

---

## v0.1.0-rc.9 — 2026-08-21

## 修改

- 移除任务更新与归档操作上的强制绕过参数，工作流保护不可绕过。

## Changed

- Removed the force-bypass parameter from task update and archive operations; workflow safeguards can no longer be bypassed.

---

## v0.1.0-rc.8 — 2026-08-21

## 新增

- 更新或归档任务时的 Git 工作区洁净性检查。

## Added

- Git-cleanliness checks when updating or archiving tasks.

## 修改

- `modified_files` 现在会与 Git 提交历史核对。

## Changed

- `modified_files` is now validated against Git commit history.

## 文档

- 优化 README 上手体验。

## Documentation

- Refreshed the README onboarding experience.

---

## v0.1.0-rc.6 — 2026-08-19

## 新增

- `trellis_task_update` 工具：更新任务状态并推进经校验的工作流阶段。

## Added

- The `trellis_task_update` tool for updating task status and advancing validated workflow stages.

---

## v0.1.0-rc.5 — 2026-08-19

## 修复

- 强制执行严格的会话级任务隔离，移除全局黑板回退，防止任务上下文跨会话泄漏。

## Fixed

- Enforced strict per-session task isolation and removed the global blackboard fallback to prevent task context from leaking across sessions.

---

## v0.1.0-rc.4 — 2026-08-18

## 性能

- 并行化看板任务 I/O，并为已归档任务引入内存缓存。

## Performance

- Parallelized kanban task I/O and introduced in-memory caching for archived tasks.

## 构建

- 修正测试命令，使其在受支持的 Node.js 版本间稳定运行。

## Build

- Fixed the test command to run consistently across supported Node.js versions.

---

## v0.1.0-rc.3 — 2026-08-18

## 新增

- Trellis 任务归档工具 `trellis_task_archive`，迷你看板支持归档树。
- 会话头部迷你看板，支持展开看板浮层。
- 自动化测试、npm 包 tarball 生成与 GitHub 发布工作流。

## Added

- The `trellis_task_archive` tool, with archive-tree support in the mini kanban.
- A session-header mini kanban with an expandable board overlay.
- Automated tests, package tarball generation, and a GitHub release workflow.

## 修复

- 看板徽标点击无响应、看板任务列表恒为空的问题。
- 重启后徽标点击再次无响应（no-summary 死状态）的问题。

## Fixed

- The kanban badge not responding to clicks and the task list always appearing empty.
- The badge becoming unresponsive again after restart (no-summary dead state).

## 改进

- 安装更可靠：提交锁文件、CI 改用 pnpm 安装依赖、移除不存在的 peer 依赖。

## Improved

- More reliable installation: committed the lockfile, switched CI installs to pnpm, and removed an unavailable peer dependency.

## 文档

- 新增 Web UI/看板截图，并将 README 重写为与项目无关的上手指南。

## Documentation

- Added Web UI/kanban screenshots and rewrote the README as a project-agnostic onboarding guide.
