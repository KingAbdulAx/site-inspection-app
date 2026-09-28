import os
import json

# Read compact stations
with open('app/data/compact_stations.json', 'r', encoding='utf-8') as f:
    compact_data = json.load(f)

km_json = json.dumps(compact_data['km'], separators=(',', ':'))
kd_json = json.dumps(compact_data['kd'], separators=(',', ':'))

engine_template = f'''/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 3 Linear Referencing Position Engine
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 5 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {{
  if (typeof define === 'function' && define.amd) {{
    define([], factory);
  }} else if (typeof module === 'object' && module.exports) {{
    module.exports = factory();
  }} else {{
    root.PositionEngine = factory();
  }}
}}(typeof self !== 'undefined' ? self : this, function () {{
  'use strict';

  // =========================================================================
  // 1. GEODETIC & MATHEMATICAL UTILITIES
  // =========================================================================

  const WGS84_A = 6378137.0; // Semi-major axis in meters
  const WGS84_F = 1.0 / 298.257223563; // Flattening
  const WGS84_E_SQ = 2.0 * WGS84_F - WGS84_F * WGS84_F; // Eccentricity squared

  /**
   * Computes WGS84 ellipsoid principal radii of curvature at latitude phi.
   * M: Meridional radius (North-South curvature)
   * N: Prime vertical radius (East-West curvature / cos(phi))
   */
  function getWgs84Radii(latDeg) {{
    const phi = (latDeg * Math.PI) / 180.0;
    const sinPhi = Math.sin(phi);
    const denom = Math.sqrt(1.0 - WGS84_E_SQ * sinPhi * sinPhi);
    const M = (WGS84_A * (1.0 - WGS84_E_SQ)) / (denom * denom * denom);
    const N = WGS84_A / denom;
    return {{ M, N, cosPhi: Math.cos(phi) }};
  }}

  /**
   * Accurate geodesic distance between two points in meters using WGS84 ellipsoid.
   */
  function wgs84Distance(p1, p2) {{
    const midLat = (p1.lat + p2.lat) / 2.0;
    const {{ M, N, cosPhi }} = getWgs84Radii(midLat);
    const dy = ((p2.lat - p1.lat) * Math.PI / 180.0) * M;
    const dx = ((p2.lon - p1.lon) * Math.PI / 180.0) * N * cosPhi;
    return Math.hypot(dx, dy);
  }}

  /**
   * Initial bearing from p1 to p2 in degrees [0, 360).
   */
  function calculateBearing(p1, p2) {{
    const phi1 = (p1.lat * Math.PI) / 180.0;
    const phi2 = (p2.lat * Math.PI) / 180.0;
    const dLon = ((p2.lon - p1.lon) * Math.PI) / 180.0;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180.0 / Math.PI + 360.0) % 360.0;
    return bearing;
  }}

  /**
   * Minimal angular difference between two bearings in degrees [0, 180].
   */
  function angularDifference(b1, b2) {{
    return Math.abs((b1 - b2 + 540.0) % 360.0 - 180.0);
  }}

  /**
   * Formats numeric chainage to standard 'PK X+XXX' string.
   */
  function formatPk(ch, options = {{}}) {{
    const isPoor = options.isPoor === true;
    const includePkPrefix = options.includePkPrefix !== false;
    const decimals = typeof options.decimals === 'number' ? options.decimals : 0;

    const num = Number(ch) || 0;
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const km = Math.floor(abs / 1000);
    const m = abs % 1000;

    let mStr;
    if (decimals > 0) {{
      const fixed = m.toFixed(decimals);
      const parts = fixed.split('.');
      mStr = parts[0].padStart(3, '0') + '.' + parts[1];
    }} else {{
      mStr = Math.round(m).toString().padStart(3, '0');
    }}

    const formatted = `${{sign}}${{km}}+${{mStr}}`;
    const prefix = isPoor ? '\u2248 ' : ''; // approximately symbol '≈ '
    const pkPrefix = includePkPrefix ? 'PK ' : '';
    return `${{prefix}}${{pkPrefix}}${{formatted}}`;
  }}

  /**
   * Parses standard chainage string ('PK 84+200', '84+200', '84200') into numeric meters.
   */
  function parsePk(str) {{
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = String(str).replace(/[\u2248~PKpk\s]/g, '');
    const plusIdx = clean.indexOf('+');
    if (plusIdx !== -1) {{
      const km = parseFloat(clean.slice(0, plusIdx)) || 0;
      const m = parseFloat(clean.slice(plusIdx + 1)) || 0;
      const sign = clean.trim().startsWith('-') ? -1 : 1;
      return sign * (Math.abs(km) * 1000 + m);
    }}
    return parseFloat(clean) || 0;
  }}

  // =========================================================================
  // 2. EMBEDDED MASTER SURVEYED STATIONS (KMD.kml GROUND TRUTH)
  // =========================================================================

  const EMBEDDED_STATIONS = {{
    line_km: {km_json},
    line_kd: {kd_json}
  }};

  /**
   * Expands compact station array [[pk, lon, lat], ...] to station objects.
   */
  function expandStations(compactArr, linePrefix = 'PK') {{
    return compactArr.map(item => {{
      const pk = item[0];
      const km = Math.floor(pk / 1000);
      const m = Math.abs(pk % 1000);
      const mStr = m.toString().padStart(3, '0');
      return {{
        pk: pk,
        label: `${{linePrefix}} ${{km}}+${{mStr}}`,
        lon: item[1],
        lat: item[2]
      }};
    }});
  }}

  const DEFAULT_SUBSECTIONS = [
    // Kano-Maradi line (6 sub-sections)
    {{ code: 'KNDW', name: 'Kano - Dawanau', line_id: 'line_km', ch_start: 0, ch_end: 19800 }},
    {{ code: 'DWKZ', name: 'Dawanau - Kazaure', line_id: 'line_km', ch_start: 19800, ch_end: 82902.439 }},
    {{ code: 'KZDR', name: 'Kazaure - Daura', line_id: 'line_km', ch_start: 82902.439, ch_end: 124521 }},
    {{ code: 'DRMR', name: 'Daura - Muduru', line_id: 'line_km', ch_start: 124521, ch_end: 165000 }},
    {{ code: 'MRJB', name: 'Muduru - Jibiya', line_id: 'line_km', ch_start: 165000, ch_end: 215000 }},
    {{ code: 'JBMR', name: 'Jibiya - Maradi', line_id: 'line_km', ch_start: 215000, ch_end: 284500 }},
    // Kano-Dutse branch line (3 sub-sections)
    {{ code: 'KNYG', name: 'Kano - Yar Gaya', line_id: 'line_kd', ch_start: 0, ch_end: 35000 }},
    {{ code: 'YGGY', name: 'Yar Gaya - Gaya', line_id: 'line_kd', ch_start: 35000, ch_end: 75000 }},
    {{ code: 'GYDT', name: 'Gaya - Dutse', line_id: 'line_kd', ch_start: 75000, ch_end: 115000 }}
  ];

  // =========================================================================
  // 3. ALIGNMENT CALIBRATION ENGINE
  // =========================================================================

  /**
   * AlignmentCalibration: Encapsulates geometry, surveyed station calibration,
   * residuals tracking, and orthogonal/inverse projections for a railway line.
   */
  class AlignmentCalibration {{
    constructor(options = {{}}) {{
      this.lineId = options.lineId || options.line_id || 'line_km';
      this.name = options.name || (this.lineId === 'line_km' ? 'Kano-Maradi Main Line' : 'Kano-Dutse Branch Line');
      this.stations = [];
      this.segments = [];
      this.residuals = [];
      this.maxResidualM = 0;
      this.worstStation = '';
      this.checkedPoints = 0;
      this.totalMeasuredM = 0;
      this.totalDesignM = 0;

      if (Array.isArray(options.stations) && options.stations.length >= 2) {{
        this.setStations(options.stations);
      }} else if (Array.isArray(options.stations_500m) && options.stations_500m.length >= 2) {{
        this.setStations(options.stations_500m);
      }}
    }}

    setStations(rawStations) {{
      if (!Array.isArray(rawStations) || rawStations.length < 2) {{
        throw new Error('Alignment stations array must contain at least 2 control points');
      }}

      // Standardize and sort stations monotonically by pk
      this.stations = rawStations.map(s => ({{
        pk: Number(s.pk),
        label: s.label || formatPk(s.pk),
        lon: Number(s.lon),
        lat: Number(s.lat)
      }})).sort((a, b) => a.pk - b.pk);

      this.calibrateSegments();
    }}

    /**
     * Piecewise-linearly calibrates polyline segments against surveyed station labels.
     * Computes geodesic chord lengths, design spans, and residual errors across every segment.
     */
    calibrateSegments() {{
      this.segments = [];
      this.residuals = [];
      this.maxResidualM = 0;
      this.worstStation = '';
      this.totalMeasuredM = 0;

      const n = this.stations.length;
      for (let i = 0; i < n - 1; i++) {{
        const p1 = this.stations[i];
        const p2 = this.stations[i + 1];
        const designSpanM = p2.pk - p1.pk;
        const measuredM = wgs84Distance(p1, p2);
        const residualM = measuredM - designSpanM;
        const absRes = Math.abs(residualM);

        this.totalMeasuredM += measuredM;

        const resRecord = {{
          segmentIndex: i,
          fromPk: p1.pk,
          toPk: p2.pk,
          fromLabel: p1.label,
          toLabel: p2.label,
          measuredM: measuredM,
          designSpanM: designSpanM,
          residualM: residualM,
          absResidualM: absRes
        }};
        this.residuals.push(resRecord);

        if (absRes > this.maxResidualM) {{
          this.maxResidualM = absRes;
          this.worstStation = p2.label;
        }}

        // Precompute segment projection parameters
        const midLat = (p1.lat + p2.lat) / 2.0;
        const radii = getWgs84Radii(midLat);
        const scaleX = (radii.N * radii.cosPhi * Math.PI) / 180.0;
        const scaleY = (radii.M * Math.PI) / 180.0;

        const vx = (p2.lon - p1.lon) * scaleX;
        const vy = (p2.lat - p1.lat) * scaleY;
        const lengthM = Math.hypot(vx, vy);
        const bearing = (Math.atan2(vx, vy) * 180.0 / Math.PI + 360.0) % 360.0;

        this.segments.push({{
          index: i,
          p1: p1,
          p2: p2,
          designSpanM: designSpanM,
          scaleX: scaleX,
          scaleY: scaleY,
          vx: vx,
          vy: vy,
          lengthM: lengthM,
          bearing: bearing
        }});
      }}

      this.checkedPoints = n;
      this.totalDesignM = this.stations[n - 1].pk - this.stations[0].pk;
    }}

    getCalibrationStats() {{
      return {{
        line_id: this.lineId,
        lineId: this.lineId,
        name: this.name,
        maxResidualM: Number(this.maxResidualM.toFixed(4)),
        max_residual_m: Number(this.maxResidualM.toFixed(4)),
        worstStation: this.worstStation,
        worst_station: this.worstStation,
        checkedPoints: this.checkedPoints,
        checked_points: this.checkedPoints,
        totalMeasuredLengthM: Number(this.totalMeasuredM.toFixed(2)),
        totalDesignLengthM: Number(this.totalDesignM.toFixed(2)),
        residuals: this.residuals
      }};
    }}

    /**
     * Projects GPS (lat, lon) orthogonally onto this alignment.
     * Computes piecewise-linear calibrated chainage, signed perpendicular offset,
     * side determination ('L' | 'R' | 'C'), track bearing, and snapped track coordinates.
     */
    projectPoint(lat, lon) {{
      if (!this.segments.length) return null;

      let bestDistSq = Infinity;
      let bestSeg = null;
      let bestT = 0;
      let bestTc = 0;
      let bestProjX = 0;
      let bestProjY = 0;
      let bestCross = 0;

      // Evaluate segments to find the global orthogonal minimum distance
      for (let i = 0; i < this.segments.length; i++) {{
        const seg = this.segments[i];
        if (seg.lengthM < 1e-6) continue;

        // User vector from segment origin p1 in local planar meters
        const ux = (lon - seg.p1.lon) * seg.scaleX;
        const uy = (lat - seg.p1.lat) * seg.scaleY;

        // Projection parameter t along segment
        const t = (ux * seg.vx + uy * seg.vy) / (seg.lengthM * seg.lengthM);
        const tc = Math.max(0, Math.min(1, t));

        const projX = tc * seg.vx;
        const projY = tc * seg.vy;

        const dx = ux - projX;
        const dy = uy - projY;
        const distSq = dx * dx + dy * dy;

        if (distSq < bestDistSq) {{
          bestDistSq = distSq;
          bestSeg = seg;
          bestT = t;
          bestTc = tc;
          bestProjX = projX;
          bestProjY = projY;
          // 2D cross product: vx * uy - vy * ux
          // When facing direction of v (increasing chainage):
          // cross > 0 means user is on the LEFT of the vector
          // cross < 0 means user is on the RIGHT of the vector
          bestCross = seg.vx * uy - seg.vy * ux;
        }}
      }}

      if (!bestSeg) return null;

      const perpDist = Math.sqrt(bestDistSq);

      // Sign convention: Left = left when facing increasing chainage, positive to the left.
      // Left > 0, Right < 0
      const isLeft = bestCross >= 0;
      const signedOffsetM = (isLeft ? 1.0 : -1.0) * perpDist;

      // Piecewise-linear chainage interpolation
      let calibratedCh;
      if (bestSeg.index === 0 && bestT < 0) {{
        // Linear extrapolation before chainage datum
        calibratedCh = bestSeg.p1.pk + bestT * bestSeg.designSpanM;
      }} else if (bestSeg.index === this.segments.length - 1 && bestT > 1) {{
        // Linear extrapolation past alignment terminus
        calibratedCh = bestSeg.p1.pk + bestT * bestSeg.designSpanM;
      }} else {{
        calibratedCh = bestSeg.p1.pk + bestTc * bestSeg.designSpanM;
      }}

      // Snapped track centerline coordinates
      const snappedLat = bestSeg.p1.lat + (bestProjY / bestSeg.scaleY);
      const snappedLon = bestSeg.p1.lon + (bestProjX / bestSeg.scaleX);

      // Side determination: Left (> 0.05m), Right (< -0.05m), Center (within 5cm)
      let side = 'C';
      if (signedOffsetM > 0.05) {{
        side = 'L';
      }} else if (signedOffsetM < -0.05) {{
        side = 'R';
      }}

      return {{
        lineId: this.lineId,
        ch: calibratedCh,
        offsetM: Math.abs(signedOffsetM) <= 0.05 ? 0 : signedOffsetM,
        distM: perpDist,
        side: side,
        bearing: bestSeg.bearing,
        snappedLat: snappedLat,
        snappedLon: snappedLon,
        segmentIndex: bestSeg.index,
        tc: bestTc
      }};
    }}

    /**
     * Inverse projection: (ch, offsetM) -> (lat, lon).
     * Places features, markers, and reading lines accurately on map and strip.
     * Round-trip precision < 10mm.
     */
    projectChainageOffset(ch, offsetM = 0) {{
      if (!this.segments.length) return null;

      const targetPk = Number(ch);
      let targetSeg = null;
      let t = 0;

      if (targetPk <= this.stations[0].pk) {{
        targetSeg = this.segments[0];
        t = (targetPk - targetSeg.p1.pk) / targetSeg.designSpanM;
      }} else if (targetPk >= this.stations[this.stations.length - 1].pk) {{
        targetSeg = this.segments[this.segments.length - 1];
        t = (targetPk - targetSeg.p1.pk) / targetSeg.designSpanM;
      }} else {{
        // Binary search for segment spanning targetPk
        let low = 0;
        let high = this.segments.length - 1;
        while (low <= high) {{
          const mid = Math.floor((low + high) / 2);
          const seg = this.segments[mid];
          if (targetPk >= seg.p1.pk && targetPk <= seg.p2.pk) {{
            targetSeg = seg;
            t = (targetPk - seg.p1.pk) / seg.designSpanM;
            break;
          }} else if (targetPk < seg.p1.pk) {{
            high = mid - 1;
          }} else {{
            low = mid + 1;
          }}
        }}
      }}

      if (!targetSeg) {{
        targetSeg = this.segments[0];
        t = 0;
      }}

      // Centerline point along segment in local planar meters
      const clX = t * targetSeg.vx;
      const clY = t * targetSeg.vy;

      // Unit normal to the LEFT (90 deg CCW rotation of segment vector)
      // v = (vx, vy), normal_left = (-vy / L, vx / L)
      const nx = -targetSeg.vy / targetSeg.lengthM;
      const ny = targetSeg.vx / targetSeg.lengthM;

      // Displace by signed offset (positive to Left, negative to Right)
      const targetX = clX + offsetM * nx;
      const targetY = clY + offsetM * ny;

      // Convert local planar meters back to WGS84 lat/lon
      const lat = targetSeg.p1.lat + (targetY / targetSeg.scaleY);
      const lon = targetSeg.p1.lon + (targetX / targetSeg.scaleX);

      const snappedLat = targetSeg.p1.lat + (clY / targetSeg.scaleY);
      const snappedLon = targetSeg.p1.lon + (clX / targetSeg.scaleX);

      return {{
        lat: lat,
        lon: lon,
        snapped_lat: snappedLat,
        snapped_lon: snappedLon,
        bearing: targetSeg.bearing,
        line: this.lineId,
        ch: targetPk,
        offset_m: offsetM
      }};
    }}
  }}

  // =========================================================================
  // 4. POSITION ENGINE CORE (§5 Master Spec)
  // =========================================================================

  class PositionEngine {{
    constructor(options = {{}}) {{
      this.alignments = new Map();
      this.subsections = Array.isArray(options.subsections) ? options.subsections : DEFAULT_SUBSECTIONS;
      this.activeLineId = options.activeLineId || null;
      this.anchor = null; // Locked feature anchor: {{ feature_id, ch, line, subsection, side }}
      this.lastFix = null; // Last processed GPS fix: {{ lat, lon, ch, timestamp, heading }}
      this.manualPosition = null; // Last manual entry if active
      
      // Hysteresis threshold: 25m lateral distance required to jump lines near overlapping junctions
      this.hysteresisThresholdM = typeof options.hysteresisThresholdM === 'number' ? options.hysteresisThresholdM : 25.0;
      this.poorAccuracyThresholdM = typeof options.poorAccuracyThresholdM === 'number' ? options.poorAccuracyThresholdM : 10.0;
      this.goodAccuracyThresholdM = typeof options.goodAccuracyThresholdM === 'number' ? options.goodAccuracyThresholdM : 5.0;

      // Initialize default alignments
      this.initDefaultAlignments(options.alignments);
    }}

    initDefaultAlignments(customAlignments) {{
      if (Array.isArray(customAlignments) && customAlignments.length > 0) {{
        for (const align of customAlignments) {{
          this.registerAlignment(align);
        }}
        return;
      }}

      // Check external browser bundles or embedded fallback
      let kmStations = null;
      let kdStations = null;

      if (typeof window !== 'undefined' && window.KMD_ALIGNMENT_STATIONS) {{
        kmStations = window.KMD_ALIGNMENT_STATIONS.line_km;
        kdStations = window.KMD_ALIGNMENT_STATIONS.line_kd;
      }}

      if (!kmStations && EMBEDDED_STATIONS.line_km) {{
        kmStations = expandStations(EMBEDDED_STATIONS.line_km, 'PK');
      }}
      if (!kdStations && EMBEDDED_STATIONS.line_kd) {{
        kdStations = expandStations(EMBEDDED_STATIONS.line_kd, 'PK');
      }}

      if (kmStations) {{
        this.alignments.set('line_km', new AlignmentCalibration({{
          lineId: 'line_km',
          name: 'Kano-Maradi Main Line',
          stations: kmStations
        }}));
      }}

      if (kdStations) {{
        this.alignments.set('line_kd', new AlignmentCalibration({{
          lineId: 'line_kd',
          name: 'Kano-Dutse Branch Line',
          stations: kdStations
        }}));
      }}
    }}

    registerAlignment(align) {{
      const lineId = align.lineId || align.line_id || (align instanceof AlignmentCalibration ? align.lineId : 'line_custom');
      if (align instanceof AlignmentCalibration) {{
        this.alignments.set(lineId, align);
      }} else {{
        this.alignments.set(lineId, new AlignmentCalibration(align));
      }}
      return this.alignments.get(lineId);
    }}

    getAlignment(lineId) {{
      return this.alignments.get(lineId) || null;
    }}

    getActiveLine() {{
      return this.activeLineId || (this.alignments.has('line_km') ? 'line_km' : Array.from(this.alignments.keys())[0]);
    }}

    setActiveLine(lineId) {{
      if (this.alignments.has(lineId)) {{
        this.activeLineId = lineId;
      }}
      return this.activeLineId;
    }}

    getCalibrationStats(lineId = 'line_km') {{
      const align = this.getAlignment(lineId);
      return align ? align.getCalibrationStats() : null;
    }}

    /**
     * Determines geographic subsection code for a line and chainage.
     */
    lookupSubsection(lineId, ch) {{
      const targetLine = lineId || this.getActiveLine();
      const subs = this.subsections.filter(s => s.line_id === targetLine);
      if (!subs.length) return '';

      for (const s of subs) {{
        if (ch >= s.ch_start && ch <= s.ch_end) {{
          return s.code;
        }}
      }}

      if (ch < subs[0].ch_start) return subs[0].code;
      return subs[subs.length - 1].code;
    }}

    /**
     * Anchor Fix (§5.7 Master Spec):
     * "I'm on it" / anchor fix on any feature with an exact chainage overrides position
     * (source: 'anchor'), locks chainage to feature chainage and snaps offset to 0
     * until GPS accuracy returns to <= 5m or user clears anchor.
     */
    setAnchor(featureOrCh) {{
      if (!featureOrCh) return;
      let anchorSpec = {{}};
      if (typeof featureOrCh === 'number') {{
        anchorSpec = {{
          feature_id: 'manual_anchor',
          ch: featureOrCh,
          line: this.getActiveLine(),
          side: 'C'
        }};
      }} else {{
        anchorSpec = {{
          feature_id: featureOrCh.feature_id || featureOrCh.id || 'anchor_point',
          ch: typeof featureOrCh.ch === 'number' ? featureOrCh.ch : (featureOrCh.ch_start || 0),
          line: featureOrCh.line || featureOrCh.line_id || this.getActiveLine(),
          side: featureOrCh.side || 'C'
        }};
      }}
      anchorSpec.subsection = featureOrCh.subsection || this.lookupSubsection(anchorSpec.line, anchorSpec.ch);
      this.anchor = anchorSpec;
      return this.anchor;
    }}

    clearAnchor() {{
      const prev = this.anchor;
      this.anchor = null;
      return prev;
    }}

    isAnchored() {{
      return this.anchor !== null;
    }}

    getAnchor() {{
      return this.anchor;
    }}

    /**
     * Manual Mode / Keypad Entry (§5.6 Master Spec):
     * Emits source: 'hand', tier: 'none'.
     */
    setManualPosition(data = {{}}) {{
      const line = data.line || data.line_id || this.getActiveLine();
      const ch = typeof data.ch === 'number' ? data.ch : parsePk(data.ch);
      const side = data.side || 'C';
      const offsetM = typeof data.offset_m === 'number' ? data.offset_m : (side === 'L' ? 8.0 : (side === 'R' ? -8.0 : 0));
      const subsection = data.subsection || this.lookupSubsection(line, ch);

      this.activeLineId = line;
      this.manualPosition = {{
        line: line,
        subsection: subsection,
        ch: ch,
        chFormatted: formatPk(ch, {{ isPoor: false }}),
        side: side,
        offset_m: offsetM,
        accuracy_m: null,
        source: 'hand',
        heading: null,
        facing: 'increasing',
        status: 'manual',
        tier: 'none'
      }};

      return Object.assign({{}}, this.manualPosition);
    }}

    /**
     * Computes facing direction from GPS heading or recent chainage displacement trend (§5.8).
     * Heading within 90 deg of up-chainage bearing => facing: 'increasing'
     * Heading within 90 deg of down-chainage bearing => facing: 'decreasing'
     */
    computeFacing(lineId, ch, heading) {{
      const align = this.getAlignment(lineId);
      let trackBearing = 0;
      if (align) {{
        const pt = align.projectChainageOffset(ch, 0);
        if (pt) trackBearing = pt.bearing;
      }}

      if (typeof heading === 'number' && !isNaN(heading)) {{
        const diff = angularDifference(heading, trackBearing);
        return diff <= 90.0 ? 'increasing' : 'decreasing';
      }}

      // Trend displacement fallback
      if (this.lastFix && typeof this.lastFix.ch === 'number') {{
        const dCh = ch - this.lastFix.ch;
        if (Math.abs(dCh) >= 0.3) {{
          return dCh > 0 ? 'increasing' : 'decreasing';
        }}
      }}

      return 'increasing';
    }}

    /**
     * Main Position Projection Pipeline (§5 Master Spec):
     * Handles line disambiguation & stickiness (hysteresis), piecewise-linear calibration,
     * offset and side determination, GPS accuracy tiers, anchor fix overrides, and facing.
     * 
     * @param {{Object}} fix - GPS fix: {{ lat, lon, accuracy, heading, speed, timestamp }}
     * @returns {{Object}} Master output schema:
     *   {{ line, subsection, ch, chFormatted, side, offset_m, accuracy_m, source, heading, facing, status, tier }}
     */
    projectGps(fix) {{
      if (!fix || typeof fix.lat !== 'number' || typeof fix.lon !== 'number') {{
        if (this.manualPosition) return Object.assign({{}}, this.manualPosition);
        return null;
      }}

      const accuracy = typeof fix.accuracy === 'number' ? fix.accuracy : (typeof fix.accuracy_m === 'number' ? fix.accuracy_m : 0);
      const heading = typeof fix.heading === 'number' && !isNaN(fix.heading) ? fix.heading : null;

      // 1. Check Anchor Fix Override (§5.7)
      if (this.anchor) {{
        // Auto-release anchor when GPS accuracy returns to <= 5m
        if (accuracy > 0 && accuracy <= this.goodAccuracyThresholdM) {{
          this.clearAnchor();
        }} else {{
          // Anchor remains active: locks chainage to feature chainage and snaps offset to 0
          const anchorLine = this.anchor.line || this.getActiveLine();
          const anchorCh = this.anchor.ch;
          const align = this.getAlignment(anchorLine);
          const anchorCoords = align ? align.projectChainageOffset(anchorCh, 0) : null;
          const facing = this.computeFacing(anchorLine, anchorCh, heading);

          const tier = accuracy <= this.poorAccuracyThresholdM ? 'good' : 'poor';

          return {{
            line: anchorLine,
            subsection: this.anchor.subsection || this.lookupSubsection(anchorLine, anchorCh),
            ch: anchorCh,
            chFormatted: formatPk(anchorCh, {{ isPoor: false }}),
            side: 'C',
            offset_m: 0,
            accuracy_m: accuracy || null,
            source: 'anchor',
            heading: heading,
            facing: facing,
            status: 'anchored',
            tier: tier,
            lat: fix.lat,
            lon: fix.lon,
            snapped_lat: anchorCoords ? anchorCoords.snapped_lat : fix.lat,
            snapped_lon: anchorCoords ? anchorCoords.snapped_lon : fix.lon,
            bearing: anchorCoords ? anchorCoords.bearing : 0,
            anchor_feature_id: this.anchor.feature_id
          }};
        }}
      }}

      // 2. Line Disambiguation & Line-Stickiness Hysteresis (§5.4)
      // Project onto all available alignments
      const candidateProjections = new Map();
      for (const [lineId, alignment] of this.alignments.entries()) {{
        const proj = alignment.projectPoint(fix.lat, fix.lon);
        if (proj) {{
          candidateProjections.set(lineId, proj);
        }}
      }}

      if (candidateProjections.size === 0) return null;

      let chosenLineId = this.activeLineId;

      if (!chosenLineId || !candidateProjections.has(chosenLineId)) {{
        // Unlocked state: pick candidate with smallest lateral perpendicular distance
        let minDist = Infinity;
        for (const [lineId, proj] of candidateProjections.entries()) {{
          if (proj.distM < minDist) {{
            minDist = proj.distM;
            chosenLineId = lineId;
          }}
        }}
      }} else {{
        // Locked state with stickiness hysteresis threshold
        const currentProj = candidateProjections.get(chosenLineId);
        const currentDist = currentProj.distM;

        for (const [otherLineId, otherProj] of candidateProjections.entries()) {{
          if (otherLineId !== chosenLineId) {{
            // Only jump lines if candidate is significantly closer by hysteresisThresholdM (25m)
            if (otherProj.distM < currentDist - this.hysteresisThresholdM) {{
              chosenLineId = otherLineId;
              break;
            }}
          }}
        }}
      }}

      this.activeLineId = chosenLineId;
      const proj = candidateProjections.get(chosenLineId);

      // 3. GPS Accuracy Tiers & Side Withholding (§5.5)
      // Good (<= 10m): Normal display (tier: 'good')
      // Poor (> 10m): Prefix chainage with '≈', withhold side (side: '?'), tier: 'poor'
      // None: tier: 'none'
      let tier = 'good';
      let displaySide = proj.side;
      let isPoor = false;

      if (accuracy > this.poorAccuracyThresholdM) {{
        tier = 'poor';
        isPoor = true;
        displaySide = '?'; // Withhold side under poor GPS
      }} else if (accuracy <= 0 || isNaN(accuracy)) {{
        tier = 'none';
      }}

      const chFormatted = formatPk(proj.ch, {{ isPoor: isPoor }});
      const subsection = this.lookupSubsection(chosenLineId, proj.ch);
      const facing = this.computeFacing(chosenLineId, proj.ch, heading);

      // Record last fix for velocity displacement trend tracking
      this.lastFix = {{
        lat: fix.lat,
        lon: fix.lon,
        ch: proj.ch,
        timestamp: fix.timestamp || Date.now(),
        heading: heading
      }};

      return {{
        line: chosenLineId,
        subsection: subsection,
        ch: proj.ch,
        chFormatted: chFormatted,
        side: displaySide,
        offset_m: proj.offsetM,
        accuracy_m: accuracy,
        source: 'gps',
        heading: heading,
        facing: facing,
        status: tier === 'good' ? 'good' : (tier === 'poor' ? 'poor_accuracy' : 'manual'),
        tier: tier,
        lat: fix.lat,
        lon: fix.lon,
        snapped_lat: proj.snappedLat,
        snapped_lon: proj.snappedLon,
        bearing: proj.bearing,
        dist_to_centerline_m: proj.distM
      }};
    }}

    /**
     * Inverse Projection (§5.9 Master Spec):
     * projectChainageOffsetToGps(line, ch, offsetM)
     * Round-trip precision < 10mm.
     */
    projectChainageOffsetToGps(lineId, ch, offsetM = 0) {{
      const targetLine = lineId || this.getActiveLine();
      const align = this.getAlignment(targetLine);
      if (!align) return null;
      return align.projectChainageOffset(ch, offsetM);
    }}

    formatChainage(ch, options) {{
      return formatPk(ch, options);
    }}

    parseChainage(str) {{
      return parsePk(str);
    }}

    static parseKml(kmlText) {{
      const result = {{ line_km: [], line_kd: [] }};
      if (!kmlText) return result;

      const folderParts = kmlText.split(/<Folder[^>]*>/i);
      for (let i = 1; i < folderParts.length; i++) {{
        const chunk = folderParts[i];
        const nameMatch = /<name>\s*([^<]+?)\s*<\/name>/i.exec(chunk);
        if (!nameMatch) continue;
        const folderName = nameMatch[1].trim();

        let targetArray = null;
        if (folderName === 'TXT-KM') targetArray = result.line_km;
        else if (folderName === 'R989') targetArray = result.line_kd;

        if (targetArray) {{
          const pmParts = chunk.split(/<Placemark[^>]*>/i);
          for (let j = 1; j < pmParts.length; j++) {{
            const pmChunk = pmParts[j];
            const endFolderIdx = pmChunk.indexOf('</Folder>');
            const activeChunk = endFolderIdx !== -1 ? pmChunk.slice(0, endFolderIdx) : pmChunk;

            const pmNameMatch = /<name>\s*([^<]+?)\s*<\/name>/i.exec(activeChunk);
            const coordMatch = /<coordinates>\s*([^<]+?)\s*<\/coordinates>/i.exec(activeChunk);

            if (pmNameMatch && coordMatch) {{
              const name = pmNameMatch[1].trim();
              const pkMatch = /^(\\d+)\\+(\\d{{3}})$/.exec(name);
              if (pkMatch) {{
                const pk = parseInt(pkMatch[1], 10) * 1000 + parseInt(pkMatch[2], 10);
                const coords = coordMatch[1].trim().split(',').map(Number);
                targetArray.push({{
                  pk: pk,
                  label: `PK ${{name}}`,
                  lon: coords[0],
                  lat: coords[1]
                }});
              }}
            }}
          }}
        }}
      }}

      result.line_km.sort((a, b) => a.pk - b.pk);
      result.line_kd.sort((a, b) => a.pk - b.pk);
      return result;
    }}
  }}

  // Default singleton instance
  const defaultEngine = new PositionEngine();

  return {{
    PositionEngine: PositionEngine,
    AlignmentCalibration: AlignmentCalibration,
    defaultEngine: defaultEngine,
    formatPk: formatPk,
    parsePk: parsePk,
    wgs84Distance: wgs84Distance,
    calculateBearing: calculateBearing,
    angularDifference: angularDifference
  }};
}}));
'''

out_path = os.path.join('app', 'position_engine.js')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(engine_template)

print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")
