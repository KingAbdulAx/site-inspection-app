/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 5 Record Flow Sheet
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.3 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.RecordView = exportsObj.RecordView;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  // Standard stage definitions (§6.3)
  const CONCRETE_STAGES = [
    'Not started',
    'Excavation',
    'Blinding',
    'Rebar',
    'Shuttered',
    'Concreted',
    'Completed'
  ];

  const UNLINED_STAGES = [
    'Not started',
    'Excavated',
    'Completed'
  ];

  class RecordView {
    constructor(containerElement = null, options = {}) {
      this.container = containerElement;
      this.options = options;
      this.dataStore = options.dataStore || (typeof root !== 'undefined' && root.DataStore ? root.DataStore : null);
      this.toastManager = options.toastManager || null;
      this.onRecordSaved = typeof options.onRecordSaved === 'function' ? options.onRecordSaved : null;
      this.onReportDefect = typeof options.onReportDefect === 'function' ? options.onReportDefect : null;
      this.onFlagRevision = typeof options.onFlagRevision === 'function' ? options.onFlagRevision : null;
      this.onViewIR = typeof options.onViewIR === 'function' ? options.onViewIR : null;
      this.onClose = typeof options.onClose === 'function' ? options.onClose : null;

      this.currentFeature = null;
      this.userPosition = null;
      this.isOpen = false;
      this.sheetElement = null;
      this.backdropElement = null;
    }

    /**
     * Resolve the allowed stage ladder for a given feature (§6.3)
     * - Unlined earth ditches (T3, T4, T5, CH-A): 3 stages
     * - Concrete-lined ditches and structures: 6/7 stages
     */
    static resolveStageLadder(feature, typeCatalogue = null) {
      if (!feature) return CONCRETE_STAGES.slice();

      const cat = typeCatalogue || (typeof root !== 'undefined' && root.TYPE_CATALOGUE) || (typeof TYPE_CATALOGUE !== 'undefined' ? TYPE_CATALOGUE : null);
      const code = String(feature.type_code || '').trim().toUpperCase();
      const rawCode = code.startsWith('T') ? code.substring(1) : code;

      // 1. Check TYPE_CATALOGUE directly
      if (cat) {
        if (cat[code] && Array.isArray(cat[code].stages)) {
          return cat[code].stages.slice();
        }
        if (cat[rawCode] && Array.isArray(cat[rawCode].stages)) {
          return cat[rawCode].stages.slice();
        }
      }

      // 2. Unlined type heuristics (Type 3, Type 4, Type 5, CH-A)
      const isUnlinedCode = /^(T[345]|[345]|TYPE\s*[345]|CH[-_ ]?A)$/i.test(code) || /\b(T[345]|TYPE\s*[345]|CH[-_ ]?A)\b/i.test(code);
      const desc = `${feature.short_name || ''} ${feature.category || ''} ${feature.specs || ''}`.toLowerCase();
      const isUnlinedDesc = desc.includes('unlined') || desc.includes('earth channel');

      if (isUnlinedCode || isUnlinedDesc) {
        return UNLINED_STAGES.slice();
      }

      return CONCRETE_STAGES.slice();
    }

    /**
     * Generate up to three smart suggestion buttons (§6.3):
     * De-duplicated from {claimed stage, last seen + 1, last seen (no change)}
     */
    static generateSuggestions(currentStage, claimedStage, stageLadder) {
      const suggestions = [];
      const seenStages = new Set();
      const ladder = Array.isArray(stageLadder) && stageLadder.length > 0 ? stageLadder : CONCRETE_STAGES;

      const normCurrent = currentStage || ladder[0];
      const currentIdx = ladder.findIndex(s => s.toLowerCase() === (normCurrent || '').toLowerCase());
      const actualCurrent = currentIdx >= 0 ? ladder[currentIdx] : normCurrent;

      // 1. Claimed stage (if valid in ladder and not already completed)
      if (claimedStage) {
        const matchingStage = ladder.find(s => s.toLowerCase() === claimedStage.toLowerCase());
        if (matchingStage) {
          suggestions.push({
            stage: matchingStage,
            subtitle: 'matches the claim',
            isPrimary: true,
            type: 'claim'
          });
          seenStages.add(matchingStage.toLowerCase());
        }
      }

      // 2. Next stage in progression (last seen + 1)
      if (currentIdx >= 0 && currentIdx < ladder.length - 1) {
        const nextStage = ladder[currentIdx + 1];
        if (!seenStages.has(nextStage.toLowerCase())) {
          suggestions.push({
            stage: nextStage,
            subtitle: 'next stage',
            isPrimary: suggestions.length === 0,
            type: 'next'
          });
          seenStages.add(nextStage.toLowerCase());
        }
      }

      // 3. Current stage (no change)
      if (actualCurrent && !seenStages.has(actualCurrent.toLowerCase())) {
        suggestions.push({
          stage: actualCurrent,
          subtitle: 'no change',
          isPrimary: suggestions.length === 0,
          type: 'same'
        });
        seenStages.add(actualCurrent.toLowerCase());
      }

      return suggestions.slice(0, 3);
    }

    /**
     * Open the Record Sheet modal
     */
    open(feature, userPosition = {}) {
      if (!feature) return;
      this.currentFeature = feature;
      this.userPosition = Object.assign({}, userPosition);
      this.isOpen = true;

      if (typeof document !== 'undefined') {
        this.renderDOM();
      }
    }

    /**
     * Close and dismiss the sheet
     */
    close() {
      this.isOpen = false;
      if (this.sheetElement && this.sheetElement.parentNode) {
        this.sheetElement.parentNode.removeChild(this.sheetElement);
      }
      if (this.backdropElement && this.backdropElement.parentNode) {
        this.backdropElement.parentNode.removeChild(this.backdropElement);
      }
      this.sheetElement = null;
      this.backdropElement = null;
      if (this.onClose) this.onClose();
    }

    /**
     * Execute 2-Tap Write Flow:
     * Appends FieldRecord, creates discrepancy Query if applicable,
     * updates feature, dismisses sheet, and triggers 8s undo toast.
     */
    submitStage(stageName) {
      if (!this.currentFeature) return null;

      const feat = this.currentFeature;
      const previousStage = feat.current_stage || feat.stage || 'Not started';
      const fId = feat.feature_id || feat.id;

      // Check contractor claim
      const irs = this.dataStore && typeof this.dataStore.getInspectionRequestsForFeature === 'function'
        ? this.dataStore.getInspectionRequestsForFeature(fId)
        : [];
      const latestIR = irs.length > 0 ? irs[irs.length - 1] : null;

      // 1. Construct FieldRecord payload
      const pos = this.userPosition || {};
      const recordData = {
        feature_id: fId,
        kind: 'stage',
        stage: stageName,
        author: this.options.author || 'Engr. Abdulaziz A. A.',
        device_id: this.options.deviceId || 'device_field',
        created_at: new Date().toISOString(),
        measured_position: {
          ch: typeof pos.ch === 'number' ? pos.ch : (feat.ch || feat.ch_start || 0),
          side: pos.side || feat.side || 'C',
          offset_m: typeof pos.offset_m === 'number' ? pos.offset_m : (feat.offset_m || 0),
          accuracy_m: typeof pos.accuracy_m === 'number' ? pos.accuracy_m : 4.0
        },
        payload: {
          previous_stage: previousStage,
          stage: stageName,
          contractor_claimed_stage: latestIR ? latestIR.claimed_stage : null,
          ir_no: latestIR ? latestIR.ir_no : null
        }
      };

      // 2. Append durably to store
      let createdRecord = null;
      if (this.dataStore && typeof this.dataStore.addObservation === 'function') {
        createdRecord = this.dataStore.addObservation(recordData);
      } else {
        createdRecord = Object.assign({ record_id: 'rec_' + Date.now() }, recordData);
      }

      // 3. Update feature in memory
      feat.current_stage = stageName;
      feat.stage = stageName;

      // Check if discrepancy query was triggered
      const hasDiscrepancy = latestIR && latestIR.claimed_stage && (latestIR.claimed_stage.toLowerCase() !== stageName.toLowerCase());

      // 4. Dismiss modal sheet immediately (< 2 second target)
      this.close();

      // 5. Trigger 8-Second Undo Toast
      if (this.toastManager && typeof this.toastManager.showUndoToast === 'function') {
        let toastMessage = `Saved on this phone · ${stageName}`;
        if (hasDiscrepancy) {
          toastMessage += ` · Differs from IR ${latestIR.ir_no}`;
        }

        this.toastManager.showUndoToast({
          message: toastMessage,
          stageName: stageName,
          recordId: createdRecord.record_id,
          previousStage: previousStage,
          feature: feat,
          durationMs: 8000,
          onUndo: (undoDetails) => {
            if (this.dataStore && typeof this.dataStore.voidObservation === 'function') {
              this.dataStore.voidObservation(undoDetails.recordId, 'Engineer undo within 8s window');
            }
            feat.current_stage = undoDetails.previousStage;
            feat.stage = undoDetails.previousStage;

            if (this.onRecordSaved) {
              this.onRecordSaved({
                feature: feat,
                stage: undoDetails.previousStage,
                undone: true,
                record: createdRecord
              });
            }
          }
        });
      }

      // 6. Invoke onRecordSaved callback
      if (this.onRecordSaved) {
        this.onRecordSaved({
          feature: feat,
          stage: stageName,
          record: createdRecord,
          undone: false,
          hasDiscrepancy: hasDiscrepancy
        });
      }

      return createdRecord;
    }

    /**
     * Render the complete bottom sheet modal in DOM
     */
    renderDOM() {
      if (typeof document === 'undefined') return;

      const feat = this.currentFeature;
      const fId = feat.feature_id || feat.id;
      const ladder = RecordView.resolveStageLadder(feat, this.options.typeCatalogue);
      const currentStage = feat.current_stage || feat.stage || ladder[0];

      // Retrieve Contractor IRs
      const irs = this.dataStore && typeof this.dataStore.getInspectionRequestsForFeature === 'function'
        ? this.dataStore.getInspectionRequestsForFeature(fId)
        : [];
      const latestIR = irs.length > 0 ? irs[irs.length - 1] : null;
      const claimedStage = latestIR ? latestIR.claimed_stage : null;

      // Generate up to 3 smart suggestions
      const suggestions = RecordView.generateSuggestions(currentStage, claimedStage, ladder);

      // Create Backdrop
      this.backdropElement = document.createElement('div');
      this.backdropElement.className = 'di-sheet-backdrop';
      this.backdropElement.style.position = 'fixed';
      this.backdropElement.style.top = '0';
      this.backdropElement.style.left = '0';
      this.backdropElement.style.width = '100vw';
      this.backdropElement.style.height = '100vh';
      this.backdropElement.style.background = 'rgba(18, 19, 17, 0.4)';
      this.backdropElement.style.zIndex = '250';
      this.backdropElement.style.backdropFilter = 'blur(2px)';
      this.backdropElement.addEventListener('click', () => this.close());
      document.body.appendChild(this.backdropElement);

      // Create Sheet Container
      this.sheetElement = document.createElement('div');
      this.sheetElement.className = 'di-modal-sheet di-record-sheet';
      this.sheetElement.style.position = 'fixed';
      this.sheetElement.style.bottom = '0';
      this.sheetElement.style.left = '50%';
      this.sheetElement.style.transform = 'translateX(-50%)';
      this.sheetElement.style.width = '100%';
      this.sheetElement.style.maxWidth = '390px';
      this.sheetElement.style.maxHeight = '90vh';
      this.sheetElement.style.background = 'var(--surface, #FFFFFF)';
      this.sheetElement.style.borderTop = '2px solid var(--ink, #121311)';
      this.sheetElement.style.borderRadius = '16px 16px 0 0';
      this.sheetElement.style.boxShadow = 'var(--shadow-lg, 0 -8px 24px rgba(18, 19, 17, 0.2))';
      this.sheetElement.style.zIndex = '260';
      this.sheetElement.style.display = 'flex';
      this.sheetElement.style.flexDirection = 'column';
      this.sheetElement.style.overflow = 'hidden';
      this.sheetElement.style.boxSizing = 'border-box';

      // Feature presentation metadata
      const side = String(feat.side || 'C').toUpperCase();
      let badgeClass = 'di-side-badge--centre';
      let sideHtml = 'C';
      if (side === 'L') {
        badgeClass = 'di-side-badge--left';
        sideHtml = '◀ L';
      } else if (side === 'R') {
        badgeClass = 'di-side-badge--right';
        sideHtml = 'R ▶';
      }

      const typeCode = feat.type_code ? (feat.type_code.startsWith('T') ? feat.type_code : 'T' + feat.type_code) : (feat.category || 'Structure');
      const shortName = feat.short_name || feat.shortName || feat.category || 'Drainage Ditch';
      const cert = (feat.position_certainty || 'derived').toLowerCase();

      // Chainage extent text
      let chText = '';
      if (feat.geometry === 'crossing' || (typeof feat.ch === 'number' && feat.ch_start === undefined)) {
        const pk = feat.ch || feat.ch_start || 0;
        chText = `PK ${Math.floor(pk / 1000)}+${String(Math.round(pk % 1000)).padStart(3, '0')}`;
      } else {
        const s = feat.ch_start || 0;
        const e = feat.ch_end || s;
        chText = `PK ${Math.floor(s / 1000)}+${String(Math.round(s % 1000)).padStart(3, '0')} — PK ${Math.floor(e / 1000)}+${String(Math.round(e % 1000)).padStart(3, '0')}`;
      }

      // Icon SVG
      let iconSvg = '';
      const iconHelper = (typeof root !== 'undefined' && root.TypeIcons) || (typeof TypeIcons !== 'undefined' ? TypeIcons : null);
      if (iconHelper && typeof iconHelper.render === 'function') {
        iconSvg = iconHelper.render(typeCode, '28', '#121311') || iconHelper.render(feat.geometry || 'trapezoid', '28', '#121311');
      }

      // Contractor Claim Banner HTML
      let claimBannerHtml = '';
      if (latestIR && latestIR.claimed_stage) {
        claimBannerHtml = `
          <div class="di-claim-banner" style="background:var(--paper,#F6F5F0);border:1px solid var(--rule,#CFD0C9);border-radius:6px;padding:8px 12px;margin:10px 16px 0 16px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
            <div style="font-family:'Barlow',sans-serif;font-size:13px;font-weight:600;color:var(--ink,#121311);line-height:1.25;">
              Contractor claimed: <strong style="font-weight:700;">${latestIR.claimed_stage}</strong> · ${latestIR.ir_no} · ${latestIR.date || 'Recent'}
            </div>
            <button type="button" class="di-badge-claimed di-btn-view-ir" id="btnRecordViewIR" style="background:#121311;color:#FFFFFF;padding:3px 8px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.04em;border:none;cursor:pointer;white-space:nowrap;">VIEW IR</button>
          </div>
        `;
      }

      // Evidence Boxes side-by-side (§6.3)
      const evidenceBoxesHtml = `
        <div class="di-evidence-row" style="display:flex;gap:8px;padding:12px 16px 4px 16px;box-sizing:border-box;">
          <div class="di-evidence-box" style="flex:1;background:var(--surface,#FFFFFF);border:1.5px solid var(--ink,#121311);border-radius:8px;padding:8px 10px;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;">SEEN BY YOU</span>
              <span style="background:var(--hivis,#FFD100);color:#121311;padding:1px 6px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:700;">ACTIVE</span>
            </div>
            <div style="font-family:'Barlow',sans-serif;font-weight:700;font-size:16px;color:var(--ink,#121311);">${currentStage}</div>
          </div>
          <div class="di-evidence-box" style="flex:1;background:var(--paper,#F6F5F0);border:1px solid var(--rule,#CFD0C9);border-radius:8px;padding:8px 10px;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;">CONTRACTOR</span>
              <span style="border:1px solid var(--ink-3,#555952);color:var(--ink-3,#555952);padding:0 5px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:600;">IR</span>
            </div>
            <div style="font-family:'Barlow',sans-serif;font-weight:600;font-size:15px;color:var(--ink-2,#383B36);">${claimedStage || 'None filed'}</div>
          </div>
        </div>
      `;

      // Smart Suggestion Buttons (72px touch targets)
      let suggestionsHtml = '';
      if (suggestions.length > 0) {
        let buttonsHtml = '';
        for (const s of suggestions) {
          const btnClass = s.isPrimary ? 'di-btn--primary' : 'di-btn--secondary';
          buttonsHtml += `
            <button type="button" class="di-btn ${btnClass} di-suggestion-btn" data-stage="${s.stage}" style="height:72px;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 12px;box-sizing:border-box;flex:1;">
              <span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;line-height:1;text-transform:uppercase;">${s.stage}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:500;opacity:0.85;margin-top:3px;letter-spacing:0.02em;">${s.subtitle}</span>
            </button>
          `;
        }
        suggestionsHtml = `
          <div style="padding:12px 16px 0 16px;box-sizing:border-box;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.05em;margin-bottom:8px;">
              WHAT STAGE IS IT AT NOW? · 1-TAP SAVE
            </div>
            <div style="display:flex;gap:8px;">
              ${buttonsHtml}
            </div>
          </div>
        `;
      }

      // Full Stage Ladder (56px touch target rows)
      let ladderRowsHtml = '';
      for (let i = 0; i < ladder.length; i++) {
        const st = ladder[i];
        const isCurrent = (st.toLowerCase() === currentStage.toLowerCase());
        const isClaim = claimedStage && (st.toLowerCase() === claimedStage.toLowerCase());

        let badge = '';
        if (isCurrent) {
          badge = `<span style="background:var(--hivis,#FFD100);color:#121311;padding:2px 8px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;">YOU</span>`;
        } else if (isClaim) {
          badge = `<span style="border:1.5px solid var(--ink,#121311);padding:1px 6px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;">CLAIMED</span>`;
        }

        ladderRowsHtml += `
          <div class="di-stage-row ${isCurrent ? 'di-stage-row--current' : ''}" data-stage="${st}" style="height:56px;min-height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--rule,#CFD0C9);cursor:pointer;background:${isCurrent ? 'var(--hivis-16, rgba(255,209,0,0.18))' : 'var(--surface,#FFFFFF)'};box-sizing:border-box;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:var(--ink-3,#555952);width:18px;">${i + 1}</span>
              <span style="font-family:'Barlow',sans-serif;font-size:16px;font-weight:${isCurrent ? '700' : '600'};color:var(--ink,#121311);">${st}</span>
            </div>
            <div>
              ${badge}
            </div>
          </div>
        `;
      }

      // Assemble Modal Sheet DOM
      this.sheetElement.innerHTML = `
        <div class="di-sheet-handle" style="width:36px;height:4px;background:var(--rule,#CFD0C9);border-radius:2px;margin:8px auto 4px auto;"></div>
        
        <!-- Header -->
        <div class="di-sheet-header" style="padding:8px 16px 12px 16px;border-bottom:1px solid var(--rule,#CFD0C9);display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span class="di-side-badge ${badgeClass}" style="height:36px;min-width:36px;font-size:12px;">${sideHtml}</span>
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                ${iconSvg ? `<span style="display:inline-flex;align-items:center;">${iconSvg}</span>` : ''}
                <span style="font-family:'Barlow',sans-serif;font-weight:700;font-size:16px;color:var(--ink,#121311);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${typeCode} · ${shortName}
                </span>
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--ink-2,#383B36);margin-top:2px;">
                ${chText}
              </div>
            </div>
          </div>
          <span class="di-certainty di-certainty--${cert}" style="height:20px;font-size:10px;">${cert.toUpperCase()}</span>
        </div>

        ${claimBannerHtml}
        ${evidenceBoxesHtml}
        ${suggestionsHtml}

        <!-- Scrollable Stage Ladder -->
        <div class="di-stage-ladder-container" style="flex:1;overflow-y:auto;margin-top:12px;border-top:1px solid var(--rule,#CFD0C9);box-sizing:border-box;">
          <div style="padding:8px 16px 4px 16px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;">
            COMPLETE STAGE LADDER (TAP TO SET)
          </div>
          ${ladderRowsHtml}
        </div>

        <!-- Secondary Actions Footer (§6.3) -->
        <div class="di-sheet-footer" style="padding:10px 16px;background:var(--paper,#F6F5F0);border-top:1px solid var(--rule,#CFD0C9);display:flex;flex-direction:column;gap:8px;box-sizing:border-box;">
          <div style="display:flex;gap:8px;">
            <button type="button" class="di-btn di-btn--defect" id="btnRecordDefect" style="flex:1;height:52px;font-size:14px;border:2px solid var(--defect,#B3141A);color:var(--defect,#B3141A);background:var(--surface,#FFFFFF);">
              Report defect
            </button>
            <button type="button" class="di-btn di-btn--rev" id="btnRecordRevision" style="flex:1;height:52px;font-size:14px;border:2px solid var(--rev,#1446A0);color:var(--rev,#1446A0);background:var(--surface,#FFFFFF);">
              Flag design revision
            </button>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="di-btn di-btn--tertiary" id="btnRecordNote" style="flex:1;height:44px;font-size:13px;">
              Add note / photo
            </button>
            <button type="button" class="di-btn di-btn--tertiary" id="btnRecordCancel" style="flex:1;height:44px;font-size:13px;">
              Cancel
            </button>
          </div>
        </div>
      `;

      // Wire suggestion buttons
      const sugBtns = this.sheetElement.querySelectorAll('.di-suggestion-btn');
      sugBtns.forEach(b => {
        b.addEventListener('click', () => {
          const st = b.getAttribute('data-stage');
          this.submitStage(st);
        });
      });

      // Wire ladder row clicks
      const ladderRows = this.sheetElement.querySelectorAll('.di-stage-row');
      ladderRows.forEach(r => {
        r.addEventListener('click', () => {
          const st = r.getAttribute('data-stage');
          this.submitStage(st);
        });
      });

      // Wire Claim Banner View IR button
      const btnViewIR = this.sheetElement.querySelector('#btnRecordViewIR');
      if (btnViewIR) {
        btnViewIR.addEventListener('click', (e) => {
          e.stopPropagation();
          const featRef = this.currentFeature;
          this.close();
          if (this.onViewIR) {
            this.onViewIR(featRef, latestIR);
          }
        });
      }

      // Wire secondary actions
      const btnDefect = this.sheetElement.querySelector('#btnRecordDefect');
      if (btnDefect) {
        btnDefect.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onReportDefect) this.onReportDefect(featRef);
        });
      }

      const btnRev = this.sheetElement.querySelector('#btnRecordRevision');
      if (btnRev) {
        btnRev.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onFlagRevision) this.onFlagRevision(featRef);
        });
      }

      const btnNote = this.sheetElement.querySelector('#btnRecordNote');
      if (btnNote) {
        btnNote.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onReportDefect) this.onReportDefect(featRef);
        });
      }

      const btnCancel = this.sheetElement.querySelector('#btnRecordCancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => this.close());
      }

      document.body.appendChild(this.sheetElement);
    }
  }

  return {
    RecordView: RecordView,
    CONCRETE_STAGES: CONCRETE_STAGES,
    UNLINED_STAGES: UNLINED_STAGES
  };
}));
