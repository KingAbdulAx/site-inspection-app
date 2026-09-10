/**
 * KMD DRAINAGE INSPECTOR — DATA PORTABILITY & EXCHANGE CENTER
 * Complete Dataset Portability: GeoJSON, CSV, JSON, SQLite DDL/DML, and XLSX
 * Ensures engineering data is never trapped within the user interface.
 */

(function () {
  'use strict';

  class DataExchange {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;
      this._buildUI();
    }

    _buildUI() {
      this.container.innerHTML = `
        <div class="data-exchange-wrap">
          <div class="exchange-header">
            <h3>ENGINEERING DATA PORTABILITY & EXCHANGE</h3>
            <p>Export spatial alignments, design inventories, and live inspection progress into standard engineering and GIS formats.</p>
          </div>

          <div class="exchange-cards-grid">
            <!-- 1. GeoJSON -->
            <div class="exchange-card">
              <div class="ex-icon">🌐</div>
              <div class="ex-info">
                <h4>GeoJSON Export</h4>
                <p>Standard RFC 7946 FeatureCollection with line/point geometries and engineering properties. Compatible with QGIS, ArcGIS, and AutoCAD Map 3D.</p>
              </div>
              <button id="btnExportGeoJSON" class="btn-ex-action">Export GeoJSON</button>
            </div>

            <!-- 2. CSV -->
            <div class="exchange-card">
              <div class="ex-icon">📊</div>
              <div class="ex-info">
                <h4>CSV Tabular Export</h4>
                <p>Flat comma-separated spreadsheet with all chainages, typology scopes, drawing numbers, status, and punchlist notes.</p>
              </div>
              <button id="btnExportCSV" class="btn-ex-action">Export CSV</button>
            </div>

            <!-- 3. Excel (.xlsx) -->
            <div class="exchange-card">
              <div class="ex-icon">📗</div>
              <div class="ex-info">
                <h4>Excel Multi-Sheet Workbook (.xlsx)</h4>
                <p>Organized into separate sheets: Overview, Culverts, Ditches, Water Descents, and Field Inspection Log.</p>
              </div>
              <button id="btnExportXLSX" class="btn-ex-action">Export Excel (.xlsx)</button>
            </div>

            <!-- 4. SQLite / SQL -->
            <div class="exchange-card">
              <div class="ex-icon">🗄️</div>
              <div class="ex-info">
                <h4>SQLite / SQL DDL & DML Dump</h4>
                <p>Ready-to-run standard SQL script creating relational tables and inserting all spatial and inspection records for SQLite, SpatiaLite, or PostgreSQL.</p>
              </div>
              <button id="btnExportSQL" class="btn-ex-action">Export SQLite (.sql)</button>
            </div>

            <!-- 5. JSON -->
            <div class="exchange-card">
              <div class="ex-icon">📦</div>
              <div class="ex-info">
                <h4>Raw JSON Bundle</h4>
                <p>Complete uncompressed JSON archive containing project manifest, active centerlines, design features, and inspections.</p>
              </div>
              <button id="btnExportJSON" class="btn-ex-action">Export JSON</button>
            </div>

            <!-- 6. Import Backup -->
            <div class="exchange-card ex-card-import">
              <div class="ex-icon">📥</div>
              <div class="ex-info">
                <h4>Import Field Inspections</h4>
                <p>Restore or merge field inspection records from a previously exported JSON backup or multi-device dump.</p>
              </div>
              <label class="btn-ex-action btn-ex-upload">
                <span>Select JSON Backup</span>
                <input type="file" id="inputImportBackup" accept=".json" style="display:none;">
              </label>
            </div>
          </div>
        </div>
      `;

      this._bindEvents();
    }

    _bindEvents() {
      document.getElementById('btnExportGeoJSON').addEventListener('click', () => this.exportGeoJSON());
      document.getElementById('btnExportCSV').addEventListener('click', () => this.exportCSV());
      document.getElementById('btnExportXLSX').addEventListener('click', () => this.exportXLSX());
      document.getElementById('btnExportSQL').addEventListener('click', () => this.exportSQL());
      document.getElementById('btnExportJSON').addEventListener('click', () => this.exportJSON());

      const fileInput = document.getElementById('inputImportBackup');
      fileInput.addEventListener('change', e => this.importJSON(e));
    }

    _getExportPayload() {
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      const feats = window.getActiveFeatures ? window.getActiveFeatures() : [];
      const inspections = (window.appState && window.appState.inspections) || {};

      return {
        section: activeSection,
        timestamp: new Date().toISOString(),
        features: feats.map(f => {
          const p = Object.assign({}, f.properties);
          const insp = inspections[p.id] || {};
          p.live_status = insp.status || 'Not Started';
          p.live_notes = insp.notes || '';
          p.live_has_defect = !!insp.hasDefect;
          p.live_inspection_date = insp.date || insp.updated_at || '';
          p.live_inspected_by = insp.inspected_by || '';
          return Object.assign({}, f, { properties: p });
        })
      };
    }

    _downloadFile(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast(`Exported ${filename}`);
    }

    buildGeoJSON() {
      const data = this._getExportPayload();
      return {
        type: 'FeatureCollection',
        metadata: {
          project: 'Kano–Maradi–Dutse Railway Project',
          section: data.section,
          exported_at: data.timestamp,
          total_features: data.features.length
        },
        features: data.features
      };
    }

    exportGeoJSON() {
      const geojson = this.buildGeoJSON();
      const jsonStr = JSON.stringify(geojson, null, 2);
      this._downloadFile(jsonStr, `KMD_Drainage_Section_${geojson.metadata.section}_${new Date().toISOString().split('T')[0]}.geojson`, 'application/geo+json');
    }

    buildCSV() {
      const data = this._getExportPayload();
      const headers = [
        'ID', 'Category', 'Typology', 'Short_Code', 'Chainage_Str', 'Start_PK', 'End_PK',
        'Length_M', 'Side', 'Drawing_Ref', 'Specs', 'Status', 'Has_Defect', 'Inspection_Date', 'Inspected_By', 'Notes'
      ];

      const rows = [headers.join(',')];

      data.features.forEach(f => {
        const p = f.properties;
        const row = [
          p.id,
          `"${(p.category || '').replace(/"/g, '""')}"`,
          `"${(p.typology || '').replace(/"/g, '""')}"`,
          `"${(p.short_code || '').replace(/"/g, '""')}"`,
          `"${(p.chainage_str || '').replace(/"/g, '""')}"`,
          p.start_pk || '',
          p.end_pk || '',
          p.length_m || '',
          p.side || '',
          `"${(p.drawing_ref || '').replace(/"/g, '""')}"`,
          `"${(p.specs || '').replace(/"/g, '""')}"`,
          `"${p.live_status || 'Not Started'}"`,
          p.live_has_defect ? 'YES' : 'NO',
          `"${p.live_inspection_date || ''}"`,
          `"${(p.live_inspected_by || '').replace(/"/g, '""')}"`,
          `"${(p.live_notes || '').replace(/"/g, '""')}"`
        ];
        rows.push(row.join(','));
      });

      return rows.join('\r\n');
    }

    exportCSV() {
      const csv = this.buildCSV();
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      this._downloadFile(csv, `KMD_Drainage_Schedule_Section_${activeSection}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    }

    buildJSON() {
      const data = this._getExportPayload();
      return {
        project: 'Kano–Maradi–Dutse Railway Project',
        exported_at: data.timestamp,
        section: data.section,
        features: data.features,
        inspections: (window.appState && window.appState.inspections) || {}
      };
    }

    exportJSON() {
      const bundle = this.buildJSON();
      this._downloadFile(JSON.stringify(bundle, null, 2), `KMD_Drainage_Bundle_${bundle.section}_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    }

    buildSQL() {
      const data = this._getExportPayload();
      let sql = `-- ==========================================================================\n`;
      sql += `-- KANO–MARADI–DUTSE RAILWAY PROJECT\n`;
      sql += `-- Drainage Asset & Field Inspection Relational Database Dump (SQLite / PostgreSQL)\n`;
      sql += `-- Generated: ${data.timestamp}\n`;
      sql += `-- ==========================================================================\n\n`;

      sql += `CREATE TABLE IF NOT EXISTS kmd_drainage_assets (\n`;
      sql += `  asset_id TEXT PRIMARY KEY,\n`;
      sql += `  category TEXT NOT NULL,\n`;
      sql += `  typology TEXT NOT NULL,\n`;
      sql += `  short_code TEXT,\n`;
      sql += `  chainage_str TEXT NOT NULL,\n`;
      sql += `  start_pk REAL NOT NULL,\n`;
      sql += `  end_pk REAL NOT NULL,\n`;
      sql += `  length_m REAL,\n`;
      sql += `  side TEXT,\n`;
      sql += `  drawing_ref TEXT,\n`;
      sql += `  specs TEXT,\n`;
      sql += `  is_point INTEGER DEFAULT 0\n`;
      sql += `);\n\n`;

      sql += `CREATE TABLE IF NOT EXISTS kmd_inspections (\n`;
      sql += `  asset_id TEXT PRIMARY KEY,\n`;
      sql += `  status TEXT NOT NULL,\n`;
      sql += `  notes TEXT,\n`;
      sql += `  has_defect INTEGER DEFAULT 0,\n`;
      sql += `  inspection_date TEXT,\n`;
      sql += `  inspected_by TEXT,\n`;
      sql += `  updated_at TEXT,\n`;
      sql += `  FOREIGN KEY (asset_id) REFERENCES kmd_drainage_assets (asset_id)\n`;
      sql += `);\n\n`;

      sql += `BEGIN TRANSACTION;\n`;

      data.features.forEach(f => {
        const p = f.properties;
        const esc = s => (s ? `'${s.replace(/'/g, "''")}'` : 'NULL');

        sql += `INSERT OR REPLACE INTO kmd_drainage_assets VALUES (${esc(p.id)}, ${esc(p.category)}, ${esc(p.typology)}, ${esc(p.short_code)}, ${esc(p.chainage_str)}, ${p.start_pk || 0}, ${p.end_pk || 0}, ${p.length_m || 0}, ${esc(p.side)}, ${esc(p.drawing_ref)}, ${esc(p.specs)}, ${p.is_point ? 1 : 0});\n`;

        if (p.live_status && p.live_status !== 'Not Started') {
          sql += `INSERT OR REPLACE INTO kmd_inspections VALUES (${esc(p.id)}, ${esc(p.live_status)}, ${esc(p.live_notes)}, ${p.live_has_defect ? 1 : 0}, ${esc(p.live_inspection_date)}, ${esc(p.live_inspected_by)}, ${esc(data.timestamp)});\n`;
        }
      });

      sql += `COMMIT;\n`;
      return sql;
    }

    exportSQL() {
      const sql = this.buildSQL();
      const activeSection = (window.appState && window.appState.activeSection) || 'all';
      this._downloadFile(sql, `kmd_drainage_database_${activeSection}_${new Date().toISOString().split('T')[0]}.sql`, 'application/sql');
    }

    exportXLSX() {
      if (typeof XLSX === 'undefined') {
        alert('SheetJS library is loading. Please retry in a moment.');
        return;
      }

      const data = this._getExportPayload();
      const wb = XLSX.utils.book_new();

      // Sheet 1: Overview
      const overviewRows = [
        ['Project', 'Kano–Maradi–Dutse Railway Project'],
        ['Consultant', 'T.E.A.M. Nig. Ltd.'],
        ['Main Contractor', 'MOTA-ENGIL'],
        ['Corridor Section', data.section === 'all' ? 'All (Section 02 + Section 03)' : `Section ${data.section}`],
        ['Export Date', data.timestamp],
        ['Total Features', data.features.length]
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Corridor Overview');

      // Helper to build tabular sheet
      const makeSheet = filterFn => {
        const items = data.features.filter(filterFn).map(f => {
          const p = f.properties;
          return {
            'Asset ID': p.id,
            'Category': p.category,
            'Typology': p.typology,
            'Code': p.short_code,
            'Chainage': p.chainage_str,
            'Side': p.side,
            'Length (m)': p.length_m,
            'Drawing Ref': p.drawing_ref,
            'Status': p.live_status || 'Not Started',
            'Defect': p.live_has_defect ? 'YES' : 'NO',
            'Inspection Date': p.live_inspection_date || '',
            'Inspector': p.live_inspected_by || '',
            'Punchlist Notes': p.live_notes || ''
          };
        });
        return XLSX.utils.json_to_sheet(items);
      };

      // Sheet 2: Cross Drainage Culverts
      const wsCulverts = makeSheet(f => f.properties.category === 'Cross Drainage');
      XLSX.utils.book_append_sheet(wb, wsCulverts, 'Cross Drainage Culverts');

      // Sheet 3: Longitudinal Ditches
      const wsDitches = makeSheet(f => f.properties.category === 'Toe Ditch' || f.properties.category === 'Berm Ditch' || f.properties.category === 'Shoulder / Cascade');
      XLSX.utils.book_append_sheet(wb, wsDitches, 'Longitudinal Ditches');

      // Sheet 4: Water Descents & Riprap
      const wsChutes = makeSheet(f => f.properties.category === 'Water Descent' || f.properties.category === 'Riprap Protection');
      XLSX.utils.book_append_sheet(wb, wsChutes, 'Descent & Scour Armor');

      // Sheet 5: Completed & Ongoing Inspections
      const wsInspections = makeSheet(f => f.properties.live_status && f.properties.live_status !== 'Not Started');
      XLSX.utils.book_append_sheet(wb, wsInspections, 'Field Progress Log');

      XLSX.writeFile(wb, `KMD_Drainage_Inspection_Workbook_${data.section}_${new Date().toISOString().split('T')[0]}.xlsx`);
      if (window.showToast) window.showToast('Exported Excel Workbook (.xlsx)');
    }

    importJSON(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const incomingInspections = parsed.inspections || {};
          let count = 0;

          if (window.appState) {
            window.appState.inspections = Object.assign({}, window.appState.inspections, incomingInspections);
            if (window.saveInspectionsToStorage) window.saveInspectionsToStorage();
            if (window.updateProgressHUD) window.updateProgressHUD();
            if (window.cadViewer) window.cadViewer.render();
            if (window.renderAssets) window.renderAssets();
            count = Object.keys(incomingInspections).length;
          }

          alert(`Successfully imported ${count} inspection records from backup!`);
        } catch (err) {
          alert(`Failed to parse backup JSON file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  }

  window.DataExchange = DataExchange;
})();
