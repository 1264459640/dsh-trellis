# dsh-trellis

<div align="center">
  <b style="font-size: 1.3em;">Trellis Workflow Extension for DeepSeek Harness</b><br />
  <sub>Structured Stage Progression · Step State Machine · Verification Quality Gates · Optional Read-Only Planning</sub><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Node Version" src="https://img.shields.io/badge/Node.js-≥20-green.svg" />
  <img alt="Step State Machine" src="https://img.shields.io/badge/Steps-5--State%20Machine-blue.svg" />
  <img alt="Verification Gate" src="https://img.shields.io/badge/Gate-Verified%20Check-success.svg" />
</div>

<div align="center">
  🌏 <a href="./README.md">中文</a> · <a href="./README_EN.md"><b>English</b></a>
</div>

<br />

<p align="center">
  <img src="./docs/images/web-kanban-list.png" width="49%" alt="Compact task list with details inspector" />
  <img src="./docs/images/web-kanban-lanes.png" width="49%" alt="Kanban lanes with collapsed empty lanes" />
</p>
<p align="center">
  <img src="./docs/images/web-kanban-refactor.png" width="49%" alt="Refactor lane view with task details" />
</p>

---

## Overview

`dsh-trellis` is an engineering workflow extension for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness), inspired by the stage specifications and state machine design of [Trellis](https://github.com/mindfold-ai/trellis).

In complex, multi-turn AI coding workflows, typical pain points include:
1. **Writing code without a clear design**: Jumping directly into implementation often causes structural drift or regressions.
2. **Fragmented task checklists**: Maintaining separate checklists across different notes or files leads to state divergence.
3. **Missing quality verification**: Marking tasks as done without running tests or consulting human reviewers.

`dsh-trellis` addresses these issues through a unified step state machine, explicit stage progressions, and runtime tool filtering to ensure that models follow a disciplined "plan first, implement later, verify before closing" workflow.

---

## Core Features

- **Structured Stage Progression**: Standardized workflow tracks for feature development (`feat`), bug fixes (`issue`), and code refactoring (`refactor`).
- **Single Execution Contract**: Uses `task.json.steps` as the single authoritative source of truth for step statuses, preventing checklist divergence.
- **Verification Gates**: Standard step states (`pending`, `in_progress`, `verifying`, `blocked`, `completed`) with explicit support for automated AI testing and human sign-off gates before marking steps complete.
- **Optional Read-Only Planning**: When enabled via settings, code-writing tools (`write` / `edit`) are filtered out during planning phases, leaving only a sandboxed artifact channel for design documentation.
- **Session-Level Isolation**: Session pointers are stored independently under `.trellis/.runtime/sessions/`, preventing multi-session or subagent race conditions.
- **Dual-Mode Task Board**: A dense compact task list by default (type badge + title + stage + step summary), expanding into a full-screen kanban with workflow-stage lanes, auto-collapsed empty lanes, live search, type filters, and an archive lane. The UI is fully iconized (self-contained inline SVG icon set), and the details inspector provides a Step Tracker pipeline, an artifact file tree, and capsule-style property tags. The board stays deliberately restrained — it never mutates task state directly; the only advance path is the **Advance Task** button injecting an instruction into the composer for the Agent to execute, and artifact clicks produce native `@.trellis/tasks/...` file references handled by DSH.
- **Git Cleanliness Check**: Automatically verifies that the Git working tree is clean and committed before closing or archiving a task.

---

## Getting Started

### 1. Installation

Ensure Node.js ≥ 20 is installed, then run in your terminal:

```sh
dsh plugin --profile web add @banana-peeljj12/dsh-trellis@latest
```

After installation, **restart the DSH service**.

### 2. Configure Allowed Directories (Important)

By default, the plugin will not intercept any unconfigured workspaces. Add your target workspace directory to the allowlist:

1. Open the DSH Web UI and navigate to bottom-left **Settings → Plugins → Trellis Workflow**;
2. Under **Allowed Projects (allowlist)**, add the absolute path of your workspace root directory and click Save (hot-reloaded).

> **Note**: To prevent the model from editing source code prior to plan approval, enable **Enforce Read-Only Planning (`enforceReadonlyPlanning`)** in the same settings panel.

### 3. Usage

When describing complex tasks in chat, the model will guide you through creating and advancing Trellis tasks:

- **New Features**: Creates `feat-mm-dd-name`, advancing through `prd` → `design` → `design-review` → `impl` → `review` → `check`;
- **Bug Fixes**: Creates `issue-mm-dd-name`, advancing through `report` → `analyze` → `fix` → `fix-note`;
- **Refactoring**: Creates `refactor-mm-dd-name`, advancing through `scan` → `design` → `apply` → `done`.

To bypass workflow interception in a specific turn, include `no-trellis` in your prompt.

---

## Workflow Tracks

The plugin provides three standard tracks mapped to the task stage (`work.stage`):

| Track | Naming Pattern | Stage Progression | Description |
|---|---|---|---|
| **Feature (`feat`)** | `feat-MM-DD-name` | `prd` → `design` → `design-review` → `impl` → `review` → `check` | For new feature development or major functionality changes |
| **Issue (`issue`)** | `issue-MM-DD-name` | `report` → `analyze` → `fix` → `fix-note` | For bug diagnosis, fixing anomalies, and regression testing |
| **Refactor (`refactor`)** | `refactor-MM-DD-name` | `scan` → `design` → `apply` → `done` | For behavior-preserving optimizations and cleanups |

---

## Key Mechanisms

### 1. Step State Machine & Verification Gates

The `steps` array in `task.json` serves as the execution list and supports 5 states:

- `pending`: Waiting to be worked on;
- `in_progress`: Actively working on the step;
- `verifying`: Implementation done, awaiting verification;
- `blocked`: Blocked by external causes (requires `blockedReason`);
- `completed`: Verified and closed.

#### Verification Modes:
- **Automated Verification (`verification: 'ai'`)**: The model must run test commands and record `verified: true` with `verificationNotes` evidence via `trellis_task_update` in an initial call before the step can be marked `completed` in a subsequent call.
- **Human Approval Gate (`verification: 'human'`)**: Reserved for critical or high-risk changes. The step cannot be marked `completed` unless confirmed by the user and saved with `verifiedBy: 'human'`.
- **Completion Audit**: When closing or archiving a task, the plugin validates that all steps are completed and verified, and that the Git working tree is clean.

### 2. Read-Only Planning (Optional Enforcement)

When `enforceReadonlyPlanning: true` is configured, the plugin filters available tools based on the current workflow state:

| Authorization State | Condition | Available Tools | Description |
|---|---|---|---|
| `undecided` | In allowlist, no active task, not skipped | Read tools + `trellis_task_create` + `trellis_task_skip` | Guides task creation or explicit skip before modifying code |
| `planning` | Task is in planning stages (`prd`, `design`, `scan`, `report`) | Read tools + `trellis_task_update` + `trellis_artifact_update` | Removes `write` / `edit` tools; deliverables can only be updated through the artifact tool |
| `authorized` | Task is in implementation stages (`impl`, `fix`, `apply`) or skipped | Full tool surface | Restores generic read and write tools |

> Note: `trellis_artifact_update` only permits writing whitelisted documentation inside the active task directory (`.trellis/tasks/<slug>/`), preventing path traversal.

---

## Provided Tools

The plugin registers the following specialized tools:

- **`trellis_task_create`**: Creates a new task with initial `task.json`, seeds templates, and binds to the current session.
- **`trellis_task_update`**: Advances task stages, updates step progress, records verification evidence, or modifies task metadata.
- **`trellis_artifact_update`**: Safely updates task planning documents (such as `prd.md`, `design.md`, `check.md`), restricted by path and filename whitelists.
- **`trellis_task_archive`**: Archives a completed task to `.trellis/tasks/archive/YYYY-MM/` and unbinds the session.
- **`trellis_task_skip`**: Skips the Trellis workflow for the active session upon user approval, unlocking write tools.
- **`trellis_state`**: Inspects and reports Trellis runtime state and task information for the current workspace.
- **`trellis_ui_update`**: Manually refreshes the web header phase chip.

---

## Configuration Reference

Configure via the Web UI (**Settings → Plugins → Trellis Workflow**) or in `~/.dsh/settings.yaml`:

| Key | Type | Default | Description |
|---|---|---|---|
| `allowlist` | `string[]` | `[]` | **Project Allowlist**: Absolute paths of enabled workspace roots. Empty disables interception |
| `enforceReadonlyPlanning` | `boolean` | `false` | **Read-Only Planning**: Strips code modification tools during planning stages when enabled |
| `skipKeywords` | `string[]` | `['no-trellis']` | **Skip Keywords**: Suppresses workflow interception for turns containing these words |
| `injectStep` | `number` | `1` | Breadcrumb prompt injection step index (default: first step of turn) |
| `inline` | `boolean` | `false` | Enables codex-inline style phase dispatch |

---

## Repository Structure

```text
dsh-trellis/
├── lib/
│   ├── index.js            # Plugin entry: registers pre-step hooks, tool filtering, and API routes
│   ├── task.js             # Task engine: step state machine, verification gates, and audits
│   ├── skills.js           # Skills provider: provisions standard workflow skills into workspace
│   ├── breadcrumb.js       # Context builder: extracts focused steps and formats prompts
│   ├── readonly.js         # Authorization logic: undecided / planning / authorized states
│   ├── state.js            # State resolution: stage inference, session pointers, slug checks
│   ├── artifact.js         # Sandboxed writes: whitelisted artifact updates and security checks
│   ├── archive.js          # Archiving logic: completion validation, directory migration, Git checks
│   ├── board.js            # Kanban data: aggregates active tasks and archive buckets
│   ├── client.js           # Web client: phase badge, mini kanban, and settings panel
│   └── types/index.d.ts    # TypeScript type definitions
├── skills/                 # Bundled workflow skills and markdown templates
├── docs/images/            # Screenshots and architecture diagrams
└── test/                   # Automated unit test suite
```

---

## License & Acknowledgements

- Licensed under the [MIT License](./LICENSE);
- Thanks to [Trellis](https://github.com/mindfold-ai/trellis) (Mindfold) for the conceptual foundation of stage specifications and breadcrumb injection;
- Thanks to [CodeStable](https://github.com/codestable/CodeStable) for the three standard workflow track classifications;
- Thanks to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) for the modern, extensible agent runtime.
