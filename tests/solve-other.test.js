const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const FH = loadFH();
const { formatEng, stepSeries } = FH.units;
const build = FH.stages.build;
const R = FH.response;

const state = over => Object.assign({
  passband: 'hp', response: 'butterworth', poles: 4, fc: 1000, rippleDb: 1, bpQ: 10, entries: {},
}, over);
const byLabel = (stages, label) => stages.find(s => s.label === label);
const opts = (over = {}) => Object.assign({ resSeries: 'E96', capSeries: 'E12', seed: 10e3 }, over);
const solve = (stage, circuit, entry = {}, o = {}) => FH.solve.stage(stage, circuit, entry, opts(o));
const EXACT = { resSeries: 'Exact', capSeries: 'Exact' }; // 'Exact' caps: tests only

// ---- Measuring a stage from its response (not from the solver's equations) --
const H = (solved, f) => R.stageH(solved, f, null);
const mag = h => Math.hypot(h.re, h.im);

// Bisection on a sign change of g over [lo, hi] (log-spaced midpoint).
function bisect(g, lo, hi) {
  const gLo = Math.sign(g(lo));
  assert.notStrictEqual(gLo, Math.sign(g(hi)), `no sign change in [${lo}, ${hi}]`);
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (Math.sign(g(mid)) === gLo) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

// Second-order high-pass K·s²/(s² + s·ω0/Q + ω0²): at ω0 the response is
// purely imaginary (phase ±90°), and |H(ω0)| = K·Q with K the HF gain.
function measureHighPass(solved, fGuess) {
  const f0 = bisect(f => H(solved, f).re, fGuess / 3, fGuess * 3);
  const K = mag(H(solved, f0 * 1e4));
  return { f0, q: mag(H(solved, f0)) / K };
}

// Second-order band-pass: at ω0 the response is real (phase 0° or 180°), and
// the −3 dB points satisfy f2 − f1 = f0/Q exactly.
function measureBandPass(solved, fGuess) {
  const f0 = bisect(f => H(solved, f).im, fGuess / 1.5, fGuess * 1.5);
  const h3 = mag(H(solved, f0)) / Math.SQRT2;
  const g = f => mag(H(solved, f)) - h3;
  const f1 = bisect(g, f0 / 2, f0), f2 = bisect(g, f0, f0 * 2);
  return { f0, q: f0 / (f2 - f1) };
}

// Notch G·(s² + ω0²)/(s² + s·ω0/Q + ω0²): the imaginary part changes sign at
// ω0, and |H| = G/√2 where |ω0² − ω²| = ω·ω0/Q, so again f2 − f1 = f0/Q.
function measureNotch(solved, fGuess) {
  const f0 = bisect(f => H(solved, f).im, fGuess / 1.5, fGuess * 1.5);
  const G = mag(H(solved, f0 / 1e4));
  const g = f => mag(H(solved, f)) - G / Math.SQRT2;
  const f1 = bisect(g, f0 / 2, f0), f2 = bisect(g, f0, f0 * 2);
  return { f0, q: f0 / (f2 - f1) };
}

function assertClose(actual, target, rel, what) {
  assert.ok(Math.abs(actual / target - 1) < rel,
    `${what}: got ${actual}, target ${target} (${((actual / target - 1) * 100).toFixed(3)} %)`);
}

test('realizes targets', () => {
  // High-pass, Butterworth and Chebyshev 4, MFB and SK, unity gain and gain 2.
  for (const response of ['butterworth', 'chebyshev']) {
    for (const gain of [1, 2]) {
      const stages = build(state({ response, entries: { A: { gain }, B: { gain } } }));
      for (const circuit of ['mfb', 'sk']) {
        for (const st of stages) {
          const tag = `HP ${response} ${circuit} ${st.label} gain ${gain}`;
          const r = solve(st, circuit, {}, EXACT);
          assert.strictEqual(r.error, null, `${tag}: ${r.error}`);
          const m = measureHighPass(r, st.fn);
          assertClose(m.f0, st.fn, 0.001, `${tag} fn`);
          assertClose(m.q, st.q, 0.005, `${tag} Q`);
          assertClose(mag(H(r, st.fn * 1e4)), gain, 1e-4, `${tag} HF gain`);
        }
      }
    }
  }
  // Band-pass Q 10 (gain default = Q) and gain 1.
  for (const entries of [{}, { A: { gain: 1 } }]) {
    const st = byLabel(build(state({ passband: 'bp', poles: 1, entries })), 'A');
    const r = solve(st, 'mfb', {}, EXACT);
    assert.strictEqual(r.error, null, r.error);
    const m = measureBandPass(r, st.fn);
    assertClose(m.f0, st.fn, 0.001, 'BP fn');
    assertClose(m.q, 10, 0.005, 'BP Q');
    assertClose(mag(H(r, st.fn)), st.gain, 1e-4, 'BP centre gain');
  }
  // Notch Q 10.
  const n = byLabel(build(state({ passband: 'notch' })), 'A');
  const r = solve(n, 'mfb', {}, EXACT);
  assert.strictEqual(r.error, null, r.error);
  const m = measureNotch(r, n.fn);
  assertClose(m.f0, n.fn, 0.001, 'notch fn');
  assertClose(m.q, 10, 0.005, 'notch Q');
});

test('real-pole high-pass is −3 dB at fn and passes HF', () => {
  const real = byLabel(build(state({ poles: 3 })), 'Real');
  const r = solve(real, 'mfb', {}, EXACT);
  assert.strictEqual(r.error, null, r.error);
  assertClose(mag(H(r, real.fn)), Math.SQRT1_2, 1e-6, '|H(fn)|');
  assertClose(mag(H(r, real.fn * 1e4)), 1, 1e-6, 'HF gain');
  assert.ok(mag(H(r, real.fn / 1e3)) < 2e-3, 'blocks DC');
});

test('HP default caps: MFB C1 = C2 = round(C0), C3 = round(C1/G); SK C1 = C2', () => {
  const a = byLabel(build(state({ entries: { A: { gain: 2 } } })), 'A');
  const m = solve(a, 'mfb');
  assert.strictEqual(m.error, null, m.error);
  const c0 = 1 / (2 * Math.PI * a.fn * 10e3);
  assert.strictEqual(m.parts.C1, FH.units.roundToSeries(c0, 'E12'));
  assert.strictEqual(m.parts.C2, m.parts.C1);
  assert.strictEqual(m.parts.C3, FH.units.roundToSeries(m.parts.C1 / 2, 'E12'));
  assert.strictEqual(m.gainActual, m.parts.C1 / m.parts.C3);
  const k = solve(a, 'sk');
  assert.strictEqual(k.error, null, k.error);
  assert.strictEqual(k.parts.C1, FH.units.roundToSeries(c0, 'E12'));
  assert.strictEqual(k.parts.C2, k.parts.C1);
  assert.strictEqual(formatEng(k.parts.R3), '10.0k');
  assert.strictEqual(formatEng(k.parts.R4), '10.0k');
  assert.strictEqual(k.gainActual, 2);
  // Unity-gain SK HP omits R4, like SK LP.
  const k1 = solve(byLabel(build(state()), 'A'), 'sk');
  assert.ok(!('R4' in k1.parts));
});

test('HP keeps entered caps as typed', () => {
  const a = byLabel(build(state()), 'A');
  const m = solve(a, 'mfb', { c1: 4.7e-9, c2: 10e-9, c3: 3.3e-9 });
  assert.deepStrictEqual([m.parts.C1, m.parts.C2, m.parts.C3], [4.7e-9, 10e-9, 3.3e-9]);
  const k = solve(a, 'sk', { c1: 4.7e-9, c2: 10e-9 });
  assert.deepStrictEqual([k.parts.C1, k.parts.C2], [4.7e-9, 10e-9]);
});

test('BP default parts at 1 kHz Q10 gain10 seed10k', () => {
  const st = byLabel(build(state({ passband: 'bp', poles: 1, entries: { A: { gain: 10 } } })), 'A');
  const r = solve(st, 'mfb');
  assert.strictEqual(r.error, null, r.error);
  assert.strictEqual(formatEng(r.parts.C1), '27.0n');
  assert.strictEqual(formatEng(r.parts.C2), '27.0n');
  // Within one E96 step of FilterPro's values.
  const near = (x, ref, name) => {
    const lo = stepSeries(ref, 'E96', -1), hi = stepSeries(ref, 'E96', +1);
    assert.ok(x >= lo * (1 - 1e-9) && x <= hi * (1 + 1e-9), `${name} ${formatEng(x)} vs ${formatEng(ref)}`);
  };
  near(r.parts.R1, 5.90e3, 'R1');
  near(r.parts.R2, 118e3, 'R2');
  near(r.parts.R3, 309, 'R3');
});

test('notch depth', () => {
  const st = byLabel(build(state({ passband: 'notch' })), 'A');
  const r = solve(st, 'mfb', {}, EXACT);
  assert.strictEqual(r.error, null, r.error);
  const db = 20 * Math.log10(mag(H(r, st.fn)));
  assert.ok(db < -60, `|H(f0)| = ${db.toFixed(1)} dB`);
  // Passband gain 1 (inverting summer, equal resistors).
  assertClose(mag(H(r, st.fn / 1e3)), 1, 1e-4, 'LF gain');
  assertClose(mag(H(r, st.fn * 1e3)), 1, 1e-4, 'HF gain');
});

test('notch ignores the circuit argument', () => {
  const st = byLabel(build(state({ passband: 'notch' })), 'A');
  const a = solve(st, 'mfb'), b = solve(st, 'sk');
  assert.strictEqual(a.error, null, a.error);
  assert.strictEqual(JSON.stringify(a.parts), JSON.stringify(b.parts));
  assert.strictEqual(JSON.stringify(H(a, 900)), JSON.stringify(H(b, 900)));
});

test('refusals state the bound', () => {
  // SK HP gain below 1.
  const hp = { label: 'A', role: 'hp', kind: 'pair', fn: 1000, q: Math.SQRT1_2, gain: 0.5 };
  assert.strictEqual(solve(hp, 'sk').error, 'Sallen-Key gain must be ≥ 1 (got 0.5)');
  // BP: Sallen-Key not offered.
  const bp = { label: 'A', role: 'bp', kind: 'pair', fn: 1000, q: 2, gain: 2 };
  assert.strictEqual(solve(bp, 'sk').error, 'Band-pass is MFB only.');
  // BP: equal-cap MFB needs gain < 2·Q².
  const bpHot = Object.assign({}, bp, { gain: 8 });
  const e = solve(bpHot, 'mfb');
  assert.strictEqual(e.parts, null);
  assert.strictEqual(e.error, 'Band-pass gain must be < 8.00 for Q = 2.00');
  // Notch: the band-pass section runs at gain 1, so Q must exceed 1/√2.
  const notch = { label: 'A', role: 'notch', kind: 'pair', fn: 1000, q: 0.5, gain: 1 };
  assert.strictEqual(solve(notch, 'mfb').error, 'Notch Q must be > 0.71 (got 0.50)');
  // Caps above 1uF, including MFB HP C3.
  const a = byLabel(build(state()), 'A');
  assert.strictEqual(solve(a, 'mfb', { c3: 2e-6 }).error, 'Capacitors are not supported above 1uF.');
  assert.strictEqual(solve(a, 'sk', { c1: 2e-6 }).error, 'Capacitors are not supported above 1uF.');
  assert.strictEqual(solve(Object.assign({}, bp), 'mfb', { c1: 2e-6 }).error, 'Capacitors are not supported above 1uF.');
});

test('HP, BP, notch solve at 1 Hz and 1 MHz', () => {
  for (const fc of [1, 1e6]) {
    const sets = [
      ['mfb', build(state({ fc, poles: 5 }))],
      ['sk', build(state({ fc, poles: 5 }))],
      ['mfb', build(state({ fc, passband: 'bp', poles: 2 }))],
      ['mfb', build(state({ fc, passband: 'notch' }))],
    ];
    for (const [circuit, stages] of sets) {
      for (const st of stages) {
        const r = solve(st, circuit);
        const tag = `${fc} Hz ${st.role} ${circuit} ${st.label}`;
        assert.strictEqual(r.error, null, `${tag}: ${r.error}`);
        for (const [name, v] of Object.entries(r.parts)) {
          assert.ok(v > 0 && isFinite(v), `${tag} ${name} = ${v}`);
          if (name[0] === 'C') assert.ok(v <= 1e-6, `${tag} ${name} ${v} above 1uF`);
        }
      }
    }
  }
});

test('table phase omits the inversion of MFB HP, BP and notch', () => {
  const a = byLabel(build(state()), 'A');
  // A high-pass pair reads +90° at fn, MFB or SK.
  for (const circuit of ['mfb', 'sk']) {
    const r = solve(a, circuit, {}, EXACT);
    assert.ok(Math.abs(R.point([r], a.fn, null).deg - 90) < 0.01, circuit);
  }
  const bp = byLabel(build(state({ passband: 'bp', poles: 1 })), 'A');
  const rb = solve(bp, 'mfb', {}, EXACT);
  assert.ok(Math.abs(R.point([rb], bp.fn, null).deg) < 0.01, 'BP 0° at centre');
  assert.ok(R.stageH(rb, bp.fn, null).re < 0, 'stageH keeps the true (inverted) H');
  const n = byLabel(build(state({ passband: 'notch' })), 'A');
  const rn = solve(n, 'mfb', {}, EXACT);
  assert.ok(Math.abs(R.point([rn], 10, null).deg) < 1, 'notch ~0° in the passband');
});

// ---- MFB HP: typed gain vs C1/C3 (review I1) ---------------------------------

test('MFB HP refuses a typed gain that entered C1 and C3 contradict', () => {
  const a = byLabel(build(state({ entries: { A: { gain: 2 } } })), 'A');
  const r = solve(a, 'mfb', { c1: 15e-9, c3: 10e-9, gain: 2 });
  assert.strictEqual(r.parts, null);
  assert.strictEqual(r.error, 'C1/C3 sets gain = 1.50; clear Gain or change C1/C3');
  // Within 1% of the typed gain: accepted, caps kept as typed.
  const ok = solve(a, 'mfb', { c1: 20e-9, c3: 10e-9, gain: 2 });
  assert.strictEqual(ok.error, null, ok.error);
  assert.deepStrictEqual([ok.parts.C1, ok.parts.C3], [20e-9, 10e-9]);
  // Gain left blank: C1/C3 simply sets the gain.
  const blank = solve(byLabel(build(state()), 'A'), 'mfb', { c1: 15e-9, c3: 10e-9 });
  assert.strictEqual(blank.error, null, blank.error);
  assertClose(blank.gainActual, 1.5, 1e-12, 'gain = C1/C3');
});

test('MFB HP default C3 is the series value whose C1/C3 is closest to the gain', () => {
  const series = FH.units.SERIES.E12;
  for (const G of [0.7, 1.5, 2, 3, 5, 10]) {
    const a = byLabel(build(state({ entries: { A: { gain: G } } })), 'A');
    const r = solve(a, 'mfb', { gain: G });
    assert.strictEqual(r.error, null, r.error);
    // Every E12 value from 1p to 1u: none gives a gain closer (on a log scale).
    const err = c3 => Math.abs(Math.log(r.parts.C1 / c3 / G));
    for (let d = -12; d <= -7; d++) {
      for (const m of series) {
        const c3 = Number(m + 'e' + d);
        assert.ok(err(r.parts.C3) <= err(c3) + 1e-12, `G ${G}: C3 ${r.parts.C3} vs ${c3}`);
      }
    }
  }
});

test('gainDiffers flags more than 1% only, and ignores a blank gain', () => {
  const { gainDiffers } = FH.solve;
  assert.strictEqual(gainDiffers(2, 1.829), true);
  assert.strictEqual(gainDiffers(2, 2.015), false);
  assert.strictEqual(gainDiffers(null, 1.5), false);
});

// ---- Computed caps over 1uF (review I2) --------------------------------------

test('MFB HP: C3 over 1uF names C1, the gain and the bound', () => {
  const a = byLabel(build(state({ fc: 1, entries: { A: { gain: 0.5 } } })), 'A');
  const r = solve(a, 'mfb', { c1: 1e-6, gain: 0.5 });
  assert.strictEqual(r.error,
    'C1 = 1.00u at gain 0.5 needs C3 = 2.00u, above the 1uF limit; use a smaller C1 or a gain ≥ 1.00');
});

test('MFB HP defaults stay at or under 1uF for gain < 1 at low fn', () => {
  for (const capSeries of ['E6', 'E12', 'E24']) {
    for (const G of [0.3, 0.5, 0.75, 0.9]) {
      for (const st of build(state({ fc: 1, poles: 5, entries: { A: { gain: G }, B: { gain: G } } }))) {
        const r = solve(st, 'mfb', {}, { capSeries });
        assert.strictEqual(r.error, null, `${capSeries} G ${G} ${st.label}: ${r.error}`);
        for (const [name, v] of Object.entries(r.parts)) {
          if (name[0] === 'C') assert.ok(v <= 1e-6, `${capSeries} G ${G} ${name} ${v}`);
        }
      }
    }
  }
});
