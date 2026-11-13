#!/usr/bin/env node
/*
 * Connectors: where a drain ends, and what it runs into, from the drainage plans
 * (data/dwg/<SUB>_plan.json, scripts/dwg/extract_plan.py) -> data/connectors.json.
 *
 *   node scripts/dwg/build_connectors.js
 *
 * The plans draw, as blocks with an insertion point:
 *   DRN_CONNECTION_BOX_1..6 (CVR, CVT, CVD, CXV, CP2TB, CB, CXL)   connection boxes, where a ditch runs into
 *                                    another ditch, a descent or a culvert (DW-10003 details the joints)
 *   MH                               manholes on the Type 6 collector drains
 *   DRN_MANHOLE_GRID_COVER (CXC)     manholes with a grid cover (inlets)
 *   DRN_PIPE                         outlet pipes
 *   DRN_DISSIPATOR                   energy dissipators, where a ditch or a descent ends on the ground
 * and each ditch as a polyline with its two ends (x0y0, x1y1).
 *
 * A ditch end within END_M of a connector's insertion point runs into it. Each connector then names the app's
 * features it joins: a ditch of the same type and side with an end within FEAT_M of the connector, or a water
 * descent of that side within FEAT_M. A dissipator of the plans is the app's own dissipator nearest it (same
 * side, within 25 m), so it is not added twice; boxes, manholes and pipes become features of their own.
 * Duplicate blocks (the same block twice at one point) are kept once.
 *
 * Output: { built, subs: { SUB: [connector] }, ends: { featureId: { a: …, b: … } } }
 *   connector  { id, sub, kind: box|manhole|grid|pipe|dissipator, type, block, ch, off (left +), side, links: [[fid, end]] }
 *              end: 'a' (start) or 'b' (end) of a ditch, 'p' a descent, 'on' a Type 6 run the manhole sits on
 *   ends       for each ditch end that runs into something: the connector's id (or the app dissipator's id)
 *   geom       for the app's ditches: the plan's pieces of it, [ch, offset, ch, offset] end to end
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
['bundle', 'section01_bundle', 'section04_bundle', 'section05_bundle', 'structures', 'section02_bundle'].forEach(n => require(path.join(root, 'data', n + '.js')));
require(path.join(root, 'ui/model.js'));
const DI = window.DI;
DI.init();
DI.loadT9Schedule(JSON.parse(fs.readFileSync(path.join(root, 'data/t9_schedule.json'), 'utf8')), DI.T9_SCHEDULE_ON);

const END_M = 4;      // a ditch end this close to a block's insertion point runs into it
const FEAT_M = 15;    // the app's features are good to about 4 m (scaled), more where a ditch was split
const KIND = { connection_box: 'box', manhole: 'manhole', manhole_grid: 'grid', pipe: 'pipe', dissipator: 'dissipator' };
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = n => Math.round(n * 10) / 10;

// chainage and offset (left +) of a plan point, on the plan's own axis ([ch, x, y] every 25 m)
function projector(axis) {
  const P = axis.points;
  return ([x, y]) => {
    let best = null;
    for (let i = 0; i < P.length - 1; i++) {
      const [c0, x0, y0] = P[i], [c1, x1, y1] = P[i + 1];
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
      const d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
      if (!best || d < best.d) best = { d, ch: c0 + t * (c1 - c0), off: -((x - x0) * dy - (y - y0) * dx) / Math.sqrt(L2) };
    }
    return best;
  };
}

const out = { built: new Date().toISOString().slice(0, 10), source: 'data/dwg/<SUB>_plan.json', subs: {}, ends: {}, geom: {} };
const stats = {};
['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB'].forEach(sub => {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'data/dwg', sub + '_plan.json'), 'utf8'));
  const ditches = plan.features.filter(f => f.kind === 'ditch' && f.x0y0 && f.x1y1);
  const descents = plan.features.filter(f => f.kind === 'descent');
  const feats = DI.data.bySub[sub] || [];
  const appDitches = feats.filter(f => DI.isSpan(f));
  const appWD = feats.filter(f => f.code === 'WD');
  const appDiss = feats.filter(f => /^D-/.test(f.code || ''));
  const usedDiss = new Set();
  const seen = [];
  const list = [];
  const S = stats[sub] = { points: 0, dup: 0, kept: 0, linked: 0, links: 0, dissOnApp: 0 };
  plan.features.filter(f => f.kind === 'point' && KIND[f.code]).sort((a, b) => a.ch0 - b.ch0).forEach(p => {
    S.points++;
    if (seen.some(q => q.code === p.code && d2(q.xy, p.xy) < 0.5)) { S.dup++; return; }
    seen.push(p);
    const kind = KIND[p.code];
    const off = p.side === 'L' ? p.offset : p.side === 'R' ? -p.offset : 0;
    const side = p.side === 'C' ? (off >= 0 ? 'L' : 'R') : p.side;
    // the plan's ditches with an end at this block, and descents that start or stop here
    const touch = [];
    ditches.forEach(d => {
      const e0 = d2(d.x0y0, p.xy), e1 = d2(d.x1y1, p.xy);
      if (Math.min(e0, e1) <= (kind === 'dissipator' ? END_M + 2 : END_M)) touch.push(d.code);
    });
    descents.forEach(d => {
      if (d.side === side && Math.abs(d.ch0 - p.ch0) <= END_M && (Math.abs(d.offset_min - p.offset) <= END_M || Math.abs(d.offset_max - p.offset) <= END_M)) touch.push('WD');
    });
    // the app's features those are
    const links = [];
    [...new Set(touch)].forEach(code => {
      if (code === 'WD') {
        const w = appWD.filter(f => f.side === side && Math.abs(f.ch0 - p.ch0) <= FEAT_M).sort((a, b) => Math.abs(a.ch0 - p.ch0) - Math.abs(b.ch0 - p.ch0))[0];
        if (w) links.push([w.id, 'p']);
        return;
      }
      appDitches.filter(f => f.code === code && f.side === side).forEach(f => {
        const da = Math.abs(f.ch0 - p.ch0), db = Math.abs(f.ch1 - p.ch0);
        if (Math.min(da, db) <= FEAT_M) links.push([f.id, da <= db ? 'a' : 'b', Math.min(da, db)]);
      });
    });
    // a manhole sits on a Type 6 run (the drain passes through it), not at the end of one
    if ((kind === 'manhole' || kind === 'grid') && !links.length) {
      const t6 = appDitches.filter(f => f.code === 'T6' && f.ch0 - 5 <= p.ch0 && p.ch0 <= f.ch1 + 5).sort((a, b) => (a.side === side ? 0 : 1) - (b.side === side ? 0 : 1))[0];
      if (t6) links.push([t6.id, 'on']);
    }
    // one end of a feature takes the nearest connector only (settled below)
    let id = 'cn_' + sub + '_' + p.handle;
    if (kind === 'dissipator') {
      const a = appDiss.filter(f => f.side === side && Math.abs(f.ch0 - p.ch0) <= 25 && !usedDiss.has(f.id)).sort((x, y) => Math.abs(x.ch0 - p.ch0) - Math.abs(y.ch0 - p.ch0))[0];
      if (a) { id = a.id; usedDiss.add(a.id); S.dissOnApp++; }
    }
    list.push({ id, sub, kind, type: p.layer.replace(/^DRN_CONNECTION_BOX_(\d)$/, 'Type $1').replace(/^DRN_BOXTRAPTRI$/, 'Trapezoidal-triangular').replace(/^DRN_MANHOLE_GRID_COVER$/, 'Grid cover').replace(/^DRN_/, ''), block: p.block && p.block !== '*U' ? p.block : null,
      ch: r1(p.ch0), off: r1(off), side, app: id === 'cn_' + sub + '_' + p.handle ? false : true, links });
  });
  // each feature end goes to its nearest connector
  const best = {};
  list.forEach(c => c.links.forEach(([fid, end, dist]) => {
    if (end === 'p' || end === 'on') return;
    const k = fid + '|' + end;
    if (!best[k] || dist < best[k].dist) best[k] = { c, dist };
  }));
  list.forEach(c => { c.links = c.links.filter(([fid, end]) => end === 'p' || end === 'on' || best[fid + '|' + end].c === c).map(([fid, end]) => [fid, end]); });
  Object.entries(best).forEach(([k, v]) => { const [fid, end] = k.split('|'); (out.ends[fid] = out.ends[fid] || {})[end] = v.c.id; });
  S.kept = list.length; S.linked = list.filter(c => c.links.length).length; S.links = list.reduce((n, c) => n + c.links.length, 0);
  out.subs[sub] = list;
  // Where each ditch of the plans really lies: its two ends as chainage and offset, given to the app's ditch
  // of the same type and side it overlaps most. For the plan view (the strip draws lanes, not offsets).
  const at = projector(plan.axis);
  ditches.forEach(d => {
    const p0 = at(d.x0y0), p1 = at(d.x1y1);
    if (p0.d > 400 || p1.d > 400) return;
    const a0 = Math.min(p0.ch, p1.ch), a1 = Math.max(p0.ch, p1.ch);
    const f = appDitches.filter(x => x.code === d.code && x.side === d.side)
      .map(x => ({ x, ov: Math.min(a1, x.ch1) - Math.max(a0, x.ch0) })).filter(o => o.ov > -5).sort((u, v) => v.ov - u.ov)[0];
    if (!f) return;
    (out.geom[f.x.id] = out.geom[f.x.id] || []).push([r1(p0.ch), r1(p0.off), r1(p1.ch), r1(p1.off)]);
  });
});
fs.writeFileSync(path.join(root, 'data/connectors.json'), JSON.stringify(out));
console.table(stats);
const ends = Object.values(out.ends).reduce((n, e) => n + Object.keys(e).length, 0);
const spans = DI.data.features.filter(f => DI.isSpan(f)).length;
console.log('ditch ends that run into a connector:', ends, 'of', spans * 2);
