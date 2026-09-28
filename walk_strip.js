/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 4 Walk Strip Engine
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.1 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.WalkStripLayout = exportsObj.WalkStripLayout;
    root.WalkStrip = exportsObj.WalkStrip;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  // =========================================================================
  // 1. CONSTANTS & LANE GEOMETRY SPECIFICATION (§6.1)
  // =========================================================================

  const STRIP_WIDTH = 390; // Reference width in pixels
  const SCALE_PX_PER_M = 1.9; // Scale when walking
  const READING_LINE_RATIO = 0.8; // 80% from top of strip (~225m ahead, ~60m behind)
  const NEAR_BAND_METERS = 20; // Near band +/- 20m
  const DERIVED_CAP_METERS = 4.0; // 4m dotted cap on derived extents
  const CLUSTER_DISTANCE_METERS = 10.0; // 3+ points within 10m form a cluster
  const CLUSTER_MIN_POINTS = 3;

  /**
   * 11 Physical Columns across the 7 Logical Lane Categories.
   * Total Width = 5 * 33 + 60 + 5 * 33 = 165 + 60 + 165 = 390px.
   */
  const LANE_COLUMNS = [
    { id: 'off_l',   side: 'L', lane: 'off',   label: 'OFF',   xStart: 0,   width: 33, xCenter: 16.5,  offsetMin: 35.0,  offsetMax: 200.0, nominalM: 50.0 },
    { id: 'crest_l', side: 'L', lane: 'crest', label: 'CREST', xStart: 33,  width: 33, xCenter: 49.5,  offsetMin: 16.0,  offsetMax: 35.0,  nominalM: 24.0 },
    { id: 'toe_l',   side: 'L', lane: 'toe',   label: 'TOE',   xStart: 66,  width: 33, xCenter: 82.5,  offsetMin: 10.0,  offsetMax: 16.0,  nominalM: 13.0 },
    { id: 'face_l',  side: 'L', lane: 'face',  label: 'FACE',  xStart: 99,  width: 33, xCenter: 115.5, offsetMin: 4.0,   offsetMax: 10.0,  nominalM: 7.0  },
    { id: 'plat_l',  side: 'L', lane: 'plat',  label: 'PLAT',  xStart: 132, width: 33, xCenter: 148.5, offsetMin: 1.75,  offsetMax: 4.0,   nominalM: 3.5  },
    { id: 'spine',   side: 'C', lane: 'cl',    label: 'CL',    xStart: 165, width: 60, xCenter: 195.0, offsetMin: -1.75, offsetMax: 1.75, nominalM: 0.0  },
    { id: 'plat_r',  side: 'R', lane: 'plat',  label: 'PLAT',  xStart: 225, width: 33, xCenter: 241.5, offsetMin: -4.0,  offsetMax: -1.75, nominalM: -3.5 },
    { id: 'face_r',  side: 'R', lane: 'face',  label: 'FACE',  xStart: 258, width: 33, xCenter: 274.5, offsetMin: -10.0, offsetMax: -4.0,  nominalM: -7.0 },
    { id: 'toe_r',   side: 'R', lane: 'toe',   label: 'TOE',   xStart: 291, width: 33, xCenter: 307.5, offsetMin: -16.0, offsetMax: -10.0, nominalM: -13.0},
    { id: 'crest_r', side: 'R', lane: 'crest', label: 'CREST', xStart: 324, width: 33, xCenter: 340.5, offsetMin: -35.0, offsetMax: -16.0, nominalM: -24.0},
    { id: 'off_r',   side: 'R', lane: 'off',   label: 'OFF',   xStart: 357, width: 33, xCenter: 373.5, offsetMin: -200.0,offsetMax: -35.0, nominalM: -50.0}
  ];

  // Crossing corridor boundaries: Left TOE outer (x = 66) to Right TOE outer (x = 324)
  const CROSSING_CORRIDOR = {
    xStart: 66,
    xEnd: 324,
    width: 258,
    bandHeight: 12
  };

  /**
   * Format type code cleanly:
   * Numbered ditches (1..16, 1L) -> 'T1', 'T12', 'T1L'
   * Non-numeric codes (PC, BC, CH-A, D-SD, BRG, OP, etc.) -> preserved as is
   */
  function formatTypeCode(rawCode, category = '') {
    if (!rawCode) {
      if (category) {
        if (/toe/i.test(category)) return 'T12';
        if (/side/i.test(category)) return 'T1';
        if (/crest/i.test(category)) return 'T5';
        if (/cross|culvert/i.test(category)) return 'PC';
        if (/bridge/i.test(category)) return 'BRG';
      }
      return 'DITCH';
    }
    const str = String(rawCode).trim().toUpperCase();
    if (str === 'CULV_BOX' || str === 'BOX CULVERT') return 'BC';
    if (str === 'CULV_PIPE' || str === 'PIPE CULVERT') return 'PC';
    if (/^\d+[A-Z]?$/.test(str)) {
      return 'T' + str;
    }
    if (/^T\d+[A-Z]?$/.test(str)) {
      return str;
    }
    return str;
  }

  /**
   * Helper to draw diagonal hatching in a canvas rectangle
   */
  function drawHatchPattern(ctx, x, y, width, height, strokeColor = '#8C8F87', lineWidth = 1.5, spacing = 7) {
    if (width <= 0 || height <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);

    const diagCount = Math.ceil((width + height) / spacing);
    const startX = x - height;
    ctx.beginPath();
    for (let i = 0; i <= diagCount + 2; i++) {
      const lineX = startX + (i * spacing);
      ctx.moveTo(lineX, y + height);
      ctx.lineTo(lineX + height, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // =========================================================================
  // 2. PURE MATHEMATICAL LAYOUT & GEOMETRY ENGINE
  // =========================================================================

  class WalkStripLayout {
    constructor(options = {}) {
      this.width = typeof options.width === 'number' ? options.width : STRIP_WIDTH;
      this.height = typeof options.height === 'number' ? options.height : 540;
      this.scale = typeof options.scale === 'number' ? options.scale : SCALE_PX_PER_M;
      this.readingLineRatio = typeof options.readingLineRatio === 'number' ? options.readingLineRatio : READING_LINE_RATIO;
      this.columns = LANE_COLUMNS;
      this.crossingCorridor = CROSSING_CORRIDOR;
    }

    /**
     * Set viewport dimensions
     */
    setDimensions(width, height) {
      if (width > 0) this.width = width;
      if (height > 0) this.height = height;
    }

    /**
     * Compute reading line Y coordinate
     */
    getReadingLineY() {
      return this.height * this.readingLineRatio;
    }

    /**
     * Resolves a feature's lane column index [0..10]
     */
    resolveColumn(side, lane, offsetM = null) {
      const s = String(side || '').toUpperCase();
      const l = String(lane || '').toLowerCase();

      if (l === 'across' || l === 'crossing') {
        return 5; // Spine-centered crossing
      }

      if (s === 'C' || l === 'cl' || l === 'spine') {
        return 5; // Spine
      }

      // Check explicit side and lane code
      if (s === 'L') {
        if (l === 'off') return 0;
        if (l === 'crest') return 1;
        if (l === 'toe') return 2;
        if (l === 'face') return 3;
        if (l === 'plat') return 4;
      } else if (s === 'R') {
        if (l === 'plat') return 6;
        if (l === 'face') return 7;
        if (l === 'toe') return 8;
        if (l === 'crest') return 9;
        if (l === 'off') return 10;
      }

      // Fallback: match by lateral offset in meters (positive Left, negative Right)
      if (typeof offsetM === 'number' && !isNaN(offsetM)) {
        for (let i = 0; i < this.columns.length; i++) {
          const col = this.columns[i];
          if (offsetM >= col.offsetMin && offsetM <= col.offsetMax) {
            return i;
          }
        }
        return offsetM >= 0 ? 0 : 10;
      }

      // Default safe fallbacks
      return s === 'L' ? 4 : (s === 'R' ? 6 : 5);
    }

    /**
     * Get X center coordinate for a column, scaled proportionally to viewport width
     */
    getColumnXCenter(columnIndex) {
      const idx = Math.max(0, Math.min(this.columns.length - 1, columnIndex));
      const col = this.columns[idx];
      if (this.width === STRIP_WIDTH) {
        return col.xCenter;
      }
      return col.xCenter * (this.width / STRIP_WIDTH);
    }

    /**
     * Get column bounding box [xStart, width], scaled proportionally
     */
    getColumnBounds(columnIndex) {
      const idx = Math.max(0, Math.min(this.columns.length - 1, columnIndex));
      const col = this.columns[idx];
      if (this.width === STRIP_WIDTH) {
        return { xStart: col.xStart, width: col.width };
      }
      const s = this.width / STRIP_WIDTH;
      return { xStart: col.xStart * s, width: col.width * s };
    }

    /**
     * Get crossing corridor bounds, scaled proportionally and transformed by facing
     */
    getCrossingCorridorBounds(facing = 'increasing') {
      const s = this.width / STRIP_WIDTH;
      const xStart = this.crossingCorridor.xStart * s;
      const width = this.crossingCorridor.width * s;
      return this.transformBounds(xStart, width, facing);
    }

    /**
     * Convert chainage to canvas Y coordinate relative to user reading line.
     * When facing increasing: higher chainage is UPWARD (smaller Y).
     * When facing decreasing: 180° rotation -> lower chainage is UPWARD (smaller Y).
     */
    chainageToY(ch, userCh, facing = 'increasing') {
      const readingLineY = this.getReadingLineY();
      const deltaCh = ch - userCh;
      if (facing === 'decreasing') {
        // Walking decreasing: forward means ch is decreasing
        return readingLineY + (deltaCh * this.scale);
      }
      // Walking increasing: forward means ch is increasing
      return readingLineY - (deltaCh * this.scale);
    }

    /**
     * Convert canvas Y coordinate back to chainage
     */
    yToChainage(y, userCh, facing = 'increasing') {
      const readingLineY = this.getReadingLineY();
      const dy = y - readingLineY;
      if (facing === 'decreasing') {
        return userCh + (dy / this.scale);
      }
      return userCh - (dy / this.scale);
    }

    /**
     * Transforms nominal X coordinate under facing flip.
     * When facing decreasing, strip is rotated 180° so Left is on user's right hand.
     */
    transformX(nominalX, facing = 'increasing') {
      if (facing === 'decreasing') {
        return this.width - nominalX;
      }
      return nominalX;
    }

    /**
     * Transforms bounding box [xStart, width] under facing flip
     */
    transformBounds(xStart, width, facing = 'increasing') {
      if (facing === 'decreasing') {
        return {
          xStart: this.width - (xStart + width),
          width: width
        };
      }
      return { xStart, width };
    }

    /**
     * Calculates derived extent geometry with 4m dotted caps.
     * Returns:
     * - hasDerivedCaps: boolean
     * - mainSpan: { chStart, chEnd, yStart, yEnd }
     * - capStart: { chStart, chEnd, yStart, yEnd }
     * - capEnd: { chStart, chEnd, yStart, yEnd }
     */
    calculateDerivedExtentGeometry(featChStart, featChEnd, userCh, facing = 'increasing', isDerived = true) {
      const minCh = Math.min(featChStart, featChEnd);
      const maxCh = Math.max(featChStart, featChEnd);
      const lengthM = maxCh - minCh;

      const yMinCh = this.chainageToY(minCh, userCh, facing);
      const yMaxCh = this.chainageToY(maxCh, userCh, facing);

      if (!isDerived || lengthM < (DERIVED_CAP_METERS * 2)) {
        return {
          hasDerivedCaps: false,
          mainSpan: {
            chStart: minCh,
            chEnd: maxCh,
            y1: yMinCh,
            y2: yMaxCh,
            lengthPx: Math.abs(yMaxCh - yMinCh)
          },
          capStart: null,
          capEnd: null
        };
      }

      // 4m cap at start, 4m cap at end
      const cap1MinCh = minCh;
      const cap1MaxCh = minCh + DERIVED_CAP_METERS;
      const mainMinCh = minCh + DERIVED_CAP_METERS;
      const mainMaxCh = maxCh - DERIVED_CAP_METERS;
      const cap2MinCh = maxCh - DERIVED_CAP_METERS;
      const cap2MaxCh = maxCh;

      return {
        hasDerivedCaps: true,
        capMeters: DERIVED_CAP_METERS,
        capPixels: DERIVED_CAP_METERS * this.scale, // exactly 7.6px at 1.9 px/m
        capStart: {
          chStart: cap1MinCh,
          chEnd: cap1MaxCh,
          y1: this.chainageToY(cap1MinCh, userCh, facing),
          y2: this.chainageToY(cap1MaxCh, userCh, facing)
        },
        mainSpan: {
          chStart: mainMinCh,
          chEnd: mainMaxCh,
          y1: this.chainageToY(mainMinCh, userCh, facing),
          y2: this.chainageToY(mainMaxCh, userCh, facing)
        },
        capEnd: {
          chStart: cap2MinCh,
          chEnd: cap2MaxCh,
          y1: this.chainageToY(cap2MinCh, userCh, facing),
          y2: this.chainageToY(cap2MaxCh, userCh, facing)
        }
      };
    }

    /**
     * Compute visible chainage range in the current viewport
     */
    getVisibleChainageRange(userCh, facing = 'increasing') {
      const chTop = this.yToChainage(0, userCh, facing);
      const chBottom = this.yToChainage(this.height, userCh, facing);
      return {
        minCh: Math.min(chTop, chBottom),
        maxCh: Math.max(chTop, chBottom),
        aheadM: facing === 'increasing' ? (chTop - userCh) : (userCh - chTop),
        behindM: facing === 'increasing' ? (userCh - chBottom) : (chBottom - userCh)
      };
    }

    /**
     * Get Near Band bounds (+/- 20m around reading line)
     */
    getNearBandBounds(userCh, facing = 'increasing') {
      const readingLineY = this.getReadingLineY();
      const bandHalfHeightPx = NEAR_BAND_METERS * this.scale; // 20m * 1.9 = 38px
      return {
        yTop: readingLineY - bandHalfHeightPx,
        yBottom: readingLineY + bandHalfHeightPx,
        heightPx: bandHalfHeightPx * 2, // 76px
        chMin: userCh - NEAR_BAND_METERS,
        chMax: userCh + NEAR_BAND_METERS
      };
    }

    /**
     * Generate spine ticks & labels within range
     */
    generateSpineTicks(minCh, maxCh, userCh, facing = 'increasing') {
      const ticks = [];
      const first10m = Math.ceil(minCh / 10) * 10;
      const last10m = Math.floor(maxCh / 10) * 10;

      for (let ch = first10m; ch <= last10m; ch += 10) {
        const y = this.chainageToY(ch, userCh, facing);
        const is100m = (ch % 100 === 0);
        const is50m = (ch % 50 === 0);

        let tickWidth = 5;
        let tickThickness = 1;
        let label = null;
        let isBold = false;

        if (is100m) {
          tickWidth = 14;
          tickThickness = 2;
          const km = Math.floor(ch / 1000);
          const m = ch % 1000;
          label = `${km}+${String(m).padStart(3, '0')}`;
          isBold = true;
        } else if (is50m) {
          tickWidth = 10;
          tickThickness = 1;
          const m = ch % 1000;
          label = `+${String(m).padStart(3, '0')}`;
          isBold = false;
        }

        ticks.push({
          ch: ch,
          y: y,
          width: tickWidth,
          thickness: tickThickness,
          label: label,
          isBold: isBold,
          is100m: is100m,
          is50m: is50m
        });
      }

      return ticks;
    }

    /**
     * Group dense point features into clusters (3+ points within 10m in one lane)
     */
    clusterPointFeatures(pointFeatures) {
      if (!Array.isArray(pointFeatures) || pointFeatures.length === 0) {
        return { unclustered: [], clusters: [] };
      }

      // Group by column index
      const laneGroups = new Map();
      for (const feat of pointFeatures) {
        const colIdx = this.resolveColumn(feat.side, feat.lane, feat.offset_m);
        if (!laneGroups.has(colIdx)) {
          laneGroups.set(colIdx, []);
        }
        laneGroups.get(colIdx).push(feat);
      }

      const allUnclustered = [];
      const allClusters = [];

      laneGroups.forEach((pointsInLane, colIdx) => {
        // Sort points by chainage
        pointsInLane.sort((a, b) => (a.ch || a.ch_start || 0) - (b.ch || b.ch_start || 0));

        let currentCluster = [];
        let clusterStartCh = null;

        for (let i = 0; i < pointsInLane.length; i++) {
          const pt = pointsInLane[i];
          const ptCh = pt.ch || pt.ch_start || 0;

          if (currentCluster.length === 0) {
            currentCluster.push(pt);
            clusterStartCh = ptCh;
          } else if (ptCh - clusterStartCh <= CLUSTER_DISTANCE_METERS) {
            currentCluster.push(pt);
          } else {
            // Check if accumulated cluster satisfies threshold
            if (currentCluster.length >= CLUSTER_MIN_POINTS) {
              const avgCh = currentCluster.reduce((s, p) => s + (p.ch || p.ch_start || 0), 0) / currentCluster.length;
              allClusters.push({
                columnIndex: colIdx,
                ch: avgCh,
                points: currentCluster,
                count: currentCluster.length,
                isCluster: true
              });
            } else {
              allUnclustered.push(...currentCluster);
            }
            currentCluster = [pt];
            clusterStartCh = ptCh;
          }
        }

        // Handle trailing cluster
        if (currentCluster.length >= CLUSTER_MIN_POINTS) {
          const avgCh = currentCluster.reduce((s, p) => s + (p.ch || p.ch_start || 0), 0) / currentCluster.length;
          allClusters.push({
            columnIndex: colIdx,
            ch: avgCh,
            points: currentCluster,
            count: currentCluster.length,
            isCluster: true
          });
        } else {
          allUnclustered.push(...currentCluster);
        }
      });

      return {
        unclustered: allUnclustered,
        clusters: allClusters
      };
    }

    /**
     * Draw 18px Red Warning Triangle for Defects
     */
    static drawDefectWarningTriangle(ctx, x, y) {
      if (!ctx) return;
      ctx.save();
      ctx.fillStyle = '#B3141A';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 9, y + 9);
      ctx.lineTo(x - 9, y + 9);
      ctx.closePath();
      ctx.fill();

      // Exclamation point (centered within 18px triangle)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 1, y - 4, 2, 7);
      ctx.fillRect(x - 1, y + 5, 2, 2);
      ctx.restore();
    }
  }

  // =========================================================================
  // 3. INTERACTIVE WALK STRIP CANVAS COMPONENT
  // =========================================================================

  class WalkStrip {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.options = options;
      this.layout = new WalkStripLayout(options);

      // State
      this.userPosition = {
        ch: options.initialCh || 82902.439,
        side: options.initialSide || 'L',
        offset_m: typeof options.initialOffset === 'number' ? options.initialOffset : 14.0,
        accuracy_m: typeof options.initialAccuracy === 'number' ? options.initialAccuracy : 4.0,
        facing: options.initialFacing || 'increasing'
      };

      this.features = [];
      this.absences = [];
      this.selectedFeatureId = null;
      this.highlightedFeatureId = null;
      this.onFeatureSelect = typeof options.onFeatureSelect === 'function' ? options.onFeatureSelect : null;
      this.onFeatureLongPress = typeof options.onFeatureLongPress === 'function' ? options.onFeatureLongPress : null;
      this.onPositionChange = typeof options.onPositionChange === 'function' ? options.onPositionChange : null;

      // Interaction & dragging state
      this.isDragging = false;
      this.dragStartY = 0;
      this.dragStartCh = 0;

      // DOM elements
      this.canvas = null;
      this.ctx = null;
      this.headerElement = null;

      // Last rendered position to avoid redundant redraws (< 2m threshold)
      this.lastRenderedCh = null;
      this.lastRenderedFacing = null;

      if (this.container && typeof document !== 'undefined') {
        this.initDOM();
      }
    }

    initDOM() {
      this.container.innerHTML = '';
      this.container.style.position = 'relative';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      this.container.style.overflow = 'hidden';
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.background = 'var(--paper, #F6F5F0)';

      // 1. Lane Header Row (40px)
      this.headerElement = document.createElement('div');
      this.headerElement.className = 'di-strip-header';
      this.headerElement.style.height = '40px';
      this.headerElement.style.minHeight = '40px';
      this.headerElement.style.background = 'var(--surface, #FFFFFF)';
      this.headerElement.style.borderBottom = '1px solid var(--rule, #CFD0C9)';
      this.headerElement.style.display = 'flex';
      this.headerElement.style.alignItems = 'center';
      this.headerElement.style.fontFamily = "'IBM Plex Mono', monospace";
      this.headerElement.style.fontSize = '11px';
      this.headerElement.style.fontWeight = '700';
      this.headerElement.style.color = 'var(--ink-2, #383B36)';
      this.headerElement.style.boxSizing = 'border-box';
      this.headerElement.style.userSelect = 'none';
      this.container.appendChild(this.headerElement);

      this.updateHeaderRow();

      // 2. Canvas Container
      const canvasContainer = document.createElement('div');
      canvasContainer.style.flex = '1';
      canvasContainer.style.position = 'relative';
      canvasContainer.style.overflow = 'hidden';
      this.container.appendChild(canvasContainer);

      // 3. Canvas Element
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.touchAction = 'none';
      canvasContainer.appendChild(this.canvas);

      this.ctx = this.canvas.getContext('2d');

      // Bind events
      this.bindEvents();
      this.handleResize();
    }

    updateHeaderRow() {
      if (!this.headerElement) return;
      const facing = this.userPosition.facing;
      const isDecreasing = (facing === 'decreasing');
      const scaleFactor = this.layout.width / STRIP_WIDTH;

      // 40px high header:
      // Sub-row 1 (14px): Left & Right direction indicators
      // Sub-row 2 (26px): 11 lane columns aligned exactly with canvas physical columns
      const leftIndicator = isDecreasing ? '◀ RIGHT' : '◀ LEFT';
      const rightIndicator = isDecreasing ? 'LEFT ▶' : 'RIGHT ▶';
      const clSymbol = isDecreasing ? '▼ CL' : '▲ CL';

      // Physical columns on screen from left to right (indices 0..10)
      // When increasing: cols 0..4 are Left (OFF..PLAT), col 5 is CL, cols 6..10 are Right (PLAT..OFF)
      // When decreasing: 180° rotation -> cols 0..4 are Right (OFF..PLAT), col 5 is CL, cols 6..10 are Left (PLAT..OFF)
      const laneLabels = ['OFF', 'CREST', 'TOE', 'FACE', 'PLAT', clSymbol, 'PLAT', 'FACE', 'TOE', 'CREST', 'OFF'];

      let colsHtml = '';
      for (let i = 0; i < 11; i++) {
        const colWidth = (i === 5 ? 60 : 33) * scaleFactor;
        const label = laneLabels[i];
        if (i === 5) {
          colsHtml += `<div style="width:${colWidth}px;height:24px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;"><span style="background:var(--ink,#121311);color:var(--surface,#FFFFFF);padding:2px 8px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:0.03em;">${label}</span></div>`;
        } else {
          colsHtml += `<div style="width:${colWidth}px;height:24px;display:flex;align-items:center;justify-content:center;font-size:9.5px;color:var(--ink-2,#383B36);font-weight:700;box-sizing:border-box;">${label}</div>`;
        }
      }

      this.headerElement.innerHTML = `
        <div style="display:flex;flex-direction:column;width:100%;height:100%;box-sizing:border-box;justify-content:space-between;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 8px 0 8px;font-size:10px;height:14px;color:var(--ink-3,#555952);letter-spacing:0.04em;">
            <span>${leftIndicator}</span>
            <span>${rightIndicator}</span>
          </div>
          <div style="display:flex;width:100%;height:24px;align-items:center;box-sizing:border-box;">
            ${colsHtml}
          </div>
        </div>
      `;
    }

    handleResize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const w = rect.width || STRIP_WIDTH;
      const h = rect.height || 500;

      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.scale(dpr, dpr);

      this.layout.setDimensions(w, h);
      this.updateHeaderRow();
      this.render(true);
    }

    bindEvents() {
      if (!this.canvas) return;

      let longPressTimer = null;
      let longPressFired = false;
      let startClientX = 0;
      let startClientY = 0;

      const clearLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      const onPointerDown = (e) => {
        this.isDragging = true;
        this.dragStartY = e.clientY;
        this.dragStartCh = this.userPosition.ch;
        startClientX = e.clientX;
        startClientY = e.clientY;
        longPressFired = false;

        if (this.canvas.setPointerCapture) {
          try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }

        clearLongPress();
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          const feat = this.findFeatureAt(startClientX, startClientY);
          if (feat && this.onFeatureLongPress) {
            this.onFeatureLongPress(feat);
          }
        }, 500);
      };

      const onPointerMove = (e) => {
        if (!this.isDragging) return;
        const dy = e.clientY - this.dragStartY;
        const dx = e.clientX - startClientX;

        // Cancel long press if moved more than 6px
        if (Math.hypot(dx, dy) > 6) {
          clearLongPress();
        }

        // Dragging down moves backward in facing direction
        const dCh = dy / this.layout.scale;
        const newCh = this.userPosition.facing === 'decreasing'
          ? this.dragStartCh + dCh
          : this.dragStartCh - dCh;

        this.userPosition.ch = Math.max(0, newCh);
        this.render(true);
        if (this.onPositionChange) {
          this.onPositionChange(this.userPosition);
        }
      };

      const onPointerUp = (e) => {
        clearLongPress();
        if (this.isDragging) {
          this.isDragging = false;
          if (longPressFired) {
            return;
          }
          // Check for tap if minimal drag
          const totalDy = Math.abs(e.clientY - this.dragStartY);
          if (totalDy < 5) {
            this.handleTap(e.clientX, e.clientY);
          }
        }
      };

      this.canvas.addEventListener('pointerdown', onPointerDown);
      this.canvas.addEventListener('pointermove', onPointerMove);
      this.canvas.addEventListener('pointerup', onPointerUp);
      this.canvas.addEventListener('pointercancel', () => {
        clearLongPress();
        this.isDragging = false;
      });

      // Wheel support for desktop mouse navigation
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.sign(e.deltaY) * 5.0; // 5m per step
        const newCh = this.userPosition.facing === 'decreasing'
          ? this.userPosition.ch + delta
          : this.userPosition.ch - delta;
        this.userPosition.ch = Math.max(0, newCh);
        this.render(true);
        if (this.onPositionChange) {
          this.onPositionChange(this.userPosition);
        }
      }, { passive: false });
    }

    findFeatureAt(clientX, clientY) {
      if (!this.canvas) return null;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const facing = this.userPosition.facing;
      const userCh = this.userPosition.ch;

      // 1. Check crossing features first (Left TOE to Right TOE corridor)
      for (const feat of this.features) {
        if (feat.geometry === 'crossing') {
          const ch = typeof feat.ch === 'number' ? feat.ch : (feat.ch_start || 0);
          const featY = this.layout.chainageToY(ch, userCh, facing);
          const corrBounds = this.layout.getCrossingCorridorBounds(facing);
          if (Math.abs(y - featY) <= 14 && x >= corrBounds.xStart - 10 && x <= corrBounds.xStart + corrBounds.width + 56) {
            return feat;
          }
        }
      }

      // 2. Check linear features (11px wide bar spanning [ch_start, ch_end])
      let bestLinear = null;
      let bestLinearDist = Infinity;

      for (const feat of this.features) {
        if (feat.geometry === 'linear') {
          const colIdx = this.layout.resolveColumn(feat.side, feat.lane, feat.offset_m);
          const colX = this.layout.getColumnXCenter(colIdx);
          const screenX = this.layout.transformX(colX, facing);

          const y1 = this.layout.chainageToY(feat.ch_start, userCh, facing);
          const y2 = this.layout.chainageToY(feat.ch_end, userCh, facing);
          const minY = Math.min(y1, y2) - 8;
          const maxY = Math.max(y1, y2) + 8;

          // Check if tap falls within vertical span of the bar
          if (y >= minY && y <= maxY) {
            const dx = Math.abs(x - screenX);
            if (dx <= 20) { // within 20px laterally of the bar center
              if (dx < bestLinearDist) {
                bestLinearDist = dx;
                bestLinear = feat;
              }
            }
          }
        }
      }

      if (bestLinear) {
        return bestLinear;
      }

      // 3. Check point features and other marks (points, clusters, labels, off-alignment)
      let bestPoint = null;
      let bestPointDist = 24; // 24px tap hit threshold

      for (const feat of this.features) {
        if (feat.geometry !== 'linear' && feat.geometry !== 'crossing') {
          const colIdx = this.layout.resolveColumn(feat.side, feat.lane, feat.offset_m);
          const colX = this.layout.getColumnXCenter(colIdx);
          const screenX = this.layout.transformX(colX, facing);

          const ch = typeof feat.ch === 'number' ? feat.ch : (feat.ch_start || 0);
          const featY = this.layout.chainageToY(ch, userCh, facing);
          const dist = Math.hypot(x - screenX, y - featY);
          if (dist < bestPointDist) {
            bestPointDist = dist;
            bestPoint = feat;
          }
        }
      }

      return bestPoint;
    }

    handleTap(clientX, clientY) {
      const feat = this.findFeatureAt(clientX, clientY);
      if (feat && this.onFeatureSelect) {
        this.onFeatureSelect(feat);
      }
    }

    /**
     * Set feature collection to render
     */
    setFeatures(features = []) {
      this.features = Array.isArray(features) ? features : [];
      this.render(true);
    }

    /**
     * Set absences to render
     */
    setAbsences(absences = []) {
      this.absences = Array.isArray(absences) ? absences : [];
      this.render(true);
    }

    /**
     * Update user position from PositionEngine
     * Power saving rule: Only redraws if moved >= 2m or facing changed, unless forced.
     */
    setPosition(pos = {}, forceRedraw = false) {
      const ch = typeof pos.ch === 'number' ? pos.ch : this.userPosition.ch;
      const side = pos.side || this.userPosition.side;
      const offset_m = typeof pos.offset_m === 'number' ? pos.offset_m : this.userPosition.offset_m;
      const accuracy_m = typeof pos.accuracy_m === 'number' ? pos.accuracy_m : this.userPosition.accuracy_m;
      const facing = pos.facing || this.userPosition.facing;

      const deltaCh = this.lastRenderedCh !== null ? Math.abs(ch - this.lastRenderedCh) : 999;
      const facingChanged = facing !== this.lastRenderedFacing;

      this.userPosition = { ch, side, offset_m, accuracy_m, facing };

      if (facingChanged) {
        this.updateHeaderRow();
      }

      if (forceRedraw || deltaCh >= 2.0 || facingChanged) {
        this.render();
      }
    }

    /**
     * Main Render Loop (Non-RAF, on-demand execution)
     */
    render(force = false) {
      if (!this.ctx || !this.canvas) return;

      const userCh = this.userPosition.ch;
      const facing = this.userPosition.facing;

      this.lastRenderedCh = userCh;
      this.lastRenderedFacing = facing;

      const ctx = this.ctx;
      const w = this.layout.width;
      const h = this.layout.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Lane Background Tints
      this.renderLanes(ctx, w, h, facing);

      // 2. Draw Spine & Chainage Ticks
      this.renderSpine(ctx, w, h, userCh, facing);

      // 3. Draw Absences ("NONE · BY DESIGN")
      this.renderAbsences(ctx, w, h, userCh, facing);

      // 4. Draw Features (Linear, Crossing, Point, Clusters, Labels, Off-alignment, Defects)
      this.renderFeatures(ctx, w, h, userCh, facing);

      // 5. Draw Near Band (+/- 20m) & Reading Line
      this.renderReadingLineAndNearBand(ctx, w, h, userCh, facing);
    }

    /**
     * Draw Lane Background Tints
     */
    renderLanes(ctx, w, h, facing) {
      const cols = this.layout.columns;
      const tints = {
        off: '#E3E2DB',
        crest: '#ECEBE5',
        toe: '#F3F2ED',
        face: '#F9F8F5',
        plat: '#FFFFFF',
        cl: '#FFFFFF'
      };

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const nominalBounds = this.layout.getColumnBounds(i);
        const bounds = this.layout.transformBounds(nominalBounds.xStart, nominalBounds.width, facing);
        ctx.fillStyle = tints[col.lane] || '#FFFFFF';
        ctx.fillRect(bounds.xStart, 0, bounds.width, h);

        // Thin separator rule
        ctx.strokeStyle = '#E3E2DB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bounds.xStart, 0);
        ctx.lineTo(bounds.xStart, h);
        ctx.stroke();
      }
    }

    /**
     * Draw Spine Centerline, Ticks and Station Labels
     */
    renderSpine(ctx, w, h, userCh, facing) {
      const spineXNominal = this.layout.getColumnXCenter(5); // 195px
      const spineX = this.layout.transformX(spineXNominal, facing);

      // 4px Ink Centerline
      ctx.fillStyle = '#121311';
      ctx.fillRect(spineX - 2, 0, 4, h);

      // Ticks & Labels
      const range = this.layout.getVisibleChainageRange(userCh, facing);
      const ticks = this.layout.generateSpineTicks(range.minCh, range.maxCh, userCh, facing);

      for (const tick of ticks) {
        // Ticks centered across spine
        ctx.fillStyle = '#121311';
        ctx.fillRect(spineX - (tick.width / 2), tick.y - (tick.thickness / 2), tick.width, tick.thickness);

        // Chainage text labels
        if (tick.label) {
          ctx.save();
          ctx.font = tick.isBold
            ? "bold 11px 'Barlow Condensed', sans-serif"
            : "10px 'IBM Plex Mono', monospace";
          ctx.fillStyle = tick.isBold ? '#121311' : '#383B36';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          // Place label to the right of spine tick
          ctx.fillText(tick.label, spineX + 12, tick.y);
          ctx.restore();
        }
      }
    }

    /**
     * Draw Designed Absences
     */
    renderAbsences(ctx, w, h, userCh, facing) {
      if (!this.absences.length) return;

      for (const abs of this.absences) {
        const colIdx = this.layout.resolveColumn(abs.side || 'L', abs.lane || 'plat', abs.offset_m);
        const colBounds = this.layout.getColumnBounds(colIdx);
        const bounds = this.layout.transformBounds(colBounds.xStart, colBounds.width, facing);

        const y1 = this.layout.chainageToY(abs.ch_start, userCh, facing);
        const y2 = this.layout.chainageToY(abs.ch_end, userCh, facing);
        const topY = Math.min(y1, y2);
        const height = Math.abs(y2 - y1);

        if (topY + height < 0 || topY > h) continue;

        // Diagonal hatched none-by-design fill
        drawHatchPattern(ctx, bounds.xStart + 2, topY, bounds.width - 4, height, '#8C8F87', 1, 8);

        ctx.save();
        ctx.strokeStyle = '#8C8F87';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);

        // Draw bounding box
        ctx.strokeRect(bounds.xStart + 2, topY, bounds.width - 4, height);

        // Vertical text "NONE · BY DESIGN"
        ctx.font = "bold 9px 'IBM Plex Mono', monospace";
        ctx.fillStyle = '#555952';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.translate(bounds.xStart + (bounds.width / 2), topY + (height / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("NONE · BY DESIGN", 0, 0);
        ctx.restore();

        ctx.restore();
      }
    }

    /**
     * Draw All Features
     */
    renderFeatures(ctx, w, h, userCh, facing) {
      const range = this.layout.getVisibleChainageRange(userCh, facing);

      // Separate points for clustering
      const points = [];
      const nonPoints = [];

      for (const f of this.features) {
        if (f.status === 'removed') continue;
        if (f.geometry === 'point') {
          points.push(f);
        } else {
          nonPoints.push(f);
        }
      }

      // Cluster points
      const clusterResult = this.layout.clusterPointFeatures(points);

      // 1. Render Crossing structures (from Left TOE to Right TOE)
      for (const feat of nonPoints) {
        if (feat.geometry === 'crossing') {
          this.renderCrossingFeature(ctx, feat, userCh, facing);
        }
      }

      // 2. Render Buried T6 Collector inside spine
      for (const feat of nonPoints) {
        if (feat.type_code === '6' || feat.type_code === 'T6') {
          this.renderBuriedCollector(ctx, feat, userCh, facing);
        }
      }

      // 3. Render Linear features (11px wide bar, derived 4m dotted cap)
      for (const feat of nonPoints) {
        if (feat.geometry === 'linear' && feat.type_code !== '6' && feat.type_code !== 'T6') {
          this.renderLinearFeature(ctx, feat, userCh, facing);
        }
      }

      // 4. Render Off-alignment features
      for (const feat of nonPoints) {
        if (feat.geometry === 'off_alignment') {
          this.renderOffAlignmentFeature(ctx, feat, userCh, facing);
        }
      }

      // 5. Render Label positions (Riprap callout dashed circles)
      for (const feat of nonPoints) {
        if (feat.geometry === 'label') {
          this.renderLabelFeature(ctx, feat, userCh, facing);
        }
      }

      // 6. Render Unclustered Point features (16px squares)
      for (const pt of clusterResult.unclustered) {
        this.renderPointFeature(ctx, pt, userCh, facing);
      }

      // 7. Render Cluster count chips (24px stacked shadow chips)
      for (const cl of clusterResult.clusters) {
        this.renderClusterChip(ctx, cl, userCh, facing);
      }
    }

    /**
     * Draw Crossing Feature: 12px band across corridor from Left TOE to Right TOE
     */
    renderCrossingFeature(ctx, feat, userCh, facing) {
      const ch = typeof feat.ch === 'number' ? feat.ch : feat.ch_start;
      const y = this.layout.chainageToY(ch, userCh, facing);

      if (y < -20 || y > this.layout.height + 20) return;

      const bounds = this.layout.getCrossingCorridorBounds(facing);

      // Determine fill based on state
      const stage = (feat.current_stage || feat.stage || 'not started').toLowerCase();
      const isComplete = (stage === 'completed' || stage.includes('completed') || stage.includes('approved'));
      const isPartBuilt = (stage !== 'not started' && !isComplete);

      ctx.save();
      if (isComplete) {
        ctx.fillStyle = '#121311';
        ctx.fillRect(bounds.xStart, y - 6, bounds.width, 12);
      } else if (isPartBuilt) {
        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 2;
        ctx.strokeRect(bounds.xStart, y - 6, bounds.width, 12);
        // Diagonal hatch pattern
        drawHatchPattern(ctx, bounds.xStart + 1, y - 5, bounds.width - 2, 10, '#121311', 1.5, 6);
      } else {
        // Outline uninspected
        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 2;
        ctx.strokeRect(bounds.xStart, y - 6, bounds.width, 12);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(bounds.xStart + 1, y - 5, bounds.width - 2, 10);
      }

      // Black exact-chainage chip on the right
      const km = Math.floor(ch / 1000);
      const mStr = (ch % 1000).toFixed(3).padStart(7, '0');
      const chipText = `+${mStr}`;

      const chipX = bounds.xStart + bounds.width + 4;
      if (chipX + 50 <= this.layout.width) {
        ctx.fillStyle = '#121311';
        ctx.fillRect(chipX, y - 8, 54, 16);
        ctx.font = "bold 9px 'IBM Plex Mono', monospace";
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chipText, chipX + 27, y);
      }

      // Defect Warning Triangle (18px) beside crossing mark if defect exists
      if (feat.has_defect || (Array.isArray(feat.defects) && feat.defects.length > 0)) {
        this.renderDefectTriangle(ctx, bounds.xStart - 14, y);
      }

      ctx.restore();
    }

    /**
     * Draw Linear Feature: 11px wide bar, derived 4m dotted cap
     */
    renderLinearFeature(ctx, feat, userCh, facing) {
      const chStart = feat.ch_start;
      const chEnd = feat.ch_end;
      const isDerived = (feat.position_certainty === 'derived');

      const colIdx = this.layout.resolveColumn(feat.side, feat.lane, feat.offset_m);
      const colX = this.layout.getColumnXCenter(colIdx);
      const screenX = this.layout.transformX(colX, facing);

      const geom = this.layout.calculateDerivedExtentGeometry(chStart, chEnd, userCh, facing, isDerived);

      const stage = (feat.current_stage || feat.stage || 'not started').toLowerCase();
      const isComplete = (stage === 'completed' || stage.includes('completed') || stage.includes('approved'));
      const isPartBuilt = (stage !== 'not started' && !isComplete);

      ctx.save();

      // Draw Main 11px Bar
      const mainYTop = Math.min(geom.mainSpan.y1, geom.mainSpan.y2);
      const mainHeight = Math.abs(geom.mainSpan.y2 - geom.mainSpan.y1);

      if (isComplete) {
        ctx.fillStyle = '#121311';
        ctx.fillRect(screenX - 5.5, mainYTop, 11, mainHeight);
      } else if (isPartBuilt) {
        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX - 5.5, mainYTop, 11, mainHeight);
        // Fill partial diagonal hatch
        drawHatchPattern(ctx, screenX - 4.5, mainYTop + 1, 9, mainHeight - 2, '#121311', 1.5, 6);
      } else {
        // Outline
        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX - 5.5, mainYTop, 11, mainHeight);
      }

      // Draw Derived 4m Dotted Caps (3px dotted line)
      if (geom.hasDerivedCaps) {
        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 3]);

        // Start cap
        ctx.beginPath();
        ctx.moveTo(screenX, geom.capStart.y1);
        ctx.lineTo(screenX, geom.capStart.y2);
        ctx.stroke();

        // End cap
        ctx.beginPath();
        ctx.moveTo(screenX, geom.capEnd.y1);
        ctx.lineTo(screenX, geom.capEnd.y2);
        ctx.stroke();
      }

      // Type Chip (28x17px) near top of bar, or pinned within visible viewport for long bars
      const chipCode = formatTypeCode(feat.type_code, feat.category);
      let chipY = mainYTop + 2;
      if (mainHeight > 50 && mainYTop < 20) {
        chipY = Math.max(mainYTop + 2, Math.min(20, mainYTop + mainHeight - 22));
      }
      ctx.fillStyle = '#121311';
      ctx.fillRect(screenX - 14, chipY, 28, 17);
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chipCode, screenX, chipY + 8.5);

      // Defect Warning Triangle (18px) beside mark if defect exists
      if (feat.has_defect || (Array.isArray(feat.defects) && feat.defects.length > 0)) {
        this.renderDefectTriangle(ctx, screenX + 16, mainYTop + 10);
      }

      ctx.restore();
    }

    /**
     * Draw Point Feature: 16px square
     */
    renderPointFeature(ctx, feat, userCh, facing) {
      const ch = feat.ch || feat.ch_start;
      const y = this.layout.chainageToY(ch, userCh, facing);

      const colIdx = this.layout.resolveColumn(feat.side, feat.lane, feat.offset_m);
      const colX = this.layout.getColumnXCenter(colIdx);
      const screenX = this.layout.transformX(colX, facing);

      ctx.save();
      ctx.fillStyle = '#121311';
      ctx.fillRect(screenX - 8, y - 8, 16, 16);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(screenX - 8, y - 8, 16, 16);

      if (feat.has_defect || (Array.isArray(feat.defects) && feat.defects.length > 0)) {
        this.renderDefectTriangle(ctx, screenX + 14, y);
      }

      if (feat.version && feat.version > 1) {
        ctx.fillStyle = 'var(--rev, #1446A0)';
        ctx.beginPath();
        ctx.arc(screenX - 10, y - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = "bold 8px 'IBM Plex Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', screenX - 10, y - 10);
      }

      ctx.restore();
    }

    /**
     * Draw Cluster Count Chip: 24px count chip with stacked shadow
     */
    renderClusterChip(ctx, cluster, userCh, facing) {
      const y = this.layout.chainageToY(cluster.ch, userCh, facing);
      const colX = this.layout.getColumnXCenter(cluster.columnIndex);
      const screenX = this.layout.transformX(colX, facing);

      ctx.save();
      // Stacked shadow background
      ctx.fillStyle = 'rgba(18, 19, 17, 0.2)';
      ctx.beginPath();
      ctx.arc(screenX + 2, y + 2, 12, 0, Math.PI * 2);
      ctx.fill();

      // Primary chip circle
      ctx.fillStyle = '#121311';
      ctx.beginPath();
      ctx.arc(screenX, y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFD100';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Count text
      ctx.font = "bold 11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cluster.count), screenX, y);

      ctx.restore();
    }

    /**
     * Draw Label Position (Riprap): 20px dashed circle with italic text ("L=28m")
     */
    renderLabelFeature(ctx, feat, userCh, facing) {
      const ch = feat.ch || feat.ch_start;
      const y = this.layout.chainageToY(ch, userCh, facing);

      const colIdx = this.layout.resolveColumn(feat.side, feat.lane, feat.offset_m);
      const colX = this.layout.getColumnXCenter(colIdx);
      const screenX = this.layout.transformX(colX, facing);

      const lengthText = feat.specs || `L=${feat.length_m || 28}m`;

      ctx.save();
      ctx.strokeStyle = '#555952';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.arc(screenX, y, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Italic callout text beside circle
      ctx.font = "italic 11px 'Barlow', sans-serif";
      ctx.fillStyle = '#383B36';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lengthText, screenX + 14, y);

      ctx.restore();
    }

    /**
     * Draw Off-Alignment Feature: 18x28px mark in OFF lane, dashed leader to spine
     */
    renderOffAlignmentFeature(ctx, feat, userCh, facing) {
      const servesCh = typeof feat.serves_ch === 'number' ? feat.serves_ch : feat.ch;
      const yFeat = this.layout.chainageToY(feat.ch || servesCh, userCh, facing);
      const ySpine = this.layout.chainageToY(servesCh, userCh, facing);

      const colIdx = this.layout.resolveColumn(feat.side, 'off', feat.offset_m);
      const colX = this.layout.getColumnXCenter(colIdx);
      const screenX = this.layout.transformX(colX, facing);

      const spineX = this.layout.transformX(this.layout.getColumnXCenter(5), facing);

      ctx.save();

      // Dashed leader to spine at chainage served
      ctx.strokeStyle = '#555952';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(screenX, yFeat);
      ctx.lineTo(spineX, ySpine);
      ctx.stroke();

      // 18x28px mark in OFF lane
      ctx.setLineDash([]);
      ctx.fillStyle = '#121311';
      ctx.fillRect(screenX - 9, yFeat - 14, 18, 28);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(screenX - 9, yFeat - 14, 18, 28);

      // Distance text written near mark (e.g. "180 m")
      const distText = `${feat.distance_out_m || 180} m`;
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#121311';
      ctx.textAlign = feat.side === 'L' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      const labelX = feat.side === 'L' ? (screenX - 12) : (screenX + 12);
      ctx.fillText(distText, labelX, yFeat);

      ctx.restore();
    }

    /**
     * Draw Buried T6 Collector: 3px dashed line inside spine
     */
    renderBuriedCollector(ctx, feat, userCh, facing) {
      const y1 = this.layout.chainageToY(feat.ch_start, userCh, facing);
      const y2 = this.layout.chainageToY(feat.ch_end, userCh, facing);
      const spineX = this.layout.transformX(this.layout.getColumnXCenter(5), facing);

      ctx.save();
      ctx.strokeStyle = '#FFD100'; // Hi-vis dashed collector inside ink spine
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(spineX, y1);
      ctx.lineTo(spineX, y2);
      ctx.stroke();

      ctx.restore();
    }

    /**
     * Draw 18px Red Warning Triangle for Defects
     */
    renderDefectTriangle(ctx, x, y) {
      WalkStripLayout.drawDefectWarningTriangle(ctx, x, y);
    }

    /**
     * Draw Near Band (+/- 20m) & Reading Line
     */
    renderReadingLineAndNearBand(ctx, w, h, userCh, facing) {
      const readingLineY = this.layout.getReadingLineY();
      const nearBand = this.layout.getNearBandBounds(userCh, facing);
      const acc = typeof this.userPosition.accuracy_m === 'number' ? this.userPosition.accuracy_m : 4.0;
      const isPoorGps = acc > 10.0;

      ctx.save();

      // 1. Near Band Tint: 16% hi-vis tint
      ctx.fillStyle = 'rgba(255, 209, 0, 0.16)';
      ctx.fillRect(0, nearBand.yTop, w, nearBand.heightPx);

      // Dashed edges labeled "+20 m" / "-20 m"
      ctx.strokeStyle = '#121311';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Top edge
      ctx.beginPath();
      ctx.moveTo(0, nearBand.yTop);
      ctx.lineTo(w, nearBand.yTop);
      ctx.stroke();

      // Bottom edge
      ctx.beginPath();
      ctx.moveTo(0, nearBand.yBottom);
      ctx.lineTo(w, nearBand.yBottom);
      ctx.stroke();

      // Edge labels (inverted when walking decreasing)
      const topLabel = (facing === 'decreasing') ? '-20 m' : '+20 m';
      const bottomLabel = (facing === 'decreasing') ? '+20 m' : '-20 m';

      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#383B36';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(topLabel, w - 8, nearBand.yTop - 2);

      ctx.textBaseline = 'top';
      ctx.fillText(bottomLabel, w - 8, nearBand.yBottom + 2);

      // 2. Reading Line / Poor GPS Uncertainty Band
      if (isPoorGps) {
        // Spec §5 line 166: When accuracy_m > 10, reading line expands to a shaded band representing +/- accuracy_m
        const yAcc1 = this.layout.chainageToY(userCh - acc, userCh, facing);
        const yAcc2 = this.layout.chainageToY(userCh + acc, userCh, facing);
        const accTop = Math.min(yAcc1, yAcc2);
        const accHeight = Math.abs(yAcc2 - yAcc1);

        ctx.fillStyle = 'rgba(255, 209, 0, 0.35)';
        ctx.fillRect(0, accTop, w, accHeight);

        ctx.strokeStyle = '#121311';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(0, accTop, w, accHeight);

        // Dashed center reading line
        ctx.beginPath();
        ctx.moveTo(0, readingLineY);
        ctx.lineTo(w, readingLineY);
        ctx.stroke();
      } else {
        // Normal 14px hi-vis band with 2px ink edges
        ctx.setLineDash([]);
        ctx.fillStyle = '#FFD100';
        ctx.fillRect(0, readingLineY - 7, w, 14);

        // 2px ink edges
        ctx.fillStyle = '#121311';
        ctx.fillRect(0, readingLineY - 7, w, 2);
        ctx.fillRect(0, readingLineY + 5, w, 2);
      }

      // 3. Current User Position: 24px hi-vis dot with 4px ink ring (inner r=12, outer r=16)
      const userColIdx = this.layout.resolveColumn(this.userPosition.side, null, this.userPosition.offset_m);
      const userColX = this.layout.getColumnXCenter(userColIdx);
      const userScreenX = this.layout.transformX(userColX, facing);

      // 4px ink outer ring (outer radius 16px)
      ctx.setLineDash([]);
      ctx.fillStyle = '#121311';
      ctx.beginPath();
      ctx.arc(userScreenX, readingLineY, 16, 0, Math.PI * 2);
      ctx.fill();

      // 24px hi-vis dot (inner radius 12px)
      ctx.fillStyle = '#FFD100';
      ctx.beginPath();
      ctx.arc(userScreenX, readingLineY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Center dot (radius 3px)
      ctx.fillStyle = '#121311';
      ctx.beginPath();
      ctx.arc(userScreenX, readingLineY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // =========================================================================
  // 4. EXPORT MODULE
  // =========================================================================

  return {
    WalkStripLayout: WalkStripLayout,
    WalkStrip: WalkStrip,
    formatTypeCode: formatTypeCode,
    drawHatchPattern: drawHatchPattern,
    STRIP_WIDTH: STRIP_WIDTH,
    SCALE_PX_PER_M: SCALE_PX_PER_M,
    READING_LINE_RATIO: READING_LINE_RATIO,
    LANE_COLUMNS: LANE_COLUMNS,
    CROSSING_CORRIDOR: CROSSING_CORRIDOR
  };
}));
