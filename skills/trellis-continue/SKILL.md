---
name: trellis-continue
description: "Resume a paused or archived Trellis session: determine the current phase from the active task and runtime state, then load the matching skill."
---

# Trellis Continue

Use this skill to resume an existing Trellis session cleanly instead of starting
fresh.

## Steps

1. **Determine the active task.** Read the project's runtime session state
   (the `.trellis/.runtime` session file) for `current_task`, or ask the model for
   `trellis_state`.
2. **Infer the phase.** Map the task's `status` plus artifact presence:
   - no active task → triage (trellis-start)
   - planning, artifacts unreviewed → trellis-brainstorm (planning gate)
   - in_progress → trellis-before-dev / trellis-check per the flow
   - completed / dirty tree → trellis-finish-work
3. **Load the matching skill and continue** from the next step in that phase.

## Guardrails

- Do not re-open a stuck or archived task as a brand-new one unless the user asks.
- Preserve the task directory — archiving moves it, never deletes the record.
- If requirements changed materially, return to the brainstorm planning gate rather
  than resuming stale artifacts.
