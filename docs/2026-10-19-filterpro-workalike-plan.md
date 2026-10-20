# Filter Hobbyist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single offline HTML file that reproduces FilterPro 2.0's layout and design loop for LP/HP/BP/Notch active filters (MFB and Sallen-Key; Butterworth, Bessel and Chebyshev).

**Architecture:**
- One file, `filter-hobbyist.html`. Logic lives in inline `<script data-module="NAME">` blocks, one per module, which attach to a shared `window.FH` namespace. The UI lives in a final `<script data-module="ui">` block.
- A Node test harness reads the HTML, runs every non-UI module block in a `node:vm` context, and exposes `FH` to `node:test` tests.
- No build step: the HTML is the source and the deliverable.
- Responses are evaluated by small complex nodal analysis per circuit, so the ideal curve and the finite-GBW overlay share one code path.

**Tech Stack:** HTML/CSS/vanilla JS (ES2020), inline SVG. Node 25 for tests (`node:test`, `node:assert/strict`, `node:vm`), nothing installed.

**Spec:** `docs/2026-10-19-filterpro-workalike-design.md`. Read it first; this plan argues from it.

## Global Constraints

- One HTML file, works from `file://`, no network, no external libraries/CDN, no build step, no package install.
- No TI branding or logo. App title: **Filter Hobbyist**.
- Entries are kept as typed or **refused with a reason that states the bound**; never silently changed. Caps > 1 µF are refused: "Capacitors are not supported above 1uF."
- Rounding to series = nearest value on a log scale. "Exact" keeps full precision and displays 3 significant figures.
- Resistor solving and gain-at-cursor must match the spec's golden cases exactly, at the displayed precision.
- Readable code over clever code. John maintains it.
- Defaults (my call, not in the spec): Low-Pass, MFB, **Chebyshev 1 dB**, 4 poles, 1.000 kHz, Res E96, Cap E12, R1 Seed 10k, cursor 10.00 kHz, gains blank (= 1), GBW overlay off.
- Part naming convention for **every** circuit's schematic, grid and help text (spec item 4):
  - **LP stages:** C1 = feedback cap, C2 = cap to ground.
  - **MFB HP:** C1 = input cap, C2 = series cap to the inverting input, C3 = feedback cap.
  - **SK HP:** C1 = input cap, C2 = second series cap.
  - Spec case 10 (FilterPro labels) maps to C1 (fb) = 10n, C2 (gnd) = 39n.
- Commits: the folder is not a git repo yet. Task 1 runs `git init`, with `.gitignore` covering `.superpowers/` and `FilterPro 2.0 Setup.exe`. Use a Claude co-author trailer only on code Claude wrote.

## Review Focus

1. **Partial or garbage entries** (`4.7`, `n`, `1e-9`, `4n7`, blank, `-10n`): blank clears the override. Unparseable or ≤ 0 is refused with "Enter a value like 4.7n or 4n7". Owner: Task 1 test `parseEng rejects garbage`, Task 9 test steps.
2. **Changing Poles or Passband while overrides are set:** overrides for rows that no longer exist are dropped, and the others are kept. Owner: Task 7 test `normalizeState drops overrides for missing rows`.
3. **Extreme frequencies** (fc 1 Hz or 1 MHz; cursor outside the plot range): solving still works, and the plot range follows fc. Owner: Task 4 test `solves at 1 Hz and 1 MHz`.
4. **A corrupted or old URL hash or localStorage** (truncated, wrong types, unknown keys): fall back field by field to the defaults, never a blank page. Owner: Task 7 test `decodeHash tolerates garbage`.
5. **Odd order with an overridden Real-row C1:** R is re-solved from the entered C, and the Real row is kept when the order changes between odd values. Owner: Task 4 test `real pole uses entered C1`.

---

### Task 1: Repo, file skeleton, test harness, units

**Files:**
- Create: `filter-hobbyist.html` (skeleton: `<!doctype html>`, `<title>Filter Hobbyist</title>`, empty `<div id="app">`, `<script>window.FH = {};</script>`, and the `units` module block)
- Create: `tests/harness.js`, `tests/units.test.js`, `.gitignore`

**Interfaces:**
- Produces:
  - `tests/harness.js` exports `loadFH(): object`. It reads `../filter-hobbyist.html`, runs every `<script>` without `data-module="ui"` in a single `vm` context with a `window` global, and returns `window.FH`.
  - `FH.units.parseEng(text: string): number | null`. Returns `null` when the text is blank, and `NaN` when it's invalid or ≤ 0.
  - `FH.units.formatEng(x: number, sig = 3): string`
  - `FH.units.SERIES: { E6, E12, E24, E96: number[] }` (mantissas 1.0–9.x)
  - `FH.units.roundToSeries(x: number, series: 'Exact'|'E6'|'E12'|'E24'|'E96'): number`
  - `FH.units.stepSeries(x: number, series: string, dir: 1 | -1): number`, which gives the next value up or down

- [ ] **Step 1:** `git init`; write `.gitignore`.
- [ ] **Step 2: Write failing tests** in `tests/units.test.js`:
  - `parseEng accepts engineering forms`:
    - `4.7n`→4.7e-9, `4n7`→4.7e-9, `4700p`→4.7e-9, `10k`→1e4, `10K`→1e4, `20000`→2e4, `2.2u`→2.2e-6, `2µ2`→2.2e-6, `1.5M`→1.5e6, `1m`→1e-3
    - trailing `F`, `Hz`, `Ω`, `ohm` are ignored
    - blank→null
  - `parseEng rejects garbage`: `n`, `4.7.1k`, `-10n`, `0`, `abc` → NaN.
  - `formatEng`: 4.7e-9→`4.70n`, 1.07e4→`10.7k`, 6.8e-10→`680p`, 1.02e5→`102k`, 1000 with sig 4→`1.000k`.
  - `roundToSeries`: 10612 E96→10700; 14125 E96→14000; 28354 E96→28700; 10304 E96→10200; 12776 E24→13000; 6373 E24→6200; 15.9e-9 E6→15e-9; 5.3e-9 E6→4.7e-9; Exact passes through.
  - `stepSeries`: 68e-9 E12 up→82e-9, down→56e-9; 82e-9 up→100e-9 (decade wrap).
- [ ] **Step 3:** `node --test tests/` → FAIL (`FH.units` undefined).
- [ ] **Step 4:** Implement the harness and the `units` module. E96 is the standard 96-value table. Log-nearest is `argmin |ln(x/v)|` over the candidates in the surrounding decades.
- [ ] **Step 5:** `node --test tests/` → all pass.
- [ ] **Step 6:** Commit.

### Task 2: Normalized prototypes

**Files:** Modify `filter-hobbyist.html` (add the `poles` block). Test `tests/poles.test.js`.

**Interfaces:**
- Produces: `FH.poles.prototype(response: 'butterworth'|'bessel'|'chebyshev', order: number, rippleDb: number): Array<{kind:'real', wn:number} | {kind:'pair', wn:number, q:number}>`.
  - Normalized to ωc = 1.
  - Chebyshev is normalized to the ripple-band edge. Keep this in one constant, `CHEBY_NORM = 'ripple-edge'`, so spec check 1 can flip it to `'3dB'`.
  - Bessel is normalized to true −3 dB at ω = 1 (spec check 2).
  - Real pole first, then pairs in ascending Q.

- [ ] **Step 1: Write failing tests** (tolerance 1e-3):
  - Butterworth 4 → pairs (1, 0.5412), (1, 1.3066).
  - Butterworth 5 → real 1, pairs Q 0.6180, 1.6180.
  - Chebyshev 4, 1 dB → (0.5286, 0.7845), (0.9932, 3.5590).
  - Chebyshev 5, 0.5 dB → real 0.3623, (0.6905, 1.1778), (1.0177, 4.5450).
  - Bessel 4 → (1.4302, 0.5219), (1.6034, 0.8055).
  - Bessel 3 → real 1.3227, (1.4476, 0.6910).
  - The product of all stage magnitudes at ω = 1 equals −3.010 dB for Butterworth and Bessel, and −1.000 dB for Chebyshev 1 dB.
  - Orders 1–10 return ⌈n/2⌉ stages.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement:
  - Butterworth and Chebyshev poles in closed form.
  - Bessel: the roots of the reverse Bessel polynomial, via a small Durand–Kerner complex root finder in the module, then scaled so |H(j1)| = 1/√2 by bisection.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 3: Stage targets per passband

**Files:** Modify HTML (add the `stages` block). Test `tests/stages.test.js`.

**Interfaces:**
- Consumes: `FH.poles.prototype`.
- Produces: `FH.stages.build(s: State): Stage[]`, where `Stage = { label: 'Real'|'A'|'B'|'C'|'D'|'E', role: 'lp'|'hp'|'bp'|'notch', kind: 'real'|'pair', fn: number, q: number|null, gain: number }`.
  - **LP:** fn = fc·wn.
  - **HP:** fn = fc/wn.
  - **BP:** `poles` = section count, each fn = fc with q = s.bpQ, and the default gain = q.
  - **Notch:** a single pair at fc with q = s.bpQ (default 10).
  - Gain comes from `s.entries[label].gain`, defaulting to 1 (BP: q).
  - At most 5 pair rows (A–E), as in FilterPro, so the LP/HP order is 1–10 (odd orders add the Real row). For BP, sections are 1–5.
  - `State` is the object defined in Task 7. This task reads `passband, response, poles, fc, rippleDb, bpQ, entries`.

- [ ] **Step 1: Write failing tests:**
  - LP Butterworth 5 at 1 kHz → labels `Real, A, B`, fn 1000 each, q [null, 0.618, 1.618].
  - HP Chebyshev 4 1 dB at 1 kHz → fn ≈ [1891.8, 1006.8] for A/B (1000/0.5286, 1000/0.9932), q as in Task 2.
  - BP 4 sections, Q 10 → 4 stages, fn 1000, q 10, gain 10.
  - Notch → 1 stage, role notch.
  - Gain entry `{A:{gain:2}}` → A.gain 2.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 4: Solver for the low-pass core (real pole, MFB LP, SK LP) and default caps

**Files:** Modify HTML (add the `solve` block). Test `tests/solve-lp.test.js`.

**Interfaces:**
- Consumes: `FH.units.*`, `Stage`.
- Produces: `FH.solve.stage(stage: Stage, circuit: 'mfb'|'sk', entry: {c1?:number, c2?:number, c3?:number}, opts: {resSeries, capSeries, seed}): Solved`, where `Solved = { stage, circuit, parts: {R1,R2,R3?,R4?,C1,C2,C3?}, gainActual: number, error: string|null }`.
  - On error, `parts` is `null` and `error` holds the refusal text.
  - Values are the rounded ones; "Exact" stays unrounded.

Algorithms. These are pinned by the spec, so they're reproduced here because the tests alone don't determine the root and rounding order:
- **Real pole (LP):** C = entry.c1 ?? round_cap(C0), with C0 = 1/(2π·fn·seed). R = round_res(1/(2π·fn·C)).
- **MFB LP** (G = stage.gain, ω0 = 2π·fn):
  - **Default caps:** r = 1.5·4Q²(1+G), C1 = C0/√r, C2 = C0·√r, each rounded. Then, while C2/C1 < 1.2·4Q²(1+G), C2 = stepSeries(C2, +1).
  - **Refusal:** if C2/C1 < 4Q²(1+G), error `C2 must be ≥ ${formatEng(4Q²(1+G)·C1)} for Q = ${q.toFixed(2)} at gain ${G}`.
  - R2 = the smaller root of x² − x/(Q·ω0·C1) + (1+G)/(ω0²·C1·C2) = 0, then round.
  - R1 = round(R2/G).
  - R3 = round(1/(ω0²·R2·C1·C2)), using the rounded R2.
  - gainActual = R2/R1.
- **SK LP** (Cf = C1, Cg = C2, K = stage.gain as typed, R3 = round_res(seed)):
  - a = 1/ω0², b = 1/(Q·ω0). Solve (Cg + Cf(1−K))·R1² − b·R1 + a/Cf = 0.
  - If exactly one root is positive, use it. If both are, take the one giving R1 ≤ R2 (spec, pending check 5).
  - Round R1. R2 = round(a/(R1·Cf·Cg)).
  - R4 = K > 1 ? round((K−1)·R3) : omitted. gainActual = 1 + R4/R3.
  - **Default caps:** unity gain needs Cf/Cg ≥ 4Q². Use r = 1.5× the minimum ratio for realizability, found by bisection on Cf/Cg against "positive real root exists". Centre on C0, round, and step Cf up while below 1.2× the minimum.
  - **Refusal:** `C1/C2 must be ≥ ${minRatio.toFixed(2)} for Q = ${q} at gain ${K}`.
- **Any cap > 1e-6:** error `Capacitors are not supported above 1uF.`

- [ ] **Step 1: Write failing tests** (expected parts compared after `formatEng`, 3 significant figures):
  - **Golden case 1** (MFB 3-pole BW, E96/E6, seed 10k, no entries): Real → R 10.7k, C 15.0n. For A, enter c1 4.7n, c2 68n → R1 5.62k, R2 5.62k, R3 14.0k.
  - **Golden 2/3/4/5/6/7/9** (MFB): enter FilterPro's caps from the spec table, assert R1/R2/R3 exactly as tabled.
    - Case 5: Res E24. Case 6: Res Exact → `6.79k/6.79k/11.3k`, `6.37k/6.37k/12.4k`.
    - Case 7: gain 2 → 5.11k/10.2k/11.0k, gainActual 1.996 (to 3 decimals).
    - Case 9: seed 22k, gains 10/10.
  - **Golden 8 and 9 real pole:** seed 4.99k → 4.87k/33.0n; seed 22k → 23.2k/6.80n.
  - **Golden 10** (SK, gain 10, seed 10k, Res E96): A enter c1 10n, c2 39n → R1 4.99k, R2 13.0k, R3 10.0k, R4 90.9k. B with the same caps → R1 6.19k, R2 10.5k.
  - `default caps are realizable`: for MFB and SK, Q ∈ {0.5, 0.707, 1.3, 3.56, 8}, G ∈ {1, 2, 10}, all series → no error, and the ratio ≥ the minimum.
  - `refuses small C2`: MFB Q 1.3066, G 1, c1 10n, c2 10n → error starts `C2 must be ≥`.
  - `refuses > 1uF`: c2 2 → `Capacitors are not supported above 1uF.`
  - `solves at 1 Hz and 1 MHz`: Butterworth 4, both circuits → no error, finite parts.
  - `real pole uses entered C1`: c1 10n at 1 kHz E96 → R 15.8k.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 5: Nodal response engine and results numbers

**Files:** Modify HTML (add the `response` block). Test `tests/response.test.js`.

**Interfaces:**
- Consumes: `Solved`.
- Produces:
  - `FH.response.stageH(solved: Solved, f: number, gbw: number|null): {re, im}`. This is nodal analysis of that circuit's netlist. The op amp gain is A = gbw ? 2π·gbw/(j·2πf) : 1e9.
  - `FH.response.cascadeH(list: Solved[], f, gbw)` gives the product.
  - `FH.response.point(list, f, gbw): {db, deg, gdSec}`. Phase is unwrapped across the plot sweep by the caller. Group delay = −dφ/dω by central difference at ±0.1 % in f.
  - `FH.response.sweep(list, fStart, fStop, n = 400, gbw): Array<{f, db, deg, gdSec}>`, log-spaced with phase unwrapped.
  - `FH.response.requiredGBP(solved): number|null`:
    - real: 50·fn
    - MFB pair: 100·Q·fn·G
    - SK pair: 206·G·Q^1.5·fn
    - BP and notch: null
- Netlists: one per (role, kind, circuit), defined in a table in the module. Shared node naming: `in`, `n1`, `n2`, `out`. The op amp is a VCVS out = A·(v+ − v−). New circuits from Task 6 add rows to this table.

- [ ] **Step 1: Write failing tests**, using parts from Task 4's golden solves and gain at 10 kHz to 0.01 dB:
  - case 1: Real −20.12, A −39.89
  - case 2: A −40.08, B −39.87
  - case 3: A −40.01, B −39.85
  - case 4: A −40.01
  - case 5: −39.84 / −40.09
  - case 6: −40.06 / −39.94
  - case 7: A −40.01 (includes gain 1.996)
  - case 9: −19.97 / −20.01 / −19.88
  - case 10: −19.93 / −19.85
  - case 2 cascade: −79.96. case 1 cascade: −60.01 (spec screenshot totals)
  - `requiredGBP`: case 2 A 54.1k, B 131k; case 1 Real 50.0k; case 7 A 108k; case 10 A within 2 % of 1.01M, B within 2 % of 4.27M.
  - `gbw lowers SK peaking`: Butterworth 4 SK at 10 kHz, gbw 1 MHz vs null → the stage-B peak magnitude differs by > 0.1 dB, and gbw 1e12 matches null within 0.001 dB.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Use a small complex Gaussian elimination, at most 4 unknowns.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 6: High-pass, band-pass, notch (provisional pending spec checks 3–4)

**Files:** Modify the HTML `solve` and `response` blocks. Test `tests/solve-other.test.js`.

**Interfaces:**
- Consumes/extends: `FH.solve.stage`, the netlist table in `FH.response`.
- Circuits:
  - **MFB HP:** C1 in, C2 series to the inverting input, C3 feedback, R1 shunt to ground, R2 feedback.
    - Gain = C1/C3. Default caps: C1 = C2 = round(C0), C3 = round(C1/G).
    - R2 = Q·(C1+C2+C3)/(ω0·C2·C3), rounded first. R1 = 1/(ω0²·R2·C2·C3) from the rounded R2.
  - **SK HP:** C1, C2 in the series path, R1 node→output, R2 + input→ground, gain K via R3/R4 as in LP.
    - Default C1 = C2 = round(C0). The builder derives the solve in the same style: the dominant R rounded first, the fn-setting R recomputed.
  - **Real pole HP:** C series, R to ground, unity buffer.
  - **BP (MFB only, equal caps):** R1 in, R3 to ground, R2 feedback.
    - Gain = R2/(2R1) for equal caps. C = round(C0 · 1.7) (FilterPro: 27n at a 10k seed, 1 kHz; keep the factor in one constant).
    - Solve the standard equal-cap MFB band-pass. Round R2 first, then recompute R1 and R3.
  - **Notch:** MFB band-pass section plus an inverting summer that subtracts it from the input. A single fixed topology, with the notch depth set by summer resistors equal to round_res(seed). Provisional until spec check 4.
- Notch, HP and BP refusal rules follow Task 4's style, with the message stating the bound.

- [ ] **Step 1: Write failing tests:**
  - `realizes targets`: for HP (MFB, SK) Butterworth/Chebyshev 4, BP Q 10, notch Q 10, with Res Exact and Cap Exact (add `'Exact'` as an allowed cap series in tests only): the response from `stageH` gives an fn within 0.1 % (peak, or the ω where the phase is ±90°) and a Q within 0.5 % of target.
  - `BP default parts at 1 kHz Q10 gain10 seed10k`: within one E96 step of FilterPro's 5.90k / 118k / 309 Ω with C 27n.
  - `notch depth`: with Exact parts, |H(f0)| < −60 dB.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 7: State, defaults, URL hash, localStorage

**Files:** Modify HTML (add the `state` block). Test `tests/state.test.js`.

**Interfaces:**
- Produces:
  - `State = { passband: 'lp'|'hp'|'bp'|'notch', circuit: 'mfb'|'sk', response: 'butterworth'|'bessel'|'chebyshev', poles: number, fc: number, rippleDb: number, bpQ: number, resSeries: 'Exact'|'E12'|'E24'|'E96', capSeries: 'E6'|'E12'|'E24', seed: number, cursor: number, entries: { [label]: {c1?, c2?, c3?, gain?} }, gbw: number|null, showReal: boolean }`
  - `FH.state.defaults(): State` (values per Global Constraints)
  - `FH.state.normalize(s): State`, which clamps poles 1–10 (BP 1–5), drops entries for rows not in `FH.stages.build(s)`, and forces circuit `'mfb'` for BP
  - `FH.state.encodeHash(s): string`, compact `key=value&…` with entries as `A.c1=4.7e-9`
  - `FH.state.decodeHash(hash: string): State`
  - `FH.state.initial(hash: string, storage: {getItem(k)}|null): State`, with precedence hash > storage key `fh.last` > defaults
- Storage access is wrapped in try/catch so a blocked storage doesn't break the page.

- [ ] **Step 1: Write failing tests:**
  - `round-trips`: encode → decode equals the normalized state (including entries).
  - `decodeHash tolerates garbage`: `#poles=abc&fc=-5&zz=1&A.c1=x` → poles 4, fc 1000, no A override.
  - `normalizeState drops overrides for missing rows`: entries for A–E, poles 4 → only A and B kept.
  - `BP forces mfb`.
  - `initial precedence`, and a throwing storage stub still yields defaults.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 8: Window layout and settings panel (UI)

**Files:** Modify HTML: CSS, static markup in `#app`, and a `data-module="ui"` block.

**Interfaces:**
- Consumes: `FH.state.*`, `FH.stages.build`, `FH.solve.stage`, `FH.response.*`.
- Produces:
  - `FH.ui.recompute(): void`, which runs build → solve each stage → render.
  - Render hooks for later tasks: `FH.ui.renderTable(solvedList)`, `FH.ui.renderGraph(solvedList)`, `FH.ui.renderSchematics(solvedList)`, `FH.ui.setHelp(text)`, each a stub in this task.

- [ ] **Step 1:** Build the layout per the spec's Layout section, at fixed 880×560 positions (absolute positioning is fine). Use classic grey panels, sunken entries and grouped frames. No element text may clip at the default system font, and each box fits its longest value (`1.000k`, `Butterworth`, `MFB Single-Ended`).
- [ ] **Step 2:** Wire the Settings controls to the state:
  - Passband, Circuit (hidden for BP), the LP/HP frame (Poles, Cutoff) or the BP/Notch frame (Poles/Sections hidden for Notch, Q, Center Freq), Filter Type + Ripple (enabled for Chebyshev only, and the whole frame hidden for BP/Notch), Cursor, Res/Cap series, R1 Seed.
  - Each change runs `normalize` → `recompute` → write the hash and `fh.last`.
- [ ] **Step 3: Verify in the browser pane** (open the file via `preview_start` with its `file://` URL):
  - the page renders with no console errors
  - changing Passband to Band-Pass hides Circuit and Filter Type
  - Ripple is disabled for Butterworth
  - reloading keeps the settings (hash)
- [ ] **Step 4:** Commit.

### Task 9: Optional Entry grid, help box, results table, summary

**Files:** Modify the HTML `ui` block and markup.

- [ ] **Step 1: The grid:**
  - Rows A–E plus Real are enabled only for existing stages. C3 is enabled only for MFB HP. Gain is enabled for every pair stage (and BP), disabled for Real.
  - On blur or Enter: `parseEng`. Blank → delete the override. NaN → refuse with "Enter a value like 4.7n or 4n7", keeping focus and the previous value.
  - If solving returns `error`, show it as the refusal and restore the previous value.
  - Entered values are displayed with `formatEng`.
- [ ] **Step 2: The help box:**
  - It shows the selected filter type's description by default. Write one short neutral paragraph per response, plus one each for BP and notch.
  - On focus of a cap field: "The current value of this capacitor is {formatEng}F. You may enter a new value…".
  - On R1 Seed: "This entry scales the network impedance. Higher values reduce source loading and power but add noise. 10k suits many applications."
- [ ] **Step 3: The results table:**
  - Columns: Passband Gain (gainActual, 3 significant figures; Real shows 1.0), Fn (`formatEng(fn,5)+'Hz'`), Q (4 significant figures, blank for Real), Gain and Phase at the cursor (`point`), Req. GBP.
  - The header reads "Response at {cursor} Hz." The Totals row shows the product of gains, the cascade Q (blank unless LP/HP), and the cascade dB and degrees.
  - Below it, the summary line (e.g. `MFB, 4-Pole Low-Pass Chebyshev 1.0 dB: 1.000 kHz Cutoff, Passband Gain of 1.0`) and the red phase note.
- [ ] **Step 3b:** Add the test `parseEng rejects garbage` cases to a browser check: type `abc` into C1 A → the refusal appears and the value is unchanged.
- [ ] **Step 4: Verify in the pane:**
  - The default design shows a table that matches `node -e` output from the same state.
  - Entering C1 A `6.8n`, C2 A `22n` on golden case 3 settings shows R values and a −40.01 dB gain for A.
  - Entering C2 `2` shows the 1 µF refusal.
- [ ] **Step 5:** Commit.

### Task 10: Graph

**Files:** Modify the HTML `ui` block.

- [ ] **Step 1:** SVG plot of `sweep(list, fc/10, fc·100)`:
  - **Gain:** green, left axis; top = ceil((20·log10(total gain) + 10)/10)·10, span 80 dB, 10 dB grid.
  - **Phase:** red, right axis with labels +380°…−360° (FilterPro style).
  - **Group delay:** black, second right axis with a nice 0…max scale in µs/ms.
  - **Cursor:** blue vertical line; clicking the plot sets the cursor.
  - **Overlay:** when `showReal` and `gbw` are set, a second gain trace (dashed green).
  - Decade labels in `100Hz`, `1.00kHz` style.
  - The GBW entry and the "Show real response" checkbox sit at the bottom right, where FilterPro's Plot/Decades controls were.
- [ ] **Step 2: Verify in the pane:**
  - Butterworth 4 at 1 kHz crosses −3 dB at the 1 kHz gridline.
  - Gain 100 moves the top label to 50 dB.
  - Clicking the plot moves the cursor and updates the table header.
  - Turning on GBW 1 MHz with Chebyshev 4 1 dB SK shows a visibly different peak.
- [ ] **Step 3:** Commit.

### Task 11: Schematics

**Files:** Modify the HTML `ui` block.

- [ ] **Step 1:** One SVG drawing per (role, kind, circuit) (real LP/HP, MFB LP/HP, SK LP/HP, MFB BP, notch), each about 160×120. Part labels use the naming convention from Global Constraints, with the rounded values written next to them. Lay the drawings left to right in order, wrapping to a second row after 3, with a caption under each ("Real Pole Section", "Section A", …).
- [ ] **Step 2: Verify in the pane:**
  - Golden case 1 settings show "Real Pole Section" and "Section A" with 10.7k/15.0n and 5.62k/5.62k/14.0k/4.70n/68.0n.
  - 5-pole wraps correctly.
  - Switching to SK redraws with R3/R4 when the gain is > 1.
- [ ] **Step 3:** Commit.

### Task 12: Spec checks and finish

- [ ] **Step 1:** Ask John for the five FilterPro screenshots in the spec's checklist, if they haven't been supplied yet. Apply the results:
  - `CHEBY_NORM` and the Chebyshev gain reference
  - Bessel normalization
  - HP/BP/notch topology and parts (add each case as a golden test)
  - the SK unity-gain root choice (add as golden tests)
  - Run `node --test tests/` → pass.
- [ ] **Step 2:** Do a full manual pass in the pane on a narrow (1024 px) and a normal window, using `file://` with the network disabled (open the file directly). There must be no console errors, and no network requests in `read_network_requests`.
- [ ] **Step 3:** Commit.
