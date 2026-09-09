// Automated simulation test for Phase 5 PWA integration
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_DIR = path.resolve(__dirname, '..');

console.log('=== PWA MULTI-SECTION INTEGRATION TEST ===');

// Mock browser window, document, and localStorage
const localStorageData = {};
const mockLocalStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; }
};

const mockElements = {
  kpiTotal: { textContent: '' },
  kpiNotStarted: { textContent: '' },
  kpiOngoing: { textContent: '' },
  kpiCompleted: { textContent: '' },
  kpiDefects: { textContent: '' },
  lblSectionSubtitle: { textContent: '' },
  txtJumpPk: { value: '', placeholder: '' }
};

const mockButtons = [
  { getAttribute: () => 'all', classList: { add: () => {}, remove: () => {} } },
  { getAttribute: () => '02', classList: { add: () => {}, remove: () => {} } },
  { getAttribute: () => '03', classList: { add: () => {}, remove: () => {} } }
];

const mockDocument = {
  getElementById: (id) => mockElements[id] || null,
  querySelectorAll: (sel) => {
    if (sel === '.btn-sec-tab') return mockButtons;
    return [];
  },
  addEventListener: () => {}
};

// Setup sandbox context
const sandbox = {
  window: {},
  document: mockDocument,
  localStorage: mockLocalStorage,
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  L: {
    polyline: () => ({ getBounds: () => ({}) }),
    divIcon: () => ({}),
    marker: () => ({ bindTooltip: () => ({}), on: () => ({}), addTo: () => {} }),
    map: () => ({ on: () => {}, fitBounds: () => {}, setView: () => {} }),
    control: { zoom: () => ({ addTo: () => {} }), layers: () => ({ addTo: () => {} }) },
    layerGroup: () => ({ addTo: () => ({}), clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {}, hasLayer: () => false }),
    GridLayer: { extend: () => function() {} }
  },
  navigator: { onLine: true }
};
sandbox.window = sandbox;

vm.createContext(sandbox);

// 1. Load bundles into sandbox
console.log('1. Loading data bundles...');
const bundle03Code = fs.readFileSync(path.join(APP_DIR, 'data', 'bundle.js'), 'utf8');
vm.runInContext(bundle03Code, sandbox);

const bundle02Code = fs.readFileSync(path.join(APP_DIR, 'data', 'section02_bundle.js'), 'utf8');
vm.runInContext(bundle02Code, sandbox);

console.log('   Section 02 Centerline points:', sandbox.SECTION02_CENTERLINE.dense_points.length);
console.log('   Section 02 Assets count:', sandbox.SECTION02_ASSETS.features.length);
console.log('   Section 03 Centerline points:', sandbox.SECTION03_CENTERLINE.dense_points.length);
console.log('   Section 03 Assets count:', sandbox.SECTION03_ASSETS.features.length);

if (sandbox.SECTION02_ASSETS.features.length !== 1710) throw new Error('Expected 1710 S02 assets');
if (sandbox.SECTION03_ASSETS.features.length !== 842) throw new Error('Expected 842 S03 assets');

// 2. Load app.js into sandbox
console.log('\n2. Executing app.js inside test context...');
const appCode = fs.readFileSync(path.join(APP_DIR, 'app.js'), 'utf8');
vm.runInContext(appCode, sandbox);

const appState = sandbox.appState;
console.log('   Default active section:', appState.activeSection);
if (appState.activeSection !== 'all') throw new Error(`Expected default activeSection 'all', got '${appState.activeSection}'`);

// 3. Test Section Switching & Asset Counts
console.log('\n3. Testing section switching & HUD updates:');

// Mode: 'all'
sandbox.setSection('all', false);
console.log('   [Mode: All] Assets count:', appState.assetsData.features.length);
console.log('   [Mode: All] KPI Total displayed:', mockElements.kpiTotal.textContent);
console.log('   [Mode: All] Subtitle displayed:', mockElements.lblSectionSubtitle.textContent);
if (appState.assetsData.features.length !== 2552) throw new Error(`Expected 2552 assets in 'all', got ${appState.assetsData.features.length}`);
if (mockElements.kpiTotal.textContent != 2552) throw new Error(`Expected KPI total 2552, got ${mockElements.kpiTotal.textContent}`);

// Mode: '02'
sandbox.setSection('02', false);
console.log('   [Mode: 02] Assets count:', appState.assetsData.features.length);
console.log('   [Mode: 02] KPI Total displayed:', mockElements.kpiTotal.textContent);
console.log('   [Mode: 02] Subtitle displayed:', mockElements.lblSectionSubtitle.textContent);
if (appState.assetsData.features.length !== 1710) throw new Error(`Expected 1710 assets in '02', got ${appState.assetsData.features.length}`);
if (mockElements.kpiTotal.textContent != 1710) throw new Error(`Expected KPI total 1710, got ${mockElements.kpiTotal.textContent}`);

// Mode: '03'
sandbox.setSection('03', false);
console.log('   [Mode: 03] Assets count:', appState.assetsData.features.length);
console.log('   [Mode: 03] KPI Total displayed:', mockElements.kpiTotal.textContent);
console.log('   [Mode: 03] Subtitle displayed:', mockElements.lblSectionSubtitle.textContent);
if (appState.assetsData.features.length !== 842) throw new Error(`Expected 842 assets in '03', got ${appState.assetsData.features.length}`);
if (mockElements.kpiTotal.textContent != 842) throw new Error(`Expected KPI total 842, got ${mockElements.kpiTotal.textContent}`);

// Reset to 'all'
sandbox.setSection('all', false);

// 4. Test GPS Orthogonal Projection in 'all' mode
console.log('\n4. Testing GPS Orthogonal Projection:');
// Dawanau test point (PK ~19.8)
const projDawanau = sandbox.projectGpsToAlignment(12.1008, 8.4374);
console.log('   Dawanau GPS (12.1008, 8.4374) -> PK:', projDawanau.pk.toFixed(1), 'Section:', projDawanau.section);
if (Math.abs(projDawanau.pk - 19800) > 50) throw new Error(`Expected Dawanau PK near 19800, got ${projDawanau.pk}`);

// Kazaure boundary test point (PK ~82.9)
const projKazaure = sandbox.projectGpsToAlignment(12.6248, 8.4041);
console.log('   Kazaure GPS (12.6248, 8.4041) -> PK:', projKazaure.pk.toFixed(1), 'Section:', projKazaure.section);
if (Math.abs(projKazaure.pk - 82902) > 50) throw new Error(`Expected Kazaure PK near 82902, got ${projKazaure.pk}`);

// Daura end test point (PK ~124.5)
const projDaura = sandbox.projectGpsToAlignment(12.9804, 8.3125);
console.log('   Daura GPS (12.9804, 8.3125) -> PK:', projDaura.pk.toFixed(1), 'Section:', projDaura.section);
if (Math.abs(projDaura.pk - 124500) > 200) throw new Error(`Expected Daura PK near 124500, got ${projDaura.pk}`);

// 5. Test LocalStorage Partitioning
console.log('\n5. Testing LocalStorage Partitioning:');
// Simulate inspection on Section 03 asset
appState.inspections['asset_042'] = {
  status: 'Completed & Approved',
  notes: 'Tested S03 culvert',
  hasDefect: false
};
// Simulate inspection on Section 02 asset
appState.inspections['s02_asset_005'] = {
  status: 'Completed & Approved',
  notes: 'Tested S02 culvert',
  hasDefect: false
};

// Save
sandbox.window.saveInspectionsToStorage();

const s03Saved = JSON.parse(mockLocalStorage.getItem('KMD_DRAINAGE_INSPECTIONS_SEC03_V1'));
const s02Saved = JSON.parse(mockLocalStorage.getItem('KMD_DRAINAGE_INSPECTIONS_SEC02_V1'));

console.log('   Keys in Section 03 localStorage:', Object.keys(s03Saved));
console.log('   Keys in Section 02 localStorage:', Object.keys(s02Saved));

if (!s03Saved['asset_042'] || s03Saved['s02_asset_005']) {
  throw new Error('Section 03 storage contaminated with Section 02 assets!');
}
if (!s02Saved['s02_asset_005'] || s02Saved['asset_042']) {
  throw new Error('Section 02 storage contaminated with Section 03 assets!');
}
console.log('   [PASSED] Storage partitioning verified 100% strict.');

console.log('\n=== ALL PHASE 5 INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
