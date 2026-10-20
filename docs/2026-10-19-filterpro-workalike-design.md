# Filter Hobbyist: FilterPro 2.0 workalike (design)

Date: 2026-10-19. Status: draft for John's approval.

## Intent

An offline, cross-platform replacement for TI FilterPro 2.0, a 2007 Windows VB6 app that no longer runs without Wine. Modern filter tools are browser-only, sit behind logins, and lock in a full E96 spread of parts, which leaves every practical tweak to hand edits in LTspice.

FilterPro's value to John is the **design loop**:
- seed practical parts (E12 caps, any resistor series)
- slide the impedance level with R1 Seed until resistors land in a sane window (high enough to spare the op amp and keep caps small, low enough to avoid parasitics and noise)
- override individual caps and watch the response move

The typical job is an audio low-pass in the 1–20 kHz range.

## Goals

- A single HTML file that works from `file://` with no network, no install and no login. Any modern browser on macOS, Windows or Linux.
- Keep FilterPro's screen layout and interaction model, so it feels like the original (see Layout).
- Replicate FilterPro's resistor-solving behavior exactly where we know it (see Math). Ten recorded cases are golden tests.
- An optional finite-GBW op-amp overlay, replacing FilterPro's SPICE overlay.

## Non-goals (v1)

Wide band-pass, band-reject, linear-phase and Gaussian responses, Custom Fn & Q, sensitivities view, values/part table window, op-amp picker, SPICE, MFB fully differential, saving files, printing.

## Anti-goals

- Anything that needs a server, an account, a build step or a package install to run or maintain.
- Silently "fixing" a value John typed. Entries are kept or refused with a reason; never quietly changed.
- Any TI branding or TI logo (the layout is copied, the identity is not).

## Constraints

- Plain HTML/CSS/JS in one file, no external libraries, no CDN. John maintains it and is not a full-time software engineer. Prefer readable code over clever code.
- Built in small, reviewable increments (John's standing preference).
- No new dependencies on John's machine without asking. Node is already installed and may be used to run tests.

## Scope (decided by John)

- **Passband:** Low-Pass, High-Pass, Band-Pass, Notch.
- **Circuit:** MFB single-ended, Sallen-Key. (Band-Pass is MFB-only, as in FilterPro.)
- **Response:** Butterworth, Bessel, Chebyshev with typed ripple in dB. Chebyshev's tunable ripple is "the real star".

## Layout (from the decoded VB6 form and John's screenshots)

The window is about 880×560 px. The reference screenshots and the decoded layout were kept local, because they are TI material. What they showed is summarized in `docs/2026-10-20-filterpro-reference.md`.

- **Top-left:** app title in place of the TI logo. Below it a **context help box**: a description of the selected filter type, replaced by a hint for whichever field has focus (e.g. "The current value of this capacitor is 22.0nF. You may enter a new value…").
- **Top-centre graph:** log frequency axis.
  - Gain is green on the left axis. The top of the axis is passband gain + 10 dB, rounded to 10 dB, spanning 80 dB with a 10 dB grid.
  - Phase is red on the first right axis (+380° … −360°).
  - Group delay is black on a second right axis that rescales automatically.
  - The cursor frequency is a blue vertical line.
  - Default range is fc/10 to 100·fc. FilterPro showed 100 Hz–100 kHz for 1 kHz.
- **Below the graph:** one schematic per stage with part values drawn on it, labelled "Real Pole Section", "Section A", "Section B", …, wrapping to a second row when there are many. Drawn as SVG.
- **Top-right "Settings" panel:**
  - Passband (dropdown).
  - Circuit Type (dropdown; hidden for Band-Pass).
  - The Low-Pass/High-Pass frame with Poles and Cutoff Freq. For Band-Pass it becomes Poles, Q and Center Freq.
  - Filter Type with Ripple (dB, enabled for Chebyshev only).
  - Cursor Freq.
  - Components: Res series {Exact, E12, E24, E96}, Cap series {E6, E12, E24}.
  - **Optional Entry grid:** rows A–E (enabled per stage), columns C1, C2, C3, Gain (V/V), plus a Real-pole C1 row and **R1 Seed** (Ohm, default 10k). C3 is enabled only where the circuit has a third cap (MFB high-pass: input cap, cap to the inverting input, and feedback cap, with gain = C_in/C_fb). It is greyed out otherwise, as in FilterPro. *My call.*
  - The Value Display frame is dropped.
- **Bottom-right results table** (read-only), one row per stage plus Totals:
  - Passband Gain (from rounded parts)
  - Fn and Q (targets)
  - Gain and Phase at the cursor frequency (from rounded parts)
  - Required GBP
  - Below the table: a one-line summary (e.g. "MFB, 4-Pole Low-Pass Butterworth: 1.000 kHz Cutoff, Passband Gain of 1.0"), and the red note "Phase response is not corrected 180° for inverting stages."
- **Classic look:** grey panels, sunken white entry boxes, grouped frames, Arial-like small type. Fix the clipping John saw in the original. No dark mode needed.
- **Engineering notation everywhere:** entry accepts `4.7n`, `4n7`, `4700p`, `10k`, `20000`; display uses 3 significant figures with SI prefix.

## Math and behavior

### Stage targets

Normalized pole tables are computed analytically: Butterworth and Chebyshev in closed form, and Bessel from its polynomial roots. Odd orders get a real-pole section first.
- **Low-pass:** stage Fn = fc·ωn, Q per pole pair.
- **High-pass:** Fn = fc/ωn, same Q.
- **Band-Pass:** every section is tuned to the centre frequency with the entered Q (FilterPro default 10). The section gain defaults to equal Q (FilterPro: "ties gain to Q to reduce response variation"). In Band-Pass, "Poles" counts sections, as FilterPro does.
  - This was **observed** in FilterPro, not assumed: 4 sections, each 1.000 kHz, Q 10, gain 10.
  - Q is **per section**. The overall Q grows with section count (FilterPro's own help text says so).
  - Filter Type, Ripple and Circuit Type are hidden in band-pass, so the response type has no effect there.
  - Stagger-tuned band-pass is out of scope.
- **Notch:** a single tuned section at f0 with Q.

### Component solving (verified against FilterPro, MFB low-pass)

1. **Base cap from R1 Seed:** C0 = 1/(2π·Fn·Rseed).
2. **Real-pole stage** (RC + unity buffer): C = round_cap(C0), R = round_res(1/(2π·Fn·C)). Verified: seed 10k → 15n/10.7k, seed 4.99k → 33n/4.87k, seed 22k → 6.8n/23.2k.
3. **MFB low-pass** (gain G = R2/R1; C1 = feedback cap, C2 = cap to ground):
   - Default caps: C2/C1 must exceed 4·Q²·(1+G) for real resistors. Use about 1.5× that minimum, centred on C0, then round to the cap series. *This is our rule.* FilterPro's exact rule wasn't recovered; observed margins were 1.3–1.8×.
   - Solve R2 as the **smaller root** of x² − x/(Q·ω0·C1) + (1+G)/(ω0²·C1·C2) = 0, then round.
   - R1 = round(R2/G).
   - R3 = round(1/(ω0²·R2_rounded·C1·C2)). Recomputing R3 from the *rounded* R2 is what FilterPro does; it is what makes the E96 and E24 cases match.
4. **Sallen-Key low-pass** (C1 = cap to ground, C2 = feedback cap; gain K = 1 + R4/R3, R3 = Rseed):
   - Solve R1 from a = R1·R2·C1·C2 = 1/ω0² and b = C1(R1+R2) + R1·C2·(1−K) = 1/(Q·ω0), using the **typed** K, not the rounded one. Round R1, recompute R2 = a/(R1·C1·C2), and round.
     - When K is large enough, one root is negative and the other is the answer. The builder check confirmed this reproduces case 10 exactly.
     - When both roots are positive (including unity gain), FilterPro's pick is unknown. Until check 5 settles it, take the root that gives R1 ≤ R2.
   - R4 = round((K−1)·R3).
   - Default caps: for K = 1, C1/C2 ≥ 4Q²; for K > 1 the builder derives the condition. Use the same ~1.5× margin rule.
   - **Fix FilterPro's label inconsistency:** it labels SK's ground cap "C1" and MFB's feedback cap "C1". The builder picks one convention (e.g. "C1 = feedback, C2 = ground" for both) and uses it in the schematics, the grid and the help text.
5. **High-pass, Band-Pass (MFB, equal caps, R3 to ground) and Notch:** the builder derives the solving in the same style:
   - caps from C0 (or from user entry)
   - resistors solved exactly
   - the dominant resistor rounded first, and the one that sets Fn recomputed from it
6. **User-entered caps** override the defaults per stage and are kept as typed (shown rounded to 3 sig. figs). C1 only → C2 is computed by the default rule. If the entry makes the stage unrealizable, **refuse with a reason** that states the bound, e.g. "C2 must be ≥ 68n for Q = 1.31 at gain 1". Caps above 1 µF are refused (FilterPro's rule).
7. **Rounding:** nearest value in the series on a log scale. "Exact" displays 3 significant figures but keeps full precision in the math.

### Results

- Fn and Q columns show the target values.
- Gain/Phase at the cursor and the plotted curves come from the **rounded** parts' transfer functions. The plot's ideal curve uses an ideal op amp.
- **Required GBP:**
  - MFB and real-pole: 100·Q·Fn·G (real pole: 50·Fn). Verified.
  - Sallen-Key: FilterPro's formula is unknown. Two data points: G = 10.09 → Q 0.618 gives 1.01 MHz, Q 1.618 gives 4.27 MHz (consistent with ≈206·G·Q^1.5·Fn). The builder may use a documented derivation instead and note the difference.

### GBW overlay (our addition)

An optional "Op-amp GBW" entry (e.g. 10 MHz) plus a "Show real response" toggle. It draws a second gain trace computed with a single-pole op-amp model, A(s) = 2π·GBW/s, in each stage's equations. This shows the Q enhancement and peaking that finite GBW causes in Sallen-Key/MFB. It replaces FilterPro's SPICE overlay. Off by default.

### Keeping a design

The full design state (settings, series, seed, entries, cursor) is encoded in the URL `#hash`, so a design can be bookmarked or pasted into notes. The last design is also restored from localStorage on open. There are no files and no Save dialog.

## Golden test cases (FilterPro output, 1.000 kHz LP Butterworth, E96 res unless noted)

| Case | Stage | Entered | Expected parts | Gain at 10 kHz |
|---|---|---|---|---|
| 1 MFB 3-pole, E6 caps | Real | — | R 10.7k, C 15.0n | −20.12 dB |
|  | A (Q 1.0) | — | R1 5.62k, R2 5.62k, R3 14.0k, C1 4.70n, C2 68.0n | −39.89 dB |
| 2 MFB 4-pole, E12 | A (Q 0.5412) | — | 6.81k / 6.81k / 11.3k, 10.0n / 33.0n | −40.08 dB |
|  | B (Q 1.3066) | — | 6.34k / 6.34k / 12.4k, 3.90n / 82.0n | −39.87 dB |
| 3 MFB 4-pole, E12 | A | C1 6.8n, C2 22n | 10.2k / 10.2k / 16.5k | −40.01 dB |
|  | B | C1 4.7n, C2 100n | 5.23k / 5.23k / 10.2k | −39.85 dB |
| 4 same, caps entered | A | C1 680p, C2 2.2n | 102k / 102k / 165k | −40.01 dB |
| 5 MFB 4-pole, Res E24, Cap E12 | A / B | — | 6.80k/6.80k/11.0k ; 6.20k/6.20k/13.0k | −39.84 / −40.09 dB |
| 6 MFB 4-pole, Res Exact, Cap E12 | A / B | — | 6.79k/6.79k/11.3k ; 6.37k/6.37k/12.4k | −40.06 / −39.94 dB |
| 7 MFB 4-pole, E12, gain A = 2 | A | Gain 2 | R1 5.11k, R2 10.2k, R3 11.0k, C1 6.80n, C2 33.0n; gain 1.996; GBP 108 kHz | −40.01 dB |
| 8 MFB 5-pole, gain 10/10, seed 4.99k | Real / A / B | — | 4.87k,33n ; R1 1.37k R2 13.7k R3 4.75k C1 3.9n C2 100n ; R1 1.30k R2 13.0k R3 4.87k C1 1.5n C2 270n | |
| 9 same, seed 22k | Real / A / B | — | 23.2k,6.8n ; 6.04k/60.4k/23.2k, 820p/22n ; 6.49k/64.9k/21.0k, 330p/56n | −19.97 / −20.01 / −19.88 dB |
| 10 SK 5-pole, gain 10/10, seed 10k | A / B | — | R1 4.99k R2 13.0k C1(gnd) 39n C2(fb) 10n R3 10.0k R4 90.9k ; R1 6.19k R2 10.5k, same caps | −19.93 / −19.85 dB |

Resistor solving and gain-at-cursor must match these exactly. Default **cap** choices are expected to differ in some cases, since FilterPro's cap rule wasn't recovered. In those cases the test enters FilterPro's caps and checks the resistors.

## Left to the builder

- Code structure inside the single file, the test harness (Node is fine), the SVG schematic drawing style, and the exact pixel layout within the original's arrangement.
- HP/BP/Notch circuit equations (standard MFB/SK forms), and the SK GBP formula (documented).
- Bessel normalization: −3 dB at fc (FilterPro convention, to be confirmed in check 2 below).

## To confirm against FilterPro before or during the build (John can screenshot)

1. **Chebyshev cutoff and gain reference:** 4-pole, 1 dB ripple, 1 kHz, gain 1. Is the cutoff at the ripple-band edge or at −3 dB? Is gain 1 referenced to DC or to the ripple peak (per-stage gains and Totals)?
2. **Bessel:** gain at 1 kHz for a 4-pole 1 kHz design (−3 dB or not).
3. **High-pass:** one SK and one MFB 4-pole Butterworth at 1 kHz (parts and schematic).
4. **Notch:** one notch at 1 kHz (topology and parts).
5. **Sallen-Key at unity gain:** 4-pole Butterworth, 1 kHz, E96/E12, seed 10k, gains blank. These become golden tests and settle the root choice.

Build order puts the unconfirmed pieces last (notch, Chebyshev reference, high-pass), so the low-pass core can start before the checks are done.
