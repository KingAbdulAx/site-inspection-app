/**
 * MASTER TEST RUNNER - Runs all test suites and produces a summary
 */
const { execSync } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Phase 2 - Data Model', file: 'test_phase2_model.js' },
  { name: 'Phase 3 - Position Engine', file: 'test_position_engine.js' },
  { name: 'Phase 4 - Walk Strip UI', file: 'test_walk_strip.js' },
  { name: 'Phase 5 - Record Flow', file: 'test_record_flow.js' },
  { name: 'Phase 6 - Day View & Export', file: 'test_day_view.js' },
  { name: 'Phase 7 - Section View', file: 'test_section_view.js' },
  { name: 'Phase 8 - Map View', file: 'test_map_view.js' },
  { name: 'Phase 9 - Edit Door', file: 'test_edit_door.js' },
  { name: 'PWA Integration', file: 'test_pwa_integration.js' },
  { name: 'Edit Mode (Legacy)', file: 'test_edit_mode.js' },
  { name: 'New Views (Legacy)', file: 'test_new_views.js' },
  { name: 'SLD Viewer (Legacy)', file: 'test_sld_viewer.js' },
];

const results = [];
let totalPass = 0;
let totalFail = 0;

for (const suite of suites) {
  try {
    const output = execSync('node scripts/' + suite.file, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 30000
    });
    
    // Try to extract assertion count
    const assertMatch = output.match(/(\d+)\s*assertion/i);
    const assertions = assertMatch ? parseInt(assertMatch[1]) : '-';
    
    results.push({ name: suite.name, status: 'PASS', assertions });
    if (typeof assertions === 'number') totalPass += assertions;
  } catch (e) {
    results.push({ name: suite.name, status: 'FAIL', assertions: 0, error: e.stderr || e.message });
    totalFail++;
  }
}

console.log('');
console.log('================================================================');
console.log('  KMD DRAINAGE INSPECTOR - MASTER TEST RESULTS');
console.log('  ' + new Date().toISOString());
console.log('================================================================');
console.log('');

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('Suite', 35) + pad('Status', 8) + 'Assertions');
console.log('-'.repeat(55));
for (const r of results) {
  console.log(pad(r.name, 35) + pad(r.status, 8) + r.assertions);
  if (r.error) console.log('  ERROR: ' + r.error.substring(0, 100));
}
console.log('-'.repeat(55));
console.log(pad('TOTAL', 35) + pad(totalFail === 0 ? 'ALL OK' : totalFail + ' FAIL', 8) + totalPass + '+');
console.log('');

if (totalFail === 0) {
  console.log('ALL ' + results.length + ' TEST SUITES PASSED.');
} else {
  console.log(totalFail + ' SUITE(S) FAILED!');
  process.exit(1);
}
