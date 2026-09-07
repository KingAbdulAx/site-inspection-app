import os
import sys
import re
import math
import json

sys.stdout.reconfigure(encoding='utf-8')

# Ensure root directory is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import the sorted items list from compile_unified_schedule
from compile_unified_schedule import sorted_items

# Load the centerline geometry
with open('app/data/section03_centerline.json', 'r', encoding='utf-8') as f:
    centerline_data = json.load(f)

dense_points = centerline_data['dense_points']
pks = [p['pk'] for p in dense_points]

def get_track_point(target_pk):
    # Clamps and interpolates point along centerline
    if target_pk <= pks[0]:
        return dense_points[0]['lon'], dense_points[0]['lat'], dense_points[0]['bearing']
    if target_pk >= pks[-1]:
        return dense_points[-1]['lon'], dense_points[-1]['lat'], dense_points[-1]['bearing']
        
    idx = 0
    while idx < len(pks) - 1 and pks[idx+1] < target_pk:
        idx += 1
        
    p1 = dense_points[idx]
    p2 = dense_points[idx+1]
    denom = p2['pk'] - p1['pk']
    frac = (target_pk - p1['pk']) / denom if denom > 0 else 0
    
    t_lon = p1['lon'] + frac * (p2['lon'] - p1['lon'])
    t_lat = p1['lat'] + frac * (p2['lat'] - p1['lat'])
    return t_lon, t_lat, p1['bearing']

def offset_point(lon, lat, bearing, dist_m):
    # dist_m: positive for right (+90 deg), negative for left (-90 deg)
    R = 6371000.0
    offset_bearing = (bearing + (90 if dist_m >= 0 else -90)) % 360
    d = abs(dist_m)
    
    phi1 = math.radians(lat)
    lam1 = math.radians(lon)
    brg = math.radians(offset_bearing)
    delta = d / R
    
    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(brg))
    lam2 = lam1 + math.atan2(math.sin(brg) * math.sin(delta) * math.cos(phi1), math.cos(delta) - math.sin(phi1) * math.sin(phi2))
    
    return math.degrees(lam2), math.degrees(phi2)

def parse_chainage(ch_str):
    matches = re.findall(r'(\d+)\+(\d+)', ch_str)
    if len(matches) == 2:
        start_m = int(matches[0][0]) * 1000 + float(matches[0][1])
        end_m = int(matches[1][0]) * 1000 + float(matches[1][1])
        return start_m, end_m, False
    elif len(matches) == 1:
        pt_m = int(matches[0][0]) * 1000 + float(matches[0][1])
        return pt_m, pt_m, True
    return 0, 0, False

def determine_asset_attributes(pos, typ):
    pos_l = pos.lower()
    typ_l = typ.lower()
    
    # Side
    if 'left' in pos_l:
        side = 'Left'
        sign = -1
    elif 'right' in pos_l:
        side = 'Right'
        sign = 1
    else:
        side = 'Center'
        sign = 0
        
    # Standard Typology Mapping
    if 'rectangular channel' in typ_l:
        code = 'Rect Chan'
        category = 'Crest Channel'
        color = '#DC2626' # Red / Crimson
        offset_m = 25.0 * sign
        drawing_ref = 'DW-03001 / DW-03002 / DW-03100'
        specs = 'Concrete Rectangular Channel - Zone I (B=2.50m, H=1.50m, i=0.5%, Qadm=8.91 m3/s)'
        icon = 'channel'
    elif 'type 1 larger' in typ_l:
        code = 'Type 1 Lgr'
        category = 'Side Ditch'
        color = '#1D4ED8' # Dark Blue
        offset_m = 6.5 * sign
        drawing_ref = 'MDDTDW220010001 / DW-03002'
        specs = 'Concrete trapezoidal cut ditch (B=4.0-4.5m, H=0.60m, 1:2)'
        icon = 'ditch'
    elif 'type 1' in typ_l and 'type 11' not in typ_l and 'type 12' not in typ_l and 'type 13' not in typ_l and 'type 16' not in typ_l:
        code = 'Type 1 Std'
        category = 'Side Ditch'
        color = '#3B82F6' # Blue
        offset_m = 5.5 * sign
        drawing_ref = 'MDDTDW220010001'
        specs = 'Concrete trapezoidal cut ditch (b=0.75m, h=0.75m, 1:1)'
        icon = 'ditch'
    elif 'type 4' in typ_l or 'unlined toe' in typ_l:
        code = 'Type 4'
        category = 'Toe Ditch'
        color = '#92400E' # Earth Brown
        offset_m = 18.0 * sign
        drawing_ref = 'MDDTDW220010001'
        specs = 'Unlined earth ditch at embankment foot (H=1.0m, 1:1.5, i>=0.5%)'
        icon = 'ditch'
    elif 'type 7' in typ_l:
        code = 'Type 7'
        category = 'Toe Ditch'
        color = '#EA580C' # Orange
        offset_m = 17.0 * sign
        drawing_ref = 'MDDTDW220010001'
        specs = 'Concrete lined triangular toe ditch (H=0.80m, 1:1.5)'
        icon = 'ditch'
    elif 'type 12' in typ_l:
        code = 'Type 12'
        category = 'Toe Ditch'
        color = '#F59E0B' # Dark Orange / Amber
        offset_m = 18.0 * sign
        drawing_ref = 'MDDTDW220010001'
        specs = 'Concrete trapezoidal toe ditch (B=1.50m, H=0.50m, 1:1.5)'
        icon = 'ditch'
    elif 'type 13' in typ_l:
        code = 'Type 13'
        category = 'Toe Ditch'
        color = '#B45309'
        offset_m = 15.0 * sign
        drawing_ref = 'MDDTDW220010006'
        specs = 'Concrete rectangular toe ditch (B=1.50m, H=1.00m)'
        icon = 'ditch'
    elif 'type 8' in typ_l or 'bench' in typ_l:
        code = 'Type 8'
        category = 'Berm Ditch'
        color = '#0D9488' # Teal
        offset_m = 12.0 * sign
        drawing_ref = 'MDDTDW220010020'
        specs = 'Precast half-round ditch (D=0.30m) on 6m intermediate fill berm'
        icon = 'ditch'
    elif 'type 9' in typ_l or 'cascade' in typ_l or 'shoulder' in typ_l or 'half-round' in typ_l:
        code = 'Type 9'
        category = 'Shoulder / Cascade'
        color = '#10B981' # Green
        offset_m = 4.5 * sign
        drawing_ref = 'MDDTDW220010003 / DW-10020'
        specs = 'Precast half-round ditch (D=0.30m) / Stepped cascades down slope'
        icon = 'cascade'
    elif 'type 11' in typ_l or 'type 5' in typ_l or 'crest' in typ_l:
        code = 'Type 11'
        category = 'Crest Ditch'
        color = '#D97706' # Amber
        offset_m = 22.0 * sign
        drawing_ref = 'DW-03002 / MDDTDW220010001'
        specs = 'Concrete lined ditch at cutting crest (H=0.50m, 1:1.5)'
        icon = 'ditch'
    elif 'dissipator' in typ_l or 'bs2' in typ_l:
        code = 'Dissipator BS2'
        category = 'Energy Dissipator'
        color = '#D97706'
        offset_m = 8.0 * (sign if sign != 0 else 1)
        drawing_ref = 'DW-03001 / MDDTDW220010002'
        specs = 'Energy Dissipator Structure BS2 at sub-ballast collector outfall (Ø800 transverse crossing)'
        icon = 'cascade'
    elif 'discharge pipe' in typ_l:
        code = 'Discharge Pipe'
        category = 'Track Drainage'
        color = '#6366F1'
        offset_m = 9.0 * (sign if sign != 0 else 1)
        drawing_ref = 'DW-03001'
        specs = 'Concrete sub-ballast discharge pipe to outfall (Ø600 / Ø800)'
        icon = 'collector'
    elif 'type 6' in typ_l or 'collector' in typ_l:
        code = 'Type 6'
        category = 'Track Drainage'
        color = '#8B5CF6' # Purple
        offset_m = 0.0
        drawing_ref = 'DW-03001 / MDDTDW220010001'
        specs = 'Sub-surface deep drainage (Perforated PVC in gravel + manholes @ 50m)'
        icon = 'collector'
    elif 'channel type a' in typ_l:
        code = 'Chan A'
        category = 'Diversion Channel'
        color = '#DC2626' # Red
        offset_m = 25.0 * sign
        drawing_ref = 'MDDTDW220010002'
        specs = 'High-capacity unlined earth channel (B=20.0m, H=2.0m)'
        icon = 'channel'
    elif 'channel' in typ_l:
        code = 'Chan B'
        category = 'Diversion Channel'
        color = '#EF4444' # Red
        offset_m = 22.0 * sign
        drawing_ref = 'MDDTDW220010002 / DW-03001'
        specs = 'Concrete trapezoidal diversion channel (B=0.6-7.0m, H=0.8-1.0m, 1:1)'
        icon = 'channel'
    elif 'outfall' in typ_l or 'tail channel' in typ_l:
        code = 'Outfall'
        category = 'Culvert Outfall'
        color = '#64748B' # Slate
        offset_m = 25.0 * sign
        drawing_ref = 'MDDTDW220010002 / DW-03002'
        specs = 'Unlined trapezoidal culvert outfall tail channel (B=3.2-8.0m, 1:1.5)'
        icon = 'outfall'
    elif 'triple box' in typ_l or '3x' in typ_l:
        code = '3x Box Culv'
        category = 'Cross Drainage'
        color = '#334155' # Slate
        offset_m = 0.0
        drawing_ref = 'MDDTDW220010002 / DW-03002'
        specs = 'Reinforced concrete triple box culvert 3x(2.0x2.0m) / 3x(3.0x3.0m)'
        icon = 'culvert_box'
    elif 'twin box' in typ_l or '2x' in typ_l:
        code = '2x Box Culv'
        category = 'Cross Drainage'
        color = '#334155'
        offset_m = 0.0
        drawing_ref = 'MDDTDW220010002'
        specs = 'Reinforced concrete twin box culvert 2x(2.0x2.0m)'
        icon = 'culvert_box'
    elif 'single box' in typ_l or 'box culvert 1x' in typ_l:
        code = '1x Box Culv'
        category = 'Cross Drainage'
        color = '#334155'
        offset_m = 0.0
        drawing_ref = 'MDDTDW220010002 / DW-03001'
        specs = 'Reinforced concrete single box culvert 1x(2.0x2.0m) / 1x(2.5x2.5m)'
        icon = 'culvert_box'
    elif 'pipe' in typ_l:
        code = 'Pipe Culv'
        category = 'Cross Drainage'
        color = '#475569'
        offset_m = 0.0
        drawing_ref = 'MDDTDW220000023-31 / DW-03006'
        specs = 'Precast concrete pipe culvert (Ø1.2m / Ø1.5m on concrete cradle)'
        icon = 'culvert_pipe'
    elif 'overpass' in typ_l or 'overbridge' in typ_l or 'ovr-' in typ_l or 'overbridge' in pos_l:
        code = 'Overbridge'
        category = 'Overhead Crossing'
        color = '#0F172A' # Dark Charcoal
        offset_m = 0.0
        drawing_ref = 'DW-03002 / MDDTDW220010006'
        specs = 'Road Overbridge OVR-2801 (Approach road drainage: VT4-3 / VT4-4)'
        icon = 'bridge'
    elif 'bridge' in typ_l:
        code = 'Bridge'
        category = 'Bridge Crossing'
        color = '#0F172A'
        offset_m = 0.0
        drawing_ref = 'KNDWDW28... / DW-03007'
        specs = 'Railway Bridge Structure (BRG-2601 / BRG-2602 / BRG-2603)'
        icon = 'bridge'
    elif 'underpass' in typ_l or 'cattle' in typ_l or 'udr' in typ_l:
        code = 'Underpass'
        category = 'Underpass'
        color = '#1E293B'
        offset_m = 0.0
        drawing_ref = 'DW-03006 / MDDTDW220010006'
        specs = 'Underpass / Cattle Crossing (UDR) with slope protection L=98m'
        icon = 'underpass'
    elif 'boundary' in typ_l or 'start point' in typ_l:
        code = 'Boundary'
        category = 'Section Boundary'
        color = '#64748B'
        offset_m = 0.0
        drawing_ref = 'DW-03001'
        specs = 'Section 03 Start Boundary connecting to Section 02'
        icon = 'marker'
    else:
        code = 'Drain'
        category = 'Miscellaneous'
        color = '#64748B'
        offset_m = 0.0
        drawing_ref = 'Standard Details'
        specs = typ
        icon = 'ditch'
        
    return side, code, category, color, offset_m, drawing_ref, specs, icon

def build_asset_features():
    features = []
    
    for idx, (ch_str, pos, typ) in enumerate(sorted_items):
        start_pk, end_pk, is_point = parse_chainage(ch_str)
        side, code, category, color, offset_m, drawing_ref, specs, icon = determine_asset_attributes(pos, typ)
        
        asset_id = f"asset_{idx+1:03d}"
        
        # Determine geometry
        if is_point:
            # Point structure
            t_lon, t_lat, brg = get_track_point(start_pk)
            
            if category in ['Cross Drainage', 'Overhead Crossing', 'Underpass', 'Bridge Crossing']:
                # Cross line perpendicular to track
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
                p_pos = offset_point(t_lon, t_lat, brg, offset_m)
                geom = {
                    "type": "Point",
                    "coordinates": [round(p_pos[0], 7), round(p_pos[1], 7)]
                }
        else:
            # Linear ditch or channel
            # Sample every 25m along alignment
            coords = []
            span_m = end_pk - start_pk
            steps = max(2, int(math.ceil(span_m / 25.0)))
            
            for s in range(steps + 1):
                cur_pk = start_pk + (s / steps) * span_m
                t_lon, t_lat, brg = get_track_point(cur_pk)
                p_off = offset_point(t_lon, t_lat, brg, offset_m)
                coords.append([round(p_off[0], 7), round(p_off[1], 7)])
                
            geom = {
                "type": "LineString",
                "coordinates": coords
            }
            
        feature = {
            "type": "Feature",
            "id": asset_id,
            "properties": {
                "id": asset_id,
                "chainage_str": ch_str,
                "start_pk": start_pk,
                "end_pk": end_pk,
                "length_m": round(end_pk - start_pk, 1) if not is_point else 0.0,
                "is_point": is_point,
                "side": side,
                "position": pos,
                "typology": typ,
                "short_code": code,
                "category": category,
                "color": color,
                "drawing_ref": drawing_ref,
                "specs": specs,
                "icon": icon,
                "status": "Not Started", # Default status
                "notes": "",
                "inspection_date": ""
            },
            "geometry": geom
        }
        
        features.append(feature)
        
    return features

def main():
    features = build_asset_features()
    
    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Section 03 Verified Drainage Assets",
            "count": len(features),
            "generated_at": "September 2026"
        },
        "features": features
    }
    
    out_file = "app/data/section03_assets.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
        
    print(f"Saved {out_file} successfully ({len(features)} drainage features mapped onto alignment)!")

    # Write synchronous bundle.js for instant browser loading under file:// protocol
    with open("app/data/section03_centerline.json", "r", encoding="utf-8") as f:
        centerline_json = f.read()
    assets_json = json.dumps(geojson)
    bundle_content = f"window.SECTION03_CENTERLINE = {centerline_json};\nwindow.SECTION03_ASSETS = {assets_json};\n"
    with open("app/data/bundle.js", "w", encoding="utf-8") as f:
        f.write(bundle_content)
    print("Saved app/data/bundle.js successfully!")

if __name__ == '__main__':
    main()

