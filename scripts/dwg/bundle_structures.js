/*
 * Bundle every data/dwg/<SUB>_structures.json (scripts/dwg/extract_structures.py) into
 * data/structures.js, so bridges and road crossings are on the phone with no signal.
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
fs.writeFileSync(path.join(ROOT, 'data', 'structures.js'),
  '// Bridges, overpasses and underpasses from the track plans, for reference on the strip (not inspected).\n' +
  '// Made by scripts/dwg/bundle_structures.js from data/dwg/*_structures.json.\n' +
  'window.KMD_STRUCTURES = ' + JSON.stringify(out, null, 1) + ';\n');
console.log(Object.entries(out).map(([k, v]) => k + ' ' + v.structures.length).join(', '));
