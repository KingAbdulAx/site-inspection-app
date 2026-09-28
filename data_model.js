/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Master Engineering Data Model (Phase 2 Data Layer)
 * 
 * Strict Architectural Guardrails:
 * 1. Design Intent and Site Observation NEVER merge into the same table or record.
 * 2. Field records are irreplaceable and append-only (no Last-Write-Wins).
 * 3. Position is line + chainage + side, never chainage alone.
 * 4. Device-generated IDs (UUIDv7) prevent offline collision.
 * 5. Nothing is deleted: removed features remain visible with status 'removed'.
 * 6. No emojis in code or logs.
 */

(function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  // =========================================================================
  // 1. COLLISION-FREE UUIDv7 GENERATOR (RFC 9562 §6.2 Method 1)
  // Timestamp-ordered (48-bit ms), 12-bit monotonic sequence counter,
  // 62 bits entropy/variant, zero collisions offline, strictly monotonic
  // =========================================================================
  let _lastTimestamp = -1;
  let _subMsSequence = 0;

  function generateUUIDv7(timestampMs) {
    let now = (typeof timestampMs === 'number') ? timestampMs : Date.now();

    // Enforce strict monotonicity across time skew and sub-millisecond bursts
    if (now <= _lastTimestamp) {
      _subMsSequence++;
      if (_subMsSequence > 0x0fff) {
        // Rollover counter limit (4,096 IDs in single millisecond):
        // Artificially advance timestamp to maintain strict monotonic ordering
        _lastTimestamp = _lastTimestamp + 1;
        now = _lastTimestamp;
        _subMsSequence = 0;
      } else {
        now = _lastTimestamp;
      }
    } else {
      _lastTimestamp = now;
      _subMsSequence = 0;
    }

    const randBytes = new Uint8Array(10);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randBytes);
    } else {
      for (let i = 0; i < 10; i++) {
        randBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    // 48-bit timestamp in hex (12 chars)
    const timeHex = now.toString(16).padStart(12, '0');

    // 12-bit rand_a dedicated monotonic counter merged with version 7 (0b0111)
    const seq = _subMsSequence & 0x0fff;
    const verRandA = (0x7000 | seq).toString(16).padStart(4, '0');

    // Variant 10xx merged with 62-bit rand_b entropy
    const varByte = (randBytes[2] & 0x3f) | 0x80;
    let randBHex = varByte.toString(16).padStart(2, '0');
    for (let i = 3; i < 10; i++) {
      randBHex += randBytes[i].toString(16).padStart(2, '0');
    }

    return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-${verRandA}-${randBHex.slice(0, 4)}-${randBHex.slice(4)}`;
  }

  function extractUUIDv7Timestamp(uuid) {
    if (!uuid || typeof uuid !== 'string') return null;
    const clean = uuid.replace(/-/g, '');
    if (clean.length < 12) return null;
    const timeHex = clean.slice(0, 12);
    return parseInt(timeHex, 16);
  }

  // =========================================================================
  // 2. MASTER ENTITY DEFINITIONS (§4 of Master Spec)
  // =========================================================================

  /**
   * Line: Railway line corridor
   */
  class Line {
    constructor(data = {}) {
      this.id = data.id || 'line_km'; // 'line_km' (Kano-Maradi) or 'line_kd' (Kano-Dutse branch)
      this.name = data.name || 'Kano-Maradi';
      this.chainage_datum = data.chainage_datum || 'Kano Central Station PK 0+000; note both lines originate at Kano';
      this.length_km = typeof data.length_km === 'number' ? data.length_km : 0;
      this.description = data.description || '';
    }
  }

  /**
   * SubSection: Geographic operational section
   * 9 sub-sections total across 2 lines
   */
  class SubSection {
    constructor(data = {}) {
      this.code = data.code; // 'KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB', 'JBMR', 'KNYG', 'YGGY', 'GYDT'
      this.name = data.name;
      this.line_id = data.line_id || 'line_km';
      this.ch_start = typeof data.ch_start === 'number' ? data.ch_start : 0;
      this.ch_end = typeof data.ch_end === 'number' ? data.ch_end : 0;
      this.data_status = data.data_status || 'not_extracted'; // 'on_phone' | 'available' | 'not_extracted'
      this.feature_count = typeof data.feature_count === 'number' ? data.feature_count : 0;
      this.package_size_bytes = typeof data.package_size_bytes === 'number' ? data.package_size_bytes : 0;
      this.updated_at = data.updated_at || null;
      this.description = data.description || '';
    }
  }

  /**
   * Default Sub-Sections Registry across the 2 Railway Lines
   */
  const DEFAULT_LINES = [
    new Line({
      id: 'line_km',
      name: 'Kano–Maradi',
      chainage_datum: 'Kano Central Station PK 0+000',
      length_km: 284.5,
      description: 'Main Corridor: Kano Central to Niger Republic International Border (Maradi)'
    }),
    new Line({
      id: 'line_kd',
      name: 'Kano–Dutse branch',
      chainage_datum: 'Kano Central Station PK 0+000 (Chainage repeats from Kano datum)',
      length_km: 115.0,
      description: 'Branch Line: Kano to Dutse Capital via Yar Gaya and Gaya'
    })
  ];

  const DEFAULT_SUBSECTIONS = [
    // Kano-Maradi line (6 sub-sections)
    new SubSection({
      code: 'KNDW',
      name: 'Kano - Dawanau',
      line_id: 'line_km',
      ch_start: 0,
      ch_end: 19800,
      data_status: 'available',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: '2026-09-15T00:00:00Z',
      description: 'Section 01: Kano Central Station to Dawanau Inland Freight Yard'
    }),
    new SubSection({
      code: 'DWKZ',
      name: 'Dawanau - Kazaure',
      line_id: 'line_km',
      ch_start: 19800,
      ch_end: 82902.439,
      data_status: 'on_phone',
      feature_count: 1710,
      package_size_bytes: 3236628,
      updated_at: '2026-09-15T00:00:00Z',
      description: 'Section 02: Dawanau Freight Yard to Kazaure Station South Boundary'
    }),
    new SubSection({
      code: 'KZDR',
      name: 'Kazaure - Daura',
      line_id: 'line_km',
      ch_start: 82902.439,
      ch_end: 124521.000,
      data_status: 'on_phone',
      feature_count: 837,
      package_size_bytes: 1621749,
      updated_at: '2026-09-15T00:00:00Z',
      description: 'Section 03: Kazaure Station Complex to Daura Station North Boundary'
    }),
    new SubSection({
      code: 'DRMR',
      name: 'Daura - Muduru',
      line_id: 'line_km',
      ch_start: 124521.000,
      ch_end: 165000.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Section 04: Daura Station to Muduru'
    }),
    new SubSection({
      code: 'MRJB',
      name: 'Muduru - Jibiya',
      line_id: 'line_km',
      ch_start: 165000.000,
      ch_end: 215000.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Section 05: Muduru to Jibiya Border Town'
    }),
    new SubSection({
      code: 'JBMR',
      name: 'Jibiya - Maradi',
      line_id: 'line_km',
      ch_start: 215000.000,
      ch_end: 284500.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Section 06: Jibiya to Maradi Station (Republic of Niger)'
    }),
    // Kano-Dutse branch line (3 sub-sections)
    new SubSection({
      code: 'KNYG',
      name: 'Kano - Yar Gaya',
      line_id: 'line_kd',
      ch_start: 0,
      ch_end: 35000.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Branch Section 01: Kano Central to Yar Gaya Junction'
    }),
    new SubSection({
      code: 'YGGY',
      name: 'Yar Gaya - Gaya',
      line_id: 'line_kd',
      ch_start: 35000.000,
      ch_end: 75000.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Branch Section 02: Yar Gaya to Gaya Town'
    }),
    new SubSection({
      code: 'GYDT',
      name: 'Gaya - Dutse',
      line_id: 'line_kd',
      ch_start: 75000.000,
      ch_end: 115000.000,
      data_status: 'not_extracted',
      feature_count: 0,
      package_size_bytes: 0,
      updated_at: null,
      description: 'Branch Section 03: Gaya to Dutse Terminus Station'
    })
  ];

  /**
   * Alignment: Spatial corridor reference & calibration points
   */
  class Alignment {
    constructor(data = {}) {
      this.line_id = data.line_id || 'line_km';
      this.name = data.name || 'Kano-Maradi Alignment';
      this.polyline_ref = data.polyline_ref || 'data/centerline.json';
      this.cad_export_ref = data.cad_export_ref || 'SECTION 02.kmz / SECTION 03.kmz';
      this.stations_500m = Array.isArray(data.stations_500m) ? data.stations_500m : [];
      this.calibration_residuals = data.calibration_residuals || { max_residual_m: 0.12, checked_points: 0 };
    }
  }

  const DEFAULT_ALIGNMENTS = [
    new Alignment({
      line_id: 'line_km',
      name: 'Kano-Maradi Main Line Alignment',
      polyline_ref: 'data/centerline.json',
      cad_export_ref: 'SECTION 02.kmz / SECTION 03.kmz',
      stations_500m: [
        { pk: 0, label: 'PK 0+000 (Kano Central)', lon: 8.5167, lat: 12.0022 },
        { pk: 19800, label: 'PK 19+800 (Dawanau)', lon: 8.4374, lat: 12.1008 },
        { pk: 82902.439, label: 'PK 82+902.439 (Kazaure)', lon: 8.4041, lat: 12.6248 },
        { pk: 124521, label: 'PK 124+521 (Daura)', lon: 8.3125, lat: 12.9804 },
        { pk: 284500, label: 'PK 284+500 (Maradi)', lon: 7.1000, lat: 13.5000 }
      ],
      calibration_residuals: { max_residual_m: 0.12, checked_points: 5 }
    }),
    new Alignment({
      line_id: 'line_kd',
      name: 'Kano-Dutse Branch Alignment',
      polyline_ref: 'data/kano_dutse_centerline.json',
      cad_export_ref: 'BRANCH_DUTSE.kmz',
      stations_500m: [
        { pk: 0, label: 'PK 0+000 (Kano Central)', lon: 8.5167, lat: 12.0022 },
        { pk: 35000, label: 'PK 35+000 (Yar Gaya)', lon: 8.6500, lat: 11.9500 },
        { pk: 75000, label: 'PK 75+000 (Gaya)', lon: 9.0000, lat: 11.8500 },
        { pk: 115000, label: 'PK 115+000 (Dutse)', lon: 9.3333, lat: 11.7500 }
      ],
      calibration_residuals: { max_residual_m: 0.15, checked_points: 4 }
    })
  ];

  /**
   * DesignFeature: Stable identity for a designed structure
   * Separated strictly from field observations.
   */
  class DesignFeature {
    constructor(data = {}) {
      this.feature_id = data.feature_id || generateUUIDv7();
      this.created_at = data.created_at || new Date().toISOString();
      this.active_version_id = data.active_version_id || null;
      this.history_version_ids = Array.isArray(data.history_version_ids) ? data.history_version_ids : [];
    }
  }

  /**
   * DesignVersion: Immutable version of design specifications
   */
  class DesignVersion {
    constructor(data = {}) {
      this.version_id = data.version_id || (data.feature_id ? `${data.feature_id}_v${data.version || 1}` : generateUUIDv7());
      this.feature_id = data.feature_id;
      this.version = typeof data.version === 'number' ? data.version : 1;
      this.status = data.status || 'confirmed'; // 'confirmed' | 'pending' | 'superseded' | 'removed'
      
      // Source provenance
      const src = data.source || {};
      this.source = {
        kind: src.kind || 'import', // 'drawing_revision' | 'site_instruction' | 'consultant_comment' | 'import'
        doc_ref: src.doc_ref || data.drawing_ref || 'Base Drawing',
        rev: src.rev || '00',
        approval_level: src.approval_level || 'A' // 'A' | 'B' | 'C' | 'not_reviewed'
      };

      // Geometry and position
      this.line_id = data.line_id || 'line_km';
      this.subsection = data.subsection || 'KZDR';
      this.side = data.side || 'C'; // 'L' | 'R' | 'C'
      this.lane = data.lane || 'plat'; // 'plat' | 'face' | 'toe' | 'crest' | 'off' | 'cl' | 'across'
      this.offset_m = typeof data.offset_m === 'number' ? data.offset_m : 0;
      this.geometry = data.geometry || 'linear'; // 'point' | 'linear' | 'label' | 'crossing' | 'off_alignment'
      this.ch = typeof data.ch === 'number' ? data.ch : (typeof data.ch_start === 'number' ? data.ch_start : null);
      this.ch_start = typeof data.ch_start === 'number' ? data.ch_start : this.ch;
      this.ch_end = typeof data.ch_end === 'number' ? data.ch_end : this.ch;
      this.position_certainty = data.position_certainty || 'derived'; // 'exact' | 'derived' | 'label'
      this.tolerance_m = typeof data.tolerance_m === 'number' ? data.tolerance_m : (this.position_certainty === 'exact' ? 0 : 4);
      this.skew_deg = typeof data.skew_deg === 'number' ? data.skew_deg : 0;
      this.serves_ch = typeof data.serves_ch === 'number' ? data.serves_ch : null;
      this.distance_out_m = typeof data.distance_out_m === 'number' ? data.distance_out_m : 0;

      // Type and engineering drawing
      this.category = data.category || 'Drainage Structure';
      this.type_code = data.type_code || null;
      this.specs = data.specs || '';
      this.drawing_ref = data.drawing_ref || this.source.doc_ref;
      this.confidence = data.confidence || (this.type_code ? 'CONFIRMED' : 'NEEDS_VERIFICATION');

      // Audit trail
      this.created_by = data.created_by || 'system_migration';
      this.created_at = data.created_at || new Date().toISOString();

      // Complete raw properties & geometry container (guarantees 100% round-trip fidelity)
      this.raw_properties = data.raw_properties ? JSON.parse(JSON.stringify(data.raw_properties)) : {};
      this.raw_geometry = data.raw_geometry ? JSON.parse(JSON.stringify(data.raw_geometry)) : null;
    }
  }

  /**
   * Absence: Design declaration that NO feature exists in a corridor reach
   */
  class Absence {
    constructor(data = {}) {
      this.absence_id = data.absence_id || generateUUIDv7();
      this.line_id = data.line_id || data.line || 'line_km';
      this.line = this.line_id;
      this.subsection = data.subsection || 'KZDR';
      this.side = data.side || 'C';
      this.lane = data.lane || 'toe';
      this.ch_start = typeof data.ch_start === 'number' ? data.ch_start : 0;
      this.ch_end = typeof data.ch_end === 'number' ? data.ch_end : 0;
      this.reason = data.reason || 'Natural drainage slope sufficient; absence specified by approved design';
      this.drawing_ref = data.drawing_ref || '';
      this.approval_level = data.approval_level || 'A';
      this.created_at = data.created_at || new Date().toISOString();
    }
  }

  /**
   * FieldRecord: Append-only site observation
   * Strict Rule: NEVER OVERWRITES PREVIOUS RECORDS.
   */
  class FieldRecord {
    constructor(data = {}) {
      this.record_id = data.record_id || generateUUIDv7();
      this.feature_id = data.feature_id || null; // nullable for unlisted features
      this.kind = data.kind || 'stage'; // 'stage' | 'note' | 'defect' | 'as_built_position' | 'as_built_type' | 'unlisted' | 'verdict'
      this.payload = data.payload ? JSON.parse(JSON.stringify(data.payload)) : {};
      this.stage = data.stage !== undefined ? data.stage : null;
      this.verdict_vs_claim = data.verdict_vs_claim || 'no_claim'; // 'agrees' | 'disagrees' | 'no_claim'
      this.measured_position = data.measured_position ? JSON.parse(JSON.stringify(data.measured_position)) : null;
      this.author = data.author || 'Engr. Abdulaziz A. A.';
      this.created_at = data.created_at || new Date().toISOString();
      this.device_id = data.device_id || 'device_field';
      this.voided_by_record_id = data.voided_by_record_id || null;
      this.sync_state = data.sync_state || 'on_phone'; // 'on_phone' | 'sent'
    }
  }

  /**
   * Photo: Site evidence photographic record
   */
  class Photo {
    constructor(data = {}) {
      this.photo_id = data.photo_id || generateUUIDv7();
      this.record_id = data.record_id;
      this.blob_uri = data.blob_uri || data.uri || data.blob || '';
      this.uri = this.blob_uri;
      this.blob = data.blob || null;
      this.raw_fix = data.raw_fix ? JSON.parse(JSON.stringify(data.raw_fix)) : null; // { lat, lon, accuracy_m, timestamp }
      this.snapped = data.snapped ? JSON.parse(JSON.stringify(data.snapped)) : null; // { line_id, ch, side, offset_m }
      this.caption = data.caption || '';
      this.created_at = data.created_at || new Date().toISOString();
      this.sync_state = data.sync_state || 'on_phone';
    }
  }

  /**
   * InspectionRequest (IR): Contractor claim
   */
  class InspectionRequest {
    constructor(data = {}) {
      const section = data.section || 'S03';
      const progStr = (data.prog_n !== undefined && data.prog_n !== null && data.prog_n !== '' && data.prog_n !== '#REF!') ? String(data.prog_n) : null;
      const revStr = (data.rev !== undefined && data.rev !== null && data.rev !== '') ? `_r${data.rev}` : '';
      const rowStr = (data.row !== undefined && data.row !== null) ? `_row${data.row}` : '';

      this.ir_id = data.ir_id || (progStr ? `IR_${section}_${progStr}${revStr}${rowStr}` : `IR_${section}_${generateUUIDv7()}`);
      this.ir_no = data.ir_no || (progStr ? `IR-${progStr}` : `IR-${this.ir_id.slice(-6)}`);
      this.prog_n = typeof data.prog_n === 'number' ? data.prog_n : (progStr ? parseInt(progStr, 10) || 0 : 0);
      this.feature_id = data.feature_id || null;
      this.section = section;
      this.work_type = data.work_type || '';
      this.discipline = data.discipline || 'DRN';
      this.ch_from = typeof data.ch_from === 'number' ? data.ch_from : (data.ch_from ? parseFloat(data.ch_from) || null : null);
      this.ch_to = typeof data.ch_to === 'number' ? data.ch_to : (data.ch_to ? parseFloat(data.ch_to) || null : null);
      this.date = data.date || data.receipt_date || '';
      this.activity = data.activity || data.description || '';

      // Derive claimed stage
      if (data.claimed_stage) {
        this.claimed_stage = data.claimed_stage;
      } else {
        const desc = (this.activity || '').toLowerCase();
        if (desc.includes('excavat')) this.claimed_stage = 'Excavation';
        else if (desc.includes('blind')) this.claimed_stage = 'Blinding';
        else if (desc.includes('rebar') || desc.includes('steel') || desc.includes('reinforce')) this.claimed_stage = 'Rebar';
        else if (desc.includes('formwork') || desc.includes('shutter')) this.claimed_stage = 'Shuttered';
        else if (desc.includes('concrete') || desc.includes('concreting')) this.claimed_stage = 'Concreted';
        else if (desc.includes('precast')) this.claimed_stage = 'Precast';
        else if (desc.includes('complete')) this.claimed_stage = 'Completed';
        else this.claimed_stage = '';
      }

      // Map outcome
      if (data.outcome) {
        this.outcome = data.outcome;
      } else if (data.status) {
        const st = String(data.status).toUpperCase().trim();
        if (st === 'APPROVED') this.outcome = 'approved';
        else if (st === 'APPD AS NOTED') this.outcome = 'approved_with_comments';
        else if (st === 'REJECTED') this.outcome = 'rejected';
        else if (st === 'PENDING') this.outcome = 'pending';
        else this.outcome = st.toLowerCase();
      } else {
        this.outcome = 'pending';
      }

      this.remark = data.remark || '';
      this.raw_data = data.raw_data || (data.row ? JSON.parse(JSON.stringify(data)) : null);
    }
  }

  /**
   * Query: Open discrepancy item flagged for the engineering office
   */
  class Query {
    constructor(data = {}) {
      this.query_id = data.query_id || generateUUIDv7();
      this.feature_id = data.feature_id || null;
      this.reason = data.reason || data.kind || data.type || 'defect'; // 'claim_ahead' | 'misplaced' | 'wrong_type' | 'unlisted' | 'built_but_removed' | 'built_without_approval' | 'defect'
      this.kind = this.reason;
      this.type = this.reason;
      this.title = data.title || '';
      this.description = data.description || '';
      this.linked_record_ids = Array.isArray(data.linked_record_ids) ? data.linked_record_ids : [];
      this.status = data.status || 'open'; // 'open' | 'sent_to_office' | 'resolved' | 'closed'
      this.created_at = data.created_at || new Date().toISOString();
      this.updated_at = data.updated_at || new Date().toISOString();
    }
  }

  /**
   * ChangeSet: Grouping of design versions from a single document change
   */
  class ChangeSet {
    constructor(data = {}) {
      this.changeset_id = data.changeset_id || generateUUIDv7();
      this.name = data.name || 'Site Instruction Change';
      this.source = data.source ? JSON.parse(JSON.stringify(data.source)) : { kind: 'site_instruction', doc_ref: '', rev: '01', approval_level: 'B' };
      this.status = data.status || 'pending'; // 'pending' | 'confirmed'
      this.author = data.author || 'Engr. Abdulaziz A. A.';
      this.created_at = data.created_at || new Date().toISOString();
      this.version_ids = Array.isArray(data.version_ids) ? data.version_ids : [];
    }
  }

  /**
   * Conflict: Offline concurrent design edit collision
   */
  class Conflict {
    constructor(data = {}) {
      this.conflict_id = data.conflict_id || generateUUIDv7();
      this.feature_id = data.feature_id;
      this.base_version_id = data.base_version_id;
      this.local_version_id = data.local_version_id;
      this.remote_version_id = data.remote_version_id;
      this.status = data.status || 'unresolved'; // 'unresolved' | 'resolved_local' | 'resolved_remote' | 'resolved_office'
      this.created_at = data.created_at || new Date().toISOString();
    }
  }

  // =========================================================================
  // 3. MAPPING & ENGINE HELPERS
  // =========================================================================

  /**
   * Standardize side string to 'L' | 'R' | 'C'
   */
  function normalizeSide(side) {
    if (!side) return 'C';
    const s = String(side).trim().toLowerCase();
    if (s === 'left' || s === 'l') return 'L';
    if (s === 'right' || s === 'r') return 'R';
    return 'C';
  }

  /**
   * Intelligently map an asset to TYPE_CATALOGUE code
   */
  function mapAssetToTypeCode(asset) {
    const p = (asset && asset.properties) || {};
    const cat = (p.category || p.Typology_Class || p.Type || p.Layer || '').toLowerCase();
    const sc = (p.short_code || p.Struct_No || p.Asset_ID || p.id || '').toLowerCase();
    const typ = (p.typology || p.Typology_Class || p.Type || '').toLowerCase();
    const specs = (p.specs || p.Dimensions || '').toLowerCase();

    // 1. Cross-Drainage Culverts & Crossings
    if (sc.includes('box culv') || typ.includes('box culvert') || sc.includes('stn-bc') || sc.startsWith('bc-') || sc === 'bc' || sc === 'culv_box') return 'CULV_BOX';
    if (sc.includes('pipe culv') || sc.includes('pc-1.2m') || typ.includes('pipe culvert') || sc.includes('discharge pipe') || sc.startsWith('pc-') || sc === 'pc' || sc === 'culv_pipe') return 'CULV_PIPE';
    if (sc.includes('brg') || cat.includes('bridge') || typ.includes('railway bridge')) return 'BRG';
    if (sc.includes('overbridge') || typ.includes('overpass') || sc === 'op') return 'OP';
    if (sc.includes('underpass') || typ.includes('underpass') || sc === 'up') {
      if (typ.includes('water passage') || sc.includes('passage')) return '16';
      return 'UP';
    }
    if (sc.includes('cattle crossing') || typ.includes('cattle crossing') || sc === 'cc') return 'CC';

    // 2. Open Channels
    if (sc.includes('chan a') || typ.includes('earth channel') || sc === 'ch-a') return 'CH-A';
    if (sc.includes('chan b') || typ.includes('channel (type b)') || sc === 'ch-b') return 'CH-B';
    if (sc.includes('chan c') || typ.includes('channel (type c)') || sc === 'ch-c') return 'CH-C';
    if (sc.includes('rect chan') || typ.includes('rectangular channel') || sc === 'ch-r') return 'CH-R';

    // 3. Energy Dissipators & Transitions
    if (sc.includes('soz') || sc.includes('bs2') || typ.includes('spread out zone') || sc === 'd-soz') return 'D-SOZ';
    if (/\b(d-tc|tc)\b/i.test(sc) || typ.includes('trapezoidal channel dissipator')) return 'D-TC';
    if (sc.includes('descent') || typ.includes('water descent') || typ.includes('slope descent') || /\b(d-sd)\b/i.test(sc)) return 'D-SD';
    if (/\b(d-st)\b/i.test(sc) || typ.includes('stool ditch')) return 'D-ST';
    if (sc.includes('riprap') || typ.includes('riprap protection') || typ.includes('scour protection') || /\b(d-rf)\b/i.test(sc)) return 'D-RF';

    // 4. Longitudinal Railway Ditches
    // Special dual type: Type 11 / Type 5
    if (sc.includes('11/5') || typ.includes('11/5') || typ.includes('type 11 / type 5')) {
      return '11';
    }

    // Multi-type sequences or transitions: never guess a single type
    if (sc.includes('transition') || typ.includes('transition') ||
        sc.includes('sequence') || typ.includes('sequence') ||
        (typ.match(/\btype\s*\d+\b/gi) || []).length > 1) {
      return null;
    }

    function hasType(numStr) {
      const re = new RegExp(`\\btype\\s*${numStr}\\b`, 'i');
      return re.test(sc) || re.test(typ);
    }

    if (sc.includes('type 1 lgr') || typ.includes('type 1 (larger)') || sc.includes('type 1l') || typ.includes('type 1l') || sc === '1l' || sc === 't1l') return '1L';
    if (hasType('16') || sc === '16' || sc === 't16') return '16';
    if (hasType('15') || sc === '15' || sc === 't15') return '15';
    if (hasType('14') || sc === '14' || sc === 't14') return '14';
    if (hasType('13') || sc === '13' || sc === 't13') return '13';
    if (hasType('12') || sc === '12' || sc === 't12') return '12';
    if (hasType('11') || sc === '11' || sc === 't11') return '11';
    if (hasType('10') || sc === '10' || sc === 't10') return '10';
    if (hasType('9') || sc === '9' || sc === 't9') return '9';
    if (hasType('8') || sc === '8' || sc === 't8') return '8';
    if (hasType('7') || sc === '7' || sc === 't7') return '7';
    if (hasType('6') || sc.includes('collector') || cat.includes('track drainage') || sc === '6' || sc === 't6') return '6';
    if (hasType('5') || sc === '5' || sc === 't5') return '5';
    if (hasType('4') || sc === '4' || sc === 't4') return '4';
    if (hasType('3') || sc === '3' || sc === 't3') return '3';
    if (hasType('2') || sc === '2' || sc === 't2') return '2';
    if (hasType('1') || sc.includes('type 1 std') || sc === '1' || sc === 't1') return '1';

    // Multi-type or unconfirmed: never guess
    return null;
  }

  /**
   * Determine Corridor Strip Lane
   * ('plat' | 'face' | 'toe' | 'crest' | 'off' | 'cl' | 'across')
   */
  function determineLane(asset, typeCode) {
    const p = (asset && asset.properties) || {};
    const cat = (p.category || p.Typology_Class || p.Type || p.Layer || '').toLowerCase();
    const sc = (p.short_code || p.Struct_No || p.Asset_ID || '').toLowerCase();

    if (typeCode) {
      const tc = (root.TYPE_CATALOGUE && root.TYPE_CATALOGUE[typeCode]) || null;
      if (tc && tc.lane) return tc.lane;
    }

    if (p.category === 'Cross Drainage' || p.category === 'Cross Drainage Structure' ||
        p.category === 'Bridge Crossing' || p.category === 'Overhead Crossing' ||
        p.category === 'Underpass' || cat.includes('cross') || cat.includes('bridge') ||
        sc.includes('culv') || sc.includes('brg') || sc.includes('overpass') || sc.includes('underpass') ||
        typeCode === 'BRG' || typeCode === 'CULV_BOX' || typeCode === 'CULV_PIPE' || typeCode === 'OP' || typeCode === 'UP' || typeCode === 'CC') {
      return 'across';
    }
    if (cat.includes('track drainage') || p.short_code === 'Collector' || p.short_code === 'Type 6' || sc.includes('collector') || typeCode === '6') {
      return 'cl';
    }
    if (cat.includes('crest') || typeCode === '5' || typeCode === '11') return 'crest';
    if (cat.includes('toe') || typeCode === '4' || typeCode === '7' || typeCode === '12' || typeCode === '13' || typeCode === '14' || typeCode === 'D-SD' || typeCode === 'D-ST') return 'toe';
    if (cat.includes('shoulder') || cat.includes('side ditch') || typeCode === '1' || typeCode === '1L' || typeCode === '2' || typeCode === '3' || typeCode === '9' || typeCode === '10' || typeCode === '15') return 'plat';
    if (cat.includes('berm') || typeCode === '8') return 'face';
    if (cat.includes('diversion') || cat.includes('channel') || cat.includes('dissipator') || (typeCode && typeCode.startsWith('CH-')) || typeCode === 'D-SOZ' || typeCode === 'D-TC' || typeCode === 'D-RF') return 'off';

    return 'plat';
  }

  /**
   * Determine Position Certainty
   * ('exact' | 'derived' | 'label')
   */
  function determineCertainty(asset) {
    const p = (asset && asset.properties) || {};
    const cat = (p.category || p.Typology_Class || p.Type || p.Layer || '').toLowerCase();
    const sc = (p.short_code || p.Struct_No || p.Asset_ID || '').toLowerCase();

    // Culverts and crossing structures have surveyed exact stations
    if (cat.includes('cross') || cat.includes('bridge') || sc.includes('culv') || sc.includes('boundary') || sc.includes('brg') || sc.includes('crossing') || sc.includes('overpass') || sc.includes('underpass')) {
      return 'exact';
    }
    // Riprap callout annotations without physical surveyed endpoints
    if (cat.includes('riprap') || sc.includes('riprap')) {
      return 'label';
    }
    // Standard longitudinal ditches have derived chainage extents (tolerance +-4m)
    return 'derived';
  }

  /**
   * Convert Legacy GeoJSON Feature to Design Entities (DesignFeature + DesignVersion)
   * 100% property preservation guaranteed
   */
  function assetToDesignEntities(asset, subsectionCode) {
    if (!asset || !asset.properties) {
      throw new Error('Invalid GeoJSON feature: missing properties');
    }
    const p = asset.properties;
    const geom = asset.geometry || null;
    const featId = (p && (p.id || p.Asset_ID || p.asset_id)) || asset.id || generateUUIDv7();
    const subCode = subsectionCode || (String(featId).startsWith('s02_') ? 'DWKZ' : 'KZDR');
    const typeCode = mapAssetToTypeCode(asset);
    const lane = determineLane(asset, typeCode);
    const certainty = determineCertainty(asset);
    const side = normalizeSide(p.side || p.Side);
    const cat = (p.category || p.Typology_Class || p.Type || p.Layer || '').toLowerCase();
    const sc = (p.short_code || p.Struct_No || p.Asset_ID || '').toLowerCase();

    // Determine geometry kind
    let geomKind = 'linear';
    if (cat.includes('cross') || cat.includes('bridge') || sc.includes('culv') || sc.includes('brg') || sc.includes('overpass') || sc.includes('underpass') || lane === 'across') {
      geomKind = 'crossing';
    } else if (p.is_point || (geom && geom.type === 'Point')) {
      geomKind = 'point';
    } else if (lane === 'off') {
      geomKind = 'off_alignment';
    }

    const startPk = typeof p.start_pk === 'number' ? p.start_pk : (typeof p.Start_PK === 'number' ? p.Start_PK : (typeof p.pk === 'number' ? p.pk : 0));
    const endPk = typeof p.end_pk === 'number' ? p.end_pk : (typeof p.End_PK === 'number' ? p.End_PK : startPk);

    const version = new DesignVersion({
      version_id: `${featId}_v1`,
      feature_id: featId,
      version: 1,
      status: 'confirmed',
      source: {
        kind: 'import',
        doc_ref: p.drawing_ref || p.Drawing_Ref || (subCode === 'DWKZ' ? 'DWKZ Alignment Plan' : 'KZDR Alignment Plan'),
        rev: '00',
        approval_level: 'A'
      },
      line_id: 'line_km',
      subsection: subCode,
      side: side,
      lane: lane,
      offset_m: typeof p.offsetM === 'number' ? p.offsetM : (side === 'L' ? -4.5 : (side === 'R' ? 4.5 : 0)),
      geometry: geomKind,
      ch: startPk,
      ch_start: startPk,
      ch_end: endPk,
      position_certainty: certainty,
      tolerance_m: certainty === 'exact' ? 0 : 4,
      category: p.category || p.Typology_Class || p.Type || 'Drainage Structure',
      type_code: typeCode,
      specs: p.specs || p.Dimensions || '',
      drawing_ref: p.drawing_ref || p.Drawing_Ref || '',
      confidence: p.confidence || (typeCode ? 'CONFIRMED' : 'NEEDS_VERIFICATION'),
      created_by: 'system_migration',
      created_at: '2026-09-15T00:00:00Z',
      raw_properties: p,
      raw_geometry: geom
    });
    version.raw_id = asset.id;

    const feature = new DesignFeature({
      feature_id: featId,
      created_at: '2026-09-15T00:00:00Z',
      active_version_id: version.version_id,
      history_version_ids: [version.version_id]
    });

    return { feature, version };
  }

  /**
   * Reconstruct Legacy GeoJSON Feature from Design Entities
   * Returns exact original object structure with 100% field parity
   */
  function designEntitiesToLegacyFeature(feature, version) {
    if (!feature || !version) return null;
    const feat = {
      type: 'Feature',
      properties: JSON.parse(JSON.stringify(version.raw_properties)),
      geometry: version.raw_geometry ? JSON.parse(JSON.stringify(version.raw_geometry)) : null
    };
    if (version.raw_id !== undefined) {
      feat.id = version.raw_id;
    }
    return feat;
  }

  // =========================================================================
  // 4. EXPORTS
  // =========================================================================
  const DataModel = {
    generateUUIDv7,
    extractUUIDv7Timestamp,
    Line,
    SubSection,
    Alignment,
    DesignFeature,
    DesignVersion,
    Absence,
    FieldRecord,
    Photo,
    InspectionRequest,
    Query,
    ChangeSet,
    Conflict,
    DEFAULT_LINES,
    DEFAULT_SUBSECTIONS,
    DEFAULT_ALIGNMENTS,
    normalizeSide,
    mapAssetToTypeCode,
    determineLane,
    determineCertainty,
    assetToDesignEntities,
    designEntitiesToLegacyFeature
  };

  root.DataModel = DataModel;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataModel;
  }
})();
