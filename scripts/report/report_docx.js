#!/usr/bin/env node
/*
 * The progress report as a Word document, from what build_report.js wrote (report.json, diagram_<S0x>.svg):
 *
 *   node scripts/report/report_docx.js data/report/out [--logo data/report/team_logo.png]
 *
 * Writes data/report/out/Drainage_Progress_Report_<asof>.docx: a cover with document control, the basis of the
 * report, the summary, the changes from the design, then each section on landscape pages (its chainage diagram,
 * the stretches built, its culverts and station drains), and the notes. The diagrams are rendered to PNG with
 * the browser Playwright brings.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, PageOrientation,
  WidthType, ShadingType, BorderStyle, PageNumber, TabStopType, HeadingLevel, VerticalAlign, PageBreak, LevelFormat, LineRuleType
} = require('docx');

const dir = process.argv[2] || path.join(__dirname, '..', '..', 'data', 'report', 'out');
const li = process.argv.indexOf('--logo');
const logoPath = li > 0 ? process.argv[li + 1] : path.join(__dirname, '..', '..', 'data', 'report', 'team_logo.png');
const R = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));

// ------------------------------------------------------------------ house style
const FONT = 'Arial';
const INK = '1B2420', MUTED = '5D6963', RULE = 'C9D1CC', HEAD = '24332D', BAND = 'E9EEEB', FIN = '1F6B4F', WAY = 'B7791A', FLAG = 'C2412D', ACCENT = 'C2347A';
const A4 = { width: 11906, height: 16838 };
const M = 1080;   // 0.75 in margins
const W_P = A4.width - 2 * M, W_L = A4.height - 2 * M;   // text widths, portrait and landscape

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateLong = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return Number(dd) + ' ' + MON[Number(m) - 1] + ' ' + y; };
const dateShort = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return Number(dd) + ' ' + MON[Number(m) - 1].slice(0, 3) + ' ' + y; };
const pk = v => { if (v == null) return ''; const r = Math.round(v), s = r < 0 ? '-' : ''; const a = Math.abs(r); return s + Math.floor(a / 1000) + '+' + String(a % 1000).padStart(3, '0'); };
const km = m => (m / 1000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const sideTxt = s => s === 'L' ? 'Left' : s === 'R' ? 'Right' : '—';
const ASOF = dateLong(R.asof);

const t = (text, o = {}) => new TextRun(Object.assign({ text: String(text), font: FONT }, o));
const p = (runs, o = {}) => new Paragraph(Object.assign({ children: (Array.isArray(runs) ? runs : [runs]).map(r => typeof r === 'string' ? t(r) : r) }, o));
const h1 = text => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)] });
const h2 = text => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const h3 = text => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(text)] });
const note = text => p([t(text, { color: MUTED, size: 17, italics: true })], { spacing: { before: 60, after: 120 } });
const bullet = runs => p(runs, { numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 } });

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(content, width, o = {}) {
  const runs = (Array.isArray(content) ? content : [content]).map(c => typeof c === 'string' || typeof c === 'number' ? t(c, { size: o.size || 18, bold: o.bold, color: o.color }) : c);
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.TOP,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 }, columnSpan: o.span,
    children: [new Paragraph({ alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: runs })]
  });
}
// a table: columns [{ title, w, right }], rows of cells' content; a row { band: 'text' } is a full-width band
function table(cols, rows, total) {
  const ws = cols.map(c => c.w);
  const sum = ws.reduce((a, b) => a + b, 0);
  const scale = total / sum;
  const w = ws.map(x => Math.round(x * scale));
  w[w.length - 1] += total - w.reduce((a, b) => a + b, 0);
  const head = new TableRow({ tableHeader: true, children: cols.map((c, i) => cell(c.title, w[i], { fill: HEAD, color: 'FFFFFF', bold: true, size: 16, right: c.right })) });
  const body = rows.map(r => r.band != null
    ? new TableRow({ children: [cell([t(r.band, { bold: true, size: 19 }), t(r.bandNote ? '   ' + r.bandNote : '', { size: 16, color: MUTED })], total, { fill: BAND, span: cols.length })] })
    : new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, w[i], { right: cols[i].right })) }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: w, rows: [head, ...body] });
}
const chip = (txt, color) => t(' ' + txt + ' ', { bold: true, size: 15, color: 'FFFFFF', shading: { type: ShadingType.CLEAR, fill: color, color: 'auto' } });
const flag = no => t(' ' + no + ' ', { bold: true, size: 15, color: 'FFFFFF', shading: { type: ShadingType.CLEAR, fill: FLAG, color: 'auto' } });

// ------------------------------------------------------------------ figures
const worked = x => x.span ? (x.doneM > 0 || x.startedM > 0) : (x.done > 0 || x.part > 0);
const all = R.sections.flatMap(s => s.types.map(x => Object.assign({ sec: s }, x)));
const lin = all.filter(x => x.span && !x.road && !x.net);
const finM = lin.reduce((a, x) => a + x.doneM, 0), desM = lin.reduce((a, x) => a + x.designM, 0);
const culv = all.filter(x => /^(BC|PC|CC)\.pt$/.test(x.key));
const culvN = culv.reduce((a, x) => a + x.n, 0), culvDone = culv.reduce((a, x) => a + x.done, 0);
const nets = R.networks;
const netLegs = nets.reduce((a, n) => a + n.legs, 0), netDone = nets.reduce((a, n) => a + n.legsDone, 0);
const netM = nets.reduce((a, n) => a + n.m, 0), netDoneM = nets.reduce((a, n) => a + n.doneM, 0);
const KIND = { site: 'Built differently', omitted: 'Omitted on site', instructed: 'Instructed change' };

// ------------------------------------------------------------------ diagrams to PNG
async function renderDiagrams() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const page = await b.newPage({ deviceScaleFactor: 2 });
  const out = {};
  for (const s of R.sections) {
    const f = path.join(dir, 'diagram_' + s.no + '.svg');
    if (!fs.existsSync(f)) continue;
    const svg = fs.readFileSync(f, 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/).map(Number);
    await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
    await page.setContent('<html><body style="margin:0">' + svg + '</body></html>');
    out[s.no] = { png: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }), w, h };
  }
  await b.close();
  return out;
}

// ------------------------------------------------------------------ content
let LOGO = null;
function cover() {
  const ctl = [
    ['Document', 'Drainage construction progress report'],
    ['Project', 'Standard gauge railway Kano–Maradi (with branch line Kano–Dutse)'],
    ['Scope', 'Main line, Sections 01 to 05 (PK -2+675 to 243+225): longitudinal drainage, cross drainage and station drainage'],
    ['Status as of', ASOF],
    ['Basis', 'Detailed design drawings (DRN-LONG, drainage reports DWKZ- and KZDR-2200-RP-00001), as amended by the instructions listed in Section 3'],
  ];
  const sig = ['Prepared by', 'Checked by', 'Approved by'];
  return [
    p([new ImageRun({ type: 'png', data: LOGO, transformation: { width: 300, height: Math.round(300 * 360 / 1152) }, altText: { title: 'T.E.A.M.', description: 'T.E.A.M. logo', name: 'cover logo' } })], { spacing: { before: 600, after: 0 } }),
    p([t('DRAINAGE CONSTRUCTION', { bold: true, size: 40, color: INK })], { spacing: { before: 900, after: 0 } }),
    p([t('PROGRESS REPORT', { bold: true, size: 40, color: INK })], { spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 } } }),
    p([t('Standard Gauge Railway Kano–Maradi · Sections 01 to 05', { size: 24, color: MUTED })], { spacing: { after: 60 } }),
    p([t('Status as of ' + ASOF, { size: 24, color: MUTED })], { spacing: { after: 600 } }),
    table([{ title: 'Document control', w: 1 }, { title: '', w: 3 }], ctl.map(([k, v]) => [[t(k, { bold: true, size: 18 })], v]), W_P),
    p('', { spacing: { after: 360 } }),
    table([{ title: '', w: 1.2 }, { title: 'Name', w: 2 }, { title: 'Signature', w: 2 }, { title: 'Date', w: 1.3 }], sig.map(s => [[t(s, { bold: true, size: 18 })], ' ', ' ', ' ']).map(r => r), W_P),
    p([new PageBreak()])
  ];
}

function basis() {
  return [
    h1('1. Purpose and basis'),
    p('This report states what drainage has been built on the main line, against what the design has, section by section and type by type. It lists every change from the design: items built differently on site, items omitted, and design changes made by instruction.', { spacing: { after: 120 } }),
    h2('1.1 How the figures are measured'),
    bullet([t('Longitudinal ditches and drains: ', { bold: true }), t('length in metres along the main line chainage, as drawn on the DRN-LONG drawings. A ditch counts as completed when its last construction stage is recorded; a part-built length is shown as under way.')]),
    bullet([t('Culverts, cattle crossings and other structures: ', { bold: true }), t('number of structures.')]),
    bullet([t('Station and yard collector drains (Type 6): ', { bold: true }), t('manhole to manhole, by the length of each drain.')]),
    h2('1.2 Sources'),
    p('Site inspection records and the contractor\'s execution charts, as held in the KMD Drainage Inspector database (' + R.rows + ' records, read on ' + ASOF + '). Design quantities follow the drawings, with Type 9 placed where the embankment is higher than 1.8 m (change 2) and Dawanau Station as set out on site (change 3).', { spacing: { after: 120 } }),
  ];
}

function summary() {
  const out = [h1('2. Summary')];
  out.push(table([{ title: 'Item', w: 3 }, { title: 'Design', w: 1.3, right: true }, { title: 'Completed', w: 1.3, right: true }, { title: '%', w: 0.7, right: true }], [
    ['Longitudinal ditches and drains along the line', km(desM) + ' km', km(finM) + ' km', pct(finM, desM) + '%'],
    ['Culverts and cattle crossings', String(culvN), String(culvDone), pct(culvDone, culvN) + '%'],
    ['Station and yard collector drains (Type 6)', netLegs + ' (' + km(netM) + ' km)', netDone + ' (' + km(netDoneM) + ' km)', pct(netDoneM, netM) + '%'],
    ['Changes from the design: ' + R.changes.length + ' (Section 3)', '', '', ''],
  ], W_P));
  out.push(note('Section 2.1 gives the figures by section and type. Types with no work recorded yet are listed under each section.'));
  out.push(h2('2.1 By section and drainage type'));
  const rows = [];
  R.sections.forEach(s => {
    const work = s.types.filter(x => !x.road && !x.net && worked(x));
    const rest = s.types.filter(x => !x.road && !x.net && !worked(x));
    rows.push({ band: s.no + ' · ' + s.name, bandNote: 'PK ' + pk(s.from) + ' to ' + pk(s.to) + ' · ' + km(s.to - s.from) + ' km' });
    if (!work.length) rows.push(['No drainage work recorded yet', '', '', '', '', '']);
    work.forEach(x => rows.push(x.span
      ? [x.label, 'km', km(x.designM), km(x.doneM), pct(x.doneM, x.designM) + '%', x.startedM - x.doneM > 1 ? km(x.startedM - x.doneM) : '—']
      : [x.label, 'no.', String(x.n), String(x.done), pct(x.done, x.n) + '%', x.part ? String(x.part) : '—']));
    const restLin = rest.filter(x => x.span), restPts = rest.filter(x => !x.span);
    if (rest.length) rows.push([[t('Not started: ', { bold: true, size: 16, color: MUTED }), t(restLin.map(x => x.label.replace(/ (side|toe|crest|shoulder|bench) ditch.*$/, '')).join(', ') + (restLin.length ? ' (' + km(restLin.reduce((a, x) => a + x.designM, 0)) + ' km)' : '') + (restPts.length ? (restLin.length ? '; ' : '') + restPts.map(x => x.n + ' ' + x.label.toLowerCase()).join(', ') : ''), { size: 16, color: MUTED })], '', '', '', '', '']);
  });
  // a 'Not started' row spans the table: rebuild those as bands of their own
  const cols = [{ title: 'Type', w: 3.2 }, { title: 'Unit', w: 0.6 }, { title: 'Design', w: 1.1, right: true }, { title: 'Completed', w: 1.1, right: true }, { title: '%', w: 0.7, right: true }, { title: 'Under way', w: 1, right: true }];
  out.push(tableWithNotes(cols, rows, W_P));
  return out;
}
// like table(), but a row whose first cell is a run list and the rest empty becomes a full-width note row
function tableWithNotes(cols, rows, total) {
  const ws = cols.map(c => c.w), sum = ws.reduce((a, b) => a + b, 0);
  const w = ws.map(x => Math.round(x * total / sum)); w[w.length - 1] += total - w.reduce((a, b) => a + b, 0);
  const head = new TableRow({ tableHeader: true, children: cols.map((c, i) => cell(c.title, w[i], { fill: HEAD, color: 'FFFFFF', bold: true, size: 16, right: c.right })) });
  const body = rows.map(r => {
    if (r.band != null) return new TableRow({ cantSplit: true, children: [cell([t(r.band, { bold: true, size: 19 }), t('   ' + (r.bandNote || ''), { size: 16, color: MUTED })], total, { fill: BAND, span: cols.length })] });
    if (Array.isArray(r[0]) && r.slice(1).every(v => v === '')) return new TableRow({ cantSplit: true, children: [cell(r[0], total, { span: cols.length })] });
    return new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, w[i], { right: cols[i].right })) });
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: w, rows: [head, ...body] });
}

function changes() {
  const out = [h1('3. Changes from the design'), p('Items built differently on site, design items omitted on site, and design changes made by instruction. The numbers mark them on the section diagrams and tables in Section 4.', { spacing: { after: 120 } })];
  const cols = [{ title: 'No.', w: 0.45 }, { title: 'Location', w: 1.6 }, { title: 'Design', w: 2.2 }, { title: 'As built', w: 2.4 }, { title: 'Status', w: 2.2 }];
  out.push(table(cols, R.changes.map(c => {
    const sec = c.sub ? R.sections.find(s => s.id === c.sub) : null;
    return [[flag(c.no)],
      [t(c.where, { bold: true, size: 18 }), t(sec ? '  ' + sec.no + (c.ch0 != null && c.ch1 !== c.ch0 ? ', PK ' + pk(c.ch0) + ' to ' + pk(c.ch1) : '') : '', { size: 16, color: MUTED }), t('', { break: 1 }), chip(KIND[c.kind] || c.kind, c.kind === 'instructed' ? '48607A' : FLAG)],
      c.design, c.built, c.status];
  }), W_P));
  return out;
}

function stretchRows(s) {
  const out = [];
  s.stretches.forEach(x => {
    const q = out[out.length - 1];
    if (q && q.key === x.key && q.side === x.side && q.done === x.done && q.stage === x.stage && x.ch0 - q.ch1 < 2 && x.ch0 >= q.ch0) { q.ch1 = Math.max(q.ch1, x.ch1); q.len += x.len; if (x.date > q.date) q.date = x.date; }
    else out.push(Object.assign({}, x));
  });
  return out.sort((a, b) => a.ch0 - b.ch0 || (a.side < b.side ? -1 : 1));
}

function sections(img) {
  const out = [h1('4. Progress by section')];
  let first = true;
  R.sections.forEach(s => {
    const rows = stretchRows(s), pts = s.points, sn = nets.filter(n => n.sub === s.id && n.legs);
    const omittedHere = R.changes.filter(c => c.kind === 'omitted' && c.sub === s.id);
    if (!rows.length && !pts.length && !sn.some(n => n.doneM > 0)) return;
    if (!first) out.push(p([new PageBreak()]));
    first = false;
    out.push(h2(s.no + ' · ' + s.name + '   (PK ' + pk(s.from) + ' to ' + pk(s.to) + ')'));
    if (img[s.no]) {
      const wIn = 10.1, hIn = wIn * img[s.no].h / img[s.no].w;
      out.push(p([t('Each band is a drainage type, left side above right. Outlined: design; ', { size: 16, color: MUTED }), t('green', { size: 16, color: FIN, bold: true }), t(': completed; ', { size: 16, color: MUTED }), t('amber', { size: 16, color: WAY, bold: true }), t(': under way; blue columns: stations and yards; numbers: changes from the design.', { size: 16, color: MUTED })], { spacing: { after: 60 } }));
      out.push(p([new ImageRun({ type: 'png', data: img[s.no].png, transformation: { width: Math.round(wIn * 96), height: Math.round(hIn * 96) }, altText: { title: s.no + ' diagram', description: s.no + ' drainage along the chainage: design and completed', name: s.no } })], { spacing: { after: 160 } }));
    }
    if (rows.length) {
      out.push(h3('Longitudinal drainage built'));
      const flags = x => R.changes.filter(c => c.sub === s.id && c.side === x.side && c.ch0 != null && c.ch0 < x.ch1 && c.ch1 > x.ch0 && c.feature && c.kind !== 'omitted').map(c => flag(c.no));
      out.push(table([{ title: 'From PK', w: 1, right: true }, { title: 'To PK', w: 1, right: true }, { title: 'Side', w: 0.7 }, { title: 'Type', w: 3.2 }, { title: 'Length (m)', w: 1, right: true }, { title: 'Status', w: 1.6 }, { title: 'Last record', w: 1.2 }],
        rows.map(x => [pk(x.ch0), pk(x.ch1), sideTxt(x.side), [t(x.label + ' ', { size: 18 }), ...flags(x)], Math.round(x.len).toLocaleString('en-GB'), [x.done ? chip('COMPLETED', FIN) : chip(x.stage.toUpperCase(), WAY)], dateShort(x.date)]), W_L));
      const doneM = rows.filter(x => x.done).reduce((a, x) => a + x.len, 0), wayM = rows.filter(x => !x.done).reduce((a, x) => a + x.len, 0);
      out.push(note(rows.length + ' stretches: ' + Math.round(doneM).toLocaleString('en-GB') + ' m completed' + (wayM ? ', ' + Math.round(wayM).toLocaleString('en-GB') + ' m under way' : '') + '.'));
    }
    const groups = {};
    pts.forEach(x => (groups[x.label] = groups[x.label] || []).push(x));
    if (pts.length) {
      out.push(h3('Culverts and other structures'));
      out.push(table([{ title: 'Type', w: 2.2 }, { title: 'Design', w: 0.8, right: true }, { title: 'Completed', w: 0.9, right: true }, { title: 'Under way', w: 5 }],
        Object.entries(groups).map(([lb, L]) => {
          const ty = s.types.find(x => x.label === lb);
          const way = L.filter(x => !x.done);
          return [lb, String(ty ? ty.n : L.length), String(L.filter(x => x.done).length), way.length ? way.map(x => x.name.replace(/^(Box|Pipe) culvert,? ?/i, '') + ' at PK ' + pk(x.ch) + ' (' + x.stage.toLowerCase() + ')').join('; ') : '—'];
        }), W_L));
      if (omittedHere.length) out.push(note('Omitted on site and left out of the quantities: ' + omittedHere.map(c => c.design.replace(/ \(.*\)$/, '').toLowerCase() + ' at ' + c.where + ' (change ' + c.no + ')').join('; ') + '.'));
    }
    if (sn.length) {
      out.push(h3('Station and yard collector drains (Type 6)'));
      out.push(table([{ title: 'Station or yard', w: 2.2 }, { title: 'Drains', w: 0.8, right: true }, { title: 'Completed', w: 0.9, right: true }, { title: 'Length (km)', w: 1, right: true }, { title: 'Completed (km)', w: 1.1, right: true }, { title: 'Not yet completed', w: 4 }],
        sn.map(n => [n.name, String(n.legs), String(n.legsDone), km(n.m), km(n.doneM), n.legsDone === n.legs ? 'All completed' : n.legsDone === 0 ? 'Not started' : n.list.filter(l => l.state !== 'done').map(l => l.name).join('; ')]), W_L));
    }
  });
  return out;
}

function notes() {
  const out = [h1('5. Notes')];
  out.push(bullet([t('The figures are those recorded up to ' + ASOF + '. Work done but not yet recorded is not included.')]));
  out.push(bullet([t('Road drainage (the drains of roads crossing the line) has not started and is not included above.')]));
  out.push(bullet([t('Type 13 (rectangular lined ditch at the foot of the slope) is used where a road overpass embankment comes close to the railway embankment and a triangular ditch does not fit. Type 16 is the water passage that carries a longitudinal ditch through an underpass.')]));
  if (R.unmatched.length) out.push(bullet([t(R.unmatched.length + ' earlier inspection records (7 September 2026) refer to asset numbers of the first asset list, which the drawings have since replaced: ' + R.unmatched.map(u => u.id).join(', ') + '. They are left out of the figures until confirmed on site.')]));
  out.push(bullet([t('A spreadsheet with every stretch built, every design item with its status, the structures and the station drains accompanies this report.')]));
  return out;
}

// ------------------------------------------------------------------ the document
(async () => {
  const img = await renderDiagrams();
  const logo = fs.readFileSync(logoPath);
  LOGO = logo;
  const headerText = width => new Header({ children: [
    new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } }, spacing: { after: 120 },
      children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 170, height: Math.round(170 * 360 / 1152) }, altText: { title: 'T.E.A.M.', description: 'T.E.A.M. logo', name: 'logo' } }),
        t('\tKano–Maradi SGR · Drainage construction progress', { size: 16, color: MUTED })] })] });
  const footer = width => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
    children: [t('Status as of ' + ASOF, { size: 15, color: MUTED }), t('\tPage ', { size: 15, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: MUTED }), t(' of ', { size: 15, color: MUTED }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: MUTED })] })] });
  const portrait = { page: { size: { width: A4.width, height: A4.height }, margin: { top: M, bottom: M, left: M, right: M, header: 500, footer: 500 } } };
  const landscape = { page: { size: { width: A4.width, height: A4.height, orientation: PageOrientation.LANDSCAPE }, margin: { top: M, bottom: M, left: M, right: M, header: 500, footer: 500 } } };
  const doc = new Document({
    creator: 'KMD Drainage Inspector', title: 'Drainage construction progress report', description: 'Kano–Maradi SGR drainage built against the design, as of ' + ASOF,
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: INK }, paragraph: { spacing: { after: 80, line: 276, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: INK }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 20, bold: true, color: HEAD }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
      ]
    },
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
    sections: [
      { properties: Object.assign({ titlePage: true }, portrait), headers: { default: headerText(W_P), first: new Header({ children: [new Paragraph({ children: [] })] }) }, footers: { default: footer(W_P), first: footer(W_P) }, children: [...cover(), ...basis(), ...summary(), p([new PageBreak()]), ...changes()] },
      { properties: landscape, headers: { default: headerText(W_L) }, footers: { default: footer(W_L) }, children: sections(img) },
      { properties: portrait, headers: { default: headerText(W_P) }, footers: { default: footer(W_P) }, children: notes() },
    ]
  });
  const file = path.join(dir, 'Drainage_Progress_Report_' + R.asof + '.docx');
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  console.log('wrote ' + file);
})().catch(e => { console.error(e); process.exit(1); });
