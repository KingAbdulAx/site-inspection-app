/**
 * KMD DRAINAGE FIELD INSPECTOR — EDIT MODE & STRUCTURE MANAGER
 * Offline-First Structure Authoring, Modification, Deletion, and Supabase Replication
 * Aligned with Master Standard Drawings (MDDT-2200-DW-10001 through 10023)
 */

(function () {
  'use strict';

  // --- 1. Master Drainage Typology Catalog & Design Defaults ---
  const DRAINAGE_TYPOLOGIES = [
    {
      code: 'T1',
      typology: 'Unlined Side Ditch (Type 1)',
      short_code: 'Type 1',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Shoulder',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Earth cut triangular (4% platform to 1:1.5 cut slope, depth ~0.30–0.50m)',
      icon: 'ditch',
      offsetM: -4.5
    },
    {
      code: 'T2',
      typology: 'Half-Round Lined Ditch (Type 2 - Overpasses)',
      short_code: 'Type 2',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Shoulder',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Precast half-round section on compacted bulk fill, perforated tube Ø110/160mm',
      icon: 'ditch',
      offsetM: -4.5
    },
    {
      code: 'T3',
      typology: 'Unlined Side Ditch (Type 3 - Eventual)',
      short_code: 'Type 3',
      category: 'Longitudinal Ditch',
      sideDefault: 'Right',
      lane: 'Shoulder',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Earth cut triangular 4% to 1:1.5, base width variable',
      icon: 'ditch',
      offsetM: 4.5
    },
    {
      code: 'T4',
      typology: 'Unlined Ditch at Foot of Slope (Type 4 - Toe)',
      short_code: 'Type 4',
      category: 'Longitudinal Ditch',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: false,
      color: '#10B981',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Earth cut at embankment toe (triangular, 1:1.5 slopes)',
      icon: 'ditch',
      offsetM: 12.0
    },
    {
      code: 'T5',
      typology: 'Crest Ditch (Type 5 - Unlined Interceptor)',
      short_code: 'Type 5',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Crest',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Earth interceptor at top of cutting (1.50m width, 0.50m depth, 1:1.5 slopes)',
      icon: 'ditch',
      offsetM: -22.0
    },
    {
      code: 'T6',
      typology: 'Collector Drain with Filter (Type 6)',
      short_code: 'Type 6',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Toe',
      is_point: false,
      color: '#6366F1',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A / 10002',
      specs: 'Perforated PVC collector, gravel filter (14/32), sand, geotextile DS 200',
      icon: 'ditch',
      offsetM: -10.0
    },
    {
      code: 'T7',
      typology: 'Concrete Lined Ditch at Foot of Slope (Type 7 - Toe)',
      short_code: 'Type 7',
      category: 'Longitudinal Ditch',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: false,
      color: '#10B981',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Cast-in-place concrete C25/30, mesh #Ø3.8 @ 150mm, Ø6 @ 100mm',
      icon: 'ditch',
      offsetM: 12.0
    },
    {
      code: 'T8',
      typology: 'Half-Round Lined Bench Ditch (Type 8 - Berm)',
      short_code: 'Type 8',
      category: 'Longitudinal Ditch',
      sideDefault: 'Right',
      lane: 'Bench',
      is_point: false,
      color: '#38BDF8',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A / 10003',
      specs: 'Precast half-round units on berm/bench (3.00m berm width, 4% slope)',
      icon: 'ditch',
      offsetM: 8.0
    },
    {
      code: 'T9',
      typology: 'Half-Round Lined Shoulder Ditch (Type 9 - Platform Edge)',
      short_code: 'Type 9',
      category: 'Shoulder / Cascade',
      sideDefault: 'Right',
      lane: 'Shoulder',
      is_point: false,
      color: '#38BDF8',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A / 10003',
      specs: 'Precast half-round ditch D=0.30m along embankment shoulder connecting to cascades',
      icon: 'ditch',
      offsetM: 4.5
    },
    {
      code: 'T10',
      typology: 'Concrete Lined Side Ditch with Trench Filter (Type 10)',
      short_code: 'Type 10',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Shoulder',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Concrete C25/30 lined triangular ditch + deep sub-ballast trench filter with perforated pipe',
      icon: 'ditch',
      offsetM: -4.5
    },
    {
      code: 'T11',
      typology: 'Concrete Lined Crest Ditch (Type 11 - Top of Cut)',
      short_code: 'Type 11',
      category: 'Longitudinal Ditch',
      sideDefault: 'Left',
      lane: 'Crest',
      is_point: false,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A / 10003',
      specs: 'Concrete C25/30 lined crest interceptor (1.50m width, 0.50m depth, mesh #Ø3.8 @ 150mm)',
      icon: 'ditch',
      offsetM: -22.0
    },
    {
      code: 'T12',
      typology: 'Trapezoidal Lined Ditch at Foot of Slope (Type 12 - Toe)',
      short_code: 'Type 12',
      category: 'Longitudinal Ditch',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: false,
      color: '#10B981',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10001-05-A',
      specs: 'Concrete C25/30 trapezoidal ditch at embankment toe with geotextile',
      icon: 'ditch',
      offsetM: 12.0
    },
    {
      code: 'T14',
      typology: 'Special Retaining Wall Ditch (Type 14)',
      short_code: 'Type 14',
      category: 'Special Ditch',
      sideDefault: 'Left',
      lane: 'Toe',
      is_point: false,
      color: '#8B5CF6',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10006-02-A',
      specs: 'Cast-in-place concrete ditch integrated with toe retaining structure',
      icon: 'ditch',
      offsetM: -8.0
    },
    {
      code: 'T15',
      typology: 'Deep Collector Ditch (Type 15)',
      short_code: 'Type 15',
      category: 'Special Ditch',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: false,
      color: '#8B5CF6',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10006-02-A',
      specs: 'Reinforced deep collector ditch for high discharge cuts',
      icon: 'ditch',
      offsetM: 10.0
    },
    {
      code: 'T16',
      typology: 'Inter-Track Central Ditch (Type 16)',
      short_code: 'Type 16',
      category: 'Special Ditch',
      sideDefault: 'Center',
      lane: 'Centerline',
      is_point: false,
      color: '#8B5CF6',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10006-02-A',
      specs: 'Precast / in-situ longitudinal central ditch between multi-track stations',
      icon: 'ditch',
      offsetM: 0
    },
    {
      code: 'WATER_DESCENT',
      typology: 'Stepped Water Descent / Cascade Chute (DW-10003)',
      short_code: 'Cascade',
      category: 'Water Descent',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: true,
      color: '#0284C7',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10003-04-A',
      specs: 'Transverse stepped slope cascade connecting shoulder ditch to toe dissipator',
      icon: 'cascade',
      offsetM: 8.0
    },
    {
      code: 'DISSIPATOR',
      typology: 'Energy Dissipator Basin (1.2m x 1.8m)',
      short_code: 'Dissipator',
      category: 'Energy Dissipator',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: true,
      color: '#D97706',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B / DW-10003',
      specs: 'Point energy dissipator baffle basin (1.2m x 1.8m x 0.4m drop)',
      icon: 'dissipator',
      offsetM: 12.0
    },
    {
      code: 'RIPRAP',
      typology: 'Embankment Riprap Scour Protection Armor',
      short_code: 'Riprap',
      category: 'Riprap Protection',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: false,
      color: '#64748B',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10004-02-A',
      specs: 'Longitudinal stone riprap armor D50=100-200mm, thickness 0.35m on geotextile',
      icon: 'riprap',
      offsetM: 13.0
    },
    {
      code: 'CHAN_A',
      typology: 'Concrete Rectangular Channel (Type A)',
      short_code: 'Chan A',
      category: 'Diversion Channel',
      sideDefault: 'Left',
      lane: 'Channel',
      is_point: false,
      color: '#06B6D4',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B',
      specs: 'Concrete rectangular channel (B=1.0-2.5m, H=0.8-1.5m) with cover slabs',
      icon: 'channel',
      offsetM: -25.0
    },
    {
      code: 'CHAN_B',
      typology: 'Concrete Trapezoidal Channel (Type B)',
      short_code: 'Chan B',
      category: 'Diversion Channel',
      sideDefault: 'Left',
      lane: 'Channel',
      is_point: false,
      color: '#06B6D4',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B',
      specs: 'Concrete trapezoidal channel (B=1.0-7.0m, H=0.8-1.5m, 1:1)',
      icon: 'channel',
      offsetM: -25.0
    },
    {
      code: 'CHAN_C',
      typology: 'Trapezoidal Channel (Type C - Unlined)',
      short_code: 'Chan C',
      category: 'Diversion Channel',
      sideDefault: 'Right',
      lane: 'Channel',
      is_point: false,
      color: '#06B6D4',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B',
      specs: 'Earth trapezoidal diversion channel (B=2.0-5.0m, 1:1.5 slopes)',
      icon: 'channel',
      offsetM: 25.0
    },
    {
      code: 'BOX_1X',
      typology: 'Reinforced Concrete Single Box Culvert 1x(2.5x2.5m)',
      short_code: '1x Box Culv',
      category: 'Cross Drainage',
      sideDefault: 'Center',
      lane: 'Centerline',
      is_point: true,
      color: '#334155',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B',
      specs: 'Reinforced concrete single cell box culvert 1x(2.5x2.5m) C30/37 with wingwalls',
      icon: 'culvert_box',
      offsetM: 0
    },
    {
      code: 'BOX_2X',
      typology: 'Reinforced Concrete Twin Box Culvert 2x(2.5x2.5m)',
      short_code: '2x Box Culv',
      category: 'Cross Drainage',
      sideDefault: 'Center',
      lane: 'Centerline',
      is_point: true,
      color: '#334155',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10002-07-B',
      specs: 'Reinforced concrete twin cell box culvert 2x(2.5x2.5m) C30/37 with wingwalls',
      icon: 'culvert_box',
      offsetM: 0
    },
    {
      code: 'PIPE_CULV',
      typology: 'Precast Concrete Pipe Culvert Ø1000mm',
      short_code: 'Pipe Culv',
      category: 'Cross Drainage',
      sideDefault: 'Center',
      lane: 'Centerline',
      is_point: true,
      color: '#334155',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-00030',
      specs: 'Precast concrete class 120D pipe culvert DN1000 with headwalls and aprons',
      icon: 'culvert_pipe',
      offsetM: 0
    },
    {
      code: 'MANHOLE',
      typology: 'Modular Prefab Manhole Ø1.2m',
      short_code: 'Manhole',
      category: 'Structure',
      sideDefault: 'Right',
      lane: 'Toe',
      is_point: true,
      color: '#64748B',
      drawing_ref: 'T2019-323-DD-MD-MDDT-2200-DW-10022-01-A',
      specs: 'Prefab modular circular manhole Ø1200mm with ductile iron cover and ladder',
      icon: 'marker',
      offsetM: 10.0
    }
  ];

  // --- 2. Helper Functions ---
  function parsePk(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(/PK/gi, '').replace(/\s+/g, '');
    if (clean.includes('+')) {
      const parts = clean.split('+');
      const km = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      return km * 1000 + m;
    }
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    return num < 500 ? num * 1000 : num;
  }

  function formatPk(pk) {
    const num = Math.round(Number(pk) || 0);
    const km = Math.floor(num / 1000);
    const m = Math.abs(num % 1000);
    return `${km}+${m.toString().padStart(3, '0')}`;
  }

  function formatChainageStr(startPk, endPk, isPoint) {
    if (isPoint || Math.abs(startPk - endPk) < 0.5) {
      return `PK ${formatPk(startPk)}`;
    }
    const s = Math.min(startPk, endPk);
    const e = Math.max(startPk, endPk);
    return `PK ${formatPk(s)} – PK ${formatPk(e)}`;
  }

  // --- 3. Geometric Centerline Spatial Projection ---
  function getCenterlinePoints(pk) {
    if (pk < 82902 && window.SECTION02_CENTERLINE && window.SECTION02_CENTERLINE.dense_points) {
      return window.SECTION02_CENTERLINE.dense_points;
    }
    if (window.SECTION03_CENTERLINE && window.SECTION03_CENTERLINE.dense_points) {
      return window.SECTION03_CENTERLINE.dense_points;
    }
    if (window.SECTION02_CENTERLINE && window.SECTION02_CENTERLINE.dense_points) {
      return window.SECTION02_CENTERLINE.dense_points;
    }
    return [];
  }

  function interpolateCenterline(targetPk) {
    const pts = getCenterlinePoints(targetPk);
    if (!pts || pts.length === 0) {
      return { pk: targetPk, lon: 8.3948, lat: 12.6328, bearing: 0 };
    }
    if (targetPk <= pts[0].pk) return pts[0];
    if (targetPk >= pts[pts.length - 1].pk) return pts[pts.length - 1];

    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].pk <= targetPk && targetPk <= pts[i + 1].pk) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const span = p1.pk - p0.pk;
        const t = span === 0 ? 0 : (targetPk - p0.pk) / span;

        let diff = (p1.bearing || 0) - (p0.bearing || 0);
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        const bearing = ((p0.bearing || 0) + t * diff + 360) % 360;

        return {
          pk: targetPk,
          lon: p0.lon + t * (p1.lon - p0.lon),
          lat: p0.lat + t * (p1.lat - p0.lat),
          bearing: p0.bearing !== undefined ? Math.round(bearing * 100) / 100 : (p0.bearing || 0)
        };
      }
    }
    return pts[0];
  }

  function computeGeometryForPk(startPk, endPk, isPoint, side, customOffsetM) {
    const sPk = Math.min(startPk, endPk);
    const ePk = Math.max(startPk, endPk);

    // Helper: offset a single point perpendicular to bearing
    function offsetPoint(pt, distM) {
      const bearingRad = ((pt.bearing || 0) * Math.PI) / 180.0;
      // Perpendicular bearing: Left is -90deg (-PI/2), Right is +90deg (+PI/2)
      const perpRad = side === 'Left' ? bearingRad - Math.PI / 2.0 : bearingRad + Math.PI / 2.0;
      const latRad = (pt.lat * Math.PI) / 180.0;

      const dLat = (distM * Math.cos(perpRad)) / 111139.0;
      const dLon = (distM * Math.sin(perpRad)) / (111139.0 * Math.cos(latRad));

      return [
        Math.round((pt.lon + dLon) * 1e7) / 1e7,
        Math.round((pt.lat + dLat) * 1e7) / 1e7
      ];
    }

    // Determine offset
    const offset = Math.abs(typeof customOffsetM === 'number' ? customOffsetM : (side === 'Center' ? 0 : 8.0));

    // A. Cross-drainage culvert point structure (LineString spanning track from Left to Right)
    if (isPoint && (side === 'Center' || side === 'Cross')) {
      const closestPt = interpolateCenterline(sPk);
      const bearingRad = ((closestPt.bearing || 0) * Math.PI) / 180.0;
      const latRad = (closestPt.lat * Math.PI) / 180.0;
      const spanM = 15.0; // 15m culvert wingwall to wingwall span across track

      const leftPerp = bearingRad - Math.PI / 2.0;
      const rightPerp = bearingRad + Math.PI / 2.0;

      const pLeft = [
        Math.round((closestPt.lon + (spanM * Math.sin(leftPerp)) / (111139.0 * Math.cos(latRad))) * 1e7) / 1e7,
        Math.round((closestPt.lat + (spanM * Math.cos(leftPerp)) / 111139.0) * 1e7) / 1e7
      ];
      const pRight = [
        Math.round((closestPt.lon + (spanM * Math.sin(rightPerp)) / (111139.0 * Math.cos(latRad))) * 1e7) / 1e7,
        Math.round((closestPt.lat + (spanM * Math.cos(rightPerp)) / 111139.0) * 1e7) / 1e7
      ];

      return {
        type: 'LineString',
        coordinates: [pLeft, pRight]
      };
    }

    // B. Point structure (Dissipator, Cascade, Manhole, Boundary)
    if (isPoint) {
      const closestPt = interpolateCenterline(sPk);
      return {
        type: 'Point',
        coordinates: offsetPoint(closestPt, offset)
      };
    }

    // C. Linear structure (Ditch, Channel, Riprap)
    // Starts exactly at sPk, includes intermediate vertices, terminates exactly at ePk
    const startPt = interpolateCenterline(sPk);
    const endPt = interpolateCenterline(ePk);
    const coords = [offsetPoint(startPt, offset)];

    const intermediatePoints = [];
    if (window.SECTION02_CENTERLINE && window.SECTION02_CENTERLINE.dense_points && sPk < 82902) {
      const s02Pts = window.SECTION02_CENTERLINE.dense_points;
      for (let i = 0; i < s02Pts.length; i++) {
        if (s02Pts[i].pk > sPk && s02Pts[i].pk < ePk) {
          intermediatePoints.push(s02Pts[i]);
        }
      }
    }
    if (window.SECTION03_CENTERLINE && window.SECTION03_CENTERLINE.dense_points && ePk >= 82800) {
      const s03Pts = window.SECTION03_CENTERLINE.dense_points;
      for (let i = 0; i < s03Pts.length; i++) {
        if (s03Pts[i].pk > sPk && s03Pts[i].pk < ePk) {
          if (!intermediatePoints.some(p => Math.abs(p.pk - s03Pts[i].pk) < 1.0)) {
            intermediatePoints.push(s03Pts[i]);
          }
        }
      }
    }
    intermediatePoints.sort((a, b) => a.pk - b.pk);
    for (let i = 0; i < intermediatePoints.length; i++) {
      coords.push(offsetPoint(intermediatePoints[i], offset));
    }
    coords.push(offsetPoint(endPt, offset));

    return {
      type: 'LineString',
      coordinates: coords
    };
  }

  // --- 4. EditManager Class Definition ---
  const STORAGE_KEY_EDITS = 'KMD_DRAINAGE_STRUCTURE_EDITS_V1';

  class EditManager {
    constructor() {
      this.isEditMode = false;
      this.edits = {
        created: {},  // { [id]: GeoJSONFeature }
        updated: {},  // { [id]: { properties: {...}, geometry?: {...}, updated_at: ... } }
        deleted: {},  // { [id]: ISOString }
        reverted: {}  // { [id]: ISOString }
      };
      this.loadEdits();
    }

    loadEdits() {
      try {
        if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return;
        const raw = localStorage.getItem(STORAGE_KEY_EDITS);
        if (raw) {
          const parsed = JSON.parse(raw);
          let deleted = {};
          if (Array.isArray(parsed.deleted)) {
            parsed.deleted.forEach(id => {
              deleted[id] = new Date().toISOString();
            });
          } else if (parsed.deleted && typeof parsed.deleted === 'object') {
            deleted = parsed.deleted;
          }

          this.edits = {
            created: parsed.created || {},
            updated: parsed.updated || {},
            deleted: deleted,
            reverted: parsed.reverted || {}
          };
        }
      } catch (e) {
        console.warn('Error loading structure edits from localStorage:', e);
        this.edits = { created: {}, updated: {}, deleted: {}, reverted: {} };
      }
    }

    saveEdits() {
      try {
        if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
        localStorage.setItem(STORAGE_KEY_EDITS, JSON.stringify(this.edits));
      } catch (e) {
        console.error('Error saving structure edits to localStorage:', e);
      }
    }

    toggleEditMode(forceVal) {
      if (typeof forceVal === 'boolean') {
        this.isEditMode = forceVal;
      } else {
        this.isEditMode = !this.isEditMode;
      }
      this._updateUIState();
      return this.isEditMode;
    }

    _updateUIState() {
      const btnToggle = document.getElementById('btnToggleEditMode');
      const banner = document.getElementById('editModeBanner');
      const lbl = document.getElementById('lblEditMode');

      if (btnToggle) {
        if (this.isEditMode) {
          btnToggle.classList.add('active');
          if (lbl) lbl.textContent = 'Editing ON';
        } else {
          btnToggle.classList.remove('active');
          if (lbl) lbl.textContent = 'Edit Mode';
        }
      }

      if (banner) {
        banner.style.display = this.isEditMode ? 'flex' : 'none';
      }

      // If drawer is open and an asset is selected, switch drawer view mode
      const tabEdit = document.getElementById('tabEditMode');
      const tabInsp = document.getElementById('tabInspectionMode');
      if (tabEdit && tabInsp) {
        if (this.isEditMode) {
          this.setDrawerTab('edit');
        } else {
          this.setDrawerTab('inspection');
        }
      }

      if (window.showToast) {
        window.showToast(
          this.isEditMode
            ? '✏️ Edit Mode Activated: Tap any structure to edit, or click + Add Structure.'
            : '🔒 Read-Only Inspection Mode Activated.'
        );
      }
    }

    setDrawerTab(tabName) {
      const tabEdit = document.getElementById('tabEditMode');
      const tabInsp = document.getElementById('tabInspectionMode');
      const viewInsp = document.getElementById('drawerViewInspection');
      const viewEdit = document.getElementById('drawerViewEdit');

      if (!tabEdit || !tabInsp || !viewInsp || !viewEdit) return;

      if (tabName === 'edit') {
        tabEdit.classList.add('active');
        tabInsp.classList.remove('active');
        viewEdit.style.display = 'block';
        viewInsp.style.display = 'none';
        this.populateDrawerEditForm();
      } else {
        tabInsp.classList.add('active');
        tabEdit.classList.remove('active');
        viewInsp.style.display = 'block';
        viewEdit.style.display = 'none';
      }
    }

    populateDrawerEditForm() {
      const state = window.appState;
      if (!state || !state.selectedAsset) return;
      const p = state.selectedAsset.properties;

      const selTypology = document.getElementById('editSelectTypology');
      const txtStartPk = document.getElementById('editTxtStartPk');
      const txtEndPk = document.getElementById('editTxtEndPk');
      const chkIsPoint = document.getElementById('editChkIsPoint');
      const grpEnd = document.getElementById('groupEditEndPk');
      const selSide = document.getElementById('editSelectSide');
      const selLane = document.getElementById('editSelectLane');
      const txtSpecs = document.getElementById('editTxtSpecs');
      const txtDrawing = document.getElementById('editTxtDrawing');
      const txtNotes = document.getElementById('editTxtNotes');
      const lblLength = document.getElementById('editLblLength');
      const btnRevert = document.getElementById('btnRevertStructureEdit');
      const lblCustomBadge = document.getElementById('editCustomBadge');

      if (selTypology) {
        let found = false;
        for (let i = 0; i < selTypology.options.length; i++) {
          if (selTypology.options[i].value === p.typology || selTypology.options[i].text.includes(p.short_code)) {
            selTypology.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) selTypology.value = 'CUSTOM';
      }

      if (txtStartPk) txtStartPk.value = formatPk(p.start_pk || p.pk || 0);
      if (txtEndPk) txtEndPk.value = formatPk(p.end_pk || p.start_pk || p.pk || 0);
      if (chkIsPoint) chkIsPoint.checked = !!p.is_point;
      if (grpEnd) grpEnd.style.display = p.is_point ? 'none' : 'block';
      if (selSide) selSide.value = p.side || 'Left';

      // Infer physical lane from typology/category if not explicitly recorded
      const inferredLane = p.lane || (function () {
        const cat = (p.category || '').toLowerCase();
        const typ = (p.typology || '').toLowerCase();
        const code = (p.short_code || '').toLowerCase();
        if (cat.includes('channel') || typ.includes('channel') || code.includes('chan')) return 'Channel';
        if (cat.includes('crest') || typ.includes('crest') || code.includes('type 5') || code.includes('type 11')) return 'Crest';
        if (cat.includes('berm') || typ.includes('bench') || typ.includes('berm') || code.includes('type 8')) return 'Bench';
        if (cat.includes('toe') || typ.includes('foot of slope') || typ.includes('toe') || code.includes('type 7') || code.includes('type 4') || code.includes('type 12') || code.includes('riprap') || cat.includes('riprap') || cat.includes('dissipator')) return 'Toe';
        if (cat.includes('cross') || (p.is_point && p.side === 'Center')) return 'Centerline';
        return 'Shoulder';
      })();
      if (selLane) selLane.value = inferredLane;

      if (txtSpecs) txtSpecs.value = p.specs || '';
      if (txtDrawing) txtDrawing.value = p.drawing_ref || '';
      if (txtNotes) txtNotes.value = p.notes || '';
      if (lblLength) lblLength.textContent = p.is_point ? '0 m (Point)' : `${p.length_m || 0} m`;

      if (lblCustomBadge) {
        if (p.is_user_created) {
          lblCustomBadge.textContent = 'Site Added';
          lblCustomBadge.style.display = 'inline-block';
        } else if (this.isModified(p.id)) {
          lblCustomBadge.textContent = 'Modified';
          lblCustomBadge.style.display = 'inline-block';
        } else {
          lblCustomBadge.style.display = 'none';
        }
      }

      if (btnRevert) {
        btnRevert.style.display = (this.isModified(p.id) && !p.is_user_created) ? 'inline-flex' : 'none';
      }
    }

    // --- 5. Add / Create Structure ---
    addStructure(data) {
      const nowIso = new Date().toISOString();
      const startPk = parsePk(data.start_pk);
      const isPoint = !!data.is_point;
      const endPk = isPoint ? startPk : parsePk(data.end_pk || data.start_pk);
      const sPk = Math.min(startPk, endPk);
      const ePk = Math.max(startPk, endPk);

      const lengthM = isPoint ? 0 : Math.round(Math.abs(ePk - sPk) * 100) / 100;
      const chainageStr = formatChainageStr(sPk, ePk, isPoint);
      const section = sPk < 82902 ? '02' : '03';

      const newId = 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Find matching catalog default if available
      const catEntry = DRAINAGE_TYPOLOGIES.find(t => t.typology === data.typology || t.code === data.typology_code) || {};

      const shortCode = data.short_code || catEntry.short_code || 'Custom';
      const category = data.category || catEntry.category || 'Drainage Structure';
      const color = data.color || catEntry.color || '#38BDF8';
      const drawingRef = data.drawing_ref || catEntry.drawing_ref || 'Standard Details';
      const specs = data.specs || catEntry.specs || 'As-built site addition';
      const icon = data.icon || catEntry.icon || (isPoint ? 'marker' : 'ditch');
      const side = data.side || catEntry.sideDefault || 'Left';
      const lane = data.lane || catEntry.lane || (isPoint ? 'Toe' : 'Shoulder');
      const offsetM = typeof data.offsetM === 'number' ? data.offsetM : (catEntry.offsetM || (side === 'Left' ? -8.0 : 8.0));

      const geometry = computeGeometryForPk(sPk, ePk, isPoint, side, offsetM);

      const feature = {
        type: 'Feature',
        id: newId,
        properties: {
          id: newId,
          is_user_created: true,
          chainage_str: chainageStr,
          start_pk: sPk,
          end_pk: ePk,
          pk: sPk,
          length_m: lengthM,
          is_point: isPoint,
          side: side,
          position: `${side} (${lane})`,
          lane: lane,
          typology: data.typology || catEntry.typology || 'Custom Drainage Structure',
          typology_code: data.typology_code || catEntry.code || '',
          short_code: shortCode,
          category: category,
          color: color,
          drawing_ref: drawingRef,
          specs: specs,
          icon: icon,
          status: data.status || 'Not Started',
          notes: data.notes || '',
          inspection_date: '',
          section: section,
          created_at: nowIso,
          updated_at: nowIso
        },
        geometry: geometry
      };

      if (this.edits.deleted && this.edits.deleted[newId]) delete this.edits.deleted[newId];
      if (this.edits.reverted && this.edits.reverted[newId]) delete this.edits.reverted[newId];

      this.edits.created[newId] = feature;
      this.saveEdits();

      // Queue offline sync
      if (window.syncEngine && window.syncEngine.queueStructureEdit) {
        window.syncEngine.queueStructureEdit('struct_edit:' + newId, 'CREATE', feature);
      }

      this.refreshAppViews();

      if (window.selectAsset) {
        window.selectAsset(feature);
      }

      if (window.showToast) {
        window.showToast(`✔ Added Structure: ${shortCode} at ${chainageStr}`);
      }

      return feature;
    }

    // --- 6. Update / Modify Structure ---
    updateStructure(id, updatedFields) {
      const nowIso = new Date().toISOString();

      // 1. If user-created structure
      if (this.edits.created[id]) {
        const feat = this.edits.created[id];
        const p = feat.properties;

        Object.assign(p, updatedFields);
        p.updated_at = nowIso;

        if (updatedFields.start_pk !== undefined || updatedFields.end_pk !== undefined || updatedFields.is_point !== undefined || updatedFields.side !== undefined) {
          const sPk = Math.min(p.start_pk, p.end_pk);
          const ePk = Math.max(p.start_pk, p.end_pk);
          p.start_pk = sPk;
          p.end_pk = p.is_point ? sPk : ePk;
          p.pk = sPk;
          p.length_m = p.is_point ? 0 : Math.round(Math.abs(ePk - sPk) * 100) / 100;
          p.chainage_str = formatChainageStr(sPk, p.end_pk, p.is_point);
          p.section = sPk < 82902 ? '02' : '03';
          feat.geometry = computeGeometryForPk(sPk, p.end_pk, p.is_point, p.side, p.offsetM);
        }

        if (this.edits.reverted && this.edits.reverted[id]) delete this.edits.reverted[id];
        if (this.edits.deleted && this.edits.deleted[id]) delete this.edits.deleted[id];

        this.saveEdits();
        if (window.syncEngine && window.syncEngine.queueStructureEdit) {
          window.syncEngine.queueStructureEdit('struct_edit:' + id, 'UPDATE', feat);
        }
        this.refreshAppViews();
        if (window.selectAsset) window.selectAsset(feat);
        if (window.showToast) window.showToast(`✔ Updated Structure: ${p.short_code}`);
        return feat;
      }

      // 2. Base asset modification
      if (!this.edits.updated[id]) {
        this.edits.updated[id] = {
          properties: {},
          updated_at: nowIso
        };
      }

      const rec = this.edits.updated[id];
      Object.assign(rec.properties, updatedFields);
      rec.updated_at = nowIso;

      // Recompute geometry if chainage or side changed
      const baseFeat = this._getBaseFeatureById(id);
      if (baseFeat) {
        const p = Object.assign({}, baseFeat.properties, rec.properties);
        if (updatedFields.start_pk !== undefined || updatedFields.end_pk !== undefined || updatedFields.is_point !== undefined || updatedFields.side !== undefined) {
          const sPk = Math.min(p.start_pk, p.end_pk);
          const ePk = Math.max(p.start_pk, p.end_pk);
          p.start_pk = sPk;
          p.end_pk = p.is_point ? sPk : ePk;
          p.pk = sPk;
          p.length_m = p.is_point ? 0 : Math.round(Math.abs(ePk - sPk) * 100) / 100;
          p.chainage_str = formatChainageStr(sPk, p.end_pk, p.is_point);
          p.section = sPk < 82902 ? '02' : '03';
          rec.properties.start_pk = p.start_pk;
          rec.properties.end_pk = p.end_pk;
          rec.properties.length_m = p.length_m;
          rec.properties.chainage_str = p.chainage_str;
          rec.properties.section = p.section;
          rec.geometry = computeGeometryForPk(sPk, p.end_pk, p.is_point, p.side, p.offsetM);
        }
      }

      if (this.edits.reverted && this.edits.reverted[id]) delete this.edits.reverted[id];
      if (this.edits.deleted && this.edits.deleted[id]) delete this.edits.deleted[id];

      this.saveEdits();

      // Queue offline sync
      const fullMerged = this.getFeatureById(id);
      if (window.syncEngine && window.syncEngine.queueStructureEdit && fullMerged) {
        window.syncEngine.queueStructureEdit('struct_edit:' + id, 'UPDATE', fullMerged);
      }

      this.refreshAppViews();
      if (fullMerged && window.selectAsset) {
        window.selectAsset(fullMerged);
      }
      if (window.showToast) {
        window.showToast(`✔ Updated Structure: ${(fullMerged && fullMerged.properties.short_code) || id}`);
      }
      return fullMerged;
    }

    // --- 7. Delete Structure ---
    deleteStructure(id) {
      const nowIso = new Date().toISOString();

      if (this.edits.created[id]) {
        delete this.edits.created[id];
      }
      if (this.edits.updated[id]) {
        delete this.edits.updated[id];
      }
      if (this.edits.reverted && this.edits.reverted[id]) {
        delete this.edits.reverted[id];
      }

      if (!this.edits.deleted || Array.isArray(this.edits.deleted)) {
        this.edits.deleted = {};
      }
      this.edits.deleted[id] = nowIso;

      this.saveEdits();

      if (window.syncEngine && window.syncEngine.queueStructureEdit) {
        window.syncEngine.queueStructureEdit('struct_edit:' + id, 'DELETE', { id });
      }

      // Close drawer if deleted asset was selected
      const state = window.appState;
      if (state && state.selectedAsset && state.selectedAsset.properties.id === id) {
        state.selectedAsset = null;
        if (window.collapseDrawer) window.collapseDrawer();
      }

      this.refreshAppViews();

      if (window.showToast) {
        window.showToast(`🗑️ Structure deleted`);
      }
    }

    // --- 8. Revert Modified Structure to Design ---
    revertStructure(id) {
      const nowIso = new Date().toISOString();

      if (this.edits.updated[id]) {
        delete this.edits.updated[id];
      }
      if (this.edits.deleted && this.edits.deleted[id]) {
        delete this.edits.deleted[id];
      }

      if (!this.edits.reverted) {
        this.edits.reverted = {};
      }
      this.edits.reverted[id] = nowIso;

      this.saveEdits();

      if (window.syncEngine && window.syncEngine.queueStructureEdit) {
        window.syncEngine.queueStructureEdit('struct_edit:' + id, 'REVERT', { id });
      }

      this.refreshAppViews();
      const restored = this.getFeatureById(id);
      if (restored && window.selectAsset) {
        window.selectAsset(restored);
      }

      if (window.showToast) {
        window.showToast(`↩️ Reverted to original design: ${(restored && restored.properties.short_code) || id}`);
      }
    }

    isModified(id) {
      return !this.isDeleted(id) && !!this.edits.updated[id];
    }

    isCreated(id) {
      return !this.isDeleted(id) && !!this.edits.created[id];
    }

    isDeleted(id) {
      if (!this.edits.deleted) return false;
      if (Array.isArray(this.edits.deleted)) return this.edits.deleted.includes(id);
      return !!this.edits.deleted[id];
    }

    // --- 9. Merging Edits into Active Features ---
    applyEditsToFeatures(baseFeatures, activeSection) {
      if (!Array.isArray(baseFeatures)) return [];

      const merged = [];
      const baseIdSet = new Set();

      // 1. Filter out deleted features and apply updates to base features
      for (let i = 0; i < baseFeatures.length; i++) {
        const f = baseFeatures[i];
        const fid = f.properties && f.properties.id;
        if (fid) baseIdSet.add(fid);

        if (this.isDeleted(fid)) continue;

        if (this.edits.updated[fid]) {
          const mod = this.edits.updated[fid];
          const mergedProps = Object.assign({}, f.properties, mod.properties);
          const effSection = mergedProps.section || (mergedProps.start_pk < 82902 ? '02' : '03');

          // If this feature was moved out of activeSection, omit from this section view
          if (activeSection !== 'all' && effSection !== activeSection) {
            continue;
          }

          const updatedFeature = {
            type: 'Feature',
            id: fid,
            properties: mergedProps,
            geometry: mod.geometry || f.geometry
          };
          merged.push(updatedFeature);
        } else {
          merged.push(f);
        }
      }

      // 2. Append base features from another section that were moved INTO activeSection
      if (activeSection !== 'all') {
        for (const [uid, mod] of Object.entries(this.edits.updated)) {
          if (this.isDeleted(uid)) continue;
          if (this.edits.created[uid]) continue; // handled in step 3
          if (baseIdSet.has(uid)) continue; // already processed in step 1

          const movedFeat = this.getFeatureById(uid);
          if (!movedFeat) continue;

          const p = movedFeat.properties;
          const effSection = p.section || (p.start_pk < 82902 ? '02' : '03');
          if (effSection === activeSection) {
            merged.push(movedFeat);
          }
        }
      }

      // 3. Append user-created features
      for (const [cid, custFeat] of Object.entries(this.edits.created)) {
        if (this.isDeleted(cid)) continue;
        const p = custFeat.properties;
        const effSection = p.section || (p.start_pk < 82902 ? '02' : '03');
        if (activeSection === '02' && effSection !== '02') continue;
        if (activeSection === '03' && effSection !== '03') continue;
        merged.push(custFeat);
      }

      return merged;
    }

    _getBaseFeatureById(id) {
      const s02Feats = (window.SECTION02_ASSETS && window.SECTION02_ASSETS.features) || [];
      const s03Feats = (window.SECTION03_ASSETS && window.SECTION03_ASSETS.features) || [];
      return s02Feats.find(f => f.properties.id === id) || s03Feats.find(f => f.properties.id === id) || null;
    }

    getFeatureById(id) {
      if (this.isDeleted(id)) return null;
      if (this.edits.created[id]) return this.edits.created[id];
      const base = this._getBaseFeatureById(id);
      if (!base) return null;
      if (this.edits.updated[id]) {
        return {
          type: 'Feature',
          id: id,
          properties: Object.assign({}, base.properties, this.edits.updated[id].properties),
          geometry: this.edits.updated[id].geometry || base.geometry
        };
      }
      return base;
    }

    refreshAppViews() {
      if (window.syncActiveDataPointers) window.syncActiveDataPointers();
      if (typeof window.updateProgressHUD === 'function') window.updateProgressHUD();
      if (typeof window.renderAssets === 'function') window.renderAssets();
      if (window.sldViewer && typeof window.sldViewer.render === 'function') window.sldViewer.render();
      if (window.cadViewer && typeof window.cadViewer.render === 'function') window.cadViewer.render();
      if (window.chainageScrubber && typeof window.chainageScrubber.queryNearbyFeatures === 'function') {
        window.chainageScrubber.queryNearbyFeatures();
      }
      if (window.projectDashboard && typeof window.projectDashboard.render === 'function') {
        window.projectDashboard.render();
      }
    }

    // --- 10. Supabase Sync Payload Packaging ---
    getSyncPayload(featureId) {
      if (this.edits.reverted && this.edits.reverted[featureId]) {
        return {
          action: 'REVERT',
          feature: { id: featureId },
          updated_at: this.edits.reverted[featureId]
        };
      }
      if (this.isDeleted(featureId)) {
        const delTime = (this.edits.deleted && typeof this.edits.deleted === 'object' && !Array.isArray(this.edits.deleted) && this.edits.deleted[featureId]) || new Date().toISOString();
        return {
          action: 'DELETE',
          feature: { id: featureId },
          updated_at: delTime
        };
      }
      if (this.edits.created[featureId]) {
        return {
          action: 'CREATE',
          feature: this.edits.created[featureId],
          updated_at: this.edits.created[featureId].properties.updated_at
        };
      }
      if (this.edits.updated[featureId]) {
        return {
          action: 'UPDATE',
          feature: this.getFeatureById(featureId),
          updated_at: this.edits.updated[featureId].updated_at
        };
      }
      return null;
    }

    mergeCloudEdit(assetId, editPayload, cloudUpdatedAt) {
      if (!editPayload || !editPayload.action) return false;
      const fid = editPayload.feature_id || assetId.replace('struct_edit:', '');
      const action = editPayload.action.toUpperCase();
      const cloudTime = new Date(cloudUpdatedAt || editPayload.timestamp || 0).getTime();

      let localTime = 0;
      if (this.edits.created[fid]) {
        localTime = new Date(this.edits.created[fid].properties.updated_at || 0).getTime();
      } else if (this.edits.updated[fid]) {
        localTime = new Date(this.edits.updated[fid].updated_at || 0).getTime();
      } else if (this.isDeleted(fid)) {
        const delIso = (this.edits.deleted && typeof this.edits.deleted === 'object' && !Array.isArray(this.edits.deleted) && this.edits.deleted[fid]) || 0;
        localTime = new Date(delIso).getTime();
      } else if (this.edits.reverted && this.edits.reverted[fid]) {
        localTime = new Date(this.edits.reverted[fid]).getTime();
      }

      // Conflict Resolution: Last-Write-Wins based on timestamp
      if (localTime > cloudTime) {
        return false; // Local change is newer; reject stale cloud edit
      }

      if (action === 'REVERT') {
        delete this.edits.updated[fid];
        if (this.edits.deleted && this.edits.deleted[fid]) delete this.edits.deleted[fid];
        if (!this.edits.reverted) this.edits.reverted = {};
        this.edits.reverted[fid] = cloudUpdatedAt || new Date().toISOString();
        this.saveEdits();
        return true;
      } else if (action === 'CREATE' && editPayload.data) {
        if (this.edits.deleted && this.edits.deleted[fid]) delete this.edits.deleted[fid];
        if (this.edits.reverted && this.edits.reverted[fid]) delete this.edits.reverted[fid];
        this.edits.created[fid] = editPayload.data;
        this.saveEdits();
        return true;
      } else if (action === 'UPDATE' && editPayload.data) {
        if (this.edits.deleted && this.edits.deleted[fid]) delete this.edits.deleted[fid];
        if (this.edits.reverted && this.edits.reverted[fid]) delete this.edits.reverted[fid];
        if (this.edits.created[fid]) {
          this.edits.created[fid] = editPayload.data;
        } else {
          this.edits.updated[fid] = {
            properties: editPayload.data.properties || {},
            geometry: editPayload.data.geometry,
            updated_at: cloudUpdatedAt
          };
        }
        this.saveEdits();
        return true;
      } else if (action === 'DELETE') {
        delete this.edits.created[fid];
        delete this.edits.updated[fid];
        if (this.edits.reverted && this.edits.reverted[fid]) delete this.edits.reverted[fid];
        if (!this.edits.deleted || Array.isArray(this.edits.deleted)) this.edits.deleted = {};
        this.edits.deleted[fid] = cloudUpdatedAt || new Date().toISOString();
        this.saveEdits();
        return true;
      }
      return false;
    }
  }

  // Instantiate & Expose
  window.DRAINAGE_TYPOLOGIES = DRAINAGE_TYPOLOGIES;
  window.editManager = new EditManager();
  window.computeGeometryForPk = computeGeometryForPk;
  window.interpolateCenterline = interpolateCenterline;
  window.parsePk = parsePk;
  window.formatPk = formatPk;
})();
