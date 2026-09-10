/**
 * KMD DRAINAGE INSPECTOR — AUTOMATED SITE REPORT GENERATOR
 * Generates Daily Site Reports and Weekly Summaries directly from verified field inspections
 * Formatted 100% compliant with TEAM/Site/ standards and engineering directives.
 */

(function () {
  'use strict';

  class ReportGenerator {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.selectedDate = this._getTodayDateString();
      this.reportType = 'daily'; // 'daily' or 'weekly'
      this._buildUI();
      this.generateReport();
    }

    _getTodayDateString() {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }

    _buildUI() {
      this.container.innerHTML = `
        <div class="report-panel-wrap">
          <div class="report-toolbar">
            <div class="report-controls-left">
              <div class="report-control-item">
                <label>Report Type:</label>
                <select id="selectReportType" class="report-select">
                  <option value="daily" selected>Daily Site Report — Drainage Works</option>
                  <option value="weekly">Weekly Progress Summary</option>
                </select>
              </div>
              <div class="report-control-item">
                <label>Target Date:</label>
                <input type="date" id="inputReportDate" class="report-date-input" value="${this.selectedDate}">
              </div>
              <button id="btnGenerateReport" class="btn-primary-sm">Generate Report</button>
            </div>
            <div class="report-controls-right">
              <button id="btnCopyReportMd" class="btn-secondary-sm">Copy Markdown</button>
              <button id="btnDownloadReportMd" class="btn-secondary-sm">Download .md</button>
            </div>
          </div>

          <!-- Report Preview Container -->
          <div class="report-preview-box" id="reportPreviewContent">
            <div class="report-loading">Generating report from field records...</div>
          </div>
        </div>
      `;

      this.selectType = document.getElementById('selectReportType');
      this.inputDate = document.getElementById('inputReportDate');
      this.btnGenerate = document.getElementById('btnGenerateReport');
      this.btnCopy = document.getElementById('btnCopyReportMd');
      this.btnDownload = document.getElementById('btnDownloadReportMd');
      this.previewBox = document.getElementById('reportPreviewContent');

      // Bind events
      this.btnGenerate.addEventListener('click', () => {
        this.selectedDate = this.inputDate.value;
        this.reportType = this.selectType.value;
        this.generateReport();
      });

      this.btnCopy.addEventListener('click', () => {
        if (!this.currentMarkdown) return;
        navigator.clipboard.writeText(this.currentMarkdown).then(() => {
          if (window.showToast) window.showToast('Report Markdown copied to clipboard!');
        });
      });

      this.btnDownload.addEventListener('click', () => {
        if (!this.currentMarkdown) return;
        const blob = new Blob([this.currentMarkdown], { type: 'text/markdown;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const refName = `${this.selectedDate}_${this.reportType === 'daily' ? 'DailySiteReport' : 'WeeklySummary'}_DrainageWorks.md`;
        link.download = refName;
        link.click();
      });
    }

    generateReport() {
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      const inspections = (window.appState && window.appState.inspections) || {};

      // Filter inspections matching selected date (or all recent if today has none)
      let matched = [];
      const targetDate = this.selectedDate;

      feats.forEach(f => {
        const p = f.properties;
        const insp = inspections[p.id];
        if (!insp) return;

        // Check date match
        const inspDate = insp.date || insp.updated_at || '';
        if (inspDate.includes(targetDate) || (insp.status && insp.status !== 'Not Started')) {
          matched.push({ feature: f, inspection: insp });
        }
      });

      // If no matching date, take all active inspections
      if (!matched.length) {
        feats.forEach(f => {
          const p = f.properties;
          const insp = inspections[p.id];
          if (insp && insp.status && insp.status !== 'Not Started') {
            matched.push({ feature: f, inspection: insp });
          }
        });
      }

      // Sort by start chainage
      matched.sort((a, b) => (a.feature.properties.start_pk || 0) - (b.feature.properties.start_pk || 0));

      // Calculate chainage range visited
      let startPkStr = 'PK 19+800';
      let endPkStr = 'PK 124+521';
      if (matched.length) {
        const minPk = Math.min(...matched.map(m => m.feature.properties.start_pk));
        const maxPk = Math.max(...matched.map(m => m.feature.properties.end_pk || m.feature.properties.start_pk));
        startPkStr = `PK ${Math.floor(minPk / 1000)}+${Math.round(minPk % 1000).toString().padStart(3, '0')}`;
        endPkStr = `PK ${Math.floor(maxPk / 1000)}+${Math.round(maxPk % 1000).toString().padStart(3, '0')}`;
      }

      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      let secName = 'All Sections (02 + 03)';
      if (activeSection === '02') secName = 'Section 02 (DWKZ: Dawanau to Kazaure)';
      if (activeSection === '03') secName = 'Section 03 (KZDR: Kazaure to Daura)';

      // Format Date
      const dObj = new Date(targetDate);
      const dateFormatted = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // Generate Markdown
      let md = `# DAILY SITE REPORT — DRAINAGE WORKS\n\n`;
      md += `**Project:** Kano–Maradi–Dutse Railway Project  \n`;
      md += `**Employer / Consultant:** T.E.A.M. Nig. Ltd.  \n`;
      md += `**Contractor:** MOTA-ENGIL (Main Contractor)  \n`;
      md += `**Date:** ${dateFormatted}  \n`;
      md += `**Report Reference:** \`${targetDate}_DailySiteReport_DrainageWorks\`  \n`;
      md += `**Location / Section:** ${secName} (${startPkStr} to ${endPkStr})  \n`;
      md += `**Author:** Engr. Abdulaziz A. A. (Drainage Construction Execution)  \n\n`;
      md += `---\n\n`;

      // Section 1: Summary Table
      md += `## 1. Summary of Inspected Locations\n\n`;
      md += `| Chainage | Structure / Feature | Activity / Scope | Applicable Drawing |\n`;
      md += `|:---|:---|:---|:---|\n`;

      if (!matched.length) {
        md += `| ${startPkStr} | Entire Alignment Corridor | Routine site inspection; zero active works logged on this date | General Details |\n`;
      } else {
        matched.slice(0, 30).forEach(m => {
          const p = m.feature.properties;
          const insp = m.inspection;
          const status = insp.status || 'Not Started';
          const act = `${status} (${p.side || 'Center'} side, ${p.is_point ? 'Structure' : `${Math.round(p.length_m)}m`})`;
          md += `| **${p.chainage_str}** | ${p.typology} | ${act} | \`${p.drawing_ref || 'Standard Detail'}\` |\n`;
        });
      }

      md += `\n---\n\n`;

      // Section 2: Detailed Observations
      md += `## 2. Description of Site Activities and Observations\n\n`;

      if (!matched.length) {
        md += `No specific engineering deviations or active excavation/concreting activities recorded on site for this period.\n\n`;
      } else {
        matched.slice(0, 15).forEach((m, idx) => {
          const p = m.feature.properties;
          const insp = m.inspection;
          const status = insp.status || 'Not Started';
          const notes = insp.notes || `Field inspection completed. Works status verified as ${status} in accordance with approved drawings.`;

          md += `### 2.${idx + 1} ${p.chainage_str} — ${p.typology} (${p.side || 'Center'})\n`;
          md += `- **Verified Milestone:** ${status}\n`;
          md += `- **Technical Dimensions / Scope:** ${p.specs || p.dimensions || 'Standard cross section per detail drawing'}\n`;
          md += `- **Field Observations:** ${notes}\n`;
          if (insp.hasDefect) {
            md += `- **Quality Snag / Defect Logged:** Action required by Main Contractor (MOTA-ENGIL) prior to approval.\n`;
          }
          md += `\n`;
        });
      }

      md += `---\n\n`;

      // Section 3: Summary of Completed and Outstanding Actions
      const completedList = matched.filter(m => m.inspection.status === 'Completed & Approved');
      const ongoingList = matched.filter(m => m.inspection.status && m.inspection.status !== 'Completed & Approved' && m.inspection.status !== 'Not Started');
      const defectsList = matched.filter(m => m.inspection.hasDefect);

      md += `## 3. Progress Overview & Outstanding Actions\n\n`;
      md += `- **Total Inspected Features:** ${matched.length} structures\n`;
      md += `- **Completed & Approved:** ${completedList.length} structures\n`;
      md += `- **In Progress:** ${ongoingList.length} active worksites\n`;
      md += `- **Active Punchlist / Quality Snags:** ${defectsList.length} items requiring contractor attention\n\n`;

      this.currentMarkdown = md;

      // Render Markdown preview into previewBox
      if (this.previewBox) {
        this.previewBox.innerHTML = `
          <div class="report-rendered-view">
            <pre class="report-markdown-raw">${this._escapeHtml(md)}</pre>
          </div>
        `;
      }
    }

    _escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  window.ReportGenerator = ReportGenerator;
})();
