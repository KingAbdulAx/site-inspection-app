import fitz
import os
import sys
import re
import glob
import json

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

print("=== SCANNING ALL 47 PLAN SHEETS FOR DRAINAGE CALLOUTS ===")

with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
plan_sheets = [d for d in docs if "DW-03" in d.get("doc_number", "")]
plan_sheets.sort(key=lambda d: d["doc_number"])

callout_records = []

for d in plan_sheets:
    doc_num = d["doc_number"]
    pdf_fn = d.get("pdf_filename")
    if not pdf_fn:
        continue
    pdf_path = os.path.join(DRAWINGS_DIR, pdf_fn)
    rev = d["submitted_revision"]
    status = d["effective_status"]
    
    if not os.path.exists(pdf_path):
        continue
        
    doc = fitz.open(pdf_path)
    page = doc[0]
    blocks = page.get_text("blocks")
    
    for b in blocks:
        txt = b[4].strip()
        # Look for drainage features:
        # Half round bench ditch
        m_hr = re.search(r'HALF\s+ROUND\s+(?:LINED\s+)?(?:BENCH\s+)?DITCH[^\n]*(?:\n[^\n]*)?', txt, re.IGNORECASE)
        if m_hr:
            callout_records.append({
                "doc_number": doc_num,
                "revision": rev,
                "status": status,
                "category": "Berm Ditch",
                "typology": "Half-Round Lined Bench Ditch (Type 8)",
                "raw_text": txt.replace('\n', ' '),
                "x": b[0], "y": b[1]
            })
            
        # Slope protection
        m_sp = re.search(r'SLOPE\s+PROTECTION[^\n]*(?:\n[^\n]*)?', txt, re.IGNORECASE)
        if m_sp and "REV" not in txt and "CHECKED" not in txt:
            callout_records.append({
                "doc_number": doc_num,
                "revision": rev,
                "status": status,
                "category": "Riprap Protection",
                "typology": "Embankment Riprap Armor & Scour Protection",
                "raw_text": txt.replace('\n', ' '),
                "x": b[0], "y": b[1]
            })
            
        # Channels
        m_ch = re.search(r'(?:TRAPEZOIDAL\s+)?CHANNEL\s+(?:TYPE\s+[A-Z]|WITH\s+\d+\s*m)[^\n]*', txt, re.IGNORECASE)
        if m_ch:
            callout_records.append({
                "doc_number": doc_num,
                "revision": rev,
                "status": status,
                "category": "Diversion Channel",
                "typology": "Concrete Trapezoidal Channel",
                "raw_text": txt.replace('\n', ' '),
                "x": b[0], "y": b[1]
            })
            
        # Stepped cascades / water descents
        m_wd = re.search(r'(?:WATER\s+DESCENT|STEPPED\s+CASCADE|CHUTE)[^\n]*', txt, re.IGNORECASE)
        if m_wd:
            callout_records.append({
                "doc_number": doc_num,
                "revision": rev,
                "status": status,
                "category": "Water Descent",
                "typology": "Precast Water Descent (Type 9 Chute)",
                "raw_text": txt.replace('\n', ' '),
                "x": b[0], "y": b[1]
            })
            
        # Energy Dissipator
        m_ed = re.search(r'ENERGY\s+DISSIPATOR[^\n]*', txt, re.IGNORECASE)
        if m_ed:
            callout_records.append({
                "doc_number": doc_num,
                "revision": rev,
                "status": status,
                "category": "Energy Dissipator",
                "typology": "Energy Dissipator Basin",
                "raw_text": txt.replace('\n', ' '),
                "x": b[0], "y": b[1]
            })

print(f"Total callouts found across 47 plan sheets: {len(callout_records)}")
cats = {}
for c in callout_records:
    cat = c["category"]
    cats[cat] = cats.get(cat, 0) + 1
for k, v in cats.items():
    print(f"  {k}: {v}")
