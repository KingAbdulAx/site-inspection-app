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
  // These tests must never reach the live cloud database: the app would sync the records they make
  // (stages, defects, ranges) as real inspections. Every request to Supabase is refused.
  const _newContext = b.newContext.bind(b);
  b.newContext = async (...a) => { const c = await _newContext(...a); await c.route(/supabase\.co/, r => r.abort()); return c; };
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
    return DA.strip.hits.filter(h => !h.ref).map(h => ({ id: h.f.id, x: r.left + (Math.max(h.x0, 0) + Math.min(h.x1, r.width)) / 2, y: r.top + (h.y0 + h.y1) / 2 }))
      .filter(h => { const e = document.elementFromPoint(h.x, h.y); return e && e.closest('#stripHost'); });
  });
  let right = 0, opened = 0;
  for (const m of marks) {
    await t.evaluate(() => DA.closeAll());
    await t.touchscreen.tap(m.x, m.y); await t.waitForTimeout(400);
    const got = await t.evaluate(() => { const ov = document.querySelector('.ov:last-child'); if (!ov) return null; const s = ov.querySelector('[data-act=stage],[data-act=range-all]'); const hl = ov.querySelector('.frow.hl'); return s ? s.dataset.id : hl ? hl.dataset.id : '?'; });
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
  // a ditch's record sheet and feature page give both ends and the length
  await t.evaluate(() => DA.closeAll());
  const span = await t.evaluate(() => { const f = DI.data.bySub.DWKZ.find(x => x.code === 'T9' && x.cert === 'exact' && x.ch1 - x.ch0 > 20); return { id: f.id, a: DI.fmtCh(f.ch0, 3), b: DI.fmtCh(f.ch1, 3), m: Math.round(f.ch1 - f.ch0).toLocaleString('en-GB') + ' m' }; });
  await t.evaluate(id => DA.openRecord(id), span.id); await t.waitForTimeout(300);
  const sheet = await t.evaluate(() => document.querySelector('.ov:last-child .fhead .t2').textContent);
  assert(sheet.includes(span.a) && sheet.includes(span.b) && sheet.includes(span.m), 'record sheet shows from, to and length: ' + sheet.trim());
  await t.evaluate(id => { DA.closeAll(); DA.openFeature(id); }, span.id); await t.waitForTimeout(400);
  const kv = await t.evaluate(() => document.querySelector('.ov:last-child .kv').textContent);
  assert(/From/.test(kv) && kv.includes(span.b) && /Length/.test(kv) && kv.includes(span.m), 'feature page lists From, To and Length');
  await t.evaluate(() => DA.closeAll());
  // Type 9 from the contractor's schedule: on in Section 02, marked as from the letter
  await t.goto(BASE + '?sim=DWKZ:25500:-4:3'); await t.waitForTimeout(2500);
  const pc = await t.evaluate(() => { const f = DI.data.bySub.DWKZ.find(x => x.sched && x.ch1 - x.ch0 > 100); return f && { id: f.id, a: DI.fmtCh(f.ch0, 3), b: DI.fmtCh(f.ch1, 3) }; });
  assert(pc, 'Section 02 has scheduled Type 9 pieces once the page has loaded');
  await t.evaluate(id => DA.openRecord(id), pc.id); await t.waitForTimeout(300);
  const psheet = await t.evaluate(() => document.querySelector('.ov:last-child .fhead').textContent);
  assert(/Letter 4218/.test(psheet) && psheet.includes(pc.a) && psheet.includes(pc.b), 'a scheduled piece is marked Letter 4218 with its ends: ' + psheet.replace(/\s+/g, ' ').slice(0, 90));
  await t.evaluate(() => DA.closeAll());
  // Type 9 progress by length, from the record sheet
  const big = await t.evaluate(() => { const f = DI.data.bySub.DWKZ.find(x => x.sched && x.ch1 - x.ch0 > 250); return { id: f.id, a: Math.round(f.ch0), b: Math.round(f.ch1) }; });
  await t.evaluate(id => DA.openRecord(id), big.id); await t.waitForTimeout(300);
  assert(await t.evaluate(() => !!document.querySelector('.ov:last-child .rgbar') && /0 of/.test(document.querySelector('.ov:last-child .rg-sum').textContent)), 'the sheet of a Type 9 asks how much is done: 0 m so far');
  await t.fill('#rgFrom', await t.evaluate(v => DI.fmtCh(v), big.a)); await t.fill('#rgTo', await t.evaluate(v => DI.fmtCh(v), big.a + 100));
  await t.tap('.ov:last-child [data-act=range-save]'); await t.waitForTimeout(400);
  const part = await t.evaluate(id => { const c = DI.statusOf(DI.data.byId[id]); return { m: Math.round(c.cover.m), bucket: c.bucket }; }, big.id);
  assert(part.m === 100 && part.bucket === 'moving', 'a typed range saves: ' + JSON.stringify(part));
  await t.evaluate(id => DA.openRecord(id), big.id); await t.waitForTimeout(300);
  assert(await t.evaluate(() => /100 of/.test(document.querySelector('.ov:last-child .rg-sum').textContent) && document.querySelectorAll('.ov:last-child .rgbar i').length === 1), 'the sheet shows 100 m done');
  const bigLast = await t.evaluate(id => DI.data.byId[id].ladder.length - 1, big.id);
  await t.tap('.ov:last-child [data-act=stage][data-stage="' + bigLast + '"]'); await t.waitForTimeout(400);
  assert(await t.evaluate(id => DI.statusOf(DI.data.byId[id]).bucket === 'done', big.id), 'the whole stretch finished in one tap');
  // any ditch: a part at a stage, picked on the sheet
  const t12 = await t.evaluate(() => { const f = DI.data.bySub.DWKZ.find(x => x.code === 'T12' && x.ch1 - x.ch0 > 200 && !DI.coverOf(x)); return { id: f.id, a: Math.round(f.ch0) }; });
  await t.evaluate(id => DA.openRecord(id), t12.id); await t.waitForTimeout(300);
  await t.tap('.ov:last-child [data-act=range-stage][data-stage="3"]'); await t.waitForTimeout(300);
  assert(await t.evaluate(() => /Save this part at Formwork/.test(document.querySelector('.ov:last-child [data-act=range-save]').textContent)), 'the stage picked for a part shows on the save button');
  await t.fill('#rgFrom', await t.evaluate(v => DI.fmtCh(v), t12.a + 10)); await t.fill('#rgTo', await t.evaluate(v => DI.fmtCh(v), t12.a + 70));
  await t.tap('.ov:last-child [data-act=range-save]'); await t.waitForTimeout(400);
  const tw = await t.evaluate(id => { const c = DI.coverOf(DI.data.byId[id]); return { f: Math.round(c.mAt[3]), e: Math.round(c.mAt[1]), m: Math.round(c.m) }; }, t12.id);
  assert(tw.f === 60 && tw.e === 60 && tw.m === 0, 'a T12 part saved at Formwork: ' + JSON.stringify(tw));
  await t.evaluate(id => DA.openRecord(id), t12.id); await t.waitForTimeout(300);
  assert(await t.evaluate(() => /Formwork\s*60 m/.test(document.querySelector('.ov:last-child .rg-stages').textContent.replace(/\s+/g, ' '))), 'the sheet lists the metres at each stage');
  await t.evaluate(() => DA.closeAll());

  // Phase 3: Built to a different length (as-built extent editing, quiet design vs built display, strip rendering, undo)
  const spanFeat = await t.evaluate(() => {
    const f = DI.data.bySub.DWKZ.find(x => x.kind === 'linear' && x.ch1 - x.ch0 > 100);
    return { id: f.id, ch0: Math.round(f.ch0), ch1: Math.round(f.ch1) };
  });
  await t.evaluate(id => DA.openRecord(id), spanFeat.id);
  await t.waitForTimeout(300);
  assert(await t.evaluate(() => !!document.querySelector('.ov:last-child [data-act=extent-edit]')), 'record sheet has Built to a different length button');
  await t.tap('.ov:last-child [data-act=extent-edit]');
  await t.waitForTimeout(300);
  assert(await t.evaluate(() => !!document.querySelector('#eeChInput')), 'extent editing sheet opened with chainage input');
  await t.tap('.ov:last-child [data-act=ee-pick-end][data-end=end]');
  await t.tap('.ov:last-child [data-act=ee-nudge][data-n="25"]');
  await t.waitForTimeout(200);
  const preview = await t.evaluate(() => document.querySelector('#eePreview').textContent);
  assert(preview.includes('+25 m'), 'live preview shows +25 m extension: ' + preview);
  await t.tap('.ov:last-child [data-act=ee-save]');
  await t.waitForTimeout(400);
  await t.evaluate(id => DA.openRecord(id), spanFeat.id);
  await t.waitForTimeout(300);
  const sheetHead = await t.evaluate(() => document.querySelector('.ov:last-child .fhead').textContent);
  assert(sheetHead.includes('+25 m') && sheetHead.includes('As built'), 'sheet header displays quiet as-built extent: ' + sheetHead.replace(/\s+/g, ' ').slice(0, 100));
  await t.evaluate(id => DA.openFeature(id), spanFeat.id);
  await t.waitForTimeout(300);
  const featText = await t.evaluate(() => document.querySelector('.ov:last-child').textContent);
  assert(featText.includes('As built') && featText.includes('+25 m on site'), 'feature page shows quiet extent under title');
  await t.evaluate(id => DA.openHistory(id), spanFeat.id);
  await t.waitForTimeout(300);
  const histText = await t.evaluate(() => document.querySelector('.ov:last-child').textContent);
  assert(histText.includes('As built') && histText.includes('+25 m'), 'history page lists as-built event');
  await t.evaluate(() => DA.closeAll());
  await t.evaluate(id => {
    const f = DI.data.byId[id];
    DA.setHand(f.line, f.built ? f.built.ch1 : f.ch1);
  }, spanFeat.id);
  await t.waitForTimeout(600);
  const stripHasTag = await t.evaluate(() => document.querySelector('#stripHost').innerHTML.includes('+25m'));
  assert(stripHasTag, 'strip renders +25m tag on extended end');
  await t.evaluate(id => {
    const rec = DI.live(r => r.kind === 'extent' && r.featureId === id).pop();
    if (rec) DI.voidRecord(rec.id);
  }, spanFeat.id);
  const reverted = await t.evaluate(id => !DI.data.byId[id].built, spanFeat.id);
  assert(reverted, 'undoing extent record reverts f.built');

  // Phase 4: Automatic joins when spans overlap
  const joinFeats = await t.evaluate(() => {
    const f1 = DI.data.byId['s02_asset_143'];
    const f2 = DI.data.byId['t9s_DWKZ_R_24825'];
    return { id1: f1.id, id2: f2.id, ch0: Math.round(f1.ch0), ch1: Math.round(f1.ch1), f2ch0: Math.round(f2.ch0), f2ch1: Math.round(f2.ch1) };
  });
  await t.evaluate(id => DA.openRecord(id), joinFeats.id1);
  await t.waitForTimeout(300);
  await t.tap('.ov:last-child [data-act=extent-edit]');
  await t.waitForTimeout(300);
  await t.tap('.ov:last-child [data-act=ee-pick-end][data-end=end]');
  await t.fill('#eeChInput', '24+850');
  await t.evaluate(() => {
    const inp = document.querySelector('#eeChInput');
    inp.dispatchEvent(new Event('change'));
  });
  await t.waitForTimeout(200);
  const joinPreview = await t.evaluate(() => document.querySelector('#eePreview').textContent);
  assert(joinPreview.includes('This will join with'), 'live preview announces join on overlap: ' + joinPreview);
  await t.tap('.ov:last-child [data-act=ee-save]');
  await t.waitForTimeout(400);
  const joinToast = await t.evaluate(() => document.querySelector('#toastHost').textContent);
  assert(joinToast.includes('Joined with'), 'toast confirms join: ' + joinToast);
  const isJoined = await t.evaluate(([id1, id2]) => {
    const p = DI.data.byId[id1];
    const abs = DI.data.byId[id2];
    return p.absorbed && p.absorbed.some(x => x.id === id2) && abs.absorbedInto === id1;
  }, [joinFeats.id1, joinFeats.id2]);
  assert(isJoined, 'primary lists absorbed piece and absorbed piece points to primary');
  await t.evaluate(id => DA.openHistory(id), joinFeats.id1);
  await t.waitForTimeout(300);
  const histJoin = await t.evaluate(() => document.querySelector('.ov:last-child').textContent);
  assert(histJoin.includes('Joined') && histJoin.includes('Absorbed'), 'history lists join timeline event');
  await t.evaluate(() => DA.closeAll());
  // Undo join via toast
  await t.tap('#toastHost [data-act=undo]');
  await t.waitForTimeout(400);
  const undone = await t.evaluate(([id1, id2]) => {
    return DI.data.byId[id1].absorbed === null && DI.data.byId[id2].absorbedInto === null;
  }, [joinFeats.id1, joinFeats.id2]);
  assert(undone, 'undo via toast restores separate spans');

  await t.goto(BASE + '?sim=KZDR:100500:-4:3'); await t.waitForTimeout(2000);
  assert(await t.evaluate(() => DI.hasT9Schedule('KZDR') && DI.hasT9Schedule('MRJB')), 'the other sections have their scheduled pieces too');
  // embankment height and the Type 9 check (S02 has the longitudinal profile)
  await t.goto(BASE + '?sim=DWKZ:41500:-4:3&tab=section'); await t.waitForTimeout(2500);
  // the Progress tab: scopes, completion by count and by length, types named on their buttons
  assert(await t.evaluate(() => /Progress/.test(document.querySelector('.nav [data-tab=section]').textContent)), 'the tab is called Progress');
  const pg = await t.evaluate(() => ({
    scopes: [...document.querySelectorAll('[data-act=sec-scope]')].map(b => b.textContent.trim()),
    rows: [...document.querySelectorAll('[data-act=sec-sub]')].map(b => b.dataset.sub),
    chips: [...document.querySelectorAll('[data-act=sec-cat]')].map(b => b.innerText.replace(/\s+/g, ' ').trim()),
    stat: document.querySelector('.povr').innerText.replace(/\s+/g, ' ')
  }));
  assert(pg.scopes.join() === 'All,Main line,Branch line' && pg.rows.length === 5, 'overview: All / Main line / Branch line, one row per section: ' + pg.rows.join());
  assert(pg.chips.some(c => /Type 9 shoulder ditch \d+\.\d of \d+\.\d km/.test(c)) && pg.chips.some(c => /Box culverts \d+ of \d+/.test(c)), 'type buttons carry their progress: ' + pg.chips.slice(1, 4).join(' | '));
  assert(/Structures \d[\d,]* of \d[\d,]* \d+%/i.test(pg.stat) && /Ditches \d[\d,.]* of \d[\d,.]* km/i.test(pg.stat), 'completion shown as a count and as km: ' + pg.stat.slice(0, 120));
  await t.tap('[data-act=sec-scope][data-v=KD]'); await t.waitForTimeout(300);
  assert(await t.evaluate(() => document.querySelectorAll('[data-act=sec-sub]').length === 0 && /No drawings/.test(document.querySelector('#scr-section').textContent)), 'the branch line has no drawings yet and says so');
  await t.tap('[data-act=sec-scope][data-v=KM]'); await t.waitForTimeout(300);
  await t.tap('[data-act=sec-sub][data-sub=KZDR]'); await t.waitForTimeout(300);
  assert(await t.evaluate(() => /KZDR/.test(document.querySelector('#scr-section h1 + .rng, #scr-section').textContent) && document.querySelector('.psub.cur').dataset.sub === 'KZDR'), 'tapping a section row opens that section');
  await t.goto(BASE + '?sim=DWKZ:41500:-4:3&tab=section'); await t.waitForTimeout(2500);
  const card = await t.evaluate(() => { const b = document.querySelector('[data-act=t9-list]'); return b && b.textContent; });
  assert(card && /See the \d+ stretches/.test(card), 'Section tab shows the Type 9 check: ' + card);
  await t.tap('[data-act=t9-list]'); await t.waitForTimeout(300);
  const want = await t.evaluate(() => Number(document.querySelector('.ov:last-child .frow').dataset.ch));
  await t.tap('.ov:last-child .frow'); await t.waitForTimeout(800);
  assert(await t.evaluate(w => DA.S.tab === 'walk' && DA.strip.viewCh === w, want), 'a stretch in the list opens the strip there');
  assert(await t.evaluate(() => /FILL|CUT/.test(document.querySelector('#posHead').textContent)), 'the header shows the fill height');
  // bridges and road crossings: drawn for reference, a tap says what it is
  await t.goto(BASE + '?sim=DWKZ:25840:3:3'); await t.waitForTimeout(2000);
  assert(await t.evaluate(() => /FILL|CUT/.test(document.querySelector('#posHead').textContent)), 'at an overpass the header keeps the fill height');
  const band = await t.evaluate(() => { const r = document.querySelector('#stripHost').getBoundingClientRect(); const h = DA.strip.hits.find(x => x.ref); return h && { x: r.left + 20, y: r.top + (h.y0 + h.y1) / 2 }; });
  await t.evaluate(() => DA.closeAll());
  await t.touchscreen.tap(band.x, band.y); await t.waitForTimeout(400);
  assert(await t.evaluate(() => { const ov = document.querySelector('.ov:last-child'); return ov && /OVR-2801/.test(ov.textContent) && /road over the railway/.test(ov.textContent) && !ov.querySelector('[data-act=stage]'); }), 'tapping the overpass opens what it is, with nothing to record');
  await t.goto(BASE + '?sim=DWKZ:36350:3:3'); await t.waitForTimeout(2000);
  assert(await t.evaluate(() => /ON BRG-2602/.test(document.querySelector('#posHead').textContent)), 'on a bridge the header names it');
  await tctx.close();
  console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
  server.close();
  if (errs.length) process.exitCode = 1;
  console.log(process.exitCode ? 'E2E FAILED' : 'E2E PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
