/*
 * Unit tests for ui/model.js — the data layer of the redesigned app.
 * Run: node scripts/test_ui_model.js
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');

global.window = global;
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
require(path.join(root, 'data/bundle.js'));
require(path.join(root, 'data/section02_bundle.js'));
require(path.join(root, 'ui/model.js'));
const DI = window.DI;
DI.init();
DI.loadIRs(require(path.join(root, 'culvert_ir_progress_table.json')));

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); }
}
function section(name, fn) { console.log('--- ' + name); fn(); }

section('Formatting and parsing chainage', () => {
  ok(DI.fmtCh(111017.229, 3) === '111+017.229', 'three decimals');
  ok(DI.fmtCh(19999.6) === '20+000', 'kilometre rollover on rounding');
  ok(DI.fmtCh(82999.9996, 3) === '83+000.000', 'rollover with decimals');
  ok(DI.fmtPlus(111017.229, 3) === '+017.229', 'strip label');
  ok(DI.parseCh('PK 82+902,439') === 82902.439, 'decimal comma');
  ok(DI.parseCh('111+020') === 111020, 'plain');
  ok(isNaN(DI.parseCh('abc')), 'garbage');
});

section('Features load for both sub-sections with lanes and certainty', () => {
  ok(DI.data.bySub.KZDR.length > 800, 'KZDR features: ' + DI.data.bySub.KZDR.length);
  ok(DI.data.bySub.DWKZ.length > 1700, 'DWKZ features: ' + DI.data.bySub.DWKZ.length);
  ok(!DI.hasData('KNDW') && !DI.hasData('GYDT'), 'unprocessed sub-sections are present and empty');
  const all = DI.data.features;
  ok(all.every(f => f.ch0 <= f.ch1), 'start before end');
  ok(all.every(f => ['exact', 'derived', 'label'].includes(f.cert)), 'every feature has a certainty');
  ok(all.filter(f => f.catKey === 'riprap').every(f => f.kind === 'label' && f.cert === 'label'), 'riprap is a label position, never an extent');
  ok(all.filter(f => f.catKey === 'cross').every(f => f.kind === 'cross' && f.lane === 'across'), 'culverts cross the corridor');
  ok(all.filter(f => f.catKey === 'toe').every(f => f.lane === 'toe' && /^T(4|7|12|13|14)$/.test(f.code)), 'toe ditches carry their type');
  const t4 = all.find(f => f.code === 'T4');
  ok(t4 && t4.ladder.length === 3, 'unlined Type 4 has the short ladder');
  const pipe = all.find(f => /Pipe culvert Ø1\.5 m/.test(f.name));
  ok(!!pipe, 'pipe culvert named by diameter');
  const box = all.find(f => /^Single box culvert 1×\(2\.5×2\.5 m\)$/.test(f.name));
  ok(!!box, 'box culvert named by cells and size');
  ok(all.filter(f => f.side === 'L').every(f => f.offset >= 0) && all.filter(f => f.side === 'R').every(f => f.offset <= 0), 'left positive, right negative');
});

section('Sub-section lookup', () => {
  ok(DI.subAt('KM', 111020).id === 'KZDR', 'KZDR');
  ok(DI.subAt('KM', 50000).id === 'DWKZ', 'DWKZ');
  ok(DI.subAt('KM', 5000) === null, 'Kano–Dawanau has no chainage yet');
  ok(DI.subAt('KD', 111020) === null, 'branch line is separate');
});

section('Position: projection round-trip, side sign', () => {
  [[111020, 14], [111020, -9], [90000, 0.5], [50000, 30], [30000, -60]].forEach(([ch, off]) => {
    const sub = DI.subAt('KM', ch).id;
    const p = DI.pointAt(sub, ch, off);
    const q = DI.project(sub, p.lat, p.lon);
    ok(Math.abs(q.ch - ch) < 0.05, sub + ' ' + ch + ' chainage round-trip (' + (q.ch - ch).toFixed(3) + ' m)');
    ok(Math.abs(q.offset - off) < 0.05, sub + ' ' + ch + ' offset round-trip (' + (q.offset - off).toFixed(3) + ' m)');
  });
  ok(DI.laneOf(0.5) === 'cl' && DI.laneOf(3) === 'plat' && DI.laneOf(-13) === 'toe' && DI.laneOf(24) === 'crest' && DI.laneOf(80) === 'off', 'lanes by offset');
});

section('Contractor claims', () => {
  const withIr = DI.data.features.filter(f => DI.data.irs[f.id]);
  ok(withIr.length > 50, 'culverts with IRs: ' + withIr.length);
  const f = withIr[0];
  const c = DI.claimOf(f.id);
  ok(c && c.stage >= 1 && c.stage <= f.ladder.length - 1, 'claim stage within the ladder');
  ok(DI.data.irs[f.id].every((r, i, a) => i === 0 || a[i - 1].date <= r.date), 'IRs in date order');
});

section('Append-only records: undo never deletes', () => {
  const f = DI.data.bySub.KZDR.find(x => x.kind === 'cross');
  const before = DI.records.length;
  const r1 = DI.addRecord({ kind: 'stage', featureId: f.id, stage: 2 });
  ok(DI.seenOf(f.id).stage === 2, 'recorded stage is what is seen');
  const r2 = DI.addRecord({ kind: 'stage', featureId: f.id, stage: 4 });
  ok(DI.seenOf(f.id).stage === 4, 'newer record wins');
  DI.voidRecord(r2.id);
  ok(DI.seenOf(f.id).stage === 2, 'undo falls back to the earlier record');
  ok(DI.records.length === before + 3, 'the undone record is kept, plus a void');
  ok(DI.voidRecord(r2.id) === null, 'cannot void twice');
  ok(DI.records.find(r => r.id === r1.id).stage === 2, 'first record untouched');
  const lg = JSON.parse(store.KMD_DRAINAGE_INSPECTIONS_SEC03_V1)[f.id];
  ok(lg && lg.status === 'Blinding' && lg.source === 'walk', 'mirrored to the sync store');
  ok(!DI.seenOf(f.id).office, 'own mirror is not mistaken for an office record');
});

section('Defects and status', () => {
  const f = DI.data.bySub.KZDR.find(x => x.catKey === 'toe');
  const d = DI.addRecord({ kind: 'defect', featureId: f.id, defect: 'Cracking' });
  ok(DI.openDefects(f.id).length === 1, 'open defect');
  const c = DI.addRecord({ kind: 'clear', target: d.id });
  ok(DI.openDefects(f.id).length === 0, 'cleared');
  DI.voidRecord(c.id);
  ok(DI.openDefects(f.id).length === 1, 'undoing a clear re-opens');
  const st = DI.statusOf(f);
  ok(['none', 'moving', 'stalled', 'done'].includes(st.bucket), 'status bucket');
  const r = DI.addRecord({ kind: 'design', action: 'remove', featureId: f.id, source: { kind: 'revision', drawing: 'DW-1', rev: '07', level: 'A' } });
  ok(DI.statusOf(f).removed, 'removed in revision is flagged, not hidden');
  ok(DI.data.byId[f.id], 'feature still exists after removal');
  DI.voidRecord(r.id);
  ok(!DI.statusOf(f).removed, 'design change can be stepped back');
});

console.log('\n' + (fail ? 'FAILED: ' : 'ALL PASSED: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
