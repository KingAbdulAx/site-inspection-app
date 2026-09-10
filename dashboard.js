/**
 * KMD DRAINAGE INSPECTOR — EXECUTIVE PROJECT DASHBOARD
 * Contractual Design Inventory vs. Field Progress Analytics
 * Strictly calculates metrics from verified spatial features and live inspection records.
 */

(function () {
  'use strict';

  class ProjectDashboard {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;
      this.render();
    }

    render() {
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      const inspections = (window.appState && window.appState.inspections) || {};

      // 1. Calculate Metrics
      const totalFeatures = feats.length;
      let completedCount = 0;
      let ongoingCount = 0;
      let notStartedCount = 0;
      let defectCount = 0;
      let totalLinearM = 0;
      let completedLinearM = 0;

      // Category aggregations: { total: 0, completed: 0, totalM: 0, completedM: 0 }
      const cats = {
        'Toe Ditch': { name: 'Toe Ditches (Types 4, 7, 12)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Water Descent': { name: 'Water Descents (Cascades)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Shoulder Ditch': { name: 'Platform Shoulder Ditches (Type 9)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Shoulder / Cascade': { name: 'Platform Shoulder Ditches (Type 9)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Berm Ditch': { name: 'Berm Ditches (Type 8)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Cross Drainage': { name: 'Cross Drainage Culverts (Box & Pipe)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Riprap Protection': { name: 'Riprap Armor & Scour Protection', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Diversion Channel': { name: 'Open & Diversion Channels (Types A–C)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Energy Dissipator': { name: 'Energy Dissipators (Basins)', total: 0, completed: 0, totalM: 0, completedM: 0 },
        'Track Drainage': { name: 'Track & Yard Collector Networks', total: 0, completed: 0, totalM: 0, completedM: 0 }
      };

      const defectsList = [];

      feats.forEach(f => {
        const p = f.properties;
        const insp = inspections[p.id] || {};
        const status = insp.status || 'Not Started';
        const hasDefect = !!insp.hasDefect;
        const len = p.length_m || 0;

        totalLinearM += len;

        if (status === 'Completed & Approved') {
          completedCount++;
          completedLinearM += len;
        } else if (status === 'Not Started') {
          notStartedCount++;
        } else {
          ongoingCount++;
        }

        if (hasDefect) {
          defectCount++;
          defectsList.push({
            id: p.id,
            chainage: p.chainage_str,
            typology: p.typology,
            side: p.side,
            drawing: p.drawing_ref,
            notes: insp.notes || 'Defect logged',
            date: insp.date || 'Unspecified'
          });
        }

        // Categorize
        const catKey = p.category;
        if (cats[catKey]) {
          cats[catKey].total++;
          cats[catKey].totalM += len;
          if (status === 'Completed & Approved') {
            cats[catKey].completed++;
            cats[catKey].completedM += len;
          }
        }
      });

      const overallPct = totalFeatures > 0 ? Math.round((completedCount / totalFeatures) * 100) : 0;

      // Section metadata
      let sectionTitle = 'All Active Sections (02 + 03)';
      let sectionCode = 'KAMA CORRIDOR';
      let chainageSpan = 'PK 19+800 — PK 124+521 (104.7 km)';

      if (activeSection === '02') {
        sectionTitle = 'Section 02: Dawanau to Kazaure';
        sectionCode = 'DWKZ';
        chainageSpan = 'PK 19+800 — PK 82+902 (63.1 km)';
      } else if (activeSection === '03') {
        sectionTitle = 'Section 03: Kazaure to Daura';
        sectionCode = 'KZDR';
        chainageSpan = 'PK 82+902 — PK 124+521 (41.6 km)';
      }

      // Build HTML
      this.container.innerHTML = `
        <div class="dashboard-wrap">
          <!-- Top Section Header -->
          <div class="dash-header-card">
            <div class="dash-badge-row">
              <span class="dash-sec-code">${sectionCode}</span>
              <span class="dash-sec-type">DRAINAGE EXECUTION MONITOR</span>
            </div>
            <h2 class="dash-sec-title">${sectionTitle}</h2>
            <div class="dash-sec-span">${chainageSpan}</div>
          </div>

          <!-- KPI Summary Cards -->
          <div class="dash-kpi-grid">
            <div class="dash-kpi-card">
              <span class="dash-kpi-label">TOTAL FEATURES</span>
              <span class="dash-kpi-num val-total">${totalFeatures}</span>
              <span class="dash-kpi-sub">${(totalLinearM / 1000).toFixed(1)} km linear ditches</span>
            </div>
            <div class="dash-kpi-card">
              <span class="dash-kpi-label">COMPLETED & APPROVED</span>
              <span class="dash-kpi-num val-completed">${completedCount}</span>
              <span class="dash-kpi-sub">${overallPct}% overall physical progress</span>
            </div>
            <div class="dash-kpi-card">
              <span class="dash-kpi-label">IN PROGRESS</span>
              <span class="dash-kpi-num val-ongoing">${ongoingCount}</span>
              <span class="dash-kpi-sub">Active excavation / concrete casting</span>
            </div>
            <div class="dash-kpi-card">
              <span class="dash-kpi-label">NOT STARTED</span>
              <span class="dash-kpi-num val-not-started">${notStartedCount}</span>
              <span class="dash-kpi-sub">Design inventory pending execution</span>
            </div>
            <div class="dash-kpi-card">
              <span class="dash-kpi-label">ACTIVE ISSUES / SNAGS</span>
              <span class="dash-kpi-num val-defects">${defectCount}</span>
              <span class="dash-kpi-sub">Quality punch items logged</span>
            </div>
          </div>

          <!-- Typology Completion Breakdown -->
          <div class="dash-section-panel">
            <div class="dash-panel-title">DRAINAGE TYPOLOGY BREAKDOWN (DESIGN VS FIELD COMPLETION)</div>
            <div class="typology-progress-list">
              ${Object.entries(cats).map(([key, item]) => {
                if (item.total === 0) return '';
                const pct = Math.round((item.completed / item.total) * 100);
                return `
                  <div class="typology-progress-item">
                    <div class="typo-row-top">
                      <span class="typo-name">${item.name}</span>
                      <span class="typo-counts">
                        <strong>${item.completed}</strong> / ${item.total} (${pct}%)
                        ${item.totalM > 0 ? `<span class="typo-m">· ${Math.round(item.completedM)}m / ${Math.round(item.totalM)}m</span>` : ''}
                      </span>
                    </div>
                    <div class="typo-bar-track">
                      <div class="typo-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Active Quality Issues / Punchlist -->
          <div class="dash-section-panel">
            <div class="dash-panel-title">ACTIVE QUALITY DEFECTS & PUNCHLIST ITEMS (${defectCount})</div>
            ${defectsList.length === 0 ? `
              <div class="dash-empty-notice">Zero active defects logged. All inspected reaches conform to technical specifications.</div>
            ` : `
              <div class="dash-defects-table-wrap">
                <table class="dash-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Chainage</th>
                      <th>Typology</th>
                      <th>Side</th>
                      <th>Inspection Observation / Issue</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${defectsList.map(d => `
                      <tr>
                        <td><strong>${d.id}</strong></td>
                        <td>${d.chainage}</td>
                        <td>${d.typology}</td>
                        <td>${d.side}</td>
                        <td class="text-defect">${d.notes}</td>
                        <td>${d.date}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    }
  }

  window.ProjectDashboard = ProjectDashboard;
})();
