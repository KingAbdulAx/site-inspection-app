(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MapView = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  class MapView {
    constructor(container, dataStore, positionEngine) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      this.dataStore = dataStore;
      this.positionEngine = positionEngine;

      this.map = null;
      this.gpsWatchId = null;
      this.layers = {
        base: null,
        alignment: null,
        features: null,
        gps: null
      };
      
      this.userGpsMarker = null;
      this.userAccuracyCircle = null;

      this._initMap();
    }

    _initMap() {
      // 1. Map Initialization
      this.map = L.map(this.container, {
        center: [12.6328, 8.3948], // Default to KMD midpoint
        zoom: 16,
        minZoom: 10,
        maxZoom: 20,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(this.map);

      // 2. Base Layers
      const esriSatelliteWash = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.5, attribution: 'Tiles &copy; Esri &mdash; Kano-Maradi Railway' }
      );
      const esriSatelliteFull = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 1.0, attribution: 'Tiles &copy; Esri' }
      );
      const osmStandard = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
        { maxZoom: 19, attribution: '&copy; OpenStreetMap' }
      );
      const esriDarkBase = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri Dark Canvas' }
      );

      // Default washed satellite
      esriSatelliteWash.addTo(this.map);

      const baseMaps = {
        'Satellite (50% wash)': esriSatelliteWash,
        'Satellite (full)': esriSatelliteFull,
        'OpenStreetMap': osmStandard,
        'Dark Canvas': esriDarkBase
      };

      // 3. Overlay Layers
      this.layers.alignment = L.layerGroup().addTo(this.map);
      this.layers.features = L.layerGroup().addTo(this.map);
      this.layers.gps = L.layerGroup().addTo(this.map);

      // 4. Custom Controls
      const overlays = {
        'Track Alignment': this.layers.alignment,
        'Drainage Features': this.layers.features,
        'Live GPS': this.layers.gps
      };

      // Add a custom control panel for layers to avoid the default one
      this._addCustomLayerControl(baseMaps, overlays);
      this._addCustomMapControls();

      // 5. Draw Alignment
      this._drawAlignment();
    }

    _addCustomLayerControl(baseMaps, overlays) {
      const LayerControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: () => {
          const div = L.DomUtil.create('div', 'custom-layer-control');
          div.style.backgroundColor = '#0F172A';
          div.style.padding = '10px';
          div.style.borderRadius = '8px';
          div.style.border = '1px solid #1E293B';
          div.style.color = '#F8FAFC';
          div.style.fontSize = '12px';
          div.style.fontFamily = 'var(--font-mono, "IBM Plex Mono", monospace)';
          
          div.innerHTML = '<strong style="display:block;margin-bottom:8px;color:#38BDF8;">BASEMAPS</strong>';
          
          Object.keys(baseMaps).forEach(name => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '4px';
            label.style.cursor = 'pointer';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'basemap';
            radio.checked = name === 'Satellite (50% wash)';
            radio.onchange = () => {
              Object.values(baseMaps).forEach(layer => this.map.removeLayer(layer));
              this.map.addLayer(baseMaps[name]);
            };
            
            label.appendChild(radio);
            label.appendChild(document.createTextNode(' ' + name));
            div.appendChild(label);
          });
          
          div.innerHTML += '<strong style="display:block;margin-top:12px;margin-bottom:8px;color:#38BDF8;">OVERLAYS</strong>';
          
          Object.keys(overlays).forEach(name => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '4px';
            label.style.cursor = 'pointer';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = true;
            chk.onchange = () => {
              if (chk.checked) this.map.addLayer(overlays[name]);
              else this.map.removeLayer(overlays[name]);
            };
            
            label.appendChild(chk);
            label.appendChild(document.createTextNode(' ' + name));
            div.appendChild(label);
          });
          
          // Stop map dragging when interacting with control
          L.DomEvent.disableClickPropagation(div);
          return div;
        }
      });
      this.map.addControl(new LayerControl());
    }

    _addCustomMapControls() {
      const MapActionsControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: () => {
          const div = L.DomUtil.create('div', 'map-actions-control');
          div.style.display = 'flex';
          div.style.flexDirection = 'column';
          div.style.gap = '8px';
          
          const btnZoomExt = document.createElement('button');
          btnZoomExt.textContent = 'Zoom to Extent';
          btnZoomExt.style.padding = '8px 12px';
          btnZoomExt.style.backgroundColor = '#1E293B';
          btnZoomExt.style.color = '#F8FAFC';
          btnZoomExt.style.border = '1px solid #334155';
          btnZoomExt.style.borderRadius = '4px';
          btnZoomExt.style.cursor = 'pointer';
          btnZoomExt.style.fontWeight = 'bold';
          btnZoomExt.onclick = () => this.zoomToExtent();
          
          const btnZoomGps = document.createElement('button');
          btnZoomGps.textContent = 'Zoom to GPS';
          btnZoomGps.style.padding = '8px 12px';
          btnZoomGps.style.backgroundColor = '#0284C7';
          btnZoomGps.style.color = '#FFFFFF';
          btnZoomGps.style.border = 'none';
          btnZoomGps.style.borderRadius = '4px';
          btnZoomGps.style.cursor = 'pointer';
          btnZoomGps.style.fontWeight = 'bold';
          btnZoomGps.onclick = () => {
             if (this.userGpsMarker) {
                 this.map.setView(this.userGpsMarker.getLatLng(), 18);
             } else {
                 this.startGpsTracking();
             }
          };
          
          const btnCache = document.createElement('button');
          btnCache.textContent = 'Cache Area';
          btnCache.style.padding = '8px 12px';
          btnCache.style.backgroundColor = '#10B981';
          btnCache.style.color = '#FFFFFF';
          btnCache.style.border = 'none';
          btnCache.style.borderRadius = '4px';
          btnCache.style.cursor = 'pointer';
          btnCache.style.fontWeight = 'bold';
          btnCache.onclick = () => this.cacheVisibleTiles();
          
          div.appendChild(btnZoomExt);
          div.appendChild(btnZoomGps);
          div.appendChild(btnCache);
          
          L.DomEvent.disableClickPropagation(div);
          return div;
        }
      });
      this.map.addControl(new MapActionsControl());
    }

    _drawAlignment() {
      if (!this.positionEngine) return;
      const align = this.positionEngine.getAlignment('line_km');
      if (!align || !align.stations || align.stations.length === 0) return;
      
      const pts = align.stations;
      const latlngs = pts.map(p => [p.lat, p.lon]);
      
      // True KML curvature rendering
      L.polyline(latlngs, { color: '#FFFFFF', weight: 6, opacity: 1.0, lineCap: 'round' }).addTo(this.layers.alignment);
      L.polyline(latlngs, { color: '#0F172A', weight: 2, opacity: 1.0, lineCap: 'round' }).addTo(this.layers.alignment);
      
      // km station markers every 1km
      const maxCh = pts[pts.length - 1].pk;
      for (let ch = 0; ch <= maxCh; ch += 1000) {
        const pt = align.projectChainageOffset(ch, 0);
        if (pt) {
          const html = `<div style="background:#0F172A;color:#FFFFFF;border:1px solid #38BDF8;padding:2px 4px;font-size:10px;border-radius:4px;white-space:nowrap;font-family:monospace;">PK ${ch/1000}+000</div>`;
          const icon = L.divIcon({ html: html, className: 'km-marker', iconSize: [60, 20], iconAnchor: [30, -5] });
          L.marker([pt.lat, pt.lon], { icon: icon }).addTo(this.layers.alignment);
          
          // Tick line
          L.circleMarker([pt.lat, pt.lon], { radius: 3, fillColor: '#FFFFFF', color: '#0F172A', weight: 1, fillOpacity: 1 }).addTo(this.layers.alignment);
        }
      }
    }

    refresh() {
      this.layers.features.clearLayers();
      
      let features = [];
      if (this.dataStore && typeof this.dataStore.getAllFeatures === 'function') {
         features = this.dataStore.getAllFeatures();
      } else if (typeof window.getActiveFeatures === 'function') {
         features = window.getActiveFeatures();
      }
      
      const align = this.positionEngine ? this.positionEngine.getAlignment('line_km') : null;
      if (!align) return;
      
      features.forEach(f => {
        const p = f.properties;
        let color = p.color || '#38BDF8';
        
        // Offset calculation
        let offsetM = 0;
        const isLeft = p.side === 'Left';
        const sign = isLeft ? 1 : -1;
        
        const lane = (p.lane || p.position || '').toLowerCase();
        if (lane.includes('shoulder')) offsetM = 5 * sign;
        else if (lane.includes('toe')) offsetM = 15 * sign;
        else if (lane.includes('crest')) offsetM = 25 * sign;
        else if (lane.includes('channel')) offsetM = 35 * sign;
        else offsetM = 5 * sign;
        
        const isCross = p.category === 'Cross Drainage' || p.category === 'Overhead Crossing' || p.category === 'Underpass';
        const isPoint = p.is_point || (p.length_m === 0) || ['Energy Dissipator', 'Water Descent', 'Manhole'].includes(p.category);
        
        const chStart = p.start_pk || p.pk;
        const chEnd = p.end_pk || chStart;
        
        if (isCross) {
             const ptL = align.projectChainageOffset(chStart, 15);
             const ptR = align.projectChainageOffset(chStart, -15);
             if (ptL && ptR) {
               const line = L.polyline([[ptL.lat, ptL.lon], [ptR.lat, ptR.lon]], { color: color, weight: 6, opacity: 0.9 });
               line.bindPopup(this._buildPopupContent(p));
               line.on('click', () => this._fireSelect(f));
               line.addTo(this.layers.features);
             }
        } else if (!isPoint && chStart !== chEnd) {
          // Longitudinal polylines
          const pts = [];
          for (let ch = chStart; ch <= chEnd; ch += 20) {
            const pt = align.projectChainageOffset(ch, offsetM);
            if (pt) pts.push([pt.lat, pt.lon]);
          }
          const ptEnd = align.projectChainageOffset(chEnd, offsetM);
          if (ptEnd) pts.push([ptEnd.lat, ptEnd.lon]);
          
          if (pts.length > 1) {
            const line = L.polyline(pts, { color: color, weight: 4, opacity: 0.8 });
            line.bindPopup(this._buildPopupContent(p));
            line.on('click', () => this._fireSelect(f));
            line.addTo(this.layers.features);
          }
        } else {
           // Point features
           const pt = align.projectChainageOffset(chStart, offsetM);
           if (pt) {
             const m = L.circleMarker([pt.lat, pt.lon], {
               radius: 6, fillColor: color, color: '#FFFFFF', weight: 2, fillOpacity: 0.9
             });
             m.bindPopup(this._buildPopupContent(p));
             m.on('click', () => this._fireSelect(f));
             m.addTo(this.layers.features);
           }
        }
      });
    }

    _buildPopupContent(p) {
      return `
        <div style="font-family:var(--font-base, 'Barlow', sans-serif); color:#0F172A; min-width:180px;">
          <h4 style="margin:0 0 4px 0;font-size:14px;">${p.short_code}</h4>
          <p style="margin:0 0 4px 0;font-size:12px;color:#475569;">${p.typology}</p>
          <p style="margin:0 0 8px 0;font-size:12px;font-family:var(--font-mono, monospace);">PK ${p.chainage_str || p.start_pk}</p>
          <button style="width:100%;padding:6px;background:#38BDF8;color:#0F172A;border:none;border-radius:4px;cursor:pointer;font-weight:bold;"
                  onclick="document.dispatchEvent(new CustomEvent('kmd:feature-selected', { detail: '${p.id}' }))">
            View Details
          </button>
        </div>
      `;
    }

    _fireSelect(feature) {
       // Direct callback to app's selection logic if available
       if (typeof window.selectAsset === 'function') {
           window.selectAsset(feature);
       }
       const ev = new CustomEvent('kmd:feature-selected', { detail: { id: feature.properties.id } });
       document.dispatchEvent(ev);
    }

    show() {
      this.container.style.display = 'block';
      if (this.map) this.map.invalidateSize();
    }

    hide() {
      this.container.style.display = 'none';
    }

    zoomToExtent() {
       if (!this.positionEngine) return;
       const align = this.positionEngine.getAlignment('line_km');
       if (align && align.stations.length > 0) {
          const pts = align.stations.map(p => [p.lat, p.lon]);
          this.map.fitBounds(L.latLngBounds(pts), { padding: [20, 20] });
       }
    }

    zoomToFeature(featureId) {
       // Optional zoom logic
    }

    startGpsTracking() {
      if (this.gpsWatchId) return;
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
         alert('Geolocation is not supported by your browser.');
         return;
      }
      
      this.gpsWatchId = navigator.geolocation.watchPosition(pos => {
         const lat = pos.coords.latitude;
         const lon = pos.coords.longitude;
         const acc = pos.coords.accuracy;
         
         this.layers.gps.clearLayers();
         this.userAccuracyCircle = L.circle([lat, lon], { 
             radius: acc, color: '#38BDF8', fillColor: '#38BDF8', fillOpacity: 0.2, weight: 1 
         }).addTo(this.layers.gps);
         
         this.userGpsMarker = L.circleMarker([lat, lon], { 
             radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#0284C7', fillOpacity: 1 
         }).addTo(this.layers.gps);
         
         this.map.setView([lat, lon]);
      }, err => {
         console.warn('GPS Error:', err);
      }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
    }

    stopGpsTracking() {
      if (this.gpsWatchId) {
        navigator.geolocation.clearWatch(this.gpsWatchId);
        this.gpsWatchId = null;
      }
      this.layers.gps.clearLayers();
      this.userGpsMarker = null;
      this.userAccuracyCircle = null;
    }

    cacheVisibleTiles() {
       const bounds = this.map.getBounds();
       
       let urls = [];
       // Zoom levels 13 to 17
       for (let z = 13; z <= 17; z++) {
          const nw = this.map.project(bounds.getNorthWest(), z);
          const se = this.map.project(bounds.getSouthEast(), z);
          
          const tileNw = nw.divideBy(256).floor();
          const tileSe = se.divideBy(256).floor();
          
          for (let x = tileNw.x; x <= tileSe.x; x++) {
             for (let y = tileNw.y; y <= tileSe.y; y++) {
                urls.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`);
             }
          }
       }
       
       if (urls.length > 500) {
          if (!confirm(`This will download ${urls.length} tiles for offline use. Proceed?`)) return;
       } else {
          alert(`Preparing to cache ${urls.length} tiles...`);
       }
       
       let loaded = 0;
       const progressDiv = document.createElement('div');
       progressDiv.style.position = 'absolute';
       progressDiv.style.bottom = '20px';
       progressDiv.style.left = '50%';
       progressDiv.style.transform = 'translateX(-50%)';
       progressDiv.style.backgroundColor = '#0F172A';
       progressDiv.style.color = '#38BDF8';
       progressDiv.style.padding = '12px 24px';
       progressDiv.style.borderRadius = '20px';
       progressDiv.style.fontWeight = 'bold';
       progressDiv.style.zIndex = '9999';
       progressDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
       progressDiv.innerText = `Caching tiles: 0 / ${urls.length}`;
       this.container.appendChild(progressDiv);
       
       const fetchNext = (index) => {
          if (index >= urls.length) {
             progressDiv.innerText = `Cache complete! (${urls.length} tiles ready offline)`;
             setTimeout(() => progressDiv.remove(), 4000);
             return;
          }
          fetch(urls[index], { mode: 'no-cors' }).then(() => {
             loaded++;
             if (loaded % 5 === 0) {
                 progressDiv.innerText = `Caching tiles: ${loaded} / ${urls.length}`;
             }
             fetchNext(index + 1);
          }).catch(() => {
             fetchNext(index + 1);
          });
       };
       
       // Process in batches of 3 to speed up
       fetchNext(0);
       if (urls.length > 1) fetchNext(1);
       if (urls.length > 2) fetchNext(2);
    }
  }

  return MapView;
}));
