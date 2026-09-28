/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 4 Identify View Component
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.2 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.IdentifyLogic = exportsObj.IdentifyLogic;
    root.IdentifyView = exportsObj.IdentifyView;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  const BUBBLE_SYMBOLS = ['①', '②', '③', '④', '⑤'];

  /**
   * Format type code cleanly without mangling
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
    if (/^\d+[A-Z]?$/.test(str)) return 'T' + str;
    if (/^T\d+[A-Z]?$/.test(str)) return str;
    return str;
  }

  // =========================================================================
  // 1. PURE MATHEMATICAL & LAYOUT LOGIC FOR IDENTIFY VIEW
  // =========================================================================

  const IdentifyLogic = {
    BUBBLE_SYMBOLS: BUBBLE_SYMBOLS,

    /**
     * Assign numbered bubbles to up to 5 features within +/- 20m.
     * Prioritizes crossing structures first, then nearest by lateral offset.
     */
    assignBubbleNumbers: function (featuresWithin20m, userPosition = {}) {
      if (!Array.isArray(featuresWithin20m) || featuresWithin20m.length === 0) {
        return [];
      }

      const userCh = typeof userPosition.ch === 'number' ? userPosition.ch : 0;
      const userOffset = typeof userPosition.offset_m === 'number' ? userPosition.offset_m : 0;
      const facing = userPosition.facing || 'increasing';

      // 1. Prioritize: crossing structures first, then nearest lateral offset
      const sorted = featuresWithin20m.slice().sort((a, b) => {
        const isCrossA = (a.geometry === 'crossing');
        const isCrossB = (b.geometry === 'crossing');
        if (isCrossA && !isCrossB) return -1;
        if (!isCrossA && isCrossB) return 1;

        // Then nearest lateral offset to user
        const offA = typeof a.offset_m === 'number' ? a.offset_m : 0;
        const offB = typeof b.offset_m === 'number' ? b.offset_m : 0;
        const dOffA = Math.abs(offA - userOffset);
        const dOffB = Math.abs(offB - userOffset);
        if (Math.abs(dOffA - dOffB) > 0.1) {
          return dOffA - dOffB;
        }

        // Secondary: chainage distance
        const chA = typeof a.ch === 'number' ? a.ch : (a.ch_start || 0);
        const chB = typeof b.ch === 'number' ? b.ch : (b.ch_start || 0);
        return Math.abs(chA - userCh) - Math.abs(chB - userCh);
      });

      // Up to 5 items carry numbered bubbles
      const assigned = [];
      const count = Math.min(5, sorted.length);

      for (let i = 0; i < count; i++) {
        const feat = sorted[i];
        const num = i + 1;
        const symbol = BUBBLE_SYMBOLS[i];

        // Compute cross-section SVG coordinates (viewBox 0 0 390 180)
        // Centerline is at x = 195
        const offsetM = typeof feat.offset_m === 'number' ? feat.offset_m : (feat.side === 'L' ? 12 : (feat.side === 'R' ? -12 : 0));
        // Scale: ~4.5 px per lateral meter for cross section diagram (corridor +/-35m fits into 390px)
        // When facing increasing: Positive offset is Left (dx negative from CL 195)
        // When facing decreasing: 180° rotation -> Left is on user's right hand (dx positive from CL 195)
        let bubbleX = facing === 'decreasing'
          ? (195 + (offsetM * 4.2))
          : (195 - (offsetM * 4.2));
        bubbleX = Math.max(24, Math.min(366, bubbleX));

        let bubbleY = 110; // Default ground level
        if (feat.geometry === 'crossing') {
          bubbleX = 195;
          bubbleY = 145; // Beneath embankment barrel
        } else if (feat.lane === 'plat') {
          bubbleY = 80;
        } else if (feat.lane === 'face') {
          bubbleY = 100;
        } else if (feat.lane === 'toe') {
          bubbleY = 125;
        } else if (feat.lane === 'crest') {
          bubbleY = 65;
        }

        // Relative text: "here", "3 m ahead", "3 m behind"
        const featCh = typeof feat.ch === 'number' ? feat.ch : (feat.ch_start || 0);
        const dCh = featCh - userCh;
        let distText = 'here';
        if (Math.abs(dCh) >= 1.0) {
          const m = Math.round(Math.abs(dCh));
          let isAhead = (dCh > 0);
          if (facing === 'decreasing') isAhead = (dCh < 0);
          distText = `${m} m ${isAhead ? '▲' : '▼'}`;
        }

        const typeCode = formatTypeCode(feat.type_code, feat.category || feat.strip);
        const shortName = feat.short_name || feat.shortName || feat.category || 'Structure';
        const sideStr = (feat.side || 'C').toUpperCase();
        const offStr = feat.geometry === 'crossing' ? 'C' : `${sideStr} ${Math.abs(Math.round(offsetM))}m`;

        const buttonLabel = `${symbol} ${typeCode} ${shortName} · ${offStr} · ${distText}`;

        assigned.push({
          bubbleNumber: num,
          bubbleSymbol: symbol,
          feature: feat,
          feature_id: feat.feature_id || feat.id,
          x: bubbleX,
          y: bubbleY,
          buttonLabel: buttonLabel,
          relativePositionText: distText
        });
      }

      return assigned;
    },

    /**
     * Render In-Plane Cross-Section SVG Diagram
     */
    generateCrossSectionSvg: function (assignedBubbles = [], activeFeatureId = null, facing = 'increasing') {
      const isDecreasing = (facing === 'decreasing');
      const leftIndicator = isDecreasing ? '◀ RIGHT' : '◀ LEFT';
      const rightIndicator = isDecreasing ? 'LEFT ▶' : 'RIGHT ▶';
      const clIndicator = isDecreasing ? '▼ CL' : '▲ CL';

      let svg = '<svg viewBox="0 0 390 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="background:#F6F5F0;display:block;">';

      // 1. Natural Ground Line
      svg += '<line x1="10" y1="125" x2="380" y2="125" stroke="#CFD0C9" stroke-width="1.5" stroke-dasharray="4 4"/>';

      // 2. Embankment Fill / Cut Polygon
      // Embankment: crest from x=145 to 245 at y=75, slopes down to toe at x=85 and x=305 at y=125
      svg += '<polygon points="85,125 145,75 245,75 305,125" fill="#ECEBE5" stroke="#121311" stroke-width="2"/>';

      // 3. Ballast Layer
      // Ballast trapezoid from x=165,75 to 225,75 down to top layer at y=68
      svg += '<polygon points="160,75 170,68 220,68 230,75" fill="#383B36" stroke="#121311" stroke-width="1.5"/>';

      // 4. Rails & Sleeper at CL (x = 195)
      // Sleeper
      svg += '<rect x="175" y="65" width="40" height="3" fill="#121311"/>';
      // Left and Right Rails
      svg += '<rect x="187" y="58" width="3" height="7" fill="#121311"/>';
      svg += '<rect x="200" y="58" width="3" height="7" fill="#121311"/>';

      // 5. Track Centerline (CL) Marker
      svg += '<line x1="195" y1="40" x2="195" y2="160" stroke="#121311" stroke-width="1" stroke-dasharray="3 3"/>';
      svg += `<text x="195" y="36" font-family="IBM Plex Mono" font-weight="700" font-size="9" fill="#121311" text-anchor="middle">${clIndicator}</text>`;

      // 6. Culvert Barrel with Headwalls (In-plane crossing structure)
      // Barrel extends beneath embankment from x=75 to 315 at y=140
      svg += '<rect x="80" y="132" width="230" height="16" fill="#FFFFFF" stroke="#121311" stroke-width="2"/>';
      // Left Headwall
      svg += '<rect x="74" y="126" width="6" height="28" fill="#121311"/>';
      // Right Headwall
      svg += '<rect x="310" y="126" width="6" height="28" fill="#121311"/>';

      // 7. Left & Right Toe Ditches
      // Left toe ditch trapezoid at x=85
      svg += '<path d="M72 125 L77 137 L88 137 L93 125" fill="#FFFFFF" stroke="#121311" stroke-width="1.5"/>';
      // Right toe ditch trapezoid at x=305
      svg += '<path d="M297 125 L302 137 L313 137 L318 125" fill="#FFFFFF" stroke="#121311" stroke-width="1.5"/>';

      // 8. Lateral Side Indicators (as faced)
      svg += `<text x="24" y="24" font-family="IBM Plex Mono" font-weight="700" font-size="11" fill="#555952">${leftIndicator}</text>`;
      svg += `<text x="366" y="24" font-family="IBM Plex Mono" font-weight="700" font-size="11" fill="#555952" text-anchor="end">${rightIndicator}</text>`;

      // 9. Numbered Bubbles
      for (const item of assignedBubbles) {
        const isSelected = activeFeatureId && (item.feature_id === activeFeatureId);
        const bubbleBg = isSelected ? '#FFD100' : '#121311';
        const textColor = isSelected ? '#121311' : '#FFFFFF';
        const strokeColor = '#121311';

        svg += `<g class="di-identify-bubble" data-feature-id="${item.feature_id || ''}" style="cursor:pointer;">`;
        svg += `<circle cx="${item.x}" cy="${item.y}" r="12" fill="${bubbleBg}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${item.x}" y="${item.y + 4}" font-family="Barlow" font-weight="700" font-size="12" fill="${textColor}" text-anchor="middle">${item.bubbleNumber}</text>`;
        svg += '</g>';
      }

      svg += '</svg>';
      return svg;
    }
  };

  // =========================================================================
  // 2. INTERACTIVE IDENTIFY VIEW COMPONENT
  // =========================================================================

  class IdentifyView {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.options = options;
      this.features = [];
      this.userPosition = {
        ch: options.initialCh || 82902.439,
        side: options.initialSide || 'L',
        offset_m: options.initialOffset || 14.0,
        facing: options.initialFacing || 'increasing'
      };

      this.selectedFeatureId = null;
      this.assignedBubbles = [];

      this.onSelectFeature = typeof options.onSelectFeature === 'function' ? options.onSelectFeature : null;
      this.onOpenDrawer = typeof options.onOpenDrawer === 'function' ? options.onOpenDrawer : null;

      this.svgContainer = null;
      this.buttonGrid = null;

      if (this.container && typeof document !== 'undefined') {
        this.initDOM();
      }
    }

    initDOM() {
      this.container.innerHTML = '';
      this.container.className = 'di-identify-view';
      this.container.style.width = '100%';
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.background = 'var(--paper, #F6F5F0)';
      this.container.style.boxSizing = 'border-box';

      // 1. Cross-section SVG diagram container
      this.svgContainer = document.createElement('div');
      this.svgContainer.className = 'di-identify-diagram';
      this.svgContainer.style.width = '100%';
      this.svgContainer.style.borderBottom = '1px solid var(--rule, #CFD0C9)';
      this.container.appendChild(this.svgContainer);

      // 2. 3x2 Grid of 60px number buttons
      this.buttonGrid = document.createElement('div');
      this.buttonGrid.className = 'di-identify-grid';
      this.buttonGrid.style.display = 'grid';
      this.buttonGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      this.buttonGrid.style.gap = '8px';
      this.buttonGrid.style.padding = '12px 16px';
      this.buttonGrid.style.boxSizing = 'border-box';
      this.container.appendChild(this.buttonGrid);

      this.render();
    }

    updateData(features, userPosition) {
      if (Array.isArray(features)) this.features = features;
      if (userPosition) this.userPosition = Object.assign({}, this.userPosition, userPosition);
      this.render();
    }

    setSelectedFeature(featureId) {
      this.selectedFeatureId = featureId;
      this.render();
    }

    render() {
      if (!this.svgContainer || !this.buttonGrid) return;

      const userCh = this.userPosition.ch;
      // Filter within +/- 20m
      const nearFeatures = this.features.filter(f => {
        if (f.status === 'removed') return false;
        const sCh = typeof f.ch_start === 'number' ? f.ch_start : (f.ch || 0);
        const eCh = typeof f.ch_end === 'number' ? f.ch_end : sCh;
        return (Math.max(sCh, eCh) >= userCh - 20) && (Math.min(sCh, eCh) <= userCh + 20);
      });

      // Assign bubble numbers (up to 5)
      this.assignedBubbles = IdentifyLogic.assignBubbleNumbers(nearFeatures, this.userPosition);

      // 1. Render SVG Diagram
      this.svgContainer.innerHTML = IdentifyLogic.generateCrossSectionSvg(
        this.assignedBubbles,
        this.selectedFeatureId,
        this.userPosition.facing || 'increasing'
      );

      // Attach click listeners to SVG bubbles
      const bubbleElements = this.svgContainer.querySelectorAll('.di-identify-bubble');
      bubbleElements.forEach(el => {
        el.addEventListener('click', () => {
          const fId = el.getAttribute('data-feature-id');
          const item = this.assignedBubbles.find(b => (b.feature_id === fId || (b.feature && (b.feature.feature_id === fId || b.feature.id === fId))));
          if (item) {
            this.selectedFeatureId = fId;
            this.render();
            if (this.onSelectFeature) this.onSelectFeature(item.feature);
          }
        });
      });

      // 2. Render Grid of 60px buttons (numbered buttons for assigned bubbles + "As a list ▲")
      this.buttonGrid.innerHTML = '';

      for (let i = 0; i < this.assignedBubbles.length; i++) {
        const item = this.assignedBubbles[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'di-btn di-btn--secondary';
        btn.style.height = '60px';
        btn.style.padding = '4px 10px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'flex-start';
        btn.style.textAlign = 'left';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '600';
        btn.style.lineHeight = '1.25';
        btn.style.borderRadius = 'var(--radius-md, 8px)';
        btn.style.boxSizing = 'border-box';

        const isSelected = this.selectedFeatureId && (item.feature_id === this.selectedFeatureId);
        if (isSelected) {
          btn.style.background = 'var(--hivis, #FFD100)';
          btn.style.color = '#121311';
          btn.style.borderColor = '#121311';
        }
        btn.textContent = item.buttonLabel;
        btn.addEventListener('click', () => {
          this.selectedFeatureId = item.feature_id;
          this.render();
          if (this.onSelectFeature) this.onSelectFeature(item.feature);
        });

        this.buttonGrid.appendChild(btn);
      }

      // "As a list ▲" button to open WalkDrawer
      const listBtn = document.createElement('button');
      listBtn.type = 'button';
      listBtn.className = 'di-btn di-btn--primary';
      listBtn.style.height = '60px';
      listBtn.style.fontSize = '15px';
      listBtn.style.letterSpacing = '0.04em';
      listBtn.style.borderRadius = 'var(--radius-md, 8px)';
      listBtn.textContent = 'As a list ▲';
      listBtn.addEventListener('click', () => {
        if (this.onOpenDrawer) {
          this.onOpenDrawer();
        }
      });
      this.buttonGrid.appendChild(listBtn);
    }
  }

  // =========================================================================
  // 3. EXPORT MODULE
  // =========================================================================

  return {
    IdentifyLogic: IdentifyLogic,
    IdentifyView: IdentifyView,
    formatTypeCode: formatTypeCode,
    BUBBLE_SYMBOLS: BUBBLE_SYMBOLS
  };
}));
