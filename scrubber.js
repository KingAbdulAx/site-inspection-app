/**
 * KMD DRAINAGE INSPECTOR — CHAINAGE SCRUBBER & PROXIMITY INSPECTOR
 * "Wagwan Along the Alignment?" Field Navigation Engine
 */

(function () {
  'use strict';

  class ChainageScrubber {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.currentPk = 84406; // Default to PK 84+406
      this.startPk = 19800;
      this.endPk = 124521;
      this.searchRadiusM = 200; // Search window +/- 200m

      this._buildUI();
      this._bindEvents();
      this.updateRange();
    }

    _buildUI() {
      this.container.innerHTML = `
        <div class="scrubber-panel">
          <div class="scrubber-header">
            <div class="scrubber-title-wrap">
              <span class="scrubber-label">ALIGNMENT CHAINAGE</span>
              <span class="scrubber-active-pk" id="scrubberActivePk">PK 84+406</span>
            </div>
            <div class="scrubber-step-tools">
              <button type="button" class="btn-step" data-step="-500" title="Back 500m">-500m</button>
              <button type="button" class="btn-step" data-step="-100" title="Back 100m">-100m</button>
              <button type="button" class="btn-step" data-step="100" title="Forward 100m">+100m</button>
              <button type="button" class="btn-step" data-step="500" title="Forward 500m">+500m</button>
            </div>
          </div>

          <div class="scrubber-track-wrap">
            <span class="scrubber-bound-label" id="scrubberStartLabel">PK 19+800</span>
            <div class="scrubber-slider-container">
              <input type="range" id="chainageRangeInput" class="scrubber-slider" min="19800" max="124521" step="25" value="84406">
              <div class="scrubber-ticks-bar" id="scrubberTicksBar"></div>
            </div>
            <span class="scrubber-bound-label" id="scrubberEndLabel">PK 124+521</span>
          </div>

          <!-- "Wagwan Along the Alignment?" Live Proximity Asset Strip -->
          <div class="wagwan-strip">
            <div class="wagwan-header">
              <span class="wagwan-title">WAGWAN AT THIS CHAINAGE? (±200m)</span>
              <span class="wagwan-count" id="wagwanCount">0 features</span>
            </div>
            <div class="wagwan-cards" id="wagwanCards">
              <div class="wagwan-empty">Drag the slider above to inspect engineering features along the track.</div>
            </div>
          </div>
        </div>
      `;

      this.slider = document.getElementById('chainageRangeInput');
      this.activePkLabel = document.getElementById('scrubberActivePk');
      this.startLabel = document.getElementById('scrubberStartLabel');
      this.endLabel = document.getElementById('scrubberEndLabel');
      this.wagwanCards = document.getElementById('wagwanCards');
      this.wagwanCount = document.getElementById('wagwanCount');
    }

    _bindEvents() {
      // Slider input event (continuous drag)
      this.slider.addEventListener('input', e => {
        const pk = parseFloat(e.target.value);
        this.setChainage(pk, false);
      });

      // Step buttons (-500m, -100m, +100m, +500m)
      this.container.querySelectorAll('.btn-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const step = parseFloat(btn.getAttribute('data-step'));
          const newPk = Math.max(this.startPk, Math.min(this.endPk, this.currentPk + step));
          this.setChainage(newPk, true);
        });
      });
    }

    updateRange() {
      const activeSection = window.appState ? window.appState.activeSection : 'all';
      if (activeSection === '02') {
        this.startPk = 19800;
        this.endPk = 82902.439;
      } else if (activeSection === '03') {
        this.startPk = 82902.439;
        this.endPk = 124521;
      } else {
        // all
        this.startPk = 19800;
        this.endPk = 124521;
      }

      this.slider.min = this.startPk;
      this.slider.max = this.endPk;
      this.startLabel.innerText = this.formatPk(this.startPk);
      this.endLabel.innerText = this.formatPk(this.endPk);

      if (this.currentPk < this.startPk || this.currentPk > this.endPk) {
        this.currentPk = this.startPk;
      }
      this.slider.value = this.currentPk;
      this.setChainage(this.currentPk, true);
    }

    formatPk(pk) {
      const km = Math.floor(pk / 1000);
      const m = Math.round(pk % 1000);
      return `PK ${km}+${m.toString().padStart(3, '0')}`;
    }

    setChainage(pk, updateSlider = true) {
      this.currentPk = Math.max(this.startPk, Math.min(this.endPk, pk));
      if (updateSlider) this.slider.value = this.currentPk;
      this.activePkLabel.innerText = this.formatPk(this.currentPk);

      // 1. Move CAD Viewer
      if (window.cadViewer) {
        window.cadViewer.jumpToPk(this.currentPk, true);
      }

      // 2. Move Leaflet map if visible
      if (window.appState && window.appState.map && window.jumpToChainage) {
        // Fast snap without reloading full layout
        const km = Math.floor(this.currentPk / 1000);
        const m = Math.round(this.currentPk % 1000);
        const pkStr = `${km}+${m.toString().padStart(3, '0')}`;
        const input = document.getElementById('txtJumpPk');
        if (input) input.value = pkStr;
      }

      // 3. Query "Wagwan at this Chainage?"
      this.queryNearbyFeatures();
    }

    queryNearbyFeatures() {
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      if (!feats.length) {
        this.wagwanCards.innerHTML = '<div class="wagwan-empty">No engineering features available.</div>';
        this.wagwanCount.innerText = '0 features';
        return;
      }

      const pk = this.currentPk;
      const r = this.searchRadiusM;

      // Filter features within [pk - r, pk + r]
      const nearby = [];
      feats.forEach(f => {
        const p = f.properties;
        let distM = Infinity;

        if (p.is_point) {
          distM = Math.abs(p.start_pk - pk);
          if (distM <= r) {
            nearby.push({ feature: f, distM, isPoint: true });
          }
        } else {
          // Linear feature: check overlap
          if (p.end_pk >= pk - r && p.start_pk <= pk + r) {
            // Distance from current pk to nearest point on feature
            if (pk >= p.start_pk && pk <= p.end_pk) distM = 0;
            else distM = Math.min(Math.abs(p.start_pk - pk), Math.abs(p.end_pk - pk));
            nearby.push({ feature: f, distM, isPoint: false });
          }
        }
      });

      // Sort by proximity to current station
      nearby.sort((a, b) => a.distM - b.distM);

      this.wagwanCount.innerText = `${nearby.length} feature${nearby.length === 1 ? '' : 's'}`;

      if (!nearby.length) {
        this.wagwanCards.innerHTML = '<div class="wagwan-empty">No drainage structures within ±200m of this chainage. Natural sheet runoff or open earth reach.</div>';
        return;
      }

      const inspections = (window.appState && window.appState.inspections) || {};

      let html = '';
      nearby.slice(0, 12).forEach(item => {
        const p = item.feature.properties;
        const insp = inspections[p.id] || {};
        const status = insp.status || 'Not Started';
        const hasDefect = !!insp.hasDefect;

        let statusClass = 'badge-status-not-started';
        if (status === 'Completed & Approved') statusClass = 'badge-status-completed';
        else if (status !== 'Not Started') statusClass = 'badge-status-ongoing';
        if (hasDefect) statusClass = 'badge-status-defect';

        const sideClass = p.side === 'Left' ? 'side-l' : (p.side === 'Right' ? 'side-r' : 'side-c');

        html += `
          <div class="wagwan-card" data-asset-id="${p.id}" title="Tap to inspect ${p.typology}">
            <div class="wagwan-card-top">
              <span class="wagwan-badge-code" style="background:${p.color || '#38BDF8'}">${p.short_code || 'DRAIN'}</span>
              <span class="wagwan-badge-side ${sideClass}">${p.side || 'Center'}</span>
              <span class="wagwan-badge-status ${statusClass}">${hasDefect ? 'Defect' : status}</span>
            </div>
            <div class="wagwan-card-mid">
              <div class="wagwan-card-title">${p.typology}</div>
              <div class="wagwan-card-ch">${p.chainage_str}</div>
            </div>
            <div class="wagwan-card-bot">
              <span class="wagwan-card-dwg">${p.drawing_ref || 'Standard Detail'}</span>
              <span class="wagwan-card-len">${p.is_point ? 'Structure' : `${Math.round(p.length_m)} m`}</span>
            </div>
          </div>
        `;
      });

      this.wagwanCards.innerHTML = html;

      // Card click event -> Select Asset
      this.wagwanCards.querySelectorAll('.wagwan-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-asset-id');
          const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
          const match = feats.find(f => f.properties.id === id);
          if (match && window.selectAsset) {
            window.selectAsset(match);
          }
        });
      });
    }
  }

  window.ChainageScrubber = ChainageScrubber;
})();
