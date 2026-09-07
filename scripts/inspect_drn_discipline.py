import json
from collections import Counter

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

drn_irs = [r for r in irs if r.get("discipline") == "DRN"]
print(f"Total Discipline == 'DRN' IRs: {len(drn_irs)}")

status_drn = Counter(r["status"] for r in drn_irs)
print("\n--- DRN Statuses ---")
for s, c in status_drn.items():
    print(f"  {s}: {c}")

print("\n--- All DRN IRs Sample (first 30) ---")
for r in drn_irs[:30]:
    ch = f"{r['ch_from']} - {r['ch_to']}"
    print(f"IR #{r['prog_n']} | {r['status']:<15} | CH: {ch:<20} | Date: {r['receipt_date'][:10]} | Desc: {r['description']}")
