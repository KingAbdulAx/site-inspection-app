#!/usr/bin/env node
/*
 * Drainage construction progress report: what is built, against the design, section by section.
 *
 *   node scripts/report/build_report.js [--rows rows.json] [--out dir] [--asof 2026-11-16]
 *
 * Reads the cloud database the app syncs with (the Supabase `inspections` table, read only), or a saved copy of
 * it (--rows), and runs it through the app's own model (ui/model.js), so the report counts exactly what the app
 * shows. Writes, in --out (default data/report/out):
 *   report.html   the report: summary, changes from the design, a chainage diagram per section, what is built
 *   report.json   the same figures, for scripts/report/report_xlsx.py (the Excel appendix)
 * Changes from the design come from data/report/changes.json, and from any drain recorded in the app as built to
 * a different length.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = arg('--out') || path.join(root, 'data', 'report', 'out');

global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } };

async function cloudRows() {
  if (arg('--rows')) return JSON.parse(fs.readFileSync(arg('--rows'), 'utf8'));
  require(path.join(root, 'config.js'));
  const c = window.APP_CONFIG;
  const r = await fetch(c.supabaseUrl.replace(/\/$/, '') + '/rest/v1/inspections?select=*', { headers: { apikey: c.supabaseAnonKey, Authorization: 'Bearer ' + c.supabaseAnonKey } });
  if (!r.ok) throw new Error('could not read the database: ' + r.status);
  return r.json();
}

(async () => {
  const rows = await cloudRows();
  // the rows as the app keeps them after a sync
  const ins = {};
  rows.forEach(x => { ins[x.asset_id] = { status: x.status, notes: x.notes || '', hasDefect: !!x.has_defect, date: x.inspection_date || '', inspected_by: x.inspected_by || '', updated_at: x.updated_at }; });
  store.KMD_DRAINAGE_INSPECTIONS_SEC03_V1 = JSON.stringify(ins);
  ['bundle', 'section01_bundle', 'section04_bundle', 'section05_bundle', 'structures', 'section02_bundle'].forEach(n => require(path.join(root, 'data', n + '.js')));
  require(path.join(root, 'ui', 'model.js'));
  const DI = window.DI;
  DI.init();
  DI.loadT9Schedule(JSON.parse(fs.readFileSync(path.join(root, 'data/t9_schedule.json'), 'utf8')), DI.T9_SCHEDULE_ON);
  DI.loadConnectors(JSON.parse(fs.readFileSync(path.join(root, 'data/connectors.json'), 'utf8')));
  DI.loadNetworks(JSON.parse(fs.readFileSync(path.join(root, 'data/networks.json'), 'utf8')));
  const asof = arg('--asof') || new Date().toISOString().slice(0, 10);
  const register = JSON.parse(fs.readFileSync(path.join(root, 'data/report/changes.json'), 'utf8')).changes;

  const r1 = v => Math.round(v * 10) / 10;
  const SUBS = DI.LINES.find(l => l.id === 'KM').subs.filter(s => s.from != null);
  const sectionNo = { KNDW: 'S01', DWKZ: 'S02', KZDR: 'S03', DRMR: 'S04', MRJB: 'S05' };
  // design items left out on site (the register's 'omitted'): out of the quantities, listed as changes
  const omitted = new Set(register.filter(c => c.kind === 'omitted' && c.feature).map(c => c.feature));
  // Type 16 (water passages in underpasses) comes from the drawing (data/dwg/type16.json), not the first asset list
  const t16 = JSON.parse(fs.readFileSync(path.join(root, 'data/dwg/type16.json'), 'utf8')).passages;
  const alive = f => !f.absorbedInto && !omitted.has(f.id) && f.code !== 'T16' && !DI.statusOf(f).removed;
  const lastOf = f => { const lg = window.appState.inspections[f.id]; return lg ? { date: (lg.date || lg.updated_at || '').slice(0, 10), by: lg.inspected_by || '' } : { date: '', by: '' }; };

  const report = { asof, built: new Date().toISOString(), rows: rows.length, sections: [], changes: [], networks: [], unmatched: [] };

  SUBS.forEach(s => {
    const feats = (DI.data.bySub[s.id] || []).filter(alive);
    const sec = { id: s.id, no: sectionNo[s.id], name: s.name, from: s.from, to: s.to, types: [], stretches: [], design: [], points: [], stations: DI.refs().filter(r => r.area && r.sub === s.id).map(r => ({ name: r.name, ch0: r.ch0, ch1: r.ch1, kind: r.kind })) };
    // by type: what the design has, what is built
    DI.typeProgress(s.id).forEach(t => {
      const list = t.feats.filter(alive);
      if (!list.length || /^(OP|BRG)\.pt$/.test(t.key)) return;   // bridges and road crossings: for reference, not drainage
      const p = DI.progressOf(list);
      const started = t.span ? (p.lin.names.length ? p.lin.atLeast[p.lin.names[0]] || 0 : 0) : 0;
      sec.types.push({ key: t.key, label: t.label, span: t.span, road: list.some(f => f.road), net: list.some(f => f.net),
        designM: t.span ? r1(p.lin.m) : null, doneM: t.span ? r1(p.lin.doneM) : null, startedM: t.span ? r1(started) : null,
        n: t.span ? p.lin.n : p.pts.n, done: t.span ? p.lin.done : p.pts.done, part: p.part });
    });
    const p16 = t16.filter(x => x.sub === s.id);
    if (p16.length) { sec.t16 = p16; sec.types.push({ key: 'T16.pt', label: 'Type 16 water passages in underpasses', span: false, road: false, net: false, designM: null, doneM: null, startedM: null, n: p16.length, done: p16.filter(x => x.done).length, part: 0 }); }
    // along the line: each drain's design extent and what is built of it, by chainage
    feats.filter(f => DI.isSpan(f) && !f.road && !f.net && f.ch1 - f.ch0 >= 1).forEach(f => {
      const st = DI.statusOf(f), t = DI.typeOf(f), max = f.ladder.length - 1;
      const [a, b] = DI.extentEnds(f);
      sec.design.push({ id: f.id, key: t.key, label: t.label, side: f.side, ch0: r1(f.ch0), ch1: r1(f.ch1), len: r1(f.ch1 - f.ch0), built: f.built ? [r1(a), r1(b)] : null, state: st.bucket, stage: st.best > 0 ? f.ladder[Math.min(st.best, max)] : '' });
      const segs = st.cover ? st.cover.segs.map(g => [g.a, g.b, g.s]) : st.best > 0 ? [[a, b, Math.min(st.best, max)]] : [];
      const when = lastOf(f);
      segs.forEach(([x, y, k]) => sec.stretches.push({ id: f.id, key: t.key, label: t.label, side: f.side, ch0: r1(x), ch1: r1(y), len: r1(y - x), done: k >= max, stage: f.ladder[k], date: when.date, by: when.by }));
    });
    // structures at a point: culverts, descents, boxes
    feats.filter(f => !DI.isSpan(f) && !f.road && !f.net && !(f.conn && (f.code === 'MH' || f.code === 'MHG')) && !/^(OP|BRG)$/.test(f.code)).forEach(f => {
      const st = DI.statusOf(f);
      if (st.best > 0) sec.points.push({ id: f.id, key: DI.typeOf(f).key, label: DI.typeOf(f).label, name: f.name, ch: r1(f.ch0), side: f.side, done: st.bucket === 'done', stage: f.ladder[Math.min(st.best, f.ladder.length - 1)], date: lastOf(f).date });
    });
    sec.stretches.sort((x, y) => x.ch0 - y.ch0);
    sec.points.sort((x, y) => x.ch - y.ch);
    report.sections.push(sec);
  });

  // station and yard networks
  DI.refs().filter(r => r.area).forEach(r => {
    const net = DI.netOf(r.id).filter(alive);
    const legs = net.filter(f => DI.isSpan(f)), mhs = net.filter(f => !DI.isSpan(f));
    if (!legs.length) return;
    const p = DI.progressOf(legs), done = f => DI.statusOf(f).bucket === 'done';
    report.networks.push({ name: r.name, sub: r.sub, legs: legs.length, legsDone: legs.filter(done).length, m: r1(p.lin.m), doneM: r1(p.lin.doneM), manholes: mhs.length, manholesDone: mhs.filter(done).length,
      list: legs.sort((x, y) => x.ch0 - y.ch0).map(f => ({ id: f.id, name: f.name.replace(/^Type 6 drain /, '').replace(/^Collector pipe /, 'pipe '), len: r1(f.len || f.ch1 - f.ch0), dia: f.dia || null, state: DI.statusOf(f).bucket })) });
  });

  // changes: the register, then drains the app has as built to another length
  register.filter(c => c.listed !== false).forEach(c => report.changes.push(Object.assign({}, c)));
  DI.data.features.filter(f => f.built && alive(f)).forEach(f => {
    report.changes.push({ kind: 'site', sub: f.sub, ch0: r1(Math.min(f.ch0, f.built.ch0)), ch1: r1(Math.max(f.ch1, f.built.ch1)), side: f.side, where: DI.fmtCh(f.built.ch0) + ', ' + (f.side === 'L' ? 'left' : 'right'),
      design: f.name + ', ' + DI.fmtCh(f.ch0) + ' to ' + DI.fmtCh(f.ch1) + ' (' + Math.round(f.ch1 - f.ch0) + ' m)',
      built: 'Built ' + DI.fmtCh(f.built.ch0) + ' to ' + DI.fmtCh(f.built.ch1) + ' (' + Math.round(f.built.ch1 - f.built.ch0) + ' m)', status: 'Recorded on site in the app', feature: f.id });
  });
  report.changes.forEach((c, i) => { c.no = i + 1; });

  // rows for drainage the app no longer has (older ids): left out of the figures, listed for checking
  rows.forEach(x => {
    if (DI.data.byId[x.asset_id] || /^struct_edit|^test_/.test(x.asset_id) || x.status === 'Not Started') return;
    // a straight Type 6 run of the first data, now the network's legs (t6_<SUB>_<handle>_n), which carry its record
    const run = /^cad_([A-Z]+)_([0-9A-F]+)$/.exec(x.asset_id);
    if (run && DI.data.features.some(f => f.id.startsWith('t6_' + run[1] + '_' + run[2] + '_'))) return;
    report.unmatched.push({ id: x.asset_id, status: x.status, date: (x.inspection_date || '').slice(0, 10), by: x.inspected_by || '', notes: x.notes || '' });
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  const page = require('./report_html.js');
  fs.writeFileSync(path.join(OUT, 'report.html'), page(report, DI));
  // each section's diagram on its own, light, for the Word report (report_docx.js renders them to PNG)
  report.sections.forEach(s => { const svg = page.standalone(s, report, DI); if (svg) fs.writeFileSync(path.join(OUT, 'diagram_' + s.no + '.svg'), svg); });
  const tot = report.sections.reduce((a, s) => a + s.stretches.filter(x => x.done).reduce((b, x) => b + x.len, 0), 0);
  console.log('report as of ' + asof + ': ' + rows.length + ' database rows; ' + Math.round(tot) + ' m of drains along the line finished; ' + report.changes.length + ' changes; ' + report.unmatched.length + ' rows for older ids left out');
  console.log('wrote ' + path.relative(process.cwd(), path.join(OUT, 'report.html')) + ' and report.json');
})().catch(e => { console.error(e.message); process.exit(1); });
