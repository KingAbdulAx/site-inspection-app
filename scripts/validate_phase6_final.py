import json
import os
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

APP_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"
DATA_DIR = os.path.join(APP_DIR, "data")

print("=================================================================")
print("=== PHASE 6: COMPREHENSIVE FINAL VALIDATION & AUDIT ===")
print("=================================================================")

# 1. Load Data
with open(os.path.join(DATA_DIR, "section02_assets.json"), encoding='utf-8') as f:
    s02_data = json.load(f)

with open(os.path.join(DATA_DIR, "section03_assets.json"), encoding='utf-8') as f:
    s03_data = json.load(f)

with open(os.path.join(DATA_DIR, "section02_centerline.json"), encoding='utf-8') as f:
    cl02_data = json.load(f)

with open(os.path.join(DATA_DIR, "section03_centerline.json"), encoding='utf-8') as f:
    cl03_data = json.load(f)

s02_features = s02_data["features"]
s03_features = s03_data["features"]

print(f"Loaded Section 02 Assets: {len(s02_features)}")
print(f"Loaded Section 03 Assets: {len(s03_features)}")
print(f"Total Unified Corridor Assets: {len(s02_features) + len(s03_features)}")

# 2. Section Extent Verification
# Contractual Section 02 extent: PK 18+400 (Dawanau Yard Package start) to PK 82+902.439 (Connection with S03)
MIN_PK = 18400.0
MAX_PK = 82902.439 + 0.1

out_of_bounds = [
    f for f in s02_features 
    if f["properties"]["start_pk"] < MIN_PK - 1.0 or f["properties"]["end_pk"] > MAX_PK + 1.0
]
print(f"\n1. Features outside section extent [PK 18+400 to PK 82+902]: {len(out_of_bounds)}")
assert len(out_of_bounds) == 0, f"Found out of bounds: {[f['id'] for f in out_of_bounds]}"

# 3. Geometry Direction & Positive Length
invalid_dir = [f for f in s02_features if f["properties"]["end_pk"] < f["properties"]["start_pk"]]
print(f"2. Features with end_pk < start_pk: {len(invalid_dir)}")
assert len(invalid_dir) == 0

invalid_len = [
    f for f in s02_features 
    if not f["properties"]["is_point"] and f["properties"]["length_m"] <= 0.0
]
print(f"3. Linear features with length_m <= 0.0: {len(invalid_len)}")
assert len(invalid_len) == 0

# 4. ID Collision Verification
s02_ids = [f["id"] for f in s02_features]
s03_ids = set(f["id"] for f in s03_features)
assert len(s02_ids) == len(set(s02_ids)), "Duplicate IDs found within Section 02!"
collisions = [aid for aid in s02_ids if aid in s03_ids]
print(f"4. ID Collisions between Section 02 and Section 03: {len(collisions)}")
assert len(collisions) == 0

# 5. Category Breakdown with Primary Source Drawings
cat_sources = {}
for f in s02_features:
    p = f["properties"]
    c = p["category"]
    draw = p["drawing_ref"]
    if c not in cat_sources:
        cat_sources[c] = {"count": 0, "total_len": 0.0, "sources": {}}
    cat_sources[c]["count"] += 1
    cat_sources[c]["total_len"] += p.get("length_m", 0.0)
    
    # Track top drawing references
    d_short = draw.split('/')[0].strip() if draw else 'Unspecified'
    cat_sources[c]["sources"][d_short] = cat_sources[c]["sources"].get(d_short, 0) + 1

print("\n5. Feature Breakdown by Category with Primary Source Drawings:")
print(f"{'Category':<22} | {'Count':<6} | {'Length (m)':<12} | {'Sample Sources'}")
print("-" * 80)
for c, info in sorted(cat_sources.items(), key=lambda x: x[1]["count"], reverse=True):
    top_src = ", ".join(f"{s} ({n})" for s, n in list(info["sources"].items())[:3])
    print(f"{c:<22} | {info['count']:<6} | {info['total_len']:<12.1f} | {top_src[:45]}")

# 6. Centerline Round-Trip Verification (PK -> Lon/Lat -> Projected PK)
pts02 = cl02_data["dense_points"]
pks02 = [p["pk"] for p in pts02]
R_EARTH = 6371000.0

def interpolate_pk_point(target_pk):
    import bisect
    idx = bisect.bisect_right(pks02, target_pk) - 1
    idx = max(0, min(idx, len(pks02) - 2))
    p1 = pts02[idx]
    p2 = pts02[idx+1]
    denom = p2['pk'] - p1['pk']
    frac = (target_pk - p1['pk']) / denom if denom > 0 else 0.0
    lon = p1['lon'] + frac * (p2['lon'] - p1['lon'])
    lat = p1['lat'] + frac * (p2['lat'] - p1['lat'])
    return lat, lon

def project_lat_lon(lat, lon):
    bestDistSq = Infinity = float('inf')
    bestSegmentIdx = 0
    for i in range(0, len(pts02), 2):
        dLat = (lat - pts02[i]["lat"]) * 111139.0
        dLon = (lon - pts02[i]["lon"]) * 111139.0 * math.cos(math.radians(lat))
        dSq = dLat * dLat + dLon * dLon
        if dSq < bestDistSq:
            bestDistSq = dSq
            bestSegmentIdx = max(0, i - 1)
            
    searchStart = max(0, bestSegmentIdx - 4)
    searchEnd = min(len(pts02) - 2, bestSegmentIdx + 4)
    minPerpDist = float('inf')
    finalPk = pts02[bestSegmentIdx]["pk"]
    
    for i in range(searchStart, searchEnd + 1):
        p1 = pts02[i]
        p2 = pts02[i+1]
        cosLat = math.cos(math.radians(p1["lat"]))
        vx = (p2["lon"] - p1["lon"]) * ((math.pi * R_EARTH) / 180.0) * cosLat
        vy = (p2["lat"] - p1["lat"]) * ((math.pi * R_EARTH) / 180.0)
        ux = (lon - p1["lon"]) * ((math.pi * R_EARTH) / 180.0) * cosLat
        uy = (lat - p1["lat"]) * ((math.pi * R_EARTH) / 180.0)
        lenSq = vx * vx + vy * vy
        if lenSq == 0: continue
        t = max(0.0, min(1.0, (ux * vx + uy * vy) / lenSq))
        projX = t * vx
        projY = t * vy
        dx = ux - projX
        dy = uy - projY
        perpDist = math.sqrt(dx * dx + dy * dy)
        if perpDist < minPerpDist:
            minPerpDist = perpDist
            finalPk = p1["pk"] + t * (p2["pk"] - p1["pk"])
            
    return finalPk, minPerpDist

print("\n6. Round-Trip Accuracy Check (PK -> Coords -> Orthogonal Projection):")
test_pks = [19800.0, 25000.0, 35000.0, 48000.0, 60000.0, 72000.0, 80000.0, 82902.439]
max_err = 0.0
for tpk in test_pks:
    lat, lon = interpolate_pk_point(tpk)
    proj_pk, perp_dist = project_lat_lon(lat, lon)
    err_m = abs(proj_pk - tpk)
    max_err = max(max_err, err_m)
    print(f"  Target PK {tpk:9.3f} -> Lat/Lon ({lat:.6f}, {lon:.6f}) -> Projected PK {proj_pk:9.3f} (Err: {err_m*1000:6.2f} mm)")

assert max_err < 0.05, f"Round trip error exceeded 50mm: {max_err} m"
print(f"\nMax round-trip error across Section 02: {max_err*1000:.2f} mm (< 50 mm threshold).")

# 7. Byte-Exact Backup Check
with open(os.path.join(DATA_DIR, "section03_assets.json.bak"), "rb") as f1, open(os.path.join(DATA_DIR, "section03_assets.json"), "rb") as f2:
    assert f1.read() == f2.read(), "section03_assets.json has been modified from backup!"

with open(os.path.join(DATA_DIR, "section03_centerline.json.bak"), "rb") as f1, open(os.path.join(DATA_DIR, "section03_centerline.json"), "rb") as f2:
    assert f1.read() == f2.read(), "section03_centerline.json has been modified from backup!"

print("\n7. Section 03 Byte-Exact Integrity: 100% MATCH against .bak files.")
print("=== ALL PHASE 6 VALIDATIONS PASSED WITH ZERO DEFECTS ===")
