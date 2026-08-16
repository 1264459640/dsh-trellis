---
name: trellis-break-loop
description: "Break a repeated-debugging loop: classify the true root cause, explain why earlier fixes failed, and propose prevention. Use when the same issue has been fixed multiple times."
---

# Trellis Break Loop

Use this skill when a debugging cycle repeats — the same issue fixed twice or more,
or an issue that keeps resurfacing after "fixes".

## Steps

1. **Classify the root cause.** Be precise about the actual mechanism, not the
   symptom. Reproduce if possible.
2. **Why did earlier fixes fail?** For each prior attempt, state the mechanism it
   addressed and why it did not address the real cause (wrong layer, wrong timing,
   partial state, masking, etc.).
3. **Propose prevention.** Recommend the durable fix and, when warranted, a spec
   note so the class of issue does not recur.
4. Persist the lesson to the task `research/` (and spec per trellis-update-spec).

## Guardrails

- Stop patching symptoms; each iteration must target a refined root-cause model.
- If you cannot reproduce, say so and gather the missing evidence instead of
  guessing another fix.
- Capture the lesson in files — conversations get compacted, files do not.
