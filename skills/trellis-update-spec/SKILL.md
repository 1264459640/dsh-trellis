---
name: trellis-update-spec
description: "Review whether a task produced new knowledge worth recording under the project spec: new patterns or conventions, pitfalls, and technical decisions. Walk through the judgment even if the conclusion is nothing-to-update."
---

# Trellis Update Spec

Run this skill in Phase 3 (before commit) to capture lessons from a finished task
so future work benefits.

## Judgment

Ask whether this task surfaced anything worth writing down:

- a newly discovered pattern or convention the project should keep
- a pitfall you hit (so it does not recur)
- a new technical decision and its rationale

## Where it lands

- Spec guidelines: under `.trellis/spec/<package>/<layer>/` — either extend the
  relevant guideline file or add a pointer from the package index.
- Cross-package thinking guides: under `.trellis/spec/guides/index.md`.

## Steps

1. Review the task artifacts and the changes for the categories above.
2. Decide: concrete result → write it to the correct spec location.
   Nothing to update → still walk through the judgment explicitly (so the decision
   is visible, not skipped).
3. Keep spec edits focused and tied to the evidence; update the package index if you
   add a guideline file.

## Guardrails

- Do not record code-as-spec unless it encodes a convention worth following.
- Spec writes belong in the same task's commit batch (Phase 3.4), not a forgotten
  follow-up.
- If the task fixed a bug whose root cause belongs in the spec, land that before
  committing — not after.
