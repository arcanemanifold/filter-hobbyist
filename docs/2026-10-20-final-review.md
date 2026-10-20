# Final whole-branch review: build/v1 (5eb3fe9..9205bb7)

Reviewer: final whole-branch seat. Read-only. I did the review in three passes (math modules, UI module, tests and ledger) and did not use subagents.

What I checked:
- the spec, the plan, the ledger, and all 2032 lines of `filter-hobbyist.html` and the 7 test files
- ran `node --test`: 68 pass, 0 fail
- ran a scratch sweep of 842,400 default-cap solves (every passband × circuit × response × poles 1–10 × ripple × fc 1 Hz–1 MHz × cap/res series × seed 1k–100k × Q): no non-finite parts and no LP/HP refusals
- ran targeted probes, and compared screenshots 12 (case 7) and 19 (case 8)

## Strengths

- **Golden cases are covered and they pass.** Resistor solving matches all ten cases at 3 significant figures (`tests/solve-lp.test.js:26-91`). Gain at the 10 kHz cursor matches to 0.01 dB (`tests/response.test.js:62-98`), and phase to 0.1°. The spec's key trick is implemented and documented at `filter-hobbyist.html:640-641`: R3 is recomputed from the *rounded* R2.
- **One netlist table drives everything.** The response engine (`:894-982`) is a small nodal solver over named netlists. The schematic slot tables (`:1437, 1453, 1483`) and the help text (`:1766-1780`) use the same part names. So the solver, the response, the drawing and the grid agree by construction. I checked every slot mapping against its netlist (LP, HP, BP, notch, real, SK and MFB) and they all match.
- **The math is readable.** Every solver states its topology, H(s), the derivation and the rounding order in comments. John can audit it against a textbook. The SK minimum-ratio closed form (`:647`) is correct: I re-derived it from the discriminant.
- **The defaults are robust.** Default caps never refuse for LP or HP anywhere in the sweep. The 1 µF ceiling slides the centre instead of failing at low fc.
- **State handling is defensive.** The hash/storage precedence is right. Normalize falls back field by field and guards against `__proto__` keys. `replaceState` avoids history spam. The "only commit if the text was edited" guard (`:1957-1969`) protects typed full-precision values from being overwritten by the rounded display.
- **Offline is clean.** There are no URLs, fetches, external fonts or libraries. The only `http://` is the SVG `xmlns` inside a data URI, which never makes a request.
- **Ideal normalizations check out (Exact series).** Butterworth and Bessel are −3.01 dB at fc. Chebyshev odd orders are −ripple at fc. Even orders are 0 dB at fc relative to DC.

## Issues

### Critical

None.

### Important

**I1. A typed MFB high-pass gain is not honored, and nothing says so.** `filter-hobbyist.html:751`, `:754`
- **What's wrong:** gain is C1/C3 with both caps on the cap series, so the realized gain lands well off the typed one. With E12 caps, typed 2 gives 1.829, 3 gives 3.191 and 5 gives 4.545 (up to 9%, about 0.8 dB). Worse, if C3 is also entered, the typed gain is ignored entirely: gain 2 plus C3 = 10n gives 1.500. The grid still shows "2" in the Gain cell and no message appears.
- **Why it matters:** this conflicts with the anti-goal "never quietly changed" (the entry is kept but not obeyed), and it is a real passband error in a part John specified. The table's Passband Gain column does show 1.83, but nothing flags that it differs from the entry.
- **Fix (pick one):**
  - (a) When C3 is entered (or C1 and C3 are both entered) and a gain is also typed, refuse with "Gain is set by C1/C3 when C3 is entered; clear one."
  - (b) For defaults, search the neighbouring series values of C1 (= C2) and C3 for the pair whose ratio is closest to G. This is a few lines, in the same style as `defaultCapPair`.
  - (c) Also mark the Passband Gain cell when it differs from the entry by more than about 1%.
- **Note:** the ledger deferred this as a Task 6 minor. I'm promoting it to Important because it is the one place where the tool overrides a typed entry without saying so.

**I2. Some refusals in the main design loop don't state the bound or say which stage caused them.** `filter-hobbyist.html:540-542` (with `:499`) and `:1900-1901`
- **Derived cap over the limit:** when a cap *derived* from an entered one (or the default C3 at low fn with G < 1) goes over 1 µF, the message is the generic "Capacitors are not supported above 1uF." The user typed nothing above 1 µF. The spec, Math item 6, requires the refusal to state the bound.
- **No stage named:** when a dropdown, Poles or fc change is refused because a kept override on another row became unrealizable, the message ("C2 must be ≥ 68n for Q = 1.31 at gain 1") doesn't name the section. The dropdown then snaps back.
- **Why it matters:** the "override caps, then explore Filter Type, Poles and ripple" loop is the reason the tool exists (spec Intent). Unexplained refusals there will feel like the app is broken.
- **Fix, two small edits:**
  - In `commit()`, prefix `failed.error` with `` `Section ${failed.stage.label}: ` `` (or "Real pole: ").
  - In `stage()`, when a *computed* cap passes 1 µF, say which part and what was entered. For example: "C2 would need 1.5u (above the 1uF limit) for C1 = 100n; enter C1 ≤ 68n or clear it."
- **Note:** the ledger deferred both halves as minors (T4 and T9). Spec Math item 6 makes them a requirement.

### Minor

1. `:1607` **Gain-axis top doesn't match FilterPro for small gains.** Screenshot 12 shows a +6 dB passband with a +10 dB axis top; ours gives +20 dB. Screenshot 19 shows +40 dB → +50 dB, which ours matches. FilterPro looks like floor((g+10)/10)·10 with a small tolerance. This is cosmetic.
2. `:1948` vs `:821` **Band-Pass Q = 0.5 can be typed but is never solvable.** The default gain equals Q, and the bound is 2Q² = 0.5. The refusal then talks about a gain the user never typed. Either raise the field minimum a little above 0.5 or word the refusal around Q.
3. `:1169-1201` with `:1925` **A passband change keeps cap overrides whose physical meaning changes,** and drops rows that disappear without a notice. For example, LP C1 (feedback) becomes HP C1 (input), and switching to Notch drops rows B–E. This is plan-sanctioned (Review Focus 2), but it sits near the anti-goal. Consider clearing overrides on a passband change, with a notice in the help box.
4. `:253` **parseEng refuses a leading-dot entry** like `.47u`. It is refused with a reason (not silent), but it's a common way to type values.
5. `:710` **Unity-gain SK returns an R3 that isn't in the circuit.** It's harmless today; it will confuse any future parts list.
6. **Task 12 step 2 was not run as the plan wrote it.** The check was done over local http in an 800 px pane, not from `file://` with the network off. localStorage on `file://` (Chrome shares one origin; Safari differs) and the `replaceState` fallback path (`:1574`) are untested. John should open the file once by double-click in Safari and in Chrome and reload.

### Triage of the ledger's "minor (deferred)" lines

**Fix before merge:**
- **T6, MFB HP gain lands off with cap rounding:** promoted, see I1.
- **T4, cap-limit message unhelpful when an entered cap forces its partner above 1uF:** see I2.
- **T6, MFB HP low fn & G<1 refused with a cap-limit message:** see I2.
- **T9, trial-solve refusal doesn't name the stage:** see I2.
- **T1, 'G' prefix broken:** cheap and recommended. `parseEng('1G')` is NaN because `toLowerCase` gives 'g'. The GBW field (`:2007`) then refuses "1G" with the wrong reason ("must be above 0"). It is a one-character fix at `:258`: keep `G` like `M`.

**Fine to defer:**
- **T1:** `10f` parses as 10 (caught by the 1 µF refusal), unknown-series passthrough (inputs are normalized), missing tests for `4.7`/`1e-9`, and formatEng at ≥1T.
- **T2:** all.
- **T3:** all (normalize clamps the order).
- **T4:** MFB G ≤ 0 (unreachable), the defaultCapPair naming, and the SK root (waits on check 5).
- **T5:** all.
- **T6:**
  - The BP G ≤ 0 message, the notch re-running equalCaps, the naming, and the refusal-path tests.
  - Notch depth limited by rounding: −23.7 dB at E96. Surface it to John with check 4. R5 = round(R4·gBP) would only partly help.
- **T7:** all.
- **T8:** all.
- **T9:**
  - "An existing broken stage blocks unrelated changes" can only happen from a loaded hash, and the table shows the error.
  - The stale refusal after hashchange is a one-line fix (`refusalShowing = false` in the handler); worth doing but not blocking.
  - Retyping the displayed text is by design.
- **T10:** all. "+380°" copies FilterPro exactly; screenshots 12 and 19 confirm it.
- **T11:** all. A DOM smoke test is a good follow-up (see Recommendations).

### Rulings checked against the spec

Most rulings are consistent with the spec or with the FilterPro screenshots. Three need John's explicit sign-off, because they depart from the spec's literal text:

1. **Case 7 per-stage gain** (A = −34.01 dB, where the spec table says −40.01). The spec says gain-at-cursor "must match exactly". Even so, screenshot 19 (case 8) shows FilterPro *does* put a stage's gain in its own row: A at gain 10 reads −20.04 dB. That supports the ruling that the case-7 row shift is a FilterPro quirk. The Totals match (−73.88). I agree with the ruling, but the spec's case-7 row needs amending. The test at `tests/response.test.js:82` documents the deviation well.
2. **"Sections" instead of "Poles"** for Band-Pass. The spec Layout says "Poles". This is a one-label change and John's call.
3. **Totals Q left blank.** Screenshots 12 and 19 show FilterPro fills it in (707.11m, 1.0000). The spec is silent. It is fine to defer, but this ruling isn't neutral: the value is visible in the original.

The remaining rulings are fine:
- the Chebyshev reference at DC (pending check 1)
- the ripple clamp (the UI refuses with the bound, so nothing is silently clamped)
- the SK closed form (verified)
- the 1 µF default ceiling
- the SK gain < 1 refusal
- the table phase convention (matches the −169.4° in screenshot 12)
- the GBW thresholds
- the notch/BP/SK HP provisional choices
- refusing settings changes that break a kept entry (consistent with spec Math item 6; the messages need I2)
- deferring Task 12 step 1 to John

## Declined to judge

- **FilterPro's unrecovered default-cap rule** (case 1's default C2 is 47n vs FilterPro's 68n). The spec explicitly allows the difference.
- **The HP/BP/notch topologies, the SK unity-root pick, Chebyshev/Bessel references and the HP GBP rule.** All are provisional by spec, waiting on checks 1–5.
- **The SK Required GBP formula** (206·G·Q^1.5·Fn). It is the spec's own fitted formula.
- **Group-delay accuracy** near the notch null (a central-difference spike). It is display-only and already noted.
- **Pixel layout and clipping.** I didn't render the page. The controller verified it in the pane, with screenshots in the ledger.
- **Rounding sensitivity at high Q.** A 10-pole Chebyshev with 3 dB ripple is −1.81 dB at fc with E96/E12 parts and 0.00 dB with Exact. That is real component sensitivity, which FilterPro shows too, not a bug.

## Recommendations

- **Add one tiny DOM smoke test.** Node has no DOM, so a `tests/ui-smoke.html` that John opens by hand would do: it loads the page in an iframe, sets three hashes and asserts that no stage shows "see message". This guards the drawings ↔ NETLISTS coupling, which nothing tests today.
- **When John supplies the five FilterPro checks,** add each one as a golden test next to cases 1–10. The provisional constants (`CHEBY_NORM`, `BP_CAP_FACTOR`, the notch R6 and the SK root) are each in one place, so the follow-up is cheap.
- **Maintainability is good for the owner.** Each module is one IIFE with a header comment, there is no framework, and the heaviest code (nodal analysis) is about 50 lines with its equations written out. The UI block (about 770 lines) is the least approachable part. It is still linear and commented.

## Assessment

**Ready to merge? With fixes.**

**Reasoning:** The filter math, golden-case matching, cross-module naming and offline constraint are solid and well tested. Two small fixes are needed before the tool meets its own anti-goal and spec Math item 6 in John's core design loop: I1 (the MFB HP gain entry isn't honored) and I2 (refusals without a stage or bound). Each is a few lines. The 'G'-prefix one-liner should go in with them.
