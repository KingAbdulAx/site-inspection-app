/*
 * Drainage Inspector — shell.
 * Position header, the Walk screen (Strip / Map / Section), the at-you bar,
 * the drawer, the record sheet, toasts, and setting position by hand.
 * Other screens live in screens.js and hang off window.DA.
 */
(function () {
  'use strict';
  const DI = window.DI, I = window.DIcons;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = DI.esc;

  const S = {
    tab: 'walk',
    mode: 'strip',
    pos: { line: 'KM', sub: 'KZDR', ch: 111020, side: '—', offset: 0, facing: 'increasing', tier: 'none', acc: null, source: 'hand', lat: null, lon: null },
    fixes: [],
    handAt: 0,
    lastSignal: null
  };
  const DA = window.DA = { S, $, esc, overlays: [], sectionsAsked: {} };

  // ----------------------------------------------------------- helpers
  function sideBadge(side, size) {
    const cls = 'badge' + (side === 'C' ? ' c' : '') + (size ? ' ' + size : '');
    if (side === 'L') return '<span class="' + cls + '"><span class="arr">' + I.TRI_L + 'L</span></span>';
    if (side === 'R') return '<span class="' + cls + '"><span class="arr">R' + I.TRI_R + '</span></span>';
    return '<span class="' + cls + '">C</span>';
  }
  function certChip(f) {
    if (f.cert === 'exact') return '<span class="chip exact">Exact</span>';
    if (f.cert === 'label') return '<span class="chip label">Label</span>';
    if (f.cert === 'measured') return '<span class="chip measured">Measured</span>';
    return '<span class="chip derived">±4 m</span>';
  }
  function chText(f, arrow) {
    if (f.cert === 'exact') return DI.fmtCh(f.ch0, 3);
    if (f.cert === 'label') return 'near ' + DI.fmtCh(f.ch0);
    if (f.cert === 'measured') return DI.fmtCh(f.ch0, 1) + (f.ch1 - f.ch0 > 1 && arrow !== false ? ' → ' + DI.fmtCh(f.ch1, 1) : '');
    if (f.ch1 - f.ch0 > 1) return '≈' + DI.fmtCh(f.ch0) + (arrow === false ? '' : ' → ' + DI.fmtCh(f.ch1));
    return '≈' + DI.fmtCh(f.ch0);
  }
  function chHtml(f, arrow) {
    const t = chText(f, arrow);
    return '<span class="nw">' + esc(t).replace(' → ', '</span> <span class="nw">→ ') + '</span>';
  }
  function meter(f, st, cls) {
    const n = f.ladder.length - 1;
    const s = st.s == null ? -1 : st.s, c = st.c == null ? -1 : st.c;
    let h = '<span class="meter ' + (cls || '') + '">';
    for (let i = 0; i < n; i++) {
      let k = '';
      if (s < 0 && c < 0) k = 'n';
      else if (i < s) k = 's';
      else if (i < c) k = 'h';
      else if (st.stalled && i === Math.max(s, c)) k = 'z';
      h += '<i class="' + k + '"></i>';
    }
    return h + '</span>';
  }
  function stageLabel(f, st) {
    if (st.s == null && st.c == null) return '<span class="st never">Not yet seen</span>';
    if (st.s == null) return '<span class="st">' + esc(f.ladder[st.c]) + ' <small class="muted">claimed</small></span>';
    return '<span class="st">' + esc(f.ladder[st.s]) + '</span>';
  }
  function offText(f) {
    if (f.kind === 'cross') return 'Under track';
    if (f.lane === 'cl') return 'Under the track, buried';
    if (f.offsetM != null) return (f.side === 'R' ? '+' : '−') + f.offsetM + ' m';
    const m = DI.LANE_OFFSET[f.lane];
    return '≈' + (f.side === 'R' ? '+' : '−') + m + ' m';
  }
  // Distance words relative to where you stand and the way you face.
  function relText(f, ch, facing) {
    const dir = facing === 'decreasing' ? -1 : 1;
    const words = d => Math.round(Math.abs(d)) + ' m ' + (d * dir > 0 ? 'ahead' : 'behind');
    if (f.ch1 - f.ch0 > 1 && f.kind !== 'cross') {
      if (ch >= f.ch0 && ch <= f.ch1) return 'runs past you';
      const near = Math.abs(f.ch0 - ch) < Math.abs(f.ch1 - ch) ? f.ch0 : f.ch1;
      const startEnd = (near === f.ch0) === (dir > 0) ? 'starts' : 'ends';
      return startEnd + ' ' + (Math.abs(near - ch) < 1.5 ? 'here' : words(near - ch));
    }
    const d = f.ch0 - ch;
    if (Math.abs(d) < 1.5) return 'here';
    return words(d);
  }
  Object.assign(DA, { sideBadge, certChip, chText, chHtml, meter, stageLabel, offText, relText });

  // ----------------------------------------------------------- theme
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('KMD_THEME_V1', t); } catch (e) { /* ignore */ }
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', t === 'office' ? '#151614' : '#F6F5F0');
  }
  DA.setTheme = setTheme;

  // -------------------------------------------------------- position
  function lineFeatures() { return DI.data.features.filter(f => f.line === S.pos.line); }
  DA.lineFeatures = lineFeatures;

  function setHand(line, ch) {
    const sub = DI.subAt(line, ch);
    Object.assign(S.pos, { line, ch, sub: sub ? sub.id : null, source: 'hand', tier: 'none', side: '—', offset: 0, acc: null });
    S.handAt = Date.now();
    if (DA.strip) DA.strip.viewCh = null;
    DI.savePosition(S.pos);
    render();
  }
  function setAnchor(f) {
    Object.assign(S.pos, { ch: f.ch0, source: 'anchor', tier: 'good', acc: 0, offset: 0, side: f.side });
    DI.savePosition(S.pos);
    DA.toast({ title: 'Position fixed on ' + f.name, sub: DI.fmtCh(f.ch0, 3) + ' · exact' });
    render();
  }
  DA.setHand = setHand;
  DA.setAnchor = setAnchor;

  function onFix(lat, lon, acc, heading, speed) {
    S.lastSignal = Date.now();
    const cands = DI.LINES.flatMap(l => l.subs).filter(sb => DI.data.centre[sb.id]).map(sb => {
      const p = DI.project(sb.id, lat, lon);
      return p && Object.assign(p, { sub: sb.id, line: sb.line });
    }).filter(Boolean);
    if (!cands.length) return;
    // Line stickiness: stay with the current sub-section unless another is clearly closer.
    cands.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
    let best = cands[0];
    const curr = cands.find(c => c.sub === S.pos.sub);
    if (curr && Math.abs(curr.offset) < Math.abs(best.offset) + 25) best = curr;
    S.fixes.push({ lat, lon, acc, ch: best.ch, offset: best.offset, t: Date.now() });
    if (S.fixes.length > 30) S.fixes.shift();
    if (Math.abs(best.offset) > 1500) {
      if (S.pos.source !== 'hand') { S.pos.tier = 'none'; S.pos.source = 'hand'; S.pos.side = '—'; }
      S.pos.farFromLine = Math.round(Math.abs(best.offset));
      render();
      return;
    }
    S.pos.farFromLine = 0;
    const good = acc <= 10;
    // By hand or anchored holds until a good fix, and never for a minute after typing.
    if ((S.pos.source === 'hand' && S.handAt && (Date.now() - S.handAt < 60000 || !good)) || (S.pos.source === 'anchor' && !good)) {
      render();
      return;
    }
    const prev = S.pos.ch;
    // Facing: heading against the track bearing when moving; otherwise chainage trend.
    let facing = S.pos.facing;
    if (heading != null && !isNaN(heading) && speed > 0.7) {
      const d = ((heading - best.bearing) % 360 + 540) % 360 - 180;
      facing = Math.abs(d) < 90 ? 'increasing' : 'decreasing';
    } else if (S.pos.source === 'gps' && Math.abs(best.ch - prev) > 3 && best.line === S.pos.line) {
      facing = best.ch > prev ? 'increasing' : 'decreasing';
    }
    const off = best.offset;
    Object.assign(S.pos, {
      line: best.line, sub: best.sub, ch: best.ch, offset: off, acc, lat, lon, facing,
      source: 'gps', tier: good ? 'good' : 'poor',
      side: !good ? '?' : Math.abs(off) < 1.75 ? 'C' : off > 0 ? 'L' : 'R'
    });
    DI.savePosition(S.pos);
    render();
  }

  function startGps() {
    const q = new URLSearchParams(location.search);
    if (q.get('sim')) return simulate(q.get('sim'));
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.watchPosition(
      p => onFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.heading, p.coords.speed),
      () => { if (S.pos.source === 'gps') { S.pos.tier = 'none'; render(); } },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 }
    );
  }
  // ?sim=KZDR:111020:14:4  (sub-section : chainage : offset, left + : accuracy)
  function simulate(spec) {
    const [sub, ch, off, acc] = spec.split(':');
    if (acc === 'none') { setHand(DI.SUBS[sub].line, Number(ch)); return; }
    const p = DI.pointAt(sub, Number(ch), Number(off || 0));
    if (!p) return;
    S.handAt = 0;
    onFix(p.lat, p.lon, Number(acc || 4), null, 0);
  }
  DA.onFix = onFix;

  // ------------------------------------------------------ header
  function posHeader() {
    const p = S.pos, L = DI.LINES.find(l => l.id === p.line);
    let gps;
    if (p.source === 'anchor') gps = '<button class="gps anchor" data-act="keypad">' + I.icon('pin', '') .replace('<svg', '<svg width="18" height="18"') + ' ON EXACT POINT</button>';
    else if (p.tier === 'good') gps = '<button class="gps" data-act="keypad">' + I.bars(p.acc <= 5 ? 4 : 3) + ' GPS ±' + Math.round(p.acc) + ' m</button>';
    else if (p.tier === 'poor') gps = '<button class="gps poor" data-act="keypad">' + I.bars(1) + ' GPS ±' + Math.round(p.acc) + ' m</button>';
    else gps = '<button class="gps none" data-act="keypad">' + I.icon('hand').replace('<svg', '<svg width="20" height="20"') + ' NO GPS</button>';
    const ch = DI.fmtCh(p.ch);
    let chHtml = p.tier === 'poor' ? '<span class="approx">≈</span>' + ch : ch;
    let youLbl = 'You are', side;
    if (p.source === 'hand') { youLbl = 'Set by hand'; side = 'SIDE —'; }
    else if (p.tier === 'poor') side = 'SIDE ?';
    else if (p.side === 'C') side = 'On CL';
    else side = p.side + ' ' + Math.round(Math.abs(p.offset)) + ' m';
    if (p.farFromLine) { youLbl = 'GPS ' + (p.farFromLine / 1000).toFixed(1) + ' km off line'; }
    const tri = p.facing === 'decreasing' ? '▼' : '▲';
    return '<div class="pos-line"><span>' + esc(L.short) + '</span>' + (p.sub ? '<span class="chip-sub">' + p.sub + '</span>' : '<span class="chip-sub">NO DATA</span>') + '</div>' + gps +
      '<button class="pos-ch tap' + (p.source === 'hand' ? ' hand' : '') + '" data-act="keypad" aria-label="Chainage">' + chHtml + '</button>' +
      '<button class="pos-you tap" data-act="facing"><div class="lbl">' + esc(youLbl) + '</div><div class="side">' + side + '</div>' +
      '<div class="facing">FACING <span class="tri">' + tri + '</span> <b>' + p.facing + '</b></div></button>';
  }
  DA.posHeader = posHeader;

  function laneHeader() {
    const W = $('#vp').clientWidth || 390;
    const g = window.DStrip.geom(W, S.pos.facing);
    const names = { off: 'OFF', crest: 'CREST', toe: 'TOE', face: 'FACE', plat: 'PLAT', cl: 'CL' };
    let n = '';
    g.cols.forEach(c => { n += '<span style="width:' + (c.x1 - c.x0) + 'px" class="' + (c.lane === 'cl' ? 'cl' : '') + '">' + (c.lane === 'cl' ? '<div style="font-size:15px;line-height:1">' + (S.pos.facing === 'decreasing' ? '▼' : '▲') + '</div>' : '') + names[c.lane] + '</span>'; });
    const flip = g.flip;
    return '<div class="sides"><span>◀ ' + (flip ? 'RIGHT' : 'LEFT') + '</span><span>' + (flip ? 'LEFT' : 'RIGHT') + ' ▶</span></div><div class="names">' + n + '</div>';
  }

  // ------------------------------------------------------- at you
  function nearItems(ch, radius) {
    const r = radius || 20;
    return lineFeatures().filter(f => f.ch1 >= ch - r && f.ch0 <= ch + r);
  }
  DA.nearItems = nearItems;
  function orderAsFaced(list) {
    const flip = S.pos.facing === 'decreasing';
    const rank = f => {
      if (f.kind === 'cross' || f.side === 'C') return 0;
      const i = ['plat', 'face', 'toe', 'crest', 'off'].indexOf(f.lane);
      return (f.side === 'L' ? -1 : 1) * (i + 1);
    };
    return list.slice().sort((a, b) => (flip ? -1 : 1) * (rank(a) - rank(b)) || a.ch0 - b.ch0);
  }
  DA.orderAsFaced = orderAsFaced;

  function atYouPick(ch) {
    const near = nearItems(ch, 20);
    const dist = f => f.ch0 <= ch && ch <= f.ch1 ? 0 : Math.min(Math.abs(f.ch0 - ch), Math.abs(f.ch1 - ch));
    const pts = near.filter(f => f.kind === 'cross' || f.kind === 'point').sort((a, b) => dist(a) - dist(b));
    if (pts.length && dist(pts[0]) <= 10) return { f: pts[0], near };
    const lin = near.filter(f => (f.kind === 'linear' || f.kind === 'buried') && dist(f) === 0)
      .sort((a, b) => Math.abs(a.offset - S.pos.offset) - Math.abs(b.offset - S.pos.offset));
    if (lin.length) return { f: lin[0], near };
    if (pts.length) return { f: pts[0], near };
    const any = near.slice().sort((a, b) => dist(a) - dist(b));
    return { f: any[0] || null, near };
  }
  DA.atYouPick = atYouPick;

  function nextAhead(ch) {
    const dir = S.pos.facing === 'decreasing' ? -1 : 1;
    const ahead = lineFeatures().filter(f => dir > 0 ? f.ch0 > ch + 20 : f.ch1 < ch - 20)
      .sort((a, b) => dir > 0 ? a.ch0 - b.ch0 : b.ch1 - a.ch1);
    const x = ahead.find(f => f.kind === 'cross') || ahead[0];
    return x ? { f: x, d: Math.abs((dir > 0 ? x.ch0 : x.ch1) - ch) } : null;
  }

  function atYouBar() {
    const el = $('#atyou');
    const p = S.pos;
    el.className = 'atyou';
    if (!p.sub || !DI.hasData(p.sub)) {
      const sub = DI.subAt(p.line, p.ch);
      el.classList.add('absent');
      el.innerHTML = '<div class="main"><span class="badge c" style="border-style:dashed">—</span><div class="txt"><div class="kick">No design data here</div><div class="name"><span>' + (sub ? esc(sub.id) + ' drawings not processed' : 'Outside the sub-sections') + '</span></div><div class="where muted">Shown present and empty</div></div></div>' +
        '<button class="more" data-act="project"><span class="w">Switch<br>sub-section</span></button>';
      return;
    }
    if (p.tier === 'poor') {
      const within = lineFeatures().filter(f => f.cert === 'exact' && Math.abs(f.ch0 - p.ch) <= p.acc).sort((a, b) => Math.abs(a.ch0 - p.ch) - Math.abs(b.ch0 - p.ch));
      const near = nearItems(p.ch, p.acc);
      el.classList.add('poor');
      const a = within[0];
      el.innerHTML = '<div class="main"><div class="txt"><div class="poor-t">GPS can’t tell which of ' + near.length + '</div><div class="poor-s">Stand on something exact to fix your position</div></div></div>' +
        (a ? '<button class="more" data-act="anchor" data-id="' + esc(a.id) + '"><span class="kick" style="color:var(--ink)">I’m on the</span><span style="display:flex;gap:6px;align-items:center;font:700 19px/1.2 var(--f-sans);margin:4px 0">' + I.typeIcon(a.icon) + esc(a.kind === 'cross' && /culvert/i.test(a.name) ? 'culvert' : a.name.split(' ')[0].toLowerCase()) + '</span><span class="mono" style="font-size:14px">' + DI.fmtCh(a.ch0, 3) + '</span><span class="chip exact" style="margin-top:3px">Exact</span></button>'
          : '<button class="more" data-act="keypad"><span class="w">Set by<br>hand</span></button>');
      return;
    }
    const pick = atYouPick(p.ch);
    const pending = DI.live(r => r.kind === 'design' && Math.abs((r.ch || 0) - p.ch) < 150 && r.line === p.line);
    if (!pick.f) {
      if (pending.length) {
        const r = pending[pending.length - 1];
        el.classList.add('rev');
        el.innerHTML = '<button class="main" data-act="changes"><span class="chip rev" style="height:30px;font-size:15px">Δ ' + esc(r.source.rev || '') + '</span><div class="txt"><div class="name"><span>' + pending.length + ' change' + (pending.length > 1 ? 's' : '') + ' near you</span></div><div class="where" style="font-size:14px">' + esc(r.source.drawing || r.source.kind) + ' rev ' + esc(r.source.rev || '—') + ' · pending</div><div style="font:500 14px/1.3 var(--f-sans);margin-top:3px">Your field records are untouched</div></div></button>' +
          '<button class="more" data-act="changes"><span style="font:700 16px/1.2 var(--f-sans)">Review</span><span style="font:700 26px/1 var(--f-cond)">' + pending.length + '</span></button>';
        return;
      }
      const nx = nextAhead(p.ch);
      const absent = (S.absences || []).find(a => a.ch0 <= p.ch && a.ch1 >= p.ch);
      el.classList.add('absent');
      el.innerHTML = '<div class="main"><span class="badge c" style="border:0;background:var(--none-design);width:52px;height:52px"></span><div class="txt"><div class="name"><span>' + (absent ? 'No ditch here — by design' : 'Nothing drawn within 20 m') + '</span></div><div style="font:500 15px/1.3 var(--f-sans);color:var(--ink-2)">' + (absent ? esc(absent.why) : 'Walk on, or set position by hand') + '</div>' + (absent ? '<div class="where" style="font-size:14px;margin-top:4px">' + esc(absent.sheet) + '</div>' : '') + '</div></div>' +
        (nx ? '<button class="more" data-act="goto-next" data-ch="' + nx.f.ch0 + '"><span class="kick">Next ' + (p.facing === 'decreasing' ? '▼' : '▲') + '</span><span class="n">' + Math.round(nx.d) + ' m</span><span class="w" style="display:flex;gap:4px;align-items:center">' + I.typeIcon(nx.f.icon).replace('ticon', 'ticon" style="width:18px;height:13px') + esc(nx.f.name.split(' ').slice(0, 2).join(' ')) + '</span></button>' : '<div class="more"></div>');
      return;
    }
    const f = pick.f;
    const others = pick.near.length - 1;
    el.innerHTML = '<button class="main" data-act="record" data-id="' + esc(f.id) + '">' + sideBadge(f.side, 'lg') +
      '<div class="txt"><div class="kick">At you · tap to record</div><div class="name">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></div>' +
      '<div class="where">' + chText(f, false) + ' ' + certChip(f) + '</div></div></button>' +
      '<button class="more" data-act="drawer"><span class="n">+' + Math.max(0, others) + '</span><span class="w">within<br>20 m</span>' + I.icon('chevUp').replace('<svg', '<svg width="20" height="20"') + '</button>';
  }

  // ------------------------------------------------------- walk render
  function renderWalk() {
    $('#posHead').innerHTML = posHeader();
    const mode = S.mode;
    document.querySelectorAll('.seg3 button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('#laneHead').classList.toggle('hidden', mode !== 'strip');
    $('#cutHead').classList.toggle('hidden', mode !== 'section');
    $('#stripHost').classList.toggle('hidden', mode !== 'strip');
    $('#mapHost').classList.toggle('hidden', mode !== 'map');
    $('#cutHost').classList.toggle('hidden', mode !== 'section');
    if (mode === 'strip') {
      $('#laneHead').innerHTML = laneHeader();
      renderStrip();
    } else if (mode === 'section') {
      renderCut();
    } else if (mode === 'map' && DA.renderMap) {
      DA.renderMap($('#mapHost'));
    }
    atYouBar();
  }
  function renderStrip() {
    if (!DA.strip) {
      DA.strip = new window.DStrip.Strip($('#stripHost'), {
        onTap: f => openDrawer(f.ch0, f.id),
        onPan: () => { $('#recentre').classList.remove('hidden'); }
      });
    }
    const p = S.pos;
    DA.strip.render({
      line: p.line, ch: p.ch, userCh: p.ch, facing: p.facing, tier: p.tier, acc: p.acc || 0,
      source: p.source, offset: p.offset, features: lineFeatures(), absences: S.absences || [],
      unlisted: DI.live(r => r.kind === 'unlisted' && r.line === p.line)
    });
    $('#recentre').classList.toggle('hidden', DA.strip.viewCh == null);
  }
  function renderCut() {
    const p = S.pos;
    const items = orderAsFaced(nearItems(p.ch, 20)).slice(0, 5).map(f => ({ f }));
    const at = atYouPick(p.ch).f;
    const pick = items.find(x => x.f.kind === 'cross');
    const cutCh = pick ? pick.f.ch0 : p.ch;
    const W = $('#vp').clientWidth || 390;
    const fitH = ($('#vp').clientHeight || 500) - (Math.ceil((items.length + 1) / 3) * 80 + 28) - 64;
    // The real design section, when this sub-section's cross sections are on the phone.
    if (p.sub && !DI.data.sections[p.sub] && !DA.sectionsAsked[p.sub]) {
      DA.sectionsAsked[p.sub] = true;
      fetch('data/sections_' + p.sub + '.json').then(r => r.ok ? r.json() : null).then(j => { if (j) { DI.loadSections(p.sub, j); render(); } }).catch(() => { /* none for this sub-section */ });
    }
    const sec = p.sub ? DI.sectionAt(p.sub, cutCh) : null;
    $('#cutHead').innerHTML = '<span>SECTION AT ' + (sec ? DI.fmtCh(sec.ch) : pick ? DI.fmtCh(cutCh, 3) : DI.fmtCh(cutCh)) + '</span><span class="muted">LOOKING ' + (p.facing === 'decreasing' ? '▼' : '▲') + (sec ? ' · DESIGN · VERT. EXAGG.' : ' · NOT TO SCALE') + '</span>';
    let h = '<div style="background:var(--paper)">' + (sec ? window.DStrip.realCut(sec, items, p.facing, W, fitH) : window.DStrip.sectionCut(items, p.facing, W, fitH)) + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 12px;border-top:2px solid var(--ink);background:var(--paper)">';
    items.forEach((it, i) => {
      const f = it.f;
      const title = f.code && /^T\d/.test(f.code) ? 'Type ' + f.code.slice(1) : f.catKey === 'descent' ? 'Descent' : f.catKey === 'riprap' ? 'Riprap' : f.catKey === 'diversion' ? 'Channel' : f.kind === 'cross' ? f.name.replace(/Single |Twin |Triple /, '').split(' ').slice(0, 2).join(' ') : f.name.split(',')[0].split(' ').slice(0, 2).join(' ');
      const rel = relText(f, p.ch, p.facing);
      const tri = /ahead/.test(rel) ? '▲' : /behind/.test(rel) ? '▼' : '';
      const on = at && at.id === f.id;
      const short = rel === 'runs past you' ? 'on it' : rel.replace(' ahead', '').replace(' behind', '').replace('starts ', 'starts · ').replace('ends ', 'ends · ');
      h += '<button data-act="record" data-id="' + esc(f.id) + '" style="min-height:72px;border:2.5px solid var(--ink);background:' + (on ? 'var(--hivis);color:#121311' : 'var(--surface)') + ';display:flex;gap:8px;align-items:center;padding:6px 8px;text-align:left">' +
        '<span style="flex:none;width:34px;height:34px;border-radius:50%;background:' + (on ? 'var(--surface)' : 'var(--hivis)') + ';border:2.5px solid #121311;color:#121311;display:flex;align-items:center;justify-content:center;font:700 19px/1 var(--f-cond)">' + (i + 1) + '</span>' +
        '<span style="min-width:0"><b style="display:block;font:700 17px/1.1 var(--f-sans);overflow-wrap:break-word">' + esc(title) + '</b><span style="font:500 14.5px/1.2 var(--f-sans)">' + esc(short) + ' ' + tri + '</span></span></button>';
    });
    h += '<button data-act="drawer" style="min-height:72px;border:2.5px dashed var(--ink);display:flex;align-items:center;justify-content:center;gap:8px;font:700 19px/1 var(--f-sans)">As a list ' + I.icon('chevUp').replace('<svg', '<svg width="20" height="20"') + '</button></div><div style="height:72px"></div>';
    if (!items.length) h = '<div class="empty-state"><b>Nothing within 20 m</b>The section is drawn when a structure is at you.</div>';
    $('#cutHost').innerHTML = h;
  }

  // ------------------------------------------------------- overlays
  function openOverlay(html, cls, opts) {
    const o = opts || {};
    const host = $('#overlay');
    const wrap = document.createElement('div');
    wrap.className = 'ov';
    if (cls.indexOf('sheet') === 0) {
      wrap.innerHTML = '<div class="scrim" data-act="close"></div><div class="' + cls + '"><div class="grab" data-act="close"></div><div class="body">' + html + '</div></div>';
    } else {
      wrap.innerHTML = '<div class="' + cls + '">' + html + '</div>';
    }
    host.appendChild(wrap);
    DA.overlays.push({ el: wrap, onClose: o.onClose, key: o.key });
    return wrap;
  }
  function closeOverlay() {
    const o = DA.overlays.pop();
    if (!o) return;
    o.el.remove();
    if (o.onClose) o.onClose();
  }
  function closeAll() { while (DA.overlays.length) closeOverlay(); }
  Object.assign(DA, { openOverlay, closeOverlay, closeAll });

  // ------------------------------------------------------- drawer
  function openDrawer(ch, hlId) {
    const around = ch == null ? S.pos.ch : ch;
    const list = orderAsFaced(nearItems(around, 20));
    const mine = Math.abs(around - S.pos.ch) < 1;
    let h = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 14px;border-bottom:3px solid var(--ink);margin:0 -16px;padding-left:16px;padding-right:16px">' +
      '<div><div style="font:700 24px/1.15 var(--f-sans)">Within 20 m of ' + (mine ? 'you' : DI.fmtCh(around)) + ' · ' + list.length + '</div><div style="font:500 16px/1.3 var(--f-sans);color:var(--ink-3)">Left to right, as you face ' + (S.pos.facing === 'decreasing' ? '▼' : '▲') + '</div></div>' +
      '<button data-act="close" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center">' + I.icon('chevDown').replace('<svg', '<svg width="30" height="30"') + '</button></div>';
    h += '<div style="margin:0 -16px">';
    if (!list.length) h += '<div class="empty-state"><b>Nothing drawn here</b>No structure on the drawings within 20 m.</div>';
    list.forEach(f => {
      const st = DI.statusOf(f);
      h += '<button class="frow' + (f.id === hlId ? ' hl' : '') + '" data-act="record" data-id="' + esc(f.id) + '" id="row-' + esc(f.id) + '">' + sideBadge(f.side) +
        '<div class="mid"><div class="t1">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span>' + (st.defects.length ? '<span style="color:var(--defect)">' + I.icon('warn').replace('<svg', '<svg width="18" height="18"') + '</span>' : '') + '</div>' +
        '<div class="t2">' + chHtml(f) + ' ' + certChip(f) + '</div><div class="t3">' + offText(f) + ' · ' + relText(f, S.pos.ch, S.pos.facing) + '</div></div>' +
        '<div class="right">' + meter(f, st) + stageLabel(f, st) + '</div></button>';
    });
    h += '</div><div class="grid2 mt16"><button class="btn" data-act="unlisted" style="font-size:16px;min-height:56px">' + '<span style="background:var(--hivis);color:#121311;border:2px solid #121311;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font:700 18px/1 var(--f-cond)">?</span> Not on the drawings</button>' +
      '<button class="btn" data-act="add-design" style="font-size:16px;min-height:56px;border-color:var(--rev);color:var(--rev)">' + I.icon('plus') + ' Add to design</button></div>' +
      '<button class="btn mt8" data-act="base-add" data-ch="' + around + '" style="font-size:16px;min-height:56px;border-style:dashed">' + I.icon('edit') + ' Missing from the data — the extraction skipped it</button>';
    const ov = openOverlay(h, 'sheet tall');
    const row = hlId && ov.querySelector('#row-' + CSS.escape(hlId));
    if (row) row.scrollIntoView({ block: 'center' });
  }
  DA.openDrawer = openDrawer;

  // ------------------------------------------------------- record sheet
  function openRecord(fid) {
    const f = DI.data.byId[fid];
    if (!f) return;
    const st = DI.statusOf(f);
    const max = f.ladder.length - 1;
    const rel = relText(f, S.pos.ch, S.pos.facing);
    let h = '<div class="fhead">' + sideBadge(f.side, 'xl') + '<div style="min-width:0"><button class="t1" data-act="feature" data-id="' + esc(f.id) + '" style="text-align:left">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></button>' +
      '<div class="t2">' + chText(f) + ' ' + certChip(f) + ' <span class="rel">' + esc(rel) + '</span></div></div></div>';
    h += '<div class="pair mt16"><div class="built"><div class="part"><span class="chip seen">Seen by you</span>' + meter(f, { s: st.s == null ? 0 : st.s, c: -1 }, '') +
      '<div class="stage"><b>' + (st.seen ? esc(f.ladder[st.s]) + ' · ' + DI.fmtDate(st.seen.at) : 'Not yet') + '</b></div></div></div>';
    h += '<div class="built"><div class="part"><span class="chip claim">Contractor</span>' + (st.claim ? meter(f, { s: -1, c: st.c }, '') : meter(f, { s: -1, c: -1 }, '')) +
      '<div class="stage"><b>' + (st.claim ? esc(f.ladder[st.c]) + ' <span class="mono" style="font-size:14px;color:var(--ink-3);font-weight:500">IR ' + esc(st.claim.ir) + ' · ' + DI.fmtDate(st.claim.date) + '</span>' : '<span class="muted" style="font-weight:600">No IR</span>') + '</b></div></div></div></div>';
    h += '<div style="font:700 21px/1.2 var(--f-sans);margin:18px 0 10px;color:var(--ink-2)">What stage is it at now?</div>';
    const opts = [];
    const s = st.s, c = st.c;
    if (s != null) {
      if (s < max) {
        const up = s + 1;
        opts.push({ stage: up, sub: 'One up from what you saw' + (c === up ? ' · matches the claim' : '') });
        if (c != null && c > up) opts.push({ stage: c, sub: 'What the contractor claims · IR ' + st.claim.ir });
      }
      opts.push({ stage: s, sub: 'No change since ' + DI.fmtDate(st.seen.at) });
    } else {
      if (c != null && c > 0) opts.push({ stage: c, sub: 'Matches the claim · IR ' + st.claim.ir });
      opts.push({ stage: 0, sub: 'Nothing built yet' });
      if (c == null || c === 0) opts.push({ stage: 1, sub: 'Work has started' });
    }
    opts.forEach((o, i) => {
      h += '<button class="opt' + (i === 0 ? ' primary' : '') + '" data-act="stage" data-id="' + esc(f.id) + '" data-stage="' + o.stage + '"><span><b>' + esc(f.ladder[o.stage]) + '</b><small>' + esc(o.sub) + '</small></span>' + (i === 0 ? I.icon('check') : '') + '</button>';
    });
    h += '<button class="opt" data-act="ladder"><span><b>Other stage</b><small>Show all ' + f.ladder.length + '</small></span>' + I.icon('chevDown') + '</button>';
    h += '<div class="ladder hidden" id="fullLadder">' + f.ladder.map((n, i) => '<button class="opt" data-act="stage" data-id="' + esc(f.id) + '" data-stage="' + i + '"><span><b>' + esc(n) + '</b></span>' + (s === i ? '<small>seen</small>' : c === i ? '<small>claimed</small>' : '') + '</button>').join('') + '</div>';
    h += '<div class="row-btns mt8"><button class="btn defect" data-act="defect" data-id="' + esc(f.id) + '">' + I.icon('warn') + 'Defect</button>' +
      '<button class="btn" data-act="photo" data-id="' + esc(f.id) + '">' + I.icon('camera') + 'Photo</button>' +
      '<button class="btn" data-act="note" data-id="' + esc(f.id) + '">' + I.icon('notes') + 'Note</button></div>';
    h += '<button class="btn mt8" data-act="feature" data-id="' + esc(f.id) + '" style="min-height:48px;border:0;background:transparent;font-size:17px;text-decoration:underline">Everything about this feature ›</button>';
    openOverlay(h, 'sheet tall');
  }
  DA.openRecord = openRecord;

  function snapPos() {
    const p = S.pos;
    return { line: p.line, sub: p.sub, ch: Math.round(p.ch * 10) / 10, side: p.side, offset: Math.round(p.offset * 10) / 10, acc: p.acc, source: p.source, lat: p.lat, lon: p.lon };
  }
  DA.snapPos = snapPos;

  function recordStage(fid, stage) {
    const f = DI.data.byId[fid];
    const claim = DI.claimOf(fid);
    const r = DI.addRecord({ kind: 'stage', featureId: fid, stage, line: f.line, sub: f.sub, ch: f.ch0, pos: snapPos(), claimStage: claim ? claim.stage : null, claimIr: claim ? claim.ir : null });
    closeAll();
    toast({ title: 'Saved on this phone', sub: f.ladder[stage] + ' · ' + DI.fmtTime(r.at) + ' · ' + DI.inspector().replace(/^Engr\.\s*/, ''), undo: () => { DI.voidRecord(r.id); render(); toast({ title: 'Undone', sub: 'The record is kept, marked as withdrawn' }); } });
    render();
  }
  DA.recordStage = recordStage;

  // ------------------------------------------------------- toast
  let toastTimer = null;
  function toast(t) {
    const host = $('#toastHost');
    clearTimeout(toastTimer);
    const ms = t.undo ? 8000 : 3500;
    host.innerHTML = '<div class="toast">' + I.icon(t.icon || 'phone') + '<div class="tt"><b>' + esc(t.title) + '</b><span>' + esc(t.sub || '') + '</span></div>' +
      (t.undo ? '<button class="undo" data-act="undo">Undo</button>' : '') + '<i class="bar" style="animation-duration:' + ms + 'ms"></i></div>';
    DA.pendingUndo = t.undo || null;
    toastTimer = setTimeout(() => { host.innerHTML = ''; DA.pendingUndo = null; }, ms);
  }
  DA.toast = toast;

  // ------------------------------------------------------- keypad
  function openKeypad(opts) {
    const o = opts || {};
    const st = { line: S.pos.line, digits: String(Math.round(S.pos.ch)).replace(/(\d{3})$/, '+$1') };
    const draw = () => {
      const ch = DI.parseCh(st.digits.indexOf('+') < 0 ? st.digits.replace(/(\d{3})$/, '+$1') : st.digits);
      const sub = isNaN(ch) ? null : DI.subAt(st.line, ch);
      const L = DI.LINES.find(l => l.id === st.line);
      let h = '<div class="segm" style="grid-template-columns:1fr 1fr">' + DI.LINES.map(l => '<button data-act="kp-line" data-line="' + l.id + '" class="' + (st.line === l.id ? 'on' : '') + '"><div>' + esc(l.name) + '</div><div style="font:500 15px/1.2 var(--f-sans);opacity:0.85">' + esc(l.kind) + '</div></button>').join('') + '</div>';
      h += '<div class="kp-disp"><div class="v"><small>PK</small>' + esc(st.digits || '') + '<span class="cur"></span></div><div class="in' + (sub && DI.hasData(sub.id) ? '' : ' bad') + '">' +
        (sub ? 'in ' + sub.id + '<br>' + DI.fmtCh(sub.from) + ' – ' + DI.fmtCh(sub.to) + (DI.hasData(sub.id) ? '' : '<br>no drawings yet') : 'No drawings for<br>this chainage yet') + '</div></div>';
      h += '<div class="keypad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', 'del'].map(k => '<button data-act="kp-key" data-k="' + k + '">' + (k === 'del' ? I.icon('backspace') : k) + '</button>').join('') + '</div>';
      h += '<button class="btn primary center mt12" data-act="kp-go"' + (isNaN(ch) ? ' disabled' : '') + '>Go to ' + (isNaN(ch) ? '—' : DI.fmtCh(ch)) + ', ' + esc(L.name) + '</button>';
      if (S.lastSignal && S.pos.source !== 'gps') h += '<button class="btn mt8" data-act="kp-gps">' + I.icon('target') + 'Use GPS again</button>';
      if (o.title) h = '<div style="font:700 26px/1 var(--f-cond);margin-bottom:12px">' + esc(o.title) + '</div>' + h;
      body.innerHTML = h;
      st.ch = ch;
    };
    const ov = openOverlay('', 'sheet tall');
    const body = ov.querySelector('.body');
    ov.kp = {
      key(k) {
        if (k === 'del') st.digits = st.digits.slice(0, -1);
        else if (k === '+') { if (st.digits.indexOf('+') < 0 && st.digits.length) st.digits += '+'; }
        else {
          const after = st.digits.split('+')[1];
          if (after != null && after.length >= 3) return;
          if (st.digits.replace('+', '').length >= 7) return;
          st.digits += k;
        }
        draw();
      },
      line(l) { st.line = l; draw(); },
      go() {
        if (isNaN(st.ch)) return;
        closeOverlay();
        if (o.onGo) return o.onGo(st.line, st.ch);
        if (S.tab !== 'walk') setTab('walk'); else closeAll();
        setHand(st.line, st.ch);
      }
    };
    draw();
  }
  DA.openKeypad = openKeypad;

  // ------------------------------------------------------- note sheet
  function openNote(fid) {
    const f = DI.data.byId[fid];
    const ov = openOverlay('<div style="font:700 28px/1 var(--f-cond);margin-bottom:12px">Note on ' + esc(f.name) + '</div><textarea class="inp" id="noteText" rows="4" placeholder="What you see"></textarea><button class="btn primary center mt12" data-act="note-save" data-id="' + esc(fid) + '">Save note</button><p class="note">Saved on this phone the moment you tap. Kept as a new record.</p>', 'sheet');
    setTimeout(() => { const t = ov.querySelector('textarea'); if (t) t.focus(); }, 60);
  }

  // ------------------------------------------------------- photos
  function takePhoto(cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(blob => {
          const id = DI.uid();
          const meta = { id, at: new Date().toISOString(), fix: { lat: S.pos.lat, lon: S.pos.lon, acc: S.pos.acc }, snapped: snapPos() };
          DI.putPhoto(id, blob).then(() => cb(meta)).catch(() => cb(meta));
        }, 'image/jpeg', 0.82);
      };
      img.src = url;
    };
    inp.click();
  }
  DA.takePhoto = takePhoto;
  function photoTile(meta, n) {
    const cap = DI.fmtTime(meta.at) + ':' + String(new Date(meta.at).getSeconds()).padStart(2, '0') + '<br>' +
      (meta.fix && meta.fix.acc != null ? 'GPS ±' + Math.round(meta.fix.acc) + ' m →' : 'by hand →') + '<br>' + DI.fmtCh(meta.snapped.ch) + ' ' + (meta.snapped.side || '');
    return '<div class="photo"><div class="img" data-photo="' + esc(meta.id) + '"><span>Photo ' + n + '</span></div><div class="cap">' + cap + '</div></div>';
  }
  function hydratePhotos(root) {
    (root || document).querySelectorAll('[data-photo]').forEach(el => {
      if (el.dataset.loaded) return;
      el.dataset.loaded = '1';
      DI.getPhoto(el.dataset.photo).then(b => { if (b) el.style.backgroundImage = 'url(' + URL.createObjectURL(b) + ')'; });
    });
  }
  Object.assign(DA, { photoTile, hydratePhotos });

  // ------------------------------------------------------- nav + render
  function setTab(t) {
    S.tab = t;
    closeAll();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + t));
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    render();
  }
  DA.setTab = setTab;

  function navLabel() {
    const n = DI.live(r => r.kind !== 'void' && r.kind !== 'base' && sameDay(r.at)).length;
    $('#navDay').textContent = 'Day · ' + n + ' on phone';
  }
  function sameDay(iso) { const d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString(); }
  DA.sameDay = sameDay;

  let rq = null;
  function render() {
    if (rq) return;
    rq = requestAnimationFrame(() => {
      rq = null;
      navLabel();
      if (S.tab === 'walk') renderWalk();
      else if (S.tab === 'section' && DA.renderSection) DA.renderSection($('#scr-section'));
      else if (S.tab === 'day' && DA.renderDay) DA.renderDay($('#scr-day'));
      DA.overlays.forEach(o => o.el.refresh && o.el.refresh());
    });
  }
  DA.render = render;

  // ------------------------------------------------------- events
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    const ov = b.closest('.ov');
    switch (act) {
      case 'close': closeOverlay(); break;
      case 'tab': setTab(b.dataset.tab); break;
      case 'mode': S.mode = b.dataset.mode; render(); break;
      case 'record': closeAll(); openRecord(id); break;
      case 'drawer': openDrawer(); break;
      case 'ladder': { const l = ov.querySelector('#fullLadder'); l.classList.toggle('hidden'); b.classList.add('hidden'); break; }
      case 'stage': recordStage(id, Number(b.dataset.stage)); break;
      case 'undo': if (DA.pendingUndo) { const u = DA.pendingUndo; DA.pendingUndo = null; $('#toastHost').innerHTML = ''; u(); } break;
      case 'keypad': openKeypad(); break;
      case 'kp-key': ov.kp.key(b.dataset.k); break;
      case 'kp-line': ov.kp.line(b.dataset.line); break;
      case 'kp-go': ov.kp.go(); break;
      case 'kp-gps': S.handAt = 0; S.pos.source = 'gps'; closeOverlay(); if (S.fixes.length) { const x = S.fixes[S.fixes.length - 1]; onFix(x.lat, x.lon, x.acc); } break;
      case 'facing': S.pos.facing = S.pos.facing === 'increasing' ? 'decreasing' : 'increasing'; DI.savePosition(S.pos); render(); break;
      case 'anchor': setAnchor(DI.data.byId[id]); break;
      case 'recentre': if (DA.strip) DA.strip.recentre(); render(); break;
      case 'goto-next': if (DA.strip) { DA.strip.viewCh = Number(b.dataset.ch); render(); } break;
      case 'note': openNote(id); break;
      case 'note-save': {
        const t = ov.querySelector('textarea').value.trim();
        if (!t) return;
        const f = DI.data.byId[id];
        const r = DI.addRecord({ kind: 'note', featureId: id, note: t, line: f.line, sub: f.sub, ch: f.ch0, pos: snapPos() });
        closeAll();
        toast({ title: 'Note saved on this phone', sub: DI.fmtTime(r.at), undo: () => { DI.voidRecord(r.id); render(); } });
        render();
        break;
      }
      case 'photo': takePhoto(meta => {
        const f = DI.data.byId[id];
        const r = DI.addRecord({ kind: 'photo', featureId: id, photos: [meta], line: f.line, sub: f.sub, ch: f.ch0, pos: snapPos() });
        if (!b.closest('.full')) closeAll();
        toast({ title: 'Photo saved on this phone', sub: f.name + ' · ' + DI.fmtTime(r.at), icon: 'camera', undo: () => { DI.voidRecord(r.id); render(); } });
        render();
      }); break;
      default:
        if (DA.actions && DA.actions[act]) DA.actions[act](b, ov, e);
    }
  }

  // ------------------------------------------------------- boot
  function boot() {
    let theme = 'sun';
    try { theme = localStorage.getItem('KMD_THEME_V1') || 'sun'; } catch (e) { /* ignore */ }
    setTheme(theme);
    DI.init();
    const last = DI.lastPosition();
    const q = new URLSearchParams(location.search);
    if (last && last.line) Object.assign(S.pos, { line: last.line, sub: last.sub, ch: last.ch, facing: last.facing || 'increasing' });
    if (q.get('facing')) S.pos.facing = q.get('facing');
    if (q.get('tab')) S.tab = q.get('tab');
    if (q.get('mode')) S.mode = q.get('mode');
    S.absences = [];
    document.addEventListener('click', onClick);
    window.addEventListener('resize', render);
    let sy = null;
    $('#atyou').addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive: true });
    $('#atyou').addEventListener('touchend', e => { if (sy != null && sy - e.changedTouches[0].clientY > 40) openDrawer(); sy = null; });
    fetch('culvert_ir_progress_table.json').then(r => r.json()).then(rows => { DI.loadIRs(rows); render(); }).catch(() => { /* offline without cache: no claims */ });
    window.onExternalInspectionsUpdated = () => { DI.loadLegacy(); render(); };
    window.showToast = msg => toast({ title: String(msg) });
    setTab(S.tab);
    startGps();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  }
  DA.boot = boot;
})();
