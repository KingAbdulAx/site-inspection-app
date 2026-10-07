/*
 * Drainage Inspector — correcting the base data.
 * The extraction from the drawings is not perfect. This is the third kind of
 * change, beside a field finding and a design revision: "the drawing was
 * read wrong". It edits the base the app is built on, needs no revision, and
 * raises no query. Every correction is a record you can undo, export, and
 * bake into data/ with scripts/apply_base_corrections.js.
 */
(function () {
  'use strict';
  const DI = window.DI, I = window.DIcons, DA = window.DA, S = DA.S;
  const esc = DI.esc;
  const A = DA.actions;

  const GROUPS = [
    ['Toe ditch', ['T4', 'T7', 'T12', 'T13', 'T14']],
    ['Side / platform ditch', ['T1', 'T1L', 'T3', 'T10', 'T15', 'T2', 'T9']],
    ['Face, crest and berm', ['T8', 'T5', 'T11', 'WD', 'RIP']],
    ['Crossing the track', ['BC', 'PC', 'T16', 'UP', 'CC', 'BRG', 'OP']],
    ['Off alignment', ['CH-A', 'CH-B', 'CH-C', 'CH-R']],
    ['Dissipators and other', ['D-SOZ', 'D-SD', 'D-TC', 'D-ST', 'D-RF', 'T6', 'MD']]
  ];
  const LANES = [['plat', 'Platform'], ['face', 'Face'], ['toe', 'Toe'], ['crest', 'Crest'], ['off', 'Off']];
  const CERTS = [['exact', 'Quoted on the drawing', 'Numbers written on the sheet', '<span class="chip exact">Exact</span>'],
    ['derived', 'Scaled from the plan', 'Read off the plan, good to about 4 m', '<span class="chip derived">±4 m</span>'],
    ['label', 'Where the note sits', 'A callout, not an extent', '<span class="chip label">Label</span>'],
    ['measured', 'Measured on site', 'GPS or tape, where you stand', '<span class="chip measured">Measured</span>']];

  function recLabel(r) {
    if (r.kind !== 'base') return null;
    return { edit: 'Data corrected', add: 'Added to the data', delete: 'Removed from the data', verify: 'Checked against the drawing', unverify: 'Check withdrawn' }[r.action] || 'Data';
  }
  DA.recLabel = recLabel;

  // The strip under the feature title: checked or not, corrected or not.
  DA.baseStrip = function (f) {
    let h = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px">';
    if (f.verified) h += '<button class="chip" data-act="base-unverify" data-id="' + esc(f.id) + '" style="height:32px;background:var(--ink);color:var(--on-ink);gap:6px">' + I.icon('check').replace('<svg', '<svg width="16" height="16"') + 'Checked · ' + esc(f.verified.sheet || 'drawing') + ' · ' + DI.fmtDate(f.verified.at) + '</button>';
    else h += '<button class="chip" data-act="base-verify" data-id="' + esc(f.id) + '" style="height:32px;border:2px dashed var(--ink);gap:6px">' + I.icon('check').replace('<svg', '<svg width="16" height="16"') + 'Mark checked against the drawing</button>';
    if (f.corrected) h += '<span class="chip" style="height:32px;border:2px solid var(--ink)">Corrected · ' + DI.fmtDate(f.lastCorrected || '') + '</span>';
    if (f.added) h += '<span class="chip" style="height:32px;border:2px solid var(--ink)">Added by hand</span>';
    h += '<button class="chip" data-act="base-edit" data-id="' + esc(f.id) + '" style="height:32px;border:2px solid var(--ink);gap:6px;margin-left:auto">' + I.icon('edit').replace('<svg', '<svg width="16" height="16"') + 'Correct the data</button></div>';
    return h;
  };
  DA.baseDeletedBanner = function (f) {
    if (!f.deleted) return '';
    const r = DI.live(x => x.kind === 'base' && x.action === 'delete' && x.featureId === f.id).pop();
    return '<div class="banner" style="background:var(--ink-2)">' + I.icon('x') + '<div><b>Removed from the data</b><span>' + esc(f.deleted.note || 'extraction error') + ' · ' + DI.fmtDate(f.deleted.at) + '</span></div>' +
      (r ? '<button data-act="base-undo" data-id="' + esc(r.id) + '" style="margin-left:auto;background:#fff;color:#121311;padding:8px 12px;font:700 16px/1 var(--f-sans)">Undo</button>' : '') + '</div>';
  };
  DA.baseDoor = function (fid) {
    return '<div class="door" style="border-color:var(--ink-2)"><div class="dh" style="background:var(--surface);color:var(--ink)"><b>The data is wrong</b><span>The drawing was read wrong when it was extracted. Fixes the base; no revision, no query.</span></div>' +
      '<button data-act="base-edit" data-id="' + esc(fid) + '">' + I.icon('edit') + 'Correct position, side, type or size' + I.icon('chev', 'chev') + '</button>' +
      '<button data-act="base-del" data-id="' + esc(fid) + '">' + I.icon('x') + 'Not a real feature — remove from the data' + I.icon('chev', 'chev') + '</button></div>';
  };

  // ---------------------------------------------------------------- form
  function openBaseForm(opts) {
    const f = opts.fid ? DI.data.byId[opts.fid] : null;
    const sub = f ? f.sub : (opts.sub || S.pos.sub || 'KZDR');
    const presetKey = f ? (DI.presetOf(f) || '') : (opts.preset || 'T12');
    const hereCh = () => Math.round(S.pos.ch * (S.pos.source === 'gps' && S.pos.tier === 'good' ? 10 : 1)) / (S.pos.source === 'gps' && S.pos.tier === 'good' ? 10 : 1);
    const orig = f ? { preset: presetKey, name: f.name, side: f.side, lane: f.lane, ch0: f.ch0, ch1: f.ch1, offsetM: f.offsetM != null ? f.offsetM : '', cert: f.cert, sheet: f.sheet || '', level: f.level || '', stated: f.stated != null ? f.stated : '' } : null;
    const d = orig ? Object.assign({}, orig) : { preset: presetKey, name: '', side: opts.side || 'L', lane: DI.PRESETS[presetKey].lane, ch0: opts.ch != null ? opts.ch : hereCh(), ch1: (opts.ch != null ? opts.ch : hereCh()) + 50, offsetM: '', cert: 'derived', sheet: opts.sheet || '', level: '', stated: '' };
    d.ch0s = DI.fmtCh(d.ch0, d.cert === 'exact' ? 3 : 0); d.ch1s = DI.fmtCh(d.ch1, d.cert === 'exact' ? 3 : 0);
    d.note = ''; d.check = true; // correcting it against the sheet is checking it
    const ov = DA.openOverlay('', 'full');
    const draw = () => {
      const p = DI.PRESETS[d.preset] || DI.PRESETS.T12;
      const linear = p.kind === 'linear' || p.kind === 'buried';
      let h = '<div class="topbar"><button class="ib" data-act="close">' + I.icon('close') + '</button><div class="t">' + (f ? 'Correct the data' : 'Missing from the data') + '</div><div class="right"><span class="tag">' + esc(sub) + '</span></div></div><div class="scroll">';
      if (f) h += '<div class="fhead" style="padding:14px 16px;background:var(--surface);border-bottom:1px solid var(--rule)">' + DA.sideBadge(f.side, 'xl') + '<div style="min-width:0"><div class="t1">' + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + ' ' + DA.certChip(f) + '</div><div class="muted" style="font-size:14px;margin-top:4px">as extracted' + (f.corrected ? ', with corrections' : '') + '</div></div></div>';
      h += '<div class="pad"><p class="note" style="margin:14px 0 0">Fixes how the drawing was read. Not a design revision, not a field query. You can undo it, and it exports with the data.</p>';
      h += '<div class="lbl-caps" style="margin:20px 0 8px">What it is</div><select class="inp" id="bfPreset" style="font:600 18px/1 var(--f-sans)">';
      GROUPS.forEach(([g, keys]) => { h += '<optgroup label="' + esc(g) + '">' + keys.map(k => '<option value="' + k + '"' + (d.preset === k ? ' selected' : '') + '>' + esc(DI.PRESETS[k].name) + (DI.PRESETS[k].code ? ' · ' + DI.PRESETS[k].code : '') + '</option>').join('') + '</optgroup>'; });
      if (!d.preset) h += '<option value="" selected>Keep as extracted</option>';
      h += '</select><input class="inp mt8" id="bfName" placeholder="Name as on the sheet, e.g. Pipe culvert Ø1.2 m" value="' + esc(d.name) + '" style="font:500 18px/1 var(--f-sans)">';
      h += '<div class="lbl-caps" style="margin:20px 0 8px">Side</div><div class="segm" style="grid-template-columns:repeat(3,1fr)">' + [['L', '◀ Left'], ['C', 'Centre'], ['R', 'Right ▶']].map(([k, n]) => '<button data-act="bf-set" data-k="side" data-v="' + k + '" class="' + (d.side === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
      if (p.lane !== 'across' && p.lane !== 'cl') h += '<div class="lbl-caps" style="margin:16px 0 8px">Lane</div><div class="segm" style="grid-template-columns:repeat(5,1fr)">' + LANES.map(([k, n]) => '<button data-act="bf-set" data-k="lane" data-v="' + k + '" class="' + (d.lane === k ? 'on' : '') + '" style="font-size:15px">' + n + '</button>').join('') + '</div>';
      h += '<div class="lbl-caps" style="margin:20px 0 8px">Where</div><div class="grid2"><div class="fld"><label>' + (linear ? 'Start' : 'Chainage') + '</label><input class="inp" id="bfCh0" value="' + esc(d.ch0s) + '" inputmode="decimal"><button class="linkbtn mt8" style="color:var(--ink)" data-act="bf-here" data-k="ch0s">Where I stand</button></div>' +
        (linear ? '<div class="fld"><label>End</label><input class="inp" id="bfCh1" value="' + esc(d.ch1s) + '" inputmode="decimal"><button class="linkbtn mt8" style="color:var(--ink)" data-act="bf-here" data-k="ch1s">Where I stand</button></div>' : '<div></div>') + '</div>';
      if (p.lane !== 'across') h += '<div class="fld"><label>Offset from centreline, m (from the cross-section or measured; leave blank for the lane’s typical)</label><div style="display:flex;gap:8px"><input class="inp" id="bfOff" value="' + esc(d.offsetM) + '" inputmode="decimal" placeholder="' + (DI.LANE_OFFSET[d.lane] || '') + '"><button class="btn" data-act="bf-here" data-k="offsetM" style="width:auto;white-space:nowrap">Here</button></div></div>';
      if (p.kind === 'label') h += '<div class="fld"><label>Stated length on the sheet, m</label><input class="inp" id="bfStated" value="' + esc(d.stated) + '" inputmode="decimal"></div>';
      h += '<div class="lbl-caps" style="margin:14px 0 8px">How exact is this position?</div>';
      CERTS.forEach(([k, n, s2, c]) => { h += '<button class="setrow' + (d.cert === k ? ' sel' : '') + '" data-act="bf-set" data-k="cert" data-v="' + k + '" style="border:2px solid var(--ink);margin-bottom:6px"><span style="display:flex;gap:12px;align-items:center"><span class="radio' + (d.cert === k ? ' on' : '') + '"></span><span><b>' + n + '</b><small>' + s2 + '</small></span></span>' + c + '</button>'; });
      h += '<div class="lbl-caps" style="margin:20px 0 8px">Source</div><div class="grid2" style="grid-template-columns:1.6fr 1fr"><div class="fld"><label>Sheet</label><input class="inp" id="bfSheet" value="' + esc(d.sheet) + '" placeholder="DW-03021-06"></div><div class="fld"><label>Level</label><div class="segm" style="grid-template-columns:repeat(4,1fr)">' + [['', '—'], ['A', 'A'], ['B', 'B'], ['C', 'C']].map(([k, n]) => '<button data-act="bf-set" data-k="level" data-v="' + k + '" class="' + (d.level === k ? 'on' : '') + '" style="padding:0">' + n + '</button>').join('') + '</div></div></div>';
      h += '<button class="setrow" data-act="bf-check" style="border:2.5px solid var(--ink);margin-top:6px"><span><b>Checked against the drawing</b><small>Ticks it off in Check against drawings</small></span><span class="tog' + (d.check ? ' on' : '') + '"></span></button>';
      h += '<textarea class="inp mt12" id="bfNote" rows="2" placeholder="What was wrong (optional)">' + esc(d.note) + '</textarea>';
      h += '<button class="btn primary center mt16" data-act="bf-save">' + (f ? 'Save correction' : 'Add to the data') + '</button>';
      if (f) h += '<button class="btn defect mt8" data-act="base-del" data-id="' + esc(f.id) + '">' + I.icon('x') + 'Not a real feature — remove</button>';
      h += '<div style="height:40px"></div></div></div>';
      const sc = ov.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
      ov.firstChild.innerHTML = h;
      const sc2 = ov.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
      const bind = (id, k) => { const e = ov.querySelector(id); if (e) e.addEventListener('input', ev => { d[k] = ev.target.value; }); };
      bind('#bfName', 'name'); bind('#bfCh0', 'ch0s'); bind('#bfCh1', 'ch1s'); bind('#bfOff', 'offsetM'); bind('#bfStated', 'stated'); bind('#bfSheet', 'sheet'); bind('#bfNote', 'note');
      ov.querySelector('#bfPreset').addEventListener('change', e => { d.preset = e.target.value; const q = DI.PRESETS[d.preset]; if (q) { d.lane = q.lane; if (q.kind === 'cross') d.cert = 'exact'; if (q.kind === 'label') d.cert = 'label'; d.name = q.name; } draw(); });
    };
    ov.bf = {
      set(k, v) { d[k] = v; draw(); },
      here(k) {
        if (k === 'offsetM') { if (S.pos.source !== 'gps') { DA.toast({ title: 'No GPS offset', sub: 'Type it from the cross-section instead' }); return; } d.offsetM = Math.abs(S.pos.offset).toFixed(1); d.side = S.pos.offset > 0 ? 'L' : 'R'; }
        else d[k] = DI.fmtCh(hereCh(), S.pos.source === 'gps' && S.pos.tier === 'good' ? 1 : 0);
        if (S.pos.source === 'gps' && k !== 'offsetM') d.cert = d.cert === 'exact' ? 'exact' : 'measured';
        draw();
      },
      check() { d.check = !d.check; draw(); },
      save() {
        const ch0 = DI.parseCh(d.ch0s), ch1 = DI.parseCh(d.ch1s);
        if (isNaN(ch0)) { DA.toast({ title: 'Chainage not understood', sub: 'Type it like 111+017.229' }); return; }
        const q = DI.PRESETS[d.preset];
        const linear = q ? (q.kind === 'linear' || q.kind === 'buried') : (f && (f.kind === 'linear' || f.kind === 'buried'));
        if (linear && isNaN(ch1)) { DA.toast({ title: 'End chainage not understood' }); return; }
        const next = { preset: d.preset, name: d.name.trim(), side: d.side, lane: d.lane, ch0, ch1: linear ? ch1 : ch0, offsetM: d.offsetM === '' ? '' : Number(d.offsetM), cert: d.cert, sheet: d.sheet.trim(), level: d.level, stated: d.stated === '' ? '' : Number(d.stated) };
        const set = {};
        Object.keys(next).forEach(k => {
          const was = orig ? orig[k] : undefined;
          const same = typeof next[k] === 'number' && typeof was === 'number' ? Math.abs(next[k] - was) < 0.0005 : String(next[k]) === String(was == null ? '' : was);
          if (!orig || !same) set[k] = next[k];
        });
        if (set.preset === '' ) delete set.preset;
        if (set.name === '') delete set.name;
        if (set.offsetM === '') set.offsetM = orig && orig.offsetM !== '' ? null : undefined;
        if (set.stated === '') delete set.stated;
        if (set.level === '' && !orig) delete set.level;
        Object.keys(set).forEach(k => { if (set[k] === undefined) delete set[k]; });
        let r = null, fid = f && f.id;
        if (f && Object.keys(set).length) r = DI.correctBase(f.id, set, d.note.trim());
        if (!f) { r = DI.addBase(sub, set, d.note.trim()); fid = r.featureId; }
        const nf = DI.data.byId[fid];
        let v = null;
        if (d.check && nf && !nf.verified) v = DI.verifyBase(fid, set.sheet || nf.sheet);
        if (!d.check && nf && nf.verified) v = DI.unverifyBase(fid);
        DA.closeOverlay();
        if (!r && !v) { DA.toast({ title: 'Nothing changed' }); return; }
        const ids = [r, v].filter(Boolean).map(x => x.id);
        DA.toast({ title: f ? 'Data corrected' : 'Added to the data', sub: (nf ? nf.name + ' · ' + DA.chText(nf) : ''), undo: () => { ids.reverse().forEach(id => DI.voidRecord(id)); DA.render(); } });
        DA.render();
      }
    };
    draw();
  }
  DA.openBaseForm = openBaseForm;
  const fromSheet = b => { if (b.closest('.sheet')) DA.closeOverlay(); };
  A['base-edit'] = b => { fromSheet(b); openBaseForm({ fid: b.dataset.id }); };
  A['base-add'] = b => fromSheet(b) || openBaseForm({ sub: b.dataset.sub, sheet: b.dataset.sheet, ch: b.dataset.ch != null ? Number(b.dataset.ch) : undefined });
  A['bf-set'] = (b, ov) => ov.bf.set(b.dataset.k, b.dataset.v);
  A['bf-here'] = (b, ov) => ov.bf.here(b.dataset.k);
  A['bf-check'] = (b, ov) => ov.bf.check();
  A['bf-save'] = (b, ov) => ov.bf.save();

  A['base-del'] = b => {
    if (b.closest('.sheet')) DA.closeOverlay();
    const f = DI.data.byId[b.dataset.id];
    const reasons = ['Duplicate of another feature', 'Not on the drawing — misread', 'Symbol misread, really something else', 'Outside this sub-section'];
    let h = '<div style="font:700 30px/1.05 var(--f-cond);margin-bottom:6px">Remove from the data?</div><p class="note" style="margin-top:0">For extraction errors only. If the design itself changed, use “The drawing has changed” instead. Records you made on it are kept, and you can undo.</p>' +
      '<div class="fhead" style="margin:10px 0 16px">' + DA.sideBadge(f.side) + '<div><div class="t1"><span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chText(f) + '</div></div></div>' +
      reasons.map(x => '<button class="opt" data-act="base-del-go" data-id="' + esc(f.id) + '" data-v="' + esc(x) + '" style="min-height:56px"><span><b style="font:700 19px/1.2 var(--f-sans)">' + esc(x) + '</b></span>' + I.icon('chev') + '</button>').join('');
    DA.openOverlay(h, 'sheet tall');
  };
  A['base-del-go'] = b => {
    const f = DI.data.byId[b.dataset.id];
    const r = DI.deleteBase(f.id, b.dataset.v);
    DA.closeAll();
    DA.toast({ title: 'Removed from the data', sub: f.name + ' · ' + b.dataset.v, undo: () => { DI.voidRecord(r.id); DA.render(); } });
    DA.render();
  };
  A['base-verify'] = b => { const f = DI.data.byId[b.dataset.id]; const r = DI.verifyBase(f.id, f.sheet); DA.toast({ title: 'Checked against ' + (f.sheet || 'the drawing'), sub: f.name, undo: () => { DI.voidRecord(r.id); DA.render(); } }); DA.render(); };
  A['base-unverify'] = b => { if (confirm('Withdraw the “checked” mark?')) { DI.unverifyBase(b.dataset.id); DA.render(); } };
  A['base-undo'] = b => { DI.voidRecord(b.dataset.id); DA.render(); };

  // ------------------------------------------------ check against drawings
  // Desk workflow: open the PDF sheet beside the phone, go down its list,
  // tick what is right and correct what is not.
  // Group by sheet number, so DW-03003 and DW-03003-05 are one sheet.
  function sheetKey(f) { const m = String(f.sheet || '').match(/DW-\d{5}/); return m ? m[0] : (f.sheet || 'No sheet'); }
  function openCheck(sub) {
    const ov = DA.openOverlay('', 'full');
    let open = null, onlyUnchecked = false;
    const draw = () => {
      const all = (DI.data.bySub[sub] || []);
      const groups = {};
      all.forEach(f => { (groups[sheetKey(f)] = groups[sheetKey(f)] || []).push(f); });
      const keys = Object.keys(groups).sort((a, b) => groups[a][0].ch0 - groups[b][0].ch0);
      const done = all.filter(f => f.verified).length;
      let h = '<div class="topbar"><button class="ib" data-act="' + (open ? 'chk-back' : 'close') + '">' + I.icon('back') + '</button><div class="t">' + (open ? esc(open) : 'Check against drawings') + '</div><div class="right"><span class="tag">' + sub + '</span></div></div><div class="scroll">';
      if (!open) {
        h += '<div class="pad mt16"><p class="big-stat" style="font-size:36px">' + done + ' of ' + all.length + ' checked</p><div class="stack" style="height:18px"><i style="width:' + (done / Math.max(1, all.length) * 100) + '%;background:var(--ink)"></i></div><p class="note">Open a sheet here and the same sheet as a PDF beside it. Tick what is right; tap a row to correct it.</p></div><div style="border-top:3px solid var(--ink)">';
        keys.forEach(k => {
          const g = groups[k], c = g.filter(f => f.verified).length;
          const lo = Math.min(...g.map(f => f.ch0)), hi = Math.max(...g.map(f => f.ch1));
          h += '<button class="frow" data-act="chk-open" data-v="' + esc(k) + '"><div class="mid"><div class="t1"><span class="mono" style="font-size:18px">' + esc(k) + '</span></div><div class="t2">' + DI.fmtCh(lo) + ' → ' + DI.fmtCh(hi) + ' · ' + g.length + ' features</div></div><div class="right"><span class="st' + (c === g.length ? '' : ' never') + '">' + c + ' / ' + g.length + '</span><span class="meter"><i style="width:80px;background:linear-gradient(90deg,var(--ink) ' + (c / g.length * 100) + '%,transparent 0)"></i></span></div></button>';
        });
        h += '</div>';
      } else {
        const g = groups[open] || [];
        const list = onlyUnchecked ? g.filter(f => !f.verified) : g;
        const c = g.filter(f => f.verified).length;
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px"><b style="font:700 20px/1 var(--f-sans)">' + c + ' of ' + g.length + ' checked</b><button class="chip" data-act="chk-filter" style="height:34px;border:2px solid var(--ink)' + (onlyUnchecked ? ';background:var(--ink);color:var(--on-ink)' : '') + '">Only unchecked</button></div><div style="border-top:3px solid var(--ink)">';
        list.forEach(f => {
          h += '<div class="frow" style="gap:10px"><button data-act="chk-tick" data-id="' + esc(f.id) + '" aria-label="Checked" style="flex:none;width:48px;height:48px;border:2.5px solid var(--ink);display:flex;align-items:center;justify-content:center;background:' + (f.verified ? 'var(--ink);color:var(--on-ink)' : 'var(--surface)') + '">' + (f.verified ? I.icon('check').replace('<svg', '<svg width="28" height="28"') : '') + '</button>' +
            '<button class="mid" data-act="base-edit" data-id="' + esc(f.id) + '" style="text-align:left"><div class="t1">' + DA.sideBadge(f.side).replace('class="badge', 'style="width:28px;height:28px;font-size:16px" class="badge') + I.typeIcon(f.icon) + '<span>' + esc(f.name) + '</span></div><div class="t2">' + DA.chHtml(f) + ' ' + DA.certChip(f) + '</div><div class="t3">' + DA.offText(f) + (f.corrected ? ' · corrected' : '') + '</div></button>' +
            '<button data-act="feature" data-id="' + esc(f.id) + '" style="flex:none;width:36px;height:48px;display:flex;align-items:center;justify-content:center">' + I.icon('chev').replace('<svg', '<svg width="22" height="22"') + '</button></div>';
        });
        const lo = g.length ? Math.min(...g.map(f => f.ch0)) : S.pos.ch;
        h += '</div><div class="pad mt16"><button class="btn" data-act="base-add" data-sub="' + sub + '" data-sheet="' + esc(open === 'No sheet' ? '' : open) + '" data-ch="' + lo + '">' + I.icon('plus') + 'Missing from this sheet</button><button class="btn mt8" data-act="chk-all" ' + (c === g.length ? 'disabled' : '') + '>Mark all ' + (g.length - c) + ' remaining as checked</button></div>';
      }
      h += '<div style="height:40px"></div></div>';
      const sc = ov.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
      ov.firstChild.innerHTML = h;
      const sc2 = ov.querySelector('.scroll'); if (sc2 && open === ov.lastOpen) sc2.scrollTop = top;
      ov.lastOpen = open;
    };
    ov.refresh = draw;
    ov.chk = {
      open(k) { open = k; draw(); },
      back() { open = null; draw(); },
      filter() { onlyUnchecked = !onlyUnchecked; draw(); },
      tick(id) { const f = DI.data.byId[id]; if (f.verified) DI.unverifyBase(id); else DI.verifyBase(id, f.sheet); draw(); DA.render(); },
      all() {
        const g = (DI.data.bySub[sub] || []).filter(f => sheetKey(f) === open && !f.verified);
        if (!confirm('Mark ' + g.length + ' features on ' + open + ' as checked?')) return;
        const ids = g.map(f => DI.verifyBase(f.id, f.sheet).id);
        DA.toast({ title: g.length + ' marked checked', sub: open, undo: () => { ids.forEach(id => DI.voidRecord(id)); draw(); DA.render(); } });
        draw(); DA.render();
      }
    };
    draw();
  }
  A['check-sheets'] = b => openCheck(b.dataset.sub || S.pos.sub || 'KZDR');
  A['chk-open'] = (b, ov) => ov.chk.open(b.dataset.v);
  A['chk-back'] = (b, ov) => ov.chk.back();
  A['chk-filter'] = (b, ov) => ov.chk.filter();
  A['chk-tick'] = (b, ov) => ov.chk.tick(b.dataset.id);
  A['chk-all'] = (b, ov) => ov.chk.all();

  // ---------------------------------------------- project: base data panel
  DA.basePanel = function () {
    const recs = DI.baseRecords();
    const c = { edit: 0, add: 0, delete: 0, verify: 0 };
    recs.forEach(r => { if (c[r.action] != null) c[r.action]++; });
    let h = '<div style="border-top:3px solid var(--ink);margin-top:18px"><div class="section-h"><span class="lbl-caps">Base data</span><span class="muted" style="font:600 15px/1 var(--f-sans)">' + recs.length + ' change' + (recs.length === 1 ? '' : 's') + ' on this phone</span></div>';
    h += '<div class="pad" style="font:500 16px/1.5 var(--f-sans);color:var(--ink-2);margin-bottom:10px">' + c.edit + ' corrected · ' + c.add + ' added · ' + c.delete + ' removed · ' + c.verify + ' checked</div>';
    ['KNDW', 'DWKZ', 'KZDR', 'DRMR'].filter(DI.hasData).forEach(sb => {
      const all = DI.data.bySub[sb], done = all.filter(f => f.verified).length;
      h += '<button class="setrow" data-act="check-sheets" data-sub="' + sb + '"><span><b>Check ' + sb + ' against drawings</b><small>' + done + ' of ' + all.length + ' checked, sheet by sheet</small></span>' + I.icon('chev').replace('<svg', '<svg width="24" height="24"') + '</button>';
    });
    h += '<button class="setrow" data-act="base-list"><span><b>All corrections</b><small>Review or undo each one</small></span>' + I.icon('chev').replace('<svg', '<svg width="24" height="24"') + '</button>';
    h += '<button class="setrow" data-act="base-export"><span><b>Export corrections</b><small>A small file to keep, move to another phone, or bake into the app’s data</small></span>' + I.icon('download').replace('<svg', '<svg width="24" height="24"') + '</button>';
    h += '<button class="setrow" data-act="base-geo"><span><b>Export corrected data</b><small>GeoJSON per sub-section, for QGIS or the office</small></span>' + I.icon('download').replace('<svg', '<svg width="24" height="24"') + '</button>';
    h += '<button class="setrow" data-act="base-import"><span><b>Import corrections</b><small>From an export; nothing is duplicated</small></span>' + I.icon('plus').replace('<svg', '<svg width="24" height="24"') + '</button></div>';
    return h;
  };
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  A['base-export'] = () => { const x = DI.exportCorrections(); download('kmd-base-corrections-' + stamp() + '.json', JSON.stringify(x, null, 1)); DA.toast({ title: 'Corrections saved to this phone', sub: x.records.length + ' records' }); };
  A['base-geo'] = () => { ['KNDW', 'DWKZ', 'KZDR', 'DRMR'].filter(DI.hasData).forEach(sb => download(sb + '-corrected-' + stamp() + '.geojson', JSON.stringify(DI.exportGeo(sb)), 'application/geo+json')); DA.toast({ title: 'Corrected data saved', sub: 'One GeoJSON per sub-section' }); };
  A['base-import'] = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      file.text().then(t => {
        let x; try { x = JSON.parse(t); } catch (e) { DA.toast({ title: 'Not a corrections file' }); return; }
        if (!x || x.kind !== 'kmd-base-corrections') { DA.toast({ title: 'Not a corrections file' }); return; }
        const n = DI.importRecords(x.records);
        DA.toast({ title: n + ' correction record' + (n === 1 ? '' : 's') + ' imported', sub: 'Already-present ones skipped' });
        DA.render();
      });
    };
    inp.click();
  };
  A['base-list'] = () => {
    const recs = DI.baseRecords().sort((a, b) => a.at < b.at ? 1 : -1);
    let h = '<div style="font:700 30px/1 var(--f-cond);margin-bottom:10px">Corrections · ' + recs.length + '</div><div style="margin:0 -16px;border-top:3px solid var(--ink)">';
    if (!recs.length) h += '<div class="empty-state"><b>No corrections yet</b>Open a feature and tap “Correct the data”, or check a sheet against its drawing.</div>';
    recs.slice(0, 200).forEach(r => {
      const f = DI.data.byId[r.featureId];
      const what = Object.keys(r.set || {}).map(k => k + ' → ' + (k.startsWith('ch') ? DI.fmtCh(r.set[k], 3) : r.set[k])).join(', ');
      h += '<div class="frow"><span class="time">' + DI.fmtDate(r.at) + '<br>' + DI.fmtTime(r.at) + '</span><div class="mid"><div class="t1"><span>' + esc(recLabel(r)) + '</span></div><div class="t3">' + esc(f ? f.name + ' · ' + DA.chText(f) : r.featureId) + '</div>' + (what || r.note ? '<div class="t2" style="font-size:13.5px">' + esc([what, r.note].filter(Boolean).join(' · ')) + '</div>' : '') + '</div><button class="chip claim" data-act="base-undo-list" data-id="' + esc(r.id) + '" style="height:36px">Undo</button></div>';
    });
    DA.openOverlay(h + '</div>', 'sheet tall');
  };
  A['base-undo-list'] = b => { DI.voidRecord(b.dataset.id); DA.closeOverlay(); A['base-list'](); DA.render(); };
})();
