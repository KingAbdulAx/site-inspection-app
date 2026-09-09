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
- Committed backup baselines to git.
