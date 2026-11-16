/*
 * The progress report as one page (scripts/report/build_report.js gives it the figures). Easy to read first:
 * the summary, then what was built differently from the design, then each section along its chainage.
 */
'use strict';
module.exports = function html(R, DI) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ch = v => DI.fmtCh(Math.round(v));
  const km = m => (m / 1000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const side = s => s === 'L' ? 'Left' : s === 'R' ? 'Right' : 'Both';
  const dateTxt = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return Number(dd) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] + ' ' + y; };
  const asofTxt = dateTxt(R.asof);
  const worked = t => t.span ? (t.doneM > 0 || t.startedM > 0) : (t.done > 0 || t.part > 0);

  // --- the figures
  const all = R.sections.flatMap(s => s.types.map(t => Object.assign({ sec: s }, t)));
  const lin = all.filter(t => t.span && !t.road && !t.net);
  const finM = lin.reduce((a, t) => a + t.doneM, 0), desM = lin.reduce((a, t) => a + t.designM, 0);
  const culv = all.filter(t => /^(BC|PC|CC)\.pt$/.test(t.key));
  const culvN = culv.reduce((a, t) => a + t.n, 0), culvDone = culv.reduce((a, t) => a + t.done, 0);
  const netLegs = R.networks.reduce((a, n) => a + n.legs, 0), netDone = R.networks.reduce((a, n) => a + n.legsDone, 0);
  const netM = R.networks.reduce((a, n) => a + n.m, 0), netDoneM = R.networks.reduce((a, n) => a + n.doneM, 0);

  const bar = (a, b, part) => '<span class="bar" aria-hidden="true"><i class="d" style="width:' + Math.min(100, pct(a, b)) + '%"></i>' + (part ? '<i class="p" style="width:' + Math.min(100 - pct(a, b), pct(part, b)) + '%"></i>' : '') + '</span>';

  // --- summary by section
  let sum = '';
  R.sections.forEach(s => {
    const rows = s.types.filter(t => !t.road && !t.net && worked(t));
    const rest = s.types.filter(t => !t.road && !t.net && !worked(t));
    const restLin = rest.filter(t => t.span), restPts = rest.filter(t => !t.span);
    sum += '<tbody><tr class="sec"><th colspan="5">' + esc(s.no + ' · ' + s.name) + '<span>' + ch(s.from) + ' to ' + ch(s.to) + '</span></th></tr>';
    if (!rows.length) sum += '<tr><td colspan="5" class="muted">No drainage work recorded yet.</td></tr>';
    rows.forEach(t => {
      if (t.span) sum += '<tr><td>' + esc(t.label) + '</td><td class="n">' + km(t.designM) + ' km</td><td class="n">' + km(t.doneM) + ' km</td><td class="n"><b>' + pct(t.doneM, t.designM) + '%</b></td><td>' + bar(t.doneM, t.designM, Math.max(0, t.startedM - t.doneM)) + (t.startedM - t.doneM > 1 ? '<small>' + km(t.startedM - t.doneM) + ' km under way</small>' : '') + '</td></tr>';
      else sum += '<tr><td>' + esc(t.label) + '</td><td class="n">' + t.n + '</td><td class="n">' + t.done + '</td><td class="n"><b>' + pct(t.done, t.n) + '%</b></td><td>' + bar(t.done, t.n, t.part) + (t.part ? '<small>' + t.part + ' under way</small>' : '') + '</td></tr>';
    });
    if (rest.length) sum += '<tr class="rest"><td colspan="5">Not started: ' + esc(restLin.map(t => t.label.replace(/ (side|toe|crest|shoulder|bench) ditch.*$/, '')).join(', ')) + (restLin.length ? ' (' + km(restLin.reduce((a, t) => a + t.designM, 0)) + ' km)' : '') + (restPts.length ? (restLin.length ? '; ' : '') + esc(restPts.map(t => t.n + ' ' + t.label.toLowerCase()).join(', ')) : '') + '</td></tr>';
    sum += '</tbody>';
  });

  // --- changes
  const chg = R.changes.map(c => '<tr><td class="n"><span class="flag">' + c.no + '</span></td><td><b>' + esc(c.where) + '</b>' + (c.sub ? '<small>' + esc(R.sections.find(s => s.id === c.sub).no) + (c.ch0 != null ? ' · ' + ch(c.ch0) + ' to ' + ch(c.ch1) : '') + '</small>' : '') + '<span class="kind ' + c.kind + '">' + (c.kind === 'site' ? 'Built differently' : 'Instructed change') + '</span></td><td>' + esc(c.design) + '</td><td>' + esc(c.built) + '</td><td>' + esc(c.status) + '</td></tr>').join('');

  // --- the diagram of a section: chainage across, a band per drainage type that has work, left above right
  function diagram(s) {
    const keys = [...new Set(s.stretches.map(x => x.key))];
    const order = s.types.map(t => t.key);
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (!keys.length) return '';
    const W = 1100, X0 = 150, X1 = W - 14, top = 52, lane = 11, gapL = 3, band = 2 * lane + gapL + 16;
    const H = top + keys.length * band + 26;
    const X = c => X0 + (c - s.from) / (s.to - s.from) * (X1 - X0);
    let g = '';
    // stations and yards, for finding your way
    // a label too close to the one before it goes on a second line
    let lastX = -1e9, row = 0;
    s.stations.slice().sort((p, q) => p.ch0 - q.ch0).forEach(st => { const a = Math.max(X0, X(st.ch0)), b = Math.min(X1, X(st.ch1)); if (b <= a) return; const mx = (a + b) / 2; row = mx - lastX < 90 ? 1 - row : 0; lastX = mx; g += '<rect x="' + a.toFixed(1) + '" y="' + (top - 8) + '" width="' + Math.max(2, b - a).toFixed(1) + '" height="' + (H - top - 18) + '" class="stn"/><text x="' + mx.toFixed(1) + '" y="' + (top - 12 - row * 14) + '" class="stnl">' + esc(st.name.replace(/ Station$/, '').replace(/ freight yard$/, ' yard').replace(/ maintenance centre$/, ' depot')) + '</text>'; });
    // chainage
    const step = (s.to - s.from) > 30000 ? 5000 : 2000;
    for (let c = Math.ceil(s.from / step) * step; c <= s.to; c += step) g += '<line x1="' + X(c).toFixed(1) + '" x2="' + X(c).toFixed(1) + '" y1="' + (top - 4) + '" y2="' + (H - 20) + '" class="grid"/><text x="' + X(c).toFixed(1) + '" y="' + (H - 6) + '" class="tick">' + DI.fmtCh(c) + '</text>';
    keys.forEach((k, i) => {
      const y = top + i * band;
      const t = s.types.find(x => x.key === k);
      g += '<text x="0" y="' + (y + lane + 4) + '" class="bl">' + esc(t.label.replace(/ ditch.*$/, '').replace(/^Type /, 'Type ')) + '</text>';
      ['L', 'R'].forEach((sd, j) => {
        const yy = y + j * (lane + gapL);
        g += '<text x="' + (X0 - 8) + '" y="' + (yy + lane - 2) + '" class="sl">' + sd + '</text>';
        s.design.filter(d => d.key === k && d.side === sd).forEach(d => { const a = X(d.ch0), b = X(d.ch1); g += '<rect x="' + a.toFixed(1) + '" y="' + yy + '" width="' + Math.max(1, b - a).toFixed(1) + '" height="' + lane + '" class="des"><title>' + esc(t.label + ', ' + side(sd).toLowerCase() + ', ' + ch(d.ch0) + ' to ' + ch(d.ch1) + ' (design)') + '</title></rect>'; });
        s.stretches.filter(x => x.key === k && x.side === sd).forEach(x => { const a = X(x.ch0), b = X(x.ch1); g += '<rect x="' + a.toFixed(1) + '" y="' + yy + '" width="' + Math.max(1.5, b - a).toFixed(1) + '" height="' + lane + '" class="' + (x.done ? 'fin' : 'way') + '"><title>' + esc(t.label + ', ' + side(sd).toLowerCase() + ', ' + ch(x.ch0) + ' to ' + ch(x.ch1) + ': ' + (x.done ? 'finished' : x.stage)) + '</title></rect>'; });
      });
      R.changes.filter(c => c.sub === s.id && c.ch0 != null && c.feature && s.design.some(d => d.id === c.feature && d.key === k)).forEach(c => {
        const x = X((c.ch0 + c.ch1) / 2), yy = y + (c.side === 'R' ? lane + gapL : 0);
        g += '<g class="fl"><circle cx="' + x.toFixed(1) + '" cy="' + (yy - 7) + '" r="7"/><text x="' + x.toFixed(1) + '" y="' + (yy - 3.5) + '">' + c.no + '</text></g>';
      });
    });
    return '<div class="dia"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(s.no + ' drainage along the chainage') + '">' + g + '</svg></div>';
  }

  // what is built, a line per stretch (pieces that run on from each other at the same state are one)
  function stretches(s) {
    const out = [];
    s.stretches.forEach(x => {
      const p = out[out.length - 1];
      if (p && p.key === x.key && p.side === x.side && p.done === x.done && p.stage === x.stage && x.ch0 - p.ch1 < 2 && x.ch0 >= p.ch0) { p.ch1 = Math.max(p.ch1, x.ch1); p.len += x.len; if (x.date > p.date) p.date = x.date; }
      else out.push(Object.assign({}, x));
    });
    out.sort((a, b) => a.ch0 - b.ch0 || (a.side < b.side ? -1 : 1));
    const flagOf = x => R.changes.filter(c => c.sub === s.id && c.side === x.side && c.ch0 != null && c.ch0 < x.ch1 && c.ch1 > x.ch0 && c.feature).map(c => '<span class="flag sm">' + c.no + '</span>').join('');
    return out.map(x => '<tr><td class="n">' + ch(x.ch0) + '</td><td class="n">' + ch(x.ch1) + '</td><td>' + side(x.side) + '</td><td>' + esc(x.label) + flagOf(x) + '</td><td class="n">' + Math.round(x.len).toLocaleString('en-GB') + ' m</td><td>' + (x.done ? '<span class="st fin">Finished</span>' : '<span class="st way">' + esc(x.stage) + '</span>') + '</td><td class="muted">' + esc(dateTxt(x.date)) + '</td></tr>').join('');
  }

  let secs = '';
  R.sections.forEach(s => {
    const rows = stretches(s);
    const pts = s.points;
    const nets = R.networks.filter(n => n.sub === s.id);
    if (!rows && !pts.length && !nets.some(n => n.doneM > 0)) return;
    secs += '<section class="sect" id="' + s.no.toLowerCase() + '"><h3>' + esc(s.no) + ' · ' + esc(s.name) + '<span>' + ch(s.from) + ' to ' + ch(s.to) + ' · ' + km(s.to - s.from) + ' km</span></h3>';
    if (rows) {
      secs += '<p class="lead">Each band is a drain type, left side above right. The outline is what the design has; filled is built.</p>' + diagram(s);
      secs += '<h4>Drains built along the line</h4><div class="tw"><table class="list"><thead><tr><th>From</th><th>To</th><th>Side</th><th>Type</th><th>Length</th><th>State</th><th>Last record</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    const pg = {};
    pts.forEach(p => (pg[p.label] = pg[p.label] || []).push(p));
    if (pts.length) {
      secs += '<h4>Culverts and other structures</h4><div class="tw"><table class="list"><thead><tr><th>Type</th><th>Finished</th><th>Under way</th></tr></thead><tbody>' +
        Object.entries(pg).map(([lb, L]) => '<tr><td>' + esc(lb) + '</td><td>' + L.filter(p => p.done).length + ' of ' + (s.types.find(t => t.label === lb) || { n: L.length }).n + '</td><td>' + (L.filter(p => !p.done).map(p => esc(p.name.replace(/^(Box|Pipe) culvert,? ?/i, '')) + ' <span class="muted">' + ch(p.ch) + ', ' + esc(p.stage.toLowerCase()) + '</span>').join('<br>') || '<span class="muted">none</span>') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    nets.filter(n => n.legs).forEach(n => {
      secs += '<h4>' + esc(n.name) + ': Type 6 collector drains</h4><p class="lead">' + n.legsDone + ' of ' + n.legs + ' drains finished, ' + km(n.doneM) + ' of ' + km(n.m) + ' km. ' + (n.doneM > 0 ? 'Not finished: ' + esc(n.list.filter(l => l.state !== 'done').map(l => l.name).join('; ') || 'none') + '.' : 'Not started.') + '</p>';
    });
    secs += '</section>';
  });

  const unmatched = R.unmatched.length ? '<p>' + R.unmatched.length + ' older records are left out of the figures. They are under asset numbers from the first asset list, which the drawings have since replaced, and are waiting to be confirmed on site: ' + esc(R.unmatched.map(u => u.id).join(', ')) + '.</p>' : '';

  return `<title>Drainage Progress Report</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: an engineer's report on drawing paper. Summary first, then changes, then each section along its chainage. */
:root {
  --paper: #F7F8F6; --sheet: #FFFFFF; --ink: #1B2420; --muted: #5D6963; --rule: #D6DCD8;
  --design: #8E9C96; --design-bg: #EEF1EF; --fin: #1F6B4F; --way: #C98A1B; --flag: #C2412D; --stn: #E4E9F0; --stn-ink: #48607A;
  --f-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-head: "IBM Plex Sans Condensed", "Arial Narrow", system-ui, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #121715; --sheet: #1A201D; --ink: #E6ECE8; --muted: #9AA7A0; --rule: #2E3833;
  --design: #6F7D77; --design-bg: #232B27; --fin: #4CC08E; --way: #E6A93A; --flag: #F06A52; --stn: #1F2A36; --stn-ink: #9DB4CC; color-scheme: dark } }
:root[data-theme="dark"] {
  --paper: #121715; --sheet: #1A201D; --ink: #E6ECE8; --muted: #9AA7A0; --rule: #2E3833;
  --design: #6F7D77; --design-bg: #232B27; --fin: #4CC08E; --way: #E6A93A; --flag: #F06A52; --stn: #1F2A36; --stn-ink: #9DB4CC; color-scheme: dark }
body { background: var(--paper); color: var(--ink); font: 15px/1.5 var(--f-body); }
.wrap { max-width: 1160px; margin: 0 auto; padding-block: 28px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 34px; }
.wrap > *, .sect > * { min-width: 0; }
header { display: grid; gap: 6px; border-bottom: 2px solid var(--ink); padding-bottom: 16px; }
.eyebrow { font: 600 12px/1 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
h1 { font: 700 clamp(28px, 5vw, 40px)/1.1 var(--f-head); margin: 0; text-wrap: balance; }
h2 { font: 700 24px/1.2 var(--f-head); margin: 0 0 12px; }
h3 { font: 700 21px/1.25 var(--f-head); margin: 0 0 6px; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; }
h3 span, .sec th span { font: 500 13px/1 var(--f-mono); color: var(--muted); }
h4 { font: 600 15px/1.3 var(--f-body); margin: 18px 0 8px; }
p { margin: 0; max-width: 72ch; }
.lead { color: var(--muted); margin-bottom: 10px; }
.muted { color: var(--muted); }
small { display: block; color: var(--muted); font-size: 12px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.kpi { background: var(--sheet); border: 1px solid var(--rule); border-radius: 6px; padding: 14px 16px; display: grid; gap: 4px; }
.kpi b { font: 700 28px/1.1 var(--f-head); font-variant-numeric: tabular-nums; }
.kpi span { color: var(--muted); font-size: 13px; }
.tw, .dia { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.dia { background: var(--sheet); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 10px 4px; }
.dia svg { display: block; }
table { border-collapse: collapse; width: 100%; background: var(--sheet); font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--rule); vertical-align: top; }
thead th { font: 600 12px/1.2 var(--f-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--muted); background: var(--paper); }
td.n, th.n { text-align: right; white-space: nowrap; font-family: var(--f-mono); font-size: 14px; }
.sum td:first-child { min-width: 200px; }
.sec th { background: var(--paper); font: 700 16px/1.3 var(--f-head); padding-top: 18px; border-bottom: 2px solid var(--ink); display: table-cell; }
.sec th span { margin-left: 12px; }
tr.rest td { color: var(--muted); font-size: 13px; }
.bar { display: flex; width: 160px; max-width: 100%; height: 10px; background: var(--design-bg); border: 1px solid var(--design); border-radius: 2px; overflow: hidden; }
.bar i { display: block; height: 100%; }
.bar .d { background: var(--fin); } .bar .p { background: var(--way); }
.list td { white-space: nowrap; } .list td:nth-child(4) { white-space: normal; min-width: 160px; }
.chg td { min-width: 150px; } .chg td:first-child { min-width: 0; }
.kind { display: inline-block; margin-top: 6px; font: 600 11px/1 var(--f-mono); text-transform: uppercase; letter-spacing: .05em; padding: 4px 6px; border-radius: 3px; border: 1px solid currentColor; }
.kind.site { color: var(--flag); } .kind.instructed { color: var(--stn-ink); }
.flag { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--flag); color: var(--sheet); font: 700 12px/1 var(--f-mono); }
.flag.sm { width: 18px; height: 18px; font-size: 11px; margin-left: 6px; vertical-align: 1px; }
.st { font: 600 12px/1 var(--f-mono); text-transform: uppercase; letter-spacing: .04em; padding: 3px 6px; border-radius: 3px; }
.st.fin { background: var(--fin); color: var(--sheet); } .st.way { background: var(--way); color: #1B1407; }
.key { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: var(--muted); align-items: center; }
.key i { display: inline-block; width: 26px; height: 10px; margin-right: 6px; vertical-align: -1px; border: 1px solid var(--design); }
.key .k-des { background: var(--design-bg); } .key .k-fin { background: var(--fin); border-color: var(--fin); } .key .k-way { background: var(--way); border-color: var(--way); } .key .k-stn { background: var(--stn); border-color: var(--stn); }
.sect { display: grid; gap: 6px; border-top: 1px solid var(--rule); padding-top: 22px; }
svg .des { fill: var(--design-bg); stroke: var(--design); stroke-width: .8; }
svg .fin { fill: var(--fin); } svg .way { fill: var(--way); }
svg .stn { fill: var(--stn); } svg .stnl { fill: var(--stn-ink); font: 600 11px var(--f-head); text-anchor: middle; }
svg .grid { stroke: var(--rule); stroke-width: 1; } svg .tick { fill: var(--muted); font: 11px var(--f-mono); text-anchor: middle; }
svg .bl { fill: var(--ink); font: 600 12px var(--f-body); } svg .sl { fill: var(--muted); font: 600 10px var(--f-mono); text-anchor: end; }
svg .fl circle { fill: var(--flag); } svg .fl text { fill: var(--sheet); font: 700 10px var(--f-mono); text-anchor: middle; }
footer { border-top: 1px solid var(--rule); padding-top: 14px; color: var(--muted); font-size: 13px; display: grid; gap: 8px; }
@media (max-width: 640px) { .bar { width: 90px; } .sum td:first-child { min-width: 140px; } }
</style>
<div class="wrap">
<header>
  <span class="eyebrow">Kano–Maradi standard gauge railway · Sections 01 to 05</span>
  <h1>Drainage construction progress</h1>
  <p class="muted">As of ${esc(asofTxt)}. What has been built, against what the design has, section by section.</p>
</header>

<section>
  <h2>Summary</h2>
  <div class="kpis">
    <div class="kpi"><b>${km(finM)} km</b><span>of drains along the line finished, of ${km(desM)} km in the design (${pct(finM, desM)}%)</span></div>
    <div class="kpi"><b>${culvDone} of ${culvN}</b><span>culverts and cattle crossings finished</span></div>
    <div class="kpi"><b>${netDone} of ${netLegs}</b><span>station and yard collector drains finished (${km(netDoneM)} of ${km(netM)} km)</span></div>
    <div class="kpi"><b>${R.changes.length}</b><span>changes from the design, ${R.changes.filter(c => c.kind === 'site').length} of them built differently on site</span></div>
  </div>
  <h4>By section and drainage type</h4>
  <div class="key"><span><i class="k-fin"></i>Finished</span><span><i class="k-way"></i>Under way</span><span><i class="k-des"></i>Design, not built</span></div>
  <div class="tw"><table class="sum"><thead><tr><th>Type</th><th class="n">Design</th><th class="n">Finished</th><th class="n">%</th><th>Progress</th></tr></thead>${sum}</table></div>
</section>

<section>
  <h2>Changes from the design</h2>
  <p class="lead">Built differently on site, or changed by instruction. The numbers mark them on the section diagrams below.</p>
  <div class="tw"><table class="chg"><thead><tr><th>No.</th><th>Where</th><th>Design</th><th>Built</th><th>Status</th></tr></thead><tbody>${chg}</tbody></table></div>
</section>

<section>
  <h2>Section by section</h2>
  <div class="key"><span><i class="k-des"></i>Design</span><span><i class="k-fin"></i>Finished</span><span><i class="k-way"></i>Under way</span><span><i class="k-stn"></i>Station or yard</span><span><span class="flag sm" style="margin:0 6px 0 0">1</span>Change from the design</span></div>
  ${secs}
</section>

<footer>
  <p>From the KMD Drainage Inspector app: site records and the office's progress imports (${R.rows} records), read ${esc(asofTxt)}. Design lengths are from the DRN-LONG drawings, with Type 9 where the embankment is higher than 1.8 m (change 2) and Dawanau Station as set out (change 3). Lengths are along the main line's chainage. The station and yard collector drains are measured along each drain.</p>
  ${unmatched}
</footer>
</div>`;
};
