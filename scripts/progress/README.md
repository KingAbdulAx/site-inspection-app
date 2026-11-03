# Site progress into the app

Inputs: the contractor's **Culvert Monitoring & Execution Status** charts (one PDF per section) and the **Ditch Progress** sheets (Type 1, Type 9).

```
# 1. Charts → rows (poppler's pdftotext gives word positions)
pdftotext -bbox 'Culvert Monitoring & Execution Status-Section 01 - 25_09_26.pdf' S01.bbox.html
python3 scripts/progress/parse_culvert_chart.py S01.bbox.html            # → S01.rows.json (same for S02, S03)
python3 scripts/progress/read_ditch_progress.py T1='Ditch Progress - Type 1.xlsx' T9='Ditch Progress - Type 9.xlsx' > ditch_rows.json

# 2. Match to the data; write the report, the culverts to add, and the progress rows
node scripts/progress/import_progress.js --asof 2026-09-25 --ditch-date 2026-09-30 \
  --chart KNDW=S01.rows.json --chart DWKZ=S02.rows.json --chart KZDR=S03.rows.json \
  --ditches ditch_rows.json --existing <current rows of the inspections table>.json

# 3. Culverts the data lacks (all of S01, cattle crossings, …) go into the base data
node scripts/apply_base_corrections.js data/progress/culverts_from_charts.json

# 4. Progress into the cloud database (dry run first; every write is logged and can be undone)
node scripts/progress/push_progress.js data/progress/progress_2026-09-25.json
node scripts/progress/push_progress.js data/progress/progress_2026-09-25.json --push
node scripts/progress/push_progress.js data/progress/pushed_2026-09-25.json --undo --push
```

Rules:

- **Road and yard crossings** (`82 R3`, `84 AR`, `DWA 2A`, `E1R1`) carry road chainages (0+351…) and are left out. Only main-line names (`4.1`, `5.A`, `E.1`, `CC 78`) are used.
- A chart culvert takes the data's culvert within 20 m, or within 45 m if the same kind. Otherwise it is added from the chart (±4 m: a table position, not a drawing).
- **Stage** = the furthest column ticked, on the feature's ladder. A box culvert is **Completed** once painted; a pipe culvert once its joints are done. Backfill is not a stage. "Ongoing" goes in the note.
- **Ditches**: executed runs laid over ditches of the same type and side.
  - **Type 1**: 90% covered (or no more than 15 m left) is Completed; less is Concreted, with the metres in the note.
  - **Type 9** is precast and tracked by length. The executed ranges go into the row's notes as `[T9 done 20900 to 21000; 21100 to 21225]` (chainages in metres), which the app reads as completed metres; no more than 5 m left is Completed, otherwise Concreted. The Type 9 pieces of the contractor's schedule (`data/t9_schedule.json`, on for every section) are laid over too. A Type 9 row the office wrote earlier is replaced when more is done now; a row from a phone is never replaced.
  - The phone writes the same note when it records a range, and adopts the office's ranges as its own (undoable) records before it writes over such a row. Test: `node scripts/test_progress_ranges.js`.
- A row already in the database is left alone, unless the chart is further on **and** newer.

The report for each run is `data/progress/progress_<date>.md`. A later section's run takes `--tag S04`, so its files (`culverts_from_charts_S04.json`, `progress_<date>_S04.json/.md`, `pushed_<date>_S04.json`) sit beside the first run's instead of replacing them:

```
node scripts/progress/import_progress.js --asof 2026-09-25 --chart DRMR=S04.rows.json --existing <current rows>.json --tag S04
node scripts/apply_base_corrections.js data/progress/culverts_from_charts_S04.json
node scripts/progress/push_progress.js data/progress/progress_2026-09-25_S04.json --push
```
