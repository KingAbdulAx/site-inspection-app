(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./export_engine'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./export_engine'));
  } else {
    root.DayView = factory(root.ExportEngine);
  }
}(typeof self !== 'undefined' ? self : this, function(ExportEngine) {
  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  class DayView {
    constructor(container, dataStore) {
      this.container = container;
      this.dataStore = dataStore;
      this.exportEngine = new ExportEngine(dataStore);
      this.activeSession = null;
      
      this._loadSession();
      this._setupDOM();
      this._bindEvents();
    }

    _loadSession() {
      // Mock localStorage for node environments during testing if necessary
      const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
      const stored = ls.getItem('KMD_V2_SESSIONS');
      if (stored) {
        try {
          const sessions = JSON.parse(stored);
          if (sessions && sessions.length > 0) {
            const lastSession = sessions[sessions.length - 1];
            if (lastSession && !lastSession.ended_at) {
              const lastActive = new Date(lastSession.last_active_at || lastSession.started_at).getTime();
              if (Date.now() - lastActive > 30 * 60 * 1000) {
                lastSession.ended_at = new Date().toISOString();
                this._saveSessions(sessions);
              } else {
                this.activeSession = lastSession;
              }
            }
          }
        } catch (e) {
          console.error('Error loading sessions', e);
        }
      }
    }

    _saveSessions(sessions) {
      const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
      ls.setItem('KMD_V2_SESSIONS', JSON.stringify(sessions));
    }

    _updateSession(record) {
      const now = new Date().toISOString();
      let sessions = [];
      const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
      const stored = ls.getItem('KMD_V2_SESSIONS');
      if (stored) {
        try {
          sessions = JSON.parse(stored);
        } catch(e) {}
      }

      if (!this.activeSession) {
        this.activeSession = {
          session_id: root.DataModel ? root.DataModel.generateUUIDv7() : 'sess_' + Date.now(),
          started_at: now,
          last_active_at: now,
          ended_at: null,
          line: 'Kano-Maradi',
          subsection: 'KZDR',
          ch_start: null,
          ch_end: null,
          records_count: 0,
          defects_count: 0,
          features_touched: []
        };
        sessions.push(this.activeSession);
      } else {
        const idx = sessions.findIndex(s => s.session_id === this.activeSession.session_id);
        if (idx !== -1) {
          sessions[idx] = this.activeSession;
        } else {
          sessions.push(this.activeSession);
        }
      }

      this.activeSession.last_active_at = now;
      this.activeSession.records_count++;
      if (record.kind === 'defect') {
        this.activeSession.defects_count++;
      }

      if (record.feature_id && !this.activeSession.features_touched.includes(record.feature_id)) {
        this.activeSession.features_touched.push(record.feature_id);
      }

      if (record.feature_id && this.dataStore) {
        const feat = this.dataStore.getFeatureById(record.feature_id);
        if (feat && feat.ch_start !== undefined && feat.ch_start !== null) {
          if (this.activeSession.ch_start === null || feat.ch_start < this.activeSession.ch_start) {
            this.activeSession.ch_start = feat.ch_start;
          }
          if (this.activeSession.ch_end === null || feat.ch_start > this.activeSession.ch_end) {
            this.activeSession.ch_end = feat.ch_start;
          }
        }
      }

      this._saveSessions(sessions);
    }

    endWalk() {
      if (this.activeSession) {
        this.activeSession.ended_at = new Date().toISOString();
        const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
        const stored = ls.getItem('KMD_V2_SESSIONS');
        if (stored) {
          try {
            const sessions = JSON.parse(stored);
            const idx = sessions.findIndex(s => s.session_id === this.activeSession.session_id);
            if (idx !== -1) {
              sessions[idx] = this.activeSession;
              this._saveSessions(sessions);
            }
          } catch(e) {}
        }
        this.activeSession = null;
        this.refresh();
      }
    }

    _setupDOM() {
      if (!this.container) return;
      this.container.innerHTML = `
        <div class="day-view-inner" style="padding: 16px; padding-bottom: 80px; overflow-y: auto; height: 100%;">
          <div class="di-card day-summary-card" style="margin-bottom: 24px;">
            <div id="daySummaryContent"></div>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <button type="button" class="di-btn--secondary" id="btnExportDay">Export</button>
              <button type="button" class="di-btn--primary" id="btnEndWalk">End Walk</button>
            </div>
          </div>
          <div class="day-timeline" id="dayTimeline"></div>
        </div>
      `;

      this.container.querySelector('#btnEndWalk').addEventListener('click', () => {
        this.endWalk();
      });

      this.container.querySelector('#btnExportDay').addEventListener('click', () => {
        if (!this.activeSession) return;
        const csv = this.exportEngine.exportCSV(this.activeSession);
        this.exportEngine.downloadFile(csv, `export_${this.activeSession.session_id}.csv`, 'text/csv');
      });
    }

    _bindEvents() {
      if (typeof window !== 'undefined') {
        window.addEventListener('kmd:record-saved', (e) => {
          if (e.detail && e.detail.record) {
            this._updateSession(e.detail.record);
            if (this.container && this.container.style.display !== 'none') {
              this.refresh();
            }
          }
        });
      }
    }

    show() {
      if (this.container) {
        this.container.style.display = 'block';
        this.refresh();
      }
    }

    hide() {
      if (this.container) {
        this.container.style.display = 'none';
      }
    }

    _formatTime(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    refresh() {
      if (!this.container) return;
      const summaryContent = this.container.querySelector('#daySummaryContent');
      const timeline = this.container.querySelector('#dayTimeline');

      if (!this.activeSession) {
        summaryContent.innerHTML = '<h3>No Active Session</h3><p>Start logging to create a new session.</p>';
        timeline.innerHTML = '<p style="color: var(--text-muted);">No records yet. Walk to a feature and tap the stage button to start logging.</p>';
        return;
      }

      const d = new Date(this.activeSession.started_at);
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const formatChainage = (ch) => {
        if (ch === null || ch === undefined) return 'Unknown';
        const km = Math.floor(ch / 1000);
        const m = Math.floor(ch % 1000).toString().padStart(3, '0');
        return `PK ${km}+${m}`;
      };

      const chRange = (this.activeSession.ch_start !== null && this.activeSession.ch_end !== null) 
        ? `${formatChainage(this.activeSession.ch_start)} to ${formatChainage(this.activeSession.ch_end)}`
        : 'No location data';

      const conflictsCount = (this.dataStore && typeof this.dataStore.getConflicts === 'function') ? this.dataStore.getConflicts('open').length : 0;
      
      summaryContent.innerHTML = `
        <h3 style="margin-top:0;">${dateStr}, ${timeStr}</h3>
        <p style="color: var(--text-muted); margin-bottom: 8px;">${chRange}</p>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${this.activeSession.line} / ${this.activeSession.subsection}</p>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div><strong>${this.activeSession.features_touched.length}</strong> features checked</div>
          <div><strong>${this.activeSession.records_count}</strong> records added</div>
          <div><strong style="color:var(--defect,#C62828);">${this.activeSession.defects_count}</strong> defects raised</div>
          <div><strong style="color:var(--defect,#C62828);">${conflictsCount}</strong> conflicts</div>
        </div>
      `;

      const records = this.exportEngine._getSessionRecords(this.activeSession);
      
      if (records.length === 0) {
        timeline.innerHTML = '<p style="color: var(--text-muted);">No records yet. Walk to a feature and tap the stage button to start logging.</p>';
        return;
      }

      let html = '';
      records.forEach(r => {
        const feat = r.feature_id ? this.dataStore.getFeatureById(r.feature_id) : null;
        const time = this._formatTime(r.created_at);
        const iconSvg = (feat && root.TypeIcons && root.TypeIcons[feat.type_code]) ? root.TypeIcons[feat.type_code]() : '';
        const ch = feat ? formatChainage(feat.ch_start) : '';
        const title = feat ? `${feat.type_code} ${feat.name || ''}` : 'Unknown Feature';
        const side = feat ? feat.side : '';
        
        let desc = '';
        if (r.kind === 'stage') desc = `Stage advanced to ${r.stage}`;
        else if (r.kind === 'defect') desc = `Defect: ${r.payload && r.payload.defect_type ? r.payload.defect_type : ''}`;
        else if (r.kind === 'note') desc = `Note added`;

        html += `
          <div class="di-feature-row" style="display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; cursor: pointer;" data-feature-id="${r.feature_id}">
            <div style="width: 45px; text-align: right; color: var(--text-muted); font-size: 0.8rem; padding-top: 4px;">${time}</div>
            <div style="flex: 1; background: var(--bg-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 24px; height: 24px;">${iconSvg}</div>
                  <strong style="font-size: 0.95rem;">${title}</strong>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); background: var(--bg-body); padding: 2px 6px; border-radius: 4px;">${side}</div>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">${ch}</div>
              <div style="font-size: 0.9rem;">${desc}</div>
            </div>
          </div>
        `;
      });

      timeline.innerHTML = html;

      timeline.querySelectorAll('.di-feature-row').forEach(row => {
        row.addEventListener('click', () => {
          const fid = row.getAttribute('data-feature-id');
          if (fid && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kmd:jump-to-feature', { detail: { feature_id: fid } }));
          }
        });
      });
    }
  }

  return DayView;
}));
