/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Phase 2 Automated Test Suite: Data Model, Storage Decoupling & Migration Engine
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const APP_DIR = path.resolve(__dirname, '..');
const DataModel = require(path.join(APP_DIR, 'data_model.js'));
const { DataStore, STORAGE_KEYS } = require(path.join(APP_DIR, 'data_store.js'));
const { TYPE_CATALOGUE, getTypeInfo } = require(path.join(APP_DIR, 'type_catalogue.js'));

console.log('================================================================');
console.log('KMD DRAINAGE INSPECTOR - PHASE 2 DATA MODEL & MIGRATION TEST');
console.log('================================================================\n');

let passedAssertions = 0;
function check(condition, message) {
  assert(condition, message);
  passedAssertions++;
}

// Helper mock storage
function createMockStorage(initialData = {}) {
  const store = Object.assign({}, initialData);
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
    _dump: () => Object.assign({}, store)
  };
}

// -----------------------------------------------------------------------------
// SUITE 1: Master Entity Schemas & Strict UUIDv7 Monotonicity
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Master Entity Schemas & UUIDv7 Monotonicity ---');

const uuid1 = DataModel.generateUUIDv7();
const uuid2 = DataModel.generateUUIDv7();
check(typeof uuid1 === 'string' && uuid1.length === 36, 'UUIDv7 must be a 36-char formatted string');
check(uuid1.charAt(14) === '7', 'UUIDv7 must have version nibble 7 at index 14');
check(/[89ab]/i.test(uuid1.charAt(19)), 'UUIDv7 must have variant nibble (8, 9, a, or b) at index 19');
check(uuid1 !== uuid2, 'Consecutive UUIDv7 calls must be globally unique');
check(uuid1 < uuid2, 'Consecutive UUIDv7 calls must be lexicographically strictly increasing');

const ts1 = DataModel.extractUUIDv7Timestamp(uuid1);
const now = Date.now();
check(Math.abs(ts1 - now) < 5000, 'UUIDv7 timestamp must match current epoch time within 5s');

// Rigorous 10,000 sub-millisecond burst stress test for zero inversions
const burstTime = 1700000000000;
let burstInversions = 0;
let lastId = '';
for (let i = 0; i < 10000; i++) {
  const id = DataModel.generateUUIDv7(burstTime);
  if (lastId && id <= lastId) burstInversions++;
  lastId = id;
}
check(burstInversions === 0, `UUIDv7 sub-ms burst test must have 0 inversions across 10,000 IDs (got ${burstInversions})`);

// Clock backwards skew test (NTP jump backward)
const pastTime = burstTime - 10000;
const skewId = DataModel.generateUUIDv7(pastTime);
check(skewId > lastId, 'UUIDv7 must maintain strict monotonic order even when clock jumps backwards');

// Lines verification
check(DataModel.DEFAULT_LINES.length === 2, 'Must define exactly 2 railway lines');
const lineKm = DataModel.DEFAULT_LINES.find(l => l.id === 'line_km');
const lineKd = DataModel.DEFAULT_LINES.find(l => l.id === 'line_kd');
check(lineKm && (lineKm.name === 'Kano–Maradi' || lineKm.name === 'Kano-Maradi'), 'Kano–Maradi main line must be registered');
check(lineKd && (lineKd.name === 'Kano–Dutse branch' || lineKd.name === 'Kano-Dutse branch'), 'Kano–Dutse branch line must be registered');
check(lineKd.chainage_datum.includes('Kano'), 'Branch line must warn that chainage repeats from Kano datum');

// SubSections verification (9 total: 6 for Kano-Maradi, 3 for Kano-Dutse)
check(DataModel.DEFAULT_SUBSECTIONS.length === 9, 'Must register all 9 sub-sections across both lines');
const expectedKmCodes = ['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB', 'JBMR'];
const expectedKdCodes = ['KNYG', 'YGGY', 'GYDT'];

expectedKmCodes.forEach(code => {
  const sub = DataModel.DEFAULT_SUBSECTIONS.find(s => s.code === code);
  check(sub && sub.line_id === 'line_km', `Sub-section ${code} must belong to Kano-Maradi line`);
});

expectedKdCodes.forEach(code => {
  const sub = DataModel.DEFAULT_SUBSECTIONS.find(s => s.code === code);
  check(sub && sub.line_id === 'line_kd', `Sub-section ${code} must belong to Kano-Dutse branch`);
});

const dwkz = DataModel.DEFAULT_SUBSECTIONS.find(s => s.code === 'DWKZ');
const kzdr = DataModel.DEFAULT_SUBSECTIONS.find(s => s.code === 'KZDR');
check(dwkz.data_status === 'on_phone', 'DWKZ must have data_status "on_phone"');
check(kzdr.data_status === 'on_phone', 'KZDR must have data_status "on_phone"');
check(dwkz.ch_start === 19800 && Math.abs(dwkz.ch_end - 82902.439) < 0.01, 'DWKZ chainage span must be PK 19+800 to 82+902.439');
check(Math.abs(kzdr.ch_start - 82902.439) < 0.01 && kzdr.ch_end === 124521, 'KZDR chainage span must be PK 82+902.439 to 124+521');

// Alignments verification
check(Array.isArray(DataModel.DEFAULT_ALIGNMENTS) && DataModel.DEFAULT_ALIGNMENTS.length === 2, 'DEFAULT_ALIGNMENTS must contain 2 line alignments');
const alignKm = DataModel.DEFAULT_ALIGNMENTS.find(a => a.line_id === 'line_km');
check(alignKm && alignKm.stations_500m.length >= 5, 'Kano-Maradi alignment must contain 500m calibration stations');

console.log('[PASS] Master entities and UUIDv7 monotonicity verified.\n');

// -----------------------------------------------------------------------------
// SUITE 2: Pre-Migration Backup & Verified Rollback Subsystem
// -----------------------------------------------------------------------------
console.log('--- 2. Testing Pre-Migration Backup & Rollback Subsystem ---');

const initialMockData = {
  [STORAGE_KEYS.LEGACY_S03_INSPECTIONS]: JSON.stringify({
    asset_001: { status: 'Completed', notes: 'Pre-existing field note', inspection_date: '2026-08-12T09:00:00Z', author: 'Engr. A' },
    asset_056: { status: 'Excavation', notes: 'Culvert excavation started', hasDefect: true, defect_types: ['Silted / blocked'] }
  }),
  [STORAGE_KEYS.LEGACY_S02_INSPECTIONS]: JSON.stringify({
    s02_asset_001: { status: 'Blinding', notes: 'Station collector work' }
  }),
  [STORAGE_KEYS.LEGACY_ACTIVE_SECTION]: '03',
  'CUSTOM_USER_SESSION': 'active_token_xyz_9988'
};

const mockStorage = createMockStorage(initialMockData);
const store = new DataStore(mockStorage);

check(!store.hasBackup(), 'Store must have no backup before migration');

// Run backup explicitly
const backupRes = store.createBackup();
check(backupRes.success, 'Backup creation must succeed');
check(store.hasBackup(), 'hasBackup() must return true after backup created');

const backupInfo = store.getBackupInfo();
check(backupInfo && backupInfo.keys_count >= 4, 'Backup metadata must report captured keys');
check(backupInfo.keys_list.includes(STORAGE_KEYS.LEGACY_S03_INSPECTIONS), 'Backup must include legacy S03 inspections');

// Run migration
const s3Raw = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'data', 'section03_assets.json'), 'utf8'));
const s2Raw = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'data', 'section02_assets.json'), 'utf8'));

const migReport = store.migrate({
  section02Assets: s2Raw,
  section03Assets: s3Raw,
  forceBackup: true
});

check(migReport.success, 'Migration must complete successfully');
check(mockStorage.getItem(STORAGE_KEYS.DESIGN_FEATURES) !== null, 'V2 DesignFeatures key must exist after migration');
check(mockStorage.getItem(STORAGE_KEYS.FIELD_RECORDS) !== null, 'V2 FieldRecords key must exist after migration');
check(mockStorage.getItem(STORAGE_KEYS.ALIGNMENTS) !== null, 'V2 Alignments key must exist after migration');
check(mockStorage.getItem(STORAGE_KEYS.MIGRATION_STATUS) !== null, 'V2 MigrationStatus key must exist after migration');

// Test Rollback
console.log('   Executing rollbackMigration()...');
const rollbackRes = store.rollbackMigration();
check(rollbackRes.success, 'rollbackMigration() must report success');

// Verify V2 keys are removed
check(mockStorage.getItem(STORAGE_KEYS.DESIGN_FEATURES) === null, 'V2 DesignFeatures key must be deleted after rollback');
check(mockStorage.getItem(STORAGE_KEYS.DESIGN_VERSIONS) === null, 'V2 DesignVersions key must be deleted after rollback');
check(mockStorage.getItem(STORAGE_KEYS.FIELD_RECORDS) === null, 'V2 FieldRecords key must be deleted after rollback');
check(mockStorage.getItem(STORAGE_KEYS.ALIGNMENTS) === null, 'V2 Alignments key must be deleted after rollback');
check(mockStorage.getItem(STORAGE_KEYS.MIGRATION_STATUS) === null, 'V2 MigrationStatus key must be deleted after rollback');

// Verify pre-migration keys are 100% restored
check(mockStorage.getItem(STORAGE_KEYS.LEGACY_ACTIVE_SECTION) === '03', 'Legacy active section must be restored');
check(mockStorage.getItem('CUSTOM_USER_SESSION') === 'active_token_xyz_9988', 'Custom user session key must be preserved');

const restoredS03 = JSON.parse(mockStorage.getItem(STORAGE_KEYS.LEGACY_S03_INSPECTIONS));
check(restoredS03.asset_001.status === 'Completed', 'Original S03 inspection record must be restored identically');
check(restoredS03.asset_056.hasDefect === true, 'Original defect flags must be restored identically');

console.log('[PASS] Pre-migration backup and lossless rollback verified.\n');

// -----------------------------------------------------------------------------
// SUITE 3: Lossless GeoJSON Round-Trip & 100% Field Preservation
// -----------------------------------------------------------------------------
console.log('--- 3. Testing Lossless Round-Trip (KZDR: 837 features, DWKZ: 1,710 features) ---');

// Re-run migration with both datasets
store.migrate({
  section02Assets: s2Raw,
  section03Assets: s3Raw,
  forceBackup: true
});

// Verify KZDR (837 features)
const kzdrRoundTrip = store.verifyRoundTrip(s3Raw.features, 'KZDR');
check(kzdrRoundTrip.passed, 'KZDR round-trip verification must pass with zero issues');
check(kzdrRoundTrip.total_features === 837, `KZDR must verify all 837 features (got ${kzdrRoundTrip.total_features})`);
check(kzdrRoundTrip.missing_properties === 0, 'KZDR must have zero missing properties');
check(kzdrRoundTrip.mismatched_properties === 0, 'KZDR must have zero mismatched property values');
check(kzdrRoundTrip.fidelity_percentage === '100.00', 'KZDR property fidelity must be exactly 100.00%');

// Verify DWKZ (1,710 features)
const dwkzRoundTrip = store.verifyRoundTrip(s2Raw.features, 'DWKZ');
check(dwkzRoundTrip.passed, 'DWKZ round-trip verification must pass with zero issues');
check(dwkzRoundTrip.total_features === 1710, `DWKZ must verify all 1,710 features (got ${dwkzRoundTrip.total_features})`);
check(dwkzRoundTrip.missing_properties === 0, 'DWKZ must have zero missing properties');
check(dwkzRoundTrip.mismatched_properties === 0, 'DWKZ must have zero mismatched property values');
check(dwkzRoundTrip.fidelity_percentage === '100.00', 'DWKZ property fidelity must be exactly 100.00%');

// Test exportLegacyGeoJSON
const exportedKzdr = store.exportLegacyGeoJSON('KZDR');
check(exportedKzdr.type === 'FeatureCollection', 'exportLegacyGeoJSON must return a GeoJSON FeatureCollection');
check(exportedKzdr.features.length === 837, `exportLegacyGeoJSON('KZDR') must export exactly 837 features (got ${exportedKzdr.features.length})`);

const exportedDwkz = store.exportLegacyGeoJSON('DWKZ');
check(exportedDwkz.features.length === 1710, `exportLegacyGeoJSON('DWKZ') must export exactly 1,710 features (got ${exportedDwkz.features.length})`);

// Deep check on sample asset
const origAsset001 = s3Raw.features.find(f => f.properties && f.properties.id === 'asset_001');
const exportedAsset001 = exportedKzdr.features.find(f => f.properties && f.properties.id === 'asset_001');
check(exportedAsset001, 'asset_001 must exist in exported KZDR GeoJSON');
check(exportedAsset001.properties.drawing_ref === origAsset001.properties.drawing_ref, 'Drawing ref must match identically');
check(exportedAsset001.properties.specs === origAsset001.properties.specs, 'Specs must match identically');
check(exportedAsset001.geometry.coordinates[0] === origAsset001.geometry.coordinates[0], 'Longitude coordinate must match identically');
check(exportedAsset001.geometry.coordinates[1] === origAsset001.geometry.coordinates[1], 'Latitude coordinate must match identically');

// Verify BRG-2601 export position is correctly placed at PK 87000 and NOT index 0
const brgExportIdx = exportedKzdr.features.findIndex(f => f.properties && (f.properties.Asset_ID === 'BRG-2601' || f.properties.id === 'BRG-2601'));
check(brgExportIdx > 0 && brgExportIdx < 836, `BRG-2601 must be sorted by chainage (found at index ${brgExportIdx})`);
check(exportedKzdr.features[brgExportIdx].properties.Start_PK === 87000, 'BRG-2601 Start_PK must be 87000');

console.log(`[PASS] Total 2,547 features round-trip verified with 100.00% fidelity.\n`);

// -----------------------------------------------------------------------------
// SUITE 4: Master Type Catalogue Seeding & Intelligent Type Mapping
// -----------------------------------------------------------------------------
console.log('--- 4. Testing Master Type Catalogue & Type Mapping ---');

check(TYPE_CATALOGUE['1'] && TYPE_CATALOGUE['1'].code === 'T1', 'Type 1 must be present');
check(TYPE_CATALOGUE['12'] && TYPE_CATALOGUE['12'].code === 'T12', 'Type 12 must be present');
check(TYPE_CATALOGUE['6'] && TYPE_CATALOGUE['6'].lane === 'cl', 'Type 6 collector drain must be in CL spine lane');
check(TYPE_CATALOGUE['CH-B'] && TYPE_CATALOGUE['CH-B'].lane === 'off', 'Channel B must be in OFF lane');
check(TYPE_CATALOGUE['D-SD'] && TYPE_CATALOGUE['D-SD'].lane === 'toe', 'Slope descent dissipator must be in TOE lane');
check(TYPE_CATALOGUE['BRG'] && TYPE_CATALOGUE['BRG'].lane === 'across', 'Bridge must be in ACROSS lane');
check(TYPE_CATALOGUE['CULV_BOX'] && TYPE_CATALOGUE['CULV_BOX'].strip === 'BC', 'Box culvert must have BC strip code');
check(TYPE_CATALOGUE['CULV_PIPE'] && TYPE_CATALOGUE['CULV_PIPE'].strip === 'PC', 'Pipe culvert must have PC strip code');

// Test alias lookups with Type prefix stripping and natural aliases
check(getTypeInfo('T12') === TYPE_CATALOGUE['12'], 'getTypeInfo("T12") must resolve to Type 12');
check(getTypeInfo('12') === TYPE_CATALOGUE['12'], 'getTypeInfo("12") must resolve to Type 12');
check(getTypeInfo('Type 12') === TYPE_CATALOGUE['12'], 'getTypeInfo("Type 12") must resolve to Type 12');
check(getTypeInfo('type 1') === TYPE_CATALOGUE['1'], 'getTypeInfo("type 1") must resolve to Type 1');
check(getTypeInfo('BC') === TYPE_CATALOGUE['CULV_BOX'], 'getTypeInfo("BC") must resolve to Box Culvert');
check(getTypeInfo('Box Culvert') === TYPE_CATALOGUE['CULV_BOX'], 'getTypeInfo("Box Culvert") must resolve to Box Culvert');
check(getTypeInfo('Pipe Culvert') === TYPE_CATALOGUE['CULV_PIPE'], 'getTypeInfo("Pipe Culvert") must resolve to Pipe Culvert');
check(getTypeInfo('Bridge') === TYPE_CATALOGUE['BRG'], 'getTypeInfo("Bridge") must resolve to Bridge');

// Test type mapping logic on assets
const t12Sample = { properties: { category: 'Toe Ditch', short_code: 'Type 12', typology: 'Trapezoidal Lined Toe Ditch' } };
check(DataModel.mapAssetToTypeCode(t12Sample) === '12', 'Toe Ditch Type 12 must map to "12"');

const culvSample = { properties: { category: 'Cross Drainage', short_code: '1x Box Culv', typology: 'Single Box Culvert 1x(2.0x2.0m)' } };
check(DataModel.mapAssetToTypeCode(culvSample) === 'CULV_BOX', 'Box culvert must map to "CULV_BOX"');

// Test BRG-2601 mapping
const brgSample = s3Raw.features.find(f => f.properties && f.properties.Asset_ID === 'BRG-2601');
check(DataModel.mapAssetToTypeCode(brgSample) === 'BRG', 'BRG-2601 must map to "BRG"');
check(DataModel.determineLane(brgSample, 'BRG') === 'across', 'BRG-2601 lane must be "across"');
check(DataModel.determineCertainty(brgSample) === 'exact', 'BRG-2601 certainty must be "exact"');

// Test Type 11 / 5 mapping
const t11Sample = { properties: { category: 'Crest Ditch', short_code: 'Type 11/5', typology: 'Concrete Lined Crest Ditch (Type 11 / Type 5)' } };
check(DataModel.mapAssetToTypeCode(t11Sample) === '11', 'Type 11/5 must map to "11"');

const boundarySample = { properties: { category: 'Section Boundary', short_code: 'Boundary', typology: 'Section Start' } };
check(DataModel.mapAssetToTypeCode(boundarySample) === null, 'Section boundary must map to null (NEEDS_VERIFICATION)');

const transSample = { properties: { category: 'Toe Ditch', short_code: 'Toe Ditch', typology: 'Type 12 / Type 7 Sequence' } };
check(DataModel.mapAssetToTypeCode(transSample) === null, 'Transition sequence must map to null without guessing');

console.log('[PASS] Master Type Catalogue and type mapping rules verified.\n');

// -----------------------------------------------------------------------------
// SUITE 5: Append-Only FieldRecord Store (Zero Last-Write-Wins)
// -----------------------------------------------------------------------------
console.log('--- 5. Testing Append-Only FieldRecord Behavior & Anti-LWW ---');

const initialRecordsCount = store.fieldRecords.length;

// Record 1: Excavation
const rec1 = store.addObservation({
  feature_id: 'asset_002',
  kind: 'stage',
  stage: 'Excavation',
  author: 'Engr. Abdulaziz A. A.'
});
check(rec1.record_id && rec1.record_id.length === 36, 'Observation must receive device-generated UUIDv7');
check(store.getLatestStage('asset_002') === 'Excavation', 'Latest stage must be Excavation');
check(store.fieldRecords.length === initialRecordsCount + 1, 'Field records count must increment by 1');

// Record 2: Rebar (saving new stage must NOT overwrite record 1!)
const rec2 = store.addObservation({
  feature_id: 'asset_002',
  kind: 'stage',
  stage: 'Rebar',
  author: 'Engr. Abdulaziz A. A.'
});
check(store.getLatestStage('asset_002') === 'Rebar', 'Latest stage must be Rebar');
check(store.fieldRecords.length === initialRecordsCount + 2, 'Field records count must increment to 2');
check(store.fieldRecords[initialRecordsCount].record_id === rec1.record_id, 'Record 1 must remain intact at original index');
check(store.fieldRecords[initialRecordsCount].stage === 'Excavation', 'Record 1 stage must still be Excavation');

// Record 3: Concreted
const rec3 = store.addObservation({
  feature_id: 'asset_002',
  kind: 'stage',
  stage: 'Concreted',
  author: 'Engr. Abdulaziz A. A.'
});
check(store.getLatestStage('asset_002') === 'Concreted', 'Latest stage must be Concreted');
check(store.fieldRecords.length === initialRecordsCount + 3, 'Field records count must increment to 3');

// Test Undo / Voiding of Record 3
console.log('   Executing voidObservation() on record 3...');
const voidResult = store.voidObservation(rec3.record_id, 'Wrong structure tapped on site');
check(voidResult.target_record.record_id === rec3.record_id, 'Target record must match voided record');
check(voidResult.target_record.voided_by_record_id === voidResult.voiding_record.record_id, 'Target record must point to voiding record ID');
check(store.fieldRecords.length === initialRecordsCount + 4, 'Voiding must append a new record, not delete');

// Test anti-double voiding: attempting to void an already voided record must throw
let doubleVoidPrevented = false;
try {
  store.voidObservation(rec3.record_id, 'Second void attempt');
} catch (e) {
  doubleVoidPrevented = true;
}
check(doubleVoidPrevented, 'Attempting to void an already-voided record must throw an error');

// Verification of active vs full observation history
const activeObs = store.getObservationsForFeature('asset_002', false, 'stage');
check(activeObs.length === 2, `Active stage observations must be 2 (got ${activeObs.length})`);
check(activeObs[0].stage === 'Excavation' && activeObs[1].stage === 'Rebar', 'Active observations must be Excavation and Rebar');

const fullObsHistory = store.getObservationsForFeature('asset_002', true);
check(fullObsHistory.length === 4, `Full audit history must retain all 4 records (got ${fullObsHistory.length})`);
check(store.getLatestStage('asset_002') === 'Rebar', 'Latest active stage must roll back to Rebar');

// Test that defect records with a stage preserve stage in getLatestStage
const recDefect = store.addObservation({
  feature_id: 'asset_003',
  kind: 'defect',
  stage: 'Blinding',
  payload: { defect_types: ['Silted'] }
});
check(store.getLatestStage('asset_003') === 'Blinding', 'Feature with defect logged during Blinding must report stage "Blinding"');

console.log('[PASS] Append-only observation store and non-destructive voiding verified.\n');

// -----------------------------------------------------------------------------
// SUITE 6: Complete Decoupling of Design Intent and Site Observations
// -----------------------------------------------------------------------------
console.log('--- 6. Testing Complete Store Decoupling (Design vs Field) ---');

const designFeat = store.getDesignFeature('asset_001');
check(designFeat && designFeat.feature, 'DesignFeature must exist');
check(designFeat.active_version, 'DesignVersion must exist');

// Verify DesignFeature does not carry field progress data
check(designFeat.feature.stage === undefined, 'DesignFeature must NEVER contain field stage property');
check(designFeat.feature.status === undefined, 'DesignFeature must NEVER contain field status property');
check(designFeat.feature.notes === undefined, 'DesignFeature must NEVER contain field notes property');
check(designFeat.feature.hasDefect === undefined, 'DesignFeature must NEVER contain field defect property');

// Verify DesignVersion source provenance
check(designFeat.active_version.source.approval_level === 'A', 'DesignVersion must carry source approval level');
check(designFeat.active_version.status === 'confirmed', 'DesignVersion status must be confirmed');

// Verify physical separation in localStorage keys
const rawDesignKeys = JSON.parse(mockStorage.getItem(STORAGE_KEYS.DESIGN_FEATURES));
const rawFieldRecords = JSON.parse(mockStorage.getItem(STORAGE_KEYS.FIELD_RECORDS));

check(Object.prototype.hasOwnProperty.call(rawDesignKeys, 'asset_001'), 'Design features table must contain asset_001');
check(Array.isArray(rawFieldRecords), 'Field records must be stored in distinct array store');
check(!rawDesignKeys.asset_001.observations, 'Design feature record must not embed observation list');

console.log('[PASS] Design intent and site observations remain in strictly decoupled stores.\n');

// -----------------------------------------------------------------------------
// SUITE 7: Design Versioning, Soft-Deletion & Auto-Raised Queries
// -----------------------------------------------------------------------------
console.log('--- 7. Testing Design Versioning & Auto-Query on Removal ---');

// asset_002 already has field records at stage 'Rebar' (above 'Not Started')
const remResult = store.removeDesignFeature('asset_002', 'Alignment change per SI-012', 'SI-012', '02');
check(remResult.feature.feature_id === 'asset_002', 'Feature must retain stable ID');
check(remResult.removed_version.status === 'removed', 'New design version must have status "removed"');
check(remResult.removed_version.version === 2, 'Removed version number must increment to 2');
check(remResult.feature.history_version_ids.length === 2, 'Feature history must track both versions');

// Check that feature is NOT deleted from designFeatures
check(store.designFeatures['asset_002'] !== undefined, 'Removed feature must NEVER be deleted from designFeatures');

// Since work was recorded on site, auto-query "built_but_removed" MUST be created
check(remResult.query !== null, 'Removing a feature with site progress must auto-raise a Query');
check(remResult.query.reason === 'built_but_removed', 'Query reason must be "built_but_removed"');
check(remResult.query.linked_record_ids.length >= 1, 'Query must link to observed field records');
check(store.queries[remResult.query.query_id] !== undefined, 'Query must be registered in queries store');

console.log('[PASS] Design versioning and auto-query on removal verified.\n');

// -----------------------------------------------------------------------------
// SUITE 8: Contractor Claims (IRs) & Discrepancy Query Generation
// -----------------------------------------------------------------------------
console.log('--- 8. Testing IR Ingestion & Contractor Claim Discrepancies ---');

// Load real s03_drainage_irs.json
const realIRs = JSON.parse(fs.readFileSync(path.join(APP_DIR, 's03_drainage_irs.json'), 'utf8'));
check(realIRs.length === 1066, `Must load all 1,066 real IR records (got ${realIRs.length})`);

store.migrate({
  section02Assets: s2Raw,
  section03Assets: s3Raw,
  irRecords: realIRs,
  forceBackup: false
});

check(Object.keys(store.inspectionRequests).length === 1066, `All 1,066 IRs must be ingested without collision (got ${Object.keys(store.inspectionRequests).length})`);

// Verify status mapping on sample IRs
const appdNotedIR = Object.values(store.inspectionRequests).find(ir => ir.prog_n === 98);
check(appdNotedIR && appdNotedIR.outcome === 'approved_with_comments', 'Status "APPD AS NOTED" must map to outcome "approved_with_comments"');
check(appdNotedIR.claimed_stage === 'Excavation', 'Activity description containing "Excavate" must map to claimed_stage "Excavation"');

// Test stage discrepancy auto-query
// Map an IR to asset_056 where contractor claimed "Completed"
store.addInspectionRequest({
  ir_id: 'IR_S03_TEST_CLAIM',
  ir_no: 'IR-TEST-01',
  prog_n: 9999,
  feature_id: 'asset_056',
  section: 'S03',
  claimed_stage: 'Completed',
  outcome: 'approved'
});

// Inspector records "Blinding" on asset_056 while contractor claimed "Completed"
const claimDiscrepancyRec = store.addObservation({
  feature_id: 'asset_056',
  kind: 'stage',
  stage: 'Blinding',
  author: 'Engr. Abdulaziz A. A.'
});

check(claimDiscrepancyRec.verdict_vs_claim === 'disagrees', 'verdict_vs_claim must flag "disagrees"');

const claimAheadQueries = Object.values(store.queries).filter(q => q.reason === 'claim_ahead' && q.feature_id === 'asset_056');
check(claimAheadQueries.length >= 1, 'Discrepancy with contractor claim must auto-generate a "claim_ahead" query');
check(claimAheadQueries[0].linked_record_ids.includes(claimDiscrepancyRec.record_id), 'Query must link to the engineer observation');

console.log('[PASS] IR claims and automatic discrepancy query generation verified.\n');

// -----------------------------------------------------------------------------
// SUITE 9: Extended Entities (Photo, Absence, ChangeSet, Conflict, Alignment)
// -----------------------------------------------------------------------------
console.log('--- 9. Testing Extended Entities (Photo, Absence, ChangeSet, Conflict) ---');

// Test Photo
const photo = store.addPhoto({
  record_id: claimDiscrepancyRec.record_id,
  blob_uri: 'data:image/jpeg;base64,samplephoto123',
  raw_fix: { lat: 12.653, lon: 8.411, accuracy_m: 2.5, timestamp: Date.now() },
  caption: 'Culvert excavation blinding inspection'
});
check(photo.photo_id && photo.uri === photo.blob_uri, 'Photo entity must be created with URI aliases');
const recordPhotos = store.getPhotosForRecord(claimDiscrepancyRec.record_id);
check(recordPhotos.length === 1 && recordPhotos[0].photo_id === photo.photo_id, 'getPhotosForRecord must return attached photo');

// Test Absence
const abs = store.addAbsence({
  subsection: 'KZDR',
  lane: 'toe',
  ch_start: 90000,
  ch_end: 90500,
  reason: 'Natural ridge line diverts runoff away from formation',
  drawing_ref: 'DW-03003'
});
check(abs.line === 'line_km' && abs.line_id === 'line_km', 'Absence must provide both line and line_id');
const absences = store.getAbsences('KZDR', 'toe');
check(absences.length >= 1, 'getAbsences must filter by section and lane');

// Test ChangeSet
const cs = store.createChangeSet({
  name: 'Slope drain additions per SI-015',
  source: { kind: 'site_instruction', doc_ref: 'SI-015', rev: '01', approval_level: 'B' }
});
check(cs.changeset_id && cs.status === 'pending', 'ChangeSet must be created with pending status');

// Test Conflict
const conflict = store.addConflict({
  feature_id: 'asset_001',
  base_version_id: 'asset_001_v1',
  local_version_id: 'asset_001_v2_local',
  remote_version_id: 'asset_001_v2_remote'
});
check(conflict.status === 'unresolved', 'Conflict must initialize with unresolved status');
store.resolveConflict(conflict.conflict_id, 'resolved_office');
check(store.conflicts[conflict.conflict_id].status === 'resolved_office', 'Conflict must be marked resolved');

// Test Alignment
const kmAlign = store.getAlignment('line_km');
check(kmAlign && kmAlign.name.includes('Kano-Maradi'), 'getAlignment must retrieve registered corridor alignment');

console.log('[PASS] Extended entities verified.\n');

// -----------------------------------------------------------------------------
// SUITE 10: Zero-Config Ingestion Test
// -----------------------------------------------------------------------------
console.log('--- 10. Testing Zero-Config Migration Auto-Discovery ---');

const freshStore = new DataStore(createMockStorage());
const autoMigReport = freshStore.migrate(); // No arguments passed
check(autoMigReport.success, 'Zero-config migrate() must succeed');
check(autoMigReport.stats.total_design_features === 2547, `Zero-config must auto-load 2,547 features (got ${autoMigReport.stats.total_design_features})`);
check(autoMigReport.stats.irs_migrated === 1066, `Zero-config must auto-load 1,066 IRs (got ${autoMigReport.stats.irs_migrated})`);
check(freshStore.getLines().length === 2, 'Zero-config must populate master lines');
check(freshStore.getSubSections().length === 9, 'Zero-config must populate all 9 subsections');

console.log('[PASS] Zero-config migration auto-discovery verified.\n');

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('================================================================');
console.log(`ALL 10 TEST SUITES PASSED VERIFICATION 100%! (${passedAssertions} assertions verified)`);
console.log('================================================================\n');
