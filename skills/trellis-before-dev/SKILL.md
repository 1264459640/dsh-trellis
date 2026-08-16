---
name: trellis-before-dev
description: "Before editing code during an implementation phase, read the project spec and the task's planning artifacts so the changes follow established conventions and requirements."
---

# Trellis Before Dev

Load this skill at the start of implementation (Phase 2) to ground edits in the
project's spec and the active task's reviewed artifacts.

## Steps

1. **Read project spec.** Load each package/layer's spec index that this task
   touches (`.trellis/spec/<package>/<layer>/index.md` and the guideline files it
   points to). This is where conventions, error-handling rules, and architecture
   notes live.
2. **Read task artifacts**, in this order:
   - `prd.md` — requirements and acceptance criteria.
   - `design.md` if present — boundaries, data flow, contracts.
   - `implement.md` if present — ordered checklist and validation commands.
3. **Read research** under `<task>/research/` for material the task gathered.
4. Implement the reviewed artifacts, not remembered habits.

## Guardrails

- Follow the spec's Pre-Development checklist before first edit.
- Conventions are read from the spec, not recalled; if a rule you expected is
  absent, prefer the project's existing patterns over your own defaults.
- Stop and surface a spec gap (rather than silently diverging) if the reviewed
  artifacts contradict the actual code.
