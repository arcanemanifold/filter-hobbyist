const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const { build } = loadFH().stages;

const TOL = 1e-3;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= TOL * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const base = { passband: 'lp', response: 'butterworth', poles: 4, fc: 1000, rippleDb: 1, bpQ: 10, entries: {} };
const st = over => build(Object.assign({}, base, over));

test('LP Butterworth 5 at 1 kHz', () => {
  const s = st({ poles: 5 });
  assert.deepStrictEqual(Array.from(s.map(x => x.label)), ['Real', 'A', 'B']);
  s.forEach(x => { near(x.fn, 1000, 'fn'); assert.strictEqual(x.role, 'lp'); });
  assert.strictEqual(s[0].kind, 'real');
  assert.strictEqual(s[0].q, null);
  near(s[1].q, 0.618, 'qA'); near(s[2].q, 1.618, 'qB');
  s.forEach(x => assert.strictEqual(x.gain, 1));
});

test('HP Chebyshev 4 1 dB at 1 kHz', () => {
  const s = st({ passband: 'hp', response: 'chebyshev', poles: 4 });
  assert.deepStrictEqual(Array.from(s.map(x => x.label)), ['A', 'B']);
  near(s[0].fn, 1891.8, 'fnA'); near(s[1].fn, 1006.8, 'fnB');
  near(s[0].q, 0.7845, 'qA'); near(s[1].q, 3.559, 'qB');
  assert.strictEqual(s[0].role, 'hp');
});

test('BP 4 sections, Q 10', () => {
  const s = st({ passband: 'bp', poles: 4 });
  assert.deepStrictEqual(Array.from(s.map(x => x.label)), ['A', 'B', 'C', 'D']);
  s.forEach(x => {
    assert.strictEqual(x.role, 'bp'); assert.strictEqual(x.kind, 'pair');
    near(x.fn, 1000, 'fn'); assert.strictEqual(x.q, 10); assert.strictEqual(x.gain, 10);
  });
});

test('Notch is one stage', () => {
  const s = st({ passband: 'notch' });
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s[0].role, 'notch'); assert.strictEqual(s[0].label, 'A');
  near(s[0].fn, 1000, 'fn'); assert.strictEqual(s[0].q, 10); assert.strictEqual(s[0].gain, 1);
});

test('gain entries override; Real ignores gain', () => {
  const s = st({ poles: 5, entries: { A: { gain: 2 }, Real: { gain: 7 } } });
  assert.strictEqual(s[0].gain, 1);
  assert.strictEqual(s[1].gain, 2);
  assert.strictEqual(st({ passband: 'bp', poles: 2, entries: { B: { gain: 3 } } })[1].gain, 3);
});

test('order 10 gives A-E; BP 5 sections', () => {
  assert.deepStrictEqual(Array.from(st({ poles: 10 }).map(x => x.label)), ['A', 'B', 'C', 'D', 'E']);
  assert.strictEqual(st({ passband: 'bp', poles: 5 }).length, 5);
});
