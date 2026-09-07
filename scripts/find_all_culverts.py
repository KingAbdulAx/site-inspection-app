import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

culvert_assets = []
for a in assets:
    p = a["properties"]
    cat = p.get("category", "")
    typ = p.get("typology", "")
    pos = p.get("position", "")
    icon = p.get("icon", "")
    
    if cat == "Cross Drainage" or pos == "Cross Drainage" or "culvert" in typ.lower() or icon in ["culvert_box", "culvert_pipe"]:
        culvert_assets.append(a)

print(f"Total culvert assets found in section03_assets.json: {len(culvert_assets)}")

# Check their types
box_culverts = [a for a in culvert_assets if "box" in a["properties"].get("typology", "").lower()]
pipe_culverts = [a for a in culvert_assets if "pipe" in a["properties"].get("typology", "").lower()]
other_culverts = [a for a in culvert_assets if a not in box_culverts and a not in pipe_culverts]

print(f"Box Culverts: {len(box_culverts)}")
print(f"Pipe Culverts: {len(pipe_culverts)}")
print(f"Other: {len(other_culverts)}")

# Sample 10
for a in culvert_assets[:10]:
    print(f"{a['id']:<10} | {a['properties'].get('chainage_str'):<12} | {a['properties'].get('typology')}")
