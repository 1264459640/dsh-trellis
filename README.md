# trellis-workflow — 自包含 Trellis → DSH 工作流插件

一个**完全自包含、可独立发版**的 DeepSeek Harness (DSH / Cordis) 插件，把 Trellis
工作流的"每步触发 + 面包屑注入 + 技能引导"搬进 DSH。插件包自身不依赖 python、不携带
任何 Trellis AGPL 源码，所有状态机与技能内容均为本包重写（MIT）。

- Trellis 语义参考：`@mindfoldhq/trellis`（AGPL-3.0-only）的工作流流程，仅复用其
  **流程语义**，不复制其代码与文档正文。
- 运行时按各项目自身的 `.trellis/` 读取，因此**继承已有项目的 spec**，不丢沉淀。

## 它做什么

1. **每步触发**：订阅 `agent/pre-step`（waterfall），按会话 cwd 命中白名单后，读取该
   项目 `.trellis/.runtime/sessions/*.json` 的 `current_task` → `task.json.status` →
   workflow.md 的 `[workflow-state:*]`，把一条 user 角色的面包屑消息注入本轮消息流
   （等价 Trellis 官方 per-turn breadcrumb，提醒而非强制）。
2. **技能按项目供给（不再内置注册）**：`trellis-*` 技能随包携带（插件包 `skills/` 为权威
   副本），但**不**通过 `ctx.skills.registerProvider` 注册。会话开始（每轮面包屑注入）时检测
   项目 `.agents/skills/` 是否已有这些技能：**有则跳过，无则从插件包复制**（含共享
   `_templates/`）；harness 内置的 `dsh-skill-filesystem` provider 直接从项目根发现它们
   （`source: project-agents`）。项目可自行增改 `.agents/skills/` 下的技能副本，插件不再
   覆盖已存在的副本。除原生工作流技能外，含三类工作流技能 `trellis-feat` / `trellis-issue` /
   `trellis-refactor`（new feature / bug / 行为等价重构，各自带 quick/standard 车道与硬人卡点）。
3. **诊断工具**：`trellis_state` 工具可问"某项目当前处于工作流的哪个阶段"。
4. **建任务工具**：`trellis_task_create` 一次性完成「写 `.trellis/tasks/<slug>/task.json`
   （status=planning）+ 播种该工作类型的产物模板 + 首次使用初始化 `.trellis/templates/` +
   **同步写 `.trellis/.runtime/sessions/` 的 `current_task` 指针**」，面包屑/阶段/Web 徽标
   立即生效——修掉"只建 task 不同步 session，导致解析不到 active task"的常见问题。
5. **Web UI 阶段徽标**：在有 web 服务的 profile 下，会话标题行右侧出现一枚嵌入徽标
   （`conversation.session.header.utilities` 官方 additive 座位），紧凑展示当前项目活动
   任务的类型与阶段（如 `功能 · design`）；悬停/点击展开该 `work.type` 的完整阶段轨道。
   数据来自 host 按会话发布的**只读缓存摘要**（`POST /trellis-workflow/api/task-state`，
   仅 `{ sessionId }`，绝不返回路径、也绝不由浏览器请求触发项目解析/fs 读取）；模型在
   阶段切换时调用 `trellis_ui_update`（无参数）刷新缓存，徽标在挂载/会话切换/页面焦点
   回归/手动点击时读取。headless（无 web 服务）profile 下此功能整体不激活，其余功能不受影响。

## 目录结构

```
dsh-trellis/
  package.json            # ESM cordis 插件包（name: dsh-trellis, MIT）
  lib/
    index.js              # 插件主入口（agent/pre-step 面包屑 + 技能供给 + trellis_state/trellis_task_create + Web 徽标路由/工具）
    task.js               # trellis_task_create 的写入侧：slug/校验、task.json 构造、模板播种、session 指针同步
    resolve.js            # cwd → 项目根 + .trellis 资产路径
    state.js              # 阶段解析：session → 活跃任务 → status → phase + workflow.md 面包屑 + 任务摘要/轨道
    breadcrumb.js         # 经 createUserMessage 构造注入消息 + no-trellis 逃生口
    trust.js              # 本地同源/防 DNS-rebinding 围栏（Web 只读路由）
    skills.js             # 技能供给：检测项目 .agents/skills/ 并复制缺失的 trellis-* 技能与 _templates/
    meta.js               # 名称 / 配置 Schema / 默认白名单
    types/index.d.ts
  skills/trellis-*/SKILL.md   # 15 个随包技能（权威副本；会话开始时按需复制到项目 .agents/skills/，含 trellis-feat/issue/refactor）
  skills/_templates/          # 三类工作流产物模板 + work-types.md 路由表（随技能一并复制到项目 .agents/skills/_templates/）
```

> 项目侧落盘位置：`.agents/skills/trellis-*/SKILL.md` 与 `.agents/skills/_templates/`
> （harness 的 `dsh-skill-filesystem` 从 `.agents/skills` 发现技能，无需改 profile）。

## 配置

`cordis.patch.yml`（或宿主 profile）中挂载本插件的行：

```yaml
- id: trellis-workflow
  name: 'dsh-trellis'
  config:
    # 命中这些项目的 cwd 才注入（效果上的"工作区级"）
    allowlist:
      - "D:/GameEngine_Project/Godot/motion"
    # 只在每个新 user 消息的首步注入，避免刷屏
    injectStep: 1
    # 消息里出现这些独立单词时本轮跳过注入
    skipKeywords: ["no-trellis"]
    # 若按 codex-inline 调度（planning-inline / in_progress-inline）置 true
    inline: false
```

### Web 设置（白名单在线编辑，免重启）

插件同时提供 host 侧设置命名空间 `trellis-workflow` 和一个客户端设置页签（随包分发，
通过 `dsh.client` 清单由 web 自动加载）。**重启 DSH 后**，侧边栏「设置 → 插件」下会出现
**「Trellis 工作流」** 页签，可在线增删 `allowlist`（项目根）、改 `injectStep` /
`skipKeywords` / `inline`；保存即写入用户设置文档并即时生效（下一轮注入即用新值），
无需改 yml、无需重启。配置分层为：

```text
schema 默认值 <- cordis.patch.yml 的 config（base）<- Web 设置页的用户文档
```

Web 里覆盖的字段优先于 patch.yml；Web 里重置后回落到 patch.yml / 默认值。

> **前置（path A，必须）**：harness 只向 Web 客户端暴露 `WEB_SETTINGS_NAMESPACES`
> 名单内的设置命名空间（dsh-host-apiproxy 写死）。安装器 `scripts/install.mjs` 会幂等
> 补丁该名单（新增 `trellis-workflow`）——`dsh plugin add` 后需补跑一次
> `node scripts/install.mjs --patch-harness`（或在 DSH 升级覆盖 harness 后重跑补回；
> 该模式无需 profile，自动扫描 Windows `%LOCALAPPDATA%` 与 Linux/macOS
> `~/.nvm` / `~/.npm/_npx` 下的所有 harness 副本）。
> 未补丁时页签显示"当前 harness 未向 Web 暴露…"。
>
> **另（harness 全局限制）**：设置 RPC 仅对本机回环地址开放；用局域网 IP/主机名访问
> 时设置功能整体降级。非回环或不想改 harness 时，可绕过 Web 直接编辑
> `$DSH_HOME/settings.yaml` 写 `trellis-workflow:` 段（热重载、同样免重启生效）。

## 发版 / 接入

### 通用命令安装 / 卸载（推荐，`dsh plugin`）

本包声明了 `dsh.bundle` 并自带 `cordis.patch.yml` 激活层，因此走 DSH 标准的
`dsh plugin` 命令：`add` 后由 loader 的 reconcile 自动把包加入该 profile 的
`dsh.profile.bundles` 层栈（bundle 层 `insert` 插件行，重启即挂载注入层）；
`remove` 时依赖与 bundle 层一并清除（合成树不再有插件行）。

```bash
# 安装（link: 指向本地包；发布后可直接用包名）
dsh plugin --profile web add link:F:/dsh-plugins/dsh-trellis

# 卸载
dsh plugin --profile web remove dsh-trellis
```

两条命令都幂等；执行后重启 DSH 生效。`remove` 后 node_modules 里可能残留指向本包的
junction（pnpm 不回收 link: 链接，惰性无害）；需要彻底清掉可再跑
`node scripts/install.mjs --uninstall --profile web`。

**按项目覆盖配置**（如 allowlist）：在 profile 的 `cordis.patch.yml` 加同名 id 行只写
config，loader 按 id 合并、profile 层优先：

```yaml
- id: trellis-workflow
  config:
    allowlist:
      - "F:/Projects/FordProject"
```

（也可以在 Web 设置页在线改，见上文"Web 设置"。）

### 传统安装器（可选，行式管理）

`scripts/install.mjs` 仍是可用的备选工具——不依赖 `dsh.bundle`，直接维护
`cordis.patch.yml` 行 + junction：

```bash
node node_modules/dsh-trellis/scripts/install.mjs \
  --profile web --allowlist "F:/Projects/FordProject"
npm run install:trellis -- --profile web --allowlist "F:/Projects/FordProject"
```

常用参数：

| 参数 | 说明 |
|------|------|
| `--profile <name>` | 目标 profile；缺省时自动识别"包含本插件"的那个 |
| `--allowlist <path>` | 注入白名单项目根，可重复 |
| `--inject-step <n>` | 只在该步注入（默认 1） |
| `--skip-keywords a,b` | 消息含这些词时本轮跳过注入 |
| `--inline` | 按 codex-inline 调度解析阶段 |
| `--dry-run` | 只预览改动，不写盘 |
| `--patch-harness` | 只补丁 harness 的 `WEB_SETTINGS_NAMESPACES` 白名单（无需 profile） |
| `--uninstall` | 一步卸载：配置行 + 依赖 junction + `package.json` 依赖项 |
| `--fix-deps` | 清理 `package.json` 中指向不存在路径的 trellis link 依赖 |

卸载只删指向本包的 junction 与 trellis 依赖项；真实目录或指向别处的链接一律不动。
重启 DSH 后插件完全移除（Web 设置里残留的 `trellis-workflow` 用户段无插件消费，惰性保留，不影响任何东西）。

- **本地接法（快速，本机已就绪）**：包已有 `node_modules/@deepseek-ai` junction 指向 profile
  的 hoisted 依赖；profile 侧的
  `C:\Users\12644\.dsh\profiles\web\node_modules\dsh-trellis` junction
  指向本目录，因此插件可被 loader import 并解析其 `@deepseek-ai/*` peer 依赖。
- **独立发版**：发布为 npm 包 `dsh-trellis` 后，使用者在自己的 profile
  `dsh plugin --profile <name> add dsh-trellis`，重启 DSH 即可。

> 说明：Cordis loader 的 `import()` 按 Node ESM 解析，`@deepseek-ai/*` peer 依赖必须能随包
> 解析到。包在 profile 之外时，需要在包根建 `node_modules/@deepseek-ai` junction 到 profile 的
> hoisted 目录（本包已建），或在 profile 内 `pnpm add` 后运行。

## 许可

MIT。本包不含 Trellis AGPL 源码。语义参考 Trellis workflow，内容为本包重写。
