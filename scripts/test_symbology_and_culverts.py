import fitz
import os
import sys
import re
import json
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"
OUTPUT_IMG_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\scripts\symbology_crops"
os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

print("=== STEP 1: TEST SYMBOLOGY ON SECTION 02 PLAN SHEETS ===")

sample_sheets = [
    ("DW-03004-04", os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03004-04.pdf")),
    ("DW-03020-04", os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03020-04.pdf")),
    ("DW-03047-05", os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03047-05.pdf")),
]

for name, path in sample_sheets:
    if not os.path.exists(path):
        print(f"File not found: {path}")
        continue
    doc = fitz.open(path)
    page = doc[0]
    print(f"\nAnalyzing {name} (Rect: {page.rect}):")
    
    # Check text occurrences of drainage types
    text = page.get_text()
    ditch_mentions = re.findall(r'(?:ditch\s+type\s+\d+|channel\s+type\s+[A-Z]|water\s+descent|half\s+round|riprap)', text, re.IGNORECASE)
    print(f"  Explicit text mentions: {set(ditch_mentions)}")
    
    # Check drawings/vector paths
    drawings = page.get_drawings()
    # Find markers: small X or / paths
    x_markers_black = []
    x_markers_blue = []
    slash_markers_black = []
    
    for d in drawings:
        color = d.get('color')
        fill = d.get('fill')
        items = d.get('items', [])
        rect = d.get('rect')
        
        # Look for small crosses or lines typical of markers (size < 10 pt)
        if rect.width < 15 and rect.height < 15:
            # Check color
            # Black: (0,0,0) or close
            is_black = color and max(color) < 0.15
            # Blue: high blue, low red
            is_blue = color and len(color) == 3 and color[2] > 0.6 and color[0] < 0.3
            
            # Check shape
            # An X is made of 2 crossing line segments or a cross path
            if len(items) == 2 and items[0][0] == 'l' and items[1][0] == 'l':
                p1_start, p1_end = items[0][1], items[0][2]
                p2_start, p2_end = items[1][1], items[1][2]
                # crossing diagonals?
                if is_black:
                    x_markers_black.append((rect.x0, rect.y0))
                elif is_blue:
                    x_markers_blue.append((rect.x0, rect.y0))
            elif len(items) == 1 and items[0][0] == 'l':
                # Single slash
                if is_black:
                    slash_markers_black.append((rect.x0, rect.y0))
    
    print(f"  Small vector paths: black={len(x_markers_black)}, blue={len(x_markers_blue)}, single-slash black={len(slash_markers_black)}")

    # Let's render a 300 DPI crop of a track section with ditch markings
    # Strip 1: y around 400-800, Strip 2: y around 950-1350
    # Let's render strip 1 middle
    crop_rect = fitz.Rect(500, 300, 1100, 700)
    pix = page.get_pixmap(matrix=fitz.Matrix(3.0, 3.0), clip=crop_rect)
    crop_file = os.path.join(OUTPUT_IMG_DIR, f"{name}_crop.png")
    pix.save(crop_file)
    print(f"  Saved high-res crop to {crop_file}")

print("\n=== STEP 2: CROSS-REFERENCE CULVERTS (APPENDIX II VS 119 DRAWINGS) ===")

with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
dw04_list = [d for d in docs if "DW-04" in d.get("doc_number", "")]
print(f"Total culvert detail drawings in register: {len(dw04_list)}")

dw04_by_ch = {}
dw04_no_ch = []
for d in dw04_list:
    m = re.search(r'CH\s*=\s*(\d+\+\d+)', d["title"])
    if m:
        ch = m.group(1)
        dw04_by_ch[ch] = d
    else:
        dw04_no_ch.append(d)

print(f"Drawings with parsed chainage in title: {len(dw04_by_ch)}")
print(f"Drawings without chainage in title: {len(dw04_no_ch)}")
for d in dw04_no_ch:
    print(f"  {d['document_number']}: {d['title']}")

# Parse Appendix II
rp_path = os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf")
doc_rp = fitz.open(rp_path)

appendix_culverts = []
for p in [75, 76, 77]: # Pages 76, 77, 78
    txt = doc_rp[p].get_text()
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    i = 0
    while i < len(lines):
        line = lines[i]
        # Match chainage like 21+340
        if re.match(r'^\d+\+\d+$', line):
            ch = line
            # Let's inspect surrounding tokens to get Catchment, Flow, Structure Name, ID, Section
            # In PyMuPDF text, table rows might be parsed column-wise or row-wise
            appendix_culverts.append((ch, p+1, lines[max(0, i-6):min(len(lines), i+8)]))
        i += 1

print(f"Appendix II total culvert chainages: {len(appendix_culverts)}")
app_chs = set(c[0] for c in appendix_culverts)
dw_chs = set(dw04_by_ch.keys())

common = app_chs.intersection(dw_chs)
only_app = app_chs - dw_chs
only_dw = dw_chs - app_chs

print(f"Chainages matching both Appendix II and DW-04 drawings: {len(common)}")
print(f"Chainages in Appendix II but NOT in DW-04 drawing titles: {len(only_app)} -> {sorted(list(only_app))}")
print(f"Chainages in DW-04 drawing titles but NOT in Appendix II: {len(only_dw)} -> {sorted(list(only_dw))}")
