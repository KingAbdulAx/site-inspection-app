/*
 * Bake base-data corrections made on the phone into the bundled data.
 *
 *   node scripts/apply_base_corrections.js path/to/kmd-base-corrections.json [--dry-run]
 *
 * The JSON comes from the app: Section → Switch → Base data → Export corrections.
 * It rewrites data/section01_bundle.js, data/bundle.js and data/section02_bundle.js (and the matching
 * *_assets.json files) using the same code the app uses to apply corrections,
 * so what you saw on the phone is exactly what gets written. Corrections are
 * absolute values, so baking the same file twice changes nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!file) { console.log('usage: node scripts/apply_base_corrections.js corrections.json [--dry-run]'); process.exit(1); }
const input = JSON.parse(fs.readFileSync(file, 'utf8'));
if (input.kind !== 'kmd-base-corrections') { console.error('Not a corrections export from the app.'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
global.window = global;
const store = { KMD_WALK_RECORDS_V1: JSON.stringify(input.records || []) };
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
require(path.join(ROOT, 'data/bundle.js'));
require(path.join(ROOT, 'data/section01_bundle.js'));
require(path.join(ROOT, 'data/section02_bundle.js'));
require(path.join(ROOT, 'ui/model.js'));
const DI = window.DI;
DI.init();

const live = DI.baseRecords();
const counts = live.reduce((o, r) => { o[r.action] = (o[r.action] || 0) + 1; return o; }, {});
console.log('Corrections in file: ' + (input.records || []).length + ' records; live: ' + JSON.stringify(counts));

const targets = [
  { sub: 'KNDW', bundle: 'data/section01_bundle.js', centre: 'SECTION01_CENTERLINE', assets: 'SECTION01_ASSETS', json: 'data/section01_assets.json' },
  { sub: 'KZDR', bundle: 'data/bundle.js', centre: 'SECTION03_CENTERLINE', assets: 'SECTION03_ASSETS', json: 'data/section03_assets.json' },
  { sub: 'DWKZ', bundle: 'data/section02_bundle.js', centre: 'SECTION02_CENTERLINE', assets: 'SECTION02_ASSETS', json: 'data/section02_assets.json' }
];
targets.forEach(t => {
  const before = (window[t.assets].features || []).length;
  const n = live.filter(r => ((DI.data.byId[r.featureId] || {}).sub || r.sub) === t.sub).length;
  if (!n) { console.log(t.sub + ': no corrections, left untouched'); return; }
  const geo = DI.exportGeo(t.sub);
  console.log(t.sub + ': ' + before + ' → ' + geo.features.length + ' features' + (geo.metadata.removed_as_extraction_errors.length ? ', removed ' + geo.metadata.removed_as_extraction_errors.map(x => x.id).join(', ') : ''));
  if (dry) return;
  // Keep the centreline text as it is; only the assets block is rewritten.
  const old = fs.readFileSync(path.join(ROOT, t.bundle), 'utf8');
  const at = old.indexOf('\nwindow.' + t.assets + ' = ');
  const head = at >= 0 ? old.slice(0, at + 1) : 'window.' + t.centre + ' = ' + JSON.stringify(window[t.centre], null, 2) + ';\n\n';
  fs.writeFileSync(path.join(ROOT, t.bundle), head + 'window.' + t.assets + ' = ' + JSON.stringify(geo, null, 2) + ';\n');
  if (fs.existsSync(path.join(ROOT, t.json))) fs.writeFileSync(path.join(ROOT, t.json), JSON.stringify(geo, null, 2));
});
console.log(dry ? 'Dry run: nothing written.' : 'Written. Commit the data/ changes; the phone can keep or clear its corrections (re-applying them is harmless).');
