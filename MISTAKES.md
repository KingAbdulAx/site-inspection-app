# Error Log & Operational Mistakes Tracking

This document logs troubleshooting steps, operational mistakes, failed commands, and bug fixes across the KMD Drainage Field Inspector application repository.

See also the master workspace log at `../MISTAKES.md`.

## Log Entries

### [2026-09-25 10:48] — Unlined Type Heuristic & Composite Construction Stage Mismatches

- **Date/Time:** 2026-09-25 10:48 (WAT)
- **Context:** Hardening Phase 5 dynamic stage ladder resolution (`RecordView.resolveStageLadder`) and 6-segment stage meter (`WalkDrawerLogic.computeStageMeterLevel`).
- **The Mistake/Error:**
  1. `RecordView.resolveStageLadder` used strict string equality (`code === 'T3' || code === '3'`), causing descriptive type strings like `'Type 3'` or `'Type 4'` to fail unlined detection and fall back to the 7-stage concrete ladder (`['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed']`).
  2. `WalkDrawerLogic.computeStageMeterLevel` checked only exact equality against canonical single-word stage names, returning `0` (unstarted) for real-world composite construction progress descriptions such as `'Rebar / Shuttering'` or `'Excavation / Blinding'`.
- **The Fix:**
  1. Updated `resolveStageLadder` with boundary regex `/^(T[345]|[345]|TYPE\s*[345]|CH[-_ ]?A)$/i` and `/\b(T[345]|TYPE\s*[345]|CH[-_ ]?A)\b/i`, ensuring all variants of T3/T4/T5/CH-A resolve to 3 unlined stages without false matching T13/T14/T15.
  2. Updated `computeStageMeterLevel` with hierarchical substring classifiers (`norm.includes('concret') -> 5`, `norm.includes('shutter') -> 4`, `norm.includes('rebar') -> 3`, `norm.includes('blind') -> 2`, `norm.includes('excavat') -> 1`), while preserving `excavated -> 3` for unlined ditches.
- **Lesson Learned:** Civil engineering field databases often contain human-entered variants (`Type 3` vs `T3`, `Rebar / Shuttering` vs `Rebar`); always employ word-boundary regex and partial substring heuristics rather than strict string equality for taxonomy mapping.

### [2026-09-25 10:46] — Ripgrep (rg) Not Available on Windows PowerShell PATH

- **Date/Time:** 2026-09-25 10:46 (WAT)
- **Context:** Searching for method occurrences in `data_store.js` using `rg -n "addObservation" data_store.js`.
- **The Mistake/Error:** Attempted to invoke `rg` executable directly from PowerShell, triggering `CommandNotFoundException: The term 'rg' is not recognized as the name of a cmdlet, function, script file, or operable program`.
- **The Fix:** Used inline `node -e` scripts with `fs.readFileSync` for precise code symbol location in Windows environments.
- **Lesson Learned:** Do not assume external Unix CLI tools like `rg` or `grep` exist on the system PATH in Windows; prefer Node.js standard libraries.

### [2026-09-25 10:40] — Truncated Function Body SyntaxError & Headless DOM Undefined in WalkDrawer

- **Date/Time:** 2026-09-25 10:40 (WAT)
- **Context:** Executing Phase 5 automated test runner `node app/scripts/test_record_flow.js`.
- **The Mistake/Error:**
  1. A prior edit in `app/walk_drawer.js` displaced the closing brace of `extractCategoryCounts`, leaving `computeStageMeterLevel` declared illegally inside a loop and throwing `SyntaxError: In strict mode code, functions can only be declared at top level or inside a block`.
  2. `WalkDrawer.prototype.createStageMeter` unconditionally called `document.createElement('div')`, throwing `ReferenceError: document is not defined` when running in headless Node.js test environments.
- **The Fix:**
  1. Restored the proper for-loop termination in `extractCategoryCounts` and placed `computeStageMeterLevel` at the module object level.
  2. Added a headless environment check (`typeof document === 'undefined'`) in `createStageMeter` that returns an object containing `level`, `stageName`, `numSegments`, and a mock `querySelectorAll` method matching partial and complete segment classes.
- **Lesson Learned:** Always test code execution in both Node.js headless runtime and browser DOM contexts when authoring isomorphic UMD components.

### [2026-09-25 10:21] — PowerShell && Command Chaining Syntax Error

- **Date/Time:** 2026-09-25 10:21 (WAT)
- **Context:** Attempting to chain multiple test suites in a single command (`node ... && node ...`) in PowerShell.
- **The Mistake/Error:** Executed command with bash-style `&&` operator in Windows PowerShell, which rejected the token: `The token '&&' is not a valid statement separator in this version`.
- **The Fix:** Use semicolon `;` separator or execute each test runner in a separate command execution.
- **Lesson Learned:** Windows PowerShell (prior to PowerShell 7) does not support `&&` statement chaining; always use `;` or separate executions.

### [2026-09-25 10:16] — Executed Git Command from Parent Directory Missing .git Repository

- **Date/Time:** 2026-09-25 10:16 (WAT)
- **Context:** Inspecting git status of modified files across the PWA application codebase.
- **The Mistake/Error:** Executed `git status -s` in `TEAM` root directory instead of `TEAM/app`, triggering `fatal: not a git repository (or any of the parent directories): .git`.
- **The Fix:** Run git commands with working directory explicitly set to `c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app` where the `.git` repository resides.
- **Lesson Learned:** Check the repository boundary before running VCS commands; `app/` is an independent git repository nested inside `TEAM/`.

### [2026-09-25 10:13] — MockStorage Constructor TypeError in Phase 5 Test Suite

- **Date/Time:** 2026-09-25 10:13 (WAT)
- **Context:** Running standalone Node.js automated test runner `node app/scripts/test_record_flow.js` for Phase 5.
- **The Mistake/Error:** Executed `const storage = new MockStorage();` assuming `MockStorage` was an exported constructor class from `data_store.js`. In `data_store.js`, mock storage is created via helper function `createMockStorage()`, resulting in `TypeError: MockStorage is not a constructor`.
- **The Fix:** Implemented standard `createMockStorage(initialData)` helper returning localStorage-compatible interface (`getItem`, `setItem`, `removeItem`, `length`, `key`), and initialized `DataStore` with `new DataStore(createMockStorage())`.
- **Lesson Learned:** Check the exact export contract and function signature in `data_store.js` before assuming constructor semantics in test runners.

### [2026-09-24 23:05] — Linear Hit-Testing Failure, Track CL Shift on Non-390px Viewports & Type Code Mangling in Phase 4 Walk Strip

- **Date/Time:** 2026-09-24 23:05 (WAT)
- **Context:** Hardening and verifying Phase 4 Walk Strip, At-You Bar, WalkDrawer, and Identify View components (§6.1, §6.2 & §10).
- **The Mistake/Error:**
  1. `handleTap` in `walk_strip.js` calculated distance only to `ch_start`. Tapping anywhere along the body of an extended linear feature (e.g. 30m ditch) was completely ignored.
  2. In `WalkStripLayout`, columns were hardcoded at 390px while `transformX()` used `this.width - nominalX`. On a 412px viewport, facing flip shifted the track centerline (CL) 22px laterally (from 195px to 217px).
  3. `formatTypeCode` naively prepended `'T'` to all non-numbered codes (`replace(/^T/i, '')`), mangling Pipe Culverts (`PC`) and Box Culverts (`BC`) into non-existent types (`'TPC'`, `'TBC'`).
  4. Header row used floating flex margins (`space-between`) with 11 spans squished in the center with 4px gap, completely misaligned with the canvas lanes below.
  5. When accuracy > 10m (Poor GPS), chainage lacked the mandatory `"≈ "` prefix, side was still displayed instead of withheld as `"SIDE ?"`, and reading line stayed static instead of expanding to `±accuracy_m` band.
  6. `WalkDrawer` had zero `TypeIcons` cross-section SVG integration, lacked `data-feature-id` and `scrollToFeature()`, and At-You Bar lacked swipe-up gesture detection.
  7. Cross-section view in `identify_view.js` failed to invert lateral coordinates and headers (`◀ RIGHT` / `LEFT ▶`) when facing decreasing, and displayed up to 4 disabled `— (empty)` dummy buttons.
- **The Fix:**
  1. Replaced point-only hit test in `handleTap` with a full bounding-box vertical extent test `(y >= minY - 8 && y <= maxY + 8 && dx <= 20)`.
  2. Implemented proportional column scaling via `getColumnBounds()` and `getColumnXCenter()`, ensuring track CL is always exactly at `width / 2` regardless of viewport width or facing.
  3. Standardized `formatTypeCode()` across all modules: numeric ditches (1..16, 1L) receive `'T'` prefix (`'T12'`, `'T1L'`), while non-numeric codes (`'PC'`, `'BC'`, `'CH-A'`, `'D-SD'`, `'BRG'`, `'OP'`, `'UP'`) are strictly preserved.
  4. Replaced flex header row with a 2-subrow header (14px indicators + 26px columns) matching exact physical column pixel boundaries.
  5. Implemented Poor GPS mode in `WalkView` and `WalkStrip`: prefix `"≈ "` on chainage, `"SIDE ?"` lateral indicator, and `±accuracy_m` shaded uncertainty band.
  6. Integrated `TypeIcons` SVGs into drawer rows, added `data-feature-id`, implemented smooth `scrollToFeature()` with highlight flash, and wired swipe-up touch listeners.
  7. Added facing inversion to `IdentifyLogic.assignBubbleNumbers` and `generateCrossSectionSvg`, and cleaned button grid to render only active bubble buttons plus "As a list ▲".
- **Lesson Learned:** Always test UI canvas coordinates and responsive transforms across multiple target viewports (360px, 390px, 412px, 480px), and verify that hit-testing matches continuous geometric intervals rather than singular start points.

### [2026-09-24 22:45] — Geometric Underflow Boundary Condition on Short Derived Extents (< 8m)

- **Date/Time:** 2026-09-24 22:45 (WAT)
- **Context:** Implementing derived extent 4m dotted cap geometry in `walk_strip.js` (`calculateDerivedExtentGeometry`).
- **The Mistake/Error:** Naively subtracting 4m caps from both ends of a linear feature (`startCh + 4m` to `endCh - 4m`) produces an inverted or negative main span when the feature length is less than or equal to 8.0 meters (e.g. 6m inlet transitions or short chute connections).
- **The Fix:** Implemented a boundary check: when `lengthM < (DERIVED_CAP_METERS * 2)` (8m), disable dual caps (`hasDerivedCaps = false`) and render the entire feature span continuously without inverted negative coordinates.
- **Lesson Learned:** Always check whether dual boundary deductions exceed the total length of the geometry, especially when applying fixed-dimension end treatments to parameterized linear features.

### [2026-09-24 22:20] — Civil Station Rounding Error (PK 0+1000) & European Comma Decimal Truncation in Position Engine

- **Date/Time:** 2026-09-24 22:20 (WAT)
- **Context:** Implementing and hardening the Phase 3 Linear Referencing Position Engine (`position_engine.js`).
- **The Mistake/Error:**
  1. `formatPk` computed `Math.floor(abs / 1000)` before rounding the meter part. When `ch = 999.8` or `19999.9`, `Math.round(m)` evaluated to 1000 without incrementing `km`, producing illegal stationing strings like `PK 0+1000` and `PK 19+1000`.
  2. `parsePk` used `parseFloat` on the meter part without converting Continental European decimal commas to dots (`replace(/[≈~PKpk\s]/g, '')`). Stated chainages like `PK 82+902,439` were parsed as `82902`, truncating the fractional meters.
  3. `computeFacing` reset facing to `'increasing'` on stationary GPS jitter (< 0.3m) and lacked line tracking, causing bogus cross-line `dCh` jumps upon line switching.
  4. `projectGps` returned `null` when GPS signal dropped (`fix == null`) even when an anchor fix was active.
- **The Fix:**
  1. In `formatPk`, compute rounded absolute meters first before splitting into `km` and `m` so `m` is strictly bound to `[0, 999]`.
  2. In `parsePk`, replace commas with dots (`.replace(/,/g, '.')`) prior to splitting and parsing.
  3. In `computeFacing`, implement stationary jitter hysteresis (`this.lastFacing`) and verify line identity before computing `dCh`.
  4. In `projectGps`, fall back to `getCurrentPosition()` if anchored when `fix` is null.
- **Lesson Learned:** Civil stationing formatters must perform integer kilometer rollovers on rounded values, and geodetic trend trackers must incorporate deadbands to ignore sub-meter stationary hardware noise.

### [2026-09-24 22:19] — PowerShell Nested Quote and Slash Parser Error in Node CLI Execution

- **Date/Time:** 2026-09-24 22:19 (WAT)
- **Context:** Evaluating `parsePk` with comma decimals via `node -e` in PowerShell.
- **The Mistake/Error:** Used single quotes outer with double quotes inner or unescaped quotes in PowerShell CLI, causing Node to throw `SyntaxError: Unexpected end of input` and `Unexpected token '.'`.
- **The Fix:** Use PowerShell-safe string escaping with double quotes outer and single quotes inner: `node -e "const { parsePk } = require('./position_engine.js'); console.log(parsePk('PK 82+902,439'));"`.
- **Lesson Learned:** When running one-liner node evaluations in PowerShell, always wrap the outer `-e` expression in double quotes and inner strings in single quotes.

### [2026-09-24 22:07] — Fatal Git Error Running Command in Workspace Parent Rather Than app Repo

- **Date/Time:** 2026-09-24 22:07 (WAT)
- **Context:** Checking git status of modified files across the PWA codebase.
- **The Mistake/Error:** Executed `git status` with working directory set to `c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM` instead of `c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app` where `.git` is initialized, triggering `fatal: not a git repository`.
- **The Fix:** Run git commands with working directory `c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app`.
- **Lesson Learned:** Always check the repository root location (`app/` in this workspace) when running git operations.

### [2026-09-24 22:02] — Manual Degrees to Radians Double Conversion in Test Point Generation

- **Date/Time:** 2026-09-24 22:02 (WAT)
- **Context:** Setting up synthetic 15m lateral offset test in `test_position_engine.js`.
- **The Mistake/Error:** Formula used `15.0 / (scale * Math.PI / 180.0)`, multiplying scale by `Math.PI / 180.0` in the denominator which yielded radians instead of degrees, producing an 858-meter offset instead of 15 meters.
- **The Fix:** Used the engine's built-in `projectChainageOffsetToGps` directly to place the test points, ensuring exact round-trip validation.
- **Lesson Learned:** Avoid manual degree/radian arithmetic in tests when the engine's own inverse projection is available to place ground-truth test points.

### [2026-09-24 21:52] — IndexError on Empty LineStrings in KMD.kml MultiGeometry

- **Date/Time:** 2026-09-24 21:52 (WAT)
- **Context:** Inspecting geometry tags inside `TRA-H-GTR_Eixo` in `KMZs KAMA/KMD.kml`.
- **The Mistake/Error:** Assumed `mg.findall('.//kml:LineString', ns)` always contains LineStrings; Placemark 0 contained different child elements or zero LineStrings, resulting in `IndexError: list index out of range` on `lines[0]`.
- **The Fix:** Guard `if len(lines) > 0:` and inspect all child elements of MultiGeometry (`[c.tag for c in mg]`).
- **Lesson Learned:** Always check array length and child tag varieties before indexing geometry collections when parsing KML MultiGeometry.

### [2026-09-24 21:51] — PowerShell Escaped Curly Brace and Nested Quote ParserError in Inline Python

- **Date/Time:** 2026-09-24 21:51 (WAT)
- **Context:** Inspecting Placemark element tags in `KMZs KAMA/KMD.kml` via `python -c` in PowerShell.
- **The Mistake/Error:** Used `split(\"}\")` within a set comprehension inside `python -c "..."` under PowerShell, which PowerShell interpreted as a block delimiter token error (`Unexpected token '}' in expression or statement`).
- **The Fix:** Place Python code into dedicated script files or avoid curly braces and double-quote nesting inside `-c` commands in PowerShell.
- **Lesson Learned:** Always write inspection scripts to standalone `.py` files instead of using inline python with braces in PowerShell.

### [2026-09-15 08:45] — Centerline Circular Bearing Wrap, Cross-Section Move Partition, and SW Precache Desync

- **Date/Time:** 2026-09-15 08:45 (WAT)
- **Context:** Implementing in-app Edit Mode, alignment geometry calculations, cross-corridor section switching, and PWA offline caching.
- **The Mistake/Error:**
  1. *Bearing Wrap Disorientation:* `interpolateCenterline` used linear arithmetic `p0.bearing + t * (p1.bearing - p0.bearing)`. Across 9 track locations where bearings cross North (e.g. PK 85+650 [359.31°] -> PK 85+675 [0.05°]), mid-span bearing became 215.6° instead of 359.61°, rotating perpendicular offsets by 144° and placing Left structures onto the Right side of the track.
  2. *Cross-Section Base Asset Disappearance:* `applyEditsToFeatures` only iterated over the active section's base features. When a base asset was moved across PK 82+902 (e.g. Section 03 asset moved to PK 75+000 in Section 02), it did not appear in Section 02 and remained stuck in Section 03.
  3. *Linear Chainage Form Validation Gap:* In edit and add structure modals, only `sPk` was validated. An invalid or empty `end_pk` caused `parsePk` to return 0, which `Math.min(sPk, 0)` turned into start chainage PK 0+000, creating an 84-kilometer long corrupt feature.
  4. *Service Worker Precache Failure:* `sw.js` listed nonexistent legacy files (`app_config.js`, `chainage_scrubber.js`, `project_dashboard.js`), which caused atomic `cache.addAll` to reject with HTTP 404, preventing offline PWA installation entirely.
- **The Fix:**
  1. Implemented shortest-arc modular circular angular interpolation `((p0.bearing + t * diff + 360) % 360)` in `interpolateCenterline`.
  2. Enhanced `applyEditsToFeatures` to omit features moved out of the section and pull in base features moved into `activeSection` from `this.edits.updated`.
  3. Added strict validation for `end_pk` and non-zero length (`Math.abs(sPk - ePk) >= 0.5`) on linear features.
  4. Corrected `PRECACHE_LOCAL_ASSETS` in `sw.js` and added automated test suite 13 verifying all precache files physically exist on disk.
- **Lesson Learned:** Angular spatial quantities must always use circular modular arithmetic; multi-partition views must handle cross-partition entity transfers symmetrically; and Service Worker precache arrays must be verified against disk in automated test suites because `cache.addAll` is atomic.

### [2026-09-15 08:24] — PowerShell Token '&&' Not Supported in Windows PowerShell 5.1

- **Date/Time:** 2026-09-15 08:24 (WAT)
- **Context:** Executing multiple Node test scripts sequentially in PowerShell.
- **The Mistake/Error:** Attempted to chain commands with `&&` (`node scripts/test_sld_viewer.js && node scripts/test_new_views.js`), causing `The token '&&' is not a valid statement separator in this version`.
- **The Fix:** Use semicolon `;` separator in Windows PowerShell or execute tests individually.
- **Lesson Learned:** Windows PowerShell 5.1 does not support bash-style `&&` chaining; use `;` or separate commands.

### [2026-09-24 09:50] — Substring Prefix Collision in Ditch Typology Mapping (Type 1 vs Types 10–16)

- **Date/Time:** 2026-09-24 09:50 (WAT)
- **Context:** Implementing Phase 2 data model migration and automatic typology mapping from legacy dataset attributes to `TYPE_CATALOGUE` codes.
- **The Mistake/Error:** `mapAssetToTypeCode` used `sc.includes('type 1')` to identify Type 1 ditches. Because `'type 12'.includes('type 1')` evaluates to `true`, all Type 10 through Type 16 ditches were mistakenly classified as Type 1 (`'1'`), causing test failure on Type 12 toe ditch mapping.
- **The Fix:** Implemented word-boundary regular expression matching `/\btype\s*${numStr}\b/i` evaluated in strict reverse numerical order (16 down to 1). This ensures multi-digit ditch types are matched accurately without substring prefix collisions.
- **Lesson Learned:** Identifier and classification decoders must never use naive substring matching (`String.includes`) on numeric tokens where one code is a prefix of another; always enforce word boundaries (`\b`) or discrete token parsing.

### [2026-09-24 09:51] — False Positive Matching of 'tc' Dissipator Code in Word 'ditch'

- **Date/Time:** 2026-09-24 09:51 (WAT)
- **Context:** Mapping legacy drainage typology strings to energy dissipators (`D-TC` = Trapezoidal Channel Dissipator).
- **The Mistake/Error:** Used `sc.includes('tc')` to identify TC dissipators. Because every string containing the word "ditch" (e.g. "Toe Ditch", "Side Ditch") contains the substring sequence 'tc' (`d-i-T-C-h`), any generic ditch was falsely classified as a Trapezoidal Channel Dissipator (`D-TC`).
- **The Fix:** Replaced naive substring `includes('tc')` with word-boundary regex `/\b(d-tc|tc)\b/i`.
- **Lesson Learned:** Short acronyms (2 letters) must never be matched via `String.includes` against natural language names or compound descriptors without word boundary constraints.

### [2026-09-24 10:02] — UUIDv7 Non-Monotonic Scrambling in Burst Sequences

- **Date/Time:** 2026-09-24 10:02 (WAT)
- **Context:** Generating sub-millisecond sequential UUIDv7 identifiers during high-frequency field record sync and data ingestion.
- **The Mistake/Error:** XORed `_subMsSequence` with fresh random bytes on every call within the same millisecond (`this._subMsSequence ^ (Math.floor(Math.random() * 0xFFF))`), causing 44% of sequential UUIDs to invert lexicographically, violating RFC 9562 §6.2 monotonicity.
- **The Fix:** Implemented RFC 9562 §6.2 Method 1 dedicated monotonic sequence counter (0..4095) with timestamp advancement on rollover and forward monotonicity enforcement on backward clock skew.
- **Lesson Learned:** Monotonic UUID generators must never mix random jitter into the sequence counter bits; maintain a deterministic incrementing counter for sub-millisecond resolution.

### [2026-09-24 10:05] — Contractor IR Overwrite Collision on Non-Unique Progress Numbers (#REF!)

- **Date/Time:** 2026-09-24 10:05 (WAT)
- **Context:** Ingesting contractor Inspection Requests (`s03_drainage_irs.json`) into the normalized `InspectionRequest` entity store.
- **The Mistake/Error:** Keyed IR records solely by `IR_${section}_${prog_n}`. In the raw contractor spreadsheet, 7 rows contained `#REF!` or duplicate progress numbers across revision cycles, causing 7 real inspection records to be silently overwritten via Last-Write-Wins (LWW) and losing status data by defaulting to 'pending'.
- **The Fix:** Formed composite unique keys (`IR_${section}_${progStr}${revStr}${rowStr}`), preserved all 1,066 rows, and normalized status fields (`APPD AS NOTED` -> `approved_with_comments`, `REJECTED` -> `rejected`, `APPD` -> `approved`).
- **Lesson Learned:** External contractor data often contains unvalidated, uncomputed, or duplicate spreadsheet identifiers; always construct deterministic composite keys containing disambiguating record row/index numbers to prevent LWW data loss.

### [2026-09-24 10:08] — Multi-Property Misclassification and Sort Inversion for Bridge BRG-2601

- **Date/Time:** 2026-09-24 10:08 (WAT)
- **Context:** Migrating legacy Section 03 assets to V2 `DesignFeature` entities and exporting back to legacy GeoJSON.
- **The Mistake/Error:** Feature `BRG-2601` uses non-standard property casing (`Asset_ID`, `Typology_Class`, `Type`, and `Start_PK`). The migration mapper only checked lowercase properties (`id`, `category`, `short_code`, `typology`, `start_pk`), causing `mapAssetToTypeCode` to return `null`, lane to default to `'plat'`, certainty to fall back to `'low'`, and `exportLegacyGeoJSON` to assign chainage 0, sorting the bridge to index 0 instead of PK 87+000.
- **The Fix:** Checked alternate property casings (`Asset_ID`, `Typology_Class`, `Type`, `Start_PK`, `End_PK`), properly mapping `BRG-2601` to type `'BRG'`, lane `'across'`, certainty `'exact'`, and sorting by `Start_PK` in GeoJSON export.
- **Lesson Learned:** Legacy datasets containing merged schema revisions frequently have divergent field name casings; always implement robust property fallback checks across historical schema variants.

### [2026-09-24 10:10] — Defect Observation Silently Resetting Latest Stage to 'Not Started'

- **Date/Time:** 2026-09-24 10:10 (WAT)
- **Context:** Calculating the active construction stage for a feature in `DataStore.getLatestStage(featureId)`.
- **The Mistake/Error:** When a defect was logged alongside a stage (e.g. Blinding), the observation record `kind` was set to `'defect'`. `getLatestStage` strictly filtered for `kind === 'stage'`, ignoring stage metadata on defect records and causing the feature to falsely display `'Not Started'`.
- **The Fix:** Updated `getLatestStage` filter to include `(r.kind === 'stage' || r.kind === 'defect') && r.stage`, ensuring stages recorded during defect logging are preserved in progress tracking.
- **Lesson Learned:** Filtering domain records by event kind must consider hybrid events (such as defect reports that capture the construction phase where the defect was observed); never discard stage telemetry attached to quality incident records.



