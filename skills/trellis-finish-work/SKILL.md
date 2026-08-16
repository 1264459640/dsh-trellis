---
name: trellis-finish-work
description: "Wrap up an archived or completed Trellis task: confirm the working tree is clean, run any remaining bookkeeping, and record the session."
---

# Trellis Finish Work

Run this skill to finish a task that has been archived or reported completed.

## Steps

1. **Confirm commit state.** If the working tree is dirty, return to the commit
   step and land the work commits first — never interleave bookkeeping commits
   with work commits.
2. **Run the commit flow** (work commits → archive commit → journal commit) if it
   has not already happened. Do not `git push` unless the user asks.
3. **Record the session.** Append a journal entry and update the personal index so
   cross-session tracking stays continuous.
4. **Wrap up.** Tell the user the task is closed and where the session record lives.

## Guardrails

- Never `git commit --amend`.
- Work commits first, then bookkeeping — in order.
- If the user commits by hand instead, skip to wrap-up once they confirm; do not
  present a second commit plan after a rejection.
