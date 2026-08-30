# dsh-trellis

<!-- Hero -->
<div align="center">
  <b style="font-size: 1.25em;">Trellis Workflows Adapted for DeepSeek Harness</b><br />
  <sub>Plan Before Coding · Clear Stages · Visual Progress · Keep AI on Track</sub><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Node Version" src="https://img.shields.io/badge/Node.js-≥20-green.svg" />
  <img alt="Per-turn Reminder" src="https://img.shields.io/badge/-Per--turn%20Reminder-4d6bfe" />
  <img alt="Skill Auto-provisioning" src="https://img.shields.io/badge/-Skill%20Auto--provisioning-4d6bfe" />
  <img alt="Web Kanban" src="https://img.shields.io/badge/-Web%20Kanban-4d6bfe" />
  <br /><br />
  <b>Automatically injects task-state breadcrumbs into each turn</b>, auto-provisions 15+ <code>trellis-*</code> skills into projects,<br />
  and provides native task tools plus a Web UI stage chip & Mini Kanban board.
</div>

<div align="center">
  🌏 <a href="./README.md">中文</a> · <a href="./README_EN.md"><b>English</b></a>
</div>

<br />

<p align="center">
  <img src="./docs/images/web-phase-chip.png" width="49%" alt="Web phase chip and stage track popover" />
  <img src="./docs/images/web-kanban.png" width="49%" alt="Mini task kanban board and monthly archive grouping" />
</p>

---

## 💡 Why dsh-trellis?

When building complex software with AI coding agents, you often face these pain points:
- 🤯 **Losing Context & Drifting**: After several turns, the AI forgets the original goal and starts touching unrelated code.
- 🏃 **Rushing to Code Blindly**: Handed a feature, the AI jumps straight into implementation without understanding architecture or side effects, creating regressions.
- ❓ **Black-Box Progress**: Unclear whether the AI is planning, coding, or testing, making debugging or steering difficult.

**`dsh-trellis` brings the structured engineering workflows of [Trellis](https://github.com/mindfold-ai/trellis) into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).**

It guides the AI to work like a seasoned engineer:
1. 🧠 **Context-Aware & Focused**: At the start of each turn, the plugin automatically reminds the AI of the active task and current stage.
2. 📐 **Plan First, Implement Second**: Follows standardized workflows — PRD & Design before coding for features; reproduce & root-cause analysis before fixing bugs.
3. 📊 **Visual & Transparent**: A stage chip stays on the top-right header; click to open the Mini Kanban to inspect progress, switch tasks, or browse archives.
4. 🪶 **Zero Overhead**: Pure Node.js ESM, zero external dependencies, no Python required, and zero project pollution.

---

## ⚡ 30-Second Quick Start

### 1. Install Plugin

Ensure Node.js ≥ 20 and DSH are installed. Run in your terminal:

```sh
# Install plugin
dsh plugin --profile web add @banana-peeljj12/dsh-trellis

# Update plugin to latest
dsh plugin --profile web add @banana-peeljj12/dsh-trellis@latest

# Or link from local source
dsh plugin --profile web add link:/abs/path/to/dsh-trellis
```

After installation, **restart the DSH server**.

### 2. Add Project to Allowlist

By default, the allowlist is empty. Configure it once via Web UI:

1. Refresh the DSH browser page.
2. Go to **Settings → Plugins → Trellis Workflow** on the left sidebar.
3. In **Allowlist Projects**, enter the absolute path of your project (e.g. `/home/user/my-project` or `D:/projects/my-project`), and save. It takes effect **immediately** without restart.

> 💡 Alternatively, you can edit `~/.dsh/settings.yaml` under `trellis-workflow.allowlist`.

### 3. Start Coding!

Just converse with your AI Agent as usual:
> *"Help me add a WeChat QR code login feature to the user system."*

The AI will automatically guide you through creating a Trellis task (e.g., `feat-08-20-wechat-login`), generating a PRD, and progressing step by step!

---

## 🧭 Three Built-in Workflows

`dsh-trellis` provides three battle-tested engineering tracks:

| Work Type | Entry Skill | Standard Track | Use Case |
|---|---|---|---|
| **Feature Development** | `trellis-feat` | `PRD (prd)` → `Design (design)` → `Design Review (review)` → `Implementation (impl)` → `Code Review (review)` → `Validation (check)` | New features, major revamps. Supports `quick` and `standard` lanes. |
| **Issue Fixing** | `trellis-issue` | `Report (report)` → `Root Cause (analyze)` → `Fix (fix)` → `Fix Note (fix-note)` | Bug fixes, regressions. Pairs with `trellis-break-loop` if looped. |
| **Code Refactoring** | `trellis-refactor` | `Scan (scan)` → `Refactor Plan (design)` → `Apply (apply)` | Behavior-preserving optimizations, cleanups, architectural splits. |

### 🚀 Quick Lane vs 🛡️ Standard Lane
- **Quick Lane (`quick`)**: For localized, small changes with clear scope. Skips heavy review gates and goes straight to implementation and validation.
- **Standard Lane (`standard`)**: Enforces **human gates** (e.g. design plan must be approved by the user, and code must pass review & verification before archiving).

---

## ✨ Key Features

### 1. 🧭 Subtle & Smart Per-turn Breadcrumbs
- Injects the active task's current state and next recommended action on the first step of each user message.
- **Clean**: Injects only once per turn without cluttering subsequent tool-execution steps.
- **Escape Hatch**: Skip workflow injection anytime by including `no-trellis` in your prompt.

### 2. 🧩 Auto-Provisioned Skills
- Bundles 15 finely tuned `trellis-*` skills and artifact templates (in `skills/`).
- Checks the project's `.agents/skills/` on session start and automatically copies missing skills without manual configuration.

### 3. 🏷️ Web Phase Chip & Mini Kanban Board
- Displays a compact phase badge (e.g. `feat · design`) on the session header bar.
- **Works in brand-new conversations too**: before the first message, the chip sits at the top-right above the input box, so a task can be activated before work starts.
- Hover or click to view the full stage pipeline.
- Click to open the **Mini Kanban**:
  - 🔄 **Quick Switch**: Switch the active task binding with one click.
  - 🗄️ **Monthly Folders**: Browse completed historical tasks grouped by month (e.g. `2025-08`).
- High Performance: Backed by host-side read-only caching; requests never trigger slow filesystem scans.

### 4. 🛠️ Complete Task Lifecycle Tools
- `trellis_task_create`: Scaffold task directories, initialize PRD/Design templates, enforce `<type>-<mm-dd>-<name>` conventions, and bind session pointers.
- `trellis_task_update`: Update stages and statuses atomically with track validation and UI cache sync.
- `trellis_task_archive`: Atomically move finished tasks to archive directories and unbind sessions.
- `trellis_state`: Inspect workflow diagnostics anytime.

---

## ⚙️ Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `allowlist` | `string[]` | `[]` | **Project Allowlist**: Absolute paths of enabled projects. Disabled if empty. |
| `injectStep` | `number` | `1` | Turn step number to inject breadcrumb (1 = first step). |
| `skipKeywords` | `string[]` | `['no-trellis']` | Skip breadcrumb injection if the user prompt contains any of these keywords. |
| `inline` | `boolean` | `false` | Enable codex-inline style phase resolution. |

### Configuration Options

1. **Web Settings UI (Recommended)**: Go to **Settings → Plugins → Trellis Workflow**, edit and save.
2. **User Config (`~/.dsh/settings.yaml`)**:
   ```yaml
   trellis-workflow:
     allowlist:
       - /path/to/my-project
     injectStep: 1
     skipKeywords:
       - no-trellis
     inline: false
   ```

---

## 🛠️ Architecture & Development

```text
dsh-trellis/
├── package.json            # npm package metadata (@banana-peeljj12/dsh-trellis, MIT)
├── cordis.patch.yml        # dsh.bundle self-activation layer
├── lib/
│   ├── index.js            # Main plugin entry: registers pre-step hooks, tools & RPCs
│   ├── task.js             # Task creation & updates: slug checks, template seeding, session sync
│   ├── archive.js          # Task archiving: atomic move to archive/<yyyy-mm>/, unbind pointers
│   ├── resolve.js          # Project resolution: matches cwd against allowlist
│   ├── state.js            # State machine: active tasks, stages, summary & pipeline
│   ├── breadcrumb.js       # Turn injection builder & escape keywords filter
│   ├── trust.js            # Loopback origin security validation (anti DNS-rebinding)
│   ├── skills.js           # Auto-provisions authoritative skill copies
│   ├── settings.js         # Settings namespace registration & storage
│   └── meta.js             # Schema & defaults definition
├── skills/                 # 15 authoritative skill definitions
│   ├── trellis-*/SKILL.md  # Skill markdown bodies
│   └── _templates/         # Task templates (prd/design/review) & routing table
└── scripts/
    └── install.mjs         # Standalone CLI installer
```

---

## ❓ FAQ

<details>
<summary><b>Q1: Why doesn't Trellis trigger after installation?</b></summary>

- **Check Allowlist**: `allowlist` is empty by default. Add your project root path via Web Settings or `settings.yaml`.
- **Restart Server**: Restart the DSH server once after installing the plugin, then hard-refresh the browser (`Ctrl+F5` or `Cmd+Shift+R`).
- **Check Escape Keywords**: Ensure your message doesn't contain `no-trellis`.
</details>

<details>
<summary><b>Q2: "Trellis Workflow" tab is missing in Web Settings?</b></summary>

- Run `node scripts/install.mjs --patch-harness` to expose the settings tab, or directly edit `~/.dsh/settings.yaml` under `trellis-workflow:`.
</details>

<details>
<summary><b>Q3: How do I completely uninstall?</b></summary>

```sh
dsh plugin --profile web remove @banana-peeljj12/dsh-trellis
```
</details>

---

## 🙏 Acknowledgements

- **[Trellis](https://github.com/mindfold-ai/trellis)** (by [Mindfold](https://mindfold.ai), AGPL-3.0-only):
  Special thanks to Mindfold for open-sourcing the Trellis workflow concepts. This project only ports the **workflow semantics** (stages, artifact conventions, and breadcrumbs). All code and skills are independently rewritten under MIT.
- **[CodeStable](https://github.com/codestable/CodeStable)**:
  Special thanks to CodeStable for the inspiration behind the 3-track workflow design (feat / issue / refactor).
- **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)**:
  The powerful AI Agent runtime foundation.

---

## 📄 License

[MIT](./LICENSE)
