import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

pks = []
for a in assets:
    spk = a["properties"].get("start_pk")
    epk = a["properties"].get("end_pk")
    if spk is not None:
        pks.append(spk)
    if epk is not None:
        pks.append(epk)

print(f"PWA Dataset PK range: PK {min(pks)/1000:.3f} (PK {min(pks):.0f}) to PK {max(pks)/1000:.3f} (PK {max(pks):.0f})")

# Check asset_167, asset_169, asset_176:
for aid in ["asset_167", "asset_169", "asset_176", "asset_002", "asset_064"]:
    match = [a for a in assets if a["id"] == aid]
    if match:
        print(aid, match[0]["properties"])
