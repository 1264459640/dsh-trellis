# trellis-workflow / task-engine — 质量检查与约定

> 本文件由 `feat` 任务 `feat-09-05-native-steps-guard`（原生执行步骤、验证门禁与规划期产物写入保护）沉淀。
> 证据：任务规划产物（prd/design/design-review/implement/review）与本包 `lib/` 源码（task.js / artifact.js / breadcrumb.js / index.js）。
> 补充：`issue-09-05-breadcrumb-undefined` 沉淀"注入消息 source 不得含 undefined"反模式（见已知坑 3）；
> `feat-09-06-unified-steps-engine` 沉淀步骤 5 态状态机、多主体验证门禁与废弃模板自愈修剪（见约定 1/2/6 与白名单兼容条款）。

## 任务执行引擎约定

1. **执行步骤清单用 `steps`，不用外来术语**：`task.json` 的步骤分解统一为
   `steps: TaskStep[]`（`id/title/spec/acceptance/status/verification/verify/verified/verifiedBy/verificationNotes/blockedReason`）。
   不引入 `subtask`/`needsVerification`/`L1/L2`/`RedTeam` 等旁路词表——单一原生词表；
   也不保留 `checklist.yaml` / `implement.md` 平行清单（feat-09-06 收编：验证计划与风险/回滚归
   `design.md`，执行推进 100% 走 `steps`；旧项目残留模板由 `ensureProjectSkills` 每轮自动修剪）。
   向下兼容（无 `steps` 的旧任务仍按原有阶段推进）。
2. **步骤 5 态状态机与多主体验证（先验证后完结，先校验后写盘）**：
   - **状态机**：`pending` → `in_progress` → `verifying` → `completed`（可中途 `blocked`，
     `blocked` 必须携带 `blockedReason`）；`verifying` 是"代码写完、等待验证"的显式缓冲态；
   - **验证主体**：`verification: 'none' | 'ai' | 'human'`（`verify: true` 是 `'ai'` 的遗留别名）；
     `'ai'` = 模型/自动化验证，`'human'` = 人工验收卡点；
   - **步骤验证门禁**：`applyStepUpdate` 只在验证条件已持久化时放行 `status: 'completed'`——
     `'ai'` 要求 `current.verified === true`；`'human'` 要求 `current.verified === true &&
     current.verifiedBy === 'human'`（模型自证自签被物理拒绝），强制**两阶段提交**；
   - **任务完结门禁**：`updateTaskRecord` 置 `status: 'completed'` 与 `archiveTaskRecord`
     归档前都必须过 `checkStepsCompletion`——任一步骤处于 `blocked`（`[trellis/steps_blocked]`）、
     `status !== 'completed'`（`[trellis/steps_incomplete]`）或验证未通过
     （`[trellis/steps_unverified]`，含 `'human'` 未确认）均拒绝；
   - 布尔字段必须严格类型校验（`typeof === 'boolean'`），`Boolean()` 会把字符串 `"false"`
     强制转成 `true`，是历史旁路点。
3. **产物写入走专属受控工具 `trellis_artifact_update`**：
   - 只允许写入当前任务目录 `.trellis/tasks/<slug>/` 下的标准交付文档（全工种白名单，见
     `lib/artifact.js` `ALLOWED_ARTIFACTS`），禁止触碰项目源码；
   - **白名单保留已废弃模板名（兼容历史任务）**：`implement.md` / `checklist.yaml` 虽已从模板体系
     废弃并被自愈修剪，但**必须继续留在 `ALLOWED_ARTIFACTS`**——历史任务的读/归档仍按这些名字访问，
     移除条目会破坏存量任务产物（feat-09-06 边界条款：绝不触碰 `tasks/` 历史产物；清理模板时严禁连带移除）；
   - **slug 必须做穿越校验**：`SLUG_CHARSET` 之外还要 `path.relative(tasksDir, taskDir) === safeSlug`
     强制 slug 是 `tasks/` 的直接子段（拒绝 `.`、`..`、含分隔符）——仅靠文件名字符集校验
     会放过 `..`（点号在合法字符集内）。
4. **规划期只读保护（`enforceReadonlyPlanning`）＝授权状态机 + 阶段感知相位**（issue-09-06 重述）：
   - **相位必须由细粒度 `work.stage` 派生（`lib/state.js` `stagePhase`/`phaseForTask`），不能只看 `status`**。
     status↔stage 耦合（`skills/_templates/work-types.md`）：planning ↔ feat prd/design/design-review；
     issue report/analyze；refactor scan/design；in_progress ↔ feat impl/review/check；issue fix/fix-note；
     refactor apply。`completed` 状态恒胜（展示终态）。未知/遗留 stage 回退到基于 status 的粗粒度相位。
   - 三态授权（`lib/readonly.js` `authorizationOf`）：`undecided`（无任务且未跳过）→
     仅裁剪 `write`/`edit` + 任务写工具（`trellis_task_update` / `trellis_artifact_update` /
     `trellis_task_archive` / `trellis_ui_update`），`trellis_state` / `trellis_task_create` /
     `trellis_task_skip` 与其余工具（含其他插件工具）保留；`planning`（规划型阶段）→
     仅裁剪 `write`/`edit` + 任务生命周期工具（`trellis_task_create` / `trellis_task_skip` /
     `trellis_task_archive` / `trellis_ui_update`），`trellis_state` / `trellis_task_update` /
     `trellis_artifact_update` 与其余工具保留；`authorized`（写码阶段 / completed / 已跳过）→
     完整工具面（不裁剪）。裁剪是 **denylist**（只移除指定工具），不是 allowlist——
     其他插件注册的工具（web_search、generate_image、subagent、skill 等）绝不能被连带裁剪
     （issue-09-07-trim-tools-denylist）。经 `system-prompt/assemble` 按会话 cwd 命中 allowlist
     后物理裁剪工具 Schema。
   - **写路径必须拒绝状态漂移**：`trellis_task_create` / `trellis_task_update` 校验合并后的
     status↔stage，拒绝「规划型阶段 + `status=in_progress`」（`lib/task.js`），保证只读窗口不被
     模型纪律失误打开；`write`/`edit` 从规划期工具面剔除，但 `trellis_artifact_update` 必须保留
     为唯一写通道，否则规划期"想写方案却无工具"会死锁。
   - **只读语义双通道：工具面裁剪 + 显式指令文本注入**（feat-09-07-inject-readonly-prompt）：
     除了 denylist 裁剪，`system-prompt/assemble` 处理器在 `undecided`/`planning` 时还会向
     sections 追加 `trellis:readonly` 指令段（`lib/readonly.js` `appendReadonlyInstruction` +
     `readonlyInstructionFor`），让模型在提示词文本里明确读到"当前只读、方案获批前禁止改码"，
     而不只是面对裁剪后的工具面。注入条件与裁剪条件一致（`enforceReadonlyPlanning=true` +
     命中 allowlist + `undecided`/`planning`）；`authorized` 时三函数均返回 null、装配结果与
     现状一致——但 `trellis:spec-index` 段与授权无关、任何相位都可能存在（见约定 7）。`trellis:readonly` 是**预留 section 名**：追加前先过滤同名段保证至多一份，
     满足 harness invariant（name 非空唯一 + 字符串 text）。指令文本为中文硬编码（PRD 决策，
     无 i18n；无 workflow.md 的项目会出现英文默认面包屑 + 唯一中文指令段的混排，属有意为之）。
   - Web 看板/徽标同样消费解析后的 `phase`（`lib/board.js` 记录携带 `phase` 字段），不直接按裸
     `status` 分列/标色。
5. **当前步骤高信噪比注入**：`impl`/`in_progress` 阶段经 `agent/pre-step` 注入当前活跃步骤
   （`findActiveStep` + `formatStepPrompt`），并用**内存级** `stepInjectedCache`（`Map<sessionId, key>`，
   key = `stepId:status:verified`）防刷屏——同一步骤未变化时降级为 `formatStepReminder` 单行提示；
   **禁止在 pre-step 内写盘**；`session/disposed` 时清理该缓存。
   `findActiveStep` 优先级：`blocked` > `in_progress` > `verifying` > `pending`（阻塞最先暴露）；
   `formatStepPrompt` 分级渲染：`blocked`（阻塞原因）、`verifying + human`（👤 人工验收等待卡点，
   严禁模型擅自推进）、`verifying + ai`（执行 design.md 验证命令并记录证据）。
6. **废弃模板自动修剪（self-healing）**：`ensureProjectSkills` 每轮运行时会清理项目级残留的
   废弃模板（`DEPRECATED_PROJECT_TEMPLATES`：`.agents/skills/_templates/` 与 `.trellis/templates/`
   下的 `feat/implement.md`、`refactor/checklist.yaml`）——仅硬编码相对路径、`assertPolicyAllowsWrite`
   沙箱 fail-closed、**绝不触碰 `tasks/` 下任何历史产物**；修剪失败静默跳过，不影响面包屑注入。

7. **工程规范索引（`trellis:spec-index`）＝ 免 workflow.md 的 spec 注入通道**（feat-10-22 沉淀）：
   本插件不再创建或注入 `.trellis/workflow.md`（项目级 `[workflow-state:*]` 覆盖块**仍然读取**），
   因此"项目带 `.trellis/spec/`"这一事实不能只靠面包屑传递。
   - **装配期注入**：`system-prompt/assemble` 在命中 allowlist 且项目有 `.trellis/spec/` 时追加
     `trellis:spec-index` 段（`lib/spec.js`：`listProjectSpecs` + `formatSpecIndexInstruction` +
     `appendSpecInstruction`）。**只注入索引（路径 + 先读约束），绝不注入正文**——正文由模型按需 read。
   - **与只读策略解耦**：spec 索引是领域知识而非写保护，由独立开关 `injectSpecIndex`（默认 true）控制，
     **不得**挂在 `enforceReadonlyPlanning` 之下。
   - **路径必须有根锚点**：`matchAllowlist` 是祖先匹配，会话 cwd 可能是子目录，渲染必须带
     「路径相对项目根 `<root>`」，否则子目录会话的 `read` 必然打空。
   - **热路径必须 memo**：`system-prompt/assemble` 按**请求**触发（改动前未开只读保护时该处理器零 fs），
     故 spec 索引以 project root 为键做短 TTL memo（`SPEC_INDEX_TTL_MS`），并把 `context.signal`
     透传给 `fs.resolve/stat/listDir`。无 memo 的目录遍历属于回归项。
   - **walk 必须收着走**：`maxDirs` 限广度、`maxDepth` 限深度、`maxEntries` 限输出，且必须
     **先收全有界树再排名截断**（index.md 优先 → 深度 → 字典序），否则浅层旁支文档会把真正管事的
     深层 `index.md` 挤掉；越界条目（symlink/junction 指向 root 之外）用
     `fs.contains(rootTarget, childTarget)` 拦掉，判定失败即跳过。
   - **失败一律 fail-open**：目录缺失/不可读/已 abort/恶意树都返回"无规范"（不注入、不抛错），
     绝不因为索引坏掉而中断一轮对话。

## 已知坑（防复发）

- **"不再注入 workflow.md" 不等于"不再读它"**：插件仍读项目级 `[workflow-state:*]` 覆盖块
  （`composeBreadcrumb` 的 `source: 'project'` 分支）。删掉 `readOptionalText(fs, p.workflow)`
  会静默丢掉项目自定义面包屑，属功能回退（feat-10-22）。
- **配置项不得只在 schema 里加字段**：任何新增 volatile 字段都要同步 `lib/client.js` 的中英
  label/hint + `settingsBoolField` + `projection()`，以及 `test/settings-projection.test.js`
  的 `FIELDS` 全等断言与 README/README_EN 配置表——否则设置面板看不见、测试直接红（feat-10-22）。
- **更新任务数据不等于切换会话绑定**（issue-10-21-fix-stale-task-binding）：`updateTaskRecord`
  不写 runtime 指针；显式 `slug` 只选更新目标。否则旧任务更新晚完成会把新建任务的绑定改回旧任务。
  绑定由创建和显式激活/取消激活负责；不得用“先检查再写回指针”的非原子补丁恢复隐式重绑。
- **摘要必须读取当前绑定，异步旧读不能覆盖新状态**：创建/更新/skip 完成后都先失效、再从实际
  会话指针刷新，不能直接缓存操作目标（创建的指针写入后也可能已有新绑定）。宿主摘要解析用
  mutation epoch 丢弃并重试过期读；pre-step 遇到 epoch 变化则不发布旧摘要。回归测试须用门闩
  覆盖“旧更新晚完成”“旧刷新晚返回”“指针已提交但创建/skip 晚返回”，不依赖随机 sleep。

- **status 与 work.stage 必须强耦合，相位/授权/展示一律吃阶段感知相位**（issue-09-06-refactor-scan-readonly）：
  只按 `status` 派生相位会让 refactor 的 scan（规划型阶段）在 `status=in_progress` 时被当作执行中，
  只读授权直接放开。禁止新增"只看 status 不看 stage"的相位/授权/分列逻辑。
- 工具 `output.schema` 必须声明 `additionalProperties: false`，否则 `defineTool` 抛
  `UNSUPPORTED_SCHEMA`（见 web-ui 约定 2 的 lossless JSON 配对要求）。
- 注入消息的 `source` 可选字段必须**条件展开省略**（`...(x ? { key: x } : {})`），**禁止写 `undefined` 值**：
  `createUserMessage` 经 `structuredClone`/`deepFreeze` 会保留 `undefined` 键值（只有 `JSON.stringify` 丢键）；
  `agent/pre-step` 注入的面包屑会被 `dsh-agent-loop` 整体 append 为 `user/message` 会话事件，
  而 `dsh-session` 的 lossless-JSON 校验（`snapshotJsonValue`）拒绝任何 `undefined`，
  直接抛 `session event "user/message" carries non-JSON-serializable data` 使本轮运行失败
  （证据：issue-09-05-breadcrumb-undefined；参考实现 `dsh-agent-instructions` 即用条件展开）。
- 安全边界别只信"文件名/字符集"校验：路径穿越要结合 `path.relative` 强约束为直接子段。
- 删除类操作（模板修剪、归档移动）用 `node:fs` 时必须以**硬编码相对路径 + 沙箱策略 fail-closed**
  双保险，绝不允许"扫描并删除用户内容"的宽松实现；`dsh-fs` 无 delete/move 原语是已知边界。
- **宿主工具上下文与底层执行参数不能混用**（issue-10-25-artifact-task-binding）：宿主工具的会话 ID 在
  `exec.agent.session.id`，底层任务函数常用 `exec.sessionId`。产物默认目标解析必须兼容宿主形态，
  否则会把“有当前会话”误当作“无会话”，回退 canonical 指针并覆盖旧任务。回归测试应通过真实
  注册工具调用，构造 canonical 旧任务与当前会话新任务并存，断言返回 slug、实际文件及绑定均正确。
- `trellis_artifact_update` 的默认 slug 跟随**会话绑定任务**，不一定是本次正在推进的任务
  （证据：feat-09-07 曾把 design.md 误写入绑定任务 trellis-right-phase-panel，靠 `git checkout`
  还原）。写产物时若会话绑定任务 ≠ 目标任务，必须显式传 `slug`，否则会污染其他任务目录。