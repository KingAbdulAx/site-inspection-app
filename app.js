/**
 * KMD DRAINAGE FIELD INSPECTOR & ALIGNMENT TRACKER (PWA)
 * Core Client Engine: Spatial Projection, Leaflet GIS, Local Persistence & Excel Export
 */

(function () {
  'use strict';

  // --- 1. Global State ---
  const state = {
    map: null,
    activeSection: localStorage.getItem('KMD_ACTIVE_SECTION') || 'all', // 'all', '02', '03' (defaults to 'all')
    centerlineData: null,
    assetsData: null,
    viewMode: 'typology', // 'typology' or 'progress'
    activeFilter: 'all',  // 'all', 'ditches', 'structures', 'status_not_started', 'status_ongoing', 'status_completed', 'status_defect'
    selectedAsset: null,
    gpsWatchId: null,
    isLocating: false,
    userGpsMarker: null,
    userAccuracyCircle: null,
    userCurrentPk: null,
    userCurrentOffset: null,
    inspections: {}, // Stored progress: { assetId: { status, notes, hasDefect, date, photos } }
    mapLayers: {
      centerline: null,
      ticks100m: null,
      ticks1km: null,
      ditches: null,
      structures: null,
      gridOffline: null
    }
  };
  window.appState = state;

  // --- 1.5. Multi-Section Data Helpers ---
  function getActiveCenterlines() {
    if (state.activeSection === '02') {
      return window.SECTION02_CENTERLINE ? [window.SECTION02_CENTERLINE] : [];
    } else if (state.activeSection === '03') {
      return window.SECTION03_CENTERLINE ? [window.SECTION03_CENTERLINE] : [];
    } else {
      // 'all'
      const list = [];
      if (window.SECTION02_CENTERLINE) list.push(window.SECTION02_CENTERLINE);
      if (window.SECTION03_CENTERLINE) list.push(window.SECTION03_CENTERLINE);
      return list;
    }
  }

  function getActiveFeatures() {
    const s02Feats = (window.SECTION02_ASSETS && window.SECTION02_ASSETS.features) || [];
    const s03Feats = (window.SECTION03_ASSETS && window.SECTION03_ASSETS.features) || [];
    if (state.activeSection === '02') {
      return s02Feats;
    } else if (state.activeSection === '03') {
      return s03Feats;
    } else {
      // 'all'
      return [...s02Feats, ...s03Feats];
    }
  }

  function syncActiveDataPointers() {
    const cls = getActiveCenterlines();
    state.centerlineData = cls.length === 1 ? cls[0] : (cls[0] || null);
    state.assetsData = {
      type: 'FeatureCollection',
      features: getActiveFeatures()
    };
  }

  // --- 2. Local Storage Persistence & KPI Tracker ---
  const STORAGE_KEY_S03 = 'KMD_DRAINAGE_INSPECTIONS_SEC03_V1';
  const STORAGE_KEY_S02 = 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1';

  function loadInspectionsFromStorage() {
    try {
      state.inspections = {};
      const rawS03 = localStorage.getItem(STORAGE_KEY_S03);
      if (rawS03) Object.assign(state.inspections, JSON.parse(rawS03));
      const rawS02 = localStorage.getItem(STORAGE_KEY_S02);
      if (rawS02) Object.assign(state.inspections, JSON.parse(rawS02));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function saveInspectionsToStorage() {
    try {
      const s03 = {};
      const s02 = {};
      for (const [id, val] of Object.entries(state.inspections)) {
        if (id.startsWith('s02_')) {
          s02[id] = val;
        } else {
          s03[id] = val;
        }
      }
      localStorage.setItem(STORAGE_KEY_S03, JSON.stringify(s03));
      localStorage.setItem(STORAGE_KEY_S02, JSON.stringify(s02));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }
  window.saveInspectionsToStorage = saveInspectionsToStorage;

  function updateProgressHUD() {
    const feats = getActiveFeatures();
    const total = feats.length;
    let notStarted = 0;
    let ongoing = 0;
    let completed = 0;
    let defects = 0;

    feats.forEach(f => {
      const p = f.properties;
      const insp = state.inspections[p.id] || {};
      const status = insp.status || 'Not Started';

      if (insp.hasDefect) {
        defects++;
      }

      if (status === 'Completed & Approved' || status === 'Completed') {
        completed++;
      } else if (status === 'Not Started') {
        notStarted++;
      } else {
        ongoing++;
      }
    });

    const elTotal = document.getElementById('kpiTotal');
    const elNotStarted = document.getElementById('kpiNotStarted');
    const elOngoing = document.getElementById('kpiOngoing');
    const elCompleted = document.getElementById('kpiCompleted');
    const elDefects = document.getElementById('kpiDefects');

    if (elTotal) elTotal.textContent = total;
    if (elNotStarted) elNotStarted.textContent = notStarted;
    if (elOngoing) elOngoing.textContent = ongoing;
    if (elCompleted) elCompleted.textContent = completed;
    if (elDefects) elDefects.textContent = defects;
  }

  // --- 3. Mathematical Orthogonal Projection ---
  // Earth radius in meters
  const R_EARTH = 6371000.0;

  function projectGpsToAlignment(gpsLat, gpsLon) {
    const centerlines = getActiveCenterlines();
    if (centerlines.length === 0) return null;

    let globalBest = null;

    centerlines.forEach(cl => {
      const pts = cl.dense_points;
      if (!pts || pts.length < 2) return;

      let bestDistSq = Infinity;
      let bestSegmentIdx = 0;

      // 1. Fast coarse search to find closest vertex
      for (let i = 0; i < pts.length; i += 2) {
        const dLat = (gpsLat - pts[i].lat) * 111139.0;
        const dLon = (gpsLon - pts[i].lon) * 111139.0 * Math.cos((gpsLat * Math.PI) / 180);
        const dSq = dLat * dLat + dLon * dLon;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestSegmentIdx = Math.max(0, i - 1);
        }
      }

      // 2. Local fine orthogonal projection on adjacent segments
      const searchStart = Math.max(0, bestSegmentIdx - 4);
      const searchEnd = Math.min(pts.length - 2, bestSegmentIdx + 4);

      let finalPk = pts[bestSegmentIdx].pk;
      let finalOffset = 0;
      let minPerpDist = Infinity;
      let finalBearing = pts[bestSegmentIdx].bearing;

      for (let i = searchStart; i <= searchEnd; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        // Convert to local planar meters relative to p1
        const cosLat = Math.cos((p1.lat * Math.PI) / 180.0);
        const vx = (p2.lon - p1.lon) * ((Math.PI * R_EARTH) / 180.0) * cosLat;
        const vy = (p2.lat - p1.lat) * ((Math.PI * R_EARTH) / 180.0);

        const ux = (gpsLon - p1.lon) * ((Math.PI * R_EARTH) / 180.0) * cosLat;
        const uy = (gpsLat - p1.lat) * ((Math.PI * R_EARTH) / 180.0);

        const lenSq = vx * vx + vy * vy;
        if (lenSq === 0) continue;

        let t = (ux * vx + uy * vy) / lenSq;
        t = Math.max(0, Math.min(1, t)); // Clamp to segment

        const projX = t * vx;
        const projY = t * vy;

        const dx = ux - projX;
        const dy = uy - projY;
        const perpDist = Math.sqrt(dx * dx + dy * dy);

        if (perpDist < minPerpDist) {
          minPerpDist = perpDist;
          finalPk = p1.pk + t * (p2.pk - p1.pk);
          finalBearing = p1.bearing;

          const cross = vy * ux - vx * uy;
          finalOffset = (cross >= 0 ? 1 : -1) * perpDist;
        }
      }

      if (!globalBest || minPerpDist < globalBest.distM) {
        globalBest = {
          pk: finalPk,
          offsetM: finalOffset,
          distM: minPerpDist,
          bearing: finalBearing,
          section: cl.metadata ? cl.metadata.section : ''
        };
      }
    });

    return globalBest;
  }
  window.projectGpsToAlignment = projectGpsToAlignment;

  // --- 4. Leaflet Map Initialization ---
  function initMap() {
    loadInspectionsFromStorage();

    // Default center at PK 84+406 (Overbridge OVR-2801)
    const initialLat = 12.6328;
    const initialLon = 8.3948;

    state.map = L.map('map', {
      center: [initialLat, initialLon],
      zoom: 16,
      minZoom: 11,
      maxZoom: 20,
      zoomControl: false,
      rotate: true,
      touchRotate: true,
      touchZoom: true,
      shiftKeyRotate: true,
      rotateControl: false
    });

    if (state.map.on) {
      state.map.on('rotate', onMapRotate);
    }

    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // Basemap Layers (Official, fast, free & zero watermark)
    const esriDarkBase = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri Dark Canvas &mdash; Kano–Maradi Railway' }
    );
    const esriDarkRef = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, pane: 'shadowPane' }
    );
    const esriDarkCanvas = L.layerGroup([esriDarkBase, esriDarkRef]);

    const esriLightBase = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri Light Canvas &mdash; Kano–Maradi Railway' }
    );
    const esriLightRef = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, pane: 'shadowPane' }
    );
    const esriLightCanvas = L.layerGroup([esriLightBase, esriLightRef]);

    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    const esriSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Kano–Maradi Railway'
      }
    );

    // Offline Dark Slate Grid Layer (zero internet fallback)
    const offlineCanvasLayer = L.GridLayer.extend({
      createTile: function (coords) {
        const tile = document.createElement('canvas');
        tile.width = 256;
        tile.height = 256;
        const ctx = tile.getContext('2d');
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(256, 0);
        ctx.moveTo(0, 0); ctx.lineTo(0, 256);
        ctx.stroke();
        return tile;
      }
    });

    const offlineGrid = new offlineCanvasLayer();

    // Default to Barebones Dark ("just enough to see wagwan" without satellite clutter)
    esriDarkCanvas.addTo(state.map);

    const baseMaps = {
      'Dark Slate Canvas (Esri)': esriDarkCanvas,
      'Light Gray Canvas (Esri)': esriLightCanvas,
      'Street Map (OSM)': osmStandard,
      'Satellite Imagery (Esri)': esriSatellite,
      'Offline Technical Grid': offlineGrid
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(state.map);

    // Initialize layer groups
    state.mapLayers.centerline = L.layerGroup().addTo(state.map);
    state.mapLayers.ticks100m = L.layerGroup().addTo(state.map);
    state.mapLayers.ticks1km = L.layerGroup().addTo(state.map);
    state.mapLayers.ditches = L.layerGroup().addTo(state.map);
    state.mapLayers.structures = L.layerGroup().addTo(state.map);

    // Initialize active section data, UI, and fit bounds
    setSection(state.activeSection, true);

    // Map Click Handler (deselect / close drawer if clicking background)
    state.map.on('click', function (e) {
      if (e.originalEvent.target.id === 'map' || e.originalEvent.target.classList.contains('leaflet-container')) {
        collapseDrawer();
      }
    });

    setupEventListeners();
    window.selectAsset = selectAsset;
    window.setMapMode = setMapMode;
    window.setFilter = setFilter;
    window.__APP_STATE = state;
  }

  // --- 4.5. Mode and Filter Management ---
  function setMapMode(mode) {
    if (state.viewMode === mode) return;
    state.viewMode = mode;

    const btnTypology = document.getElementById('btnModeTypology');
    const btnProgress = document.getElementById('btnModeProgress');

    if (mode === 'progress') {
      btnProgress.classList.add('active');
      btnTypology.classList.remove('active');
      showToast('Switched to Birds-Eye Progress View (Status Colors)');
    } else {
      btnTypology.classList.add('active');
      btnProgress.classList.remove('active');
      showToast('Switched to Typology View (Standard Detail Colors)');
    }

    renderAssets();
  }

  function setFilter(filterValue) {
    state.activeFilter = filterValue;
    const select = document.getElementById('selectFilter');
    if (select && select.value !== filterValue) {
      select.value = filterValue;
    }

    // Update KPI chip active classes
    const chips = document.querySelectorAll('.kpi-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-filter') === filterValue) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    renderAssets();
    const cleanName = filterValue.replace('status_', '').replace('_', ' ').toUpperCase();
    showToast(`Filter: ${cleanName}`);
  }

  function isAssetMatchingFilter(feat, filter) {
    if (!filter || filter === 'all') return true;
    const p = feat.properties;
    const insp = state.inspections[p.id] || {};
    const status = insp.status || 'Not Started';

    if (filter === 'ditches') {
      return p.category !== 'Cross Drainage' && p.category !== 'Overhead Crossing' && p.category !== 'Underpass' && p.category !== 'Riprap Protection' && p.category !== 'Water Descent' && p.category !== 'Energy Dissipator';
    }
    if (filter === 'structures') {
      return p.category === 'Cross Drainage' || p.category === 'Overhead Crossing' || p.category === 'Underpass';
    }
    if (filter === 'slope_protection') {
      return p.category === 'Riprap Protection' || p.category === 'Water Descent' || p.category === 'Energy Dissipator';
    }
    if (filter === 'status_not_started') {
      return status === 'Not Started';
    }
    if (filter === 'status_ongoing') {
      return status !== 'Not Started' && status !== 'Completed & Approved' && status !== 'Completed';
    }
    if (filter === 'status_completed') {
      return status === 'Completed & Approved' || status === 'Completed';
    }
    if (filter === 'status_defect') {
      return !!insp.hasDefect;
    }
    return true;
  }

  // --- 5. Render Track Centerline & Station Ticks ---
  function renderCenterline() {
    if (!state.mapLayers.centerline) return;
    state.mapLayers.centerline.clearLayers();
    state.mapLayers.ticks100m.clearLayers();
    state.mapLayers.ticks1km.clearLayers();

    const centerlines = getActiveCenterlines();
    if (centerlines.length === 0) return;

    centerlines.forEach(cl => {
      if (!cl.geojson || !cl.geojson.features || !cl.geojson.features[0]) return;
      const coords = cl.geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

      // Outer track casing (Dark Slate)
      L.polyline(coords, {
        color: '#0F172A',
        weight: 7,
        opacity: 0.95,
        lineCap: 'round'
      }).addTo(state.mapLayers.centerline);

      // Mid track rail ballast line (Sky Blue)
      L.polyline(coords, {
        color: '#0284C7',
        weight: 4,
        opacity: 0.85
      }).addTo(state.mapLayers.centerline);

      // Inner railroad sleeper dashed line (Crisp White)
      L.polyline(coords, {
        color: '#FFFFFF',
        weight: 2.5,
        dashArray: '6, 8',
        opacity: 1.0
      }).addTo(state.mapLayers.centerline);

      // 100m Station Ticks
      const ticks100 = cl.ticks_100m || [];
      ticks100.forEach(t => {
        const isMajor = t.is_major;
        const html = `<div class="chainage-pill ${isMajor ? 'major' : ''}">${t.label}</div>`;

        const icon = L.divIcon({
          className: 'chainage-label-icon',
          html: html,
          iconSize: [40, 16],
          iconAnchor: [20, 8]
        });

        const marker = L.marker([t.lat, t.lon], { icon: icon, interactive: true });
        marker.bindTooltip(`Chainage Station: ${t.full_label}`, { direction: 'top' });
        marker.on('click', () => {
          state.map.setView([t.lat, t.lon], 18);
          showToast(`Centered at ${t.full_label}`);
        });

        if (isMajor) {
          marker.addTo(state.mapLayers.ticks1km);
        } else {
          marker.addTo(state.mapLayers.ticks100m);
        }
      });
    });

    // Dynamic tick display based on zoom level
    updateTickVisibility();
  }

  function updateTickVisibility() {
    if (!state.map) return;
    const zoom = state.map.getZoom();
    if (zoom >= 16) {
      if (!state.map.hasLayer(state.mapLayers.ticks100m)) {
        state.map.addLayer(state.mapLayers.ticks100m);
      }
    } else {
      if (state.map.hasLayer(state.mapLayers.ticks100m)) {
        state.map.removeLayer(state.mapLayers.ticks100m);
      }
    }
  }

  // --- 6. Render Drainage Assets ---
  function renderAssets() {
    if (!state.mapLayers.ditches || !state.mapLayers.structures) return;

    state.mapLayers.ditches.clearLayers();
    state.mapLayers.structures.clearLayers();

    const feats = getActiveFeatures();
    if (feats.length === 0) return;

    const isProgressMode = state.viewMode === 'progress';

    feats.forEach(feat => {
      if (!isAssetMatchingFilter(feat, state.activeFilter)) return;

      const p = feat.properties;
      const geom = feat.geometry;
      const insp = state.inspections[p.id] || {};
      const status = insp.status || 'Not Started';
      const hasDefect = !!insp.hasDefect;

      let strokeColor = p.color;
      let strokeOpacity = 0.9;
      let strokeWeight = p.category === 'Cross Drainage' ? 6 : 4;
      let strokeDash = p.typology.includes('Type 6') ? '6, 6' : undefined;
      let pinClass = 'custom-pin';
      let pinColor = p.color;

      if (isProgressMode) {
        if (hasDefect) {
          strokeColor = '#EF4444';
          strokeWeight = 6;
          strokeOpacity = 1.0;
          strokeDash = undefined;
          pinClass = 'custom-pin status-defect';
          pinColor = '#EF4444';
        } else if (status === 'Completed & Approved' || status === 'Completed') {
          strokeColor = '#10B981';
          strokeWeight = 5;
          strokeOpacity = 1.0;
          strokeDash = undefined;
          pinClass = 'custom-pin status-completed';
          pinColor = '#10B981';
        } else if (status !== 'Not Started') {
          strokeColor = '#F59E0B';
          strokeWeight = 6;
          strokeOpacity = 1.0;
          strokeDash = undefined;
          pinClass = 'custom-pin status-ongoing';
          pinColor = '#F59E0B';
        } else {
          // Not Started
          strokeColor = '#64748B';
          strokeWeight = 3.5;
          strokeOpacity = 0.65;
          strokeDash = '5, 5';
          pinClass = 'custom-pin status-not-started';
          pinColor = '#475569';
        }
      }

      const statusBadge = hasDefect
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#EF4444;color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.02em;">DEFECT / SNAG</span>`
        : (status === 'Completed & Approved' || status === 'Completed')
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#10B981;color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.02em;">APPROVED</span>`
        : status !== 'Not Started'
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#F59E0B;color:#000;font-size:10px;font-weight:bold;letter-spacing:0.02em;">${status.toUpperCase()}</span>`
        : `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#475569;color:#CBD5E1;font-size:10px;">NOT STARTED</span>`;

      if (geom.type === 'LineString') {
        const latlngs = geom.coordinates.map(c => [c[1], c[0]]);

        const line = L.polyline(latlngs, {
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity,
          dashArray: strokeDash
        });

        line.bindTooltip(
          `<strong>${p.short_code}</strong> | ${p.chainage_str}<br><small>${p.position}</small><br>${statusBadge}`,
          { sticky: true }
        );

        line.on('click', function () {
          selectAsset(feat);
        });

        if (p.category === 'Cross Drainage' || p.category === 'Overhead Crossing' || p.category === 'Underpass') {
          line.addTo(state.mapLayers.structures);
        } else {
          line.addTo(state.mapLayers.ditches);
        }
      } else if (geom.type === 'Point') {
        const latlng = [geom.coordinates[1], geom.coordinates[0]];

        let iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
        if (p.category === 'Cross Drainage') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
        } else if (p.category === 'Overhead Crossing') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18M4 14a8 8 0 0 1 16 0M3 18v-4M21 18v-4"/></svg>';
        } else if (p.category === 'Underpass') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10"/><path d="M9 19v-6a3 3 0 0 1 6 0v6"/></svg>';
        } else if (p.category === 'Shoulder / Cascade' || p.category === 'Water Descent') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/><polyline points="6 4 12 10 18 4"/></svg>';
        } else if (p.category === 'Riprap Protection') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>';
        } else if (p.category === 'Energy Dissipator') {
          iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
        }

        const customIcon = L.divIcon({
          className: 'custom-pin-container',
          html: `<div class="${pinClass}" style="background:${pinColor};">${iconSvg}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker(latlng, { icon: customIcon });
        marker.bindTooltip(
          `<strong>${p.short_code}</strong> | ${p.chainage_str}<br><small>${p.typology}</small><br>${statusBadge}`,
          { direction: 'top' }
        );

        marker.on('click', function () {
          selectAsset(feat);
        });

        marker.addTo(state.mapLayers.structures);
      }
    });
  }

  // --- 7. Drawer & Inspection Card Handlers ---
  function selectAsset(feat) {
    window.selectAsset = selectAsset;
    state.selectedAsset = feat;
    const p = feat.properties;
    const insp = state.inspections[p.id] || {};
    const status = insp.status || 'Not Started';

    // Populate Drawer Elements
    document.getElementById('drawerAssetCode').textContent = p.short_code;
    document.getElementById('drawerAssetCode').style.backgroundColor = p.color;
    document.getElementById('drawerAssetCode').style.color = '#FFFFFF';

    document.getElementById('drawerSideBadge').textContent = p.side;
    document.getElementById('drawerSideBadge').style.backgroundColor =
      p.side === 'Left' ? '#1D4ED8' : p.side === 'Right' ? '#EA580C' : '#475569';
    document.getElementById('drawerSideBadge').style.color = '#FFFFFF';

    document.getElementById('drawerChainage').textContent = p.chainage_str;
    document.getElementById('drawerPosition').textContent = p.position;

    // Spec Grid
    document.getElementById('specTypology').textContent = p.typology;
    document.getElementById('specLength').textContent = p.length_m > 0 ? `${p.length_m} m` : 'Cross Structure';
    document.getElementById('specDrawing').textContent = p.drawing_ref || 'Standard Details';
    document.getElementById('specDimensions').textContent = p.specs || 'Per Detail Drawing';

    // Status Buttons
    updateMilestoneButtonsUI(status);

    // Notes
    document.getElementById('defectNotes').value = insp.notes || '';
    document.getElementById('chkDefect').checked = !!insp.hasDefect;

    // Open Drawer in Compact MID State (shows specs + milestones without covering map)
    midDrawer();

    // Highlight on Map
    if (feat.geometry.type === 'Point') {
      state.map.panTo([feat.geometry.coordinates[1], feat.geometry.coordinates[0]], { animate: true });
    } else {
      const coords = feat.geometry.coordinates;
      const midIdx = Math.floor(coords.length / 2);
      state.map.panTo([coords[midIdx][1], coords[midIdx][0]], { animate: true });
    }
  }
  state.selectAsset = selectAsset;

  function updateMilestoneButtonsUI(activeStatus) {
    const buttons = document.querySelectorAll('.btn-milestone');
    buttons.forEach(btn => {
      const s = btn.getAttribute('data-status');
      btn.classList.remove('selected', 'approved');
      if (s === activeStatus || (activeStatus === 'Completed' && s === 'Completed & Approved')) {
        if (s === 'Completed & Approved') {
          btn.classList.add('approved');
        } else {
          btn.classList.add('selected');
        }
      }
    });
  }

  // --- 7.5. Three-Point Drawer Controller (Peek, Mid, Full, Hidden) ---
  let currentDrawerState = 'collapsed';

  function setDrawerState(targetState) {
    const d = document.getElementById('inspectionDrawer');
    if (!d) return;

    d.style.transform = ''; // Clear inline styles from drag
    d.classList.remove('dragging');
    d.classList.remove('hidden', 'collapsed', 'mid', 'expanded');
    d.classList.add(targetState);
    currentDrawerState = targetState;
  }

  function expandDrawer() {
    setDrawerState('expanded');
  }

  function midDrawer() {
    setDrawerState('mid');
  }

  function collapseDrawer() {
    setDrawerState('collapsed');
  }

  function hideDrawer() {
    setDrawerState('hidden');
  }

  function toggleDrawer() {
    if (currentDrawerState === 'collapsed' || currentDrawerState === 'hidden') {
      setDrawerState('mid');
    } else if (currentDrawerState === 'mid') {
      setDrawerState('expanded');
    } else {
      setDrawerState('collapsed');
    }
  }

  function saveCurrentInspection(showExplicitToast = true) {
    if (!state.selectedAsset) return;
    const p = state.selectedAsset.properties;

    const selectedBtn = document.querySelector('.btn-milestone.selected, .btn-milestone.approved');
    const status = selectedBtn ? selectedBtn.getAttribute('data-status') : 'Not Started';
    const notes = document.getElementById('defectNotes').value.trim();
    const hasDefect = document.getElementById('chkDefect').checked;

    const nowIso = new Date().toISOString();
    state.inspections[p.id] = {
      assetId: p.id,
      chainage_str: p.chainage_str,
      short_code: p.short_code,
      typology: p.typology,
      status: status,
      notes: notes,
      hasDefect: hasDefect,
      date: nowIso.replace('T', ' ').substring(0, 16),
      updated_at: nowIso,
      inspected_by: (window.APP_CONFIG && window.APP_CONFIG.inspectorName) || 'Engr. Abdulaziz A. A.'
    };

    saveInspectionsToStorage();
    if (window.syncEngine && window.syncEngine.queueAssetForSync) {
      window.syncEngine.queueAssetForSync(p.id);
    }
    updateProgressHUD();
    renderAssets(); // Re-render to show updated progress colors
    if (showExplicitToast) {
      showToast(`Saved progress for ${p.short_code} (${status})`);
    } else {
      showToast(`Updated to: ${status}`);
    }
  }

  // --- 8. Live GPS Tracking Engine ---
  function toggleGpsLocation() {
    const btn = document.getElementById('btnLocate');

    if (state.isLocating) {
      // Stop tracking
      if (state.gpsWatchId !== null) {
        navigator.geolocation.clearWatch(state.gpsWatchId);
        state.gpsWatchId = null;
      }
      state.isLocating = false;
      btn.classList.remove('active');
      document.getElementById('gpsStatusDot').classList.remove('active');
      document.getElementById('hudGpsState').textContent = 'GPS OFF';
      showToast('Live GPS Tracking Stopped');

      if (state.userGpsMarker) {
        state.map.removeLayer(state.userGpsMarker);
        state.userGpsMarker = null;
      }
      if (state.userAccuracyCircle) {
        state.map.removeLayer(state.userAccuracyCircle);
        state.userAccuracyCircle = null;
      }
    } else {
      // Start tracking
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      state.isLocating = true;
      btn.classList.add('active');
      document.getElementById('gpsStatusDot').classList.add('active');
      document.getElementById('hudGpsState').textContent = 'ACQUIRING...';
      showToast('Acquiring high-accuracy GPS signal...');

      state.gpsWatchId = navigator.geolocation.watchPosition(
        onGpsLocationSuccess,
        onGpsLocationError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 1000
        }
      );
    }
  }

  function onGpsLocationSuccess(pos) {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // Run Orthogonal Projection
    const proj = projectGpsToAlignment(lat, lon);

    if (proj) {
      state.userCurrentPk = proj.pk;
      state.userCurrentOffset = proj.offsetM;

      const km = Math.floor(proj.pk / 1000);
      const m = (proj.pk % 1000).toFixed(1);
      const sideText = proj.offsetM >= 0 ? `${proj.offsetM.toFixed(1)}m Right` : `${Math.abs(proj.offsetM).toFixed(1)}m Left`;

      document.getElementById('hudGpsState').textContent = 'LOCKED';
      document.getElementById('hudCurrentPk').textContent = `PK ${km}+${m.padStart(5, '0')}`;
      document.getElementById('hudCurrentOffset').textContent = sideText;
      document.getElementById('hudAccuracy').textContent = `±${Math.round(accuracy)}m`;
      // Note: Auto-opening drawer during GPS tracking disabled per engineering directive
    }

    // Update GPS Marker on Map
    const latlng = [lat, lon];
    if (!state.userGpsMarker) {
      const pulseIcon = L.divIcon({
        className: 'user-gps-pulse',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #FFFFFF;box-shadow:0 0 12px #3B82F6;"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      state.userGpsMarker = L.marker(latlng, { icon: pulseIcon }).addTo(state.map);
      state.userAccuracyCircle = L.circle(latlng, {
        radius: accuracy,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(state.map);
    } else {
      state.userGpsMarker.setLatLng(latlng);
      state.userAccuracyCircle.setLatLng(latlng);
      state.userAccuracyCircle.setRadius(accuracy);
    }

    // Follow user if close to track
    state.map.panTo(latlng, { animate: true });
  }

  function onGpsLocationError(err) {
    console.warn('GPS Error:', err);
    document.getElementById('hudGpsState').textContent = 'NO SIGNAL';
    showToast(`GPS Error: ${err.message}`);
  }

  // --- 8.4. Map Rotation & Compass Controller ---
  function onMapRotate() {
    if (!state.map || typeof state.map.getBearing !== 'function') return;
    const bearing = state.map.getBearing() || 0;
    const normalized = (bearing % 360 + 360) % 360;

    const needle = document.getElementById('compassNeedleSvg');
    if (needle) {
      // Needle points to true North (opposite of map bearing)
      needle.style.transform = `rotate(${-normalized}deg)`;
    }

    const lbl = document.getElementById('lblBearing');
    if (lbl) {
      let dir = 'N';
      if (normalized >= 22.5 && normalized < 67.5) dir = 'NE';
      else if (normalized >= 67.5 && normalized < 112.5) dir = 'E';
      else if (normalized >= 112.5 && normalized < 157.5) dir = 'SE';
      else if (normalized >= 157.5 && normalized < 202.5) dir = 'S';
      else if (normalized >= 202.5 && normalized < 247.5) dir = 'SW';
      else if (normalized >= 247.5 && normalized < 292.5) dir = 'W';
      else if (normalized >= 292.5 && normalized < 337.5) dir = 'NW';
      lbl.textContent = `${Math.round(normalized)}° ${dir}`;
    }

    const btn = document.getElementById('btnCompass');
    if (btn) {
      if (normalized > 2 && normalized < 358) {
        btn.classList.add('rotated');
      } else {
        btn.classList.remove('rotated');
      }
    }
  }

  function toggleMapBearing() {
    if (!state.map || typeof state.map.setBearing !== 'function') return;
    const bearing = state.map.getBearing() || 0;
    const normalized = (bearing % 360 + 360) % 360;

    // Nominal track corridor orientation for Section 03 is 314.5° (NW toward Daura)
    if (normalized > 4 && normalized < 356) {
      // If rotated, snap back to True North (0°)
      state.map.setBearing(0);
      showToast('Aligned to True North (0°)');
    } else {
      // Snap along the Railway Track Corridor (315° NW)
      state.map.setBearing(314.5);
      showToast('Aligned to Track Corridor (315° NW)');
    }
    onMapRotate();
  }

  // --- 8.5. Fluid Drawer Swipe Gestures & Snapping (Mobile Touch & Pointer) ---
  function setupDrawerGestures() {
    const d = document.getElementById('inspectionDrawer');
    const handleBar = document.getElementById('drawerHandleBar');
    const miniBar = document.getElementById('drawerMiniBar');
    const drawerContent = document.getElementById('drawerContent');
    const toggleBtn = document.getElementById('btnDrawerToggle');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDrawer();
      });
    }

    if (!d) return;

    let startY = 0;
    let currentY = 0;
    let startTime = 0;
    let isDragging = false;
    let initialTranslateY = 0;
    let hasMoved = false;

    function getSnapTranslate(stateName) {
      const drawerHeight = d.offsetHeight || 520;
      if (stateName === 'expanded') return 0;
      if (stateName === 'mid') return drawerHeight - 280;
      if (stateName === 'collapsed') return drawerHeight - 64;
      if (stateName === 'hidden') return drawerHeight;
      return drawerHeight - 64;
    }

    function startDrag(clientY) {
      isDragging = true;
      hasMoved = false;
      startY = clientY;
      currentY = clientY;
      startTime = Date.now();
      initialTranslateY = getSnapTranslate(currentDrawerState);

      d.classList.add('dragging');
      d.style.transition = 'none';
    }

    function moveDrag(clientY) {
      if (!isDragging) return;
      currentY = clientY;
      const deltaY = currentY - startY;

      if (Math.abs(deltaY) > 5) {
        hasMoved = true;
      }

      let newY = initialTranslateY + deltaY;
      if (newY < 0) {
        newY = newY * 0.22; // Rubberband resistance above top limit
      }

      d.style.transform = `translateY(${newY}px)`;
    }

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;

      d.classList.remove('dragging');
      d.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';

      const deltaY = currentY - startY;
      const duration = Math.max(Date.now() - startTime, 1);
      const velocity = deltaY / duration; // px/ms (+ down, - up)
      const currentTranslateY = initialTranslateY + deltaY;

      if (!hasMoved || Math.abs(deltaY) < 10) {
        // Tap action, not drag
        return;
      }

      // 1. High-velocity swipe flick detection
      if (velocity > 0.35) {
        // Fast swipe down
        if (currentDrawerState === 'expanded') {
          setDrawerState('mid');
        } else if (currentDrawerState === 'mid') {
          setDrawerState('collapsed');
        } else {
          setDrawerState('hidden');
        }
      } else if (velocity < -0.35) {
        // Fast swipe up
        if (currentDrawerState === 'collapsed' || currentDrawerState === 'hidden') {
          setDrawerState('mid');
        } else {
          setDrawerState('expanded');
        }
      } else {
        // 2. Position snap to closest target state
        const distExpanded = Math.abs(currentTranslateY - getSnapTranslate('expanded'));
        const distMid = Math.abs(currentTranslateY - getSnapTranslate('mid'));
        const distCollapsed = Math.abs(currentTranslateY - getSnapTranslate('collapsed'));
        const distHidden = Math.abs(currentTranslateY - getSnapTranslate('hidden'));

        if (distHidden < 55 && deltaY > 40) {
          setDrawerState('hidden');
        } else if (distExpanded <= distMid && distExpanded <= distCollapsed) {
          setDrawerState('expanded');
        } else if (distMid <= distExpanded && distMid <= distCollapsed) {
          setDrawerState('mid');
        } else {
          setDrawerState('collapsed');
        }
      }
    }

    // --- Native Touch Events (Mobile Safari / Chrome) ---
    function handleTouchStart(e) {
      if (e.target.closest('button, input, textarea, a, select')) return;
      if (e.touches && e.touches.length === 1) {
        startDrag(e.touches[0].clientY);
      }
    }

    function handleTouchMove(e) {
      if (!isDragging) return;
      if (e.touches && e.touches.length === 1) {
        moveDrag(e.touches[0].clientY);
        if (e.cancelable) {
          e.preventDefault(); // Stop mobile browser page scroll / pull-to-refresh
        }
      }
    }

    function handleTouchEnd(e) {
      endDrag();
    }

    // --- Pointer Events (Desktop Mouse & Stylus) ---
    function handlePointerDown(e) {
      if (e.pointerType === 'touch') return; // Handled by touch events
      if (e.target.closest('button, input, textarea, a, select')) return;

      startDrag(e.clientY);
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (err) {}

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    function handlePointerMove(e) {
      if (e.pointerType === 'touch') return;
      moveDrag(e.clientY);
    }

    function handlePointerUp(e) {
      if (e.pointerType === 'touch') return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      endDrag();
    }

    // Attach listeners to Handle Bar and Mini Bar
    const dragTargets = [handleBar, miniBar].filter(Boolean);
    dragTargets.forEach(target => {
      target.addEventListener('touchstart', handleTouchStart, { passive: false });
      target.addEventListener('touchmove', handleTouchMove, { passive: false });
      target.addEventListener('touchend', handleTouchEnd, { passive: false });
      target.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      target.addEventListener('pointerdown', handlePointerDown);
    });

    // Content top-edge swipe down (when scrolled to top)
    if (drawerContent) {
      let contentTouchStartY = 0;
      let isContentSwipingDown = false;

      drawerContent.addEventListener('touchstart', function(e) {
        if (drawerContent.scrollTop <= 0 && e.touches.length === 1) {
          contentTouchStartY = e.touches[0].clientY;
          isContentSwipingDown = false;
        }
      }, { passive: true });

      drawerContent.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && drawerContent.scrollTop <= 0) {
          const delta = e.touches[0].clientY - contentTouchStartY;
          if (delta > 10 && !isDragging) {
            isContentSwipingDown = true;
            startDrag(e.touches[0].clientY);
          }
          if (isDragging && isContentSwipingDown) {
            moveDrag(e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
          }
        }
      }, { passive: false });

      drawerContent.addEventListener('touchend', function() {
        if (isDragging && isContentSwipingDown) {
          isContentSwipingDown = false;
          endDrag();
        }
      }, { passive: false });
    }

    // Tap on handle bar or mini bar to cycle states
    if (handleBar) {
      handleBar.addEventListener('click', function (e) {
        if (!hasMoved) {
          toggleDrawer();
        }
      });
    }

    if (miniBar) {
      miniBar.addEventListener('click', function (e) {
        if (e.target.closest('button, input, textarea, a, select')) return;
        if (!hasMoved) {
          toggleDrawer();
        }
      });
    }
  }

  // --- 9. Quick Jump to PK ---
  function jumpToChainage() {
    const input = document.getElementById('txtJumpPk').value.trim();
    if (!input) return;

    let targetPk = null;
    const match = input.match(/(\d+)\s*[\+\.]\s*(\d+)/);
    if (match) {
      targetPk = parseInt(match[1]) * 1000 + parseFloat(match[2]);
    } else {
      const rawNum = parseFloat(input);
      if (!isNaN(rawNum)) {
        targetPk = rawNum < 500 ? rawNum * 1000 : rawNum;
      }
    }

    const centerlines = getActiveCenterlines();
    if (targetPk === null || centerlines.length === 0) {
      alert('Please enter a valid chainage, e.g. "24+500" or "84+400"');
      return;
    }

    let closestPt = null;
    let minDiff = Infinity;

    centerlines.forEach(cl => {
      const pts = cl.dense_points || [];
      for (const pt of pts) {
        const diff = Math.abs(pt.pk - targetPk);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = pt;
        }
      }
    });

    if (!closestPt) {
      alert('Could not locate chainage on active alignment.');
      return;
    }

    state.map.setView([closestPt.lat, closestPt.lon], 17, { animate: true });
    const km = Math.floor(targetPk / 1000);
    const m = Math.floor(targetPk % 1000);
    showToast(`Jumped to PK ${km}+${m.toString().padStart(3, '0')}`);
  }

  // --- 10. Filter Assets ---
  function applyLayerFilter() {
    const filter = document.getElementById('selectFilter').value;
    setFilter(filter);
  }

  // --- 11. Excel Progress Export ---
  function exportProgressExcel() {
    if (!window.XLSX) {
      alert('Excel export engine is loading, please try again in a moment.');
      return;
    }

    const rows = [];
    rows.push([
      'Asset ID',
      'Chainage Interval',
      'Side / Position',
      'Short Typology',
      'Full Description / Scope',
      'Applicable Drawing',
      'Cross-Section Specs',
      'Inspection Status',
      'Punchlist / Defect Notes',
      'Defect Flag',
      'Last Inspected Date'
    ]);

    const feats = getActiveFeatures();
    feats.forEach(f => {
      const p = f.properties;
      const insp = state.inspections[p.id] || {};
      rows.push([
        p.id,
        p.chainage_str,
        p.position,
        p.short_code,
        p.typology,
        p.drawing_ref,
        p.specs,
        insp.status || 'Not Started',
        insp.notes || '',
        insp.hasDefect ? 'YES' : 'NO',
        insp.date || ''
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 28 },
      { wch: 16 },
      { wch: 38 },
      { wch: 26 },
      { wch: 35 },
      { wch: 20 },
      { wch: 35 },
      { wch: 12 },
      { wch: 18 }
    ];

    const sheetName = state.activeSection === '02' ? 'Section 02' : (state.activeSection === '03' ? 'Section 03' : 'All Sections');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const today = new Date().toISOString().substring(0, 10);
    const fileSuffix = state.activeSection === '02' ? 'Section02' : (state.activeSection === '03' ? 'Section03' : 'All_Sections');
    XLSX.writeFile(wb, `KMD_${fileSuffix}_Drainage_Inspection_Progress_${today}.xlsx`);
    showToast(`Downloaded Excel Progress Report (${feats.length} assets)!`);
  }

  // --- 11.5. Section Selector Controller ---
  function setSection(sectionId, shouldFitBounds = true) {
    state.activeSection = sectionId;
    localStorage.setItem('KMD_ACTIVE_SECTION', sectionId);

    // Update tab buttons UI
    document.querySelectorAll('.btn-sec-tab').forEach(btn => {
      if (btn.getAttribute('data-section') === sectionId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update subtitle & jump placeholder
    const elSub = document.getElementById('lblSectionSubtitle');
    const txtJump = document.getElementById('txtJumpPk');
    if (sectionId === '02') {
      if (elSub) elSub.textContent = 'Section 02: DWKZ (PK 19+800 — 82+902)';
      if (txtJump) txtJump.placeholder = 'Jump to PK (e.g. 24+500)';
    } else if (sectionId === '03') {
      if (elSub) elSub.textContent = 'Section 03: KZDR (PK 82+902 — 124+521)';
      if (txtJump) txtJump.placeholder = 'Jump to PK (e.g. 84+400)';
    } else {
      if (elSub) elSub.textContent = 'All Sections: Dawanau to Daura (PK 19+800 — 124+521)';
      if (txtJump) txtJump.placeholder = 'Jump to PK (e.g. 24+500 or 84+400)';
    }

    syncActiveDataPointers();
    renderCenterline();
    renderAssets();
    updateProgressHUD();

    if (shouldFitBounds && state.map) {
      fitMapToActiveSection();
    }
  }
  window.setSection = setSection;

  function fitMapToActiveSection() {
    const cls = getActiveCenterlines();
    if (cls.length === 0 || !state.map) return;

    let allCoords = [];
    cls.forEach(cl => {
      if (cl.geojson && cl.geojson.features && cl.geojson.features[0]) {
        const coords = cl.geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        allCoords = allCoords.concat(coords);
      }
    });

    if (allCoords.length > 0) {
      state.map.fitBounds(L.polyline(allCoords).getBounds(), { padding: [30, 30] });
    }
  }
  window.fitMapToActiveSection = fitMapToActiveSection;

  // --- 12. UI Event Listeners ---
  function setupEventListeners() {
    // Section Selector Tabs (All, Section 02, Section 03)
    document.querySelectorAll('.btn-sec-tab').forEach(btn => {
      btn.addEventListener('click', function () {
        const sec = this.getAttribute('data-section');
        setSection(sec, true);
      });
    });

    const btnCompass = document.getElementById('btnCompass');
    if (btnCompass) {
      btnCompass.addEventListener('click', toggleMapBearing);
    }

    document.getElementById('btnLocate').addEventListener('click', toggleGpsLocation);
    document.getElementById('btnJump').addEventListener('click', jumpToChainage);
    document.getElementById('txtJumpPk').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') jumpToChainage();
    });

    // View Mode Toggle (Typology vs Birds-Eye Progress)
    const btnTypology = document.getElementById('btnModeTypology');
    const btnProgress = document.getElementById('btnModeProgress');
    if (btnTypology) btnTypology.addEventListener('click', () => setMapMode('typology'));
    if (btnProgress) btnProgress.addEventListener('click', () => setMapMode('progress'));

    // Progress KPI Chips Filter
    document.querySelectorAll('.kpi-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        const filter = this.getAttribute('data-filter');
        setFilter(filter);
      });
    });

    document.getElementById('selectFilter').addEventListener('change', applyLayerFilter);
    document.getElementById('btnExport').addEventListener('click', exportProgressExcel);

    // Initialize Fluid Touch Gestures & Snap Points (Swipe up / down)
    setupDrawerGestures();
    document.getElementById('btnCloseDrawer').addEventListener('click', collapseDrawer);
    document.getElementById('btnSaveInspection').addEventListener('click', () => saveCurrentInspection(true));

    // Defect Checkbox Toggle Listener (auto-saves defect state)
    const chkDefect = document.getElementById('chkDefect');
    if (chkDefect) {
      chkDefect.addEventListener('change', function () {
        saveCurrentInspection(false);
      });
    }

    // Milestone buttons (immediate feedback & auto-save)
    const milestoneBtns = document.querySelectorAll('.btn-milestone');
    milestoneBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        milestoneBtns.forEach(b => b.classList.remove('selected', 'approved'));
        const s = this.getAttribute('data-status');
        if (s === 'Completed & Approved') {
          this.classList.add('approved');
        } else {
          this.classList.add('selected');
        }
        // Auto-save on tap for immediate live map feedback
        saveCurrentInspection(false);
      });
    });

    // Cloud Sync & Cloud Settings Modal Listeners
    const btnSyncStatus = document.getElementById('btnSyncStatus');
    if (btnSyncStatus) {
      btnSyncStatus.addEventListener('click', function () {
        if (window.syncEngine) window.syncEngine.syncNow();
      });
    }

    const modalCloud = document.getElementById('modalCloudSettings');
    const btnCloudSettings = document.getElementById('btnCloudSettings');
    const btnCloseCloud = document.getElementById('btnCloseCloudSettings');
    const btnSaveCloud = document.getElementById('btnSaveCloudSettings');
    const btnModalSyncNow = document.getElementById('btnModalSyncNow');
    const btnTestCloudConn = document.getElementById('btnTestCloudConn');

    function openCloudModal() {
      if (!modalCloud) return;
      const cfg = window.APP_CONFIG || {};
      const devId = (window.syncEngine && window.syncEngine.getDeviceId) ? window.syncEngine.getDeviceId() : '—';
      const qCount = (window.syncEngine && window.syncEngine.getPendingCount) ? window.syncEngine.getPendingCount() : 0;
      const lastSync = window.syncState && window.syncState.lastSyncTime ? new Date(window.syncState.lastSyncTime).toLocaleTimeString() : 'Never';

      document.getElementById('cfgSupabaseUrl').value = cfg.supabaseUrl || '';
      document.getElementById('cfgSupabaseKey').value = cfg.supabaseAnonKey || '';
      document.getElementById('cfgInspectorName').value = cfg.inspectorName || '';
      document.getElementById('cfgDeviceId').textContent = devId;
      document.getElementById('cfgQueueCount').textContent = `${qCount} pending`;
      document.getElementById('cfgLastSync').textContent = lastSync;

      modalCloud.style.display = 'flex';
    }

    function closeCloudModal() {
      if (modalCloud) modalCloud.style.display = 'none';
    }

    if (btnCloudSettings) btnCloudSettings.addEventListener('click', openCloudModal);
    if (btnCloseCloud) btnCloseCloud.addEventListener('click', closeCloudModal);
    if (modalCloud) {
      modalCloud.addEventListener('click', function (e) {
        if (e.target === modalCloud) closeCloudModal();
      });
    }

    if (btnSaveCloud) {
      btnSaveCloud.addEventListener('click', function () {
        const url = document.getElementById('cfgSupabaseUrl').value.trim();
        const key = document.getElementById('cfgSupabaseKey').value.trim();
        const name = document.getElementById('cfgInspectorName').value.trim();

        if (window.APP_CONFIG_SAVE) {
          window.APP_CONFIG_SAVE({
            supabaseUrl: url,
            supabaseAnonKey: key,
            inspectorName: name
          });
        }
        showToast('Cloud settings saved.');
        closeCloudModal();
        if (window.syncEngine) window.syncEngine.syncNow();
      });
    }

    if (btnModalSyncNow) {
      btnModalSyncNow.addEventListener('click', function () {
        if (window.syncEngine) {
          window.syncEngine.syncNow();
          setTimeout(() => {
            const qCount = window.syncEngine.getPendingCount();
            document.getElementById('cfgQueueCount').textContent = `${qCount} pending`;
            document.getElementById('cfgLastSync').textContent = window.syncState.lastSyncTime ? new Date(window.syncState.lastSyncTime).toLocaleTimeString() : 'Just now';
          }, 1500);
        }
      });
    }

    if (btnTestCloudConn) {
      btnTestCloudConn.addEventListener('click', async function () {
        const url = document.getElementById('cfgSupabaseUrl').value.trim();
        const key = document.getElementById('cfgSupabaseKey').value.trim();
        if (!url || !key) {
          showToast('Please enter both Supabase URL and API Key.');
          return;
        }
        showToast('Testing connection...');
        try {
          const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/inspections?select=count`, {
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`
            }
          });
          if (resp.ok) {
            showToast('Connection Successful! (HTTP 200 OK)');
          } else {
            const err = await resp.text();
            showToast(`Connection Failed [HTTP ${resp.status}]: ${err.substring(0, 50)}`);
          }
        } catch (e) {
          showToast(`Network Error: ${e.message}`);
        }
      });
    }
  }

  // Hook for Cloud Sync to notify PWA of newly pulled inspections
  window.onExternalInspectionsUpdated = function () {
    updateProgressHUD();
    renderAssets();
    if (state.selectedAsset) {
      selectAsset(state.selectedAsset);
    }
    showToast('Updated with cloud changes.');
  };

  // Toast Notification
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }
  window.showToast = showToast;

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initMap);
})();
