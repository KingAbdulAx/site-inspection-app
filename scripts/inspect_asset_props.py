import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

print("Sample 3 culvert assets:")
culverts = [a for a in assets if "culvert" in a["properties"].get("category", "").lower() or "pc" in a["properties"].get("type", "").lower() or "bc" in a["properties"].get("type", "").lower() or a["properties"].get("structure_type") == "CULVERT"]
for c in culverts[:3]:
    print(c["id"], c["properties"])

print("\nSample 3 line ditch assets:")
ditches = [a for a in assets if a["geometry"]["type"] == "LineString"]
for d in ditches[:3]:
    print(d["id"], d["properties"])
