const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const { prototype } = loadFH().poles;

const TOL = 1e-3;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= TOL, `${msg}: ${a} vs ${b}`);

// Compare a prototype against expected [kind, wn, q?] rows.
function check(stages, expected) {
  assert.strictEqual(stages.length, expected.length);
  expected.forEach((e, i) => {
    assert.strictEqual(stages[i].kind, e[0], `stage ${i} kind`);
    near(stages[i].wn, e[1], `stage ${i} wn`);
    if (e[0] === 'pair') near(stages[i].q, e[2], `stage ${i} q`);
  });
}

// Magnitude (dB) at w = 1 of the cascade of unity-DC-gain stages.
function dbAt1(stages) {
  let mag = 1;
  for (const s of stages) {
    if (s.kind === 'real') mag *= s.wn / Math.hypot(s.wn, 1);
    else mag *= s.wn * s.wn / Math.hypot(s.wn * s.wn - 1, s.wn / s.q);
  }
  return 20 * Math.log10(mag);
}

test('Butterworth 4 and 5', () => {
  check(prototype('butterworth', 4, 0), [['pair', 1, 0.5412], ['pair', 1, 1.3066]]);
  check(prototype('butterworth', 5, 0), [['real', 1], ['pair', 1, 0.6180], ['pair', 1, 1.6180]]);
});

test('Chebyshev 4 (1 dB) and 5 (0.5 dB)', () => {
  check(prototype('chebyshev', 4, 1), [['pair', 0.5286, 0.7845], ['pair', 0.9932, 3.5590]]);
  check(prototype('chebyshev', 5, 0.5),
    [['real', 0.3623], ['pair', 0.6905, 1.1778], ['pair', 1.0177, 4.5450]]);
});

test('Bessel 3 and 4', () => {
  check(prototype('bessel', 4, 0), [['pair', 1.4302, 0.5219], ['pair', 1.6034, 0.8055]]);
  check(prototype('bessel', 3, 0), [['real', 1.3227], ['pair', 1.4476, 0.6910]]);
});

test('gain at w=1 matches the normalization', () => {
  for (const n of [2, 3, 4, 5, 8, 9]) {
    near(dbAt1(prototype('butterworth', n, 0)), -3.010, `butterworth ${n}`);
    near(dbAt1(prototype('bessel', n, 0)), -3.010, `bessel ${n}`);
  }
  // Odd order: DC gain is the peak, so the ripple edge is -1 dB from DC.
  for (const n of [3, 5, 7]) near(dbAt1(prototype('chebyshev', n, 1)), -1.0, `cheby ${n}`);
  // Even order: DC sits at the bottom of a ripple valley, so the edge equals
  // DC gain (0 dB relative to unity-DC stages; -1 dB below the ripple peaks).
  for (const n of [2, 4, 6]) near(dbAt1(prototype('chebyshev', n, 1)), 0, `cheby ${n}`);
});

test('orders 1-10 return ceil(n/2) stages, real pole first, Q ascending', () => {
  for (const r of ['butterworth', 'bessel', 'chebyshev']) {
    for (let n = 1; n <= 10; n++) {
      const st = prototype(r, n, 1);
      assert.strictEqual(st.length, Math.ceil(n / 2), `${r} ${n}`);
      assert.strictEqual(st.filter(s => s.kind === 'real').length, n % 2);
      if (n % 2) assert.strictEqual(st[0].kind, 'real');
      const qs = st.filter(s => s.kind === 'pair').map(s => s.q);
      for (let i = 1; i < qs.length; i++) assert.ok(qs[i] > qs[i - 1], `${r} ${n} Q order`);
    }
  }
});
