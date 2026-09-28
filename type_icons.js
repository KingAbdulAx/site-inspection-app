(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TypeIcons = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TypeIcons = {
    // Cross-section icon shapes (viewBox 0 0 28 17, stroke-width 2)
    trapezoid: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M3 3 L8 14 L20 14 L25 3" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    },

    triangle: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M3 3 L14 14 L25 3" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    },

    'triangle-dashed': function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M3 3 L14 14 L25 3" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2"/></svg>';
    },

    'half-round': function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M5 3 A9 9 0 0 0 23 3" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/></svg>';
    },

    rectangle: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M4 3 L4 14 L24 14 L24 3" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    },

    'dashed-circle': function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="8.5" r="5.5" fill="none" stroke="' + color + '" stroke-width="2" stroke-dasharray="2.5 2"/></svg>';
    },

    dish: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><path d="M3 5 Q14 13 25 5" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/></svg>';
    },

    crossing: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="3" x2="26" y2="3" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/><rect x="9" y="7" width="10" height="7" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/></svg>';
    },

    point: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 28 17" width="28" height="17" xmlns="http://www.w3.org/2000/svg"><rect x="10.5" y="5" width="7" height="7" fill="' + color + '"/></svg>';
    },

    // UI & Navigation Icons (viewBox 0 0 24 24, stroke 2)
    walk: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 22l3-7 3 3v4M17 10l-4 4-2-2-3 3M17 10l-2-6-4 2"/></svg>';
    },

    section: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="8" cy="6" r="2" fill="' + color + '"/><circle cx="16" cy="12" r="2" fill="' + color + '"/><circle cx="10" cy="18" r="2" fill="' + color + '"/></svg>';
    },

    day: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>';
    },

    gps: function(color) {
      color = color || 'currentColor';
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>';
    },

    // Helper: get icon SVG by type code (e.g. 'T1', 'CH-A', 'D-SOZ', 'BRG')
    getIconForType: function(typeCode, color) {
      var cat = (typeof root !== 'undefined' && root.TYPE_CATALOGUE) || (typeof TYPE_CATALOGUE !== 'undefined' ? TYPE_CATALOGUE : null);
      if (!cat) return '';
      var info = cat[typeCode];
      if (!info) return '';
      var iconFn = this[info.icon];
      return iconFn ? iconFn(color) : '';
    },

    // General render helper
    render: function(nameOrCode, size, color) {
      color = color || 'currentColor';
      var svg = '';
      if (typeof this[nameOrCode] === 'function') {
        svg = this[nameOrCode](color);
      } else if (this.getIconForType(nameOrCode, color)) {
        svg = this.getIconForType(nameOrCode, color);
      }
      if (svg && size) {
        svg = svg.replace(/width="\d+"/, 'width="' + size + '"').replace(/height="\d+"/, 'height="' + size + '"');
      }
      return svg;
    }
  };

  return TypeIcons;
}));
