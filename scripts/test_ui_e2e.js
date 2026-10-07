/*
 * End-to-end test of the redesigned app in a real browser (Playwright).
 * Serves the repo itself, simulates GPS with ?sim=, and walks the main flows:
 * record + undo, full ladder, defect with photo, keypad, strip drag,
 * design change needing a source, and exporting the day.
 * Run: node scripts/test_ui_e2e.js   (needs the playwright package + Chromium)
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (e2) { console.log('SKIP: playwright not installed'); process.exit(0); }
}
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
});
// a small valid JPEG for the photo flow
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
(async () => {
  await new Promise(res => server.listen(0, res));
  const BASE = 'http://localhost:' + server.address().port + '/index.html';
  const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'di-e2e-'));
  fs.writeFileSync(SP + '/photo.jpg', JPEG);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?sim=KZDR:111020:14:4'); await p.waitForTimeout(1500);
  await p.evaluate(() => { localStorage.removeItem('KMD_WALK_RECORDS_V1'); localStorage.removeItem('KMD_WALK_DRAFTS_V1'); localStorage.removeItem('KMD_DRAINAGE_INSPECTIONS_SEC03_V1'); });
  await p.reload(); await p.waitForTimeout(1500);
  const fid = await p.evaluate(() => DA.atYouPick(DA.S.pos.ch).f.id);
  // record + undo
  await p.click('#atyou .main'); await p.waitForTimeout(200);
  await p.click('.opt.primary'); await p.waitForTimeout(200);
  let seen = await p.evaluate(id => DI.seenOf(id), fid);
  assert(seen && seen.stage > 0 && !seen.office, 'stage recorded as own record');
  await p.click('.toast .undo'); await p.waitForTimeout(200);
  seen = await p.evaluate(id => DI.seenOf(id), fid);
  assert(!seen, 'undo withdraws the record');
  const n = await p.evaluate(() => DI.records.length);
  assert(n === 2, 'undo appends a void; original kept (' + n + ' records)');
  // full ladder
  await p.click('#atyou .main'); await p.click('[data-act=ladder]'); await p.waitForTimeout(100);
  await p.click('#fullLadder [data-stage="4"]'); await p.waitForTimeout(200);
  seen = await p.evaluate(id => DI.seenOf(id), fid);
  assert(seen && seen.stage === 4, 'other stage from the full ladder');
  const legacy = await p.evaluate(id => JSON.parse(localStorage.getItem('KMD_DRAINAGE_INSPECTIONS_SEC03_V1'))[id], fid);
  const stageName = await p.evaluate(id => DI.data.byId[id].ladder[4], fid);
  assert(legacy && legacy.status === stageName, 'mirrored to the sync store by name: ' + (legacy && legacy.status));
  // defect with photo
  await p.evaluate(id => DA.openDefect(id), fid); await p.waitForTimeout(200);
  await p.click('[data-act=df-type][data-v=Cracking]');
  await p.click('[data-act=df-part][data-v=Barrel]');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act=df-photo]')]);
  await fc.setFiles(SP + '/photo.jpg'); await p.waitForTimeout(1200);
  await p.fill('#dfNote', 'Crack along barrel soffit');
  await p.waitForTimeout(100);
  const draft = await p.evaluate(id => DI.drafts()[id], fid);
  assert(draft && draft.photos.length === 1 && draft.defect === 'Cracking', 'draft kept on the phone with the photo');
  await p.click('[data-act=df-raise]'); await p.waitForTimeout(300);
  const d = await p.evaluate(id => DI.openDefects(id), fid);
  assert(d.length === 1 && d[0].photos[0].snapped.ch > 0, 'defect raised with snapped photo position');
  assert(await p.evaluate(id => !DI.drafts()[id], fid), 'draft cleared after raising');
  await p.evaluate(id => DA.openFeature(id), fid); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.full .scroll').scrollTop = 1250);
  await p.evaluate(() => DA.closeAll());
  // keypad to DWKZ
  await p.click('#posHead .pos-ch');
  for (let i = 0; i < 8; i++) await p.click('[data-act=kp-key][data-k=del]');
  for (const k of '50+000') await p.click(`[data-act=kp-key][data-k="${k}"]`);
  await p.click('[data-act=kp-go]'); await p.waitForTimeout(400);
  const pos = await p.evaluate(() => DA.S.pos);
  assert(pos.sub === 'DWKZ' && pos.ch === 50000 && pos.source === 'hand', 'keypad moves to DWKZ 50+000 by hand');
  // pan strip
  const box = await p.locator('#stripHost').boundingBox();
  await p.mouse.move(box.x + 100, box.y + 200); await p.mouse.down(); await p.mouse.move(box.x + 100, box.y + 500, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(300);
  assert(await p.isVisible('#recentre'), 'dragging the strip shows Back to me');
  await p.click('#recentre'); await p.waitForTimeout(200);
  assert(!(await p.isVisible('#recentre')), 'Back to me recentres');
  // zoom: fixed steps, wider span, faster pan, kept across reloads
  const z0 = await p.evaluate(() => ({ z: DA.strip.zoom, span: DA.strip.span(), lbl: document.querySelector('#zoomLbl').textContent }));
  await p.click('#zoomCtl [data-d="1"]'); await p.waitForTimeout(200);
  await p.click('#zoomCtl [data-d="1"]'); await p.waitForTimeout(200);
  const z2 = await p.evaluate(() => ({ z: DA.strip.zoom, span: DA.strip.span(), lbl: document.querySelector('#zoomLbl').textContent, out: document.querySelector('#zoomCtl').classList.contains('out') }));
  assert(z0.z === 0 && z2.z === 2 && z2.span > z0.span * 8 && z2.out, 'zoom out two steps: ' + z0.lbl + ' → ' + z2.lbl);
  const pan0 = await p.evaluate(() => { DA.strip.pan(100); const v = DA.strip.viewCh; DA.strip.recentre(); return Math.abs(v - DA.S.pos.ch); });
  assert(pan0 > 400, 'the same drag moves ' + Math.round(pan0) + ' m zoomed out (53 m at walking scale)');
  await p.reload(); await p.waitForTimeout(1200);
  assert(await p.evaluate(() => DA.strip.zoom === 2), 'zoom kept across a reload');
  await p.keyboard.press('+'); await p.keyboard.press('+'); await p.keyboard.press('+'); await p.waitForTimeout(200);
  assert(await p.evaluate(() => DA.strip.zoom === 0 && document.querySelector('#zoomCtl [data-d="-1"]').disabled), '+ zooms back in, and stops at the walking scale');
  // tap a mark opens the drawer
  // design change: remove, then strip marks it
  await p.goto(BASE + '?sim=KZDR:111020:14:4'); await p.waitForTimeout(1500);
  await p.evaluate(id => DA.actions['design-edit']({ dataset: { id, v: 'remove' } }), fid); await p.waitForTimeout(200);
  await p.click('[data-act=de-save]'); await p.waitForTimeout(200);
  assert(await p.evaluate(id => !DI.statusOf(DI.data.byId[id]).removed, fid), 'no source → no design change');
  await p.fill('[data-src=rev]', '07'); await p.click('[data-act=de-save]'); await p.waitForTimeout(300);
  const st = await p.evaluate(id => { const s = DI.statusOf(DI.data.byId[id]); return { removed: s.removed, q: DI.live(r => r.kind === 'query' && r.featureId === id).length }; }, fid);
  assert(st.removed && st.q === 1, 'removal pending + built-but-removed query raised');
  // day export
  await p.click('.nav [data-tab=day]'); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export-day]')]);
  const dlPath = await dl.path(); const csv = fs.readFileSync(dlPath, 'utf8');
  assert(/record_id/.test(csv) && csv.split('\n').length > 3, 'day CSV exported (' + (csv.split('\n').length - 1) + ' rows)');
  await p.waitForTimeout(800);
  // touch: a finger tap on a mark opens that structure, not whatever the follow-up click lands on
  const tctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const t = await tctx.newPage();
  t.on('pageerror', e => errs.push(e.message));
  await t.goto(BASE + '?sim=DWKZ:21500:8:3'); await t.waitForTimeout(1500);
  await t.evaluate(() => { localStorage.setItem('KMD_STRIP_ZOOM_V1', '0'); localStorage.removeItem('KMD_WALK_RECORDS_V1'); }); await t.reload(); await t.waitForTimeout(1500);
  const marks = await t.evaluate(() => {
    const r = document.querySelector('#stripHost').getBoundingClientRect();
    return DA.strip.hits.map(h => ({ id: h.f.id, x: r.left + (Math.max(h.x0, 0) + Math.min(h.x1, r.width)) / 2, y: r.top + (h.y0 + h.y1) / 2 }))
      .filter(h => { const e = document.elementFromPoint(h.x, h.y); return e && e.closest('#stripHost'); });
  });
  let right = 0, opened = 0;
  for (const m of marks) {
    await t.evaluate(() => DA.closeAll());
    await t.touchscreen.tap(m.x, m.y); await t.waitForTimeout(400);
    const got = await t.evaluate(() => { const ov = document.querySelector('.ov:last-child'); if (!ov) return null; const s = ov.querySelector('[data-act=stage]'); const hl = ov.querySelector('.frow.hl'); return s ? s.dataset.id : hl ? hl.dataset.id : '?'; });
    if (got) opened++;
    if (got === m.id) right++;
  }
  assert(marks.length > 5 && right === marks.length, 'finger taps open the tapped structure (' + right + ' of ' + marks.length + ', ' + opened + ' opened)');
  // completed in two taps: the mark, then Completed
  await t.evaluate(() => DA.closeAll());
  const one = marks.find(m => true);
  await t.touchscreen.tap(one.x, one.y); await t.waitForTimeout(400);
  const last = await t.evaluate(id => DI.data.byId[id].ladder.length - 1, one.id);
  await t.tap('.ov:last-child [data-act=stage][data-stage="' + last + '"]'); await t.waitForTimeout(300);
  seen = await t.evaluate(id => DI.seenOf(id), one.id);
  assert(seen && seen.stage === last, 'completed from the record sheet in one tap');
  await tctx.close();
  console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
  server.close();
  if (errs.length) process.exitCode = 1;
  console.log(process.exitCode ? 'E2E FAILED' : 'E2E PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
