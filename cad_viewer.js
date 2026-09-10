/**
 * KMD DRAINAGE INSPECTOR — LIGHTWEIGHT CAD/GIS FIELD VIEWER
 * Zero-Tile High-Performance 2D Canvas Engine
 * Built for instant 60fps field navigation, CAD linework, smart LOD stationing, and offline reliability.
 */

(function () {
  'use strict';

  class CadViewer {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.options = Object.assign({
        background: '#0B0F19',
        gridColor: 'rgba(148, 163, 184, 0.08)',
        trackColor: '#E2E8F0',
        centerlineColor: '#38BDF8',
        tickColor: '#94A3B8',
        labelColor: '#F8FAFC',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }, options);

      // Create canvas element
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'cad-canvas';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.canvas.style.touchAction = 'none';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      // Reference origin for local metric planar coordinates (WGS84)
      this.refLon = 8.43738;
      this.refLat = 12.10080;
      this.R = 6378137.0; // Earth radius in meters
      this.rad = Math.PI / 180.0;
      this.cosRefLat = Math.cos(this.refLat * this.rad);

      // Viewport State in local metric meters
      this.centerXM = 0; // Easting offset from ref in meters
      this.centerYM = 0; // Northing offset from ref in meters
      this.scale = 0.5;   // Pixels per meter (0.05 = corridor, 2.0 = detailed close-up)
      this.rotation = 0;  // Viewport rotation angle in radians (0 = North up)
      this.orientationMode = 'north'; // 'north' or 'track'

      // Layer Visibility Flags
      this.layers = {
        grid: true,
        alignment: true,
        ticks: true,
        culverts: true,
        ditches: true,
        chutes: true,
        riprap: true,
        labels: true
      };

      // Hover and selection
      this.hoveredAsset = null;
      this.selectedAssetId = null;

      // Interaction State
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.dragCenterStart = { x: 0, y: 0 };
      this.pinchDist = null;

      // Bind events
      this._bindEvents();
      this.resize();
    }

    // Coordinate conversion: WGS84 Lon/Lat -> Local Metric Meters (East, North)
    geoToMeters(lon, lat) {
      const xm = (lon - this.refLon) * this.rad * this.R * this.cosRefLat;
      const ym = (lat - this.refLat) * this.rad * this.R;
      return { xm, ym };
    }

    metersToGeo(xm, ym) {
      const lat = (ym / this.R) / this.rad + this.refLat;
      const lon = (xm / (this.R * this.cosRefLat)) / this.rad + this.refLon;
      return { lon, lat };
    }

    // Transform: Local Metric Meters -> Screen Pixels
    metersToScreen(xm, ym) {
      const dx = xm - this.centerXM;
      const dy = ym - this.centerYM;

      // Rotate by -this.rotation
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;

      const px = this.width / 2 + rx * this.scale;
      const py = this.height / 2 - ry * this.scale; // Invert y for screen
      return { px, py };
    }

    // Transform: Screen Pixels -> Local Metric Meters
    screenToMeters(px, py) {
      const rx = (px - this.width / 2) / this.scale;
      const ry = (this.height / 2 - py) / this.scale;

      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const dx = rx * cos - ry * sin;
      const dy = rx * sin + ry * cos;

      return {
        xm: this.centerXM + dx,
        ym: this.centerYM + dy
      };
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;

      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // High-DPI scaling
      this.render();
    }

    // Center view at specific chainage along active alignment
    jumpToPk(pk, smooth = true) {
      const cls = window.appState ? (window.getActiveCenterlines ? window.getActiveCenterlines() : []) : [];
      for (const cl of cls) {
        if (!cl.spline_points || !cl.spline_points.length) continue;
        const pts = cl.spline_points;
        if (pk >= pts[0].pk && pk <= pts[pts.length - 1].pk) {
          // Binary search or interpolation for nearest spline point
          let best = pts[0];
          let minDiff = Math.abs(pts[0].pk - pk);
          for (let i = 1; i < pts.length; i++) {
            const diff = Math.abs(pts[i].pk - pk);
            if (diff < minDiff) {
              minDiff = diff;
              best = pts[i];
            }
          }

          const { xm, ym } = this.geoToMeters(best.lon, best.lat);
          this.centerXM = xm;
          this.centerYM = ym;

          if (this.orientationMode === 'track') {
            // Track up: track bearing in degrees rotated to point up (0 rad)
            this.rotation = (best.bearing * Math.PI) / 180.0;
          }
          this.render();
          return true;
        }
      }
      return false;
    }

    // Fit view to entire active corridor or section
    fitBounds(secId = 'all') {
      const cls = window.getActiveCenterlines ? window.getActiveCenterlines() : [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      cls.forEach(cl => {
        if (!cl.spline_points) return;
        cl.spline_points.forEach(pt => {
          const { xm, ym } = this.geoToMeters(pt.lon, pt.lat);
          if (xm < minX) minX = xm;
          if (xm > maxX) maxX = xm;
          if (ym < minY) minY = ym;
          if (ym > maxY) maxY = ym;
        });
      });

      if (!isFinite(minX)) return;

      this.centerXM = (minX + maxX) / 2;
      this.centerYM = (minY + maxY) / 2;

      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const margin = 100; // pixels
      const scaleX = (this.width - margin * 2) / spanX;
      const scaleY = (this.height - margin * 2) / spanY;
      this.scale = Math.min(scaleX, scaleY);
      this.scale = Math.max(0.015, Math.min(this.scale, 0.5));
      this.render();
    }

    setOrientation(mode) {
      this.orientationMode = mode; // 'north' or 'track'
      if (mode === 'north') {
        this.rotation = 0;
      } else {
        // Find bearing at current center
        const { lon, lat } = this.metersToGeo(this.centerXM, this.centerYM);
        if (window.projectGpsToAlignment) {
          const snap = window.projectGpsToAlignment(lat, lon);
          if (snap) {
            this.rotation = (snap.bearing * Math.PI) / 180.0;
          }
        }
      }
      this.render();
    }

    setZoom(newScale) {
      this.scale = Math.max(0.01, Math.min(newScale, 15.0));
      this.render();
    }

    zoomIn() {
      this.setZoom(this.scale * 1.4);
    }

    zoomOut() {
      this.setZoom(this.scale / 1.4);
    }

    // --- RENDER PIPELINE ---
    render() {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;

      // 1. Clear background
      ctx.fillStyle = this.options.background;
      ctx.fillRect(0, 0, this.width, this.height);

      // 2. Render CAD grid (100m or 1km technical grid depending on zoom)
      if (this.layers.grid) {
        this._renderGrid(ctx);
      }

      // 3. Render Centerline & Station Ticks
      if (this.layers.alignment) {
        this._renderAlignment(ctx);
      }

      // 4. Render Engineering Drainage Features
      this._renderFeatures(ctx);

      // 5. Render User GPS Position (if active)
      this._renderUserLocation(ctx);

      // 6. Render HUD Compass / Orientation Indicator
      this._renderCompass(ctx);

      // 7. Render Scale Bar
      this._renderScaleBar(ctx);
    }

    _renderGrid(ctx) {
      // Determine grid interval based on zoom scale
      let gridM = 1000;
      if (this.scale > 1.5) gridM = 100;
      else if (this.scale > 0.4) gridM = 500;
      else if (this.scale < 0.05) gridM = 5000;

      const halfW = (this.width / 2) / this.scale;
      const halfH = (this.height / 2) / this.scale;
      const maxSpan = Math.sqrt(halfW * halfW + halfH * halfH);

      const startX = Math.floor((this.centerXM - maxSpan) / gridM) * gridM;
      const endX = Math.ceil((this.centerXM + maxSpan) / gridM) * gridM;
      const startY = Math.floor((this.centerYM - maxSpan) / gridM) * gridM;
      const endY = Math.ceil((this.centerYM + maxSpan) / gridM) * gridM;

      ctx.save();
      ctx.strokeStyle = this.options.gridColor;
      ctx.lineWidth = 1;

      // Draw subtle crosshair ticks at intersections
      for (let x = startX; x <= endX; x += gridM) {
        for (let y = startY; y <= endY; y += gridM) {
          const { px, py } = this.metersToScreen(x, y);
          if (px >= -20 && px <= this.width + 20 && py >= -20 && py <= this.height + 20) {
            ctx.beginPath();
            ctx.moveTo(px - 4, py);
            ctx.lineTo(px + 4, py);
            ctx.moveTo(px, py - 4);
            ctx.lineTo(px, py + 4);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    _renderAlignment(ctx) {
      const cls = window.getActiveCenterlines ? window.getActiveCenterlines() : [];
      if (!cls.length) return;

      cls.forEach(cl => {
        if (!cl.spline_points || cl.spline_points.length < 2) return;
        const pts = cl.spline_points;

        // Draw track centerline
        ctx.save();
        ctx.beginPath();
        let started = false;

        for (let i = 0; i < pts.length; i++) {
          const { xm, ym } = this.geoToMeters(pts[i].lon, pts[i].lat);
          const { px, py } = this.metersToScreen(xm, ym);

          // Cull points far outside screen
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }

        // Base sleeper rail line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(3, Math.min(8, 2.5 * this.scale));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Guide track center line
        ctx.strokeStyle = this.options.centerlineColor;
        ctx.lineWidth = Math.max(1, Math.min(3, 1.0 * this.scale));
        ctx.stroke();
        ctx.restore();

        // Station Ticks & Labels
        if (this.layers.ticks) {
          this._renderStationTicks(ctx, cl);
        }
      });
    }

    _renderStationTicks(ctx, cl) {
      const isHighZoom = this.scale >= 0.8;
      const isMedZoom = this.scale >= 0.15;
      const pts = cl.spline_points || [];

      // 1. 100m Minor Ticks (if med or high zoom)
      if (isMedZoom && cl.ticks_100m) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.2;

        cl.ticks_100m.forEach(t => {
          const { xm, ym } = this.geoToMeters(t.lon, t.lat);
          const { px, py } = this.metersToScreen(xm, ym);
          if (px < -50 || px > this.width + 50 || py < -50 || py > this.height + 50) return;

          // Perpendicular tick vector
          const tickLen = isHighZoom ? 8 : 5;
          const rad = ((t.bearing + 90) * Math.PI) / 180.0 - this.rotation;
          const dx = Math.cos(rad) * tickLen;
          const dy = Math.sin(rad) * tickLen;

          ctx.beginPath();
          ctx.moveTo(px - dx, py + dy);
          ctx.lineTo(px + dx, py - dy);
          ctx.stroke();

          // 100m text labels if very close zoom
          if (isHighZoom && this.scale >= 2.0 && t.pk % 200 === 0) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`+${t.pk % 1000}`, px + dx + 4, py - dy + 3);
          }
        });
        ctx.restore();
      }

      // 2. 1km Major Station Ticks & Station Badges
      if (cl.ticks_1km) {
        ctx.save();
        cl.ticks_1km.forEach(t => {
          const { xm, ym } = this.geoToMeters(t.lon, t.lat);
          const { px, py } = this.metersToScreen(xm, ym);
          if (px < -100 || px > this.width + 100 || py < -100 || py > this.height + 100) return;

          // Tick bar
          const tickLen = isMedZoom ? 14 : 8;
          const rad = ((t.bearing + 90) * Math.PI) / 180.0 - this.rotation;
          const dx = Math.cos(rad) * tickLen;
          const dy = Math.sin(rad) * tickLen;

          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(px - dx, py + dy);
          ctx.lineTo(px + dx, py - dy);
          ctx.stroke();

          // Station Callout Label
          if (this.layers.labels) {
            // Intelligent LOD filtering: at overview, only show every 5km
            if (!isMedZoom && t.pk % 5000 !== 0) return;

            const labelText = `PK ${Math.floor(t.pk / 1000)}+000`;
            ctx.font = 'bold 11px Inter, monospace';
            const textWidth = ctx.measureText(labelText).width;

            const badgeX = px + dx + 6;
            const badgeY = py - dy - 8;

            // Rounded badge background
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX - 4, badgeY - 10, textWidth + 8, 16, 4);
            ctx.fill();
            ctx.stroke();

            // Badge text
            ctx.fillStyle = '#38BDF8';
            ctx.textAlign = 'left';
            ctx.fillText(labelText, badgeX, badgeY + 2);
          }
        });
        ctx.restore();
      }
    }

    _renderFeatures(ctx) {
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      if (!feats || !feats.length) return;

      const isProgress = window.appState && window.appState.viewMode === 'progress';
      const inspections = (window.appState && window.appState.inspections) || {};

      feats.forEach(f => {
        const p = f.properties;
        const geom = f.geometry;
        if (!geom) return;

        // Apply layer visibility filter
        if (p.category === 'Toe Ditch' && !this.layers.ditches) return;
        if (p.category === 'Cross Drainage' && !this.layers.culverts) return;
        if (p.category === 'Water Descent' && !this.layers.chutes) return;
        if (p.category === 'Riprap Protection' && !this.layers.riprap) return;

        // Apply active filter from appState if defined
        if (window.isAssetMatchingFilter && window.appState && window.appState.activeFilter) {
          if (!window.isAssetMatchingFilter(f, window.appState.activeFilter)) return;
        }

        // Determine feature color
        let strokeColor = p.color || '#38BDF8';
        if (isProgress) {
          const insp = inspections[p.id] || {};
          const status = insp.status || 'Not Started';
          if (status === 'Completed & Approved') strokeColor = '#10B981'; // Emerald
          else if (status === 'Concreted') strokeColor = '#06B6D4';        // Cyan
          else if (status === 'Rebar / Shuttering') strokeColor = '#8B5CF6'; // Purple
          else if (status === 'Blinding') strokeColor = '#F59E0B';          // Amber
          else if (status === 'Excavation') strokeColor = '#E11D48';        // Rose
          else strokeColor = '#475569';                                    // Slate
          if (insp.hasDefect) strokeColor = '#EF4444';                     // Red
        }

        const isSelected = p.id === this.selectedAssetId;

        // Render Geometry
        if (geom.type === 'LineString') {
          this._renderLineFeature(ctx, geom.coordinates, strokeColor, p, isSelected);
        } else if (geom.type === 'Point') {
          this._renderPointFeature(ctx, geom.coordinates, strokeColor, p, isSelected);
        }
      });
    }

    _renderLineFeature(ctx, coords, color, props, isSelected) {
      if (!coords || coords.length < 2) return;

      ctx.save();
      ctx.beginPath();
      let isVisible = false;

      coords.forEach((coord, idx) => {
        const { xm, ym } = this.geoToMeters(coord[0], coord[1]);
        const { px, py } = this.metersToScreen(xm, ym);

        if (px >= -50 && px <= this.width + 50 && py >= -50 && py <= this.height + 50) {
          isVisible = true;
        }

        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });

      if (!isVisible) {
        ctx.restore();
        return;
      }

      const isCulvert = props.category === 'Cross Drainage';

      if (isCulvert) {
        // Cross Drainage Culvert: thick transverse bar with wingwall chevrons
        ctx.strokeStyle = isSelected ? '#FACC15' : color;
        ctx.lineWidth = Math.max(3.5, Math.min(8, 2.0 * this.scale));
        ctx.lineCap = 'butt';
        ctx.stroke();

        // Draw culvert center badge if close enough
        if (this.scale >= 0.8 && this.layers.labels) {
          const midIdx = Math.floor(coords.length / 2);
          const { xm, ym } = this.geoToMeters(coords[midIdx][0], coords[midIdx][1]);
          const { px, py } = this.metersToScreen(xm, ym);

          const label = props.short_code || 'CULVERT';
          ctx.font = 'bold 9px Inter, monospace';
          const tw = ctx.measureText(label).width;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = isSelected ? '#FACC15' : color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(px - tw / 2 - 3, py - 6, tw + 6, 12, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.fillText(label, px, py + 3);
        }
      } else {
        // Longitudinal ditch / channel
        ctx.strokeStyle = isSelected ? '#FACC15' : color;
        ctx.lineWidth = Math.max(2, Math.min(6, 1.5 * this.scale));
        ctx.lineCap = 'round';
        ctx.stroke();

        if (isSelected) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.lineWidth = Math.max(6, Math.min(14, 3.5 * this.scale));
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    _renderPointFeature(ctx, coord, color, props, isSelected) {
      const { xm, ym } = this.geoToMeters(coord[0], coord[1]);
      const { px, py } = this.metersToScreen(xm, ym);

      if (px < -20 || px > this.width + 20 || py < -20 || py > this.height + 20) return;

      ctx.save();
      const r = isSelected ? 6 : Math.max(3, Math.min(6, 1.2 * this.scale));

      if (props.category === 'Water Descent') {
        // Type 9 Chute: cascade stepped diamond/chevron
        ctx.fillStyle = isSelected ? '#FACC15' : color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected || this.scale >= 1.2) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        // Standard marker point
        ctx.fillStyle = isSelected ? '#FACC15' : color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _renderUserLocation(ctx) {
      if (!window.appState || !window.appState.isLocating) return;
      // If mock or real GPS lat/lon available
      const lat = window.appState.userGpsLat;
      const lon = window.appState.userGpsLon;
      if (!lat || !lon) return;

      const { xm, ym } = this.geoToMeters(lon, lat);
      const { px, py } = this.metersToScreen(xm, ym);

      ctx.save();
      // Accuracy circle
      const accM = window.appState.userAccuracyM || 10;
      const accPx = accM * this.scale;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(accPx, 8), 0, Math.PI * 2);
      ctx.fill();

      // Heading / track cone
      if (window.appState.userCurrentPk) {
        // Location dot
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderCompass(ctx) {
      // Small North arrow in top-right
      const cx = this.width - 32;
      const cy = 32;
      const r = 16;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-this.rotation);

      // Compass disc
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // North needle (Red)
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(0, -r + 3);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();

      // South needle (Grey)
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(0, r - 3);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();

      // 'N' label
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', 0, -r - 3);

      ctx.restore();
    }

    _renderScaleBar(ctx) {
      // Scale bar in bottom-left
      const barPx = 100;
      const meters = barPx / this.scale;

      let niceMeters = 100;
      if (meters >= 5000) niceMeters = Math.round(meters / 5000) * 5000;
      else if (meters >= 1000) niceMeters = Math.round(meters / 1000) * 1000;
      else if (meters >= 500) niceMeters = 500;
      else if (meters >= 100) niceMeters = 100;
      else if (meters >= 50) niceMeters = 50;
      else niceMeters = Math.max(10, Math.round(meters / 10) * 10);

      const actualPx = niceMeters * this.scale;
      const bx = 20;
      const by = this.height - 20;

      ctx.save();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by - 4);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + actualPx, by);
      ctx.lineTo(bx + actualPx, by - 4);
      ctx.stroke();

      const text = niceMeters >= 1000 ? `${(niceMeters / 1000).toFixed(1)} km` : `${niceMeters} m`;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, bx + actualPx / 2, by - 6);
      ctx.restore();
    }

    // --- INTERACTION & EVENT LISTENERS ---
    _bindEvents() {
      // Resize listener
      window.addEventListener('resize', () => this.resize());

      // Mouse drag pan
      this.canvas.addEventListener('mousedown', e => {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragCenterStart = { x: this.centerXM, y: this.centerYM };
      });

      window.addEventListener('mousemove', e => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;

        // Rotate delta back by rotation
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        const rdx = (-dx * cos - dy * sin) / this.scale;
        const rdy = (dx * sin - dy * cos) / this.scale;

        this.centerXM = this.dragCenterStart.x + rdx;
        this.centerYM = this.dragCenterStart.y + rdy;
        this.render();
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      // Wheel Zoom
      this.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        this.setZoom(this.scale * factor);
      }, { passive: false });

      // Click hit testing
      this.canvas.addEventListener('click', e => {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        this._handleHitTest(px, py);
      });

      // Touch events (Pan & Pinch Zoom)
      this.canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          this.dragCenterStart = { x: this.centerXM, y: this.centerYM };
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.pinchDist = Math.sqrt(dx * dx + dy * dy);
        }
      }, { passive: true });

      this.canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.dragStart.x;
          const dy = e.touches[0].clientY - this.dragStart.y;

          const cos = Math.cos(this.rotation);
          const sin = Math.sin(this.rotation);
          const rdx = (-dx * cos - dy * sin) / this.scale;
          const rdy = (dx * sin - dy * cos) / this.scale;

          this.centerXM = this.dragCenterStart.x + rdx;
          this.centerYM = this.dragCenterStart.y + rdy;
          this.render();
        } else if (e.touches.length === 2 && this.pinchDist) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const factor = dist / this.pinchDist;
          this.scale *= factor;
          this.pinchDist = dist;
          this.render();
        }
      }, { passive: true });

      this.canvas.addEventListener('touchend', () => {
        this.isDragging = false;
        this.pinchDist = null;
      });
    }

    _handleHitTest(clickPx, clickPy) {
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      let closestFeature = null;
      let minPixelDist = 20; // Hit test radius: 20 pixels

      feats.forEach(f => {
        const geom = f.geometry;
        if (!geom) return;

        if (geom.type === 'Point') {
          const { xm, ym } = this.geoToMeters(geom.coordinates[0], geom.coordinates[1]);
          const { px, py } = this.metersToScreen(xm, ym);
          const d = Math.hypot(px - clickPx, py - clickPy);
          if (d < minPixelDist) {
            minPixelDist = d;
            closestFeature = f;
          }
        } else if (geom.type === 'LineString') {
          for (let i = 0; i < geom.coordinates.length - 1; i++) {
            const m1 = this.geoToMeters(geom.coordinates[i][0], geom.coordinates[i][1]);
            const p1 = this.metersToScreen(m1.xm, m1.ym);
            const m2 = this.geoToMeters(geom.coordinates[i + 1][0], geom.coordinates[i + 1][1]);
            const p2 = this.metersToScreen(m2.xm, m2.ym);

            // Distance from point to segment
            const vx = p2.px - p1.px;
            const vy = p2.py - p1.py;
            const len2 = vx * vx + vy * vy;
            if (len2 === 0) continue;

            const t = Math.max(0, Math.min(1, ((clickPx - p1.px) * vx + (clickPy - p1.py) * vy) / len2));
            const projX = p1.px + t * vx;
            const projY = p1.py + t * vy;
            const d = Math.hypot(clickPx - projX, clickPy - projY);

            if (d < minPixelDist) {
              minPixelDist = d;
              closestFeature = f;
            }
          }
        }
      });

      if (closestFeature) {
        this.selectedAssetId = closestFeature.properties.id;
        this.render();
        if (window.selectAsset) {
          window.selectAsset(closestFeature);
        }
      }
    }
  }

  window.CadViewer = CadViewer;
})();
