# dsh-trellis

<!-- Hero -->
<div align="center">
  <b style="font-size: 1.15em;">Trellis workflows, adapted into DeepSeek Harness — per-turn trigger · skill provisioning · phase visibility</b><br /><br />
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="per-turn trigger" src="https://img.shields.io/badge/-per-turn%20trigger-4d6bfe" /> <img alt="skill provisioning" src="https://img.shields.io/badge/-skill%20provisioning-4d6bfe" /> <img alt="task tool" src="https://img.shields.io/badge/-task%20tool-4d6bfe" /> <img alt="Web phase chip" src="https://img.shields.io/badge/-Web%20phase%20chip-4d6bfe" /><br /><br />
  <b>Injects the active task's state as a per-turn breadcrumb</b>, provisions the <code>trellis-*</code> skills<br />
  into each project, and ships native task/phase tools plus a Web phase chip.
</div>

<div align="center">
  🌏 <a href="./README.md">中文</a> · <a href="./README_EN.md"><b>English</b></a>
</div>

<p align="center">
  <img src="./docs/images/web-phase-chip.png" width="49%" alt="Web phase chip and stage track popover" />
  <img src="./docs/images/web-kanban.png" width="49%" alt="Mini task kanban board and monthly archive grouping" />
</p>

`dsh-trellis` is an **adaptation** of the [Trellis](https://github.com/mindfold-ai/trellis)
workflow for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — nothing
more: it ports Trellis's workflow semantics onto DSH, and is neither a new workflow system nor an
official [Mindfold](https://mindfold.ai) product. **Self-contained, MIT, zero external runtime**:
no Python, no vendored Trellis AGPL source — the state machines and skill content are rewritten in
this package. It reads each project's own `.trellis/` at runtime, so **existing Trellis projects
keep their accumulated spec**.

## ✨ Features

- 🧭 **Per-turn trigger (breadcrumb injection)** — subscribes to the `agent/pre-step` waterfall,
  resolves the project from the session cwd against an allowlist, reads
  `.trellis/.runtime/sessions/*.json` → `current_task` → `task.json.status` → phase, and injects a
  user-role breadcrumb into the turn (the Trellis per-turn breadcrumb equivalent — a reminder, not
  a hard gate). Injects only on the first step of each new user message; a turn is skipped when it
  contains a keyword such as `no-trellis`.
- 🧩 **Per-project skill provisioning** — the 15 `trellis-*` skills ship in the package
  (`skills/` is the authoritative copy). At session start the plugin checks the project's
  `.agents/skills/` — copies what's missing (including the shared `_templates/`), skips what's
  present — and the harness's built-in `dsh-skill-filesystem` provider discovers them from the
  project root (`source: project-agents`). **No registration, no profile edits.** Projects may edit
  their own copies freely; a deleted skill is re-provisioned on the next turn.
- 🛠️ **One-shot task creation** — `trellis_task_create` writes
  `.trellis/tasks/<slug>/task.json` (`status=planning`), seeds the artifact templates for the work
  type, initializes `.trellis/templates/` on first use, **and synchronously updates the
  `current_task` pointer in `.trellis/.runtime/sessions/`** — fixing the classic "task created but
  session not synced, so no active task resolves".
- 🔄 **Task update & stage transitions** — `trellis_task_update` updates an existing task's `status`
  (`planning` / `in_progress` / `completed`), `work.stage`, `mode`, `title`, and `description`. When
  `slug` is omitted, it defaults to the active task bound to this session, validates stage transitions
  against the workType track, and synchronously refreshes the Web chip cache.
- 🗄️ **One-shot archiving** — `trellis_task_archive` (used by `trellis-finish-work` at wrap-up)
  atomically moves a completed task into `.trellis/tasks/archive/<yyyy-mm>/<slug>/` — month key =
  the slug's `mm` + the current year, computed by the SAME helper the kanban board reader uses, so
  writing and reading always agree; legacy slugs without an `mm-dd` segment go under `other/`. It
  also unbinds every session that had the task bound (archived tasks are read-only and leave the
  active board). Archiving moves the record — it never deletes it.
- 🔍 **Phase diagnostics** — `trellis_state` answers "which workflow phase is this project in" and
  validates the active task slug.
- 🏷️ **Web phase chip & Mini kanban** — on web profiles, a chip appears at the right of the session header
  (official additive seat `conversation.session.header.utilities`) showing the active task's type
  and stage (e.g. `功能 · design`); hover/click expands the full stage track for that work type and a
  mini task kanban board (switch active task bindings, browse monthly archived tasks).
  Data comes from a host-side **read-only cache summary**; browser requests never trigger project
  resolution or file reads. Headless profiles (no web service) simply don't activate this feature;
  everything else is unaffected.
- ✅ **Slug validation** — the active task directory must follow `<work-type>-<mm-dd>-<name>`
  (e.g. `feat-01-15-billing-export`); violations surface a fix hint in the per-turn breadcrumb and
  in `trellis_state`.

## 🧠 Workflow model

Three workflow types are built in — generically adapted from
[CodeStable](https://github.com/codestable/CodeStable) (the FTM/CodeStable idea, content rewritten
here, MIT), driven by the `_templates/work-types.md` routing table:

| Work type | Entry skill | Stage track | Notes |
|---|---|---|---|
| New feature / feature change | `trellis-feat` | prd → design → design-review → impl → review → check | `quick` / `standard` lanes |
| Bug / anomaly / regression | `trellis-issue` | report → analyze → fix → fix-note | pair with `trellis-break-loop` when debugging loops |
| Behavior-equivalent refactor | `trellis-refactor` | scan → design → apply | behavior changes → feat / issue |

- Native `status` stays `planning` → `in_progress` → `completed` (archive); fine-grained stages
  live in `work.stage` + artifact files, and **repository artifacts win over chat history**.
- Archive layout (write/read consistent): a completed task is moved by `trellis_task_archive` to
  `.trellis/tasks/archive/<yyyy-mm>/<slug>/`, month key = the slug's `mm` + the current year
  (e.g. `feat-08-15-x` → `2025-08`; legacy slugs without an `mm-dd` go under `other/`); the kanban
  reads the archive tree with the same rule and folds it by `yyyy-mm`.
- The `standard` lane has **human checkpoints**: design needs user approval, design-review needs an
  independent reviewer pass, check must pass before archive; a failing checkpoint forbids writing
  `status=in_progress`.
- New task directory names must be `<work-type>-<mm-dd>-<short-name>` (mm-dd = creation date).

The 15 bundled skills (`skills/`, the authoritative copy, provisioned into the project's
`.agents/skills/` on demand):

`trellis-start` · `trellis-brainstorm` · `trellis-before-dev` · `trellis-check` ·
`trellis-update-spec` · `trellis-finish-work` · `trellis-continue` · `trellis-break-loop` ·
`trellis-channel` · `trellis-meta` · `trellis-session-insight` · `trellis-spec-bootstrap` ·
`trellis-feat` · `trellis-issue` · `trellis-refactor`

Plus the shared artifact templates `_templates/` (`feat/` `issue/` `refactor/` + `work-types.md`
routing table), copied alongside into the project's `.agents/skills/_templates/`.

## 🚀 Install

**Prerequisites**: DSH installed and running (`dsh web` works), Node.js ≥ 20.

```sh
# from the npm registry (after publishing)
dsh plugin --profile web add @banana-peeljj12/dsh-trellis

# from a source checkout (development)
dsh plugin --profile web add link:/abs/path/to/dsh-trellis

# from a packed tarball (pnpm pack, no publishing involved)
dsh plugin --profile web add file:/abs/path/to/banana-peeljj12-dsh-trellis-0.1.0-rc.5.tgz
```

The package declares `dsh.bundle.patch` (its `cordis.patch.yml`), so `add` lets the loader's
reconcile merge it into the profile's `dsh.profile.bundles` layer stack — **restart DSH to mount**
(host-half change; the client half picks up on a hard browser refresh). Uninstall goes through the
same CLI and clears the config row together with the dependency:

```sh
dsh plugin --profile web remove @banana-peeljj12/dsh-trellis
```

### ⚠️ Important: Configure Project Allowlist

> **Note**: By default, the allowlist is empty (`allowlist: []`). After installing and mounting the plugin, **you must add your project root path to the allowlist** for breadcrumb injection, skill provisioning, task tools, and kanban features to take effect for that project.

Three ways to configure the allowlist:

1. **Web Settings (Recommended, takes effect immediately without restart)**:
   Restart DSH and refresh the browser, navigate to **Settings → Plugins → Trellis workflow**, add your project's absolute path (e.g. `/path/to/your/project`) under **Allowlist Projects (allowlist)**, and click Save.
2. **User Settings File (`settings.yaml`, hot-reloaded)**:
   Edit `~/.dsh/settings.yaml` (or `%USERPROFILE%\.dsh\settings.yaml` on Windows):
   ```yaml
   trellis-workflow:
     allowlist:
       - /path/to/your/project
   ```
3. **Profile Configuration (`cordis.patch.yml`)**:
   Specify `allowlist` in `~/.dsh/profiles/web/cordis.patch.yml` under the plugin configuration (see below).

<details>
<summary><b>Manual install (bypass the CLI, step by step)</b></summary>

1. `cd ~/.dsh/profiles/web`
2. Add `"@banana-peeljj12/dsh-trellis": "link:/abs/path/to/dsh-trellis"` to `package.json` dependencies, then run
   `pnpm install`
3. Append the mount row to `cordis.patch.yml`:
   ```yaml
   - insert:
       - id: trellis-workflow
         name: '@banana-peeljj12/dsh-trellis'
   ```
4. Restart DSH; hard-refresh the browser (Cmd/Ctrl+Shift+R)

> The `@deepseek-ai/*` peer dependencies resolve via Node ESM: when the package lives outside the
> profile, they must resolve from the profile's hoisted `node_modules` (the CLI install handles
> this automatically).

</details>

<details>
<summary><b>Update</b></summary>

```sh
dsh plugin --profile web add @banana-peeljj12/dsh-trellis
```

Re-run the command (or bump the version in `~/.dsh/profiles/web/package.json` and
`pnpm install`). Host-half changes need a DSH restart; client-half changes only need a hard refresh.

</details>

<details>
<summary><b>Troubleshooting</b></summary>

| Symptom | Cause / fix |
|---|---|
| Nothing takes effect | 1. Project not added to allowlist (default is empty, add your project root path in Settings or settings.yaml); 2. Host-half changes don't hot-reload: restart DSH; 3. Client-half changes need a hard browser refresh |
| No "Trellis workflow" tab in Settings | The harness `WEB_SETTINGS_NAMESPACES` wasn't patched (run `node scripts/install.mjs --patch-harness`) or DSH wasn't restarted; alternatively edit the `trellis-workflow:` section in `$DSH_HOME/settings.yaml` (hot-reloaded) |
| Breadcrumb never injects | Session cwd isn't under `allowlist`; the message contains `skipKeywords` (default `no-trellis`); or it isn't the `injectStep` (default 1) |
| Settings break over LAN | Settings RPC is loopback-only (a harness-wide restriction) |
| Stale link left in node_modules after remove | pnpm doesn't reap `link:` dependencies — inert and harmless; clean up with `node scripts/install.mjs --uninstall --profile web` |

</details>

## ⚙️ Configuration

| Field | Type / default | Description |
|---|---|---|
| `allowlist` | `string[]`, default `[]` | Project roots whose cwd receives the breadcrumb ("workspace-level" in effect); empty = inject nowhere |
| `injectStep` | `number`, default `1` | Only inject on this step index (1 = first step of each new user message) |
| `skipKeywords` | `string[]`, default `['no-trellis']` | Turns containing these standalone words skip injection |
| `inline` | `boolean`, default `false` | Resolve phase names assuming codex-inline dispatch (`planning-inline` / `in_progress-inline`) |

Mount row in `cordis.patch.yml` (or the host profile):

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

Config layering:

```text
schema defaults <- cordis.patch.yml config (base) <- Web Settings user document
```

<details>
<summary><b>Web settings (edit the allowlist online, no restart)</b></summary>

The plugin registers a host-side settings namespace `trellis-workflow` and ships a client settings
tab (auto-loaded by web through the `dsh.client` manifest). **After restarting DSH**, a
"Trellis workflow" tab appears under Settings → Plugins: add/remove `allowlist` entries, change
`injectStep` / `skipKeywords` / `inline` online; saving writes the user settings document and takes
effect on the next turn — no yml edits, no restart. Web overrides beat patch.yml; resetting falls
back to patch.yml / defaults.

**Prerequisite (path A, required)**: the harness only exposes settings namespaces listed in
`WEB_SETTINGS_NAMESPACES` to the Web client. `node scripts/install.mjs --patch-harness`
idempotently patches that list (it scans the common harness install locations; re-run after a DSH
upgrade overwrites the harness). Without the patch the tab shows "current harness does not expose…".

**Workaround (path B)**: settings RPC is loopback-only (LAN access degrades settings entirely). If
you don't run loopback or prefer not to touch the harness, write a `trellis-workflow:` section
directly into `$DSH_HOME/settings.yaml` — hot-reloaded, equally restart-free.

</details>

## 🛠️ Develop & build

```
dsh-trellis/
  package.json            # ESM cordis plugin package (name: @banana-peeljj12/dsh-trellis, MIT)
  cordis.patch.yml        # dsh.bundle.patch self-activating layer (insert row)
  lib/
    index.js              # entry: agent/pre-step breadcrumb + skill provisioning + trellis_state / trellis_task_create / trellis_task_update / trellis_task_archive + Web chip
    task.js               # task creation & update: slug validation / task.json / template seeding / session pointer sync
    archive.js            # trellis_task_archive write side: archive target / completed guard / atomic move (guarded node:fs) / pointer unbind
    resolve.js            # cwd → project root + .trellis asset paths
    state.js              # phase resolution: session → active task → status → phase + workflow.md breadcrumb + summary/track
    breadcrumb.js         # createUserMessage injection + no-trellis escape hatch
    trust.js              # loopback/same-origin trust fence (Web read-only route)
    skills.js             # skill provisioning: check .agents/skills/ and copy missing skills + _templates/
    settings.js           # optional settings namespace (Web Settings tab)
    meta.js               # name / config schema / defaults
    types/index.d.ts
  skills/trellis-*/SKILL.md   # 15 bundled skills (authoritative copy)
  skills/_templates/          # artifact templates + work-types.md routing table
  scripts/install.mjs         # legacy installer (bin: trellis-install)
```

Plain JavaScript, zero build, zero runtime dependencies (`@deepseek-ai/*` are peers provided by the
web profile); the client half is a hand-written zero-build bundle registered through the public slot
system (the chip uses the official additive seat `conversation.session.header.utilities`). The
legacy installer `scripts/install.mjs` remains available as an alternative (it doesn't rely on
`dsh.bundle`; it manages the `cordis.patch.yml` row + dependency link directly):

| Flag | Description |
|---|---|
| `--profile <name>` | Target profile; defaults to auto-detecting the one containing this plugin |
| `--allowlist <path>` | Breadcrumb allowlist project root; repeatable |
| `--inject-step <n>` | Only inject on this step (default 1) |
| `--skip-keywords a,b` | Skip injection for turns containing these words |
| `--inline` | Resolve phases with codex-inline dispatch |
| `--auto` | Idempotent auto mode (for wrapper scripts) |
| `--dry-run` | Preview changes only, write nothing |
| `--patch-harness` | Only patch the harness `WEB_SETTINGS_NAMESPACES` allowlist (no profile needed) |
| `--uninstall` | One-step uninstall: config row + dependency link + `package.json` dep entries |
| `--fix-deps` | Clean stale trellis link deps in `package.json` pointing at non-existent paths |

## 🔐 Security

- The Web chip reads a host-side **read-only cache**: `POST /trellis-workflow/api/task-state`
  accepts only `{ sessionId }` and its responses never contain paths; a browser request
  **never** triggers project resolution or file reads (a cache miss returns a stable empty state,
  indistinguishable from an unknown session — no probing).
- The route sits behind a loopback trust fence (loopback host + same-origin markers, mirroring the
  official `isTrustedApiRequest` semantics) plus method / path / body-size checks; errors return
  stable status words only, leaking nothing internal.
- Task creation, archive pointer cleanup and skill copying go through `ctx.fs` with a per-call
  sandbox policy; sandbox
  denials map to the standard `[sandbox: …]` marker and follow the same escalation flow as the
  harness's own editor tools.
- The archive **directory move** is a documented, controlled exception (dsh-fs has no
  move/delete primitive, and the harness's own model file tools expose none either): it uses a
  `node:fs` atomic rename, but the slug is strictly regex-validated, source and target always stay
  inside `.trellis/tasks/` (same drive), the root comes only from the session header allowlist
  match, and the move is fail-closed on the session's sandbox policy (read-only denies;
  workspace-write denies outside its `workspaceRoot`) — no silent bypass in any confined mode.
- A skill-provisioning failure only warns and never breaks the current turn's injection (the
  missing skills can be copied on a later turn).

## ⚠️ Known limitations

- Headless profiles (no web service) never activate the Web chip; everything else is unaffected.
- Injection only happens in allowlisted projects; a project needs its own `.trellis/` (without a
  `workflow.md` the plugin falls back to built-in breadcrumb text).
- Web settings RPC is loopback-only (a harness-wide restriction).
- Slug validation is a reminder, not an enforcement — a non-conforming task still proceeds, just
  with a per-turn fix hint.
- Only the Trellis workflow semantics are consumed; the task file layout must follow the
  `.trellis/` conventions.

## 🖥️ Platform support

Windows / Linux / macOS (pure Node ESM, no native dependencies, no build-artifact differences).
Node.js ≥ 20.

## 🙏 Acknowledgments

`dsh-trellis` is an **adaptation** of [Trellis](https://github.com/mindfold-ai/trellis) (by
[Mindfold](https://mindfold.ai), AGPL-3.0-only) for DeepSeek Harness:

- It reuses only Trellis's **workflow semantics** (the active-task breadcrumb,
  `[workflow-state:*]` phase blocks, stage tracks and artifact conventions) — not its code or
  documentation text;
- This package contains no AGPL source; the state machines, skills and templates are independently
  rewritten and released under MIT;
- This project has **no affiliation with and is not endorsed by Mindfold** — it is a third-party
  adaptation of the Trellis idea in the DSH ecosystem; when deploying Trellis itself, follow its
  AGPL-3.0 license terms.

Thanks to the Mindfold team for designing and open-sourcing the Trellis workflow.

The three built-in work types (feat / issue / refactor) are generically adapted from
[CodeStable](https://github.com/codestable/CodeStable) (the FTM/CodeStable idea) — again, only the
process design is referenced and the content is rewritten here; thanks to the CodeStable team for
their workflow designs.

## 🔗 Links

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the host
- [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) — service-oriented sidebar workbench plugin
- [Trellis](https://github.com/mindfold-ai/trellis) — the adapted workflow itself (only its semantics are ported here)
- [CodeStable](https://github.com/codestable/CodeStable) — the source the three work types (feat / issue / refactor) are adapted from

## License

MIT. This package contains no Trellis AGPL source; the workflow semantics reference Trellis, and
all content is rewritten in this package.
