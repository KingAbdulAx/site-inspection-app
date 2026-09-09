import os
import sys
import json
import math

sys.stdout.reconfigure(encoding='utf-8')

APP_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"
DATA_DIR = os.path.join(APP_DIR, "data")

FEATURES_FILE = os.path.join(DATA_DIR, "section02_features.json")
CENTERLINE_FILE = os.path.join(DATA_DIR, "section02_centerline.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "section02_assets.json")

print("=================================================================")
print("=== PHASE 4: COMPILE SECTION 02 ASSETS GEOJSON (s02_asset_XXX) ===")
print("=================================================================")

# 1. Load Centerline
print(f"Loading centerline from {CENTERLINE_FILE}...")
with open(CENTERLINE_FILE, "r", encoding="utf-8") as f:
    cl_data = json.load(f)

dense_points = cl_data["dense_points"]
pks = [p["pk"] for p in dense_points]
min_cl_pk = pks[0]
max_cl_pk = pks[-1]
print(f"Centerline loaded: {len(dense_points)} points spanning PK {min_cl_pk:.3f} to PK {max_cl_pk:.3f}")

def get_track_point(target_pk):
    """Interpolates (lon, lat, bearing) along the Section 02 centerline spline."""
    if target_pk <= pks[0]:
        return dense_points[0]['lon'], dense_points[0]['lat'], dense_points[0]['bearing']
    if target_pk >= pks[-1]:
        return dense_points[-1]['lon'], dense_points[-1]['lat'], dense_points[-1]['bearing']
        
    # Binary search or sequential scan
    # Given sorted pks, use bisect
    import bisect
    idx = bisect.bisect_right(pks, target_pk) - 1
    idx = max(0, min(idx, len(pks) - 2))
    
    p1 = dense_points[idx]
    p2 = dense_points[idx+1]
    denom = p2['pk'] - p1['pk']
    frac = (target_pk - p1['pk']) / denom if denom > 0 else 0.0
    
    t_lon = p1['lon'] + frac * (p2['lon'] - p1['lon'])
    t_lat = p1['lat'] + frac * (p2['lat'] - p1['lat'])
    return t_lon, t_lat, p1['bearing']

def offset_point(lon, lat, bearing, dist_m):
    """Geodesic offset perpendicular to track (dist_m: + for right, - for left)."""
    R = 6371000.0 # Earth radius in meters
    offset_bearing = (bearing + (90.0 if dist_m >= 0 else -90.0)) % 360.0
    d = abs(dist_m)
    
    phi1 = math.radians(lat)
    lam1 = math.radians(lon)
    brg = math.radians(offset_bearing)
    delta = d / R
    
    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(brg))
    lam2 = lam1 + math.atan2(math.sin(brg) * math.sin(delta) * math.cos(phi1), math.cos(delta) - math.sin(phi1) * math.sin(phi2))
    
    return math.degrees(lam2), math.degrees(phi2)

def format_chainage_str(start_pk, end_pk, is_point):
    if is_point:
        km = int(start_pk // 1000)
        m = int(round(start_pk % 1000))
        return f"PK {km}+{m:03d}"
    else:
        skm, sm = int(start_pk // 1000), int(round(start_pk % 1000))
        ekm, em = int(end_pk // 1000), int(round(end_pk % 1000))
        return f"PK {skm}+{sm:03d} – PK {ekm}+{em:03d}"

# 2. Load Features
print(f"Loading features from {FEATURES_FILE}...")
with open(FEATURES_FILE, "r", encoding="utf-8") as f:
    feat_data = json.load(f)

features = feat_data["features"]
print(f"Loaded {len(features)} features.")

# Sort features by start_pk, then by category
features.sort(key=lambda f: (f["start_pk"], f["category"], f.get("side", "")))

geojson_features = []

for idx, feat in enumerate(features, start=1):
    asset_id = f"s02_asset_{idx:03d}"
    
    cat = feat["category"]
    typ = feat["typology"]
    short_code = feat["short_code"]
    side = feat.get("side", "Center")
    start_pk = feat["start_pk"]
    end_pk = feat["end_pk"]
    is_point = feat["is_point"]
    length_m = feat["length_m"]
    pos = feat.get("position", "")
    specs = feat.get("specs", "")
    drawing_ref = feat.get("source_drawing", "")
    notes = feat.get("notes", "")
    conf = feat.get("confidence", "CONFIRMED")
    v_stat = feat.get("effective_status", "LEVEL A")
    d_method = feat.get("derivation_method", "")
    
    # Sign for side offset: Left = -1, Right = +1, Center = 0
    sign = -1.0 if side == "Left" else (1.0 if side == "Right" else 0.0)
    
    # Determine color, icon, and offset_m
    if cat == "Section Boundary":
        color = "#64748B"
        icon = "marker"
        offset_m = 0.0
    elif cat == "Cross Drainage":
        color = "#334155"
        icon = "culvert_box" if "Box" in typ or "BC" in typ else "culvert_pipe"
        offset_m = 0.0
    elif cat == "Diversion Channel":
        color = "#EF4444"
        icon = "channel"
        offset_m = 25.0 * (sign if sign != 0 else 1.0)
    elif cat == "Track Drainage":
        color = "#8B5CF6"
        icon = "collector"
        offset_m = 0.0
    elif cat == "Toe Ditch":
        if "Type 7" in typ:
            color = "#EA580C"
            offset_m = 17.0 * (sign if sign != 0 else 1.0)
        elif "Type 4" in typ:
            color = "#92400E"
            offset_m = 18.0 * (sign if sign != 0 else 1.0)
        else: # Type 12
            color = "#F59E0B"
            offset_m = 18.0 * (sign if sign != 0 else 1.0)
        icon = "ditch"
    elif cat == "Riprap Protection":
        color = "#78716C"
        icon = "ditch"
        offset_m = 10.0 * (sign if sign != 0 else 1.0)
    elif cat == "Berm Ditch":
        color = "#0D9488"
        icon = "ditch"
        offset_m = 12.0 * (sign if sign != 0 else 1.0)
    elif cat == "Shoulder / Cascade":
        color = "#10B981"
        icon = "cascade"
        offset_m = 4.5 * (sign if sign != 0 else 1.0)
    elif cat == "Water Descent":
        color = "#0284C7"
        icon = "cascade"
        offset_m = 6.0 * (sign if sign != 0 else 1.0)
    else:
        color = "#64748B"
        icon = "ditch"
        offset_m = 15.0 * (sign if sign != 0 else 1.0)
        
    # Build Geometry
    if is_point:
        t_lon, t_lat, brg = get_track_point(start_pk)
        
        if cat in ["Cross Drainage", "Section Boundary"] and cat == "Cross Drainage":
            # Perpendicular cross line across track (-15m to +15m)
            p_left = offset_point(t_lon, t_lat, brg, -15.0)
            p_right = offset_point(t_lon, t_lat, brg, 15.0)
            geom = {
                "type": "LineString",
                "coordinates": [
                    [round(p_left[0], 7), round(p_left[1], 7)],
                    [round(p_right[0], 7), round(p_right[1], 7)]
                ]
            }
        else:
            # Discrete point structure (Water Descent, Section Boundary marker)
            p_pos = offset_point(t_lon, t_lat, brg, offset_m)
            geom = {
                "type": "Point",
                "coordinates": [round(p_pos[0], 7), round(p_pos[1], 7)]
            }
    else:
        # Linear feature: sample every 25m along alignment
        span_m = max(1.0, end_pk - start_pk)
        steps = max(2, int(math.ceil(span_m / 25.0)))
        coords = []
        
        for s in range(steps + 1):
            cur_pk = start_pk + (s / steps) * span_m
            t_lon, t_lat, brg = get_track_point(cur_pk)
            p_off = offset_point(t_lon, t_lat, brg, offset_m)
            coords.append([round(p_off[0], 7), round(p_off[1], 7)])
            
        geom = {
            "type": "LineString",
            "coordinates": coords
        }
        
    chainage_str = format_chainage_str(start_pk, end_pk, is_point)
    
    props = {
        "id": asset_id,
        "chainage_str": chainage_str,
        "start_pk": round(start_pk, 3),
        "end_pk": round(end_pk, 3),
        "length_m": round(length_m, 1),
        "is_point": is_point,
        "side": side,
        "position": pos,
        "typology": typ,
        "short_code": short_code,
        "category": cat,
        "color": color,
        "drawing_ref": drawing_ref,
        "specs": specs,
        "icon": icon,
        "status": "Not Started",
        "notes": notes,
        "inspection_date": "",
        "confidence": conf,
        "effective_status": v_stat,
        "derivation_method": d_method
    }
    
    geojson_features.append({
        "type": "Feature",
        "id": asset_id,
        "properties": props,
        "geometry": geom
    })

geojson_doc = {
    "type": "FeatureCollection",
    "metadata": {
        "title": "Section 02 Verified Drainage Assets (Dawanau to Kazaure)",
        "section": "Section 02 (DWKZ)",
        "count": len(geojson_features),
        "nominal_extent": "PK 19+800 to PK 82+902.439",
        "total_span_m": 63102.439,
        "generated_at": "September 2026"
    },
    "features": geojson_features
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(geojson_doc, f, indent=2)

print(f"\nSuccessfully compiled {len(geojson_features)} assets to {OUTPUT_FILE}")
print(f"File size: {os.path.getsize(OUTPUT_FILE):,} bytes")
