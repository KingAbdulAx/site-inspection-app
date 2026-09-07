import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

actual_culverts = []
for a in assets:
    p = a["properties"]
    typ = p.get("typology", "")
    cat = p.get("category", "")
    is_pt = p.get("is_point", False)
    geom_type = a["geometry"]["type"]
    
    # Culverts are Cross Drainage structures (points)
    if is_pt or geom_type == "Point":
        if "box culvert" in typ.lower() or "pipe culvert" in typ.lower() or "culvert" in typ.lower() or cat == "Cross Drainage":
            actual_culverts.append(a)

print(f"Total Actual Culvert Structures in Section 03: {len(actual_culverts)}")

# Print all of them with ID, PK, typology
culvert_ids = []
for i, a in enumerate(sorted(actual_culverts, key=lambda x: x["properties"].get("start_pk", 0)), 1):
    p = a["properties"]
    culvert_ids.append(a["id"])
    print(f"{i:<3} | {a['id']:<10} | {p.get('chainage_str'):<12} | PK: {p.get('start_pk'):<8} | {p.get('typology')}")

with open("all_section03_culvert_ids.json", "w", encoding="utf-8") as f:
    json.dump(culvert_ids, f, indent=2)

print("Saved all_section03_culvert_ids.json")
