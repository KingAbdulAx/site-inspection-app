/**
 * KMD DRAINAGE FIELD INSPECTOR — CONFIGURATION
 * Cloud Database & Inspector Settings
 */

(function () {
  'use strict';

  const STORAGE_KEY_CONFIG = 'KMD_DRAINAGE_CONFIG_OVERRIDE_V1';

  // Default hardcoded project credentials
  const DEFAULT_CONFIG = {
    supabaseUrl: 'https://jefbmllqgxofppjqxmhy.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc',
    inspectorName: 'Engr. Abdulaziz A. A.',
    syncIntervalMs: 60000,
    autoSyncOnOnline: true
  };

  // Allow user override from localStorage
  function getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_CONFIG, parsed);
      }
    } catch (e) {
      console.warn('Error reading config override:', e);
    }
    return Object.assign({}, DEFAULT_CONFIG);
  }

  function saveConfig(overrides) {
    try {
      const current = getConfig();
      const updated = Object.assign({}, current, overrides);
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
      window.APP_CONFIG = updated;
      return true;
    } catch (e) {
      console.error('Error saving config override:', e);
      return false;
    }
  }

  window.APP_CONFIG = getConfig();
  window.APP_CONFIG_SAVE = saveConfig;
})();
