(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ExportEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  class ExportEngine {
    constructor(dataStore) {
      this.dataStore = dataStore;
    }

    _escapeCSV(val) {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    _getSessionRecords(session) {
      const allRecords = this.dataStore.getAllFieldRecords();
      return allRecords.filter(r => 
        r.created_at >= session.started_at && 
        (!session.ended_at || r.created_at <= session.ended_at) &&
        !r.voided_by_record_id
      ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    exportCSV(session) {
      const records = this._getSessionRecords(session);
      
      const headers = [
        'record_id', 'timestamp', 'feature_id', 'feature_type', 'feature_name', 
        'chainage', 'side', 'kind', 'stage', 'verdict_vs_claim', 
        'defect_type', 'defect_severity', 'notes', 'author', 'device_id', 'sync_state'
      ];

      let csv = headers.join(',') + '\n';

      records.forEach(r => {
        const feat = r.feature_id ? this.dataStore.getFeatureById(r.feature_id) : null;
        const row = [
          r.record_id,
          r.created_at,
          r.feature_id || '',
          feat ? feat.type_code : '',
          feat ? (feat.name || '') : '',
          feat ? feat.ch_start : '',
          feat ? feat.side : '',
          r.kind,
          r.stage || '',
          r.verdict_vs_claim || '',
          r.payload && r.payload.defect_type ? r.payload.defect_type : '',
          r.payload && r.payload.severity ? r.payload.severity : '',
          r.payload && r.payload.notes ? r.payload.notes : '',
          r.author,
          r.device_id,
          r.sync_state
        ];
        csv += row.map(val => this._escapeCSV(val)).join(',') + '\n';
      });

      return csv;
    }

    exportProvenance(session) {
      const records = this._getSessionRecords(session);
      const featureIds = new Set(records.map(r => r.feature_id).filter(id => id));
      
      const features_referenced = [];
      const design_versions_cited = [];
      const designVersionIds = new Set();

      featureIds.forEach(fid => {
        const feat = this.dataStore.getFeatureById(fid);
        if (feat) {
          features_referenced.push(feat);
          if (feat.design_version_id && !designVersionIds.has(feat.design_version_id)) {
            designVersionIds.add(feat.design_version_id);
            const v = this.dataStore.getDesignVersion(feat.design_version_id);
            if (v) design_versions_cited.push(v);
          }
        }
      });

      return {
        session: session,
        records: records,
        features_referenced: features_referenced,
        design_versions_cited: design_versions_cited,
        export_metadata: {
          exported_at: new Date().toISOString(),
          app_version: '2.0.0',
          device_id: records.length > 0 ? records[0].device_id : 'unknown'
        }
      };
    }

    _formatChainage(ch) {
      if (typeof ch !== 'number') return 'Unknown';
      const km = Math.floor(ch / 1000);
      const m = Math.floor(ch % 1000).toString().padStart(3, '0');
      return `PK ${km}+${m}`;
    }

    exportDailyReport(session) {
      const records = this._getSessionRecords(session);
      const features = new Set(records.map(r => r.feature_id).filter(Boolean));
      
      const dateStr = session.started_at ? new Date(session.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Unknown Date';
      const author = records.length > 0 ? records[0].author : 'Engr. Abdulaziz A. A.';

      let chStart = session.ch_start ? this._formatChainage(session.ch_start) : 'Unknown';
      let chEnd = session.ch_end ? this._formatChainage(session.ch_end) : 'Unknown';

      let md = `# DAILY SITE REPORT -- DRAINAGE WORKS\n\n`;
      md += `**Project:** Kano-Maradi-Dutse Railway Project\n`;
      md += `**Employer / Consultant:** T.E.A.M. Nig. Ltd.\n`;
      md += `**Contractor:** MOTA-ENGIL (Main Contractor)\n`;
      md += `**Date:** ${dateStr}\n`;
      md += `**Report Reference:** ${new Date().toISOString().split('T')[0]}_DailySiteReport_DrainageWorks\n`;
      md += `**Location / Section:** ${chStart} to ${chEnd}\n`;
      md += `**Author:** ${author}\n\n`;

      md += `## Section 1: Summary of Inspected Locations\n\n`;
      md += `| Chainage | Structure / Feature | Activity / Scope | Applicable Drawing |\n`;
      md += `|:---|:---|:---|:---|\n`;

      const featureMap = new Map();
      
      records.forEach(r => {
        if (!r.feature_id) return;
        let fdata = featureMap.get(r.feature_id);
        if (!fdata) {
          const feat = this.dataStore.getFeatureById(r.feature_id);
          if (feat) {
            fdata = { feat, records: [] };
            featureMap.set(r.feature_id, fdata);
          }
        }
        if (fdata) {
          fdata.records.push(r);
        }
      });

      const sortedFeatures = Array.from(featureMap.values()).sort((a, b) => a.feat.ch_start - b.feat.ch_start);

      sortedFeatures.forEach(fdata => {
        const feat = fdata.feat;
        const ch = this._formatChainage(feat.ch_start);
        const structure = `${feat.type_code || ''} ${feat.name || ''}`.trim();
        
        let activities = [];
        let drawings = feat.drawing_ref || 'Standard';

        fdata.records.forEach(r => {
          if (r.kind === 'stage') activities.push(`Stage updated to ${r.stage}`);
          if (r.kind === 'defect') activities.push(`Defect logged: ${r.payload.defect_type || 'General'}`);
          if (r.kind === 'note') activities.push(`Note added`);
        });

        activities = [...new Set(activities)].join(', ');

        md += `| ${ch} | ${structure} | ${activities} | ${drawings} |\n`;
      });

      md += `\n## Section 2: Description of Site Activities and Observations\n\n`;

      sortedFeatures.forEach(fdata => {
        const feat = fdata.feat;
        const ch = this._formatChainage(feat.ch_start);
        
        md += `### 2.1 ${ch} -- ${feat.name || feat.type_code}\n\n`;
        
        fdata.records.forEach(r => {
          if (r.kind === 'stage') {
            md += `- **Progress:** Confirmed structure is at stage "${r.stage}".\n`;
          } else if (r.kind === 'defect') {
            md += `- **Defect (${r.payload.severity || 'Normal'}):** ${r.payload.defect_type || ''} - ${r.payload.notes || ''}\n`;
          } else if (r.kind === 'note') {
            md += `- **Observation:** ${r.payload.notes || ''}\n`;
          }
        });
        
        const photos = fdata.records.filter(r => r.kind === 'photo');
        if (photos.length > 0) {
          md += `- **Photos:** ${photos.length} site photos captured.\n`;
        }
        md += `\n`;
      });

      return md;
    }

    downloadFile(content, filename, mimeType) {
      if (typeof document === 'undefined') return;
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    }
  }

  return ExportEngine;
}));
