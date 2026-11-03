/*
 * The office import and the phone agree on Type 9 progress by length.
 * Run: node scripts/test_progress_ranges.js
 *
 * An executed run from the ditch sheet is laid over the Type 9 pieces of the contractor's schedule, written
 * as a row with '[T9 done ... to ...]' in its notes, and read back by the app as completed metres. Then the
 * phone adds a range of its own on top of that row, which carries both, and undo keeps its meaning.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
['data/bundle.js', 'data/section01_bundle.js', 'data/section04_bundle.js', 'data/section05_bundle.js', 'data/structures.js', 'data/section02_bundle.js', 'ui/model.js'].forEach(f => require(path.join(root, f)));
const DI = window.DI;
DI.init();
const sched = JSON.parse(fs.readFileSync(path.join(root, 'data/t9_schedule.json'), 'utf8'));
DI.loadT9Schedule(sched, DI.T9_SCHEDULE_ON);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };
const pk = ch => DI.fmtCh(ch, 0);

const pieces = DI.data.bySub.DWKZ.filter(f => f.sched && f.ch1 - f.ch0 > 500 && f.ch1 - f.ch0 < 1500);
const A = pieces[0], B = pieces[1];
const run = (f, a, b) => ({ code: 'T9', date: '2026-10-20', a: pk(a), b: pk(b), total: Math.round(b - a), side: f.side === 'L' ? 'LHS' : 'RHS', executed: Math.round(b - a), ir1: 'IR-' + Math.round(a), ir2: null, remark: null });
const rows = [run(A, A.ch0 + 20, A.ch0 + 120), run(A, A.ch0 + 150, A.ch0 + 250), run(B, B.ch0 - 30, B.ch1 + 30)];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kmd-progress-'));
fs.writeFileSync(path.join(dir, 'ditch_rows.json'), JSON.stringify(rows));
execFileSync('node', [path.join(root, 'scripts/progress/import_progress.js'), '--asof', '2026-10-25', '--ditches', path.join(dir, 'ditch_rows.json'), '--out', dir], { stdio: 'pipe' });
const out = JSON.parse(fs.readFileSync(path.join(dir, 'progress_2026-10-25.json'), 'utf8')).rows;
const ra = out.find(r => r.asset_id === A.id), rb = out.find(r => r.asset_id === B.id);

console.log('--- the import writes ranges');
ok(ra && rb, 'a row for each of the two pieces the runs lie on');
ok(ra.status === 'Concreted' && /\[T9 done [^\]]*\]/.test(ra.notes), 'a part-done piece is Concreted, with its ranges in the notes: ' + ra.notes.slice(-70));
ok(DI.parseRangeNote(ra.notes).length === 2 && Math.abs(DI.parseRangeNote(ra.notes).reduce((n, [a, b]) => n + b - a, 0) - 200) < 1, 'two runs, 200 m');
ok(rb.status === 'Completed & Approved', 'a piece covered end to end is Completed');

console.log('--- the app reads them back');
// A row as sync.js hands it to the app: pulled from the cloud, so without 'source'
const KEY = 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1';
const pulled = r => ({ status: r.status, notes: r.notes, hasDefect: false, date: r.inspection_date, inspected_by: r.inspected_by, updated_at: r.inspection_date + 'T12:00:00+00:00' });
store[KEY] = JSON.stringify({ [A.id]: pulled(ra), [B.id]: pulled(rb) });
DI.loadLegacy();
let ca = DI.coverOf(A), cb = DI.coverOf(B);
ok(ca && Math.abs(ca.m - 200) < 1 && ca.ranges.length === 2 && !ca.full, 'the office row reads as 200 m done in two ranges, not finished: ' + (ca && Math.round(ca.m)));
ok(DI.statusOf(A).bucket === 'moving' && DI.statusOf(A).s < DI.statusOf(A).max, 'part-built, and the "Concreted" status does not finish a two-stage run');
ok(cb && cb.full && DI.statusOf(B).bucket === 'done', 'the fully covered piece is done');
const p0 = DI.progressOf([A]).lin.doneM;
ok(Math.abs(p0 - 200) < 1, 'the Progress totals count 200 m');

console.log('--- the phone adds to the office row');
const r1 = DI.addRange(A.id, A.ch0 + 300, A.ch0 + 340);
ca = DI.coverOf(A);
ok(Math.abs(ca.m - 240) < 1 && ca.ranges.length === 3, 'a range of its own: 240 m in three ranges');
ok(DI.records.filter(r => r.kind === 'range' && r.featureId === A.id && r.imported).length === 2, 'the two office ranges became its own (undoable) records first');
const row = JSON.parse(store[KEY])[A.id];
ok(row.source === 'walk' && DI.parseRangeNote(row.notes).length === 3 && row.status === 'Concreted', 'the row it writes carries all three: ' + row.notes);
DI.voidRecord(r1.id);
ca = DI.coverOf(A);
ok(Math.abs(ca.m - 200) < 1, 'undoing its own range leaves the office 200 m: ' + Math.round(ca.m));
const imported = DI.records.find(r => r.kind === 'range' && r.featureId === A.id && r.imported);
DI.voidRecord(imported.id);
ok(Math.abs(DI.coverOf(A).m - 100) < 1 && DI.parseRangeNote(JSON.parse(store[KEY])[A.id].notes).length === 1, 'an office range can be undone too, and the row follows');
const left = DI.records.find(r => r.kind === 'range' && r.featureId === A.id && DI.live(x => x.id === r.id).length);
DI.voidRecord(left.id);
ok(!DI.coverOf(A) && JSON.parse(store[KEY])[A.id].status === 'Not Started' && !/T9 done/.test(JSON.parse(store[KEY])[A.id].notes), 'all undone: the row goes back to Not Started with no ranges');

console.log('--- a later import');
const rows2 = [run(A, A.ch0 + 20, A.ch0 + 120), run(A, A.ch0 + 150, A.ch0 + 400)];
fs.writeFileSync(path.join(dir, 'ditch_rows2.json'), JSON.stringify(rows2));
const existing = [{ asset_id: A.id, status: ra.status, notes: ra.notes, inspected_by: ra.inspected_by, updated_at: ra.inspection_date + 'T12:00:00+00:00' }];
fs.writeFileSync(path.join(dir, 'existing.json'), JSON.stringify(existing));
execFileSync('node', [path.join(root, 'scripts/progress/import_progress.js'), '--asof', '2026-10-30', '--ditch-date', '2026-10-30', '--ditches', path.join(dir, 'ditch_rows2.json'), '--existing', path.join(dir, 'existing.json'), '--out', dir], { stdio: 'pipe' });
const out2 = JSON.parse(fs.readFileSync(path.join(dir, 'progress_2026-10-30.json'), 'utf8'));
const r2 = out2.rows.find(r => r.asset_id === A.id);
ok(r2 && r2.replaces && DI.parseRangeNote(r2.notes).reduce((n, [a, b]) => n + b - a, 0) > 340, 'the earlier office row is replaced once more is done: ' + (r2 && r2.notes.slice(-60)));
ok(!out2.skipped_existing.some(x => x.asset_id === A.id), 'and is not left alone');


console.log('--- sync carries as-built extents');
const extFrom = A.ch0 - 25, extTo = A.ch1 + 35;
const rExtPhone = DI.addExtent(A.id, extFrom, extTo, 'Extended on site');
ok(A.built && A.built.ch0 === extFrom && A.built.ch1 === extTo, 'extent saved on phone');
const rowWithExt = JSON.parse(store[KEY])[A.id];
ok(rowWithExt && /\[extent \d+(\.\d)? to \d+(\.\d)?\]/.test(rowWithExt.notes), 'phone notes carry [extent ... to ...]: ' + (rowWithExt && rowWithExt.notes));
const pExt = DI.parseExtentNote(rowWithExt.notes);
ok(pExt && pExt[0] === extFrom && pExt[1] === extTo, 'parseExtentNote matches from/to');

// Foreign extent adoption: simulate pulling an office row that carries an extent marker
const foreignRow = { status: 'Concreted', notes: '[T9 done 20950 to 21050] | [extent 20880 to 21260]', inspected_by: 'office', updated_at: '2026-10-31T10:00:00+00:00' };
store[KEY] = JSON.stringify(Object.assign(JSON.parse(store[KEY]), { [B.id]: foreignRow }));
DI.loadLegacy();
ok(B.built && B.built.ch0 === 20880 && B.built.ch1 === 21260, 'foreign extent from cloud row read by app');
DI.adoptForeignExtent(B);
ok(DI.records.some(r => r.kind === 'extent' && r.featureId === B.id && r.imported), 'foreign extent adopted as phone own record');
DI.voidRecord(rExtPhone.id);

fs.rmSync(dir, { recursive: true, force: true });
console.log('\n' + (fail ? 'FAILED' : 'ALL PASSED') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
