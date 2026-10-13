# MRJB: CAD drainage vs app data

Source: `S05-DRN-LONG.dxf` on axis `S05-TRA-PLAT.dxf` (2482 ticks, 181+100 → 243+225).

## Ditches

Measured metre by metre, per side and lane group (platform, toe, crest, berm, track):

| | length | share of CAD |
|---|---|---|
| CAD ditch length | 96.2 km | 100% |
| App had it, same type | 0.0 km | 0% |
| App had it, different type | 0.0 km | 0% |
| App missed it | 96.2 km | 100% |
| App has ditch where the CAD has none | 0.0 km | |

Features: 0 app ditch pieces (median 0 m long) vs 412 CAD runs. Corrections: 0 app features take a CAD run (0 change type), 412 CAD runs added, 0 duplicate pieces removed, 0 pieces not in the CAD removed.

Start shift of carried features (CAD − app): median 0.0 m, 90% within 0 m.

## Water descents

App 0, CAD 385. Matched 0 (within 15 m, same side; median shift 0.0 m), to add 385, to remove 0.

## Dissipators

App 0, CAD 58. Matched 0, to add 58, to remove 0.

## Riprap

App label positions 0, CAD callouts 246 (plus 344 hatched areas, not used yet). Matched 0 (within 50 m, same side; median shift 0.0 m), to add 246, to remove 0.

## Corrections file

1101 records: 1101 add. Import on the phone (Project → Base data → Import corrections), then review with Check against drawings; every record can be undone.
