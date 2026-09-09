/**
 * KMD DRAINAGE FIELD INSPECTOR — OFFLINE-FIRST SYNC ENGINE
 * Two-way Supabase Synchronization with Last-Write-Wins Conflict Resolution
 */

(function () {
  'use strict';

  const STORAGE_KEY_QUEUE = 'KMD_SYNC_PENDING_QUEUE_V1';
  const STORAGE_KEY_LAST_SYNC = 'KMD_SYNC_LAST_TIMESTAMP_V1';
  const STORAGE_KEY_DEVICE_ID = 'KMD_SYNC_DEVICE_ID_V1';

  // State
  const syncState = {
    status: 'idle', // 'idle', 'syncing', 'synced', 'pending', 'offline', 'error'
    pendingQueue: [],
    lastSyncTime: null,
    isSyncing: false,
    errorMessage: ''
  };
  window.syncState = syncState;

  // 1. Device ID Management
  function getDeviceId() {
    let devId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, devId);
    }
    return devId;
  }

  // 2. Pending Queue Management
  function loadPendingQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
      syncState.pendingQueue = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Error reading pending queue:', e);
      syncState.pendingQueue = [];
    }
    return syncState.pendingQueue;
  }

  function savePendingQueue() {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(syncState.pendingQueue));
    } catch (e) {
      console.error('Error saving pending queue:', e);
    }
  }

  function queueAssetForSync(assetId) {
    if (!syncState.pendingQueue.includes(assetId)) {
      syncState.pendingQueue.push(assetId);
      savePendingQueue();
    }
    updateSyncUI();
    // If online, debounce trigger auto-push
    if (navigator.onLine && window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) {
      debounceSync(1200);
    }
  }

  function dequeueAssets(assetIds) {
    syncState.pendingQueue = syncState.pendingQueue.filter(id => !assetIds.includes(id));
    savePendingQueue();
    updateSyncUI();
  }

  // 3. Last Sync Time Management
  function loadLastSyncTime() {
    syncState.lastSyncTime = localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null;
    return syncState.lastSyncTime;
  }

  function saveLastSyncTime(isoStr) {
    syncState.lastSyncTime = isoStr;
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, isoStr);
  }

  // 4. Supabase Network Calls
  async function pushPendingToCloud() {
    const config = window.APP_CONFIG;
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
      console.warn('Sync Push aborted: Missing Supabase credentials.');
      return false;
    }

    loadPendingQueue();
    if (syncState.pendingQueue.length === 0) {
      return true; // Nothing to push
    }

    const state = window.appState;
    if (!state || !state.inspections) return false;

    const idsToPush = [...syncState.pendingQueue];
    const payload = idsToPush.map(id => {
      const insp = state.inspections[id] || {};
      return {
        asset_id: id,
        status: insp.status || 'Not Started',
        notes: insp.notes || '',
        has_defect: !!insp.hasDefect,
        inspection_date: insp.date || '',
        inspected_by: insp.inspected_by || config.inspectorName || 'Field Engineer',
        device_id: getDeviceId(),
        updated_at: insp.updated_at || new Date().toISOString()
      };
    });

    const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/inspections`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloud push failed [HTTP ${response.status}]: ${errText}`);
    }

    dequeueAssets(idsToPush);
    return true;
  }

  async function pullLatestFromCloud() {
    const config = window.APP_CONFIG;
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
      return false;
    }

    const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/inspections?select=*`;
    const response = await fetch(url, {
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloud pull failed [HTTP ${response.status}]: ${errText}`);
    }

    const cloudRecords = await response.json();
    if (!Array.isArray(cloudRecords)) return false;

    const state = window.appState;
    if (!state) return false;

    let hasLocalChanges = false;
    loadPendingQueue();

    cloudRecords.forEach(cr => {
      const aid = cr.asset_id;
      if (!aid) return;

      const localInsp = state.inspections[aid];
      const isPendingLocal = syncState.pendingQueue.includes(aid);

      if (!localInsp) {
        // Record doesn't exist locally: accept cloud record
        state.inspections[aid] = {
          status: cr.status || 'Not Started',
          notes: cr.notes || '',
          hasDefect: !!cr.has_defect,
          date: cr.inspection_date || '',
          inspected_by: cr.inspected_by || '',
          updated_at: cr.updated_at
        };
        hasLocalChanges = true;
      } else if (isPendingLocal) {
        // Local has unsynced changes. Last-Write-Wins based on updated_at
        const localTime = new Date(localInsp.updated_at || 0).getTime();
        const cloudTime = new Date(cr.updated_at || 0).getTime();

        if (cloudTime > localTime) {
          // Cloud is newer: adopt cloud record and remove from pending queue
          state.inspections[aid] = {
            status: cr.status || 'Not Started',
            notes: cr.notes || '',
            hasDefect: !!cr.has_defect,
            date: cr.inspection_date || '',
            inspected_by: cr.inspected_by || '',
            updated_at: cr.updated_at
          };
          dequeueAssets([aid]);
          hasLocalChanges = true;
        }
      } else {
        // Local is clean (no pending changes): adopt cloud if newer or different
        const localTime = new Date(localInsp.updated_at || 0).getTime();
        const cloudTime = new Date(cr.updated_at || 0).getTime();

        if (cloudTime >= localTime && (localInsp.status !== cr.status || localInsp.notes !== cr.notes || localInsp.hasDefect !== cr.has_defect)) {
          state.inspections[aid] = {
            status: cr.status || 'Not Started',
            notes: cr.notes || '',
            hasDefect: !!cr.has_defect,
            date: cr.inspection_date || '',
            inspected_by: cr.inspected_by || '',
            updated_at: cr.updated_at
          };
          hasLocalChanges = true;
        }
      }
    });

    if (hasLocalChanges) {
      // Save merged inspections locally partitioned by section
      const s03 = {};
      const s02 = {};
      for (const [id, val] of Object.entries(state.inspections)) {
        if (id.startsWith('s02_')) {
          s02[id] = val;
        } else {
          s03[id] = val;
        }
      }
      localStorage.setItem('KMD_DRAINAGE_INSPECTIONS_SEC03_V1', JSON.stringify(s03));
      localStorage.setItem('KMD_DRAINAGE_INSPECTIONS_SEC02_V1', JSON.stringify(s02));
      if (typeof window.onExternalInspectionsUpdated === 'function') {
        window.onExternalInspectionsUpdated();
      }
    }

    saveLastSyncTime(new Date().toISOString());
    return true;
  }

  // 5. Complete Two-Way Sync Routine
  async function syncNow(isUserInitiated = false) {
    if (!navigator.onLine) {
      syncState.status = 'offline';
      updateSyncUI();
      if (isUserInitiated && window.showToast) {
        window.showToast('Offline: Working from local storage.');
      }
      return;
    }

    const config = window.APP_CONFIG;
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
      syncState.status = 'unconfigured';
      updateSyncUI();
      if (isUserInitiated && window.showToast) {
        window.showToast('Cloud database not configured. Open Cloud Settings.');
      }
      return;
    }

    if (syncState.isSyncing) return;
    syncState.isSyncing = true;
    syncState.status = 'syncing';
    updateSyncUI();

    try {
      // 1. Push local changes
      await pushPendingToCloud();
      // 2. Pull latest cloud changes
      await pullLatestFromCloud();

      loadPendingQueue();
      syncState.status = syncState.pendingQueue.length > 0 ? 'pending' : 'synced';
      syncState.errorMessage = '';
      if (isUserInitiated && window.showToast) {
        window.showToast('Cloud Sync Complete: Up to date.');
      }
    } catch (err) {
      console.error('Cloud Sync Error:', err);
      syncState.status = 'error';
      syncState.errorMessage = err.message || 'Sync failed';
      if (isUserInitiated && window.showToast) {
        window.showToast(`Sync Error: ${err.message || 'Check network'}`);
      }
    } finally {
      syncState.isSyncing = false;
      updateSyncUI();
    }
  }

  // Debounced sync helper
  let debounceTimer = null;
  function debounceSync(ms = 1000) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncNow(false);
    }, ms);
  }

  // 6. UI Status Updater
  function updateSyncUI() {
    const elBtn = document.getElementById('btnSyncStatus');
    const elDot = document.getElementById('syncDot');
    const elText = document.getElementById('syncText');
    const elIcon = document.getElementById('syncIcon');

    if (!elBtn) return;

    loadPendingQueue();
    const count = syncState.pendingQueue.length;

    if (!navigator.onLine) {
      elBtn.className = 'btn-sync-pill status-offline';
      if (elText) elText.textContent = count > 0 ? `${count} Pending (Offline)` : 'Offline';
      if (elDot) elDot.style.backgroundColor = '#94A3B8';
      elBtn.title = 'Offline mode: Changes saved locally.';
      return;
    }

    if (syncState.status === 'syncing') {
      elBtn.className = 'btn-sync-pill status-syncing';
      if (elText) elText.textContent = 'Syncing...';
      if (elDot) elDot.style.backgroundColor = '#38BDF8';
      elBtn.title = 'Syncing changes with cloud...';
    } else if (syncState.status === 'error') {
      elBtn.className = 'btn-sync-pill status-error';
      if (elText) elText.textContent = count > 0 ? `${count} Pending (Error)` : 'Sync Error';
      if (elDot) elDot.style.backgroundColor = '#EF4444';
      elBtn.title = syncState.errorMessage || 'Cloud sync error. Tap to retry.';
    } else if (count > 0) {
      elBtn.className = 'btn-sync-pill status-pending';
      if (elText) elText.textContent = `${count} Pending`;
      if (elDot) elDot.style.backgroundColor = '#F59E0B';
      elBtn.title = `${count} offline changes waiting to sync. Tap to sync.`;
    } else {
      elBtn.className = 'btn-sync-pill status-synced';
      const timeStr = syncState.lastSyncTime
        ? new Date(syncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Ready';
      if (elText) elText.textContent = `Synced ${timeStr}`;
      if (elDot) elDot.style.backgroundColor = '#10B981';
      elBtn.title = `Cloud synchronized. Last sync: ${syncState.lastSyncTime || 'Just now'}. Tap to sync.`;
    }
  }

  // 7. Event Listeners & Periodic Sync
  window.addEventListener('online', () => {
    updateSyncUI();
    if (window.APP_CONFIG && window.APP_CONFIG.autoSyncOnOnline) {
      syncNow(false);
    }
  });

  window.addEventListener('offline', () => {
    updateSyncUI();
  });

  document.addEventListener('DOMContentLoaded', () => {
    loadPendingQueue();
    loadLastSyncTime();
    updateSyncUI();

    // Initial sync on app open if online
    if (navigator.onLine && window.APP_CONFIG && window.APP_CONFIG.supabaseUrl) {
      setTimeout(() => syncNow(false), 800);
    }

    // Periodic sync interval (default 60s)
    const intervalMs = (window.APP_CONFIG && window.APP_CONFIG.syncIntervalMs) || 60000;
    setInterval(() => {
      if (navigator.onLine && !syncState.isSyncing) {
        syncNow(false);
      }
    }, intervalMs);
  });

  // Expose API
  window.syncEngine = {
    syncNow: () => syncNow(true),
    queueAssetForSync,
    getPendingCount: () => syncState.pendingQueue.length,
    updateUI: updateSyncUI,
    getDeviceId
  };
})();
