/*
 * Compare drainage extracted from the design CAD with the app's base data,
 * and write the differences as a corrections file the app can import and
 * review (Project → Base data → Import, then Check against drawings).
 *
 *   node scripts/dwg/compare_plan.js data/dwg/DWKZ_plan.json \
 *        --report data/dwg/DWKZ_comparison.md --corrections data/dwg/DWKZ_corrections.json
 *
 * Matching is by side and chainage overlap. The CAD is the design, so a
 * matched feature takes the CAD start, end, offset and type; a CAD run with
 * no counterpart is added; an app feature the CAD does not show is proposed
 * for removal. Everything goes through the normal correction records, so each
 * one can be undone on the phone.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const input = args[0];
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!input) { console.log('usage: node scripts/dwg/compare_plan.js <plan.json> [--report out.md] [--corrections out.json]'); process.exit(1); }
const cad = JSON.parse(fs.readFileSync(input, 'utf8'));

const ROOT = path.join(__dirname, '..', '..');
global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
require(path.join(ROOT, 'data/bundle.js'));
require(path.join(ROOT, 'data/section01_bundle.js'));
require(path.join(ROOT, 'data/section04_bundle.js'));
require(path.join(ROOT, 'data/section02_bundle.js'));
require(path.join(ROOT, 'ui/model.js'));
const DI = window.DI;
DI.init();
const sub = cad.sub;
const app = (DI.data.bySub[sub] || []).slice();
const fmt = (m, d) => DI.fmtCh(m, d || 0);
const cadFile = path.basename(cad.source.drainage).replace(/\.dxf$/i, '');
// Label each correction with the plan sheet it falls on, so the phone groups
// them sheet by sheet (Check against drawings) beside the PDF.
const regPath = opt('--register');
const sheets = regPath ? JSON.parse(fs.readFileSync(regPath, 'utf8')).documents
  .filter(d => d.category === 'Plan Sheet' && d.start_pk != null)
  .map(d => ({ id: d.doc_number.replace(/^.*-(DW-\d{5})$/, '$1') + (d.submitted_revision ? '-' + d.submitted_revision : ''), a: d.start_pk, b: d.end_pk })) : [];
const sheetAt = ch => { const s = sheets.find(x => ch >= x.a && ch < x.b); return s ? s.id : 'CAD ' + cadFile; };
const sheet = 'CAD ' + cadFile;

// ------------------------------------------------------------- ditches
const LINEAR_CATS = new Set(['toe', 'side', 'shoulder', 'berm', 'crest', 'track']);
const appDitches = app.filter(f => LINEAR_CATS.has(f.catKey) && f.ch1 - f.ch0 > 1);
const cadDitches = cad.features.filter(f => f.kind === 'ditch');
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Ditches only match within their lane group: a Type 9 at the platform edge
// and a Type 4 at the toe can share a side and chainage and both be right.
const GROUP = { T1: 'plat', T1L: 'plat', T2: 'plat', T3: 'plat', T9: 'plat', T10: 'plat', T15: 'plat',
  T4: 'toe', T7: 'toe', T12: 'toe', T13: 'toe', T14: 'toe', MD: 'toe', T5: 'crest', T11: 'crest', T8: 'berm', T6: 'track' };
const grp = f => GROUP[f.code] || f.catKey;
const recs = [];
const now = new Date().toISOString();
let seq = 0;
const rid = () => 'cad-' + sub + '-' + String(++seq).padStart(5, '0');
const base = (o) => Object.assign({ id: rid(), kind: 'base', at: now, by: 'CAD extraction' }, o);
const setFrom = (c, f) => {
  const s = { ch0: c.ch0, ch1: c.ch1, side: c.side, offsetM: c.offset, cert: 'exact', sheet: sheetAt((c.ch0 + c.ch1) / 2) };
  if (!f || f.code !== c.code) s.preset = c.code;
  return s;
};
const cadNote = c => c.layer + ' handle ' + c.handle + (c.notes ? ' · ' + c.notes[0] : '') + (c.flag ? ' · check: ' + c.flag : '');

// Metre-by-metre agreement per side and lane group.
const metres = { same: 0, otherType: 0, missing: 0, extra: 0 };
const typeDiff = collections();
function collections() { return new Map(); }
['L', 'R', 'C'].forEach(side => Object.values(GROUP).filter((v, i, a) => a.indexOf(v) === i).forEach(g => {
  const lo = Math.floor(cad.axis.ch_start), hi = Math.ceil(cad.axis.ch_end), n = hi - lo + 1;
  const A = new Array(n).fill(null), C = new Array(n).fill(null);
  const paint = (arr, f) => { for (let m = Math.max(lo, Math.ceil(f.ch0)); m <= Math.min(hi, Math.floor(f.ch1)); m++) arr[m - lo] = f.code; };
  appDitches.filter(f => f.side === side && grp(f) === g).forEach(f => paint(A, f));
  cadDitches.filter(f => f.side === side && grp(f) === g).forEach(f => paint(C, f));
  for (let i = 0; i < n; i++) {
    if (C[i] && A[i]) { if (C[i] === A[i]) metres.same++; else { metres.otherType++; const k = A[i] + ' → ' + C[i]; typeDiff.set(k, (typeDiff.get(k) || 0) + 1); } }
    else if (C[i]) metres.missing++;
    else if (A[i]) metres.extra++;
  }
}));

// Each CAD run is carried by the app fragment (same side and group) that
// overlaps it most; other fragments it covers are duplicates of it.
const stats = { ditch: { carried: 0, added: 0, merged: 0, notInCad: 0, typeChanged: 0, startErr: [], endErr: [] } };
const carrier = new Map();
cadDitches.slice().sort((a, b) => (b.ch1 - b.ch0) - (a.ch1 - a.ch0)).forEach(c => {
  let best = null, bo = 0;
  appDitches.forEach(f => {
    if (carrier.has(f.id) || f.side !== c.side || grp(f) !== grp(c)) return;
    const o = overlap(f.ch0, f.ch1, c.ch0, c.ch1);
    if (o > bo) { bo = o; best = f; }
  });
  if (best && bo >= 1) {
    carrier.set(best.id, c);
    stats.ditch.carried++;
    if (best.code !== c.code) stats.ditch.typeChanged++;
    stats.ditch.startErr.push(c.ch0 - best.ch0); stats.ditch.endErr.push(c.ch1 - best.ch1);
    recs.push(base({ action: 'edit', featureId: best.id, set: setFrom(c, best), note: 'From CAD: ' + cadNote(c) }));
  } else {
    stats.ditch.added++;
    recs.push(base({ action: 'add', featureId: 'cad_' + sub + '_' + c.handle, sub, set: Object.assign(setFrom(c), { preset: c.code }), note: 'In the CAD, missing from the data: ' + cadNote(c) }));
  }
});
appDitches.forEach(f => {
  if (carrier.has(f.id)) return;
  const cov = cadDitches.filter(c => c.side === f.side && grp(c) === grp(f)).reduce((t, c) => t + overlap(f.ch0, f.ch1, c.ch0, c.ch1), 0) / Math.max(1, f.ch1 - f.ch0);
  if (cov >= 0.5) { stats.ditch.merged++; recs.push(base({ action: 'delete', featureId: f.id, note: 'Duplicate piece of a CAD run already carried by another feature (' + sheet + ')' })); }
  else { stats.ditch.notInCad++; recs.push(base({ action: 'delete', featureId: f.id, note: 'Not in the CAD drainage on this side, lane and chainage (' + sheet + ')' })); }
});

// ------------------------------------------------------------- points
function matchPoints(appList, cadList, tol, preset, label, extra) {
  const x = extra || (() => ({ cert: 'exact' }));
  const used = new Set();
  const st = { app: appList.length, cad: cadList.length, matched: 0, moved: [], added: 0, removed: 0 };
  appList.forEach(f => {
    let best = null, bd = tol;
    cadList.forEach((c, i) => {
      if (used.has(i) || (f.side !== 'C' && c.side !== f.side)) return;
      const d = Math.abs(c.ch0 - f.ch0);
      if (d <= bd) { bd = d; best = i; }
    });
    // A kind the CAD holds none of is not drawn on this file at all (S03 has no dissipator layer), so nothing is removed for it.
    if (best == null) { if (!cadList.length) { st.kept = (st.kept || 0) + 1; return; } st.removed++; recs.push(base({ action: 'delete', featureId: f.id, note: 'No ' + label + ' in the CAD within ' + tol + ' m (' + sheet + ')' })); return; }
    used.add(best);
    const c = cadList[best];
    st.matched++; st.moved.push(c.ch0 - f.ch0);
    recs.push(base({ action: 'edit', featureId: f.id, set: Object.assign({ ch0: c.ch0, ch1: c.ch0, side: c.side, offsetM: c.offset, sheet: sheetAt(c.ch0) }, x(c)), note: 'From CAD: ' + (c.text || c.layer + ' handle ' + c.handle) }));
  });
  cadList.forEach((c, i) => {
    if (used.has(i)) return;
    st.added++;
    recs.push(base({ action: 'add', featureId: 'cad_' + sub + '_' + (c.handle || ('n' + Math.round(c.ch0 * 10) + c.side)), sub, set: Object.assign({ preset, ch0: c.ch0, ch1: c.ch0, side: c.side, offsetM: c.offset, sheet: sheetAt(c.ch0) }, x(c)), note: 'In the CAD, missing from the data: ' + (c.text || c.layer + ' handle ' + c.handle) }));
  });
  return st;
}
const descents = matchPoints(app.filter(f => f.catKey === 'descent'), cad.features.filter(f => f.kind === 'descent'), 15, 'WD', 'water descent');
const dissip = matchPoints(app.filter(f => f.catKey === 'dissipator'), cad.features.filter(f => f.kind === 'point' && f.code === 'dissipator'), 25, 'D-SD', 'dissipator');

// Riprap: the CAD callouts ("SLOPE PROTECTION L:28m") are label positions, like the app's.
const ripCad = cad.features.filter(f => f.kind === 'riprap');
const riprap = matchPoints(app.filter(f => f.catKey === 'riprap'), cad.features.filter(f => f.kind === 'riprap_note'), 50, 'RIP', 'riprap callout',
  c => Object.assign({ cert: 'label' }, c.stated_length ? { stated: c.stated_length } : {}));

// ------------------------------------------------------------- report
const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const absq = (a, q) => { if (!a.length) return 0; const s = a.map(Math.abs).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const counts = recs.reduce((o, r) => { o[r.action] = (o[r.action] || 0) + 1; return o; }, {});
let md = '# ' + sub + ': CAD drainage vs app data\n\n';
md += 'Source: `' + path.basename(cad.source.drainage) + '` on axis `' + path.basename(cad.source.axis) + '` (' + cad.axis.ticks + ' ticks, ' + fmt(cad.axis.ch_start) + ' → ' + fmt(cad.axis.ch_end) + ').\n\n';
const km = m => (m / 1000).toFixed(1) + ' km';
const tot = metres.same + metres.otherType + metres.missing;
md += '## Ditches\n\nMeasured metre by metre, per side and lane group (platform, toe, crest, berm, track):\n\n| | length | share of CAD |\n|---|---|---|\n';
md += '| CAD ditch length | ' + km(tot) + ' | 100% |\n';
md += '| App had it, same type | ' + km(metres.same) + ' | ' + (metres.same / tot * 100).toFixed(0) + '% |\n';
md += '| App had it, different type | ' + km(metres.otherType) + ' | ' + (metres.otherType / tot * 100).toFixed(0) + '% |\n';
md += '| App missed it | ' + km(metres.missing) + ' | ' + (metres.missing / tot * 100).toFixed(0) + '% |\n';
md += '| App has ditch where the CAD has none | ' + km(metres.extra) + ' | |\n\n';
md += 'Features: ' + appDitches.length + ' app ditch pieces (median ' + (() => { const L = appDitches.map(f => f.ch1 - f.ch0).sort((x, y) => x - y); return L.length ? L[L.length >> 1].toFixed(0) : '0'; })() + ' m long) vs ' + cadDitches.length + ' CAD runs. Corrections: ' + stats.ditch.carried + ' app features take a CAD run (' + stats.ditch.typeChanged + ' change type), ' + stats.ditch.added + ' CAD runs added, ' + stats.ditch.merged + ' duplicate pieces removed, ' + stats.ditch.notInCad + ' pieces not in the CAD removed.\n\n';
md += 'Start shift of carried features (CAD − app): median ' + med(stats.ditch.startErr).toFixed(1) + ' m, 90% within ' + absq(stats.ditch.startErr, 0.9).toFixed(0) + ' m.\n\n';
const td = [...typeDiff.entries()].sort((a, b) => b[1] - a[1]);
if (td.length) { md += '### Where the type differed (app → CAD)\n\n| Change | length |\n|---|---|\n'; td.slice(0, 20).forEach(([k, v]) => { md += '| ' + k + ' | ' + v + ' m |\n'; }); md += '\n'; }
md += '## Water descents\n\nApp ' + descents.app + ', CAD ' + descents.cad + '. Matched ' + descents.matched + ' (within 15 m, same side; median shift ' + med(descents.moved).toFixed(1) + ' m), to add ' + descents.added + ', to remove ' + descents.removed + '.\n\n';
md += '## Dissipators\n\nApp ' + dissip.app + ', CAD ' + dissip.cad + '. Matched ' + dissip.matched + ', to add ' + dissip.added + ', to remove ' + dissip.removed + (dissip.kept ? ' (the CAD file has no dissipator layer, so the app\'s ' + dissip.kept + ' are left as they are)' : '') + '.\n\n';
md += '## Riprap\n\nApp label positions ' + riprap.app + ', CAD callouts ' + riprap.cad + ' (plus ' + ripCad.length + ' hatched areas, not used yet). Matched ' + riprap.matched + ' (within 50 m, same side; median shift ' + med(riprap.moved).toFixed(1) + ' m), to add ' + riprap.added + ', to remove ' + riprap.removed + '.\n\n';
md += '## Corrections file\n\n' + recs.length + ' records: ' + Object.entries(counts).map(([k, v]) => v + ' ' + k).join(', ') + '. Import on the phone (Project → Base data → Import corrections), then review with Check against drawings; every record can be undone.\n';

if (opt('--report')) fs.writeFileSync(opt('--report'), md);
if (opt('--corrections')) fs.writeFileSync(opt('--corrections'), JSON.stringify({ kind: 'kmd-base-corrections', version: 1, exported_at: now, by: 'CAD extraction', source: cad.source, records: recs }, null, 1));
console.log(md);
