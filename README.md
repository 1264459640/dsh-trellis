# dsh-trellis

<!-- Hero -->
<div align="center">
  <b style="font-size: 1.15em;">Trellis 工作流适配进 DeepSeek Harness —— 每步触发 · 技能引导 · 阶段可见</b><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="每步触发" src="https://img.shields.io/badge/-每步触发-4d6bfe" /> <img alt="技能供给" src="https://img.shields.io/badge/-技能供给-4d6bfe" /> <img alt="建任务工具" src="https://img.shields.io/badge/-建任务工具-4d6bfe" /> <img alt="Web 阶段徽标" src="https://img.shields.io/badge/-Web%20阶段徽标-4d6bfe" /><br /><br />
  <b>每回合注入项目任务状态面包屑</b>，把 <code>trellis-*</code> 技能随项目供给，<br />
  并提供建任务 / 查阶段的原生工具与 Web 界面阶段徽标。
</div>

<div align="center">
  🌏 <a href="./README.md"><b>中文</b></a> · <a href="./README_EN.md">English</a>
</div>

<p align="center">
  <img src="./docs/images/web-phase-chip.png" width="49%" alt="Web 阶段徽标与阶段轨道" />
  <img src="./docs/images/web-kanban.png" width="49%" alt="Mini 任务看板与归档折叠" />
</p>

`dsh-trellis` 是 [Trellis](https://github.com/mindfold-ai/trellis) 工作流在
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）上的**适配移植**——
本项目**只是**把 Trellis 的流程语义接到 DSH 上，不是新的工作流体系，也不属于
[Mindfold](https://mindfold.ai) 的官方产物。**自包含、MIT、零外部运行时**：不需要 Python、
不携带任何 Trellis AGPL 源码，状态机与技能内容均为本包重写；运行时按各项目自身的 `.trellis/`
读取，因此**直接继承已有 Trellis 项目的沉淀**。

## ✨ 功能一览

- 🧭 **每步触发（面包屑注入）**：订阅 `agent/pre-step` waterfall，命中白名单项目后读取
  `.trellis/.runtime/sessions/*.json` 的 `current_task` → `task.json.status` → 阶段，并把一条
  user 角色面包屑注入本轮消息流（等价 Trellis 官方 per-turn breadcrumb，提醒而非强制）。只在新
  用户消息的首步注入；消息含 `no-trellis` 等关键词时整轮跳过。
- 🧩 **技能随项目供给**：15 个 `trellis-*` 技能随包携带（包内 `skills/` 为权威副本），会话开始时
  检测项目 `.agents/skills/`——缺则复制（含共享 `_templates/`）、有则跳过；由 harness 内置的
  `dsh-skill-filesystem` provider 从项目根发现（`source: project-agents`），**无需注册、无需改
  profile**。项目可自由增改自己的技能副本，删掉的技能下轮自动补回。
- 🛠️ **建任务一步到位**：`trellis_task_create` 一次性完成「写 `.trellis/tasks/<slug>/task.json`
  （status=planning）+ 播种该工作类型的产物模板 + 首次使用初始化 `.trellis/templates/` + **同步写
  `.trellis/.runtime/sessions/` 的 `current_task` 指针**」——修掉"只建 task 不同步 session，导致
  解析不到 active task"的常见问题。
- 🔄 **更新任务与状态流转**：`trellis_task_update` 支持原子更新任务的 `status`（`planning` / `in_progress` / `completed`）、`work.stage`、`mode`、`title` 与 `description`。省略 `slug` 时自动作用于当前 session 绑定的活动任务，并对工作流 stage 轨道合法性进行校验，更新后自动刷新 Web 状态徽标缓存。
- 🗄️ **归档一步到位**：`trellis_task_archive`（配合收工走 `trellis-finish-work`）把已完成任务原子
  移入 `.trellis/tasks/archive/<yyyy-mm>/<slug>/`——月份键 = slug 的 `mm` + 当年，与看板读取共用
  同一辅助函数，**写读永远一致**；无 `mm-dd` 的遗留 slug 归 `other/`。自动解绑所有指向该任务的
  会话指针（归档任务只读、不再占活跃看板），归档只移动、不删除记录。
- 🔍 **阶段诊断**：`trellis_state` 工具随时回答"某项目当前处于工作流的哪个阶段"，并校验任务 slug。
- 🏷️ **Web 阶段徽标 & Mini 任务看板**：web profile 下会话标题行右侧嵌入一枚徽标（官方 additive 座位
  `conversation.session.header.utilities`），紧凑展示当前活动任务的类型与阶段（如 `功能 · design`），
  悬停/点击展开该工作类型的完整阶段轨道与 Mini 任务看板（支持快速切换会话绑定的任务、按月份折叠查看归档任务）；数据来自 host 按会话发布的**只读缓存摘要**，浏览器请求
  绝不触发项目解析或文件读取。headless（无 web 服务）profile 下此功能整体不激活，其余功能不受影响。
- ✅ **slug 校验**：活动任务目录必须符合 `<work-type>-<mm-dd>-<name>`（如
  `feat-01-15-billing-export`）；不合规时每轮面包屑与 `trellis_state` 都会给出修正提示。

## 🧠 工作流模型

插件内置三类工作流——通用化改编自 [CodeStable](https://github.com/codestable/CodeStable)
（FTM/CodeStable 思路，内容为本包重写、MIT），由 `_templates/work-types.md` 路由表驱动：

| 工作类型 | 入口技能 | 阶段轨道 | 说明 |
|---|---|---|---|
| 新功能 / 功能改造 | `trellis-feat` | prd → design → design-review → impl → review → check | quick / standard 两条车道 |
| Bug / 异常 / 回归 | `trellis-issue` | report → analyze → fix → fix-note | 反复调试时配合 `trellis-break-loop` |
| 行为等价重构 | `trellis-refactor` | scan → design → apply | 行为变更转 feat / issue |

- 原生 `status` 仍只用 `planning` → `in_progress` → `completed`（archive）；细阶段放在
  `work.stage` + 产物文件，**仓库产物优先于聊天历史**。
- 归档布局（写读一致）：completed 任务经 `trellis_task_archive` 移入
  `.trellis/tasks/archive/<yyyy-mm>/<slug>/`，月份键 = slug 的 `mm` + 当年（如 `feat-08-15-x` →
  `2025-08`；无 `mm-dd` 的遗留 slug 归 `other/`）；看板按同一规则递归识别归档树并按 `yyyy-mm`
  折叠展示。
- Standard 车道带**人卡点**：design 需用户 approve、design-review 需独立 reviewer passed、check
  必须通过后才能 archive；人卡点未过时禁止写 `status=in_progress`。
- 新任务目录名必须为 `<work-type>-<mm-dd>-<短名>`（mm-dd 为创建日期）。

随包 15 个技能（`skills/`，权威副本，按需复制到项目 `.agents/skills/`）：

`trellis-start` · `trellis-brainstorm` · `trellis-before-dev` · `trellis-check` ·
`trellis-update-spec` · `trellis-finish-work` · `trellis-continue` · `trellis-break-loop` ·
`trellis-channel` · `trellis-meta` · `trellis-session-insight` · `trellis-spec-bootstrap` ·
`trellis-feat` · `trellis-issue` · `trellis-refactor`

外加共享产物模板 `_templates/`（`feat/` `issue/` `refactor/` + `work-types.md` 路由表），随技能一并
复制到项目 `.agents/skills/_templates/`。

## 🚀 安装

**前置**：DSH 已装好（`dsh web` 能正常运行），Node.js ≥ 20。

```sh
# 从 npm registry（发布后）
dsh plugin --profile web add @banana-peeljj12/dsh-trellis

# 从本地源码 checkout（开发）
dsh plugin --profile web add link:/abs/path/to/dsh-trellis

# 从打包 tarball（pnpm pack，无需发布）
dsh plugin --profile web add file:/abs/path/to/banana-peeljj12-dsh-trellis-0.1.0-rc.5.tgz
```

包声明了 `dsh.bundle.patch`（随包的 `cordis.patch.yml`），`add` 后由 loader 的 reconcile 自动把包
并入该 profile 的 `dsh.profile.bundles` 层栈，**重启 DSH 即挂载**（host 半改动；client 半硬刷新
浏览器生效）。卸载同样走 CLI，配置行与依赖一并清除：

```sh
dsh plugin --profile web remove @banana-peeljj12/dsh-trellis
```

### ⚠️ 重要：配置项目白名单（Allowlist）

> **注意**：插件安装后**默认白名单为空（`allowlist: []`）**。挂载插件后，**必须先将目标项目的根路径加入白名单**，插件的面包屑注入、技能自动供给、任务管理工具与阶段看板才会对该项目生效。

添加白名单的三种方式：

1. **Web 设置页（推荐，免重启即时生效）**：
   重启 DSH 并刷新浏览器后，进入左侧边栏「**设置 → 插件 → Trellis 工作流**」，在「**白名单项目 (allowlist)**」输入框中添加项目绝对路径（如 `/path/to/your/project`），点击保存即可立即生效。
2. **用户配置文件（`settings.yaml`，热重载）**：
   编辑 `~/.dsh/settings.yaml`（Windows 为 `%USERPROFILE%\.dsh\settings.yaml`），添加：
   ```yaml
   trellis-workflow:
     allowlist:
       - /path/to/your/project
   ```
3. **Profile 配置文件（`cordis.patch.yml`）**：
   在 profile 的 `cordis.patch.yml` 中为插件指定 `allowlist` 配置（见下方配置说明）。

<details>
<summary><b>手动安装（绕过 CLI，想看清每一步）</b></summary>

1. `cd ~/.dsh/profiles/web`
2. 在 `package.json` 的 dependencies 加 `"@banana-peeljj12/dsh-trellis": "link:/abs/path/to/dsh-trellis"`，然后
   `pnpm install`
3. 在 `cordis.patch.yml` 追加挂载行：
   ```yaml
   - insert:
       - id: trellis-workflow
         name: '@banana-peeljj12/dsh-trellis'
   ```
4. 重启 DSH；浏览器硬刷新（Cmd/Ctrl+Shift+R）

> `@deepseek-ai/*` peer 依赖按 Node ESM 解析：包在 profile 之外时，需要让它们从 profile 的
> hoisted `node_modules` 解析到（CLI 安装会自动处理）。

</details>

<details>
<summary><b>更新</b></summary>

```sh
dsh plugin --profile web add @banana-peeljj12/dsh-trellis
```

重跑一次即可（或改高 `~/.dsh/profiles/web/package.json` 里的版本后 `pnpm install`）。host 半
改动需重启 DSH；client 半改动硬刷新浏览器即可。

</details>

<details>
<summary><b>常见问题</b></summary>

| 现象 | 原因与解决 |
|---|---|
| 功能没生效 | ① 项目未加入白名单（默认 allowlist 为空，需在 Web 设置或 settings.yaml 中添加项目根路径）；② host 半改动不热加载，重启 DSH；③ client 半改动硬刷新浏览器 |
| 设置页没有「Trellis 工作流」页签 | 未补丁 harness 的 `WEB_SETTINGS_NAMESPACES`（跑 `node scripts/install.mjs --patch-harness`）或未重启；也可直接编辑 `$DSH_HOME/settings.yaml` 的 `trellis-workflow:` 段（热重载） |
| 面包屑不注入 | 会话 cwd 不在 `allowlist`；消息含 `skipKeywords`（默认 `no-trellis`）；不是 `injectStep`（默认 1） |
| 局域网 IP 访问时设置功能失效 | 设置 RPC 仅对本机回环地址开放（harness 全局限制） |
| remove 后 node_modules 残留链接 | pnpm 不回收 `link:` 依赖，惰性无害；可用 `node scripts/install.mjs --uninstall --profile web` 彻底清理 |

</details>

## ⚙️ 配置

| 字段 | 类型 / 默认 | 说明 |
|---|---|---|
| `allowlist` | `string[]`，默认 `[]` | 注入白名单项目根（效果上的"工作区级"）；为空则不注入任何项目 |
| `injectStep` | `number`，默认 `1` | 只在该步注入（1 = 每个新用户消息的首步），避免刷屏 |
| `skipKeywords` | `string[]`，默认 `['no-trellis']` | 消息里出现这些独立单词时本轮跳过注入 |
| `inline` | `boolean`，默认 `false` | 按 codex-inline 调度解析阶段名（`planning-inline` / `in_progress-inline`） |

`cordis.patch.yml`（或宿主 profile）中挂载本插件的行：

```yaml
- id: trellis-workflow
  name: '@banana-peeljj12/dsh-trellis'
  config:
    allowlist:
      - /path/to/your/project
    injectStep: 1
    skipKeywords: ['no-trellis']
    inline: false
```

配置分层：

```text
schema 默认值 <- cordis.patch.yml 的 config（base）<- Web 设置页的用户文档
```

<details>
<summary><b>Web 设置（白名单在线编辑，免重启）</b></summary>

插件提供 host 侧设置命名空间 `trellis-workflow` 与一个随包分发的客户端设置页签（经 `dsh.client`
清单由 web 自动加载）。**重启 DSH 后**，侧边栏「设置 → 插件」出现「Trellis 工作流」页签，可在线
增删 `allowlist`（项目根）、改 `injectStep` / `skipKeywords` / `inline`；保存即写入用户设置文档并
即时生效（下一轮注入即用新值），无需改 yml、无需重启。Web 里覆盖的字段优先于 patch.yml；重置后
回落到 patch.yml / 默认值。

**前置（path A，必须）**：harness 只向 Web 客户端暴露 `WEB_SETTINGS_NAMESPACES` 名单内的设置
命名空间。安装器 `node scripts/install.mjs --patch-harness` 会幂等补丁该名单（自动扫描常见 harness
安装位置；DSH 升级覆盖 harness 后可重跑补回）。未补丁时页签会提示"当前 harness 未向 Web
暴露…"。

**绕过（path B）**：设置 RPC 仅对本机回环地址开放（局域网访问时设置功能整体降级）。非回环或不想
改 harness 时，直接编辑 `$DSH_HOME/settings.yaml` 写 `trellis-workflow:` 段——热重载、同样免重启
生效。

</details>

## 🛠️ 开发与构建

```
dsh-trellis/
  package.json            # ESM cordis 插件包（name: @banana-peeljj12/dsh-trellis, MIT）
  cordis.patch.yml        # dsh.bundle.patch 自激活层（insert 插件行）
  lib/
    index.js              # 主入口：agent/pre-step 面包屑 + 技能供给 + trellis_state / trellis_task_create / trellis_task_update / trellis_task_archive + Web 徽标
    task.js               # task 创建与更新：slug 校验 / task.json 构造与修改 / 模板播种 / session 指针同步
    archive.js            # trellis_task_archive 写入侧：归档目标 / completed 校验 / 原子移动（受控 node:fs）/ 指针解绑
    resolve.js            # cwd → 项目根 + .trellis 资产路径
    state.js              # 阶段解析：session → 活跃任务 → status → phase + workflow.md 面包屑 + 任务摘要/轨道
    breadcrumb.js         # createUserMessage 构造注入消息 + no-trellis 逃生口
    trust.js              # 本地同源 / 防 DNS-rebinding 围栏（Web 只读路由）
    skills.js             # 技能供给：检测项目 .agents/skills/ 并复制缺失技能与 _templates/
    settings.js           # 可选 settings 命名空间（Web 设置页）
    meta.js               # 名称 / 配置 Schema / 默认值
    types/index.d.ts
  skills/trellis-*/SKILL.md   # 15 个随包技能（权威副本）
  skills/_templates/          # 产物模板 + work-types.md 路由表
  scripts/install.mjs         # 传统安装器（bin: trellis-install）
```

纯 JavaScript、零构建、零运行时依赖（`@deepseek-ai/*` 为 peer，由 web profile 提供）；client 半是
手写零构建 bundle，经公共 slot 系统注册（阶段徽标用官方 additive 座位
`conversation.session.header.utilities`）。传统安装器 `scripts/install.mjs` 仍是可用的备选工具
（不依赖 `dsh.bundle`，直接维护 `cordis.patch.yml` 行 + 依赖链接）：

| 参数 | 说明 |
|---|---|
| `--profile <name>` | 目标 profile；缺省时自动识别"包含本插件"的那个 |
| `--allowlist <path>` | 注入白名单项目根，可重复 |
| `--inject-step <n>` | 只在该步注入（默认 1） |
| `--skip-keywords a,b` | 消息含这些词时本轮跳过注入 |
| `--inline` | 按 codex-inline 调度解析阶段 |
| `--auto` | 幂等自动模式（供包装脚本使用） |
| `--dry-run` | 只预览改动，不写盘 |
| `--patch-harness` | 只补丁 harness 的 `WEB_SETTINGS_NAMESPACES` 白名单（无需 profile） |
| `--uninstall` | 一步卸载：配置行 + 依赖链接 + `package.json` 依赖项 |
| `--fix-deps` | 清理 `package.json` 中指向不存在路径的 trellis link 依赖 |

## 🔐 安全

- Web 徽标数据来自 host 侧**只读缓存**：`POST /trellis-workflow/api/task-state` 只接收
  `{ sessionId }`，响应绝不含路径；浏览器请求**永不**触发项目解析或文件读取（cache miss 返回稳定
  空态，与未知会话不可区分，防探测）。
- 路由受本地信任围栏保护（回环 host + 同源标记，等价官方 `isTrustedApiRequest` 语义），并做
  method / 路径 / 请求体大小校验；错误只返回稳定状态词，不泄露内部细节。
- 任务创建、归档指针清理与技能复制全部走 `ctx.fs` + 每调用沙箱策略；沙箱拒绝映射为标准
  `[sandbox: …]` 标记，与 harness 编辑工具走同一升级流程。
- 归档的**目录移动**是文档化受控例外（dsh-fs 无 move/delete 原语，且 harness 模型文件工具也无）：
  用 `node:fs` 原子 rename，但 slug 严格正则校验、源/目标恒在 `.trellis/tasks/` 内、root 只取会话
  header 命中 allowlist 的结果，并对会话沙箱策略 fail-closed（read-only 拒绝；workspace-write 越出
  workspaceRoot 拒绝）——任何受限模式下都不静默绕过。
- 技能供给失败只告警、绝不打断当轮注入（缺失技能下轮可补复制）。

## ⚠️ 已知限制

- headless（无 web 服务）profile 下 Web 阶段徽标整体不激活，其余功能不受影响。
- 只在会话 cwd 命中 `allowlist` 的项目里注入；项目需自带 `.trellis/`（无 `workflow.md` 时用内置
  兜底面包屑文案）。
- Web 设置 RPC 仅限本机回环（harness 全局限制）。
- slug 校验是提醒而非强制——不合规的任务仍可推进，只是每轮收到修正提示。
- 只消费 Trellis 流程语义，任务文件布局需与 `.trellis/` 约定一致。

## 🖥️ 平台支持

Windows / Linux / macOS 均可（纯 Node ESM，无原生依赖、无构建产物差异）。Node.js ≥ 20。

## 🙏 致谢

`dsh-trellis` 是 [Trellis](https://github.com/mindfold-ai/trellis)（作者
[Mindfold](https://mindfold.ai)，AGPL-3.0-only）在 DeepSeek Harness 上的**适配移植**：

- 只复用 Trellis 的**流程语义**（active-task 面包屑、`[workflow-state:*]` 阶段块、阶段轨道与
  产物约定），不复制其代码与文档正文；
- 本包不含任何 AGPL 源码，状态机、技能与模板均为独立重写，以 MIT 许可发布；
- 本项目与 Mindfold **无隶属、无背书关系**，只是 Trellis 思路在 DSH 生态的第三方适配；
  部署 Trellis 本体时请遵循其 AGPL-3.0 许可条款。

感谢 Mindfold 团队设计并开源了 Trellis 工作流。

内置的三类工作流（feat / issue / refactor）则通用化改编自
[CodeStable](https://github.com/codestable/CodeStable)（源自 FTM/CodeStable 思路）——同样只参考
流程设计、内容为本包重写；感谢 CodeStable 团队的流程设计。

## 🔗 友情链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 本插件的宿主
- [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) —— 服务化侧边栏工作台插件
- [Trellis](https://github.com/mindfold-ai/trellis) —— 被适配的工作流本体（本插件仅移植其流程语义）
- [CodeStable](https://github.com/codestable/CodeStable) —— 三类工作流（feat / issue / refactor）的改编来源

## 许可

MIT。本包不含 Trellis AGPL 源码；工作流语义参考 Trellis，内容为本包重写。
