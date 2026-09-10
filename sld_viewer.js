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
      this.laneOffsets = {
        shoulder: 28,
        toe: 60,
        berm: 95
      };

      // Layer Visibility Flags
      this.layers = {
        track: true,
        ticks: true,
        culverts: true,
        ditches: true,
        chutes: true,
        riprap: true,
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

      // Separate linear and point structures
      const linearFeatures = [];
      const pointFeatures = [];

      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const p = f.properties;
        const startPk = p.start_pk !== undefined ? p.start_pk : p.pk;
        const endPk = p.end_pk !== undefined ? p.end_pk : startPk;

        // Frustum culling
        if (endPk < minVisiblePk || startPk > maxVisiblePk) continue;

        // Filter evaluation
        if (!this._matchesFilter(p, inspections[p.id], activeFilter)) continue;

        if (p.is_point) {
          pointFeatures.push(f);
        } else {
          linearFeatures.push(f);
        }
      }

      // Render Riprap first (background layer)
      if (this.layers.riprap) {
        for (let i = 0; i < linearFeatures.length; i++) {
          const p = linearFeatures[i].properties;
          if (p.typology_code === 'RIPRAP') {
            this._renderLinearFeature(ctx, linearFeatures[i], inspections[p.id], viewMode);
          }
        }
      }

      // Render Longitudinal Ditches
      if (this.layers.ditches) {
        for (let i = 0; i < linearFeatures.length; i++) {
          const p = linearFeatures[i].properties;
          if (p.typology_code !== 'RIPRAP' && p.typology_code !== 'TYPE_9') {
            this._renderLinearFeature(ctx, linearFeatures[i], inspections[p.id], viewMode);
          }
        }
      }

      // Render Chutes (Type 9)
      if (this.layers.chutes) {
        for (let i = 0; i < linearFeatures.length; i++) {
          const p = linearFeatures[i].properties;
          if (p.typology_code === 'TYPE_9') {
            this._renderChuteFeature(ctx, linearFeatures[i], inspections[p.id], viewMode);
          }
        }
      }

      // Render Cross Culverts & Bridges
      if (this.layers.culverts) {
        for (let i = 0; i < pointFeatures.length; i++) {
          this._renderCrossCulvert(ctx, pointFeatures[i], inspections[pointFeatures[i].properties.id], viewMode);
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

    // --- LONGITUDINAL DITCHES & RIPRAP ---
    _renderLinearFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;

      let laneOffset = this.laneOffsets.toe;
      if (p.typology && p.typology.toLowerCase().includes('shoulder')) {
        laneOffset = this.laneOffsets.shoulder;
      } else if (p.typology && (p.typology.toLowerCase().includes('berm') || p.typology.toLowerCase().includes('catchwater'))) {
        laneOffset = this.laneOffsets.berm;
      }
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

      // Ditch Line / Band
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 6 : (p.typology_code === 'RIPRAP' ? 7 : 4);
      ctx.lineCap = 'round';

      if (p.typology_code === 'RIPRAP') {
        ctx.setLineDash([4, 3]);
      } else {
        ctx.setLineDash([]);
      }

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
        const text = `${p.short_code || 'DITCH'} (${Math.round(p.length_m)}m)`;

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

    // --- WATER DESCENTS / CHUTES (TYPE 9) ---
    _renderChuteFeature(ctx, feature, inspection, viewMode) {
      const p = feature.properties;
      const isLeft = p.side === 'Left';
      const sideSign = isLeft ? -1 : 1;

      const shoulderPt = this.pkToScreen(p.start_pk, sideSign * this.laneOffsets.shoulder);
      const toePt = this.pkToScreen(p.end_pk || p.start_pk, sideSign * this.laneOffsets.toe);

      const isSelected = this.selectedAssetId === p.id;
      let color = p.color || '#F97316';
      if (viewMode === 'progress') {
        const status = (inspection && inspection.status) || 'Not Started';
        color = this._getProgressColor(status, inspection && inspection.hasDefect);
      }

      ctx.save();
      if (isSelected) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(shoulderPt.x, shoulderPt.y);
        ctx.lineTo(toePt.x, toePt.y);
        ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(shoulderPt.x, shoulderPt.y);
      ctx.lineTo(toePt.x, toePt.y);
      ctx.stroke();

      ctx.lineWidth = 2;
      const steps = 3;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const mx = shoulderPt.x + (toePt.x - shoulderPt.x) * t;
        const my = shoulderPt.y + (toePt.y - shoulderPt.y) * t;
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
      ctx.restore();

      this._registerLinearHitBox(shoulderPt, toePt, p, 16);
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
