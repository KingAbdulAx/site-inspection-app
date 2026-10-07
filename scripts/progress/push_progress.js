/*
 * Write a progress file (from import_progress.js) to the cloud database the app
 * syncs from: the Supabase `inspections` table, one row per asset.
 *
 *   node scripts/progress/push_progress.js data/progress/progress_2026-09-25.json          # dry run
 *   node scripts/progress/push_progress.js data/progress/progress_2026-09-25.json --push   # write
 *   node scripts/progress/push_progress.js data/progress/pushed_2026-09-25.json --undo     # remove what was written
 *
 * The table is read again just before writing. A row that is there now is left
 * alone, unless it is the exact older, lower status the progress file expected
 * to replace. Every write is logged to data/progress/pushed_<asof>[_tag].json, with
 * the rows it replaced, so --undo can put them back.
 *
 * On the phone these rows show as the office's record for the asset, by
 * "Execution chart 25/09/26" or "Ditch progress T9 30/09/26". A newer record
 * made on the phone still wins.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const push = args.includes('--push');
const undo = args.includes('--undo');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
require(path.join(__dirname, '..', '..', 'config.js'));
const { supabaseUrl, supabaseAnonKey } = window.APP_CONFIG;
const URL = supabaseUrl.replace(/\/$/, '') + '/rest/v1/inspections';
const H = { apikey: supabaseAnonKey, Authorization: 'Bearer ' + supabaseAnonKey, 'Content-Type': 'application/json' };
const DEVICE = 'import-progress';

async function current() {
  const r = await fetch(URL + '?select=*', { headers: H });
  if (!r.ok) throw new Error('read failed ' + r.status + ' ' + await r.text());
  return r.json();
}
async function upsert(rows) {
  const r = await fetch(URL, { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, H), body: JSON.stringify(rows) });
  if (!r.ok) throw new Error('write failed ' + r.status + ' ' + await r.text());
}
async function remove(ids) {
  for (let i = 0; i < ids.length; i += 50) {
    const q = ids.slice(i, i + 50).map(id => '"' + id.replace(/"/g, '') + '"').join(',');
    const r = await fetch(URL + '?asset_id=in.(' + encodeURIComponent(q) + ')&device_id=eq.' + DEVICE, { method: 'DELETE', headers: H });
    if (!r.ok) throw new Error('delete failed ' + r.status + ' ' + await r.text());
  }
}

(async () => {
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (undo) {
    // Remove what this script wrote, then put back the rows it replaced.
    const written = input.written.map(w => w.asset_id);
    console.log('removing ' + written.length + ' rows written on ' + input.pushed_at + (push ? '' : ' (dry run: add --push)'));
    if (!push) return;
    await remove(written);
    const back = input.written.filter(w => w.replaced).map(w => w.replaced);
    if (back.length) await upsert(back);
    console.log('removed; restored ' + back.length + ' replaced rows');
    return;
  }
  if (input.kind !== 'kmd-progress') throw new Error('not a progress file');
  const now = await current();
  const have = new Map(now.map(r => [r.asset_id, r]));
  const rows = [], skipped = [];
  input.rows.forEach(r => {
    const e = have.get(r.asset_id);
    const expected = r.replaces && e && e.status === r.replaces.status && e.updated_at === r.replaces.at;
    if (e && !expected) { skipped.push(r.asset_id + ' (now ' + e.status + ', ' + e.inspected_by + ')'); return; }
    rows.push({
      asset_id: r.asset_id, status: r.status, notes: r.notes, has_defect: false,
      inspection_date: r.inspection_date, inspected_by: r.inspected_by, device_id: DEVICE,
      updated_at: r.inspection_date + 'T12:00:00+00:00', _replaced: e || null
    });
  });
  // A replaced row keeps a newer time than the one it replaces, so every device takes it.
  rows.forEach(r => { if (r._replaced && r._replaced.updated_at >= r.updated_at) r.updated_at = new Date().toISOString(); });
  console.log(rows.length + ' rows to write (' + rows.filter(r => r._replaced).length + ' replacing), ' + skipped.length + ' skipped because the database has a row now' + (skipped.length ? ': ' + skipped.slice(0, 8).join('; ') : ''));
  if (!push) { console.log('dry run: add --push to write'); return; }
  const stamp = new Date().toISOString();
  // progress_2026-09-25_S04.json logs to pushed_2026-09-25_S04.json
  const log = path.join(path.dirname(file), /^progress_/.test(path.basename(file)) ? path.basename(file).replace(/^progress_/, 'pushed_') : 'pushed_' + input.asof + '.json');
  fs.writeFileSync(log, JSON.stringify({ kind: 'kmd-progress-pushed', asof: input.asof, pushed_at: stamp, table_before: now.length, written: rows.map(r => ({ asset_id: r.asset_id, status: r.status, replaced: r._replaced })) }, null, 1));
  for (let i = 0; i < rows.length; i += 100) await upsert(rows.slice(i, i + 100).map(r => { const o = Object.assign({}, r); delete o._replaced; return o; }));
  const after = await current();
  const ok = rows.filter(r => { const a = after.find(x => x.asset_id === r.asset_id); return a && a.status === r.status && a.device_id === DEVICE; }).length;
  console.log('written: ' + ok + ' of ' + rows.length + ' confirmed; table ' + now.length + ' → ' + after.length + ' rows; log ' + path.relative(process.cwd(), log));
})().catch(e => { console.error(e.message); process.exit(1); });
