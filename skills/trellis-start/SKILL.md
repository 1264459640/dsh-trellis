---
name: trellis-start
description: "Begin the Trellis workflow: classify the request and first ask for task-creation consent before creating any task. Use at the start of a session or when a new task may be needed."
---

# Trellis Start

Use this skill to open a Trellis workflow session correctly. Do not create a task
before reading this rule: task creation requires explicit user consent.

## Preconditions

- No active Trellis task has been confirmed for this turn.
- You can read the project's `.trellis/` directory (runtime + workflow assets).

## Steps

1. **Classify the request.**
   - Simple conversation or small task → ask only whether this turn should
     create a Trellis task. If the user says no, do not touch Trellis this session.
   - Complex task → ask whether you may create a Trellis task and enter planning.
     If the user says no, do not do broad inline implementation; instead explain,
     clarify scope, or suggest a smaller split.
2. **Consent is not implementation approval.** Getting permission to create a task
   only starts planning. Implementation still waits for the planning gate.
3. **Look for an existing task.** If a `<workflow-state>` breadcrumb (or
   `trellis_state`) already reports an active task, prefer resuming that task via
   `trellis-continue` instead of creating a new one.
4. **Create the task with `trellis_task_create`** (after consent): the tool writes
   `.trellis/tasks/<slug>/task.json` (status=planning), seeds the artifact templates,
   and **synchronously writes the `.trellis/.runtime/sessions/` `current_task`
   pointer** — the breadcrumb, phase and Web chip resolve the new task immediately.
   Do not hand-create the task directory or session files; derive the slug as
   `<work-type>-<mm-dd>-<name>` and let the tool validate it.

## Guardrails

- Never run `start` (activate) right after `create`. Planning must be reviewed first.
- One question per message when choosing scope; recommend options over open-ended asks.
- Do not invent a product/spec hierarchy the repository does not have; read existing
  docs and specs first.
- Creating a task without `trellis_task_create` (or without writing the runtime
  session pointer) leaves the session in `no_task` — the tool is the only
  supported path.
