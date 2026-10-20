# FilterPro 2.0 reference notes

Filter Hobbyist is built to match TI FilterPro 2.0. This file records what we learned about the original and the numbers we test against. The source material (installer, screenshots, decoded layout) stays private because it is TI's. No TI code, images or text are included in this repository.

## How the original was examined

- **The program:** FilterPro 2.0 (2007) is a Visual Basic 6 Windows app, not .NET. Its window layout (control names, captions, positions) was read from the program file. Its math is compiled native code, so it was not recovered. Behavior was worked out by running the original and comparing outputs instead.
- **Running it on macOS:** we used a CrossOver Windows 10 bottle. The installer leaves out two system libraries that Windows 10 no longer ships, and the bundled controls need registering.
  - Add the Visual Basic 6 runtime (MSVBVM60) and MFC42 through CrossOver's installer.
  - Register `TIXSpice.ocx` and the bundled OCX controls in `syswow64` with `regsvr32`.
  - Without these, the app exits silently at launch.

## Layout

The layout is copied in Filter Hobbyist, minus TI branding:
- **Top-left:** a help box (filter-type description, or a hint for the focused field).
- **Top-centre:** a graph with gain (green, fixed 80 dB span), phase (red) and group delay (black), plus a blue cursor line.
- **Below the graph:** one schematic per stage.
- **Top-right:** a Settings panel with Passband, Circuit Type, Poles/Cutoff, Filter Type + Ripple, Cursor Freq, resistor/capacitor series, and an Optional Entry grid (C1, C2, C3, Gain per stage A–E, Real-pole C1, R1 Seed).
- **Bottom-right:** a read-only results table and a summary line.

## Behaviors established

- **R1 Seed** sets the impedance level. The base cap is C0 = 1/(2π·fn·seed), rounded to the cap series. The resistors are then solved exactly and rounded.
- **MFB low-pass:** R2 is the smaller root, rounded first. R1 = R2/G. R3 is recalculated from the rounded R2. All ten original golden cases match to the digit.
- **Sallen-Key low-pass:** solved with the typed gain K. R1 is rounded first and R2 recalculated. At unity gain the root with R1 ≤ R2 is used.
- **Sallen-Key high-pass:** both resistors are rounded independently from the exact pair.
- **Notch:** a two-op-amp Fliege section: f0 = 1/(2πRC), Rq = 2·Q·R. Higher orders chain identical sections.
- **Band-pass:** MFB equal-cap sections, all tuned to the centre frequency with the entered Q, and gain tied to Q.
- **Chebyshev** cutoff is the ripple-band edge. **Bessel** is normalized to −3 dB at the cutoff. Passband gain is referenced to DC.
- **Results table:**
  - Fn and Q show target values. Gain and phase at the cursor come from the rounded parts.
  - Phase omits the 180° of inverting stages.
  - Required GBP is 100·Q·Fn·G for MFB stages and 50·Fn for the real pole.
  - Totals Q is the product of the stage Qs for low-pass and high-pass.
- **Caps above 1 µF** are refused.
- **Part labels** follow FilterPro's per-circuit naming. For example, Sallen-Key low-pass uses C1 for the ground cap and C2 for the feedback cap.

## Reference measurements (the golden tests)

All cases are at 1.000 kHz, E96 resistors unless noted. Caps are as FilterPro chose them or as entered. Resistors are given as R1 / R2 / R3.

| Case | Stage | Parts | Gain at cursor |
|---|---|---|---|
| MFB LP Butterworth 3-pole, E6 caps | Real | 10.7k, 15n | −20.12 dB @10k |
| | A | 5.62k / 5.62k / 14.0k, C1 4.7n, C2 68n | −39.89 dB @10k |
| MFB LP Butterworth 4-pole, E12 | A / B | 6.81k / 6.81k / 11.3k (10n/33n); 6.34k / 6.34k / 12.4k (3.9n/82n) | −40.08 / −39.87 @10k |
| same, caps entered | A / B | 10.2k / 10.2k / 16.5k (6.8n/22n); 5.23k / 5.23k / 10.2k (4.7n/100n) | −40.01 / −39.85 @10k |
| same, gain A = 2 | A | R1 5.11k, R2 10.2k, R3 11.0k; gain 1.996; GBP 108k | total −73.88 @10k |
| MFB LP 5-pole, gain 10/10, seed 22k | Real / A / B | 23.2k, 6.8n; 6.04k / 60.4k / 23.2k (820p/22n); 6.49k / 64.9k / 21.0k (330p/56n) | −19.97 / −20.01 / −19.88 @10k |
| SK LP 5-pole, gain 10/10 | A / B | R1 4.99k, R2 13.0k, C1 39n (gnd), C2 10n (fb), R3 10.0k, R4 90.9k; R1 6.19k, R2 10.5k | −19.93 / −19.85 @10k |
| SK LP 4-pole unity, E12 res, E6 caps | A / B | 2.20k / 15.0k (C1 15n, C2 47n); 1.50k / 18.0k (C1 6.8n, C2 150n) | −4.21 / +1.54 @1k |
| MFB LP Chebyshev 4-pole 1 dB, E6 caps | A / B | 3.65k / 3.65k / 11.0k (15n/150n); 6.65k / 6.65k / 11.8k (1.5n/220n) | −51.04 / −40.11 @10k |
| MFB LP Bessel 4-pole, E6 caps | A / B | 6.65k / 6.65k / 12.4k (6.8n/22n); 4.02k / 4.02k / 11.0k (4.7n/47n) | −3.16 / +0.14 @1k |
| MFB HP Butterworth 4-pole, E6 caps | A / B | all caps 15n; R1 17.4k / R2 6.49k; R1 41.2k / R2 2.74k* | −5.25 / +2.24 @1k |
| SK HP Butterworth 4-pole, C1 47n, C2 10n | A / B | R1 10.5k / R2 5.11k*; R1 25.5k / R2 2.15k | −5.29 / +2.42 @1k |
| Notch, 1 section, Q 10, E6 caps | A | C1 = C2 = 47n, R3–R6 3.40k, R1 = R2 = 68.1k | −21.9 dB @1k |

Notes on the starred values:
- **MFB HP section B:** FilterPro shows R2 = 2.67k. The exact value sits 0.08 % past the rounding midpoint, and we round to 2.74k.
- **SK HP section A:** FilterPro draws R2 = 5.23k, but its own gain figure (−5.29 dB) only matches 5.11k.

## Known differences

These are left as they are, and recorded in `docs/2026-10-20-build-rulings.md`:
- **Default capacitor picks:** FilterPro's rule wasn't recovered, so we use our own documented rule (C2/C1 about 1.5× the minimum ratio). Resistors match whenever the same caps are entered.
- **Sallen-Key required GBP:** FilterPro asks for 100k / 223k at unity gain for Q 0.54 / 1.31. Our formula gives 82k / 308k.
- **Band-pass and notch Totals Q:** FilterPro shows 23.97 (band-pass, 4 × Q10) and 9.81 (notch). We show the measured centre/bandwidth: 23.04 and 10.01.
- **Stage gain with gain > 1:** FilterPro appears to show a stage's gain on the next row. We show each stage's own gain; the totals match.
