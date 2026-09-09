import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

APP_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"
DATA_DIR = os.path.join(APP_DIR, "data")
S02_ASSETS_FILE = os.path.join(DATA_DIR, "section02_assets.json")
S03_ASSETS_FILE = os.path.join(DATA_DIR, "section03_assets.json")

print("=================================================================")
print("=== VALIDATING SECTION 02 ASSETS GEOJSON (section02_assets.json) ===")
print("=================================================================")

with open(S02_ASSETS_FILE, "r", encoding="utf-8") as f:
    s02_data = json.load(f)

with open(S03_ASSETS_FILE, "r", encoding="utf-8") as f:
    s03_data = json.load(f)

s02_features = s02_data.get("features", [])
s03_features = s03_data.get("features", [])

print(f"Section 02 assets: {len(s02_features)}")
print(f"Section 03 assets: {len(s03_features)}")

# 1. GeoJSON Schema Checks
assert s02_data.get("type") == "FeatureCollection", "Must be FeatureCollection"
assert "metadata" in s02_data, "Must contain metadata"

# 2. Namespace & ID Checks
s02_ids = [f["id"] for f in s02_features]
s03_ids = set(f["id"] for f in s03_features)

assert len(s02_ids) == len(set(s02_ids)), "Duplicate IDs found in Section 02"

invalid_ids = [aid for aid in s02_ids if not re.match(r"^s02_asset_\d+$", aid)]
print(f"IDs violating 's02_asset_XXX' namespace: {len(invalid_ids)}")
assert len(invalid_ids) == 0, f"Found invalid IDs: {invalid_ids[:5]}"

# Check collision with Section 03
collisions = [aid for aid in s02_ids if aid in s03_ids]
print(f"Collisions with Section 03 IDs: {len(collisions)}")
assert len(collisions) == 0, f"Collisions found: {collisions[:5]}"

# 3. Property Completeness Checks
required_props = [
    "id", "chainage_str", "start_pk", "end_pk", "length_m", "is_point",
    "side", "position", "typology", "short_code", "category", "color",
    "drawing_ref", "specs", "icon", "status", "notes", "inspection_date"
]

missing_props_count = 0
for f in s02_features:
    p = f.get("properties", {})
    for prop in required_props:
        if prop not in p:
            missing_props_count += 1
            print(f"Feature {f['id']} missing property: {prop}")
            break

print(f"Features missing required properties: {missing_props_count}")
assert missing_props_count == 0

# 4. Geographic Bounds Checks (Kano/Kazaure corridor: Lon ~8.3-8.6, Lat ~12.0-12.8)
coord_errors = 0
for f in s02_features:
    geom = f.get("geometry", {})
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    
    if gtype == "Point":
        pts = [coords]
    elif gtype == "LineString":
        pts = coords
    else:
        pts = []
        coord_errors += 1
        
    for pt in pts:
        lon, lat = pt[0], pt[1]
        if not (8.3 <= lon <= 8.6 and 12.0 <= lat <= 12.8):
            coord_errors += 1
            print(f"Out-of-bounds coordinate in {f['id']}: [{lon}, {lat}]")
            break

print(f"Coordinate errors / out-of-bounds: {coord_errors}")
assert coord_errors == 0

# 5. Category breakdown in GeoJSON
cat_counts = {}
for f in s02_features:
    c = f["properties"]["category"]
    cat_counts[c] = cat_counts.get(c, 0) + 1

print("\nAsset Breakdown by Category:")
for c, cnt in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {c:<25}: {cnt:4d}")

# 6. Check Section 03 isolation
assert len(s03_features) == 842, f"Section 03 asset count modified! Expected 842, got {len(s03_features)}"
print("\n[VERIFIED] Section 03 assets untouched (count=842).")
print("[VERIFIED] Section 02 assets valid, fully isolated, and ready for app integration.")
