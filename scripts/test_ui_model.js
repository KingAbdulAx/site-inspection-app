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
  ok(p.code === 'T9' && p.sched.src.includes('4218') && p.ladder.join() === 'Not started,Excavation,Blinding,Placed,Mortared' && (p.side === 'L' || p.side === 'R'), 'a piece is a Type 9 on the precast ladder');
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
  ok(DI.rangeable(big) && DI.rangeable(DI.data.bySub.DWKZ.find(f => f.code === 'T12')) && !DI.rangeable(DI.data.bySub.DWKZ.find(f => f.code === 'BC')), 'every ditch along the line is tracked by length; a culvert is not');
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
  DI.addRecord({ kind: 'stage', featureId: big.id, stage: big.ladder.length - 1 });
  ok(DI.coverOf(big).full && DI.statusOf(big).bucket === 'done', 'a finished stage on the whole run counts as all of it');
  ok(DI.addRange(big.id, big.ch0, big.ch0 + 0.2) === null && DI.addRange(DI.data.bySub.DWKZ.find(f => f.code === 'BC').id, 0, 50) === null, 'a sliver, or a culvert, saves nothing');
  const drawn = DI.data.bySub.DWKZ.find(f => f.code === 'T9' && !f.sched && f.ch1 - f.ch0 > 50);
  DI.addRange(drawn.id, drawn.ch0, drawn.ch0 + 30);
  ok(DI.statusOf(drawn).cover.m > 29 && DI.statusOf(drawn).bucket === 'moving', 'a drawn Type 9 takes ranges too');
  const rec = DI.addRecord({ kind: 'stage', featureId: p.id, stage: p.ladder.length - 1 });
  ok(DI.seenOf(p.id) && DI.seenOf(p.id).stage === p.ladder.length - 1, 'a piece takes a finished record');
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


section('Phase 4: Automatic joins when spans overlap', () => {
  // Find two same-sub, same-side, same-lane linear features
  const sub = 'DWKZ';
  const t9List = DI.data.bySub[sub].filter(x => x.code === 'T9' && x.side === 'R' && x.lane === 'plat' && !DI.coverOf(x) && !DI.seenOf(x.id));
  ok(t9List.length >= 2, 'found at least two clean Type 9 spans on R plat in DWKZ: ' + t9List.length);
  const fA = t9List[0];
  const fB = t9List[1];

  // 1. Overlap detection
  // Gap > 0.5 m returns null
  const noJoin = DI.detectJoins(fA.id, 1000, 1050);
  // (Assuming fB is not at 1000..1050)
  ok(noJoin === null || !noJoin.absorbed.includes(fB), 'gap > 0.5 m does not join across gap');

  // Overlap or touching within 0.5 m: set proposed extent of fA to touch fB.ch0
  const fBExt = DI.extentEnds(fB);
  const touchJoin = DI.detectJoins(fA.id, fBExt[0] - 100, fBExt[0] - 0.2);
  ok(touchJoin !== null && touchJoin.allPieces.some(p => p.id === fB.id), 'ends touching within 0.5 m detected as overlap');

  // Overlap sharing length
  const overlapJoin = DI.detectJoins(fA.id, fBExt[0] - 50, fBExt[0] + 50);
  ok(overlapJoin !== null && overlapJoin.allPieces.some(p => p.id === fB.id), 'extents sharing length detected as overlap');
  ok(overlapJoin.from === Math.min(fBExt[0] - 50, fBExt[0]) && overlapJoin.to === Math.max(fBExt[0] + 50, fBExt[1]), 'union extent computed correctly');

  // 2. Execute join
  const primaryId = overlapJoin.primary.id;
  const absIds = overlapJoin.absorbed.map(p => p.id);
  const rExt = DI.addExtent(fA.id, fBExt[0] - 50, fBExt[0] + 50);
  const rJoin = DI.addJoin(primaryId, absIds);
  ok(rJoin && rJoin.into === primaryId, 'join record added successfully');

  const prim = DI.data.byId[primaryId];
  ok(prim.absorbed && prim.absorbed.length === absIds.length, 'primary lists absorbed pieces');
  absIds.forEach(id => {
    ok(DI.data.byId[id].absorbedInto === primaryId, 'absorbed piece has absorbedInto set to primary');
  });
  ok(prim.built && prim.built.ch0 === overlapJoin.from && prim.built.ch1 === overlapJoin.to, 'primary feature has union as-built extent: ' + prim.built.ch0 + ' to ' + prim.built.ch1);

  // 3. Progress totals do NOT double count absorbed features
  const progBoth = DI.progressOf([prim, ...prim.absorbed]);
  ok(progBoth.lin.n === 1, 'progressOf counts joined run as 1 span instead of multiple');
  ok(progBoth.lin.m === prim.built.len, 'progressOf uses union length for total metres');

  // 4. Records on absorbed piece count towards joined coverOf
  const absFeat = prim.absorbed[0];
  const absExt = DI.extentEnds(absFeat);
  const rngOnAbs = DI.addRange(absFeat.id, absExt[0], absExt[0] + 20);
  const covPrim = DI.coverOf(prim);
  ok(covPrim && covPrim.ranges.some(([a, b]) => Math.abs(b - a - 20) < 0.2), 'coverOf on primary includes range recorded on absorbed piece');

  // Completed stage on absorbed piece counts as that piece entire extent
  const absLadderMax = absFeat.ladder.length - 1;
  const rStageAbs = DI.addRecord({ kind: 'stage', featureId: absFeat.id, stage: absLadderMax, line: absFeat.line, sub: absFeat.sub });
  const covPrimStage = DI.coverOf(prim);
  ok(covPrimStage.m >= (absExt[1] - absExt[0]), 'completed stage on absorbed piece counts its whole extent towards joined run');

  // 5. 3-way join handling
  if (t9List.length >= 3) {
    const fC = t9List[2];
    const fCExt = DI.extentEnds(fC);
    // Join fC as well
    const rJoin3 = DI.addJoin(primaryId, [absFeat.id, fC.id]);
    ok(prim.absorbed.length === 2, '3-way join absorbs two pieces into primary');
    DI.voidRecord(rJoin3.id);
  }

  // 6. Undo of the join reverts cleanly
  DI.voidRecord(rStageAbs.id);
  DI.voidRecord(rngOnAbs.id);
  DI.voidRecord(rJoin.id);
  DI.voidRecord(rExt.id);

  ok(prim.absorbed === null, 'undoing join clears primary.absorbed');
  absIds.forEach(id => {
    ok(DI.data.byId[id].absorbedInto === null, 'undoing join clears absorbedInto on absorbed piece');
  });
  ok(fA.built === null, 'undoing extent restores original null built state');
});


section('Phase 5: stages by construction method, and by length for every ditch', () => {
  const KZ = DI.data.bySub.KZDR, DW = DI.data.bySub.DWKZ;
  const t12 = KZ.find(f => f.code === 'T12' && f.ch1 - f.ch0 > 200 && !DI.coverOf(f));
  const t4 = DW.find(f => f.code === 'T4' && f.ch1 - f.ch0 > 50 && !DI.coverOf(f));
  const t6 = DW.find(f => f.code === 'T6' && f.kind === 'buried');
  const wd = DW.find(f => f.code === 'WD');
  ok(t12.ladder.join('>') === 'Not started>Excavation>Surface prep>Formwork>Reinforcement>Cast>Completed / approved', 'cast in situ: formwork before reinforcement, then cast, then completed / approved');
  ok(t4.ladder.join('>') === 'Not started>Excavation>Profiling', 'unlined: excavation, then profiling');
  ok(t6 && t6.ladder.length === 9 && t6.ladder[2] === 'Stone dust bedding' && t6.ladder[8] === 'Geotextile wrapped' && DI.rangeable(t6), 'Type 6 French drain: eight stages, tracked by length');
  ok(wd.ladder.join('>') === 'Not started>Excavation>Blinding>Placed>Mortared', 'chutes are precast: excavation, blinding, placed, mortared');
  // stages by length
  const a = t12.ch0, L = t12.ch1 - t12.ch0;
  const rA = DI.addRange(t12.id, a, a + 150, null, 1);   // excavated 150 m
  const rB = DI.addRange(t12.id, a, a + 80, null, 3);    // formwork on the first 80 m
  let st = DI.statusOf(t12), c = st.cover;
  ok(c && Math.round(c.mAt[1]) === 150 && Math.round(c.mAt[3]) === 80 && Math.round(c.mAt[2]) === 80 && c.m === 0, 'a higher stage counts at every stage below it: excavated 150, formwork 80, finished 0');
  ok(st.bucket === 'moving' && st.s === 3 && c.floor === 0 && c.segs.length === 2, 'part-built at Formwork, two lengths');
  const lg = JSON.parse(store.KMD_DRAINAGE_INSPECTIONS_SEC03_V1)[t12.id];
  ok(lg.status === 'Rebar / Shuttering' && /\[stages Excavation: [\d.]+ to [\d.]+; Formwork: [\d.]+ to [\d.]+\]/.test(lg.notes) && !/done/.test(lg.notes), 'the cloud row: the furthest stage as status, each length under its stage in the notes: ' + lg.notes);
  const back = DI.parseStageNote(lg.notes);
  ok(back.length === 2 && back[0].name === 'Excavation' && Math.round(back[0].b - back[0].a) === 70 && back[1].name === 'Formwork', 'the note reads back');
  // the whole stretch at a stage, then a finished part
  const rW = DI.addRecord({ kind: 'stage', featureId: t12.id, stage: 1 });
  c = DI.coverOf(t12);
  ok(Math.round(c.mAt[1]) === Math.round(L) && c.floor === 1 && Math.round(c.mAt[3]) === 80, 'the whole stretch excavated, the first 80 m still at formwork');
  const rC = DI.addRange(t12.id, a, a + 40);
  c = DI.coverOf(t12);
  ok(Math.round(c.m) === 40 && !c.full && Math.round(c.mAt[5]) === 40, 'a range with no stage is finished: 40 m');
  const lg2 = JSON.parse(store.KMD_DRAINAGE_INSPECTIONS_SEC03_V1)[t12.id];
  ok(lg2.status === 'Concreted' && /\[done [\d.]+ to [\d.]+\]/.test(lg2.notes) && !/T9 done/.test(lg2.notes), 'part finished: Concreted, and the finished part as [done …] (not a Type 9): ' + lg2.notes);
  const p0 = DI.progressOf([t12]);
  ok(Math.round(p0.lin.atLeast.Excavation) === Math.round(L) && Math.round(p0.lin.atLeast.Formwork) === 80 && Math.round(p0.lin.doneM) === 40 && p0.lin.names.join() === t12.ladder.slice(1).join(), 'Progress has the metres at each stage, in ladder order');
  [rC, rW, rB, rA].forEach(r => DI.voidRecord(r.id));
  ok(!DI.coverOf(t12) && JSON.parse(store.KMD_DRAINAGE_INSPECTIONS_SEC03_V1)[t12.id].status === 'Not Started', 'all undone: not started, the row follows');
  // an office row: a whole-run status, the old executed note, staged notes
  const KEY = 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1', put = rows => { store[KEY] = JSON.stringify(Object.assign(JSON.parse(store[KEY] || '{}'), rows)); DI.loadLegacy(); };
  put({ [t4.id]: { status: 'Excavation', notes: '', updated_at: '2026-11-01T10:00:00+00:00', inspected_by: 'office' } });
  c = DI.coverOf(t4);
  ok(c && c.floor === 1 && !c.full && DI.statusOf(t4).s === 1, 'an office status with no ranges is the whole run at that stage');
  const t1 = DW.find(f => f.code === 'T1' && f.ch1 - f.ch0 > 300);
  const ea = DI.fmtCh(t1.ch0 + 10), eb = DI.fmtCh(t1.ch0 + 110);
  put({ [t1.id]: { status: 'Concreted', notes: 'Ditch progress T1 30/09/26 · 100 of ' + Math.round(t1.ch1 - t1.ch0) + ' m executed (' + ea + '–' + eb + ')', updated_at: '2026-10-01T10:00:00+00:00', inspected_by: 'Ditch progress T1 30/09/26' } });
  c = DI.coverOf(t1);
  ok(c && Math.round(c.mAt[5]) === 100 && c.m === 0 && c.floor === 0, 'an older import row ("100 m executed (a–b)") reads as 100 m cast, not the whole run');
  // a phone adds a part on top of an office row: the row it writes still has the office's stages
  const r6 = DI.addRange(t1.id, t1.ch0 + 200, t1.ch0 + 260, null, 1);
  const lg3 = JSON.parse(store[KEY])[t1.id];
  const sn = DI.parseStageNote(lg3.notes);
  ok(lg3.source === 'walk' && sn.some(x => x.name === 'Cast' && Math.round(x.b - x.a) === 100) && sn.some(x => x.name === 'Excavation' && Math.round(x.b - x.a) === 60), 'adding to an office row keeps its cast 100 m: ' + lg3.notes);
  DI.voidRecord(r6.id);
  // old records on the old ladders say the same thing on the new ones
  const rOld = { id: 'old-1', at: '2026-10-01T00:00:00Z', by: 'x', kind: 'stage', featureId: t12.id, stage: 3, stageName: 'Rebar' };
  const rOld2 = { id: 'old-2', at: '2026-10-01T00:00:00Z', by: 'x', kind: 'stage', featureId: t4.id, stage: 1, stageName: 'Excavated' };
  const t9p = DW.find(f => f.sched);
  const rOld3 = { id: 'old-3', at: '2026-10-01T00:00:00Z', by: 'x', kind: 'stage', featureId: t9p.id, stage: 1, stageName: 'Completed' };
  DI.importRecords([rOld, rOld2, rOld3]);
  ok(DI.migrateStageNames() === 3, 'three old stage records migrated');
  const m1 = DI.records.find(r => r.id === 'old-1'), m2 = DI.records.find(r => r.id === 'old-2'), m3 = DI.records.find(r => r.id === 'old-3');
  ok(m1.stageName === 'Reinforcement' && m1.stage === 4 && m1.wasStage.name === 'Rebar', 'old Rebar is Reinforcement now (formwork comes first)');
  ok(m2.stageName === 'Excavation' && m2.stage === 1, 'old Excavated is Excavation');
  ok(m3.stage === t9p.ladder.length - 1 && m3.stageName === 'Mortared', 'a Type 9 piece Completed on the old two-stage ladder is Mortared (finished)');
  ok(DI.migrateStageNames() === 0, 'migration runs once');
  ok(DI.legacyStage(t12, 'Rebar / Shuttering') === 3 && DI.legacyStage(t12, 'Concreted') === 5 && DI.legacyStage(t9p, 'Concreted') === 3 && DI.legacyStage(t4, 'Completed & Approved') === 2, 'database words on each ladder');
});


section('Phase 5b: stations and yards, for reference like bridges', () => {
  const areas = DI.refs().filter(r => r.area);
  const st = areas.filter(r => r.kind === 'station'), yd = areas.filter(r => r.kind === 'yard');
  ok(st.length === 12 && yd.length === 6 && yd.filter(r => r.what === 'maintenance').length === 2, 'twelve stations, four freight yards and two maintenance centres: ' + st.length + ', ' + yd.length);
  const names = st.map(r => r.name.replace(' Station', '')).join();
  ok(names === 'Dawanau,Kunya,Dambatta,Kazaure,Durbe,Daura,Shargalle,Mashi,Muduru,Katsina,Daddara,Jibiya', 'the stations in order along the line: ' + names);
  ok(areas.every(r => r.ch1 > r.ch0 && r.line === 'KM' && DI.SUBS[r.sub] && r.source && r.id), 'each has an extent, a sub-section, its drawing and an id');
  ok(st.filter(r => r.platform).every(r => r.platform[1] - r.platform[0] > 300 && r.platform[0] >= r.ch0 - 1 && r.platform[1] <= r.ch1 + 1), 'platforms (about 350 m) lie within their station');
  const kz = DI.areasAt('KM', 83500);
  ok(kz.length === 1 && kz[0].name === 'Kazaure Station' && kz[0].sub === 'KZDR', 'at 83+500: Kazaure station');
  ok(DI.areasAt('KM', 80000).some(r => r.name === 'Kazaure freight yard' && r.side === 'R'), 'at 80+000: Kazaure freight yard, on the right');
  ok(!DI.areasAt('KM', 140000).length, 'open line has none');
  ok(DI.refById(kz[0].id) === kz[0] && DI.refsNear('KM', 83400, 83600).includes(kz[0]), 'found like any reference structure');
  ok(st.find(r => /Kunya/.test(r.name)).note.includes('no platform'), 'a station with nothing drawn yet says so');
  ok(DI.refs().filter(r => r.kind === 'bridge').length === DI.refs().filter(r => r.kind === 'bridge' && !r.area).length, 'bridges are unchanged');
});


section('Phase 6: connectors from the drainage plans', () => {
  const j = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data/connectors.json'), 'utf8'));
  const n0 = DI.data.features.length;
  DI.loadConnectors(j);
  const conn = DI.data.features.filter(f => f.conn);
  ok(conn.length > 2000 && DI.data.features.length === n0 + conn.length, 'connection boxes, manholes and outlet pipes are features: ' + conn.length);
  DI.loadConnectors(j);
  ok(DI.data.features.filter(f => f.conn).length === conn.length, 'loading twice adds nothing more');
  const cb = DI.data.features.filter(f => f.code === 'CB'), mh = DI.data.features.filter(f => f.code === 'MH');
  ok(cb.length > 1500 && cb.every(f => DI.ladderKind(f.ladder) === 'insitu'), 'connection boxes are cast in situ: ' + cb.length);
  const exits = mh.filter(f => f.conn.exit);
  ok(exits.length > 10 && exits.length < 40 && exits.every(f => DI.ladderKind(f.ladder) === 'insitu') && mh.filter(f => !f.conn.exit).every(f => DI.ladderKind(f.ladder) === 'precast'), 'manholes are precast, except the one at each outlet: ' + exits.length + ' of ' + mh.length);
  ok(conn.every(f => f.kind === 'point' && Math.abs(f.offset) < 400 && f.ch0 === f.ch1 && DI.LANES.concat(['cl']).includes(f.lane)), 'each sits at its true offset, in the lane that offset falls in');
  // a ditch that runs from a dissipator into a connection box, and both ways round
  const t = DI.data.bySub.KZDR.find(f => f.code === 'T12' && DI.endsOf(f).start && DI.endsOf(f).end);
  const e = DI.endsOf(t);
  ok(Math.abs(e.start.ch0 - t.ch0) < 16 && Math.abs(e.end.ch0 - t.ch1) < 16, 'a ditch names what each end runs into, near that end');
  const back = DI.joinsOf(e.end);
  ok(back.some(x => x.f === t && x.end === 'end'), 'and the connector names the ditch, at its end');
  const ds = DI.data.features.find(f => /^D-/.test(f.code) && DI.joinsOf(f).length);
  ok(ds && !ds.conn && DI.joinsOf(ds).every(x => DI.isSpan(x.f) || x.f.code === 'WD'), 'a dissipator of the plans is the app\'s own, with what runs into it');
  ok(mh.filter(f => DI.joinsOf(f).some(x => x.end === 'on' && x.f.code === 'T6')).length > mh.length * 0.8, 'manholes sit on their Type 6 runs');
  const tp = DI.typeProgress('DWKZ');
  ok(tp.some(x => x.key === 'CB.pt' && x.label === 'Connection boxes' && x.p.pts.n > 400), 'Progress counts connection boxes as a type');
  // a connector is built like anything else
  const box = cb.find(f => f.sub === 'DWKZ');
  DI.addRecord({ kind: 'stage', featureId: box.id, stage: box.ladder.length - 1 });
  ok(DI.statusOf(box).bucket === 'done', 'a connection box takes a stage record');
  ok(Object.keys(j.geom).length > 1000 && DI.geomOf(t) && DI.geomOf(t).every(p => p.length === 4), 'ditches have their plan geometry for the plan view');
});


section('Phases 8 and 9: Type 6 networks, road drainage', () => {
  const j = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data/networks.json'), 'utf8'));
  const before = DI.data.features.filter(f => f.code === 'T6' && f.kind === 'buried').length;
  DI.loadNetworks(j);
  const F = DI.data.features, legs = F.filter(f => /^t6_/.test(f.id)), pipes = F.filter(f => f.code === 'CP');
  ok(legs.length > 200 && legs.every(f => f.kind === 'buried' && f.len > 0 && DI.ladderKind(f.ladder) === 'french'), 'Type 6 is cut into legs with their own length: ' + legs.length + ' (was ' + before + ' straight runs)');
  ok(pipes.length > 10 && pipes.every(f => f.ladder === DI.LADDER_BPIPE), 'the yards\' collector pipes are legs too: ' + pipes.length);
  ok(!F.some(f => f.code === 'T6' && f.kind === 'buried' && !f.net && f.sub === 'DWKZ'), 'the straight runs give way where the network is drawn');
  const both = legs.filter(f => DI.endsOf(f).start && DI.endsOf(f).end);
  ok(both.length > legs.length * 0.8 && both.every(f => /^(MH|MHG)$/.test(DI.endsOf(f).start.code)), 'most legs run manhole to manhole: ' + both.length);
  const mh = DI.endsOf(both[0]).end;
  ok(DI.joinsOf(mh).some(x => x.f === both[0] && x.end === 'end'), 'and the manhole names the leg that ends at it');
  const turn = legs.find(f => !DI.rangeable(f) && f.len > 5);
  ok(turn && turn.ch1 - turn.ch0 < 0.8 * turn.len && DI.geomOf(turn).length >= 1, 'a leg that turns or crosses the line is tracked whole, and drawn with its turns');
  ok(Math.abs(DI.progressOf([turn]).lin.m - turn.len) < 0.01, 'its length in Progress is its own, not its chainage');
  ok(F.some(f => /^mh_/.test(f.id) && f.mhName), 'yard manholes come with their names');
  const named = F.filter(f => f.mhName);
  ok(named.length > 240 && named.every(f => f.name.includes(f.mhName)) && named.some(f => /^MH\d+\.\d+-[A-Z]+$/.test(f.mhName)), 'manholes keep their drawing names (MH3.3-YDKZ): ' + named.length);
  ok(legs.filter(f => / → /.test(f.name)).length > legs.length * 0.8, 'a leg is named by its manholes: ' + legs.find(f => / → /.test(f.name)).name);
  // roads
  const rd = F.filter(f => f.road);
  ok(rd.length > 1500 && rd.filter(f => f.kind === 'net').every(f => f.len > 0 && DI.geomOf(f)), 'road drains, with their shape and length: ' + rd.filter(f => f.kind === 'net').length);
  ok(rd.some(f => f.code === 'RDS' && f.ladder.length === 3) && rd.some(f => f.code === 'RPC'), 'riprap dissipators and road culverts');
  const ovr = DI.refs().find(r => r.kind === 'overpass' && DI.roadDrainage(r.id).length > 10);
  ok(ovr && DI.roadDrainage(ovr.id).every(f => f.road === ovr.id), 'a road crossing gathers its drainage: ' + (ovr && ovr.name));
  const joined = Object.keys(DI.data.roadJoins);
  const rail = DI.data.byId[joined[0]];
  ok(joined.length > 40 && !rail.road && DI.roadJoinsOf(rail).every(x => x.f.road && Math.abs(x.ch - (rail.ch0 + rail.ch1) / 2) < (rail.ch1 - rail.ch0) / 2 + 16), 'road drains that end on a railway ditch name it: ' + joined.length + ' ditches');
  const tp = DI.typeProgress(ovr.sub);
  ok(tp.some(t => t.key === 'RD' && t.label === 'Road drainage' && t.span && t.p.lin.m > 1000), 'Progress has road drainage, in km');
  const t4 = rd.find(f => f.code === 'RT4' && /unlined/.test(f.name));
  ok(t4 && DI.ladderKind(t4.ladder) === 'unlined' && rd.filter(f => /concrete/.test(f.name)).every(f => DI.ladderKind(f.ladder) === (f.code === 'RT9' ? 'precast' : 'insitu')), 'road ditches: unlined type 4 on the unlined stages, concrete ones cast in situ (type 9 precast)');
  DI.addRecord({ kind: 'stage', featureId: t4.id, stage: t4.ladder.length - 1 });
  ok(DI.statusOf(t4).bucket === 'done' && Math.abs(DI.progressOf([t4]).lin.doneM - t4.len) < 0.01, 'a road drain takes a stage, and counts its own length');
});

console.log('\n' + (fail ? 'FAILED: ' : 'ALL PASSED: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
