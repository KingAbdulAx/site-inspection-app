/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Linear Referencing Position Engine Test Suite (§5 & §10 Master Spec)
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const APP_DIR = path.resolve(__dirname, '..');
const {
  PositionEngine,
  AlignmentCalibration,
  formatPk,
  parsePk,
  wgs84Distance,
  calculateBearing,
  angularDifference
} = require(path.join(APP_DIR, 'position_engine.js'));

console.log('================================================================');
console.log('KMD DRAINAGE INSPECTOR - PHASE 3 POSITION ENGINE TEST SUITE');
console.log('================================================================\n');

let passedAssertions = 0;
function check(condition, message) {
  assert(condition, message);
  passedAssertions++;
}

// -----------------------------------------------------------------------------
// SUITE 1: Straight Line Projections (Orthogonal Distance, Progression, Sign)
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Straight Line Projections ---');

// Create a synthetic straight track alignment heading North from PK 0+000 to PK 2+000
// At latitude 12.0 deg N, longitude 8.5 deg E
// Scale: 1 deg lat is approx 110574m, so 2000m is approx 0.0180878 deg lat
const lat0 = 12.000000;
const lon0 = 8.500000;
const lat1 = 12.004522; // 500m North
const lat2 = 12.009044; // 1000m North
const lat3 = 12.013566; // 1500m North
const lat4 = 12.018088; // 2000m North

const straightStations = [
  { pk: 0, label: 'PK 0+000', lon: lon0, lat: lat0 },
  { pk: 500, label: 'PK 0+500', lon: lon0, lat: lat1 },
  { pk: 1000, label: 'PK 1+000', lon: lon0, lat: lat2 },
  { pk: 1500, label: 'PK 1+500', lon: lon0, lat: lat3 },
  { pk: 2000, label: 'PK 2+000', lon: lon0, lat: lat4 }
];

const straightAlign = new AlignmentCalibration({
  lineId: 'line_straight',
  name: 'Synthetic Straight Track',
  stations: straightStations
});

const straightEngine = new PositionEngine({
  alignments: [straightAlign],
  activeLineId: 'line_straight'
});

// Test 1.1: Point exactly on centerline at PK 750
const midLat = (lat1 + lat2) / 2.0;
const projOnCenterline = straightEngine.projectGps({ lat: midLat, lon: lon0, accuracy: 4.0 });
check(projOnCenterline !== null, 'Projection on centerline must return result');
check(Math.abs(projOnCenterline.ch - 750.0) < 0.5, `Chainage at midpoint should be ~750m, got ${projOnCenterline.ch}`);
check(Math.abs(projOnCenterline.offset_m) < 0.05, `Offset on centerline must be 0m, got ${projOnCenterline.offset_m}`);
check(projOnCenterline.side === 'C', `Side on centerline must be 'C', got ${projOnCenterline.side}`);

// Test 1.2: Chainage progression along track
const fix0 = straightEngine.projectGps({ lat: lat0, lon: lon0, accuracy: 3.0 });
const fix500 = straightEngine.projectGps({ lat: lat1, lon: lon0, accuracy: 3.0 });
const fix1000 = straightEngine.projectGps({ lat: lat2, lon: lon0, accuracy: 3.0 });
const fix2000 = straightEngine.projectGps({ lat: lat4, lon: lon0, accuracy: 3.0 });

check(Math.abs(fix0.ch - 0.0) < 0.1, `Datum chainage must be 0, got ${fix0.ch}`);
check(Math.abs(fix500.ch - 500.0) < 0.5, `PK 0+500 chainage must be ~500, got ${fix500.ch}`);
check(Math.abs(fix1000.ch - 1000.0) < 0.5, `PK 1+000 chainage must be ~1000, got ${fix1000.ch}`);
check(Math.abs(fix2000.ch - 2000.0) < 0.5, `PK 2+000 chainage must be ~2000, got ${fix2000.ch}`);
check(fix0.ch < fix500.ch && fix500.ch < fix1000.ch && fix1000.ch < fix2000.ch, 'Chainage must strictly increase along polyline progression');

// Test 1.3: Orthogonal displacement distance (15m offset)
// Track bearing is ~0 deg North. West is Left (offset > 0), East is Right (offset < 0).
const ptLeft15m = straightEngine.projectChainageOffsetToGps('line_straight', 750, 15.0);
const ptRight15m = straightEngine.projectChainageOffsetToGps('line_straight', 750, -15.0);

const resLeft = straightEngine.projectGps({ lat: ptLeft15m.lat, lon: ptLeft15m.lon, accuracy: 4.0 });
const resRight = straightEngine.projectGps({ lat: ptRight15m.lat, lon: ptRight15m.lon, accuracy: 4.0 });

check(Math.abs(resLeft.offset_m - 15.0) < 0.05, `Left offset should be +15.0m, got ${resLeft.offset_m}`);
check(resLeft.side === 'L', `Left point side must be 'L', got ${resLeft.side}`);
check(Math.abs(resRight.offset_m - (-15.0)) < 0.05, `Right offset should be -15.0m, got ${resRight.offset_m}`);
check(resRight.side === 'R', `Right point side must be 'R', got ${resRight.side}`);
check(Math.abs(resLeft.ch - 750.0) < 0.5, 'Perpendicular offset must not perturb along-track chainage');
check(Math.abs(resRight.ch - 750.0) < 0.5, 'Perpendicular offset must not perturb along-track chainage');

console.log('[PASS] Straight line projections verified.\n');

// -----------------------------------------------------------------------------
// SUITE 2: Circular Arc / Curved Track Projections
// -----------------------------------------------------------------------------
console.log('--- 2. Testing Circular Arc / Curved Track Projections ---');

// Build a 90-degree circular curve with radius R = 1000m turning from East (bearing 90) to North (bearing 0)
// Arc center at (lat_center, lon_center)
// Points sampled along the arc every 100m from PK 0+000 to PK 1+570.8 (approx Pi/2 * 1000m)
const arcRadiusM = 1000.0;
const centerLat = 12.0;
const centerLon = 8.5;

// Radii at centerLat
const mLatRad = (12.0 * Math.PI) / 180.0;
const scaleNorth = 111132.92 - 559.82 * Math.cos(2 * mLatRad);
const scaleEast = 111412.84 * Math.cos(mLatRad);

const curveStations = [];
const arcTotalLengthM = (Math.PI / 2.0) * arcRadiusM; // ~1570.796m
const numStations = 17; // every ~100m
for (let i = 0; i < numStations; i++) {
  const fraction = i / (numStations - 1);
  const pk = fraction * arcTotalLengthM;
  // Angle theta sweeps from -PI/2 (South of center, pointing East) to 0 (East of center, pointing North)
  // Curve center at (0, 0). Track starts at (0, -R) heading East, curves CCW to (R, 0) heading North.
  const angle = -Math.PI / 2.0 + fraction * (Math.PI / 2.0);
  const xM = arcRadiusM * Math.cos(angle);
  const yM = arcRadiusM * Math.sin(angle);

  const lon = centerLon + xM / scaleEast;
  const lat = centerLat + yM / scaleNorth;

  curveStations.push({
    pk: pk,
    label: `PK ${Math.round(pk)}`,
    lon: lon,
    lat: lat
  });
}

const curveAlign = new AlignmentCalibration({
  lineId: 'line_curve',
  name: 'Synthetic 1000m Radius Curve',
  stations: curveStations
});

const curveEngine = new PositionEngine({
  alignments: [curveAlign],
  activeLineId: 'line_curve'
});

// Test 2.1: Project point on curve at 45 degrees (halfway along arc)
const midAngle = -Math.PI / 4.0;
const midX = arcRadiusM * Math.cos(midAngle);
const midY = arcRadiusM * Math.sin(midAngle);
const ptCurveMid = {
  lon: centerLon + midX / scaleEast,
  lat: centerLat + midY / scaleNorth,
  accuracy: 3.0
};
const resCurveMid = curveEngine.projectGps(ptCurveMid);
const expectedMidPk = arcTotalLengthM / 2.0;
check(Math.abs(resCurveMid.ch - expectedMidPk) < 5.0, `Mid-curve chainage should be ~${expectedMidPk.toFixed(1)}m, got ${resCurveMid.ch.toFixed(1)}m`);
check(Math.abs(resCurveMid.offset_m) < 0.1, `On-curve offset should be ~0m, got ${resCurveMid.offset_m.toFixed(2)}m`);
check(resCurveMid.side === 'C', `On-curve side should be 'C', got ${resCurveMid.side}`);

// Test 2.2: Point outside curve (radius = R + 20m).
// Since track turns left (CCW) towards North, the inside of the curve (towards center) is LEFT.
// The outside of the curve (away from center) is RIGHT.
// Let's verify: Vector v points CCW. Center is to the left of travel.
// Point at radius R - 25m (inside): should be Left (offset > 0, side 'L')
const inX = (arcRadiusM - 25.0) * Math.cos(midAngle);
const inY = (arcRadiusM - 25.0) * Math.sin(midAngle);
const ptInside = {
  lon: centerLon + inX / scaleEast,
  lat: centerLat + inY / scaleNorth,
  accuracy: 3.0
};
const resInside = curveEngine.projectGps(ptInside);
check(resInside.side === 'L', `Inside of CCW curve must be Left ('L'), got ${resInside.side}`);
check(Math.abs(resInside.offset_m - 25.0) < 1.0, `Inside offset should be +25m, got ${resInside.offset_m.toFixed(2)}m`);

// Point at radius R + 25m (outside): should be Right (offset < 0, side 'R')
const outX = (arcRadiusM + 25.0) * Math.cos(midAngle);
const outY = (arcRadiusM + 25.0) * Math.sin(midAngle);
const ptOutside = {
  lon: centerLon + outX / scaleEast,
  lat: centerLat + outY / scaleNorth,
  accuracy: 3.0
};
const resOutside = curveEngine.projectGps(ptOutside);
check(resOutside.side === 'R', `Outside of CCW curve must be Right ('R'), got ${resOutside.side}`);
check(Math.abs(resOutside.offset_m - (-25.0)) < 1.0, `Outside offset should be -25m, got ${resOutside.offset_m.toFixed(2)}m`);

console.log('[PASS] Circular arc projections verified.\n');

// -----------------------------------------------------------------------------
// SUITE 3: Piecewise 500m Station Calibration and Residual Calculation
// -----------------------------------------------------------------------------
console.log('--- 3. Testing Piecewise 500m Station Calibration & Residuals ---');

// Load full default engine with real KMD.kml surveyed stations
const engine = new PositionEngine();
const kmStats = engine.getCalibrationStats('line_km');
const kdStats = engine.getCalibrationStats('line_kd');

check(kmStats !== null, 'Kano-Maradi calibration stats must exist');
check(kdStats !== null, 'Kano-Dutse calibration stats must exist');
check(kmStats.checkedPoints === 570, `Kano-Maradi must check exactly 570 surveyed stations, got ${kmStats.checkedPoints}`);
check(kdStats.checkedPoints === 216, `Kano-Dutse must check exactly 216 surveyed stations, got ${kdStats.checkedPoints}`);

console.log(`   Kano-Maradi: Checked ${kmStats.checkedPoints} stations across ${kmStats.totalDesignLengthM}m stated alignment.`);
console.log(`   Kano-Maradi worst segment residual: ${kmStats.maxResidualM}m at station ${kmStats.worstStation}`);
console.log(`   Kano-Dutse: Checked ${kdStats.checkedPoints} stations across ${kdStats.totalDesignLengthM}m stated alignment.`);
console.log(`   Kano-Dutse worst segment residual: ${kdStats.maxResidualM}m at station ${kdStats.worstStation}`);

check(typeof kmStats.maxResidualM === 'number' && kmStats.maxResidualM > 0, 'Worst residual must be a positive number');
check(typeof kmStats.worstStation === 'string' && kmStats.worstStation.length > 0, 'Worst station label must be populated');
check(kmStats.residuals.length === 569, 'Kano-Maradi must record residuals for 569 segments');

// Test that every surveyed 500m station projects to its exact design chainage (0 error)
const kmAlign = engine.getAlignment('line_km');
const samplePks = [0, 500, 19800, 50000, 82902, 124500, 200000, 284500];
for (const testPk of samplePks) {
  // Find nearest station
  let nearestStation = kmAlign.stations[0];
  let minDiff = Infinity;
  for (const st of kmAlign.stations) {
    const diff = Math.abs(st.pk - testPk);
    if (diff < minDiff) {
      minDiff = diff;
      nearestStation = st;
    }
  }

  const proj = engine.projectGps({ lat: nearestStation.lat, lon: nearestStation.lon, accuracy: 2.0 });
  const err = Math.abs(proj.ch - nearestStation.pk);
  check(err < 0.05, `Surveyed station ${nearestStation.label} must project to exact PK (err: ${err.toFixed(4)}m)`);
  check(Math.abs(proj.offset_m) < 0.05, `Surveyed station ${nearestStation.label} must project to 0 offset on centerline`);
}

console.log('[PASS] Piecewise 500m station calibration and residuals verified.\n');

// -----------------------------------------------------------------------------
// SUITE 4: Side Sign Convention (Left > 0, Right < 0, Center = 0)
// -----------------------------------------------------------------------------
console.log('--- 4. Testing Side Sign Convention ---');

// Test at PK 84+406 (Section 03 near Kazaure)
// Track bearing is ~317 deg (NW).
// Left is facing increasing chainage: a 90 deg CCW turn from 317 deg is ~227 deg (SW).
// Right is a 90 deg CW turn: ~47 deg (NE).
const baseCh = 84406.0;
const clPt = engine.projectChainageOffsetToGps('line_km', baseCh, 0);
const leftPt = engine.projectChainageOffsetToGps('line_km', baseCh, 12.0);
const rightPt = engine.projectChainageOffsetToGps('line_km', baseCh, -12.0);

const projCl = engine.projectGps({ lat: clPt.lat, lon: clPt.lon, accuracy: 3.0 });
const projLeft = engine.projectGps({ lat: leftPt.lat, lon: leftPt.lon, accuracy: 3.0 });
const projRight = engine.projectGps({ lat: rightPt.lat, lon: rightPt.lon, accuracy: 3.0 });

check(projCl.side === 'C', `Centerline side must be 'C', got ${projCl.side}`);
check(projCl.offset_m === 0, `Centerline offset must be 0m, got ${projCl.offset_m}`);

check(projLeft.side === 'L', `Left side must be 'L', got ${projLeft.side}`);
check(projLeft.offset_m > 0, `Left offset must be strictly positive (>0), got ${projLeft.offset_m}`);
check(Math.abs(projLeft.offset_m - 12.0) < 0.01, `Left offset magnitude must be 12.0m, got ${projLeft.offset_m}`);

check(projRight.side === 'R', `Right side must be 'R', got ${projRight.side}`);
check(projRight.offset_m < 0, `Right offset must be strictly negative (<0), got ${projRight.offset_m}`);
check(Math.abs(projRight.offset_m - (-12.0)) < 0.01, `Right offset magnitude must be -12.0m, got ${projRight.offset_m}`);

console.log('[PASS] Side sign convention verified.\n');

// -----------------------------------------------------------------------------
// SUITE 5: Dual-Line Disambiguation & Line-Stickiness Hysteresis
// -----------------------------------------------------------------------------
console.log('--- 5. Testing Dual-Line Disambiguation & Line-Stickiness Hysteresis ---');

// Kano Central datum area where both Kano-Maradi (line_km) and Kano-Dutse (line_kd) overlap
// Station 0+000:
// line_km: lon 8.4492815, lat 11.9237733
// line_kd: lon 8.4494019, lat 11.9240475
// Let's create an engine with default 25m hysteresis
const multiEngine = new PositionEngine({ hysteresisThresholdM: 25.0 });

// Point 1: 5m from line_km, 35m from line_kd
const ptNearKm = multiEngine.projectChainageOffsetToGps('line_km', 1000, 5.0);
const fix1 = multiEngine.projectGps({ lat: ptNearKm.lat, lon: ptNearKm.lon, accuracy: 3.0 });
check(fix1.line === 'line_km', `Should lock onto line_km when closer to it (got ${fix1.line})`);
check(multiEngine.getActiveLine() === 'line_km', 'Active line should be line_km');

// Point 2: User moves slightly towards line_kd near junction, but only 10m closer to line_kd.
// Hysteresis requires 25m delta to switch lines!
const fix2 = multiEngine.projectGps({
  lat: ptNearKm.lat + 0.0001,
  lon: ptNearKm.lon + 0.0001,
  accuracy: 3.0
});
// Should stick to line_km because difference does not exceed 25m hysteresis threshold
check(fix2.line === 'line_km', `Should maintain line stickiness (hysteresis) on line_km (got ${fix2.line})`);

// Point 3: User walks firmly onto Kano-Dutse branch (5m from line_kd, >50m from line_km)
const ptNearKd = multiEngine.projectChainageOffsetToGps('line_kd', 1500, 3.0);
const fix3 = multiEngine.projectGps({ lat: ptNearKd.lat, lon: ptNearKd.lon, accuracy: 3.0 });
check(fix3.line === 'line_kd', `Should switch to line_kd when >25m closer to it (got ${fix3.line})`);
check(multiEngine.getActiveLine() === 'line_kd', 'Active line should now be line_kd');

// Point 4: Chainage alone never resolves line. At PK 1000 on line_kd, it must stay line_kd
const ptNearKdPk1000 = multiEngine.projectChainageOffsetToGps('line_kd', 1000, 2.0);
const fix4 = multiEngine.projectGps({ lat: ptNearKdPk1000.lat, lon: ptNearKdPk1000.lon, accuracy: 3.0 });
check(fix4.line === 'line_kd', `Must stay on line_kd by lateral distance, never by chainage alone (got ${fix4.line})`);

console.log('[PASS] Dual-line disambiguation and line-stickiness verified.\n');

// -----------------------------------------------------------------------------
// SUITE 6: GPS Accuracy Tiers (Good <= 10m, Poor > 10m with '≈' & Side Withheld, None)
// -----------------------------------------------------------------------------
console.log('--- 6. Testing GPS Accuracy Tiers ---');

// Test Tier 1: Good GPS (<= 10m)
const fixGood = engine.projectGps({ lat: clPt.lat, lon: leftPt.lon, accuracy: 4.5 });
check(fixGood.tier === 'good', `Tier must be 'good' when accuracy <= 10m, got ${fixGood.tier}`);
check(fixGood.side === 'L', `Side must be shown normally ('L') under good GPS, got ${fixGood.side}`);
check(!fixGood.chFormatted.startsWith('≈'), `Chainage formatted must not contain '≈' under good GPS, got ${fixGood.chFormatted}`);
check(fixGood.status === 'good', `Status must be 'good', got ${fixGood.status}`);

// Test Tier 2: Poor GPS (> 10m)
// Master Spec §5.5: "Poor (> 10 m): prefix the chainage with '≈', withhold the side ('SIDE ?'), switch the reading line to a band of ±accuracy, and offer 'fix on an exact point'."
const fixPoor = engine.projectGps({ lat: clPt.lat, lon: leftPt.lon, accuracy: 18.0 });
check(fixPoor.tier === 'poor', `Tier must be 'poor' when accuracy > 10m, got ${fixPoor.tier}`);
check(fixPoor.side === '?', `Side must be withheld as '?' under poor GPS, got ${fixPoor.side}`);
check(fixPoor.chFormatted.startsWith('≈'), `Chainage formatted must be prefixed with '≈', got ${fixPoor.chFormatted}`);
check(fixPoor.status === 'poor_accuracy', `Status must be 'poor_accuracy', got ${fixPoor.status}`);

// Test Tier 3: None / Manual mode
const manualPos = engine.setManualPosition({ line: 'line_km', ch: 84200, side: 'L' });
check(manualPos.tier === 'none', `Tier must be 'none' for manual position, got ${manualPos.tier}`);
check(manualPos.source === 'hand', `Source must be 'hand' for manual position, got ${manualPos.source}`);
check(manualPos.status === 'manual', `Status must be 'manual', got ${manualPos.status}`);
check(manualPos.ch === 84200, `Manual chainage must be 84200, got ${manualPos.ch}`);
check(manualPos.side === 'L', `Manual side must be 'L', got ${manualPos.side}`);

console.log('[PASS] GPS accuracy tiers verified.\n');

// -----------------------------------------------------------------------------
// SUITE 7: Anchor Fix Override and Release
// -----------------------------------------------------------------------------
console.log('--- 7. Testing Anchor Fix Override and Release ---');

// Anchor on exact culvert at PK 84+406.229
const anchorFeature = {
  feature_id: 'culv_84406',
  ch: 84406.229,
  line: 'line_km',
  subsection: 'KZDR',
  side: 'C'
};

engine.setAnchor(anchorFeature);
check(engine.isAnchored() === true, 'Engine must report isAnchored() === true');
check(engine.getAnchor().ch === 84406.229, 'Anchor chainage must match set value');

// Incoming GPS fix with poor accuracy (15m) while standing near the feature
const fixWhileAnchoredPoor = engine.projectGps({
  lat: clPt.lat + 0.0002, // slightly drift off
  lon: clPt.lon + 0.0002,
  accuracy: 15.0
});

check(fixWhileAnchoredPoor.source === 'anchor', `Source must be 'anchor' while anchored, got ${fixWhileAnchoredPoor.source}`);
check(fixWhileAnchoredPoor.ch === 84406.229, `Chainage must be locked to feature chainage, got ${fixWhileAnchoredPoor.ch}`);
check(fixWhileAnchoredPoor.offset_m === 0, `Offset must be snapped to 0 while anchored, got ${fixWhileAnchoredPoor.offset_m}`);
check(fixWhileAnchoredPoor.side === 'C', `Side must be snapped to 'C' while anchored, got ${fixWhileAnchoredPoor.side}`);
check(fixWhileAnchoredPoor.status === 'anchored', `Status must be 'anchored', got ${fixWhileAnchoredPoor.status}`);

// GPS fix with moderate accuracy (8m) still overrides (auto-release requires <= 5m)
const fixWhileAnchoredModerate = engine.projectGps({
  lat: clPt.lat + 0.0001,
  lon: clPt.lon + 0.0001,
  accuracy: 8.0
});
check(fixWhileAnchoredModerate.source === 'anchor', 'Should still be anchored with 8m accuracy');

// GPS fix with good accuracy (<= 5m, e.g. 3.2m): must auto-release anchor!
const fixAutoRelease = engine.projectGps({
  lat: clPt.lat,
  lon: leftPt.lon,
  accuracy: 3.2
});
check(engine.isAnchored() === false, 'Anchor must automatically release when GPS accuracy <= 5m');
check(fixAutoRelease.source === 'gps', `Source must revert to 'gps' after release, got ${fixAutoRelease.source}`);
check(fixAutoRelease.side === 'L', 'Position should reflect real ground measurement after release');

// Explicit manual clearAnchor test
engine.setAnchor(anchorFeature);
check(engine.isAnchored() === true, 'Should be anchored again');
engine.clearAnchor();
check(engine.isAnchored() === false, 'clearAnchor() must immediately clear anchor');

console.log('[PASS] Anchor fix override and release verified.\n');

// -----------------------------------------------------------------------------
// SUITE 8: Facing & Heading Detection (Increasing vs Decreasing)
// -----------------------------------------------------------------------------
console.log('--- 8. Testing Facing & Heading Detection ---');

// Track at PK 84+406 has bearing ~317.1 deg (up-chainage bearing towards Maradi)
const testBearing = clPt.bearing; // ~317 deg

// Heading 1: Walking aligned with track (heading 315 deg, within 90 deg of 317)
const fixFacingInc = engine.projectGps({
  lat: clPt.lat,
  lon: clPt.lon,
  accuracy: 3.0,
  heading: 315.0
});
check(fixFacingInc.facing === 'increasing', `Heading 315° on 317° track must be facing 'increasing', got ${fixFacingInc.facing}`);

// Heading 2: Walking opposite track (heading 137 deg, ~180 deg opposite)
const fixFacingDec = engine.projectGps({
  lat: clPt.lat,
  lon: clPt.lon,
  accuracy: 3.0,
  heading: 137.0
});
check(fixFacingDec.facing === 'decreasing', `Heading 137° on 317° track must be facing 'decreasing', got ${fixFacingDec.facing}`);

// Heading 3: Boundary case (within 90 deg)
const fixFacingBorder = engine.projectGps({
  lat: clPt.lat,
  lon: clPt.lon,
  accuracy: 3.0,
  heading: (testBearing + 85.0) % 360.0
});
check(fixFacingBorder.facing === 'increasing', `Heading within 85° must be facing 'increasing', got ${fixFacingBorder.facing}`);

// Heading 4: Missing heading, infer from displacement trend (dCh / dt)
// Walking forward (+5m)
engine.projectGps({ lat: clPt.lat, lon: clPt.lon, accuracy: 3.0, timestamp: 1000 });
const nextPtFwd = engine.projectChainageOffsetToGps('line_km', baseCh + 5.0, 0);
const fixTrendFwd = engine.projectGps({ lat: nextPtFwd.lat, lon: nextPtFwd.lon, accuracy: 3.0, timestamp: 2000 });
check(fixTrendFwd.facing === 'increasing', `Forward chainage movement (+5m) must yield facing 'increasing', got ${fixTrendFwd.facing}`);

// Walking backwards (-8m)
const nextPtBwd = engine.projectChainageOffsetToGps('line_km', baseCh - 3.0, 0);
const fixTrendBwd = engine.projectGps({ lat: nextPtBwd.lat, lon: nextPtBwd.lon, accuracy: 3.0, timestamp: 3000 });
check(fixTrendBwd.facing === 'decreasing', `Backward chainage movement (-8m) must yield facing 'decreasing', got ${fixTrendBwd.facing}`);

console.log('[PASS] Facing and heading detection verified.\n');

// -----------------------------------------------------------------------------
// SUITE 9: Inverse Coordinate Projection Round-Trip Precision (< 10mm)
// -----------------------------------------------------------------------------
console.log('--- 9. Testing Inverse Coordinate Projection Round-Trip Precision (< 10mm) ---');

// Test across 10 diverse chainages and offsets along Kano-Maradi and Kano-Dutse
const testVectors = [
  { line: 'line_km', ch: 500.0, offset: 0.0 },
  { line: 'line_km', ch: 19800.0, offset: 14.5 },
  { line: 'line_km', ch: 45200.75, offset: -8.25 },
  { line: 'line_km', ch: 84406.229, offset: 25.0 },
  { line: 'line_km', ch: 124500.0, offset: -18.75 },
  { line: 'line_km', ch: 231550.0, offset: 12.0 },
  { line: 'line_kd', ch: 0.0, offset: 0.0 },
  { line: 'line_kd', ch: 15250.0, offset: 16.0 },
  { line: 'line_kd', ch: 35000.0, offset: -10.5 },
  { line: 'line_kd', ch: 75000.0, offset: 22.0 }
];

let maxRoundTripErrorMm = 0;

for (const vec of testVectors) {
  // 1. Forward inverse projection: (ch, offset) -> (lat, lon)
  const gpsCoord = engine.projectChainageOffsetToGps(vec.line, vec.ch, vec.offset);
  check(gpsCoord !== null, `Inverse projection for ${vec.line} PK ${vec.ch} must succeed`);

  // 2. Project (lat, lon) back through the position engine
  engine.setActiveLine(vec.line);
  const recovered = engine.projectGps({ lat: gpsCoord.lat, lon: gpsCoord.lon, accuracy: 1.0 });
  check(recovered !== null, 'Back-projection must return result');

  // 3. Measure chainage and offset discrepancy
  const chErrM = Math.abs(recovered.ch - vec.ch);
  const offsetErrM = Math.abs(recovered.offset_m - vec.offset);
  const totalErrMm = Math.hypot(chErrM, offsetErrM) * 1000.0;

  if (totalErrMm > maxRoundTripErrorMm) {
    maxRoundTripErrorMm = totalErrMm;
  }

  check(totalErrMm < 10.0, `Round-trip error for ${vec.line} at PK ${vec.ch} offset ${vec.offset}m must be < 10mm, got ${totalErrMm.toFixed(3)}mm`);
}

console.log(`   Maximum round-trip projection error across all test vectors: ${maxRoundTripErrorMm.toFixed(4)} mm`);
check(maxRoundTripErrorMm < 10.0, 'All round-trip projections must have < 10mm precision');

console.log('[PASS] Inverse coordinate projection precision (< 10mm) verified.\n');

// -----------------------------------------------------------------------------
// SUITE 10: KML Direct Ingestion & Zero-Config Auto-Discovery
// -----------------------------------------------------------------------------
console.log('--- 10. Testing KML Direct Ingestion & Zero-Config Discovery ---');

const kmlPath = path.join(APP_DIR, '..', 'KMZs KAMA', 'KMD.kml');
if (fs.existsSync(kmlPath)) {
  const kmlText = fs.readFileSync(kmlPath, 'utf8');
  const parsedKml = PositionEngine.parseKml(kmlText);
  check(parsedKml.line_km.length === 570, `KML parse of TXT-KM must return 570 stations, got ${parsedKml.line_km.length}`);
  check(parsedKml.line_kd.length === 216, `KML parse of R989 must return 216 stations, got ${parsedKml.line_kd.length}`);
  check(parsedKml.line_km[0].pk === 0, 'First KM station must be PK 0');
  check(parsedKml.line_km[parsedKml.line_km.length - 1].pk === 284500, 'Last KM station must be PK 284+500');
  console.log(`   Successfully parsed KMD.kml: ${parsedKml.line_km.length} KM stations and ${parsedKml.line_kd.length} KD stations verified.`);
} else {
  console.log('   (Skipping KMD.kml file check: file not present in test environment)');
}

// Chainage parsing & formatting utility checks
check(formatPk(84200) === 'PK 84+200', 'formatPk(84200) should be PK 84+200');
check(formatPk(84200.5, { decimals: 1 }) === 'PK 84+200.5', 'formatPk with decimals');
check(formatPk(84200, { isPoor: true }) === '≈ PK 84+200', 'formatPk poor prefix');
check(parsePk('PK 84+200') === 84200, 'parsePk(PK 84+200) should be 84200');
check(parsePk('≈ PK 84+200.5') === 84200.5, 'parsePk poor string');

// Output Schema Full Verification
const fullOutput = engine.projectGps({ lat: clPt.lat, lon: clPt.lon, accuracy: 3.5 });
const expectedKeys = ['line', 'subsection', 'ch', 'chFormatted', 'side', 'offset_m', 'accuracy_m', 'source', 'heading', 'facing', 'status', 'tier'];
for (const key of expectedKeys) {
  check(Object.prototype.hasOwnProperty.call(fullOutput, key), `Engine output must contain required schema field: ${key}`);
}

console.log('[PASS] KML direct ingestion and schema completeness verified.\n');

// -----------------------------------------------------------------------------
// SUITE 11: Edge Cases, Rounding Boundaries & State Resilience
// -----------------------------------------------------------------------------
console.log('--- 11. Testing Edge Cases, Rounding Boundaries & State Resilience ---');

// 11.1 FormatPk Rounding at Integer Kilometer Thresholds
check(formatPk(999.8) === 'PK 1+000', `formatPk(999.8) must round to PK 1+000, got ${formatPk(999.8)}`);
check(formatPk(19999.9) === 'PK 20+000', `formatPk(19999.9) must round to PK 20+000, got ${formatPk(19999.9)}`);
check(formatPk(999.96, { decimals: 1 }) === 'PK 1+000.0', `formatPk(999.96, dec 1) must round to PK 1+000.0, got ${formatPk(999.96, { decimals: 1 })}`);
check(formatPk(-50) === 'PK -0+050', `formatPk(-50) must format to PK -0+050, got ${formatPk(-50)}`);
check(formatPk(0) === 'PK 0+000', `formatPk(0) must format to PK 0+000, got ${formatPk(0)}`);

// 11.2 ParsePk European Decimal Comma Notation
check(parsePk('PK 82+902,439') === 82902.439, `parsePk('PK 82+902,439') must parse decimal comma, got ${parsePk('PK 82+902,439')}`);
check(parsePk('84+200,5') === 84200.5, `parsePk('84+200,5') must parse decimal comma, got ${parsePk('84+200,5')}`);
check(parsePk(null) === 0, 'parsePk(null) must return 0');
check(parsePk('') === 0, 'parsePk(\'\') must return 0');

// 11.3 Facing & Heading Stationary GPS Jitter Hysteresis
const jitterEngine = new PositionEngine();
// Walk backwards to establish decreasing facing
jitterEngine.projectGps({ lat: clPt.lat, lon: clPt.lon, accuracy: 3.0, heading: 137.0 });
const facingInit = jitterEngine.projectGps({ lat: clPt.lat, lon: clPt.lon, accuracy: 3.0, heading: 137.0 });
check(facingInit.facing === 'decreasing', 'Initial heading must set facing: decreasing');

// Jitter by 0.2m without heading: must NOT reset to 'increasing'
const jitterPt = jitterEngine.projectChainageOffsetToGps('line_km', baseCh + 0.2, 0);
const fixJitter = jitterEngine.projectGps({ lat: jitterPt.lat, lon: jitterPt.lon, accuracy: 3.0 });
check(fixJitter.facing === 'decreasing', 'Stationary GPS jitter (< 1.0m) must retain previous facing direction');

// 11.4 Anchor Fix Fallback When GPS Signal is Lost
const anchorLostEngine = new PositionEngine();
anchorLostEngine.setAnchor({
  feature_id: 'left_ditch_84',
  ch: 84400.0,
  line: 'line_km',
  side: 'L'
});
check(anchorLostEngine.isAnchored() === true, 'Anchor must be active');
const fixLostGps = anchorLostEngine.projectGps(null);
check(fixLostGps !== null, 'projectGps(null) must return anchored position when anchor is active');
check(fixLostGps.source === 'anchor', 'Source must remain anchor when GPS is lost');
check(fixLostGps.side === 'L', `Anchor fix must retain feature side 'L', got ${fixLostGps.side}`);
check(fixLostGps.ch === 84400.0, 'Chainage must remain locked to 84400');
const curPos = anchorLostEngine.getCurrentPosition();
check(curPos !== null && curPos.ch === 84400.0, 'getCurrentPosition() must return active anchor position');

// 11.5 Manual Position & Anchor Mutual Clearing
anchorLostEngine.setManualPosition({ line: 'line_km', ch: 19800, side: 'R' });
check(anchorLostEngine.isAnchored() === false, 'Setting manual position must clear active anchor');
check(anchorLostEngine.getCurrentPosition().source === 'hand', 'Current position must reflect manual mode');
anchorLostEngine.setAnchor(50000);
check(anchorLostEngine.isAnchored() === true, 'Setting anchor must override manual position');
check(anchorLostEngine.getCurrentPosition().source === 'anchor', 'Current position must reflect anchor mode');
anchorLostEngine.clearAnchor();
anchorLostEngine.clearManualPosition();
check(anchorLostEngine.getCurrentPosition() === null, 'After clearing both, getCurrentPosition() must be null');

// 11.6 Constructor KML Loading & loadKml Instance Method
const kmlEngine = new PositionEngine();
if (fs.existsSync(kmlPath)) {
  const kmlText = fs.readFileSync(kmlPath, 'utf8');
  kmlEngine.loadKml(kmlText);
  check(kmlEngine.alignments.has('line_km'), 'loadKml must register line_km');
  check(kmlEngine.alignments.has('line_kd'), 'loadKml must register line_kd');
  const directKmlEngine = new PositionEngine({ kml: kmlText });
  check(directKmlEngine.alignments.has('line_km'), 'PositionEngine({ kml }) constructor must register line_km');
}

// 11.7 UMD Constructor Pattern Verification
check(typeof PositionEngine === 'function', 'PositionEngine must be a constructor function');
const directInst = new PositionEngine();
check(directInst instanceof PositionEngine, 'new PositionEngine() must instantiate correctly');
check(typeof PositionEngine.formatPk === 'function', 'PositionEngine.formatPk static helper must exist');
check(PositionEngine.defaultEngine instanceof PositionEngine, 'PositionEngine.defaultEngine must be an instance');

console.log('[PASS] Edge cases, rounding boundaries, and state resilience verified.\n');

console.log('================================================================');
console.log(`ALL 11 TEST SUITES PASSED VERIFICATION 100%! (${passedAssertions} assertions verified)`);
console.log('================================================================\n');
