(function () {
  'use strict';
  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  const TYPE_CATALOGUE = {
    // Railway ditches
    '1':   { code: 'T1',   strip: 'T1',  fullName: 'Concrete Lined Side Ditch', shortName: 'Side ditch', section: 'Standard B 0.40 x H 0.40', drawing: 'DW-10001-05-A', lane: 'plat', icon: 'trapezoid', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '1L':  { code: 'T1L',  strip: 'T1L', fullName: 'Concrete Lined Side Ditch (Larger)', shortName: 'Side ditch (large)', section: 'B 0.75 x H 0.75', drawing: 'DW-10001-05-A', lane: 'plat', icon: 'trapezoid', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '2':   { code: 'T2',   strip: 'T2',  fullName: 'Half Round Lined Ditch for Overpasses', shortName: 'Half-round overpass', section: 'D 0.30', drawing: null, lane: 'plat', icon: 'half-round', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '3':   { code: 'T3',   strip: 'T3',  fullName: 'Unlined Side Ditch', shortName: 'Unlined side', section: 'Stable rock / firm cut', drawing: null, lane: 'plat', icon: 'triangle-dashed', category: 'Side ditch', stages: ['Not started', 'Excavated', 'Completed'] },
    '4':   { code: 'T4',   strip: 'T4',  fullName: 'Unlined Ditch at Foot of Slope', shortName: 'Unlined toe', section: 'Triangular H 1.00, slopes 1.5:1', drawing: null, lane: 'toe', icon: 'triangle-dashed', category: 'Toe ditch', stages: ['Not started', 'Excavated', 'Completed'] },
    '5':   { code: 'T5',   strip: 'T5',  fullName: 'Crest Ditch', shortName: 'Crest', section: 'Triangular, unlined', drawing: null, lane: 'crest', icon: 'triangle-dashed', category: 'Crest ditch', stages: ['Not started', 'Excavated', 'Completed'] },
    '6':   { code: 'T6',   strip: 'T6',  fullName: 'Collector Drain', shortName: 'Collector', section: 'Sub-surface PVC dia.110-200mm', drawing: 'DW-10002-07-B', lane: 'cl', icon: 'dashed-circle', category: 'Track drainage', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '7':   { code: 'T7',   strip: 'T7',  fullName: 'Concrete Lined Ditch at Foot of Slope', shortName: 'Lined toe', section: 'Triangular H 1.00, slopes 1.5:1, C25/30', drawing: null, lane: 'toe', icon: 'triangle', category: 'Toe ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '8':   { code: 'T8',   strip: 'T8',  fullName: 'Half Round Lined Bench Ditch', shortName: 'Bench ditch', section: 'D 0.30 on benches, slopes H > 8.0m', drawing: 'DW-10003-04-A', lane: 'face', icon: 'half-round', category: 'Berm ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '9':   { code: 'T9',   strip: 'T9',  fullName: 'Half Round Lined Ditch', shortName: 'Half-round shoulder', section: 'D 0.30 on fills H > 4.0m', drawing: 'DW-00002-05-A', lane: 'plat', icon: 'half-round', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '10':  { code: 'T10',  strip: 'T10', fullName: 'Concrete Lined Side Ditch with Trench Filter', shortName: 'Side ditch + filter', section: 'Surface ditch + sub-surface trench', drawing: 'DW-10001-05-A', lane: 'plat', icon: 'trapezoid', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '11':  { code: 'T11',  strip: 'T11', fullName: 'Crest Ditch (Lined)', shortName: 'Crest (lined)', section: 'Triangular concrete H 0.50-1.00', drawing: null, lane: 'crest', icon: 'triangle', category: 'Crest ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '12':  { code: 'T12',  strip: 'T12', fullName: 'Trapezoidal Lined Ditch at Foot of Slope', shortName: 'Trapezoidal toe', section: 'B 1.50 x H 0.50, slopes 1.5:1', drawing: 'DW-10001-05-A', lane: 'toe', icon: 'trapezoid', category: 'Toe ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '13':  { code: 'T13',  strip: 'T13', fullName: 'Rectangular Lined Ditch at Foot of Slope', shortName: 'Rectangular toe', section: 'B 1.50 x H 1.00', drawing: 'DW-03000-05', lane: 'toe', icon: 'rectangle', category: 'Toe ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '14':  { code: 'T14',  strip: 'T14', fullName: 'Concrete Lined Triangular Ditch at Convergence', shortName: 'Convergence ditch', section: 'W 1.20 x H 0.40, slopes 1.5:1', drawing: 'DW-10006-02-A', lane: 'toe', icon: 'triangle', category: 'Toe ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '15':  { code: 'T15',  strip: 'T15', fullName: 'Rectangular Concrete Lined Side Ditch', shortName: 'Rectangular side', section: 'B 0.50 x H 0.50-0.90 with covers', drawing: 'DW-10006-02-A', lane: 'plat', icon: 'rectangle', category: 'Side ditch', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    '16':  { code: 'T16',  strip: 'T16', fullName: 'Water Passage Used in Underpasses', shortName: 'Underpass passage', section: 'Type A B 1.50, H 0.25-0.35', drawing: 'DW-10006-02-A', lane: 'across', icon: 'dish', category: 'Underpass', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },

    // Open channels
    'CH-A':    { code: 'CH-A',  strip: 'CH-A',  fullName: 'Trapezoidal Earth Channel', shortName: 'Earth channel', section: 'Natural watercourses', drawing: 'DW-10002-07-B', lane: 'off', icon: 'trapezoid', category: 'Diversion channel', stages: ['Not started', 'Excavated', 'Completed'] },
    'CH-B':    { code: 'CH-B',  strip: 'CH-B',  fullName: 'Trapezoidal Concrete Channel', shortName: 'Concrete channel', section: 'Reinforced C25/30', drawing: null, lane: 'off', icon: 'trapezoid', category: 'Diversion channel', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'CH-C':    { code: 'CH-C',  strip: 'CH-C',  fullName: 'Trapezoidal Concrete Channel with Flanking Embankments', shortName: 'Flanked channel', section: 'Compacted fill dykes', drawing: null, lane: 'off', icon: 'trapezoid', category: 'Diversion channel', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'CH-R':    { code: 'CH-R',  strip: 'CH-R',  fullName: 'Rectangular Channel', shortName: 'Rect. channel', section: 'Width 1.0-3.5m+, H 0.75-1.5m', drawing: 'DW-10009-00-A', lane: 'off', icon: 'rectangle', category: 'Diversion channel', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },

    // Energy dissipators
    'D-SOZ':   { code: 'D-SOZ', strip: 'D-SOZ', fullName: 'Spread Out Zone Dissipator', shortName: 'SOZ dissipator', section: 'B 4.50 x L 4.00-4.50 x H 0.40', drawing: 'DW-10002-07-B', lane: 'off', icon: 'point', category: 'Energy dissipator', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'D-TC':    { code: 'D-TC',  strip: 'D-TC',  fullName: 'Trapezoidal Channel Dissipator', shortName: 'TC dissipator', section: 'Flared to 1.80m, raised sill', drawing: null, lane: 'off', icon: 'point', category: 'Energy dissipator', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'D-SD':    { code: 'D-SD',  strip: 'D-SD',  fullName: 'Slope Descent Dissipator', shortName: 'Slope dissipator', section: '1.00 x 0.70 x 0.70m RC', drawing: 'DW-10003-04-A', lane: 'toe', icon: 'point', category: 'Energy dissipator', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'D-ST':    { code: 'D-ST',  strip: 'D-ST',  fullName: 'Stool Ditch Dissipator', shortName: 'Stool dissipator', section: 'Connects T4/T8/T9/T11', drawing: null, lane: 'toe', icon: 'point', category: 'Energy dissipator', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'D-RF':    { code: 'D-RF',  strip: 'D-RF',  fullName: 'Rockfill Dissipator', shortName: 'Rockfill', section: 'D50 100-200mm stone pads', drawing: null, lane: 'off', icon: 'point', category: 'Energy dissipator', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },

    // Crossings & Structures
    'BRG':       { code: 'BRG',       strip: 'BRG', fullName: 'Railway Bridge', shortName: 'Bridge', section: 'Spans 12/18/24m', drawing: null, lane: 'across', icon: 'crossing', category: 'Bridge', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'OP':        { code: 'OP',        strip: 'OP',  fullName: 'Road Overpass', shortName: 'Overpass', section: 'Road over rail', drawing: null, lane: 'across', icon: 'crossing', category: 'Bridge', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'UP':        { code: 'UP',        strip: 'UP',  fullName: 'Road Underpass', shortName: 'Underpass', section: '4.50 x 5.00m', drawing: null, lane: 'across', icon: 'crossing', category: 'Underpass', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'CC':        { code: 'CC',        strip: 'CC',  fullName: 'Cattle Crossing', shortName: 'Cattle crossing', section: '3.00 x 3.00m precast', drawing: null, lane: 'across', icon: 'crossing', category: 'Cross drainage', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'CULV_BOX':  { code: 'CULV_BOX',  strip: 'BC',  fullName: 'Cast In-Situ / Precast Box Culvert', shortName: 'Box culvert', section: 'Standard Box Culvert (DW-00029..00031)', drawing: 'DW-00029', lane: 'across', icon: 'crossing', category: 'Cross drainage', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] },
    'CULV_PIPE': { code: 'CULV_PIPE', strip: 'PC',  fullName: 'Precast Concrete Pipe Culvert', shortName: 'Pipe culvert', section: 'Standard Pipe Culvert (DW-00023)', drawing: 'DW-00023', lane: 'across', icon: 'crossing', category: 'Cross drainage', stages: ['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed'] }
  };

  // Aliases for fast direct lookups
  TYPE_CATALOGUE['BC'] = TYPE_CATALOGUE['CULV_BOX'];
  TYPE_CATALOGUE['PC'] = TYPE_CATALOGUE['CULV_PIPE'];
  TYPE_CATALOGUE['BOX CULVERT'] = TYPE_CATALOGUE['CULV_BOX'];
  TYPE_CATALOGUE['PIPE CULVERT'] = TYPE_CATALOGUE['CULV_PIPE'];
  TYPE_CATALOGUE['BRIDGE'] = TYPE_CATALOGUE['BRG'];
  TYPE_CATALOGUE['OVERPASS'] = TYPE_CATALOGUE['OP'];
  TYPE_CATALOGUE['UNDERPASS'] = TYPE_CATALOGUE['UP'];
  TYPE_CATALOGUE['CATTLE CROSSING'] = TYPE_CATALOGUE['CC'];

  // Helper to get type info by key, code, name, or strip alias
  function getTypeInfo(typeCode) {
    if (!typeCode) return null;
    const str = String(typeCode).trim();
    if (TYPE_CATALOGUE[str]) return TYPE_CATALOGUE[str];
    const upper = str.toUpperCase();
    if (TYPE_CATALOGUE[upper]) return TYPE_CATALOGUE[upper];

    // Strip leading "TYPE " or "TYPE" (e.g. "Type 12" -> "12", "Type 1L" -> "1L")
    const cleaned = upper.replace(/^TYPE\s*/i, '');
    if (TYPE_CATALOGUE[cleaned]) return TYPE_CATALOGUE[cleaned];

    // Check if code matches 'T1' -> '1', 'T12' -> '12', etc.
    if (cleaned.startsWith('T') && TYPE_CATALOGUE[cleaned.substring(1)]) {
      return TYPE_CATALOGUE[cleaned.substring(1)];
    }

    // Check code, strip, shortName, fullName
    for (const item of Object.values(TYPE_CATALOGUE)) {
      if (item.code.toUpperCase() === upper ||
          item.strip.toUpperCase() === upper ||
          (item.shortName && item.shortName.toUpperCase() === upper) ||
          (item.fullName && item.fullName.toUpperCase() === upper)) {
        return item;
      }
    }
    return null;
  }

  root.TYPE_CATALOGUE = TYPE_CATALOGUE;
  root.getTypeInfo = getTypeInfo;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TYPE_CATALOGUE,
      getTypeInfo
    };
  }
})();
