const test = require('node:test');
const assert = require('node:assert');
const { loadFH } = require('./harness');
const S = loadFH().state;
// FH objects come from a vm realm, so compare via JSON round-trip.
const plain = x => JSON.parse(JSON.stringify(x));

test('defaults match the global constraints', () => {
  assert.deepStrictEqual(plain(S.defaults()), {
    passband: 'lp', circuit: 'mfb', response: 'chebyshev', poles: 4, fc: 1000, rippleDb: 1, bpQ: 10,
    resSeries: 'E96', capSeries: 'E12', seed: 10000, cursor: 10000, entries: {}, gbw: null, showReal: false,
  });
});

test('round-trips through the hash, entries included', () => {
  const s = Object.assign(S.defaults(), {
    passband: 'hp', circuit: 'sk', response: 'bessel', poles: 5, fc: 2500.5, gbw: 1e6, showReal: true,
    resSeries: 'Exact', capSeries: 'E24', seed: 4700, cursor: 123.4, rippleDb: 0.5,
    entries: { A: { c1: 4.7e-9, gain: 2 }, B: { c2: 1e-8 } },
  });
  const n = plain(S.normalize(s));
  assert.deepStrictEqual(plain(S.decodeHash(S.encodeHash(s))), n);
  assert.deepStrictEqual(plain(S.decodeHash('#' + S.encodeHash(s))), n);
  assert.match(S.encodeHash(s), /A\.c1=4\.7e-9/);
  assert.deepStrictEqual(plain(S.decodeHash(S.encodeHash(S.defaults()))), plain(S.defaults()));
});

test('decodeHash tolerates garbage', () => {
  const s = plain(S.decodeHash('#poles=abc&fc=-5&zz=1&A.c1=x'));
  assert.strictEqual(s.poles, 4);
  assert.strictEqual(s.fc, 1000);
  assert.deepStrictEqual(s.entries, {});
  assert.deepStrictEqual(plain(S.decodeHash('')), plain(S.defaults()));
  assert.deepStrictEqual(plain(S.decodeHash('#%%%&=&&a')), plain(S.defaults()));
  assert.deepStrictEqual(plain(S.decodeHash('#passband=zzz&circuit=q&resSeries=E3&capSeries=E96')), plain(S.defaults()));
});

test('normalize drops overrides for missing rows', () => {
  const s = S.normalize(Object.assign(S.defaults(), {
    poles: 4, entries: { A: { c1: 1e-9 }, B: { c1: 2e-9 }, C: { c1: 3e-9 }, D: {}, E: { c1: 5e-9 }, Real: { c1: 1e-9 } },
  }));
  assert.deepStrictEqual(Object.keys(s.entries).sort(), ['A', 'B']);
});

test('normalize keeps Real row when still present, drops it otherwise', () => {
  const e = { Real: { c1: 1e-9 }, A: { c1: 2e-9 } };
  assert.deepStrictEqual(Object.keys(S.normalize(Object.assign(S.defaults(), { poles: 5, entries: e })).entries).sort(), ['A', 'Real']);
  assert.deepStrictEqual(Object.keys(S.normalize(Object.assign(S.defaults(), { poles: 4, entries: e })).entries), ['A']);
});

test('entries keep only finite positive numbers, field by field', () => {
  const s = S.normalize(Object.assign(S.defaults(), {
    entries: { A: { c1: 1e-9, c2: -1, c3: 'x', gain: 0, bogus: 5 }, B: { c1: NaN }, C: 7 },
  }));
  assert.deepStrictEqual(plain(s.entries), { A: { c1: 1e-9 } });
});

test('clamps poles, ripple, bpQ', () => {
  const n = o => plain(S.normalize(Object.assign(S.defaults(), o)));
  assert.strictEqual(n({ poles: 99 }).poles, 10);
  assert.strictEqual(n({ poles: 0 }).poles, 1);
  assert.strictEqual(n({ poles: 99, passband: 'bp' }).poles, 5);
  assert.strictEqual(n({ poles: 99, passband: 'notch' }).poles, 5);
  assert.strictEqual(n({ poles: 2.6 }).poles, 3);
  assert.strictEqual(n({ rippleDb: 0 }).rippleDb, 0.01);
  assert.strictEqual(n({ rippleDb: 9 }).rippleDb, 3);
  assert.strictEqual(n({ bpQ: 0 }).bpQ, 0.5);
  assert.strictEqual(n({ bpQ: 1e6 }).bpQ, 100);
  assert.strictEqual(n({ bpQ: NaN }).bpQ, 10);
});

test('positive-finite fields fall back to defaults; gbw may be null', () => {
  const n = o => plain(S.normalize(Object.assign(S.defaults(), o)));
  for (const k of ['fc', 'seed', 'cursor']) {
    for (const bad of [0, -1, NaN, Infinity, 'x', null]) assert.strictEqual(n({ [k]: bad })[k], S.defaults()[k], `${k}=${bad}`);
  }
  assert.strictEqual(n({ gbw: 0 }).gbw, null);
  assert.strictEqual(n({ gbw: -5 }).gbw, null);
  assert.strictEqual(n({ gbw: 2e6 }).gbw, 2e6);
});

test('series and enum fields fall back to defaults', () => {
  const n = o => plain(S.normalize(Object.assign(S.defaults(), o)));
  assert.strictEqual(n({ capSeries: 'E96' }).capSeries, 'E12');
  assert.strictEqual(n({ capSeries: 'Exact' }).capSeries, 'E12');
  assert.strictEqual(n({ resSeries: 'E6' }).resSeries, 'E96');
  assert.strictEqual(n({ resSeries: 'E24' }).resSeries, 'E24');
  assert.strictEqual(n({ passband: 'x' }).passband, 'lp');
  assert.strictEqual(n({ response: 'x' }).response, 'chebyshev');
  assert.strictEqual(n({ showReal: 'yes' }).showReal, false);
});

test('normalize survives non-objects', () => {
  for (const bad of [null, undefined, 5, 'x', []]) assert.deepStrictEqual(plain(S.normalize(bad)), plain(S.defaults()));
});

test('BP forces mfb', () => {
  assert.strictEqual(S.normalize(Object.assign(S.defaults(), { passband: 'bp', circuit: 'sk' })).circuit, 'mfb');
  assert.strictEqual(S.decodeHash('#passband=bp&circuit=sk').circuit, 'mfb');
  assert.strictEqual(S.normalize(Object.assign(S.defaults(), { passband: 'hp', circuit: 'sk' })).circuit, 'sk');
});

test('initial precedence: hash > storage > defaults', () => {
  const store = v => ({ getItem: k => (k === 'fh.last' ? v : null) });
  const saved = JSON.stringify(Object.assign(S.defaults(), { fc: 500, poles: 3 }));
  assert.strictEqual(S.initial('#fc=2000', store(saved)).fc, 2000);
  assert.strictEqual(S.initial('', store(saved)).fc, 500);
  assert.strictEqual(S.initial('', store(saved)).poles, 3);
  assert.deepStrictEqual(plain(S.initial('', null)), plain(S.defaults()));
  assert.deepStrictEqual(plain(S.initial('', store(null))), plain(S.defaults()));
  assert.deepStrictEqual(plain(S.initial('', store('{not json'))), plain(S.defaults()));
  assert.deepStrictEqual(plain(S.initial('', store('{"fc":"x","poles":99,"zz":1}'))), plain(Object.assign(S.defaults(), { poles: 10 })));
  assert.deepStrictEqual(plain(S.initial('', { getItem() { throw new Error('blocked'); } })), plain(S.defaults()));
});

test('inherited and __proto__ labels are ignored, no prototype pollution', () => {
  const vmProto = Object.getPrototypeOf(S.defaults().entries);
  const check = s => {
    assert.deepStrictEqual(Object.keys(s.entries), []);
    assert.strictEqual(({}).c1, undefined);
    assert.strictEqual(vmProto.c1, undefined);
  };
  check(S.decodeHash('#__proto__.c1=5&toString.c1=5&constructor.c1=5&hasOwnProperty.gain=2'));
  check(S.initial('', { getItem: () => '{"entries":{"__proto__":{"c1":5},"toString":{"c1":5},"constructor":{"c1":5}}}' }));
  check(S.normalize(JSON.parse('{"entries":{"__proto__":{"c1":5}}}')));
});
