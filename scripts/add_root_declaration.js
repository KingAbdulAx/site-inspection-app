const fs = require('fs');
const path = require('path');

const files = [
  'walk_strip.js',
  'walk_drawer.js',
  'identify_view.js',
  'walk_view.js',
  'record_view.js',
  'defect_view.js',
  'feature_detail_view.js',
  'toast_manager.js'
];

const decl = "  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);\n";

files.forEach(f => {
  const filePath = path.join(__dirname, '..', f);
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  let c = fs.readFileSync(filePath, 'utf8');
  if (!c.includes("const root = (typeof window")) {
    c = c.replace(/('use strict';[\r\n]+)/, "$1" + decl);
    fs.writeFileSync(filePath, c, 'utf8');
    console.log('Added root declaration to:', f);
  } else {
    console.log('Already has root declaration:', f);
  }
});
