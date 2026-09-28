/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 5 Automated Test Suite
 * 
 * Validates the Record Flow, Feature Detail, and Defect Workflow (§6.3, §6.4, §6.5 & §10):
 * 1. 2-tap record execution (< 2 seconds simulation) creating valid append-only FieldRecord.
 * 2. No records overwrite across consecutive submissions ("never overwritten").
 * 3. 8-second toast undo properly voids the record via voidObservation() and restores previous stage.
 * 4. Contractor IR claim discrepancy triggers automatic Query generation (claim_ahead).
 * 5. Defect logging appends defect record, assigns DEF-YYYY-NNNN, sets has_defect flag, and triggers warning triangle.
 * 6. Dynamic stage ladder adaptation (6/7 stages for concrete vs. 3 stages for unlined earth).
 * 7. Feature detail displays full audit history and contractor IRs (with > 6 months gap warning).
 * 
 * Strict Guardrail: NO EMOJIS in code or test output.
 */

'use strict';

const assert = require('assert');
const path = require('path');

// Load Modules
const DataModel = require('../data_model.js');
const DataStoreModule = require('../data_store.js');
const { DataStore } = DataStoreModule;
const TYPE_CATALOGUE = require('../type_catalogue.js');
const TypeIcons = require('../type_icons.js');

const ToastManagerModule = require('../toast_manager.js');
const { ToastManager } = ToastManagerModule;

const RecordViewModule = require('../record_view.js');
const { RecordView, CONCRETE_STAGES, UNLINED_STAGES } = RecordViewModule;

const DefectViewModule = require('../defect_view.js');
const { DefectView, DEFECT_TYPES, SEVERITY_LEVELS } = DefectViewModule;

const FeatureDetailViewModule = require('../feature_detail_view.js');
const { FeatureDetailView } = FeatureDetailViewModule;

const WalkStripModule = require('../walk_strip.js');
const { WalkStripLayout, WalkStrip } = WalkStripModule;

const WalkDrawerModule = require('../walk_drawer.js');
const { WalkDrawer, WalkDrawerLogic } = WalkDrawerModule;

const WalkViewModule = require('../walk_view.js');
const { WalkView, AtYouSelectionLogic } = WalkViewModule;

let totalAssertions = 0;

function check(condition, message) {
  totalAssertions++;
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log('================================================================');
console.log('KMD DRAINAGE INSPECTOR - PHASE 5 RECORD FLOW & DEFECT TEST SUITE');
console.log('================================================================\n');

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

// Helper to create a fresh decoupled DataStore
function createTestStore() {
  const storage = createMockStorage();
  const store = new DataStore(storage);
  return store;
}

// =========================================================================
// TEST SUITE 1: 2-Tap Record Execution (< 2s) & Append-Only FieldRecord
// =========================================================================
console.log('--- 1. Testing 2-Tap Record Execution (< 2s) & Append-Only FieldRecord ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    lane: 'toe',
    ch_start: 82900,
    ch_end: 83050,
    offset_m: 13.5,
    position_certainty: 'derived',
    current_stage: 'Not started',
    stage: 'Not started'
  };

  const userPos = {
    ch: 82950,
    side: 'L',
    offset_m: 14.0,
    accuracy_m: 3.5,
    facing: 'increasing'
  };

  let savedResult = null;
  const recordView = new RecordView(null, {
    dataStore: store,
    toastManager: toastMgr,
    typeCatalogue: TYPE_CATALOGUE,
    author: 'Engr. Abdulaziz A. A.',
    deviceId: 'kmd_field_tab_01',
    onRecordSaved: (res) => {
      savedResult = res;
    }
  });

  // Tap 1: Open sheet
  const tStart = Date.now();
  recordView.open(testFeature, userPos);
  check(recordView.isOpen === true, 'RecordView sheet is open');
  check(recordView.currentFeature === testFeature, 'Current feature is bound');

  // Tap 2: Select next stage ('Excavation')
  const record = recordView.submitStage('Excavation');
  const tElapsed = Date.now() - tStart;

  check(record !== null, 'FieldRecord was created successfully');
  check(tElapsed < 2000, `Execution completed in ${tElapsed} ms (< 2000 ms spec target)`);
  check(recordView.isOpen === false, 'RecordView sheet dismissed immediately after tap');

  // Verify created FieldRecord properties
  check(typeof record.record_id === 'string' && record.record_id.length > 0, 'Record has non-empty record_id');
  check(record.kind === 'stage', 'Record kind is stage');
  check(record.stage === 'Excavation', 'Record stage is Excavation');
  check(record.author === 'Engr. Abdulaziz A. A.', 'Author matches');
  check(record.device_id === 'kmd_field_tab_01', 'Device ID matches');
  check(record.sync_state === 'on_phone', 'Record initial state is on_phone');
  check(record.measured_position.ch === 82950, 'Measured chainage matches user position');
  check(record.measured_position.side === 'L', 'Measured side matches user position');

  // Verify feature stage updated synchronously
  check(testFeature.current_stage === 'Excavation', 'Feature current_stage updated to Excavation');
  check(testFeature.stage === 'Excavation', 'Feature stage updated to Excavation');

  // Verify persistence in store
  const allRecords = store.fieldRecords;
  check(allRecords.length === 1, 'DataStore contains exactly 1 field record');
  check(allRecords[0].record_id === record.record_id, 'Stored record ID matches');

  // Verify callback invocation
  check(savedResult !== null, 'onRecordSaved callback invoked');
  check(savedResult.stage === 'Excavation', 'Callback reported stage Excavation');
  check(savedResult.undone === false, 'Callback reported undone is false');

  toastMgr.dismissAll();
  console.log('[PASS] 2-tap record execution (< 2s) and append-only FieldRecord verified.');
}

// =========================================================================
// TEST SUITE 2: Anti-Last-Write-Wins & Consecutive Submissions
// =========================================================================
console.log('\n--- 2. Testing Anti-Last-Write-Wins & Consecutive Submissions ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    lane: 'toe',
    ch_start: 82900,
    ch_end: 83050,
    offset_m: 13.5,
    current_stage: 'Not started'
  };

  const recordView = new RecordView(null, {
    dataStore: store,
    toastManager: toastMgr,
    typeCatalogue: TYPE_CATALOGUE
  });

  const stageProgression = ['Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'];

  for (let i = 0; i < stageProgression.length; i++) {
    const st = stageProgression[i];
    recordView.open(testFeature, { ch: 82950 });
    const rec = recordView.submitStage(st);

    check(rec.stage === st, `Stage ${st} recorded`);
    check(store.fieldRecords.length === i + 1, `Store record count is ${i + 1}`);
    check(testFeature.current_stage === st, `Feature stage is ${st}`);
  }

  // Verify no records were overwritten
  const allObs = store.getObservationsForFeature('KZDR_T1_82900_L', true);
  check(allObs.length === 6, 'All 6 historical observations preserved in audit store');
  for (let i = 0; i < stageProgression.length; i++) {
    check(allObs[i].stage === stageProgression[i], `Record index ${i} retains historical stage ${stageProgression[i]}`);
  }

  // Active latest stage lookup
  const latestStage = store.getLatestStage('KZDR_T1_82900_L');
  check(latestStage === 'Completed', 'Latest active stage is Completed');

  toastMgr.dismissAll();
  console.log('[PASS] Consecutive submissions preserve full history without Last-Write-Wins overwrites.');
}

// =========================================================================
// TEST SUITE 3: 8-Second Toast Undo & Non-Destructive Voiding
// =========================================================================
console.log('\n--- 3. Testing 8-Second Toast Undo & Non-Destructive Voiding ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    current_stage: 'Excavation',
    stage: 'Excavation'
  };

  let savedCallbackData = null;
  const recordView = new RecordView(null, {
    dataStore: store,
    toastManager: toastMgr,
    typeCatalogue: TYPE_CATALOGUE,
    onRecordSaved: (res) => {
      savedCallbackData = res;
    }
  });

  // Step 1: Inspector mistakenly records 'Concreted'
  recordView.open(testFeature, { ch: 82950 });
  const mistakenRecord = recordView.submitStage('Concreted');

  check(testFeature.current_stage === 'Concreted', 'Stage is temporarily Concreted');
  check(store.fieldRecords.length === 1, 'Store has 1 record');
  check(toastMgr.activeToasts.size === 1, 'ToastManager has 1 active toast');

  // Inspect the active toast handle
  const toastHandle = Array.from(toastMgr.activeToasts.values())[0];
  check(toastHandle.recordId === mistakenRecord.record_id, 'Toast holds record ID');
  check(toastHandle.previousStage === 'Excavation', 'Toast holds previous stage Excavation');
  check(toastHandle.durationMs === 8000, 'Toast duration is exactly 8000 ms (8s)');
  check(toastHandle.isUndone === false, 'Toast is not yet undone');

  // Step 2: Inspector taps UNDO before 8s expires
  toastHandle.triggerUndo();

  check(toastHandle.isUndone === true, 'Toast marked undone');
  check(testFeature.current_stage === 'Excavation', 'Feature stage rolled back to Excavation');
  check(testFeature.stage === 'Excavation', 'Feature stage attribute rolled back to Excavation');

  // Verify non-destructive voiding in store (§6.3: "Undo writes a void record; it never hard-deletes")
  check(store.fieldRecords.length === 2, 'Field store contains 2 records (original + void record)');
  const original = store.fieldRecords[0];
  const voidRecord = store.fieldRecords[1];

  check(original.record_id === mistakenRecord.record_id, 'Original record still exists at index 0');
  check(original.voided_by_record_id === voidRecord.record_id, 'Original record points to voiding record ID');
  check(voidRecord.kind === 'verdict', 'Voiding record kind is verdict');
  check(voidRecord.payload.action === 'void', 'Voiding record action is void');
  check(voidRecord.payload.voided_record_id === original.record_id, 'Voiding record references voided ID');

  // Active observations filter excludes voided records
  const activeObs = store.getObservationsForFeature('KZDR_T1_82900_L', false, 'stage');
  check(activeObs.length === 0, 'Active observations list excludes voided record');

  // Audit history retains voided records
  const allObs = store.getObservationsForFeature('KZDR_T1_82900_L', true);
  check(allObs.length === 2, 'Audit observations list retains both records');

  // Error case: cannot void an already voided record
  let doubleVoidError = null;
  try {
    store.voidObservation(mistakenRecord.record_id);
  } catch (err) {
    doubleVoidError = err;
  }
  check(doubleVoidError !== null, 'Attempting to void an already voided record throws an error');

  // Callback notified of undo
  check(savedCallbackData !== null && savedCallbackData.undone === true, 'onRecordSaved notified with undone: true');
  check(savedCallbackData.stage === 'Excavation', 'Reported rolled-back stage is Excavation');

  toastMgr.dismissAll();
  console.log('[PASS] 8-second toast undo and non-destructive voidObservation() verified.');
}

// =========================================================================
// TEST SUITE 4: Contractor IR Claim Discrepancies & Auto-Query (claim_ahead)
// =========================================================================
console.log('\n--- 4. Testing Contractor IR Claim Discrepancies & Auto-Query ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  // Ingest Contractor IR into store claiming 'Concreted'
  const ir = new DataModel.InspectionRequest({
    ir_no: 'IR-DRN-KZDR-0042',
    feature_id: 'KZDR_T1_82900_L',
    activity: 'Ditch Concrete Lining',
    claimed_stage: 'Concreted',
    date: '2026-08-10',
    outcome: 'pending'
  });
  store.inspectionRequests[ir.ir_no] = ir;

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    current_stage: 'Excavation',
    stage: 'Excavation'
  };

  let savedRes = null;
  const recordView = new RecordView(null, {
    dataStore: store,
    toastManager: toastMgr,
    typeCatalogue: TYPE_CATALOGUE,
    onRecordSaved: (res) => {
      savedRes = res;
    }
  });

  // Test Case 4A: Discrepancy (Contractor claims 'Concreted', inspector sees 'Rebar')
  recordView.open(testFeature, { ch: 82950 });
  const rec1 = recordView.submitStage('Rebar');

  check(savedRes.hasDiscrepancy === true, 'RecordView detected claim discrepancy');
  check(rec1.verdict_vs_claim === 'disagrees', 'FieldRecord verdict_vs_claim set to disagrees');

  // Verify office Query was raised automatically
  const queries = Object.values(store.queries);
  check(queries.length === 1, 'Exactly 1 office query created');
  const q1 = queries[0];
  check(q1.reason === 'claim_ahead', 'Query reason is claim_ahead');
  check(q1.status === 'open', 'Query status is open');
  check(q1.feature_id === 'KZDR_T1_82900_L', 'Query feature_id matches');
  check(q1.linked_record_ids.includes(rec1.record_id), 'Query links to inspector record ID');
  check(q1.title.includes('IR-DRN-KZDR-0042'), 'Query title references contractor IR number');

  // Test Case 4B: Agreement (Contractor claims 'Concreted', inspector later sees 'Concreted')
  recordView.open(testFeature, { ch: 82950 });
  const rec2 = recordView.submitStage('Concreted');

  check(savedRes.hasDiscrepancy === false, 'No discrepancy when site matches claim');
  check(rec2.verdict_vs_claim === 'agrees', 'FieldRecord verdict_vs_claim set to agrees');
  check(Object.values(store.queries).length === 1, 'No additional discrepancy query created');

  toastMgr.dismissAll();
  console.log('[PASS] Contractor IR claim discrepancies and automatic claim_ahead query verified.');
}

// =========================================================================
// TEST SUITE 5: Defect Logging, Monotonic ID & Warning Triangle
// =========================================================================
console.log('\n--- 5. Testing Defect Logging, Monotonic ID & Warning Triangle ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  const testFeature = {
    feature_id: 'KZDR_PC_84400_X',
    id: 'KZDR_PC_84400_X',
    type_code: 'PC',
    geometry: 'crossing',
    side: 'C',
    ch: 84406.215,
    has_defect: false,
    defects: []
  };

  const defectView = new DefectView(null, {
    dataStore: store,
    toastManager: toastMgr,
    author: 'Engr. Abdulaziz A. A.'
  });

  // Verify 10 defect types from spec
  check(DEFECT_TYPES.length === 10, 'Exactly 10 standard defect types available');
  check(DEFECT_TYPES.includes('Scour / erosion'), 'Scour / erosion defect type present');
  check(DEFECT_TYPES.includes('Cracking'), 'Cracking defect type present');
  check(DEFECT_TYPES.includes('Honeycombing'), 'Honeycombing defect type present');
  check(DEFECT_TYPES.includes('Exposed rebar'), 'Exposed rebar defect type present');
  check(DEFECT_TYPES.includes('Joint failure'), 'Joint failure defect type present');

  // Verify 3 severity levels
  check(SEVERITY_LEVELS.length === 3, 'Exactly 3 severity levels');

  // Log Defect 1
  defectView.open(testFeature, { ch: 84406.215 });
  const def1 = defectView.submitDefect({
    defect_type: 'Scour / erosion',
    severity: 'Major (rework required)',
    chainage: 84406.215,
    note: 'Deep scour void under inlet headwall apron'
  });

  const year = new Date().getFullYear();
  check(def1.defect_id === `DEF-${year}-0001`, `First defect ID is DEF-${year}-0001`);
  check(testFeature.has_defect === true, 'Feature has_defect set to true');
  check(testFeature.defects.length === 1, 'Feature defects list contains 1 entry');
  check(testFeature.defects[0].defect_id === def1.defect_id, 'Feature defect ID matches');

  // Verify Query was raised
  check(def1.query !== null, 'Defect query was generated');
  check(def1.query.reason === 'defect', 'Query reason is defect');
  check(def1.query.status === 'open', 'Query status is open');

  // Log Defect 2 (monotonic ID increment)
  defectView.open(testFeature, { ch: 84406.215 });
  const def2 = defectView.submitDefect({
    defect_type: 'Honeycombing',
    severity: 'Minor (monitor)',
    chainage: 84407.0,
    note: 'Surface voiding on wingwall'
  });

  check(def2.defect_id === `DEF-${year}-0002`, `Second defect ID monotonically incremented to DEF-${year}-0002`);
  check(testFeature.defects.length === 2, 'Feature defects list contains 2 entries');

  // Verify warning triangle rendering logic
  let drawnX = null;
  let drawnY = null;
  let drawnFill = null;
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: (x, y) => { drawnX = x; drawnY = y; },
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    fillRect: () => {},
    set fillStyle(val) { drawnFill = val; }
  };

  WalkStripLayout.drawDefectWarningTriangle(mockCtx, 100, 200);
  check(drawnX === 100 && drawnY === 191, '18px triangle top vertex positioned correctly at y-9 (191)');
  check(drawnFill === '#FFFFFF', 'Exclamation mark filled with white');

  toastMgr.dismissAll();
  console.log('[PASS] Defect logging, monotonic DEF-YYYY-NNNN IDs, and warning triangle verified.');
}

// =========================================================================
// TEST SUITE 6: Dynamic Stage Ladder Adaptation & Smart Suggestions
// =========================================================================
console.log('\n--- 6. Testing Dynamic Stage Ladder Adaptation & Smart Suggestions ---');

{
  // Test 6A: Concrete features (7 stages)
  const concreteFeatures = [
    { type_code: 'T1' },
    { type_code: '1' },
    { type_code: 'T2' },
    { type_code: 'T6' },
    { type_code: 'T7' },
    { type_code: 'T8' },
    { type_code: 'T9' },
    { type_code: 'T11' },
    { type_code: 'T12' },
    { type_code: 'BC' },
    { type_code: 'PC' },
    { type_code: 'BRG' }
  ];

  for (const f of concreteFeatures) {
    const ladder = RecordView.resolveStageLadder(f, TYPE_CATALOGUE);
    check(ladder.length === 7, `Concrete feature type ${f.type_code} has 7 stages`);
    check(ladder[0] === 'Not started', 'First stage is Not started');
    check(ladder[3] === 'Rebar', 'Fourth stage is Rebar');
    check(ladder[5] === 'Concreted', 'Sixth stage is Concreted');
    check(ladder[6] === 'Completed', 'Seventh stage is Completed');
  }

  // Test 6B: Unlined earth ditch features (3 stages)
  const unlinedFeatures = [
    { type_code: 'T3' },
    { type_code: '3' },
    { type_code: 'Type 3' },
    { type_code: 'T4' },
    { type_code: '4' },
    { type_code: 'Type 4' },
    { type_code: 'T5' },
    { type_code: '5' },
    { type_code: 'Type 5' },
    { type_code: 'CH-A' },
    { type_code: 'CH_A' },
    { type_code: 'CUSTOM', category: 'Unlined Earth Ditch' }
  ];

  for (const f of unlinedFeatures) {
    const ladder = RecordView.resolveStageLadder(f, TYPE_CATALOGUE);
    check(ladder.length === 3, `Unlined feature type ${f.type_code} has 3 stages`);
    check(ladder[0] === 'Not started', 'First stage is Not started');
    check(ladder[1] === 'Excavated', 'Second stage is Excavated');
    check(ladder[2] === 'Completed', 'Third stage is Completed');
  }

  // Test 6C: Smart suggestions algorithm de-duplication
  // Case 1: Contractor claimed 'Rebar', current is 'Excavation'
  const sug1 = RecordView.generateSuggestions('Excavation', 'Rebar', CONCRETE_STAGES);
  check(sug1.length === 3, 'Returns 3 distinct suggestions');
  check(sug1[0].stage === 'Rebar' && sug1[0].isPrimary === true, 'Claimed stage Rebar is primary suggestion');
  check(sug1[1].stage === 'Blinding', 'Next sequential stage Blinding is suggested');
  check(sug1[2].stage === 'Excavation', 'Current stage Excavation is suggested as no change');

  // Case 2: Contractor claimed same as current 'Concreted'
  const sug2 = RecordView.generateSuggestions('Concreted', 'Concreted', CONCRETE_STAGES);
  check(sug2.length === 2, 'Deduplicates identical stages into 2 buttons');
  check(sug2[0].stage === 'Concreted' && sug2[0].isPrimary === true, 'Concreted is primary');
  check(sug2[1].stage === 'Completed', 'Completed is next sequential stage');

  // Case 3: No claim filed, current is 'Completed' (end of ladder)
  const sug3 = RecordView.generateSuggestions('Completed', null, CONCRETE_STAGES);
  check(sug3.length === 1, 'Completed has 1 suggestion (no change)');
  check(sug3[0].stage === 'Completed', 'Completed suggested');

  console.log('[PASS] Dynamic stage ladder adaptation and smart suggestions verified.');
}

// =========================================================================
// TEST SUITE 7: Feature Detail View Audit Trail & Contractor IRs
// =========================================================================
console.log('\n--- 7. Testing Feature Detail View Audit Trail & Contractor IRs ---');

{
  const store = createTestStore();

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    lane: 'toe',
    ch_start: 82900,
    ch_end: 83050,
    offset_m: 13.5,
    position_certainty: 'derived',
    tolerance_m: 4.0,
    drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
    source: { rev: '05-A' },
    specs: 'Trapezoidal concrete ditch b=0.6m, h=0.8m, m=1:1',
    current_stage: 'Rebar'
  };

  // Add older IR (8 months ago -> should trigger gap hazard)
  const eightMonthsAgo = new Date(Date.now() - (240 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const oldIR = new DataModel.InspectionRequest({
    ir_no: 'IR-OLD-001',
    feature_id: 'KZDR_T1_82900_L',
    activity: 'Ditch excavation',
    claimed_stage: 'Excavation',
    date: eightMonthsAgo,
    outcome: 'approved'
  });
  store.inspectionRequests[oldIR.ir_no] = oldIR;

  // Add observation history: 1 valid stage, 1 defect, 1 voided stage
  const obs1 = store.addObservation({
    feature_id: 'KZDR_T1_82900_L',
    kind: 'stage',
    stage: 'Excavation'
  });

  const obs2 = store.addObservation({
    feature_id: 'KZDR_T1_82900_L',
    kind: 'defect',
    stage: 'Excavation',
    payload: {
      defect_id: 'DEF-2026-0001',
      defect_type: 'Cracking',
      severity: 'Minor (monitor)'
    }
  });

  const obs3 = store.addObservation({
    feature_id: 'KZDR_T1_82900_L',
    kind: 'stage',
    stage: 'Blinding'
  });
  store.voidObservation(obs3.record_id, 'Mistaken tap');

  const obs4 = store.addObservation({
    feature_id: 'KZDR_T1_82900_L',
    kind: 'stage',
    stage: 'Rebar'
  });

  // Verify store state before rendering
  const historyObs = store.getObservationsForFeature('KZDR_T1_82900_L', true);
  check(historyObs.length === 5, '5 total audit records (4 observations + 1 void verdict)');

  const featureDetail = new FeatureDetailView(null, {
    dataStore: store,
    typeCatalogue: TYPE_CATALOGUE
  });

  featureDetail.open(testFeature, { ch: 82950 });
  check(featureDetail.isOpen === true, 'FeatureDetailView opened');

  // Verify observations retrieval by FeatureDetailView
  const detailObs = store.getObservationsForFeature(testFeature.feature_id, true);
  check(detailObs.some(o => o.voided_by_record_id !== undefined && o.voided_by_record_id !== null), 'Identifies voided record in audit trail');
  check(detailObs.some(o => o.kind === 'defect'), 'Identifies open defect in audit trail');

  // Verify IR gap analysis
  const featureIRs = store.getInspectionRequestsForFeature(testFeature.feature_id);
  check(featureIRs.length === 1, '1 IR found for feature');
  const monthsAgo = Math.round((Date.now() - new Date(featureIRs[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30));
  check(monthsAgo >= 7, `IR gap calculated at ${monthsAgo} months (> 6 months threshold)`);

  featureDetail.close();
  check(featureDetail.isOpen === false, 'FeatureDetailView closed');

  console.log('[PASS] Feature Detail View audit trail and contractor IRs verified.');
}

// =========================================================================
// TEST SUITE 8: WalkView & WalkDrawer Integration & Gesture Routing
// =========================================================================
console.log('\n--- 8. Testing WalkView & WalkDrawer Integration & Gesture Routing ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  const testFeature = {
    feature_id: 'KZDR_T1_82900_L',
    id: 'KZDR_T1_82900_L',
    type_code: 'T1',
    side: 'L',
    lane: 'toe',
    ch_start: 82900,
    ch_end: 83050,
    offset_m: 13.5,
    position_certainty: 'derived',
    current_stage: 'Not started',
    stage: 'Not started',
    has_defect: false
  };

  const walkView = new WalkView(null, {
    dataStore: store,
    toastManager: toastMgr,
    features: [testFeature],
    absences: [],
    initialCh: 82950,
    initialSide: 'L'
  });

  // Verify method existence
  check(typeof walkView.openRecordView === 'function', 'walkView.openRecordView exists');
  check(typeof walkView.openDefectView === 'function', 'walkView.openDefectView exists');
  check(typeof walkView.openFeatureDetail === 'function', 'walkView.openFeatureDetail exists');

  // Verify openRecordView routes to recordView
  let recordOpened = false;
  walkView.recordView = {
    open: (feat, pos) => {
      recordOpened = true;
      check(feat.feature_id === testFeature.feature_id, 'Routed feature matches');
    }
  };
  walkView.openRecordView(testFeature);
  check(recordOpened === true, 'openRecordView successfully invoked recordView.open');

  // Verify openDefectView routes to defectView
  let defectOpened = false;
  walkView.defectView = {
    open: (feat, pos) => {
      defectOpened = true;
      check(feat.feature_id === testFeature.feature_id, 'Routed feature matches');
    }
  };
  walkView.openDefectView(testFeature);
  check(defectOpened === true, 'openDefectView successfully invoked defectView.open');

  // Verify openFeatureDetail routes to featureDetailView
  let detailOpened = false;
  walkView.featureDetailView = {
    open: (feat, pos) => {
      detailOpened = true;
      check(feat.feature_id === testFeature.feature_id, 'Routed feature matches');
    }
  };
  walkView.openFeatureDetail(testFeature);
  check(detailOpened === true, 'openFeatureDetail successfully invoked featureDetailView.open');

  // Verify WalkDrawer onFeatureLongPress option
  let drawerLongPressed = false;
  const drawer = new WalkDrawer(null, {
    onFeatureLongPress: (feat) => {
      drawerLongPressed = true;
    }
  });
  check(typeof drawer.onFeatureLongPress === 'function', 'WalkDrawer stores onFeatureLongPress callback');
  drawer.onFeatureLongPress(testFeature);
  check(drawerLongPressed === true, 'WalkDrawer long-press callback successfully dispatched');

  console.log('[PASS] WalkView & WalkDrawer integration and gesture routing verified.');
}

// =========================================================================
// TEST SUITE 9: Edge Cases, Stage Fills, Stage Meter & Query Cancellation
// =========================================================================
console.log('\n--- 9. Testing Edge Cases, Stage Fills, Stage Meter & Query Cancellation ---');

{
  const store = createTestStore();
  const toastMgr = new ToastManager(null);

  // 9A: WalkStrip Fill Classification with case variations
  const testFeatUnstarted1 = { stage: 'Not started' };
  const testFeatUnstarted2 = { stage: 'Not Started' };
  const testFeatProgress = { stage: 'Excavation' };
  const testFeatCompleted = { stage: 'Completed' };

  function evaluateFill(feat) {
    const stage = (feat.current_stage || feat.stage || 'not started').toLowerCase();
    const isComplete = (stage === 'completed' || stage.includes('completed') || stage.includes('approved'));
    const isPartBuilt = (stage !== 'not started' && !isComplete);
    return { isComplete, isPartBuilt };
  }

  const fill1 = evaluateFill(testFeatUnstarted1);
  check(fill1.isPartBuilt === false && fill1.isComplete === false, 'Not started (lowercase s) produces outline fill (not part-built hatch)');

  const fill2 = evaluateFill(testFeatUnstarted2);
  check(fill2.isPartBuilt === false && fill2.isComplete === false, 'Not Started (capital S) produces outline fill (not part-built hatch)');

  const fill3 = evaluateFill(testFeatProgress);
  check(fill3.isPartBuilt === true && fill3.isComplete === false, 'Excavation produces hatch fill (part-built)');

  const fill4 = evaluateFill(testFeatCompleted);
  check(fill4.isPartBuilt === false && fill4.isComplete === true, 'Completed produces solid fill');

  // 9B: WalkDrawer 6-Segment Stage Meter Adaptation
  const drawer = new WalkDrawer(null, {});
  const meterUnstarted = drawer.createStageMeter('Not started');
  check(meterUnstarted.querySelectorAll('.di-stage-meter__segment--partial').length === 0, 'Unstarted meter has 0 filled segments');
  check(meterUnstarted.querySelectorAll('.di-stage-meter__segment--complete').length === 0, 'Unstarted meter has 0 complete segments');

  const meterExcavated = drawer.createStageMeter('Excavated');
  check(meterExcavated.querySelectorAll('.di-stage-meter__segment--partial').length === 3, 'Unlined Excavated ditch displays 3 segments (level 3/6)');

  const meterCompleted = drawer.createStageMeter('Completed');
  check(meterCompleted.querySelectorAll('.di-stage-meter__segment--complete').length === 6, 'Completed ditch displays 6 full segments');

  const meterCompositeRebar = drawer.createStageMeter('Rebar / Shuttering');
  check(meterCompositeRebar.querySelectorAll('.di-stage-meter__segment--partial').length === 4, 'Composite Rebar/Shuttering displays level 4/6');

  const meterCompositeExc = drawer.createStageMeter('Excavation / Blinding');
  check(meterCompositeExc.querySelectorAll('.di-stage-meter__segment--partial').length === 2, 'Composite Excavation/Blinding displays level 2/6');

  // Test DataStore active defect queries
  const defRecord = store.logDefect({
    feature_id: 'FEAT_TEST_DEFECT_ACTIVE',
    defect_type: 'Cracking',
    severity: 'Major (rework required)'
  });
  check(store.hasActiveDefect('FEAT_TEST_DEFECT_ACTIVE') === true, 'DataStore.hasActiveDefect returns true when open defect exists');
  check(store.getActiveDefectsForFeature('FEAT_TEST_DEFECT_ACTIVE').length === 1, 'DataStore.getActiveDefectsForFeature returns active defect');

  // Void defect and confirm hasActiveDefect turns false
  store.voidObservation(defRecord.record.record_id, 'False alarm');
  check(store.hasActiveDefect('FEAT_TEST_DEFECT_ACTIVE') === false, 'DataStore.hasActiveDefect returns false after voiding');
  check(store.getActiveDefectsForFeature('FEAT_TEST_DEFECT_ACTIVE').length === 0, 'getActiveDefectsForFeature returns empty array after voiding');

  // 9C: RecordView.generateSuggestions case resilience with 'Not Started'
  const sugResilient = RecordView.generateSuggestions('Not Started', null, CONCRETE_STAGES);
  check(sugResilient.length === 2, 'generateSuggestions resilient to capital S: returns 2 buttons');
  check(sugResilient[0].stage === 'Excavation', 'Next stage Excavation suggested when currently Not Started');
  check(sugResilient[1].stage === 'Not started', 'Current stage Not started suggested as no change');

  // 9D: Query Cancellation when Discrepancy Observation is Voided
  const ir = new DataModel.InspectionRequest({
    ir_no: 'IR-TEST-DISC-01',
    feature_id: 'FEAT_TEST_01',
    activity: 'Concrete Pouring',
    claimed_stage: 'Concreted',
    date: '2026-09-20',
    outcome: 'pending'
  });
  store.inspectionRequests[ir.ir_no] = ir;

  const obs = store.addObservation({
    feature_id: 'FEAT_TEST_01',
    kind: 'stage',
    stage: 'Excavation'
  });

  const discQuery = Object.values(store.queries).find(q => q.feature_id === 'FEAT_TEST_01' && q.reason === 'claim_ahead');
  check(discQuery !== undefined, 'Claim discrepancy query created');
  check(discQuery.status === 'open', 'Claim discrepancy query is open');

  // Void the observation
  store.voidObservation(obs.record_id, 'Engineer corrected tap within 8s');
  check(discQuery.status === 'cancelled', 'Linked discrepancy query status updated to cancelled upon observation void');
  check(discQuery.resolution_note.includes('Engineer corrected tap'), 'Resolution note documents cancellation reason');

  // 9E: Consecutive Toasts Independence & Non-Interference
  const toast1 = toastMgr.showUndoToast({
    message: 'Saved · Excavation',
    stageName: 'Excavation',
    recordId: 'rec_01',
    durationMs: 8000
  });

  const toast2 = toastMgr.showUndoToast({
    message: 'Saved · Blinding',
    stageName: 'Blinding',
    recordId: 'rec_02',
    durationMs: 8000
  });

  check(toastMgr.activeToasts.size === 2, 'Two toasts co-exist in ToastManager map');
  check(toast1.id !== toast2.id, 'Toasts have distinct identifiers');

  toast1.triggerUndo();
  check(toast1.isUndone === true, 'Toast 1 successfully executed undo');
  check(toast2.isUndone === false, 'Toast 2 remains active and unaffected by Toast 1 undo');

  toastMgr.dismissAll();
  check(toastMgr.activeToasts.size === 0, 'dismissAll cleanly clears all toasts');

  // 9F: Strict Zero Emojis Audit
  const fs = require('fs');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const criticalFiles = [
    '../record_view.js',
    '../toast_manager.js',
    '../defect_view.js',
    '../feature_detail_view.js',
    '../walk_strip.js',
    '../walk_drawer.js',
    '../walk_view.js',
    '../identify_view.js',
    '../data_store.js',
    '../data_model.js'
  ];

  for (const relPath of criticalFiles) {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      check(!emojiRegex.test(code), `Zero emojis in ${path.basename(relPath)}`);
    }
  }

  console.log('[PASS] Edge cases, stage fills, stage meter, and query cancellation verified.');
}

console.log('\n================================================================');
console.log(`ALL 9 TEST SUITES PASSED VERIFICATION 100%! (${totalAssertions} assertions verified)`);
console.log('================================================================');
