const fs = require('fs');

// Check index.html script tags
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
console.log('=== Scripts in index.html: ' + scripts.length + ' ===');
scripts.forEach(s => console.log('  ' + s));

// Check sw.js precache
const sw = fs.readFileSync('sw.js', 'utf8');
const m = sw.match(/PRECACHE_LOCAL_ASSETS\s*=\s*\[([\s\S]*?)\]/);
if (m) {
  const assets = [...m[1].matchAll(/'([^']+)'/g)].map(a => a[1]);
  console.log('\n=== Precache assets in sw.js: ' + assets.length + ' ===');
  assets.forEach(a => console.log('  ' + a));
}

// Check new Phase 6-9 modules exist
const required = ['day_view.js', 'export_engine.js', 'section_view.js', 'map_view.js', 'edit_door.js'];
console.log('\n=== Phase 6-9 Module Files ===');
required.forEach(f => {
  const exists = fs.existsSync(f);
  const size = exists ? fs.statSync(f).size : 0;
  const lines = exists ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
  console.log('  ' + (exists ? '[OK]' : '[MISSING]') + ' ' + f + ' (' + lines + ' lines, ' + size + ' bytes)');
});
