---
name: trellis-spec-bootstrap
description: "Seed or extend a project spec: analyze the repository, structure spec by package/layer, and plan tasks. Use on a new project or an existing project without Trellis spec."
---

# Trellis Spec Bootstrap

Use this skill to establish or grow the `.trellis/spec/` structure that the
workflow's before-dev/check/update-spec skills rely on.

## Steps

1. **Analyze the repository.** Identify packages, layers, and hot spots: entry
   points, error handling, conventions already in code, READMEs, existing docs.
2. **Establish the structure.**
   - `.trellis/spec/<package>/<layer>/index.md` — entry point carrying a
     **Pre-Development Checklist** and **Quality Check**; body guidelines live in
     sibling `.md` files it points to (e.g. `error-handling.md`, `conventions.md`).
   - `.trellis/spec/guides/index.md` — cross-package thinking guides.
3. **Seed minimal, honest rules.** Start from what the repository already does; let
   conventions accumulate as tasks surface them (see trellis-update-spec).
4. **Plan tasks** against the new structure so the workflow has a target.

## Guardrails

- Do not invent a product/spec hierarchy the repository does not have; mirror the
  actual code layout.
- Specs are living files: seed the skeleton, then refine through real tasks.
- Record decisions about structure so future edits stay consistent.
