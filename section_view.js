(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SectionView = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  const PROJECT_HIERARCHY = [
    {
      line: 'Line 1',
      name: 'Kano - Maradi (284.5 km)',
      subsections: [
        { code: 'KNDW', name: 'Kano (Nassarawa) - Dawanau', chainage: 'PK 0+000 to PK 19+800' },
        { code: 'DWKZ', name: 'Dawanau - Kazaure', chainage: 'PK 19+800 to PK 82+902.439' },
        { code: 'KZDR', name: 'Kazaure - Daura', chainage: 'PK 82+902.439 to PK 124+521.140' },
        { code: 'DRMR', name: 'Daura - Mashi - Rimi', chainage: 'PK 124+521.140 to ~PK 180+000' },
        { code: 'MRJB', name: 'Rimi - Jibiya (Nigeria)', chainage: 'PK ~180+000 to ~PK 230+000' },
        { code: 'JBMR', name: 'Jibiya (Nigeria) - Maradi (Niger)', chainage: 'PK ~230+000 to PK 284+500' }
      ]
    },
    {
      line: 'Line 2',
      name: 'Kano - Dutse Branch (127.5 km)',
      subsections: [
        { code: 'KNYG', name: 'Kano (Nassarawa) - Yankwashi - Gaya', chainage: 'PK 0+000 to ~PK 50+000' },
        { code: 'YGGY', name: 'Gaya - Gumel - Yanfari', chainage: 'PK ~50+000 to ~PK 100+000' },
        { code: 'GYDT', name: 'Yanfari - Dutse', chainage: 'PK ~100+000 to ~PK 127+500' }
      ]
    }
  ];

  class SectionView {
    constructor(container, dataStore) {
      this.container = container;
      this.dataStore = dataStore;
      this.activeSection = root.localStorage ? root.localStorage.getItem('KMD_V2_ACTIVE_SECTION') : null;
      this.selectedSection = null;
      this.render();
      this.refresh();
    }

    render() {
      this.container.innerHTML = `
        <div class="section-view-content">
          <div class="project-ribbon-container">
            ${PROJECT_HIERARCHY.map(line => `
              <div class="line-group">
                <h3 class="line-header">${line.name}</h3>
                <div class="thin-progress-bar line-progress"></div>
                <div class="ribbon-scroll">
                  ${line.subsections.map(sub => `
                    <div class="di-card subsection-card" data-code="${sub.code}">
                      <div class="card-header">
                        <span class="code-badge">${sub.code}</span>
                      </div>
                      <div class="card-body">
                        <div class="sub-name">${sub.name}</div>
                        <div class="sub-chainage">${sub.chainage}</div>
                        <div class="status-indicator"></div>
                        <div class="thin-progress-bar sub-progress" style="display:none;"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="subsection-detail-panel" style="display:none;"></div>
        </div>
      `;
      this.bindEvents();
    }

    bindEvents() {
      const cards = this.container.querySelectorAll('.subsection-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          this.selectSubsection(card.dataset.code);
        });
      });
    }

    _getSectionStatus(code) {
      if (!this.dataStore || !this.dataStore.subsections) return { status: 'not_extracted', count: 0 };
      
      const sub = this.dataStore.subsections[code];
      if (sub && sub.feature_count && sub.feature_count > 0) {
        const hasData = Object.values(this.dataStore.designFeatures || {}).some(f => f.section === code);
        return { 
          status: hasData ? 'on_phone' : 'available', 
          count: sub.feature_count 
        };
      }
      return { status: 'not_extracted', count: 0 };
    }

    _calculateProgress(code) {
      if (!this.dataStore) return 0;
      let total = 0;
      let withRecords = 0;

      const features = Object.values(this.dataStore.designFeatures || {}).filter(f => f.section === code);
      total = features.length;
      if (total === 0) return 0;

      features.forEach(f => {
        const obs = this.dataStore.getObservationsForFeature ? this.dataStore.getObservationsForFeature(f.feature_id) : [];
        if (obs && obs.length > 0) {
          withRecords++;
        }
      });

      return total > 0 ? Math.round((withRecords / total) * 100) : 0;
    }

    refresh() {
      const cards = this.container.querySelectorAll('.subsection-card');
      cards.forEach(card => {
        const code = card.dataset.code;
        const info = this._getSectionStatus(code);
        
        const indicator = card.querySelector('.status-indicator');
        const progressBar = card.querySelector('.sub-progress');
        
        indicator.className = 'status-indicator di-certainty';
        
        if (info.status === 'on_phone') {
          indicator.classList.add('chip-solid');
          indicator.textContent = `On Phone (${info.count})`;
          
          const progress = this._calculateProgress(code);
          progressBar.style.display = 'block';
          progressBar.style.width = `${progress}%`;
          progressBar.style.backgroundColor = 'var(--hivis)';
        } else if (info.status === 'available') {
          indicator.classList.add('chip-outline');
          indicator.textContent = 'Available - tap to download';
          progressBar.style.display = 'none';
        } else {
          indicator.classList.add('chip-muted');
          indicator.textContent = 'Not yet extracted';
          progressBar.style.display = 'none';
        }

        if (code === this.activeSection) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
      
      if (this.selectedSection) {
        this.renderDetailPanel(this.selectedSection);
      }
    }

    selectSubsection(code) {
      this.selectedSection = code;
      const cards = this.container.querySelectorAll('.subsection-card');
      cards.forEach(c => c.classList.remove('selected'));
      const card = this.container.querySelector(`.subsection-card[data-code="${code}"]`);
      if (card) card.classList.add('selected');
      
      this.renderDetailPanel(code);
    }

    renderDetailPanel(code) {
      const panel = this.container.querySelector('.subsection-detail-panel');
      const info = this._getSectionStatus(code);
      
      if (info.status === 'not_extracted') {
        panel.innerHTML = `<div class="detail-empty">Data not yet available</div>`;
        panel.style.display = 'block';
        return;
      }
      
      const features = Object.values(this.dataStore.designFeatures || {}).filter(f => f.section === code);
      const categories = {};
      let notStarted = 0, inProgress = 0, completed = 0;
      let lastDate = null;
      
      features.forEach(f => {
        const cat = (root.TYPE_CATALOGUE && root.TYPE_CATALOGUE[f.type_code]) ? root.TYPE_CATALOGUE[f.type_code].category : 'Other';
        categories[cat] = (categories[cat] || 0) + 1;
        
        const stage = this.dataStore.getLatestStage ? this.dataStore.getLatestStage(f.feature_id) : 'Not started';
        if (stage === 'Not started') notStarted++;
        else if (stage === 'Completed') completed++;
        else inProgress++;
        
        const obs = this.dataStore.getObservationsForFeature ? this.dataStore.getObservationsForFeature(f.feature_id) : [];
        obs.forEach(o => {
          if (!lastDate || new Date(o.timestamp) > new Date(lastDate)) {
            lastDate = o.timestamp;
          }
        });
      });
      
      let catHtml = Object.keys(categories).map(cat => `<div class="stat-pill"><span>${cat}</span><strong>${categories[cat]}</strong></div>`).join('');
      
      panel.innerHTML = `
        <div class="detail-stats">
          <h4>Category Breakdown</h4>
          <div class="stat-group">${catHtml}</div>
          
          <h4>Construction Progress</h4>
          <div class="stat-group">
            <div class="stat-pill"><span>Not Started</span><strong>${notStarted}</strong></div>
            <div class="stat-pill"><span>In Progress</span><strong>${inProgress}</strong></div>
            <div class="stat-pill"><span>Completed</span><strong>${completed}</strong></div>
          </div>
          
          <div class="detail-meta">
            ${lastDate ? `Last inspection: ${new Date(lastDate).toLocaleDateString()}` : 'No inspections yet'}
          </div>
          
          ${info.status === 'on_phone' ? `<button type="button" class="btn-switch-section" data-code="${code}">Switch to this section</button>` : ''}
        </div>
      `;
      
      const btn = panel.querySelector('.btn-switch-section');
      if (btn) {
        btn.addEventListener('click', () => this.switchToSection(code));
      }
      
      panel.style.display = 'block';
    }

    switchToSection(code) {
      this.activeSection = code;
      if (root.localStorage) {
        root.localStorage.setItem('KMD_V2_ACTIVE_SECTION', code);
      }
      
      let lineId = 'Line 1';
      PROJECT_HIERARCHY.forEach(line => {
        if (line.subsections.some(s => s.code === code)) {
          lineId = line.line;
        }
      });
      
      if (this.dataStore && this.dataStore.subsections && this.dataStore.subsections[code]) {
         this.dataStore.activeSection = code;
      }
      
      this.refresh();
      
      const event = new root.CustomEvent('kmd:section-changed', {
        detail: { code, line: lineId }
      });
      root.dispatchEvent(event);
    }

    show() {
      this.container.style.display = 'block';
      this.refresh();
    }

    hide() {
      this.container.style.display = 'none';
    }

    getActiveSection() {
      return this.activeSection;
    }
  }

  return SectionView;
}));
