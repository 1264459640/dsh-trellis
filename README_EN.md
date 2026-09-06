# dsh-trellis

<!-- Hero -->
<div align="center">
  <b style="font-size: 1.35em;">Trellis Workflow Integration for DeepSeek Harness</b><br />
  <sub>Plan First, Code Second · Single Source of Truth · Native 5-State Engine · Multi-Party Verification Gates · Visual Control</sub><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Node Version" src="https://img.shields.io/badge/Node.js-≥20-green.svg" />
  <img alt="5-State Machine" src="https://img.shields.io/badge/Steps-5--State%20Machine-blue.svg" />
  <img alt="Two-Phase Gates" src="https://img.shields.io/badge/Gate-Two--Phase%20Commit-success.svg" />
  <img alt="Readonly Planning" src="https://img.shields.io/badge/Security-Readonly%20Planning-red.svg" />
  <br /><br />
  <b>A deterministic constraint engine designed for complex AI agent software engineering.</b><br />
  Seamlessly mounts into the DSH runtime, offering per-turn breadcrumb injection, physical tool-surface pruning, two-phase step verification gates, strict per-session isolation, and an interactive Web Kanban monitor.
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

## 💡 Why dsh-trellis? The Pitfalls of AI Coding and Our Solution

When using Large Language Models (LLMs) for complex, long-running engineering tasks, traditional free-form conversational coding quickly suffers from three **structural failure modes**:

```text
┌───────────────────────────┐    Traditional AI Failure Modes    ┌───────────────────────────┐
│   Context Signal Decay    │ ─────────────────────────────────► │ Drifting away from goals, │
│ Attention Dilution        │                                    │ editing unrelated code    │
├───────────────────────────┤                                    ├───────────────────────────┤
│ Premature Implementation  │ ─────────────────────────────────► │ Rushing to edit code with │
│ Coding Without Planning   │                                    │ no research or design     │
├───────────────────────────┤                                    ├───────────────────────────┤
│  Absence of Hard Gates    │ ─────────────────────────────────► │ Self-declaring tests pass │
│ Illusion of Completion    │                                    │ and closing tasks falsely │
└───────────────────────────┘                                    └───────────────────────────┘
```

**`dsh-trellis` integrates the battle-tested engineering workflows of [Trellis](https://github.com/mindfold-ai/trellis) into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).**

It is not just a collection of system prompts, but a **deterministic, enforceable engineering runtime**:
- 🛡️ **Physical Tool-Surface Fencing**: Before plans are approved, code-writing tools (`write`/`edit`) are physically pruned from the API payload;
- 🎯 **Single Source of Truth**: Eliminates the "two-lists problem" completely — execution is driven 100% by native `task.json.steps`;
- 🚦 **Two-Phase Hard Quality Gates**: Both step-level and task-level completion gates block model self-certification and mandate human sign-off;
- 🧠 **High Signal-to-Noise Ratio (SNR) Focus**: Dynamically extracts the single highest-priority step, preventing context degradation.

---

## 🏗️ System Engineering Architecture

`dsh-trellis` hooks directly into DSH plugin waterfall events and sandboxed filesystems:

```text
                               DeepSeek Harness Host
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  [system-prompt/assemble]                     [agent/pre-step]              │
  │            │                                         │                      │
  │            ▼                                         ▼                      │
  │  ┌────────────────────┐                     ┌─────────────────────┐         │
  │  │ Read-only Planning │                     │ Active Step Locator │         │
  │  │ Tool Pruning       │                     │ Priority Decider    │         │
  │  └─────────┬──────────┘                     └──────────┬──────────┘         │
  │            │ (Prunes write/edit)                       │ (Resolves focus)   │
  │            ▼                                           ▼                    │
  │   Model Tool Surface Payload                Breadcrumb Context Block        │
  │   - read / glob / grep                      [trellis/in_progress]           │
  │   - trellis_artifact_update                 [Active Step] [#step-2] ...     │
  │   - trellis_task_update                     - Acceptance criteria & commands│
  │                                                                             │
  │  ─────────────────────────────────────────────────────────────────────────  │
  │  [Tool Execution Layer]                                                     │
  │   ├── trellis_task_create  ──► Scaffolds task, seeds templates, binds session │
  │   ├── trellis_task_update  ──► State transition, 5-state steps, dual gates  │
  │   ├── trellis_artifact_update► Sandboxed channel (whitelist + traversal guard)│
  │   └── trellis_task_archive ──► Atomic archive move, git cleanliness check   │
  │                                                                             │
  │  ─────────────────────────────────────────────────────────────────────────  │
  │  [Storage & Sandbox Boundary]                                               │
  │   ├── ctx.fs (DSH Sandboxed FS) ──► Enforces workspace-write / read-only   │
  │   ├── node:fs (Bounded Move)   ──► Atomic archive move, template self-prune │
  │   └── .trellis/tasks/<slug>/   ──► Machine state (task.json) + human docs   │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Core Engineering Mechanisms

### 1. Native 5-State Step Machine & Multi-Party Verification Gates

Rather than a primitive binary pending/done toggle, `TaskStep` models real-world software engineering with a 5-state finite automaton:

```text
               ┌──────────────┐
               │   pending    │ ◄── Planned; awaiting previous dependencies
               └──────┬───────┘
                      │ (Claim & start)
                      ▼
               ┌──────────────┐       (Blocked by dependency)      ┌──────────────┐
               │ in_progress  │ ─────────────────────────────────► │   blocked    │ (Mandatory blockedReason;
               └──────┬───────┘ ◄───────────────────────────────── └──────────────┘  surfaced at top of prompt)
                      │                                               (Resolved)
           ┌──────────┴──────────┐
  (No req) │                      │ (Verification required: 'ai' | 'human')
           ▼                      ▼
┌──────────────────┐    ┌──────────────────┐
│    completed     │    │    verifying     │ ◄── Code complete, under verification
└──────────────────┘    └────────┬─────────┘     (AI: runs test suite; Human: approval gate)
           ▲                     │
           │ (verified === true) │
           └─────────────────────┘
```

#### ① AI Automated Verification Gate (`verification: 'ai'`, legacy `verify: true`)
- **Two-Phase Commit**: The model is **physically prohibited** from marking `verified: true` and `status: 'completed'` in a single tool call;
- Once coding finishes, the step must transition to `verifying`. The model executes commands listed in `design.md`, calls `trellis_task_update` to record `verified: true` alongside `verificationNotes` (evidence/logs), and only then can mark it `completed` in a subsequent turn.

#### ② Human Manual Approval Gate (`verification: 'human'`)
- **Blocking Self-Certification**: For architectural refactorings or breaking changes, declare `verification: 'human'`;
- Tool-layer hard check: Attempting to complete the step without `current.verified === true && current.verifiedBy === 'human'` fails with `[trellis/human_gate]`;
- The model cannot forge human approval; it must present findings and wait for the user to explicitly confirm.

#### ③ Task Completion Guardrails
When a task attempts to set `status: 'completed'` or run `trellis_task_archive`:
- Any step in `blocked` → Denied (`[trellis/steps_blocked]`);
- Any step not `completed` → Denied (`[trellis/steps_incomplete]`);
- Any step unverified → Denied (`[trellis/steps_unverified]`);
- Uncommitted git changes in repository → Denied (`[trellis/git_dirty]`).

---

### 2. Single Source of Truth & Zero Redundancy

In past workflow designs, the "Two Lists Problem" led to chaos:
- Features kept a checklist in `implement.md`;
- Refactorings kept an isolated `checklist.yaml` (with proprietary `done/blocked` states);
- The root `task.json.steps` tracked yet another list.
Models inevitably fell out of sync.

#### Architecture Convergence

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Single Source of Truth Boundaries                    │
├──────────────────┬──────────────────┬──────────────────────────────────┤
│ Artifact         │ Nature of Data   │ Responsibility & Consumers       │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ task.json.steps  │ Machine State    │ Sole execution list; drives the  │
│                  │ Contract         │ 5-state machine and hard gates.  │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ design.md        │ Architectural    │ Data flow, interface contracts,  │
│                  │ Thinking (Docs)  │ test command list, and rollback. │
├──────────────────┼──────────────────┼──────────────────────────────────┤
│ prd.md           │ Requirements     │ User value, scope boundaries,    │
│                  │ Baseline         │ task-level acceptance criteria.  │
└──────────────────┴──────────────────┴──────────────────────────────────┘
```

- **Complete Template Deprecation**: `implement.md` and `checklist.yaml` templates are physically eliminated;
- **Self-Healing Template Pruning**:
  Built into `ensureProjectSkills`. Whenever an existing project loads with the new plugin, the engine silently and safely unlinks legacy template copies from `.agents/` and `.trellis/templates/` via sandboxed fail-closed checks (**historical `tasks/` data is never touched**).

---

### 3. Read-only Planning Enforcement

Why is a system prompt saying *"Please do not write code before the plan is approved"* inherently fragile?
Under long context or ambitious instructions, model autoregression tends to guess implementation details and prematurely invoke `write`/`edit`.

`dsh-trellis` implements a 3-State Authorization State Machine:

```text
                    ┌────────────────────────┐
                    │       undecided        │ (No active task, not skipped)
                    │  Tools: Read + Create  │
                    └───────────┬────────────┘
                                │ (trellis_task_create)
                                ▼
                    ┌────────────────────────┐
                    │        planning        │ (Stage is prd, design, review, or scan)
                    │  Tools: Read + Artifact Update (trellis_artifact_update)
                    │  ❌ Generic write/edit are physically stripped!
                    └───────────┬────────────┘
                                │ (Plan approved, advance to impl/fix/apply)
                                ▼
                    ┌────────────────────────┐
                    │       authorized       │ (Implementation or explicitly skipped)
                    │  Tools: Full Write     │
                    └────────────────────────┘
```

- **Physical Tool Stripping**: In `system-prompt/assemble`, `write` and `edit` tool definitions are completely pruned from the API payload. The LLM literally cannot see write tools, forcing 100% of its reasoning budget toward research and design;
- **Sandboxed Artifact Channel (`trellis_artifact_update`)**: The only permitted write tool during planning. It validates against an allowed Markdown whitelist and executes path traversal checks (`path.relative`) to ensure source code cannot be touched.

---

### 4. High-SNR Attention Management

As conversations grow, the model's effective attention decays. Flooding every turn with full checklists and huge files causes prompt bloat and instruction drift.

#### ① Active Step Priority Queue (`findActiveStep`)
During execution, the engine pinpoints **one single focal step**:
$$\text{Priority: } \mathbf{blocked} \succ \mathbf{in\_progress} \succ \mathbf{verifying} \succ \mathbf{pending}$$
- If a step is `blocked`, the blocker is surfaced immediately to trigger resolution;
- Otherwise, only the active or verifying step is injected, suppressing all completed and distant future steps.

#### ② Tiered Breadcrumb Prompts
- **`in_progress`**: Injects delivery specifications and quantitative acceptance criteria;
- **`verifying (AI)`**: Prompts running `design.md` verification commands and recording evidence;
- **`verifying (Human)`**: Emphasizes `[Human Approval Gate - 👤 Awaiting User Confirmation]` and strictly forbids unapproved completion;
- **`blocked`**: Highlights `[⚠️ Step Blocked]` along with the recorded `blockedReason`.

#### ③ In-Memory Deduplication (Zero Disk I/O)
Maintains an in-memory key map `Map<sessionId, 'stepId:status:verified'>`. When the same step stays in the same state across turns, prompt injection degrades to a single-line reminder, saving context tokens.

#### ④ Lossless-JSON Compliance
Injected breadcrumb `source` objects use conditional spreads (`...(x ? { k: x } : {})`) to guarantee zero `undefined` values, preventing DSH `snapshotJsonValue` serialization crashes.

---

### 5. Per-Session Pointer Isolation

In modern AI IDEs and multi-agent setups, users frequently open concurrent sessions or spawn subagents:
- **No Global Singleton**: Eliminates global active-task pointers;
- **Independent Pointer Files**: Each session persists its active task pointer in `.trellis/.runtime/sessions/<session-id>.json`;
- **Zero Cross-Pollution**: Session A working on `feat-A` and Session B on `issue-B` maintain isolated breadcrumbs, stage chips, and tool gating without interference.

---

## ⚡ Quick Start

### 1. Install Plugin

Ensure Node.js ≥ 20 and DSH are running. Execute:

```sh
# Install release
dsh plugin --profile web add @banana-peeljj12/dsh-trellis

# Or update to latest
dsh plugin --profile web add @banana-peeljj12/dsh-trellis@latest

# Or link local source
dsh plugin --profile web add link:/abs/path/to/dsh-trellis
```

After installation, **restart the DSH server once**.

### 2. Configure Allowlist

Trellis operates with a zero-trust default and only activates on explicitly allowed paths:
1. Open DSH Web GUI, navigate to **Settings → Plugins → Trellis Workflow**;
2. In **Allowlist Projects**, add your project root absolute path (e.g. `D:/code/my-project` or `/home/user/project`), and save. It applies **immediately** with no restart needed.

### 3. Start Working

State your goal naturally to the AI:
> *"Design and implement an RBAC permission system for our user service."*

The AI follows the standard engineering lifecycle:
1. Formulates the task `feat-09-06-rbac-auth` with user confirmation;
2. Activates read-only planning, reads existing specs, and produces `prd.md` & `design.md`;
3. Breaks work into fine-grained `steps` with explicit acceptance criteria and verification owners;
4. Enters implementation upon approval, passing two-phase gates and human sign-offs before archiving cleanly!

---

## 🧭 Built-in Standard Workflows

| Work Type | Entry Skill | Stages | Description |
|---|---|---|---|
| **Feature** (`feat`) | `trellis-feat` | `prd` → `design` → `design-review` → `impl` → `review` → `check` | New features or overhauls. Supports `quick` (fast-path) and `standard` (independent reviews & human gates). |
| **Issue** (`issue`) | `trellis-issue` | `report` → `analyze` → `fix` → `fix-note` | Bug investigations and regressions. Obvious fixes can skip `analyze`; loops trigger `trellis-break-loop`. |
| **Refactor** (`refactor`) | `trellis-refactor` | `scan` → `design` → `apply` → `done` | **Behavior-preserving cleanup**. Driven purely by `steps`; behavioral changes must route to feat/issue. |

---

## ⚙️ Configuration Reference

| Config Key | Type | Default | Description |
|---|---|---|---|
| `allowlist` | `string[]` | `[]` | **Security Allowlist**: Project root paths where Trellis is active. Empty means no projects are intercepted. |
| `enforceReadonlyPlanning` | `boolean` | `false` | **Read-only Planning Master Switch**: When enabled, physically prunes generic write/edit tools during planning. |
| `injectStep` | `number` | `1` | Turn step index where breadcrumbs are injected (default 1 = first step of each user prompt). |
| `skipKeywords` | `string[]` | `['no-trellis']` | **Escape Hatch**: If the user prompt contains this keyword, Trellis completely skips interception for that turn. |
| `inline` | `boolean` | `false` | Enables codex-inline style phase resolution. |

---

## 🛠️ Codebase Structure

```text
dsh-trellis/
├── lib/
│   ├── index.js            # Core registrar: pre-step hook, assemble tool pruning, lifecycle & RPC remotes
│   ├── task.js             # Task engine: 5-state transitions, AI/Human dual gates, checkStepsCompletion
│   ├── skills.js           # Skill provisioning & self-healing prune of deprecated project templates
│   ├── breadcrumb.js       # Context builder: findActiveStep priority queue, formatStepPrompt tiered rendering
│   ├── readonly.js         # Permission decider: maps task stage to 3-state authorization
│   ├── state.js            # State machine: stage-aware phase derivation, session isolation, archive keys
│   ├── artifact.js         # Deliverable channel: sandboxed trellis_artifact_update with traversal checks
│   ├── archive.js          # Archiver: task completion guard, bounded node:fs atomic rename, git cleanliness
│   ├── board.js            # Kanban data provider: aggregates active tasks and monthly archive trees
│   ├── client.js           # Web client UI: stage chip, Mini Kanban modal, settings page
│   └── types/index.d.ts    # TypeScript type definitions and contracts
├── skills/                 # 15 bundled workflow skills and artifact templates
└── test/                   # 72+ test assertions (state machine, gates, sandbox safety, self-healing prune)
```

---

## 📄 License & Acknowledgements

- Released under the [MIT License](./LICENSE).
- Acknowledgement to [Trellis](https://github.com/mindfold-ai/trellis) (Mindfold): Pioneer of the structured workflow concept. Workflow semantics were cleanly re-engineered natively on DSH primitives with zero AGPL code.
- Acknowledgement to [CodeStable](https://github.com/codestable/CodeStable): Inspiring feat/issue/refactor workflow designs.
- Acknowledgement to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): Modern, extensible AI agent runtime.
