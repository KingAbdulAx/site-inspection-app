import os
import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

app_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"
team_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM"

def get_s03_sheet(pk):
    if pk < 84100:
        return "DW-03001"
    sheet_num = int((pk - 84100) // 1400) + 2
    sheet_num = min(30, max(2, sheet_num))
    return f"DW-03{sheet_num:03d}"

def get_s02_sheet(pk):
    sheet_num = int((pk - 19800) // 1400) + 1
    sheet_num = min(47, max(1, sheet_num))
    return f"DWKZ-03{sheet_num:03d}"

def get_transverse_position(p):
    typ = (p.get("typology") or "").lower()
    cat = (p.get("category") or "").lower()
    code = (p.get("typology_code") or p.get("short_code") or "").lower()

    if cat == "cross drainage" or "culvert" in typ or "box" in typ or "pipe culv" in code:
        return "Track Centerline Crossing"
    if cat == "water descent" or "descent" in typ or "chute" in typ:
        return "Slope Face (Water Descent)"
    if "channel" in typ or "chan" in code or cat == "diversion channel" or "zone iii" in typ or "zone i" in typ:
        return "Outer Extent (Channel)"
    if "crest" in typ or "type 11" in code or "type 5" in code or cat == "crest ditch":
        return "Cutting Crest"
    if "bench" in typ or "berm" in typ or "type 8" in code or cat == "berm ditch":
        return "Intermediate Bench (Berm)"
    if "toe" in typ or "type 7" in code or "type 4" in code or "type 12" in code or cat == "toe ditch" or "riprap" in code or cat == "riprap protection":
        return "Embankment Toe"
    return "Shoulder (Platform Edge)"

def main():
    print("Loading datasets...", flush=True)
    with open(os.path.join(app_dir, "data/section03_assets.json"), "r", encoding="utf-8") as f:
        s03_data = json.load(f)
    with open(os.path.join(app_dir, "data/section02_assets.json"), "r", encoding="utf-8") as f:
        s02_data = json.load(f)

    # Pre-calculate Type 9 / Type 8 spans for S03
    s03_t9_t8 = []
    for f in s03_data["features"]:
        p = f["properties"]
        code = (p.get("typology_code") or p.get("short_code") or "").upper()
        typ = (p.get("typology") or "").upper()
        cat = (p.get("category") or "").upper()
        if ("TYPE 9" in code or "TYPE 9" in typ or "TYPE 8" in code or "TYPE 8" in typ or "SHOULDER" in cat) and "DESCENT" not in typ and "CHUTE" not in typ:
            s03_t9_t8.append((p.get("start_pk", 0), p.get("end_pk", 0), p.get("side", ""), code or typ))

    # Pre-calculate Type 9 / Type 8 spans for S02
    s02_t9_t8 = []
    for f in s02_data["features"]:
        p = f["properties"]
        code = (p.get("typology_code") or p.get("short_code") or "").upper()
        typ = (p.get("typology") or "").upper()
        cat = (p.get("category") or "").upper()
        if ("TYPE 9" in code or "TYPE 9" in typ or "TYPE 8" in code or "TYPE 8" in typ or "SHOULDER" in cat) and "DESCENT" not in typ and "CHUTE" not in typ:
            s02_t9_t8.append((p.get("start_pk", 0), p.get("end_pk", 0), p.get("side", ""), code or typ))

    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default sheet

    # Color tokens
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    section_hdr_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    section_hdr_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    subhead_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    alert_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid") # Amber warning
    danger_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid") # Red warning
    confirm_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid") # Green
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    # -------------------------------------------------------------
    # 1. BATCH REVIEW DASHBOARD
    # -------------------------------------------------------------
    print("Building Batch Dashboard...", flush=True)
    ws_dash = wb.create_sheet(title="Batch Review Dashboard")
    ws_dash.views.sheetView[0].showGridLines = True

    # Title Block
    ws_dash["A1"] = "KANO–MARADI–DUTSE RAILWAY PROJECT"
    ws_dash["A1"].font = Font(name="Segoe UI", size=14, bold=True, color="1E293B")
    ws_dash["A2"] = "DRAINAGE FEATURE EXTRACTION — BATCH VERIFICATION & AUDIT WORKBOOK"
    ws_dash["A2"].font = Font(name="Segoe UI", size=12, bold=True, color="0284C7")
    ws_dash["A3"] = "Supervision: T.E.A.M. Nig. Ltd. | Contractor: MOTA-ENGIL Africa | Author: Engr. Abdulaziz A. A. (Drainage Execution)"
    ws_dash["A3"].font = Font(name="Segoe UI", size=9, italic=True, color="64748B")
    ws_dash["A4"] = "Instructions: Audit features against official CAD alignment sheets in sequential batches. Verify connections (DW-10003), channels, riprap stretches, and dissipators. Log discrepancies in columns N-R."
    ws_dash["A4"].font = Font(name="Segoe UI", size=9, bold=True, color="0F172A")

    dash_headers = [
        "Batch ID", "Section", "Drawing Sheet", "Chainage Extents", "Total Features",
        "Culverts", "Side Ditches (T1)", "Shoulder (T9)", "Bench (T8)", "Toe Ditches",
        "Channels (A-C)", "Water Descents", "Riprap Stretches", "Dissipators",
        "Unconnected Descents (Anomaly)", "Zero-Len Riprap (Anomaly)", "Batch Verification Status"
    ]
    for col_idx, h in enumerate(dash_headers, 1):
        cell = ws_dash.cell(row=6, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws_dash.row_dimensions[6].height = 28

    # Populate Batch Statistics for S03
    s03_batches = {}
    for f in s03_data["features"]:
        p = f["properties"]
        pk = p.get("start_pk", 82902)
        sheet = get_s03_sheet(pk)
        if sheet not in s03_batches:
            s03_batches[sheet] = {
                "section": "Section 03 (KZDR)",
                "sheet": sheet,
                "min_pk": pk,
                "max_pk": pk,
                "total": 0, "culverts": 0, "t1": 0, "t9": 0, "t8": 0, "toe": 0,
                "channels": 0, "descents": 0, "ripraps": 0, "dissipators": 0,
                "unconnected_desc": 0, "zero_len_rip": 0
            }
        b = s03_batches[sheet]
        b["min_pk"] = min(b["min_pk"], pk)
        b["max_pk"] = max(b["max_pk"], p.get("end_pk", pk))
        b["total"] += 1
        
        cat = p.get("category", "")
        typ = p.get("typology", "")
        code = p.get("short_code", "")
        
        if cat == "Cross Drainage" or "Culv" in code or "Box" in typ:
            b["culverts"] += 1
        elif "Type 1" in code or "Type 1" in typ:
            b["t1"] += 1
        elif ("Type 9" in code or "Type 9" in typ or "Shoulder" in cat) and "Descent" not in typ and "Chute" not in typ:
            b["t9"] += 1
        elif "Type 8" in code or "Berm" in cat:
            b["t8"] += 1
        elif "Toe" in cat or "Type 7" in code or "Type 4" in code or "Type 12" in code:
            b["toe"] += 1
        elif "Channel" in cat or "Chan" in code or "Channel" in typ or "Zone" in typ:
            b["channels"] += 1
        elif cat == "Water Descent" or "Descent" in typ or "Chute" in typ:
            b["descents"] += 1
            side = p.get("side", "")
            has_conn = any((r[2] == side or r[2] == "Center" or side == "Center") and (r[0] - 15 <= pk <= r[1] + 15) for r in s03_t9_t8)
            if not has_conn:
                b["unconnected_desc"] += 1
        elif "Riprap" in cat or "Riprap" in code or "Riprap" in typ:
            b["ripraps"] += 1
            if p.get("length_m", 0) == 0:
                b["zero_len_rip"] += 1
        elif cat == "Energy Dissipator" or "Dissipator" in typ:
            b["dissipators"] += 1

    # Populate Batch Statistics for S02
    s02_batches = {}
    for f in s02_data["features"]:
        p = f["properties"]
        pk = p.get("start_pk", 19800)
        sheet = get_s02_sheet(pk)
        if sheet not in s02_batches:
            s02_batches[sheet] = {
                "section": "Section 02 (DWKZ)",
                "sheet": sheet,
                "min_pk": pk,
                "max_pk": pk,
                "total": 0, "culverts": 0, "t1": 0, "t9": 0, "t8": 0, "toe": 0,
                "channels": 0, "descents": 0, "ripraps": 0, "dissipators": 0,
                "unconnected_desc": 0, "zero_len_rip": 0
            }
        b = s02_batches[sheet]
        b["min_pk"] = min(b["min_pk"], pk)
        b["max_pk"] = max(b["max_pk"], p.get("end_pk", pk))
        b["total"] += 1

        cat = p.get("category", "")
        typ = p.get("typology", "")
        code = p.get("short_code", "")

        if cat == "Cross Drainage" or "Culv" in code or "Box" in typ:
            b["culverts"] += 1
        elif "Type 1" in code or "Type 1" in typ:
            b["t1"] += 1
        elif ("Type 9" in code or "Type 9" in typ or "Shoulder" in cat) and "Descent" not in typ and "Chute" not in typ:
            b["t9"] += 1
        elif "Type 8" in code or "Berm" in cat:
            b["t8"] += 1
        elif "Toe" in cat or "Type 7" in code or "Type 4" in code or "Type 12" in code:
            b["toe"] += 1
        elif "Channel" in cat or "Chan" in code or "Channel" in typ or "Zone" in typ:
            b["channels"] += 1
        elif cat == "Water Descent" or "Descent" in typ or "Chute" in typ:
            b["descents"] += 1
            side = p.get("side", "")
            has_conn = any((r[2] == side or r[2] == "Center" or side == "Center") and (r[0] - 15 <= pk <= r[1] + 15) for r in s02_t9_t8)
            if not has_conn:
                b["unconnected_desc"] += 1
        elif "Riprap" in cat or "Riprap" in code or "Riprap" in typ:
            b["ripraps"] += 1
            if p.get("length_m", 0) == 0:
                b["zero_len_rip"] += 1
        elif cat == "Energy Dissipator" or "Dissipator" in typ:
            b["dissipators"] += 1

    dash_row = 7

    # 1. Section 03 Batches header
    c_s03_hdr = ws_dash.cell(row=dash_row, column=1, value="── SECTION 03: KAZAURE TO DAURA (KZDR) · PK 82+902 TO PK 124+521 (30 BATCHES) ──")
    c_s03_hdr.fill = section_hdr_fill
    c_s03_hdr.font = section_hdr_font
    ws_dash.merge_cells(start_row=dash_row, start_column=1, end_row=dash_row, end_column=17)
    dash_row += 1

    for sheet, b in sorted(s03_batches.items()):
        b_id = f"S03-BATCH-{sheet[-3:]}"
        pk_range = f"PK {b['min_pk']/1000:.3f} — {b['max_pk']/1000:.3f}"
        vals = [
            b_id, b["section"], b["sheet"], pk_range, b["total"],
            b["culverts"], b["t1"], b["t9"], b["t8"], b["toe"],
            b["channels"], b["descents"], b["ripraps"], b["dissipators"],
            b["unconnected_desc"], b["zero_len_rip"], "Pending Review"
        ]
        fill = zebra_fill if dash_row % 2 == 0 else white_fill
        for col_idx, val in enumerate(vals, 1):
            c = ws_dash.cell(row=dash_row, column=col_idx, value=val)
            c.fill = fill
            c.font = Font(name="Segoe UI", size=9)
            c.border = thin_border
            if col_idx in [1, 2, 3, 4]:
                c.alignment = Alignment(horizontal="center" if col_idx != 4 else "left", vertical="center")
            elif col_idx == 17:
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.font = Font(name="Segoe UI", size=9, bold=True, color="D97706")
            else:
                c.alignment = Alignment(horizontal="right", vertical="center")
            if col_idx in [15, 16] and val > 0:
                c.fill = alert_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B45309")
        ws_dash.row_dimensions[dash_row].height = 20
        dash_row += 1

    # 2. Section 02 Batches header
    c_s02_hdr = ws_dash.cell(row=dash_row, column=1, value="── SECTION 02: DAWANAU TO KAZAURE (DWKZ) · PK 19+800 TO PK 82+902 (47 BATCHES) ──")
    c_s02_hdr.fill = section_hdr_fill
    c_s02_hdr.font = section_hdr_font
    ws_dash.merge_cells(start_row=dash_row, start_column=1, end_row=dash_row, end_column=17)
    dash_row += 1

    for sheet, b in sorted(s02_batches.items()):
        b_id = f"S02-BATCH-{sheet[-3:]}"
        pk_range = f"PK {b['min_pk']/1000:.3f} — {b['max_pk']/1000:.3f}"
        vals = [
            b_id, b["section"], b["sheet"], pk_range, b["total"],
            b["culverts"], b["t1"], b["t9"], b["t8"], b["toe"],
            b["channels"], b["descents"], b["ripraps"], b["dissipators"],
            b["unconnected_desc"], b["zero_len_rip"], "Pending Review"
        ]
        fill = zebra_fill if dash_row % 2 == 0 else white_fill
        for col_idx, val in enumerate(vals, 1):
            c = ws_dash.cell(row=dash_row, column=col_idx, value=val)
            c.fill = fill
            c.font = Font(name="Segoe UI", size=9)
            c.border = thin_border
            if col_idx in [1, 2, 3, 4]:
                c.alignment = Alignment(horizontal="center" if col_idx != 4 else "left", vertical="center")
            elif col_idx == 17:
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.font = Font(name="Segoe UI", size=9, bold=True, color="D97706")
            else:
                c.alignment = Alignment(horizontal="right", vertical="center")
            if col_idx in [15, 16] and val > 0:
                c.fill = alert_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B45309")
        ws_dash.row_dimensions[dash_row].height = 20
        dash_row += 1

    # -------------------------------------------------------------
    # 2. SECTION 03 DETAILED FEATURES SHEET
    # -------------------------------------------------------------
    print("Writing Section 03 features...", flush=True)
    ws_s03 = wb.create_sheet(title="Section 03 Features (KZDR)")
    ws_s03.views.sheetView[0].showGridLines = True

    feat_headers = [
        "Batch ID", "Drawing Sheet", "Feature ID", "Chainage Station", "Start PK", "End PK",
        "Length (m)", "Side", "Transverse Position", "Current Typology", "Category",
        "Extraction Confidence", "Extraction Anomaly / Flag", "Drawing Callout & Specs",
        "Engineer Status [AUDIT]", "Corrected Typology", "Corrected Station & Side",
        "Missing Feature / Missed Scope", "Engineer Verification Remarks"
    ]
    for col_idx, h in enumerate(feat_headers, 1):
        cell = ws_s03.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill if col_idx <= 14 else subhead_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws_s03.row_dimensions[1].height = 28

    s03_row = 2
    for f in s03_data["features"]:
        p = f["properties"]
        pk = p.get("start_pk", 82902)
        end_pk = p.get("end_pk", pk)
        sheet = get_s03_sheet(pk)
        b_id = f"S03-BATCH-{sheet[-3:]}"
        pos = get_transverse_position(p)
        cat = p.get("category", "")
        typ = p.get("typology", "")
        code = p.get("short_code", "")
        side = p.get("side", "")
        length = p.get("length_m", 0)

        anomaly = "Normal"
        conf = p.get("confidence") or "HIGH"
        if cat == "Water Descent" or "Descent" in typ or "Chute" in typ:
            has_conn = any((r[2] == side or r[2] == "Center" or side == "Center") and (r[0] - 15 <= pk <= r[1] + 15) for r in s03_t9_t8)
            if not has_conn:
                anomaly = "UNCONNECTED: No Type 9/8 half-round ditch extracted on this side at PK"
                conf = "FLAG FOR REVIEW"
            else:
                anomaly = "Connected to Type 9/8 run"
        elif "Riprap" in cat or "Riprap" in typ or code == "Riprap":
            if length == 0:
                anomaly = "POINT ANCHOR: Point extraction; requires physical stretch extents in sheet"
                conf = "FLAG FOR REVIEW"
            else:
                anomaly = f"Longitudinal toe armor stretch (L={length}m)"
        elif "Channel" in typ or "Chan" in code or cat == "Diversion Channel":
            anomaly = "Outer channel corridor (Separated on Channel layer; verify distance from track)"

        vals = [
            b_id, sheet, p.get("id"), p.get("chainage_str"), pk, end_pk,
            length, side, pos, typ, cat,
            conf, anomaly, p.get("specs") or p.get("notes") or "",
            "", "", "", "", ""
        ]

        fill = zebra_fill if s03_row % 2 == 0 else white_fill
        for col_idx, val in enumerate(vals, 1):
            c = ws_s03.cell(row=s03_row, column=col_idx, value=val)
            c.fill = fill
            c.font = Font(name="Segoe UI", size=9)
            c.border = thin_border
            if col_idx in [1, 2, 3, 8, 12]:
                c.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in [5, 6, 7]:
                c.alignment = Alignment(horizontal="right", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")
            
            if col_idx == 12 and conf == "FLAG FOR REVIEW":
                c.fill = alert_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B45309")
            if col_idx == 13 and "UNCONNECTED" in str(val):
                c.fill = danger_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B91C1C")
            if col_idx >= 15:
                c.fill = confirm_fill if s03_row % 2 == 0 else white_fill

        ws_s03.row_dimensions[s03_row].height = 18
        s03_row += 1

    # -------------------------------------------------------------
    # 3. SECTION 02 DETAILED FEATURES SHEET
    # -------------------------------------------------------------
    print("Writing Section 02 features...", flush=True)
    ws_s02 = wb.create_sheet(title="Section 02 Features (DWKZ)")
    ws_s02.views.sheetView[0].showGridLines = True

    for col_idx, h in enumerate(feat_headers, 1):
        cell = ws_s02.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill if col_idx <= 14 else subhead_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws_s02.row_dimensions[1].height = 28

    s02_row = 2
    for f in s02_data["features"]:
        p = f["properties"]
        pk = p.get("start_pk", 19800)
        end_pk = p.get("end_pk", pk)
        sheet = get_s02_sheet(pk)
        b_id = f"S02-BATCH-{sheet[-3:]}"
        pos = get_transverse_position(p)
        cat = p.get("category", "")
        typ = p.get("typology", "")
        code = p.get("short_code", "")
        side = p.get("side", "")
        length = p.get("length_m", 0)

        anomaly = "Normal"
        conf = p.get("confidence") or "HIGH"
        if cat == "Water Descent" or "Descent" in typ or "Chute" in typ:
            has_conn = any((r[2] == side or r[2] == "Center" or side == "Center") and (r[0] - 15 <= pk <= r[1] + 15) for r in s02_t9_t8)
            if not has_conn:
                anomaly = "UNCONNECTED: No Type 9/8 half-round ditch extracted on this side at PK"
                conf = "FLAG FOR REVIEW"
            else:
                anomaly = "Connected to Type 9/8 run"
        elif "Riprap" in cat or "Riprap" in typ or code == "Riprap":
            if length == 0:
                anomaly = "POINT ANCHOR: Point extraction; requires physical stretch extents in sheet"
                conf = "FLAG FOR REVIEW"
            else:
                anomaly = f"Longitudinal toe armor stretch (L={length}m)"
        elif "Channel" in typ or "Chan" in code or cat == "Diversion Channel":
            anomaly = "Outer channel corridor (Separated on Channel layer; verify distance from track)"

        vals = [
            b_id, sheet, p.get("id"), p.get("chainage_str"), pk, end_pk,
            length, side, pos, typ, cat,
            conf, anomaly, p.get("specs") or p.get("notes") or "",
            "", "", "", "", ""
        ]

        fill = zebra_fill if s02_row % 2 == 0 else white_fill
        for col_idx, val in enumerate(vals, 1):
            c = ws_s02.cell(row=s02_row, column=col_idx, value=val)
            c.fill = fill
            c.font = Font(name="Segoe UI", size=9)
            c.border = thin_border
            if col_idx in [1, 2, 3, 8, 12]:
                c.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in [5, 6, 7]:
                c.alignment = Alignment(horizontal="right", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")
            
            if col_idx == 12 and conf == "FLAG FOR REVIEW":
                c.fill = alert_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B45309")
            if col_idx == 13 and "UNCONNECTED" in str(val):
                c.fill = danger_fill
                c.font = Font(name="Segoe UI", size=9, bold=True, color="B91C1C")
            if col_idx >= 15:
                c.fill = confirm_fill if s02_row % 2 == 0 else white_fill

        ws_s02.row_dimensions[s02_row].height = 18
        s02_row += 1

    # -------------------------------------------------------------
    # 4. MISSING FEATURES LOG (AUDIT TEMPLATE)
    # -------------------------------------------------------------
    print("Writing Missing Features Log...", flush=True)
    ws_miss = wb.create_sheet(title="Missing Features Log")
    ws_miss.views.sheetView[0].showGridLines = True
    miss_headers = [
        "Item #", "Batch ID", "Drawing Sheet", "Chainage Station", "Start PK", "End PK",
        "Side (L/R)", "Transverse Position", "Feature Typology", "Drawing Callout Text",
        "Dimensions / Length", "Material / Details", "Action Required (Add / Correct)", "Engineer Notes"
    ]
    for col_idx, h in enumerate(miss_headers, 1):
        cell = ws_miss.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws_miss.row_dimensions[1].height = 28

    for r in range(2, 52):
        fill = zebra_fill if r % 2 == 0 else white_fill
        for c in range(1, len(miss_headers) + 1):
            cell = ws_miss.cell(row=r, column=c, value="")
            cell.fill = fill
            cell.border = thin_border
            if c == 1:
                cell.value = r - 1
                cell.alignment = Alignment(horizontal="center")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color="64748B")

    # -------------------------------------------------------------
    # 5. DW-10003 & TYPOLOGY REFERENCE GUIDE
    # -------------------------------------------------------------
    print("Writing Reference Guide...", flush=True)
    ws_ref = wb.create_sheet(title="DW-10003 & Typologies Guide")
    ws_ref.views.sheetView[0].showGridLines = True

    ws_ref["A1"] = "STANDARD DRAINAGE TYPOLOGY & CONNECTION RULES (DW-10001 TO DW-10006)"
    ws_ref["A1"].font = Font(name="Segoe UI", size=13, bold=True, color="1E293B")
    ws_ref["A2"] = "Reference: Master Standard Detail Drawings in TEAM/Draiange details folder/"
    ws_ref["A2"].font = Font(name="Segoe UI", size=9, italic=True, color="64748B")

    ref_headers = ["Typology / Code", "Description", "Cross-Sectional Position", "Drawing Reference", "Hydraulic Connection Rules (DW-10003)"]
    for col_idx, h in enumerate(ref_headers, 1):
        cell = ws_ref.cell(row=4, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws_ref.row_dimensions[4].height = 26

    typology_guide = [
        ("Type 1", "Unlined Side Ditch (Main Solution)", "Shoulder / Platform edge in cutting", "MDDT-DW-10001", "Receives track runoff in earth cuts. Discharges to culvert inlet or outfall channel."),
        ("Type 1 Larger", "Concrete Lined Side Ditch (B=0.75m/4.0-4.5m)", "Shoulder / Platform edge in deep cutting", "DWKZ / KZDR plans", "High-capacity deep cutting ditch (e.g. Kazaure deep cut PK 83+725 to 84+800)."),
        ("Type 4", "Unlined Toe Ditch", "Embankment foot of slope", "MDDT-DW-10001 / DW-10003", "Foot of embankment in low scour soils. Receives water descents via energy sink basin."),
        ("Type 7", "Concrete Lined Triangular Toe Ditch", "Embankment foot of slope", "MDDT-DW-10001 / DW-10003", "Heavy runoff toe ditch. Receives water descents via energy dissipator basin."),
        ("Type 8", "Precast Half-Round Bench Ditch (D=0.30m)", "Intermediate slope bench (Berm)", "MDDT-DW-10001 / DW-10003", "Collects runoff on intermediate 3m/6m benches of high embankments. Discharges into water descents."),
        ("Type 9", "Precast Half-Round Shoulder Ditch (D=0.30m)", "Platform edge / Shoulder (fill > 4m)", "MDDT-DW-10001 / DW-10003", "Platform shoulder drain. Must connect directly to water descents to drop runoff safely down slope."),
        ("Water Descent", "Precast Stepped Cascade / Slope Chute", "Embankment slope face", "MDDT-DW-10003", "Transverse slope cascade. ONLY connected to half-round ditches (Type 9 shoulder, Type 8 bench); steps down to toe dissipator."),
        ("Energy Dissipator", "Stepped Stilling Basin (1.2m x 1.8m)", "Foot of slope / Outfall terminus", "MDDT-DW-10002 / DW-10003", "Point stilling basin at ditch or channel outfall or foot of water descent entering Type 7/4 ditch."),
        ("Channel Type A", "Trapezoidal Earth Channel", "Outermost corridor extent", "MDDT-DW-10002", "Natural watercourse diversion / culvert approach and tail channel."),
        ("Channel Type B", "Concrete Trapezoidal Channel (C25/30)", "Outermost corridor extent", "MDDT-DW-10002", "High-velocity stream diversion (e.g. PK 86+200, PK 84+682). Physically on outer lane, separated from trackside ditch."),
        ("Channel Type C", "Concrete Trapezoidal Channel with Embankment", "Outermost corridor extent", "MDDT-DW-10002", "Flat terrain channel where cutting depth cannot provide adequate slope; constructed on built embankment."),
        ("Type 11", "Concrete Lined Crest Ditch", "Cutting crest (top of slope)", "MDDT-DW-10001 / DW-10003", "Prevents overland runoff from washing down cutting slope. Discharges via crest water descent."),
        ("Riprap Armor", "Loose stone riprap armor (D50=100-200mm)", "Embankment toe / slope stretch", "MDDT-DW-10004", "Continuous longitudinal stretch of scour protection. Placed over span; NOT a cross-drainage structure.")
    ]

    for idx, (t, d, p, dw, rules) in enumerate(typology_guide, 5):
        fill = zebra_fill if idx % 2 == 0 else white_fill
        for c_idx, val in enumerate([t, d, p, dw, rules], 1):
            cell = ws_ref.cell(row=idx, column=c_idx, value=val)
            cell.fill = fill
            cell.font = Font(name="Segoe UI", size=9)
            cell.border = thin_border
            if c_idx in [1, 4]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if c_idx == 1:
                    cell.font = Font(name="Segoe UI", size=9, bold=True, color="0284C7")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        ws_ref.row_dimensions[idx].height = 24

    # Explicit column widths (fast and clean!)
    col_widths_dash = {1: 15, 2: 20, 3: 15, 4: 25, 5: 14, 6: 10, 7: 15, 8: 14, 9: 12, 10: 12, 11: 15, 12: 15, 13: 16, 14: 12, 15: 25, 16: 25, 17: 22}
    for c, w in col_widths_dash.items():
        from openpyxl.utils import get_column_letter
        ws_dash.column_dimensions[get_column_letter(c)].width = w

    col_widths_feat = {1: 15, 2: 15, 3: 16, 4: 20, 5: 12, 6: 12, 7: 12, 8: 10, 9: 22, 10: 35, 11: 18, 12: 18, 13: 35, 14: 40, 15: 22, 16: 25, 17: 25, 18: 30, 19: 30}
    for ws in [ws_s03, ws_s02]:
        for c, w in col_widths_feat.items():
            from openpyxl.utils import get_column_letter
            ws.column_dimensions[get_column_letter(c)].width = w

    for c, w in {1: 8, 2: 15, 3: 15, 4: 18, 5: 12, 6: 12, 7: 10, 8: 22, 9: 25, 10: 30, 11: 20, 12: 25, 13: 25, 14: 30}.items():
        from openpyxl.utils import get_column_letter
        ws_miss.column_dimensions[get_column_letter(c)].width = w

    for c, w in {1: 18, 2: 35, 3: 28, 4: 22, 5: 45}.items():
        from openpyxl.utils import get_column_letter
        ws_ref.column_dimensions[get_column_letter(c)].width = w

    out_fp = os.path.join(team_dir, "KMD_Drainage_Extraction_Batch_Verification_Workbook.xlsx")
    app_out_fp = os.path.join(app_dir, "data", "KMD_Drainage_Extraction_Batch_Verification_Workbook.xlsx")
    print(f"Saving workbook to {out_fp}...", flush=True)
    wb.save(out_fp)
    wb.save(app_out_fp)
    print(f"SUCCESS: Generated verification workbook:\n  {out_fp}\n  {app_out_fp}", flush=True)

if __name__ == "__main__":
    main()
