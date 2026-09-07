import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

print("--- Inspecting the 99 candidates ---")
actual_culverts = []
channels_ditches_matched = []

for a in assets:
    p = a["properties"]
    typ = p.get("typology", "")
    cat = p.get("category", "")
    is_pt = p.get("is_point", False)
    geom_type = a["geometry"]["type"]
    aid = a["id"]
    
    # Culverts are Cross Drainage structures (points)
    # Check if Point geometry or is_point
    if is_pt or geom_type == "Point":
        if "box culvert" in typ.lower() or "pipe culvert" in typ.lower() or "culvert" in typ.lower() or cat == "Cross Drainage":
            actual_culverts.append(a)
    else:
        # LineString
        channels_ditches_matched.append(a)

print(f"Actual Culvert structures (Points): {len(actual_culverts)}")
print(f"Channels / Ditches that mentioned culvert in typology: {len(channels_ditches_matched)}")

print("\n--- Non-Point assets that mentioned culvert ---")
for a in channels_ditches_matched:
    p = a["properties"]
    print(f"{a['id']:<10} | {p.get('chainage_str'):<22} | Cat: {p.get('category'):<18} | Typ: {p.get('typology')}")

print("\n--- Summary of Actual Culvert Structures ---")
from collections import Counter
culv_typologies = Counter(a["properties"].get("typology", "") for a in actual_culverts)
for t, cnt in culv_typologies.most_common():
    print(f"  {cnt:<3} x {t}")
