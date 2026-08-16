---
name: trellis-brainstorm
description: "Guides collaborative requirements discovery before implementation: clarify scope one question at a time, research the codebase first, and converge on planning artifacts (prd.md, plus design.md/implement.md for complex tasks)."
---

# Trellis Brainstorm

A request to build, implement, or "go ahead" is not approval to leave planning —
and task-creation consent is not implementation approval. For every non-trivial
task, the user must respond at least once after the initial request before
implementation begins. If no clarification is needed, that response must approve
the final planning summary described below.

## Non-Negotiable Evidence Rule

If a question can be answered by exploring the codebase, explore instead of asking.
Before asking the user, check whether the answer already exists in code, tests,
configs, docs, spec files, or task history. Ask only for product intent,
preference, scope, risk tolerance, or acceptance behavior that remains genuinely
ambiguous after inspection.

## Planning Flow

1. Capture the request and known facts into `prd.md`.
2. Inspect evidence before asking: code, tests, fixtures, configs, README/docs,
   existing specs, related tasks, research files, session history.
3. Split findings into: confirmed facts; product intent still needed; scope/risk
   decisions still needed; likely out-of-scope items.
4. If a user-owned decision remains: ask the single highest-value question with a
   recommendation and the trade-off; then **stop**. Do no implementation this turn.
5. After each answer, update `prd.md`, recompute the decision inventory, repeat.
6. When no user-owned decision remains, write `design.md` + `implement.md` for
   complex tasks (lightweight tasks may be PRD-only).
7. Run the requirement-convergence gate, then the PRD convergence pass.
8. Present the final planning summary and **stop**. Do not run `start`.
9. Only a subsequent user message explicitly approving the latest summary
   authorizes `start` and implementation. If artifacts change materially after
   approval, repeat the final review.

## Question Rules

- Ask **one** question per message.
- Each question includes: the decision needed, why it matters, your recommended
  answer, the trade-off if chosen differently.
- Do not ask process questions ("should I search?"). Do the evidence work directly.
- Recommendations are not default selections. Do not pick a product decision on the
  user's behalf merely because they asked to build.

## Artifact Rules

- `prd.md`: goal + user value, confirmed facts, requirements, acceptance criteria,
  out of scope, blocking open questions.
- `design.md`: architecture/boundaries, data flow + contracts, compatibility, key
  trade-offs, rollback. Complex tasks only.
- `implement.md`: ordered checklist, validation commands, risky files/rollback
  points, follow-up before `start`. Complex tasks only.
- Complex tasks must have `prd.md`, `design.md`, `implement.md` before `start`.
  Lightweight tasks may be PRD-only.

## Requirement Convergence Gate

Before final review, verify:
- user outcome + product value explicit
- in-scope and out-of-scope explicit
- acceptance criteria describe observable outcomes
- user-owned product/scope/UX/compatibility/risk decisions resolved
- blocking open questions empty
- technical unknowns researched or explicitly deferred without changing MVP behavior

## PRD Convergence Pass

Before declaring ready, rewrite `prd.md` against the final structure, losslessly:
fold temporary sections into canonical sections, remove resolved questions, merge
parallel lists that describe the same work, preserve every file:line anchor,
decision, constraint, requirement id, and acceptance mapping.

## Non-Negotiable Planning Contract

For every non-trivial task the user must respond at least once after the initial
request before implementation begins. While any user-owned product/scope/UX/
compatibility/risk/acceptance decision remains unresolved, end the turn with
exactly one highest-value question. Do not edit product code, dispatch
implementation, or run `start`.

## Quality Bar

Before declaring planning ready: testable acceptance criteria; no unresolved
temporary sections; no duplicate facts; blocking questions empty; complex tasks
have design+implement; and the latest final summary was **explicitly approved** by
the user in a subsequent message.

Do not start implementation merely because the user originally asked to build.
