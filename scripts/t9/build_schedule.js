#!/usr/bin/env node
/*
 * Type 9 schedule from the contractor's list in NIG/KAMA/FM/2026/4218 (data/t9_letter_4218.json)
 * -> data/t9_schedule.json, the Type 9 pieces the app adds for stretches the drawings do not show.
 *
 *   node scripts/t9/build_schedule.js
 *
 * For each stretch of the letter:
 *   side    the letter gives chainages only. The side is the one the platform falls to, from the cross
 *           sections (data/heights_<SUB>.json, falls_to), as the Type 9 check uses. A station that falls
 *           both ways or has no section takes the side of its neighbour in the stretch.
 *   bridges bridge decks (data/structures.js) carry no ditch and are left out of the pieces.
 *   design  a Type 9 already drawn on the plans (either side) stays the design piece; only the rest of
 *           the stretch becomes a scheduled piece.
 * Pieces under 5 m are dropped (rounding where a drawn Type 9 ends a few metres off the letter's chainage).
 * Ids are built from the side and start chainage, so records on a piece survive a rebuild.
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

const letter = JSON.parse(fs.readFileSync(path.join(root, 'data/t9_letter_4218.json'), 'utf8'));
const NUM = { KNDW: '01', DWKZ: '02', KZDR: '03', DRMR: '04', MRJB: '05' };
const MIN_PIECE = 5;

const subtract = (parts, cuts) => {
  cuts.forEach(([c0, c1]) => {
    parts = parts.flatMap(([p0, p1]) => (c1 <= p0 || c0 >= p1) ? [[p0, p1]] : [[p0, Math.min(p1, c0)], [Math.max(p0, c1), p1]].filter(([x, y]) => y - x > 1e-6));
  });
  return parts;
};
const overlap = (a0, a1, cuts) => cuts.reduce((m, [c0, c1]) => m + Math.max(0, Math.min(a1, c1) - Math.max(a0, c0)), 0);

const out = { source: letter.source, built: new Date().toISOString().slice(0, 10), min_piece_m: MIN_PIECE, stretches: [], pieces: [] };
const totals = {};
Object.keys(letter.stretches).forEach(sub => {
  const heights = JSON.parse(fs.readFileSync(path.join(root, `data/heights_${sub}.json`), 'utf8')).rows.map(r => ({ ch: r[0], fall: r[6] }));
  const bridges = DI.refs().filter(r => r.sub === sub && r.kind === 'bridge').map(r => [r.ch0, r.ch1]);
  const designT9 = (DI.data.bySub[sub] || []).filter(f => f.code === 'T9' && !f.deleted).map(f => [f.ch0, f.ch1]);
  const reg = JSON.parse(fs.readFileSync(path.join(root, `data/section${NUM[sub]}_drawing_register.json`), 'utf8')).documents
    .filter(d => d.category === 'Plan Sheet' && d.start_pk != null);
  const sheetsFor = (a, b) => [...new Set(reg.filter(d => d.start_pk < b && d.end_pk > a).map(d => d.doc_number.replace(/^.*-(DW-\d{5})$/, '$1')))].sort();
  const T = totals[sub] = { letter: 0, bridge: 0, design: 0, scheduled: 0, dropped: 0, inferred: 0 };

  letter.stretches[sub].forEach(([a, b]) => {
    const st = heights.filter(h => h.ch >= a - 0.1 && h.ch <= b + 0.1);
    let side = st.map(h => (h.fall === 'L' || h.fall === 'R') ? h.fall : null);
    let inferred = side.filter(s => !s).length;
    for (let i = 0; i < side.length; i++) if (!side[i] && i > 0 && side[i - 1]) side[i] = side[i - 1];
    for (let i = side.length - 1; i >= 0; i--) if (!side[i] && side[i + 1]) side[i] = side[i + 1];
    if (side.some(s => !s)) {   // no station in the stretch says: the nearest one that does, within 300 m
      const near = heights.filter(h => (h.fall === 'L' || h.fall === 'R') && h.ch > a - 300 && h.ch < b + 300)
        .sort((x, y) => Math.abs(x.ch - (a + b) / 2) - Math.abs(y.ch - (a + b) / 2))[0];
      side = side.map(s => s || (near ? near.fall : 'R'));
    }
    // runs of one side, split halfway between the stations that differ
    const runs = [];
    st.forEach((h, i) => {
      const s0 = Math.max(a, h.ch - 12.5), s1 = Math.min(b, h.ch + 12.5);
      const last = runs[runs.length - 1];
      if (last && last.side === side[i]) last.ch1 = s1; else runs.push({ side: side[i], ch0: s0, ch1: s1 });
    });
    if (runs.length) { runs[0].ch0 = a; runs[runs.length - 1].ch1 = b; }
    for (let i = 1; i < runs.length; i++) runs[i].ch0 = runs[i - 1].ch1;

    const len = b - a;
    T.letter += len; T.inferred += inferred;
    let bridgeM = 0, designM = 0, schedM = 0, droppedM = 0;
    runs.forEach(r => {
      bridgeM += overlap(r.ch0, r.ch1, bridges);
      let parts = subtract([[r.ch0, r.ch1]], bridges);
      const before = parts.reduce((m, [x, y]) => m + (y - x), 0);
      parts = subtract(parts, designT9);
      designM += before - parts.reduce((m, [x, y]) => m + (y - x), 0);
      parts.forEach(([x, y]) => {
        if (y - x < MIN_PIECE) { droppedM += y - x; return; }
        schedM += y - x;
        const c0 = Math.round(x * 10) / 10, c1 = Math.round(y * 10) / 10;
        out.pieces.push({ id: `t9s_${sub}_${r.side}_${Math.round(c0)}`, sub, side: r.side, ch0: c0, ch1: c1, a, b, sheets: sheetsFor(x, y) });
      });
    });
    const r1 = n => Math.round(n * 10) / 10;
    out.stretches.push({ sub, a, b, len, bridge_m: r1(bridgeM), design_m: r1(designM), scheduled_m: r1(schedM), dropped_m: r1(droppedM) });
    T.bridge += bridgeM; T.design += designM; T.scheduled += schedM; T.dropped += droppedM;
  });
});
out.totals = {};
Object.keys(totals).forEach(k => { out.totals[k] = Object.fromEntries(Object.entries(totals[k]).map(([n, v]) => [n, Math.round(v)])); });
fs.writeFileSync(path.join(root, 'data/t9_schedule.json'), JSON.stringify(out));
console.log('pieces', out.pieces.length);
console.table(out.totals);
