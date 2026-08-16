---
name: trellis-check
description: "Verify code changes against specs and task artifacts: fix findings directly, then confirm lint, type-check, and tests pass. Use after implementation changes before reporting completion."
---

# Trellis Check

Run this skill at the end of an implementation chunk (and as the final full-scope
pass before commit) to verify changes against the project spec and the task's
reviewed artifacts.

## Steps

1. **Compare against artifacts.** Review all changes against:
   - the relevant `.trellis/spec/<package>/<layer>/index.md` Quality Check + guidelines
   - `prd.md` (acceptance criteria), `design.md` if present, `implement.md` if present
2. **Run tooling.** Lint, type-check, and tests relevant to the changed packages.
3. **Auto-fix findings directly.** Do not just report; fix what you can and re-run.
4. **Cross-layer consistency.** When changes span layers or packages, check each
   affected package's spec Quality Check, not just the latest chunk.

## Final full-scope pass

Before the commit step, run a last check over all affected packages — this catches
multi-package issues a mid-iteration local check misses.

## Guardrails

- Green tooling is necessary but not sufficient: the change must also satisfy the
  task's acceptance criteria and the spec.
- If a check reveals a `prd.md` defect, return to Phase 1, fix the artifact, and
  re-implement — do not paper over it.
- Do not report completion until checks pass and acceptance criteria are met.
