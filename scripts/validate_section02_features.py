import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data\section02_features.json"

with open(DATA_PATH, encoding='utf-8') as f:
    data = json.load(f)

features = data["features"]
print(f"Total features loaded: {len(features)}")

# 1. Chainage boundaries
min_pk = min(f["start_pk"] for f in features)
max_pk = max(f["end_pk"] for f in features)
print(f"Section PK Extent in Data: PK {min_pk:.3f} to PK {max_pk:.3f}")

# 2. Geometry / Direction integrity
invalid_order = [f for f in features if f["end_pk"] < f["start_pk"]]
print(f"Features with end_pk < start_pk: {len(invalid_order)}")

invalid_length = [f for f in features if not f["is_point"] and f["length_m"] <= 0]
print(f"Linear features with length_m <= 0: {len(invalid_length)}")

# 3. ID uniqueness
ids = [f["feature_id"] for f in features]
unique_ids = set(ids)
print(f"Unique feature IDs: {len(unique_ids)} / {len(ids)}")

# 4. Breakdown by Category
cat_summary = {}
for f in features:
    c = f["category"]
    if c not in cat_summary:
        cat_summary[c] = {"count": 0, "total_length_m": 0.0, "samples": []}
    cat_summary[c]["count"] += 1
    cat_summary[c]["total_length_m"] += f["length_m"]
    if len(cat_summary[c]["samples"]) < 2:
        cat_summary[c]["samples"].append(f)

print("\n=== CATEGORY SUMMARY ===")
print(f"{'Category':<22} | {'Count':<6} | {'Total Length (m)':<18} | {'Sample Typology'}")
print("-" * 85)
for c, info in sorted(cat_summary.items(), key=lambda x: x[1]["count"], reverse=True):
    sample_typ = info["samples"][0]["typology"] if info["samples"] else ""
    print(f"{c:<22} | {info['count']:<6} | {info['total_length_m']:<18.1f} | {sample_typ[:40]}")

# 5. Breakdown by Confidence Grade
conf_summary = {}
for f in features:
    cf = f["confidence"]
    conf_summary[cf] = conf_summary.get(cf, 0) + 1

print("\n=== CONFIDENCE GRADE SUMMARY ===")
for cf, cnt in sorted(conf_summary.items(), key=lambda x: x[1], reverse=True):
    print(f"  {cf:<20}: {cnt:5d} ({cnt/len(features)*100:.1f}%)")

# 6. Breakdown by Consultant Vetting Status
stat_summary = {}
for f in features:
    st = f["effective_status"]
    stat_summary[st] = stat_summary.get(st, 0) + 1

print("\n=== CONSULTANT VETTING STATUS SUMMARY ===")
for st, cnt in sorted(stat_summary.items(), key=lambda x: x[1], reverse=True):
    print(f"  {st:<35}: {cnt:5d} ({cnt/len(features)*100:.1f}%)")
