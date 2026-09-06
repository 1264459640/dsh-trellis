---
name: trellis-session-insight
description: "Interpret runtime session and task state to know where a Trellis workflow stands: active task, status, phase, and diagnostics."
---

# Trellis Session Insight

Use this skill to understand the current state of a Trellis workflow from its
runtime artifacts before acting.

## Where state lives

- **Runtime session files** — `.trellis/.runtime/sessions/*.json`; each has a
  `current_task` pointer (the active task dir).
- **Task JSON** — `.trellis/tasks/<task>/task.json` with `status` (
  `planning` / `in_progress` / `completed`) and the execution step list `steps`
  (5-state: `pending` / `in_progress` / `verifying` / `blocked` / `completed`;
  per-step `verification: 'none' | 'ai' | 'human'`).
- **Artifacts** — `prd.md`, `design.md` if present, `research/` files.
- **Workflow breadcrumb** — the matching `[workflow-state:STATUS]` block in
  `.trellis/workflow.md`.

## Reading the phase

| status / state | phase |
|---|---|
| no active task | `no_task` |
| task created, planning | `planning` |
| task started | `in_progress` |
| task archived | `completed` |

Combine presence checks: a complex task that is `planning` but lacks `design.md` /
a planned `steps` list is not planning-ready; an `in_progress` task with a dirty
tree still needs the commit step.

## Guardrails

- Treat the runtime session file as the source of truth for *which* task is active;
  a session may point nowhere even when tasks exist.
- Do not trust a `<workflow-state>` block alone as final — verify status and
  artifacts when the decision matters.
