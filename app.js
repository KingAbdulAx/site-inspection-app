/**
 * KMD DRAINAGE FIELD INSPECTOR & ALIGNMENT TRACKER (PWA)
 * Core Client Engine: Spatial Projection, Leaflet GIS, Local Persistence & Excel Export
 */

(function () {
  'use strict';

  // --- 1. Global State ---
  const state = {
    map: null,
    centerlineData: window.SECTION03_CENTERLINE || null,
    assetsData: window.SECTION03_ASSETS || null,
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

  // --- 2. Local Storage Persistence & KPI Tracker ---
  const STORAGE_KEY = 'KMD_DRAINAGE_INSPECTIONS_SEC03_V1';

  function loadInspectionsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state.inspections = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function saveInspectionsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.inspections));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function updateProgressHUD() {
    if (!state.assetsData || !state.assetsData.features) return;
    const feats = state.assetsData.features;
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

      if (status === 'Completed & Approved') {
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
    if (!state.centerlineData || !state.centerlineData.dense_points) return null;
    const pts = state.centerlineData.dense_points;
    if (pts.length < 2) return null;

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

        // Cross-product for Left/Right sign: (vx * uy - vy * ux)
        // Positive = Right of alignment, Negative = Left of alignment
        const cross = vx * uy - vy * ux;
        finalOffset = (cross >= 0 ? 1 : -1) * perpDist;
      }
    }

    return {
      pk: finalPk,
      offsetM: finalOffset,
      distM: minPerpDist,
      bearing: finalBearing
    };
  }

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
      zoomControl: false
    });

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
      '⚡ Barebones Dark (Esri Canvas)': esriDarkCanvas,
      '⚡ Barebones Light (Esri Canvas)': esriLightCanvas,
      '🗺️ Roads & Towns (OSM)': osmStandard,
      '🛰️ Satellite Imagery (Esri)': esriSatellite,
      '📶 Offline Technical Grid': offlineGrid
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(state.map);

    // Initialize layer groups
    state.mapLayers.centerline = L.layerGroup().addTo(state.map);
    state.mapLayers.ticks100m = L.layerGroup().addTo(state.map);
    state.mapLayers.ticks1km = L.layerGroup().addTo(state.map);
    state.mapLayers.ditches = L.layerGroup().addTo(state.map);
    state.mapLayers.structures = L.layerGroup().addTo(state.map);

    // Render data
    renderCenterline();
    renderAssets();
    updateProgressHUD();

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
      return p.category !== 'Cross Drainage' && p.category !== 'Overhead Crossing' && p.category !== 'Underpass';
    }
    if (filter === 'structures') {
      return p.category === 'Cross Drainage' || p.category === 'Overhead Crossing' || p.category === 'Underpass';
    }
    if (filter === 'status_not_started') {
      return status === 'Not Started';
    }
    if (filter === 'status_ongoing') {
      return status !== 'Not Started' && status !== 'Completed & Approved';
    }
    if (filter === 'status_completed') {
      return status === 'Completed & Approved';
    }
    if (filter === 'status_defect') {
      return !!insp.hasDefect;
    }
    return true;
  }

  // --- 5. Render Track Centerline & Station Ticks ---
  function renderCenterline() {
    if (!state.centerlineData) return;

    const coords = state.centerlineData.geojson.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

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
    const ticks100 = state.centerlineData.ticks_100m || [];
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

    // Dynamic tick display based on zoom level
    state.map.on('zoomend', function () {
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
    });
  }

  // --- 6. Render Drainage Assets ---
  function renderAssets() {
    if (!state.assetsData || !state.assetsData.features) return;

    state.mapLayers.ditches.clearLayers();
    state.mapLayers.structures.clearLayers();

    const isProgressMode = state.viewMode === 'progress';

    state.assetsData.features.forEach(feat => {
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
        } else if (status === 'Completed & Approved') {
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
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#EF4444;color:#fff;font-size:10px;font-weight:bold;">⚠️ DEFECT / SNAG</span>`
        : status === 'Completed & Approved'
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#10B981;color:#fff;font-size:10px;font-weight:bold;">✓ APPROVED</span>`
        : status !== 'Not Started'
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#F59E0B;color:#000;font-size:10px;font-weight:bold;">⚡ ${status.toUpperCase()}</span>`
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

        let iconHtml = '💧';
        if (p.category === 'Cross Drainage') iconHtml = '🔲';
        else if (p.category === 'Overhead Crossing') iconHtml = '🌉';
        else if (p.category === 'Underpass') iconHtml = '🚇';
        else if (p.category === 'Shoulder / Cascade') iconHtml = '🔻';

        const customIcon = L.divIcon({
          className: 'custom-pin-container',
          html: `<div class="${pinClass}" style="background:${pinColor};">${iconHtml}</div>`,
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

    // Expand Drawer
    expandDrawer();

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
      if (s === activeStatus) {
        if (s === 'Completed & Approved') {
          btn.classList.add('approved');
        } else {
          btn.classList.add('selected');
        }
      }
    });
  }

  function expandDrawer() {
    const d = document.getElementById('inspectionDrawer');
    d.classList.remove('hidden', 'collapsed');
  }

  function collapseDrawer() {
    const d = document.getElementById('inspectionDrawer');
    d.classList.add('collapsed');
  }

  function hideDrawer() {
    const d = document.getElementById('inspectionDrawer');
    d.classList.add('hidden');
  }

  function saveCurrentInspection(showExplicitToast = true) {
    if (!state.selectedAsset) return;
    const p = state.selectedAsset.properties;

    const selectedBtn = document.querySelector('.btn-milestone.selected, .btn-milestone.approved');
    const status = selectedBtn ? selectedBtn.getAttribute('data-status') : 'Not Started';
    const notes = document.getElementById('defectNotes').value.trim();
    const hasDefect = document.getElementById('chkDefect').checked;

    state.inspections[p.id] = {
      assetId: p.id,
      chainage_str: p.chainage_str,
      short_code: p.short_code,
      typology: p.typology,
      status: status,
      notes: notes,
      hasDefect: hasDefect,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    saveInspectionsToStorage();
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

      // Check proximity to assets (< 60m)
      checkAssetProximity(proj.pk);
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

  function checkAssetProximity(currentPk) {
    if (!state.assetsData || !state.assetsData.features) return;

    for (const feat of state.assetsData.features) {
      const p = feat.properties;
      if (currentPk >= p.start_pk - 25 && currentPk <= p.end_pk + 25) {
        // Near this asset - if drawer is closed or different asset, notify or suggest
        if (!state.selectedAsset || state.selectedAsset.properties.id !== p.id) {
          // Auto-preview asset in drawer if user is walking
          selectAsset(feat);
          showToast(`Approaching: ${p.short_code} (${p.chainage_str})`);
          break;
        }
      }
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

    if (targetPk === null || !state.centerlineData) {
      alert('Please enter a valid chainage, e.g. "84+400" or "84.4"');
      return;
    }

    const pts = state.centerlineData.dense_points;
    let closestPt = pts[0];
    let minDiff = Infinity;

    for (const pt of pts) {
      const diff = Math.abs(pt.pk - targetPk);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = pt;
      }
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

    state.assetsData.features.forEach(f => {
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

    XLSX.utils.book_append_sheet(wb, ws, 'DRAINAGE PROGRESS');
    const today = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `KMD_Section03_Drainage_Inspection_Progress_${today}.xlsx`);
    showToast('Downloaded Excel Progress Report!');
  }

  // --- 12. UI Event Listeners ---
  function setupEventListeners() {
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

    // Drawer Handle Toggles
    document.getElementById('drawerHandleBar').addEventListener('click', function () {
      const d = document.getElementById('inspectionDrawer');
      if (d.classList.contains('collapsed')) {
        expandDrawer();
      } else {
        collapseDrawer();
      }
    });

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
  }

  // Toast Notification
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initMap);
})();
