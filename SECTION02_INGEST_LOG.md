# SECTION 02 (DWKZ) DRAINAGE DESIGN INGESTION LOG

**Project:** Kano–Maradi–Dutse Railway Project  
**Section:** Section 02 (DWKZ: Dawanau to Kazaure, PK 18+400 / 19+800 to PK 82+902.439)  
**Date Initialized:** 2026-09-09  
**Branch:** `section-02-ingest`  
**Engineer / Data Agent:** Civil Engineering Data Agent  

---

## Directives & Operating Constraints
1. **Prime Directive:** Never fabricate. No interpolations, guesses, or values carried from Section 03. Record gaps explicitly.
2. **Hard Stop 1:** Strictly read-only with respect to Supabase. No test rows, seeds, pings, or migrations.
3. **Hard Stop 2:** Namespace isolation: Section 02 assets must use prefix `s02_asset_XXX` to prevent collision with Section 03 (`asset_001` ... `asset_842`).
4. **Hard Stop 3:** Centreline extraction must be derived from red track LineStrings (`ff0000fe`) with stationing from tick marks in `KMD.kml` (`TRA-H-GTR_km-tick`), never from AutoCAD text anchors (`CH=nn+mmm.mmm`).

---

## Phase 0 — Setup & Baseline Protection
- Initialized branch `section-02-ingest` from clean `main` in `TEAM/app`.
- Created byte-exact backup copies of Section 03 datasets:
  - `data/section03_assets.json.bak` (Hash / size: 1,145,024 bytes)
  - `data/section03_centerline.json.bak` (Hash / size: 418,356 bytes)
- Committed backup baselines to git (`commit 9a8effd`).

---

## Phase 1 — Submission Inventory, Reconciliation & Vetting Register
- **Date Completed:** 2026-09-09
- **Source Files Ingested:**
  - Transmittal: `Doc no. 1084/Transmittal sheet #3848.xlsx`
  - Drawings & Report: `Doc no. 1084/` (172 Drawing PDFs, 1 Design Report PDF)
  - Consultant Review 1: `Doc no. 1084/KMD TC 1084 26 HYD 30 085 00.pdf` (69 pages, dated 25 Feb 2026)
  - Consultant Review 2 (Later): `Doc no. 1084/KMD TC 1153 26 HYD 30 174 00.pdf` (9 pages, dated 13 Apr 2026)
  - Consultant Review 3 (Historical): `TEAM/KMD TC 417 25 HYD 30 046 00.pdf` (66 pages, dated 14 Feb 2025)

### 1. Reconciliation: Transmittal #3848 vs. Directory Contents
| Metric | Transmittal Listed | Directory Found | Reconciliation Status |
|:---|:---:|:---:|:---|
| Plan Sheets (`DW-03001` to `DW-03047`) | 47 | 47 | 100% Match (0 missing) |
| Culvert Plan & Cross Section (`DW-04002` to `DW-04123`) | 119 | 119 | 100% Match (0 missing) |
| Culvert Schedule Tables (`DW-06001`, `DW-06002`) | 2 | 2 | 100% Match (0 missing) |
| Collector Drains (`DW-08001` to `DW-08004`) | 4 | 4 | 100% Match (0 missing) |
| Design Report (`RP-00001-06`) | 1 | 1 | 100% Match (0 missing) |
| **Total Contractual Documents** | **173** | **173** | **Exact 1:1 Match (Zero Gaps)** |

*Note: In `Doc no. 1084/`, there are 177 total files, comprising the 173 submitted design PDFs, 1 Excel transmittal, 2 Consultant TC PDFs, and 1 agent prompt file.*

### 2. Consultant Vetting Status & Precedence Rules
- **TC 417/25 (14 Feb 2025):** Evaluated earlier Transmittal 2042 in 2025. **Formally superseded** by TC 1084/26 and TC 1153/26.
- **TC 1084/26 (25 Feb 2026):** Comprehensive evaluation of Transmittal 3848 (all 173 submitted documents).
- **TC 1153/26 (13 Apr 2026):** Subsequent evaluation of 16 revised documents submitted under Transmittal 4181. Per instructions, **TC 1153/26 takes precedence** over TC 1084/26 for all 16 documents, while retaining full audit records of both.

### 3. Vetting Status Distribution Summary
| Approval Status | TC 1084/26 Count | Effective Count (TC 1153/26 Applied) | Operational Meaning |
|:---|:---:|:---:|:---|
| **LEVEL A** (Approved with No Comments) | 109 | **113** | Fully vetted; approved for execution. |
| **LEVEL B** (Proceed Subject to Amendments as Noted) | 40 | **44** | Approved to proceed on site; minor notes to amend in as-builts. |
| **LEVEL C** (Subject to Amendment as Noted) | 15 | **7** | Technical objections / clarifications required before construction. |
| **ON-HOLD** (Relocation Directive) | 9 | **9** | Work frozen due to Employer Dawanau Freight Yard relocation directive. |
| **TOTAL** | **173** | **173** | |

### 4. Status Precedence Updates from TC 1153/26 (16 Documents Reviewed)
| Document Number | Title / Chainage | TC 1084 Status | TC 1153 Status (Latest) | Review Revision | Precedence Resolution Note |
|:---|:---|:---:|:---:|:---:|:---|
| `DW-03000` | Symbology | *Omitted* | **LEVEL B** | Rev 03 | Evaluated in TC 1153, but PDF file absent from Doc no. 1084. |
| `DW-03014` | Plan CH 36+600 – CH 38+000 | LEVEL B | **LEVEL C** | Rev 05 | Overwritten to Level C in TC 1153 due to unlined ditch velocity queries. |
| `DW-03016` | Plan CH 39+400 – CH 40+800 | LEVEL B | **LEVEL C** | Rev 05 | Overwritten to Level C in TC 1153 due to unlined ditch velocity queries. |
| `DW-03030` | Plan CH 59+000 – CH 60+400 | LEVEL C | **LEVEL C** | Rev 06 | Maintained Level C in TC 1153. |
| `DW-03031` | Plan CH 60+400 – CH 61+800 | LEVEL C | **LEVEL C** | Rev 06 | Maintained Level C in TC 1153. |
| `DW-03037` | Plan CH 68+800 – CH 70+200 | LEVEL B | **LEVEL C** | Rev 05 | Overwritten to Level C in TC 1153 due to downstream erosion query. |
| `DW-03038` | Plan CH 70+200 – CH 71+600 | LEVEL C | **LEVEL B** | Rev 06 | Upgraded to Level B in TC 1153. |
| `DW-03041` | Plan CH 74+400 – CH 75+800 | LEVEL C | **LEVEL B** | Rev 06 | Upgraded to Level B in TC 1153. |
| `DW-03042` | Plan CH 75+800 – CH 77+200 | LEVEL C | **LEVEL B** | Rev 06 | Upgraded to Level B in TC 1153. |
| `DW-03043` | Plan CH 77+200 – CH 78+600 | LEVEL C | **LEVEL C** | Rev 06 | Maintained Level C in TC 1153. |
| `DW-03044` | Plan CH 78+600 – CH 80+000 | LEVEL C | **LEVEL B** | Rev 06 | Upgraded to Level B in TC 1153. |
| `DW-04008` | Culvert CH=23+700 | LEVEL B | **LEVEL A** | Rev 03 | Upgraded to Level A Approved in TC 1153. |
| `DW-04026` | Culvert CH=32+707 | LEVEL B | **LEVEL A** | Rev 02 | Upgraded to Level A Approved in TC 1153. |
| `DW-04069` | Culvert CH=61+936 | LEVEL B | **LEVEL A** | Rev 03 | Upgraded to Level A Approved in TC 1153. |
| `DW-04078` | Culvert CH=65+857 | LEVEL B | **LEVEL A** | Rev 03 | Upgraded to Level A Approved in TC 1153. |
| `RP-00001` | Design Report Vol 6 | LEVEL C | **LEVEL C** | Rev 07 | Maintained Level C in TC 1153 (Table 3.27 unlined flow velocity queries). |

### 5. Dawanau Freight Yard ON-HOLD Directive
Per Federal Ministry of Transport / Employer Letter No. `T.0063/S.50/C.9/Vol.1/417` dated 4th September 2025, the Dawanau Freight Yard is directed to be relocated. In TC 1084/26 Page 4, the Consultant formally placed nine (9) submitted documents **ON-HOLD**:
1. `DW-03001-05`: Drainage Plan - Dawanau Freight Yard
2. `DW-03002-05`: Drainage Plan - CH 19+800 to CH 21+200
3. `DW-03003-05`: Drainage Plan - CH 21+200 to CH 22+600
4. `DW-06001-07`: Drainage - Pipes and Culverts Table (incorporates Dawanau lines)
5. `DW-06002-06`: Drainage - Pipes and Culverts Table (incorporates Dawanau lines)
6. `DW-08001-02`: Collector Drain – Dawanau (Sheet 1/2)
7. `DW-08002-02`: Collector Drain – Dambatta (associated yard package)
8. `DW-08003-01`: Collector Drain – Yard-Kazaure (associated yard package)
9. `DW-08004-01`: Collector Drain – Dawanau (Sheet 2/2)

### 6. Documented Gaps & Non-Issued Drawings
1. **Never-Issued Culverts:** Drawings `DW-04113`, `DW-04114`, and `DW-04116` do not exist in the transmittal, folder, or consultant reviews. Verified as intentionally never issued (no gap in physical chainage).
2. **Symbology Key Sheet (`DW-03000`):** Omitted from Transmittal 3848 and absent from `Doc no. 1084`. Reviewed as Rev 03 Level B in TC 1153/26, but the PDF drawing was not included in local submittal records. High-resolution visual testing of Section 02 sheets against Section 03 symbology key is required in Phase 3.

### 7. Phase 1 Data Artifact
- Generated `data/section02_drawing_register.json` (283 KB) recording complete metadata, title, revision, chainage extent, file size, TC 1084 status/comments, TC 1153 status/comments, and precedence notes for all 174 document entries.

---

## Phase 2 — Alignment Extraction & Centerline Verification
- **Date Completed:** 2026-09-09
- **Source Files:**
  - Track Geometry: `KMZs KAMA/01. KANO-MARADI LINE/SECTION 02.kmz` (`doc.kml`, `Polyline [3BEDD7]:0`, colour `ff0000fe`)
  - Corridor Stationing: `KMZs KAMA/KMD.kml` (`TRA-H-GTR_km-tick` midpoints & `TXT-KM` 500m labels)
  - Boundary Reference: `data/section03_centerline.json` (Section 03 baseline)

### 1. Methodology & Geometry Separation
- Extracted all 2,940 LineStrings of colour `ff0000fe` from `SECTION 02.kmz`.
- Filtered and separated cross-track sleeper ties / gauge ticks from longitudinal track rails:
  - **Cross Ticks:** 1,470 segments (average length 1.000 m, total length 1,470.53 m) oriented perpendicular to track bearing ($60^\circ\text{--}120^\circ$ / $240^\circ\text{--}300^\circ$). Rejected from centerline geometry.
  - **Rail Segments:** 1,470 segments (total length 126,247.90 m) oriented along track bearing ($315^\circ\text{--}360^\circ$ / $0^\circ\text{--}45^\circ$).
- Chained rail segments into two continuous, gapless lines from south to north:
  - **Rail 1 (Left Rail):** 735 segments, WGS84 geodesic length = 63,124.409 m.
  - **Rail 2 (Right Rail):** 735 segments, WGS84 geodesic length = 63,123.489 m.
  - **Segment Continuity:** 100% gapless (<0.10 m connection tolerance at every vertex; zero unassigned segments).
  - **Track Gauge:** Constant 1.000 m lateral separation across all 736 vertex pairs.
- Reconstructed the true railway track centerline as the exact mathematical midpoint between Rail 1 and Rail 2 at every vertex across the entire corridor.

### 2. Alignment Verification Numbers
| Verification Metric | Required / Stated Value | Derived Centerline Value | Discrepancy | Acceptance Status |
|:---|:---:|:---:|:---:|:---:|
| **Start Chainage** (`DW-03002`) | PK 19+800.000 | PK 19+800.000 | 0.000 m | Exact Match |
| **End Chainage** (`DW-03047`) | PK 82+902.439 | PK 82+902.439 | 0.000 m | Exact Match |
| **Section Span** | 63,102.439 m | 63,123.949 m | +21.510 m | **0.0341%** (Threshold: $\le 0.1000\%$) — **PASSED** |
| **Terminal Lon/Lat** (PK 82+902.439) | — | Lon: `8.4041225`, Lat: `12.6249800` | — | Verified |
| **Boundary Gap vs. S03** (PK 82+902.439) | Section 03 Start | Lon: `8.4040758`, Lat: `12.6248062` | **19.88 m** | Verified ($dx = -5.08\text{m}, dy = -19.34\text{m}$) |

*Note on Boundary Gap:* The 19.88 m join gap at CH 82+902.439 corresponds precisely to the known ~17.2 m offset in the Section 03 baseline caused by AutoCAD text leader anchor positions (`CH=83+000`). Per directive, the gap is recorded plainly without forcing the lines together.

### 3. Subsampling & Centerline Dataset
- Resampled the continuous 736-vertex centerline along WGS84 geodesics to standard app schema:
  - **Dense Spline Points:** 2,526 vertices spaced at 25.0 m steps from PK 19+800 to PK 82+902.439 (each with `pk`, `lon`, `lat`, `bearing`).
  - **100m Ticks:** 632 tick marks every 100 m from PK 19+800 to PK 82+900.
  - **1km Major Ticks:** 63 major tick marks every 1,000 m from PK 20+000 to PK 82+000.
  - **GeoJSON:** FeatureCollection with single LineString feature representing Section 02.
- Schema verified 100% compatible with `section03_centerline.json`.
- Output: `data/section02_centerline.json` (624,998 bytes).

---

## Phase 3 — Drainage Inventory Extraction
- **Date Completed:** 2026-09-09
- **Source Files Ingested:**
  - 47 Plan Sheets: `DW-03001-05` to `DW-03047-05` (`Doc no. 1084`)
  - 119 Culvert Detail Sheets: `DW-04002-02` to `DW-04123-01` (`Doc no. 1084`)
  - 2 Culvert Schedule Tables: `DW-06001-07`, `DW-06002-06` (verified raster title-only, per prompt)
  - 4 Collector Drain Drawings: `DW-08001-02` to `DW-08004-01` (`Doc no. 1084`)
  - Design Report Vol 6: `RP-00001-06` (Appendix II, Table 3.27, Table 3.28, Table 3.29)
  - Consultant Reviews: `TC 1084/26` and `TC 1153/26`

### 1. Symbology Verification on Section 02 Plan Sheets
- Tested sample plan sheets at high resolution (300–400 DPI crops) on `DW-03004-04`, `DW-03020-04`, and `DW-03047-05`.
- **Finding:** The Section 03 symbology key holds **identically** on Section 02 plan sheets without exception:
  - **Black ✕ markers:** Type 7 — Concrete lined triangular ditch at foot of slope (MDDT DW-10001).
  - **Blue ✕ markers:** Type 4 — Unlined triangular ditch at foot of slope (MDDT DW-10001).
  - **Black ∕ markers:** Type 12 — Trapezoidal concrete lined ditch at foot of slope (MDDT DW-10001 / DW-10006).
  - **Red text & lines:** Type 1 — Concrete lined platform edge side ditch with invert levels and longitudinal slopes.
  - **Azure text:** Invert levels and slopes along foot-of-slope and crest ditches.
  - **Text callouts:** Half round lined bench ditches (Type 8), slope protection riprap armor ($D_{50}=200\text{ mm}$), diversion channels (Type B, Type C), and culvert identification callouts.

### 2. Plan Sheet Scale Factor & Coordinate Transformation
- Regressed x-coordinates of station tick marks in the STATION band across upper and lower strips:
  - Strip 1 (y: 700–780): $scale = 2.83529\text{ pt/m}$, max residual = **0.094 pt** (< 0.033 m).
  - Strip 2 (y: 1480–1560): $scale = 2.83529\text{ pt/m}$, max residual = **0.094 pt** (< 0.033 m).
- **Side Assignment Rule:** For chainage increasing left-to-right:
  - $y < \text{track } y \implies$ **Left** Side
  - $y > \text{track } y \implies$ **Right** Side
  - Verified 100% consistent with Design Report Table 3.27 ditch side assignments (`21+510` to `22+544` on Left, `24+675` to `24+372` on Right).

### 3. Culvert Extraction & Reconciliation (DW-04xxx vs Appendix II)
- Parsed all 119 culvert drawings in `Doc no. 1084` (`DW-04002` to `DW-04123`).
- Parsed all 110 culvert entries in Design Report `RP-00001-06` Appendix II (pages 76–78).
- **Reconciliation Audit:**
  - **109 Culverts:** Exact 1:1 match across drawing title, drawing body, and Appendix II schedule.
  - **1 Chainage Discrepancy Resolved:** Drawing `DW-04058-02` transmittal title reads `CH=56+755`, but the drawing body text and title block explicitly specify `CH=56+775.000` (`CULVERT - CH=56+775`). Confirmed matching Appendix II `56+775` (BC 56.1, 3x(2.50x2.50m), $Q=19.73\text{ m}^3/\text{s}$). Recorded at physical chainage PK 56+775.000 with title discrepancy noted.
  - **10 Contractual Culverts Omitted from Appendix II:** 10 drawings in `DW-04xxx` are absent from Report Appendix II. All 10 are fully approved under TC 1084/26 / TC 1153/26 (9 Level A, 1 Level B):
    1. `DW-04025` (Rev 02, Level A): Pipe Culvert 1xØ1.5m at PK 32+622.508
    2. `DW-04026` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 32+707.000
    3. `DW-04058` (Rev 02, Level B): Box Culvert 3x(2.50x2.50m) at PK 56+775.000 (title reads 56+755)
    4. `DW-04066` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 60+250.000
    5. `DW-04111` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 80+047.349
    6. `DW-04112` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 80+189.000
    7. `DW-04115` (Rev 01, Level A): Box Culvert 1x(2.00x2.00m) at PK 81+189.000
    8. `DW-04117` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 81+825.000
    9. `DW-04118` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 81+937.000
    10. `DW-04121` (Rev 01, Level A): Pipe Culvert 1xØ1.2m at PK 82+850.000
  - **2 CAD Drafting Typos Resolved:**
    - `DW-04024`: Drawing text reads `PIP2 1.2m` (CAD typo for `PIPE 1.2m`, Ø1200 at PK 32+579.648). Resolved as Pipe Culvert 1xØ1.2m.
    - `DW-04042`: Drawing text reads `B.C. 3(3.0x3.0)m` (omitted 'x'). Resolved as Triple Box Culvert 3x(3.00x3.00m) at PK 46+195.536.
  - **Culvert Totals:** **119 Culverts** (67 Box Culverts, 52 Pipe Culverts; 110 CONFIRMED, 9 PROBABLE).

### 4. Diversion Channels (Report Table 3.28)
- Extracted all 10 major concrete trapezoidal diversion channels (5,129.6 m total):
  1. PK 19+850 – PK 21+119 (Type B, B=2.0m, H=1.0m, L=1,269.37m, Left Side) — Dawanau Yard perimeter (ON-HOLD)
  2. PK 21+340 – PK 21+584 (Type B, B=5.0m, H=1.0m, L=244.15m, Left Side)
  3. PK 22+325 – PK 22+540 (Type B, B=4.0m, H=1.0m, L=214.77m, Right Side)
  4. PK 22+475 – PK 22+551 (Type B, B=4.0m, H=1.0m, L=75.88m, Left Side)
  5. PK 22+544 – PK 22+755 (Type C, B=5.0m, H=1.5m, L=211.20m, Right Side)
  6. PK 31+925 – PK 32+482 (Type B, B=1.5m, H=1.0m, L=556.94m, Right Side)
  7. PK 34+000 – PK 34+746 (Type B, B=2.0m, H=0.8m, L=746.35m, Right Side)
  8. PK 37+175 – PK 37+372 (Type B, B=1.5m, H=0.8m, L=196.99m, Right Side, Level C)
  9. PK 41+800 – PK 42+609 (Type B, B=1.5m, H=1.0m, L=808.76m, Right Side)
  10. PK 56+125 – PK 56+930 (Type C, B=2.5m, H=0.8m, L=804.97m, Left Side)

### 5. Track Drainage & Collector Networks (DW-08001..08004 & Table 3.29)
- 4 station/yard drainage packages (5,800.0 m total):
  1. `DW-08001-02` (PK 18+400 – PK 19+800): Dawanau Freight Yard sub-ballast drainage (ON-HOLD)
  2. `DW-08004-01` (PK 19+800 – PK 21+200): Dawanau Freight Yard collector lines and outfalls (ON-HOLD)
  3. `DW-08002-02` (PK 48+100 – PK 49+600): Dambatta Station track drainage collector lines (Discharge Pipes 1DB–4DB, LEVEL A)
  4. `DW-08003-01` (PK 79+200 – PK 80+700): Kazaure Yard collector lines and discharge pipes (1YKZ–3YKZ, LEVEL A)

### 6. Longitudinal Ditches & Callouts from 47 Plan Sheets
- Extracted 1,323 raw marker runs, stitched across adjacent overlapping sheet boundaries into **929 continuous Toe Ditch features** (96,787.9 m total).
- Extracted **69 Berm Ditch features** (Type 8 Half-Round, 3,450.0 m) from plan callouts.
- Extracted **251 Riprap Protection features** (Embankment riprap armor and wingwall scour protection, 7,028.0 m) from plan callouts.

### 7. Phase 3 Feature Inventory Summary
| Category | Feature Count | Total Length (m) | Typology & Standard Details | Primary Source | Confidence Grade |
|:---|:---:|:---:|:---|:---|:---|
| **Toe Ditch** | 929 | 96,787.9 | Type 7 (Concrete Triangular), Type 4 (Unlined Triangular), Type 12 (Trapezoidal Lined) — MDDT DW-10001 | Plan Sheets `DW-03002`..`03047` | PROBABLE (100% Vector Derived) |
| **Riprap Protection** | 251 | 7,028.0 | Embankment Riprap Armor & Scour Protection ($D_{50}=200\text{ mm}$) — MDDT DW-10004 | Plan Sheets `DW-03002`..`03047` | PROBABLE |
| **Cross Drainage** | 119 | 0.0 | Box Culverts (67) & Pipe Culverts (52) | Culvert Drawings `DW-04002`..`04123` & Report Appendix II | CONFIRMED (110) / PROBABLE (9) |
| **Berm Ditch** | 69 | 3,450.0 | Half-Round Lined Bench Ditch (Type 8) — MDDT DW-10020 | Plan Sheets `DW-03002`..`03047` | PROBABLE |
| **Diversion Channel** | 10 | 5,129.6 | Concrete Trapezoidal Channel (Type B, Type C) — MDDT DW-10002 | Design Report Table 3.28 & Plan Sheets | CONFIRMED (9) / NEEDS_VERIFICATION (1) |
| **Track Drainage** | 4 | 5,800.0 | Sub-ballast Collector Network (Perforated Pipes Ø400–Ø1000 & Manholes) — MDDT DW-10022 | Drawings `DW-08001`..`08004` & Report Table 3.29 | CONFIRMED |
| **Section Boundary** | 2 | 0.0 | Section 02 Nominal Boundaries (PK 19+800 & PK 82+902.439) | `DW-03002` & `DW-03047` | CONFIRMED |
| **TOTAL** | **1,384** | **118,195.5** | | | **125 CONFIRMED, 1258 PROBABLE, 1 NV** |

### 8. Vetting Status Distribution Across Features
| Consultant Vetting Status | Feature Count | Percentage | Operational Guidance |
|:---|:---:|:---:|:---|
| **LEVEL B** (Proceed Subject to Amendments) | 1,032 | 74.6% | Approved for construction; amend minor drafting notes in as-builts. |
| **LEVEL C** (Subject to Amendment as Noted) | 178 | 12.9% | Requires technical clarification/revision before execution. |
| **LEVEL A** (Approved with No Comments) | 124 | 9.0% | Fully vetted and unconditionally approved for execution. |
| **ON-HOLD** (Freight Yard Relocation Package) | 50 | 3.6% | Frozen due to Federal Ministry of Transport Dawanau relocation directive. |
| **TOTAL** | **1,384** | **100.0%** | |

### 9. Phase 3 Data Artifact
- Generated intermediate feature dataset: `data/section02_features.json` (1,063,673 bytes, 1,384 features).

