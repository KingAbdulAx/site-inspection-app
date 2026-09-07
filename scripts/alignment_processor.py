import os
import sys
import re
import math
import json
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

def extract_alignment_control_points():
    """
    Extracts the official, authoritative AutoCAD 100m station marks from
    SECTION 03.kmz and SECTION 02.kmz, resolving the ~128m backwards chainage offset.
    """
    kmz3_path = r'KMZs KAMA\01. KANO-MARADI LINE\SECTION 03.kmz'
    kmz2_path = r'KMZs KAMA\01. KANO-MARADI LINE\SECTION 02.kmz'
    
    if not os.path.exists(kmz3_path):
        # Fallback to local working folder or downloads
        alt_path = r'SECTION 03.kmz'
        if os.path.exists(alt_path):
            kmz3_path = alt_path
        else:
            raise FileNotFoundError(f"Source KMZ not found at {kmz3_path}")
            
    control_points = {}
    
    # 1. Read boundary points from Section 02 (PK 82+800)
    if os.path.exists(kmz2_path):
        with zipfile.ZipFile(kmz2_path, 'r') as z:
            root = ET.fromstring(z.read('doc.kml'))
            for p in root.findall('.//{http://www.opengis.net/kml/2.2}Placemark'):
                n = p.find('{http://www.opengis.net/kml/2.2}name')
                if n is not None and n.text:
                    m = re.match(r'^(\d{2,3})\+(\d{3})$', n.text.strip())
                    if m:
                        val = int(m.group(1))*1000 + int(m.group(2))
                        if val in [82800]:
                            pt = p.find('.//{http://www.opengis.net/kml/2.2}coordinates')
                            if pt is not None and pt.text:
                                c = [float(x) for x in pt.text.strip().split(',')[:2]]
                                control_points[val] = (c[0], c[1], f"PK {m.group(1)}+{m.group(2)}")

    # 2. Read all 100m stations from Section 03 (PK 83+000 to PK 124+500)
    with zipfile.ZipFile(kmz3_path, 'r') as z:
        root = ET.fromstring(z.read('doc.kml'))
        for p in root.findall('.//{http://www.opengis.net/kml/2.2}Placemark'):
            n = p.find('{http://www.opengis.net/kml/2.2}name')
            if n is not None and n.text:
                m = re.match(r'^(\d{2,3})\+(\d{3})$', n.text.strip())
                if m:
                    val = int(m.group(1))*1000 + int(m.group(2))
                    pt = p.find('.//{http://www.opengis.net/kml/2.2}coordinates')
                    if pt is not None and pt.text:
                        c = [float(x) for x in pt.text.strip().split(',')[:2]]
                        control_points[val] = (c[0], c[1], f"PK {m.group(1)}+{m.group(2)}")

    # 3. Interpolate PK 82+900 (straight midpoint between 82+800 and 83+000)
    if 82800 in control_points and 83000 in control_points:
        c28 = control_points[82800]
        c30 = control_points[83000]
        lon29 = (c28[0] + c30[0]) / 2.0
        lat29 = (c28[1] + c30[1]) / 2.0
        control_points[82900] = (lon29, lat29, "PK 82+900")
        
    sorted_pks = sorted(control_points.keys())
    print(f"Extracted {len(sorted_pks)} official AutoCAD 100m stations from PK {sorted_pks[0]} to PK {sorted_pks[-1]}")
    return control_points, sorted_pks

def calculate_bearing(lon1, lat1, lon2, lat2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    lam1 = math.radians(lon1)
    lam2 = math.radians(lon2)
    y = math.sin(lam2 - lam1) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(lam2 - lam1)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360

def get_centripetal_t(t, p0, p1, alpha=0.5):
    # Centripetal parameterization (alpha = 0.5) avoids cusps and overshoot
    d = math.hypot(p1[1] - p0[1], p1[2] - p0[2])
    return t + (d ** alpha)

def interpolate_centripetal_catmull_rom(control_points, sorted_pks, step_m=25.0):
    """
    Interpolates smooth, continuous railway track centerline using centripetal Catmull-Rom spline.
    Points are sampled every step_m meters.
    """
    pts = [(pk, control_points[pk][0], control_points[pk][1]) for pk in sorted_pks]
    n = len(pts)
    
    # Boundary padding: extrapolate ghost control points at ends
    p_ext = []
    p_ext.append((pts[0][0] - 100, 2 * pts[0][1] - pts[1][1], 2 * pts[0][2] - pts[1][2]))
    p_ext.extend(pts)
    p_ext.append((pts[-1][0] + 100, 2 * pts[-1][1] - pts[-2][1], 2 * pts[-1][2] - pts[-2][2]))
    
    dense_points = []
    
    for i in range(1, n):
        p0 = p_ext[i - 1]
        p1 = p_ext[i]
        p2 = p_ext[i + 1]
        p3 = p_ext[i + 2]
        
        pk_start = p1[0]
        pk_end = p2[0]
        span_m = pk_end - pk_start
        num_sub = max(1, int(round(span_m / step_m)))
        
        t0 = 0.0
        t1 = get_centripetal_t(t0, p0, p1)
        t2 = get_centripetal_t(t1, p1, p2)
        t3 = get_centripetal_t(t2, p2, p3)
        
        for s in range(num_sub):
            t = t1 + (s / float(num_sub)) * (t2 - t1)
            
            A1_lon = ((t1 - t) * p0[1] + (t - t0) * p1[1]) / (t1 - t0) if t1 > t0 else p1[1]
            A1_lat = ((t1 - t) * p0[2] + (t - t0) * p1[2]) / (t1 - t0) if t1 > t0 else p1[2]
            
            A2_lon = ((t2 - t) * p1[1] + (t - t1) * p2[1]) / (t2 - t1)
            A2_lat = ((t2 - t) * p1[2] + (t - t1) * p2[2]) / (t2 - t1)
            
            A3_lon = ((t3 - t) * p2[1] + (t - t2) * p3[1]) / (t3 - t2) if t3 > t2 else p2[1]
            A3_lat = ((t3 - t) * p2[2] + (t - t2) * p3[2]) / (t3 - t2) if t3 > t2 else p2[2]
            
            B1_lon = ((t2 - t) * A1_lon + (t - t0) * A2_lon) / (t2 - t0)
            B1_lat = ((t2 - t) * A1_lat + (t - t0) * A2_lat) / (t2 - t0)
            
            B2_lon = ((t3 - t) * A2_lon + (t - t1) * A3_lon) / (t3 - t1)
            B2_lat = ((t3 - t) * A2_lat + (t - t1) * A3_lat) / (t3 - t1)
            
            C_lon = ((t2 - t) * B1_lon + (t - t1) * B2_lon) / (t2 - t1)
            C_lat = ((t2 - t) * B1_lat + (t - t1) * B2_lat) / (t2 - t1)
            
            cur_pk = pk_start + (s / float(num_sub)) * span_m
            
            dense_points.append({
                "pk": round(cur_pk, 2),
                "lon": round(C_lon, 7),
                "lat": round(C_lat, 7)
            })
            
    # Add final endpoint
    dense_points.append({
        "pk": round(pts[-1][0], 2),
        "lon": round(pts[-1][1], 7),
        "lat": round(pts[-1][2], 7)
    })
    
    # Compute forward tangential bearing along track for each point
    for i in range(len(dense_points) - 1):
        p_cur = dense_points[i]
        p_next = dense_points[i + 1]
        dense_points[i]["bearing"] = round(calculate_bearing(p_cur["lon"], p_cur["lat"], p_next["lon"], p_next["lat"]), 2)
        
    dense_points[-1]["bearing"] = dense_points[-2]["bearing"]
    
    return dense_points

def build_station_ticks(dense_points, control_points):
    """
    Builds 100m station ticks directly using the official AutoCAD station coordinates,
    ensuring 100% ground and drawing truth.
    """
    ticks_100m = []
    ticks_1km = []
    
    min_pk = int(dense_points[0]["pk"] // 100 * 100)
    max_pk = int(dense_points[-1]["pk"] // 100 * 100)
    
    pks = [p["pk"] for p in dense_points]
    
    for target_pk in range(min_pk, max_pk + 100, 100):
        # Prefer exact official AutoCAD station coordinates if available
        if target_pk in control_points:
            t_lon, t_lat, _ = control_points[target_pk]
            # Find closest bearing from dense_points
            idx = 0
            while idx < len(pks) - 1 and pks[idx + 1] <= target_pk:
                idx += 1
            bearing = dense_points[idx]["bearing"]
        else:
            idx = 0
            while idx < len(pks) - 1 and pks[idx + 1] < target_pk:
                idx += 1
                
            if idx < len(pks) - 1:
                p1 = dense_points[idx]
                p2 = dense_points[idx + 1]
                denom = (p2["pk"] - p1["pk"])
                frac = (target_pk - p1["pk"]) / denom if denom > 0 else 0
                t_lon = p1["lon"] + frac * (p2["lon"] - p1["lon"])
                t_lat = p1["lat"] + frac * (p2["lat"] - p1["lat"])
                bearing = p1["bearing"]
            else:
                p = dense_points[-1]
                t_lon, t_lat, bearing = p["lon"], p["lat"], p["bearing"]
            
        km_val = target_pk // 1000
        m_val = target_pk % 1000
        label_short = f"{km_val}+{m_val:03d}"
        label_full = f"PK {km_val}+{m_val:03d}"
        
        is_1km = (m_val == 0)
        
        tick_obj = {
            "pk": target_pk,
            "label": label_short,
            "full_label": label_full,
            "lon": round(t_lon, 7),
            "lat": round(t_lat, 7),
            "bearing": round(bearing, 2),
            "is_major": is_1km
        }
        
        ticks_100m.append(tick_obj)
        if is_1km:
            ticks_1km.append(tick_obj)
            
    return ticks_100m, ticks_1km

def main():
    os.makedirs('app/data', exist_ok=True)
    control_points, sorted_pks = extract_alignment_control_points()
    dense_points = interpolate_centripetal_catmull_rom(control_points, sorted_pks, step_m=25.0)
    ticks_100m, ticks_1km = build_station_ticks(dense_points, control_points)
    
    # Filter dense points to start from PK 82+800 to end
    coordinates = [[p["lon"], p["lat"]] for p in dense_points]
    
    output_data = {
        "metadata": {
            "section": "Section 03: Kazaure to Daura (KZDR)",
            "start_pk": sorted_pks[0],
            "end_pk": sorted_pks[-1],
            "total_points": len(dense_points),
            "step_meters": 25.0,
            "interpolation": "Official AutoCAD Civil 3D 100m Stations + Centripetal Catmull-Rom Spline",
            "source_model": "KMZs KAMA/01. KANO-MARADI LINE/SECTION 03.kmz",
            "calibration_shift": "Recalibrated to resolve ~128.8m backwards shift",
            "generated_at": "September 2026",
            "datum": "WGS84"
        },
        "dense_points": dense_points,
        "ticks_100m": ticks_100m,
        "ticks_1km": ticks_1km,
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "name": "Kano-Maradi Railway Centerline (Section 03 - Calibrated)",
                        "start_pk": sorted_pks[0],
                        "end_pk": sorted_pks[-1]
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates
                    }
                }
            ]
        }
    }
    
    out_file = "app/data/section03_centerline.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Saved {out_file} successfully ({len(dense_points)} polyline points, {len(ticks_100m)} 100m ticks)!")

if __name__ == '__main__':
    main()
