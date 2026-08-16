---
name: trellis-meta
description: "Customize Trellis itself: edit workflow.md breadcrumbs, add a status, wire lifecycle hooks, or change skills/agents. Use when the user wants to change how the workflow behaves."
---

# Trellis Meta

Use this skill to modify the Trellis workflow (vs. doing work *within* it).

## What you can change

- **Per-turn breadcrumb text:** edit the corresponding `[workflow-state:STATUS]`
  block in `.trellis/workflow.md`. Keep the `STATUS` charset `[A-Za-z0-9_-]+`.
- **Add a custom status:** add a new `[workflow-state:my-status]` block and have a
  lifecycle hook write it to `task.json.status`.
- **Wrap a lifecycle hook:** add a `hooks` field on a task:
  ```
  { "hooks": { "after_finish": ["your-command-here"] } }
  ```
  Supported events: `after_create / after_start / after_finish / after_archive`.
- **Change skills / agents / context loading** under the project's shared skill
  and agent configuration.

## Guardrails

- The breadcrumb is the only per-turn channel identifying the phase; keep every
  `[required · once]` step reachable from its phase's `[workflow-state:*]` block.
- Phase1 triage must always ask for task-creation consent before creating a task.
- Planning must distinguish lightweight PRD-only tasks from complex ones that need
  design+implement before `start`.
- Record the change so a broken or removed `[workflow-state:*]` block is obvious.
