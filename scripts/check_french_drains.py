import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

french_drains = [a for a in assets if "french" in str(a["properties"]).lower() or "underdrain" in str(a["properties"]).lower() or "type 8" in str(a["properties"]).lower() or "type 6" in str(a["properties"]).lower()]
print(f"Total French / Underdrain / Type 8 / Type 6 assets in PWA: {len(french_drains)}")
for fd in french_drains[:10]:
    print(fd["id"], fd["properties"]["chainage_str"], fd["properties"]["typology"])
