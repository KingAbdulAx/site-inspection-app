/*
 * End-to-end test of the desk layouts in a real browser (Playwright).
 * Serves the repo itself, simulates GPS with ?sim=, and checks:
 * the rail, the docked list, sheets docking on the right, the section beside
 * the strip on wide screens, the keyboard, and moving between phone and desk.
 * Run: node scripts/test_ui_desk_e2e.js   (needs the playwright package + Chromium)
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
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
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
const box = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 }; }, sel);

(async () => {
  await new Promise(res => server.listen(0, res));
  const BASE = 'http://localhost:' + server.address().port + '/index.html';
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?sim=DWKZ:21560:12:4'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1800);

  // ---- wide: rail, strip, section beside it, list docked
  ok(await p.evaluate(() => DA.layout === 'wide' && document.documentElement.classList.contains('wide')), 'wide layout at 1440 px');
  const rail = await box(p, '.nav'), strip = await box(p, '#stripHost'), cut = await box(p, '#cutHost'), dock = await box(p, '#side');
  ok(rail.x === 0 && rail.w < 120 && rail.h === 900, 'nav is a full-height rail on the left: ' + JSON.stringify(rail));
  ok(strip.vis && cut.vis && strip.x + strip.w <= cut.x && cut.x + cut.w <= dock.x, 'strip | section | list side by side');
  ok(dock.x + dock.w === 1440 && dock.w >= 360, 'list docked on the right: ' + JSON.stringify(dock));
  ok(await p.evaluate(() => /Within 20 m of you/.test(document.querySelector('#side').textContent) && document.querySelectorAll('#side .frow').length > 0), 'docked list shows what is within 20 m of you');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#vp .seg3')).display === 'none'), 'strip/map/section switch hidden: the strip is always shown');
  ok(await p.evaluate(() => document.querySelectorAll('#cutHost [data-act=drawer]').length === 0), 'no "As a list" tile when the list is docked');

  // ---- tapping on the strip points the docked list at that feature
  const hit = await p.evaluate(() => { const H = document.querySelector('#stripHost').clientHeight; const h = DA.strip.hits.find(x => x.f.kind !== 'cross' && Math.abs(x.f.ch0 - DA.S.pos.ch) > 5 && x.y0 > 40 && x.y1 < H - 40); return h && { id: h.f.id, x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 }; });
  const sb = await p.$('#stripHost').then(e => e.boundingBox());
  await p.mouse.click(sb.x + hit.x, sb.y + hit.y); await p.waitForTimeout(400);
  ok(await p.evaluate(() => DA.overlays.length === 0 && !!DA.S.sideHl && !!document.querySelector('#side #row-' + CSS.escape(DA.S.sideHl) + '.hl')), 'strip tap highlights the feature in the docked list, no sheet');
  ok(await p.evaluate(() => !!document.querySelector('#side [data-act=side-me]')), '"Back to me" offered while the list is away from you');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => DA.S.sideCh == null && /of you/.test(document.querySelector('#side').textContent)), 'Esc brings the list back to you');

  // ---- sheets dock on the right, over the list
  await p.click('#atyou .main'); await p.waitForTimeout(400);
  const sheet = await box(p, '.ov .sheet');
  ok(sheet && sheet.x + sheet.w === 1440 && sheet.y === 0 && sheet.h === 900 && Math.abs(sheet.w - dock.w) <= 1, 'record sheet docks over the list: ' + JSON.stringify(sheet));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ov .scrim')).display === 'none'), 'no scrim: the strip stays usable');
  const nRec = await p.evaluate(() => DI.records.length);
  await p.click('.ov .opt.primary'); await p.waitForTimeout(300);
  ok(await p.evaluate(n => DI.records.length === n + 1 && DA.overlays.length === 0, nRec), 'recording from the docked sheet saves and closes it');
  await p.click('.toast .undo'); await p.waitForTimeout(200);

  // ---- a sheet opened from a full page sits above it
  await p.evaluate(() => DA.openFeature(DA.atYouPick(DA.S.pos.ch).f.id)); await p.waitForTimeout(300);
  const page = await box(p, '.ov .full');
  ok(page.x > 96 && page.w <= 922, 'full page is a centred page on the desk: ' + JSON.stringify(page));
  await p.evaluate(() => DA.openKeypad()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const s = document.querySelector('.ov:last-child .sheet'); const r = s.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + 200).closest('.sheet') === s; }), 'sheet opened over a full page is on top of it');

  // ---- keyboard on the keypad
  for (const k of ['Backspace', 'Backspace', 'Backspace', 'Backspace', 'Backspace', 'Backspace', 'Backspace', '2', '2', '+', '1', '0', '0']) await p.keyboard.press(k);
  ok(await p.evaluate(() => /22\+100/.test(document.querySelector('.kp-disp').textContent)), 'typed digits go into the keypad');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => DA.overlays.length === 0 && Math.round(DA.S.pos.ch) === 22100 && DA.S.pos.source === 'hand'), 'Enter goes there');
  await p.keyboard.press('g'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => DA.overlays.length === 1 && !!DA.overlays[0].el.kp), 'G opens Go to chainage');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => DA.overlays.length === 0), 'Esc closes it');
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => DA.strip.viewCh != null && !document.querySelector('#recentre').classList.contains('hidden')), 'arrow keys scroll the strip');
  await p.click('#recentre'); await p.waitForTimeout(200);

  // ---- second pane: map, then back to section
  await p.click('.seg2 [data-v=map]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !document.querySelector('#mapHost').classList.contains('hidden') && document.querySelector('#cutHost').classList.contains('hidden') && document.querySelector('#stripHost').getBoundingClientRect().width > 0), 'map beside the strip');
  await p.click('.seg2 [data-v=section]'); await p.waitForTimeout(400);

  // ---- rail: theme and tabs
  await p.click('#railTheme'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'office' && /Office/.test(document.querySelector('#railTheme').textContent)), 'rail switches to the Office theme');
  await p.click('#railTheme'); await p.waitForTimeout(200);
  await p.click('.nav [data-tab=day]'); await p.waitForTimeout(300);
  const day = await p.evaluate(() => { const s = document.querySelector('#scr-day .scroll'); return { l: parseFloat(getComputedStyle(s).paddingLeft), w: s.getBoundingClientRect().width }; });
  ok(day.l > 100, 'Day reads as one centred column: ' + JSON.stringify(day));
  await p.click('.nav [data-tab=walk]'); await p.waitForTimeout(300);

  // ---- resize: desk, phone, and back to wide
  await p.setViewportSize({ width: 1100, height: 800 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => DA.layout === 'desk' && document.querySelector('#vp #cutHost') && getComputedStyle(document.querySelector('#vp .seg3')).display !== 'none' && document.querySelector('#side').getBoundingClientRect().width > 0), 'desk at 1100 px: switch back in the strip, list still docked');
  await p.click('#vp .seg3 [data-mode=section]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#cutHost').getBoundingClientRect().width > 300), 'section mode works on desk');
  await p.click('#vp .seg3 [data-mode=strip]'); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => DA.layout === 'phone' && getComputedStyle(document.querySelector('#side')).display === 'none' && document.querySelector('.nav').getBoundingClientRect().y > 700), 'phone at 390 px: bottom nav, no docked list');
  await p.click('#atyou .more'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => DA.overlays.length === 1 && document.querySelector('.ov .sheet').getBoundingClientRect().x === 0), 'phone: the list is a bottom sheet again');
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => DA.layout === 'wide' && !!document.querySelector('#pane2Body #cutHost') && !!document.querySelector('#pane2Head #cutHead')), 'back to wide: section moved beside the strip again');

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); server.close();
  console.log(process.exitCode ? 'DESK E2E FAILED' : 'DESK E2E PASSED');
})().catch(e => { console.error(e); process.exit(1); });
