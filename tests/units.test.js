const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const { parseEng, formatEng, roundToSeries, stepSeries, SERIES } = loadFH().units;

const close = (a, b) => assert.ok(Math.abs(a - b) <= Math.abs(b) * 1e-12, `${a} vs ${b}`);

test('parseEng accepts engineering forms', () => {
  const cases = {
    '4.7n': 4.7e-9, '4n7': 4.7e-9, '4700p': 4.7e-9, '10k': 1e4, '10K': 1e4,
    '20000': 2e4, '2.2u': 2.2e-6, '2µ2': 2.2e-6, '1.5M': 1.5e6, '1m': 1e-3,
    '10nF': 1e-8, '1kHz': 1e3, '10kΩ': 1e4, '10k ohm': 1e4, '100 Hz': 100,
  };
  for (const [s, v] of Object.entries(cases)) close(parseEng(s), v);
  assert.strictEqual(parseEng(''), null);
  assert.strictEqual(parseEng('   '), null);
});

test("parseEng: 'G' is giga, like 'M' is mega", () => {
  close(parseEng('1G'), 1e9);
  close(parseEng('1GHz'), 1e9);
  close(parseEng('2.5G'), 2.5e9);
});

test('parseEng rejects garbage', () => {
  for (const s of ['n', '4.7.1k', '-10n', '0', 'abc']) {
    assert.ok(Number.isNaN(parseEng(s)), s);
  }
});

test('formatEng', () => {
  assert.strictEqual(formatEng(4.7e-9), '4.70n');
  assert.strictEqual(formatEng(1.07e4), '10.7k');
  assert.strictEqual(formatEng(6.8e-10), '680p');
  assert.strictEqual(formatEng(1.02e5), '102k');
  assert.strictEqual(formatEng(1000, 4), '1.000k');
  assert.strictEqual(formatEng(999.6), '1.00k'); // rounding carries into next prefix
});

test('series tables have the standard sizes', () => {
  assert.deepStrictEqual(
    [SERIES.E6.length, SERIES.E12.length, SERIES.E24.length, SERIES.E96.length],
    [6, 12, 24, 96]);
});

test('roundToSeries', () => {
  const cases = [
    [10612, 'E96', 10700], [14125, 'E96', 14000], [28354, 'E96', 28700],
    [10304, 'E96', 10200], [12776, 'E24', 13000], [6373, 'E24', 6200],
    [15.9e-9, 'E6', 15e-9], [5.3e-9, 'E6', 4.7e-9],
  ];
  for (const [x, s, want] of cases) close(roundToSeries(x, s), want);
  assert.strictEqual(roundToSeries(1.2345e-7, 'Exact'), 1.2345e-7);
});

test('stepSeries', () => {
  close(stepSeries(68e-9, 'E12', 1), 82e-9);
  close(stepSeries(68e-9, 'E12', -1), 56e-9);
  close(stepSeries(82e-9, 'E12', 1), 100e-9); // decade wrap
  close(stepSeries(100e-9, 'E12', -1), 82e-9);
});
