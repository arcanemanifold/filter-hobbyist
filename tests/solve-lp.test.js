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

test('golden 10: SK 5-pole, gain 10/10, C1 (fb) 10n, C2 (gnd) 39n', () => {
  const s = lp(5, { A: { gain: 10 }, B: { gain: 10 } });
  const caps = { c1: 10e-9, c2: 39e-9 };
  const a = solve(byLabel(s, 'A'), 'sk', caps);
  expectParts(a, { R1: '4.99k', R2: '13.0k', R3: '10.0k', R4: '90.9k', C1: '10.0n', C2: '39.0n' });
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
          assert.ok(k.parts.C1 / k.parts.C2 >= minRatio, `sk ratio ${tag}`);
          [k.parts.R1, k.parts.R2, k.parts.R3].forEach(r => assert.ok(r > 0 && isFinite(r), `sk R ${tag}`));
        }
      }
    }
  }
});

test('refuses small C2 (MFB) and small C1/C2 (SK)', () => {
  const b = byLabel(lp(4), 'B'); // Q 1.3066
  const m = solve(b, 'mfb', { c1: 10e-9, c2: 10e-9 });
  assert.strictEqual(m.parts, null);
  assert.ok(m.error.startsWith('C2 must be ≥'), m.error);
  assert.strictEqual(m.error, 'C2 must be ≥ 137n for Q = 1.31 at gain 1');
  const k = solve(b, 'sk', { c1: 10e-9, c2: 10e-9 });
  assert.strictEqual(k.parts, null);
  assert.ok(k.error.startsWith('C1/C2 must be ≥'), k.error);
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
  const k = solve(b, 'sk', { c2: 4.7e-9 });
  assert.strictEqual(k.parts.C2, 4.7e-9);
  assert.ok(k.parts.C1 / k.parts.C2 >= 1.2 * 4 * b.q * b.q);
});

test('unity-gain SK omits R4', () => {
  const r = solve(byLabel(lp(4), 'A'), 'sk');
  assert.strictEqual(r.error, null);
  assert.ok(!('R4' in r.parts));
  assert.strictEqual(r.gainActual, 1);
  assert.ok(r.parts.R1 <= r.parts.R2 * 1.05, 'R1 <= R2 root (allowing rounding)');
});
