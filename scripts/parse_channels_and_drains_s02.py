import fitz
import os
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

print("=== PARSING DESIGN REPORT TABLES 3.27, 3.28, 3.29 AND COLLECTOR DRAINS ===")

rp_path = os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf")
doc_rp = fitz.open(rp_path)

# 1. Parse Table 3.28: Trapezoidal channels verification (Page 61 / pdf page index 60)
p61_txt = doc_rp[60].get_text()
p61_lines = [l.strip() for l in p61_txt.split('\n') if l.strip()]

print("Parsing Table 3.28 (Trapezoidal channels)...")
# Let's inspect the lines of page 61
channels = []
for i, l in enumerate(p61_lines):
    # Match chainages like 19+850, 22+800, etc.
    if re.match(r'^\d+\+\d+$', l):
        ch = l
        window = p61_lines[max(0, i-2):min(len(p61_lines), i+12)]
        channels.append({
            "chainage_start": ch,
            "window": window
        })
print(f"Found {len(channels)} potential channel entries in Table 3.28")

# 2. Parse Collector Drain Drawings: DW-08001 to DW-08004
collector_drawings = [
    ("DW-08001-02", "Collector Drain - Dawanau (Sheet 1/2)", "Dawanau"),
    ("DW-08002-02", "Collector Drain - Dambatta", "Dambatta"),
    ("DW-08003-01", "Collector Drain - Yard-Kazaure", "Kazaure"),
    ("DW-08004-01", "Collector Drain - Dawanau (Sheet 2/2)", "Dawanau"),
]

collector_features = []
for doc_code, title, location in collector_drawings:
    # Find matching file in Doc no. 1084
    import glob
    matches = glob.glob(os.path.join(DRAWINGS_DIR, f"*{doc_code[:8]}*.pdf"))
    if not matches:
        print(f"File not found for {doc_code}")
        continue
    fn = matches[0]
    cdoc = fitz.open(fn)
    cpage = cdoc[0]
    ctxt = cpage.get_text()
    clines = [l.strip() for l in ctxt.split('\n') if l.strip()]
    
    # Extract pipe diameters, manholes, lengths
    pipes = re.findall(r'[øØ]\s*(\d+)', ctxt)
    manholes = re.findall(r'MH\s*[\d\.]+', ctxt)
    chainages = re.findall(r'CH\s*=\s*(\d+\+\d+)', ctxt)
    
    # Status: Dawanau is ON-HOLD per TC 1084/26 Page 4
    is_on_hold = "Dawanau" in location
    status = "ON-HOLD (Relocation Directive)" if is_on_hold else "LEVEL A"
    
    collector_features.append({
        "doc_number": doc_code,
        "title": title,
        "location": location,
        "status": status,
        "pipes": list(set(pipes)),
        "manholes_count": len(manholes),
        "chainages": list(set(chainages)),
        "file": os.path.basename(fn)
    })

print(f"\nExtracted {len(collector_features)} collector drain summaries:")
for cf in collector_features:
    print(f"  {cf['doc_number']} ({cf['location']}): status={cf['status']}, pipes={cf['pipes']}, manholes={cf['manholes_count']}")
