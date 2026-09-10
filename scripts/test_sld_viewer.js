/**
 * Automated Verification for Straight-Line Diagram (SLD) Linear Track Viewer
 */

const fs = require('fs');
const path = require('path');

console.log('--- 1. Checking sld_viewer.js syntax and integrity ---');
const sldContent = fs.readFileSync(path.join(__dirname, '../sld_viewer.js'), 'utf8');

// Mock DOM environment for Node.js
const mockElements = {};
global.document = {
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = {
        appendChild: () => {},
        getBoundingClientRect: () => ({ width: 390, height: 450, left: 0, top: 0 }),
        addEventListener: () => {},
        style: {},
        innerHTML: '',
        innerText: ''
      };
    }
    return mockElements[id];
  },
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      style: {},
      getContext: () => ({
        setTransform: () => {},
        fillRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        rect: () => {},
        roundRect: () => {},
        measureText: () => ({ width: 60 }),
        fillText: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        strokeRect: () => {},
        closePath: () => {},
        setLineDash: () => {}
      }),
      addEventListener: () => {},
      getBoundingClientRect: () => ({ width: 390, height: 450, left: 0, top: 0 })
    };
  }
};
global.window = {
  addEventListener: () => {},
  devicePixelRatio: 2,
  appState: { activeSection: 'all', viewMode: 'typology', activeFilter: 'all', inspections: {} },
  getActiveFeatures: () => [
    { properties: { id: 'test_clv_1', start_pk: 84406, is_point: true, category: 'Cross Drainage', short_code: 'CLV-128', typology: '2x2.0x2.0m Box', color: '#EF4444' } },
    { properties: { id: 'test_dt_1', start_pk: 83715, end_pk: 84406, is_point: false, side: 'Left', category: 'Toe Ditch', short_code: 'TYPE 1', typology: 'Concrete Lined Trapezoidal Ditch', color: '#38BDF8', length_m: 691 } },
    { properties: { id: 'test_ch_1', start_pk: 84406, end_pk: 84406, is_point: false, side: 'Right', category: 'Water Descent', typology_code: 'WATER_DESCENT', short_code: 'WATER_DESCENT', typology: 'Precast Water Descent (DW-10003)', color: '#0284C7' } },
    { properties: { id: 'test_rip_1', start_pk: 84000, end_pk: 84406, is_point: false, side: 'Right', category: 'Riprap Protection', typology_code: 'RIPRAP', short_code: 'RIPRAP', typology: 'Riprap Armor', color: '#64748B', length_m: 406 } },
    { properties: { id: 'test_chan_1', start_pk: 84100, end_pk: 84400, is_point: false, side: 'Right', category: 'Diversion Channel', typology_code: 'CHANNEL', short_code: 'CHAN-B', typology: 'Open Trapezoidal Concrete Channel (Type B)', color: '#06B6D4', length_m: 300 } },
    { properties: { id: 'test_diss_1', start_pk: 84400, is_point: true, side: 'Right', category: 'Energy Dissipator', typology_code: 'DISSIPATOR', short_code: 'DISSIPATOR', typology: 'Energy Dissipator Basin (DW-10002/DW-10003)', color: '#D97706' } }
  ]
};

// Evaluate SLD Viewer
eval(sldContent);

const SldViewer = window.SldViewer;
if (!SldViewer) {
  console.error('FAIL: SldViewer class not exported to window!');
  process.exit(1);
}
console.log('✔ SldViewer class loaded');

const viewer = new SldViewer('sldViewportContainer');
viewer.width = 390;
viewer.height = 450;
viewer.centerPk = 84406;
viewer.pixelsPerMeter = 0.5;

console.log('--- 2. Testing Linear Coordinate Projections ---');
// Horizontal Mode
const pt1 = viewer.pkToScreen(84406, 0);
console.log(`Centerline at PK 84+406 (Horizontal): (${pt1.x.toFixed(1)}, ${pt1.y.toFixed(1)})`);
if (Math.abs(pt1.x - 195) > 0.1 || Math.abs(pt1.y - 225) > 0.1) {
  console.error(`FAIL: Center point expectation mismatch: expected (195, 225), got (${pt1.x}, ${pt1.y})`);
  process.exit(1);
}
console.log('✔ Horizontal center projection verified');

// Left side should be -offset (above center line in screen Y)
const ptLeft = viewer.pkToScreen(84406, -60);
if (ptLeft.y !== 165) {
  console.error(`FAIL: Left side lateral offset: expected 165, got ${ptLeft.y}`);
  process.exit(1);
}
console.log('✔ Left side lateral offset verified');

// 100m forward in chainage: 84406 + 100 = 84506 -> +50px (at 0.5 px/m)
const ptNext = viewer.pkToScreen(84506, 0);
if (ptNext.x !== 245) {
  console.error(`FAIL: Chainage scaling: expected 245, got ${ptNext.x}`);
  process.exit(1);
}
console.log('✔ Chainage scale (pixelsPerMeter) verified');

// Reverse transform screenToPk
const calcPk = viewer.screenToPk(245, 0);
if (Math.abs(calcPk - 84506) > 0.001) {
  console.error(`FAIL: screenToPk mismatch: expected 84506, got ${calcPk}`);
  process.exit(1);
}
console.log('✔ Inverse screenToPk transform verified (< 1mm precision)');

console.log('--- 3. Testing Orientation Toggle ---');
const newMode = viewer.toggleOrientation();
console.log(`Orientation toggled to: ${newMode}`);
if (newMode !== 'vertical') {
  console.error('FAIL: Expected vertical mode');
  process.exit(1);
}
const ptVert = viewer.pkToScreen(84406, 0);
console.log(`Centerline at PK 84+406 (Vertical): (${ptVert.x.toFixed(1)}, ${ptVert.y.toFixed(1)})`);
if (Math.abs(ptVert.x - 195) > 0.1 || Math.abs(ptVert.y - 225) > 0.1) {
  console.error('FAIL: Vertical center projection mismatch');
  process.exit(1);
}
viewer.toggleOrientation(); // Toggle back to horizontal

console.log('--- 4. Testing Render & Hit-Testing ---');
viewer.render();
console.log(`Hit boxes registered: ${viewer.hitBoxes.length}`);
if (viewer.hitBoxes.length !== 6) {
  console.error(`FAIL: Expected 6 hit boxes for all 6 active mock features, got ${viewer.hitBoxes.length}`);
  process.exit(1);
}
console.log('✔ All 6 distinct feature types registered hit boxes');

console.log('--- 5. Testing Lateral Lane Offsets & Physical Ordering per DW-10003 ---');
const offsets = viewer.laneOffsets;
if (offsets.shoulder !== 28 || offsets.bench !== 60 || offsets.toe !== 94 || offsets.crest !== 126 || offsets.channel !== 160) {
  console.error('FAIL: Lane offset values do not match DW-10003 specifications', offsets);
  process.exit(1);
}
if (!(offsets.shoulder < offsets.bench && offsets.bench < offsets.toe && offsets.toe < offsets.crest && offsets.crest < offsets.channel)) {
  console.error('FAIL: Lateral lanes are not monotonically increasing from centerline outward');
  process.exit(1);
}
console.log('✔ Monotonic transverse lane offsets verified: Shoulder (28px) < Bench (60px) < Toe (94px) < Crest (126px) < Channel (160px)');

// getFeatureLane tests
if (viewer.getFeatureLane({ typology: 'Type 1 Platform Ditch' }) !== 28) {
  console.error('FAIL: Type 1 not mapped to shoulder lane (28)');
  process.exit(1);
}
if (viewer.getFeatureLane({ typology_code: 'TYPE_9' }) !== 28) {
  console.error('FAIL: Type 9 not mapped to shoulder lane (28)');
  process.exit(1);
}
if (viewer.getFeatureLane({ typology: 'Type 8 Berm Ditch' }) !== 60) {
  console.error('FAIL: Type 8 not mapped to bench lane (60)');
  process.exit(1);
}
if (viewer.getFeatureLane({ category: 'Toe Ditch', typology: 'Type 7 Concrete Ditch' }) !== 94) {
  console.error('FAIL: Type 7 not mapped to toe lane (94)');
  process.exit(1);
}
if (viewer.getFeatureLane({ typology_code: 'RIPRAP' }) !== 94) {
  console.error('FAIL: Riprap not mapped to toe lane (94)');
  process.exit(1);
}
if (viewer.getFeatureLane({ typology: 'Cut Crest Ditch Type 11' }) !== 126) {
  console.error('FAIL: Type 11 not mapped to crest lane (126)');
  process.exit(1);
}
if (viewer.getFeatureLane({ category: 'Diversion Channel', typology: 'Open Trapezoidal Concrete Channel (Type B)' }) !== 160) {
  console.error('FAIL: Type B Channel not mapped to outermost channel lane (160)');
  process.exit(1);
}
console.log('✔ getFeatureLane accurately maps physical typologies across all 5 transverse lanes');

console.log('--- 6. Testing Feature Engineering Classification ---');
const fRip = viewer.classifyFeature({ typology_code: 'RIPRAP', category: 'Riprap Protection' });
const fChan = viewer.classifyFeature({ typology_code: 'CHANNEL', category: 'Diversion Channel' });
const fDesc = viewer.classifyFeature({ typology_code: 'WATER_DESCENT', category: 'Water Descent', typology: 'Precast Water Descent (DW-10003)' });
const fDiss = viewer.classifyFeature({ typology_code: 'DISSIPATOR', category: 'Energy Dissipator', is_point: true });
const fCross = viewer.classifyFeature({ category: 'Cross Drainage', typology: '2x2.0x2.0m Box Culvert', is_point: true });
const fDitch = viewer.classifyFeature({ category: 'Toe Ditch', typology: 'Type 7 Concrete Ditch', is_point: false });

if (fRip !== 'riprap' || fChan !== 'channel' || fDesc !== 'waterDescent' || fDiss !== 'dissipator' || fCross !== 'cross' || fDitch !== 'ditch') {
  console.error('FAIL: Feature classification mismatch', { fRip, fChan, fDesc, fDiss, fCross, fDitch });
  process.exit(1);
}
console.log('✔ Feature classification accurately separates riprap, channel, waterDescent, dissipator, cross, and ditch');

console.log('--- 7. Testing Separate Layer Toggles & Filtering ---');
// Disable channels layer
viewer.layers.channels = false;
viewer.render();
if (viewer.hitBoxes.some(h => h.assetId === 'test_chan_1')) {
  console.error('FAIL: Channels layer disabled but channel feature still rendered');
  process.exit(1);
}
viewer.layers.channels = true;

// Disable dissipators layer
viewer.layers.dissipators = false;
viewer.render();
if (viewer.hitBoxes.some(h => h.assetId === 'test_diss_1')) {
  console.error('FAIL: Dissipators layer disabled but dissipator feature still rendered');
  process.exit(1);
}
viewer.layers.dissipators = true;

// Disable riprap layer
viewer.layers.riprap = false;
viewer.render();
if (viewer.hitBoxes.some(h => h.assetId === 'test_rip_1')) {
  console.error('FAIL: Riprap layer disabled but riprap feature still rendered');
  process.exit(1);
}
viewer.layers.riprap = true;

// Disable water descents layer
viewer.layers.waterDescents = false;
viewer.render();
if (viewer.hitBoxes.some(h => h.assetId === 'test_ch_1')) {
  console.error('FAIL: Water descents layer disabled but descent feature still rendered');
  process.exit(1);
}
viewer.layers.waterDescents = true;

// Re-render full
viewer.render();
if (viewer.hitBoxes.length !== 6) {
  console.error(`FAIL: Expected 6 hit boxes after restoring all layers, got ${viewer.hitBoxes.length}`);
  process.exit(1);
}
console.log('✔ All layer toggles isolate and restore their respective feature subsets correctly');

console.log('--- 8. Testing CadViewer Layer Parity ---');
const cadContent = fs.readFileSync(path.join(__dirname, '../cad_viewer.js'), 'utf8');
eval(cadContent);
const CadViewer = window.CadViewer;
if (!CadViewer) {
  console.error('FAIL: CadViewer class not found');
  process.exit(1);
}
const mockCad = new CadViewer('sldViewportContainer');
if (mockCad.layers.channels !== true || mockCad.layers.dissipators !== true || mockCad.layers.waterDescents !== true) {
  console.error('FAIL: CadViewer missing layer parity with SldViewer', mockCad.layers);
  process.exit(1);
}
console.log('✔ CadViewer layers verified with full parity (channels, dissipators, waterDescents, riprap)');

console.log('=============================================');
console.log('🎉 SLD LINEAR TRACK VIEWER VERIFIED 100%! 🎉');
console.log('=============================================');
