# KZDR: CAD drainage vs app data

Source: `S03-DRN-LONG.dxf` on axis `S03-TRA-PLAT.dxf` (1662 ticks, 82+950 → 124+500).

## Ditches

Measured metre by metre, per side and lane group (platform, toe, crest, berm, track):

| | length | share of CAD |
|---|---|---|
| CAD ditch length | 48.8 km | 100% |
| App had it, same type | 19.5 km | 40% |
| App had it, different type | 11.3 km | 23% |
| App missed it | 18.0 km | 37% |
| App has ditch where the CAD has none | 25.7 km | |

Features: 117 app ditch pieces (median 370 m long) vs 203 CAD runs. Corrections: 78 app features take a CAD run (24 change type), 125 CAD runs added, 4 duplicate pieces removed, 35 pieces not in the CAD removed.

Start shift of carried features (CAD − app): median 0.1 m, 90% within 525 m.

### Where the type differed (app → CAD)

| Change | length |
|---|---|
| T12 → T7 | 7470 m |
| T1L → T1 | 2019 m |
| T1 → T9 | 914 m |
| T7 → T12 | 609 m |
| T4 → T7 | 217 m |
| T12 → T13 | 49 m |
| T7 → T13 | 42 m |
| T7 → T4 | 4 m |
| T4 → T12 | 3 m |

## Water descents

App 303, CAD 503. Matched 282 (within 15 m, same side; median shift -8.7 m), to add 221, to remove 21.

## Dissipators

App 1, CAD 37. Matched 0, to add 37, to remove 1.

## Riprap

App label positions 268, CAD callouts 241 (plus 322 hatched areas, not used yet). Matched 183 (within 50 m, same side; median shift 10.3 m), to add 58, to remove 85.

## Corrections file

1130 records: 543 edit, 441 add, 146 delete. These are baked into `data/bundle.js` and `data/section03_assets.json` (837 → 1,132 features); corrected features carry `di_set` in their properties. Re-importing the file on the phone changes nothing.

The S03 cross sections are rev 03 (Sep 2025) and the drainage plan is rev 06 (Apr 2026). Where they disagree on type (mostly plan T7, section T4: 353 places), the plan is the newer design and wins.
