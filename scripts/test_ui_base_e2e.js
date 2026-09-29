/*
 * End-to-end test of the redesigned app in a real browser (Playwright).
 * Serves the repo itself, simulates GPS with ?sim=, and walks the main flows:
 * correcting the base data: fix a feature, undo, add a missing one,
 * remove an extraction error, tick a sheet, and export the corrections.
 * Run: node scripts/test_ui_base_e2e.js   (needs the playwright package + Chromium)
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
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  await new Promise(res => server.listen(0, res));
  const BASE = 'http://localhost:' + server.address().port + '/index.html';
  const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'di-base-'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?sim=KZDR:111020:14:4'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
  const fid = await p.evaluate(() => DA.nearItems(DA.S.pos.ch, 20).find(f => f.code === 'T12').id);
  const before = await p.evaluate(id => ({ ch0: DI.data.byId[id].ch0, side: DI.data.byId[id].side }), fid);
  // correct via feature page
  await p.evaluate(id => DA.openFeature(id), fid); await p.waitForTimeout(300);
  await p.click('.full [data-act=base-edit]'); await p.waitForTimeout(300);
  await p.fill('#bfCh0', '110+520'); await p.fill('#bfOff', '13.8'); await p.selectOption('#bfPreset', 'T7'); await p.waitForTimeout(200);
  await p.click('[data-act=bf-save]'); await p.waitForTimeout(300);
  let f = await p.evaluate(id => { const f = DI.data.byId[id]; return { ch0: f.ch0, code: f.code, off: f.offset, v: !!f.verified, name: f.name }; }, fid);
  ok(f.ch0 === 110520 && f.code === 'T7' && Math.abs(Math.abs(f.off) - 13.8) < 1e-9 && f.v, 'correction applied + checked: ' + JSON.stringify(f));
  await p.click('.toast .undo'); await p.waitForTimeout(300);
  f = await p.evaluate(id => ({ ch0: DI.data.byId[id].ch0, v: !!DI.data.byId[id].verified }), fid);
  ok(f.ch0 === before.ch0 && !f.v, 'undo restores the extraction');
  await p.evaluate(() => DA.closeAll());
  // add missing from drawer
  await p.click('#atyou .more'); await p.waitForTimeout(200);
  await p.click('[data-act=base-add]'); await p.waitForTimeout(300);
  await p.selectOption('#bfPreset', 'PC'); await p.fill('#bfName', 'Pipe culvert Ø1.2 m'); await p.fill('#bfCh0', '111+031.400'); await p.fill('#bfSheet', 'DW-03021-06');
  await p.click('[data-act=bf-save]'); await p.waitForTimeout(300);
  const added = await p.evaluate(() => DI.data.features.filter(f => f.added).map(f => ({ n: f.name, ch: f.ch0, k: f.kind, s: f.sheet })));
  ok(added.length === 1 && added[0].ch === 111031.4 && added[0].k === 'cross', 'missing culvert added: ' + JSON.stringify(added));
  // remove via doors
  await p.evaluate(id => DA.actions.doors({ dataset: { id } }), fid); await p.waitForTimeout(200);
  await p.click('.door [data-act=base-del]'); await p.waitForTimeout(200);
  await p.click('[data-act=base-del-go] >> nth=0'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => !DI.data.features.some(f => f.id === id) && !!DI.data.byId[id].deleted, fid), 'removed as extraction error, still openable');
  // check sheets
  await p.evaluate(() => DA.actions['check-sheets']({ dataset: { sub: 'KZDR' } })); await p.waitForTimeout(300);
  await p.click('[data-act=chk-open] >> nth=20'); await p.waitForTimeout(200);
  const nv0 = await p.evaluate(() => DI.data.features.filter(f => f.verified).length);
  await p.click('[data-act=chk-tick] >> nth=0'); await p.waitForTimeout(200);
  const nv = await p.evaluate(() => DI.data.features.filter(f => f.verified).length);
  ok(nv === nv0 + 1, 'ticked one as checked');
  await p.evaluate(() => DA.closeAll());
  // export + bake
  await p.evaluate(() => DA.actions.project()); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.full .scroll').scrollTop = 1600); await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=base-export]')]);
  await dl.saveAs(SP + '/corrections.json');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  const x = JSON.parse(fs.readFileSync(SP + '/corrections.json', 'utf8'));
  ok(x.kind === 'kmd-base-corrections' && x.records.length >= 6, 'corrections file exported');
  await b.close();
  server.close();
  console.log(process.exitCode ? 'BASE E2E FAILED' : 'BASE E2E PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
