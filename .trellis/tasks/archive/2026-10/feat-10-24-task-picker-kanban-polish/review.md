# Code Review
status: passed

Scope: `git diff -- lib/client.js .trellis/spec` + untracked `test/client-polish.test.js`. Behavior-level review; no source/test edits made.

## Findings

1. **should-fix — chip focus test harness can hide real failures (false green on the negative case).** `test/client-polish.test.js:249,259,268,278` run every collected effect inside `try { fn() } catch {}`. The intent is to swallow the `fetch` ReferenceError from `load()`, but it swallows *any* throw, including one from the new focus effect (`lib/client.js:2836-2841`). The positive tests (`242`, `253`) would still fail on a throw because `log` would be empty. But **`focus is not stolen…` (`263-270`) asserts `log == []`**, so a crashing focus effect passes it. The harness also maps `useState`/`useRef` by position (`216-219`, `245`: `[, chipRef, popRef]`), so adding a hook before them silently re-targets the stubs. Fix: stub `fetch` in `globals` (for example `fetch: () => new Promise(() => {})`) and drop the blanket catch, or rethrow anything that isn't a `fetch` ReferenceError. Optionally look refs up by identity (`chip.props.ref`, the popover node's `ref`) instead of by index. The test at `297` already does this for the chip.

2. **should-fix — the completed-row progress fill in the table isn't covered.** `test/client-polish.test.js:56-69` renders a single archived task with the done group folded. Only the details-pane bar renders (`lib/client.js:2301`, `done: archived`). The table-row path (`lib/client.js:2510`, `ProgressBar … done`) is never exercised; the comment at line 62 says as much. A regression that put `TB.color.success` back on table rows would pass. Fix: render with a non-empty search query, or `doneOpen: true` via a `useState` override (spec 35 stub rule: `init` first). Then assert that the fill inside the `tw-tr` row for `p-done` is `doneFill`.

3. **should-fix — the new header labels and segment labels aren't in the contrast matrix.** `test/client-theme.test.js:97-103` `readable()` doesn't match `任务/类型/阶段/进度/步骤` or the segmented tab labels, so PRD criterion 8 isn't actually asserted for the new sticky header (`lib/client.js:2589-2620`) or the `surfaceRaised`-on-`well` pressed segment. design.md §6 says the matrix should cover the new header. I computed these with the same `textColors`/`contrast` helpers. Header: fallback 7.19, light 6.10, dark 9.30. Pressed "全部": 17.85 / 18.90 / 15.03. Badge "功能" lowest at light 4.78. So it passes today, but nothing locks it in. Fix: add the five `colHead*` zh values and the tab labels to `readable()`.

4. **should-fix — the keyboard selection in the focusable lists isn't announced, and the focus ring is weak.** The modal list (`lib/client.js:2580-2587`) and the popover list (`1867-1872`, already this way before) are `role="list"` with `tabIndex=0`. ↑↓ changes `aria-pressed` / `data-selected` on rows that are `tabIndex=-1` (`2475`). No `aria-activedescendant` and no roving focus, so a screen reader announces nothing when the selection moves. Children are `aria-hidden` header div + group divs + buttons, no `listitem`, so the list semantics are hollow too. Losing per-row Tab stops is acceptable on its own: it matches the popover pattern, the list is a single Tab stop, and folded rows become reachable after the toggle button expands them. It does need a programmatic-focus equivalent, though. Fix: give rows `id`s and set `aria-activedescendant={rowId(selected)}` on the list, or move focus to the row (roving tabindex). Second issue: `.tw-list:focus-visible` (`lib/client.js:1058`) is a 1px inset ring at brand 40% alpha. That is likely under 3:1 non-text contrast (WCAG 2.4.11), and in the modal the opaque sticky header (`2600`) covers its top edge. Use the same `outline: 2px solid brand; outline-offset: -2px` as `.tw-focus` instead.

5. **nit — Escape returns focus to the chip even when focus is outside the popover.** `lib/client.js:2817-2821`: if the user tabbed out of the open popover (say, to the composer) and presses Esc, focus jumps to the chip. Fix: call `chipRef.current.focus()` only when `popRef.current && popRef.current.contains(document.activeElement)`. Otherwise just close.

6. **nit — the focus effect re-runs on every board refresh** (`[open, board]`, `lib/client.js:2841`). It's guarded by `contains(activeElement)`, so it never steals focus from inside the popover. After a ▶ click in browsers that don't focus clicked buttons (Safari), focus moves to the list. That's benign (it stays inside the popover). No change required; worth a comment.

7. **nit — out-of-region edit.** `chipPhaseColor` was deleted from the `trellis-task-chip.js` region (`lib/client.js` was about line 730, outside the kanban region the task scoped). It was dead after the switch to `phaseDotColor` (`2883`), so the removal is correct. Record it in the task notes. Side effect: the planning chip ring is now `textMuted` (a tertiary/primary mix) rather than raw `label-tertiary`. Slightly darker, intended.

8. **nit — design measurement drift.** Popover rows are 6+18+2+16+6 = 48px, not the 44 in design.md §3 (`lib/client.js:1714-1716`). Chevron `.2s` and progress `width .25s` aren't 120ms (design §5). Either adjust or note in the design.

9. **nit — the regex at `test/client-polish.test.js:72` is convoluted.** The first alternative is dead weight; `/\.tw-live[^}]*infinite/` alone expresses the intent. The `scale(` check at `83` covers the whole TW_CSS. Fine.

10. **nit — spec wording.** Item 31 (`.trellis/spec/trellis-workflow/web-ui/index.md:253`) still lists 「呼吸光晕」 among the injected interaction states. Item 26 has a correction note; item 31 should say 「入场脉冲」 to match. Item 19's 「100% 满格鲜绿进度」 is already superseded by its correction note and the new 26 note, so no change needed there.

No regressions found:
- Row action contract unchanged: one ▶ per row, select→activate, stopPropagation, busy. Covered by the existing `client-theme.test.js:164-219`, which passes.
- Card unbind keeps stopPropagation and busy (`lib/client.js:1648-1659`).
- Done-group fold and search force-expand unchanged (`2408`). `visibleSlugs` (`2447-2449`) applies the same `doneExpanded` and filter, so ↑↓ only walks visible rows.
- `pushPromptFor` still formats host `task.activeStep` (`2052-2054`). Both CTAs call it (`1647`, `2213`).
- Portal is unchanged: modal-only, popover stays anchored (`1934-1939`).
- TaskChip hooks: two `useRef` and one `useEffect` were added unconditionally, before the early `return null` (`2855`). The order is stable.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Only the 4 `TB.T` font sizes; no half-pixel literals | Met | `lib/client.js:963` `T`. Region grep finds no `fontSize: <n>`; the only `font:` shorthands use `TB.T` (`1258`, `2506`). `client-polish.test.js:37-52` (source + rendered tree) |
| 2 | ≤5 `TB.R` radii; softer popover/modal shadows | Met | `lib/client.js:965` (5 keys), `966-971` (hairline + two light drop shadows); test `30-35` |
| 3 | No nested sub-card in the current card | Met | `lib/client.js:1559-1612` (`data-step-section` has no bg/shadow/radius; two `data-divider`s); test `96-106` |
| 4 | Desaturated state dots/icons; neutral done progress | Met | `942-946`; used at `985`, `1147`, `1173`, `1299`, `1390-1393`, `2869`. Text still uses `*Text` (`1169`, `1523`). Test `56-69`, but the table-row path is untested (finding 2) |
| 5 | Static halo for the bound task; entry animation is fade + small offset | Met | `Dot` `1103-1121`; CSS `1066-1078` (`1` iteration, no `scale`); reduced-motion `1083-1086`; test `71-84` |
| 6 | Table header (task/type/stage/progress/steps), zh+en | Met | `2589-2620` sharing `GRID_COLUMNS` (`2446`); locales `169-173`, `268-272`; tests `125-148` |
| 7 | Popover focus in; Esc returns focus to chip; ↑↓ in the modal | Met (a11y caveat, finding 4) | `2834-2841`, `2817-2821`, `2450-2460`; tests `176-208`, `242-289` |
| 8 | Contrast ≥4.5:1 in light/dark/fallback; `npm test` green | Met | 221/221 pass. New header/segment text checked manually (finding 3: not in the automated matrix) |
| 9 | User accepts the look in the real GUI | Pending (human step) | `preview.png` is an offline headless-Edge render only. It shows the header, single card, segmented control and neutral done bar in light and dark; the sticky header in dark matches the surface |

## Verification

- `npm test`: tests 221, pass 221, fail 0, cancelled 0, skipped 0 (about 3.9s).
- Ad-hoc contrast probe for the expanded board, using the `client-theme.test.js` helpers over `renderViews(...).board`:
  - fallback: header 7.19, pressed tab 17.85, type badges ≥ 6.23, slug ≥ 5.91.
  - light: header 6.10, pressed tab 18.90, type badges ≥ 4.78, slug ≥ 5.03.
  - dark: header 9.30, pressed tab 15.03, type badges ≥ 10.42, slug 9.30.
  - Temporary script deleted afterwards.
- Greps: no `fontSize: <digit>` / `borderRadius: <digit>` in the kanban region. `*Soft` / `doneFill` appear only on icons, dots, rings and fills, never on `color` of text.
- `node scripts/verify-modal-browser.mjs`: not run (`DSH_BROWSER_TEST_TOOLS` unset). `color-mix()` desaturation in a real browser is confirmed only by the offline `preview.png`, not in the user's GUI.

## Fix-ups after review (lead)
- should-fix effects swallowed: chip harness now stubs `fetch`/`window`; the try/catch is gone, so a throwing effect fails the test.
- should-fix done bar coverage: the test now renders the expanded done group and asserts the neutral `doneFill` in both the table row and the details pane, plus `successSoft` on the dot.
- should-fix contrast coverage: the header and segment labels are now in `readable()`, with an assertion that the board view actually yields them.
- should-fix a11y: the list sets `aria-activedescendant` to the selected row's unique `id` and omits it when that row is not visible. The list focus ring is now a 2px solid brand ring.
- nits: Esc refocuses the chip only when focus is inside the popover; the header is hidden when only the folded done group remains; popover row padding is down to 4px (~44px rows); the source scan starts at the `#region` marker; the outside-click test uses a real root ref; spec item 31's wording is fixed.
- Mutation check: 15/15 mutants killed (10 original + 5 for the fixes).
- `npm test`: 222/222 pass.

## trellis-check（提交前全量验证）
| 维度 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check lib/client.js`、`node --check test/client-polish.test.js` | 0 error |
| 类型检查 | 无 TS 构建脚本（`lib/types/index.d.ts` 为宿主声明），本任务未改类型面 | n/a |
| Lint | 仓库无 lint 脚本 | n/a |
| 测试有效性 | 15 个 mutation（无限脉冲／绿色 done 条／嵌套子卡／去掉 Esc 还焦／去掉打开聚焦／折叠行可导航／表头列漂移／半像素字号／scale 动画／chip 无描边／无 activedescendant／row id 缺失／Esc 忽略 inside／折叠时仍出表头／行内绿色 done） | 15/15 killed（无假绿灯） |
| 单测／集成 | `npm test` | tests 222, pass 222, fail 0 |
| PRD 验收 1–8 | 见上表 + 修复后覆盖 | 全部满足 |
| PRD 验收 9（GUI） | 用户重启 DSH 后验收 | 用户确认通过（2026-10-24） |
| 规范门禁 | `.trellis/spec/trellis-workflow/web-ui/index.md` 第 11/12/13/17/22–31/35 条 + 新增 20a–20f | 符合；第 26/31 条已按新行为更正 |
| 越界检查 | kanban region 内 `fontSize: <n>` = 0、`borderRadius: <n>` = 0；无 `--dsw-alias-bg-layer-0` | 通过 |

结论：全绿，可提交。
