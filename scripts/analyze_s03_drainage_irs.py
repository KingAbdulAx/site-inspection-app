import json
from collections import Counter
import re

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

print(f"Total S03 Drainage IRs: {len(irs)}")

# Status breakdown
status_counts = Counter(r["status"] for r in irs)
print("\n--- Status Counts ---")
for st, cnt in status_counts.most_common():
    print(f"  {st:<20}: {cnt}")

# Discipline breakdown
disc_counts = Counter(r["discipline"] for r in irs)
print("\n--- Discipline Counts ---")
for d, cnt in disc_counts.most_common():
    print(f"  {d:<20}: {cnt}")

# Work types
wt_counts = Counter(r["work_type"] for r in irs)
print("\n--- Work Type Counts ---")
for wt, cnt in wt_counts.most_common():
    print(f"  {wt:<20}: {cnt}")

# Structure Types
st_counts = Counter(r["str_type"] for r in irs)
print("\n--- Structure Types ---")
for st, cnt in st_counts.most_common(15):
    print(f"  {st:<25}: {cnt}")

# Check unique structure numbers
str_nos = set(r["str_no"] for r in irs if r["str_no"])
print(f"\nUnique Structure Numbers count: {len(str_nos)}")
sample_strs = sorted(list(str_nos))[:30]
print(f"Sample structure numbers: {sample_strs}")

# Check date ranges
dates = [r["receipt_date"][:10] for r in irs if r["receipt_date"] and r["receipt_date"].strip()]
if dates:
    print(f"\nDate Range: {min(dates)} to {max(dates)}")

# Sample recent APPROVED IRs
print("\n--- Sample 10 APPROVED Drainage IRs ---")
approved = [r for r in irs if r["status"] in ["APPROVED", "APPD AS NOTED"]]
for r in approved[:15]:
    ch = f"{r['ch_from']} - {r['ch_to']}"
    print(f"IR #{r['prog_n']} | {r['status']} | CH: {ch} | Str: {r['str_type']} {r['str_no']} | Desc: {r['description'][:60]} | Date: {r['receipt_date'][:10]}")
