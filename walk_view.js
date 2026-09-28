/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 4 Walk View & At-You Bar Coordinator
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.1, Section 6.2 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.AtYouSelectionLogic = exportsObj.AtYouSelectionLogic;
    root.WalkView = exportsObj.WalkView;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  // =========================================================================
  // 1. PURE SELECTION RULE ALGORITHM (§6.1)
  // =========================================================================

  const AtYouSelectionLogic = {
    /**
     * Master Selection Rule:
     * Among features whose extent (including its certainty tolerance) overlaps
     * your chainage +/- GPS accuracy on your side or C:
     * 1. prefer crossing and point structures, nearest first;
     * 2. otherwise the nearest linear feature by lateral offset to you;
     * 3. otherwise show the absence at your position (with its sheet) or "NEXT ▲ N m: {feature}".
     */
    selectAtYouFeature: function (features, absences, userPosition = {}, options = {}) {
      const userCh = typeof userPosition.ch === 'number' ? userPosition.ch : 0;
      const userSide = String(userPosition.side || 'C').toUpperCase();
      const userOffset = typeof userPosition.offset_m === 'number' ? userPosition.offset_m : 0;
      const accuracyM = typeof userPosition.accuracy_m === 'number' ? userPosition.accuracy_m : 4.0;
      const facing = userPosition.facing || 'increasing';
      const isPoor = (options.isPoor === true) || (accuracyM > (options.poorAccuracyThreshold || 10.0));

      const userMinCh = userCh - accuracyM;
      const userMaxCh = userCh + accuracyM;

      const candidates = [];
      const allActive = Array.isArray(features) ? features.filter(f => f.status !== 'removed') : [];

      // 1. Identify overlapping candidates on user's side or C (or crossing)
      for (const feat of allActive) {
        const featSide = String(feat.side || 'C').toUpperCase();
        const isCrossing = (feat.geometry === 'crossing');

        // Side compatibility check:
        // Crossing structures span both sides; Center (C) matches both sides;
        // User at CL matches all; or sides match.
        const sideMatches = isCrossing || (userSide === 'C') || (featSide === 'C') || (featSide === userSide);
        if (!sideMatches) continue;

        // Chainage overlap check with certainty tolerance
        const sCh = typeof feat.ch_start === 'number' ? feat.ch_start : (feat.ch || 0);
        const eCh = typeof feat.ch_end === 'number' ? feat.ch_end : sCh;
        const tol = typeof feat.tolerance_m === 'number' ? feat.tolerance_m : (feat.position_certainty === 'exact' ? 0 : 4.0);

        const featMin = Math.min(sCh, eCh) - tol;
        const featMax = Math.max(sCh, eCh) + tol;

        if (featMax >= userMinCh && featMin <= userMaxCh) {
          // Chainage distance to user
          let dCh = 0;
          if (userCh < Math.min(sCh, eCh)) {
            dCh = Math.min(sCh, eCh) - userCh;
          } else if (userCh > Math.max(sCh, eCh)) {
            dCh = userCh - Math.max(sCh, eCh);
          }

          // Lateral offset distance to user
          const featOffset = typeof feat.offset_m === 'number' ? feat.offset_m : (featSide === 'L' ? 12 : (featSide === 'R' ? -12 : 0));
          const dOffset = Math.abs(featOffset - userOffset);

          candidates.push({
            feature: feat,
            dCh: dCh,
            dOffset: dOffset,
            isCrossingOrPoint: (feat.geometry === 'crossing' || feat.geometry === 'point'),
            isCrossing: isCrossing
          });
        }
      }

      // 2. Count features within 20m for the right-hand counter
      const within20m = allActive.filter(f => {
        const sCh = typeof f.ch_start === 'number' ? f.ch_start : (f.ch || 0);
        const eCh = typeof f.ch_end === 'number' ? f.ch_end : sCh;
        return (Math.max(sCh, eCh) >= userCh - 20) && (Math.min(sCh, eCh) <= userCh + 20);
      });

      // 3. Variant Check: Poor GPS
      if (isPoor && candidates.length > 1) {
        // Find nearest exact crossing structure (e.g. culvert) to anchor
        const culverts = allActive.filter(f => f.geometry === 'crossing' || (f.position_certainty === 'exact'));
        let nearestAnchor = null;
        let minCulvDist = Infinity;
        for (const c of culverts) {
          const cCh = typeof c.ch === 'number' ? c.ch : (c.ch_start || 0);
          const d = Math.abs(cCh - userCh);
          if (d < minCulvDist) {
            minCulvDist = d;
            nearestAnchor = c;
          }
        }

        return {
          variant: 'poor_gps',
          selectedFeature: candidates[0].feature,
          candidatesCount: candidates.length,
          within20mCount: within20m.length,
          nearestAnchor: nearestAnchor,
          bannerText: `GPS can't tell which of ${candidates.length} · Stand on something exact`,
          actionButtonText: nearestAnchor ? `I'm on Culvert ${formatStationExact(nearestAnchor.ch || nearestAnchor.ch_start)} EXACT` : 'Stand on exact culvert'
        };
      }

      // 4. Evaluate Selection Rule Priority
      if (candidates.length > 0) {
        // Priority 1: Crossing and point structures, nearest first
        const crossingAndPoints = candidates.filter(c => c.isCrossingOrPoint);
        if (crossingAndPoints.length > 0) {
          crossingAndPoints.sort((a, b) => {
            if (Math.abs(a.dCh - b.dCh) > 0.1) return a.dCh - b.dCh;
            return a.dOffset - b.dOffset;
          });
          const chosen = crossingAndPoints[0].feature;
          return buildResult(chosen, candidates.length, within20m.length);
        }

        // Priority 2: Nearest linear feature by lateral offset
        candidates.sort((a, b) => {
          if (Math.abs(a.dOffset - b.dOffset) > 0.1) return a.dOffset - b.dOffset;
          return a.dCh - b.dCh;
        });
        const chosen = candidates[0].feature;
        return buildResult(chosen, candidates.length, within20m.length);
      }

      // Priority 3: Fallback — Absence at user position or Next feature ahead
      if (Array.isArray(absences) && absences.length > 0) {
        const matchingAbsence = absences.find(a => {
          const absSide = String(a.side || 'L').toUpperCase();
          const sideOk = (userSide === 'C') || (absSide === userSide);
          return sideOk && (userCh >= a.ch_start) && (userCh <= a.ch_end);
        });

        if (matchingAbsence) {
          // Find next feature ahead
          const nextFeat = findNextFeatureAhead(allActive, userCh, userSide, facing);
          return {
            variant: 'empty_by_design',
            absence: matchingAbsence,
            selectedFeature: null,
            candidatesCount: 0,
            within20mCount: within20m.length,
            title: `No ditch here — by design · ${matchingAbsence.drawing_ref || 'Approved Design'} · Level ${matchingAbsence.approval_level || 'A'}`,
            nextFeature: nextFeat,
            nextText: nextFeat ? `NEXT ▲ ${Math.round(nextFeat.distM)} m ${nextFeat.name}` : ''
          };
        }
      }

      // Fallback: No feature and no absence -> Next feature ahead
      const nextFeat = findNextFeatureAhead(allActive, userCh, userSide, facing);
      return {
        variant: 'empty_stretch',
        selectedFeature: null,
        candidatesCount: 0,
        within20mCount: within20m.length,
        title: 'No drainage structures in immediate range',
        nextFeature: nextFeat,
        nextText: nextFeat ? `NEXT ▲ ${Math.round(nextFeat.distM)} m ${nextFeat.name}` : ''
      };
    }
  };

  /**
   * Helper: format type code cleanly without mangling
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

  /**
   * Helper: format station chainage
   */
  function formatStation(ch) {
    const num = Math.round(Number(ch) || 0);
    const km = Math.floor(num / 1000);
    const m = String(num % 1000).padStart(3, '0');
    return `${km}+${m}`;
  }

  /**
   * Helper: format exact civil station chainage (preserves millimetric decimals)
   */
  function formatStationExact(ch) {
    const num = Number(ch) || 0;
    const km = Math.floor(num / 1000);
    if (Math.abs(num - Math.round(num)) < 0.001) {
      return `${km}+${String(Math.round(num % 1000)).padStart(3, '0')}`;
    }
    const m = (num % 1000).toFixed(3).padStart(7, '0');
    return `${km}+${m}`;
  }

  /**
   * Helper: Find next feature ahead in facing direction
   */
  function findNextFeatureAhead(features, userCh, userSide, facing) {
    let bestFeat = null;
    let minDist = Infinity;

    for (const f of features) {
      const s = String(f.side || 'C').toUpperCase();
      if (s !== 'C' && userSide !== 'C' && s !== userSide && f.geometry !== 'crossing') continue;

      const fCh = typeof f.ch === 'number' ? f.ch : (f.ch_start || 0);
      const diff = fCh - userCh;
      const isAhead = (facing === 'decreasing') ? (diff < 0) : (diff > 0);
      if (isAhead) {
        const dist = Math.abs(diff);
        if (dist < minDist) {
          minDist = dist;
          bestFeat = f;
        }
      }
    }

    if (bestFeat) {
      const typeCode = formatTypeCode(bestFeat.type_code, bestFeat.category || bestFeat.strip);
      const name = `${typeCode} ${bestFeat.short_name || bestFeat.shortName || bestFeat.category || 'Structure'}`.trim();
      return {
        feature: bestFeat,
        distM: minDist,
        name: name
      };
    }
    return null;
  }

  /**
   * Helper: Build standard or revision result
   */
  function buildResult(feat, candidatesCount, within20mCount) {
    // Check if feature has pending drawing revision
    const isRevision = (feat.status === 'pending') || (feat.active_version && feat.active_version.status === 'pending');
    if (isRevision) {
      const rev = feat.source ? feat.source.rev : '07';
      const doc = feat.drawing_ref || 'Approved Drawing';
      return {
        variant: 'revision',
        selectedFeature: feat,
        candidatesCount: candidatesCount,
        within20mCount: within20mCount,
        bannerText: `△${rev} · pending changes near you · ${doc} rev ${rev}`,
        actionButtonText: 'Compare with previous rev'
      };
    }

    return {
      variant: 'normal',
      selectedFeature: feat,
      candidatesCount: candidatesCount,
      within20mCount: within20mCount
    };
  }

  // =========================================================================
  // 2. WALK VIEW SHELL & CONTROLLER COMPONENT
  // =========================================================================

  class WalkView {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.options = options;

      // Current Sub-section & Line
      this.lineId = options.lineId || 'line_km';
      this.subSectionCode = options.subSectionCode || 'KZDR';

      // User State
      this.userPosition = {
        ch: typeof options.initialCh === 'number' ? options.initialCh : 82902.439,
        side: options.initialSide || 'L',
        offset_m: typeof options.initialOffset === 'number' ? options.initialOffset : 14.0,
        accuracy_m: typeof options.initialAccuracy === 'number' ? options.initialAccuracy : 4.0,
        facing: options.initialFacing || 'increasing',
        isManual: false
      };

      this.currentMode = 'strip'; // 'strip' | 'map' | 'section'
      this.features = Array.isArray(options.features) ? options.features : [];
      this.absences = Array.isArray(options.absences) ? options.absences : [];
      this.selectedFeature = null;

      // Callbacks
      this.onRecordStage = typeof options.onRecordStage === 'function' ? options.onRecordStage : null;
      this.onNavigate = typeof options.onNavigate === 'function' ? options.onNavigate : null;

      // Data store & Toast manager
      this.dataStore = options.dataStore || (typeof root !== 'undefined' && root.DataStore ? root.DataStore : null);
      this.toastManager = options.toastManager || null;

      // Phase 5 Sheets
      this.recordView = null;
      this.defectView = null;
      this.featureDetailView = null;

      // Sub-components
      this.walkStrip = null;
      this.walkDrawer = null;
      this.identifyView = null;

      // DOM references
      this.headerElement = null;
      this.stripContainer = null;
      this.atYouBarElement = null;
      this.bottomNavElement = null;
      this.modeToggleElement = null;

      if (this.container && typeof document !== 'undefined') {
        this.initDOM();
      }
    }

    initDOM() {
      this.container.innerHTML = '';
      this.container.className = 'di-walk-view';
      this.container.style.width = '100%';
      this.container.style.maxWidth = '390px';
      this.container.style.height = '100%';
      this.container.style.margin = '0 auto';
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.position = 'relative';
      this.container.style.overflow = 'hidden';
      this.container.style.background = 'var(--paper, #F6F5F0)';
      this.container.style.boxSizing = 'border-box';

      // 1. Position Header (116px)
      this.headerElement = document.createElement('header');
      this.headerElement.className = 'di-position-header';
      this.headerElement.style.height = '116px';
      this.headerElement.style.minHeight = '116px';
      this.headerElement.style.maxHeight = '116px';
      this.headerElement.style.padding = '12px 16px';
      this.headerElement.style.display = 'flex';
      this.headerElement.style.flexDirection = 'column';
      this.headerElement.style.justifyContent = 'space-between';
      this.headerElement.style.background = 'var(--surface, #FFFFFF)';
      this.headerElement.style.borderBottom = '1px solid var(--rule, #CFD0C9)';
      this.headerElement.style.boxSizing = 'border-box';
      this.container.appendChild(this.headerElement);

      // 2. Middle Content: Strip or Identify Container (fills vertical space)
      this.stripContainer = document.createElement('div');
      this.stripContainer.className = 'di-walk-content-container';
      this.stripContainer.style.flex = '1';
      this.stripContainer.style.position = 'relative';
      this.stripContainer.style.overflow = 'hidden';
      this.stripContainer.style.display = 'flex';
      this.stripContainer.style.flexDirection = 'column';
      this.container.appendChild(this.stripContainer);

      // Initialize Walk Strip Engine in content container
      if (typeof root.WalkStrip !== 'undefined') {
        this.walkStrip = new root.WalkStrip(this.stripContainer, {
          initialCh: this.userPosition.ch,
          initialSide: this.userPosition.side,
          initialOffset: this.userPosition.offset_m,
          initialAccuracy: this.userPosition.accuracy_m,
          initialFacing: this.userPosition.facing,
          onFeatureSelect: (feat) => {
            this.selectedFeature = feat;
            this.updateAtYouBar();
            if (this.walkDrawer) this.walkDrawer.open(feat.feature_id || feat.id);
          },
          onFeatureLongPress: (feat) => {
            this.openFeatureDetail(feat);
          },
          onPositionChange: (pos) => {
            this.userPosition = Object.assign({}, this.userPosition, pos);
            this.updatePositionHeader();
            this.updateAtYouBar();
          }
        });
        this.walkStrip.setFeatures(this.features);
        this.walkStrip.setAbsences(this.absences);
      }

      // 3. Floating Segmented Control (44px, bottom-left above at-you bar)
      this.modeToggleElement = document.createElement('div');
      this.modeToggleElement.className = 'di-floating-mode-control';
      this.modeToggleElement.style.position = 'absolute';
      this.modeToggleElement.style.bottom = '148px'; // 68px nav + 72px bar + 8px gap
      this.modeToggleElement.style.left = '16px';
      this.modeToggleElement.style.height = '44px';
      this.modeToggleElement.style.background = 'var(--surface, #FFFFFF)';
      this.modeToggleElement.style.border = '1.5px solid var(--ink, #121311)';
      this.modeToggleElement.style.borderRadius = '22px';
      this.modeToggleElement.style.boxShadow = 'var(--shadow-md, 0 4px 12px rgba(18, 19, 17, 0.12))';
      this.modeToggleElement.style.display = 'flex';
      this.modeToggleElement.style.alignItems = 'center';
      this.modeToggleElement.style.padding = '2px';
      this.modeToggleElement.style.zIndex = '50';
      this.modeToggleElement.style.boxSizing = 'border-box';
      this.container.appendChild(this.modeToggleElement);

      this.renderModeControl();

      // 4. At-You Bar (72px)
      this.atYouBarElement = document.createElement('div');
      this.atYouBarElement.className = 'di-at-you-bar';
      this.atYouBarElement.style.height = '72px';
      this.atYouBarElement.style.minHeight = '72px';
      this.atYouBarElement.style.maxHeight = '72px';
      this.container.appendChild(this.atYouBarElement);

      // Swipe up gesture listener on At-You Bar to open drawer
      let touchStartY = null;
      this.atYouBarElement.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });
      this.atYouBarElement.addEventListener('touchend', (e) => {
        if (touchStartY !== null && e.changedTouches && e.changedTouches[0]) {
          const dy = touchStartY - e.changedTouches[0].clientY;
          if (dy > 25) { // Swiped up at least 25px
            if (this.walkDrawer) this.walkDrawer.open();
          }
        }
        touchStartY = null;
      }, { passive: true });

      // 5. Bottom Navigation (68px: Walk · Section · Day)
      this.bottomNavElement = document.createElement('nav');
      this.bottomNavElement.className = 'di-bottom-nav';
      this.bottomNavElement.style.height = '68px';
      this.bottomNavElement.style.minHeight = '68px';
      this.bottomNavElement.style.maxHeight = '68px';
      this.container.appendChild(this.bottomNavElement);

      this.renderBottomNav();

      // 6. WalkDrawer component initialized inside container
      if (typeof root.WalkDrawer !== 'undefined') {
        this.walkDrawer = new root.WalkDrawer(this.container, {
          initialCh: this.userPosition.ch,
          initialSide: this.userPosition.side,
          initialOffset: this.userPosition.offset_m,
          initialFacing: this.userPosition.facing,
          onSelectFeature: (feat) => {
            this.selectedFeature = feat;
            this.updateAtYouBar();
            if (this.walkStrip) {
              this.walkStrip.setPosition({ ch: feat.ch || feat.ch_start }, true);
            }
            this.openRecordView(feat);
          },
          onFeatureLongPress: (feat) => {
            this.openFeatureDetail(feat);
          },
          onToggle: (isOpen) => {
            // Re-scroll strip so reading line stays visible above drawer
            if (this.walkStrip) {
              this.walkStrip.layout.readingLineRatio = isOpen ? 0.35 : 0.8;
              this.walkStrip.render(true);
            }
          }
        });
        this.walkDrawer.updateData(this.features, this.userPosition);
      }

      // 7. Phase 5 Modules Initialization (Toast, Record, Defect, Feature Detail)
      if (!this.toastManager && typeof root.ToastManager !== 'undefined') {
        this.toastManager = new root.ToastManager(this.container);
      }

      if (typeof root.RecordView !== 'undefined') {
        this.recordView = new root.RecordView(this.container, {
          dataStore: this.dataStore,
          toastManager: this.toastManager,
          typeCatalogue: (typeof root.TYPE_CATALOGUE !== 'undefined' ? root.TYPE_CATALOGUE : null),
          onRecordSaved: (res) => {
            this.updateDatasets(this.features, this.absences);
            if (this.onRecordStage) this.onRecordStage(res);
          },
          onReportDefect: (feat) => {
            this.openDefectView(feat);
          },
          onViewIR: (feat) => {
            this.openFeatureDetail(feat);
          },
          onFlagRevision: (feat) => {
            if (this.dataStore && typeof this.dataStore.addQuery === 'function') {
              this.dataStore.addQuery({
                feature_id: feat.feature_id || feat.id,
                reason: 'built_without_approval',
                title: `Design revision flagged for ${feat.short_name || feat.type_code}`,
                description: `Site engineer flagged potential design variance on ${feat.type_code} (PK ${feat.ch_start || feat.ch || 0})`,
                status: 'open'
              });
            }
            if (this.toastManager) this.toastManager.showToast('Revision flagged · Query raised for office', 'info');
          }
        });
      }

      if (typeof root.DefectView !== 'undefined') {
        this.defectView = new root.DefectView(this.container, {
          dataStore: this.dataStore,
          toastManager: this.toastManager,
          onDefectLogged: (res) => {
            this.updateDatasets(this.features, this.absences);
          }
        });
      }

      if (typeof root.EditDoor !== 'undefined') {
        this.editDoor = new root.EditDoor(this.container, this.dataStore);
      }

      if (typeof root.FeatureDetailView !== 'undefined') {
        this.featureDetailView = new root.FeatureDetailView(this.container, {
          dataStore: this.dataStore,
          typeCatalogue: (typeof root.TYPE_CATALOGUE !== 'undefined' ? root.TYPE_CATALOGUE : null),
          onRecordStage: (feat) => {
            this.openRecordView(feat);
          },
          onReportDefect: (feat) => {
            if (this.editDoor) {
              this.editDoor.openFieldDiscrepancy(feat);
            } else {
              this.openDefectView(feat);
            }
          },
          onFlagRevision: (feat) => {
            if (this.editDoor) {
              this.editDoor.openDesignRevision(feat);
            }
          }
        });
      }

      // Initial Renders
      this.updatePositionHeader();
      this.updateAtYouBar();
    }

    /**
     * Render Position Header (116px)
     */
    updatePositionHeader() {
      if (!this.headerElement) return;

      const pos = this.userPosition;
      const ch = pos.ch;
      const km = Math.floor(ch / 1000);
      const m = Math.round(ch % 1000);
      const acc = typeof pos.accuracy_m === 'number' ? pos.accuracy_m : 4;
      const isPoor = (acc > 10) && !pos.isManual;

      // Spec §5 line 166: When accuracy_m > 10, prefix with "≈ "
      const prefix = isPoor ? '≈ ' : '';
      const chainageText = `${prefix}PK ${km}+${String(m).padStart(3, '0')}`;

      // Spec §5 line 166: Withhold side in Poor GPS -> "SIDE ?"
      const sideStr = (pos.side || 'C').toUpperCase();
      const offsetM = Math.abs(Math.round(pos.offset_m || 0));
      let sideText = '';
      if (isPoor) {
        sideText = 'SIDE ?';
      } else {
        sideText = sideStr === 'C' ? 'C 0 m' : `${sideStr} ${offsetM} m`;
      }

      const facingText = pos.facing === 'decreasing'
        ? 'FACING ▼ decreasing'
        : 'FACING ▲ increasing';

      // GPS trust chip
      let gpsChipClass = 'di-gps-chip--good';
      let gpsText = `GPS ±${Math.round(acc)} m`;
      if (pos.isManual) {
        gpsChipClass = 'di-gps-chip--none';
        gpsText = 'NO GPS · MANUAL';
      } else if (acc > 10) {
        gpsChipClass = 'di-gps-chip--poor';
        gpsText = `GPS ±${Math.round(acc)} m POOR`;
      }

      this.headerElement.innerHTML = `
        <div class="di-position-header__top" style="display:flex;justify-content:space-between;align-items:center;">
          <div class="di-chip-group" style="display:flex;gap:6px;align-items:center;">
            <span class="di-chip-section" style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;">KM · ${this.subSectionCode}</span>
            <span class="di-gps-chip ${gpsChipClass}" style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;">${gpsText}</span>
          </div>
          <div class="di-position-header__facing" style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-2,#383B36);">${facingText}</div>
        </div>
        <div class="di-position-header__mid" style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px;">
          <div class="di-position-header__chainage" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:62px;line-height:0.95;color:var(--ink,#121311);letter-spacing:-0.02em;">${chainageText}</div>
          <div class="di-position-header__side" style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:var(--ink,#121311);">${sideText}</div>
        </div>
      `;
    }

    /**
     * Render Mode Segmented Control (Strip | Map | Section)
     */
    renderModeControl() {
      if (!this.modeToggleElement) return;

      const modes = [
        { id: 'strip', label: 'Strip' },
        { id: 'section', label: 'Section' },
        { id: 'map', label: 'Map' }
      ];

      this.modeToggleElement.innerHTML = '';
      for (const m of modes) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.height = '36px';
        btn.style.padding = '0 14px';
        btn.style.border = 'none';
        btn.style.borderRadius = '18px';
        btn.style.fontFamily = "'IBM Plex Mono', monospace";
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '700';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.15s ease';

        if (this.currentMode === m.id) {
          btn.style.background = 'var(--ink, #121311)';
          btn.style.color = 'var(--surface, #FFFFFF)';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--ink-2, #383B36)';
        }

        btn.textContent = m.label;
        btn.addEventListener('click', () => {
          this.setMode(m.id);
        });
        this.modeToggleElement.appendChild(btn);
      }
    }

    /**
     * Switch view mode between Strip, Identify (Section), and Map
     */
    setMode(mode) {
      this.currentMode = mode;
      this.renderModeControl();

      if (!this.stripContainer) return;

      if (mode === 'section') {
        // Render Identify cross-section view in content container
        this.stripContainer.innerHTML = '';
        if (typeof root.IdentifyView !== 'undefined') {
          this.identifyView = new root.IdentifyView(this.stripContainer, {
            initialCh: this.userPosition.ch,
            initialSide: this.userPosition.side,
            initialOffset: this.userPosition.offset_m,
            initialFacing: this.userPosition.facing,
            onSelectFeature: (feat) => {
              this.selectedFeature = feat;
              this.updateAtYouBar();
              this.openRecordView(feat);
            },
            onOpenDrawer: () => {
              if (this.walkDrawer) this.walkDrawer.open();
            }
          });
          this.identifyView.updateData(this.features, this.userPosition);
          if (this.selectedFeature) {
            this.identifyView.setSelectedFeature(this.selectedFeature.feature_id || this.selectedFeature.id);
          }
        }
      } else {
        // Restore Walk Strip Canvas
        this.stripContainer.innerHTML = '';
        if (typeof root.WalkStrip !== 'undefined') {
          this.walkStrip = new root.WalkStrip(this.stripContainer, {
            initialCh: this.userPosition.ch,
            initialSide: this.userPosition.side,
            initialOffset: this.userPosition.offset_m,
            initialAccuracy: this.userPosition.accuracy_m,
            initialFacing: this.userPosition.facing,
            onFeatureSelect: (feat) => {
              this.selectedFeature = feat;
              this.updateAtYouBar();
              if (this.walkDrawer) this.walkDrawer.open();
            },
            onFeatureLongPress: (feat) => {
              this.openFeatureDetail(feat);
            },
            onPositionChange: (pos) => {
              this.userPosition = Object.assign({}, this.userPosition, pos);
              this.updatePositionHeader();
              this.updateAtYouBar();
            }
          });
          this.walkStrip.setFeatures(this.features);
          this.walkStrip.setAbsences(this.absences);
        }
      }
    }

    /**
     * Evaluate selection rule and render 72px At-You Bar
     */
    updateAtYouBar() {
      if (!this.atYouBarElement) return;

      const result = AtYouSelectionLogic.selectAtYouFeature(
        this.features,
        this.absences,
        this.userPosition,
        { isPoor: this.userPosition.accuracy_m > 10 }
      );

      // If user explicitly tapped a feature on strip or identify view, prioritize it
      const feat = this.selectedFeature || result.selectedFeature;
      const variant = this.selectedFeature ? 'normal' : result.variant;

      this.atYouBarElement.className = 'di-at-you-bar';

      // 1. Poor GPS Variant
      if (variant === 'poor_gps') {
        this.atYouBarElement.classList.add('di-at-you-bar--poor');
        this.atYouBarElement.innerHTML = `
          <div class="di-at-you-bar__left" style="flex:1;min-width:0;">
            <div style="font-family:'Barlow',sans-serif;font-size:14px;font-weight:700;color:#121311;line-height:1.2;">
              ${result.bannerText}
            </div>
          </div>
          <button type="button" class="di-btn di-btn--primary" style="height:48px;font-size:14px;padding:0 12px;width:auto;white-space:nowrap;" id="btnAnchorExact">
            ${result.actionButtonText}
          </button>
        `;

        const btnAnchor = this.atYouBarElement.querySelector('#btnAnchorExact');
        if (btnAnchor && result.nearestAnchor) {
          btnAnchor.addEventListener('click', () => {
            const anchorCh = result.nearestAnchor.ch || result.nearestAnchor.ch_start;
            this.userPosition.ch = anchorCh;
            this.userPosition.accuracy_m = 0.1;
            this.updatePositionHeader();
            if (this.walkStrip) this.walkStrip.setPosition(this.userPosition, true);
            this.updateAtYouBar();
          });
        }
        return;
      }

      // 2. Revision View Variant
      if (variant === 'revision') {
        this.atYouBarElement.classList.add('di-at-you-bar--rev');
        this.atYouBarElement.innerHTML = `
          <div class="di-at-you-bar__left" style="flex:1;min-width:0;">
            <div style="font-family:'Barlow',sans-serif;font-size:14px;font-weight:700;color:var(--rev,#1446A0);line-height:1.2;">
              ${result.bannerText}
            </div>
          </div>
          <button type="button" class="di-btn di-btn--rev" style="height:48px;font-size:13px;padding:0 12px;width:auto;white-space:nowrap;">
            ${result.actionButtonText}
          </button>
        `;
        return;
      }

      // 3. Empty By Design Variant
      if (variant === 'empty_by_design') {
        this.atYouBarElement.classList.add('di-at-you-bar--empty');
        this.atYouBarElement.innerHTML = `
          <div class="di-at-you-bar__left" style="flex:1;min-width:0;">
            <div style="font-family:'Barlow',sans-serif;font-size:14px;font-weight:700;color:var(--ink-2,#383B36);line-height:1.2;">
              ${result.title}
            </div>
          </div>
          <div class="di-at-you-bar__right" style="min-width:88px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink,#121311);">
            ${result.nextText || ''}
          </div>
        `;
        return;
      }

      // 4. Normal Variant with Selected Feature
      if (feat) {
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

        const typeCode = formatTypeCode(feat.type_code, feat.category || feat.strip);
        const shortName = feat.short_name || feat.shortName || feat.category || 'Drainage Structure';
        const cert = (feat.position_certainty || 'derived').toLowerCase();
        const countWithin20m = result.within20mCount || 1;

        this.atYouBarElement.innerHTML = `
          <div class="di-at-you-bar__left" id="atYouRecordTrigger" style="flex:1;min-width:0;cursor:pointer;display:flex;align-items:center;gap:10px;">
            <span class="di-side-badge ${badgeClass}" style="height:36px;min-width:36px;font-size:12px;">${sideHtml}</span>
            <div class="di-at-you-bar__info" style="min-width:0;">
              <div class="di-at-you-bar__sub" style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;">AT YOU · TAP TO RECORD</div>
              <div class="di-at-you-bar__title" style="font-family:'Barlow',sans-serif;font-weight:700;font-size:15px;color:var(--ink,#121311);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${typeCode} · ${shortName}
              </div>
            </div>
            <span class="di-certainty di-certainty--${cert}" style="height:20px;font-size:10px;">${cert.toUpperCase()}</span>
          </div>
          <div class="di-at-you-bar__right" id="atYouDrawerTrigger" style="min-width:88px;font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;color:var(--ink-2,#383B36);cursor:pointer;display:flex;align-items:center;justify-content:flex-end;gap:4px;">
            <span>+${countWithin20m} within 20m</span>
            <span style="font-size:16px;">›</span>
          </div>
        `;

        const recordTrigger = this.atYouBarElement.querySelector('#atYouRecordTrigger');
        if (recordTrigger) {
          recordTrigger.addEventListener('click', () => {
            this.openRecordView(feat);
          });
        }

        const drawerTrigger = this.atYouBarElement.querySelector('#atYouDrawerTrigger');
        if (drawerTrigger) {
          drawerTrigger.addEventListener('click', () => {
            if (this.walkDrawer) this.walkDrawer.open();
          });
        }
      } else {
        // Fallback: Empty Stretch
        this.atYouBarElement.innerHTML = `
          <div class="di-at-you-bar__left" style="flex:1;min-width:0;">
            <div style="font-family:'Barlow',sans-serif;font-size:14px;color:var(--ink-3,#555952);">
              ${result.title}
            </div>
          </div>
          <div class="di-at-you-bar__right" style="min-width:88px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink,#121311);">
            ${result.nextText || ''}
          </div>
        `;
      }
    }

    /**
     * Render Bottom Navigation (68px: Walk · Section · Day)
     */
    renderBottomNav() {
      if (!this.bottomNavElement) return;

      this.bottomNavElement.innerHTML = `
        <button type="button" class="di-bottom-nav__item di-bottom-nav__item--active" data-nav="walk">
          <div class="di-bottom-nav__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 22l3-7 3 3v4M17 10l-4 4-2-2-3 3M17 10l-2-6-4 2"/></svg>
          </div>
          <span>Walk</span>
        </button>
        <button type="button" class="di-bottom-nav__item" data-nav="section">
          <div class="di-bottom-nav__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>
          </div>
          <span>Section</span>
        </button>
        <button type="button" class="di-bottom-nav__item" data-nav="day">
          <div class="di-bottom-nav__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>
          </div>
          <span>Day · 17 on phone</span>
        </button>
      `;

      const navButtons = this.bottomNavElement.querySelectorAll('.di-bottom-nav__item');
      navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const navTarget = btn.getAttribute('data-nav');
          if (this.onNavigate) this.onNavigate(navTarget);
        });
      });
    }

    /**
     * Update features and absences from DataStore
     */
    updateDatasets(features, absences) {
      if (Array.isArray(features)) this.features = features;
      if (Array.isArray(absences)) this.absences = absences;

      if (this.walkStrip) {
        this.walkStrip.setFeatures(this.features);
        this.walkStrip.setAbsences(this.absences);
      }
      if (this.walkDrawer) {
        this.walkDrawer.updateData(this.features, this.userPosition);
      }
      if (this.identifyView) {
        this.identifyView.updateData(this.features, this.userPosition);
      }

      this.updateAtYouBar();
    }

    /**
     * Update user position from PositionEngine
     */
    updatePosition(pos) {
      this.userPosition = Object.assign({}, this.userPosition, pos);
      this.updatePositionHeader();

      if (this.walkStrip) {
        this.walkStrip.setPosition(this.userPosition);
      }
      if (this.walkDrawer && this.walkDrawer.isOpen) {
        this.walkDrawer.updateData(this.features, this.userPosition);
      }
      if (this.identifyView) {
        this.identifyView.updateData(this.features, this.userPosition);
      }

      this.updateAtYouBar();
    }

    /**
     * Open Phase 5 Record Flow modal sheet
     */
    openRecordView(feat) {
      if (!feat) return;
      this.selectedFeature = feat;
      this.updateAtYouBar();
      if (this.recordView) {
        this.recordView.open(feat, this.userPosition);
      } else if (this.onRecordStage) {
        this.onRecordStage(feat);
      }
    }

    /**
     * Open Phase 5 Defect Reporting modal sheet
     */
    openDefectView(feat) {
      if (!feat) return;
      this.selectedFeature = feat;
      this.updateAtYouBar();
      if (this.defectView) {
        this.defectView.open(feat, this.userPosition);
      }
    }

    /**
     * Open Phase 5 Feature Detail read-only audit sheet
     */
    openFeatureDetail(feat) {
      if (!feat) return;
      this.selectedFeature = feat;
      this.updateAtYouBar();
      if (this.featureDetailView) {
        this.featureDetailView.open(feat, this.userPosition);
      }
    }
  }

  // =========================================================================
  // 3. EXPORT MODULE
  // =========================================================================

  return {
    AtYouSelectionLogic: AtYouSelectionLogic,
    WalkView: WalkView
  };
}));
