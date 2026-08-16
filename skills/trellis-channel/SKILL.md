---
name: trellis-channel
description: "Coordinate a multi-agent channel: workers, progress reporting, shared context, and handoffs. Use when a task is split across several workers or agents."
---

# Trellis Channel

Use this skill to coordinate work across multiple workers/agents when a task is
split into independently verifiable chunks.

## Principles

- **One authoritative shared context.** Keep the source of truth in files/task
  artifacts, not scattered chat. Workers read artifacts, then report.
- **Independent units.** Each worker owns a deliverable that can be verified on its
  own; express ordering dependencies in the artifacts, not by implied tree position.
- **Frequent, thin progress.** Report state (done / blocked / next) with artifacts,
  not narrative.

## Workflow

1. Define the task tree: a parent task for the source requirements + cross-child
   acceptance, child tasks for independently verifiable deliverables.
2. Dispatch each child with an explicit prompt that starts with the active task and
   names the deliverable.
3. After each worker, update progress and the relevant artifact; resolve conflicts
   in the shared context.
4. On completion, run the parent's integration review against the cross-child
   acceptance criteria.

## Guardrails

- A worker that would spawn the same role it already is should not; avoid
  unbounded recursive dispatch.
- Do not treat parent/child position as a dependency system — write ordering into
  the child artifacts.
