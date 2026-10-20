const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const FH = loadFH();
const { formatEng, SERIES } = FH.units;
const build = FH.stages.build;

// Stage targets via the real stages module, so Q values are the exact
// Butterworth ones (not 4-digit table values that could flip a rounding).
const lp = (poles, entries = {}) => build({
  passband: 'lp', response: 'butterworth', poles, fc: 1000, rippleDb: 1, bpQ: 10, entries,
});
const byLabel = (stages, label) => stages.find(s => s.label === label);

const opts = (over = {}) => Object.assign({ resSeries: 'E96', capSeries: 'E12', seed: 10e3 }, over);
const solve = (stage, circuit, entry = {}, o = {}) => FH.solve.stage(stage, circuit, entry, opts(o));

// Compare solved parts as FilterPro displays them (3 significant figures).
function expectParts(solved, expected) {
  assert.strictEqual(solved.error, null, `unexpected error: ${solved.error}`);
  for (const [name, text] of Object.entries(expected)) {
    assert.strictEqual(formatEng(solved.parts[name]), text, `${name}`);
  }
}

test('golden 1: MFB 3-pole, E6 caps, real pole defaults and stage A', () => {
  const s = lp(3);
  const o = { capSeries: 'E6' };
  expectParts(solve(byLabel(s, 'Real'), 'mfb', {}, o), { R1: '10.7k', C1: '15.0n' });
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 4.7e-9, c2: 68e-9 }, o),
    { R1: '5.62k', R2: '5.62k', R3: '14.0k', C1: '4.70n', C2: '68.0n' });
});

test('golden 2: MFB 4-pole E12 with FilterPro caps', () => {
  const s = lp(4);
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }), { R1: '6.81k', R2: '6.81k', R3: '11.3k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }), { R1: '6.34k', R2: '6.34k', R3: '12.4k' });
});

test('golden 3/4: MFB 4-pole, caps entered', () => {
  const s = lp(4);
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 6.8e-9, c2: 22e-9 }), { R1: '10.2k', R2: '10.2k', R3: '16.5k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 4.7e-9, c2: 100e-9 }), { R1: '5.23k', R2: '5.23k', R3: '10.2k' });
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 680e-12, c2: 2.2e-9 }), { R1: '102k', R2: '102k', R3: '165k' });
});

test('golden 5: MFB 4-pole, Res E24', () => {
  const s = lp(4);
  const o = { resSeries: 'E24' };
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }, o), { R1: '6.80k', R2: '6.80k', R3: '11.0k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }, o), { R1: '6.20k', R2: '6.20k', R3: '13.0k' });
});

test('golden 6: MFB 4-pole, Res Exact', () => {
  const s = lp(4);
  const o = { resSeries: 'Exact' };
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 10e-9, c2: 33e-9 }, o), { R1: '6.79k', R2: '6.79k', R3: '11.3k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 3.9e-9, c2: 82e-9 }, o), { R1: '6.37k', R2: '6.37k', R3: '12.4k' });
});

test('golden 7: MFB 4-pole, gain A = 2', () => {
  const a = byLabel(lp(4, { A: { gain: 2 } }), 'A');
  const r = solve(a, 'mfb', { c1: 6.8e-9, c2: 33e-9 });
  expectParts(r, { R1: '5.11k', R2: '10.2k', R3: '11.0k', C1: '6.80n', C2: '33.0n' });
  assert.strictEqual(r.gainActual.toFixed(3), '1.996');
});

test('golden 8: MFB 5-pole, gain 10/10, seed 4.99k', () => {
  const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } });
  const o = { seed: 4.99e3 };
  expectParts(solve(byLabel(s, 'Real'), 'mfb', {}, o), { R1: '4.87k', C1: '33.0n' });
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 3.9e-9, c2: 100e-9 }, o), { R1: '1.37k', R2: '13.7k', R3: '4.75k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 1.5e-9, c2: 270e-9 }, o), { R1: '1.30k', R2: '13.0k', R3: '4.87k' });
});

test('golden 9: MFB 5-pole, gain 10/10, seed 22k', () => {
  const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } });
  const o = { seed: 22e3 };
  expectParts(solve(byLabel(s, 'Real'), 'mfb', {}, o), { R1: '23.2k', C1: '6.80n' });
  expectParts(solve(byLabel(s, 'A'), 'mfb', { c1: 820e-12, c2: 22e-9 }, o), { R1: '6.04k', R2: '60.4k', R3: '23.2k' });
  expectParts(solve(byLabel(s, 'B'), 'mfb', { c1: 330e-12, c2: 56e-9 }, o), { R1: '6.49k', R2: '64.9k', R3: '21.0k' });
});

// Round 2: FilterPro's SK LP labels are C1 = to ground, C2 = feedback, so the
// entered caps swapped columns (same circuit, same expected resistors).
test('golden 10: SK 5-pole, gain 10/10, C1 (gnd) 39n, C2 (fb) 10n', () => {
  const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } });
  const caps = { c1: 39e-9, c2: 10e-9 };
  const a = solve(byLabel(s, 'A'), 'sk', caps);
  expectParts(a, { R1: '4.99k', R2: '13.0k', R3: '10.0k', R4: '90.9k', C1: '39.0n', C2: '10.0n' });
  expectParts(solve(byLabel(s, 'B'), 'sk', caps), { R1: '6.19k', R2: '10.5k', R3: '10.0k', R4: '90.9k' });
  assert.ok(Math.abs(a.gainActual - 10.09) < 1e-9, `gainActual ${a.gainActual}`);
});

test('default caps are realizable', () => {
  const capSeries = Object.keys(SERIES).concat('Exact');
  for (const q of [0.5, 0.707, 1.3, 3.56, 8]) {
    for (const gain of [1, 2, 10]) {
      const stage = { label: 'A', role: 'lp', kind: 'pair', fn: 1000, q, gain };
      for (const cs of capSeries) {
        for (const rs of capSeries) {
          const o = { capSeries: cs, resSeries: rs };
          const m = solve(stage, 'mfb', {}, o);
          const tag = `Q ${q} G ${gain} cap ${cs} res ${rs}`;
          assert.strictEqual(m.error, null, `mfb ${tag}: ${m.error}`);
          assert.ok(m.parts.C2 / m.parts.C1 >= 4 * q * q * (1 + gain), `mfb ratio ${tag}`);
          [m.parts.R1, m.parts.R2, m.parts.R3].forEach(r => assert.ok(r > 0 && isFinite(r), `mfb R ${tag}`));

          const k = solve(stage, 'sk', {}, o);
          assert.strictEqual(k.error, null, `sk ${tag}: ${k.error}`);
          const minRatio = 1 / (1 / (4 * q * q) + gain - 1);
          assert.ok(k.parts.C2 / k.parts.C1 >= minRatio, `sk ratio ${tag}`);
          [k.parts.R1, k.parts.R2, k.parts.R3].forEach(r => assert.ok(r > 0 && isFinite(r), `sk R ${tag}`));
        }
      }
    }
  }
});

test('refuses small C2 (MFB) and small C2/C1 (SK)', () => {
  const b = byLabel(lp(4), 'B'); // Q 1.3066
  const m = solve(b, 'mfb', { c1: 10e-9, c2: 10e-9 });
  assert.strictEqual(m.parts, null);
  assert.ok(m.error.startsWith('C2 must be ≥'), m.error);
  assert.strictEqual(m.error, 'C2 must be ≥ 137n for Q = 1.31 at gain 1');
  const k = solve(b, 'sk', { c1: 10e-9, c2: 10e-9 });
  assert.strictEqual(k.parts, null);
  assert.strictEqual(k.error, 'C2/C1 must be ≥ 6.83 for Q = 1.31 at gain 1');
});

test('refuses caps above 1uF', () => {
  const s = lp(3);
  for (const circuit of ['mfb', 'sk']) {
    const r = solve(byLabel(s, 'A'), circuit, { c2: 2 });
    assert.strictEqual(r.error, 'Capacitors are not supported above 1uF.');
    assert.strictEqual(r.parts, null);
  }
  assert.strictEqual(solve(byLabel(s, 'Real'), 'mfb', { c1: 2e-6 }).error, 'Capacitors are not supported above 1uF.');
});

test('solves at 1 Hz and 1 MHz', () => {
  for (const fc of [1, 1e6]) {
    const stages = build({ passband: 'lp', response: 'butterworth', poles: 5, fc, rippleDb: 1, bpQ: 10, entries: {} });
    for (const circuit of ['mfb', 'sk']) {
      for (const st of stages) {
        const r = solve(st, circuit);
        assert.strictEqual(r.error, null, `${fc} Hz ${circuit} ${st.label}: ${r.error}`);
        for (const [name, v] of Object.entries(r.parts)) {
          assert.ok(v > 0 && isFinite(v), `${fc} Hz ${circuit} ${st.label} ${name} = ${v}`);
          if (name[0] === 'C') assert.ok(v <= 1e-6, `${name} ${v} above 1uF`);
        }
      }
    }
  }
});

test('real pole uses entered C1', () => {
  const real = byLabel(lp(3), 'Real');
  const r = solve(real, 'mfb', { c1: 10e-9 });
  expectParts(r, { R1: '15.8k', C1: '10.0n' });
  assert.strictEqual(r.parts.C1, 10e-9); // kept as typed
});

test('C1 only: C2 follows the default rule; entered cap kept as typed', () => {
  const b = byLabel(lp(4), 'B');
  const m = solve(b, 'mfb', { c1: 4.7e-9 });
  assert.strictEqual(m.parts.C1, 4.7e-9);
  assert.ok(m.parts.C2 / m.parts.C1 >= 1.2 * 4 * b.q * b.q * 2);
  const k = solve(b, 'sk', { c1: 4.7e-9 });   // SK: C1 is the small cap, to ground
  assert.strictEqual(k.parts.C1, 4.7e-9);
  assert.ok(k.parts.C2 / k.parts.C1 >= 1.2 * 4 * b.q * b.q);
});

test('unity-gain SK omits R4', () => {
  const r = solve(byLabel(lp(4), 'A'), 'sk');
  assert.strictEqual(r.error, null);
  assert.ok(!('R4' in r.parts));
  assert.strictEqual(r.gainActual, 1);
  assert.ok(r.parts.R1 <= r.parts.R2 * 1.05, 'R1 <= R2 root (allowing rounding)');
});

test('SK refuses gain below 1', () => {
  for (const gain of [0.9, 0.5]) {
    const stage = { label: 'A', role: 'lp', kind: 'pair', fn: 1000, q: Math.SQRT1_2, gain };
    const r = solve(stage, 'sk');
    assert.strictEqual(r.parts, null, `gain ${gain}`);
    assert.strictEqual(r.error, `Sallen-Key gain must be ≥ 1 (got ${gain})`);
  }
});

// ---- A computed partner cap over 1uF (review I2) -----------------------------

test('an entered cap that forces its partner above 1uF is refused with the bound', () => {
  const b = byLabel(lp(4), 'B'); // Q = 1.31: MFB C2/C1 ≥ 13.7, SK C2(fb)/C1(gnd) ≥ 6.83
  assert.strictEqual(solve(b, 'mfb', { c1: 100e-9 }).error,
    'C1 = 100n needs C2 ≥ 1.37u, above the 1uF limit; use a smaller C1');
  assert.strictEqual(solve(b, 'sk', { c1: 470e-9 }).error,
    'C1 = 470n needs C2 ≥ 3.21u, above the 1uF limit; use a smaller C1');
});

test('the default partner settles for 1uF when that still meets the ratio', () => {
  // 68n · 13.7 = 0.93u fits under 1uF, but the 1.5x default aim (1.4u) does not.
  const b = byLabel(lp(4), 'B');
  const r = solve(b, 'mfb', { c1: 68e-9 });
  assert.strictEqual(r.error, null, r.error);
  assert.strictEqual(r.parts.C1, 68e-9);
  assert.strictEqual(r.parts.C2, 1e-6);
});

// ---- Round 2 goldens (John's FilterPro screenshots of 2026-10-20) ------------
const R = FH.response;
const dbAt = (list, f) => R.point(list, f, null).db.toFixed(2);
const build4 = (response, passband = 'lp') => build({
  passband, response, poles: 4, fc: 1000, rippleDb: 1, bpQ: 10, entries: {},
});

test('golden: Chebyshev 4-pole 1 dB MFB (ripple-edge fn, DC gain reference)', () => {
  const s = build4('chebyshev');
  const o = { capSeries: 'E6' };
  const a = solve(byLabel(s, 'A'), 'mfb', { c1: 15e-9, c2: 150e-9 }, o);
  const b = solve(byLabel(s, 'B'), 'mfb', { c1: 1.5e-9, c2: 220e-9 }, o);
  assert.strictEqual(a.stage.fn.toFixed(2), '528.58');
  assert.strictEqual(a.stage.q.toFixed(4), '0.7845');
  assert.strictEqual(b.stage.fn.toFixed(2), '993.23');
  assert.strictEqual(b.stage.q.toFixed(4), '3.5590');
  expectParts(a, { R1: '3.65k', R2: '3.65k', R3: '11.0k' });
  expectParts(b, { R1: '6.65k', R2: '6.65k', R3: '11.8k' });
  assert.strictEqual(dbAt([a], 10e3), '-51.04');
  assert.strictEqual(dbAt([b], 10e3), '-40.11');
  assert.strictEqual(dbAt([a, b], 10e3), '-91.15');
  assert.strictEqual(formatEng(R.requiredGBP(a)), '41.5k');
  assert.strictEqual(formatEng(R.requiredGBP(b)), '353k');
});

test('golden: Bessel 4-pole MFB (-3 dB normalization)', () => {
  const s = build4('bessel');
  const o = { capSeries: 'E6' };
  const a = solve(byLabel(s, 'A'), 'mfb', { c1: 6.8e-9, c2: 22e-9 }, o);
  const b = solve(byLabel(s, 'B'), 'mfb', { c1: 4.7e-9, c2: 47e-9 }, o);
  assert.strictEqual(a.stage.fn.toFixed(1), '1430.2');
  assert.strictEqual(a.stage.q.toFixed(5), '0.52193');
  assert.strictEqual(b.stage.fn.toFixed(1), '1603.4');
  assert.strictEqual(b.stage.q.toFixed(5), '0.80554');
  expectParts(a, { R1: '6.65k', R2: '6.65k', R3: '12.4k' });
  expectParts(b, { R1: '4.02k', R2: '4.02k', R3: '11.0k' });
  assert.strictEqual(dbAt([a], 1e3), '-3.16');
  assert.strictEqual(dbAt([b], 1e3), '0.14');
  assert.strictEqual(dbAt([a, b], 1e3), '-3.02');
});

test('golden: SK low-pass unity gain, FilterPro labels C1 = gnd, C2 = fb', () => {
  const s = lp(4);
  const o = { resSeries: 'E12', capSeries: 'E6' };
  const a = solve(byLabel(s, 'A'), 'sk', { c1: 15e-9, c2: 47e-9 }, o);
  const b = solve(byLabel(s, 'B'), 'sk', { c1: 6.8e-9, c2: 150e-9 }, o);
  expectParts(a, { R1: '2.20k', R2: '15.0k', C1: '15.0n', C2: '47.0n' });
  expectParts(b, { R1: '1.50k', R2: '18.0k', C1: '6.80n', C2: '150n' });
  assert.strictEqual(dbAt([a], 1e3), '-4.21');
  assert.strictEqual(dbAt([b], 1e3), '1.54');
  assert.strictEqual(dbAt([a, b], 1e3), '-2.67');
});

// Wiring by label: give every part a distinct value and find it in the netlist.
const wired = (key, parts) => R.NETLISTS[key](parts).elements
  .reduce((m, [type, a, b, v]) => Object.assign(m, { [Object.keys(parts).find(k => parts[k] === v)]: [a, b] }), {});

test('netlists use FilterPro labels (SK LP, SK HP, MFB HP)', () => {
  // SK LP: C1 from the + input (n2) to ground, C2 feedback n1 -> out.
  const sl = wired('lp/sk', { R1: 1, R2: 2, C1: 3, C2: 4 });
  assert.deepStrictEqual(sl.C1, ['n2', 'gnd']);
  assert.deepStrictEqual(sl.C2, ['n1', 'out']);
  // SK HP: R1 from the + input (n2) to ground (sets Q), R2 feedback n1 -> out.
  const sh = wired('hp/sk', { R1: 1, R2: 2, C1: 3, C2: 4 });
  assert.deepStrictEqual(sh.R1, ['n2', 'gnd']);
  assert.deepStrictEqual(sh.R2, ['n1', 'out']);
  // MFB HP: C1 input, C3 series to the − input, C2 feedback middle node -> out,
  // R1 feedback − input -> out, R2 shunt middle node -> ground.
  const mh = wired('hp/mfb', { R1: 1, R2: 2, C1: 3, C2: 4, C3: 5 });
  assert.deepStrictEqual(mh, {
    C1: ['in', 'n1'], C3: ['n1', 'n2'], C2: ['n1', 'out'], R1: ['n2', 'out'], R2: ['n1', 'gnd'],
  });
});
