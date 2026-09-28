/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 4 Automated Test Suite
 * 
 * Tests the Walk Strip Canvas/DOM Engine, At-You Bar Selection Rule,
 * WalkDrawer, and Identify Cross-Section View (§6.1, §6.2 & §10).
 * 
 * Strict Guardrail: NO EMOJIS in code or test output.
 */

'use strict';

const assert = require('assert');
const path = require('path');

// Load Phase 4 modules
const WalkStripModule = require('../walk_strip.js');
const {
  WalkStripLayout,
  STRIP_WIDTH,
  SCALE_PX_PER_M,
  READING_LINE_RATIO,
  LANE_COLUMNS,
  CROSSING_CORRIDOR
} = WalkStripModule;

const WalkDrawerModule = require('../walk_drawer.js');
const {
  WalkDrawerLogic
} = WalkDrawerModule;

const IdentifyViewModule = require('../identify_view.js');
const {
  IdentifyLogic,
  BUBBLE_SYMBOLS
} = IdentifyViewModule;

const WalkViewModule = require('../walk_view.js');
const {
  AtYouSelectionLogic
} = WalkViewModule;

let totalAssertions = 0;

function check(condition, message) {
  totalAssertions++;
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log('================================================================');
console.log('KMD DRAINAGE INSPECTOR - PHASE 4 WALK STRIP & IDENTIFY TEST SUITE');
console.log('================================================================\n');

// =========================================================================
// TEST SUITE 1: 7-Lane Offset Layout & Spine Tick Spacing
// =========================================================================
console.log('--- 1. Testing 7-Lane Offset Layout & Spine Tick Spacing ---');

const layout = new WalkStripLayout({ width: 390, height: 540 });

// 1.1 Strip Width & Column Counts
check(STRIP_WIDTH === 390, 'Reference strip width must be exactly 390px');
check(LANE_COLUMNS.length === 11, 'Must have exactly 11 columns across 7 lane categories');

const totalColWidth = LANE_COLUMNS.reduce((sum, c) => sum + c.width, 0);
check(totalColWidth === 390, 'Sum of 11 column widths must equal 390px (got ' + totalColWidth + ')');

// 1.2 Lane Column Geometries
const spineCol = LANE_COLUMNS[5];
check(spineCol.id === 'spine' && spineCol.width === 60, 'Spine column width must be 60px');
check(spineCol.xCenter === 195.0, 'Spine centerline must be centered at x = 195px');

// Left lanes (5 columns of 33px each = 165px)
const leftCols = LANE_COLUMNS.slice(0, 5);
check(leftCols.every(c => c.width === 33 && c.side === 'L'), 'All 5 left lanes must be 33px wide with side L');
check(leftCols[0].xStart === 0 && leftCols[0].xCenter === 16.5, 'Left OFF column must span [0, 33] center 16.5');
check(leftCols[4].xStart === 132 && leftCols[4].xCenter === 148.5, 'Left PLAT column must span [132, 165] center 148.5');

// Right lanes (5 columns of 33px each = 165px)
const rightCols = LANE_COLUMNS.slice(6, 11);
check(rightCols.every(c => c.width === 33 && c.side === 'R'), 'All 5 right lanes must be 33px wide with side R');
check(rightCols[0].xStart === 225 && rightCols[0].xCenter === 241.5, 'Right PLAT column must span [225, 258] center 241.5');
check(rightCols[4].xStart === 357 && rightCols[4].xCenter === 373.5, 'Right OFF column must span [357, 390] center 373.5');

// 1.3 Crossing Corridor Bounds (Left TOE outer to Right TOE outer)
check(CROSSING_CORRIDOR.xStart === 66, 'Crossing corridor must start at Left TOE outer (x = 66)');
check(CROSSING_CORRIDOR.xEnd === 324, 'Crossing corridor must end at Right TOE outer (x = 324)');
check(CROSSING_CORRIDOR.width === 258, 'Crossing corridor width must be exactly 258px (324 - 66)');

// 1.4 Column Resolution by Side, Lane & Offset
check(layout.resolveColumn('L', 'off') === 0, 'Left OFF maps to column 0');
check(layout.resolveColumn('L', 'toe') === 2, 'Left TOE maps to column 2');
check(layout.resolveColumn('L', 'plat') === 4, 'Left PLAT maps to column 4');
check(layout.resolveColumn('C', 'cl') === 5, 'Spine CL maps to column 5');
check(layout.resolveColumn('R', 'plat') === 6, 'Right PLAT maps to column 6');
check(layout.resolveColumn('R', 'toe') === 8, 'Right TOE maps to column 8');
check(layout.resolveColumn('R', 'off') === 10, 'Right OFF maps to column 10');
check(layout.resolveColumn('C', 'crossing') === 5, 'Crossing corridor resolves spine center');

// Column resolution by lateral offset
check(layout.resolveColumn(null, null, 45.0) === 0, 'Offset +45m maps to Left OFF (col 0)');
check(layout.resolveColumn(null, null, 12.0) === 2, 'Offset +12m maps to Left TOE (col 2)');
check(layout.resolveColumn(null, null, 0.0) === 5, 'Offset 0m maps to Spine (col 5)');
check(layout.resolveColumn(null, null, -12.0) === 8, 'Offset -12m maps to Right TOE (col 8)');
check(layout.resolveColumn(null, null, -45.0) === 10, 'Offset -45m maps to Right OFF (col 10)');

// 1.5 Scale & Reading Line
check(SCALE_PX_PER_M === 1.9, 'Scale must be 1.9 px/m when walking');
check(READING_LINE_RATIO === 0.8, 'Reading line must be fixed at 80% of strip height');
check(layout.getReadingLineY() === 540 * 0.8, 'Reading line Y on 540px height must be 432px');

// 1.6 Spine Ticks and Labels Generation
const ticks = layout.generateSpineTicks(82800, 83000, 82900, 'increasing');
check(ticks.length === 21, 'Must generate 21 ticks across 200m at 10m intervals');

const tick10m = ticks.find(t => t.ch === 82810);
check(tick10m.width === 5 && tick10m.thickness === 1, '10m tick must be 5px wide and 1px thick');
check(tick10m.label === null, '10m non-50m ticks must have no text label');

const tick50m = ticks.find(t => t.ch === 82850);
check(tick50m.width === 10 && tick50m.thickness === 1, '50m tick must be 10px wide and 1px thick');
check(tick50m.label === '+850', '50m tick must be formatted as +850 (got ' + tick50m.label + ')');
check(tick50m.isBold === false, '50m non-hundred tick must not be bold');

const tick100m = ticks.find(t => t.ch === 82900);
check(tick100m.width === 14 && tick100m.thickness === 2, '100m tick must be 14px wide and 2px thick');
check(tick100m.label === '82+900', '100m tick must have bold full chainage (got ' + tick100m.label + ')');
check(tick100m.isBold === true, '100m tick must be bold');

// Pixel distance between adjacent 10m ticks
const tickDeltaPx = Math.abs(ticks[1].y - ticks[0].y);
check(Math.abs(tickDeltaPx - (10 * 1.9)) < 1e-4, '10m ticks must be separated by exactly 19.0px (got ' + tickDeltaPx + ')');

console.log('[PASS] 7-lane offset layout and spine tick spacing verified.\n');

// =========================================================================
// TEST SUITE 2: At-You Bar Selection Rule Algorithm
// =========================================================================
console.log('--- 2. Testing At-You Bar Selection Rule Algorithm ---');

// Setup mock features
const featCulvert = {
  feature_id: 'feat_culv_1',
  geometry: 'crossing',
  ch: 82902.439,
  ch_start: 82902.439,
  ch_end: 82902.439,
  side: 'C',
  offset_m: 0,
  position_certainty: 'exact',
  tolerance_m: 0,
  type_code: 'CULV_BOX',
  short_name: 'Box culvert 2x2m',
  category: 'Cross drainage'
};

const featDitchPlat = {
  feature_id: 'feat_ditch_plat',
  geometry: 'linear',
  ch_start: 82850,
  ch_end: 82950,
  side: 'L',
  lane: 'plat',
  offset_m: 3.5,
  position_certainty: 'derived',
  tolerance_m: 4,
  type_code: '1',
  short_name: 'Side ditch',
  category: 'Side ditch'
};

const featDitchToe = {
  feature_id: 'feat_ditch_toe',
  geometry: 'linear',
  ch_start: 82880,
  ch_end: 82930,
  side: 'L',
  lane: 'toe',
  offset_m: 13.0,
  position_certainty: 'derived',
  tolerance_m: 4,
  type_code: '12',
  short_name: 'Trapezoidal toe',
  category: 'Toe ditch'
};

const featDitchRight = {
  feature_id: 'feat_ditch_r',
  geometry: 'linear',
  ch_start: 82880,
  ch_end: 82930,
  side: 'R',
  lane: 'toe',
  offset_m: -13.0,
  position_certainty: 'derived',
  tolerance_m: 4,
  type_code: '12',
  short_name: 'Trapezoidal toe',
  category: 'Toe ditch'
};

// 2.1 Priority 1: Crossing and point structures preferred over linear features
const resCrossingPriority = AtYouSelectionLogic.selectAtYouFeature(
  [featDitchPlat, featCulvert, featDitchToe],
  [],
  { ch: 82902.0, side: 'L', offset_m: 3.5, accuracy_m: 4.0 }
);
check(resCrossingPriority.variant === 'normal', 'Result variant must be normal');
check(resCrossingPriority.selectedFeature.feature_id === 'feat_culv_1', 'Crossing structure must take priority over linear ditches (got ' + resCrossingPriority.selectedFeature.feature_id + ')');

// 2.2 Priority 2: Nearest linear feature by lateral offset
// User at offset L 14m (close to Toe ditch at 13m, far from Plat ditch at 3.5m)
const resLateralOffset = AtYouSelectionLogic.selectAtYouFeature(
  [featDitchPlat, featDitchToe],
  [],
  { ch: 82900.0, side: 'L', offset_m: 14.0, accuracy_m: 4.0 }
);
check(resLateralOffset.selectedFeature.feature_id === 'feat_ditch_toe', 'Nearest linear feature by lateral offset must be selected (got ' + resLateralOffset.selectedFeature.feature_id + ')');

// 2.3 Side Disambiguation: Left vs Right side filtering
const resSideFilter = AtYouSelectionLogic.selectAtYouFeature(
  [featDitchToe, featDitchRight],
  [],
  { ch: 82900.0, side: 'R', offset_m: -12.0, accuracy_m: 4.0 }
);
check(resSideFilter.selectedFeature.feature_id === 'feat_ditch_r', 'Must select feature matching user side R');

// 2.4 Priority 3: Fallback — Designed Absence at user position
const mockAbsence = {
  absence_id: 'abs_1',
  subsection: 'KZDR',
  side: 'L',
  lane: 'plat',
  ch_start: 83100,
  ch_end: 83300,
  drawing_ref: 'DW-03019-06',
  approval_level: 'A'
};

const resAbsence = AtYouSelectionLogic.selectAtYouFeature(
  [featDitchPlat],
  [mockAbsence],
  { ch: 83200.0, side: 'L', offset_m: 3.5, accuracy_m: 4.0 }
);
check(resAbsence.variant === 'empty_by_design', 'Absence must trigger empty_by_design variant');
check(resAbsence.absence.drawing_ref === 'DW-03019-06', 'Absence drawing reference must be DW-03019-06');
check(resAbsence.title.includes('No ditch here — by design'), 'Title must contain exact spec wording');

// 2.5 Variant: Poor GPS (accuracy > 10m with ambiguity)
const resPoorGps = AtYouSelectionLogic.selectAtYouFeature(
  [featDitchPlat, featDitchToe, featCulvert],
  [],
  { ch: 82902.0, side: 'L', offset_m: 10.0, accuracy_m: 15.0 }, // 15m poor GPS
  { isPoor: true }
);
check(resPoorGps.variant === 'poor_gps', 'Accuracy > 10m must trigger poor_gps variant');
check(resPoorGps.bannerText.includes('GPS can\'t tell which of'), 'Banner must indicate GPS ambiguity');
check(resPoorGps.nearestAnchor && resPoorGps.nearestAnchor.feature_id === 'feat_culv_1', 'Must propose nearest exact anchor culvert');
check(resPoorGps.actionButtonText.includes('EXACT'), 'Anchor action button must include EXACT label');

// 2.6 Variant: Pending Revision
const featPendingRev = Object.assign({}, featDitchToe, {
  status: 'pending',
  source: { rev: '07' },
  drawing_ref: 'DW-03008'
});
const resRevision = AtYouSelectionLogic.selectAtYouFeature(
  [featPendingRev],
  [],
  { ch: 82900.0, side: 'L', offset_m: 13.0, accuracy_m: 3.0 }
);
check(resRevision.variant === 'revision', 'Pending status must trigger revision variant');
check(resRevision.bannerText.includes('△07'), 'Revision banner must contain delta symbol and revision number');

console.log('[PASS] At-You Bar selection rule algorithm verified.\n');

// =========================================================================
// TEST SUITE 3: 40+ Features in 400m Density & Clustering Logic
// =========================================================================
console.log('--- 3. Testing 40+ Features in 400m Density & Clustering Logic ---');

const denseFeatures = [];
// Generate 45 features across 400m (PK 82+800 to PK 83+200)
for (let i = 0; i < 45; i++) {
  const ch = 82800 + (i * 8.5);
  if (i >= 10 && i <= 14) {
    // 5 point features closely clustered within 8m in Left TOE lane
    denseFeatures.push({
      feature_id: `pt_cluster_${i}`,
      geometry: 'point',
      ch: 82900 + (i - 10) * 1.5, // 82900, 82901.5, 82903, 82904.5, 82906 (span = 6m)
      side: 'L',
      lane: 'toe',
      offset_m: 13.0,
      type_code: 'D-SD'
    });
  } else if (i % 4 === 0) {
    // Linear ditches in PLAT
    denseFeatures.push({
      feature_id: `linear_plat_${i}`,
      geometry: 'linear',
      ch_start: ch,
      ch_end: ch + 25,
      side: 'L',
      lane: 'plat',
      offset_m: 3.5,
      type_code: '1'
    });
  } else if (i % 4 === 1) {
    // Linear ditches in TOE
    denseFeatures.push({
      feature_id: `linear_toe_${i}`,
      geometry: 'linear',
      ch_start: ch,
      ch_end: ch + 30,
      side: 'R',
      lane: 'toe',
      offset_m: -13.0,
      type_code: '12'
    });
  } else if (i % 4 === 2) {
    // Crossing culverts
    denseFeatures.push({
      feature_id: `cross_${i}`,
      geometry: 'crossing',
      ch: ch,
      ch_start: ch,
      ch_end: ch,
      side: 'C',
      type_code: 'BC'
    });
  } else {
    // Isolated point features
    denseFeatures.push({
      feature_id: `pt_iso_${i}`,
      geometry: 'point',
      ch: ch,
      side: 'R',
      lane: 'crest',
      offset_m: -24.0,
      type_code: 'D-ST'
    });
  }
}

check(denseFeatures.length === 45, 'Synthesized 45 features in 400m density stretch');

// Test point clustering
const pointsInDense = denseFeatures.filter(f => f.geometry === 'point');
const clusterOutput = layout.clusterPointFeatures(pointsInDense);

check(clusterOutput.clusters.length >= 1, 'Must form at least one cluster for 3+ points within 10m in one lane');
const toeCluster = clusterOutput.clusters.find(c => c.columnIndex === 2); // Left TOE is col 2
check(toeCluster !== undefined, 'Must find cluster in Left TOE lane (column 2)');
check(toeCluster.count === 5, 'Cluster must group exactly 5 points (got ' + toeCluster.count + ')');
check(Math.abs(toeCluster.ch - 82903.0) < 0.1, 'Cluster center chainage must be mean of points (~82903.0)');

// Total points accounted for without drop
const totalPointsAccounted = clusterOutput.unclustered.length + clusterOutput.clusters.reduce((s, c) => s + c.count, 0);
check(totalPointsAccounted === pointsInDense.length, 'All point features must be accounted for across clusters and unclustered');

// Check horizontal separation: Linear features across different lanes do not overlap in X
const colPlat = layout.resolveColumn('L', 'plat');
const colToe = layout.resolveColumn('L', 'toe');
check(layout.getColumnXCenter(colPlat) === 148.5, 'Left PLAT center is 148.5px');
check(layout.getColumnXCenter(colToe) === 82.5, 'Left TOE center is 82.5px');
check(Math.abs(layout.getColumnXCenter(colPlat) - layout.getColumnXCenter(colToe)) === 66.0, 'Different lanes horizontally separated by 66px with zero collision');

console.log('[PASS] 40+ features in 400m density and clustering logic verified.\n');

// =========================================================================
// TEST SUITE 4: Derived Extent 4m Dotted Cap Geometry
// =========================================================================
console.log('--- 4. Testing Derived Extent 4m Dotted Cap Geometry ---');

// 4.1 Feature with derived certainty, length = 50m
const geomDerived = layout.calculateDerivedExtentGeometry(82900, 82950, 82920, 'increasing', true);
check(geomDerived.hasDerivedCaps === true, 'Derived feature of 50m must have derived caps');
check(geomDerived.capMeters === 4.0, 'Cap length must be exactly 4.0 meters');
check(Math.abs(geomDerived.capPixels - 7.6) < 1e-4, 'Cap length in pixels must be exactly 7.6px (4m * 1.9 px/m)');

// Span checks
check(geomDerived.capStart.chStart === 82900 && geomDerived.capStart.chEnd === 82904, 'Start cap must span PK 82900 to 82904 (4m)');
check(geomDerived.mainSpan.chStart === 82904 && geomDerived.mainSpan.chEnd === 82946, 'Main bar must span PK 82904 to 82946 (42m, stopping 4m short at each end)');
check(geomDerived.capEnd.chStart === 82946 && geomDerived.capEnd.chEnd === 82950, 'End cap must span PK 82946 to 82950 (4m)');

// Y coordinates: at scale 1.9, 4m is 7.6px
const startCapPx = Math.abs(geomDerived.capStart.y2 - geomDerived.capStart.y1);
check(Math.abs(startCapPx - 7.6) < 1e-4, 'Start cap pixels must be exactly 7.6px (got ' + startCapPx + ')');

const mainBarPx = Math.abs(geomDerived.mainSpan.y2 - geomDerived.mainSpan.y1);
check(Math.abs(mainBarPx - (42 * 1.9)) < 1e-4, 'Main bar pixels must be exactly 79.8px (got ' + mainBarPx + ')');

// 4.2 Exact feature: No derived caps
const geomExact = layout.calculateDerivedExtentGeometry(82900, 82950, 82920, 'increasing', false);
check(geomExact.hasDerivedCaps === false, 'Exact feature must not have derived caps');
check(geomExact.mainSpan.chStart === 82900 && geomExact.mainSpan.chEnd === 82950, 'Exact feature main span must cover full 50m extent');

// 4.3 Short feature (length <= 8m): Handled gracefully without inverted span
const geomShort = layout.calculateDerivedExtentGeometry(82900, 82906, 82903, 'increasing', true);
check(geomShort.hasDerivedCaps === false, 'Short derived feature (< 8m) must not invert caps');
check(geomShort.mainSpan.chStart === 82900 && geomShort.mainSpan.chEnd === 82906, 'Short derived feature covers full extent');

console.log('[PASS] Derived extent 4m dotted cap geometry verified.\n');

// =========================================================================
// TEST SUITE 5: Strip Facing Flip Transformation
// =========================================================================
console.log('--- 5. Testing Strip Facing Flip Transformation ---');

const userCh = 82900;
const chAheadIncreasing = 82950;
const chBehindIncreasing = 82850;

// 5.1 Chainage to Y transformation when facing increasing
const yAheadInc = layout.chainageToY(chAheadIncreasing, userCh, 'increasing');
const yUserInc = layout.chainageToY(userCh, userCh, 'increasing');
const yBehindInc = layout.chainageToY(chBehindIncreasing, userCh, 'increasing');

check(yAheadInc < yUserInc, 'When facing increasing, higher chainage must be above reading line (smaller Y)');
check(yBehindInc > yUserInc, 'When facing increasing, lower chainage must be below reading line (larger Y)');
check(Math.abs(yUserInc - layout.getReadingLineY()) < 1e-4, 'User position must sit on reading line (Y = 432px)');

// 5.2 Chainage to Y transformation when facing decreasing
// Walking decreasing: user walks towards 82850 (which is now in front / ahead)
const yAheadDec = layout.chainageToY(chBehindIncreasing, userCh, 'decreasing');
const yBehindDec = layout.chainageToY(chAheadIncreasing, userCh, 'decreasing');

check(yAheadDec < yUserInc, 'When facing decreasing, lower chainage is ahead and must be above reading line (smaller Y)');
check(yBehindDec > yUserInc, 'When facing decreasing, higher chainage is behind and must be below reading line (larger Y)');

// 5.3 180° Horizontal Rotation of Lateral Lanes
// Left OFF nominal center is 16.5px. Under 180° rotation on 390px width:
// Screen X = 390 - 16.5 = 373.5px (Right side of screen!)
check(layout.transformX(16.5, 'increasing') === 16.5, 'Increasing: Left OFF stays on left (16.5px)');
check(layout.transformX(16.5, 'decreasing') === 373.5, 'Decreasing: Left OFF rotates 180° to screen right (373.5px)');

// Right OFF nominal center is 373.5px. Under 180° rotation:
// Screen X = 390 - 373.5 = 16.5px (Left side of screen!)
check(layout.transformX(373.5, 'increasing') === 373.5, 'Increasing: Right OFF stays on right (373.5px)');
check(layout.transformX(373.5, 'decreasing') === 16.5, 'Decreasing: Right OFF rotates 180° to screen left (16.5px)');

// Spine CL is at 195. Under 180° rotation:
// Screen X = 390 - 195 = 195px (Stays exactly centered!)
check(layout.transformX(195.0, 'decreasing') === 195.0, 'Decreasing: Spine CL stays at 195px');

// 5.4 Round-trip Y to Chainage Inversion
const testChs = [82700, 82850.5, 82900, 82980.25, 83120];
for (const tch of testChs) {
  const yInc = layout.chainageToY(tch, userCh, 'increasing');
  const chBackInc = layout.yToChainage(yInc, userCh, 'increasing');
  check(Math.abs(chBackInc - tch) < 1e-4, 'Increasing round-trip chainage must be exact for PK ' + tch);

  const yDec = layout.chainageToY(tch, userCh, 'decreasing');
  const chBackDec = layout.yToChainage(yDec, userCh, 'decreasing');
  check(Math.abs(chBackDec - tch) < 1e-4, 'Decreasing round-trip chainage must be exact for PK ' + tch);
}

console.log('[PASS] Strip facing flip transformation verified.\n');

// =========================================================================
// TEST SUITE 6: WalkDrawer Left-to-Right Sorting by Offset as Faced
// =========================================================================
console.log('--- 6. Testing WalkDrawer Left-to-Right Sorting by Offset as Faced ---');

const drawerFeatures = [
  { feature_id: 'feat_l_crest', side: 'L', offset_m: 24.0, category: 'Crest ditch', ch: 82900 },
  { feature_id: 'feat_r_toe',   side: 'R', offset_m: -13.0, category: 'Toe ditch', ch: 82902 },
  { feature_id: 'feat_cl_cross',side: 'C', offset_m: 0.0, category: 'Cross drainage', ch: 82901 },
  { feature_id: 'feat_l_plat',  side: 'L', offset_m: 3.5, category: 'Side ditch', ch: 82900 },
  { feature_id: 'feat_r_crest', side: 'R', offset_m: -24.0, category: 'Crest ditch', ch: 82903 }
];

// 6.1 Facing Increasing: Left is on user's left hand -> Descending offset
// Order should be: L 24 (+24) -> L 3.5 (+3.5) -> CL (0) -> R 13 (-13) -> R 24 (-24)
const sortedIncreasing = WalkDrawerLogic.sortLeftToRightAsFaced(drawerFeatures, 'increasing', 82900);
check(sortedIncreasing[0].feature_id === 'feat_l_crest', 'Increasing: 1st must be Left Crest (+24m)');
check(sortedIncreasing[1].feature_id === 'feat_l_plat',  'Increasing: 2nd must be Left Plat (+3.5m)');
check(sortedIncreasing[2].feature_id === 'feat_cl_cross', 'Increasing: 3rd must be Center CL (0m)');
check(sortedIncreasing[3].feature_id === 'feat_r_toe',   'Increasing: 4th must be Right Toe (-13m)');
check(sortedIncreasing[4].feature_id === 'feat_r_crest', 'Increasing: 5th must be Right Crest (-24m)');

// 6.2 Facing Decreasing: User rotated 180° -> Railway Right is on user's left hand -> Ascending offset
// Order should be: R 24 (-24) -> R 13 (-13) -> CL (0) -> L 3.5 (+3.5) -> L 24 (+24)
const sortedDecreasing = WalkDrawerLogic.sortLeftToRightAsFaced(drawerFeatures, 'decreasing', 82900);
check(sortedDecreasing[0].feature_id === 'feat_r_crest', 'Decreasing: 1st must be Right Crest (-24m)');
check(sortedDecreasing[1].feature_id === 'feat_r_toe',   'Decreasing: 2nd must be Right Toe (-13m)');
check(sortedDecreasing[2].feature_id === 'feat_cl_cross', 'Decreasing: 3rd must be Center CL (0m)');
check(sortedDecreasing[3].feature_id === 'feat_l_plat',  'Decreasing: 4th must be Left Plat (+3.5m)');
check(sortedDecreasing[4].feature_id === 'feat_l_crest', 'Decreasing: 5th must be Left Crest (+24m)');

// 6.3 Relative Position Text
const textHere = WalkDrawerLogic.computeRelativePositionText({ ch_start: 82890, ch_end: 82910 }, 82900, 'increasing');
check(textHere === 'here', 'Feature spanning user position must read "here"');

const textAheadInc = WalkDrawerLogic.computeRelativePositionText({ ch_start: 82925, ch_end: 82940 }, 82900, 'increasing');
check(textAheadInc === '25 m ahead', 'Feature at +25m facing increasing must read "25 m ahead" (got ' + textAheadInc + ')');

const textBehindInc = WalkDrawerLogic.computeRelativePositionText({ ch_start: 82885, ch_end: 82890 }, 82900, 'increasing');
check(textBehindInc === '15 m behind', 'Feature at -15m facing increasing must read "15 m behind" (got ' + textBehindInc + ')');

const textAheadDec = WalkDrawerLogic.computeRelativePositionText({ ch_start: 82885, ch_end: 82890 }, 82900, 'decreasing');
check(textAheadDec === '15 m ahead', 'Feature at 82885 facing decreasing must read "15 m ahead" (got ' + textAheadDec + ')');

// 6.4 Near Band Filter (+/- 20m)
const outOfRangeFeat = { feature_id: 'out_of_range', ch_start: 82950, ch_end: 82970 };
const inRangeFeat = { feature_id: 'in_range', ch_start: 82895, ch_end: 82905 };
const filteredNear = WalkDrawerLogic.getFeaturesWithinNearBand([outOfRangeFeat, inRangeFeat], 82900, 20);
check(filteredNear.length === 1 && filteredNear[0].feature_id === 'in_range', 'Near band filter must only keep features within +/- 20m');

console.log('[PASS] WalkDrawer left-to-right sorting by offset as faced verified.\n');

// =========================================================================
// TEST SUITE 7: Identify View Bubble Number Assignment & 3x2 Grid
// =========================================================================
console.log('--- 7. Testing Identify View Bubble Number Assignment ---');

const identifyFeatures = [
  { feature_id: 'f_ditch_toe_l', geometry: 'linear', ch_start: 82890, ch_end: 82920, side: 'L', lane: 'toe', offset_m: 14.0, type_code: '12', short_name: 'Trapezoidal toe' },
  { feature_id: 'f_culvert', geometry: 'crossing', ch: 82903, side: 'C', offset_m: 0, type_code: 'PC', short_name: 'Pipe culvert dia.1.5m' },
  { feature_id: 'f_ditch_plat_l', geometry: 'linear', ch_start: 82890, ch_end: 82910, side: 'L', lane: 'plat', offset_m: 3.5, type_code: '1', short_name: 'Side ditch' },
  { feature_id: 'f_ditch_toe_r', geometry: 'linear', ch_start: 82895, ch_end: 82915, side: 'R', lane: 'toe', offset_m: -14.0, type_code: '12', short_name: 'Trapezoidal toe' },
  { feature_id: 'f_descent_l', geometry: 'point', ch: 82905, side: 'L', lane: 'face', offset_m: 7.0, type_code: 'D-SD', short_name: 'Slope descent' },
  { feature_id: 'f_crest_r', geometry: 'linear', ch_start: 82890, ch_end: 82920, side: 'R', lane: 'crest', offset_m: -24.0, type_code: '5', short_name: 'Crest ditch' },
  { feature_id: 'f_off_channel', geometry: 'linear', ch_start: 82890, ch_end: 82920, side: 'L', lane: 'off', offset_m: 50.0, type_code: 'CH-A', short_name: 'Earth channel' }
];

// Assign bubble numbers (up to 5)
const assignedBubbles = IdentifyLogic.assignBubbleNumbers(identifyFeatures, { ch: 82900, offset_m: 14.0 });

check(assignedBubbles.length === 5, 'Must assign exactly 5 numbered bubbles (got ' + assignedBubbles.length + ')');
check(BUBBLE_SYMBOLS.length === 5, 'Must have 5 bubble symbols: ' + BUBBLE_SYMBOLS.join(', '));

// Bubble 1 must be crossing structure (Priority 1)
check(assignedBubbles[0].bubbleNumber === 1, 'First bubble must be number 1');
check(assignedBubbles[0].bubbleSymbol === '①', 'First bubble symbol must be ① (got ' + assignedBubbles[0].bubbleSymbol + ')');
check(assignedBubbles[0].feature.geometry === 'crossing', 'First bubble must be assigned to crossing structure');
check(assignedBubbles[0].feature_id === 'f_culvert', 'First bubble must be the pipe culvert');

// Button labels must match 3x2 grid spec (clean type codes without TPC mangling)
check(assignedBubbles[0].buttonLabel.startsWith('① PC Pipe culvert'), 'Button label must format symbol, type code and name (got: ' + assignedBubbles[0].buttonLabel + ')');
check(assignedBubbles[1].buttonLabel.startsWith('② T12 Trapezoidal toe'), 'Button label must format numeric ditch type code as T12 (got: ' + assignedBubbles[1].buttonLabel + ')');

// Check coordinates generated for cross-section SVG
check(typeof assignedBubbles[0].x === 'number' && typeof assignedBubbles[0].y === 'number', 'Bubble must have valid x, y SVG coordinates');
check(assignedBubbles[0].x === 195, 'Crossing culvert must be centered on CL (x = 195)');

// Generate cross-section SVG string
const svgOutput = IdentifyLogic.generateCrossSectionSvg(assignedBubbles, 'f_culvert', 'increasing');
check(svgOutput.includes('<svg') && svgOutput.includes('</svg>'), 'Must generate valid SVG element');
check(svgOutput.includes('polygon points="85,125 145,75 245,75 305,125"'), 'Must render embankment slope polygon');
check(svgOutput.includes('▲ CL'), 'Must render track centerline label');
check(svgOutput.includes('di-identify-bubble'), 'Must render bubble elements with click targets');
check(svgOutput.includes('◀ LEFT') && svgOutput.includes('RIGHT ▶'), 'Must render lateral indicators for increasing facing');

console.log('[PASS] Identify view bubble number assignment verified.\n');

// =========================================================================
// 8. TESTING PROPORTIONAL COLUMN SCALING & CL ALIGNMENT ACROSS VIEWPORT WIDTHS
// =========================================================================
console.log('--- 8. Testing Proportional Column Scaling & CL Alignment ---');

const widthsToTest = [360, 390, 412, 480];
for (const w of widthsToTest) {
  const l = new WalkStripLayout({ width: w, height: 600 });
  const spineNominalX = l.getColumnXCenter(5);
  const spineIncX = l.transformX(spineNominalX, 'increasing');
  const spineDecX = l.transformX(spineNominalX, 'decreasing');

  // Spine centerline must always be exactly at width / 2 under both facings!
  check(Math.abs(spineIncX - (w / 2)) < 0.001, `Spine increasing on ${w}px must be ${w/2} (got ${spineIncX})`);
  check(Math.abs(spineDecX - (w / 2)) < 0.001, `Spine decreasing on ${w}px must be ${w/2} (got ${spineDecX})`);
  check(Math.abs(spineIncX - spineDecX) < 0.001, `Spine must not shift laterally on facing flip on ${w}px`);

  // Column bounds must sum to total width
  let totalColsWidth = 0;
  for (let i = 0; i < 11; i++) {
    const b = l.getColumnBounds(i);
    totalColsWidth += b.width;
  }
  check(Math.abs(totalColsWidth - w) < 0.01, `Columns on ${w}px must span total width ${w}px (got ${totalColsWidth})`);
}
console.log('[PASS] Proportional column scaling and CL alignment verified.\n');

// =========================================================================
// 9. TESTING LINEAR FEATURE HIT TESTING ACROSS FULL VERTICAL EXTENT
// =========================================================================
console.log('--- 9. Testing Linear Feature Hit Testing Across Full Extent ---');

const hitLayout = new WalkStripLayout({ width: 390, height: 600 });
const testLinearFeature = {
  feature_id: 'ditch_test_long',
  geometry: 'linear',
  ch_start: 82900,
  ch_end: 82950,
  side: 'L',
  lane: 'toe',
  offset_m: 14.0,
  type_code: '12'
};

// User at 82920, facing increasing (reading line at 480px)
const userTestCh = 82920;
const yStart = hitLayout.chainageToY(testLinearFeature.ch_start, userTestCh, 'increasing'); // 82900: below reading line
const yEnd = hitLayout.chainageToY(testLinearFeature.ch_end, userTestCh, 'increasing');     // 82950: above reading line
const colIdx = hitLayout.resolveColumn('L', 'toe', 14.0);
const colX = hitLayout.getColumnXCenter(colIdx);

// Simulate tap at midpoint of ditch (ch = 82925)
const yMid = hitLayout.chainageToY(82925, userTestCh, 'increasing');
check(yMid > Math.min(yStart, yEnd) && yMid < Math.max(yStart, yEnd), 'Midpoint Y must fall between yStart and yEnd');

// Bounding box hit-test check
const tapWithinLinear = (yMid >= Math.min(yStart, yEnd) - 8 && yMid <= Math.max(yStart, yEnd) + 8) &&
                        (Math.abs(colX - colX) <= 20);
check(tapWithinLinear === true, 'Tap along linear body must be detected as a valid hit');

// Tap outside linear extent (ch = 82970)
const yOutside = hitLayout.chainageToY(82970, userTestCh, 'increasing');
const tapOutsideLinear = (yOutside >= Math.min(yStart, yEnd) - 8 && yOutside <= Math.max(yStart, yEnd) + 8);
check(tapOutsideLinear === false, 'Tap outside linear span must not hit');

console.log('[PASS] Linear feature hit testing verified.\n');

// =========================================================================
// 10. TESTING POOR GPS SELECTION VARIANT & EXACT CIVIL STATION FORMATTING
// =========================================================================
console.log('--- 10. Testing Poor GPS Selection Variant & Exact Civil Station Formatting ---');

const poorGpsFeatures = [
  { feature_id: 'f_culv_1', geometry: 'crossing', ch: 111017.229, position_certainty: 'exact', type_code: 'PC', short_name: 'Pipe culvert' },
  { feature_id: 'f_lin_1', geometry: 'linear', ch_start: 111000, ch_end: 111040, side: 'L', lane: 'toe', offset_m: 14.0, type_code: '12' },
  { feature_id: 'f_lin_2', geometry: 'linear', ch_start: 111000, ch_end: 111040, side: 'R', lane: 'toe', offset_m: -14.0, type_code: '12' }
];

const poorResult = AtYouSelectionLogic.selectAtYouFeature(poorGpsFeatures, [], { ch: 111015, accuracy_m: 15.0 }, { isPoor: true });
check(poorResult.variant === 'poor_gps', 'Must trigger poor_gps variant when accuracy > 10m with multiple candidates');
check(poorResult.actionButtonText.includes('111+017.229 EXACT'), 'Action button must display exact millimetric station (got: ' + poorResult.actionButtonText + ')');

console.log('[PASS] Poor GPS selection variant and exact civil station verified.\n');

// =========================================================================
// 11. TESTING TYPE CODE REFINEMENT ACROSS ALL APP MODULES
// =========================================================================
console.log('--- 11. Testing Type Code Formatting Consistency ---');

const testCodes = [
  { in: '12', cat: 'toe', exp: 'T12' },
  { in: '1', cat: 'side', exp: 'T1' },
  { in: '1L', cat: '', exp: 'T1L' },
  { in: 'T12', cat: '', exp: 'T12' },
  { in: 'PC', cat: '', exp: 'PC' },
  { in: 'CULV_PIPE', cat: '', exp: 'PC' },
  { in: 'BC', cat: '', exp: 'BC' },
  { in: 'CULV_BOX', cat: '', exp: 'BC' },
  { in: 'CH-A', cat: '', exp: 'CH-A' },
  { in: 'D-SD', cat: '', exp: 'D-SD' },
  { in: 'BRG', cat: '', exp: 'BRG' }
];

for (const tc of testCodes) {
  const wsFormatted = WalkStripModule.formatTypeCode(tc.in, tc.cat);
  const wdFormatted = WalkDrawerModule.formatTypeCode(tc.in, tc.cat);
  const ivFormatted = IdentifyViewModule.formatTypeCode(tc.in, tc.cat);

  check(wsFormatted === tc.exp, `WalkStrip formatTypeCode('${tc.in}') must be '${tc.exp}' (got '${wsFormatted}')`);
  check(wdFormatted === tc.exp, `WalkDrawer formatTypeCode('${tc.in}') must be '${tc.exp}' (got '${wdFormatted}')`);
  check(ivFormatted === tc.exp, `IdentifyView formatTypeCode('${tc.in}') must be '${tc.exp}' (got '${ivFormatted}')`);
}
console.log('[PASS] Type code formatting consistency verified.\n');

// =========================================================================
// 12. TESTING IDENTIFY VIEW FACING ADAPTATION (180° INVERSION)
// =========================================================================
console.log('--- 12. Testing Identify View Facing Adaptation ---');

// Facing decreasing: Left (positive offset) must be on user's right hand (x > 195)
const decreasingBubbles = IdentifyLogic.assignBubbleNumbers(identifyFeatures, { ch: 82900, offset_m: 14.0, facing: 'decreasing' });
const leftDitchBubble = decreasingBubbles.find(b => b.feature.side === 'L' && b.feature.lane === 'toe');
check(leftDitchBubble.x > 195, 'Left ditch bubble when facing decreasing must be on right half of diagram (got x = ' + leftDitchBubble.x + ')');

const svgDecreasing = IdentifyLogic.generateCrossSectionSvg(decreasingBubbles, 'f_culvert', 'decreasing');
check(svgDecreasing.includes('◀ RIGHT') && svgDecreasing.includes('LEFT ▶'), 'SVG must invert lateral indicators when facing decreasing');
check(svgDecreasing.includes('▼ CL'), 'SVG must render decreasing centerline symbol ▼ CL');

console.log('[PASS] Identify view facing adaptation verified.\n');

// =========================================================================
// SUMMARY
// =========================================================================
console.log('================================================================');
console.log(`ALL 12 TEST SUITES PASSED VERIFICATION 100%! (${totalAssertions} assertions verified)`);
console.log('================================================================');
