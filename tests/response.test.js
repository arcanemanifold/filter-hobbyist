const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const FH = loadFH();
const R = FH.response;

// ---- Golden parts, built the same way as tests/solve-lp.test.js ------------
const lp = (poles, entries = {}, fc = 1000) => FH.stages.build({
  passband: 'lp', response: 'butterworth', poles, fc, rippleDb: 1, bpQ: 10, entries,
});
const byLabel = (stages, label) => stages.find(s => s.label === label);
const opts = (over = {}) => Object.assign({ resSeries: 'E96', capSeries: 'E12', seed: 10e3 }, over);
const solve = (stage, circuit, entry = {}, o = {}) => {
  const r = FH.solve.stage(stage, circuit, entry, opts(o));
  assert.strictEqual(r.error, null, `solve error: ${r.error}`);
  return r;
};

// Each golden case's solved stages (FilterPro's caps entered, our C1 = feedback).
const golden = {
  1: (() => {
    const s = lp(3), o = { capSeries: 'E6' };
    return {
      Real: solve(byLabel(s, 'Real'), 'mfb', {}, o),
      A: solve(byLabel(s, 'A'), 'mfb', { c1: 4.7e-9, c2: 68e-9 }, o),
    };
  })(),
  2: { A: solve(byLabel(lp(4), 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }),
       B: solve(byLabel(lp(4), 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }) },
  3: { A: solve(byLabel(lp(4), 'A'), 'mfb', { c1: 6.8e-9, c2: 22e-9 }),
       B: solve(byLabel(lp(4), 'B'), 'mfb', { c1: 4.7e-9, c2: 100e-9 }) },
  4: { A: solve(byLabel(lp(4), 'A'), 'mfb', { c1: 680e-12, c2: 2.2e-9 }) },
  5: { A: solve(byLabel(lp(4), 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }, { resSeries: 'E24' }),
       B: solve(byLabel(lp(4), 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }, { resSeries: 'E24' }) },
  6: { A: solve(byLabel(lp(4), 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }, { resSeries: 'Exact' }),
       B: solve(byLabel(lp(4), 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }, { resSeries: 'Exact' }) },
  7: (() => {
    const s = lp(4, { A: { gain: 2 } });
    return { A: solve(byLabel(s, 'A'), 'mfb', { c1: 6.8e-9, c2: 33e-9 }),
             B: solve(byLabel(s, 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }) };
  })(),
  9: (() => {
    const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } }), o = { seed: 22e3 };
    return {
      Real: solve(byLabel(s, 'Real'), 'mfb', {}, o),
      A: solve(byLabel(s, 'A'), 'mfb', { c1: 820e-12, c2: 22e-9 }, o),
      B: solve(byLabel(s, 'B'), 'mfb', { c1: 330e-12, c2: 56e-9 }, o),
    };
  })(),
  10: (() => {
    const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } });
    const caps = { c1: 39e-9, c2: 10e-9 }; // SK LP: C1 = gnd, C2 = fb (FilterPro labels)
    return { A: solve(byLabel(s, 'A'), 'sk', caps), B: solve(byLabel(s, 'B'), 'sk', caps) };
  })(),
};

// Gain/phase at the 10 kHz cursor, as the results table shows them.
const dbAt = list => R.point(list, 10e3, null).db.toFixed(2);
const degAt = list => R.point(list, 10e3, null).deg.toFixed(1);
const fmtK = hz => (hz / 1e3).toPrecision(3) + 'k';

test('stage gain at 10 kHz matches FilterPro (0.01 dB)', () => {
  const cases = [
    [1, 'Real', '-20.12'], [1, 'A', '-39.89'],
    [2, 'A', '-40.08'], [2, 'B', '-39.87'],
    [3, 'A', '-40.01'], [3, 'B', '-39.85'],
    [4, 'A', '-40.01'],
    [5, 'A', '-39.84'], [5, 'B', '-40.09'],
    [6, 'A', '-40.06'], [6, 'B', '-39.94'],
    [9, 'Real', '-19.97'], [9, 'A', '-20.01'], [9, 'B', '-19.88'],
    [10, 'A', '-19.93'], [10, 'B', '-19.85'],
  ];
  for (const [c, label, want] of cases) {
    assert.strictEqual(dbAt([golden[c][label]]), want, `case ${c} ${label}`);
  }
});

// Case 7 (screenshot 12): FilterPro's per-row Gain column shows A −40.01 and
// B −33.87, i.e. A's ×1.996 (+6.00 dB) appears on row B. The Totals row
// (−73.88) is the true cascade. We report the physically correct per-stage
// gain: A = −34.01 dB, which is FilterPro's −40.01 plus 20·log10(1.996).
test('case 7: gain-2 stage A includes its gain; cascade matches FilterPro total', () => {
  const { A, B } = golden[7];
  assert.strictEqual(dbAt([A]), '-34.01');
  // Filter shape alone (gain divided out) is FilterPro's −40.01.
  const shape = R.point([A], 10e3, null).db - 20 * Math.log10(A.gainActual);
  assert.strictEqual(shape.toFixed(2), '-40.01');
  assert.strictEqual(dbAt([B]), '-39.87');
  assert.strictEqual(dbAt([A, B]), '-73.88');
});

test('cascade gain at 10 kHz matches FilterPro totals', () => {
  assert.strictEqual(dbAt([golden[1].Real, golden[1].A]), '-60.01');
  assert.strictEqual(dbAt([golden[2].A, golden[2].B]), '-79.96');
  assert.strictEqual(dbAt([golden[3].A, golden[3].B]), '-79.86');
  assert.strictEqual(dbAt([golden[5].A, golden[5].B]), '-79.93');
  assert.strictEqual(dbAt([golden[6].A, golden[6].B]), '-80.00');
});

test('cascadeH is the product of stageH', () => {
  const { A, B } = golden[2];
  const a = R.stageH(A, 3e3, null), b = R.stageH(B, 3e3, null);
  const p = R.cascadeH([A, B], 3e3, null);
  assert.ok(Math.abs(p.re - (a.re * b.re - a.im * b.im)) < 1e-12);
  assert.ok(Math.abs(p.im - (a.re * b.im + a.im * b.re)) < 1e-12);
});

test('MFB stageH is inverting: DC gain is −R2/R1', () => {
  const h = R.stageH(golden[9].A, 1e-3, null);
  const p = golden[9].A.parts;
  assert.ok(Math.abs(h.re + p.R2 / p.R1) < 1e-6, `re ${h.re}`);
});

// Phase: FilterPro's table leaves out the MFB 180° inversion, so its numbers
// are the phase of the low-pass shape alone. Ours match that convention.
test('phase at 10 kHz matches FilterPro (0.1°)', () => {
  const cases = [
    [[golden[2].A], '-169.5'], [[golden[2].B], '-175.6'],
    [[golden[3].A], '-169.4'], [[golden[3].B], '-175.6'], [[golden[3].A, golden[3].B], '-345.0'],
    [[golden[4].A], '-169.4'],
    [[golden[5].A], '-169.4'], [[golden[5].B], '-175.5'], [[golden[5].A, golden[5].B], '-344.9'],
    [[golden[6].A, golden[6].B], '-345.0'],
    [[golden[7].A], '-169.4'], [[golden[7].A, golden[7].B], '-344.9'],
  ];
  cases.forEach(([list, want], i) => assert.strictEqual(degAt(list), want, `phase case #${i}`));
});

test('requiredGBP', () => {
  assert.strictEqual(fmtK(R.requiredGBP(golden[2].A)), '54.1k');
  assert.strictEqual(fmtK(R.requiredGBP(golden[2].B)), '131k');
  assert.strictEqual(fmtK(R.requiredGBP(golden[1].Real)), '50.0k');
  assert.strictEqual(fmtK(R.requiredGBP(golden[7].A)), '108k');
  const a = R.requiredGBP(golden[10].A), b = R.requiredGBP(golden[10].B);
  assert.ok(Math.abs(a / 1.01e6 - 1) < 0.02, `10 A ${a}`);
  assert.ok(Math.abs(b / 4.27e6 - 1) < 0.02, `10 B ${b}`);
  const bp = { stage: { role: 'bp', kind: 'pair', fn: 1e3, q: 10, gain: 1 }, circuit: 'mfb', parts: {}, gainActual: 1 };
  assert.strictEqual(R.requiredGBP(bp), null);
  assert.strictEqual(R.requiredGBP(Object.assign({}, bp, { stage: Object.assign({}, bp.stage, { role: 'notch' }) })), null);
});

// Brief asked for > 0.1 dB at 1 MHz. The real effect for these parts is
// 0.058 dB (2.971 → 3.029 dB), confirmed against the closed form in the next
// test, so the threshold here is 0.05 dB. Finite GBW *raises* SK peaking: the
// buffer's phase lag adds positive feedback through C1.
test('finite gbw raises SK peaking', () => {
  const s = lp(4, {}, 10e3);
  const B = solve(byLabel(s, 'B'), 'sk');
  const peak = gbw => Math.max(...R.sweep([B], 2e3, 50e3, 400, gbw).map(p => p.db));
  const ideal = peak(null);
  assert.ok(peak(1e6) - ideal > 0.05, `1 MHz ${peak(1e6)} vs ideal ${ideal}`);
  assert.ok(peak(300e3) - ideal > 0.1, `300 kHz ${peak(300e3)} vs ideal ${ideal}`);
  assert.ok(Math.abs(peak(1e12) - ideal) < 0.001, `1 THz ${peak(1e12)} vs ideal ${ideal}`);
});

// Independent check of the nodal solve: unity-gain SK with a buffer of gain
// K = A/(1+A) has the closed form (C1 = to ground, C2 = feedback)
//   H = K / (1 − ω²·R1R2C1C2 + jω·(R1C1 + R2C1 + R1C2·(1 − K)))
test('SK stageH with finite gbw matches the closed form', () => {
  const B = solve(byLabel(lp(4, {}, 10e3), 'B'), 'sk');
  const { R1, R2, C1, C2 } = B.parts;
  const gbw = 1e6;
  for (const f of [1e3, 5e3, 10e3, 13e3, 40e3]) {
    const w = 2 * Math.PI * f;
    const A = { re: 0, im: -gbw / f };
    const d = { re: 1 + A.re, im: A.im }, dd = d.re * d.re + d.im * d.im;
    const K = { re: (A.re * d.re + A.im * d.im) / dd, im: (A.im * d.re - A.re * d.im) / dd };
    const t = { re: R1 * C1 + R2 * C1 + R1 * C2 * (1 - K.re), im: -R1 * C2 * K.im };
    const den = { re: 1 - w * w * R1 * R2 * C1 * C2 - w * t.im, im: w * t.re };
    const want = 20 * Math.log10(Math.hypot(K.re, K.im) / Math.hypot(den.re, den.im));
    const h = R.stageH(B, f, gbw);
    const got = 20 * Math.log10(Math.hypot(h.re, h.im));
    assert.ok(Math.abs(got - want) < 1e-9, `f ${f}: ${got} vs ${want}`);
  }
});

test('real-pole group delay matches RC/(1 + (ωRC)²)', () => {
  const real = golden[1].Real;
  const tau = real.parts.R1 * real.parts.C1;
  for (const f of [100, 1e3, 5e3]) {
    const w = 2 * Math.PI * f;
    const want = tau / (1 + (w * tau) ** 2);
    const got = R.point([real], f, null).gdSec;
    assert.ok(Math.abs(got / want - 1) < 1e-4, `f ${f}: ${got} vs ${want}`);
  }
});

test('sweep is log-spaced with phase unwrapped', () => {
  const list = [golden[9].Real, golden[9].A, golden[9].B]; // 5 poles: 0 → −450°
  const pts = R.sweep(list, 10, 1e6, 400, null);
  assert.strictEqual(pts.length, 400);
  assert.ok(Math.abs(pts[0].f - 10) < 1e-9 && Math.abs(pts[399].f - 1e6) < 1e-3);
  const ratio = pts[1].f / pts[0].f;
  assert.ok(Math.abs(pts[200].f / pts[199].f - ratio) < 1e-9, 'constant log step');
  for (let i = 1; i < pts.length; i++) {
    assert.ok(Math.abs(pts[i].deg - pts[i - 1].deg) < 90, `jump at ${pts[i].f}`);
  }
  assert.ok(pts[399].deg < -400, `ends at ${pts[399].deg}`);
  assert.ok(Object.keys(pts[0]).join() === 'f,db,deg,gdSec');
});

// ---- Round 2: Totals Q --------------------------------------------------------
// LP/HP: product of the pair stages' target Qs. BP/notch: measured from the
// cascade with rounded parts (centre ÷ −3 dB bandwidth).
const solveAll = (st, circuit, o = {}) =>
  FH.stages.build(st).map(s => FH.solve.stage(s, circuit, {}, opts(o)));
const base4 = { poles: 4, fc: 1000, rippleDb: 1, bpQ: 10, entries: {} };

test('totalsQ: LP/HP is the product of the pair Qs (FilterPro examples)', () => {
  const cheby = solveAll(Object.assign({ passband: 'lp', response: 'chebyshev' }, base4), 'mfb');
  assert.strictEqual(R.totalsQ(cheby, 'lp').toFixed(4), '2.7922');
  const bessel = solveAll(Object.assign({ passband: 'lp', response: 'bessel' }, base4), 'mfb');
  assert.strictEqual(R.totalsQ(bessel, 'lp').toFixed(4), '0.4204');
  const butter = solveAll(Object.assign({ passband: 'hp', response: 'butterworth' }, base4), 'sk');
  assert.strictEqual(R.totalsQ(butter, 'hp').toFixed(4), '0.7071');
  // Real pole only: no pairs, no Q.
  const one = solveAll(Object.assign({ passband: 'lp', response: 'butterworth' }, base4, { poles: 1 }), 'mfb');
  assert.strictEqual(R.totalsQ(one, 'lp'), null);
});

// Measured Q, not tuned to FilterPro. FilterPro shows 9.81 (notch 1 × Q10,
// E96) and 23.97 (BP 4 × Q10); its definition is unknown. Ours: the measured
// centre ÷ −3 dB bandwidth (notch: also = R1/(2R) = 68.1k/6.80k = 10.01).
test('totalsQ: notch 1 × Q10 with E96/E6 parts measures 10.01 (FilterPro shows 9.81)', () => {
  const list = solveAll(Object.assign({ passband: 'notch', response: 'butterworth' }, base4, { poles: 1 }), 'mfb',
    { capSeries: 'E6' });
  const q = R.totalsQ(list, 'notch');
  assert.ok(Math.abs(q - 10.01) <= 0.05, `notch Q ${q}`);
});

test('totalsQ: BP 4 × Q10 with E96/E12 parts measures 23.04 (FilterPro shows 23.97)', () => {
  const list = solveAll(Object.assign({ passband: 'bp', response: 'butterworth' }, base4), 'mfb');
  const q = R.totalsQ(list, 'bp');
  assert.ok(Math.abs(q - 23.04) <= 0.1, `bp Q ${q}`);
});

test('totalsQ: one exact band-pass section measures its own Q', () => {
  const list = solveAll(Object.assign({ passband: 'bp', response: 'butterworth' }, base4, { poles: 1 }), 'mfb',
    { resSeries: 'Exact' });
  const q = R.totalsQ(list, 'bp');
  assert.ok(Math.abs(q / 10 - 1) < 0.01, `bp Q ${q}`);
});

test('totalsQ returns null for an empty list or a stage with an error', () => {
  assert.strictEqual(R.totalsQ([], 'lp'), null);
  assert.strictEqual(R.totalsQ([], 'notch'), null);
  const list = solveAll(Object.assign({ passband: 'lp', response: 'butterworth' }, base4), 'mfb');
  const bad = list.slice();
  bad[0] = { stage: list[0].stage, circuit: 'mfb', parts: null, gainActual: null, error: 'refused' };
  assert.strictEqual(R.totalsQ(bad, 'lp'), null);
  const nul = list.slice();
  nul[1] = { stage: list[1].stage, parts: null };
  assert.strictEqual(R.totalsQ(nul, 'hp'), null);
});
