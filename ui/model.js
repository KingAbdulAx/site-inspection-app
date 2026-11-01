/*
 * Drainage Inspector — model
 * Lines, sub-sections, feature normalisation, the append-only record store,
 * contractor claims, and the linear-referencing position (line, chainage,
 * side, offset, trust). No DOM in here.
 */
(function () {
  'use strict';

  const INSPECTOR_KEY = 'KMD_INSPECTOR_NAME_V1';
  const RECORDS_KEY = 'KMD_WALK_RECORDS_V1';
  const DRAFTS_KEY = 'KMD_WALK_DRAFTS_V1';
  const POS_KEY = 'KMD_WALK_LAST_POSITION_V1';
  const LEGACY_KEYS = { KNDW: 'KMD_DRAINAGE_INSPECTIONS_SEC01_V1', DWKZ: 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1', KZDR: 'KMD_DRAINAGE_INSPECTIONS_SEC03_V1', DRMR: 'KMD_DRAINAGE_INSPECTIONS_SEC04_V1', MRJB: 'KMD_DRAINAGE_INSPECTIONS_SEC05_V1' };

  // ---------------------------------------------------------------- lines
  const LINES = [
    {
      id: 'KM', name: 'Kano–Maradi', short: 'KANO–MARADI', kind: 'main line',
      subs: [
        { id: 'KNDW', name: 'Kano – Dawanau', from: -2675, to: 19800 },
        { id: 'DWKZ', name: 'Dawanau – Kazaure', from: 19800, to: 82902.439, sheets: 47 },
        { id: 'KZDR', name: 'Kazaure – Daura', from: 82902.439, to: 124521 },
        { id: 'DRMR', name: 'Daura – Muduru', from: 124521, to: 181080 },
        { id: 'MRJB', name: 'Muduru – Jibiya', from: 181080, to: 243225 },
        { id: 'JBMR', name: 'Jibiya – Maradi' }
      ]
    },
    {
      id: 'KD', name: 'Kano–Dutse', short: 'KANO–DUTSE', kind: 'branch',
      subs: [
        { id: 'KNYG', name: 'Kano – Yar Gaya' },
        { id: 'YGGY', name: 'Yar Gaya – Gaya' },
        { id: 'GYDT', name: 'Gaya – Dutse' }
      ]
    }
  ];
  const SUBS = {};
  LINES.forEach(l => l.subs.forEach(s => { s.line = l.id; SUBS[s.id] = s; }));

  // --------------------------------------------------------------- stages
  const LADDER_CONCRETE = ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'];
  const LADDER_UNLINED = ['Not started', 'Excavated', 'Completed'];
  const LADDER_PRECAST = ['Not started', 'Excavation', 'Bedding', 'Placed', 'Completed'];
  // Type 9 is precast half-round units, and the contractor reports a stretch only when it is done.
  const LADDER_T9 = ['Not started', 'Completed'];
  const LADDER_RIPRAP = ['Not started', 'Geotextile laid', 'Completed'];
  // Culverts are precast units, staged as on the site execution charts. A box
  // culvert is complete once its bituminous paint is on; a pipe culvert gets
  // no paint, so it is complete once its joints are done. Backfill is not a stage.
  const LADDER_BOX = ['Not started', 'Excavation', 'Bedding', 'Installed', 'Apron', 'Wing walls', 'Joints', 'Completed'];
  const LADDER_PIPE = ['Not started', 'Excavation', 'Bedding', 'Installed', 'Haunched', 'Apron', 'Wing walls', 'Completed'];
  const isCulvertLadder = l => l === LADDER_BOX || l === LADDER_PIPE;
  // A stage on the old cast-in-place ladder, said on a culvert ladder.
  function fromConcrete(f, i) {
    if (i == null || !isCulvertLadder(f.ladder)) return i;
    const name = LADDER_CONCRETE[Math.max(0, Math.min(LADDER_CONCRETE.length - 1, i))];
    if (name === 'Completed') return f.ladder.length - 1;
    if (name === 'Rebar' || name === 'Shuttered' || name === 'Concreted') return f.ladder.indexOf('Installed');
    if (name === 'Blinding') return f.ladder.indexOf('Bedding');
    return f.ladder.indexOf(name) < 0 ? 0 : f.ladder.indexOf(name);
  }

  // Lane geometry: typical offsets, used for ranking and for the written metres.
  const LANE_OFFSET = { cl: 0, plat: 3.5, face: 8, toe: 13.5, crest: 24, off: 50 };
  const LANES = ['off', 'crest', 'toe', 'face', 'plat'];

  // ----------------------------------------------------------- formatting
  function fmtCh(m, decimals) {
    if (m == null || isNaN(m)) return '—';
    const d = decimals == null ? 0 : decimals;
    const p = Math.pow(10, d);
    // Before Kano's zero (S01 starts at -2+675) chainage reads '-1+107', not '-2+893'.
    if (m < 0) return '-' + fmtCh(-m, decimals);
    const r = Math.round(m * p) / p;
    const km = Math.floor(r / 1000 + 1e-9);
    const rest = r - km * 1000;
    const whole = Math.floor(rest + 1e-9);
    let s = km + '+' + String(whole).padStart(3, '0');
    if (d > 0) s += '.' + String(Math.round((rest - whole) * p)).padStart(d, '0');
    return s;
  }
  // "+017.229" style label used for exact points on the strip
  function fmtPlus(m, decimals) {
    const s = fmtCh(m, decimals);
    return '+' + s.split('+')[1];
  }
  function parseCh(str) {
    if (str == null) return NaN;
    const s = String(str).replace(/PK|DK|\s/gi, '').replace(',', '.');
    const m = s.match(/^(-?)(\d+)\+(\d+(?:\.\d+)?)$/);
    if (m) return (m[1] ? -1 : 1) * (parseInt(m[2], 10) * 1000 + parseFloat(m[3]));
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }
  function decimalsOf(n) {
    const s = String(n);
    const i = s.indexOf('.');
    return i < 0 ? 0 : Math.min(3, s.length - i - 1);
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtDate(iso, withYear) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function monthsBetween(a, b) {
    const da = new Date(a), db = new Date(b);
    return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ------------------------------------------------ feature normalisation
  function sideOf(p) {
    const s = String(p.side || p.Side || '').toLowerCase();
    if (s.startsWith('l')) return 'L';
    if (s.startsWith('r')) return 'R';
    return 'C';
  }

  function culvertName(t) {
    const pipe = t.match(/(?:(\d)\s*x\s*)?[ØøΦ]+\s*(\d[.,]?\d*)\s*(m|mm)?/i) || t.match(/Pipe Culvert.*?(\d{4})/i);
    if (/pipe/i.test(t)) {
      let dia = null;
      const mm = t.match(/(\d{3,4})\s*$/) || t.match(/ø\s*(\d{3,4})/i);
      if (mm) dia = (parseInt(mm[1], 10) / 1000).toFixed(1);
      else if (pipe && pipe[2]) dia = parseFloat(pipe[2].replace(',', '.')).toFixed(1);
      const count = (t.match(/(\d)\s*x\s*Ø/i) || [])[1];
      return 'Pipe culvert ' + (count && count !== '1' ? count + '×' : '') + 'Ø' + (dia || '?') + ' m';
    }
    const box = t.match(/(\d)\s*x\s*\(\s*(\d(?:\.\d+)?)\s*x\s*(\d(?:\.\d+)?)\s*m?\)/i);
    if (box) {
      const n = box[1];
      const w = parseFloat(box[2]).toFixed(1), h = parseFloat(box[3]).toFixed(1);
      const word = n === '1' ? 'Single' : n === '2' ? 'Twin' : n === '3' ? 'Triple' : n + '-cell';
      return word + ' box culvert ' + n + '×(' + w + '×' + h + ' m)';
    }
    return /box/i.test(t) ? 'Box culvert' : 'Culvert';
  }

  function typeNo(t) {
    const m = String(t).match(/Type\s*(\d{1,2})(\s*(Larger|Lgr))?/i);
    if (!m) return null;
    return m[1] + (m[2] ? 'L' : '');
  }

  const CAT = {
    'Toe Ditch': { key: 'toe', label: 'Toe ditch', lane: 'toe', kind: 'linear' },
    'Side Ditch': { key: 'side', label: 'Side ditch', lane: 'plat', kind: 'linear' },
    'Shoulder Ditch': { key: 'shoulder', label: 'Shoulder / cascade', lane: 'plat', kind: 'linear' },
    'Berm Ditch': { key: 'berm', label: 'Berm ditch', lane: 'face', kind: 'linear' },
    'Crest Ditch': { key: 'crest', label: 'Crest ditch', lane: 'crest', kind: 'linear' },
    'Water Descent': { key: 'descent', label: 'Water descent', lane: 'face', kind: 'point' },
    'Riprap Protection': { key: 'riprap', label: 'Riprap protection', lane: 'face', kind: 'label' },
    'Cross Drainage': { key: 'cross', label: 'Cross drainage', lane: 'across', kind: 'cross' },
    'Cross Drainage Structure': { key: 'cross', label: 'Cross drainage', lane: 'across', kind: 'cross' },
    'Underpass': { key: 'underpass', label: 'Underpass', lane: 'across', kind: 'cross' },
    'Bridge Crossing': { key: 'bridge', label: 'Bridge / overbridge', lane: 'across', kind: 'cross' },
    'Overhead Crossing': { key: 'bridge', label: 'Bridge / overbridge', lane: 'across', kind: 'cross' },
    'Diversion Channel': { key: 'diversion', label: 'Diversion channel', lane: 'off', kind: 'linear' },
    'Track Drainage': { key: 'track', label: 'Track drainage', lane: 'cl', kind: 'buried' },
    'Energy Dissipator': { key: 'dissipator', label: 'Energy dissipator', lane: 'toe', kind: 'point' },
    'Miscellaneous': { key: 'misc', label: 'Miscellaneous', lane: 'toe', kind: 'linear' }
  };
  const CAT_ORDER = ['cross', 'toe', 'descent', 'riprap', 'diversion', 'shoulder', 'side', 'underpass', 'track', 'berm', 'crest', 'dissipator', 'bridge', 'misc'];

  function normalise(p, sub) {
    const catName = p.category || (p.Type === 'Bridge' ? 'Bridge Crossing' : null);
    if (!catName || catName === 'Section Boundary') return null;
    const cat = CAT[catName];
    if (!cat) return null;
    const t = String(p.typology || p.Typology_Class || '');
    let ch0 = Number(p.start_pk != null ? p.start_pk : p.Start_PK);
    let ch1 = Number(p.end_pk != null ? p.end_pk : p.End_PK);
    if (isNaN(ch0)) return null;
    if (isNaN(ch1)) ch1 = ch0;
    if (ch1 < ch0) { const x = ch0; ch0 = ch1; ch1 = x; }
    const side = sideOf(p);
    const n = typeNo(t);
    let code = '', name = t, ladder = LADDER_CONCRETE, icon = 'trap', typeKey = null;
    let kind = cat.kind, lane = cat.lane;

    switch (cat.key) {
      case 'toe': {
        const tn = /Type 4/.test(t) && !/Type 7|Type 12/.test(t) ? '4' : (n || '7');
        code = 'T' + tn; typeKey = tn;
        name = 'Type ' + tn + ' toe ditch' + (tn === '4' ? ', unlined' : '');
        icon = tn === '4' ? 'vee-dash' : tn === '7' ? 'vee' : 'trap';
        if (tn === '4') ladder = LADDER_UNLINED;
        break;
      }
      case 'side': {
        const tn = /Larger|Lgr/i.test(t + p.short_code) ? '1L' : (n || '1');
        code = 'T' + tn; typeKey = tn; name = 'Type ' + tn + ' side ditch'; icon = 'trap';
        break;
      }
      case 'shoulder':
        code = 'T9'; typeKey = '9'; name = 'Type 9 shoulder ditch'; icon = 'half';
        break;
      case 'berm':
        code = 'T8'; typeKey = '8'; name = 'Type 8 bench ditch'; icon = 'half';
        break;
      case 'crest': {
        const tn = n === '5' ? '5' : '11';
        code = 'T' + tn; typeKey = tn; name = 'Type ' + tn + ' crest ditch'; icon = 'vee';
        break;
      }
      case 'descent':
        code = 'WD'; name = 'Water descent, precast'; icon = 'descent'; ladder = LADDER_PRECAST;
        break;
      case 'riprap': {
        name = 'Riprap protection'; icon = 'riprap'; ladder = LADDER_RIPRAP;
        break;
      }
      case 'cross':
        name = culvertName(t);
        if (/Transition/i.test(t)) name = 'Road ditch transition';
        code = /pipe/i.test(t) ? 'PC' : 'BC';
        icon = /pipe/i.test(t) ? 'pipe' : 'box';
        ladder = code === 'PC' ? LADDER_PIPE : LADDER_BOX;
        break;
      case 'underpass':
        code = 'T16'; typeKey = '16'; name = /Cattle/i.test(t) ? 'Underpass / cattle crossing' : 'Underpass water passage'; icon = 'arch';
        break;
      case 'bridge':
        if (/Overbridge/i.test(t) || catName === 'Overhead Crossing') { code = 'OP'; name = 'Road overbridge'; }
        else { code = 'BRG'; name = 'Railway bridge ' + (p.Asset_ID || p.short_code || '').replace(/^Bridge$/, ''); }
        icon = 'bridge';
        break;
      case 'diversion': {
        const ty = (t.match(/Type ([ABC])\b/) || [])[1];
        code = /Rect/i.test(t) ? 'CH-R' : /Earth|Unlined/i.test(t) ? 'CH-A' : 'CH-' + (ty || 'B');
        name = 'Diversion channel'; icon = 'divert';
        if (code === 'CH-A') ladder = LADDER_UNLINED;
        break;
      }
      case 'track':
        code = 'T6'; typeKey = '6'; name = /Discharge Pipe/i.test(t) ? 'Discharge pipe' : 'Type 6 collector drain'; icon = 'collector';
        if (/Discharge/i.test(t)) { kind = 'point'; lane = 'toe'; }
        break;
      case 'dissipator':
        code = 'D-SD'; name = 'Energy dissipator'; icon = 'dissip';
        break;
      case 'misc':
        code = 'MD'; name = /Culvert/i.test(t) ? 'Culvert approach ditch' : 'Earth toe ditch'; icon = 'trap';
        if (/Unlined|Earth/i.test(t)) ladder = LADDER_UNLINED;
        break;
    }
    if (kind === 'linear' && ch1 - ch0 < 0.5) kind = 'point';
    if (kind === 'cross' && ch1 - ch0 > 5 && cat.key !== 'bridge') { /* keep centre */ }
    const level = (String(p.effective_status || '').match(/LEVEL ([ABC])/) || [])[1] || null;
    const onHold = /ON-HOLD/.test(p.effective_status || '');
    let cert = 'derived';
    if (cat.key === 'riprap') cert = 'label';
    else if (kind === 'cross' && (decimalsOf(ch0) >= 1 || p.confidence === 'CONFIRMED' || sub === 'KZDR')) cert = 'exact';
    const drawings = String(p.drawing_ref || p.Drawing_Ref || '').split('/').map(s => s.trim()).filter(Boolean);
    const sheet = (drawings.find(d => /DW-0[3-9]\d{3}|DW-03|DW-04/.test(d)) || drawings[0] || '')
      .replace(/^T2019-323-DD-[A-Z]{2}-[A-Z]{4}-\d{4}-/, '');
    const stated = cat.key === 'riprap' ? (Number(p.length_m) || (ch1 - ch0)) : null;
    const f = {
      id: p.id || p.Asset_ID, sub, line: SUBS[sub].line, catKey: cat.key, catLabel: cat.label,
      kind, lane, side, ch0, ch1, cert, code, typeKey, name, full: t || name, icon, ladder,
      sheet, drawings, level, onHold, confidence: p.confidence || (sub === 'KZDR' ? 'CONFIRMED' : ''),
      specs: p.specs || p.Dimensions || '', notes: p.notes || '', stated, raw: p
    };
    if (cert === 'label') { const mid = (ch0 + ch1) / 2; f.ch0 = f.ch1 = mid; f.kind = 'label'; }
    // For crossings, the chainage we quote is the single point.
    if (f.kind === 'cross' && cat.key !== 'bridge') { f.ch1 = f.ch0; }
    // The typical offset of the lane, signed: left positive when facing increasing.
    const mag = LANE_OFFSET[f.lane] || 0;
    f.offset = f.side === 'L' ? mag : f.side === 'R' ? -mag : 0;
    // Corrections already baked into the bundled data carry their settings.
    if (p.di_set) { applySet(f, p.di_set); f.corrected = 1; f.baseSet = Object.assign({}, p.di_set); }
    if (p.di_verified) f.verified = p.di_verified;
    return f;
  }

  // ------------------------------------------------------ base-data presets
  // What a corrected or added feature can be. Picking one sets the category,
  // the lane, how it is drawn, its code and its stage ladder together.
  const P = (catKey, code, name, lane, kind, icon, ladder, typeKey) => ({ catKey, code, name, lane, kind, icon, ladder: ladder || LADDER_CONCRETE, typeKey: typeKey || null });
  const PRESETS = {
    T1: P('side', 'T1', 'Type 1 side ditch', 'plat', 'linear', 'trap', null, '1'),
    T1L: P('side', 'T1L', 'Type 1L side ditch', 'plat', 'linear', 'trap', null, '1L'),
    T3: P('side', 'T3', 'Type 3 side ditch, unlined', 'plat', 'linear', 'vee-dash', LADDER_UNLINED, '3'),
    T10: P('side', 'T10', 'Type 10 side ditch with trench filter', 'plat', 'linear', 'trap', null, '10'),
    T15: P('side', 'T15', 'Type 15 rectangular side ditch', 'plat', 'linear', 'trap', null, '15'),
    T2: P('shoulder', 'T2', 'Type 2 half-round ditch', 'plat', 'linear', 'half', null, '2'),
    T9: P('shoulder', 'T9', 'Type 9 shoulder ditch', 'plat', 'linear', 'half', null, '9'),
    T4: P('toe', 'T4', 'Type 4 toe ditch, unlined', 'toe', 'linear', 'vee-dash', LADDER_UNLINED, '4'),
    T7: P('toe', 'T7', 'Type 7 toe ditch', 'toe', 'linear', 'vee', null, '7'),
    T12: P('toe', 'T12', 'Type 12 toe ditch', 'toe', 'linear', 'trap', null, '12'),
    T13: P('toe', 'T13', 'Type 13 rectangular toe ditch', 'toe', 'linear', 'trap', null, '13'),
    T14: P('toe', 'T14', 'Type 14 convergence ditch', 'toe', 'linear', 'vee', null, '14'),
    T8: P('berm', 'T8', 'Type 8 bench ditch', 'face', 'linear', 'half', null, '8'),
    T5: P('crest', 'T5', 'Type 5 crest ditch, unlined', 'crest', 'linear', 'vee-dash', LADDER_UNLINED, '5'),
    T11: P('crest', 'T11', 'Type 11 crest ditch', 'crest', 'linear', 'vee', null, '11'),
    T6: P('track', 'T6', 'Type 6 collector drain', 'cl', 'buried', 'collector', null, '6'),
    WD: P('descent', 'WD', 'Water descent, precast', 'face', 'point', 'descent', LADDER_PRECAST),
    RIP: P('riprap', '', 'Riprap protection', 'face', 'label', 'riprap', LADDER_RIPRAP),
    BC: P('cross', 'BC', 'Box culvert', 'across', 'cross', 'box', LADDER_BOX),
    PC: P('cross', 'PC', 'Pipe culvert', 'across', 'cross', 'pipe', LADDER_PIPE),
    T16: P('underpass', 'T16', 'Underpass water passage', 'across', 'cross', 'arch', null, '16'),
    'CH-A': P('diversion', 'CH-A', 'Diversion channel, earth', 'off', 'linear', 'divert', LADDER_UNLINED),
    'CH-B': P('diversion', 'CH-B', 'Diversion channel, concrete', 'off', 'linear', 'divert'),
    'CH-C': P('diversion', 'CH-C', 'Diversion channel with embankments', 'off', 'linear', 'divert'),
    'CH-R': P('diversion', 'CH-R', 'Rectangular channel', 'off', 'linear', 'divert'),
    'D-SOZ': P('dissipator', 'D-SOZ', 'Spread-out zone dissipator', 'toe', 'point', 'dissip'),
    'D-SD': P('dissipator', 'D-SD', 'Slope descent dissipator', 'toe', 'point', 'dissip'),
    'D-TC': P('dissipator', 'D-TC', 'Trapezoidal channel dissipator', 'toe', 'point', 'dissip'),
    'D-ST': P('dissipator', 'D-ST', 'Stool ditch dissipator', 'toe', 'point', 'dissip'),
    'D-RF': P('dissipator', 'D-RF', 'Rockfill dissipator', 'toe', 'point', 'dissip'),
    BRG: P('bridge', 'BRG', 'Railway bridge', 'across', 'cross', 'bridge'),
    OP: P('bridge', 'OP', 'Road overbridge', 'across', 'cross', 'bridge'),
    UP: P('underpass', 'UP', 'Road underpass', 'across', 'cross', 'arch'),
    CC: P('cross', 'CC', 'Cattle crossing', 'across', 'cross', 'box', LADDER_BOX),
    MD: P('misc', 'MD', 'Culvert approach ditch', 'toe', 'linear', 'trap', LADDER_UNLINED)
  };
  const CAT_LABEL = {};
  Object.values(CAT).forEach(c => { if (!CAT_LABEL[c.key]) CAT_LABEL[c.key] = c.label; });
  const CAT_NAME = {};
  Object.keys(CAT).forEach(n => { if (!CAT_NAME[CAT[n].key]) CAT_NAME[CAT[n].key] = n; });

  function presetOf(f) {
    if (f.catKey === 'riprap') return 'RIP';
    if (f.catKey === 'descent') return 'WD';
    if (PRESETS[f.code]) return f.code;
    if (f.catKey === 'track') return 'T6';
    return null;
  }
  // Apply a set of corrected fields to a feature. Values are absolute, so
  // applying the same correction twice gives the same result.
  function applySet(f, s) {
    if (!s) return f;
    if (s.preset && PRESETS[s.preset]) {
      const p = PRESETS[s.preset];
      Object.assign(f, { catKey: p.catKey, catLabel: CAT_LABEL[p.catKey] || p.catKey, code: p.code, typeKey: p.typeKey, lane: p.lane, kind: p.kind, icon: p.icon, ladder: p.ladder });
      if (!s.name) { f.name = p.name; f.full = p.name; }
    }
    ['name', 'side', 'lane', 'cert', 'sheet', 'level', 'notes', 'specs'].forEach(k => { if (s[k] != null && s[k] !== '') f[k] = s[k]; });
    if (s.name) f.full = s.fullName || s.name;
    if (s.ch0 != null && !isNaN(s.ch0)) f.ch0 = Number(s.ch0);
    if (s.ch1 != null && !isNaN(s.ch1)) f.ch1 = Number(s.ch1);
    if (f.kind === 'cross' && f.catKey !== 'bridge') f.ch1 = f.ch0;
    if (f.kind === 'point' || f.kind === 'label') f.ch1 = f.ch0;
    if (f.ch1 < f.ch0) { const x = f.ch0; f.ch0 = f.ch1; f.ch1 = x; }
    if (s.kind) f.kind = s.kind;
    if (s.stated != null) f.stated = Number(s.stated);
    if (s.offsetM !== undefined) f.offsetM = s.offsetM === null || s.offsetM === '' ? null : Math.abs(Number(s.offsetM));
    if (s.sheet) f.drawings = [s.sheet].concat((f.drawings || []).filter(d => d !== s.sheet));
    const mag = f.offsetM != null ? f.offsetM : (LANE_OFFSET[f.lane] || 0);
    f.offset = f.side === 'L' ? mag : f.side === 'R' ? -mag : 0;
    return f;
  }

  // ------------------------------------------------------ data per sub-section
  const data = { features: [], bySub: {}, byId: {}, centre: {}, irs: {}, pristine: {}, meta: {}, source: {}, deleted: [], sections: {}, heights: {} };

  function loadCentre(sub, cl) {
    if (!cl || !cl.dense_points) return;
    const pts = cl.dense_points.map(q => ({ pk: q.pk, lat: q.lat, lon: q.lon, brg: q.bearing }));
    pts.sort((a, b) => a.pk - b.pk);
    data.centre[sub] = pts;
  }

  function init() {
    const add = (sub, geo) => {
      if (!geo || !geo.features) return;
      const list = [];
      const seen = {};
      geo.features.forEach(g => {
        const f = normalise(g.properties || {}, sub);
        if (f && !seen[f.id]) { f.geom = g.geometry || null; list.push(f); seen[f.id] = 1; }
      });
      data.pristine[sub] = list;
      data.meta[sub] = geo.metadata || {};
      data.source[sub] = geo;
    };
    add('KNDW', window.SECTION01_ASSETS);
    add('DRMR', window.SECTION04_ASSETS);
    add('MRJB', window.SECTION05_ASSETS);
    add('DWKZ', window.SECTION02_ASSETS);
    add('KZDR', window.SECTION03_ASSETS);
    applyBase();
    loadCentre('KNDW', window.SECTION01_CENTERLINE);
    loadCentre('DRMR', window.SECTION04_CENTERLINE);
    loadCentre('MRJB', window.SECTION05_CENTERLINE);
    loadCentre('DWKZ', window.SECTION02_CENTERLINE);
    loadCentre('KZDR', window.SECTION03_CENTERLINE);
    SUBS.KNDW.count = (data.bySub.KNDW || []).length;
    SUBS.DRMR.count = (data.bySub.DRMR || []).length;
    SUBS.MRJB.count = (data.bySub.MRJB || []).length;
    migrateCulvertStages();
    SUBS.DWKZ.count = (data.bySub.DWKZ || []).length;
    SUBS.KZDR.count = (data.bySub.KZDR || []).length;
    loadLegacy();
  }

  // Cross sections from the design CAD (data/sections_<SUB>.json), nearest within 15 m.
  function loadSections(sub, j) { data.sections[sub] = (j.sections || []).slice().sort((a, b) => a.ch - b.ch); }
  function sectionAt(sub, ch, tol) {
    const L = data.sections[sub];
    if (!L || !L.length) return null;
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].ch < ch) lo = m + 1; else hi = m; }
    const c = [L[lo], L[lo - 1]].filter(Boolean).sort((a, b) => Math.abs(a.ch - ch) - Math.abs(b.ch - ch))[0];
    return Math.abs(c.ch - ch) <= (tol || 15) ? c : null;
  }

  // ---------------------------------------------------------------- embankment height
  // Formation to ground, every 25 m, from the design longitudinal profile (data/heights_<SUB>.json,
  // scripts/dwg/extract_profile.py). Each side's height is measured at that side's toe on the cross
  // section; where a side has none, the centreline height stands in. Where the profile gives no
  // formation level (stations, bridges) the height is an estimate from the rail level.
  // Type 9 from the contractor's schedule (data/t9_schedule.json, built by scripts/t9/build_schedule.js
  // from NIG/KAMA/FM/2026/4218). Each piece is a stretch of the letter that the drawings do not show as
  // Type 9; a Type 9 already drawn stays the design piece. Only the sub-sections in `subs` get them.
  function loadT9Schedule(j, subs) {
    Object.keys(data.pristine).forEach(sub => { data.pristine[sub] = data.pristine[sub].filter(f => !f.sched); });
    const pr = PRESETS.T9;
    const on = subs || Object.keys(SUBS);
    (j.pieces || []).filter(p => on.includes(p.sub) && SUBS[p.sub] && data.pristine[p.sub]).forEach(p => {
      const f = {
        id: p.id, sub: p.sub, line: SUBS[p.sub].line, catKey: pr.catKey, catLabel: CAT_LABEL[pr.catKey], kind: 'linear', lane: pr.lane,
        side: p.side, ch0: p.ch0, ch1: p.ch1, cert: 'exact', code: 'T9', typeKey: '9', name: pr.name, full: 'Type 9 shoulder ditch, precast half-round',
        icon: pr.icon, ladder: LADDER_T9, sheet: (p.sheets || [])[0] || '', drawings: p.sheets || [], level: null, onHold: false, confidence: '',
        specs: '', notes: '', stated: null, raw: {}, sched: { src: j.source, letter: [p.a, p.b] }
      };
      f.offset = p.side === 'L' ? LANE_OFFSET[f.lane] : -LANE_OFFSET[f.lane];
      data.pristine[p.sub].push(f);
    });
    t9Cache = {};
    applyBase();
  }
  // Where the schedule is switched on. Section 02 first: work is going on there and it matches the design.
  const T9_SCHEDULE_ON = ['DWKZ'];
  function hasT9Schedule(sub) { return !!(data.bySub[sub] || []).some(f => f.sched); }
  function loadHeights(sub, j) {
    const fb = j.fl_below_rail || 0.971;
    data.heights[sub] = (j.rows || []).map(r => {
      const est = r[2] == null;
      const c = (est ? r[1] - fb : r[2]) - r[3];
      return { ch: r[0], rail: r[1], fl: est ? r[1] - fb : r[2], gl: r[3], c, L: r[4], R: r[5], est, fall: r[6] || null, xs: r[7] === 'xs' };
    }).sort((a, b) => a.ch - b.ch);
    t9Cache = {};
  }
  function hasHeights(sub) { return !!(data.heights[sub] && data.heights[sub].length); }
  function heightAt(sub, ch, side) {
    const L = data.heights[sub];
    if (!L || !L.length || ch < L[0].ch - 13 || ch > L[L.length - 1].ch + 13) return null;
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].ch < ch) lo = m + 1; else hi = m; }
    const b = L[lo], a = L[Math.max(0, lo - 1)];
    const pick = r => (side === 'L' || side === 'R') && r[side] != null ? r[side] : r.c;
    const u = b.ch === a.ch || b.ch - a.ch > 30 ? (Math.abs(ch - a.ch) < Math.abs(ch - b.ch) ? 0 : 1) : Math.max(0, Math.min(1, (ch - a.ch) / (b.ch - a.ch)));
    const h = pick(a) + (pick(b) - pick(a)) * u;
    const near = u < 0.5 ? a : b;
    return { h, side: (side === 'L' || side === 'R') && near[side] != null ? side : 'C', est: a.est || b.est, c: a.c + (b.c - a.c) * u };
  }

  // Where Type 9 (inverted block drain) is called for: embankments higher than 1.8 m, as T.E.A.M.
  // set in KMD/MEN/Vol.15/3545 (12 Aug 2026) and Mota-Engil adopted in NIG/KAMA/FM/2026/4218 (3 Oct
  // 2026). The other thresholds stay for comparison: the design had 4 m; Mota-Engil first proposed
  // 1.0 m (NIG/KAMA/FM/2026/3634, 11 Jul 2026); 1.5 m was used on site before the 1.8 m letter.
  // Both letters keep stretches with a Type 1 on that side out of it. The drain goes on the side the
  // platform falls to ('the lower side of the railway platform', NIG/KAMA/FM/2026/3634), which is
  // where the design draws it (569 of 577 one-sided stations on S02); a roof-shaped platform needs both.
  const T9_RULES = [
    { h: 1.8, label: '1.8 m', src: 'T.E.A.M. KMD/MEN/Vol.15/3545 (12 Aug 2026), adopted in NIG/KAMA/FM/2026/4218 (3 Oct 2026)' },
    { h: 1.5, label: '1.5 m', src: 'Earlier site rule' },
    { h: 1.0, label: '1.0 m', src: 'Mota-Engil NIG/KAMA/FM/2026/3634, 11 Jul 2026 (proposal)' },
    { h: 4.0, label: '4.0 m', src: 'Original design' }
  ];
  const T9_KEY = 'KMD_T9_RULE_V2';   // V2: the official 1.8 m rule replaces any earlier choice
  let t9Cache = {};
  function t9Rule() {
    let h = 1.8;
    try { const v = Number(localStorage.getItem(T9_KEY)); if (v > 0) h = v; } catch (e) { /* ignore */ }
    return T9_RULES.find(r => r.h === h) || T9_RULES[0];
  }
  function setT9Rule(h) { try { localStorage.setItem(T9_KEY, String(h)); } catch (e) { /* ignore */ } }
  // Stretches of each side, 25 m a station: 'missing' (needed, none drawn), 'ok' (needed and drawn),
  // 'extra' (drawn on a side the platform falls to, below the threshold), 'exempt' (Type 1 on that
  // side), 'na' (on a bridge, or no formation level on the profile, or no cross section: stations).
  // 'Higher than' the threshold: a height exactly at it does not call for Type 9.
  function t9Check(sub, thr) {
    const L = data.heights[sub];
    if (!L) return null;
    const key = sub + '|' + thr + '|' + (data.bySub[sub] || []).length;
    if (t9Cache[key]) return t9Cache[key];
    const feats = (data.bySub[sub] || []).filter(f => !statusOf(f).removed);
    const on = (codes, side, ch) => feats.some(f => codes.includes(f.code) && f.side === side && ch >= f.ch0 - 5 && ch <= f.ch1 + 5);
    const bridges = refs().filter(r => r.sub === sub && r.kind === 'bridge');
    const onBridge = ch => bridges.some(b => ch >= b.ch0 && ch <= b.ch1);
    const runs = [], km = { missing: 0, ok: 0, extra: 0, exempt: 0, na: 0 };
    ['L', 'R'].forEach(side => {
      let cur = null;
      L.forEach(r => {
        const h = r[side] != null ? r[side] : r.c;
        const drawn = on(['T9'], side, r.ch);
        const low = r.fall === side || r.fall === 'both';
        let st;
        if (r.est || !r.fall || onBridge(r.ch)) st = 'na';
        else if (!low) st = drawn && h > thr ? 'ok' : null;
        else if (h > thr && on(['T1', 'T1L'], side, r.ch)) st = 'exempt';
        else if (h > thr) st = drawn ? 'ok' : 'missing';
        else st = drawn ? 'extra' : null;
        if (cur && (cur.status !== st || r.ch - cur.last > 30)) { runs.push(cur); cur = null; }
        if (!st) return;
        if (!cur) cur = { side, status: st, ch0: r.ch, last: r.ch, minH: h, maxH: h, n: 0 };
        cur.last = r.ch; cur.n++; cur.minH = Math.min(cur.minH, h); cur.maxH = Math.max(cur.maxH, h);
        km[st] += 0.025;
      });
      if (cur) runs.push(cur);
    });
    runs.forEach(r => { r.ch0 = Math.max(L[0].ch, r.ch0 - 12.5); r.ch1 = Math.min(L[L.length - 1].ch, r.last + 12.5); delete r.last; });
    runs.sort((a, b) => a.ch0 - b.ch0 || (a.side < b.side ? -1 : 1));
    return (t9Cache[key] = { thr, runs, km });
  }

  // ---------------------------------------------------------------- reference structures
  // Bridges, overpasses (road over the railway) and underpasses (road under it) from the track plans
  // (data/structures.js). For finding your way only: they are not inspected and carry no records.
  const REF_KIND = {
    bridge: { label: 'Railway bridge', short: 'BRIDGE' },
    overpass: { label: 'Overpass · road over the railway', short: 'ROAD OVER' },
    underpass: { label: 'Underpass · road under the railway', short: 'ROAD UNDER' },
    crossing: { label: 'Road crossing', short: 'ROAD' }
  };
  let refList = null;
  function refs() {
    if (refList) return refList;
    refList = [];
    const src = window.KMD_STRUCTURES || {};
    Object.keys(src).forEach(sub => {
      if (!SUBS[sub]) return;
      (src[sub].structures || []).forEach(s => refList.push(Object.assign({ sub, line: SUBS[sub].line, source: src[sub].source }, s, REF_KIND[s.kind] || REF_KIND.crossing, { kind: s.kind })));
    });
    refList.sort((a, b) => a.ch0 - b.ch0);
    return refList;
  }
  function refsNear(line, a, b) { return refs().filter(r => r.line === line && r.ch1 >= a && r.ch0 <= b); }
  function refById(id) { return refs().find(r => r.id === id) || null; }

  function hasData(sub) { return !!(data.bySub[sub] && data.bySub[sub].length); }
  function subAt(line, ch) {
    const l = LINES.find(x => x.id === line);
    if (!l) return null;
    return l.subs.find(s => s.from != null && ch >= s.from && ch < s.to) ||
      l.subs.find(s => s.from != null && Math.abs(ch - s.to) < 1) || null;
  }
  function featuresNear(line, a, b) {
    return data.features.filter(f => f.line === line && f.ch1 >= a && f.ch0 <= b);
  }

  // ---------------------------------------------------- contractor claims
  const IR_STATUS = { 'APPROVED': 'approved', 'APPD AS NOTED': 'comments', 'PENDING': 'pending', 'REJECTED': 'rejected' };
  function loadIRs(rows) {
    (rows || []).forEach(r => {
      const f = data.byId[r.asset_id];
      if (!f) return;
      const list = (r.history || []).filter(h => h.stage_idx >= 0).map(h => ({
        ir: String(h.prog_n).padStart(4, '0'), date: h.date, stage: h.stage_idx + 1,
        milestone: h.milestone, status: IR_STATUS[h.status] || 'pending',
        desc: String(h.desc || '').replace(/["“”]/g, '').replace(/\s*\.?\s*Normal approved work\.?/i, '').trim()
      })).sort((a, b) => a.date < b.date ? -1 : 1);
      data.irs[f.id] = list;
    });
  }
  function claimOf(fid) {
    const list = data.irs[fid];
    if (!list || !list.length) return null;
    let best = null;
    list.forEach(h => { if (h.status !== 'rejected' && (!best || h.stage >= best.stage)) best = h; });
    if (!best) return null;
    const f = data.byId[fid];
    const stage = isCulvertLadder(f.ladder) ? fromConcrete(f, best.stage) : best.stage;
    return Object.assign({}, best, { stage: Math.min(stage, f.ladder.length - 1) });
  }

  // ------------------------------------------------------- record store
  // Every observation is a new record. Nothing is edited in place; an undo
  // appends a void that points at the record it cancels.
  let records = [];
  let legacy = {};
  function inspector() {
    try { return localStorage.getItem(INSPECTOR_KEY) || (window.APP_CONFIG && window.APP_CONFIG.inspectorName) || 'Engr. A. Abdulwahab'; }
    catch (e) { return 'Engr. A. Abdulwahab'; }
  }
  function setInspector(n) { try { localStorage.setItem(INSPECTOR_KEY, n); } catch (e) { /* ignore */ } }
  function loadRecords() {
    try { records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); } catch (e) { records = []; }
  }
  // Culvert stage records made before culverts had their own ladder carry an
  // index on the cast-in-place one. Say them on the new ladder, by name, once.
  function migrateCulvertStages() {
    let n = 0;
    records.forEach(r => {
      if (r.kind !== 'stage' || r.stageName) return;
      const f = data.byId[r.featureId];
      if (!f || !isCulvertLadder(f.ladder)) return;
      r.stage = fromConcrete(f, r.stage);
      if (r.claimStage != null) r.claimStage = fromConcrete(f, r.claimStage);
      r.stageName = f.ladder[r.stage];
      n++;
    });
    if (n) saveRecords();
    return n;
  }
  function saveRecords() {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); return true; }
    catch (e) { console.error('Could not save records', e); return false; }
  }
  function uid() {
    const t = Date.now().toString(16).padStart(12, '0');
    const r = Array.from({ length: 5 }, () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')).join('');
    return t.slice(0, 8) + '-' + t.slice(8) + '-7' + r.slice(1, 4) + '-' + r.slice(4, 8) + '-' + r.slice(8);
  }
  function voided() {
    const s = new Set();
    records.forEach(r => { if (r.kind === 'void') s.add(r.target); });
    return s;
  }
  function live(filter) {
    const v = voided();
    return records.filter(r => r.kind !== 'void' && !v.has(r.id) && (!filter || filter(r)));
  }
  function addRecord(rec) {
    const r = Object.assign({ id: uid(), at: new Date().toISOString(), by: inspector() }, rec);
    if (r.kind === 'stage' && r.stageName == null) { const f = data.byId[r.featureId]; if (f) r.stageName = f.ladder[r.stage]; }
    records.push(r);
    saveRecords();
    if (r.kind === 'stage' || r.kind === 'defect' || r.kind === 'range') mirrorLegacy(r.featureId);
    if (r.kind === 'base') applyBase();
    return r;
  }
  function voidRecord(id) {
    if (live(r => r.id === id).length === 0) return null;
    const r = addRecord({ kind: 'void', target: id });
    const t = records.find(x => x.id === id);
    if (t && t.kind === 'base') applyBase();
    else if (t && t.featureId) mirrorLegacy(t.featureId);
    return r;
  }
  // ------------------------------------------------------- base data
  // Corrections to the extracted data: the drawing was read wrong, or a
  // feature was missed. Not a design revision and not a field finding.
  // Kept as append-only 'base' records, applied over the extraction on load.
  function applyBase() {
    const v = voided();
    const base = records.filter(r => r.kind === 'base' && !v.has(r.id)).sort((a, b) => a.at < b.at ? -1 : 1);
    data.byId = {}; data.bySub = {}; data.deleted = [];
    Object.keys(data.pristine).forEach(sub => {
      data.bySub[sub] = data.pristine[sub].map(f => { const c = Object.assign({}, f); data.byId[c.id] = c; return c; });
    });
    base.forEach(r => {
      let f = data.byId[r.featureId];
      if (r.action === 'add' && !f) {
        const p = PRESETS[(r.set && r.set.preset) || 'T12'];
        const sub = r.sub || 'KZDR';
        if (!SUBS[sub]) return;
        f = { id: r.featureId, sub, line: SUBS[sub].line, catKey: p.catKey, catLabel: CAT_LABEL[p.catKey], kind: p.kind, lane: p.lane, side: 'L', ch0: 0, ch1: 0, cert: 'derived', code: p.code, typeKey: p.typeKey, name: p.name, full: p.name, icon: p.icon, ladder: p.ladder, sheet: '', drawings: [], level: null, onHold: false, confidence: '', specs: '', notes: '', stated: null, raw: {}, added: r.at };
        (data.bySub[sub] = data.bySub[sub] || []).push(f);
        data.byId[f.id] = f;
      }
      if (!f) return;
      if (r.action === 'edit' || r.action === 'add') {
        applySet(f, r.set);
        f.corrected = (f.corrected || 0) + 1;
        f.baseSet = Object.assign({}, f.baseSet || {}, r.set);
        f.lastCorrected = r.at;
      }
      if (r.action === 'delete') f.deleted = { at: r.at, note: r.note || '' };
      if (r.action === 'verify') f.verified = { at: r.at, by: r.by, sheet: r.sheet || f.sheet };
      if (r.action === 'unverify') f.verified = null;
    });
    data.features = [];
    Object.keys(data.bySub).forEach(sub => {
      const all = data.bySub[sub];
      data.deleted = data.deleted.concat(all.filter(f => f.deleted));
      data.bySub[sub] = all.filter(f => !f.deleted).sort((a, b) => a.ch0 - b.ch0);
      data.features = data.features.concat(data.bySub[sub]);
    });
    if (SUBS.KNDW) SUBS.KNDW.count = (data.bySub.KNDW || []).length;
    if (SUBS.DRMR) SUBS.DRMR.count = (data.bySub.DRMR || []).length;
    if (SUBS.MRJB) SUBS.MRJB.count = (data.bySub.MRJB || []).length;
    if (SUBS.DWKZ) SUBS.DWKZ.count = (data.bySub.DWKZ || []).length;
    if (SUBS.KZDR) SUBS.KZDR.count = (data.bySub.KZDR || []).length;
  }
  function baseRecords() { return live(r => r.kind === 'base'); }
  function correctBase(fid, set, note) { return addRecord({ kind: 'base', action: 'edit', featureId: fid, set, note }); }
  function addBase(sub, set, note) { return addRecord({ kind: 'base', action: 'add', featureId: 'base_' + uid().replace(/-/g, '').slice(0, 16), sub, set, note }); }
  function deleteBase(fid, note) { return addRecord({ kind: 'base', action: 'delete', featureId: fid, note }); }
  function verifyBase(fid, sheet) { return addRecord({ kind: 'base', action: 'verify', featureId: fid, sheet }); }
  function unverifyBase(fid) { return addRecord({ kind: 'base', action: 'unverify', featureId: fid }); }

  // A corrected sub-section, in the same shape as the bundled data, so it
  // can replace data/bundle.js (via scripts/apply_base_corrections.js) or
  // open in QGIS. Corrected features are re-placed from the centreline.
  function exportGeo(sub) {
    const src = data.source[sub] || { type: 'FeatureCollection', features: [] };
    const idOf = g => (g.properties || {}).id || (g.properties || {}).Asset_ID;
    const done = new Set();
    const deletedIds = new Set(data.deleted.map(f => f.id));
    // Keep the source order and everything the app does not model (section
    // boundaries etc.) exactly as it was; replace only what was corrected.
    const out = [];
    src.features.forEach(g => {
      const id = idOf(g);
      if (deletedIds.has(id)) return;
      const f = data.byId[id];
      if (f && f.sub === sub && !done.has(id)) { done.add(id); out.push(f.baseSet || f.verified ? featureOut(f, sub) : g); } else out.push(g);
    });
    (data.bySub[sub] || []).filter(f => !done.has(f.id) && !f.sched).forEach(f => out.push(featureOut(f, sub)));
    const meta = Object.assign({}, src.metadata || {});
    if ('count' in meta) meta.count = out.length;
    const n = baseRecords().filter(r => ((data.byId[r.featureId] || {}).sub || r.sub) === sub).length;
    if (n) Object.assign(meta, {
      base_corrections_applied: n,
      removed_as_extraction_errors: data.deleted.filter(f => f.sub === sub).map(f => ({ id: f.id, note: f.deleted.note })),
      corrected_at: new Date().toISOString()
    });
    return Object.assign({}, src, { metadata: meta, features: out });
  }
  function featureOut(f, sub) {
    const SIDE = { L: 'Left', R: 'Right', C: 'Center' };
    if (!f.baseSet && !f.verified && f.geom) return { type: 'Feature', properties: f.raw, geometry: f.geom };
    const props = Object.assign({}, f.raw);
    delete props.di_set; delete props.di_verified;
    Object.assign(props, {
      id: f.id, start_pk: round3(f.ch0), end_pk: round3(f.ch1), length_m: round3(f.ch1 - f.ch0), is_point: f.ch1 - f.ch0 < 0.5,
      side: SIDE[f.side], category: props.category || CAT_NAME[f.catKey], typology: props.typology || f.full,
      chainage_str: 'PK ' + fmtCh(f.ch0) + (f.ch1 - f.ch0 >= 0.5 ? ' – PK ' + fmtCh(f.ch1) : '')
    });
    if (!props.status) props.status = 'Not Started';
    if (f.baseSet) { props.di_set = f.baseSet; props.category = CAT_NAME[f.catKey]; props.typology = f.full; props.short_code = f.code || props.short_code; if (f.sheet) props.drawing_ref = [f.sheet].concat((f.drawings || []).filter(d => d !== f.sheet)).join(' / '); }
    if (f.offsetM != null) props.offset_m = f.offsetM;
    if (f.verified) { props.di_verified = f.verified; props.confidence = 'CONFIRMED'; }
    let geom = f.geom;
    if (f.baseSet || !geom) {
      const pts = [];
      const step = f.ch1 - f.ch0 < 0.5 ? 0 : Math.max(5, (f.ch1 - f.ch0) / 60);
      for (let c = f.ch0; ; c += step) {
        const q = pointAt(sub, Math.min(c, f.ch1), f.offset * (f.kind === 'cross' ? 0 : 1));
        if (q) pts.push([+q.lon.toFixed(7), +q.lat.toFixed(7)]);
        if (!step || c >= f.ch1) break;
      }
      geom = pts.length > 1 ? { type: 'LineString', coordinates: pts } : pts.length ? { type: 'Point', coordinates: pts[0] } : null;
    }
    return { type: 'Feature', properties: props, geometry: geom };
  }
  function round3(n) { return Math.round(n * 1000) / 1000; }
  function exportCorrections() {
    return { kind: 'kmd-base-corrections', version: 1, exported_at: new Date().toISOString(), by: inspector(), records: records.filter(r => r.kind === 'base' || (r.kind === 'void' && records.some(x => x.id === r.target && x.kind === 'base'))) };
  }
  function importRecords(list) {
    const have = new Set(records.map(r => r.id));
    let n = 0;
    (list || []).forEach(r => { if (r && r.id && !have.has(r.id)) { records.push(r); n++; } });
    records.sort((a, b) => a.at < b.at ? -1 : 1);
    saveRecords();
    applyBase();
    return n;
  }

  function recordsFor(fid) { return live(r => r.featureId === fid).sort((a, b) => a.at < b.at ? 1 : -1); }

  // Legacy per-asset inspections (older app, and what the cloud sync reads).
  const LEGACY_STAGE = { 'Not Started': 0, 'Excavation': 1, 'Blinding': 2, 'Rebar / Shuttering': 3, 'Concreted': 5, 'Completed & Approved': 6 };
  function toLegacyStatus(f, s) {
    const name = f.ladder[s];
    if (s === 0) return 'Not Started';
    if (s === f.ladder.length - 1) return 'Completed & Approved';
    if (isCulvertLadder(f.ladder)) return name;
    if (name === 'Concreted') return 'Concreted';
    if (name === 'Rebar' || name === 'Shuttered' || name === 'Placed') return 'Rebar / Shuttering';
    if (name === 'Blinding' || name === 'Bedding' || name === 'Geotextile laid') return 'Blinding';
    return 'Excavation';
  }
  function loadLegacy() {
    legacy = {};
    Object.values(LEGACY_KEYS).forEach(k => {
      try { Object.assign(legacy, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { /* ignore */ }
    });
    window.appState = window.appState || {};
    window.appState.inspections = legacy;
  }
  function mirrorLegacy(fid) {
    const f = data.byId[fid];
    if (!f) return;
    const seen = ownSeen(fid);
    const defects = openDefects(fid);
    const now = new Date().toISOString();
    // A Type 9 run says how much is done in its notes; the status says only done or under way.
    if (rangeable(f)) adoptForeignRanges(f);
    const cov = rangeable(f) ? coverOf(f) : null;
    let status = seen ? toLegacyStatus(f, seen.stage) : 'Not Started';
    let notes = defects.map(d => d.defect + (d.note ? ': ' + d.note : '')).join(' | ');
    if (cov && cov.ranges.length) {
      status = cov.full ? toLegacyStatus(f, f.ladder.length - 1) : 'Concreted';
      notes = [notes, rangeNote(cov.ranges)].filter(Boolean).join(' | ');
    }
    legacy[fid] = {
      assetId: fid, chainage_str: f.raw.chainage_str, short_code: f.raw.short_code, typology: f.full,
      status,
      notes,
      hasDefect: defects.length > 0, date: now.replace('T', ' ').slice(0, 16), updated_at: now, inspected_by: inspector(), source: 'walk'
    };
    const key = LEGACY_KEYS[f.sub];
    try {
      const store = JSON.parse(localStorage.getItem(key) || '{}');
      store[fid] = legacy[fid];
      localStorage.setItem(key, JSON.stringify(store));
    } catch (e) { /* ignore */ }
    if (window.syncEngine && window.syncEngine.queueAssetForSync) {
      try { window.syncEngine.queueAssetForSync(fid); } catch (e) { /* offline is normal */ }
    }
  }

  function ownSeen(fid) {
    const r = live(x => x.featureId === fid && x.kind === 'stage').sort((a, b) => a.at < b.at ? 1 : -1)[0];
    return r || null;
  }
  // What someone stood in front of and recorded: own records first, then
  // anything the office already holds for this asset.
  function seenOf(fid) {
    const own = ownSeen(fid);
    const lg = legacy[fid];
    const fl = data.byId[fid];
    // An office row can name a stage of this feature's own ladder exactly ('Installed', 'Wing walls').
    if (lg && lg.source !== 'walk' && lg.status && fl && LEGACY_STAGE[lg.status] == null && fl.ladder.indexOf(lg.status) > 0) {
      const at = lg.updated_at || (lg.date ? lg.date.replace(' ', 'T') : null);
      if (!own || (at && at > own.at)) return { stage: fl.ladder.indexOf(lg.status), at, by: lg.inspected_by || 'office', office: true, note: lg.notes || '' };
    }
    if (lg && lg.source !== 'walk' && lg.status && LEGACY_STAGE[lg.status] != null && lg.status !== 'Not Started') {
      const at = lg.updated_at || (lg.date ? lg.date.replace(' ', 'T') : null);
      if (!own || (at && at > own.at)) {
        const f = data.byId[fid];
        let s = LEGACY_STAGE[lg.status];
        if (f && isCulvertLadder(f.ladder)) s = fromConcrete(f, s);
        if (f && s >= f.ladder.length) s = f.ladder.length - 1;
        if (f && lg.status === 'Completed & Approved') s = f.ladder.length - 1;
        return { stage: s, at, by: lg.inspected_by || 'office', office: true };
      }
    }
    return own;
  }
  function openDefects(fid) {
    const v = voided();
    const cleared = new Set(records.filter(r => r.kind === 'clear' && !v.has(r.id)).map(r => r.target));
    return live(r => r.featureId === fid && r.kind === 'defect' && !cleared.has(r.id));
  }
  function designChanges(fid) { return live(r => r.featureId === fid && r.kind === 'design'); }

  // A status summary used by the strip, the section view and the lists.
  // ------------------------------------------------ progress by length
  // A Type 9 run is finished a bit at a time, and the contractor reports it only when a stretch is done
  // (precast units, no stages). So it is tracked by completed ranges: 'from X to Y is done'. Records are
  // append-only like all the rest; undo voids one. A Completed stage on the whole run counts as all of it.
  const RANGE_CODES = ['T9'];
  const rangeable = f => RANGE_CODES.includes(f.code) && f.kind === 'linear' && f.ch1 - f.ch0 > 1;
  function mergeRanges(list) {
    const out = [];
    list.slice().sort((a, b) => a[0] - b[0]).forEach(([a, b]) => {
      const last = out[out.length - 1];
      if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b); else out.push([a, b]);
    });
    return out;
  }
  // The completed ranges travel to the cloud database in the row's notes, since the table has no column for
  // them: '[T9 done 20900 to 21000; 21100 to 21225]', chainages in metres. The office import writes the same.
  const RANGE_NOTE = /\[T9 done ([^\]]*)\]/;
  function rangeNote(ranges) {
    return ranges.length ? '[T9 done ' + ranges.map(([a, b]) => Math.round(a * 10) / 10 + ' to ' + Math.round(b * 10) / 10).join('; ') + ']' : '';
  }
  function parseRangeNote(notes) {
    const m = RANGE_NOTE.exec(notes || '');
    if (!m) return [];
    return m[1].split(';').map(x => x.trim().match(/^(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)$/)).filter(Boolean).map(x => [Number(x[1]), Number(x[2])]).filter(r => r[1] > r[0]);
  }
  // Ranges the database holds that this phone has no record of: the office import, or another phone. A row
  // this phone wrote itself (source 'walk') is already in its own records, so undoing one stays undone.
  function foreignRanges(f) {
    const lg = legacy[f.id];
    return lg && lg.source !== 'walk' ? parseRangeNote(lg.notes) : [];
  }
  // Before this phone writes over such a row, those ranges become its own records (undoable like the rest),
  // so the row it writes still carries them.
  function adoptForeignRanges(f) {
    const lg = legacy[f.id];
    const got = foreignRanges(f).map(([a, b]) => [Math.max(f.ch0, a), Math.min(f.ch1, b)]).filter(r => r[1] - r[0] >= 0.5);
    got.forEach(([a, b]) => {
      const mine = live(r => r.kind === 'range' && r.featureId === f.id).some(r => Math.abs(r.from - a) < 0.2 && Math.abs(r.to - b) < 0.2);
      if (!mine) records.push({ id: uid(), at: (lg && lg.updated_at) || new Date().toISOString(), by: (lg && lg.inspected_by) || 'office', kind: 'range', featureId: f.id, from: a, to: b, line: f.line, sub: f.sub, ch: a, pos: null, imported: true });
    });
    if (got.length) saveRecords();
  }
  function coverOf(f) {
    if (!rangeable(f)) return null;
    const recs = live(r => r.kind === 'range' && r.featureId === f.id);
    const own = ownSeen(f.id);
    const byStage = !!(own && own.stage >= f.ladder.length - 1);
    const foreign = foreignRanges(f);
    if (!recs.length && !byStage && !foreign.length) return null;
    const list = recs.map(r => [r.from, r.to]).concat(foreign).map(([a, b]) => [Math.max(f.ch0, Math.min(a, b)), Math.min(f.ch1, Math.max(a, b))]).filter(r => r[1] > r[0]);
    if (byStage) list.push([f.ch0, f.ch1]);
    const ranges = mergeRanges(list);
    const m = ranges.reduce((n, [a, b]) => n + b - a, 0);
    const lg = legacy[f.id];
    const lastAt = recs.map(r => r.at).concat(byStage ? [own.at] : []).concat(foreign.length && lg ? [lg.updated_at || (lg.date || '').replace(' ', 'T')] : []).filter(Boolean).sort().pop() || null;
    return { ranges, m, len: f.ch1 - f.ch0, full: m >= f.ch1 - f.ch0 - 1, lastAt, records: recs, foreign: foreign.length };
  }
  function addRange(fid, from, to, pos) {
    const f = data.byId[fid];
    if (!f || !rangeable(f)) return null;
    const a = Math.max(f.ch0, Math.min(from, to)), b = Math.min(f.ch1, Math.max(from, to));
    if (!(b - a >= 0.5)) return null;
    return addRecord({ kind: 'range', featureId: fid, from: Math.round(a * 10) / 10, to: Math.round(b * 10) / 10, line: f.line, sub: f.sub, ch: a, pos: pos || null });
  }

  function statusOf(f) {
    const seen = seenOf(f.id);
    const claim = claimOf(f.id);
    const max = f.ladder.length - 1;
    const s = seen ? seen.stage : null;
    const c = claim ? claim.stage : null;
    const best = Math.max(s == null ? 0 : s, c == null ? 0 : c);
    const lastAt = [seen && seen.at, claim && claim.date].filter(Boolean).sort().pop() || null;
    const partBuilt = best > 0 && best < max;
    const stalled = partBuilt && lastAt && (Date.now() - new Date(lastAt).getTime()) > 182 * 864e5;
    let fill = 'none';
    if (s != null && s >= max) fill = 'solid';
    else if (s != null && s > 0) fill = 'hatch';
    else if (s == null && c == null) fill = 'never';
    const changes = designChanges(f.id);
    const res = {
      seen, claim, s, c, best, max, lastAt, partBuilt, stalled, fill,
      defects: openDefects(f.id), changes,
      removed: changes.some(r => r.action === 'remove'),
      bucket: best >= max ? 'done' : best === 0 ? 'none' : stalled ? 'stalled' : 'moving'
    };
    const cov = coverOf(f);
    if (cov) {
      res.cover = cov;
      if (cov.full) Object.assign(res, { s: max, best: max, fill: 'solid', partBuilt: false, stalled: false, bucket: 'done' });
      else {
        const stl = !!cov.lastAt && (Date.now() - new Date(cov.lastAt).getTime()) > 182 * 864e5;
        // the ranges are the authority: an office row's 'Concreted' must not read as finished on a short ladder
        const cap = Math.max(0, max - 1);
        Object.assign(res, { s: res.s == null ? null : Math.min(res.s, cap), best: Math.min(Math.max(best, 1), cap), partBuilt: true, stalled: stl, fill: 'ranges', bucket: stl ? 'stalled' : 'moving', lastAt: [lastAt, cov.lastAt].filter(Boolean).sort().pop() });
      }
    }
    return res;
  }

  // ------------------------------------------------ progress overview
  // Completion, not "part-built": structures that are a single place (culverts, descents, riprap) are
  // counted; ditches and drains that run along the line are measured by length. The two are never added.
  const isSpan = f => f.kind === 'linear' || f.kind === 'buried';
  const TYPE_LABEL = { PC: 'Pipe culverts', BC: 'Box culverts', CC: 'Cattle crossings', T16: 'Underpass water passages', WD: 'Water descents', 'D-SD': 'Slope descents', BRG: 'Railway bridges', OP: 'Road overbridges' };
  // The drainage type of a feature, as a tab: 'Type 9 shoulder ditch', 'Box culverts'.
  function typeOf(f) {
    const span = isSpan(f);
    if (span && /^CH-/.test(f.code || '')) return { key: 'CH', label: 'Diversion channels', span };
    if (span && f.code === 'MD') return { key: 'MD', label: 'Approach and earth toe ditches', span };
    if (span) return { key: f.code || f.catKey, label: f.name, span };
    return { key: (f.code || f.catKey) + '.pt', label: TYPE_LABEL[f.code] || f.catLabel, span };
  }
  function progressOf(feats) {
    const o = { pts: { n: 0, done: 0 }, lin: { n: 0, done: 0, m: 0, doneM: 0 }, part: 0, stalled: 0 };
    feats.forEach(f => {
      const st = statusOf(f);
      if (st.removed) return;
      if (st.bucket === 'moving') o.part++;
      if (st.bucket === 'stalled') { o.part++; o.stalled++; }
      if (isSpan(f)) {
        const len = f.ch1 - f.ch0;
        o.lin.n++; o.lin.m += len;
        if (st.cover) o.lin.doneM += st.cover.m; else if (st.bucket === 'done') o.lin.doneM += len;
        if (st.bucket === 'done') o.lin.done++;
      } else { o.pts.n++; if (st.bucket === 'done') o.pts.done++; }
    });
    return o;
  }
  // The types in a sub-section with their own progress, in the order of the drawing categories.
  function typeProgress(sub) {
    const by = {};
    (data.bySub[sub] || []).forEach(f => { const t = typeOf(f); (by[t.key] = by[t.key] || { key: t.key, label: t.label, span: t.span, cat: CAT_ORDER.indexOf(f.catKey), feats: [] }).feats.push(f); });
    return Object.values(by).sort((a, b) => a.cat - b.cat || (a.span === b.span ? (a.label < b.label ? -1 : 1) : a.span ? -1 : 1))
      .map(g => Object.assign(g, { p: progressOf(g.feats) }));
  }

  // Drafts (defect sheets not finished).
  function drafts() { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDraft(fid, d) {
    const all = drafts();
    if (d) all[fid] = Object.assign({}, d, { at: new Date().toISOString() }); else delete all[fid];
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------ photos (IDB)
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const q = indexedDB.open('kmd-walk-photos', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('photos');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    return dbp;
  }
  function putPhoto(id, blob) {
    return db().then(d => new Promise((res, rej) => {
      const tx = d.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(blob, id);
      tx.oncomplete = () => res(id); tx.onerror = () => rej(tx.error);
    }));
  }
  function getPhoto(id) {
    return db().then(d => new Promise((res) => {
      const q = d.transaction('photos').objectStore('photos').get(id);
      q.onsuccess = () => res(q.result || null); q.onerror = () => res(null);
    })).catch(() => null);
  }

  // ---------------------------------------------------------- position
  const R_EARTH = 6371008.8;
  function project(sub, lat, lon) {
    const pts = data.centre[sub];
    if (!pts || pts.length < 2) return null;
    const k = Math.cos(lat * Math.PI / 180);
    const toXY = q => [(q.lon - lon) * Math.PI / 180 * R_EARTH * k, (q.lat - lat) * Math.PI / 180 * R_EARTH];
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = toXY(pts[i]), b = toXY(pts[i + 1]);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      if (!L2) continue;
      let t = -(a[0] * dx + a[1] * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + t * dx, py = a[1] + t * dy;
      const d2 = px * px + py * py;
      if (!best || d2 < best.d2) {
        // cross > 0: the point (origin) lies to the left of the increasing direction
        const cross = dx * (0 - a[1]) - dy * (0 - a[0]);
        const len = Math.sqrt(L2);
        best = { d2, ch: pts[i].pk + t * (pts[i + 1].pk - pts[i].pk), offset: Math.sign(cross) * Math.sqrt(d2), bearing: Math.atan2(dx, dy) * 180 / Math.PI, len };
      }
    }
    return best;
  }
  function pointAt(sub, ch, offset) {
    const pts = data.centre[sub];
    if (!pts || !pts.length) return null;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].pk < ch) i++;
    const a = pts[i], b = pts[i + 1] || a;
    const t = b.pk === a.pk ? 0 : Math.max(0, Math.min(1, (ch - a.pk) / (b.pk - a.pk)));
    let lat = a.lat + t * (b.lat - a.lat), lon = a.lon + t * (b.lon - a.lon);
    if (offset) {
      const k = Math.cos(lat * Math.PI / 180);
      const ex = (b.lon - a.lon) * k, ny = (b.lat - a.lat);
      const n = Math.hypot(ex, ny) || 1;
      // left normal of (ex, ny) is (-ny, ex)
      const lx = -ny / n, ly = ex / n;
      lat += (ly * offset) / R_EARTH * 180 / Math.PI;
      lon += (lx * offset) / (R_EARTH * k) * 180 / Math.PI;
    }
    return { lat, lon };
  }

  function laneOf(offset) {
    const a = Math.abs(offset);
    if (a < 1.75) return 'cl';
    if (a < 5.5) return 'plat';
    if (a < 10.5) return 'face';
    if (a < 18) return 'toe';
    if (a < 36) return 'crest';
    return 'off';
  }

  function savePosition(p) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ line: p.line, sub: p.sub, ch: p.ch, facing: p.facing })); } catch (e) { /* ignore */ }
  }
  function lastPosition() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch (e) { return null; }
  }

  // ------------------------------------------------------------ exports
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  loadRecords();

  window.DI = {
    LINES, SUBS, LANES, LANE_OFFSET, CAT_ORDER, data,
    init, hasData, subAt, featuresNear, loadIRs, claimOf, migrateCulvertStages,
    fmtCh, fmtPlus, parseCh, fmtDate, fmtTime, monthsBetween, esc, DAYS, MONTHS,
    inspector, setInspector, addRecord, voidRecord, live, recordsFor, seenOf, ownSeen, openDefects,
    designChanges, statusOf, drafts, saveDraft, putPhoto, getPhoto, uid, loadLegacy,
    loadSections, sectionAt, loadT9Schedule, hasT9Schedule, rangeable, coverOf, addRange, rangeNote, parseRangeNote, isSpan, typeOf, progressOf, typeProgress, T9_SCHEDULE_ON, refs, refsNear, refById, REF_KIND, loadHeights, hasHeights, heightAt, T9_RULES, t9Rule, setT9Rule, t9Check,
    PRESETS, presetOf, applyBase, baseRecords, correctBase, addBase, deleteBase, verifyBase, unverifyBase, exportGeo, exportCorrections, importRecords,
    project, pointAt, laneOf, savePosition, lastPosition, csvCell,
    get records() { return records; }
  };
})();
