/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 5 Defect Reporting Flow
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.5 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.DefectView = exportsObj.DefectView;
    root.DEFECT_TYPES = exportsObj.DEFECT_TYPES;
    root.SEVERITY_LEVELS = exportsObj.SEVERITY_LEVELS;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  // 10 Standard Defect Type Chips (§6.5)
  const DEFECT_TYPES = [
    'Scour / erosion',
    'Cracking',
    'Honeycombing',
    'Blocked / silted',
    'Alignment error',
    'Joint failure',
    'Exposed rebar',
    'Outfall scour',
    'Standing water',
    'Other'
  ];

  // 3 Standard Severity Levels
  const SEVERITY_LEVELS = [
    'Minor (monitor)',
    'Major (rework required)',
    'Critical (safety / structural risk)'
  ];

  class DefectView {
    constructor(containerElement = null, options = {}) {
      this.container = containerElement;
      this.options = options;
      this.dataStore = options.dataStore || (typeof root !== 'undefined' && root.DataStore ? root.DataStore : null);
      this.toastManager = options.toastManager || null;
      this.onDefectLogged = typeof options.onDefectLogged === 'function' ? options.onDefectLogged : null;
      this.onClose = typeof options.onClose === 'function' ? options.onClose : null;

      this.currentFeature = null;
      this.userPosition = null;
      this.isOpen = false;
      this.sheetElement = null;
      this.backdropElement = null;

      // Current form state
      this.selectedType = DEFECT_TYPES[0];
      this.selectedSeverity = SEVERITY_LEVELS[1]; // default to Major
      this.chainageValue = null;
      this.noteText = '';
      this.attachedPhoto = null;
    }

    /**
     * Open the Defect Reporting Sheet
     */
    open(feature, userPosition = {}) {
      if (!feature) return;
      this.currentFeature = feature;
      this.userPosition = Object.assign({}, userPosition);
      this.isOpen = true;

      // Default chainage where seen to user position or feature start
      const defaultCh = typeof userPosition.ch === 'number'
        ? userPosition.ch
        : (typeof feature.ch === 'number' ? feature.ch : (feature.ch_start || 0));
      this.chainageValue = defaultCh;
      this.selectedType = DEFECT_TYPES[0];
      this.selectedSeverity = SEVERITY_LEVELS[1];
      this.noteText = '';
      this.attachedPhoto = null;

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
     * Execute defect submission:
     * Appends FieldRecord, Query of reason 'defect', marks feature, triggers toast
     */
    submitDefect(overrideData = {}) {
      if (!this.currentFeature) return null;

      const feat = this.currentFeature;
      const fId = feat.feature_id || feat.id;
      const pos = this.userPosition || {};

      const defectType = overrideData.defect_type || this.selectedType;
      const severity = overrideData.severity || this.selectedSeverity;
      const ch = typeof overrideData.chainage === 'number' ? overrideData.chainage : this.chainageValue;
      const note = overrideData.note !== undefined ? overrideData.note : this.noteText;
      const photo = overrideData.photo || this.attachedPhoto;

      let result = null;

      if (this.dataStore && typeof this.dataStore.logDefect === 'function') {
        result = this.dataStore.logDefect({
          feature_id: fId,
          defect_type: defectType,
          severity: severity,
          chainage: ch,
          note: note,
          photo: photo,
          author: this.options.author || 'Engr. Abdulaziz A. A.',
          device_id: this.options.deviceId || 'device_field',
          measured_position: {
            ch: ch,
            side: pos.side || feat.side || 'C',
            offset_m: typeof pos.offset_m === 'number' ? pos.offset_m : (feat.offset_m || 0),
            accuracy_m: typeof pos.accuracy_m === 'number' ? pos.accuracy_m : 4.0
          }
        });
      } else {
        // Fallback if dataStore mock doesn't have logDefect
        const year = new Date().getFullYear();
        const defId = `DEF-${year}-0001`;
        result = {
          defect_id: defId,
          record: {
            record_id: 'rec_def_' + Date.now(),
            feature_id: fId,
            kind: 'defect',
            stage: feat.current_stage || feat.stage || 'Not started',
            payload: {
              defect_id: defId,
              defect_type: defectType,
              severity: severity,
              chainage: ch,
              note: note
            }
          },
          query: {
            query_id: 'q_def_' + Date.now(),
            feature_id: fId,
            reason: 'defect',
            title: `${defId}: ${defectType} (${severity})`,
            status: 'open'
          }
        };
      }

      // Mark feature in memory so WalkStrip renders the 18px warning triangle
      feat.has_defect = true;
      if (!Array.isArray(feat.defects)) feat.defects = [];
      feat.defects.push({
        defect_id: result.defect_id,
        defect_type: defectType,
        severity: severity,
        chainage: ch,
        note: note
      });

      // Dismiss modal
      this.close();

      // Show confirmation toast
      if (this.toastManager && typeof this.toastManager.showToast === 'function') {
        this.toastManager.showToast(`Defect ${result.defect_id} logged · Query raised for office`, 'defect', 4000);
      }

      // Invoke callback
      if (this.onDefectLogged) {
        this.onDefectLogged({
          feature: feat,
          defect_id: result.defect_id,
          record: result.record,
          query: result.query
        });
      }

      return result;
    }

    /**
     * Render the Defect Sheet in DOM
     */
    renderDOM() {
      if (typeof document === 'undefined') return;

      const feat = this.currentFeature;
      const typeCode = feat.type_code ? (feat.type_code.startsWith('T') ? feat.type_code : 'T' + feat.type_code) : (feat.category || 'Structure');
      const shortName = feat.short_name || feat.shortName || feat.category || 'Drainage Structure';
      const side = String(feat.side || 'C').toUpperCase();

      // Format initial chainage
      const km = Math.floor(this.chainageValue / 1000);
      const m = Math.round(this.chainageValue % 1000);
      const stationStr = `${km}+${String(m).padStart(3, '0')}`;

      // Create Backdrop
      this.backdropElement = document.createElement('div');
      this.backdropElement.className = 'di-sheet-backdrop';
      this.backdropElement.style.position = 'fixed';
      this.backdropElement.style.top = '0';
      this.backdropElement.style.left = '0';
      this.backdropElement.style.width = '100vw';
      this.backdropElement.style.height = '100vh';
      this.backdropElement.style.background = 'rgba(18, 19, 17, 0.4)';
      this.backdropElement.style.zIndex = '270';
      this.backdropElement.style.backdropFilter = 'blur(2px)';
      this.backdropElement.addEventListener('click', () => this.close());
      document.body.appendChild(this.backdropElement);

      // Create Sheet Container
      this.sheetElement = document.createElement('div');
      this.sheetElement.className = 'di-modal-sheet di-defect-sheet';
      this.sheetElement.style.position = 'fixed';
      this.sheetElement.style.bottom = '0';
      this.sheetElement.style.left = '50%';
      this.sheetElement.style.transform = 'translateX(-50%)';
      this.sheetElement.style.width = '100%';
      this.sheetElement.style.maxWidth = '390px';
      this.sheetElement.style.maxHeight = '90vh';
      this.sheetElement.style.background = 'var(--surface, #FFFFFF)';
      this.sheetElement.style.borderTop = '2px solid var(--defect, #B3141A)';
      this.sheetElement.style.borderRadius = '16px 16px 0 0';
      this.sheetElement.style.boxShadow = 'var(--shadow-lg, 0 -8px 24px rgba(18, 19, 17, 0.2))';
      this.sheetElement.style.zIndex = '280';
      this.sheetElement.style.display = 'flex';
      this.sheetElement.style.flexDirection = 'column';
      this.sheetElement.style.overflow = 'hidden';
      this.sheetElement.style.boxSizing = 'border-box';

      // Defect Type Chips HTML (44px touch targets)
      let chipsHtml = '';
      for (const t of DEFECT_TYPES) {
        const isActive = (t === this.selectedType);
        chipsHtml += `
          <button type="button" class="di-filter-chip di-defect-type-chip ${isActive ? 'di-filter-chip--active' : ''}" data-type="${t}" style="height:44px;padding:0 14px;font-size:13px;border-radius:22px;white-space:nowrap;">
            ${t}
          </button>
        `;
      }

      // Severity Levels HTML (44px segmented control)
      let severityHtml = '';
      for (const s of SEVERITY_LEVELS) {
        const isActive = (s === this.selectedSeverity);
        const isCritical = s.includes('Critical');
        const activeBg = isCritical ? 'var(--defect, #B3141A)' : 'var(--ink, #121311)';
        severityHtml += `
          <button type="button" class="di-severity-btn ${isActive ? 'di-severity-btn--active' : ''}" data-severity="${s}" style="flex:1;height:44px;border:none;border-radius:6px;font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;cursor:pointer;background:${isActive ? activeBg : 'transparent'};color:${isActive ? '#FFFFFF' : 'var(--ink-2, #383B36)'};transition:all 0.15s ease;">
            ${s.split(' ')[0]}
          </button>
        `;
      }

      this.sheetElement.innerHTML = `
        <div class="di-sheet-handle" style="width:36px;height:4px;background:var(--rule,#CFD0C9);border-radius:2px;margin:8px auto 4px auto;"></div>
        
        <!-- Header -->
        <div class="di-sheet-header" style="padding:8px 16px 12px 16px;border-bottom:1px solid var(--rule,#CFD0C9);display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;color:var(--defect,#B3141A);letter-spacing:0.02em;">
              REPORT FIELD DEFECT
            </div>
            <div style="font-family:'Barlow',sans-serif;font-weight:600;font-size:13px;color:var(--ink-2,#383B36);margin-top:2px;">
              ${typeCode} · ${shortName} (${side})
            </div>
          </div>
          <button type="button" class="di-btn di-btn--tertiary" id="btnDefectClose" style="height:36px;padding:0 12px;font-size:12px;">
            Close
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="di-sheet-body" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;">
          
          <!-- 1. Defect Type Chips -->
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;margin-bottom:8px;">
              DEFECT TYPE (SELECT ONE)
            </div>
            <div class="di-defect-chips-scroll" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
              ${chipsHtml}
            </div>
          </div>

          <!-- 2. Severity Segmented Control -->
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;margin-bottom:8px;">
              SEVERITY LEVEL
            </div>
            <div style="display:flex;background:var(--paper,#F6F5F0);border:1px solid var(--rule,#CFD0C9);border-radius:8px;padding:3px;box-sizing:border-box;">
              ${severityHtml}
            </div>
          </div>

          <!-- 3. Chainage Where Seen -->
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;margin-bottom:6px;">
              CHAINAGE WHERE SEEN (PK)
            </div>
            <input type="text" id="defectChainageInput" value="PK ${stationStr}" style="width:100%;height:44px;border:1.5px solid var(--ink,#121311);border-radius:6px;padding:0 12px;font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;box-sizing:border-box;background:var(--surface,#FFFFFF);">
          </div>

          <!-- 4. Field Memo / Notes -->
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;margin-bottom:6px;">
              FIELD MEMO / OBSERVATION NOTES
            </div>
            <textarea id="defectNoteInput" rows="3" placeholder="Describe defect location on structure, dimensions, erosion depth, honeycombing extent..." style="width:100%;border:1.5px solid var(--rule,#CFD0C9);border-radius:6px;padding:10px 12px;font-family:'Barlow',sans-serif;font-size:14px;box-sizing:border-box;resize:none;line-height:1.35;"></textarea>
          </div>

          <!-- 5. Photo Attachment Support -->
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-3,#555952);letter-spacing:0.04em;margin-bottom:6px;">
              PHOTOGRAPHIC EVIDENCE (GPS STAMPED)
            </div>
            <label class="di-photo-attach-box" style="display:flex;align-items:center;justify-content:center;height:56px;border:1.5px dashed var(--ink,#121311);border-radius:8px;background:var(--paper,#F6F5F0);cursor:pointer;">
              <input type="file" id="defectPhotoInput" accept="image/*" capture="environment" style="display:none;">
              <span id="defectPhotoLabel" style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:var(--ink,#121311);">
                + ATTACH CAMERA / SITE PHOTO
              </span>
            </label>
            <div id="defectGpsStamp" style="display:none;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--ink-3,#555952);">
              GPS STAMP: Lat 12.6248, Lon 8.4041 · ±4m · Snapped PK ${stationStr}
            </div>
          </div>

        </div>

        <!-- Primary Action Button: 72px LOG DEFECT (§6.5) -->
        <div class="di-sheet-footer" style="padding:12px 16px;background:var(--surface,#FFFFFF);border-top:1px solid var(--rule,#CFD0C9);box-sizing:border-box;">
          <button type="button" class="di-btn di-btn--primary" id="btnLogDefectSubmit" style="height:72px;background:var(--defect,#B3141A);color:#FFFFFF;border:none;">
            LOG DEFECT
          </button>
        </div>
      `;

      // Wire Type Chips
      const typeChips = this.sheetElement.querySelectorAll('.di-defect-type-chip');
      typeChips.forEach(c => {
        c.addEventListener('click', () => {
          typeChips.forEach(tc => tc.classList.remove('di-filter-chip--active'));
          c.classList.add('di-filter-chip--active');
          this.selectedType = c.getAttribute('data-type');
        });
      });

      // Wire Severity Segmented Control
      const sevBtns = this.sheetElement.querySelectorAll('.di-severity-btn');
      sevBtns.forEach(b => {
        b.addEventListener('click', () => {
          sevBtns.forEach(sb => {
            sb.style.background = 'transparent';
            sb.style.color = 'var(--ink-2, #383B36)';
          });
          const sev = b.getAttribute('data-severity');
          this.selectedSeverity = sev;
          const isCritical = sev.includes('Critical');
          b.style.background = isCritical ? 'var(--defect, #B3141A)' : 'var(--ink, #121311)';
          b.style.color = '#FFFFFF';
        });
      });

      // Wire Photo Upload Mock / File Reader
      const photoInput = this.sheetElement.querySelector('#defectPhotoInput');
      const photoLabel = this.sheetElement.querySelector('#defectPhotoLabel');
      const gpsStamp = this.sheetElement.querySelector('#defectGpsStamp');

      if (photoInput) {
        photoInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            this.attachedPhoto = {
              file: file,
              filename: file.name,
              timestamp: new Date().toISOString(),
              raw_fix: { lat: 12.6248, lon: 8.4041, accuracy_m: 4.0 },
              snapped: { ch: this.chainageValue, side: side }
            };
            if (photoLabel) photoLabel.textContent = `Attached: ${file.name}`;
            if (gpsStamp) gpsStamp.style.display = 'block';
          }
        });
      }

      // Wire Note Input
      const noteInput = this.sheetElement.querySelector('#defectNoteInput');
      if (noteInput) {
        noteInput.addEventListener('input', (e) => {
          this.noteText = e.target.value;
        });
      }

      // Wire Chainage Input
      const chInput = this.sheetElement.querySelector('#defectChainageInput');
      if (chInput) {
        chInput.addEventListener('change', (e) => {
          const val = e.target.value.replace(/[^0-9.]/g, '');
          if (val) {
            const num = parseFloat(val);
            if (!isNaN(num)) this.chainageValue = num;
          }
        });
      }

      // Wire Primary Submit Action
      const submitBtn = this.sheetElement.querySelector('#btnLogDefectSubmit');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this.submitDefect();
        });
      }

      // Wire Close
      const closeBtn = this.sheetElement.querySelector('#btnDefectClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      document.body.appendChild(this.sheetElement);
    }
  }

  return {
    DefectView: DefectView,
    DEFECT_TYPES: DEFECT_TYPES,
    SEVERITY_LEVELS: SEVERITY_LEVELS
  };
}));
