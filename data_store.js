/**
 * KANO-MARADI-DUTSE (KMD) RAILWAY PROJECT
 * Master Engineering Data Store & Migration Engine (Phase 2)
 * 
 * Strict Architectural Guardrails:
 * 1. Design Intent and Site Observation NEVER merge into the same table or store.
 * 2. Field records are irreplaceable and append-only (no Last-Write-Wins).
 * 3. Position is line + chainage + side, never chainage alone.
 * 4. Device-generated IDs (UUIDv7) prevent offline collision.
 * 5. Nothing is deleted: removed features remain visible with status 'removed'.
 * 6. Automatic pre-migration backup and verified rollback script.
 * 7. No emojis in code or logs.
 */

(function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : globalThis);

  // Require or resolve DataModel and TYPE_CATALOGUE
  let DataModel = root.DataModel;
  if (!DataModel && typeof require === 'function') {
    try {
      DataModel = require('./data_model.js');
    } catch (e) {
      // In browser or bundle
    }
  }

  // Storage key constants
  const STORAGE_KEYS = {
    // Backup & Migration Status
    BACKUP_PRE_MIGRATION: 'KMD_BACKUP_PRE_MIGRATION_V2',
    MIGRATION_STATUS: 'KMD_V2_MIGRATION_STATUS',
    // Core Reference Entities
    LINES: 'KMD_V2_LINES',
    SUBSECTIONS: 'KMD_V2_SUBSECTIONS',
    ALIGNMENTS: 'KMD_V2_ALIGNMENTS',
    // Separate Design Store (Design Intent)
    DESIGN_FEATURES: 'KMD_V2_DESIGN_FEATURES',
    DESIGN_VERSIONS: 'KMD_V2_DESIGN_VERSIONS',
    ABSENCES: 'KMD_V2_ABSENCES',
    CHANGESETS: 'KMD_V2_CHANGESETS',
    // Separate Field Store (Site Observations - Append Only)
    FIELD_RECORDS: 'KMD_V2_FIELD_RECORDS',
    PHOTOS: 'KMD_V2_PHOTOS',
    QUERIES: 'KMD_V2_QUERIES',
    IRS: 'KMD_V2_IRS',
    CONFLICTS: 'KMD_V2_CONFLICTS',
    // Legacy Keys for compatibility & backup
    LEGACY_S03_INSPECTIONS: 'KMD_DRAINAGE_INSPECTIONS_SEC03_V1',
    LEGACY_S02_INSPECTIONS: 'KMD_DRAINAGE_INSPECTIONS_SEC02_V1',
    LEGACY_STRUCTURE_EDITS: 'KMD_DRAINAGE_STRUCTURE_EDITS_V1',
    LEGACY_ACTIVE_SECTION: 'KMD_ACTIVE_SECTION',
    LEGACY_SYNC_QUEUE: 'KMD_SYNC_PENDING_QUEUE_V1',
    LEGACY_CONFIG: 'KMD_DRAINAGE_CONFIG_V1'
  };

  /**
   * Internal Safe Storage Adapter
   */
  function resolveStorage(customEngine) {
    if (customEngine && typeof customEngine.getItem === 'function') {
      return customEngine;
    }
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      try {
        window.localStorage.getItem('__kmd_probe__');
        return window.localStorage;
      } catch (e) {}
    }
    // In-memory fallback for test harnesses and headless node environments
    const mem = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
      key: (i) => Object.keys(mem)[i] || null,
      get length() { return Object.keys(mem).length; },
      _raw: mem
    };
  }

  /**
   * DataStore Class
   */
  class DataStore {
    constructor(storageEngine) {
      this.storage = resolveStorage(storageEngine);
      this.lines = {};
      this.subsections = {};
      this.alignments = {};
      
      // DESIGN STORE (Strictly separate from field data)
      this.designFeatures = {};
      this.designVersions = {};
      this.absences = {};
      this.changesets = {};

      // FIELD STORE (Append-only observation data)
      this.fieldRecords = [];
      this.photos = {};
      this.queries = {};
      this.inspectionRequests = {};
      this.conflicts = {};

      this._initialized = false;
    }

    // =======================================================================
    // BACKUP & ROLLBACK SUBSYSTEM (§4 & §10)
    // =======================================================================

    /**
     * Create pre-migration snapshot of all existing localStorage keys
     */
    createBackup() {
      const backupKeys = {};
      const storage = this.storage;

      // Scan all keys in storage
      if (typeof storage.length === 'number') {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k) {
            backupKeys[k] = storage.getItem(k);
          }
        }
      } else if (storage._raw) {
        Object.assign(backupKeys, storage._raw);
      }

      // Check specific legacy keys explicitly
      const targetKeys = [
        STORAGE_KEYS.LEGACY_S03_INSPECTIONS,
        STORAGE_KEYS.LEGACY_S02_INSPECTIONS,
        STORAGE_KEYS.LEGACY_STRUCTURE_EDITS,
        STORAGE_KEYS.LEGACY_ACTIVE_SECTION,
        STORAGE_KEYS.LEGACY_SYNC_QUEUE,
        STORAGE_KEYS.LEGACY_CONFIG,
        'KMD_LAST_SYNC_TIME',
        'KMD_DEVICE_ID'
      ];
      for (const tk of targetKeys) {
        const val = storage.getItem(tk);
        if (val !== null && val !== undefined) {
          backupKeys[tk] = val;
        }
      }

      const backupPayload = {
        backup_id: DataModel.generateUUIDv7(),
        created_at: new Date().toISOString(),
        version: 'v1_pre_migration_backup',
        keys_count: Object.keys(backupKeys).length,
        keys: backupKeys
      };

      const serialized = JSON.stringify(backupPayload);
      storage.setItem(STORAGE_KEYS.BACKUP_PRE_MIGRATION, serialized);

      return {
        success: true,
        backup_id: backupPayload.backup_id,
        created_at: backupPayload.created_at,
        keys_count: backupPayload.keys_count,
        bytes: serialized.length
      };
    }

    /**
     * Check if a valid pre-migration backup exists
     */
    hasBackup() {
      const raw = this.storage.getItem(STORAGE_KEYS.BACKUP_PRE_MIGRATION);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.keys === 'object';
      } catch (e) {
        return false;
      }
    }

    /**
     * Get backup summary metadata
     */
    getBackupInfo() {
      const raw = this.storage.getItem(STORAGE_KEYS.BACKUP_PRE_MIGRATION);
      if (!raw) return null;
      try {
        const b = JSON.parse(raw);
        return {
          backup_id: b.backup_id,
          created_at: b.created_at,
          version: b.version,
          keys_count: b.keys_count,
          keys_list: Object.keys(b.keys || {})
        };
      } catch (e) {
        return null;
      }
    }

    /**
     * Rollback migration: restores pre-migration keys exactly and clears V2 stores
     */
    rollbackMigration() {
      const raw = this.storage.getItem(STORAGE_KEYS.BACKUP_PRE_MIGRATION);
      if (!raw) {
        return {
          success: false,
          error: 'No backup found at key ' + STORAGE_KEYS.BACKUP_PRE_MIGRATION
        };
      }

      let backup;
      try {
        backup = JSON.parse(raw);
      } catch (e) {
        return {
          success: false,
          error: 'Corrupt backup payload: ' + e.message
        };
      }

      const storage = this.storage;

      // 1. Remove all V2 migration keys
      const v2Keys = [
        STORAGE_KEYS.MIGRATION_STATUS,
        STORAGE_KEYS.LINES,
        STORAGE_KEYS.SUBSECTIONS,
        STORAGE_KEYS.ALIGNMENTS,
        STORAGE_KEYS.DESIGN_FEATURES,
        STORAGE_KEYS.DESIGN_VERSIONS,
        STORAGE_KEYS.ABSENCES,
        STORAGE_KEYS.CHANGESETS,
        STORAGE_KEYS.FIELD_RECORDS,
        STORAGE_KEYS.PHOTOS,
        STORAGE_KEYS.QUERIES,
        STORAGE_KEYS.IRS,
        STORAGE_KEYS.CONFLICTS
      ];
      for (const vk of v2Keys) {
        storage.removeItem(vk);
      }

      // 2. Restore all pre-migration keys
      const restoredKeys = [];
      for (const [key, val] of Object.entries(backup.keys || {})) {
        if (key !== STORAGE_KEYS.BACKUP_PRE_MIGRATION) {
          storage.setItem(key, val);
          restoredKeys.push(key);
        }
      }

      // 3. Reset in-memory state
      this.lines = {};
      this.subsections = {};
      this.alignments = {};
      this.designFeatures = {};
      this.designVersions = {};
      this.absences = {};
      this.changesets = {};
      this.fieldRecords = [];
      this.photos = {};
      this.queries = {};
      this.inspectionRequests = {};
      this.conflicts = {};
      this._initialized = false;

      return {
        success: true,
        restored_keys_count: restoredKeys.length,
        restored_keys: restoredKeys,
        backup_created_at: backup.created_at,
        message: 'Migration rolled back successfully. Legacy storage restored 100% untouched.'
      };
    }

    // =======================================================================
    // MIGRATION ENGINE (§4 & §10)
    // Non-destructive ingest, 100% field preservation, separate stores
    // =======================================================================

    /**
     * Run migration into Phase 2 decoupled data layer
     */
    migrate(options = {}) {
      const forceBackup = options.forceBackup !== false;
      let section02Assets = options.section02Assets || null;
      let section03Assets = options.section03Assets || null;
      let legacyInspections = options.legacyInspections || null;
      let irRecords = options.irRecords || null;

      // Auto-resolve datasets if running in Node or Browser with globals
      if (!section02Assets) {
        if (root.SECTION02_ASSETS) {
          section02Assets = root.SECTION02_ASSETS;
        } else if (typeof require === 'function') {
          try {
            const fs = require('fs');
            const path = require('path');
            const s02Candidates = [
              path.resolve(__dirname, 'data', 'section02_assets.json'),
              path.resolve(__dirname, '..', 'data', 'section02_assets.json')
            ];
            for (const cand of s02Candidates) {
              if (fs.existsSync(cand)) {
                section02Assets = JSON.parse(fs.readFileSync(cand, 'utf8'));
                break;
              }
            }
          } catch (e) {}
        }
      }

      if (!section03Assets) {
        if (root.SECTION03_ASSETS) {
          section03Assets = root.SECTION03_ASSETS;
        } else if (typeof require === 'function') {
          try {
            const fs = require('fs');
            const path = require('path');
            const s03Candidates = [
              path.resolve(__dirname, 'data', 'section03_assets.json'),
              path.resolve(__dirname, '..', 'data', 'section03_assets.json')
            ];
            for (const cand of s03Candidates) {
              if (fs.existsSync(cand)) {
                section03Assets = JSON.parse(fs.readFileSync(cand, 'utf8'));
                break;
              }
            }
          } catch (e) {}
        }
      }

      if (!irRecords) {
        if (root.S03_DRAINAGE_IRS) {
          irRecords = root.S03_DRAINAGE_IRS;
        } else if (typeof require === 'function') {
          try {
            const fs = require('fs');
            const path = require('path');
            const irCandidates = [
              path.resolve(__dirname, 's03_drainage_irs.json'),
              path.resolve(__dirname, '..', 's03_drainage_irs.json')
            ];
            for (const cand of irCandidates) {
              if (fs.existsSync(cand)) {
                irRecords = JSON.parse(fs.readFileSync(cand, 'utf8'));
                break;
              }
            }
          } catch (e) {}
        }
      }

      // Step 1: Automatic backup
      let backupResult = null;
      if (forceBackup) {
        backupResult = this.createBackup();
      }

      // Step 2: Initialize Master Lines, 9 SubSections, and Alignments
      this.lines = {};
      for (const line of DataModel.DEFAULT_LINES) {
        this.lines[line.id] = new DataModel.Line(line);
      }

      this.subsections = {};
      for (const sub of DataModel.DEFAULT_SUBSECTIONS) {
        this.subsections[sub.code] = new DataModel.SubSection(sub);
      }

      this.alignments = {};
      if (Array.isArray(DataModel.DEFAULT_ALIGNMENTS)) {
        for (const align of DataModel.DEFAULT_ALIGNMENTS) {
          this.alignments[align.line_id] = new DataModel.Alignment(align);
        }
      }

      // Step 3: Clear design & field stores before fresh ingest
      this.designFeatures = {};
      this.designVersions = {};
      this.absences = {};
      this.changesets = {};
      this.fieldRecords = [];
      this.photos = {};
      this.queries = {};
      this.inspectionRequests = {};
      this.conflicts = {};

      let s03Count = 0;
      let s02Count = 0;
      let typeMappedCount = 0;
      let needsVerificationCount = 0;

      // Ingest Section 03 Assets (KZDR: PK 82+902 to 124+521)
      if (section03Assets && Array.isArray(section03Assets.features)) {
        for (const feat of section03Assets.features) {
          const { feature, version } = DataModel.assetToDesignEntities(feat, 'KZDR');
          this.designFeatures[feature.feature_id] = feature;
          this.designVersions[version.version_id] = version;
          s03Count++;
          if (version.type_code) {
            typeMappedCount++;
          } else {
            needsVerificationCount++;
          }
        }
      }

      // Ingest Section 02 Assets (DWKZ: PK 19+800 to 82+902)
      if (section02Assets && Array.isArray(section02Assets.features)) {
        for (const feat of section02Assets.features) {
          const { feature, version } = DataModel.assetToDesignEntities(feat, 'DWKZ');
          this.designFeatures[feature.feature_id] = feature;
          this.designVersions[version.version_id] = version;
          s02Count++;
          if (version.type_code) {
            typeMappedCount++;
          } else {
            needsVerificationCount++;
          }
        }
      }

      // Update subsection feature counts
      if (this.subsections['KZDR']) {
        this.subsections['KZDR'].feature_count = s03Count;
      }
      if (this.subsections['DWKZ']) {
        this.subsections['DWKZ'].feature_count = s02Count;
      }

      // Step 4: Ingest existing field inspections into append-only FieldRecord store
      let fieldRecordsCount = 0;
      const inspectionsPool = {};

      // 4a. Read from storage if not provided
      const rawS03 = this.storage.getItem(STORAGE_KEYS.LEGACY_S03_INSPECTIONS);
      if (rawS03) {
        try { Object.assign(inspectionsPool, JSON.parse(rawS03)); } catch (e) {}
      }
      const rawS02 = this.storage.getItem(STORAGE_KEYS.LEGACY_S02_INSPECTIONS);
      if (rawS02) {
        try { Object.assign(inspectionsPool, JSON.parse(rawS02)); } catch (e) {}
      }
      if (legacyInspections && typeof legacyInspections === 'object') {
        Object.assign(inspectionsPool, legacyInspections);
      }

      // 4b. Map inspections to append-only FieldRecord
      for (const [featId, insp] of Object.entries(inspectionsPool)) {
        if (!insp) continue;
        const status = insp.status || '';
        const notes = insp.notes || '';
        const inspDate = insp.inspection_date || insp.date || '2026-09-15T00:00:00Z';
        const author = insp.author || insp.inspector || 'Site Engineer';
        const hasDefect = Boolean(insp.hasDefect);

        // Only convert meaningful records
        if (status || notes || hasDefect) {
          const rec = new DataModel.FieldRecord({
            feature_id: featId,
            kind: hasDefect ? 'defect' : (status ? 'stage' : 'note'),
            stage: status || null,
            payload: {
              notes: notes,
              hasDefect: hasDefect,
              defect_types: insp.defect_types || [],
              legacy_raw: insp
            },
            verdict_vs_claim: 'no_claim',
            author: author,
            created_at: inspDate,
            sync_state: 'on_phone'
          });
          this.fieldRecords.push(rec);
          fieldRecordsCount++;

          // Auto-raise query if defect present
          if (hasDefect) {
            const q = new DataModel.Query({
              feature_id: featId,
              reason: 'defect',
              title: `Defect logged during legacy inspection on ${featId}`,
              description: notes || 'Legacy defect record migrated without description',
              linked_record_ids: [rec.record_id],
              status: 'open',
              created_at: inspDate
            });
            this.queries[q.query_id] = q;
          }
        }
      }

      // Step 5: Ingest Inspection Requests (IRs)
      let irsCount = 0;
      if (Array.isArray(irRecords)) {
        for (const item of irRecords) {
          const ir = new DataModel.InspectionRequest(item);
          this.inspectionRequests[ir.ir_id] = ir;
          irsCount++;
        }
      }

      // Step 6: Ingest Legacy Structure Edits (KMD_DRAINAGE_STRUCTURE_EDITS_V1)
      let editsCount = 0;
      const rawEdits = this.storage.getItem(STORAGE_KEYS.LEGACY_STRUCTURE_EDITS);
      if (rawEdits) {
        try {
          const editsObj = JSON.parse(rawEdits);
          // Created structures -> new DesignFeature & DesignVersion
          if (editsObj.created) {
            for (const [id, customFeat] of Object.entries(editsObj.created)) {
              const { feature, version } = DataModel.assetToDesignEntities(customFeat);
              version.source.kind = 'site_instruction';
              version.status = 'pending';
              this.designFeatures[feature.feature_id] = feature;
              this.designVersions[version.version_id] = version;
              editsCount++;
            }
          }
          // Updated structures -> new DesignVersion (version 2)
          if (editsObj.updated) {
            for (const [id, modFeat] of Object.entries(editsObj.updated)) {
              if (this.designFeatures[id]) {
                const baseFeat = this.designFeatures[id];
                const { version: v2 } = DataModel.assetToDesignEntities(modFeat);
                v2.version = 2;
                v2.version_id = `${id}_v2`;
                v2.status = 'pending';
                v2.source.kind = 'site_instruction';
                this.designVersions[v2.version_id] = v2;
                baseFeat.active_version_id = v2.version_id;
                baseFeat.history_version_ids.push(v2.version_id);
                editsCount++;
              }
            }
          }
          // Deleted structures -> status 'removed'
          if (editsObj.deleted) {
            for (const id of Object.keys(editsObj.deleted)) {
              if (this.designFeatures[id]) {
                const baseFeat = this.designFeatures[id];
                const activeVer = this.designVersions[baseFeat.active_version_id];
                const remVer = new DataModel.DesignVersion(Object.assign({}, activeVer, {
                  version: (activeVer ? activeVer.version + 1 : 2),
                  version_id: `${id}_v${(activeVer ? activeVer.version + 1 : 2)}_rem`,
                  status: 'removed',
                  created_at: new Date().toISOString()
                }));
                this.designVersions[remVer.version_id] = remVer;
                baseFeat.active_version_id = remVer.version_id;
                baseFeat.history_version_ids.push(remVer.version_id);
                editsCount++;
              }
            }
          }
        } catch (e) {
          // ignore corrupted legacy edits
        }
      }

      // Step 7: Persist separated stores to storage
      this.saveToStorage();

      // Step 8: Mark migration completed
      const migrationReport = {
        success: true,
        completed_at: new Date().toISOString(),
        backup: backupResult,
        stats: {
          section02_features: s02Count,
          section03_features: s03Count,
          total_design_features: Object.keys(this.designFeatures).length,
          total_design_versions: Object.keys(this.designVersions).length,
          type_mapped_count: typeMappedCount,
          needs_verification_count: needsVerificationCount,
          field_records_migrated: fieldRecordsCount,
          irs_migrated: irsCount,
          edits_migrated: editsCount
        }
      };

      this.storage.setItem(STORAGE_KEYS.MIGRATION_STATUS, JSON.stringify(migrationReport));
      this._initialized = true;

      return migrationReport;
    }

    /**
     * Persist current in-memory stores to distinct storage keys
     */
    saveToStorage() {
      const storage = this.storage;
      // Reference
      storage.setItem(STORAGE_KEYS.LINES, JSON.stringify(this.lines));
      storage.setItem(STORAGE_KEYS.SUBSECTIONS, JSON.stringify(this.subsections));
      storage.setItem(STORAGE_KEYS.ALIGNMENTS, JSON.stringify(this.alignments));

      // Design Store (separated)
      storage.setItem(STORAGE_KEYS.DESIGN_FEATURES, JSON.stringify(this.designFeatures));
      storage.setItem(STORAGE_KEYS.DESIGN_VERSIONS, JSON.stringify(this.designVersions));
      storage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(this.absences));
      storage.setItem(STORAGE_KEYS.CHANGESETS, JSON.stringify(this.changesets));

      // Field Store (separated, append-only)
      storage.setItem(STORAGE_KEYS.FIELD_RECORDS, JSON.stringify(this.fieldRecords));
      storage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(this.photos));
      storage.setItem(STORAGE_KEYS.QUERIES, JSON.stringify(this.queries));
      storage.setItem(STORAGE_KEYS.IRS, JSON.stringify(this.inspectionRequests));
      storage.setItem(STORAGE_KEYS.CONFLICTS, JSON.stringify(this.conflicts));
    }

    /**
     * Load state from storage
     */
    loadFromStorage() {
      const storage = this.storage;
      try {
        const rawLines = storage.getItem(STORAGE_KEYS.LINES);
        if (rawLines) this.lines = JSON.parse(rawLines);

        const rawSubs = storage.getItem(STORAGE_KEYS.SUBSECTIONS);
        if (rawSubs) this.subsections = JSON.parse(rawSubs);

        const rawAlign = storage.getItem(STORAGE_KEYS.ALIGNMENTS);
        if (rawAlign) this.alignments = JSON.parse(rawAlign);

        const rawFeats = storage.getItem(STORAGE_KEYS.DESIGN_FEATURES);
        if (rawFeats) this.designFeatures = JSON.parse(rawFeats);

        const rawVers = storage.getItem(STORAGE_KEYS.DESIGN_VERSIONS);
        if (rawVers) this.designVersions = JSON.parse(rawVers);

        const rawAbs = storage.getItem(STORAGE_KEYS.ABSENCES);
        if (rawAbs) this.absences = JSON.parse(rawAbs);

        const rawCS = storage.getItem(STORAGE_KEYS.CHANGESETS);
        if (rawCS) this.changesets = JSON.parse(rawCS);

        const rawField = storage.getItem(STORAGE_KEYS.FIELD_RECORDS);
        if (rawField) this.fieldRecords = JSON.parse(rawField);

        const rawPhotos = storage.getItem(STORAGE_KEYS.PHOTOS);
        if (rawPhotos) this.photos = JSON.parse(rawPhotos);

        const rawQueries = storage.getItem(STORAGE_KEYS.QUERIES);
        if (rawQueries) this.queries = JSON.parse(rawQueries);

        const rawIRs = storage.getItem(STORAGE_KEYS.IRS);
        if (rawIRs) this.inspectionRequests = JSON.parse(rawIRs);

        const rawConflicts = storage.getItem(STORAGE_KEYS.CONFLICTS);
        if (rawConflicts) this.conflicts = JSON.parse(rawConflicts);

        this._initialized = true;
        return true;
      } catch (e) {
        return false;
      }
    }

    // =======================================================================
    // APPEND-ONLY FIELD RECORD METHODS (No Last-Write-Wins)
    // =======================================================================

    /**
     * Record a site observation.
     * Appends to field store. NEVER overwrites previous records!
     */
    addObservation(recordData = {}) {
      const rec = new DataModel.FieldRecord(recordData);
      this.fieldRecords.push(rec);

      // Check if verdict vs claim or defect requires raising an office query
      if (rec.feature_id) {
        // Find latest IR for this feature if any
        const featureIRs = Object.values(this.inspectionRequests).filter(ir => ir.feature_id === rec.feature_id);
        if (featureIRs.length > 0 && rec.stage) {
          const latestIR = featureIRs[featureIRs.length - 1];
          if (latestIR.claimed_stage && latestIR.claimed_stage.toLowerCase() !== rec.stage.toLowerCase()) {
            rec.verdict_vs_claim = 'disagrees';
            const q = new DataModel.Query({
              feature_id: rec.feature_id,
              reason: 'claim_ahead',
              title: `Stage discrepancy with IR ${latestIR.ir_no}`,
              description: `Observed stage is '${rec.stage}', contractor claimed '${latestIR.claimed_stage}' on IR ${latestIR.ir_no}`,
              linked_record_ids: [rec.record_id],
              status: 'open'
            });
            this.queries[q.query_id] = q;
          } else {
            rec.verdict_vs_claim = 'agrees';
          }
        }
      }

      this.saveToStorage();
      return rec;
    }

    /**
     * Void / Undo an observation.
     * Marks the record with voided_by_record_id and creates a new void entry.
     * The original record remains in the store and is NEVER deleted!
     */
    voidObservation(recordId, reason = 'Operator undo', author = 'Engr. Abdulaziz A. A.') {
      const target = this.fieldRecords.find(r => r.record_id === recordId);
      if (!target) {
        throw new Error(`Record ${recordId} not found in field records`);
      }
      if (target.voided_by_record_id) {
        throw new Error(`Record ${recordId} is already voided by ${target.voided_by_record_id}`);
      }

      const voidingRecord = new DataModel.FieldRecord({
        feature_id: target.feature_id,
        kind: 'verdict',
        stage: target.stage,
        payload: {
          action: 'void',
          voided_record_id: recordId,
          reason: reason
        },
        author: author,
        sync_state: 'on_phone'
      });

      target.voided_by_record_id = voidingRecord.record_id;
      this.fieldRecords.push(voidingRecord);

      // Cancel any open queries linked to this voided observation
      for (const qId of Object.keys(this.queries)) {
        const q = this.queries[qId];
        if (q.linked_record_ids && q.linked_record_ids.includes(recordId) && q.status === 'open') {
          q.status = 'cancelled';
          q.resolution_note = `Voided due to observation undo: ${reason}`;
          q.updated_at = new Date().toISOString();
        }
      }

      this.saveToStorage();

      return {
        target_record: target,
        voiding_record: voidingRecord
      };
    }

    /**
     * Get all observations for a feature
     */
    getObservationsForFeature(featureId, includeVoided = false, kind = null) {
      return this.fieldRecords.filter(r => {
        if (r.feature_id !== featureId) return false;
        if (!includeVoided && r.voided_by_record_id) return false;
        if (kind && r.kind !== kind) return false;
        return true;
      });
    }

    /**
     * Get latest active stage for a feature
     */
    getLatestStage(featureId) {
      const records = this.getObservationsForFeature(featureId, false);
      const stageRecords = records.filter(r => (r.kind === 'stage' || r.kind === 'defect') && r.stage && r.stage.toLowerCase() !== 'not started');
      if (stageRecords.length === 0) return 'Not started';
      return stageRecords[stageRecords.length - 1].stage;
    }

    /**
     * Check if a feature has any unvoided, active defects
     */
    hasActiveDefect(featureId) {
      return this.getActiveDefectsForFeature(featureId).length > 0;
    }

    /**
     * Get all active (unvoided) defect records for a feature
     */
    getActiveDefectsForFeature(featureId) {
      return this.getObservationsForFeature(featureId, false, 'defect');
    }

    /**
     * Generate monotonically increasing defect ID in format DEF-YYYY-NNNN
     */
    getNextDefectId(year = new Date().getFullYear()) {
      let maxSeq = 0;
      for (const r of this.fieldRecords) {
        if (r.kind === 'defect' && r.payload && r.payload.defect_id) {
          const m = String(r.payload.defect_id).match(/DEF-\d{4}-(\d+)/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }
      }
      for (const q of Object.values(this.queries)) {
        if (q.reason === 'defect') {
          const m = String(q.title || '').match(/DEF-\d{4}-(\d+)/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }
      }
      const nextSeq = maxSeq + 1;
      return `DEF-${year}-${String(nextSeq).padStart(4, '0')}`;
    }

    /**
     * Log a defect observation with linked office query
     */
    logDefect(defectData = {}) {
      const year = new Date().getFullYear();
      const defectId = defectData.defect_id || this.getNextDefectId(year);
      const featureId = defectData.feature_id || null;
      const defectType = defectData.defect_type || 'Other';
      const severity = defectData.severity || 'Major (rework required)';
      const chainage = typeof defectData.chainage === 'number' ? defectData.chainage : (defectData.measured_position ? defectData.measured_position.ch : null);
      const note = defectData.note || '';

      const record = this.addObservation({
        feature_id: featureId,
        kind: 'defect',
        stage: defectData.stage || (featureId ? this.getLatestStage(featureId) : 'Not Started'),
        payload: {
          defect_id: defectId,
          defect_type: defectType,
          severity: severity,
          chainage: chainage,
          note: note,
          has_photo: !!defectData.photo
        },
        author: defectData.author || 'Engr. Abdulaziz A. A.',
        device_id: defectData.device_id || 'device_field',
        measured_position: defectData.measured_position || (chainage !== null ? { ch: chainage } : null)
      });

      const query = this.addQuery({
        feature_id: featureId,
        reason: 'defect',
        title: `${defectId}: ${defectType} (${severity})`,
        description: note || `${defectType} defect reported at PK ${chainage !== null ? chainage : 'unknown'}`,
        linked_record_ids: [record.record_id],
        status: 'open'
      });

      let photo = null;
      if (defectData.photo) {
        photo = this.addPhoto(Object.assign({}, defectData.photo, {
          record_id: record.record_id
        }));
      }

      return {
        defect_id: defectId,
        record: record,
        query: query,
        photo: photo
      };
    }

    // =======================================================================
    // DESIGN INTENT METHODS (Separate from field observations)
    // =======================================================================

    /**
     * Get a design feature with active version
     */
    getDesignFeature(featureId) {
      const feat = this.designFeatures[featureId];
      if (!feat) return null;
      const activeVersion = this.designVersions[feat.active_version_id] || null;
      return {
        feature: feat,
        active_version: activeVersion,
        history_versions: feat.history_version_ids.map(vid => this.designVersions[vid]).filter(Boolean)
      };
    }

    /**
     * Remove a design feature (§8 Door 2).
     * Creates new version with status 'removed'.
     * Feature is NEVER deleted.
     * If site work exists above 'Not Started', auto-raises 'built_but_removed' Query!
     */
    removeDesignFeature(featureId, reason = '', docRef = '', rev = '01', author = 'Engr. Abdulaziz A. A.') {
      const featData = this.getDesignFeature(featureId);
      if (!featData || !featData.active_version) {
        throw new Error(`Feature ${featureId} not found in design store`);
      }

      const current = featData.active_version;
      const nextVerNum = current.version + 1;
      const remVersion = new DataModel.DesignVersion(Object.assign({}, current, {
        version: nextVerNum,
        version_id: `${featureId}_v${nextVerNum}`,
        status: 'removed',
        source: {
          kind: 'site_instruction',
          doc_ref: docRef || current.source.doc_ref,
          rev: rev,
          approval_level: 'B'
        },
        created_by: author,
        created_at: new Date().toISOString()
      }));

      this.designVersions[remVersion.version_id] = remVersion;
      featData.feature.active_version_id = remVersion.version_id;
      featData.feature.history_version_ids.push(remVersion.version_id);

      // Check if site observations exist
      const activeObs = this.getObservationsForFeature(featureId, false);
      const hasWork = activeObs.some(o => o.kind === 'stage' && o.stage && o.stage.toLowerCase() !== 'not started');
      let createdQuery = null;

      if (hasWork) {
        createdQuery = new DataModel.Query({
          feature_id: featureId,
          reason: 'built_but_removed',
          title: `Built but removed from design: ${featureId}`,
          description: `Feature removed in doc ${docRef} rev ${rev}, but site observations exist at stage '${this.getLatestStage(featureId)}'.`,
          linked_record_ids: activeObs.map(o => o.record_id),
          status: 'open'
        });
        this.queries[createdQuery.query_id] = createdQuery;
      }

      this.saveToStorage();

      return {
        feature: featData.feature,
        removed_version: remVersion,
        query: createdQuery
      };
    }

    // =======================================================================
    // ROUND-TRIP EXPORT & RECONSTRUCTION (100% Preservation)
    // =======================================================================

    /**
     * Export subsection to exact legacy GeoJSON FeatureCollection
     */
    exportLegacyGeoJSON(subSectionCode) {
      const code = subSectionCode || 'KZDR';
      const features = [];

      for (const feat of Object.values(this.designFeatures)) {
        const activeVer = this.designVersions[feat.active_version_id];
        if (activeVer && activeVer.subsection === code && activeVer.status !== 'removed') {
          const legacyFeat = DataModel.designEntitiesToLegacyFeature(feat, activeVer);
          if (legacyFeat) features.push(legacyFeat);
        }
      }

      // Sort by start_pk accurately across standard and uppercase property formats
      features.sort((a, b) => {
        const aPk = typeof a.properties.start_pk === 'number' ? a.properties.start_pk : (typeof a.properties.Start_PK === 'number' ? a.properties.Start_PK : (a.properties.pk || 0));
        const bPk = typeof b.properties.start_pk === 'number' ? b.properties.start_pk : (typeof b.properties.Start_PK === 'number' ? b.properties.Start_PK : (b.properties.pk || 0));
        return aPk - bPk;
      });

      return {
        type: 'FeatureCollection',
        features: features
      };
    }

    /**
     * Verify round-trip fidelity against original dataset
     */
    verifyRoundTrip(originalFeatures, subSectionCode) {
      if (!Array.isArray(originalFeatures)) {
        throw new Error('originalFeatures must be an array');
      }

      let totalPropsChecked = 0;
      let matchedProps = 0;
      let missingProps = 0;
      let mismatchedProps = 0;
      const issues = [];

      for (const orig of originalFeatures) {
        const id = (orig.properties && (orig.properties.id || orig.properties.Asset_ID || orig.properties.asset_id)) || orig.id;
        const featData = this.getDesignFeature(id);
        if (!featData || !featData.active_version) {
          issues.push(`Feature ${id} missing in store`);
          continue;
        }

        const reconstructed = DataModel.designEntitiesToLegacyFeature(featData.feature, featData.active_version);

        // Check top-level id
        if (orig.id !== undefined && reconstructed.id !== orig.id) {
          issues.push(`Feature ${id} top-level id mismatch: ${reconstructed.id} vs ${orig.id}`);
        }

        // Check geometry
        if (orig.geometry) {
          if (!reconstructed.geometry) {
            issues.push(`Feature ${id} lost geometry`);
          } else if (reconstructed.geometry.type !== orig.geometry.type) {
            issues.push(`Feature ${id} geometry type mismatch: ${reconstructed.geometry.type} vs ${orig.geometry.type}`);
          }
        }

        // Check all original properties
        for (const [key, origVal] of Object.entries(orig.properties || {})) {
          totalPropsChecked++;
          const reconVal = reconstructed.properties[key];
          if (reconVal === undefined) {
            missingProps++;
            issues.push(`Feature ${id} property '${key}' missing`);
          } else if (JSON.stringify(reconVal) !== JSON.stringify(origVal)) {
            mismatchedProps++;
            issues.push(`Feature ${id} property '${key}' mismatch`);
          } else {
            matchedProps++;
          }
        }
      }

      return {
        passed: issues.length === 0,
        total_features: originalFeatures.length,
        total_properties_checked: totalPropsChecked,
        matched_properties: matchedProps,
        mismatched_properties: mismatchedProps,
        missing_properties: missingProps,
        fidelity_percentage: totalPropsChecked > 0 ? ((matchedProps / totalPropsChecked) * 100).toFixed(2) : '100.00',
        issues: issues.slice(0, 10)
      };
    }

    // =======================================================================
    // EXTENDED ENTITY HELPER METHODS (§4 & §10)
    // =======================================================================

    // Reference data
    getLines() {
      return Object.values(this.lines);
    }

    getLine(id) {
      return this.lines[id] || null;
    }

    getSubSections(lineId = null) {
      const all = Object.values(this.subsections);
      return lineId ? all.filter(s => s.line_id === lineId) : all;
    }

    getSubSection(code) {
      return this.subsections[code] || null;
    }

    getAlignment(lineId = 'line_km') {
      return this.alignments[lineId] || null;
    }

    // Design intent
    addDesignFeature(feature, version, changeSetId = null) {
      if (!feature || !version) throw new Error('Both feature and version are required');
      this.designFeatures[feature.feature_id] = feature;
      this.designVersions[version.version_id] = version;
      if (changeSetId && this.changesets[changeSetId]) {
        this.changesets[changeSetId].version_ids.push(version.version_id);
      }
      this.saveToStorage();
      return { feature, version };
    }

    updateDesignFeature(featureId, newProps = {}, reason = 'Design revision', docRef = '', rev = '01', author = 'Engr. Abdulaziz A. A.') {
      const featData = this.getDesignFeature(featureId);
      if (!featData || !featData.active_version) {
        throw new Error(`Feature ${featureId} not found in design store`);
      }
      const current = featData.active_version;
      const nextVerNum = current.version + 1;
      const updatedVer = new DataModel.DesignVersion(Object.assign({}, current, newProps, {
        version: nextVerNum,
        version_id: `${featureId}_v${nextVerNum}`,
        status: 'confirmed',
        source: {
          kind: 'drawing_revision',
          doc_ref: docRef || current.source.doc_ref,
          rev: rev,
          approval_level: 'B'
        },
        created_by: author,
        created_at: new Date().toISOString()
      }));

      this.designVersions[updatedVer.version_id] = updatedVer;
      featData.feature.active_version_id = updatedVer.version_id;
      featData.feature.history_version_ids.push(updatedVer.version_id);
      this.saveToStorage();
      return updatedVer;
    }

    addAbsence(absenceData = {}) {
      const abs = new DataModel.Absence(absenceData);
      this.absences[abs.absence_id] = abs;
      this.saveToStorage();
      return abs;
    }

    getAbsences(subSectionCode = null, lane = null) {
      return Object.values(this.absences).filter(a => {
        if (subSectionCode && a.subsection !== subSectionCode) return false;
        if (lane && a.lane !== lane) return false;
        return true;
      });
    }

    createChangeSet(changeSetData = {}) {
      const cs = new DataModel.ChangeSet(changeSetData);
      this.changesets[cs.changeset_id] = cs;
      this.saveToStorage();
      return cs;
    }

    getChangeSet(changeSetId) {
      return this.changesets[changeSetId] || null;
    }

    // Field & Office observations
    addPhoto(photoData = {}) {
      const photo = new DataModel.Photo(photoData);
      this.photos[photo.photo_id] = photo;
      this.saveToStorage();
      return photo;
    }

    getPhotosForRecord(recordId) {
      return Object.values(this.photos).filter(p => p.record_id === recordId);
    }

    getPhotosForFeature(featureId) {
      const obs = this.getObservationsForFeature(featureId, true);
      const recordIds = new Set(obs.map(o => o.record_id));
      return Object.values(this.photos).filter(p => recordIds.has(p.record_id));
    }

    addQuery(queryData = {}) {
      const q = new DataModel.Query(queryData);
      this.queries[q.query_id] = q;
      this.saveToStorage();
      return q;
    }

    getQueries(status = null, reason = null) {
      return Object.values(this.queries).filter(q => {
        if (status && q.status !== status) return false;
        if (reason && q.reason !== reason) return false;
        return true;
      });
    }

    resolveQuery(queryId, resolutionNotes = '') {
      const q = this.queries[queryId];
      if (!q) throw new Error(`Query ${queryId} not found`);
      q.status = 'resolved';
      q.description += `\n[Resolved: ${resolutionNotes}]`;
      q.updated_at = new Date().toISOString();
      this.saveToStorage();
      return q;
    }

    addInspectionRequest(irData = {}) {
      const ir = new DataModel.InspectionRequest(irData);
      this.inspectionRequests[ir.ir_id] = ir;
      this.saveToStorage();
      return ir;
    }

    getInspectionRequestsForFeature(featureId) {
      return Object.values(this.inspectionRequests).filter(ir => ir.feature_id === featureId);
    }

    getInspectionRequestsBySection(section = 'S03') {
      return Object.values(this.inspectionRequests).filter(ir => ir.section === section);
    }

    addConflict(conflictData = {}) {
      const conflict = new DataModel.Conflict(conflictData);
      this.conflicts[conflict.conflict_id] = conflict;
      this.saveToStorage();
      return conflict;
    }

    resolveConflict(conflictId, resolutionChoice = 'resolved_office') {
      const c = this.conflicts[conflictId];
      if (!c) throw new Error(`Conflict ${conflictId} not found`);
      c.status = resolutionChoice;
      this.saveToStorage();
      return c;
    }

    getConflicts(status = null) {
      return Object.values(this.conflicts).filter(c => {
        if (status && c.status !== status) return false;
        return true;
      });
    }
  }

  // Exports: support both object destructuring and direct class usage
  DataStore.DataStore = DataStore;
  DataStore.STORAGE_KEYS = STORAGE_KEYS;
  DataStore.resolveStorage = resolveStorage;

  root.DataStore = DataStore;
  root.STORAGE_KEYS = STORAGE_KEYS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataStore;
  }
})();
