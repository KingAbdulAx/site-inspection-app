/*
 * Bundle every data/dwg/<SUB>_structures.json (scripts/dwg/extract_structures.py) into
 * data/structures.js, so bridges and road crossings are on the phone with no signal; and the stations and
 * freight yards of data/dwg/stations.json (scripts/dwg/extract_stations.py) with them.
 *   node scripts/dwg/bundle_structures.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const dir = path.join(ROOT, 'data', 'dwg');
const out = {};
fs.readdirSync(dir).filter(f => /_structures\.json$/.test(f)).sort().forEach(f => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  // the drawing's own name, not the converted file's ('S02-TRA-PLAT-m.dxf')
  const source = String(j.source).replace(/^(S0\d)-TRA-PLAT.*$/, 'T2019-0323-$1-DD-TRA-PLAT');
  out[j.sub] = { source, structures: j.structures };
});
const stPath = path.join(dir, 'stations.json');
const stations = fs.existsSync(stPath) ? JSON.parse(fs.readFileSync(stPath, 'utf8')).stations : [];
const t1Path = path.join(dir, 't1_large.json');
const t1 = fs.existsSync(t1Path) ? JSON.parse(fs.readFileSync(t1Path, 'utf8')).runs.filter(r => r.large).map(r => ({ sub: r.sub, handle: r.handle, ch0: r.ch0, ch1: r.ch1, side: r.side, w: r.width })) : [];
fs.writeFileSync(path.join(ROOT, 'data', 'structures.js'),
  '// Bridges, overpasses and underpasses from the track plans, for reference on the strip (not inspected).\n' +
  '// Made by scripts/dwg/bundle_structures.js from data/dwg/*_structures.json.\n' +
  'window.KMD_STRUCTURES = ' + JSON.stringify(out, null, 1) + ';\n' +
  '// Stations and freight yards from the STATIONS_YARDS drawings (data/dwg/stations.json): extent along the line,\n' +
  '// platforms, buildings, and outlines as [chainage, offset left +] pairs. For reference, not inspected.\n' +
  'window.KMD_STATIONS = ' + JSON.stringify(stations) + ';\n' +
  '// The larger Type 1 side ditch (T1L): drawn with a thick line on DRN_DITCH_TYPE1 (data/dwg/t1_large.json,\n' +
  '// scripts/dwg/extract_t1_large.py). By the drawing handle, chainage and side.\n' +
  'window.KMD_T1_LARGE = ' + JSON.stringify(t1) + ';\n');
console.log(Object.entries(out).map(([k, v]) => k + ' ' + v.structures.length).join(', ') + '; stations and yards ' + stations.length + '; larger Type 1 runs ' + t1.length);
