/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 5 Feature Detail View
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.4 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.FeatureDetailView = exportsObj.FeatureDetailView;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  class FeatureDetailView {
    constructor(containerElement = null, options = {}) {
      this.container = containerElement;
      this.options = options;
      this.dataStore = options.dataStore || (typeof root !== 'undefined' && root.DataStore ? root.DataStore : null);
      this.typeCatalogue = options.typeCatalogue || (typeof root !== 'undefined' && root.TYPE_CATALOGUE ? root.TYPE_CATALOGUE : null);
      this.onRecordStage = typeof options.onRecordStage === 'function' ? options.onRecordStage : null;
      this.onReportDefect = typeof options.onReportDefect === 'function' ? options.onReportDefect : null;
      this.onFlagRevision = typeof options.onFlagRevision === 'function' ? options.onFlagRevision : null;
      this.onClose = typeof options.onClose === 'function' ? options.onClose : null;

      this.currentFeature = null;
      this.userPosition = null;
      this.isOpen = false;
      this.sheetElement = null;
      this.backdropElement = null;
    }

    /**
     * Open the Feature Detail Sheet
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
     * Close the sheet
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
     * Render the complete Feature Detail View in DOM (§6.4)
     */
    renderDOM() {
      if (typeof document === 'undefined') return;

      const feat = this.currentFeature;
      const fId = feat.feature_id || feat.id;

      // Type information lookup
      const cat = this.typeCatalogue || (typeof root !== 'undefined' && root.TYPE_CATALOGUE) || {};
      const typeCode = feat.type_code ? (feat.type_code.startsWith('T') ? feat.type_code : 'T' + feat.type_code) : (feat.category || 'Structure');
      const rawCode = typeCode.startsWith('T') ? typeCode.substring(1) : typeCode;
      const typeInfo = cat[typeCode] || cat[rawCode] || {};

      const fullName = typeInfo.fullName || feat.full_name || feat.name || `${typeCode} · Drainage Asset`;
      const shortName = typeInfo.shortName || feat.short_name || feat.category || 'Structure';
      const side = String(feat.side || 'C').toUpperCase();
      const cert = (feat.position_certainty || 'derived').toLowerCase();
      const lane = feat.lane || 'toe';
      const offsetM = Math.abs(Math.round(feat.offset_m || 0));
      const tolM = feat.tolerance_m !== undefined ? feat.tolerance_m : (cert === 'exact' ? 0 : 4);

      // Side badge HTML
      let badgeClass = 'di-side-badge--centre';
      let sideHtml = 'C';
      if (side === 'L') {
        badgeClass = 'di-side-badge--left';
        sideHtml = '◀ L';
      } else if (side === 'R') {
        badgeClass = 'di-side-badge--right';
        sideHtml = 'R ▶';
      }

      // Chainage extent
      let chExtentStr = '';
      if (feat.geometry === 'crossing' || (typeof feat.ch === 'number' && feat.ch_start === undefined)) {
        const pk = feat.ch || feat.ch_start || 0;
        chExtentStr = `PK ${Math.floor(pk / 1000)}+${String(Math.round(pk % 1000)).padStart(3, '0')}`;
      } else {
        const s = feat.ch_start || 0;
        const e = feat.ch_end || s;
        const len = Math.abs(e - s);
        chExtentStr = `PK ${Math.floor(s / 1000)}+${String(Math.round(s % 1000)).padStart(3, '0')} — PK ${Math.floor(e / 1000)}+${String(Math.round(e % 1000)).padStart(3, '0')} (${len.toFixed(1)} m)`;
      }

      // Drawing specifications
      const drawingRef = feat.drawing_ref || typeInfo.drawing || 'Approved Design';
      const rev = feat.source && feat.source.rev ? feat.source.rev : '05-A';
      const specSnippet = feat.specs || typeInfo.section || 'Reinforced Concrete / Trapezoidal profile';

      // Observations & IR records from DataStore
      const observations = this.dataStore && typeof this.dataStore.getObservationsForFeature === 'function'
        ? this.dataStore.getObservationsForFeature(fId, true)
        : [];
      // Sort newest first
      observations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const irs = this.dataStore && typeof this.dataStore.getInspectionRequestsForFeature === 'function'
        ? this.dataStore.getInspectionRequestsForFeature(fId)
        : [];
      // Sort newest first
      irs.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));

      const latestObs = observations.find(o => o.kind === 'stage' && !o.voided_by_record_id);
      const latestIR = irs[0] || null;

      const currentStage = latestObs ? latestObs.stage : (feat.current_stage || feat.stage || 'Not started');
      const claimedStage = latestIR ? latestIR.claimed_stage : null;

      // Verdict vs claim
      let verdictHtml = '';
      if (latestIR && claimedStage) {
        const isDiscrepancy = claimedStage.toLowerCase() !== currentStage.toLowerCase();
        if (isDiscrepancy) {
          verdictHtml = `
            <div style="background:var(--defect-bg,#FCEBEA);border:1.5px solid var(--defect,#B3141A);border-radius:6px;padding:8px 12px;margin-top:8px;">
              <span style="font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;color:var(--defect,#B3141A);">
                DISCREPANCY · CLAIM AHEAD
              </span>
              <p style="font-family:'Barlow',sans-serif;font-size:12.5px;color:var(--ink,#121311);margin:2px 0 0 0;">
                Contractor claimed '${claimedStage}' on IR ${latestIR.ir_no}, but verified on site at '${currentStage}'. Office query open.
              </p>
            </div>
          `;
        } else {
          verdictHtml = `
            <div style="background:rgba(255,209,0,0.12);border:1.5px solid var(--ink,#121311);border-radius:6px;padding:8px 12px;margin-top:8px;">
              <span style="font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;color:var(--ink,#121311);">
                VERDICT: IN AGREEMENT
              </span>
              <p style="font-family:'Barlow',sans-serif;font-size:12.5px;color:var(--ink-2,#383B36);margin:2px 0 0 0;">
                Observed site work matches contractor claim '${claimedStage}' on IR ${latestIR.ir_no}.
              </p>
            </div>
          `;
        }
      }

      // Check open defects
      const defectRecords = observations.filter(o => o.kind === 'defect' && !o.voided_by_record_id);
      let defectsCardHtml = '';
      if (defectRecords.length > 0) {
        let defectsListHtml = '';
        for (const d of defectRecords) {
          const p = d.payload || {};
          defectsListHtml += `
            <div style="padding:6px 0;border-bottom:1px dashed var(--defect,#B3141A);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--defect,#B3141A);">${p.defect_id || 'DEFECT'}</strong>
                <span style="font-family:'Barlow',sans-serif;font-weight:700;font-size:11.5px;color:var(--defect,#B3141A);">${p.severity || ''}</span>
              </div>
              <div style="font-family:'Barlow',sans-serif;font-size:13px;color:var(--ink,#121311);margin-top:2px;">
                ${p.defect_type || 'Defect'} · PK ${p.chainage || ''}
              </div>
              ${p.note ? `<div style="font-family:'Barlow',sans-serif;font-size:12px;color:var(--ink-2,#383B36);margin-top:2px;">${p.note}</div>` : ''}
            </div>
          `;
        }

        defectsCardHtml = `
          <div class="di-card" style="background:var(--defect-bg,#FCEBEA);border:1.5px solid var(--defect,#B3141A);margin-top:12px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--defect,#B3141A);letter-spacing:0.02em;margin-bottom:6px;">
              OPEN SITE DEFECTS (${defectRecords.length})
            </div>
            ${defectsListHtml}
          </div>
        `;
      }

      // Contractor IR List HTML (§6.4)
      let irsListHtml = '';
      if (irs.length > 0) {
        for (let i = 0; i < irs.length; i++) {
          const ir = irs[i];
          const outcome = ir.outcome || 'Pending';
          let outcomeBg = '#FFFFFF';
          let outcomeColor = '#121311';
          if (outcome.includes('app') || outcome === 'approved') {
            outcomeBg = '#121311';
            outcomeColor = '#FFFFFF';
          } else if (outcome.includes('rej')) {
            outcomeBg = 'var(--defect,#B3141A)';
            outcomeColor = '#FFFFFF';
          }

          // Check gap between IRs or since last IR (> 6 months)
          let gapWarningHtml = '';
          if (i === 0 && ir.date) {
            const irDate = new Date(ir.date);
            const monthsAgo = Math.round((Date.now() - irDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
            if (monthsAgo > 6) {
              gapWarningHtml = `
                <div style="background:var(--pattern-hazard);color:#121311;padding:4px 8px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;margin-bottom:6px;">
                  HAZARD: No contractor activity submitted for ${monthsAgo} months
                </div>
              `;
            }
          }

          irsListHtml += `
            ${gapWarningHtml}
            <div class="di-data-row" style="flex-direction:column;align-items:flex-start;gap:3px;padding:8px 0;border-bottom:1px solid var(--rule,#CFD0C9);">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
                <span style="font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:var(--ink,#121311);">${ir.ir_no}</span>
                <span style="background:${outcomeBg};color:${outcomeColor};padding:2px 8px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;">
                  ${outcome.toUpperCase()}
                </span>
              </div>
              <div style="font-family:'Barlow',sans-serif;font-size:13px;color:var(--ink-2,#383B36);">
                ${ir.activity || 'Inspection request'} · Claimed: <strong>${ir.claimed_stage || 'N/A'}</strong>
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink-3,#555952);">
                ${ir.date || 'Undated'}
              </div>
            </div>
          `;
        }
      } else {
        irsListHtml = `<div style="padding:8px 0;font-family:'Barlow',sans-serif;font-size:13px;color:var(--ink-3,#555952);">No inspection requests on record for this feature.</div>`;
      }

      // History Block HTML (§6.4: "YOUR RECORDS: never overwritten")
      let historyListHtml = '';
      if (observations.length > 0) {
        for (const obs of observations) {
          const isVoided = !!obs.voided_by_record_id;
          const kind = (obs.kind || 'stage').toUpperCase();
          const time = obs.created_at ? new Date(obs.created_at).toLocaleString() : '';

          let details = '';
          if (obs.kind === 'stage') details = `Stage recorded: <strong>${obs.stage || 'Not started'}</strong>`;
          else if (obs.kind === 'defect') details = `Defect: <strong>${obs.payload && obs.payload.defect_type}</strong> (${obs.payload && obs.payload.severity})`;
          else if (obs.kind === 'verdict') details = `Verdict: ${obs.payload && obs.payload.action}`;
          else details = `Payload: ${JSON.stringify(obs.payload || {})}`;

          historyListHtml += `
            <div style="padding:8px 0;border-bottom:1px solid var(--rule,#CFD0C9);${isVoided ? 'opacity:0.5;text-decoration:line-through;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);">${kind}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 6px;border-radius:3px;background:var(--paper,#F6F5F0);border:1px solid var(--rule,#CFD0C9);">
                  ${obs.sync_state === 'sent' ? 'SENT' : 'ON PHONE'}
                </span>
              </div>
              <div style="font-family:'Barlow',sans-serif;font-size:13.5px;color:var(--ink,#121311);margin-top:2px;">
                ${details}
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--ink-3,#555952);margin-top:2px;">
                ${time} · ${obs.author || 'Inspector'} · ${obs.device_id || 'phone'}
              </div>
              ${isVoided ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--defect,#B3141A);margin-top:2px;">VOIDED by ${obs.voided_by_record_id}</div>` : ''}
            </div>
          `;
        }
      } else {
        historyListHtml = `<div style="padding:8px 0;font-family:'Barlow',sans-serif;font-size:13px;color:var(--ink-3,#555952);">No site observations recorded yet on this device.</div>`;
      }

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
      this.sheetElement.className = 'di-modal-sheet di-feature-detail-sheet';
      this.sheetElement.style.position = 'fixed';
      this.sheetElement.style.bottom = '0';
      this.sheetElement.style.left = '50%';
      this.sheetElement.style.transform = 'translateX(-50%)';
      this.sheetElement.style.width = '100%';
      this.sheetElement.style.maxWidth = '390px';
      this.sheetElement.style.height = '92vh';
      this.sheetElement.style.maxHeight = '92vh';
      this.sheetElement.style.background = 'var(--paper, #F6F5F0)';
      this.sheetElement.style.borderTop = '2px solid var(--ink, #121311)';
      this.sheetElement.style.borderRadius = '16px 16px 0 0';
      this.sheetElement.style.boxShadow = 'var(--shadow-lg, 0 -8px 24px rgba(18, 19, 17, 0.2))';
      this.sheetElement.style.zIndex = '260';
      this.sheetElement.style.display = 'flex';
      this.sheetElement.style.flexDirection = 'column';
      this.sheetElement.style.overflow = 'hidden';
      this.sheetElement.style.boxSizing = 'border-box';

      this.sheetElement.innerHTML = `
        <div class="di-sheet-handle" style="width:36px;height:4px;background:var(--rule,#CFD0C9);border-radius:2px;margin:8px auto 4px auto;"></div>
        
        <!-- 1. Header Block -->
        <div style="padding:8px 16px 12px 16px;background:var(--surface,#FFFFFF);border-bottom:1px solid var(--rule,#CFD0C9);display:flex;align-items:flex-start;justify-content:space-between;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-start;gap:10px;min-width:0;">
            <span class="di-side-badge ${badgeClass}" style="height:36px;min-width:36px;font-size:12px;margin-top:2px;">${sideHtml}</span>
            <div style="min-width:0;">
              <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;color:var(--ink,#121311);line-height:1.15;">
                ${fullName}
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink-2,#383B36);margin-top:4px;">
                ${typeCode} · KM · ${feat.subsection || 'KZDR'} · ${lane.toUpperCase()} LANE
              </div>
            </div>
          </div>
          <span class="di-certainty di-certainty--${cert}" style="height:22px;font-size:11px;white-space:nowrap;">${cert.toUpperCase()}</span>
        </div>

        <!-- Scrollable Detail Body -->
        <div style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">
          
          <!-- 2. What is Built Card (§6.4) -->
          <div class="di-card">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--ink,#121311);letter-spacing:0.02em;margin-bottom:8px;">
              WHAT IS BUILT ON SITE
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Seen by you</span>
              <span class="di-data-row__value" style="font-weight:700;color:var(--ink,#121311);">${currentStage}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Contractor claimed</span>
              <span class="di-data-row__value">${claimedStage || 'None filed'}</span>
            </div>
            ${verdictHtml}
          </div>

          ${defectsCardHtml}

          <!-- 3. Position & Geometry Block -->
          <div class="di-card">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--ink,#121311);letter-spacing:0.02em;margin-bottom:8px;">
              POSITION & GEOMETRY
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Line & Sub-section</span>
              <span class="di-data-row__value">${(feat.line_id === 'line_kd' || feat.line === 'KD') ? 'Kano–Dutse (KD)' : 'Kano–Maradi (KM)'} · ${feat.subsection || 'KZDR'}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Chainage Extent</span>
              <span class="di-data-row__value">${chExtentStr}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Side & Lateral Offset</span>
              <span class="di-data-row__value">${side} ${offsetM} m</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Lane Category</span>
              <span class="di-data-row__value">${lane.toUpperCase()}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Certainty Tolerance</span>
              <span class="di-data-row__value">±${tolM} m (${cert.toUpperCase()})</span>
            </div>
          </div>

          <!-- 4. Design Intent & Drawing Block -->
          <div class="di-card">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--ink,#121311);letter-spacing:0.02em;margin-bottom:8px;">
              FROM THE DRAWING
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Structure Typology</span>
              <span class="di-data-row__value">${typeCode} · ${fullName}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Drawing Reference</span>
              <span class="di-data-row__value">${drawingRef} rev ${rev}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Approval Level</span>
              <span class="di-data-row__value">Level A (Cleared for Construction)</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Cross-Section Dimensions</span>
              <span class="di-data-row__value">${specSnippet}</span>
            </div>
            <div class="di-data-row">
              <span class="di-data-row__label">Drawing Sheet Reference</span>
              <span class="di-data-row__value">${feat.sheet_no || typeInfo.drawing || 'Standard Detail Sheet'}</span>
            </div>
          </div>

          <!-- 5. Contractor Inspection Requests Block -->
          <div class="di-card">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--ink,#121311);letter-spacing:0.02em;margin-bottom:6px;">
              CONTRACTOR'S INSPECTION REQUESTS (${irs.length})
            </div>
            ${irsListHtml}
          </div>

          <!-- 6. Audit History Block -->
          <div class="di-card">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--ink,#121311);letter-spacing:0.02em;">
                AUDIT HISTORY (${observations.length})
              </span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--ink-3,#555952);">NEVER OVERWRITTEN</span>
            </div>
            ${historyListHtml}
          </div>

        </div>

        <!-- 7. Bottom Actions Bar (§6.4) -->
        <div style="padding:10px 16px;background:var(--surface,#FFFFFF);border-top:1px solid var(--rule,#CFD0C9);display:flex;flex-direction:column;gap:8px;box-sizing:border-box;">
          <button type="button" class="di-btn di-btn--primary" id="btnDetailRecordStage" style="height:72px;">
            RECORD ON THIS FEATURE
          </button>
          <div style="display:flex;gap:8px;">
            <button type="button" class="di-btn di-btn--defect" id="btnDetailDefect" style="flex:1;height:52px;font-size:14px;border:2px solid var(--defect,#B3141A);color:var(--defect,#B3141A);background:var(--surface,#FFFFFF);">
              Report defect
            </button>
            <button type="button" class="di-btn di-btn--rev" id="btnDetailRevision" style="flex:1;height:52px;font-size:14px;border:2px solid var(--rev,#1446A0);color:var(--rev,#1446A0);background:var(--surface,#FFFFFF);">
              Flag revision
            </button>
            <button type="button" class="di-btn di-btn--tertiary" id="btnDetailClose" style="height:52px;width:72px;font-size:13px;">
              Close
            </button>
          </div>
        </div>
      `;

      // Wire Actions
      const btnRecord = this.sheetElement.querySelector('#btnDetailRecordStage');
      if (btnRecord) {
        btnRecord.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onRecordStage) this.onRecordStage(featRef);
        });
      }

      const btnDefect = this.sheetElement.querySelector('#btnDetailDefect');
      if (btnDefect) {
        btnDefect.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onReportDefect) this.onReportDefect(featRef);
        });
      }

      const btnRev = this.sheetElement.querySelector('#btnDetailRevision');
      if (btnRev) {
        btnRev.addEventListener('click', () => {
          const featRef = this.currentFeature;
          this.close();
          if (this.onFlagRevision) this.onFlagRevision(featRef);
        });
      }

      const btnClose = this.sheetElement.querySelector('#btnDetailClose');
      if (btnClose) {
        btnClose.addEventListener('click', () => this.close());
      }

      document.body.appendChild(this.sheetElement);
    }
  }

  return {
    FeatureDetailView: FeatureDetailView
  };
}));
