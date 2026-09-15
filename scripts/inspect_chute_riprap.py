import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("=== Chute / Water Descent sample ===")
chute_samples = [f for f in data["features"] if "Precast Water Descent" in f["properties"].get("typology", "")]
for f in chute_samples[:5]:
    print("ID:", f["properties"]["id"])
    print("Props:", f["properties"])
    print("Geom type:", f["geometry"]["type"])
    print("Geom coords:", f["geometry"]["coordinates"])
    print("-" * 40)

print("\n=== Riprap sample ===")
riprap_samples = [f for f in data["features"] if "Riprap" in f["properties"].get("typology", "") or f["properties"].get("typology_code") == "RIPRAP"]
for f in riprap_samples[:5]:
    print("ID:", f["properties"]["id"])
    print("Props:", f["properties"])
    print("Geom type:", f["geometry"]["type"])
    print("Geom coords:", f["geometry"]["coordinates"])
    print("-" * 40)

print("\n=== Dissipator sample ===")
diss_samples = [f for f in data["features"] if "dissipat" in (f["properties"].get("typology", "") + f["properties"].get("name", "") + f["properties"].get("id", "")).lower()]
for f in diss_samples[:5]:
    print("ID:", f["properties"]["id"])
    print("Props:", f["properties"])
    print("Geom type:", f["geometry"]["type"])
    print("Geom coords:", f["geometry"]["coordinates"])
    print("-" * 40)
