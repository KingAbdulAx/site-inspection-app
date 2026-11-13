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
  // Stages by how a drain is built (Abdul, 12 Nov 2026).
  //   cast in situ: excavate, prepare the surface to shape, formwork (the side profile), reinforcement,
  //                 cast; Completed / approved once the formwork is struck.
  //   precast (Type 9 half-round units, chutes, dissipators): excavate, light blinding, place, then mortar
  //                 the joints and the gap the excavation left. Mortared is finished.
  //   unlined: excavate, then profile.
  //   Type 6 French drain: as built on site (stone dust replaced the sharp sand of the design).
  const LADDER_INSITU = ['Not started', 'Excavation', 'Surface prep', 'Formwork', 'Reinforcement', 'Cast', 'Completed / approved'];
  const LADDER_CONCRETE = LADDER_INSITU;
  const LADDER_UNLINED = ['Not started', 'Excavation', 'Profiling'];
  const LADDER_PRECAST = ['Not started', 'Excavation', 'Blinding', 'Placed', 'Mortared'];
  // Type 9 is precast like the rest; the contractor reports a stretch only when it is done, and the
  // office import writes it as finished, but the stages between can be recorded on the phone.
  const LADDER_T9 = LADDER_PRECAST;
  const LADDER_FRENCH = ['Not started', 'Excavation', 'Stone dust bedding', 'Pipe laid', 'Gravel to half height', 'Concrete wash', 'Geotextile laid', 'Washed gravel', 'Geotextile wrapped'];
  // The cast-in-place ladder before 12 Nov 2026. IR claims are indexed on it, and older records name its stages.
  const OLD_CONCRETE = ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'];
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
    const name = OLD_CONCRETE[Math.max(0, Math.min(OLD_CONCRETE.length - 1, i))];
    if (name === 'Completed') return f.ladder.length - 1;
    if (name === 'Rebar' || name === 'Shuttered' || name === 'Concreted') return f.ladder.indexOf('Installed');
    if (name === 'Blinding') return f.ladder.indexOf('Bedding');
    return f.ladder.indexOf(name) < 0 ? 0 : f.ladder.indexOf(name);
  }

  // A stage named on another (older) ladder, said on this feature's ladder. Exact names win; otherwise
  // by what the old name meant on site. On the old cast-in-place ladder Rebar came before Shuttered; on
  // site the formwork goes up first and the steel follows, so either one means the reinforcement is in.
  const STAGE_ALIAS = {
    insitu: { Excavated: 1, Excavation: 1, Blinding: 2, Bedding: 2, Rebar: 4, Shuttered: 4, Placed: 4, Installed: 4, Concreted: 5, Completed: 6, Mortared: 6 },
    precast: { Excavated: 1, Bedding: 2, 'Surface prep': 2, Rebar: 3, Shuttered: 3, Formwork: 3, Reinforcement: 3, Installed: 3, Concreted: 3, Cast: 3, Completed: 4, 'Completed / approved': 4 },
    unlined: { Excavated: 1, Blinding: 1, Bedding: 1, 'Surface prep': 1, Rebar: 1, Shuttered: 1, Placed: 1, Concreted: 1, Completed: 2 },
    french: { Excavated: 1, Blinding: 2, Bedding: 2, 'Surface prep': 2, Rebar: 3, Shuttered: 3, Placed: 3, Concreted: 3, Completed: 8, 'Completed / approved': 8 }
  };
  function ladderKind(l) {
    return l === LADDER_INSITU ? 'insitu' : l === LADDER_PRECAST ? 'precast' : l === LADDER_UNLINED ? 'unlined' : l === LADDER_FRENCH ? 'french' : isCulvertLadder(l) ? 'culvert' : 'other';
  }
  function stageByName(f, name) {
    if (name == null) return null;
    const i = f.ladder.indexOf(name);
    if (i >= 0) return i;
    const k = ladderKind(f.ladder);
    if (k === 'culvert') { const j = OLD_CONCRETE.indexOf(name); return j >= 0 ? fromConcrete(f, j) : null; }
    const a = STAGE_ALIAS[k];
    if (a && a[name] != null) return Math.min(a[name], f.ladder.length - 1);
    if (name === 'Completed' || name === 'Completed / approved' || name === 'Mortared') return f.ladder.length - 1;
    return null;
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
    'Miscellaneous': { key: 'misc', label: 'Miscellaneous', lane: 'toe', kind: 'linear' },
    'Connector': { key: 'connector', label: 'Connectors', lane: 'toe', kind: 'point' }
  };
  const CAT_ORDER = ['cross', 'toe', 'descent', 'riprap', 'diversion', 'shoulder', 'side', 'underpass', 'track', 'berm', 'crest', 'dissipator', 'connector', 'bridge', 'misc'];

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
        code = 'T9'; typeKey = '9'; name = 'Type 9 shoulder ditch'; icon = 'half'; ladder = LADDER_PRECAST;
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
        if (/Discharge/i.test(t)) { kind = 'point'; lane = 'toe'; } else ladder = LADDER_FRENCH;
        break;
      case 'dissipator':
        code = 'D-SD'; name = 'Energy dissipator'; icon = 'dissip'; ladder = LADDER_PRECAST;
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
    T9: P('shoulder', 'T9', 'Type 9 shoulder ditch', 'plat', 'linear', 'half', LADDER_PRECAST, '9'),
    T4: P('toe', 'T4', 'Type 4 toe ditch, unlined', 'toe', 'linear', 'vee-dash', LADDER_UNLINED, '4'),
    T7: P('toe', 'T7', 'Type 7 toe ditch', 'toe', 'linear', 'vee', null, '7'),
    T12: P('toe', 'T12', 'Type 12 toe ditch', 'toe', 'linear', 'trap', null, '12'),
    T13: P('toe', 'T13', 'Type 13 rectangular toe ditch', 'toe', 'linear', 'trap', null, '13'),
    T14: P('toe', 'T14', 'Type 14 convergence ditch', 'toe', 'linear', 'vee', null, '14'),
    T8: P('berm', 'T8', 'Type 8 bench ditch', 'face', 'linear', 'half', null, '8'),
    T5: P('crest', 'T5', 'Type 5 crest ditch, unlined', 'crest', 'linear', 'vee-dash', LADDER_UNLINED, '5'),
    T11: P('crest', 'T11', 'Type 11 crest ditch', 'crest', 'linear', 'vee', null, '11'),
    T6: P('track', 'T6', 'Type 6 collector drain', 'cl', 'buried', 'collector', LADDER_FRENCH, '6'),
    WD: P('descent', 'WD', 'Water descent, precast', 'face', 'point', 'descent', LADDER_PRECAST),
    RIP: P('riprap', '', 'Riprap protection', 'face', 'label', 'riprap', LADDER_RIPRAP),
    BC: P('cross', 'BC', 'Box culvert', 'across', 'cross', 'box', LADDER_BOX),
    PC: P('cross', 'PC', 'Pipe culvert', 'across', 'cross', 'pipe', LADDER_PIPE),
    T16: P('underpass', 'T16', 'Underpass water passage', 'across', 'cross', 'arch', null, '16'),
    'CH-A': P('diversion', 'CH-A', 'Diversion channel, earth', 'off', 'linear', 'divert', LADDER_UNLINED),
    'CH-B': P('diversion', 'CH-B', 'Diversion channel, concrete', 'off', 'linear', 'divert'),
    'CH-C': P('diversion', 'CH-C', 'Diversion channel with embankments', 'off', 'linear', 'divert'),
    'CH-R': P('diversion', 'CH-R', 'Rectangular channel', 'off', 'linear', 'divert'),
    'D-SOZ': P('dissipator', 'D-SOZ', 'Spread-out zone dissipator', 'toe', 'point', 'dissip', LADDER_PRECAST),
    'D-SD': P('dissipator', 'D-SD', 'Slope descent dissipator', 'toe', 'point', 'dissip', LADDER_PRECAST),
    'D-TC': P('dissipator', 'D-TC', 'Trapezoidal channel dissipator', 'toe', 'point', 'dissip', LADDER_PRECAST),
    'D-ST': P('dissipator', 'D-ST', 'Stool ditch dissipator', 'toe', 'point', 'dissip', LADDER_PRECAST),
    'D-RF': P('dissipator', 'D-RF', 'Rockfill dissipator', 'toe', 'point', 'dissip', LADDER_RIPRAP),
    BRG: P('bridge', 'BRG', 'Railway bridge', 'across', 'cross', 'bridge'),
    OP: P('bridge', 'OP', 'Road overbridge', 'across', 'cross', 'bridge'),
    UP: P('underpass', 'UP', 'Road underpass', 'across', 'cross', 'arch'),
    CC: P('cross', 'CC', 'Cattle crossing', 'across', 'cross', 'box', LADDER_BOX),
    MD: P('misc', 'MD', 'Culvert approach ditch', 'toe', 'linear', 'trap', LADDER_UNLINED),
    CB: P('connector', 'CB', 'Connection box', 'toe', 'point', 'cbox'),
    MH: P('connector', 'MH', 'Manhole', 'cl', 'point', 'mh', LADDER_PRECAST),
    MHG: P('connector', 'MHG', 'Manhole, grid cover', 'cl', 'point', 'mh', LADDER_PRECAST),
    PO: P('connector', 'PO', 'Outlet pipe', 'toe', 'point', 'outlet', LADDER_PRECAST)
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
    migrateStageNames();
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
    migrateStageNames();
  }
  // ------------------------------------------------ connectors
  // Where a drain ends and what it runs into, from the drainage plans (data/connectors.json, made by
  // scripts/dwg/build_connectors.js): connection boxes, manholes, grid-cover manholes and outlet pipes become
  // features of their own (they are built, so they have stages); a dissipator of the plans is the app's own.
  // ends: what each ditch end runs into; geom: where the plans draw each ditch (chainage and true offset).
  const CONN = { box: 'CB', manhole: 'MH', grid: 'MHG', pipe: 'PO' };
  // The lane a true offset falls in, for the strip.
  function laneOf(off) {
    const a = Math.abs(off);
    return a < 2 ? 'cl' : a < 5.75 ? 'plat' : a < 10.75 ? 'face' : a < 18.75 ? 'toe' : a < 37 ? 'crest' : 'off';
  }
  function loadConnectors(j) {
    Object.keys(data.pristine).forEach(sub => { data.pristine[sub] = data.pristine[sub].filter(f => !f.conn); });
    data.connEnds = j.ends || {};
    data.geom = j.geom || {};
    data.connAt = {};      // feature id -> [{ id, end }] of the connectors it touches
    Object.keys(j.subs || {}).forEach(sub => {
      if (!SUBS[sub] || !data.pristine[sub]) return;
      const list = j.subs[sub];
      // the manhole nearest each outlet pipe (within 60 m) is the outlet's
      const exits = new Set();
      list.filter(c => c.kind === 'pipe').forEach(o => {
        const m = list.filter(c => c.kind === 'manhole' && Math.abs(c.ch - o.ch) < 60).sort((a, b) => Math.hypot(a.ch - o.ch, a.off - o.off) - Math.hypot(b.ch - o.ch, b.off - o.off))[0];
        if (m) exits.add(m.id);
      });
      list.forEach(c => {
        c.links.forEach(([fid, end]) => (data.connAt[fid] = data.connAt[fid] || []).push({ id: c.id, end }));
        if (c.app) {        // the app's own dissipator: it only gains its links
          (data.connAt[c.id] = data.connAt[c.id] || []).push(...c.links.map(([fid, end]) => ({ id: fid, end: end === 'a' ? 'start' : end === 'b' ? 'end' : end, of: true })));
          return;
        }
        const code = CONN[c.kind];
        const pr = PRESETS[code];
        // a manhole at the outlet of a collector drain is cast in situ; the rest are precast rings
        const exit = exits.has(c.id);
        const ladder = c.kind === 'box' ? LADDER_INSITU : exit ? LADDER_INSITU : pr.ladder;
        const lane = c.kind === 'manhole' || c.kind === 'grid' ? (Math.abs(c.off) < 20 ? 'cl' : laneOf(c.off)) : laneOf(c.off);
        const name = c.kind === 'box' ? 'Connection box' + (c.type && /^Type/.test(c.type) ? ', ' + c.type.toLowerCase() : '') : exit ? 'Manhole at the outlet' : pr.name;
        const f = {
          id: c.id, sub, line: SUBS[sub].line, catKey: 'connector', catLabel: CAT_LABEL.connector, kind: 'point', lane,
          side: c.side, ch0: c.ch, ch1: c.ch, cert: 'derived', code, typeKey: null, name, full: name + (c.block ? ' (' + c.block + ')' : ''),
          icon: pr.icon, ladder, sheet: '', drawings: [], level: null, onHold: false, confidence: '', specs: c.block || '', notes: '', stated: null,
          raw: {}, offset: c.off, conn: { kind: c.kind, type: c.type, block: c.block, exit, links: c.links }
        };
        data.pristine[sub].push(f);
      });
    });
    applyBase();
    migrateStageNames();
  }
  function hasConnectors() { return !!data.connAt; }
  // What a ditch's start and end run into: { start: feature|null, end: feature|null }; and for a connector or
  // a dissipator, what runs into it.
  function endsOf(f) {
    const e = (data.connEnds || {})[f.id] || {};
    return { start: e.a ? data.byId[e.a] || null : null, end: e.b ? data.byId[e.b] || null : null };
  }
  function joinsOf(f) {
    if (f.conn) return f.conn.links.map(([fid, end]) => ({ f: data.byId[fid], end: end === 'a' ? 'start' : end === 'b' ? 'end' : end })).filter(x => x.f);
    return ((data.connAt || {})[f.id] || []).filter(x => x.of).map(x => ({ f: data.byId[x.id], end: x.end })).filter(x => x.f);
  }
  // Where the plans draw a ditch: pieces [ch, offset, ch, offset]; none for one the plans do not have.
  function geomOf(f) { return (data.geom || {})[f.id] || null; }
  // Where the schedule is switched on: every section.
  const T9_SCHEDULE_ON = ['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB'];
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
    const feats = (data.bySub[sub] || []).filter(f => !statusOf(f).removed && !f.absorbedInto);
    const on = (codes, side, ch) => feats.some(f => { if (!codes.includes(f.code) || f.side !== side) return false; const [c0, c1] = extentEnds(f); return ch >= c0 - 5 && ch <= c1 + 5; });
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
    crossing: { label: 'Road crossing', short: 'ROAD' },
    station: { label: 'Station', short: 'STATION' },
    yard: { label: 'Freight yard', short: 'YARD' }
  };
  // Stations and yards (data/structures.js, KMD_STATIONS) run along the line like a bridge, beside it.
  const isArea = r => r.kind === 'station' || r.kind === 'yard';
  let refList = null;
  function refs() {
    if (refList) return refList;
    refList = [];
    const src = window.KMD_STRUCTURES || {};
    Object.keys(src).forEach(sub => {
      if (!SUBS[sub]) return;
      (src[sub].structures || []).forEach(s => refList.push(Object.assign({ sub, line: SUBS[sub].line, source: src[sub].source }, s, REF_KIND[s.kind] || REF_KIND.crossing, { kind: s.kind })));
    });
    (window.KMD_STATIONS || []).forEach(s => {
      if (!SUBS[s.sub]) return;
      const k = REF_KIND[s.kind];
      refList.push(Object.assign({ line: SUBS[s.sub].line, source: s.src }, s, k, { kind: s.kind, area: true,
        label: s.kind === 'yard' ? (s.what === 'maintenance' ? 'Maintenance centre' : 'Freight yard') : 'Station',
        short: s.kind === 'yard' ? (s.what === 'maintenance' ? 'DEPOT' : 'YARD') : 'STATION' }));
    });
    refList.sort((a, b) => a.ch0 - b.ch0);
    return refList;
  }
  // The stations and yards at a chainage (a station's track area; a yard's extent).
  function areasAt(line, ch, pad) {
    const p = pad || 0;
    return refs().filter(r => r.area && r.line === line && ch >= r.ch0 - p && ch <= r.ch1 + p);
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
    // IR stages are indexed on the old cast-in-place ladder: said on this feature's ladder by meaning
    const k = Math.max(0, Math.min(OLD_CONCRETE.length - 1, best.stage));
    const named = isCulvertLadder(f.ladder) ? fromConcrete(f, best.stage) : f.ladder === LADDER_INSITU || f.ladder.length === OLD_CONCRETE.length ? best.stage : (k === 0 ? 0 : stageByName(f, OLD_CONCRETE[k]));
    const stage = named == null ? best.stage : named;
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
  // Stage records said on a ladder that has since changed (12 Nov 2026: stages by construction method).
  // Each record names its stage; say it on the feature's ladder now, by meaning, once. The name it had is kept.
  function migrateStageNames() {
    let n = 0;
    records.forEach(r => {
      if (r.kind !== 'stage') return;
      const f = data.byId[r.featureId];
      if (!f || isCulvertLadder(f.ladder)) return;
      if (r.stageName == null) {
        if (r.stage >= f.ladder.length) { r.stage = f.ladder.length - 1; n++; }
        r.stageName = f.ladder[r.stage];
        return;
      }
      if (f.ladder[r.stage] === r.stageName) return;
      const j = stageByName(f, r.stageName);
      if (j == null) return;
      r.wasStage = { stage: r.stage, name: r.stageName };
      r.stage = j; r.stageName = f.ladder[j];
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
    if (r.kind === 'extent') { applyExtents(); applyJoins(); }
    if (r.kind === 'join') { applyJoins(); }
    if (r.kind === 'stage' || r.kind === 'defect' || r.kind === 'range' || r.kind === 'extent' || r.kind === 'join') mirrorLegacy(r.featureId || r.into);
    if (r.kind === 'base') applyBase();
    return r;
  }
  function voidRecord(id) {
    if (live(r => r.id === id).length === 0) return null;
    const r = addRecord({ kind: 'void', target: id });
    const t = records.find(x => x.id === id);
    if (t && t.kind === 'base') applyBase();
    else if (t && (t.kind === 'extent' || t.kind === 'join')) { applyExtents(); applyJoins(); mirrorLegacy(t.featureId || t.into); }
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
    applyExtents();
    applyJoins();
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
  // The database's status column is coarse (the old app's five words); the stage detail of a drain
  // travels in the notes ('[stages …]', below). An exact stage name of a culvert ladder goes as it is.
  function toLegacyStatus(f, s) {
    const name = f.ladder[s];
    if (!s) return 'Not Started';
    if (s === f.ladder.length - 1) return 'Completed & Approved';
    if (isCulvertLadder(f.ladder)) return name;
    const k = ladderKind(f.ladder);
    if (k === 'insitu') return s >= 5 ? 'Concreted' : s >= 3 ? 'Rebar / Shuttering' : s === 2 ? 'Blinding' : 'Excavation';
    if (k === 'precast' || k === 'french') return s >= 3 ? 'Rebar / Shuttering' : s === 2 ? 'Blinding' : 'Excavation';
    if (name === 'Geotextile laid') return 'Blinding';
    return 'Excavation';
  }
  // A status from the database, on this feature's ladder (null: not a stage of it).
  function legacyStage(f, status) {
    if (!status || status === 'Not Started') return 0;
    if (status === 'Completed & Approved') return f.ladder.length - 1;
    const i = f.ladder.indexOf(status);
    if (i >= 0) return i;
    if (status === 'Rebar / Shuttering') {
      const k = ladderKind(f.ladder);
      return k === 'culvert' ? f.ladder.indexOf('Installed') : k === 'unlined' ? 1 : Math.min(3, f.ladder.length - 1);
    }
    return stageByName(f, status);
  }
  function loadLegacy() {
    legacy = {};
    Object.values(LEGACY_KEYS).forEach(k => {
      try { Object.assign(legacy, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { /* ignore */ }
    });
    window.appState = window.appState || {};
    window.appState.inspections = legacy;
    applyExtents();
    applyJoins();
  }
  function mirrorLegacy(fid) {
    const f = data.byId[fid];
    if (!f) return;
    const seen = ownSeen(fid);
    const defects = openDefects(fid);
    const now = new Date().toISOString();
    // A drain along the line says in its notes how much is at which stage; the status says only how far
    // it has got: finished, part finished ('Concreted'), or the furthest stage anywhere on it.
    if (rangeable(f)) adoptForeignRanges(f);
    adoptForeignExtent(f);
    const cov = rangeable(f) ? coverOf(f) : null;
    let status = seen ? toLegacyStatus(f, seen.stage) : 'Not Started';
    let notes = defects.map(d => d.defect + (d.note ? ': ' + d.note : '')).join(' | ');
    if (rangeable(f)) status = 'Not Started';
    if (cov) {
      const max = f.ladder.length - 1;
      status = cov.full ? toLegacyStatus(f, max) : cov.m > 0 ? 'Concreted' : toLegacyStatus(f, Math.min(cov.top, max - 1));
      notes = [notes, rangeNote(cov.ranges, f.code), stageNote(f, cov.segs)].filter(Boolean).join(' | ');
    }
    if (f.built) {
      notes = [notes, extentNote(f.built)].filter(Boolean).join(' | ');
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
    // An office row names a stage: exactly on this ladder ('Installed', 'Wing walls'), or in the old words.
    if (lg && lg.source !== 'walk' && lg.status && fl && lg.status !== 'Not Started') {
      const st = legacyStage(fl, lg.status);
      const at = lg.updated_at || (lg.date ? lg.date.replace(' ', 'T') : null);
      if (st != null && st > 0 && (!own || (at && at > own.at))) return { stage: st, at, by: lg.inspected_by || 'office', office: true, note: lg.notes || '' };
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
  // ------------------------------------------------ progress by length, by stage
  // Every drain that runs along the line is built a bit at a time, so it is tracked by ranges: 'from X to Y
  // is at Formwork'. A range carries the stage it reached; a higher stage means the lower ones are done over
  // the same length. Records are append-only like all the rest; undo voids one. A stage recorded for the
  // whole run counts as that stage over all of it. A range with no stage (Type 9, before 12 Nov 2026) is
  // finished.
  const isSpanF = f => f.kind === 'linear' || f.kind === 'buried';
  const rangeable = f => !!f && isSpanF(f) && !isCulvertLadder(f.ladder) && f.ladder.length > 1 && f.ch1 - f.ch0 > 1;
  function mergeRanges(list) {
    const out = [];
    list.slice().sort((a, b) => a[0] - b[0]).forEach(([a, b]) => {
      const last = out[out.length - 1];
      if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b); else out.push([a, b]);
    });
    return out;
  }
  // The ranges travel to the cloud database in the row's notes, since the table has no column for them,
  // chainages in metres:
  //   finished       '[T9 done 20900 to 21000; 21100 to 21225]' (a Type 9; '[done …]' for any other drain)
  //   in between     '[stages Excavation: 20900 to 21300; Formwork: 21000 to 21100]', each length under the
  //                  highest stage it reached
  // The office import writes the same. A Type 9 row keeps its old form, which phones on an older app read.
  const RANGE_NOTE = /\[(?:T9 )?done ([^\]]*)\]/;
  const STAGE_NOTE = /\[stages ([^\]]*)\]/;
  const r1 = n => Math.round(n * 10) / 10;
  const rangeList = ranges => ranges.map(([a, b]) => r1(a) + ' to ' + r1(b)).join('; ');
  function rangeNote(ranges, code) {
    return ranges.length ? '[' + (code === undefined || code === 'T9' ? 'T9 ' : '') + 'done ' + rangeList(ranges) + ']' : '';
  }
  function parsePairs(txt) {
    return String(txt).split(/[;,]/).map(x => x.trim().match(/^(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)$/)).filter(Boolean).map(x => [Number(x[1]), Number(x[2])]).filter(r => r[1] > r[0]);
  }
  function parseRangeNote(notes) {
    const m = RANGE_NOTE.exec(notes || '');
    return m ? parsePairs(m[1]) : [];
  }
  // '[stages …]' from segments [{a, b, s}] of a feature: the in-between stages only (finished goes in '[done …]').
  function stageNote(f, segs) {
    const max = f.ladder.length - 1, by = {};
    segs.forEach(g => { if (g.s > 0 && g.s < max) (by[g.s] = by[g.s] || []).push([g.a, g.b]); });
    const ks = Object.keys(by).map(Number).sort((x, y) => x - y);
    return ks.length ? '[stages ' + ks.map(k => f.ladder[k] + ': ' + by[k].map(([a, b]) => r1(a) + ' to ' + r1(b)).join(', ')).join('; ') + ']' : '';
  }
  // [{name, a, b}] from '[stages …]'
  function parseStageNote(notes) {
    const m = STAGE_NOTE.exec(notes || '');
    if (!m) return [];
    const out = [];
    m[1].split(';').forEach(part => {
      const i = part.indexOf(':');
      if (i < 0) return;
      const name = part.slice(0, i).trim();
      parsePairs(part.slice(i + 1)).forEach(([a, b]) => out.push({ name, a, b }));
    });
    return out;
  }
  // Metres named in a row's notes, any stage: to tell whether an office row grew.
  function noteMetres(notes) {
    return parseRangeNote(notes).concat(parseStageNote(notes).map(x => [x.a, x.b])).reduce((m, [a, b]) => m + b - a, 0);
  }
  // Rows the office import wrote before ranges were kept for every ditch: 'N of L m executed (20+900–21+000, …)'.
  function parseExecutedNote(notes) {
    const m = /m executed \(([^)]*)\)/.exec(notes || '');
    if (!m) return [];
    return m[1].split(',').map(x => x.trim().split('–')).filter(x => x.length === 2).map(([a, b]) => [parseCh(a), parseCh(b)]).filter(([a, b]) => !isNaN(a) && !isNaN(b) && b > a);
  }
  // What the database holds that this phone has no record of (the office import, another phone), as
  // [a, b, stage]. A row this phone wrote itself (source 'walk') is already in its own records, so undoing
  // one stays undone. Ranges in the notes are the authority; with none, the status is the whole run's stage.
  function foreignStaged(f) {
    const lg = legacy[f.id];
    if (!lg || lg.source === 'walk') return [];
    const max = f.ladder.length - 1;
    const out = parseRangeNote(lg.notes).map(([a, b]) => [a, b, max]);
    parseStageNote(lg.notes).forEach(x => { const k = stageByName(f, x.name); if (k != null && k > 0) out.push([x.a, x.b, k]); });
    if (out.length) return out;
    const st = legacyStage(f, lg.status);
    if (!st) return [];
    const ex = parseExecutedNote(lg.notes);
    if (ex.length && st < max) return ex.map(([a, b]) => [a, b, st]);
    const [p0, p1] = extentEnds(f);
    return [[p0, p1, st]];
  }
  function foreignRanges(f) { return foreignStaged(f).filter(x => x[2] >= f.ladder.length - 1).map(([a, b]) => [a, b]); }
  // Before this phone writes over such a row, what it holds becomes the phone's own records (undoable like
  // the rest), so the row it writes still carries it.
  function adoptForeignRanges(f) {
    const lg = legacy[f.id];
    const max = f.ladder.length - 1;
    const [ch0, ch1] = extentEnds(f);
    const got = foreignStaged(f).map(([a, b, k]) => [Math.max(ch0, a), Math.min(ch1, b), k]).filter(r => r[1] - r[0] >= 0.5);
    got.forEach(([a, b, k]) => {
      const mine = live(r => r.kind === 'range' && r.featureId === f.id).some(r => Math.abs(r.from - a) < 0.2 && Math.abs(r.to - b) < 0.2 && (r.stage == null ? max : r.stage) === k);
      if (!mine) records.push({ id: uid(), at: (lg && lg.updated_at) || new Date().toISOString(), by: (lg && lg.inspected_by) || 'office', kind: 'range', featureId: f.id, from: a, to: b, stage: k, stageName: f.ladder[k], line: f.line, sub: f.sub, ch: a, pos: null, imported: true });
    });
    if (got.length) saveRecords();
  }
  // Highest stage at each point, as segments [{a, b, s}] over [ch0, ch1].
  function segmentsOf(items, ch0, ch1) {
    const xs = [ch0, ch1];
    items.forEach(([a, b]) => { if (a > ch0 && a < ch1) xs.push(a); if (b > ch0 && b < ch1) xs.push(b); });
    const pts = [...new Set(xs.map(x => Math.round(x * 100) / 100))].sort((x, y) => x - y);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], mid = (a + b) / 2;
      let s = 0;
      items.forEach(([p, q, k]) => { if (p <= mid && q >= mid && k > s) s = k; });
      if (!s) continue;
      const last = segs[segs.length - 1];
      if (last && last.s === s && Math.abs(last.b - a) < 0.5) last.b = b; else segs.push({ a, b, s });
    }
    return segs;
  }
  function coverOf(f) {
    if (!rangeable(f)) return null;
    const max = f.ladder.length - 1;
    const pieces = (f.absorbed && f.absorbed.length) ? [f, ...f.absorbed] : [f];
    const items = [], recs = [];
    let foreignN = 0, lastAt = null;
    const later = at => { if (at && (!lastAt || at > lastAt)) lastAt = at; };
    pieces.forEach(p => {
      const pmax = p.ladder.length - 1;
      const on = k => Math.min(max, k == null ? max : k === pmax ? max : k);
      live(r => r.kind === 'range' && r.featureId === p.id).forEach(r => { recs.push(r); items.push([r.from, r.to, on(r.stage)]); later(r.at); });
      const own = ownSeen(p.id);
      if (own && own.stage > 0) { const [p0, p1] = extentEnds(p); items.push([p0, p1, on(own.stage)]); recs.push({ from: p0, to: p1, at: own.at, stage: own.stage, whole: true }); later(own.at); }
      const fr = foreignStaged(p);
      if (fr.length) {
        foreignN += fr.length;
        fr.forEach(([a, b, k]) => items.push([a, b, on(k)]));
        const lg = legacy[p.id];
        later(lg && (lg.updated_at || (lg.date || '').replace(' ', 'T')));
      }
    });
    if (!items.length) return null;
    const [ch0, ch1] = extentEnds(f);
    const clipped = items.map(([a, b, k]) => [Math.max(ch0, Math.min(a, b)), Math.min(ch1, Math.max(a, b)), k]).filter(r => r[1] > r[0] && r[2] > 0);
    const segs = segmentsOf(clipped, ch0, ch1);
    const len = ch1 - ch0;
    const byStage = [], mAt = [];
    for (let k = 0; k <= max; k++) {
      byStage[k] = k === 0 ? [[ch0, ch1]] : mergeRanges(segs.filter(g => g.s >= k).map(g => [g.a, g.b]));
      mAt[k] = k === 0 ? len : byStage[k].reduce((n, [a, b]) => n + b - a, 0);
    }
    let floor = 0;
    for (let k = 1; k <= max; k++) if (mAt[k] >= len - 1) floor = k;
    const top = segs.reduce((n, g) => Math.max(n, g.s), 0);
    if (!top) return null;
    return { ranges: byStage[max], m: mAt[max], len, full: mAt[max] >= len - 1, lastAt, records: recs, foreign: foreignN, segs, byStage, mAt, top, floor, max };
  }
  // A length at a stage (the last stage when none is given).
  function addRange(fid, from, to, pos, stage) {
    let f = data.byId[fid];
    if (f && f.absorbedInto) { fid = f.absorbedInto; f = data.byId[fid]; }
    if (!f || !rangeable(f)) return null;
    const max = f.ladder.length - 1;
    const k = stage == null ? max : Math.max(1, Math.min(max, Math.round(stage)));
    const [ch0, ch1] = extentEnds(f);
    const a = Math.max(ch0, Math.min(from, to)), b = Math.min(ch1, Math.max(from, to));
    if (!(b - a >= 0.5)) return null;
    return addRecord({ kind: 'range', featureId: fid, from: r1(a), to: r1(b), stage: k, stageName: f.ladder[k], line: f.line, sub: f.sub, ch: a, pos: pos || null });
  }

  // ------------------------------------------------ as-built extents
  // A feature built longer or shorter than the design. Design ends f.ch0/f.ch1 are never changed.
  // The latest live extent record wins. Zero or negative length is rejected.
  const EXTENT_NOTE = /\[extent (-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)\]/;
  function extentNote(built) {
    return built ? '[extent ' + Math.round(built.ch0 * 10) / 10 + ' to ' + Math.round(built.ch1 * 10) / 10 + ']' : '';
  }
  function parseExtentNote(notes) {
    const m = EXTENT_NOTE.exec(notes || '');
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]);
    return b > a ? [a, b] : null;
  }
  function foreignExtent(f) {
    const lg = legacy[f.id];
    return lg && lg.source !== 'walk' ? parseExtentNote(lg.notes) : null;
  }
  function adoptForeignExtent(f) {
    const lg = legacy[f.id];
    const got = foreignExtent(f);
    if (!got) return;
    const [a, b] = got;
    if (b - a < 0.5) return;
    const mine = live(r => r.kind === 'extent' && r.featureId === f.id).some(r => Math.abs(r.from - a) < 0.2 && Math.abs(r.to - b) < 0.2);
    if (!mine) {
      records.push({ id: uid(), at: (lg && lg.updated_at) || new Date().toISOString(), by: (lg && lg.inspected_by) || 'office', kind: 'extent', featureId: f.id, from: a, to: b, line: f.line, sub: f.sub, ch: a, pos: null, imported: true });
      saveRecords();
      applyExtents();
    applyJoins();
    }
  }
  function applyExtents() {
    const v = voided();
    Object.values(data.byId).forEach(f => { f.built = null; });
    const extRecs = records.filter(r => r.kind === 'extent' && !v.has(r.id)).sort((a, b) => a.at < b.at ? -1 : 1);
    const latestByFid = {};
    extRecs.forEach(r => { latestByFid[r.featureId] = r; });
    Object.entries(latestByFid).forEach(([fid, r]) => {
      const f = data.byId[fid];
      if (!f) return;
      const ch0 = Math.min(r.from, r.to);
      const ch1 = Math.max(r.from, r.to);
      const len = ch1 - ch0;
      f.built = {
        ch0, ch1, len,
        diff0: ch0 - f.ch0,
        diff1: ch1 - f.ch1,
        diffLen: len - (f.ch1 - f.ch0),
        recordId: r.id,
        at: r.at,
        by: r.by,
        note: r.note || ''
      };
    });
    Object.values(data.byId).forEach(f => {
      if (!f.built) {
        const fe = foreignExtent(f);
        if (fe) {
          const ch0 = Math.min(fe[0], fe[1]);
          const ch1 = Math.max(fe[0], fe[1]);
          const len = ch1 - ch0;
          f.built = {
            ch0, ch1, len,
            diff0: ch0 - f.ch0,
            diff1: ch1 - f.ch1,
            diffLen: len - (f.ch1 - f.ch0),
            recordId: null,
            foreign: true
          };
        }
      }
    });
  }
  function extentOf(f) { return f ? (f.built || null) : null; }
  function addExtent(fid, from, to, note, pos) {
    const f = data.byId[fid];
    if (!f) return null;
    if (from == null || to == null || isNaN(from) || isNaN(to)) return null;
    const a = Math.round(Number(from) * 10) / 10;
    const b = Math.round(Number(to) * 10) / 10;
    if (b <= a || b - a < 0.5) return null;
    return addRecord({
      kind: 'extent',
      featureId: fid,
      from: a,
      to: b,
      note: note || '',
      line: f.line,
      sub: f.sub,
      ch: a,
      pos: pos || null
    });
  }

  function extentEnds(f) {
    if (!f) return [0, 0];
    if (f.built) return [f.built.ch0, f.built.ch1];
    return [Math.min(f.ch0, f.ch1), Math.max(f.ch0, f.ch1)];
  }
  function addJoin(intoFid, absorbedIds, note, pos) {
    const primary = data.byId[intoFid];
    if (!primary || !absorbedIds || !absorbedIds.length) return null;
    const r = addRecord({
      kind: 'join',
      into: intoFid,
      absorbed: absorbedIds,
      line: primary.line,
      sub: primary.sub,
      note: note || '',
      pos: pos || null
    });
    applyJoins();
    return r;
  }
  function detectJoins(fid, from, to) {
    const f = data.byId[fid];
    if (!f) return null;
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    const subFeats = (data.bySub[f.sub] || []).filter(o =>
      o.id !== f.id &&
      o.code === f.code &&
      o.side === f.side &&
      o.lane === f.lane &&
      !statusOf(o).removed
    );
    const cluster = new Set([f.id]);
    let minCh = a, maxCh = b;
    let added = true;
    while (added) {
      added = false;
      subFeats.forEach(o => {
        if (cluster.has(o.id)) return;
        const [o0, o1] = extentEnds(o);
        if (Math.max(minCh, o0) <= Math.min(maxCh, o1) + 0.5) {
          cluster.add(o.id);
          minCh = Math.min(minCh, o0);
          maxCh = Math.max(maxCh, o1);
          added = true;
        }
      });
    }
    if (cluster.size <= 1) return null;
    const allPieces = Array.from(cluster).map(id => data.byId[id]);
    allPieces.sort((p1, p2) => {
      const s1 = p1.id === f.id ? a : extentEnds(p1)[0];
      const s2 = p2.id === f.id ? a : extentEnds(p2)[0];
      return s1 - s2;
    });
    const primary = allPieces[0];
    const absorbed = allPieces.slice(1);
    const unionLen = maxCh - minCh;
    return {
      primary,
      absorbed,
      allPieces,
      from: minCh,
      to: maxCh,
      unionLen
    };
  }
  function applyJoins() {
    const v = voided();
    Object.values(data.byId).forEach(f => {
      f.absorbedInto = null;
      f.absorbed = null;
      f.joinRecord = null;
    });
    const joinRecs = records.filter(r => r.kind === 'join' && !v.has(r.id)).sort((a, b) => a.at < b.at ? -1 : 1);
    if (!joinRecs.length) return;

    const parentMap = {};
    const recMap = {};
    joinRecs.forEach(r => {
      const primary = data.byId[r.into];
      if (!primary) return;
      recMap[r.into] = r;
      (r.absorbed || []).forEach(absId => {
        if (data.byId[absId] && absId !== r.into) {
          parentMap[absId] = r.into;
        }
      });
    });

    function getRoot(id) {
      let curr = id;
      const seen = new Set();
      while (parentMap[curr] && !seen.has(curr)) {
        seen.add(curr);
        curr = parentMap[curr];
      }
      return curr;
    }

    const absorbedByRoot = {};
    Object.keys(parentMap).forEach(childId => {
      const rootId = getRoot(childId);
      if (rootId !== childId && data.byId[rootId]) {
        const child = data.byId[childId];
        child.absorbedInto = rootId;
        if (!absorbedByRoot[rootId]) absorbedByRoot[rootId] = [];
        absorbedByRoot[rootId].push(child);
      }
    });

    Object.keys(absorbedByRoot).forEach(rootId => {
      const root = data.byId[rootId];
      if (!root || root.absorbedInto) return;
      const absorbedList = absorbedByRoot[rootId];
      root.absorbed = absorbedList;
      root.joinRecord = recMap[root.id] || null;

      const all = [root, ...absorbedList];
      const minFrom = Math.min(...all.map(p => extentEnds(p)[0]));
      const maxTo = Math.max(...all.map(p => extentEnds(p)[1]));
      const len = maxTo - minFrom;

      root.built = {
        ch0: minFrom,
        ch1: maxTo,
        len,
        diff0: minFrom - root.ch0,
        diff1: maxTo - root.ch1,
        diffLen: len - (root.ch1 - root.ch0),
        recordId: root.joinRecord ? root.joinRecord.id : (root.built ? root.built.recordId : null),
        at: root.joinRecord ? root.joinRecord.at : (root.built ? root.built.at : null),
        by: root.joinRecord ? root.joinRecord.by : (root.built ? root.built.by : null),
        note: root.joinRecord ? root.joinRecord.note : (root.built ? root.built.note : ''),
        joined: true
      };
    });
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
      if (cov.full) Object.assign(res, { s: max, best: max, fill: 'solid', partBuilt: false, stalled: false, bucket: 'done', floor: max });
      else {
        const stl = !!cov.lastAt && (Date.now() - new Date(cov.lastAt).getTime()) > 182 * 864e5;
        // the ranges are the authority: a part finished run is not finished, whatever the office row's status says
        const cap = Math.max(0, max - 1), top = Math.min(cov.top, cap);
        Object.assign(res, { s: top, best: Math.min(Math.max(top, c == null ? 0 : c, 1), cap), floor: cov.floor, partBuilt: true, stalled: stl, fill: 'ranges', bucket: stl ? 'stalled' : 'moving', lastAt: [lastAt, cov.lastAt].filter(Boolean).sort().pop() });
      }
    }
    return res;
  }

  // ------------------------------------------------ progress overview
  // Completion, not "part-built": structures that are a single place (culverts, descents, riprap) are
  // counted; ditches and drains that run along the line are measured by length. The two are never added.
  const isSpan = f => f.kind === 'linear' || f.kind === 'buried';
  const TYPE_LABEL = { CB: 'Connection boxes', MH: 'Manholes', MHG: 'Grid-cover manholes', PO: 'Outlet pipes', PC: 'Pipe culverts', BC: 'Box culverts', CC: 'Cattle crossings', T16: 'Underpass water passages', WD: 'Water descents', 'D-SD': 'Slope descents', BRG: 'Railway bridges', OP: 'Road overbridges' };
  // The drainage type of a feature, as a tab: 'Type 9 shoulder ditch', 'Box culverts'.
  function typeOf(f) {
    const span = isSpan(f);
    if (span && /^CH-/.test(f.code || '')) return { key: 'CH', label: 'Diversion channels', span };
    if (span && f.code === 'MD') return { key: 'MD', label: 'Approach and earth toe ditches', span };
    if (span) return { key: f.code || f.catKey, label: f.name, span };
    return { key: (f.code || f.catKey) + '.pt', label: TYPE_LABEL[f.code] || f.catLabel, span };
  }
  function progressOf(feats) {
    // lin.atLeast: metres that have reached each stage (by the stage's name, in ladder order in lin.names)
    // lin.ofLen: the length of the ditches whose ladder has that stage (what its percentage is of)
    const o = { pts: { n: 0, done: 0 }, lin: { n: 0, done: 0, m: 0, doneM: 0, atLeast: {}, ofLen: {}, names: [] }, part: 0, stalled: 0 };
    const addAt = (f, k, m, len) => {
      const n = f.ladder[k];
      if (!(n in o.lin.atLeast)) {
        o.lin.ofLen[n] = 0;
        // keep each ladder's order: after the stage before it, if that one is listed
        const prev = k > 1 ? o.lin.names.indexOf(f.ladder[k - 1]) : -1;
        o.lin.names.splice(prev >= 0 ? prev + 1 : o.lin.names.length, 0, n);
        o.lin.atLeast[n] = 0;
      }
      o.lin.atLeast[n] += m;
      o.lin.ofLen[n] += len;
    };
    feats.forEach(f => {
      if (f.absorbedInto) return;
      const st = statusOf(f);
      if (st.removed) return;
      if (st.bucket === 'moving') o.part++;
      if (st.bucket === 'stalled') { o.part++; o.stalled++; }
      if (isSpan(f)) {
        const len = f.built ? (f.built.ch1 - f.built.ch0) : (f.ch1 - f.ch0);
        o.lin.n++; o.lin.m += len;
        if (st.cover) o.lin.doneM += st.cover.m; else if (st.bucket === 'done') o.lin.doneM += len;
        for (let k = 1; k < f.ladder.length; k++) {
          const m = st.cover ? st.cover.mAt[k] : st.bucket === 'done' ? len : 0;
          addAt(f, k, m, len);
        }
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
    init, hasData, subAt, featuresNear, loadIRs, claimOf, migrateCulvertStages, migrateStageNames, stageByName, legacyStage, ladderKind, LADDER_INSITU, LADDER_PRECAST, LADDER_UNLINED, LADDER_FRENCH,
    fmtCh, fmtPlus, parseCh, fmtDate, fmtTime, monthsBetween, esc, DAYS, MONTHS,
    inspector, setInspector, addRecord, voidRecord, live, recordsFor, seenOf, ownSeen, openDefects,
    designChanges, statusOf, drafts, saveDraft, putPhoto, getPhoto, uid, loadLegacy, mirrorLegacy,
    loadSections, sectionAt, loadT9Schedule, hasT9Schedule, rangeable, coverOf, addRange, rangeNote, parseRangeNote, stageNote, parseStageNote, noteMetres, parseExecutedNote, foreignStaged, extentNote, parseExtentNote, foreignExtent, adoptForeignExtent, applyExtents, extentOf, addExtent, extentEnds, addJoin, detectJoins, applyJoins, isSpan, typeOf, progressOf, typeProgress, T9_SCHEDULE_ON, refs, refsNear, refById, REF_KIND, areasAt, isArea, loadConnectors, hasConnectors, endsOf, joinsOf, geomOf, laneOf, loadHeights, hasHeights, heightAt, T9_RULES, t9Rule, setT9Rule, t9Check,
    PRESETS, presetOf, applyBase, baseRecords, correctBase, addBase, deleteBase, verifyBase, unverifyBase, exportGeo, exportCorrections, importRecords,
    project, pointAt, laneOf, savePosition, lastPosition, csvCell,
    get records() { return records; }
  };
})();
