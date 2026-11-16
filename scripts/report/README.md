# Drainage progress report

What has been built, against the design, section by section: for the engineer's progress report.

```
node scripts/report/build_report.js --asof 2026-11-16 --out data/report/out
python3 scripts/report/report_xlsx.py data/report/out/report.json data/report/out/drainage_progress_2026-11-16.xlsx
```

`build_report.js` reads the cloud database the app syncs with (read only; `--rows file.json` reads a saved copy instead) and runs it through the app's own model, so the report counts exactly what the app shows. It writes:

- `report.html`, one page: the summary by section and drainage type, the changes from the design, then each section's chainage diagram (a band per drain type, left above right; the design outlined, the built part filled) with the stretches built, its culverts and its station networks. It prints to PDF from a browser.
- `report.json`, the same figures. `report_xlsx.py` turns them into the Excel appendix: Summary (with % as formulas), Changes, Built, Design (every drain along the line with its state), Structures, Networks, Older records.

## Changes from the design

`data/report/changes.json` lists them: `site` for what was built differently, `instructed` for a change made by letter or a later drawing. A change with `sub`, `ch0`, `ch1`, `side` and `feature` (the drain's id) is flagged on that section's diagram and on the stretch in the table. A drain recorded in the app as built to a different length is added on its own.

## What is left out

- Bridges and road crossings: they are for reference, not drainage.
- Road drainage: not built yet.
- Records under ids the app no longer has: rows from the first asset list (asset_018 ... asset_127, the drop descent asset_265). These are Type 9/8 recorded on 7 Sep 2026 at places the drawings since replaced. They are listed at the end, and left out until confirmed on site.
