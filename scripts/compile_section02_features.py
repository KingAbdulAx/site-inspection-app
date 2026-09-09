import os
import sys
import re
import json
import fitz
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

print("=================================================================")
print("=== PHASE 3: COMPREHENSIVE SECTION 02 DRAINAGE INVENTORY EXTRACTION ===")
print("=================================================================")

# Load drawing register
with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
docs_by_num = {d.get("doc_number"): d for d in docs}

features = []
feature_idx = 1

# -------------------------------------------------------------
# 1. SECTION BOUNDARY MARKERS
# -------------------------------------------------------------
print("\n--- 1. Section Boundaries ---")
features.append({
    "temp_id": f"feat_{feature_idx:04d}",
    "category": "Section Boundary",
    "typology": "Section 02 Start Point (Open Line / Dawanau Interface)",
    "short_code": "Boundary",
    "start_pk": 19800.0,
    "end_pk": 19800.0,
    "length_m": 0.0,
    "is_point": True,
    "side": "Center",
    "position": "Section 02 Start Boundary",
    "specs": "Section 02 Open Line Start Chainage (DW-03002)",
    "source_drawing": "DW-03002-05",
    "derivation_method": "Contractual chainage from sheet title and station band",
    "confidence": "CONFIRMED",
    "effective_status": "ON-HOLD (Dawanau Yard Package)",
    "notes": "Transition from Dawanau Freight Yard to open line"
})
feature_idx += 1

features.append({
    "temp_id": f"feat_{feature_idx:04d}",
    "category": "Section Boundary",
    "typology": "Section 02 End Point (Connection with Section 03)",
    "short_code": "Boundary",
    "start_pk": 82902.439,
    "end_pk": 82902.439,
    "length_m": 0.0,
    "is_point": True,
    "side": "Center",
    "position": "Section 02 / Section 03 Boundary",
    "specs": "Contractual section interface at PK 82+902.439",
    "source_drawing": "DW-03047-05",
    "derivation_method": "Contractual chainage from sheet title and track geometry end vertex",
    "confidence": "CONFIRMED",
    "effective_status": "LEVEL A",
    "notes": "Matches Section 03 start point"
})
feature_idx += 1

# -------------------------------------------------------------
# 2. CULVERTS (119 Cross Drainage Structures)
# -------------------------------------------------------------
print("\n--- 2. Culverts (DW-04002 to DW-04123) ---")
with open(os.path.join(APP_DATA_DIR, "section02_parsed_culverts.json"), encoding='utf-8') as f:
    parsed_culverts = json.load(f)

parsed_culverts.sort(key=lambda c: c["pk"] if c["pk"] is not None else 0)

for c in parsed_culverts:
    pk = c["pk"]
    st_type = c["structure_type"]
    barrels = c.get("barrels", 1)
    dims = c.get("internal_dims", "")
    ch_title = c.get("chainage_title", f"{int(pk//1000)}+{int(pk%1000):03d}")
    
    if st_type == "Box Culvert":
        short_code = f"{barrels}x Box Culv" if barrels > 1 else "1x Box Culv"
        typology = f"Reinforced Concrete Box Culvert {barrels}x({dims}) (BC {ch_title})" if barrels > 1 else f"Reinforced Concrete Single Box Culvert 1x({dims}) (BC {ch_title})"
        specs = f"Reinforced concrete box culvert {barrels}x({dims})"
    else:
        short_code = "Pipe Culv"
        typology = f"Precast Concrete Pipe Culvert 1x{dims} (PC {ch_title})"
        specs = f"Precast concrete pipe culvert 1x{dims}"
        
    doc_entry = docs_by_num.get(c["doc_number"], {})
    rev = c["revision"]
    doc_ref = f"{c['doc_number'].split('-')[-1]}-{rev}"
    
    features.append({
        "temp_id": f"feat_{feature_idx:04d}",
        "category": "Cross Drainage",
        "typology": typology,
        "short_code": short_code,
        "start_pk": round(pk, 3),
        "end_pk": round(pk, 3),
        "length_m": 0.0,
        "is_point": True,
        "side": "Center",
        "position": "Cross Drainage",
        "specs": specs,
        "source_drawing": f"{c['doc_number']}-{rev}",
        "derivation_method": "Culvert detail sheet CAD station and title",
        "confidence": c["confidence"],
        "effective_status": c["effective_status"],
        "notes": f"Slope protection callouts: {c['slope_protection_callouts']}, Riprap D50: {c.get('riprap_d50_mm', 'Unstated')}mm"
    })
    feature_idx += 1

print(f"Added {len(parsed_culverts)} culverts.")

# -------------------------------------------------------------
# 3. TRAPEZOIDAL DIVERSION CHANNELS (Design Report Table 3.28)
# -------------------------------------------------------------
print("\n--- 3. Trapezoidal Diversion Channels (Table 3.28) ---")
table_328_channels = [
    {"start_pk": 19850.0, "end_pk": 21119.37, "type": "Type B", "B": 2.00, "H": 1.00, "slope": "0.30% / 2.72%", "length_m": 1269.37, "side": "Left", "q_m3s": 4.35, "status": "ON-HOLD (Relocation Directive)", "drawing": "DW-03001/DW-03002", "conf": "CONFIRMED"},
    {"start_pk": 21340.0, "end_pk": 21584.15, "type": "Type B", "B": 5.00, "H": 1.00, "slope": "1.28%", "length_m": 244.15, "side": "Left", "q_m3s": 11.60, "status": "LEVEL A", "drawing": "DW-03003", "conf": "CONFIRMED"},
    {"start_pk": 22325.0, "end_pk": 22539.77, "type": "Type B", "B": 4.00, "H": 1.00, "slope": "1.20%", "length_m": 214.77, "side": "Right", "q_m3s": 20.39, "status": "LEVEL A", "drawing": "DW-03003", "conf": "CONFIRMED"},
    {"start_pk": 22475.0, "end_pk": 22550.88, "type": "Type B", "B": 4.00, "H": 1.00, "slope": "1.10%", "length_m": 75.88, "side": "Left", "q_m3s": 21.16, "status": "LEVEL A", "drawing": "DW-03003", "conf": "CONFIRMED"},
    {"start_pk": 22544.0, "end_pk": 22755.20, "type": "Type C", "B": 5.00, "H": 1.50, "slope": "1.15%", "length_m": 211.20, "side": "Right", "q_m3s": 41.55, "status": "LEVEL A", "drawing": "DW-03004", "conf": "CONFIRMED"},
    {"start_pk": 31925.0, "end_pk": 32481.94, "type": "Type B", "B": 1.50, "H": 1.00, "slope": "0.87%", "length_m": 556.94, "side": "Right", "q_m3s": 3.84, "status": "LEVEL A", "drawing": "DW-03010", "conf": "CONFIRMED"},
    {"start_pk": 34000.0, "end_pk": 34746.35, "type": "Type B", "B": 2.00, "H": 0.80, "slope": "0.36%", "length_m": 746.35, "side": "Right", "q_m3s": 4.39, "status": "LEVEL A", "drawing": "DW-03012", "conf": "CONFIRMED"},
    {"start_pk": 37175.0, "end_pk": 37371.99, "type": "Type B", "B": 1.50, "H": 0.80, "slope": "0.45%", "length_m": 196.99, "side": "Right", "q_m3s": 2.82, "status": "LEVEL C", "drawing": "DW-03014", "conf": "NEEDS_VERIFICATION"},
    {"start_pk": 41800.0, "end_pk": 42608.76, "type": "Type B", "B": 1.50, "H": 1.00, "slope": "1.13%", "length_m": 808.76, "side": "Right", "q_m3s": 4.55, "status": "LEVEL A", "drawing": "DW-03017", "conf": "CONFIRMED"},
    {"start_pk": 56125.0, "end_pk": 56929.97, "type": "Type C", "B": 2.50, "H": 0.80, "slope": "0.38%", "length_m": 804.97, "side": "Left", "q_m3s": 5.30, "status": "LEVEL A", "drawing": "DW-03028", "conf": "CONFIRMED"},
]

for ch in table_328_channels:
    typology = f"Concrete Trapezoidal Channel ({ch['type']} B={ch['B']}m, H={ch['H']}m)"
    specs = f"Trapezoidal diversion channel (B={ch['B']}m, H={ch['H']}m, slope {ch['slope']}, Qaff={ch['q_m3s']} m³/s)"
    
    features.append({
        "temp_id": f"feat_{feature_idx:04d}",
        "category": "Diversion Channel",
        "typology": typology,
        "short_code": f"Chan {ch['type'][-1]}",
        "start_pk": round(ch["start_pk"], 1),
        "end_pk": round(ch["end_pk"], 1),
        "length_m": round(ch["length_m"], 1),
        "is_point": False,
        "side": ch["side"],
        "position": f"{ch['side']} Side (Diversion Channel)",
        "specs": specs,
        "source_drawing": f"RP-00001-06 (Table 3.28) / {ch['drawing']}",
        "derivation_method": "Design report Table 3.28 verification schedule cross-referenced with plan drawings",
        "confidence": ch["conf"],
        "effective_status": ch["status"],
        "notes": f"Affluent flow: {ch['q_m3s']} m3/s, slope: {ch['slope']}"
    })
    feature_idx += 1

print(f"Added {len(table_328_channels)} trapezoidal channels.")

# -------------------------------------------------------------
# 4. COLLECTOR DRAINAGE NETWORKS (DW-08001 to DW-08004 & Table 3.29)
# -------------------------------------------------------------
print("\n--- 4. Collector Drains & Station Track Drainage ---")
collector_items = [
    {"doc": "DW-08001-02", "title": "Collector Drain – Dawanau (Sheet 1/2)", "start_pk": 18400.0, "end_pk": 19800.0, "side": "Center", "specs": "Sub-ballast perforated pipe network Ø400-Ø1000 with inspection manholes", "status": "ON-HOLD (Relocation Directive)", "conf": "CONFIRMED"},
    {"doc": "DW-08004-01", "title": "Collector Drain – Dawanau (Sheet 2/2)", "start_pk": 19800.0, "end_pk": 21200.0, "side": "Center", "specs": "Dawanau freight yard track drainage collector lines and outfalls", "status": "ON-HOLD (Relocation Directive)", "conf": "CONFIRMED"},
    {"doc": "DW-08002-02", "title": "Collector Drain – Dambatta", "start_pk": 48100.0, "end_pk": 49600.0, "side": "Center", "specs": "Dambatta station track drainage collector lines (Discharge Pipes 1DB-4DB)", "status": "LEVEL A", "conf": "CONFIRMED"},
    {"doc": "DW-08003-01", "title": "Collector Drain – Yard-Kazaure", "start_pk": 79200.0, "end_pk": 80700.0, "side": "Center", "specs": "Kazaure yard collector lines and discharge pipes (1YKZ-3YKZ)", "status": "LEVEL A", "conf": "CONFIRMED"},
]

for col in collector_items:
    length = col["end_pk"] - col["start_pk"]
    features.append({
        "temp_id": f"feat_{feature_idx:04d}",
        "category": "Track Drainage",
        "typology": f"Sub-ballast Collector Network ({col['title'].split('–')[-1].strip()})",
        "short_code": "Collector",
        "start_pk": round(col["start_pk"], 1),
        "end_pk": round(col["end_pk"], 1),
        "length_m": round(length, 1),
        "is_point": False,
        "side": col["side"],
        "position": "Station / Yard Track Drainage",
        "specs": col["specs"],
        "source_drawing": col["doc"],
        "derivation_method": "Dedicated collector drain drawings DW-08001..08004 and Design Report Table 3.29",
        "confidence": col["conf"],
        "effective_status": col["status"],
        "notes": "Includes perforated pipes and modular concrete inspection manholes"
    })
    feature_idx += 1

print(f"Added {len(collector_items)} collector network packages.")

# -------------------------------------------------------------
# 5. SINGLE-PASS EXTRACTION OF 47 PLAN SHEETS (DW-03001 to DW-03047)
#    - Ditch Markers (Type 7, Type 4, Type 12)
#    - Half Round Callouts (Type 8 Bench vs Type 9 Platform Shoulder)
#    - Riprap Slope Protection Callouts
#    - Discrete Type 9 Water Descents (Chutes)
# -------------------------------------------------------------
print("\n--- 5. Plan Sheets Comprehensive Processing ---")

plan_sheets = [d for d in docs if "DW-03" in d.get("doc_number", "")]
plan_sheets.sort(key=lambda d: d["doc_number"])

raw_ditch_runs = []
callout_features = []
water_descent_raw = []

for d in plan_sheets:
    pdf_fn = d.get("pdf_filename")
    if not pdf_fn:
        continue
    pdf_path = os.path.join(DRAWINGS_DIR, pdf_fn)
    if not os.path.exists(pdf_path):
        continue
        
    doc = fitz.open(pdf_path)
    page = doc[0]
    words = page.get_text("words")
    blocks = page.get_text("blocks")
    drawings = page.get_drawings()
    
    # Fit station ticks
    s1_ticks, s2_ticks = [], []
    for w in words:
        m = re.match(r'^(\d{2})\+(\d{3})$', w[4])
        if m:
            pk = float(m.group(1))*1000.0 + float(m.group(2))
            if 700 <= w[1] <= 780: s1_ticks.append((w[0], pk))
            elif 1480 <= w[1] <= 1560: s2_ticks.append((w[0], pk))
    s1_ticks.sort(key=lambda t: t[0])
    s2_ticks.sort(key=lambda t: t[0])
    
    def fit_s(ticks):
        if len(ticks) < 2: return None, None
        xs = np.array([t[0] for t in ticks])
        pks = np.array([t[1] for t in ticks])
        return np.polyfit(pks, xs, 1)

    m1, c1 = fit_s(s1_ticks)
    m2, c2 = fit_s(s2_ticks)
    
    track_y1, track_y2 = 332.0, 1202.0
    for drw in drawings:
        c_col = drw.get('color')
        if c_col and len(c_col)==3 and c_col[0]>0.8 and c_col[1]<0.2 and c_col[2]<0.2:
            r = drw.get('rect')
            if r.width > 200:
                if r.y0 < 850: track_y1 = r.y0
                else: track_y2 = r.y0

    # A. Extract marker glyphs (Type 7, 4, 12) & Water Descent CAD blocks
    markers = []
    sheet_chutes = []
    for drw in drawings:
        color = drw.get('color')
        fill = drw.get('fill')
        rect = drw.get('rect')
        items = drw.get('items', [])
        
        # Small glyphs: width < 15 and height < 15
        if rect.width < 15 and rect.height < 15:
            if rect.y0 < 850 and m1 is not None:
                pk = (rect.x0 - c1) / m1
                side = "Left" if rect.y0 < track_y1 else "Right"
            elif rect.y0 >= 850 and m2 is not None:
                pk = (rect.x0 - c2) / m2
                side = "Left" if rect.y0 < track_y2 else "Right"
            else:
                pk = None
                
            if pk is not None:
                is_black = color and max(color) < 0.15
                is_blue = color and len(color)==3 and color[2] > 0.6 and color[0] < 0.3
                
                # Type 7: Black X
                if len(items) == 2 and items[0][0] == 'l' and items[1][0] == 'l' and is_black:
                    markers.append((pk, side, "Type 7", d["doc_number"], d["submitted_revision"], d["effective_status"]))
                # Type 4: Blue X
                elif len(items) == 2 and items[0][0] == 'l' and items[1][0] == 'l' and is_blue:
                    markers.append((pk, side, "Type 4", d["doc_number"], d["submitted_revision"], d["effective_status"]))
                # Type 12: Black slash
                elif len(items) == 1 and items[0][0] == 'l' and is_black:
                    p1, p2 = items[0][1], items[0][2]
                    if abs(p1.x - p2.x) > 1 and abs(p1.y - p2.y) > 1:
                        markers.append((pk, side, "Type 12", d["doc_number"], d["submitted_revision"], d["effective_status"]))
                        
        # Type 9 Water Descent CAD blocks: RGB (0.0, 0.647, 0.867)
        is_wd_blue = False
        for col in [fill, color]:
            if col and len(col) == 3:
                if abs(col[0] - 0.0) < 0.05 and abs(col[1] - 0.647) < 0.05 and abs(col[2] - 0.867) < 0.05:
                    is_wd_blue = True
                    break
        if is_wd_blue and (rect.height > 10 or rect.width > 10):
            mid_x = (rect.x0 + rect.x1) / 2.0
            mid_y = (rect.y0 + rect.y1) / 2.0
            if mid_y < 850 and m1 is not None:
                pk = (mid_x - c1) / m1
                side = "Left" if mid_y < track_y1 else "Right"
                sheet_chutes.append((pk, side, d["doc_number"], d["submitted_revision"], d["effective_status"]))
            elif mid_y >= 850 and m2 is not None:
                pk = (mid_x - c2) / m2
                side = "Left" if mid_y < track_y2 else "Right"
                sheet_chutes.append((pk, side, d["doc_number"], d["submitted_revision"], d["effective_status"]))

    # Cluster sheet chutes (within 12m)
    sheet_chutes.sort(key=lambda c: c[0])
    for sc in sheet_chutes:
        if not water_descent_raw:
            water_descent_raw.append(sc)
            continue
        last_sc = water_descent_raw[-1]
        if sc[1] == last_sc[1] and abs(sc[0] - last_sc[0]) <= 12.0:
            continue
        water_descent_raw.append(sc)

    # Cluster ditch markers
    markers.sort(key=lambda x: x[0])
    for (side_f, type_f) in [
        ("Left", "Type 7"), ("Right", "Type 7"),
        ("Left", "Type 4"), ("Right", "Type 4"),
        ("Left", "Type 12"), ("Right", "Type 12")
    ]:
        filtered = [m for m in markers if m[1] == side_f and m[2] == type_f]
        if not filtered: continue
        
        current_run = [filtered[0]]
        for pt in filtered[1:]:
            if pt[0] - current_run[-1][0] <= 20.0:
                current_run.append(pt)
            else:
                if len(current_run) >= 3:
                    raw_ditch_runs.append({
                        "type": type_f,
                        "side": side_f,
                        "start_pk": current_run[0][0],
                        "end_pk": current_run[-1][0],
                        "doc_number": current_run[0][3],
                        "revision": current_run[0][4],
                        "status": current_run[0][5],
                        "markers": len(current_run)
                    })
                current_run = [pt]
        if len(current_run) >= 3:
            raw_ditch_runs.append({
                "type": type_f,
                "side": side_f,
                "start_pk": current_run[0][0],
                "end_pk": current_run[-1][0],
                "doc_number": current_run[0][3],
                "revision": current_run[0][4],
                "status": current_run[0][5],
                "markers": len(current_run)
            })

    # B. Extract Text Callouts: Type 8 Bench Ditches, Type 9 Platform Shoulder Ditches, Riprap Protection
    for b in blocks:
        txt = b[4].strip()
        
        # Half Round Ditches (Type 8 vs Type 9)
        m_hr = re.search(r'HALF\s+ROUND\s+(?:LINED\s+)?(?:BENCH\s+)?DITCH[^\n]*(?:L:\s*(\d+)m?)?[^\n]*(?:i:\s*([0-9\.]+)%?)?', txt, re.IGNORECASE)
        if m_hr:
            if b[1] < 850 and m1 is not None:
                pk = (b[0] - c1) / m1
                side = "Left" if b[1] < track_y1 else "Right"
            elif b[1] >= 850 and m2 is not None:
                pk = (b[0] - c2) / m2
                side = "Left" if b[1] < track_y2 else "Right"
            else:
                continue
                
            len_m = float(m_hr.group(1)) if m_hr.group(1) else 50.0
            slope_s = f"{m_hr.group(2)}%" if m_hr.group(2) else "Unstated"
            is_bench = "BENCH" in txt.upper()
            
            if is_bench:
                callout_features.append({
                    "category": "Berm Ditch",
                    "typology": "Half-Round Lined Bench Ditch (Type 8)",
                    "short_code": "Type 8 Ditch",
                    "start_pk": round(pk - len_m/2.0, 1),
                    "end_pk": round(pk + len_m/2.0, 1),
                    "length_m": round(len_m, 1),
                    "is_point": False,
                    "side": side,
                    "position": f"{side} Bench (Cut Slope)",
                    "specs": f"Precast half-round lined bench ditch (MDDT DW-10020), L={len_m}m, slope={slope_s}",
                    "source_drawing": f"{d['doc_number']}-{d['submitted_revision']}",
                    "derivation_method": "Plan sheet text callout coordinates projected to alignment",
                    "confidence": "PROBABLE",
                    "effective_status": d["effective_status"],
                    "notes": txt.replace('\n', ' ')
                })
            else:
                callout_features.append({
                    "category": "Shoulder / Cascade",
                    "typology": "Half-Round Platform Shoulder Ditch (Type 9)",
                    "short_code": "Type 9 Ditch",
                    "start_pk": round(pk - len_m/2.0, 1),
                    "end_pk": round(pk + len_m/2.0, 1),
                    "length_m": round(len_m, 1),
                    "is_point": False,
                    "side": side,
                    "position": f"{side} Platform Shoulder",
                    "specs": f"Precast half-round lined platform shoulder ditch (MDDT DW-10020 / DW-10003), L={len_m}m, slope={slope_s}",
                    "source_drawing": f"{d['doc_number']}-{d['submitted_revision']}",
                    "derivation_method": "Plan sheet text callout coordinates projected to alignment",
                    "confidence": "PROBABLE",
                    "effective_status": d["effective_status"],
                    "notes": txt.replace('\n', ' ')
                })

        # Riprap Slope Protection
        m_sp = re.search(r'SLOPE\s+PROTECTION[^\n]*(?:L:\s*(\d+)m?|L=\s*(\d+)m?)?[^\n]*(?:D50\s*=\s*(\d+)mm)?', txt, re.IGNORECASE)
        if m_sp and "REV" not in txt and "CHECKED" not in txt and "MOTA" not in txt:
            if b[1] < 850 and m1 is not None:
                pk = (b[0] - c1) / m1
                side = "Left" if b[1] < track_y1 else "Right"
            elif b[1] >= 850 and m2 is not None:
                pk = (b[0] - c2) / m2
                side = "Left" if b[1] < track_y2 else "Right"
            else:
                continue
                
            len_val = m_sp.group(1) or m_sp.group(2)
            len_m = float(len_val) if len_val else 28.0
            d50_val = m_sp.group(3) or "200"
            
            callout_features.append({
                "category": "Riprap Protection",
                "typology": "Embankment Riprap Armor & Scour Protection",
                "short_code": "Riprap",
                "start_pk": round(pk - len_m/2.0, 1),
                "end_pk": round(pk + len_m/2.0, 1),
                "length_m": round(len_m, 1),
                "is_point": False,
                "side": side,
                "position": f"{side} Slope (Riprap Armor)",
                "specs": f"Embankment riprap armor protection (MDDT DW-10004), L={len_m}m, D50={d50_val}mm",
                "source_drawing": f"{d['doc_number']}-{d['submitted_revision']}",
                "derivation_method": "Plan sheet text callout coordinates projected to alignment",
                "confidence": "PROBABLE",
                "effective_status": d["effective_status"],
                "notes": txt.replace('\n', ' ')
            })

print(f"Extraction summary from 47 plan sheets:")
print(f"  Raw Ditch Runs: {len(raw_ditch_runs)}")
print(f"  Callout Features (Type 8, Type 9 Shoulder, Riprap): {len(callout_features)}")
print(f"  Discrete Type 9 Water Descents: {len(water_descent_raw)}")

# Stitch adjacent longitudinal ditch runs
raw_ditch_runs.sort(key=lambda r: (r["type"], r["side"], r["start_pk"]))

stitched_runs = []
for run in raw_ditch_runs:
    if not stitched_runs:
        stitched_runs.append(run)
        continue
    last = stitched_runs[-1]
    if last["type"] == run["type"] and last["side"] == run["side"] and (run["start_pk"] <= last["end_pk"] + 25.0):
        last["end_pk"] = max(last["end_pk"], run["end_pk"])
        last["markers"] += run["markers"]
        if run["doc_number"] not in last["doc_number"]:
            last["doc_number"] = f"{last['doc_number']} / {run['doc_number']}"
    else:
        stitched_runs.append(run)

stitched_runs.sort(key=lambda r: r["start_pk"])

for r in stitched_runs:
    spk = round(r["start_pk"], 1)
    epk = round(r["end_pk"], 1)
    length = round(epk - spk, 1)
    if length < 5.0:
        continue
        
    dtype = r["type"]
    side = r["side"]
    doc_ref = r["doc_number"]
    rev = r["revision"]
    status = r["status"]
    
    if dtype == "Type 7":
        cat = "Toe Ditch"
        typology = "Concrete Lined Triangular Toe Ditch (Type 7)"
        short_code = "Type 7 Ditch"
        specs = "Concrete lined triangular ditch at foot of slope (MDDT DW-10001)"
    elif dtype == "Type 4":
        cat = "Toe Ditch"
        typology = "Unlined Triangular Toe Ditch (Type 4)"
        short_code = "Type 4 Ditch"
        specs = "Unlined triangular ditch at foot of slope (MDDT DW-10001)"
    else: # Type 12
        cat = "Toe Ditch"
        typology = "Trapezoidal Lined Toe Ditch (Type 12)"
        short_code = "Type 12 Ditch"
        specs = "Trapezoidal concrete lined ditch at foot of slope (MDDT DW-10001 / DW-10006)"
        
    features.append({
        "temp_id": f"feat_{feature_idx:04d}",
        "category": cat,
        "typology": typology,
        "short_code": short_code,
        "start_pk": spk,
        "end_pk": epk,
        "length_m": length,
        "is_point": False,
        "side": side,
        "position": f"{side} Side (Foot of Slope)",
        "specs": specs,
        "source_drawing": doc_ref,
        "derivation_method": f"Plan sheet vector marker glyph clustering ({r['markers']} markers, affine station band scale 2.835 pt/m)",
        "confidence": "PROBABLE",
        "effective_status": status,
        "notes": f"Stitched across {doc_ref}"
    })
    feature_idx += 1

# Add callout features (Type 8, Type 9 Shoulder, Riprap)
for cf in callout_features:
    cf["temp_id"] = f"feat_{feature_idx:04d}"
    features.append(cf)
    feature_idx += 1

# Add Discrete Type 9 Water Descents
for wd in water_descent_raw:
    pk = round(wd[0], 1)
    side = wd[1]
    doc_num = wd[2]
    rev = wd[3]
    status = wd[4]
    
    features.append({
        "temp_id": f"feat_{feature_idx:04d}",
        "category": "Water Descent",
        "typology": "Precast Water Descent (Type 9 Chute)",
        "short_code": "Desc",
        "start_pk": pk,
        "end_pk": pk,
        "length_m": 0.0,
        "is_point": True,
        "side": side,
        "position": f"{side} Embankment Slope Face (Shoulder Chute)",
        "specs": "Precast half-round chute D=0.30m down embankment slope discharging shoulder ditch into toe dissipator per DW-10003-04-A.",
        "source_drawing": f"{doc_num}-{rev}",
        "derivation_method": "CAD vector stepped cascade block (RGB 0.0, 0.647, 0.867) matching DW-10003-04-A",
        "confidence": "PROBABLE",
        "effective_status": status,
        "notes": "Connects Type 9 platform shoulder ditch to toe energy dissipator"
    })
    feature_idx += 1

# Sort all features by start_pk
features.sort(key=lambda f: (f["start_pk"], f["category"]))

# Re-index feature IDs sequentially
for i, f in enumerate(features, 1):
    f["feature_id"] = f"s02_feat_{i:04d}"
    del f["temp_id"]

print(f"\n=================================================================")
print(f"=== TOTAL SECTION 02 DRAINAGE FEATURES COMPILED: {len(features)} ===")
print(f"=================================================================")

cat_counts = {}
cat_lengths = {}
for f in features:
    c = f["category"]
    cat_counts[c] = cat_counts.get(c, 0) + 1
    cat_lengths[c] = cat_lengths.get(c, 0.0) + f["length_m"]

print("\nFeature breakdown by Category:")
for c, cnt in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {c:25s}: {cnt:4d} ({cat_lengths[c]:10.1f} m)")

conf_counts = {}
for f in features:
    cf = f["confidence"]
    conf_counts[cf] = conf_counts.get(cf, 0) + 1

print("\nFeature breakdown by Confidence Grade:")
for cf, cnt in conf_counts.items():
    print(f"  {cf:20s}: {cnt:4d}")

stat_counts = {}
for f in features:
    st = f["effective_status"]
    stat_counts[st] = stat_counts.get(st, 0) + 1

print("\nFeature breakdown by Consultant Vetting Status:")
for st, cnt in sorted(stat_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {st:35s}: {cnt:4d}")

# Save to intermediate section02_features.json
out_file = os.path.join(APP_DATA_DIR, "section02_features.json")
with open(out_file, "w", encoding="utf-8") as f:
    json.dump({
        "section": "Section 02 (DWKZ: Dawanau to Kazaure)",
        "nominal_extent": {"start_pk": 19800.0, "end_pk": 82902.439, "span_m": 63102.439},
        "total_features": len(features),
        "generated_at": "2026-09-09",
        "category_counts": cat_counts,
        "confidence_counts": conf_counts,
        "features": features
    }, f, indent=2)

print(f"\nSuccessfully written to {out_file} ({os.path.getsize(out_file):,} bytes)")
