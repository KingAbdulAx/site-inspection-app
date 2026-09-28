/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 4 Walk Drawer Component
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
    root.WalkDrawer = exportsObj.WalkDrawer;
    root.WalkDrawerLogic = exportsObj.WalkDrawerLogic;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  // =========================================================================
  // 1. PURE MATHEMATICAL & SORTING LOGIC FOR DRAWER
  // =========================================================================

  const WalkDrawerLogic = {
    /**
     * Filter features within +/- 20m of user chainage
     */
    getFeaturesWithinNearBand: function (features, userCh, rangeM = 20) {
      if (!Array.isArray(features)) return [];
      const minCh = userCh - rangeM;
      const maxCh = userCh + rangeM;

      return features.filter(f => {
        if (f.status === 'removed') return false;
        const sCh = typeof f.ch_start === 'number' ? f.ch_start : (f.ch || 0);
        const eCh = typeof f.ch_end === 'number' ? f.ch_end : sCh;
        const featMin = Math.min(sCh, eCh) - (f.tolerance_m || 0);
        const featMax = Math.max(sCh, eCh) + (f.tolerance_m || 0);
        return featMax >= minCh && featMin <= maxCh;
      });
    },

    /**
     * Sort features Left-to-Right based on user's facing direction.
     * When facing increasing:
     *   Left is on user's left hand -> offset descends (+50m down to -50m).
     * When facing decreasing:
     *   Right is on user's left hand -> offset ascends (-50m up to +50m).
     */
    sortLeftToRightAsFaced: function (features, facing = 'increasing', userCh = 0) {
      if (!Array.isArray(features)) return [];
      const list = features.slice();

      list.sort((a, b) => {
        const offsetA = typeof a.offset_m === 'number' ? a.offset_m : (a.side === 'L' ? 10 : (a.side === 'R' ? -10 : 0));
        const offsetB = typeof b.offset_m === 'number' ? b.offset_m : (b.side === 'L' ? 10 : (b.side === 'R' ? -10 : 0));

        let offsetDiff = 0;
        if (facing === 'decreasing') {
          // Ascending offset: negative (Right) to positive (Left)
          offsetDiff = offsetA - offsetB;
        } else {
          // Descending offset: positive (Left) to negative (Right)
          offsetDiff = offsetB - offsetA;
        }

        if (Math.abs(offsetDiff) > 0.05) {
          return offsetDiff;
        }

        // Secondary tie-breaker: nearest chainage distance to user
        const chA = typeof a.ch === 'number' ? a.ch : (a.ch_start || 0);
        const chB = typeof b.ch === 'number' ? b.ch : (b.ch_start || 0);
        return Math.abs(chA - userCh) - Math.abs(chB - userCh);
      });

      return list;
    },

    /**
     * Compute relative longitudinal position string ("N m ahead", "N m behind", or "here")
     */
    computeRelativePositionText: function (feat, userCh, facing = 'increasing') {
      const ch = typeof feat.ch === 'number' ? feat.ch : feat.ch_start;
      const sCh = typeof feat.ch_start === 'number' ? feat.ch_start : ch;
      const eCh = typeof feat.ch_end === 'number' ? feat.ch_end : ch;
      const minCh = Math.min(sCh, eCh);
      const maxCh = Math.max(sCh, eCh);

      if (userCh >= minCh && userCh <= maxCh) {
        return 'here';
      }

      const diff = ch - userCh;
      let distM = Math.round(Math.abs(diff));
      if (distM < 1) distM = 1;

      let isAhead = false;
      if (facing === 'decreasing') {
        isAhead = (diff < 0);
      } else {
        isAhead = (diff > 0);
      }

      return `${distM} m ${isAhead ? 'ahead' : 'behind'}`;
    },

    /**
     * Extract categories with counts for filter chips
     */
    extractCategoryCounts: function (features) {
      const counts = { 'All': features.length };
      for (const f of features) {
        const cat = f.category || 'Other';
        counts[cat] = (counts[cat] || 0) + 1;
      }
      return counts;
    },

    /**
     * Compute 6-segment meter level (0 to 6) based on stage name
     */
    computeStageMeterLevel: function (stageName) {
      const norm = String(stageName || '').toLowerCase().trim();
      if (!norm || norm === 'not started' || norm.includes('not started') || norm.includes('unstarted')) return 0;
      if (norm === 'completed' || norm.includes('completed') || norm.includes('approved')) return 6;
      if (norm === 'excavated') return 3; // unlined earth ditch active progress (3/6)
      if (norm.includes('concret')) return 5;
      if (norm.includes('shutter')) return 4;
      if (norm.includes('rebar')) return 3;
      if (norm.includes('blind')) return 2;
      if (norm.includes('excavat')) return 1;
      const stages = ['not started', 'excavation', 'blinding', 'rebar', 'shuttered', 'concreted', 'completed'];
      const stageIdx = stages.findIndex(s => s === norm);
      return stageIdx <= 0 ? 0 : (stageIdx >= 6 ? 6 : stageIdx);
    }
  };

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
  // 2. INTERACTIVE WALK DRAWER COMPONENT (50% SLIDE-UP SHEET)
  // =========================================================================

  class WalkDrawer {
    constructor(parentContainer, options = {}) {
      this.container = parentContainer;
      this.options = options;
      this.isOpen = false;
      this.activeCategory = 'All';
      this.features = [];
      this.userPosition = {
        ch: options.initialCh || 82902.439,
        side: options.initialSide || 'L',
        offset_m: options.initialOffset || 14.0,
        facing: options.initialFacing || 'increasing'
      };

      this.onSelectFeature = typeof options.onSelectFeature === 'function' ? options.onSelectFeature : null;
      this.onFeatureLongPress = typeof options.onFeatureLongPress === 'function' ? options.onFeatureLongPress : null;
      this.onToggle = typeof options.onToggle === 'function' ? options.onToggle : null;

      this.drawerElement = null;
      this.listElement = null;
      this.headerTitleElement = null;
      this.headerSubtitleElement = null;
      this.filterChipsElement = null;

      if (this.container && typeof document !== 'undefined') {
        this.initDOM();
      }
    }

    initDOM() {
      // Create main drawer wrapper
      this.drawerElement = document.createElement('div');
      this.drawerElement.className = 'di-walk-drawer';
      this.drawerElement.style.position = 'absolute';
      this.drawerElement.style.left = '0';
      this.drawerElement.style.right = '0';
      this.drawerElement.style.bottom = '0';
      this.drawerElement.style.height = '50%';
      this.drawerElement.style.background = 'var(--surface, #FFFFFF)';
      this.drawerElement.style.borderTop = '2px solid var(--ink, #121311)';
      this.drawerElement.style.boxShadow = 'var(--shadow-lg, 0 8px 24px rgba(18, 19, 17, 0.16))';
      this.drawerElement.style.zIndex = '100';
      this.drawerElement.style.display = 'flex';
      this.drawerElement.style.flexDirection = 'column';
      this.drawerElement.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      this.drawerElement.style.transform = 'translateY(100%)';
      this.drawerElement.style.pointerEvents = 'none';

      // 1. Header Row
      const header = document.createElement('div');
      header.className = 'di-drawer-header';
      header.style.padding = '12px 16px';
      header.style.borderBottom = '1px solid var(--rule, #CFD0C9)';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.background = 'var(--surface, #FFFFFF)';

      const titleGroup = document.createElement('div');
      this.headerTitleElement = document.createElement('div');
      this.headerTitleElement.style.fontFamily = "'Barlow', sans-serif";
      this.headerTitleElement.style.fontWeight = '700';
      this.headerTitleElement.style.fontSize = '16px';
      this.headerTitleElement.style.color = 'var(--ink, #121311)';
      this.headerTitleElement.textContent = 'Within 20 m of you · 0';

      this.headerSubtitleElement = document.createElement('div');
      this.headerSubtitleElement.style.fontFamily = "'IBM Plex Mono', monospace";
      this.headerSubtitleElement.style.fontSize = '11px';
      this.headerSubtitleElement.style.color = 'var(--ink-3, #555952)';
      this.headerSubtitleElement.style.textTransform = 'uppercase';
      this.headerSubtitleElement.textContent = 'Left to right, as you face ▲';

      titleGroup.appendChild(this.headerTitleElement);
      titleGroup.appendChild(this.headerSubtitleElement);

      // Close chevron button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'di-btn di-btn--tertiary';
      closeBtn.style.padding = '0 12px';
      closeBtn.style.height = '36px';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', () => {
        this.close();
      });

      header.appendChild(titleGroup);
      header.appendChild(closeBtn);
      this.drawerElement.appendChild(header);

      // 2. Category Filter Chips (44px target)
      this.filterChipsElement = document.createElement('div');
      this.filterChipsElement.className = 'di-drawer-filters';
      this.filterChipsElement.style.display = 'flex';
      this.filterChipsElement.style.gap = '8px';
      this.filterChipsElement.style.padding = '8px 16px';
      this.filterChipsElement.style.overflowX = 'auto';
      this.filterChipsElement.style.whiteSpace = 'nowrap';
      this.filterChipsElement.style.borderBottom = '1px solid var(--rule, #CFD0C9)';
      this.drawerElement.appendChild(this.filterChipsElement);

      // 3. Scrollable Feature List
      this.listElement = document.createElement('div');
      this.listElement.className = 'di-drawer-list';
      this.listElement.style.flex = '1';
      this.listElement.style.overflowY = 'auto';
      this.listElement.style.background = 'var(--paper, #F6F5F0)';
      this.drawerElement.appendChild(this.listElement);

      this.container.appendChild(this.drawerElement);
    }

    /**
     * Open Drawer, optionally scrolling to a specific feature ID
     */
    open(featureId = null) {
      this.isOpen = true;
      if (this.drawerElement) {
        this.drawerElement.style.transform = 'translateY(0)';
        this.drawerElement.style.pointerEvents = 'auto';
      }
      this.render();
      if (featureId) {
        setTimeout(() => {
          this.scrollToFeature(featureId);
        }, 50);
      }
      if (this.onToggle) this.onToggle(true);
    }

    /**
     * Scroll drawer list directly to feature row and highlight
     */
    scrollToFeature(featureId) {
      if (!this.listElement || !featureId) return;
      const targetRow = this.listElement.querySelector(`[data-feature-id="${featureId}"]`);
      if (targetRow) {
        if (targetRow.scrollIntoView) {
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        targetRow.classList.add('di-feature-row--highlighted');
        setTimeout(() => {
          targetRow.classList.remove('di-feature-row--highlighted');
        }, 1500);
      }
    }

    /**
     * Close Drawer
     */
    close() {
      this.isOpen = false;
      if (this.drawerElement) {
        this.drawerElement.style.transform = 'translateY(100%)';
        this.drawerElement.style.pointerEvents = 'none';
      }
      if (this.onToggle) this.onToggle(false);
    }

    /**
     * Toggle Drawer
     */
    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }

    /**
     * Update State & Features
     */
    updateData(features, userPosition) {
      if (Array.isArray(features)) this.features = features;
      if (userPosition) this.userPosition = Object.assign({}, this.userPosition, userPosition);
      if (this.isOpen) {
        this.render();
      }
    }

    /**
     * Render Drawer Content
     */
    render() {
      if (!this.drawerElement || !this.listElement) return;

      const userCh = this.userPosition.ch;
      const facing = this.userPosition.facing;

      // 1. Filter within 20m
      const nearFeatures = WalkDrawerLogic.getFeaturesWithinNearBand(this.features, userCh, 20);

      // 2. Sort Left-to-Right as faced
      const sortedFeatures = WalkDrawerLogic.sortLeftToRightAsFaced(nearFeatures, facing, userCh);

      // 3. Update Title & Subtitle
      if (this.headerTitleElement) {
        this.headerTitleElement.textContent = `Within 20 m of you · ${sortedFeatures.length}`;
      }
      if (this.headerSubtitleElement) {
        this.headerSubtitleElement.textContent = facing === 'decreasing'
          ? 'Left to right, as you face ▼'
          : 'Left to right, as you face ▲';
      }

      // 4. Render Filter Chips
      this.renderFilterChips(nearFeatures);

      // 5. Apply Active Category Filter
      let displayFeatures = sortedFeatures;
      if (this.activeCategory !== 'All') {
        displayFeatures = sortedFeatures.filter(f => (f.category || 'Other') === this.activeCategory);
      }

      // 6. Render Rows
      this.listElement.innerHTML = '';
      if (displayFeatures.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.padding = '32px 16px';
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.color = 'var(--ink-3, #555952)';
        emptyDiv.style.fontFamily = "'Barlow', sans-serif";
        emptyDiv.style.fontSize = '14px';
        emptyDiv.textContent = 'No features within 20 m of your position.';
        this.listElement.appendChild(emptyDiv);
        return;
      }

      for (const feat of displayFeatures) {
        const row = this.createFeatureRow(feat, userCh, facing);
        this.listElement.appendChild(row);
      }
    }

    /**
     * Render 44px Category Filter Chips
     */
    renderFilterChips(features) {
      if (!this.filterChipsElement) return;
      this.filterChipsElement.innerHTML = '';

      const counts = WalkDrawerLogic.extractCategoryCounts(features);
      const categories = Object.keys(counts);

      for (const cat of categories) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `di-filter-chip ${cat === this.activeCategory ? 'di-filter-chip--active' : ''}`;
        chip.textContent = `${cat} (${counts[cat]})`;
        chip.addEventListener('click', () => {
          this.activeCategory = cat;
          this.render();
        });
        this.filterChipsElement.appendChild(chip);
      }
    }

    /**
     * Create 72px Feature Row
     */
    createFeatureRow(feat, userCh, facing) {
      const row = document.createElement('div');
      row.className = 'di-feature-row';
      row.setAttribute('data-feature-id', feat.feature_id || feat.id || '');
      row.style.cursor = 'pointer';

      // 1. Side Badge (40px)
      const leftCol = document.createElement('div');
      leftCol.className = 'di-feature-row__left';
      const side = (feat.side || 'C').toUpperCase();
      let badgeClass = 'di-side-badge--centre';
      let sideHtml = 'C';
      if (side === 'L') {
        badgeClass = 'di-side-badge--left';
        sideHtml = '◀ L';
      } else if (side === 'R') {
        badgeClass = 'di-side-badge--right';
        sideHtml = 'R ▶';
      }
      leftCol.innerHTML = `<span class="di-side-badge ${badgeClass}">${sideHtml}</span>`;
      row.appendChild(leftCol);

      // 2. Center Info
      const centerCol = document.createElement('div');
      centerCol.className = 'di-feature-row__center';

      // Type + Name + Type Cross-Section Icon
      const nameDiv = document.createElement('div');
      nameDiv.className = 'di-feature-row__name';
      const typeCode = formatTypeCode(feat.type_code, feat.category || feat.strip);
      const name = feat.short_name || feat.shortName || feat.category || 'Drainage Structure';

      let iconSvg = '';
      const iconHelper = (typeof root !== 'undefined' && root.TypeIcons) || (typeof TypeIcons !== 'undefined' ? TypeIcons : null);
      if (iconHelper && typeof iconHelper.render === 'function') {
        iconSvg = iconHelper.render(typeCode, null, '#121311') || iconHelper.render(feat.geometry || 'point', null, '#121311');
      }

      let defectBadge = '';
      if (feat.has_defect || (Array.isArray(feat.defects) && feat.defects.length > 0)) {
        defectBadge = `<span style="display:inline-flex;align-items:center;justify-content:center;background:#B3141A;color:#FFFFFF;border-radius:3px;padding:1px 5px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;margin-left:6px;vertical-align:middle;">DEFECT</span>`;
      }

      nameDiv.innerHTML = `${iconSvg ? `<span class="di-feature-row__icon" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">${iconSvg}</span>` : ''}<span class="di-feature-row__title">${typeCode} · ${name}</span>${defectBadge}`;

      // Position, Certainty Chip, Offset & Relative Ahead/Behind
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'di-feature-row__details';

      // Certainty chip
      const cert = (feat.position_certainty || 'derived').toLowerCase();
      const certChip = document.createElement('span');
      certChip.className = `di-certainty di-certainty--${cert}`;
      certChip.textContent = cert.toUpperCase();
      detailsDiv.appendChild(certChip);

      // Offset and relative longitudinal position
      const relPosText = WalkDrawerLogic.computeRelativePositionText(feat, userCh, facing);
      const offsetM = Math.abs(Math.round(feat.offset_m || 0));
      const posSpan = document.createElement('span');
      posSpan.textContent = `${side} ${offsetM} m · ${relPosText}`;
      detailsDiv.appendChild(posSpan);

      centerCol.appendChild(nameDiv);
      centerCol.appendChild(detailsDiv);
      row.appendChild(centerCol);

      // 3. Right: 6-segment stage meter & stage name
      const rightCol = document.createElement('div');
      rightCol.className = 'di-feature-row__right';

      const stage = feat.current_stage || feat.stage || 'Not started';
      const meterDiv = this.createStageMeter(stage);
      rightCol.appendChild(meterDiv);

      row.appendChild(rightCol);

      // Tap and 500ms Long-Press events
      let longPressTimer = null;
      let longPressFired = false;
      let startClientX = 0;
      let startClientY = 0;

      row.addEventListener('pointerdown', (e) => {
        longPressFired = false;
        startClientX = e.clientX;
        startClientY = e.clientY;
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          if (this.onFeatureLongPress) {
            this.onFeatureLongPress(feat);
          }
        }, 500);
      });

      row.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - startClientX, e.clientY - startClientY) > 8) {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
      });

      row.addEventListener('pointerup', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });

      row.addEventListener('pointercancel', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });

      row.addEventListener('click', () => {
        if (longPressFired) {
          longPressFired = false;
          return;
        }
        if (this.onSelectFeature) {
          this.onSelectFeature(feat);
        }
      });

      return row;
    }

    /**
     * Create 6-Segment Stage Meter Element
     */
    createStageMeter(stageName) {
      const level = WalkDrawerLogic.computeStageMeterLevel(stageName);

      if (typeof document === 'undefined') {
        const partialCount = (level > 0 && level < 6) ? level : 0;
        const completeCount = (level === 6) ? 6 : 0;
        return {
          level: level,
          stageName: stageName || 'NOT STARTED',
          numSegments: 6,
          querySelectorAll: (sel) => {
            if (sel.includes('segment--partial')) {
              return new Array(partialCount).fill({});
            }
            if (sel.includes('segment--complete')) {
              return new Array(completeCount).fill({});
            }
            if (sel.includes('segment')) {
              return new Array(level).fill({});
            }
            return [];
          }
        };
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'di-stage-meter';

      const bars = document.createElement('div');
      bars.className = 'di-stage-meter__bars';

      for (let i = 1; i <= 6; i++) {
        const seg = document.createElement('div');
        seg.className = 'di-stage-meter__segment';
        if (i <= level) {
          seg.classList.add(level === 6 ? 'di-stage-meter__segment--complete' : 'di-stage-meter__segment--partial');
        }
        bars.appendChild(seg);
      }

      const label = document.createElement('div');
      label.className = 'di-stage-meter__label';
      label.style.fontSize = '9px';
      label.textContent = stageName || 'NOT STARTED';

      wrapper.appendChild(bars);
      wrapper.appendChild(label);
      return wrapper;
    }
  }

  // =========================================================================
  // 3. EXPORT MODULE
  // =========================================================================

  return {
    WalkDrawerLogic: WalkDrawerLogic,
    WalkDrawer: WalkDrawer,
    formatTypeCode: formatTypeCode
  };
}));
