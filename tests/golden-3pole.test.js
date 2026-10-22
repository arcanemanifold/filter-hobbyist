// FilterPro 3-pole cases from John's screenshots of 2026-10-22.
// MFB low-pass, 1 kHz, E96 resistors, E12 caps, R1 Seed 10k, cursor 100 Hz.
// Parts and gain/phase at 100 Hz match FilterPro exactly.
//
// The one deliberate difference: FilterPro shows the real-pole Fn as the square
// root of the true pole frequency (702.97 Hz for Chebyshev, 1.1501 kHz for
// Bessel) and bases its Req. GBP on that. Its own parts put the pole at
// 1/(2*pi*R1*C1) = 494 Hz and 1.3227 kHz, which is what we show.
const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const FH = loadFH();
const f = FH.units.formatEng;

const OPTS = { resSeries: 'E96', capSeries: 'E12', seed: 10e3 };

function design(response, entries) {
  const s = FH.state.normalize({
    passband: 'lp', circuit: 'mfb', response, poles: 3, fc: 1000, rippleDb: 1,
    resSeries: 'E96', capSeries: 'E12', seed: 10e3, cursor: 100, entries,
  });
  return FH.stages.build(s).map(st => FH.solve.stage(st, 'mfb', s.entries[st.label] || {}, OPTS));
}
const parts = s => Object.fromEntries(Object.entries(s.parts).map(([k, v]) => [k, f(v, 3)]));
const at100 = s => FH.response.point([s], 100, null);

test('Chebyshev 1 dB 3-pole: parts, Fn, Q and response at 100 Hz', () => {
  // FilterPro picked the same caps (2.20n / 120n) whether entered or not.
  for (const entries of [{}, { A: { c1: 2.2e-9, c2: 120e-9 } }]) {
    const [real, a] = design('chebyshev', entries);
    assert.deepStrictEqual(parts(real), { R1: '9.76k', C1: '33.0n' });
    assert.deepStrictEqual(parts(a), { R1: '6.49k', R2: '6.49k', R3: '15.0k', C1: '2.20n', C2: '120n' });
    assert.strictEqual(f(real.stage.fn, 5), '494.17');
    assert.strictEqual(f(a.stage.fn, 5), '997.10');
    assert.strictEqual(f(a.stage.q, 5), '2.0177');
    assert.strictEqual(at100(real).db.toFixed(2), '-0.17');
    assert.strictEqual(at100(real).deg.toFixed(1), '-11.4');
    assert.strictEqual(at100(a).db.toFixed(2), '0.08');
    assert.strictEqual(at100(a).deg.toFixed(1), '-2.9');
    assert.strictEqual(f(FH.response.requiredGBP(a), 3), '201k');
    const t = FH.response.point([real, a], 100, null);
    assert.strictEqual(t.db.toFixed(2), '-0.10');
    assert.strictEqual(t.deg.toFixed(1), '-14.4');
  }
});

test('Bessel 3-pole with C2 = 33n: parts, Q and response at 100 Hz', () => {
  // FilterPro chose C1 5.60n / C2 33.0n by itself; entering C2 = 33n gives the same stage here.
  const [real, a] = design('bessel', { A: { c2: 33e-9 } });
  assert.deepStrictEqual(parts(real), { R1: '10.0k', C1: '12.0n' });
  assert.deepStrictEqual(parts(a), { R1: '5.76k', R2: '5.76k', R3: '11.3k', C1: '5.60n', C2: '33.0n' });
  assert.strictEqual(f(a.stage.fn, 5), '1.4476k');
  assert.strictEqual(f(a.stage.q, 5), '691.05m');
  assert.strictEqual(at100(real).db.toFixed(2), '-0.02');
  assert.strictEqual(at100(real).deg.toFixed(1), '-4.3');
  assert.strictEqual(at100(a).deg.toFixed(1), '-5.7');
  const t = FH.response.point([real, a], 100, null);
  assert.strictEqual(t.db.toFixed(2), '-0.03');
  assert.strictEqual(t.deg.toFixed(1), '-10.0');
});
