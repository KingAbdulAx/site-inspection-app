/**
 * KANO–MARADI–DUTSE RAILWAY PROJECT
 * Project Structure & Multi-Section Manifest Architecture
 * Single Source of Truth for Project Hierarchy & Extensible Alignment Sections
 */

(function () {
  'use strict';

  const KMD_PROJECT_MANIFEST = {
    id: 'kmd_railway',
    name: 'Kano–Maradi–Dutse Railway Project',
    employer: 'Federal Ministry of Transportation',
    consultant: 'T.E.A.M. Nig. Ltd.',
    contractor: 'MOTA-ENGIL (Main Contractor)',
    author: 'Engr. Abdulaziz A. A. (Drainage Construction Execution)',
    audience: 'Senior Engineer / Resident Engineer',
    corridor: {
      nominalStartPk: 18400,
      nominalEndPk: 124521,
      totalLengthKm: 106.12,
      extentStr: 'PK 18+400 / 19+800 to PK 124+521'
    },
    sections: [
      {
        id: '01',
        code: 'KM01',
        name: 'Section 01: Kano to Dawanau',
        shortName: 'Section 01',
        startPk: 0,
        endPk: 19800,
        lengthKm: 19.8,
        status: 'planned', // 'active' or 'planned'
        description: 'Kano Central Station to Dawanau Inland Dry Port & Freight Yard',
        centerlineKey: 'SECTION01_CENTERLINE',
        assetsKey: 'SECTION01_ASSETS',
        storageKey: 'KMD_DRAINAGE_INSPECTIONS_SEC01_V1'
      },
      {
        id: '02',
        code: 'DWKZ',
        name: 'Section 02: Dawanau to Kazaure (DWKZ)',
        shortName: 'Section 02',
        startPk: 19800,
        endPk: 82902.439,
        lengthKm: 63.1,
        status: 'active',
        description: 'Dawanau Freight Yard to Kazaure Station South Boundary',
        centerlineKey: 'SECTION02_CENTERLINE',
        assetsKey: 'SECTION02_ASSETS',
        storageKey: 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1',
        drawingRegister: 'data/section02_drawing_register.json',
        transmittal: 'Transmittal Sheet #3848 / TC 1084 & TC 1153'
      },
      {
        id: '03',
        code: 'KZDR',
        name: 'Section 03: Kazaure to Daura (KZDR)',
        shortName: 'Section 03',
        startPk: 82902.439,
        endPk: 124521.000,
        lengthKm: 41.6,
        status: 'active',
        description: 'Kazaure Station Complex to Daura Station North Boundary',
        centerlineKey: 'SECTION03_CENTERLINE',
        assetsKey: 'SECTION03_ASSETS',
        storageKey: 'KMD_DRAINAGE_INSPECTIONS_SEC03_V1',
        transmittal: 'Transmittal Sheet #4366 & #3825 / TC 1211'
      },
      {
        id: '04',
        code: 'DRKD',
        name: 'Section 04: Daura to Kongolam (Niger Border)',
        shortName: 'Section 04',
        startPk: 124521.000,
        endPk: 165000.000,
        lengthKm: 40.5,
        status: 'planned',
        description: 'Daura Station to Niger Republic International Border at Kongolam',
        centerlineKey: 'SECTION04_CENTERLINE',
        assetsKey: 'SECTION04_ASSETS',
        storageKey: 'KMD_DRAINAGE_INSPECTIONS_SEC04_V1'
      }
    ],

    // Utility to get active sections
    getActiveSections() {
      return this.sections.filter(s => s.status === 'active');
    },

    // Utility to get section by ID
    getSectionById(secId) {
      return this.sections.find(s => s.id === secId) || null;
    },

    // Utility to find section for a given PK
    getSectionForPk(pk) {
      return this.sections.find(s => pk >= s.startPk && pk <= s.endPk) || null;
    },

    // Get combined corridor bounds for active sections
    getActiveCorridorBounds() {
      const active = this.getActiveSections();
      if (!active.length) return { startPk: 0, endPk: 0 };
      const startPk = Math.min(...active.map(s => s.startPk));
      const endPk = Math.max(...active.map(s => s.endPk));
      return { startPk, endPk, totalKm: ((endPk - startPk) / 1000).toFixed(1) };
    }
  };

  window.KMD_PROJECT_MANIFEST = KMD_PROJECT_MANIFEST;
})();
