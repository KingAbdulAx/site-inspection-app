import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    s03 = json.load(f)

# Find all Type 9 and Type 8 ditches
type9_runs = []
type8_runs = []
for feat in s03["features"]:
    p = feat["properties"]
    code = (p.get("typology_code") or p.get("short_code") or "").upper()
    typ = (p.get("typology") or "").upper()
    if "TYPE 9" in code or "TYPE 9" in typ or "TYPE_9" in code:
        if "CHUTE" not in typ and "DESCENT" not in typ:
            type9_runs.append((p.get("id"), p.get("start_pk"), p.get("end_pk"), p.get("side"), p.get("typology")))
    if "TYPE 8" in code or "TYPE 8" in typ or "TYPE_8" in code:
        type8_runs.append((p.get("id"), p.get("start_pk"), p.get("end_pk"), p.get("side"), p.get("typology")))

print(f"Section 03 Type 9 ditch runs ({len(type9_runs)}):")
for r in type9_runs:
    print(f"  {r[0]}: PK {r[1]:.1f} - {r[2]:.1f} ({r[3]}) - {r[4]}")

print(f"\nSection 03 Type 8 ditch runs ({len(type8_runs)}):")
for r in type8_runs:
    print(f"  {r[0]}: PK {r[1]:.1f} - {r[2]:.1f} ({r[3]}) - {r[4]}")

# Check water descents against Type 9/8 runs
water_descents = [f for f in s03["features"] if f["properties"].get("category") == "Water Descent" or "Water Descent" in f["properties"].get("typology", "")]
print(f"\nTotal Water Descents in S03: {len(water_descents)}")

connected = 0
unconnected = 0
for wd in water_descents:
    p = wd["properties"]
    pk = p.get("start_pk")
    side = p.get("side")
    # Check if inside any Type 9 run on the same side
    has_t9 = any(r[1] - 5 <= pk <= r[2] + 5 and (r[3] == side or r[3] == "Center" or side == "Center") for r in type9_runs)
    has_t8 = any(r[1] - 5 <= pk <= r[2] + 5 and (r[3] == side or r[3] == "Center" or side == "Center") for r in type8_runs)
    if has_t9 or has_t8:
        connected += 1
    else:
        unconnected += 1

print(f"Connected to Type 9 / Type 8 runs: {connected}")
print(f"NOT connected to Type 9 / Type 8 runs: {unconnected}")
