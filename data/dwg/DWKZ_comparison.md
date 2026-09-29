# DWKZ: CAD drainage vs app data

Source: `S02-DRN-LONG.dxf` on axis `S02-TRA-PLAT.dxf` (2522 ticks, 19+825 → 82+900).

## Ditches

Measured metre by metre, per side and lane group (platform, toe, crest, berm, track):

| | length | share of CAD |
|---|---|---|
| CAD ditch length | 87.7 km | 100% |
| App had it, same type | 44.7 km | 51% |
| App had it, different type | 6.8 km | 8% |
| App missed it | 36.3 km | 41% |
| App has ditch where the CAD has none | 29.4 km | |

Features: 1002 app ditch pieces (median 31 m long) vs 386 CAD runs. Corrections: 300 app features take a CAD run (46 change type), 86 CAD runs added, 193 duplicate pieces removed, 509 pieces not in the CAD removed.

Start shift of carried features (CAD − app): median -12.1 m, 90% within 220 m.

### Where the type differed (app → CAD)

| Change | length |
|---|---|
| T4 → T12 | 1842 m |
| T7 → T12 | 1249 m |
| T4 → T7 | 1206 m |
| T7 → T4 | 769 m |
| T12 → T7 | 756 m |
| T12 → T4 | 583 m |
| T4 → T13 | 370 m |
| T12 → T13 | 13 m |
| T7 → T13 | 2 m |

## Water descents

App 326, CAD 483. Matched 3 (within 15 m, same side; median shift -12.5 m), to add 480, to remove 323.

## Dissipators

App 0, CAD 46. Matched 0, to add 46, to remove 0.

## Riprap

App label positions 251, CAD callouts 263 (plus 474 hatched areas, not used yet). Matched 183 (within 50 m, same side; median shift 26.5 m), to add 80, to remove 68.

## Corrections file

2271 records: 486 edit, 692 add, 1093 delete. These are now baked into `data/section02_bundle.js` and `data/section02_assets.json` (1,710 → 1,309 features); corrected features carry `di_set` in their properties. Re-importing the file on the phone changes nothing.
