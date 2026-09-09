import os
import sys
import re
import json
import fitz

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

# Load register
with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
dw04_list = [d for d in docs if "DW-04" in d.get("doc_number", "")]

print(f"Total DW-04 drawings to parse: {len(dw04_list)}")

# Load Appendix II from report
rp_path = os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf")
doc_rp = fitz.open(rp_path)

# Parse Appendix II into a dictionary keyed by normalized chainage string (e.g. '21+340')
appendix_ii = {}
for p in [75, 76, 77]: # Pages 76, 77, 78
    txt = doc_rp[p].get_text()
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    for i, line in enumerate(lines):
        if re.match(r'^\d+\+\d+$', line):
            ch = line
            # Window of lines around this chainage
            window = lines[max(0, i-8):min(len(lines), i+10)]
            # We will parse structured values:
            # Table columns: Catch. Name | Flow [m3/s] | Structure Name | Chainage | N.º | Section
            # Find flow (number with decimal, e.g. 7.25, 21.16, 1.38, 0.84)
            # Find structure name (e.g. 21.1, 22.1, 50.A, 68.A, 73.B)
            # Find Section (e.g. 2.50 x 2.50, ø 1500, ø 1200, 3.00 x 3.00, 2.00 x 2.00)
            # Find N.º (1 or 3)
            # Let's extract them from the lines before and after
            appendix_ii[ch] = {
                "chainage": ch,
                "page": p + 1,
                "window": window
            }

print(f"Loaded {len(appendix_ii)} entries from Appendix II")

# Parse each DW-04 drawing
culverts = []

for d in dw04_list:
    doc_num = d["doc_number"]
    rev = d["submitted_revision"]
    title = d["title"]
    status = d["effective_status"]
    pdf_fn = d["pdf_filename"]
    pdf_path = os.path.join(DRAWINGS_DIR, pdf_fn)
    
    if not os.path.exists(pdf_path):
        print(f"WARNING: File missing: {pdf_path}")
        continue
        
    doc = fitz.open(pdf_path)
    page = doc[0]
    txt = page.get_text()
    blocks = page.get_text("blocks")
    
    # 1. Exact chainage
    exact_ch_m = re.findall(r'CH\s*=\s*(\d+\+\d+(?:\.\d+)?)', txt)
    exact_ch = exact_ch_m[0] if exact_ch_m else None
    
    # Stated chainage from title
    title_ch_m = re.search(r'CH\s*=\s*(\d+\+\d+)', title)
    title_ch = title_ch_m.group(1) if title_ch_m else None
    
    # Compute pk float
    pk = None
    ref_ch = exact_ch or title_ch
    if ref_ch:
        parts = ref_ch.split('+')
        pk = float(parts[0]) * 1000.0 + float(parts[1])
        
    # 2. Culvert structure type and dimensions
    # Search for "B.C. (WxH)m", "B.C. 3(WxH)m", "PIPE X.Xm", "PIP2 X.Xm"
    is_box = False
    is_pipe = False
    dims = None
    barrels = 1
    
    # Check for triple/twin box e.g. B.C. 3(3.0x3.0)m or 3x(2.5x2.5)m
    multi_bc_m = re.search(r'B\.?C\.?\s*(\d)\s*\(?([0-9\.]+)\s*[xX]\s*([0-9\.]+)\)?', txt)
    if multi_bc_m:
        is_box = True
        barrels = int(multi_bc_m.group(1))
        dims = f"{multi_bc_m.group(2)}x{multi_bc_m.group(3)}m"
    else:
        bc_m = re.search(r'B\.?C\.?\s*\(([0-9\.]+)\s*[xX]\s*([0-9\.]+)\)\s*m?', txt)
        if bc_m:
            is_box = True
            dims = f"{bc_m.group(1)}x{bc_m.group(2)}m"
    
    pipe_m = re.search(r'PIP[E2]\s*([0-9\.]+)\s*m?', txt)
    if pipe_m:
        is_pipe = True
        dims = f"Ø{pipe_m.group(1)}m"
        
    # Check for cell count / barrels (e.g. 1, 2, 3)
    # Often in cross section block or table
    cell_m = re.search(r'(\d)\s*[xX]\s*\(([0-9\.]+)\s*[xX]\s*([0-9\.]+)\)', txt)
    if cell_m:
        is_box = True
        barrels = int(cell_m.group(1))
        dims = f"{cell_m.group(2)}x{cell_m.group(3)}m"
    elif not is_box and not is_pipe:
        if "BOX CULVERT" in txt.upper():
            is_box = True
        elif "PIPE CULVERT" in txt.upper() or "PIPE" in txt.upper():
            is_pipe = True
            
    # Check if dimensions appear as 2.00 x 2.00 or 2.50 x 2.50 or 3.00 x 3.00
    if not dims:
        dim_m = re.search(r'([23]\.[05]0)\s*[xX]\s*([23]\.[05]0)', txt)
        if dim_m:
            dims = f"{dim_m.group(1)}x{dim_m.group(2)}m"
            is_box = True
        diam_m = re.search(r'[øØ]\s*([12]\.[025]0?)', txt)
        if diam_m:
            dims = f"Ø{diam_m.group(1)}m"
            is_pipe = True

    # 3. Coordinates UTM Zone 32N (Point 01, 02, 03)
    coords_utm = {}
    # Look for table with Point, Easting, Northing
    # Coordinates in Section 02 are Easting ~ 400000-450000, Northing ~ 1320000-1400000
    coords_found = re.findall(r'(\d{6}\.\d{3})\s+(\d{7}\.\d{3})', txt)
    if coords_found:
        coords_utm["easting_northing_pairs"] = coords_found
        
    # 4. Slope protection
    slope_prot_m = re.findall(r'SLOPE\s+PROTECTION\s*(?:L:?\s*(\d+)m?)?', txt, re.IGNORECASE)
    riprap_d50 = re.findall(r'D50\s*=\s*(\d+)\s*mm', txt, re.IGNORECASE)
    
    # 5. Outfall / Inlet channels or ditches
    channels = re.findall(r'(?:UNLINED|CONCRETE)\s+TRAPEZOIDAL\s+CULVERT\s+DITCH\s+CHANNEL[^\n]*', txt, re.IGNORECASE)
    
    # Cross reference with Appendix II
    # Match title_ch or int(pk)
    norm_ch = f"{int(pk//1000)}+{int(pk%1000):03d}" if pk else title_ch
    app_entry = appendix_ii.get(norm_ch)
    
    # Also check if norm_ch is 56+755 matching 56+775
    if not app_entry and norm_ch == "56+755":
        app_entry = appendix_ii.get("56+775")
    if not app_entry and title_ch:
        app_entry = appendix_ii.get(title_ch)
        
    confidence = "CONFIRMED" if app_entry else "PROBABLE"
    
    culvert_record = {
        "doc_number": doc_num,
        "revision": rev,
        "title": title,
        "pdf_filename": pdf_fn,
        "effective_status": status,
        "chainage_title": title_ch,
        "chainage_exact": exact_ch,
        "pk": pk,
        "structure_type": "Box Culvert" if is_box else ("Pipe Culvert" if is_pipe else "Culvert"),
        "barrels": barrels,
        "internal_dims": dims,
        "slope_protection_callouts": len(slope_prot_m),
        "riprap_d50_mm": riprap_d50[0] if riprap_d50 else None,
        "associated_channels": channels,
        "utm_points_count": len(coords_found),
        "in_appendix_ii": app_entry is not None,
        "confidence": confidence
    }
    culverts.append(culvert_record)

print(f"\nSuccessfully parsed {len(culverts)} culvert drawings.")
box_count = sum(1 for c in culverts if c["structure_type"] == "Box Culvert")
pipe_count = sum(1 for c in culverts if c["structure_type"] == "Pipe Culvert")
other_count = sum(1 for c in culverts if c["structure_type"] not in ["Box Culvert", "Pipe Culvert"])
confirmed_count = sum(1 for c in culverts if c["confidence"] == "CONFIRMED")
probable_count = sum(1 for c in culverts if c["confidence"] == "PROBABLE")

print(f"Summary: Box Culverts={box_count}, Pipe Culverts={pipe_count}, Unresolved Type={other_count}")
print(f"Confidence: CONFIRMED={confirmed_count}, PROBABLE={probable_count}")

# Check unresolved types if any
if other_count > 0:
    print("\nCulverts with unresolved type:")
    for c in culverts:
        if c["structure_type"] not in ["Box Culvert", "Pipe Culvert"]:
            print(f"  {c['doc_number']}: {c['title']}")

# Save parsed culverts
out_path = os.path.join(APP_DATA_DIR, "section02_parsed_culverts.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(culverts, f, indent=2)
print(f"\nSaved parsed culverts to {out_path}")
