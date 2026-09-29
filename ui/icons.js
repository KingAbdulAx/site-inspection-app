/* Drainage Inspector — icons. Type icons are the cross-section of the thing
   in the ground; UI icons are plain line glyphs. All use currentColor. */
(function () {
  'use strict';
  const S = (vb, body, cls) => '<svg class="' + (cls || '') + '" viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';

  const TYPE = {
    trap: '<path d="M2 3 L7 14 H19 L24 3"/>',
    vee: '<path d="M2 3 L13 15 L24 3"/>',
    'vee-dash': '<path d="M2 3 L13 15 L24 3" stroke-dasharray="3 2.5"/>',
    half: '<path d="M3 4 H23 A10 9 0 0 1 3 4 Z"/>',
    pipe: '<path d="M3 2.5 H23"/><circle cx="13" cy="10.5" r="5.5"/>',
    box: '<path d="M3 2.5 H23"/><rect x="7.5" y="5.5" width="11" height="10"/>',
    arch: '<path d="M4 16 V9 A9 7 0 0 1 22 9 V16 Z"/>',
    bridge: '<path d="M2 4 H24 M5 4 V15 M21 4 V15 M5 9 Q13 3 21 9"/>',
    descent: '<path d="M3 16 H23 M4 3 L20 16 M9 3 L23 13"/>',
    riprap: '<circle cx="8" cy="11" r="4"/><circle cx="16" cy="11" r="4"/><circle cx="12" cy="5" r="3.2"/><circle cx="20" cy="5" r="2.6"/>',
    divert: '<path d="M2 5 L7 15 H15 L20 5"/><path d="M15 9 L23 2 M18 2 H23 V7"/>',
    collector: '<path d="M3 2.5 H23"/><circle cx="13" cy="10.5" r="5.5" stroke-dasharray="2.6 2.2"/>',
    dissip: '<rect x="3" y="6" width="8" height="7"/><path d="M11 9.5 H14 M23 3 L14 9.5 L23 16"/>',
    cascade: '<path d="M5 2 V6 H11 V11 H17 V16"/>'
  };
  function typeIcon(key, cls) { return S('0 0 26 18', TYPE[key] || TYPE.trap, cls || 'ticon'); }

  const UI = {
    walk: '<path d="M12 2 V22 M5 7 H9 M5 12 H9 M5 17 H9 M15 9.5 H19 M15 14.5 H19"/>',
    section: '<path d="M3 6 H21 M3 12 H21 M3 18 H21 M8 4 V8 M15 10 V14 M10 16 V20"/>',
    day: '<rect x="3.5" y="5" width="17" height="16" rx="1"/><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7 M8.5 15 L11 17.5 L15.5 12.5"/>',
    back: '<path d="M15 4 L7 12 L15 20"/>',
    close: '<path d="M5 5 L19 19 M19 5 L5 19"/>',
    share: '<path d="M12 15 V3 M7 8 L12 3 L17 8 M5 12 V21 H19 V12"/>',
    chev: '<path d="M9 5 L16 12 L9 19"/>',
    chevDown: '<path d="M5 9 L12 16 L19 9"/>',
    chevUp: '<path d="M5 15 L12 8 L19 15"/>',
    check: '<path d="M4 12.5 L9.5 18 L20 6.5"/>',
    warn: '<path d="M12 3 L22 20 H2 Z"/><path d="M12 9.5 V14 M12 17 V17.2"/>',
    camera: '<path d="M3 8 H7.5 L9 5.5 H15 L16.5 8 H21 V19 H3 Z"/><circle cx="12" cy="13" r="3.6"/>',
    notes: '<path d="M6 3 H15 L19 7 V21 H6 Z"/><path d="M9 12 H16 M9 16 H16"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><path d="M9.5 12 L11.5 14 L15 10"/>',
    cloud: '<path d="M7 18 H17.5 A4 4 0 0 0 17 10 A5.5 5.5 0 0 0 6.5 11 A3.5 3.5 0 0 0 7 18 Z"/>',
    cloudOff: '<path d="M7 18 H17.5 A4 4 0 0 0 17 10 A5.5 5.5 0 0 0 6.5 11 A3.5 3.5 0 0 0 7 18 Z"/><path d="M3 4 L21 20"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11 V8 A4 4 0 0 1 16 8 V11"/>',
    hand: '<path d="M8 13 V5.5 A1.5 1.5 0 0 1 11 5.5 V11 M11 10 V3.8 A1.5 1.5 0 0 1 14 3.8 V11 M14 10 V5 A1.5 1.5 0 0 1 17 5 V13 M8 12 A1.5 1.5 0 0 0 5 12.5 L7.5 18 A5 5 0 0 0 12 21 H13 A5 5 0 0 0 18 16 V9.5"/>',
    pin: '<path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z"/><circle cx="12" cy="9.5" r="2.6"/>',
    layers: '<path d="M12 3 L22 8.5 L12 14 L2 8.5 Z M2 13 L12 18.5 L22 13"/>',
    target: '<circle cx="12" cy="12" r="6"/><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15.5 14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/>',
    download: '<path d="M12 3 V15 M7 10 L12 15 L17 10 M5 20 H19"/>',
    backspace: '<path d="M9 5 H21 V19 H9 L3 12 Z M12 9 L17 15 M17 9 L12 15"/>',
    plus: '<path d="M12 5 V19 M5 12 H19"/>',
    sizes: '<rect x="3" y="4" width="18" height="16"/><path d="M3 14 H21 M13 14 V20"/>',
    x: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
    history: '<path d="M4 12 A8 8 0 1 0 6.5 6.3"/><path d="M4 4 V8.5 H8.5 M12 8 V12 L15 14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2 V4.5 M12 19.5 V22 M2 12 H4.5 M19.5 12 H22 M4.9 4.9 L6.7 6.7 M17.3 17.3 L19.1 19.1 M4.9 19.1 L6.7 17.3 M17.3 6.7 L19.1 4.9"/>',
    edit: '<path d="M4 20 H8 L19 9 L15 5 L4 16 Z"/>'
  };
  function icon(key, cls) { return S('0 0 24 24', UI[key] || '', cls || ''); }

  // GPS signal bars: n of 4 filled.
  function bars(n) {
    let s = '<svg viewBox="0 0 22 16" width="22" height="16" aria-hidden="true">';
    for (let i = 0; i < 4; i++) {
      const h = 5 + i * 3.5, x = i * 5.5;
      s += '<rect x="' + (x + 0.75) + '" y="' + (16 - h + 0.75) + '" width="3.5" height="' + (h - 1.5) + '" fill="' + (i < n ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.5"/>';
    }
    return s + '</svg>';
  }
  // Direction glyph used in side badges.
  const TRI_L = '<svg viewBox="0 0 10 12" width="10" height="12"><path d="M9 0 V12 L0 6 Z" fill="currentColor"/></svg>';
  const TRI_R = '<svg viewBox="0 0 10 12" width="10" height="12"><path d="M1 0 V12 L10 6 Z" fill="currentColor"/></svg>';

  window.DIcons = { typeIcon, icon, bars, TRI_L, TRI_R };
})();
