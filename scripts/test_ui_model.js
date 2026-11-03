/*
 * Unit tests for ui/model.js — the data layer of the redesigned app.
 * Run: node scripts/test_ui_model.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');

global.window = global;
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
require(path.join(root, 'data/bundle.js'));
require(path.join(root, 'data/section01_bundle.js'));
require(path.join(root, 'data/section04_bundle.js'));
require(path.join(root, 'data/section05_bundle.js'));
require(path.join(root, 'data/structures.js'));
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
  ok(DI.data.bySub.DWKZ.length > 1300, 'DWKZ features: ' + DI.data.bySub.DWKZ.length);
  ok(DI.hasData('KNDW') && DI.data.bySub.KNDW.length > 300, 'KNDW features from the S01 CAD: ' + DI.data.bySub.KNDW.length);
  ok(DI.hasData('DRMR') && DI.data.bySub.DRMR.length > 900, 'DRMR features from the S04 CAD and chart: ' + DI.data.bySub.DRMR.length);
  ok(DI.data.bySub.DRMR.filter(f => f.catKey === 'cross').length === 115, 'DRMR culverts from the S04 execution chart');
  ok(DI.hasData('MRJB') && DI.data.bySub.MRJB.length > 1200, 'MRJB features from the S05 CAD and chart: ' + DI.data.bySub.MRJB.length);
  ok(DI.data.bySub.MRJB.filter(f => f.catKey === 'cross').length === 111, 'MRJB culverts from the S05 execution chart');
  ok(!DI.hasData('JBMR') && !DI.hasData('GYDT'), 'unprocessed sub-sections are present and empty');
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

section('Embankment height and the Type 9 rule (S02)', () => {
  DI.loadHeights('DWKZ', JSON.parse(fs.readFileSync(path.join(root, 'data/heights_DWKZ.json'), 'utf8')));
  ok(DI.hasHeights('DWKZ') && DI.data.heights.DWKZ.length === 2526, 'S02 profile: 2526 stations every 25 m');
  const h = DI.heightAt('DWKZ', 80675, 'C');
  ok(h && Math.abs(h.h - 11.09) < 0.05 && !h.est, 'highest fill 11.09 m at 80+675, formation to ground: ' + (h && h.h.toFixed(2)));
  const a = DI.heightAt('DWKZ', 21500, 'L'), b = DI.heightAt('DWKZ', 21500, 'R');
  ok(a.side === 'L' && b.side === 'R' && a.h !== b.h, 'each side has its own height');
  ok(DI.heightAt('DWKZ', 20000, 'C').est, 'no formation level at Dawanau station: an estimate');
  const old = DI.t9Check('DWKZ', 4), now = DI.t9Check('DWKZ', 1.5);
  ok(old.km.missing < 1.5 && old.km.ok > 10, 'the 4 m rule reproduces the drawn Type 9 (' + old.km.missing.toFixed(1) + ' km not drawn)');
  ok(now.km.missing > 25 && now.runs.every(r => r.ch0 < r.ch1 && (r.side === 'L' || r.side === 'R')), 'the 1.5 m rule finds ' + now.km.missing.toFixed(1) + ' km with no Type 9 drawn');
  ok(DI.t9Rule().h === 1.8 && /3545/.test(DI.t9Rule().src) && /4218/.test(DI.t9Rule().src), 'the official 1.8 m rule is the default, citing 3545 and 4218');
});

section('Type 9 schedule from letter 4218', () => {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'data/t9_schedule.json'), 'utf8'));
  const letter = JSON.parse(fs.readFileSync(path.join(root, 'data/t9_letter_4218.json'), 'utf8')).stretches;
  const tot = Object.values(letter).reduce((m, l) => m + l.reduce((n, [a, b]) => n + b - a, 0), 0);
  ok(tot === 164625 && Object.values(letter).reduce((n, l) => n + l.length, 0) === 216, 'the letter list is 216 stretches, 164,625 m');
  ok(Object.keys(j.totals).every(k => { const t = j.totals[k]; return Math.abs(t.letter - t.bridge - t.design - t.scheduled - t.dropped) <= 5; }), 'every stretch is a bridge deck, a drawn Type 9 or a scheduled piece');
  ok(j.totals.DRMR.bridge > 1000 && j.totals.DWKZ.bridge === 0, 'S04 bridge decks (1,008 m) carry no ditch');
  const before = DI.t9Check('DWKZ', 1.8).km.missing, n0 = DI.data.bySub.DWKZ.length;
  DI.loadT9Schedule(j, DI.T9_SCHEDULE_ON);
  const sched = DI.data.bySub.DWKZ.filter(f => f.sched);
  ok(DI.T9_SCHEDULE_ON.length === 5 && ['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB'].every(s => DI.hasT9Schedule(s)), 'switched on for all five sections');
  ok(sched.length === j.pieces.filter(p => p.sub === 'DWKZ').length && DI.data.bySub.DWKZ.length === n0 + sched.length, 'S02 gets ' + sched.length + ' scheduled pieces');
  ok(j.pieces.length === DI.data.features.filter(f => f.sched).length, 'all ' + j.pieces.length + ' pieces of the schedule are in the app');
  DI.loadT9Schedule(j, DI.T9_SCHEDULE_ON);
  ok(DI.data.bySub.DWKZ.length === n0 + sched.length, 'loading twice adds nothing more');
  const p = sched[0];
  ok(p.code === 'T9' && p.sched.src.includes('4218') && p.ladder.join() === 'Not started,Completed' && (p.side === 'L' || p.side === 'R'), 'a piece is a Type 9 with a two-stage ladder (precast, reported when done)');
  ok(sched.every(f => f.ch1 - f.ch0 >= 5 && f.offset === (f.side === 'L' ? 3.5 : -3.5)), 'pieces are at least 5 m and on the platform edge');
  // every station of every S02 stretch (off the bridges) is covered by a drawn or scheduled Type 9, on either side
  const rows = DI.data.heights.DWKZ, t9 = DI.data.bySub.DWKZ.filter(f => f.code === 'T9');
  const br = DI.refs().filter(r => r.sub === 'DWKZ' && r.kind === 'bridge');
  let st = 0, cov = 0;
  letter.DWKZ.forEach(([a, b]) => rows.filter(r => r.ch >= a && r.ch <= b && !br.some(x => r.ch >= x.ch0 && r.ch <= x.ch1)).forEach(r => { st++; if (t9.some(f => r.ch >= f.ch0 - 6 && r.ch <= f.ch1 + 6)) cov++; }));
  ok(cov / st > 0.99, 'Type 9 covers ' + cov + ' of ' + st + ' stations in the letter\'s S02 stretches');
  const after = DI.t9Check('DWKZ', 1.8).km.missing;
  ok(after < before * 0.2, 'the red "not drawn" length at 1.8 m falls from ' + before.toFixed(1) + ' to ' + after.toFixed(1) + ' km');
  // progress by completed length
  const big = sched.find(f => f.ch1 - f.ch0 >= 100);
  ok(DI.rangeable(big) && !DI.rangeable(DI.data.bySub.DWKZ.find(f => f.code === 'T12')), 'Type 9 runs are tracked by length, other ditches are not');
  ok(!DI.coverOf(big) && DI.statusOf(big).bucket === 'none', 'nothing completed yet');
  const mid = (big.ch0 + big.ch1) / 2;
  const r1 = DI.addRange(big.id, big.ch0, mid);
  let st1 = DI.statusOf(big);
  ok(Math.abs(st1.cover.m - (mid - big.ch0)) < 0.2 && st1.bucket === 'moving' && st1.fill === 'ranges', 'half done: ' + Math.round(st1.cover.m) + ' of ' + Math.round(big.ch1 - big.ch0) + ' m, part-built');
  DI.addRange(big.id, mid - 10, big.ch1);
  st1 = DI.statusOf(big);
  ok(st1.cover.full && st1.bucket === 'done' && st1.fill === 'solid' && st1.cover.ranges.length === 1, 'two overlapping ranges merge, and together finish the run');
  DI.voidRecord(DI.records.filter(x => x.kind === 'range').pop().id);
  ok(!DI.statusOf(big).cover.full && DI.statusOf(big).cover.ranges.length === 1, 'undoing the last one takes its length back');
  DI.voidRecord(r1.id);
  ok(!DI.coverOf(big), 'all undone: not started again');
  DI.addRecord({ kind: 'stage', featureId: big.id, stage: 1 });
  ok(DI.coverOf(big).full && DI.statusOf(big).bucket === 'done', 'a Completed stage on the whole run counts as all of it');
  ok(DI.addRange(big.id, big.ch0, big.ch0 + 0.2) === null && DI.addRange(DI.data.bySub.DWKZ.find(f => f.code === 'T12').id, 0, 50) === null, 'a sliver, or a ditch that is not Type 9, saves nothing');
  const drawn = DI.data.bySub.DWKZ.find(f => f.code === 'T9' && !f.sched && f.ch1 - f.ch0 > 50);
  DI.addRange(drawn.id, drawn.ch0, drawn.ch0 + 30);
  ok(DI.statusOf(drawn).cover.m > 29 && DI.statusOf(drawn).bucket === 'moving', 'a drawn Type 9 takes ranges too');
  const rec = DI.addRecord({ kind: 'stage', featureId: p.id, stage: 1 });
  ok(DI.seenOf(p.id) && DI.seenOf(p.id).stage === 1, 'a piece takes a Completed record');
  DI.voidRecord(rec.id);
  const geo = DI.exportGeo('DWKZ');
  ok(!(geo.features || []).some(g => /^t9s_/.test((g.properties || {}).id || '')), 'scheduled pieces are not exported as base data');
});

section('Progress: counts for structures, length for ditches', () => {
  const tp = DI.typeProgress('DWKZ');
  const t9 = tp.find(t => t.key === 'T9'), box = tp.find(t => t.key === 'BC.pt');
  ok(t9 && t9.span && /Type 9/.test(t9.label) && t9.p.lin.m > 15000 && t9.p.pts.n === 0, 'Type 9 is a ditch type, measured by length: ' + (t9 && (t9.p.lin.m / 1000).toFixed(1)) + ' km');
  ok(box && !box.span && box.label === 'Box culverts' && box.p.pts.n > 50 && box.p.lin.n === 0, 'Box culverts are counted: ' + (box && box.p.pts.n));
  const all = DI.progressOf(DI.data.bySub.DWKZ), sum = tp.reduce((n, t) => n + t.p.pts.n + t.p.lin.n, 0);
  ok(sum === all.pts.n + all.lin.n, 'every structure is in exactly one type (' + sum + ')');
  ok(tp.every(t => t.label && !/^\s*$/.test(t.label)) && new Set(tp.map(t => t.key)).size === tp.length, 'types have names and are distinct');
  const g = tp.find(t => t.key === 'T9'), before = DI.progressOf(g.feats).lin.doneM;
  const piece = g.feats.find(f => f.sched && f.ch1 - f.ch0 > 150 && !DI.statusOf(f).cover);
  DI.addRange(piece.id, piece.ch0, piece.ch0 + 100);
  ok(Math.abs(DI.progressOf(g.feats).lin.doneM - before - 100) < 0.2, 'a completed range of 100 m adds 100 m to the Type 9 total');
  const wd = tp.find(t => t.key === 'WD.pt'), w = wd.feats[0];
  const d0 = DI.progressOf(wd.feats).pts.done;
  DI.addRecord({ kind: 'stage', featureId: w.id, stage: w.ladder.length - 1 });
  ok(DI.progressOf(wd.feats).pts.done === d0 + 1, 'a completed water descent adds one to the count');
  const whole = DI.progressOf([].concat(...['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB'].map(s => DI.data.bySub[s])));
  ok(whole.pts.n > 3000 && whole.lin.m > 300000, 'the whole project: ' + whole.pts.n + ' structures, ' + (whole.lin.m / 1000).toFixed(0) + ' km of ditch');
  ok(DI.LINES.map(l => l.id).join() === 'KM,KD' && !DI.hasData('KNYG'), 'main line has data, the branch has none yet');
});

section('Bridges and road crossings, for reference', () => {
  const all = DI.refs();
  ok(all.length > 80 && ['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB'].every(s => all.some(r => r.sub === s)), 'structures on all five sections: ' + all.length);
  const b = DI.refsNear('KM', 36300, 36310).find(r => r.kind === 'bridge');
  ok(b && b.name === 'BRG-2602' && b.ch0 === 36077 && b.ch1 === 36628, 'BRG-2602 spans 36+077 to 36+628, as the drawing says');
  ok(all.filter(r => r.kind === 'bridge').every(r => r.ch1 - r.ch0 > 20), 'every bridge has its length');
  const o = DI.refsNear('KM', 25850, 25850)[0];
  ok(o && o.kind === 'overpass' && o.name === 'OVR-2801', 'OVR-2801 is a road over the railway at 25+850');
  ok(!DI.data.features.some(f => /^ref_/.test(f.id)), 'reference structures are not drainage features');
});

section('Sub-section lookup', () => {
  ok(DI.subAt('KM', 111020).id === 'KZDR', 'KZDR');
  ok(DI.subAt('KM', 50000).id === 'DWKZ', 'DWKZ');
  ok(DI.subAt('KM', 5000).id === 'KNDW', 'KNDW');
  ok(DI.subAt('KM', -1107).id === 'KNDW', 'KNDW before Kano\'s zero');
  ok(DI.fmtCh(-1107) === '-1+107' && DI.parseCh('-1+107') === -1107, 'negative chainage reads -1+107');
  ok(DI.subAt('KM', 130000).id === 'DRMR' && DI.subAt('KM', 181000).id === 'DRMR', 'DRMR');
  ok(DI.subAt('KM', 200000).id === 'MRJB' && DI.subAt('KM', 243000).id === 'MRJB', 'MRJB');
  ok(DI.subAt('KM', 250000) === null, 'past MRJB: no chainage yet');
  const c = DI.pointAt('DRMR', 181079, 0), d = DI.pointAt('MRJB', 181081, 0);
  const gap2 = Math.hypot((c.lat - d.lat) * 110574, (c.lon - d.lon) * 111320 * Math.cos(c.lat * Math.PI / 180));
  ok(gap2 < 3, 'S04/S05 centrelines meet: ' + gap2.toFixed(2) + ' m for 2 m of chainage');
  // the S03 and S04 centrelines meet where the sub-sections do
  const a = DI.pointAt('KZDR', 124520, 0), b = DI.pointAt('DRMR', 124522, 0);
  const gap = Math.hypot((a.lat - b.lat) * 110574, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180));
  ok(gap < 3, 'S03/S04 centrelines meet: ' + gap.toFixed(2) + ' m for 2 m of chainage');
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

section('Culverts: precast ladders from the execution charts', () => {
  const box = DI.data.features.find(f => f.code === 'BC'), pipe = DI.data.features.find(f => f.code === 'PC');
  ok(box.ladder.join('>') === 'Not started>Excavation>Bedding>Installed>Apron>Wing walls>Joints>Completed', 'box: complete after paint (joints, then completed)');
  ok(pipe.ladder.join('>') === 'Not started>Excavation>Bedding>Installed>Haunched>Apron>Wing walls>Completed', 'pipe: haunched; complete after joints');
  // a record made on the old cast-in-place ladder (7 steps, 6 = Completed) is said on the new one, once
  const old = { id: 'old-1', kind: 'stage', featureId: box.id, stage: 6, at: '2026-01-01T00:00:00Z', by: 'x' };
  const old2 = { id: 'old-2', kind: 'stage', featureId: pipe.id, stage: 4, at: '2026-01-01T00:00:00Z', by: 'x' };
  DI.records.push(old, old2);
  ok(DI.migrateCulvertStages() === 2, 'two old culvert records migrated');
  ok(old.stage === box.ladder.length - 1 && old.stageName === 'Completed', 'old Completed stays Completed');
  ok(old2.stage === pipe.ladder.indexOf('Installed'), 'old Shuttered reads Installed');
  ok(DI.migrateCulvertStages() === 0, 'migration runs once');
  DI.records.splice(DI.records.indexOf(old), 1); DI.records.splice(DI.records.indexOf(old2), 1);
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
  ok(lg && lg.status === f.ladder[2] && lg.source === 'walk', 'mirrored to the sync store: ' + (lg && lg.status));
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

section('Base data: correct, add, remove, check, bake', () => {
  const n0 = DI.data.bySub.KZDR.length;
  const f = DI.data.bySub.KZDR.find(x => x.code === 'T12');
  const orig = { ch0: f.ch0, code: f.code };
  const r = DI.correctBase(f.id, { preset: 'T7', ch0: f.ch0 - 12, offsetM: 13.8, side: 'L' });
  let g = DI.data.byId[f.id];
  ok(g.code === 'T7' && g.ch0 === orig.ch0 - 12 && g.offset === 13.8 && g.lane === 'toe', 'correction applied');
  ok(g.ladder.length === 7 && g.name === 'Type 7 toe ditch', 'type change brings its name and ladder');
  DI.voidRecord(r.id);
  g = DI.data.byId[f.id];
  ok(g.code === orig.code && g.ch0 === orig.ch0, 'undo restores the extraction');
  const a = DI.addBase('KZDR', { preset: 'PC', name: 'Pipe culvert Ø1.2 m', ch0: 111031.4, side: 'C', cert: 'exact', sheet: 'DW-03021-06' });
  ok(DI.data.bySub.KZDR.length === n0 + 1 && DI.data.byId[a.featureId].kind === 'cross', 'missing feature added');
  const gone = DI.data.bySub.KZDR[3];
  DI.deleteBase(gone.id, 'Duplicate');
  ok(DI.data.bySub.KZDR.length === n0 && !DI.data.features.includes(DI.data.byId[gone.id]) && DI.data.byId[gone.id].deleted, 'removed, but still openable');
  DI.verifyBase(f.id, 'DW-03020-06');
  ok(DI.data.byId[f.id].verified && DI.data.byId[f.id].verified.sheet === 'DW-03020-06', 'checked against a sheet');
  DI.correctBase(f.id, { ch1: f.ch1 + 20 });
  // bake: export, reload from the export with no records, compare
  const geo = DI.exportGeo('KZDR');
  const src = window.SECTION03_ASSETS;
  ok(geo.features.length === src.features.length, 'feature count: one added, one removed');
  const untouched = src.features.find(x => x.properties.id === DI.data.bySub.KZDR[10].id);
  ok(geo.features.includes(untouched), 'untouched features pass through unchanged');
  const keep = { recs: store.KMD_WALK_RECORDS_V1 };
  window.SECTION03_ASSETS = geo;
  store.KMD_WALK_RECORDS_V1 = '[]';
  const mod = require.resolve(path.join(root, 'ui/model.js'));
  delete require.cache[mod]; require(mod); window.DI.init();
  const D2 = window.DI;
  ok(D2.data.byId[f.id].ch1 === f.ch1 + 20 && D2.data.byId[f.id].verified, 'baked correction survives a reload');
  ok(D2.data.byId[a.featureId] && D2.data.byId[a.featureId].name === 'Pipe culvert Ø1.2 m', 'baked addition survives a reload');
  ok(!D2.data.byId[gone.id], 'baked removal is gone');
  store.KMD_WALK_RECORDS_V1 = keep.recs;
  delete require.cache[mod]; require(mod); window.DI.init();
  ok(window.DI.data.bySub.KZDR.length === n0 - DI.data.bySub.KZDR.filter(f => f.sched).length, 're-applying the same corrections on baked data changes nothing');
  window.SECTION03_ASSETS = src;
});


section('Phase 3: As-built extents (built to a different length)', () => {
  const sched = JSON.parse(fs.readFileSync(path.join(root, 'data/t9_schedule.json'), 'utf8'));
  DI.loadT9Schedule(sched, DI.T9_SCHEDULE_ON);
  const f = DI.data.bySub.KZDR.find(x => x.code === 'T12');
  const origCh0 = f.ch0, origCh1 = f.ch1, origLen = f.ch1 - f.ch0;

  // 1. Zero/negative length rejected
  ok(DI.addExtent(f.id, 100, 100) === null, 'zero length extent rejected');
  ok(DI.addExtent(f.id, 100, 90) === null, 'negative length extent rejected');
  ok(DI.addExtent(f.id, 100, 100.2) === null, 'sub-0.5 m length extent rejected');
  ok(!f.built, 'feature has no built extent after rejected calls');

  // 2. Extending a feature
  const rExt = DI.addExtent(f.id, origCh0 - 20, origCh1 + 30, 'Extended on site');
  ok(rExt && rExt.kind === 'extent', 'valid extent record added');
  ok(f.built && f.built.ch0 === origCh0 - 20 && f.built.ch1 === origCh1 + 30, 'f.built derived correctly');
  ok(f.built.len === origLen + 50 && f.built.diffLen === 50, 'f.built lengths and differences computed');
  ok(f.ch0 === origCh0 && f.ch1 === origCh1, 'design ends f.ch0/f.ch1 never changed');

  // 3. Latest live extent wins
  const rExt2 = DI.addExtent(f.id, origCh0 - 10, origCh1 + 40, 'Second adjustment');
  ok(f.built.ch0 === origCh0 - 10 && f.built.ch1 === origCh1 + 40, 'latest live extent wins');
  DI.voidRecord(rExt2.id);
  ok(f.built.ch0 === origCh0 - 20 && f.built.ch1 === origCh1 + 30, 'undoing latest restores previous live extent');

  // 4. Undoing all extents restores f.built = null
  DI.voidRecord(rExt.id);
  ok(f.built === null, 'voiding all extents leaves f.built null');

  // 5. Scheduled feature (Letter 4218) supports extents
  const t9 = DI.data.bySub.DWKZ.find(x => x.sched && x.code === 'T9');
  ok(t9, 'found scheduled Type 9 feature');
  const t9OrigCh0 = t9.ch0, t9OrigCh1 = t9.ch1;
  const rT9 = DI.addExtent(t9.id, t9OrigCh0, t9OrigCh1 + 30);
  ok(t9.built && t9.built.ch1 === t9OrigCh1 + 30, 'extents work on scheduled features');

  // 6. Range clamping to as-built extent: can record range up to as-built end
  const rng1 = DI.addRange(t9.id, t9OrigCh1, t9OrigCh1 + 30);
  ok(rng1 && rng1.from === t9OrigCh1 && rng1.to === t9OrigCh1 + 30, 'range recorded on the extended stretch');
  const cov1 = DI.coverOf(t9);
  ok(cov1 && cov1.ranges.some(([a, b]) => b === t9OrigCh1 + 30), 'coverOf includes ranges on extended stretch');

  // 7. Shortening below completed ranges: ranges beyond new end clipped in coverOf, records intact
  const rT9Short = DI.addExtent(t9.id, t9OrigCh0, t9OrigCh1 - 10);
  const covShort = DI.coverOf(t9);
  ok(covShort.len === (t9OrigCh1 - 10) - t9OrigCh0, 'coverOf length uses shortened as-built length');
  ok(covShort.ranges.every(([a, b]) => b <= t9OrigCh1 - 10), 'ranges beyond shortened end clipped in coverOf');
  ok(DI.live(r => r.kind === 'range' && r.featureId === t9.id).length >= 1, 'underlying range records remain intact');

  // 8. Progress totals use as-built length
  const pTot = DI.progressOf([t9]);
  ok(pTot.lin.m === t9.built.len, 'progressOf uses as-built length for total metres');

  // 9. Base data exportGeo must NOT include as-built extents
  const rCADExt = DI.addExtent(f.id, origCh0 - 15, origCh1 + 25);
  const geoSec03 = DI.exportGeo('KZDR');
  const exportedCAD = geoSec03.features.find(g => (g.properties || {}).id === f.id);
  ok(exportedCAD && exportedCAD.properties.start_pk === origCh0 && exportedCAD.properties.end_pk === origCh1, 'exportGeo isolates design geometry from as-built extents');
  DI.voidRecord(rCADExt.id);

  // 10. Extending across a bridge deck
  const brgs = DI.refsNear('DWKZ', t9.ch0, 50000).filter(r => r.kind === 'bridge');
  if (brgs.length) {
    const extBridge = DI.addExtent(t9.id, brgs[0].ch0 - 50, brgs[0].ch1 + 50);
    ok(t9.built && t9.built.ch0 === brgs[0].ch0 - 50 && t9.built.ch1 === brgs[0].ch1 + 50, 'extending across bridge deck succeeds');
    DI.voidRecord(extBridge.id);
  }

  // 11. Extents with office row and sync: notes carry [extent ... to ...] and can be adopted
  DI.mirrorLegacy(t9.id);
  const legKey = 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1';
  const legRow = JSON.parse(store[legKey] || '{}')[t9.id];
  ok(legRow && /\[extent \d+(\.\d)? to \d+(\.\d)?\]/.test(legRow.notes), 'mirrorLegacy notes carry [extent ... to ...]: ' + (legRow && legRow.notes));
  const parsedExt = DI.parseExtentNote(legRow.notes);
  ok(parsedExt && parsedExt[0] === t9.built.ch0 && parsedExt[1] === t9.built.ch1, 'parseExtentNote recovers extent coordinates');

  // Clean up
  DI.voidRecord(rT9Short.id);
  DI.voidRecord(rT9.id);
  DI.voidRecord(rng1.id);
  ok(t9.built === null, 'clean up restored pristine state');
});

console.log('\n' + (fail ? 'FAILED: ' : 'ALL PASSED: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
