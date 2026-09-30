/*
 * Site progress from the contractor's execution charts and ditch sheets,
 * turned into the app's stages.
 *
 *   node scripts/progress/import_progress.js --asof 2026-09-25 \
 *     --chart KNDW=S01.rows.json --chart DWKZ=S02.rows.json --chart KZDR=S03.rows.json \
 *     --ditches ditch_rows.json --ditch-date 2026-09-30 [--existing supabase_rows.json]
 *
 * Writes, in data/progress/:
 *   culverts_from_charts.json   base 'add' records for chart culverts the data lacks
 *                               (all of S01, cattle crossings, a few others): bake with
 *                               scripts/apply_base_corrections.js
 *   progress_<asof>.json        one row per asset, ready for scripts/progress/push_progress.js
 *   progress_<asof>.md          what matched, what did not, and why
 *
 * Culverts: main-line rows only. Road and yard crossings ('82 R3', '84 AR',
 * 'DWA 2A', 'E1R1') carry their own road chainage (0+351…) and are left out.
 * A chart row takes the app culvert within 20 m, or within 45 m if it is the
 * same kind (box or pipe). The stage is the furthest column ticked, on the
 * feature's ladder: a box culvert is Completed once painted, a pipe culvert
 * once its joints are done; backfill is not a stage.
 *
 * Ditches: executed runs (Type 1, Type 9) are laid over the app's ditches of
 * the same type and side. 90% covered, or no more than 15 m left, is Completed;
 * less is Concreted, with the executed metres in the note.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const many = k => args.reduce((a, v, i) => (v === k ? a.concat(args[i + 1]) : a), []);
const asof = opt('--asof') || new Date().toISOString().slice(0, 10);
const ditchDate = opt('--ditch-date') || asof;
const charts = many('--chart').map(s => { const [sub, file] = s.split('='); return { sub, file }; });
const ditchFile = opt('--ditches');
const existing = opt('--existing') ? JSON.parse(fs.readFileSync(opt('--existing'), 'utf8')) : [];
const OUT = path.join(__dirname, '..', '..', 'data', 'progress');
const SECTION = { KNDW: 'S01', DWKZ: 'S02', KZDR: 'S03' };
const dmy = d => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4);

// The app's own model, so ladders, chainage and matching are exactly the app's.
const ROOT = path.join(__dirname, '..', '..');
global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
['data/bundle.js', 'data/section01_bundle.js', 'data/section02_bundle.js', 'ui/model.js'].forEach(f => require(path.join(ROOT, f)));
const DI = window.DI;
DI.init();

const MAIN = /^(-?\d+\.(\d+|[A-Z])|E\.\d+|CC ?\d+)$/;
const COL = { excavation: 'Excavation', bedding: 'Bedding', installed: 'Installed', haunch: 'Haunched', apron: 'Apron', wings: 'Wing walls' };
const COL_WORD = { excavation: 'excavation', bedding: 'bedding', installed: 'installed', haunch: 'haunch', apron: 'apron', wings: 'wing walls', joints: 'joints', paint: 'paint', backfill: 'backfill' };

// The last stage goes out as 'Completed & Approved', which every version of
// the app reads; the others by their name on the feature's ladder.
const statusName = (ladder, i) => (i === ladder.length - 1 ? 'Completed & Approved' : ladder[i]);
const LEGACY = { 'Not Started': 0, 'Excavation': 1, 'Blinding': 2, 'Rebar / Shuttering': 3, 'Concreted': 5 };
// Where a database status sits on a ladder (the app's own reading of it, simplified).
function dbStage(ladder, status) {
  if (status === 'Completed & Approved') return ladder.length - 1;
  if (ladder.indexOf(status) >= 0) return ladder.indexOf(status);
  if (LEGACY[status] == null) return null;
  if (ladder.indexOf('Installed') < 0) return Math.min(LEGACY[status], ladder.length - 1);
  return [0, 1, 2, 3, 3, 3][LEGACY[status]];
}

// ---------------------------------------------------------------- culverts
function shape(r) {
  const mid = r.mid.replace(/,/g, '.');
  const n = parseInt(mid, 10) || 1;
  const box = mid.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  const pipe = mid.match(/ø\s*(\d{3,4})/i);
  const cattle = /^CC/.test(r.name.trim());
  const kind = cattle ? 'CC' : box ? 'BC' : pipe ? 'PC' : /pipe/i.test(r.type) ? 'PC' : 'BC';
  const mult = ['', 'Single', 'Double', 'Triple', 'Quadruple'][n] || n + '-cell';
  let name;
  if (kind === 'PC') name = (n > 1 ? (n === 2 ? 'Twin' : n + '×') + ' pipe culvert ' + n + '×' : 'Pipe culvert ') + 'Ø' + (pipe ? (Number(pipe[1]) / 1000).toFixed(1) : '?') + ' m';
  else {
    const dims = box ? '(' + Number(box[1]).toFixed(1) + '×' + Number(box[2]).toFixed(1) + ' m)' : '';
    name = (kind === 'CC' ? 'Cattle crossing ' : mult + ' box culvert ') + n + '×' + dims;
  }
  return { kind, n, name };
}
function culvertStage(f, cells) {
  const pipe = f.ladder.indexOf('Haunched') >= 0;
  const names = Object.assign({}, COL, { joints: pipe ? 'Completed' : 'Joints', paint: pipe ? null : 'Completed' });
  let stage = 0;
  const done = [], ongoing = [];
  Object.entries(cells).forEach(([k, v]) => {
    if (/^ongoing/i.test(v)) { ongoing.push(COL_WORD[k]); return; }
    done.push(COL_WORD[k] + (v !== 'done' ? ' (' + v + ')' : ''));
    const i = names[k] ? f.ladder.indexOf(names[k]) : -1;
    if (i > stage) stage = i;
  });
  return { stage, done, ongoing };
}

const adds = [], rows = [], report = { culvert: {}, ditch: {} };
let addSeq = 0;
charts.forEach(({ sub, file }) => {
  const chart = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sec = SECTION[sub];
  const main = chart.filter(r => MAIN.test(r.name.trim()));
  const road = chart.filter(r => !MAIN.test(r.name.trim()));
  const app = (DI.data.bySub[sub] || []).filter(f => f.kind === 'cross' && f.catKey === 'cross');
  const used = new Set();
  const st = report.culvert[sub] = { chart: chart.length, main: main.length, road: road.map(r => r.name + ' @ ' + r.ch), matched: 0, near: [], added: [], appNotInChart: [], typeDiffers: [], rows: [] };
  const pick = (r, tol, sameKind) => {
    const ch = DI.parseCh(r.ch), k = shape(r).kind;
    let best = null, bd = tol + 1e-9;
    app.forEach(f => {
      if (used.has(f.id)) return;
      if (sameKind && (f.code === 'PC') !== (k === 'PC')) return;
      const d = Math.abs(f.ch0 - ch);
      if (d <= bd) { bd = d; best = f; }
    });
    return best ? { f: best, d: bd } : null;
  };
  const match = new Map();
  main.forEach(r => { const m = pick(r, 20, false); if (m) { used.add(m.f.id); match.set(r, m); } });
  main.forEach(r => { if (match.has(r)) return; const m = pick(r, 45, true); if (m) { used.add(m.f.id); match.set(r, m); st.near.push(r.name + ' @ ' + r.ch + ' → ' + m.f.code + ' @ ' + DI.fmtCh(m.f.ch0) + ' (' + Math.round(m.d) + ' m)'); } });
  main.forEach(r => {
    let f, m = match.get(r);
    if (m) {
      f = m.f; st.matched++;
      const k = shape(r).kind;
      if (k !== 'CC' && (f.code === 'PC') !== (k === 'PC')) st.typeDiffers.push(r.name + ' @ ' + r.ch + ': chart ' + (k === 'PC' ? 'pipe' : 'box') + ', data ' + f.name);
    } else {
      // Not in the data: add it from the chart (a table position, so ±4 m).
      const sh = shape(r);
      const id = 'xc_' + sub + '_' + r.name.trim().replace(/[^A-Za-z0-9]+/g, '_');
      const ch = DI.parseCh(r.ch);
      adds.push({ id: 'xc-' + sub + '-' + String(++addSeq).padStart(4, '0'), kind: 'base', at: asof + 'T12:00:00.000Z', by: 'Execution chart ' + dmy(asof), action: 'add', featureId: id, sub,
        set: { preset: sh.kind, ch0: ch, ch1: ch, side: 'C', cert: 'derived', sheet: 'Execution chart ' + sec + ' ' + dmy(asof), name: sh.name, fullName: sh.name + ' — ' + r.name.trim() + ' (execution chart ' + sec + ')' },
        note: 'In the ' + sec + ' execution chart (' + r.name.trim() + ' at ' + r.ch + '), not in the drawings data' });
      st.added.push(r.name + ' @ ' + r.ch + ' (' + sh.name + ')');
      f = { id, ladder: sh.kind === 'PC' ? ['Not started', 'Excavation', 'Bedding', 'Installed', 'Haunched', 'Apron', 'Wing walls', 'Completed'] : ['Not started', 'Excavation', 'Bedding', 'Installed', 'Apron', 'Wing walls', 'Joints', 'Completed'], name: sh.name };
    }
    const cs = culvertStage(f, r.cells);
    const line = { name: r.name.trim(), ch: r.ch, asset: f.id, stage: f.ladder[cs.stage], done: cs.done, ongoing: cs.ongoing, plan: r.plan_comment };
    st.rows.push(line);
    if (cs.stage > 0) {
      rows.push({ asset_id: f.id, sub, stage: cs.stage, ladder: f.ladder, status: statusName(f.ladder, cs.stage), has_defect: false, inspection_date: asof, inspected_by: 'Execution chart ' + dmy(asof),
        notes: 'Execution chart ' + sec + ' ' + dmy(asof) + ' · ' + r.name.trim() + ' at ' + r.ch + ' · done: ' + (cs.done.join(', ') || '—') + (cs.ongoing.length ? ' · ongoing: ' + cs.ongoing.join(', ') : '') + (r.plan_comment ? ' · ' + r.plan_comment : '') });
    }
  });
  st.appNotInChart = app.filter(f => !used.has(f.id)).map(f => f.code + ' @ ' + DI.fmtCh(f.ch0) + ' (' + f.name + ')');
});

// ---------------------------------------------------------------- ditches
if (ditchFile) {
  const drows = JSON.parse(fs.readFileSync(ditchFile, 'utf8'));
  const done = drows.filter(r => r.executed > 0).map(r => {
    const a = DI.parseCh(r.a), b = DI.parseCh(r.b);
    return Object.assign({}, r, { ch0: Math.min(a, b), ch1: Math.max(a, b), sd: r.side === 'LHS' ? 'L' : 'R' });
  });
  const fam = f => (f.code === 'T9' ? 'T9' : 'T1');
  const feats = DI.data.features.filter(f => ['T1', 'T1L', 'T9'].includes(f.code) && f.ch1 - f.ch0 >= 1);
  const st = report.ditch = { rows: drows.length, executed: done.length, completed: 0, partial: [], lost: [] };
  feats.forEach(f => {
    const over = done.filter(r => r.code === fam(f) && r.sd === f.side && r.ch1 > f.ch0 && r.ch0 < f.ch1);
    if (!over.length) return;
    const iv = over.map(r => [Math.max(r.ch0, f.ch0), Math.min(r.ch1, f.ch1)]).sort((a, b) => a[0] - b[0]);
    let cov = 0, end = -1e12;
    iv.forEach(([a, b]) => { if (b <= end) return; cov += b - Math.max(a, end); end = b; });
    const L = f.ch1 - f.ch0;
    const complete = cov / L >= 0.9 || L - cov <= 15;
    const status = complete ? f.ladder[f.ladder.length - 1] : 'Concreted';
    const irs = Array.from(new Set(over.map(r => [r.ir1, r.ir2].filter(Boolean).join(' / ')).filter(Boolean)));
    const date = over.map(r => r.date).filter(Boolean).sort().pop() || ditchDate;
    if (complete) st.completed++; else st.partial.push(f.code + ' ' + f.side + ' ' + DI.fmtCh(f.ch0) + '–' + DI.fmtCh(f.ch1) + ': ' + Math.round(cov) + ' of ' + Math.round(L) + ' m');
    rows.push({ asset_id: f.id, sub: f.sub, stage: f.ladder.indexOf(status), ladder: f.ladder, status: statusName(f.ladder, f.ladder.indexOf(status)), has_defect: false, inspection_date: date, inspected_by: 'Ditch progress ' + fam(f) + ' ' + dmy(ditchDate),
      notes: 'Ditch progress ' + fam(f) + ' ' + dmy(ditchDate) + ' · ' + Math.round(cov) + ' of ' + Math.round(L) + ' m executed' + (complete ? '' : ' (' + iv.map(([a, b]) => DI.fmtCh(a) + '–' + DI.fmtCh(b)).join(', ') + ')') + (irs.length ? ' · ' + irs.join('; ') : '') });
  });
  st.lost = done.filter(r => !feats.some(f => fam(f) === r.code && f.side === r.sd && f.ch1 > r.ch0 && f.ch0 < r.ch1)).map(r => r.code + ' ' + r.side + ' ' + r.a + '–' + r.b + ' (' + r.executed + ' m, ' + (r.ir1 || 'no IR') + ')');
}

// ---------------------------------------------------------------- existing rows
// A row already in the database stays, unless the chart is further on and newer.
const have = new Map(existing.map(r => [r.asset_id, r]));
const kept = [], out = [];
rows.forEach(r => {
  const e = have.get(r.asset_id);
  if (!e) { out.push(r); return; }
  const was = dbStage(r.ladder, e.status);
  if (was != null && r.stage > was && String(e.updated_at).slice(0, 10) < r.inspection_date) {
    r.notes += ' · was ' + e.status + ' (' + String(e.updated_at).slice(0, 10) + ')';
    r.replaces = { status: e.status, by: e.inspected_by, at: e.updated_at };
    out.push(r);
  } else kept.push({ r, e });
});
out.forEach(r => { delete r.stage; delete r.ladder; });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'culverts_from_charts.json'), JSON.stringify({ kind: 'kmd-base-corrections', app: 'Drainage Inspector', exported_at: asof + 'T12:00:00.000Z', source: 'Culvert Monitoring & Execution Status charts, ' + dmy(asof), records: adds }, null, 1));
fs.writeFileSync(path.join(OUT, 'progress_' + asof + '.json'), JSON.stringify({ kind: 'kmd-progress', asof, ditch_date: ditchDate, rows: out, skipped_existing: kept.map(k => ({ asset_id: k.r.asset_id, chart: k.r.status, database: k.e.status, database_by: k.e.inspected_by, database_at: k.e.updated_at })) }, null, 1));

let md = '# Site progress, ' + dmy(asof) + '\n\nFrom the Culvert Monitoring & Execution Status charts (' + dmy(asof) + ') and the ditch progress sheets (' + dmy(ditchDate) + ').\n\n';
md += 'Completion: a box culvert is Completed once its bituminous paint is on; a pipe culvert, once its joints are done. Backfill is not a stage.\n\n';
md += '| | rows |\n|---|---|\n| progress rows to write | ' + out.length + ' (' + out.filter(r => r.replaces).length + ' replacing an older, lower status) |\n| already in the database (left as they are) | ' + kept.length + ' |\n| culverts added to the data from the charts | ' + adds.length + ' |\n\n';
Object.entries(report.culvert).forEach(([sub, s]) => {
  md += '## Culverts, ' + sub + ' (' + SECTION[sub] + ')\n\n' + s.chart + ' chart rows: ' + s.main + ' on the main line, ' + s.road.length + ' road or yard crossings left out.\n\n';
  md += '- Matched to the data: ' + s.matched + (s.near.length ? ' (' + s.near.length + ' of them 20–45 m apart, same kind)' : '') + '\n- Added from the chart: ' + s.added.length + '\n- In the data, not in the chart: ' + s.appNotInChart.length + '\n\n';
  const by = {};
  s.rows.forEach(r => { by[r.stage] = (by[r.stage] || 0) + 1; });
  md += 'Stages: ' + Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ') + '.\n\n';
  if (s.near.length) md += '**Matched 20–45 m apart** (probably moved by a design revision; the data keeps its chainage):\n\n' + s.near.map(x => '- ' + x).join('\n') + '\n\n';
  if (s.typeDiffers.length) md += '**Chart and data disagree on the kind** (the data keeps its kind; the stage is read on its ladder):\n\n' + s.typeDiffers.map(x => '- ' + x).join('\n') + '\n\n';
  if (s.added.length) md += '**Added from the chart**:\n\n' + s.added.map(x => '- ' + x).join('\n') + '\n\n';
  if (s.appNotInChart.length) md += '**In the data but not in the chart**:\n\n' + s.appNotInChart.map(x => '- ' + x).join('\n') + '\n\n';
  md += '**Road and yard crossings left out**: ' + s.road.join(', ') + '\n\n';
});
if (report.ditch.rows) {
  const d = report.ditch;
  md += '## Ditches (Type 1, Type 9)\n\n' + d.rows + ' sheet rows, ' + d.executed + ' with executed metres. ' + d.completed + ' ditch features Completed, ' + d.partial.length + ' part-done (Concreted, with the metres in the note).\n\n';
  if (d.partial.length) md += '**Part-done**:\n\n' + d.partial.map(x => '- ' + x).join('\n') + '\n\n';
  if (d.lost.length) md += '**Executed runs with no ditch of that type on that side in the data**:\n\n' + d.lost.map(x => '- ' + x).join('\n') + '\n\n';
}
if (kept.length) {
  const up = out.filter(r => r.replaces);
  if (up.length) md += '## Replacing an older, lower status\n\n' + up.map(r => '- ' + r.asset_id + ': ' + r.replaces.status + ' (' + r.replaces.by + ', ' + String(r.replaces.at).slice(0, 10) + ') → ' + r.status).join('\n') + '\n\n';
  md += '## Already in the database, left as they are\n\n| asset | chart says | database says | by, on |\n|---|---|---|---|\n' +
    kept.map(k => '| ' + k.r.asset_id + ' | ' + k.r.status + ' | ' + k.e.status + ' | ' + k.e.inspected_by + ', ' + String(k.e.updated_at).slice(0, 10) + ' |').join('\n') + '\n';
}
fs.writeFileSync(path.join(OUT, 'progress_' + asof + '.md'), md);
console.log('progress rows ' + out.length + ' (+' + kept.length + ' already in the database), culverts to add ' + adds.length);
Object.entries(report.culvert).forEach(([sub, s]) => console.log(' ' + sub + ': main ' + s.main + ', matched ' + s.matched + ' (' + s.near.length + ' at 20–45 m), added ' + s.added.length + ', data-only ' + s.appNotInChart.length + ', road ' + s.road.length));
if (report.ditch.rows) console.log(' ditches: completed ' + report.ditch.completed + ', partial ' + report.ditch.partial.length + ', lost ' + report.ditch.lost.length);
