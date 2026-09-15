# Error Log & Operational Mistakes Tracking

This document logs troubleshooting steps, operational mistakes, failed commands, and bug fixes across the KMD Drainage Field Inspector application repository.

See also the master workspace log at `../MISTAKES.md`.

## Log Entries

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
