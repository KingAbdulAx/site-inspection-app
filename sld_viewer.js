/**
 * KMD DRAINAGE INSPECTOR — STRAIGHT-LINE DIAGRAM (SLD) LINEAR TRACK VIEWER
 * Pure 1D/2D Engineering Linear Schematic Engine
 * 
 * Unrolls the entire 104.7 km railway alignment into a single straight reference axis:
 * - Centerline: Double rails, sleepers, 100m minor ticks, 1km major station markers
 * - Left Side (+Y / Above): Longitudinal shoulder, toe, and berm ditches
 * - Right Side (-Y / Below): Longitudinal shoulder, toe, and berm ditches
 * - Cross Culverts: Transverse rectangular structures crossing perpendicular through the track
 * - Cascades / Chutes (Type 9): Vertical drop connectors from shoulder down to toe ditch
 * - Riprap Armor: Protective embankment toe zone hatching
 * - Live GPS: Projected beacon directly on the straight centerline
 */

(function () {
  'use strict';

  class SldViewer {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.options = Object.assign({
        background: '#0B0F19',
        trackBedColor: 'rgba(30, 41, 59, 0.7)',
        railColor: '#94A3B8',
        sleeperColor: 'rgba(148, 163, 184, 0.4)',
        centerlineColor: '#38BDF8',
        gridLineColor: 'rgba(148, 163, 184, 0.12)',
        majorTickColor: '#E2E8F0',
        minorTickColor: '#475569',
        textColor: '#F8FAFC',
        textMutedColor: '#94A3B8',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }, options);

      // Create Canvas
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'sld-canvas';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.canvas.style.touchAction = 'none';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      // State
      this.orientation = 'horizontal'; // 'horizontal' (default) or 'vertical'
      this.centerPk = 84406; // Active chainage station (meters)
      this.pixelsPerMeter = 0.6; // Scale: 0.6 px/m means 100m = 60px, 1km = 600px
      this.minScale = 0.04; // 1km = 40px (overview of entire corridor)
      this.maxScale = 3.5;  // 100m = 350px (detailed structure view)

      // Lateral Lane Offsets in Pixels from Track Centerline
      // Physically ordered per CAD drawings & DW-10003 from centerline outward:
      this.laneOffsets = {
        shoulder: 28,  // Type 9 half-round platform edge, Type 1 cutting side ditch, Type 6 sub-ballast collector, Type 2, 3, 10, 15
        bench: 60,     // Type 8 half-round intermediate bench/berm ditch
        toe: 94,       // Type 7 concrete toe ditch, Type 4 unlined toe ditch, Type 12 trapezoidal toe ditch, Riprap armor
        crest: 126,    // Type 5 unlined crest ditch, Type 11 lined crest ditch, cut crest channels
        channel: 160   // Open channels (Type A earth channel, Type B concrete channel, Type C, diversion channels)
      };

      // Layer Visibility Flags
      this.layers = {
        track: true,
        ticks: true,
        culverts: true,       // True cross-drainage structures crossing the track (Box & Pipe Culverts, Underpasses, Bridges)
        ditches: true,        // Longitudinal side, bench, toe, and crest ditches
        channels: true,       // Open Channels (Types A, B, C, Diversion channels on outermost lane) - SEPARATE LAYER!
        waterDescents: true,  // Water Descents / Cascades down slope
        chutes: true,         // Backward compatible alias for waterDescents
        dissipators: true,    // Energy Dissipators (point structures at ditch/channel/descent terminus)
        riprap: true,         // Riprap Armor & Scour Protection (longitudinal toe stretches)
        labels: true
      };

      // Selection & Interaction
      this.selectedAssetId = null;
      this.hoveredAsset = null;
      this.isDragging = false;
      this.dragStartCoord = 0;
      this.dragStartPk = 0;
      this.touchStartDist = null;
      this.touchStartScale = null;

      // Hit-test bounding boxes cache for tap events
      this.hitBoxes = [];

      this._bindEvents();
      this.resize();
    }

    resize() {
      if (!this.container || !this.canvas) return;
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;

      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.render();
    }

    _bindEvents() {
      window.addEventListener('resize', () => this.resize());

      // Mouse Drag & Touch Pan
      const getCoord = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return this.orientation === 'horizontal' ? clientX : clientY;
      };

      const onStart = (e) => {
        if (e.touches && e.touches.length === 2) {
          // Pinch Zoom
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.touchStartDist = Math.hypot(dx, dy);
          this.touchStartScale = this.pixelsPerMeter;
          this.isDragging = false;
          return;
        }
        this.isDragging = true;
        this.dragStartCoord = getCoord(e);
        this.dragStartPk = this.centerPk;
      };

      const onMove = (e) => {
        if (e.touches && e.touches.length === 2 && this.touchStartDist) {
          // Handle Pinch Zoom
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const factor = dist / this.touchStartDist;
          this.setScale(this.touchStartScale * factor);
          return;
        }

        if (!this.isDragging) {
          // Hover hit-test on desktop
          if (!e.touches) {
            const rect = this.canvas.getBoundingClientRect();
            this._handleHover(e.clientX - rect.left, e.clientY - rect.top);
          }
          return;
        }

        const coord = getCoord(e);
        const deltaPx = coord - this.dragStartCoord;
        // In horizontal: dragging left moves chainage forward (+PK)
        // In vertical: dragging up moves chainage forward (+PK)
        const deltaMeters = deltaPx / this.pixelsPerMeter;
        const newPk = this.dragStartPk - deltaMeters;
        this.setCenterPk(newPk, false);
      };

      const onEnd = (e) => {
        if (this.isDragging) {
          const coord = e.changedTouches ? (this.orientation === 'horizontal' ? e.changedTouches[0].clientX : e.changedTouches[0].clientY) : getCoord(e);
          const moved = Math.abs(coord - this.dragStartCoord);
          if (moved < 5) {
            // Tap / Click Hit Test
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            this._handleClick(clientX - rect.left, clientY - rect.top);
          } else {
            // Sync Scrubber on release
            if (window.chainageScrubber) {
              window.chainageScrubber.setChainage(this.centerPk, true);
            }
          }
        }
        this.isDragging = false;
        this.touchStartDist = null;
      };

      this.canvas.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);

      // Wheel Zoom
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        this.setScale(this.pixelsPerMeter * factor);
      }, { passive: false });
    }

    setScale(newScale) {
      this.pixelsPerMeter = Math.max(this.minScale, Math.min(this.maxScale, newScale));
      this.render();
    }

    zoomIn() {
      this.setScale(this.pixelsPerMeter * 1.35);
    }

    zoomOut() {
      this.setScale(this.pixelsPerMeter / 1.35);
    }

    toggleOrientation() {
      this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      this.render();
      return this.orientation;
    }

    setCenterPk(pk, syncScrubber = true) {
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      let minPk = 19800;
      let maxPk = 124521;
      if (activeSection === '02') {
        minPk = 19800;
        maxPk = 82902.439;
      } else if (activeSection === '03') {
        minPk = 82902.439;
        maxPk = 124521;
      }
      this.centerPk = Math.max(minPk, Math.min(maxPk, pk));
      this.render();

      if (syncScrubber && window.chainageScrubber) {
        window.chainageScrubber.setChainage(this.centerPk, true);
      }
      this._updateFloatingHud();
    }

    jumpToPk(pk, syncScrubber = false) {
      this.setCenterPk(pk, syncScrubber);
    }

    fitSection() {
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      let startPk = 19800;
      let endPk = 124521;
      if (activeSection === '02') {
        startPk = 19800;
        endPk = 82902;
      } else if (activeSection === '03') {
        startPk = 82902;
        endPk = 124521;
      }
      this.centerPk = (startPk + endPk) / 2;
      const corridorLengthM = endPk - startPk;
      const dim = this.orientation === 'horizontal' ? (this.width - 60) : (this.height - 60);
      this.pixelsPerMeter = Math.max(this.minScale, Math.min(0.2, dim / corridorLengthM));
      this.render();
      this._updateFloatingHud();
    }

    setSelectedAsset(assetId) {
      this.selectedAssetId = assetId;
      this.render();
    }

    // Determine lateral lane offset for a feature based on drawing layout & DW-10003
    getFeatureLane(p) {
      const cat = (p.category || '').toLowerCase();
      const typ = (p.typology || '').toLowerCase();
      const code = (p.typology_code || p.short_code || '').toLowerCase();

      // 1. Channel (Outermost extent)
      if (cat === 'diversion channel' || cat === 'open channel' || typ.includes('channel') || code.includes('chan') || typ.includes('zone iii') || typ.includes('zone i') || typ.includes('rectangular channel')) {
        return this.laneOffsets.channel;
      }
      // 2. Crest Ditch (Top of cutting slope)
      if (cat === 'crest ditch' || cat === 'crest channel' || typ.includes('crest') || code.includes('type 11') || code.includes('type 5')) {
        return this.laneOffsets.crest;
      }
      // 3. Bench / Berm Ditch (Intermediate slope bench)
      if (cat === 'berm ditch' || typ.includes('bench') || typ.includes('berm') || code.includes('type 8')) {
        return this.laneOffsets.bench;
      }
      // 4. Toe / Foot of Slope
      if (cat === 'toe ditch' || typ.includes('foot of slope') || typ.includes('toe') || code.includes('type 7') || code.includes('type 4') || code.includes('type 12') || code === 'riprap' || cat === 'riprap protection') {
        return this.laneOffsets.toe;
      }
      // 5. Shoulder / Platform edge (Closest to rail)
      return this.laneOffsets.shoulder;
    }

    // Classify feature into true engineering category
    classifyFeature(p) {
      const cat = (p.category || '').toLowerCase();
      const typ = (p.typology || '').toLowerCase();
      const code = (p.typology_code || p.short_code || '').toLowerCase();

      if (cat === 'riprap protection' || typ.includes('riprap') || code === 'riprap' || typ.includes('scour protection')) {
        return 'riprap';
      }
      if (cat === 'water descent' || typ.includes('water descent') || typ.includes('chute') || code === 'desc' || code === 'descent' || code.includes('descent') || code.includes('chute')) {
        return 'waterDescent';
      }
      if (cat === 'energy dissipator' || typ.includes('dissipator') || typ.includes('energy sink') || code.includes('dissipator') || code === 'bs1' || code === 'bs2') {
        return 'dissipator';
      }
      if (cat === 'diversion channel' || cat === 'open channel' || typ.includes('channel') || code.startsWith('chan') || code.includes('chan') || code === 'rect chan' || typ.includes('zone i') || typ.includes('zone iii')) {
        return 'channel';
      }
      if (cat === 'cross drainage' || typ.includes('box culvert') || typ.includes('pipe culvert') || typ.includes('underpass') || typ.includes('overbridge') || typ.includes('bridge') || code.includes('culv') || code.includes('box') || code.includes('pipe') || p.is_point) {
        return 'cross';
      }
      return 'ditch';
    }

    // --- COORDINATE PROJECTION: Linear PK & Lateral Offset -> Screen (X, Y) ---
    pkToScreen(pk, lateralOffsetPx = 0) {
      const isHoriz = this.orientation === 'horizontal';
      const centerCoord = isHoriz ? (this.width / 2) : (this.height / 2);
      const crossCoord = isHoriz ? (this.height / 2) : (this.width / 2);

      // Linear distance along track in pixels
      const distFromCenterM = pk - this.centerPk;
      const alongPx = centerCoord + distFromCenterM * this.pixelsPerMeter;

      // Lateral offset:
      // Left side: negative cross offset in screen coordinates (upwards in horizontal, leftwards in vertical)
      // Right side: positive cross offset
      const crossPx = crossCoord + lateralOffsetPx;

      return isHoriz ? { x: alongPx, y: crossPx } : { x: crossPx, y: alongPx };
    }

    screenToPk(x, y) {
      const isHoriz = this.orientation === 'horizontal';
      const alongPx = isHoriz ? x : y;
      const centerCoord = isHoriz ? (this.width / 2) : (this.height / 2);
      const distFromCenterPx = alongPx - centerCoord;
      const distFromCenterM = distFromCenterPx / this.pixelsPerMeter;
      return this.centerPk + distFromCenterM;
    }

    // --- RENDER PIPELINE ---
    render() {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;
      this.hitBoxes = [];

      // 1. Clear background
      ctx.fillStyle = this.options.background;
      ctx.fillRect(0, 0, this.width, this.height);

      // 2. Visible chainage window
      const isHoriz = this.orientation === 'horizontal';
      const viewLengthPx = isHoriz ? this.width : this.height;
      const halfWindowM = (viewLengthPx / 2) / this.pixelsPerMeter;
      const minVisiblePk = this.centerPk - halfWindowM - 50;
      const maxVisiblePk = this.centerPk + halfWindowM + 50;

      // 3. Render Track Centerline, Sleepers & Rails
      if (this.layers.track) {
        this._renderTrackBed(ctx);
      }

      // 4. Render Station Ticks & Kilometer Gridlines
      if (this.layers.ticks) {
        this._renderStationTicks(ctx, minVisiblePk, maxVisiblePk);
      }

      // 5. Render Engineering Drainage Features
      const features = window.getActiveFeatures ? window.getActiveFeatures() : [];
      const inspections = (window.appState && window.appState.inspections) || {};
      const viewMode = (window.appState && window.appState.viewMode) || 'typology';
      const activeFilter = (window.appState && window.appState.activeFilter) || 'all';

      // Segregate features by engineering classification
      const riprapFeatures = [];
      const channelFeatures = [];
      const ditchFeatures = [];
      const waterDescentFeatures = [];
      const dissipatorFeatures = [];
      const crossFeatures = [];

      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const p = f.properties;
        const startPk = p.start_pk !== undefined ? p.start_pk : p.pk;
        const endPk = p.end_pk !== undefined ? p.end_pk : startPk;

        // Frustum culling
        if (endPk < minVisiblePk || startPk > maxVisiblePk) continue;

        // Filter evaluation
        if (!this._matchesFilter(p, inspections[p.id], activeFilter)) continue;

        const kind = this.classifyFeature(p);
        if (kind === 'riprap') riprapFeatures.push(f);
        else if (kind === 'channel') channelFeatures.push(f);
        else if (kind === 'waterDescent') waterDescentFeatures.push(f);
        else if (kind === 'dissipator') dissipatorFeatures.push(f);
        else if (kind === 'cross') crossFeatures.push(f);
        else ditchFeatures.push(f);
      }

      // 1. Render Riprap Scour Protection along embankment toe
      if (this.layers.riprap) {
        for (let i = 0; i < riprapFeatures.length; i++) {
          this._renderRiprapFeature(ctx, riprapFeatures[i], inspections[riprapFeatures[i].properties.id], viewMode);
        }
      }

      // 2. Render Open Channels on outermost extent
      if (this.layers.channels) {
        for (let i = 0; i < channelFeatures.length; i++) {
          this._renderChannelFeature(ctx, channelFeatures[i], inspections[channelFeatures[i].properties.id], viewMode);
        }
      }

      // 3. Render Longitudinal Ditches (Types 1-16) on shoulder, bench, toe, crest
      if (this.layers.ditches) {
        for (let i = 0; i < ditchFeatures.length; i++) {
          this._renderDitchFeature(ctx, ditchFeatures[i], inspections[ditchFeatures[i].properties.id], viewMode);
        }
      }

      // 4. Render Water Descents connecting Type 9 shoulder ditch -> Type 8 bench -> toe dissipator
      if (this.layers.waterDescents && this.layers.chutes) {
        for (let i = 0; i < waterDescentFeatures.length; i++) {
          this._renderWaterDescentFeature(ctx, waterDescentFeatures[i], ditchFeatures, inspections[waterDescentFeatures[i].properties.id], viewMode);
        }
      }

      // 5. Render Energy Dissipators at ditch/channel/descent terminus
      if (this.layers.dissipators) {
        for (let i = 0; i < dissipatorFeatures.length; i++) {
          this._renderEnergyDissipator(ctx, dissipatorFeatures[i], inspections[dissipatorFeatures[i].properties.id], viewMode);
        }
      }

      // 6. Render Cross Culverts & Bridges crossing track
      if (this.layers.culverts) {
        for (let i = 0; i < crossFeatures.length; i++) {
          this._renderCrossCulvert(ctx, crossFeatures[i], inspections[crossFeatures[i].properties.id], viewMode);
        }
      }

      // 6. Section Transition Boundary (PK 82+902)
      this._renderSectionBoundary(ctx, 82902.439, 'Section 02 (DWKZ) ──┤├── Section 03 (KZDR)');

      // 7. Live GPS Position Indicator
      this._renderGpsPosition(ctx);

      // 8. Hover Highlight Overlay
      if (this.hoveredAsset) {
        this._renderHoverTooltip(ctx, this.hoveredAsset);
      }
    }

    // --- TRACK BED & RAILS ---
    _renderTrackBed(ctx) {
      const isHoriz = this.orientation === 'horizontal';
      const crossCoord = isHoriz ? (this.height / 2) : (this.width / 2);
      const bedWidth = 24; // Track ballast bed width in pixels

      // Ballast Bed
      ctx.fillStyle = this.options.trackBedColor;
      if (isHoriz) {
        ctx.fillRect(0, crossCoord - bedWidth / 2, this.width, bedWidth);
      } else {
        ctx.fillRect(crossCoord - bedWidth / 2, 0, bedWidth, this.height);
      }

      // Rails (Double line, gauge = 10px)
      const gauge = 10;
      ctx.strokeStyle = this.options.railColor;
      ctx.lineWidth = 2.5;

      if (isHoriz) {
        ctx.beginPath();
        ctx.moveTo(0, crossCoord - gauge / 2);
        ctx.lineTo(this.width, crossCoord - gauge / 2);
        ctx.moveTo(0, crossCoord + gauge / 2);
        ctx.lineTo(this.width, crossCoord + gauge / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(crossCoord - gauge / 2, 0);
        ctx.lineTo(crossCoord - gauge / 2, this.height);
        ctx.moveTo(crossCoord + gauge / 2, 0);
        ctx.lineTo(crossCoord + gauge / 2, this.height);
        ctx.stroke();
      }

      // Track Centerline (Subtle dashed cyan line)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (isHoriz) {
        ctx.moveTo(0, crossCoord);
        ctx.lineTo(this.width, crossCoord);
      } else {
        ctx.moveTo(crossCoord, 0);
        ctx.lineTo(crossCoord, this.height);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- STATION TICKS & KILOMETER MARKERS ---
    _renderStationTicks(ctx, minPk, maxPk) {
      const isHoriz = this.orientation === 'horizontal';
      const crossCoord = isHoriz ? (this.height / 2) : (this.width / 2);

      // Determine step based on zoom level
      let minorStep = 100;
      let majorStep = 1000;
      if (this.pixelsPerMeter < 0.15) {
        minorStep = 1000;
        majorStep = 5000;
      } else if (this.pixelsPerMeter < 0.35) {
        minorStep = 500;
        majorStep = 1000;
      }

      const startTick = Math.floor(minPk / minorStep) * minorStep;
      const endTick = Math.ceil(maxPk / minorStep) * minorStep;

      for (let pk = startTick; pk <= endTick; pk += minorStep) {
        const isMajor = (pk % majorStep === 0);
        const pt = this.pkToScreen(pk, 0);
        const along = isHoriz ? pt.x : pt.y;

        // Grid Line across entire corridor
        if (isMajor) {
          ctx.strokeStyle = this.options.gridLineColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (isHoriz) {
            ctx.moveTo(along, 0);
            ctx.lineTo(along, this.height);
          } else {
            ctx.moveTo(0, along);
            ctx.lineTo(this.width, along);
          }
          ctx.stroke();
        }

        // Tick mark on track bed
        const tickLength = isMajor ? 18 : 10;
        ctx.strokeStyle = isMajor ? this.options.majorTickColor : this.options.minorTickColor;
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.beginPath();
        if (isHoriz) {
          ctx.moveTo(along, crossCoord - tickLength);
          ctx.lineTo(along, crossCoord + tickLength);
        } else {
          ctx.moveTo(crossCoord - tickLength, along);
          ctx.lineTo(crossCoord + tickLength, along);
        }
        ctx.stroke();

        // Station Label
        if (isMajor && this.layers.labels) {
          const km = Math.floor(pk / 1000);
          const m = Math.round(pk % 1000);
          const label = `PK ${km}+${m.toString().padStart(3, '0')}`;

          ctx.fillStyle = this.options.textColor;
          ctx.font = '600 11px ' + this.options.fontFamily;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          if (isHoriz) {
            ctx.fillText(label, along, crossCoord - 14);
          } else {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, crossCoord - 14, along);
          }
        } else if (minorStep === 100 && this.pixelsPerMeter > 0.8 && this.layers.labels) {
          // Minor tick label +100, +200
          const m = Math.round(pk % 1000);
          if (m !== 0) {
            ctx.fillStyle = this.options.textMutedColor;
            ctx.font = '500 9px ' + this.options.fontFamily;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            if (isHoriz) {
              ctx.fillText(`+${m}`, along, crossCoord - 12);
            } else {
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(`+${m}`, crossCoord - 12, along);
            }
          }
        }
      }
    }

    // --- RIPRAP SCOUR PROTECTION (LONGITUDINAL TOE STRETCHES) ---
    _renderRiprapFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const isBoth = p.side === 'Center' || !p.side;
      const sides = isBoth ? [-1, 1] : [isLeft ? -1 : 1];

      const startPk = p.start_pk;
      const lenM = p.length_m > 0 ? p.length_m : 28.0;
      const endPk = (p.end_pk && p.end_pk > startPk) ? p.end_pk : (startPk + lenM);

      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      let color = p.color || '#64748B';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      sides.forEach(sideSign => {
        const lateralPx = sideSign * this.laneOffsets.toe;
        const p1 = this.pkToScreen(startPk, lateralPx);
        const p2 = this.pkToScreen(endPk, lateralPx);

        ctx.save();
        // Selection highlight
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        // Protective rock band casing
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 8 : 6;
        ctx.lineCap = 'butt';
        ctx.setLineDash([5, 3]); // Rock armor dashed pattern
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Stone armor stippling along the span
        ctx.fillStyle = color;
        const spanM = endPk - startPk;
        const stippleCount = Math.min(20, Math.max(3, Math.floor(spanM / 15)));
        for (let s = 0; s <= stippleCount; s++) {
          const t = s / stippleCount;
          const spk = startPk + spanM * t;
          const spt = this.pkToScreen(spk, lateralPx);
          ctx.beginPath();
          ctx.arc(spt.x, spt.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Label
        if (this.layers.labels && (this.pixelsPerMeter >= 0.4 || isSelected || isHovered)) {
          const midPk = (startPk + endPk) / 2;
          const midPt = this.pkToScreen(midPk, lateralPx);
          const txt = `RIPRAP (${Math.round(spanM)}m)`;

          ctx.fillStyle = isSelected ? '#FBBF24' : '#94A3B8';
          ctx.font = '600 9px ' + this.options.fontFamily;
          if (this.orientation === 'horizontal') {
            ctx.textAlign = 'center';
            ctx.textBaseline = sideSign < 0 ? 'bottom' : 'top';
            ctx.fillText(txt, midPt.x, midPt.y + (sideSign < 0 ? -6 : 6));
          } else {
            ctx.textAlign = sideSign < 0 ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, midPt.x + (sideSign < 0 ? -6 : 6), midPt.y);
          }
        }

        ctx.restore();
        this._registerLinearHitBox(p1, p2, p, 18);
      });
    }

    // --- OPEN CHANNELS (OUTERMOST CORRIDOR EXTENT) ---
    _renderChannelFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;

      const lateralPx = sideSign * this.laneOffsets.channel;
      const p1 = this.pkToScreen(p.start_pk, lateralPx);
      const p2 = this.pkToScreen(p.end_pk, lateralPx);

      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      let color = p.color || '#0284C7';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Outer channel bank casing
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
      ctx.lineWidth = isSelected ? 10 : 8;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Channel invert line
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 6 : 4.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Station endpoints
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 3.5, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      if (this.layers.labels) {
        const midPk = (p.start_pk + p.end_pk) / 2;
        const midPt = this.pkToScreen(midPk, lateralPx);
        const txt = `${p.short_code || 'CHANNEL'} (${Math.round(p.length_m || (p.end_pk - p.start_pk))}m)`;

        ctx.fillStyle = isSelected ? '#FBBF24' : '#38BDF8';
        ctx.font = '700 9px ' + this.options.fontFamily;
        if (this.orientation === 'horizontal') {
          ctx.textAlign = 'center';
          ctx.textBaseline = isLeft ? 'bottom' : 'top';
          ctx.fillText(txt, midPt.x, midPt.y + (isLeft ? -6 : 6));
        } else {
          ctx.textAlign = isLeft ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, midPt.x + (isLeft ? -6 : 6), midPt.y);
        }
      }

      ctx.restore();
      this._registerLinearHitBox(p1, p2, p, 18);
    }

    // --- LONGITUDINAL DITCHES (TYPES 1-16) ---
    _renderDitchFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;

      const laneOffset = this.getFeatureLane(p);
      const lateralPx = sideSign * laneOffset;

      const p1 = this.pkToScreen(p.start_pk, lateralPx);
      const p2 = this.pkToScreen(p.end_pk, lateralPx);

      const isHoriz = this.orientation === 'horizontal';
      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      let color = p.color || '#38BDF8';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();

      // Selection Glow
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Ditch Line
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();

      // Station start/end dots
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      const lenPx = isHoriz ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);
      if (lenPx > 70 && this.layers.labels) {
        const midPk = (p.start_pk + p.end_pk) / 2;
        const midPt = this.pkToScreen(midPk, lateralPx);
        const text = `${p.short_code || 'DITCH'} (${Math.round(p.length_m || (p.end_pk - p.start_pk))}m)`;

        ctx.fillStyle = isSelected ? '#FBBF24' : this.options.textColor;
        ctx.font = '600 10px ' + this.options.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = isLeft ? 'bottom' : 'top';
        const offsetSign = isLeft ? -5 : 5;

        if (isHoriz) {
          ctx.fillText(text, midPt.x, midPt.y + offsetSign);
        } else {
          ctx.textAlign = isLeft ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, midPt.x + offsetSign, midPt.y);
        }
      }

      this._registerLinearHitBox(p1, p2, p, 16);
    }

    // Compatibility alias for existing automated tests
    _renderLinearFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      if (p.typology_code === 'RIPRAP') {
        return this._renderRiprapFeature(ctx, feature, inspection, viewMode);
      }
      return this._renderDitchFeature(ctx, feature, inspection, viewMode);
    }

    // --- WATER DESCENTS / CASCADES (DW-10003 CONNECTIONS) ---
    _renderWaterDescentFeature(ctx, feature, visibleDitches, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;

      // Check if a Type 9 shoulder ditch exists at this PK on this side
      const hasType9 = visibleDitches && visibleDitches.some(d => {
        const dp = d.properties;
        const code = (dp.typology_code || dp.short_code || '').toUpperCase();
        const typ = (dp.typology || '').toUpperCase();
        const cat = (dp.category || '').toUpperCase();
        const isT9 = (code.includes('TYPE 9') || typ.includes('TYPE 9') || code.includes('TYPE_9') || cat.includes('SHOULDER')) && !typ.includes('CHUTE') && !typ.includes('DESCENT');
        const dSide = dp.side || 'Left';
        const matchSide = dSide === p.side || dSide === 'Center' || p.side === 'Center';
        return isT9 && matchSide && (p.start_pk >= dp.start_pk - 25 && p.start_pk <= dp.end_pk + 25);
      });

      // Check if a Type 8 bench ditch exists at this PK on this side
      const hasType8 = visibleDitches && visibleDitches.some(d => {
        const dp = d.properties;
        const code = (dp.typology_code || dp.short_code || '').toUpperCase();
        const typ = (dp.typology || '').toUpperCase();
        const cat = (dp.category || '').toUpperCase();
        const isT8 = code.includes('TYPE 8') || typ.includes('TYPE 8') || code.includes('TYPE_8') || cat.includes('BERM');
        const dSide = dp.side || 'Left';
        const matchSide = dSide === p.side || dSide === 'Center' || p.side === 'Center';
        return isT8 && matchSide && (p.start_pk >= dp.start_pk - 25 && p.start_pk <= dp.end_pk + 25);
      });

      const isConnected = hasType9 || hasType8;
      const startLaneOffset = hasType9 ? this.laneOffsets.shoulder : (hasType8 ? this.laneOffsets.bench : this.laneOffsets.shoulder);
      const startPt = this.pkToScreen(p.start_pk, sideSign * startLaneOffset);
      const benchPt = this.pkToScreen(p.start_pk, sideSign * this.laneOffsets.bench);
      const toePt = this.pkToScreen(p.end_pk || p.start_pk, sideSign * this.laneOffsets.toe);

      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      let color = p.color || '#0284C7';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();

      // Selection / Hover Halo
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(toePt.x, toePt.y);
        ctx.stroke();
      }

      // Cascade Linework (Down Slope - Never crosses centerline!)
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.lineTo(toePt.x, toePt.y);
      ctx.stroke();

      // Connection Collar at Top (DW-10003 Section A-A: flared inlet collar)
      ctx.fillStyle = isConnected ? color : '#EF4444';
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Stepped Cascade Teeth
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const mx = startPt.x + (toePt.x - startPt.x) * t;
        const my = startPt.y + (toePt.y - startPt.y) * t;
        ctx.beginPath();
        if (this.orientation === 'horizontal') {
          ctx.moveTo(mx - 4, my);
          ctx.lineTo(mx + 4, my);
        } else {
          ctx.moveTo(mx, my - 4);
          ctx.lineTo(mx, my + 4);
        }
        ctx.stroke();
      }

      // Bench junction if Type 8 is present along a shoulder run
      if (hasType9 && hasType8) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(benchPt.x, benchPt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Energy Dissipator Basin at Toe (DW-10003: discharges into toe ditch 7/4)
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      const bW = 8;
      const bH = 6;
      if (this.orientation === 'horizontal') {
        const by = isLeft ? toePt.y - bH : toePt.y;
        ctx.beginPath();
        ctx.rect(toePt.x - bW / 2, by, bW, bH);
        ctx.fill();
        ctx.stroke();
      } else {
        const bx = isLeft ? toePt.x - bW : toePt.x;
        ctx.beginPath();
        ctx.rect(bx, toePt.y - bH / 2, bW, bH);
        ctx.fill();
        ctx.stroke();
      }

      // Label or Warning indicator if unconnected
      if (this.layers.labels && (this.pixelsPerMeter >= 0.8 || isSelected || isHovered || !isConnected)) {
        ctx.fillStyle = !isConnected ? '#EF4444' : (isSelected ? '#FBBF24' : this.options.textMutedColor);
        ctx.font = (!isConnected ? 'bold 8px ' : '500 8px ') + this.options.fontFamily;
        let lbl = '⚠️ Unlinked (Audit)';
        if (hasType9 && hasType8) lbl = 'Descent (T9→T8→Toe)';
        else if (hasType9) lbl = 'Descent (T9→Toe)';
        else if (hasType8) lbl = 'Descent (T8→Toe)';

        if (this.orientation === 'horizontal') {
          ctx.textAlign = 'center';
          ctx.textBaseline = isLeft ? 'bottom' : 'top';
          ctx.fillText(lbl, toePt.x, toePt.y + (isLeft ? -8 : 8));
        } else {
          ctx.textAlign = isLeft ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(lbl, toePt.x + (isLeft ? -8 : 8), toePt.y);
        }
      }

      ctx.restore();
      this._registerLinearHitBox(startPt, toePt, p, 16);
    }

    // Compatibility alias for existing automated tests
    _renderChuteFeature(ctx, feature, inspection, viewMode) {
      return this._renderWaterDescentFeature(ctx, feature, [], inspection, viewMode);
    }

    // --- POINT ENERGY DISSIPATORS ---
    _renderEnergyDissipator(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;
      const pk = p.start_pk !== undefined ? p.start_pk : p.pk;

      // Position on toe lane or channel lane
      const isChan = p.typology && p.typology.toLowerCase().includes('channel');
      const lateralPx = sideSign * (isChan ? this.laneOffsets.channel : this.laneOffsets.toe);
      const pt = this.pkToScreen(pk, lateralPx);

      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      let color = p.color || '#D97706';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();
      if (isSelected || isHovered) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stepped Stilling Basin glyph (14x10 px)
      const bw = 12;
      const bh = 8;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(pt.x - bw / 2, pt.y - bh / 2, bw, bh);
      ctx.fill();
      ctx.stroke();

      // End baffle sill line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (this.orientation === 'horizontal') {
        ctx.moveTo(pt.x + bw / 2, pt.y - bh / 2);
        ctx.lineTo(pt.x + bw / 2, pt.y + bh / 2);
      } else {
        ctx.moveTo(pt.x - bw / 2, pt.y + bh / 2);
        ctx.lineTo(pt.x + bw / 2, pt.y + bh / 2);
      }
      ctx.stroke();

      // Label
      if (this.layers.labels && (this.pixelsPerMeter >= 0.5 || isSelected || isHovered)) {
        ctx.fillStyle = isSelected ? '#FBBF24' : '#FCD34D';
        ctx.font = '700 9px ' + this.options.fontFamily;
        const txt = p.short_code || 'Dissipator';
        if (this.orientation === 'horizontal') {
          ctx.textAlign = 'center';
          ctx.textBaseline = isLeft ? 'bottom' : 'top';
          ctx.fillText(txt, pt.x, pt.y + (isLeft ? -7 : 7));
        } else {
          ctx.textAlign = isLeft ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, pt.x + (isLeft ? -7 : 7), pt.y);
        }
      }

      ctx.restore();
      this.hitBoxes.push({
        x1: pt.x - 10,
        y1: pt.y - 10,
        x2: pt.x + 10,
        y2: pt.y + 10,
        properties: p
      });
    }

    // --- CROSS-DRAINAGE CULVERTS & BRIDGES ---
    _renderCrossCulvert(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const pk = p.start_pk !== undefined ? p.start_pk : p.pk;
      const isSelected = this.selectedAssetId === p.id;
      const isHovered = this.hoveredAsset && this.hoveredAsset.id === p.id;

      const crossHalfSpanPx = this.laneOffsets.toe + 18;
      const ptLeft = this.pkToScreen(pk, -crossHalfSpanPx);
      const ptRight = this.pkToScreen(pk, crossHalfSpanPx);
      const ptCenter = this.pkToScreen(pk, 0);

      let color = p.color || '#EF4444';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(ptLeft.x, ptLeft.y);
        ctx.lineTo(ptRight.x, ptRight.y);
        ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 8 : 6;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(ptLeft.x, ptLeft.y);
      ctx.lineTo(ptRight.x, ptRight.y);
      ctx.stroke();

      const flangeW = 6;
      ctx.fillStyle = color;
      if (this.orientation === 'horizontal') {
        ctx.fillRect(ptLeft.x - flangeW / 2, ptLeft.y - 3, flangeW, 6);
        ctx.fillRect(ptRight.x - flangeW / 2, ptRight.y - 3, flangeW, 6);
      } else {
        ctx.fillRect(ptLeft.x - 3, ptLeft.y - flangeW / 2, 6, flangeW);
        ctx.fillRect(ptRight.x - 3, ptRight.y - flangeW / 2, 6, flangeW);
      }

      // Label with LOD throttling (only show text if sufficiently zoomed in or selected/hovered)
      if (this.layers.labels && (this.pixelsPerMeter >= 0.35 || isSelected || isHovered)) {
        ctx.fillStyle = isSelected ? '#FBBF24' : '#FFFFFF';
        ctx.font = '700 10px ' + this.options.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const label = p.short_code || p.id;
        if (this.orientation === 'horizontal') {
          ctx.fillText(label, ptCenter.x, ptLeft.y - 6);
        } else {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, ptLeft.x - 6, ptCenter.y);
        }
      }

      ctx.restore();

      this._registerLinearHitBox(ptLeft, ptRight, p, 20);
    }

    // --- SECTION BOUNDARY MARKER ---
    _renderSectionBoundary(ctx, pk, label) {
      const pt = this.pkToScreen(pk, 0);
      const isHoriz = this.orientation === 'horizontal';

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      if (isHoriz) {
        ctx.moveTo(pt.x, 0);
        ctx.lineTo(pt.x, this.height);
      } else {
        ctx.moveTo(0, pt.y);
        ctx.lineTo(this.width, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 9px ' + this.options.fontFamily;
      ctx.textAlign = 'center';
      const crossCoord = isHoriz ? (this.height / 2) : (this.width / 2);
      if (isHoriz) {
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, pt.x, crossCoord - 32);
      } else {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, crossCoord - 32, pt.y);
      }
      ctx.restore();
    }

    // --- LIVE GPS POSITION ---
    _renderGpsPosition(ctx) {
      const state = window.appState;
      if (!state || !state.isLocating || state.userCurrentPk === null) return;

      const userPk = state.userCurrentPk;
      const pt = this.pkToScreen(userPk, 0);

      ctx.save();
      const pulseTime = Date.now() / 600;
      const haloRadius = 16 + Math.sin(pulseTime) * 4;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3B82F6';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60A5FA';
      ctx.font = '700 10px ' + this.options.fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const km = Math.floor(userPk / 1000);
      const m = Math.round(userPk % 1000);
      const txt = `YOU (PK ${km}+${m.toString().padStart(3, '0')})`;

      if (this.orientation === 'horizontal') {
        ctx.fillText(txt, pt.x, pt.y + 12);
      } else {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, pt.x + 12, pt.y);
      }
      ctx.restore();
    }

    // --- HIT TESTING & TOOLTIPS ---
    _registerLinearHitBox(p1, p2, properties, tolerancePx) {
      this.hitBoxes.push({
        x1: Math.min(p1.x, p2.x) - tolerancePx,
        y1: Math.min(p1.y, p2.y) - tolerancePx,
        x2: Math.max(p1.x, p2.x) + tolerancePx,
        y2: Math.max(p1.y, p2.y) + tolerancePx,
        properties: properties
      });
    }

    _handleHover(x, y) {
      let match = null;
      for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
        const box = this.hitBoxes[i];
        if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
          match = box.properties;
          break;
        }
      }
      if (this.hoveredAsset !== match) {
        this.hoveredAsset = match;
        this.canvas.style.cursor = match ? 'pointer' : 'default';
        this.render();
      }
    }

    _handleClick(x, y) {
      let match = null;
      for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
        const box = this.hitBoxes[i];
        if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
          match = box.properties;
          break;
        }
      }
      if (match) {
        this.setSelectedAsset(match.id);
        const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
        const fullFeat = feats.find(f => f.properties.id === match.id);
        if (fullFeat && window.selectAsset) {
          window.selectAsset(fullFeat);
        }
      }
    }

    _renderHoverTooltip(ctx, p) {
      const text = `${p.short_code || p.id} · ${p.typology} (${p.chainage_str})`;
      ctx.save();
      ctx.font = '600 11px ' + this.options.fontFamily;
      const textWidth = ctx.measureText(text).width;
      const padding = 8;
      const boxW = textWidth + padding * 2;
      const boxH = 26;

      const px = Math.min(this.width - boxW - 10, Math.max(10, this.width / 2 - boxW / 2));
      const py = 12;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(px, py, boxW, boxH, 6) : ctx.rect(px, py, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px + boxW / 2, py + boxH / 2);
      ctx.restore();
    }

    // --- FLOATING HUD CHIP UPDATE ---
    _updateFloatingHud() {
      const hudEl = document.getElementById('sldFloatingHudText');
      if (!hudEl) return;

      const km = Math.floor(this.centerPk / 1000);
      const m = Math.round(this.centerPk % 1000);
      const pkStr = `PK ${km}+${m.toString().padStart(3, '0')}`;

      const state = window.appState;
      const sec = state ? (state.activeSection === '02' ? 'Sec 02' : (state.activeSection === '03' ? 'Sec 03' : 'All')) : 'All';
      const count = window.getActiveFeatures ? window.getActiveFeatures().length : 2552;

      if (state && state.isLocating && state.userCurrentPk !== null) {
        const acc = state.userAccuracyM ? `±${Math.round(state.userAccuracyM)}m` : '';
        hudEl.innerHTML = `<span class="hud-gps-live">● GPS</span> ${pkStr} (${acc}) · ${sec}`;
      } else {
        hudEl.innerText = `${pkStr} · ${sec} · ${count.toLocaleString()} Assets`;
      }
    }

    // --- HELPER LOGIC ---
    _matchesFilter(p, insp, activeFilter) {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'ditches') return !p.is_point && p.typology_code !== 'RIPRAP';
      if (activeFilter === 'structures') return p.is_point;
      if (activeFilter === 'slope_protection') return p.typology_code === 'RIPRAP' || p.typology_code === 'TYPE_9';

      const status = (insp && insp.status) || 'Not Started';
      const hasDefect = !!(insp && insp.hasDefect);

      if (activeFilter === 'status_completed') return status === 'Completed & Approved';
      if (activeFilter === 'status_ongoing') return status !== 'Not Started' && status !== 'Completed & Approved';
      if (activeFilter === 'status_not_started') return status === 'Not Started';
      if (activeFilter === 'status_defect') return hasDefect;

      return true;
    }

    _getProgressColor(status, hasDefect) {
      if (hasDefect) return '#EF4444';
      switch (status) {
        case 'Excavation': return '#F97316';
        case 'Blinding': return '#FBBF24';
        case 'Rebar / Shuttering': return '#A855F7';
        case 'Concreted': return '#3B82F6';
        case 'Completed & Approved': return '#10B981';
        case 'Not Started':
        default:
          return '#64748B';
      }
    }
  }

  window.SldViewer = SldViewer;
})();
