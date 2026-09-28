/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Drainage Field Inspector PWA — Phase 5 Toast Notification & Undo Manager
 * 
 * Strict Constraint: NO EMOJIS in code or logs.
 * Conforms to Master Specification Section 6.3 & Section 10.
 * Pure Vanilla JavaScript (UMD: Node.js and Browser Compatible).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.ToastManager = exportsObj.ToastManager;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);
  class ToastManager {
    constructor(containerElement = null) {
      this.container = containerElement;
      this.activeToasts = new Map();
      this._idCounter = 0;
    }

    /**
     * Ensure a DOM container element exists for toast display
     */
    _ensureContainer() {
      if (this.container && typeof document !== 'undefined') return this.container;
      if (typeof document === 'undefined') return null;

      let el = document.getElementById('diToastContainer');
      if (!el) {
        el = document.createElement('div');
        el.id = 'diToastContainer';
        el.className = 'di-toast-container';
        el.style.position = 'fixed';
        el.style.bottom = '76px'; // Above 68px bottom nav + 8px margin
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.width = '100%';
        el.style.maxWidth = '390px';
        el.style.padding = '0 16px';
        el.style.boxSizing = 'border-box';
        el.style.zIndex = '300';
        el.style.pointerEvents = 'none';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.gap = '8px';
        document.body.appendChild(el);
      }
      this.container = el;
      return el;
    }

    /**
     * Show an 8-Second Undo Toast for newly logged stage observations (§6.3)
     * 
     * Spec:
     * "Saved on this phone · {stage} · {time} · {author} with a yellow Undo for 8 s.
     *  Undo writes a void record; it never hard-deletes."
     */
    showUndoToast(options = {}) {
      const toastId = 'toast_' + (++this._idCounter);
      const stageName = options.stageName || (options.feature && (options.feature.current_stage || options.feature.stage)) || 'Recorded';
      const author = options.author || 'Engr. Abdulaziz A. A.';
      const recordId = options.recordId || null;
      const previousStage = options.previousStage || 'Not Started';
      const feature = options.feature || null;
      const durationMs = typeof options.durationMs === 'number' ? options.durationMs : 8000;
      const onUndo = typeof options.onUndo === 'function' ? options.onUndo : null;
      const onDismiss = typeof options.onDismiss === 'function' ? options.onDismiss : null;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const defaultMsg = `Saved on this phone · ${stageName}`;
      const message = options.message || defaultMsg;

      const toastHandle = {
        id: toastId,
        recordId: recordId,
        previousStage: previousStage,
        feature: feature,
        durationMs: durationMs,
        startTime: Date.now(),
        isUndone: false,
        isDismissed: false,
        element: null,
        timer: null,
        animationInterval: null,
        triggerUndo: null,
        dismiss: null,
        getRemainingMs: () => Math.max(0, durationMs - (Date.now() - toastHandle.startTime))
      };

      // Undo function
      const executeUndo = () => {
        if (toastHandle.isUndone || toastHandle.isDismissed) return;
        toastHandle.isUndone = true;

        if (toastHandle.timer) clearTimeout(toastHandle.timer);
        if (toastHandle.animationInterval) clearInterval(toastHandle.animationInterval);

        if (onUndo) {
          onUndo({
            recordId: recordId,
            previousStage: previousStage,
            feature: feature,
            reason: 'Operator undo within 8s window'
          });
        }

        if (toastHandle.element) {
          const msgEl = toastHandle.element.querySelector('.di-toast__message');
          if (msgEl) msgEl.textContent = 'Undone · Record voided';
          const subEl = toastHandle.element.querySelector('.di-toast__meta');
          if (subEl) subEl.textContent = 'Observation voided non-destructively';
          const btn = toastHandle.element.querySelector('.di-toast__action');
          if (btn) btn.style.display = 'none';
          const bar = toastHandle.element.querySelector('.di-toast__progress-bar');
          if (bar) bar.style.display = 'none';

          setTimeout(() => {
            executeDismiss();
          }, 1200);
        }
      };

      // Dismiss function
      const executeDismiss = () => {
        if (toastHandle.isDismissed) return;
        toastHandle.isDismissed = true;

        if (toastHandle.timer) clearTimeout(toastHandle.timer);
        if (toastHandle.animationInterval) clearInterval(toastHandle.animationInterval);

        if (toastHandle.element && toastHandle.element.parentNode) {
          toastHandle.element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          toastHandle.element.style.opacity = '0';
          toastHandle.element.style.transform = 'translateY(10px)';
          setTimeout(() => {
            if (toastHandle.element && toastHandle.element.parentNode) {
              toastHandle.element.parentNode.removeChild(toastHandle.element);
            }
          }, 200);
        }

        this.activeToasts.delete(toastId);
        if (onDismiss) onDismiss();
      };

      toastHandle.triggerUndo = executeUndo;
      toastHandle.dismiss = executeDismiss;

      // Start automatic expiration timer
      toastHandle.timer = setTimeout(() => {
        executeDismiss();
      }, durationMs);

      // DOM Rendering (if browser DOM available)
      const containerEl = this._ensureContainer();
      if (containerEl && typeof document !== 'undefined') {
        const toastEl = document.createElement('div');
        toastEl.className = 'di-toast di-toast--undo';
        toastEl.style.pointerEvents = 'auto';
        toastEl.style.position = 'relative';
        toastEl.style.display = 'flex';
        toastEl.style.alignItems = 'center';
        toastEl.style.justifyContent = 'space-between';
        toastEl.style.padding = '12px 16px';
        toastEl.style.background = 'var(--surface, #FFFFFF)';
        toastEl.style.border = '1.5px solid var(--ink, #121311)';
        toastEl.style.borderRadius = 'var(--radius-md, 8px)';
        toastEl.style.boxShadow = 'var(--shadow-lg, 0 8px 24px rgba(18, 19, 17, 0.16))';
        toastEl.style.overflow = 'hidden';
        toastEl.style.boxSizing = 'border-box';

        toastEl.innerHTML = `
          <div class="di-toast__content" style="flex:1;min-width:0;padding-right:12px;">
            <div class="di-toast__message" style="font-family:'Barlow',sans-serif;font-size:14.5px;font-weight:700;color:var(--ink,#121311);line-height:1.2;">
              ${message}
            </div>
            <div class="di-toast__meta" style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink-3,#555952);margin-top:2px;">
              ${timeStr} · ${author}
            </div>
          </div>
          <button type="button" class="di-toast__action" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;letter-spacing:0.04em;color:#121311;background:var(--hivis,#FFD100);border:1.5px solid #121311;border-radius:4px;padding:6px 14px;cursor:pointer;white-space:nowrap;">
            UNDO
          </button>
          <div class="di-toast__progress-bar" style="position:absolute;bottom:0;left:0;height:4px;background:var(--hivis,#FFD100);width:100%;transition:width 0.1s linear;"></div>
        `;

        const undoBtn = toastEl.querySelector('.di-toast__action');
        if (undoBtn) {
          undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            executeUndo();
          });
        }

        const progressBar = toastEl.querySelector('.di-toast__progress-bar');
        if (progressBar) {
          const startTime = Date.now();
          toastHandle.animationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remainingRatio = Math.max(0, 1 - (elapsed / durationMs));
            progressBar.style.width = (remainingRatio * 100).toFixed(1) + '%';
            if (remainingRatio <= 0) {
              clearInterval(toastHandle.animationInterval);
            }
          }, 50);
        }

        containerEl.appendChild(toastEl);
        toastHandle.element = toastEl;
      }

      this.activeToasts.set(toastId, toastHandle);
      return toastHandle;
    }

    /**
     * Show general informational toast
     */
    showToast(message, type = 'info', durationMs = 3000) {
      const toastId = 'toast_' + (++this._idCounter);
      const containerEl = this._ensureContainer();

      const toastHandle = {
        id: toastId,
        message: message,
        type: type,
        element: null,
        timer: null,
        dismiss: null
      };

      const executeDismiss = () => {
        if (toastHandle.timer) clearTimeout(toastHandle.timer);
        if (toastHandle.element && toastHandle.element.parentNode) {
          toastHandle.element.parentNode.removeChild(toastHandle.element);
        }
        this.activeToasts.delete(toastId);
      };

      toastHandle.dismiss = executeDismiss;
      toastHandle.timer = setTimeout(executeDismiss, durationMs);

      if (containerEl && typeof document !== 'undefined') {
        const toastEl = document.createElement('div');
        toastEl.className = `di-toast di-toast--${type}`;
        toastEl.style.pointerEvents = 'auto';
        toastEl.style.padding = '12px 16px';
        toastEl.style.background = (type === 'defect') ? 'var(--defect-bg, #FCEBEA)' : 'var(--surface, #FFFFFF)';
        toastEl.style.border = (type === 'defect') ? '1.5px solid var(--defect, #B3141A)' : '1.5px solid var(--ink, #121311)';
        toastEl.style.borderRadius = 'var(--radius-md, 8px)';
        toastEl.style.boxShadow = 'var(--shadow-md, 0 4px 12px rgba(18, 19, 17, 0.12))';
        toastEl.style.color = (type === 'defect') ? 'var(--defect, #B3141A)' : 'var(--ink, #121311)';
        toastEl.style.fontFamily = "'Barlow', sans-serif";
        toastEl.style.fontSize = '14px';
        toastEl.style.fontWeight = '600';
        toastEl.textContent = message;

        containerEl.appendChild(toastEl);
        toastHandle.element = toastEl;
      }

      this.activeToasts.set(toastId, toastHandle);
      return toastHandle;
    }

    /**
     * Dismiss all open toasts
     */
    dismissAll() {
      for (const toast of this.activeToasts.values()) {
        if (typeof toast.dismiss === 'function') {
          toast.dismiss();
        }
      }
      this.activeToasts.clear();
    }
  }

  return {
    ToastManager: ToastManager
  };
}));
