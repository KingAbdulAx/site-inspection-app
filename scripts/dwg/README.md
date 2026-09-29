# Drainage from the design CAD

These scripts read the project DWGs directly, so no symbol is interpreted and nothing is rasterised:

- The **type** comes from the CAD layer (`DRN_DITCH_TYPE12` …).
- The **position** comes from the drawn geometry (WGS84 UTM 32N).
- **Chainage and offset** come from the official 25 m ticks and 100 m labels on the track plan.

## Files you need (per sub-section)

Get them with **AutoCAD → eTransmit** on a plan sheet and on a cross-section sheet. That packs the sheet and all its external references.

| File | What it holds |
|---|---|
| `T2019-0323-S0x-DD-DRN-LONG.dwg` | longitudinal drainage, one layer per type, plus dissipators, manholes, connection boxes, descents (`DRN_WATER_DISCHARGE`), riprap hatches and callouts |
| `T2019-0323-S0x-DD-TRA-PLAT.dwg` | track plan: 25 m ticks (block `S11`, layer `TRA-H-GTR_km-tick`) and 100 m labels (block `S35`, attribute `19+800`) |
| `T2019-0323-S0x-DD-ALG-CROSS-SECTIONS.dwg` | every cross section, with `Pk=` (S02) or `CH=` (S03) label (`S985`), height to LRL (`S591`), toe distances (`S7002`), ditches (`L50`, lining `L320`/`L431`, Type 1 `L446`, crest `L168`) |

The sheet DWGs (`…-DW-03003-05.dwg`) only reference these files; on their own they hold no drainage.

## Steps

```
# 1. DWG → DXF (LibreDWG; build once: see below)
dwg2dxf -y -o S02-DRN-LONG.dxf  T2019-0323-S02-DD-DRN-LONG.dwg
dwg2dxf -y -o S02-TRA-PLAT.dxf  T2019-0323-S02-DD-TRA-PLAT.dwg
dwg2dxf -y -o S02-XS-raw.dxf    T2019-0323-S02-DD-ALG-CROSS-SECTIONS.dwg
python3 scripts/dwg/fix_dxf.py S02-XS-raw.dxf S02-XS.dxf      # rejoins a text value with a raw line break

# 2. Plan drainage → chainage, side, offset
python3 scripts/dwg/extract_plan.py --drn S02-DRN-LONG.dxf --axis S02-TRA-PLAT.dxf --sub DWKZ --out data/dwg/DWKZ_plan.json

# 3. Cross sections → per-section ditches, height, profile (and a cross-check against the plan)
python3 scripts/dwg/extract_sections.py --xs S02-XS.dxf --sub DWKZ --plan data/dwg/DWKZ_plan.json \
    --out data/dwg/DWKZ_sections.json --app data/sections_DWKZ.json

# 4. Compare with the app's data → report + corrections file
node scripts/dwg/compare_plan.js data/dwg/DWKZ_plan.json --register data/section02_drawing_register.json \
    --report data/dwg/DWKZ_comparison.md --corrections data/dwg/DWKZ_corrections.json
```

# 5. (only if the app's centreline is off) rebuild it from the CAD axis
python3 scripts/dwg/centreline_from_cad.py --plan data/dwg/KZDR_plan.json --lead data/dwg/DWKZ_plan.json \
    --bundle data/bundle.js --var SECTION03_CENTERLINE --start 82800 --section "Section 03: Kazaure to Daura (KZDR)"
```

KZDR ran the same way, with `--register data/section03_drawing_register.json`. That register is built from the consultant's review TC 1211/26 (sheet numbers, revisions and approval levels, on the 1.4 km sheet grid).

Then either:

- **Review on the phone:** Project → Base data → Import corrections, then work through *Check against drawings* sheet by sheet. Every record can be undone. Or,
- **Bake straight into the data:** `node scripts/apply_base_corrections.js data/dwg/DWKZ_corrections.json`.

DWKZ has been baked (1,710 → 1,311 features), and KZDR too (837 → 1,132). Re-applying the file to the baked data changes nothing, so a phone that already imported it can keep or clear those records.

## Checks built in

- **Chainage axis:** the ticks are chained by distance, and each 100 m label votes for the chainage and direction. On DWKZ, 630 of 632 labels agree. The app's centreline was compared with it and is within 0.1–0.4 m, with no chainage bias.
- **Ditch lengths:** runs carrying a "HALF ROUND LINED DITCH L:…m" note are compared with the length drawn. On DWKZ, 58 of 64 are within 2 m; on KZDR, 47 of 50. A long run is called out once per sheet it crosses, so repeated identical notes count once.
- **Centreline against the CAD axis:** DWKZ's app centreline was already within 0.1–0.4 m. KZDR's was not: it sat about 17 m to the side and 12 m out in chainage, and left a 19.9 m gap at the S02/S03 boundary. `centreline_from_cad.py` rebuilt it from the S03 track plan ticks (with the S02 axis for the first 100 m): it now matches the CAD axis within 6 mm, and the boundary gap is 0.01 m. Features are stored by chainage, side and offset, so they kept their chainages and are now drawn in the right place.
- **Sections against the plan:** section by section, the ditch type and offset from the cross sections are compared with the plan runs at the same chainage and side. The result is in `DWKZ_sections.json → cross_check`.

## Building LibreDWG (once)

```
curl -LO https://github.com/LibreDWG/libredwg/releases/download/0.13.3/libredwg-0.13.3.tar.xz
tar xJf libredwg-0.13.3.tar.xz && cd libredwg-0.13.3
./configure --disable-bindings --disable-docs && make -j && sudo make install && sudo ldconfig
pip install ezdxf numpy pyproj
```

On Windows, the free ODA File Converter does the same DWG → DXF step.
