/*
 * Drainage Inspector — screens.
 * Feature, Log defect, Section (ribbon + map), Project, Day, History,
 * the two editing doors, and the Map view of the walk.
 */
(function () {
  'use strict';
  const DI = window.DI, I = window.DIcons, DA = window.DA, S = DA.S;
  const esc = DI.esc;
  const A = DA.actions = {};
  const LEVEL_MEANING = { A: 'Approved', B: 'Approved with comments', C: 'Revise and resubmit' };

  function topbar(title, opts) {
    const o = opts || {};
    return '<div class="topbar"><button class="ib" data-act="' + (o.back || 'close') + '">' + I.icon(o.x ? 'close' : 'back') + '</button><div class="t' + (o.caps ? ' caps' : '') + '">' + esc(title) + '</div><div class="right">' + (o.right || '') + '</div></div>';
  }
  function fsum(f, extra) {
    return '<div class="fhead" style="padding:16px;background:var(--surface);border-bottom:1px solid var(--rule)">' + DA.sideBadge(f.side, 'xl') +
      '<div style="min-width:0"><div class="t1">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + ' ' + DA.certChip(f) + (extra ? ' <span class="rel">' + extra + '</span>' : '') + '</div></div></div>';
  }
  function lineOf(f) { return DI.LINES.find(l => l.id === f.line); }

  // ================================================================ FEATURE
  function sectionDrawing(f) {
    const sz = f.name.match(/\(([\d.]+)×([\d.]+) m\)/);
    const dia = f.name.match(/Ø([\d.]+)/);
    let s = '<svg viewBox="0 0 320 170" width="100%" style="max-width:340px;margin:0 auto">';
    s += '<text x="40" y="24" style="fill:var(--ink-2);font:500 13px var(--f-mono)">' + (f.kind === 'cross' ? 'formation above' : 'ground') + '</text>';
    s += '<line x1="40" y1="34" x2="280" y2="34" style="stroke:var(--ink-2);stroke-width:1.5" stroke-dasharray="6 4"/>';
    if (f.icon === 'box' && sz) {
      s += '<rect x="112" y="44" width="92" height="92" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"/><rect x="124" y="56" width="68" height="68" style="fill:var(--surface);stroke:var(--ink);stroke-width:2"/>';
      s += '<path d="M218 56 V124 M213 56 H223 M213 124 H223" style="stroke:var(--ink);stroke-width:1.8"/><text x="228" y="95" style="fill:var(--ink);font:500 14px var(--f-mono)">' + sz[2] + '</text>';
      s += '<path d="M124 146 H192 M124 141 V151 M192 141 V151" style="stroke:var(--ink);stroke-width:1.8"/><text x="158" y="166" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">' + sz[1] + '</text>';
    } else if (f.icon === 'pipe' && dia) {
      s += '<circle cx="160" cy="92" r="44" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"/><circle cx="160" cy="92" r="34" style="fill:var(--surface);stroke:var(--ink);stroke-width:2"/>';
      s += '<path d="M126 92 H194" style="stroke:var(--ink);stroke-width:1.5"/><text x="160" y="160" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">Ø ' + dia[1] + ' m</text>';
    } else if (f.icon === 'vee' || f.icon === 'vee-dash') {
      s += '<path d="M80 50 L160 130 L240 50" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"' + (f.icon === 'vee-dash' ? ' stroke-dasharray="8 5"' : '') + '/><text x="160" y="158" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">H 1.00 · 1.5:1</text>';
    } else if (f.icon === 'half') {
      s += '<path d="M100 50 H220 A60 60 0 0 1 100 50 Z" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"/><text x="160" y="150" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">D 0.30</text>';
    } else {
      s += '<path d="M70 50 L115 120 H205 L250 50" style="fill:var(--lane-off);stroke:var(--ink);stroke-width:2.5"/>';
      if (f.typeKey === '12') s += '<text x="160" y="150" text-anchor="middle" style="fill:var(--ink);font:500 14px var(--f-mono)">B 1.50 · H 0.50 · 1.5:1</text>';
    }
    return s + '</svg>';
  }

  function irRows(list) {
    let h = '';
    list.forEach((r, i) => {
      if (i > 0) {
        const m = DI.monthsBetween(list[i - 1].date, r.date);
        if (m >= 6) h += '<div class="gap"><i></i><div><b>Nothing submitted for ' + m + ' months</b><span>' + DI.fmtDate(list[i - 1].date, true) + ' → ' + DI.fmtDate(r.date, true) + '</span></div></div>';
      }
      const d = new Date(r.date);
      const lbl = { approved: 'Approved', comments: 'With comments', pending: 'Pending', rejected: 'Rejected' }[r.status];
      h += '<div class="ir"><div class="d">' + String(d.getDate()).padStart(2, '0') + ' ' + DI.MONTHS[d.getMonth()] + '<br>' + d.getFullYear() + '</div><div><div class="n">IR ' + esc(r.ir) + '</div><div class="s">' + esc(r.milestone) + ' · <span style="font-weight:500">' + esc(r.desc.slice(0, 44)) + (r.desc.length > 44 ? '…' : '') + '</span></div></div><span class="chip ' + r.status + '">' + lbl + '</span></div>';
    });
    return h;
  }

  function provenance(f, st) {
    const L = lineOf(f);
    const parts = [f.name.replace('Single box', 'Box') + ' · ' + (L.id === 'KM' ? 'KM' : 'KD') + '/' + f.sub + ' ' + DA.chText(f) + ' ' + f.side +
      ' (' + (f.cert === 'exact' ? 'exact' : f.cert === 'label' ? 'label position' : '±4 m') + (f.sheet ? ' · ' + f.sheet : '') + (f.level ? ' · Level ' + f.level : '') + ')'];
    if (st.seen) parts.push('Seen: ' + f.ladder[st.s] + ', ' + DI.fmtDate(st.seen.at, true) + ' ' + DI.fmtTime(st.seen.at) + ', ' + String(st.seen.by || '').replace(/^Engr\.\s*/, ''));
    else parts.push('Not seen by the inspector yet');
    if (st.claim) parts.push('Claimed: ' + f.ladder[st.c] + ', IR ' + st.claim.ir + ', ' + DI.fmtDate(st.claim.date, true) + ', ' + st.claim.status);
    if (st.defects.length) parts.push('Defect open: ' + st.defects.map(d => d.defect.toLowerCase() + (d.photos && d.photos.length ? ', ' + d.photos.length + ' photo' + (d.photos.length > 1 ? 's' : '') : '')).join('; '));
    return parts.join(' · ');
  }

  function statusIcons(r) {
    const q = window.syncState && window.syncState.pendingQueue || [];
    const last = window.syncState && window.syncState.lastSyncTime;
    const sent = last && last > r.at && q.indexOf(r.featureId) < 0;
    return '<span style="display:flex;gap:6px;align-items:center">' + I.icon('phone').replace('<svg', '<svg width="22" height="22"') + '<span style="opacity:' + (sent ? 1 : 0.35) + '">' + I.icon('cloud').replace('<svg', '<svg width="24" height="24"') + '</span></span>';
  }

  function openFeature(fid) {
    const f = DI.data.byId[fid];
    if (!f) return;
    const ov = DA.openOverlay('', 'full', {});
    ov.refresh = () => draw();
    const draw = () => {
      const st = DI.statusOf(f);
      const L = lineOf(f);
      let h = topbar('Feature', { caps: true, right: '<button class="ib" data-act="copy-prov" data-id="' + esc(f.id) + '">' + I.icon('share') + '</button>' }) + '<div class="scroll">';
      if (f.level === 'C') h += '<div class="banner">' + I.icon('warn') + '<div><b>Drawing not cleared for construction</b><span>' + esc(f.sheet || 'Drawing') + ' · Level C · revise and resubmit</span></div></div>';
      if (st.removed) h += '<div class="banner" style="background:var(--rev)">' + I.icon('x') + '<div><b>Removed from the design · pending</b><span>' + esc(st.changes.find(r => r.action === 'remove').source.drawing || '') + ' rev ' + esc(st.changes.find(r => r.action === 'remove').source.rev || '') + '</span></div></div>';
      h += '<div style="padding:18px 16px;background:var(--surface);border-bottom:1px solid var(--rule)"><div class="fhead">' + DA.sideBadge(f.side, 'xl') + '<div style="min-width:0"><div style="font:700 36px/1.02 var(--f-cond)">' + esc(f.name) + '</div>' +
        (f.full && f.full !== f.name ? '<div style="font:500 17px/1.3 var(--f-sans);color:var(--ink-2);margin-top:4px">' + esc(f.full) + '</div>' : '') + '</div></div>';
      h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;font:500 24px/1 var(--f-mono)">' + DA.chText(f) + ' ' + DA.certChip(f) + ' <span style="font:500 18px/1 var(--f-sans);color:var(--ink-2)">' + (f.kind === 'cross' ? 'crosses under track' : '') + '</span></div>';
      const where = f.kind === 'cross' ? L.short + ' · ' + f.sub + ' · ' + f.catLabel : DA.offText(f).replace('≈', '≈ ') + ' ' + (f.side === 'L' ? 'left' : f.side === 'R' ? 'right' : '') + ' of CL · ' + ({ toe: 'toe of slope', plat: 'platform edge', face: 'slope face', crest: 'crest', off: 'off alignment', cl: 'under the track' }[f.lane] || '');
      h += '<div class="lbl-caps" style="margin-top:12px;color:var(--ink-3)">' + esc(where) + '</div></div>';

      // what is built
      h += '<div class="section-h"><span class="lbl-caps">What is built</span></div><div class="pad">';
      if (!st.seen && !st.claim) {
        h += '<div class="built empty">' + DA.meter(f, { s: null, c: null }, 'lg') + '<b>Nobody has recorded this yet</b><div style="margin-top:8px;color:var(--ink-2)">No inspection requests from the contractor either.</div></div>';
        h += '<button class="btn primary mt12" data-act="record" data-id="' + esc(f.id) + '">Record first observation ' + I.icon('chev') + '</button>';
      } else {
        h += '<div class="built"><div class="part"><div class="toprow"><span class="chip seen">Seen by you</span><span class="when">' + (st.seen ? DI.fmtDate(st.seen.at, true) + ' · ' + DI.fmtTime(st.seen.at) : '') + '</span></div>' +
          DA.meter(f, { s: st.s == null ? 0 : st.s, c: -1 }, 'lg') + '<div class="stage"><b>' + (st.seen ? esc(f.ladder[st.s]) : 'Not yet') + '</b><span>' + (st.seen ? esc(st.seen.by || '') + (st.seen.office ? ' · office' : '') : '') + '</span></div></div>';
        if (st.claim) h += '<div class="part"><div class="toprow"><span class="chip claim">Contractor claims</span><span class="when">IR ' + esc(st.claim.ir) + ' · ' + DI.fmtDate(st.claim.date, true) + '</span></div>' +
          DA.meter(f, { s: -1, c: st.c }, 'lg') + '<div class="stage"><b>' + esc(f.ladder[st.c]) + '</b><span>' + esc(st.claim.status === 'comments' ? 'approved as noted' : st.claim.status) + '</span></div></div>';
        if (st.claim && st.s != null && st.c !== st.s) {
          const d = st.c - st.s;
          h += '<div class="warn">' + I.icon('warn') + '<div>You disagree: claim is ' + Math.abs(d) + ' stage' + (Math.abs(d) > 1 ? 's' : '') + ' ' + (d > 0 ? 'ahead' : 'behind') + '<small>' + esc(f.ladder[st.c]) + ' claimed; you saw ' + esc(f.ladder[st.s]) + '</small></div></div>';
        }
        if (f.level === 'C' && st.best > 0) h += '<div class="warn">' + I.icon('warn') + '<div>Work started ahead of an approved drawing. Sent to the office as an open item.</div></div>';
        h += '</div><button class="btn primary mt12" data-act="record" data-id="' + esc(f.id) + '">Record stage ' + I.icon('chev') + '</button>';
      }
      h += '<div class="row-btns two mt8"><button class="btn defect" data-act="defect" data-id="' + esc(f.id) + '">' + I.icon('warn') + 'Defect</button><button class="btn" data-act="photo" data-id="' + esc(f.id) + '">' + I.icon('camera') + 'Photo</button></div></div>';

      // open defects
      if (st.defects.length) {
        h += '<div class="section-h"><span class="lbl-caps">Open defect · ' + st.defects.length + '</span></div><div class="pad">';
        st.defects.forEach(d => {
          h += '<div style="border:3px solid var(--defect);margin-bottom:12px;background:var(--surface)"><div style="background:var(--defect);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:12px 14px"><b style="font:700 21px/1 var(--f-sans)">' + esc(d.defect) + '</b><span class="mono" style="font-size:14px">raised ' + DI.fmtDate(d.at) + ' · ' + DI.fmtTime(d.at) + '</span></div><div style="padding:14px">';
          if (d.part) h += '<div class="lbl-caps">' + esc(d.part) + '</div>';
          if (d.note) h += '<div style="font:500 18px/1.45 var(--f-sans);margin-top:8px">' + esc(d.note) + '</div>';
          if (d.photos && d.photos.length) {
            h += '<div class="photos mt12">' + d.photos.map((p, i) => '<div class="photo"><div class="img" data-photo="' + esc(p.id) + '"><span>Photo ' + (i + 1) + '</span></div></div>').join('') + '</div>';
            const p = d.photos[0];
            h += '<div class="mono" style="background:var(--paper);padding:10px 12px;margin-top:10px;font-size:14px;line-height:1.6;color:var(--ink-2)">Photo 1 · ' + DI.fmtTime(p.at) + '<br>fix ' + (p.fix && p.fix.lat != null ? p.fix.lat.toFixed(4) + ' N ' + p.fix.lon.toFixed(4) + ' E ±' + Math.round(p.fix.acc) + ' m' : 'no GPS') + '<br>snapped → ' + DI.fmtCh(p.snapped.ch) + ' ' + esc(p.snapped.side || '') + (p.snapped.offset ? ', ' + Math.abs(p.snapped.offset).toFixed(1) + ' m' : '') + '</div>';
          }
          h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">' + statusIcons(d) + '<button class="linkbtn" style="color:var(--ink)" data-act="clear-defect" data-id="' + esc(d.id) + '">Cleared on site</button></div></div></div>';
        });
        h += '</div>';
      }

      // where it starts and ends (derived linear)
      if (f.cert === 'derived' && f.ch1 - f.ch0 > 5) {
        const ex = DA.lineFeatures().filter(x => x.cert === 'exact').sort((a, b) => Math.abs(a.ch0 - f.ch0) - Math.abs(b.ch0 - f.ch0))[0];
        h += '<div class="section-h"><span class="lbl-caps">Where it starts and ends</span></div><div class="pad"><div style="border:2.5px solid var(--ink);background:var(--surface);padding:16px">';
        h += '<svg viewBox="0 0 320 70" width="100%"><text x="36" y="14" style="fill:var(--ink);font:500 13px var(--f-mono)">±4</text><text x="284" y="14" text-anchor="end" style="fill:var(--ink);font:500 13px var(--f-mono)">±4</text>' +
          '<line x1="26" y1="28" x2="40" y2="28" style="stroke:var(--ink);stroke-width:5" stroke-dasharray="2 3"/><rect x="42" y="23" width="236" height="10" style="fill:var(--ink)"/><line x1="280" y1="28" x2="294" y2="28" style="stroke:var(--ink);stroke-width:5" stroke-dasharray="2 3"/>' +
          '<text x="30" y="60" style="fill:var(--ink);font:500 13px var(--f-mono)">≈' + DI.fmtCh(f.ch0) + '</text><text x="160" y="60" text-anchor="middle" style="fill:var(--ink);font:500 13px var(--f-mono)">≈' + Math.round(f.ch1 - f.ch0) + ' m</text><text x="292" y="60" text-anchor="end" style="fill:var(--ink);font:500 13px var(--f-mono)">≈' + DI.fmtCh(f.ch1) + '</text></svg>';
        h += '<p style="margin:12px 0 8px">Ends read from marker spacing on the plan, so good to about 4 m.' + (ex ? ' Set out from the nearest exact point:' : '') + '</p>';
        if (ex) {
          const d = Math.round(f.ch0 - ex.ch0);
          h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font:700 18px/1 var(--f-sans)">' + I.typeIcon(ex.icon) + esc(ex.name.split(' ').slice(0, 2).join(' ')) + ' <span class="mono" style="font-weight:500">' + DI.fmtCh(ex.ch0, 3) + '</span><span class="chip exact">Exact</span></div><div class="muted mt8">start ≈ ' + Math.abs(d) + ' m ' + (d >= 0 ? 'after' : 'before') + '</div>';
        }
        h += '</div></div>';
      }

      // from the drawing
      h += '<div class="section-h"><span class="lbl-caps">From the drawing</span><span class="chip claim" style="gap:6px">' + I.icon('lock').replace('<svg', '<svg width="16" height="16"') + 'Read only</span></div>';
      h += '<div class="drawing"><div>' + sectionDrawing(f) + '<div class="kv mt12">';
      const kv = (k, v) => { h += '<div class="k">' + k + '</div><div class="v">' + v + '</div>'; };
      kv('Typology', esc(f.full || f.name));
      if (f.specs) kv('Section', '<span style="font-family:var(--f-sans);font-size:15px">' + esc(f.specs) + '</span>');
      kv('Position', DA.chText(f) + '<div style="margin-top:6px">' + DA.certChip(f) + '</div>');
      kv('How we know', f.cert === 'exact' ? 'Quoted on the drawing' : f.cert === 'label' ? 'Where the note sits' : 'Read from marker spacing');
      kv('Side', { L: 'Left', R: 'Right', C: 'Centre' }[f.side] + (f.kind === 'cross' ? ' · crosses' : ''));
      if (f.stated) kv('Stated length', 'L = ' + Math.round(f.stated) + ' m');
      kv('Drawing', esc(f.drawings.join(' / ') || '—'));
      if (f.level) kv('Approval', 'Level ' + f.level + '<small>' + LEVEL_MEANING[f.level] + '</small>');
      if (f.onHold) kv('Status', esc(f.raw.effective_status));
      if (f.confidence) kv('Confidence', esc(f.confidence));
      if (f.notes) kv('Notes', '<span style="font-family:var(--f-sans);font-size:15px">' + esc(f.notes) + '</span>');
      h += '</div></div></div>';

      // contractor IRs
      const irs = DI.data.irs[f.id] || [];
      h += '<div class="section-h"><span class="lbl-caps">Contractor’s inspection requests · ' + irs.length + '</span></div>';
      h += irs.length ? '<div style="border-top:2px solid var(--ink)">' + irRows(irs) + '</div>' : '<div class="pad note">No inspection requests matched to this structure.</div>';

      // your records
      const recs = DI.recordsFor(f.id);
      h += '<div class="section-h"><span class="lbl-caps">Your records · ' + recs.length + '</span><span class="chip claim" style="gap:6px">' + I.icon('lock').replace('<svg', '<svg width="16" height="16"') + 'Never overwritten</span></div><div class="pad">';
      if (recs.length) {
        h += '<div style="border:3px solid var(--ink);background:var(--surface)">';
        recs.forEach(r => {
          const what = r.kind === 'stage' ? '<div>' + DA.meter(f, { s: r.stage, c: -1 }, 'md') + '<b style="display:block;font:700 19px/1.2 var(--f-sans);margin-top:5px">' + esc(f.ladder[r.stage]) + '</b></div>'
            : '<div><b style="font:700 19px/1.2 var(--f-sans)">' + esc(r.kind === 'defect' ? 'Defect · ' + r.defect : r.kind === 'note' ? 'Note' : r.kind === 'photo' ? 'Photo' : r.kind === 'query' ? 'Query · ' + (r.title || '') : r.kind === 'design' ? 'Design change · ' + r.action : r.kind) + '</b>' + (r.note ? '<div class="muted" style="font-size:15px">' + esc(r.note) + '</div>' : '') + '</div>';
          h += '<div style="display:grid;grid-template-columns:96px 1fr auto;gap:10px;align-items:center;padding:14px;border-bottom:1px solid var(--rule)"><div class="mono" style="font-size:14.5px;line-height:1.35;color:var(--ink-2)">' + DI.fmtDate(r.at, true) + '<br>' + DI.fmtTime(r.at) + '</div>' + what + statusIcons(r) + '</div>';
        });
        h += '<div style="padding:14px;font:500 16px/1.4 var(--f-sans);color:var(--ink-2)">A correction is added as a new record; the old one stays.</div></div>';
      } else h += '<div class="note">Nothing recorded on this phone yet.</div>';
      h += '</div>';

      // weekly report
      const prov = provenance(f, st);
      h += '<div class="section-h"><span class="lbl-caps">For the weekly report</span></div><div class="pad"><div class="mono" style="border:2.5px dashed var(--ink-3);padding:16px;font-size:14.5px;line-height:1.6">' + esc(prov) + '</div>' +
        '<button class="btn mt8" data-act="copy-prov" data-id="' + esc(f.id) + '">' + I.icon('share') + 'Copy with provenance</button>';
      h += '<div class="grid2 mt24"><button class="btn" data-act="doors" data-id="' + esc(f.id) + '">What doesn’t match?</button><button class="btn" data-act="history" data-id="' + esc(f.id) + '">' + I.icon('history') + 'History</button></div></div><div style="height:40px"></div></div>';
      const sc = ov.querySelector('.scroll');
      const top = sc ? sc.scrollTop : 0;
      ov.firstChild.innerHTML = h;
      const sc2 = ov.querySelector('.scroll');
      if (sc2) sc2.scrollTop = top;
      DA.hydratePhotos(ov);
    };
    draw();
  }
  DA.openFeature = openFeature;
  A.feature = b => { DA.closeAll(); openFeature(b.dataset.id); };
  A['copy-prov'] = b => {
    const f = DI.data.byId[b.dataset.id];
    const text = provenance(f, DI.statusOf(f));
    const done = () => DA.toast({ title: 'Copied with provenance', sub: 'Paste it into the weekly report' });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  };
  function fallbackCopy(text, done) {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    t.remove();
  }
  A['clear-defect'] = b => {
    const r = DI.addRecord({ kind: 'clear', target: b.dataset.id });
    DA.toast({ title: 'Defect marked cleared', sub: 'Kept in the history', undo: () => { DI.voidRecord(r.id); DA.render(); } });
    DA.render();
  };

  // ================================================================ DEFECT
  const DEFECTS = ['Undermined', 'Honeycombing', 'Cracking', 'Silted / blocked', 'Wrong type built', 'Wrong position', 'Damaged', 'Other'];
  function partsFor(f) {
    if (f.kind === 'cross') return ['Inlet', 'Inlet wingwall L', 'Inlet wingwall R', 'Barrel', 'Outlet', 'Outlet wingwall L', 'Outlet wingwall R', 'Apron'];
    if (f.kind === 'point') return ['Top', 'Body', 'Bottom', 'Dissipator'];
    return ['Start', 'Along the run', 'End', 'Lining', 'Joint', 'Outfall'];
  }
  function openDefect(fid) {
    const f = DI.data.byId[fid];
    const st = DI.statusOf(f);
    const d = Object.assign({ defect: null, part: null, photos: [], note: '' }, DI.drafts()[fid] || {});
    const ov = DA.openOverlay('', 'full');
    const save = () => DI.saveDraft(fid, (d.defect || d.note || d.photos.length) ? d : null);
    const draw = () => {
      let h = topbar('Log defect', { x: true, right: '<span class="tag">' + I.icon('phone').replace('<svg', '<svg width="16" height="16"') + 'Draft on phone</span>' });
      h += '<div class="scroll">' + fsum(f, st.seen ? esc(f.ladder[st.s]) + ' · seen ' + DI.fmtTime(st.seen.at) : '');
      h += '<div class="pad"><div class="lbl-caps" style="margin:22px 0 10px">What is wrong</div><div class="grid2">' +
        DEFECTS.map(x => '<button class="pick' + (d.defect === x ? ' on red' : '') + '" data-act="df-type" data-v="' + esc(x) + '">' + esc(x) + (d.defect === x ? I.icon('check') : '') + '</button>').join('') + '</div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Where on it</div><div class="picks">' + partsFor(f).map(x => '<button class="pick' + (d.part === x ? ' on' : '') + '" data-act="df-part" data-v="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Photos · ' + d.photos.length + '</div><div class="photos">' + d.photos.map((p, i) => DA.photoTile(p, i + 1)).join('') +
        '<button class="photo-add" data-act="df-photo">' + I.icon('camera') + 'Take photo</button></div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Note</div><textarea class="inp" id="dfNote" rows="3" placeholder="What you see, where exactly">' + esc(d.note) + '</textarea>';
      h += '<button class="btn defect-solid mt16" data-act="df-raise"' + (d.defect ? '' : ' disabled') + '>Raise defect</button><p class="note" style="text-align:center">Opens as an item for the office. Each photo keeps its raw GPS fix and the chainage it was snapped to.</p><div style="height:30px"></div></div></div>';
      const sc = ov.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
      ov.firstChild.innerHTML = h;
      const sc2 = ov.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
      ov.querySelector('#dfNote').addEventListener('input', e => { d.note = e.target.value; save(); });
      DA.hydratePhotos(ov);
    };
    ov.df = {
      type(v) { d.defect = d.defect === v ? null : v; save(); draw(); },
      part(v) { d.part = d.part === v ? null : v; save(); draw(); },
      photo() { DA.takePhoto(m => { d.photos.push(m); save(); draw(); }); },
      raise() {
        if (!d.defect) return;
        const r = DI.addRecord({ kind: 'defect', featureId: fid, defect: d.defect, part: d.part, note: d.note, photos: d.photos, line: f.line, sub: f.sub, ch: f.ch0, pos: DA.snapPos() });
        DI.saveDraft(fid, null);
        DA.closeAll();
        DA.toast({ title: 'Defect raised · on this phone', sub: d.defect + ' · ' + f.name, icon: 'warn', undo: () => { DI.voidRecord(r.id); DI.saveDraft(fid, d); DA.render(); } });
        DA.render();
      }
    };
    draw();
  }
  DA.openDefect = openDefect;
  A.defect = b => { DA.closeAll(); openDefect(b.dataset.id); };
  A['df-type'] = (b, ov) => ov.df.type(b.dataset.v);
  A['df-part'] = (b, ov) => ov.df.part(b.dataset.v);
  A['df-photo'] = (b, ov) => ov.df.photo();
  A['df-raise'] = (b, ov) => ov.df.raise();

  // ================================================================ SECTION TAB
  S.secCat = 'cross';
  S.secView = 'ribbon';
  function renderSection(el) {
    const p = S.pos;
    const sub = DI.SUBS[p.sub] && DI.hasData(p.sub) ? DI.SUBS[p.sub] : DI.SUBS.KZDR;
    const all = DI.data.bySub[sub.id] || [];
    const L = DI.LINES.find(l => l.id === sub.line);
    const counts = {};
    all.forEach(f => { counts[f.catKey] = (counts[f.catKey] || 0) + 1; });
    const cats = DI.CAT_ORDER.filter(k => counts[k]);
    if (S.secCat !== 'all' && !counts[S.secCat]) S.secCat = 'all';
    const list = S.secCat === 'all' ? all : all.filter(f => f.catKey === S.secCat);
    const stats = list.map(f => ({ f, st: DI.statusOf(f) }));
    const b = { none: 0, moving: 0, stalled: 0, done: 0 };
    stats.forEach(x => b[x.st.bucket]++);
    const label = S.secCat === 'all' ? 'structures' : (all.find(f => f.catKey === S.secCat) || {}).catLabel || '';
    let h = '<div class="scroll"><div class="sec-head"><div><h1>' + sub.id + ' <small>' + esc(sub.name.replace(' – ', '–')) + '</small></h1><div class="rng">' + esc(L.name) + ' · ' + DI.fmtCh(sub.from) + ' → ' + DI.fmtCh(sub.to) + ' · ' + ((sub.to - sub.from) / 1000).toFixed(1) + ' km</div></div>' +
      '<button class="btn" data-act="project" style="width:auto;min-height:56px;font-size:19px">' + I.icon('layers') + 'Switch</button></div>';
    h += '<div class="chips-scroll"><button data-act="sec-cat" data-v="all" class="' + (S.secCat === 'all' ? 'on' : '') + '">All <small>' + all.length + '</small></button>' +
      cats.map(k => '<button data-act="sec-cat" data-v="' + k + '" class="' + (S.secCat === k ? 'on' : '') + '">' + esc(all.find(f => f.catKey === k).catLabel) + ' <small>' + counts[k] + '</small></button>').join('') + '</div>';
    const part = b.moving + b.stalled;
    h += '<div class="pad mt16"><p class="big-stat">' + part + ' of ' + list.length + ' part-built</p><div style="font:500 18px/1.3 var(--f-sans);color:var(--ink-2);margin-top:4px">' + b.stalled + ' of them unchanged for over 6 months</div>';
    const tot = Math.max(1, list.length);
    h += '<div class="stack"><i style="width:' + (b.none / tot * 100) + '%;background:var(--surface)"></i><i style="width:' + (b.moving / tot * 100) + '%;background:var(--part)"></i><i style="width:' + (b.stalled / tot * 100) + '%;background:var(--hazard)"></i><i style="width:' + (b.done / tot * 100) + '%;background:var(--ink)"></i></div>';
    h += '<div class="legend"><div><i style="background:var(--surface)"></i><b>' + b.none + '</b>Not started</div><div><i style="background:var(--part)"></i><b>' + b.moving + '</b>Part-built, moving</div><div><i style="background:var(--hazard)"></i><b>' + b.stalled + '</b>Part-built, stalled &gt; 6 mo</div><div><i style="background:var(--ink)"></i><b>' + b.done + '</b>Completed</div></div>';
    const names = ['Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted'];
    const hist = [0, 0, 0, 0, 0];
    stats.forEach(x => { if (x.st.partBuilt) { const n = x.f.ladder.length - 1; const i = Math.min(4, Math.round((x.st.best - 1) * 4 / Math.max(1, n - 2))); hist[Math.max(0, i)]++; } });
    const hm = Math.max(1, ...hist);
    h += '<div class="lbl-caps mt24">Where the part-built ones stand</div><div class="hist">' + hist.map((v, i) => '<div>' + v + '<i style="height:' + Math.max(4, v / hm * 90) + 'px"></i><small>' + names[i] + '</small></div>').join('') + '</div></div>';

    h += '<div style="border-top:3px solid var(--ink);margin-top:20px;padding:16px 16px 8px;display:flex;justify-content:space-between;align-items:center"><span class="lbl-caps">Every structure, one mark · ▲ up the line</span>' +
      '<div class="segm" style="grid-template-columns:1fr 1fr;width:150px"><button data-act="sec-view" data-v="ribbon" class="' + (S.secView === 'ribbon' ? 'on' : '') + '" style="min-height:40px">Ribbon</button><button data-act="sec-view" data-v="map" class="' + (S.secView === 'map' ? 'on' : '') + '" style="min-height:40px">Map</button></div></div>';
    if (S.secView === 'ribbon') {
      h += '<div class="ribbon">';
      const k0 = Math.floor(sub.from / 2000) * 2000;
      for (let a = Math.floor((sub.to - 1) / 2000) * 2000; a >= k0; a -= 2000) {
        const b2 = a + 2000;
        let marks = '';
        if (a < sub.from) marks += '<span class="outside" style="left:0;width:' + ((sub.from - a) / 2000 * 100) + '%"></span>';
        if (b2 > sub.to) marks += '<span class="outside" style="left:' + ((sub.to - a) / 2000 * 100) + '%;right:0"></span>';
        stats.forEach(x => {
          const c = (x.f.ch0 + x.f.ch1) / 2;
          if (c >= a && c < b2) marks += '<i class="' + (x.st.bucket === 'done' ? '' : x.st.bucket) + '" style="left:' + ((c - a) / 2000 * 100) + '%"></i>';
        });
        if (p.line === sub.line && p.ch >= a && p.ch < b2) marks += '<span class="you" style="left:' + ((p.ch - a) / 2000 * 100) + '%"></span>';
        h += '<button class="r" data-act="walk-at" data-ch="' + (a + 1000) + '" data-line="' + sub.line + '"><span class="k">' + (a / 1000) + '–' + (b2 / 1000) + '</span><span class="marks">' + marks + '</span></button>';
      }
      h += '<div style="display:flex;gap:18px;align-items:center;padding:12px 0;font:600 16px/1 var(--f-sans);flex-wrap:wrap"><span style="display:flex;gap:6px;align-items:center"><i style="width:10px;height:22px;background:var(--hivis);border:2px solid var(--ink)"></i>You</span><span style="display:flex;gap:6px;align-items:center"><i style="width:40px;height:22px;background:var(--no-data)"></i>Outside ' + sub.id + '</span><span>Tap a row to walk it</span></div></div>';
    } else {
      h += ribbonMap(sub, stats);
    }
    // stalled longest
    const stalled = stats.filter(x => x.st.stalled).sort((a, b2) => (a.st.lastAt < b2.st.lastAt ? -1 : 1)).slice(0, 5);
    h += '<div class="section-h" style="border-top:1px solid var(--rule)"><span class="lbl-caps">Stalled longest</span></div><div style="border-top:3px solid var(--ink)">';
    if (!stalled.length) h += '<div class="pad note" style="padding:16px">Nothing part-built has sat still for more than six months.</div>';
    stalled.forEach(x => {
      const f = x.f, mo = DI.monthsBetween(x.st.lastAt, new Date().toISOString());
      const d = new Date(x.st.lastAt);
      h += '<button class="frow" data-act="feature" data-id="' + esc(f.id) + '">' + DA.sideBadge(f.side) + '<div class="mid"><div class="t1">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + ' ' + DA.certChip(f) + '</div>' +
        '<div class="t3">' + esc(f.ladder[x.st.best]) + ' since ' + DI.MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' &nbsp;<b style="color:var(--ink)">' + mo + ' mo</b></div></div><div class="right">' + DA.meter(f, x.st) + '<span class="st">' + esc(f.ladder[x.st.best]) + '</span></div></button>';
    });
    h += '</div><div style="height:30px"></div></div>';
    const sc = el.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
    el.innerHTML = h;
    const sc2 = el.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
  }
  DA.renderSection = renderSection;
  A['sec-cat'] = b => { S.secCat = b.dataset.v; DA.render(); };
  A['sec-view'] = b => { S.secView = b.dataset.v; DA.render(); };
  A['walk-at'] = b => {
    const ch = Number(b.dataset.ch);
    DA.setTab('walk');
    if (DA.strip) { DA.strip.viewCh = ch; }
    if (S.pos.source === 'hand' || S.pos.line !== b.dataset.line) DA.setHand(b.dataset.line, ch);
    DA.render();
  };

  function ribbonMap(sub, stats) {
    const pts = DI.data.centre[sub.id];
    if (!pts) return '<div class="pad note">No centreline for this sub-section.</div>';
    const W = 360, H = 520;
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    pts.forEach(q => { minLat = Math.min(minLat, q.lat); maxLat = Math.max(maxLat, q.lat); minLon = Math.min(minLon, q.lon); maxLon = Math.max(maxLon, q.lon); });
    const k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const sx = (W - 120) / ((maxLon - minLon) * k || 1), sy = (H - 60) / (maxLat - minLat || 1);
    const sc = Math.min(sx, sy);
    const X = lon => 70 + (lon - minLon) * k * sc, Y = lat => H - 30 - (lat - minLat) * sc;
    let s = '<div class="pad"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="background:var(--paper);border:2px solid var(--ink)" data-act="ribbon-map">';
    for (let g = Math.ceil(minLat * 10) / 10; g <= maxLat; g += 0.1) s += '<line x1="0" x2="' + W + '" y1="' + Y(g) + '" y2="' + Y(g) + '" style="stroke:var(--rule)"/><text x="' + (W - 4) + '" y="' + (Y(g) - 4) + '" text-anchor="end" style="fill:var(--ink-2);font:500 12px var(--f-mono)">' + g.toFixed(1) + '°N</text>';
    for (let g = Math.ceil(minLon * 10) / 10; g <= maxLon; g += 0.1) s += '<line y1="0" y2="' + H + '" x1="' + X(g) + '" x2="' + X(g) + '" style="stroke:var(--rule)"/><text x="' + (X(g) + 3) + '" y="14" style="fill:var(--ink-2);font:500 12px var(--f-mono)">' + g.toFixed(1) + '°E</text>';
    const path = pts.filter((q, i) => i % 4 === 0).map((q, i) => (i ? 'L' : 'M') + X(q.lon).toFixed(1) + ' ' + Y(q.lat).toFixed(1)).join(' ');
    s += '<path d="' + path + '" style="fill:none;stroke:var(--surface);stroke-width:8"/><path d="' + path + '" style="fill:none;stroke:var(--ink);stroke-width:3.5"/>';
    stats.forEach(x => {
      const q = DI.pointAt(sub.id, (x.f.ch0 + x.f.ch1) / 2, x.f.side === 'L' ? 350 : -350);
      if (!q) return;
      const fill = x.st.bucket === 'done' ? 'var(--ink)' : x.st.bucket === 'moving' ? 'var(--part)' : x.st.bucket === 'stalled' ? 'url(#rmHaz)' : 'var(--surface)';
      s += '<rect x="' + (X(q.lon) - 4) + '" y="' + (Y(q.lat) - 4) + '" width="8" height="8" style="fill:' + fill + ';stroke:var(--ink);stroke-width:1.2"/>';
    });
    s += '<defs><pattern id="rmHaz" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" style="fill:var(--hivis)"/><rect width="2" height="4" fill="#121311"/></pattern></defs>';
    for (let c = Math.ceil(sub.from / 5000) * 5000; c < sub.to; c += 5000) {
      const q = DI.pointAt(sub.id, c, 0);
      s += '<rect x="' + (X(q.lon) - 44) + '" y="' + (Y(q.lat) - 11) + '" width="30" height="20" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><text x="' + (X(q.lon) - 29) + '" y="' + (Y(q.lat) + 4) + '" text-anchor="middle" style="fill:var(--ink);font:500 12px var(--f-mono)">' + c / 1000 + '</text>';
    }
    if (S.pos.sub === sub.id) {
      const q = DI.pointAt(sub.id, S.pos.ch, 0);
      s += '<circle cx="' + X(q.lon) + '" cy="' + Y(q.lat) + '" r="9" style="fill:var(--hivis);stroke:#121311;stroke-width:3"/>';
      s += '<rect x="' + (X(q.lon) - 124) + '" y="' + (Y(q.lat) - 11) + '" width="106" height="22" style="fill:var(--hivis);stroke:#121311;stroke-width:1.5"/><text x="' + (X(q.lon) - 71) + '" y="' + (Y(q.lat) + 5) + '" text-anchor="middle" style="fill:#121311;font:600 12.5px var(--f-mono)">YOU · ' + DI.fmtCh(S.pos.ch) + '</text>';
    }
    s += '</svg><div class="legend mt12" style="grid-template-columns:1fr 1fr"><div><i style="background:var(--surface)"></i>Not started</div><div><i style="background:var(--part)"></i>Part-built</div><div><i style="background:var(--hazard)"></i>Stalled &gt; 6 mo</div><div><i style="background:var(--ink)"></i>Completed</div></div><p class="note">Tap anywhere on the line to open the strip there. North up.</p></div>';
    DA.ribbonGeo = { sub: sub.id, X, Y, W, H, pts };
    return s;
  }
  A['ribbon-map'] = (b, ov, e) => {
    const g = DA.ribbonGeo; if (!g) return;
    const r = b.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * g.W, y = (e.clientY - r.top) / r.height * g.H;
    let best = null, bd = 1e9;
    g.pts.forEach(q => { const d = Math.hypot(g.X(q.lon) - x, g.Y(q.lat) - y); if (d < bd) { bd = d; best = q; } });
    if (best && bd < 30) { const L = DI.SUBS[g.sub].line; b.dataset.ch = best.pk; b.dataset.line = L; A['walk-at'](b); }
  };

  // ================================================================ PROJECT
  function openProject() {
    const ov = DA.openOverlay('', 'full');
    ov.refresh = () => draw();
    const draw = () => {
      let h = '<div class="topbar"><button class="ib" data-act="close">' + I.icon('back') + '</button><div class="t" style="text-align:left;font-size:40px">Project</div><div class="right" style="font:600 16px/1 var(--f-sans);color:var(--ink-2);white-space:nowrap">2 lines · 9 sub-sections</div></div><div class="scroll">';
      h += '<div class="pad mt12"><button data-act="keypad" style="display:flex;align-items:center;gap:14px;width:100%;height:72px;border:3px solid var(--ink);background:var(--surface);padding:0 18px;font:500 21px/1 var(--f-sans);white-space:nowrap;text-align:left">' + I.icon('search').replace('<svg', '<svg width="30" height="30" style="flex:none"') + '<span>Go to line + chainage</span><span style="margin-left:auto;font:500 16px/1 var(--f-mono);color:var(--ink-2)">PK ___+___</span></button></div>';
      DI.LINES.forEach(L => {
        h += '<div style="border-top:3px solid var(--ink);margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;padding:18px 16px 6px"><span class="lbl-caps" style="font-size:15px;color:var(--ink)">' + esc(L.short) + ' ' + (L.id === 'KM' ? 'LINE' : 'BRANCH') + '</span><span style="font:600 16px/1 var(--f-sans);color:var(--ink-2)">from Kano ▼</span></div>';
        if (L.id === 'KD') h += '<div style="padding:0 16px 6px;color:var(--defect);font:600 17px/1.3 var(--f-sans)">Chainage starts again at Kano. Always read it with the line.</div>';
        h += '<div class="proj-line"><span class="proj-rail"></span>';
        L.subs.forEach(sb => {
          const has = DI.hasData(sb.id), cur = S.pos.sub === sb.id;
          h += '<button class="proj-sub' + (has ? ' has' : ' empty') + (cur ? ' cur' : '') + '" data-act="proj-go" data-sub="' + sb.id + '"><span class="dot"></span><span><span style="display:flex;align-items:baseline;flex-wrap:wrap"><span class="code">' + sb.id + '</span><span class="nm">' + esc(sb.name) + '</span></span><div class="rng">' + (has ? DI.fmtCh(sb.from) + ' → ' + DI.fmtCh(sb.to) + ' · ' + DI.data.bySub[sb.id].length + ' features' : '—') + '</div></span>' +
            (has ? '<span class="pill-on">' + (cur ? 'YOU ARE HERE' : 'ON PHONE') + '</span>' : '<span class="st">Drawings not<br>yet processed</span>') + '</button>';
        });
        h += '</div></div>';
      });
      // settings
      let theme = document.documentElement.getAttribute('data-theme');
      h += '<div style="border-top:3px solid var(--ink);margin-top:18px"><div class="section-h"><span class="lbl-caps">This phone</span></div>';
      h += '<button class="setrow" data-act="set-name"><span><b>Inspector</b><small>' + esc(DI.inspector()) + '</small></span>' + I.icon('edit').replace('<svg', '<svg width="24" height="24"') + '</button>';
      h += '<button class="setrow' + (theme === 'sun' ? ' sel' : '') + '" data-act="set-theme" data-v="sun"><span><b>Sun</b><small>Ink on paper. Reads best in full sun.</small></span><span class="radio' + (theme === 'sun' ? ' on' : '') + '"></span></button>';
      h += '<button class="setrow' + (theme === 'office' ? ' sel' : '') + '" data-act="set-theme" data-v="office"><span><b>Office</b><small>Dark. Kinder on battery and eyes indoors.</small></span><span class="radio' + (theme === 'office' ? ' on' : '') + '"></span></button>';
      h += '<a class="setrow" href="legacy.html" style="text-decoration:none"><span><b>Classic app</b><small>The previous map-and-list app, with its editing tools</small></span>' + I.icon('chev').replace('<svg', '<svg width="24" height="24"') + '</a></div><div style="height:40px"></div></div>';
      ov.firstChild.innerHTML = h;
    };
    draw();
  }
  A.project = () => { DA.closeAll(); openProject(); };
  A['proj-go'] = b => {
    const sb = DI.SUBS[b.dataset.sub];
    if (!DI.hasData(sb.id)) { DA.toast({ title: sb.id + ': drawings not yet processed', sub: 'Shown here so the line is complete' }); return; }
    DA.closeAll();
    if (S.pos.sub !== sb.id) DA.setHand(sb.line, sb.from + 50);
    DA.setTab('walk');
  };
  A['set-theme'] = b => { DA.setTheme(b.dataset.v); DA.render(); };
  A['set-name'] = () => {
    const n = prompt('Inspector name, as it goes on every record', DI.inspector());
    if (n && n.trim()) { DI.setInspector(n.trim()); DA.render(); }
  };

  // ================================================================ DAY
  let offlineSince = navigator.onLine ? null : Date.now();
  window.addEventListener('offline', () => { offlineSince = Date.now(); DA.render(); });
  window.addEventListener('online', () => { offlineSince = null; DA.render(); });

  function renderDay(el) {
    const today = DI.live(r => DA.sameDay(r.at) && r.kind !== 'clear').sort((a, b) => a.at < b.at ? 1 : -1);
    const now = new Date();
    const q = (window.syncState && window.syncState.pendingQueue) || [];
    const last = window.syncState && window.syncState.lastSyncTime;
    const sent = today.filter(r => last && last > r.at && q.indexOf(r.featureId) < 0).length;
    const subs = Array.from(new Set(today.map(r => r.sub).filter(Boolean)));
    let h = '<div class="scroll"><div style="display:flex;justify-content:space-between;align-items:baseline;padding:16px 16px 12px;border-bottom:3px solid var(--ink)"><span style="font:700 48px/1 var(--f-cond)">Today</span><span style="font:600 18px/1 var(--f-sans);color:var(--ink-2)">' + DI.DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + DI.MONTHS[now.getMonth()] + (subs.length ? ' · ' + subs.join(', ') : S.pos.sub ? ' · ' + S.pos.sub : '') + '</span></div>';
    h += '<div class="pad mt16"><div class="card"><div class="ci">' + I.icon('phone') + '<div><b>' + today.length + ' record' + (today.length === 1 ? '' : 's') + ' safe on this phone</b><span>Written the moment you tapped. Nothing to press.</span></div></div>';
    const cfg = window.APP_CONFIG && window.APP_CONFIG.supabaseUrl;
    h += '<div class="ci">' + I.icon(navigator.onLine ? 'cloud' : 'cloudOff') + '<div><b style="font-size:22px">' + sent + ' sent to the office yet</b><span>' +
      (!cfg ? 'Office sync is not set up on this phone.' : navigator.onLine ? 'They send on their own while there is signal.' : 'No signal' + (offlineSince ? ' since ' + DI.fmtTime(new Date(offlineSince).toISOString()) : '') + '. They send on their own when there is.') +
      ' Records already in the office are never replaced by these.</span></div></div></div>';
    const drafts = DI.drafts();
    const dk = Object.keys(drafts).filter(k => DI.data.byId[k]);
    if (dk.length) {
      h += '<div class="card red mt16">';
      dk.forEach(k => {
        const d = drafts[k], f = DI.data.byId[k];
        h += '<div class="ci" style="display:block"><div style="display:flex;gap:12px;align-items:center;color:var(--defect)">' + I.icon('notes') + '<b>' + (dk.length > 1 ? dk.length + ' drafts' : '1 draft') + ' not finished</b></div><div style="font:500 18px/1.45 var(--f-sans);margin:10px 0 14px">Defect on ' + esc(f.name) + ', ' + ({ L: 'left', R: 'right', C: 'centre' }[f.side]) + ', ' + DA.chText(f, false) + ' — ' +
          [d.defect ? d.defect.toLowerCase() + ' chosen' : 'no type yet', d.note ? 'note written' : 'no note', d.photos && d.photos.length ? d.photos.length + ' photo' + (d.photos.length > 1 ? 's' : '') : 'no photo yet'].join(', ') + '.</div>' +
          '<div class="grid2"><button class="btn primary center" style="min-height:56px;font:700 20px/1 var(--f-sans)" data-act="defect" data-id="' + esc(k) + '">Finish</button><button class="btn" data-act="discard-draft" data-id="' + esc(k) + '">Discard</button></div></div>';
      });
      h += '</div>';
    }
    // covered
    const chs = today.filter(r => r.ch != null && r.line === S.pos.line).map(r => r.ch);
    if (chs.length) {
      const a = Math.min(...chs) - 20, b = Math.max(...chs) + 20;
      const inRange = DA.lineFeatures().filter(f => f.ch1 >= a && f.ch0 <= b);
      const recIds = new Set(today.map(r => r.featureId));
      const rec = inRange.filter(f => recIds.has(f.id)).length;
      h += '<div class="lbl-caps mt24" style="margin-bottom:10px">What you covered</div><div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;font:600 20px/1 var(--f-mono)"><span>' + DI.fmtCh(a) + ' → ' + DI.fmtCh(b) + '</span><span style="font-family:var(--f-sans)">' + ((b - a) / 1000).toFixed(2) + ' km</span></div>';
      h += '<div class="barcode">' + inRange.map(f => '<i class="' + (recIds.has(f.id) ? 'r' : 'u') + '" style="left:' + (((f.ch0 + f.ch1) / 2 - a) / (b - a || 1) * 100) + '%"></i>').join('') + '</div>';
      h += '<div style="display:flex;gap:18px;font:600 17px/1 var(--f-sans);flex-wrap:wrap"><span>▌' + rec + ' recorded</span><span class="muted">▯ ' + (inRange.length - rec) + ' in range, not checked</span></div></div>';
    }
    // differs from contractor
    const diffs = today.filter(r => r.kind === 'stage' && r.claimStage != null && r.claimStage !== r.stage);
    if (diffs.length) {
      h += '<div class="lbl-caps mt24" style="margin-bottom:10px">Differs from the contractor · ' + diffs.length + '</div></div><div style="border-top:3px solid var(--ink)">';
      diffs.forEach(r => { const f = DI.data.byId[r.featureId]; if (f) h += dayRow(r, f, '≠ claim · ' + f.ladder[r.claimStage]); });
      h += '</div><div class="pad">';
    }
    h += '<div class="lbl-caps mt24" style="margin-bottom:10px">All records · ' + today.length + '</div></div><div style="border-top:3px solid var(--ink)">';
    if (!today.length) h += '<div class="empty-state"><b>Nothing recorded today</b>Tap the bar at the bottom of Walk to record the structure you are standing at.</div>';
    const shown = S.dayAll ? today : today.slice(0, 3);
    shown.forEach(r => { const f = DI.data.byId[r.featureId]; h += f ? dayRow(r, f) : dayRowOther(r); });
    if (!S.dayAll && today.length > 3) h += '<button class="btn" data-act="day-all" style="border:0;border-bottom:1px solid var(--rule)">' + (today.length - 3) + ' more ' + I.icon('chevDown') + '</button>';
    h += '</div><div class="pad mt24"><button class="btn primary center" data-act="export-day"' + (today.length ? '' : ' disabled') + '>' + I.icon('share') + ' Export day for the report</button><p class="note" style="text-align:center">Table + photos, each row with line, chainage, side, drawing, who and when. Works with no signal: saves to the phone.</p></div><div style="height:30px"></div></div>';
    const sc = el.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
    el.innerHTML = h;
    const sc2 = el.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
  }
  function dayRow(r, f, diffText) {
    const st = { s: r.kind === 'stage' ? r.stage : null, c: -1 };
    const what = r.kind === 'stage' ? f.ladder[r.stage] : r.kind === 'defect' ? 'Defect · ' + r.defect : r.kind === 'note' ? 'Note' : r.kind === 'photo' ? 'Photo' : r.kind === 'query' ? 'Query' : r.kind === 'design' ? 'Design · ' + r.action : r.kind;
    return '<button class="frow" data-act="feature" data-id="' + esc(f.id) + '"><span class="time">' + DI.fmtTime(r.at) + '</span>' + DA.sideBadge(f.side) +
      '<div class="mid"><div class="t1"><span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + ' ' + DA.certChip(f) + '</div></div><div class="right">' +
      (r.kind === 'stage' ? DA.meter(f, st) : '') + '<span class="st' + (diffText ? ' diff' : '') + '"' + (r.kind === 'defect' ? ' style="color:var(--defect)"' : '') + '>' + esc(diffText || what) + '</span></div></button>';
  }
  function dayRowOther(r) {
    return '<div class="frow"><span class="time">' + DI.fmtTime(r.at) + '</span><span class="badge" style="background:var(--hivis);color:#121311">?</span><div class="mid"><div class="t1"><span>' + esc(r.kind === 'unlisted' ? 'Unlisted · ' + (r.what || '') : r.kind) + '</span></div><div class="t2">' + (r.ch != null ? DI.fmtCh(r.ch) : '') + ' <span class="chip measured">Measured</span></div></div></div>';
  }
  DA.renderDay = renderDay;
  A['day-all'] = () => { S.dayAll = true; DA.render(); };
  A['discard-draft'] = b => { if (confirm('Discard this draft? Nothing has been raised from it.')) { DI.saveDraft(b.dataset.id, null); DA.render(); } };
  A['export-day'] = () => exportDay();

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportDay() {
    const today = DI.live(r => DA.sameDay(r.at) && r.kind !== 'clear').sort((a, b) => a.at < b.at ? -1 : 1);
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const head = ['time', 'line', 'sub_section', 'chainage', 'position_certainty', 'side', 'feature_id', 'feature', 'drawing', 'level', 'record', 'stage', 'contractor_claim', 'defect', 'part', 'note', 'photos', 'inspector', 'gps_accuracy_m', 'position_source', 'record_id'];
    const rows = today.map(r => {
      const f = DI.data.byId[r.featureId] || {};
      return [r.at, r.line || f.line, r.sub || f.sub, f.ch0 != null ? DA.chText(f) : DI.fmtCh(r.ch), f.cert || 'measured', f.side || (r.pos && r.pos.side), r.featureId || '', f.name || r.what || '', f.sheet || '', f.level || '', r.kind,
        r.kind === 'stage' && f.ladder ? f.ladder[r.stage] : '', r.claimStage != null && f.ladder ? f.ladder[r.claimStage] + ' (IR ' + r.claimIr + ')' : '', r.defect || '', r.part || '', r.note || '',
        (r.photos || []).length, r.by, r.pos && r.pos.acc != null ? Math.round(r.pos.acc) : '', r.pos ? r.pos.source : '', r.id];
    });
    const csv = [head].concat(rows).map(r => r.map(DI.csvCell).join(',')).join('\r\n');
    download('drainage-day-' + stamp + '.csv', new Blob(['﻿' + csv], { type: 'text/csv' }));
    // a printable report with the photos inside it
    const photoIds = [];
    today.forEach(r => (r.photos || []).forEach(p => photoIds.push(p.id)));
    Promise.all(photoIds.map(id => DI.getPhoto(id).then(b => b ? new Promise(res => { const fr = new FileReader(); fr.onload = () => res([id, fr.result]); fr.readAsDataURL(b); }) : [id, null]))).then(pairs => {
      const img = Object.fromEntries(pairs);
      let html = '<!doctype html><meta charset="utf-8"><title>Drainage day ' + stamp + '</title><style>body{font:14px/1.4 system-ui,sans-serif;margin:24px;color:#121311}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eee}img{width:180px;margin:4px 4px 0 0;border:1px solid #333}code{font-family:ui-monospace,monospace}</style>';
      html += '<h1>Drainage inspection · ' + stamp + '</h1><p>' + esc(DI.inspector()) + ' · ' + today.length + ' records · exported from the phone</p><table><tr><th>Time</th><th>Line / chainage</th><th>Feature</th><th>Record</th><th>Photos</th></tr>';
      today.forEach(r => {
        const f = DI.data.byId[r.featureId] || {};
        const what = r.kind === 'stage' && f.ladder ? 'Seen: <b>' + esc(f.ladder[r.stage]) + '</b>' + (r.claimStage != null ? '<br>Claimed: ' + esc(f.ladder[r.claimStage]) + ' (IR ' + esc(r.claimIr) + ')' : '') : esc(r.kind) + (r.defect ? ': <b>' + esc(r.defect) + '</b>' : '') + (r.part ? ' · ' + esc(r.part) : '');
        html += '<tr><td><code>' + DI.fmtTime(r.at) + '</code></td><td><code>' + esc((r.line || '') + '/' + (r.sub || '') + ' ' + (f.ch0 != null ? DA.chText(f) : DI.fmtCh(r.ch)) + ' ' + (f.side || '')) + '</code><br>' + esc(f.sheet || '') + (f.level ? ' · Level ' + f.level : '') + '</td><td>' + esc(f.name || r.what || '') + '</td><td>' + what + (r.note ? '<br>' + esc(r.note) : '') + '</td><td>' +
          (r.photos || []).map(p => img[p.id] ? '<img src="' + img[p.id] + '"><br><code>' + DI.fmtTime(p.at) + ' ' + (p.fix && p.fix.lat != null ? p.fix.lat.toFixed(5) + ',' + p.fix.lon.toFixed(5) + ' ±' + Math.round(p.fix.acc) + 'm' : 'no fix') + ' → ' + DI.fmtCh(p.snapped.ch) + ' ' + esc(p.snapped.side || '') + '</code>' : '').join('') + '</td></tr>';
      });
      html += '</table>';
      download('drainage-day-' + stamp + '.html', new Blob([html], { type: 'text/html' }));
      DA.toast({ title: 'Day saved to this phone', sub: 'CSV table and a report with photos' });
    });
  }

  // ================================================================ HISTORY
  function openHistory(fid) {
    const f = DI.data.byId[fid];
    const ov = DA.openOverlay('', 'full');
    let tab = 'all';
    const draw = () => {
      const ev = [];
      DI.recordsFor(fid).forEach(r => {
        if (r.kind === 'stage') ev.push({ at: r.at, t: 'field', dot: 'seen', tag: '<span class="chip seen">Seen</span>', h: esc(f.ladder[r.stage]), m: esc(String(r.by).replace(/^Engr\.\s*/, '')) + ' · on phone' });
        else if (r.kind === 'defect') ev.push({ at: r.at, t: 'field', dot: 'q', tag: '<span class="chip defect">Defect</span>', h: esc(r.defect), b: esc([r.part, r.note].filter(Boolean).join(' · ')), m: esc(String(r.by).replace(/^Engr\.\s*/, '')) });
        else if (r.kind === 'query') ev.push({ at: r.at, t: 'field', dot: 'q', tag: '<span class="chip defect">Query</span>', h: esc(r.title || 'Query'), b: esc(r.note || ''), m: esc(String(r.by).replace(/^Engr\.\s*/, '')) + ' · open' });
        else if (r.kind === 'note') ev.push({ at: r.at, t: 'field', dot: 'seen', tag: '<span class="chip claim">Note</span>', h: '', b: esc(r.note), m: esc(String(r.by).replace(/^Engr\.\s*/, '')) });
        else if (r.kind === 'photo') ev.push({ at: r.at, t: 'field', dot: 'seen', tag: '<span class="chip claim">Photo</span>', h: '', m: esc(String(r.by).replace(/^Engr\.\s*/, '')) });
        else if (r.kind === 'design') ev.push({ at: r.at, t: 'design', dot: 'd', tag: '<span class="chip rev">Δ ' + esc(r.source.rev || '') + '</span>', h: esc({ remove: 'Removed', move: 'Moved', retype: 'Type or size changed', add: 'Added' }[r.action]), b: esc(r.summary || ''), m: esc([r.source.drawing, r.source.rev ? 'rev ' + r.source.rev : '', r.source.level ? 'Level ' + r.source.level : '', r.source.kind].filter(Boolean).join(' · ')) + ' · pending' });
      });
      (DI.data.irs[fid] || []).forEach(r => ev.push({ at: r.date, t: 'field', dot: 'ir', tag: '<span class="chip claim">IR ' + esc(r.ir) + '</span>', h: esc(r.milestone) + ' claimed', m: 'Contractor · ' + r.status }));
      ev.push({ at: '0000', t: 'design', dot: 'd', tag: '<span class="chip rev">Drawing</span>', h: 'From the drawing set', b: esc(f.full) + ' at ' + DA.chText(f), m: esc(f.sheet || '') + (f.level ? ' · Level ' + f.level : '') + ' · office import' });
      ev.sort((a, b) => a.at < b.at ? 1 : -1);
      let h = topbar('History') + '<div class="scroll">' + fsum(f) + '<div class="pad mt16"><div class="segm" style="grid-template-columns:repeat(3,1fr)">' +
        [['all', 'Everything'], ['design', 'Design'], ['field', 'Field']].map(([k, n]) => '<button data-act="hist-tab" data-v="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div><div class="tl">';
      ev.filter(e => tab === 'all' || e.t === tab).forEach(e => {
        const d = e.at === '0000' ? '' : DI.fmtDate(e.at, true) + (e.at.length > 10 ? '<br>' + DI.fmtTime(e.at) : '');
        h += '<div class="e"><div class="d">' + (d || 'drawing') + '</div><span class="dot ' + e.dot + '"></span><div class="c"><div class="h">' + e.tag + ' ' + e.h + '</div>' + (e.b ? '<div class="b">' + e.b + '</div>' : '') + '<div class="m">' + e.m + '</div></div></div>';
      });
      h += '</div><div class="lock-note">' + I.icon('lock') + 'Nothing here is edited in place. A correction is a new entry, and the old one stays visible.</div></div>';
      ov.firstChild.innerHTML = h;
    };
    ov.hist = { tab(v) { tab = v; draw(); } };
    draw();
  }
  A.history = b => openHistory(b.dataset.id);
  A['hist-tab'] = (b, ov) => ov.hist.tab(b.dataset.v);

  // ================================================================ EDITING: TWO DOORS
  function openDoors(fid) {
    const f = DI.data.byId[fid];
    const h = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + DA.sideBadge(f.side) + '<b style="font:700 19px/1.2 var(--f-sans)">' + esc(f.name) + '</b><span class="mono">' + DA.chText(f, false) + '</span>' + DA.certChip(f) + '</div>' +
      '<div style="font:700 38px/1.05 var(--f-cond);margin:14px 0">What doesn’t match?</div>' +
      '<div class="door"><div class="dh"><b>The ground differs from the drawing</b><span>Design stays as drawn. You record what is there — it becomes a query.</span></div>' +
      '<button data-act="asbuilt" data-id="' + esc(fid) + '">' + I.icon('pin') + 'Built in a different place' + I.icon('chev', 'chev') + '</button>' +
      '<button data-act="query" data-id="' + esc(fid) + '" data-v="type">' + I.typeIcon('trap') + 'Built as a different type or size' + I.icon('chev', 'chev') + '</button>' +
      '<button data-act="query" data-id="' + esc(fid) + '" data-v="other">' + I.icon('notes') + 'Something else about it' + I.icon('chev', 'chev') + '</button></div>' +
      '<div class="door blue"><div class="dh"><b>The drawing has changed</b><span>Changes the design. Needs the revision or instruction that says so.</span></div>' +
      '<button data-act="design-edit" data-id="' + esc(fid) + '" data-v="remove">' + I.icon('x') + 'Removed in a revision' + I.icon('chev', 'chev') + '</button>' +
      '<button data-act="design-edit" data-id="' + esc(fid) + '" data-v="move">' + I.icon('pin') + 'Moved in a revision' + I.icon('chev', 'chev') + '</button>' +
      '<button data-act="design-edit" data-id="' + esc(fid) + '" data-v="retype">' + I.icon('sizes') + 'Type or size changed in a revision' + I.icon('chev', 'chev') + '</button></div>' +
      '<div class="lock-note" style="padding:4px 0 10px">' + I.icon('lock') + 'Nothing is deleted or written over. Every change is a new version you can step back from.</div>';
    DA.openOverlay(h, 'sheet tall');
  }
  A.doors = b => openDoors(b.dataset.id);

  // Door 1 — a field finding
  function openQuery(fid, kind) {
    const f = DI.data.byId[fid];
    const d = { photos: [], note: '', what: '' };
    const ov = DA.openOverlay('', 'full');
    const draw = () => {
      let h = topbar(kind === 'type' ? 'Built differently?' : 'Something else') + '<div class="scroll">' + fsum(f, 'design') + '<div class="pad">';
      if (kind === 'type') h += '<div class="lbl-caps" style="margin:22px 0 10px">What was built instead</div><input class="inp" id="qWhat" placeholder="e.g. Type 7 instead of Type 12" value="' + esc(d.what) + '" style="font-family:var(--f-sans);font-size:19px">';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Evidence</div><div class="photos">' + d.photos.map((p, i) => DA.photoTile(p, i + 1)).join('') + '<button class="photo-add" data-act="q-photo">' + I.icon('camera') + 'Photo</button></div>';
      h += '<textarea class="inp mt12" id="qNote" rows="3" placeholder="What is different, in your words">' + esc(d.note) + '</textarea>';
      h += '<button class="btn primary center mt16" data-act="q-raise">Raise as a query</button><p class="note">The design is not touched. Kept as a field record and sent to the office as an open item.</p></div></div>';
      ov.firstChild.innerHTML = h;
      const w = ov.querySelector('#qWhat'); if (w) w.addEventListener('input', e => { d.what = e.target.value; });
      ov.querySelector('#qNote').addEventListener('input', e => { d.note = e.target.value; });
      DA.hydratePhotos(ov);
    };
    ov.q = {
      photo() { DA.takePhoto(m => { d.photos.push(m); draw(); }); },
      raise() {
        if (!d.note && !d.what && !d.photos.length) { DA.toast({ title: 'Add a note or a photo first' }); return; }
        const r = DI.addRecord({ kind: 'query', featureId: fid, title: kind === 'type' ? 'Built as a different type or size' : 'Differs from the drawing', what: d.what, note: [d.what, d.note].filter(Boolean).join(' — '), photos: d.photos, line: f.line, sub: f.sub, ch: f.ch0, pos: DA.snapPos() });
        DA.closeAll();
        DA.toast({ title: 'Query raised · on this phone', sub: 'The design stays as drawn', undo: () => { DI.voidRecord(r.id); DA.render(); } });
        DA.render();
      }
    };
    draw();
  }
  A.query = b => { DA.closeAll(); openQuery(b.dataset.id, b.dataset.v); };
  A['q-photo'] = (b, ov) => ov.q.photo();
  A['q-raise'] = (b, ov) => ov.q.raise();

  // Built somewhere else: measured position, checked against GPS error
  function openAsBuilt(fid) {
    const f = DI.data.byId[fid];
    const d = { photos: [], note: '', m: null, tape: null };
    const ov = DA.openOverlay('', 'full');
    const capture = () => {
      const recent = S.fixes.filter(x => Date.now() - x.t < 60000 && x.acc <= 15).slice(-12);
      if (!recent.length) { d.m = null; return; }
      const ch = recent.reduce((t, x) => t + x.ch, 0) / recent.length;
      const off = recent.reduce((t, x) => t + x.offset, 0) / recent.length;
      const acc = Math.max(1, recent.reduce((t, x) => t + x.acc, 0) / recent.length / Math.sqrt(recent.length) * 1.5);
      d.m = { ch, offset: off, acc, n: recent.length, at: new Date().toISOString() };
    };
    capture();
    const draw = () => {
      let h = topbar('Built somewhere else?') + '<div class="scroll">' + fsum(f, 'design') + '<div class="pad">';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">1 · Stand on what was built</div>';
      if (d.m) h += '<button data-act="ab-capture" style="width:100%;text-align:left;background:var(--hivis);color:#121311;border:3px solid #121311;padding:14px 18px;display:flex;justify-content:space-between;align-items:center"><span><b style="display:block;font:700 22px/1.2 var(--f-sans)">Captured where you stand</b><span class="mono">' + DI.fmtTime(d.m.at) + ' · ' + d.m.n + ' fix' + (d.m.n > 1 ? 'es' : '') + ' averaged</span></span>' + I.icon('check').replace('<svg', '<svg width="30" height="30"') + '</button>';
      else h += '<button class="btn hivis" data-act="ab-capture" style="min-height:72px">' + I.icon('target') + 'Capture where I stand</button><p class="note">Needs a GPS fix of ±15 m or better in the last minute. Otherwise measure by tape below.</p>';
      if (d.m) {
        const diff = d.m.ch - f.ch0, lat = (d.m.offset - f.offset);
        const real = Math.abs(diff) > d.m.acc * 1.5;
        const dir = diff >= 0 ? 'up the line' : 'down the line';
        h += '<div class="lbl-caps" style="margin:22px 0 10px">2 · The difference</div><div style="border:3px solid var(--ink);background:var(--surface);padding:16px">';
        const bx = Math.max(60, Math.min(260, 110 + diff * 12));
        h += '<svg viewBox="0 0 320 110" width="100%"><line x1="10" y1="52" x2="310" y2="52" style="stroke:var(--ink);stroke-width:3"/><rect x="98" y="40" width="24" height="24" style="fill:var(--surface);stroke:var(--ink);stroke-width:2.5"/>' +
          '<rect x="' + (bx - 24) + '" y="28" width="48" height="48" style="fill:var(--hivis-soft);stroke:var(--ink);stroke-width:1.5" stroke-dasharray="4 3"/><rect x="' + (bx - 12) + '" y="40" width="24" height="24" style="fill:var(--ink)"/>' +
          '<text x="110" y="92" text-anchor="middle" style="fill:var(--ink);font:500 13px var(--f-mono)">design</text><text x="' + bx + '" y="92" text-anchor="middle" style="fill:var(--ink);font:500 13px var(--f-mono)">built</text><text x="' + bx + '" y="106" text-anchor="middle" style="fill:var(--ink-3);font:500 11px var(--f-mono)">GPS ±' + d.m.acc.toFixed(0) + ' m</text>' +
          '<text x="' + ((110 + bx) / 2) + '" y="20" text-anchor="middle" style="fill:var(--ink);font:700 18px var(--f-cond)">' + Math.abs(diff).toFixed(1) + ' m</text></svg>';
        h += '<div class="kv mt8"><div class="k">Design</div><div class="v">' + DI.fmtCh(f.ch0, f.cert === 'exact' ? 3 : 0) + ' ' + DA.certChip(f) + '</div><div class="k">Built</div><div class="v">' + DI.fmtCh(d.m.ch, 1) + ' <span class="chip measured">Measured · GPS ±' + d.m.acc.toFixed(0) + ' m</span></div><div class="k">Apart</div><div class="v">' + Math.abs(diff).toFixed(1) + ' m ' + dir + ' · ' + Math.abs(lat).toFixed(1) + ' m ' + (lat > 0 ? 'left' : 'right') + '</div></div>';
        h += '<div style="background:' + (real ? 'var(--ink);color:var(--on-ink)' : 'var(--hivis);color:#121311') + ';padding:14px;margin-top:12px;font:700 18px/1.3 var(--f-sans);display:flex;gap:10px">' + I.icon(real ? 'check' : 'warn').replace('<svg', '<svg width="24" height="24"') + (real ? 'Bigger than the GPS error. The difference is real.' : 'Within the GPS error. Measure by tape from an exact point to be sure.') + '</div></div>';
      }
      h += '<button data-act="ab-tape" style="width:100%;text-align:left;border:2.5px solid var(--ink);background:var(--surface);padding:14px 18px;margin-top:12px;display:flex;justify-content:space-between;align-items:center"><span><b style="font:700 20px/1.2 var(--f-sans);display:block">Measure by tape instead</b><span class="muted">From an exact point, when GPS isn’t good enough</span></span>' + I.icon('chev').replace('<svg', '<svg width="26" height="26"') + '</button>';
      if (d.tape) h += '<div class="mono mt8" style="padding:10px;border:2px dashed var(--ink-3)">Tape: ' + esc(d.tape.text) + '</div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">3 · Evidence</div><div class="photos">' + d.photos.map((p, i) => DA.photoTile(p, i + 1)).join('') + '<button class="photo-add" data-act="ab-photo">' + I.icon('camera') + 'Photo</button></div>';
      h += '<textarea class="inp mt12" id="abNote" rows="3" placeholder="e.g. Inlet headwall set out ~7 m up the line from design">' + esc(d.note) + '</textarea>';
      h += '<button class="btn primary center mt16" data-act="ab-raise"' + (d.m || d.tape ? '' : ' disabled') + '>Raise as a query</button><p class="note">Design stays at ' + DA.chText(f, false) + '. Your measurement is kept as an as-built record, with the raw GPS fixes.</p><div style="height:30px"></div></div></div>';
      ov.firstChild.innerHTML = h;
      ov.querySelector('#abNote').addEventListener('input', e => { d.note = e.target.value; });
      DA.hydratePhotos(ov);
    };
    ov.ab = {
      capture() { capture(); if (!d.m) DA.toast({ title: 'No usable GPS fix', sub: 'Measure by tape from an exact point instead' }); draw(); },
      tape() {
        const ex = DA.lineFeatures().filter(x => x.cert === 'exact').sort((a, b) => Math.abs(a.ch0 - f.ch0) - Math.abs(b.ch0 - f.ch0))[0];
        const v = prompt('Distance along the line from ' + (ex ? ex.name + ' at ' + DI.fmtCh(ex.ch0, 3) : 'the nearest exact point') + ', in metres (negative = down the line):', '');
        if (v == null || isNaN(parseFloat(v))) return;
        const ch = (ex ? ex.ch0 : f.ch0) + parseFloat(v);
        d.tape = { from: ex ? ex.id : null, dist: parseFloat(v), text: parseFloat(v) + ' m from ' + (ex ? DI.fmtCh(ex.ch0, 3) : '?') + ' → ' + DI.fmtCh(ch, 1) };
        d.m = d.m || { ch, offset: f.offset, acc: 0.5, n: 0, at: new Date().toISOString(), tape: true };
        if (d.m.tape) d.m.ch = ch;
        draw();
      },
      photo() { DA.takePhoto(m => { d.photos.push(m); draw(); }); },
      raise() {
        const diff = d.m ? d.m.ch - f.ch0 : 0;
        const r = DI.addRecord({ kind: 'query', featureId: fid, title: 'Built ' + Math.abs(diff).toFixed(1) + ' m from design', asBuilt: d.m, tape: d.tape, fixes: S.fixes.slice(-12), note: 'As-built ' + DI.fmtCh(d.m.ch, 1) + (d.m.tape ? ' (tape)' : ', GPS ±' + d.m.acc.toFixed(0) + ' m') + (d.note ? '. ' + d.note : ''), photos: d.photos, line: f.line, sub: f.sub, ch: f.ch0, pos: DA.snapPos() });
        DA.closeAll();
        DA.toast({ title: 'Query raised · on this phone', sub: 'Design stays where it is drawn', undo: () => { DI.voidRecord(r.id); DA.render(); } });
        DA.render();
      }
    };
    draw();
  }
  A.asbuilt = b => { DA.closeAll(); openAsBuilt(b.dataset.id); };
  A['ab-capture'] = (b, ov) => ov.ab.capture();
  A['ab-tape'] = (b, ov) => ov.ab.tape();
  A['ab-photo'] = (b, ov) => ov.ab.photo();
  A['ab-raise'] = (b, ov) => ov.ab.raise();

  // Door 2 — a design change, with its source
  function sourceBlock(src) {
    return '<div class="lbl-caps" style="margin:20px 0 10px;color:var(--rev)">Source · required</div><div class="segm blue" style="grid-template-columns:repeat(3,1fr)">' +
      [['revision', 'Drawing revision'], ['instruction', 'Site instruction'], ['comment', 'Consultant comment']].map(([k, n]) => '<button data-act="src-kind" data-v="' + k + '" class="' + (src.kind === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="grid2 mt12" style="grid-template-columns:1.6fr 1fr"><div class="fld"><label>' + (src.kind === 'revision' ? 'Drawing' : 'Reference') + '</label><input class="inp" data-src="drawing" value="' + esc(src.drawing || '') + '" placeholder="DW-03008"></div><div class="fld"><label>Revision</label><input class="inp" data-src="rev" value="' + esc(src.rev || '') + '" placeholder="07"></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font:600 16px/1 var(--f-sans);color:var(--ink-2)">Approval on the sheet</span><span style="display:flex;gap:6px">' + ['A', 'B', 'C'].map(l => '<button data-act="src-level" data-v="' + l + '" class="chip ' + (src.level === l ? 'approved' : 'lvl') + '" style="height:36px;padding:0 12px">' + (src.level === l ? 'Level ' : '') + l + '</button>').join('') + '</span></div>';
  }
  function bindSource(ov, src) {
    ov.querySelectorAll('[data-src]').forEach(i => i.addEventListener('input', e => { src[i.dataset.src] = e.target.value.trim(); }));
  }
  function openDesignEdit(fid, action) {
    const f = DI.data.byId[fid];
    const st = DI.statusOf(f);
    const src = { kind: 'revision', drawing: (f.sheet || '').replace(/-\d{2}$/, ''), rev: '', level: 'A' };
    const d = { ch: '', what: '' };
    const title = { remove: 'Remove from design', move: 'Move in a revision', retype: 'Type or size changed' }[action];
    const ov = DA.openOverlay('', 'sheet tall rev');
    const draw = () => {
      let h = '<span class="chip rev" style="height:30px;font-size:15px">' + esc(title) + ' Δ ' + esc(src.rev || '__') + '</span>' +
        '<div class="fhead mt12">' + DA.sideBadge(f.side, 'xl') + '<div><div class="t1"><span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + ' ' + DA.certChip(f) + '</div></div></div>';
      h += sourceBlock(src);
      if (action === 'move') h += '<div class="fld mt12"><label>New chainage, as on the revised sheet</label><input class="inp" id="deCh" inputmode="decimal" placeholder="111+212" value="' + esc(d.ch) + '"></div>';
      if (action === 'retype') h += '<div class="fld mt12"><label>New type or size</label><input class="inp" id="deWhat" placeholder="e.g. Pipe Ø1.5 m" value="' + esc(d.what) + '" style="font-family:var(--f-sans)"></div>';
      h += '<div class="lbl-caps" style="margin:20px 0 6px">What happens</div>';
      h += '<div class="lock-note" style="padding:10px 0;border-bottom:1px solid var(--rule)">' + I.icon('lock') + 'All field records, photos and inspection requests stay attached and read-only.</div>';
      if (action === 'remove') h += '<div class="lock-note" style="padding:10px 0;border-bottom:1px solid var(--rule)">' + I.icon('x') + '<span>It stays on the strip and the map, struck through and marked <b>REMOVED Δ' + esc(src.rev || '') + '</b>. Never hidden.</span></div>';
      else h += '<div class="lock-note" style="padding:10px 0;border-bottom:1px solid var(--rule)">' + I.icon('history') + '<span>Shows on your strip at once as <b>pending</b>. The office confirms. The old version is kept.</span></div>';
      if (action === 'remove' && st.seen && st.s > 0) h += '<div style="border:2.5px solid var(--defect);background:var(--defect-bg);padding:14px;display:flex;gap:12px;margin-top:12px;font:500 17px/1.45 var(--f-sans)"><span style="color:var(--defect)">' + I.icon('warn').replace('<svg', '<svg width="28" height="28"') + '</span><span><b style="color:var(--defect)">Work exists on site</b> — you saw it ' + esc(f.ladder[st.s]) + ' on ' + DI.fmtDate(st.seen.at) + '. It will be flagged <b>Built but removed from design</b> and sent to the office.</span></div>';
      h += '<button class="btn rev mt16" data-act="de-save">' + esc(action === 'remove' ? 'Remove in rev ' + (src.rev || '—') : action === 'move' ? 'Move in rev ' + (src.rev || '—') : 'Change in rev ' + (src.rev || '—')) + '</button><button class="btn mt8" data-act="close">Cancel</button>';
      ov.querySelector('.body').innerHTML = h;
      bindSource(ov, src);
      // Keep the revision in the tag and the button in step without re-rendering mid-tap.
      ov.querySelectorAll('[data-src=rev]').forEach(i => i.addEventListener('input', () => {
        const r = src.rev || '__';
        const tag = ov.querySelector('.body > .chip.rev'); if (tag) tag.textContent = title + ' Δ ' + r;
        const btn = ov.querySelector('[data-act=de-save]'); if (btn) btn.textContent = btn.textContent.replace(/rev .*$/, 'rev ' + (src.rev || '—'));
      }));
      const c = ov.querySelector('#deCh'); if (c) c.addEventListener('input', e => { d.ch = e.target.value; });
      const w = ov.querySelector('#deWhat'); if (w) w.addEventListener('input', e => { d.what = e.target.value; });
    };
    ov.src = src;
    ov.redraw = draw;
    ov.de = {
      save() {
        if (!src.drawing || !src.rev) { DA.toast({ title: 'No source, no design change', sub: 'Name the drawing and revision that says so' }); return; }
        let summary = '';
        if (action === 'move') {
          const nc = DI.parseCh(d.ch);
          if (isNaN(nc)) { DA.toast({ title: 'Type the new chainage', sub: 'As written on the revised sheet' }); return; }
          summary = 'Moved to ' + DI.fmtCh(nc, 3) + ' · ' + Math.abs(nc - f.ch0).toFixed(1) + ' m ' + (nc > f.ch0 ? 'up' : 'down') + ' the line';
          d.newCh = nc;
        }
        if (action === 'retype') { if (!d.what) { DA.toast({ title: 'Say what it changed to' }); return; } summary = f.name + ' → ' + d.what; }
        if (action === 'remove') summary = 'Removed';
        DI.addRecord({ kind: 'design', action, featureId: fid, source: Object.assign({}, src), summary, newCh: d.newCh, newType: d.what, status: 'pending', line: f.line, sub: f.sub, ch: f.ch0 });
        if (action === 'remove' && st.seen && st.s > 0) DI.addRecord({ kind: 'query', featureId: fid, title: 'Built but removed from design', note: 'Seen ' + f.ladder[st.s] + ' on ' + DI.fmtDate(st.seen.at, true) + '; removed in ' + src.drawing + ' rev ' + src.rev, line: f.line, sub: f.sub, ch: f.ch0 });
        DA.closeAll();
        DA.toast({ title: 'Design change saved · pending', sub: src.drawing + ' rev ' + src.rev + ' · the office confirms' });
        DA.render();
      }
    };
    draw();
  }
  A['design-edit'] = b => { DA.closeAll(); openDesignEdit(b.dataset.id, b.dataset.v); };
  A['src-kind'] = (b, ov) => { ov.src.kind = b.dataset.v; ov.redraw(); };
  A['src-level'] = (b, ov) => { ov.src.level = b.dataset.v; ov.redraw(); };
  A['de-save'] = (b, ov) => ov.de.save();

  // Add to the design, three steps
  const ADD_KINDS = [['toe', 'Toe ditch', 'trap', 'toe'], ['side', 'Side ditch', 'trap', 'plat'], ['descent', 'Water descent', 'descent', 'face'], ['cross', 'Culvert', 'pipe', 'across'], ['riprap', 'Riprap', 'riprap', 'face'], ['diversion', 'Diversion', 'divert', 'off']];
  function openAddDesign() {
    const src = { kind: 'revision', drawing: '', rev: '', level: 'A' };
    const d = { kind: 'toe', side: 'R', ch0: DI.fmtCh(S.pos.ch), ch1: DI.fmtCh(S.pos.ch + 100), type: '', how: 'exact' };
    const ov = DA.openOverlay('', 'full');
    const draw = () => {
      let h = topbar('Add to the design', { x: true, right: '<span class="tag">3 steps</span>' }) + '<div class="scroll"><div class="pad">';
      h += '<div class="lbl-caps" style="margin:20px 0 0">1 · What says so</div>' + sourceBlock(src).replace('<div class="lbl-caps" style="margin:20px 0 10px;color:var(--rev)">Source · required</div>', '<div style="height:10px"></div>');
      h += '<div class="lbl-caps" style="margin:22px 0 10px">2 · What is it</div><div class="grid2">' + ADD_KINDS.map(([k, n, ic]) => '<button class="pick' + (d.kind === k ? ' on' : '') + '" data-act="ad-kind" data-v="' + k + '"><span style="display:flex;gap:10px;align-items:center">' + I.typeIcon(ic) + n + '</span></button>').join('') + '</div>';
      h += '<input class="inp mt12" id="adType" placeholder="Type and size, e.g. Type 12 · B 1.50 · H 0.50" value="' + esc(d.type) + '" style="font-family:var(--f-sans);font-size:18px">';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">3 · Where</div><div class="segm" style="grid-template-columns:repeat(3,1fr)">' + [['L', '◀ Left'], ['C', 'Centre'], ['R', 'Right ▶']].map(([k, n]) => '<button data-act="ad-side" data-v="' + k + '" class="' + (d.side === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
      h += '<div class="grid2 mt12"><div class="fld"><label>Start</label><input class="inp" id="adCh0" value="' + esc(d.ch0) + '"></div><div class="fld"><label>End</label><input class="inp" id="adCh1" value="' + esc(d.ch1) + '"></div></div>';
      h += '<div class="lbl-caps" style="margin:14px 0 10px">How exact is this position?</div>';
      [['exact', 'Quoted on the drawing', 'Numbers written on the sheet', '<span class="chip exact">Exact</span>'], ['derived', 'Scaled from the drawing', 'Read off the plan at 1:1000', '<span class="chip derived">±4 m</span>'], ['measured', 'Walked on site', 'Mark start and end where you stand', '<span class="chip measured">Measured · GPS</span>']].forEach(([k, n, s2, c]) => {
        h += '<button class="setrow' + (d.how === k ? ' sel' : '') + '" data-act="ad-how" data-v="' + k + '" style="border:2px solid var(--ink);margin-bottom:8px"><span style="display:flex;gap:12px;align-items:center"><span class="radio' + (d.how === k ? ' on' : '') + '"></span><span><b>' + n + '</b><small>' + s2 + '</small></span></span>' + c + '</button>';
      });
      h += '<button class="btn rev mt16" data-act="ad-save">Add to design</button><p class="note">Pending until the office confirms. It shows on your strip now, marked pending.</p><div style="height:30px"></div></div></div>';
      ov.firstChild.innerHTML = h;
      bindSource(ov, src);
      const bind = (id, k) => { const e = ov.querySelector(id); if (e) e.addEventListener('input', ev => { d[k] = ev.target.value; }); };
      bind('#adType', 'type'); bind('#adCh0', 'ch0'); bind('#adCh1', 'ch1');
    };
    ov.src = src; ov.redraw = draw;
    ov.ad = {
      set(k, v) { d[k] = v; draw(); },
      save() {
        if (!src.drawing || !src.rev) { DA.toast({ title: 'No source, no design change', sub: 'Name the drawing and revision' }); return; }
        const a = DI.parseCh(d.ch0), b = DI.parseCh(d.ch1);
        if (isNaN(a)) { DA.toast({ title: 'Give a start chainage' }); return; }
        const kind = ADD_KINDS.find(x => x[0] === d.kind);
        DI.addRecord({ kind: 'design', action: 'add', source: Object.assign({}, src), summary: kind[1] + (d.type ? ' · ' + d.type : '') + ' · ' + d.side + ' ' + DI.fmtCh(a) + (isNaN(b) ? '' : ' → ' + DI.fmtCh(b)), add: { kind: d.kind, lane: kind[3], side: d.side, ch0: a, ch1: isNaN(b) ? a : b, type: d.type, how: d.how }, status: 'pending', line: S.pos.line, sub: S.pos.sub, ch: a });
        DA.closeAll();
        DA.toast({ title: 'Added to the design · pending', sub: src.drawing + ' rev ' + src.rev });
        DA.render();
      }
    };
    draw();
  }
  A['add-design'] = () => { DA.closeAll(); openAddDesign(); };
  A['ad-kind'] = (b, ov) => ov.ad.set('kind', b.dataset.v);
  A['ad-side'] = (b, ov) => ov.ad.set('side', b.dataset.v);
  A['ad-how'] = (b, ov) => ov.ad.set('how', b.dataset.v);
  A['ad-save'] = (b, ov) => ov.ad.save();

  // Something built that no drawing shows
  function openUnlisted() {
    const d = { what: 'Water descent', ref: 'no', photos: [], note: '' };
    const ov = DA.openOverlay('', 'full');
    const p = DA.snapPos();
    const draw = () => {
      let h = topbar('Not on the drawings') + '<div class="scroll"><div style="display:flex;gap:14px;padding:16px;background:var(--surface);border-bottom:1px solid var(--rule)"><span class="badge" style="background:var(--hivis);color:#121311;border:2.5px solid #121311;width:52px;height:52px;font-size:30px">?</span><span style="font:500 18px/1.4 var(--f-sans)">Something is built here that no drawing on this phone shows.</span></div><div class="pad">';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">What is it</div><div class="grid2">' + ['Water descent', 'Ditch', 'Culvert / pipe', 'Riprap', 'Cascade', 'Something else'].map(x => '<button class="pick' + (d.what === x ? ' on' : '') + '" data-act="ul-what" data-v="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Where</div><div style="border:2.5px solid var(--ink);background:var(--surface);padding:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font:500 20px/1 var(--f-mono)">' + (p.side === 'L' || p.side === 'R' ? DA.sideBadge(p.side) : '') + DI.fmtCh(p.ch) + ' <span class="chip measured">' + (p.source === 'gps' ? 'Measured · GPS ±' + Math.round(p.acc) + ' m' : 'Set by hand') + '</span></div><div class="muted mt8">' + (p.source === 'gps' ? Math.abs(p.offset).toFixed(1) + ' m ' + (p.offset > 0 ? 'left' : 'right') + ' of CL · ' : '') + 'captured ' + DI.fmtTime(new Date().toISOString()) + '</div></div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Is it on another document?</div><div class="segm" style="grid-template-columns:repeat(3,1fr)">' + [['no', 'No'], ['unknown', 'Don’t know'], ['yes', 'Yes, add ref']].map(([k, n]) => '<button data-act="ul-ref" data-v="' + k + '" class="' + (d.ref === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
      h += '<div class="lbl-caps" style="margin:22px 0 10px">Evidence</div><div class="photos">' + d.photos.map((x, i) => DA.photoTile(x, i + 1)).join('') + '<button class="photo-add" data-act="ul-photo">' + I.icon('camera') + 'Photo</button></div>';
      h += '<textarea class="inp mt12" id="ulNote" rows="2" placeholder="Note' + (d.ref === 'yes' ? ' — include the document reference' : '') + '">' + esc(d.note) + '</textarea>';
      h += '<button class="btn primary center mt16" data-act="ul-save">Record as unlisted</button><p class="note">Shows on your strip and map as a yellow ? mark. It never enters the design unless a revision adds it.</p><div style="height:30px"></div></div></div>';
      ov.firstChild.innerHTML = h;
      ov.querySelector('#ulNote').addEventListener('input', e => { d.note = e.target.value; });
      DA.hydratePhotos(ov);
    };
    ov.ul = {
      set(k, v) { d[k] = v; draw(); },
      photo() { DA.takePhoto(m => { d.photos.push(m); draw(); }); },
      save() {
        const r = DI.addRecord({ kind: 'unlisted', what: d.what, ref: d.ref, note: d.note, photos: d.photos, line: p.line, sub: p.sub, ch: p.ch, side: p.side === 'L' || p.side === 'R' ? p.side : 'L', offset: p.offset, pos: p });
        DA.closeAll();
        DA.toast({ title: 'Unlisted item recorded', sub: d.what + ' · ' + DI.fmtCh(p.ch), undo: () => { DI.voidRecord(r.id); DA.render(); } });
        DA.render();
      }
    };
    draw();
  }
  A.unlisted = () => { DA.closeAll(); openUnlisted(); };
  A['ul-what'] = (b, ov) => ov.ul.set('what', b.dataset.v);
  A['ul-ref'] = (b, ov) => ov.ul.set('ref', b.dataset.v);
  A['ul-photo'] = (b, ov) => ov.ul.photo();
  A['ul-save'] = (b, ov) => ov.ul.save();

  // Changes near you (revision view)
  A.changes = () => {
    const list = DI.live(r => r.kind === 'design' && r.line === S.pos.line).sort((a, b) => Math.abs(a.ch - S.pos.ch) - Math.abs(b.ch - S.pos.ch)).slice(0, 20);
    let h = '<div style="font:700 30px/1 var(--f-cond);margin-bottom:6px">Design changes · ' + list.length + '</div><p class="note" style="margin-top:0">Pending until the office confirms. Your field records are untouched.</p><div style="margin:0 -16px;border-top:3px solid var(--rev)">';
    list.forEach(r => {
      const f = DI.data.byId[r.featureId];
      h += '<button class="frow" ' + (f ? 'data-act="feature" data-id="' + esc(f.id) + '"' : '') + '><span class="chip rev">Δ ' + esc(r.source.rev) + '</span><div class="mid"><div class="t1"><span>' + esc(f ? f.name : r.summary) + '</span></div><div class="t2">' + DI.fmtCh(r.ch) + ' · ' + esc(r.summary || r.action) + '</div><div class="t3">' + esc(r.source.drawing) + ' rev ' + esc(r.source.rev) + ' · Level ' + esc(r.source.level) + ' · pending</div></div></button>';
    });
    DA.openOverlay(h + '</div>', 'sheet tall rev');
  };

  // ================================================================ MAP
  S.map = { ground: 'washed', corridor: true, chainage: true, drainage: true, claims: false, photos: false };
  let map = null, layer = null, lastKey = '';
  function renderMap(host) {
    if (!window.L) {
      host.innerHTML = '<div class="empty-state"><b>Map not on this phone yet</b>The map library downloads the first time there is signal. The strip works without it.</div>';
      return;
    }
    if (!map) {
      host.innerHTML = '<div class="mapbox washed" id="mapEl"></div><div class="map-date">' + I.icon('clock').replace('<svg', '<svg width="16" height="16"') + '<span id="mapGround">IMAGERY · WASHED</span></div>' +
        '<div class="map-tools"><button data-act="map-layers">' + I.icon('layers') + '</button><button data-act="map-north"><span style="font-size:20px;line-height:1">▲</span>N</button><button class="hv" data-act="map-me">' + I.icon('target') + '</button></div><div class="map-note">Imagery: Esri World Imagery · older than the works</div>';
      map = window.L.map(host.querySelector('#mapEl'), { zoomControl: false, attributionControl: false });
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }).addTo(map);
      layer = window.L.layerGroup().addTo(map);
      map.on('dragstart', () => { S.mapFollow = false; });
      S.mapFollow = true;
      map.setView([12.8, 8.4], 17);
    }
    const box = host.querySelector('.mapbox');
    box.classList.toggle('washed', S.map.ground === 'washed');
    box.classList.toggle('lines', S.map.ground === 'lines');
    host.querySelector('#mapGround').textContent = S.map.ground === 'lines' ? 'LINEWORK ONLY' : 'IMAGERY · ' + (S.map.ground === 'washed' ? 'WASHED' : 'FULL');
    setTimeout(() => map.invalidateSize(), 0);
    const p = S.pos;
    const sub = p.sub && DI.data.centre[p.sub] ? p.sub : null;
    if (!sub) return;
    const key = [sub, Math.round(p.ch / 20), JSON.stringify(S.map), DI.records.length, p.tier, Math.round(p.offset)].join('|');
    const here = DI.pointAt(sub, p.ch, p.source === 'gps' ? p.offset : 0);
    if (S.mapFollow) map.setView([here.lat, here.lon], map.getZoom() < 15 ? 17 : map.getZoom(), { animate: false });
    if (key === lastKey) return;
    lastKey = key;
    layer.clearLayers();
    const L = window.L;
    const a = p.ch - 600, b = p.ch + 600;
    const line = (off, ch0, ch1, step) => { const out = []; for (let c = ch0; c <= ch1; c += step || 10) { const q = DI.pointAt(sub, c, off); if (q) out.push([q.lat, q.lon]); } return out; };
    const cl = line(0, a, b, 10);
    L.polyline(cl, { color: '#fff', weight: 9, opacity: 1 }).addTo(layer);
    L.polyline(cl, { color: '#121311', weight: 4 }).addTo(layer);
    if (S.map.corridor) [-22, 22].forEach(o => { const pl = line(o, a, b, 10); L.polyline(pl, { color: '#fff', weight: 4 }).addTo(layer); L.polyline(pl, { color: '#121311', weight: 1.5, dashArray: '6 5' }).addTo(layer); });
    if (S.map.chainage) for (let c = Math.ceil(a / 100) * 100; c <= b; c += 100) {
      const q = DI.pointAt(sub, c, -26), q0 = DI.pointAt(sub, c, -16), q1 = DI.pointAt(sub, c, 16);
      L.polyline([[q0.lat, q0.lon], [q1.lat, q1.lon]], { color: '#121311', weight: 2 }).addTo(layer);
      L.marker([q.lat, q.lon], { icon: L.divIcon({ className: '', html: '<span class="map-lbl">' + DI.fmtCh(c) + '</span>', iconAnchor: [0, 10] }) }).addTo(layer);
    }
    if (S.map.drainage) DI.featuresNear(p.line, a, b).forEach(f => {
      const st = DI.statusOf(f);
      const fill = st.fill === 'solid' ? '#121311' : st.fill === 'hatch' ? '#8C8E86' : '#fff';
      const off = f.offset * 1.4;
      if (f.kind === 'cross') {
        const q0 = DI.pointAt(sub, f.ch0, 20), q1 = DI.pointAt(sub, f.ch0, -20);
        L.polyline([[q0.lat, q0.lon], [q1.lat, q1.lon]], { color: '#fff', weight: 11 }).addTo(layer);
        L.polyline([[q0.lat, q0.lon], [q1.lat, q1.lon]], { color: '#121311', weight: 7 }).addTo(layer).on('click', () => DA.openRecord(f.id));
        const ql = DI.pointAt(sub, f.ch0, -30);
        if (S.map.chainage) L.marker([ql.lat, ql.lon], { icon: L.divIcon({ className: '', html: '<span class="map-lbl exact">' + DI.fmtCh(f.ch0, f.cert === 'exact' ? 3 : 0) + '</span>', iconAnchor: [0, 10] }) }).addTo(layer);
      } else if (f.kind === 'linear' || f.kind === 'buried') {
        const pl = line(off, Math.max(a, f.ch0), Math.min(b, f.ch1), 5);
        if (pl.length > 1) {
          L.polyline(pl, { color: '#fff', weight: 7 }).addTo(layer);
          L.polyline(pl, { color: '#121311', weight: 3.5, dashArray: st.fill === 'never' || f.kind === 'buried' ? '5 4' : st.fill === 'hatch' ? '2 3' : null }).addTo(layer).on('click', () => DA.openRecord(f.id));
        }
      } else {
        const q = DI.pointAt(sub, f.ch0, off);
        const html = f.kind === 'label' ? '<div style="width:16px;height:16px;border-radius:50%;border:2px dashed #121311;background:rgba(255,255,255,0.8)"></div>' : '<div style="width:14px;height:14px;background:' + fill + ';border:2px solid #121311;outline:2px solid #fff"></div>';
        L.marker([q.lat, q.lon], { icon: L.divIcon({ className: '', html, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(layer).on('click', () => DA.openRecord(f.id));
      }
      if (st.defects.length) { const q = DI.pointAt(sub, f.ch0, off + 6); L.marker([q.lat, q.lon], { icon: L.divIcon({ className: '', html: '<span style="color:#B3141A;font:700 18px/1 sans-serif;text-shadow:0 0 2px #fff">⚠</span>', iconAnchor: [6, 10] }) }).addTo(layer); }
    });
    if (S.map.photos) DI.live(r => r.photos && r.photos.length).forEach(r => r.photos.forEach(ph => { if (ph.fix && ph.fix.lat != null) L.circleMarker([ph.fix.lat, ph.fix.lon], { radius: 5, color: '#121311', weight: 2, fillColor: '#FFD100', fillOpacity: 1 }).addTo(layer); }));
    if (p.tier === 'poor') L.circle([here.lat, here.lon], { radius: p.acc, color: '#121311', weight: 2, dashArray: '6 4', fillColor: '#FFD100', fillOpacity: 0.25 }).addTo(layer);
    else L.marker([here.lat, here.lon], { icon: L.divIcon({ className: '', html: '<div style="width:24px;height:24px;border-radius:50%;background:#FFD100;border:4px solid #121311"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 1000 }).addTo(layer);
  }
  DA.renderMap = renderMap;
  A['map-me'] = () => { S.mapFollow = true; lastKey = ''; DA.render(); };
  A['map-north'] = () => { if (map) map.setView(map.getCenter(), map.getZoom()); };
  A['map-layers'] = () => {
    const draw = () => {
      let h = '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 0 12px;border-bottom:2px solid var(--ink);margin:0 -16px;padding:0 16px 12px"><span style="font:700 34px/1 var(--f-cond)">Map layers</span><button data-act="close">' + I.icon('close').replace('<svg', '<svg width="30" height="30"') + '</button></div><div class="lbl-caps" style="margin:16px 0 8px">Ground</div><div style="margin:0 -16px">';
      [['lines', 'Linework only', 'Clearest in full sun. Least battery.'], ['washed', 'Imagery, washed', 'Default. The drawing stays on top.'], ['full', 'Imagery, full', 'For streams, tracks and settlements.']].forEach(([k, n, s2]) => {
        h += '<button class="setrow' + (S.map.ground === k ? ' sel' : '') + '" data-act="ml-ground" data-v="' + k + '"><span style="display:flex;gap:14px;align-items:center"><span class="radio' + (S.map.ground === k ? ' on' : '') + '"></span><span><b>' + n + '</b><small>' + s2 + '</small></span></span></button>';
      });
      h += '</div><div style="border:2.5px solid var(--ink);padding:14px;margin:14px 0"><b style="font:700 19px/1.2 var(--f-sans)">Imagery on this phone</b><div class="mono muted" style="font-size:14px;margin-top:6px">Tiles are kept after you have viewed them, so ground you have looked at with signal stays available offline.</div><div style="font:700 15px/1.3 var(--f-sans);margin-top:8px">Older than the works: for ground, never for progress.</div></div><div class="lbl-caps" style="margin:6px 0 8px">On the map</div><div style="margin:0 -16px">';
      [['corridor', 'Corridor and earthworks line', ''], ['chainage', 'Chainage every 100 m', ''], ['drainage', 'Drainage, by stage', ''], ['photos', 'Where photos were taken', 'Raw GPS fix, not the snapped chainage']].forEach(([k, n, s2]) => {
        h += '<button class="setrow" data-act="ml-tog" data-v="' + k + '"><span><b>' + n + '</b>' + (s2 ? '<small>' + s2 + '</small>' : '') + '</span><span class="tog' + (S.map[k] ? ' on' : '') + '"></span></button>';
      });
      h += '</div><div class="lbl-caps" style="margin:16px 0 8px">Alignment source</div><div class="mono" style="font-size:14px;line-height:1.6">SECTION 02.kmz / SECTION 03.kmz · drawn centreline<br>Chainage measured along the line, checked against the station labels</div>';
      return h;
    };
    const ov = DA.openOverlay(draw(), 'sheet tall');
    ov.refresh = () => { ov.querySelector('.body').innerHTML = draw(); };
  };
  A['ml-ground'] = (b, ov) => { S.map.ground = b.dataset.v; ov.refresh(); lastKey = ''; DA.render(); };
  A['ml-tog'] = (b, ov) => { S.map[b.dataset.v] = !S.map[b.dataset.v]; ov.refresh(); lastKey = ''; DA.render(); };
})();
