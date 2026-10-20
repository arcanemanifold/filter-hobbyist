# Build rulings (decisions made during the v1 build)

Each line gives what was decided, why, and what it costs if it's wrong. Recorded 2026-10-20.

- Ruling: Task 1 step 1 (git init + .gitignore) skipped — the controller already did it in setup (main@5eb3fe9, branch build/v1) — costs nothing if wrong.
- Ruling: test command is `node --test` (Node 25 treats `node --test tests/` as a module path) — carried into every later dispatch — costs nothing if wrong.
- Ruling: Task 2 Chebyshev check at ω=1 is −1.000 dB for odd orders and 0 dB (relative to unity-DC stages) for even orders — the plan's blanket −1 dB was wrong for even orders (DC sits in a ripple valley); this ties into spec check 1 (gain reference) — if wrong, only the test expectation changes.
- Ruling: Chebyshev rippleDb must stay in [0.01, 3] dB — Task 7 normalize clamps it (rippleDb=0 gives NaN poles) — costs a clamp if wrong.
- Ruling: stages stay unity-DC; even-order Chebyshev therefore peaks +ripple above DC; Passband Gain is referenced to DC until spec check 1 says otherwise — cost: a constant gain offset if FilterPro references the peak.
- Ruling: Task 4 SK min ratio via closed form 1/(1/(4Q²)+K−1) instead of bisection — equivalent, simpler — cost: none if it matches bisection (reviewer to check).
- Ruling: Task 4 refusal messages show Q with toFixed(2) for both MFB and SK — the brief's raw ${q} would print 16 digits — cost: cosmetic.
- Ruling: Task 4 default caps capped at 1uF (resistors scale up instead) so very low fc doesn't refuse every default design; entered caps are never altered — cost: low-fc defaults may give big resistors.
- Ruling: Task 4 adds refusal "Sallen-Key gain must be ≥ 1" — SK can't do gain below 1 — cost: none.
- Ruling: table phase omits MFB inversion (raw H is 180° off FilterPro's displayed values; matching FilterPro's table) — stageH keeps true H — cost: phase column convention if John prefers raw.
- Ruling: case 7 per-stage gain shows A = −34.01 dB (its own gain 1.996 included), not FilterPro's −40.01; FilterPro appears to show the gain on row B (B −33.87); totals match (−73.88) — physically correct beats copying a display quirk — cost: one row differs from FilterPro in gain>1 designs.
- Ruling: GBW overlay test thresholds are >0.05 dB at 1 MHz and >0.1 dB at 300 kHz (plan's 0.1 dB at 1 MHz was physically wrong; finite GBW raises SK peaking) — cost: none.
- Ruling: Task 6 notch gain via summer feedback R6 = round(G·seed); inputs round(seed) — provisional until spec check 4 — cost: notch topology rework.
- Ruling: Task 6 BP cap naming C1 = feedback, C2 = to inverting input — Task 11 schematic must use it — cost: label swap.
- Ruling: Task 6 SK HP rounds R1 first (mirrors SK LP); HP GBP reuses LP rules — unverified vs FilterPro (check 3) — cost: small part/GBP differences.
- Ruling: BP count field labelled "Sections" instead of FilterPro's "Poles" (4 = 4 sections = 8 poles) — clearer for the owner — cost: one label edit if John wants FilterPro's wording.
- Ruling: a settings change (incl. dropdowns) that would make a kept entry unrealizable is refused with the reason, rather than applied with a broken stage — consistent with "never silently change" — cost: John may find mode switches blocked by a leftover cap entry; alternative is to apply and mark the row red.
- Ruling: gain cells display plain numbers ("0.5") and refuse with "Enter a gain like 2 or 1.5"; Passband Gain shows 3 sig figs ("1.00") — cost: cosmetic.
- Ruling: Totals Q blank in all modes (controller, at dispatch) — cost: FilterPro showed a Totals Q; can add later.
- Ruling: Task 10 GBW visibility check moved to fc 20–30 kHz (at 1 kHz with 1 MHz GBW the effect is ~0.04 dB, physically correct) — cost: none.
- Ruling: Task 12 step 1 (five FilterPro screenshot checks) deferred to John at finish — needs his CrossOver time; provisional choices stay behind their constants — cost: Chebyshev norm/gain ref, Bessel norm, HP/notch parts, SK unity root may change after checks.
- Ruling: I1 fix = refuse when entered C1/C3 conflict with a typed gain (message states the realised C1/C3 ratio); defaults pick the series C3 closest to C1/G; when realised gain differs from typed by >1%, mark the Passband Gain cell and say so in help — keeps "never silently changed" — cost: extra UI marker.
- Ruling: final fix — MFB HP C3 entered alone (C1 default) is not refused; deviation is marked with "*" instead — cost: John may want a refusal there.
- Ruling: final fix — default caps slide to keep partner caps ≤ 1u (MFB HP G<1 low fn; computed partner settles for 1u when ratio still met) — defaults only, entries untouched — cost: low-fc defaults differ.
- Final fix: parked (minor) — MFB HP with only C2 entered names C1 in the C3-over-1u refusal — Ruling: bound still stated; wording fix later.
- Final fix: parked (minor) — stage prefix also on the stage's own cell refusals — Ruling: harmless.
