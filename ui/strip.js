/*
 * Drainage Inspector — the strip.
 * Chainage runs up the screen; offset becomes five fixed lanes a side.
 * Lateral distance is ranked, not scaled. Walk the other way and the strip
 * turns with you: LEFT is still the lanes marked LEFT, now on your right.
 */
(function () {
  'use strict';
  const DI = window.DI;
  const ORDER_L = ['off', 'crest', 'toe', 'face', 'plat'];
  const SPINE = 60;
  const PX_PER_M = 1.9;
  const TOL = 4; // derived tolerance, metres

  function geom(W, facing) {
    const lw = (W - SPINE) / 10;
    const cx = W / 2;
    const flip = facing === 'decreasing';
    function laneX(side, lane) {
      if (lane === 'cl' || lane === 'across') return cx;
      const i = ORDER_L.indexOf(lane);
      if (i < 0) return cx;
      let x = side === 'R' ? cx + SPINE / 2 + (4 - i) * lw + lw / 2 : i * lw + lw / 2;
      if (side === 'C') x = i * lw + lw / 2;
      return flip ? W - x : x;
    }
    // Columns in screen order with their tint.
    const cols = [];
    ORDER_L.forEach((l, i) => cols.push({ side: 'L', lane: l, x0: i * lw, x1: (i + 1) * lw }));
    cols.push({ side: 'C', lane: 'cl', x0: cx - SPINE / 2, x1: cx + SPINE / 2 });
    ORDER_L.slice().reverse().forEach((l, i) => cols.push({ side: 'R', lane: l, x0: cx + SPINE / 2 + i * lw, x1: cx + SPINE / 2 + (i + 1) * lw }));
    if (flip) cols.forEach(c => { const a = W - c.x1, b = W - c.x0; c.x0 = a; c.x1 = b; });
    cols.sort((a, b) => a.x0 - b.x0);
    return { lw, cx, flip, laneX, cols };
  }

  const TINT = { off: 'var(--lane-off)', crest: 'var(--lane-crest)', toe: 'var(--lane-toe)', face: 'var(--lane-face)', plat: 'var(--lane-plat)', cl: 'var(--lane-spine)' };

  function fillStyle(fill) {
    if (fill === 'solid') return 'fill:var(--ink);stroke:var(--ink)';
    if (fill === 'hatch') return 'fill:url(#pHatch);stroke:var(--ink)';
    return 'fill:var(--surface);stroke:var(--ink)';
  }

  function defs() {
    return '<defs>' +
      '<pattern id="pHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--surface)"/><rect width="2.2" height="6" style="fill:var(--ink)"/></pattern>' +
      '<pattern id="pNone" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.6" height="9" style="fill:#9A9C94"/></pattern>' +
      '<pattern id="pNoData" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="2" height="6" style="fill:#BDBFB7"/></pattern>' +
      '<pattern id="pHazard" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" style="fill:var(--hivis)"/><rect width="5" height="10" fill="#121311"/></pattern>' +
      '</defs>';
  }

  function chip(x, y, text, opts) {
    const o = opts || {};
    const fs = o.fs || 13;
    const w = Math.max(20, text.length * fs * (o.mono ? 0.62 : 0.56) + 10);
    const h = fs + 9;
    let ax = x - (o.anchor === 'end' ? w : o.anchor === 'start' ? 0 : w / 2);
    if (o.clampW) ax = Math.max(2, Math.min(o.clampW - w - 2, ax));
    const bg = o.bg || 'var(--surface)', fg = o.fg || 'var(--ink)', st = o.stroke === false ? 'none' : (o.strokeC || 'var(--ink)');
    return '<g><rect x="' + ax + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" style="fill:' + bg + ';stroke:' + st + ';stroke-width:1.5"' + (o.dash ? ' stroke-dasharray="4 3"' : '') + '/>' +
      '<text x="' + (ax + w / 2) + '" y="' + (y + fs * 0.36) + '" text-anchor="middle" style="fill:' + fg + ';font:' + (o.weight || 700) + ' ' + fs + 'px ' + (o.mono ? 'var(--f-mono)' : 'var(--f-cond)') + (o.italic ? ';font-style:italic' : '') + (o.ls ? ';letter-spacing:' + o.ls : '') + '">' + DI.esc(text) + '</text></g>';
  }

  class Strip {
    constructor(el, opts) {
      this.el = el;
      this.opts = opts || {};
      this.hits = [];
      this.viewCh = null;
      this.drag = null;
      el.addEventListener('pointerdown', e => this.down(e));
      el.addEventListener('pointermove', e => this.move(e));
      el.addEventListener('pointerup', e => this.up(e));
      el.addEventListener('pointercancel', () => { this.drag = null; });
      el.addEventListener('wheel', e => { e.preventDefault(); this.pan(-e.deltaY); }, { passive: false });
    }
    down(e) { this.drag = { y: e.clientY, x: e.clientX, y0: e.clientY, moved: false }; try { this.el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
    move(e) {
      if (!this.drag) return;
      const dy = e.clientY - this.drag.y;
      if (Math.abs(e.clientY - this.drag.y0) > 6) this.drag.moved = true;
      if (this.drag.moved) { this.pan(dy); this.drag.y = e.clientY; }
    }
    up(e) {
      const d = this.drag; this.drag = null;
      if (!d || d.moved) return;
      const r = this.el.getBoundingClientRect();
      this.tap(e.clientX - r.left, e.clientY - r.top);
    }
    pan(dy) {
      if (!this.state) return;
      const dir = this.state.facing === 'decreasing' ? -1 : 1;
      const base = this.viewCh == null ? this.state.ch : this.viewCh;
      this.viewCh = base + (dy / PX_PER_M) * dir;
      if (this.opts.onPan) this.opts.onPan(this.viewCh);
      this.render(this.state);
    }
    recentre() { this.viewCh = null; if (this.state) this.render(this.state); }
    tap(x, y) {
      let best = null, bd = 1e9;
      this.hits.forEach(h => {
        const dx = x < h.x0 ? h.x0 - x : x > h.x1 ? x - h.x1 : 0;
        const dy = y < h.y0 ? h.y0 - y : y > h.y1 ? y - h.y1 : 0;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = h; }
      });
      if (best && bd < 16 && this.opts.onTap) this.opts.onTap(best.f);
    }

    render(state) {
      this.state = state;
      const W = this.el.clientWidth || 390, H = this.el.clientHeight || 500;
      const g = geom(W, state.facing);
      const dir = state.facing === 'decreasing' ? -1 : 1;
      const viewCh = this.viewCh == null ? state.ch : this.viewCh;
      const readY = Math.round(H * 0.78);
      const Y = ch => readY - (ch - viewCh) * PX_PER_M * dir;
      const chTop = viewCh + (readY / PX_PER_M) * dir;
      const chBot = viewCh - ((H - readY) / PX_PER_M) * dir;
      const lo = Math.min(chTop, chBot) - 30, hi = Math.max(chTop, chBot) + 30;
      const hits = [];
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs();

      // lanes
      g.cols.forEach(c => {
        s += '<rect x="' + c.x0 + '" y="0" width="' + (c.x1 - c.x0) + '" height="' + H + '" style="fill:' + TINT[c.lane] + '"/>';
        s += '<line x1="' + c.x0 + '" y1="0" x2="' + c.x0 + '" y2="' + H + '" style="stroke:var(--rule);stroke-width:1"/>';
      });

      // chainage without design data (outside the extracted sub-sections)
      const subsWithData = DI.LINES.find(l => l.id === state.line).subs.filter(sb => DI.hasData(sb.id));
      const covered = subsWithData.map(sb => [sb.from, sb.to]);
      const gaps = [];
      let cur = lo;
      covered.sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { if (a > cur) gaps.push([cur, Math.min(a, hi)]); cur = Math.max(cur, b); });
      if (cur < hi) gaps.push([cur, hi]);
      gaps.forEach(([a, b]) => {
        if (b <= lo || a >= hi || b - a < 1) return;
        const y0 = Math.min(Y(a), Y(b)), y1 = Math.max(Y(a), Y(b));
        s += '<rect x="0" y="' + y0 + '" width="' + W + '" height="' + (y1 - y0) + '" style="fill:url(#pNoData);opacity:0.55"/>';
        const my = Math.max(40, Math.min(H - 40, (y0 + y1) / 2));
        if (y1 - y0 > 60) s += chip(W / 2, my, 'NO DESIGN DATA · NOT EXTRACTED YET', { fs: 13, ls: '0.06em', clampW: W });
      });

      // absences by design, drawn in their lane
      (state.absences || []).forEach(a => {
        if (a.ch1 < lo || a.ch0 > hi) return;
        a.sides.forEach(sd => {
          const x = g.laneX(sd, a.lane), w = g.lw * 0.62;
          const y0 = Math.max(-5, Math.min(Y(a.ch0), Y(a.ch1))), y1 = Math.min(H + 5, Math.max(Y(a.ch0), Y(a.ch1)));
          s += '<rect x="' + (x - w / 2) + '" y="' + y0 + '" width="' + w + '" height="' + (y1 - y0) + '" style="fill:url(#pNone)"/>';
          const my = (y0 + y1) / 2;
          s += '<text transform="translate(' + (x + 5) + ',' + my + ') rotate(-90)" text-anchor="middle" style="fill:var(--ink-2);font:700 12px var(--f-sans);letter-spacing:0.1em">' + DI.esc(a.label || 'NONE · BY DESIGN') + '</text>';
        });
      });

      // near band (±20 m around you)
      if (state.tier !== 'poor') {
        const ya = Y(state.userCh + 20), yb = Y(state.userCh - 20);
        const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
        s += '<rect x="0" y="' + y0 + '" width="' + W + '" height="' + (y1 - y0) + '" style="fill:var(--hivis-band)"/>';
        s += '<line x1="0" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '" style="stroke:var(--ink);stroke-width:1.2" stroke-dasharray="6 4"/>';
        s += '<line x1="0" y1="' + y1 + '" x2="' + W + '" y2="' + y1 + '" style="stroke:var(--ink);stroke-width:1.2" stroke-dasharray="6 4"/>';
      }

      // spine: ticks, track, labels
      const sx0 = g.cx - SPINE / 2, sx1 = g.cx + SPINE / 2;
      const t0 = Math.floor(lo / 10) * 10;
      for (let c = t0; c <= hi; c += 10) {
        const y = Y(c);
        if (y < -10 || y > H + 10) continue;
        s += '<line x1="' + (sx0 + 3) + '" y1="' + y + '" x2="' + (sx0 + 10) + '" y2="' + y + '" style="stroke:var(--ink);stroke-width:1.6"/>';
        s += '<line x1="' + (sx1 - 10) + '" y1="' + y + '" x2="' + (sx1 - 3) + '" y2="' + y + '" style="stroke:var(--ink);stroke-width:1.6"/>';
      }
      s += '<line x1="' + g.cx + '" y1="0" x2="' + g.cx + '" y2="' + H + '" style="stroke:var(--ink);stroke-width:4"/>';

      // features
      const feats = state.features.filter(f => f.ch1 >= lo && f.ch0 <= hi);
      const tags = [];
      const late = [];
      const points = [];
      feats.forEach(f => {
        const st = DI.statusOf(f);
        const faded = st.removed ? ';opacity:0.45' : '';
        if (f.kind === 'cross') {
          const xL = g.laneX('L', 'toe'), xR = g.laneX('R', 'toe');
          const xa = Math.min(xL, xR) - g.lw * 0.3, xb = Math.max(xL, xR) + g.lw * 0.3;
          let y0 = Y(f.ch0), y1 = Y(f.ch1);
          const hh = f.catKey === 'bridge' ? 16 : 12;
          if (Math.abs(y1 - y0) < hh) { const m = (y0 + y1) / 2; y0 = m - hh / 2; y1 = m + hh / 2; }
          const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
          s += '<rect x="' + xa + '" y="' + ya + '" width="' + (xb - xa) + '" height="' + (yb - ya) + '" style="' + fillStyle(st.fill) + ';stroke-width:2' + faded + '"' + (st.fill === 'never' ? ' stroke-dasharray="5 3"' : '') + '/>';
          const lbl = f.cert === 'exact' ? DI.fmtPlus(f.ch0, 3) : '≈' + DI.fmtPlus(f.ch0, 0);
          late.push(chip(W - 2, (ya + yb) / 2, lbl, { anchor: 'end', mono: true, fs: 14, weight: 600, bg: f.cert === 'exact' ? '#121311' : 'var(--surface)', fg: f.cert === 'exact' ? '#fff' : 'var(--ink)' }));
          hits.push({ f, x0: xa, x1: W, y0: ya - 4, y1: yb + 4 });
          if (st.defects.length) s += warnMark(xb + 4, ya - 16);
          if (st.changes.length) s += revMark(g.cx, ya - 14, st.changes[0], W);
          return;
        }
        if (f.kind === 'buried') {
          const x = g.cx + (f.side === 'R' ? 1 : -1) * (g.flip ? -1 : 1) * 17;
          const y0 = Math.max(-5, Math.min(Y(f.ch0), Y(f.ch1))), y1 = Math.min(H + 5, Math.max(Y(f.ch0), Y(f.ch1)));
          s += '<line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + y1 + '" style="stroke:var(--ink);stroke-width:3' + faded + '" stroke-dasharray="5 4"/>';
          hits.push({ f, x0: x - 6, x1: x + 6, y0, y1 });
          tags.push({ x, yTop: Math.min(Y(f.ch0), Y(f.ch1)), code: f.code, dashed: true });
          return;
        }
        const x = g.laneX(f.side, f.lane);
        if (f.kind === 'label') {
          const y = Y(f.ch0);
          s += '<circle cx="' + x + '" cy="' + y + '" r="10" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.8' + faded + '" stroke-dasharray="4 3"/>';
          s += '<text x="' + x + '" y="' + (y + 25) + '" text-anchor="middle" style="fill:var(--ink);font:italic 700 12.5px var(--f-cond)">L=' + Math.round(f.stated || 0) + 'm</text>';
          hits.push({ f, x0: x - 12, x1: x + 12, y0: y - 12, y1: y + 12 });
          if (st.defects.length) s += warnMark(x + 10, y - 22);
          return;
        }
        if (f.kind === 'point') { points.push({ f, st, x, y: Y(f.ch0) }); return; }
        // linear bar
        const bw = 11;
        let a = f.ch0, b = f.ch1;
        const derived = f.cert === 'derived' && b - a > TOL * 3;
        if (derived) { a += TOL; b -= TOL; }
        const ya = Y(a), yb = Y(b);
        const y0 = Math.max(-6, Math.min(ya, yb)), y1 = Math.min(H + 6, Math.max(ya, yb));
        if (y1 > y0) {
          s += '<rect x="' + (x - bw / 2) + '" y="' + y0 + '" width="' + bw + '" height="' + (y1 - y0) + '" style="' + fillStyle(st.fill) + ';stroke-width:2' + faded + '"' + (st.fill === 'never' ? ' stroke-dasharray="4 3"' : '') + '/>';
        }
        if (derived) {
          const capPx = Math.max(12, TOL * PX_PER_M);
          [[a, f.ch0], [b, f.ch1]].forEach(([inner]) => {
            const yi = Y(inner);
            const outward = (inner === a ? -1 : 1) * dir; // toward the true end, in chainage
            const ye = yi - outward * capPx;
            s += '<line x1="' + x + '" y1="' + yi + '" x2="' + x + '" y2="' + ye + '" style="stroke:var(--ink);stroke-width:3" stroke-dasharray="2 3"/>';
          });
        }
        if (st.removed) s += '<line x1="' + (x - 9) + '" y1="' + y0 + '" x2="' + (x + 9) + '" y2="' + y1 + '" style="stroke:var(--rev);stroke-width:2.5"/>';
        hits.push({ f, x0: x - 10, x1: x + 10, y0: y0 - 4, y1: y1 + 4 });
        tags.push({ x, yTop: Math.min(Y(f.ch0), Y(f.ch1)), yBot: Math.max(Y(f.ch0), Y(f.ch1)), code: f.code });
        if (st.defects.length) s += warnMark(x + 8, Math.max(8, Math.min(H - 24, Math.min(ya, yb) - 4)));
        if (st.changes.length) s += revMark(x, Math.max(14, Math.min(ya, yb) + 20), st.changes[0], W);
      });

      // points: fold those in the same lane within 10 m into a count
      const groups = {};
      points.forEach(p => { const k = p.f.side + p.f.lane; (groups[k] = groups[k] || []).push(p); });
      Object.values(groups).forEach(list => {
        list.sort((a, b) => a.f.ch0 - b.f.ch0);
        let run = [];
        const flush = () => {
          if (!run.length) return;
          const p = run[0];
          if (run.length === 1) {
            s += '<rect x="' + (p.x - 8) + '" y="' + (p.y - 8) + '" width="16" height="16" style="' + fillStyle(p.st.fill) + ';stroke-width:2' + (p.st.removed ? ';opacity:0.45' : '') + '"' + (p.st.fill === 'never' ? ' stroke-dasharray="3 2"' : '') + '/>';
            if (p.st.defects.length) s += warnMark(p.x + 9, p.y - 22);
            if (p.st.removed) s += '<path d="M' + (p.x - 11) + ' ' + (p.y - 11) + ' L' + (p.x + 11) + ' ' + (p.y + 11) + ' M' + (p.x + 11) + ' ' + (p.y - 11) + ' L' + (p.x - 11) + ' ' + (p.y + 11) + '" style="stroke:var(--rev);stroke-width:2.5"/>';
            hits.push({ f: p.f, x0: p.x - 11, x1: p.x + 11, y0: p.y - 11, y1: p.y + 11 });
          } else {
            const ym = run.reduce((t, q) => t + q.y, 0) / run.length;
            s += '<rect x="' + (p.x - 9) + '" y="' + (ym - 13) + '" width="22" height="22" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.6"/>';
            s += '<rect x="' + (p.x - 13) + '" y="' + (ym - 9) + '" width="22" height="22" style="fill:var(--surface);stroke:var(--ink);stroke-width:2"/>';
            s += '<text x="' + (p.x - 2) + '" y="' + (ym + 8) + '" text-anchor="middle" style="fill:var(--ink);font:700 16px var(--f-cond)">' + run.length + '</text>';
            if (run.some(q => q.st.defects.length)) s += warnMark(p.x + 10, ym - 28);
            hits.push({ f: p.f, x0: p.x - 14, x1: p.x + 14, y0: ym - 14, y1: ym + 14 });
          }
          run = [];
        };
        list.forEach(p => {
          if (run.length && Math.abs(p.f.ch0 - run[0].f.ch0) > 10) flush();
          run.push(p);
        });
        flush();
      });

      // unlisted field marks ("?" — not on the drawings)
      (state.unlisted || []).forEach(u => {
        if (u.ch < lo || u.ch > hi) return;
        const x = g.laneX(u.side, DI.laneOf(u.offset || 0) === 'cl' ? 'plat' : DI.laneOf(u.offset || 0)), y = Y(u.ch);
        s += '<rect x="' + (x - 10) + '" y="' + (y - 10) + '" width="20" height="20" style="fill:var(--hivis);stroke:#121311;stroke-width:2"/>';
        s += '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" style="fill:#121311;font:700 16px var(--f-cond)">?</text>';
      });

      // spine labels on top of the track
      for (let c = Math.floor(lo / 50) * 50; c <= hi; c += 50) {
        const y = Y(c);
        if (y < 8 || y > H - 8) continue;
        const major = c % 100 === 0;
        const t = major ? DI.fmtCh(c) : '+' + String(c % 1000).padStart(3, '0');
        const fs = major ? 15 : 13;
        const w = t.length * fs * 0.56 + 8;
        s += '<rect x="' + (g.cx - w / 2) + '" y="' + (y - fs / 2 - 3) + '" width="' + w + '" height="' + (fs + 6) + '" style="fill:var(--lane-spine)"/>';
        s += '<text x="' + g.cx + '" y="' + (y + fs * 0.36) + '" text-anchor="middle" style="fill:var(--ink);font:' + (major ? 700 : 600) + ' ' + fs + 'px var(--f-cond)">' + t + '</text>';
      }

      // type tags on linear marks, pinned to the top edge when the run goes off-screen
      const placed = [];
      tags.sort((a, b) => a.yTop - b.yTop).forEach(t => {
        let y = t.yTop + 12;
        if (t.yTop < 14) y = 14;
        if (t.yBot != null && y > t.yBot - 4 && t.yBot < 14) return;
        if (y > H - 8) return;
        // one tag per run; skip a tag that would sit on top of another in the same lane
        if (placed.some(q => Math.abs(q.x - t.x) < 4 && Math.abs(q.y - y) < 26)) return;
        placed.push({ x: t.x, y });
        s += chip(t.x, y, t.code, { fs: 14, dash: t.dashed });
      });

      // near band labels
      if (state.tier !== 'poor') {
        const ya = Y(state.userCh + 20), yb = Y(state.userCh - 20);
        s += chip(W - 3, ya, (dir > 0 ? '+' : '−') + '20 m', { anchor: 'end', fs: 13 });
        s += chip(W - 3, yb, (dir > 0 ? '−' : '+') + '20 m', { anchor: 'end', fs: 13 });
      }

      // reading line / you
      const yu = Y(state.userCh);
      if (state.tier === 'poor') {
        const ya = Y(state.userCh + state.acc), yb = Y(state.userCh - state.acc);
        const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
        s += '<rect x="0" y="' + y0 + '" width="' + W + '" height="' + (y1 - y0) + '" style="fill:var(--hivis);opacity:0.3"/>';
        s += '<line x1="0" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '" style="stroke:var(--ink);stroke-width:2" stroke-dasharray="7 4"/>';
        s += '<line x1="0" y1="' + y1 + '" x2="' + W + '" y2="' + y1 + '" style="stroke:var(--ink);stroke-width:2" stroke-dasharray="7 4"/>';
        s += chip(8, Math.max(14, y0 + 16), 'SOMEWHERE IN HERE · ±' + Math.round(state.acc) + ' m', { anchor: 'start', fs: 15, bg: '#121311', fg: '#fff', stroke: false, ls: '0.02em' });
      } else if (state.source === 'hand') {
        s += '<line x1="0" y1="' + yu + '" x2="' + W + '" y2="' + yu + '" style="stroke:var(--ink);stroke-width:4" stroke-dasharray="14 8"/>';
        s += chip(8, yu - 24, '✋ SET BY HAND', { anchor: 'start', fs: 15, bg: '#121311', fg: '#fff', stroke: false, ls: '0.02em' });
      } else {
        s += '<rect x="0" y="' + (yu - 6) + '" width="' + W + '" height="12" style="fill:var(--hivis);opacity:0.9"/>';
        s += '<line x1="0" y1="' + (yu - 6) + '" x2="' + W + '" y2="' + (yu - 6) + '" style="stroke:var(--ink);stroke-width:1.5"/>';
        s += '<line x1="0" y1="' + (yu + 6) + '" x2="' + W + '" y2="' + (yu + 6) + '" style="stroke:var(--ink);stroke-width:1.5"/>';
        const lane = DI.laneOf(state.offset || 0);
        const ux = lane === 'cl' ? g.cx : g.laneX(state.offset > 0 ? 'L' : 'R', lane);
        s += '<circle cx="' + ux + '" cy="' + yu + '" r="13" style="fill:var(--hivis);stroke:#121311;stroke-width:4"/>';
      }

      s += late.join('') + '</svg>';
      this.el.innerHTML = s;
      this.hits = hits;
      this.visible = { lo: Math.min(chTop, chBot), hi: Math.max(chTop, chBot) };
    }
  }

  function warnMark(x, y) {
    return '<g transform="translate(' + x + ',' + y + ')"><path d="M9 1 L17.5 16 H0.5 Z" style="fill:var(--surface);stroke:var(--defect);stroke-width:2;stroke-linejoin:round"/><path d="M9 6.5 V10.5 M9 13 V13.2" style="stroke:var(--defect);stroke-width:2;stroke-linecap:round"/></g>';
  }
  function revMark(x, y, rec, W) {
    const word = rec.action === 'remove' ? 'REMOVED' : rec.action === 'add' ? 'NEW' : 'CHANGED';
    return chip(x, y, word + ' Δ' + (rec.source && rec.source.rev || ''), { fs: 13, bg: 'var(--rev)', fg: '#fff', stroke: false, clampW: W, ls: '0.04em' });
  }

  // ------------------------------------------------------------------
  // The section at your chainage: numbered features that match the list.
  function sectionCut(items, facing, W, fitH) {
    const H = 300;
    const flip = facing === 'decreasing';
    const cx = W / 2;
    const scaleX = v => cx + (flip ? -v : v); // v in "screen units", positive = screen right
    // lateral screen positions per lane (left is negative when facing increasing)
    const pos = { cl: 0, plat: W * 0.13, face: W * 0.25, toe: W * 0.36, crest: W * 0.44, off: W * 0.47 };
    const baseY = 190, topY = 100;
    const outH = Math.max(170, Math.min(H, fitH || H));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + outH + '" preserveAspectRatio="xMidYMid slice">' + defs();
    const lw = (W - SPINE) / 10;
    [['off', 0], ['crest', 1], ['toe', 2], ['face', 3], ['plat', 4]].forEach(([l, i]) => {
      s += '<rect x="' + i * lw + '" y="0" width="' + lw + '" height="' + H + '" style="fill:' + TINT[l] + '"/>';
      s += '<rect x="' + (W - (i + 1) * lw) + '" y="0" width="' + lw + '" height="' + H + '" style="fill:' + TINT[l] + '"/>';
    });
    s += '<rect x="' + (cx - SPINE / 2) + '" y="0" width="' + SPINE + '" height="' + H + '" style="fill:var(--lane-spine)"/>';
    // ground and embankment
    s += '<line x1="0" y1="' + baseY + '" x2="' + W + '" y2="' + baseY + '" style="stroke:var(--ink-3);stroke-width:1.5"/>';
    const pw = W * 0.2;
    s += '<path d="M' + (cx - W * 0.32) + ' ' + baseY + ' L' + (cx - pw / 2) + ' ' + topY + ' H' + (cx + pw / 2) + ' L' + (cx + W * 0.32) + ' ' + baseY + '" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"/>';
    s += '<path d="M' + (cx - pw * 0.4) + ' ' + topY + ' L' + (cx - pw * 0.3) + ' ' + (topY - 16) + ' H' + (cx + pw * 0.3) + ' L' + (cx + pw * 0.4) + ' ' + topY + '" style="fill:var(--rule);stroke:var(--ink);stroke-width:1.5"/>';
    s += '<rect x="' + (cx - pw * 0.25) + '" y="' + (topY - 22) + '" width="6" height="6" style="fill:var(--ink)"/><rect x="' + (cx + pw * 0.25 - 6) + '" y="' + (topY - 22) + '" width="6" height="6" style="fill:var(--ink)"/>';
    s += '<text x="' + cx + '" y="' + (topY - 38) + '" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">7.00 m platform</text>';
    s += '<text x="' + (cx - W * 0.33) + '" y="' + (baseY + 50) + '" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">' + (flip ? '+' : '−') + '13 m</text>';
    s += '<text x="' + (cx + W * 0.33) + '" y="' + (baseY + 50) + '" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">' + (flip ? '−' : '+') + '13 m</text>';
    s += '<text x="14" y="' + (H - 22) + '" style="fill:var(--ink);font:700 16px var(--f-cond)">' + (flip ? '◀ RIGHT' : '◀ LEFT') + '</text>';
    s += '<text x="' + (W - 14) + '" y="' + (H - 22) + '" text-anchor="end" style="fill:var(--ink);font:700 16px var(--f-cond)">' + (flip ? 'LEFT ▶' : 'RIGHT ▶') + '</text>';

    const bubble = (x, y, n, tx, ty) => '<line x1="' + x + '" y1="' + y + '" x2="' + tx + '" y2="' + ty + '" style="stroke:var(--ink);stroke-width:1.8"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="16" style="fill:var(--hivis);stroke:#121311;stroke-width:2.5"/><text x="' + x + '" y="' + (y + 7) + '" text-anchor="middle" style="fill:#121311;font:700 20px var(--f-cond)">' + n + '</text>';
    const used = {};
    items.forEach((it, i) => {
      const f = it.f, n = i + 1;
      if (f.kind === 'cross') {
        const x0 = cx - W * 0.33, x1 = cx + W * 0.33, y = baseY - 12;
        s += '<rect x="' + x0 + '" y="' + (y - 12) + '" width="' + (x1 - x0) + '" height="24" style="fill:var(--surface);stroke:var(--ink);stroke-width:2.5" stroke-dasharray="7 4"/>';
        s += '<rect x="' + (x0 - 6) + '" y="' + (y - 18) + '" width="10" height="36" style="fill:var(--ink)"/><rect x="' + (x1 - 4) + '" y="' + (y - 18) + '" width="10" height="36" style="fill:var(--ink)"/>';
        const dia = (f.name.match(/Ø[\d.]+ m|\d×\([\d.×]+ m\)/) || [''])[0];
        s += '<text x="' + cx + '" y="' + (y + 5) + '" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">' + DI.esc(dia) + '</text>';
        s += '<line x1="' + cx + '" y1="' + (baseY + 50) + '" x2="' + cx + '" y2="' + (H - 6) + '" style="stroke:var(--ink);stroke-width:1.5" stroke-dasharray="3 3"/>';
        s += bubble(cx, baseY + 42, n, cx, y + 12);
        return;
      }
      const sgn = f.side === 'R' ? 1 : f.side === 'L' ? -1 : 0;
      const lat = pos[f.lane] != null ? pos[f.lane] : pos.toe;
      const x = scaleX(sgn * lat);
      const key = f.side + f.lane;
      const k = used[key] = (used[key] || 0) + 1;
      const y = f.lane === 'plat' ? topY + 6 : f.lane === 'face' ? (topY + baseY) / 2 + 8 : f.lane === 'cl' ? topY - 4 : baseY - 4;
      if (f.kind === 'point') s += '<rect x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" style="fill:var(--ink)"/>';
      else if (f.kind === 'label') s += '<circle cx="' + x + '" cy="' + y + '" r="8" style="fill:var(--surface);stroke:var(--ink);stroke-width:2" stroke-dasharray="3 2"/>';
      else s += '<rect x="' + (x - 7) + '" y="' + (y - 20) + '" width="14" height="' + (f.lane === 'plat' ? 14 : 22) + '" style="fill:var(--ink)"/>';
      const outward = (x < cx ? -1 : 1);
      const bx = Math.max(20, Math.min(W - 20, x + outward * (18 + (k - 1) * 30)));
      const by = y - 60 - (k - 1) * 14;
      s += bubble(bx, by, n, x, y - 10);
    });
    return s + '</svg>';
  }

  // ------------------------------------------------------------------
  // The real design section at your chainage (from the cross-section CAD),
  // with the same numbered bubbles as the list. Vertical is exaggerated so a
  // 5 m bank and a 0.5 m ditch both read on a phone; the header says by how much.
  const GROUP_OF = { toe: 'toe', side: 'side', shoulder: 'side', crest: 'crest' };
  function realCut(sec, items, facing, W, fitH) {
    const H = Math.max(190, Math.min(320, fitH || 300));
    const flip = facing === 'decreasing';
    const p = sec.p || {};
    const solid = ['slope', 'platform', 'toe_ditch', 'lining', 'side_ditch', 'crest_ditch'];
    let xr = 12, ylo = 0, yhi = 0.5;
    solid.forEach(r => (p[r] || []).forEach(l => l.forEach(([x, y]) => { xr = Math.max(xr, Math.abs(x)); ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); })));
    xr = Math.min(35, xr + 4);
    (p.ground || []).forEach(l => l.forEach(([x, y]) => { if (Math.abs(x) <= xr) ylo = Math.min(ylo, y); }));
    ylo -= 0.6; yhi += 1.2;
    const sx = (W / 2 - 14) / xr;
    const sy = Math.min(sx * 4, (H - 96) / (yhi - ylo));
    const top = 34;
    const X = x => W / 2 + (flip ? -x : x) * sx;
    const Y = y => top + (yhi - y) * sy;
    const path = l => l.map(([x, y], i) => (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
    const surface = x => {
      let best = null;
      ['slope', 'platform', 'ground', 'toe_ditch'].forEach(r => (p[r] || []).forEach(l => {
        for (let i = 0; i < l.length - 1; i++) {
          const [x0, y0] = l[i], [x1, y1] = l[i + 1];
          if ((x - x0) * (x - x1) <= 0 && x0 !== x1) { const y = y0 + (y1 - y0) * (x - x0) / (x1 - x0); if (best == null || y > best) best = y; }
        }
      }));
      return best == null ? 0 : best;
    };
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs();
    s += '<rect width="' + W + '" height="' + H + '" style="fill:var(--paper)"/>';
    s += '<line x1="' + (W / 2) + '" y1="' + (top - 16) + '" x2="' + (W / 2) + '" y2="' + (H - 40) + '" style="stroke:var(--ink-3);stroke-width:1" stroke-dasharray="4 4"/>';
    (p.ground || []).forEach(l => { s += '<path d="' + path(l) + '" style="fill:none;stroke:var(--ink-3);stroke-width:1.5"/>'; });
    (p.platform || []).forEach(l => { s += '<path d="' + path(l) + '" style="fill:none;stroke:var(--ink-2);stroke-width:1.2"/>'; });
    (p.slope || []).forEach(l => { s += '<path d="' + path(l) + '" style="fill:none;stroke:var(--ink);stroke-width:2.5;stroke-linejoin:round"/>'; });
    ['toe_ditch', 'side_ditch', 'crest_ditch'].forEach(r => (p[r] || []).forEach(l => { s += '<path d="' + path(l) + '" style="fill:none;stroke:var(--ink);stroke-width:2.5;stroke-linejoin:round"/>'; }));
    (p.lining || []).forEach(l => { s += '<path d="' + path(l) + '" style="fill:none;stroke:var(--ink);stroke-width:4;stroke-linejoin:round"/>'; });
    if (sec.h != null) s += '<text x="' + (W - 10) + '" y="' + (top - 16) + '" text-anchor="end" style="fill:var(--ink);font:500 13px var(--f-mono)">H to LRL ' + sec.h.toFixed(2) + ' m</text>';
    const lbl = (arr, side) => { if (!arr || !arr.length) return ''; const x = X((side === 'L' ? -1 : 1) * Math.max(...arr)); return '<text x="' + Math.max(28, Math.min(W - 28, x)) + '" y="' + (H - 44) + '" text-anchor="middle" style="fill:var(--ink-2);font:500 12.5px var(--f-mono)">L=' + Math.max(...arr).toFixed(2) + '</text>'; };
    s += lbl(sec.Ll, 'L') + lbl(sec.Lr, 'R');
    s += '<text x="14" y="' + (H - 18) + '" style="fill:var(--ink);font:700 16px var(--f-cond)">' + (flip ? '◀ RIGHT' : '◀ LEFT') + '</text>';
    s += '<text x="' + (W - 14) + '" y="' + (H - 18) + '" text-anchor="end" style="fill:var(--ink);font:700 16px var(--f-cond)">' + (flip ? 'LEFT ▶' : 'RIGHT ▶') + '</text>';

    const bubble = (x, y, n, tx, ty) => '<line x1="' + x + '" y1="' + y + '" x2="' + tx + '" y2="' + ty + '" style="stroke:var(--ink);stroke-width:1.8"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="15" style="fill:var(--hivis);stroke:#121311;stroke-width:2.5"/><text x="' + x + '" y="' + (y + 7) + '" text-anchor="middle" style="fill:#121311;font:700 19px var(--f-cond)">' + n + '</text>';
    const used = {};
    items.forEach((it, i) => {
      const f = it.f, n = i + 1;
      if (f.kind === 'cross') {
        const yb = Y(ylo + 0.9);
        s += '<rect x="' + X(-xr + 5) + '" y="' + (yb - 8) + '" width="' + (X(xr - 5) - X(-xr + 5)) + '" height="16" style="fill:none;stroke:var(--ink);stroke-width:2" stroke-dasharray="7 4"/>';
        s += bubble(W / 2, H - 70, n, W / 2, yb + 8);
        return;
      }
      const sign = f.side === 'L' ? -1 : f.side === 'R' ? 1 : 0;
      const g = GROUP_OF[f.catKey];
      const d = g && (sec.d || []).find(q => q[0] === f.side && q[1] === (g === 'toe' ? 'toe' : g));
      const off = d ? d[2] : (f.offsetM != null ? f.offsetM : ({ plat: 3.5, face: 7, toe: 11, crest: 20, off: 30, cl: 0 }[f.lane] || 8));
      const xm = sign * Math.min(off, xr - 1);
      const tx = X(xm), ty = Y(surface(xm));
      const k = used[f.side] = (used[f.side] || 0) + 1;
      const out = (tx < W / 2 ? -1 : 1);
      const bx = Math.max(18, Math.min(W - 18, tx + out * (10 + (k - 1) * 22)));
      const by = Math.max(18, ty - 46 - (k - 1) * 26);
      s += bubble(bx, by, n, tx, ty - 3);
    });
    return s + '</svg>';
  }

  window.DStrip = { Strip, sectionCut, realCut, geom, SPINE };
})();
