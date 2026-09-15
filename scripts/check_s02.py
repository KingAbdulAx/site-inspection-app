import json

with open("data/section02_assets.json", "r", encoding="utf-8") as f:
    s02 = json.load(f)

# Find all Type 9 and Type 8 ditches in s02
type9_runs = []
type8_runs = []
water_descents = []
ripraps = []
channels = []

for feat in s02["features"]:
    p = feat["properties"]
    code = (p.get("typology_code") or p.get("short_code") or "").upper()
    typ = (p.get("typology") or "").upper()
    cat = (p.get("category") or "").upper()
    
    if "TYPE 9" in code or "TYPE 9" in typ or "TYPE_9" in code:
        if "CHUTE" not in typ and "DESCENT" not in typ:
            type9_runs.append((p.get("id"), p.get("start_pk"), p.get("end_pk"), p.get("side"), p.get("typology")))
    if "TYPE 8" in code or "TYPE 8" in typ or "TYPE_8" in code:
        type8_runs.append((p.get("id"), p.get("start_pk"), p.get("end_pk"), p.get("side"), p.get("typology")))
    if cat == "WATER DESCENT" or "DESCENT" in typ or "CHUTE" in typ:
        water_descents.append(p)
    if "RIPRAP" in code or "RIPRAP" in typ or "RIPRAP" in cat:
        ripraps.append(p)
    if "CHANNEL" in typ or "CHAN" in code or "CHANNEL" in cat:
        channels.append(p)

print(f"Section 02:")
print(f"  Type 9 runs: {len(type9_runs)}")
print(f"  Type 8 runs: {len(type8_runs)}")
print(f"  Water descents: {len(water_descents)}")
print(f"  Ripraps: {len(ripraps)}")
print(f"  Channels: {len(channels)}")

if water_descents:
    sample = water_descents[0]
    print("Sample water descent in S02:", sample)
