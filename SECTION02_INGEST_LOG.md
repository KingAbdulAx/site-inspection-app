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
