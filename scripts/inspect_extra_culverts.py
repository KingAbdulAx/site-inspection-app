import json
import os
import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
dw04_list = [d for d in docs if "DW-04" in d.get("doc_number", "")]

target_chs = ['32+623', '32+707', '56+755', '60+250', '80+047', '80+189', '81+189', '81+825', '81+937', '82+850']

print("=== INSPECTING 10 DW-04 DRAWINGS NOT IN REPORT APPENDIX II ===")
for ch in target_chs:
    matches = [d for d in dw04_list if ch in d['title']]
    for d in matches:
        print(f"\nDrawing: {d['doc_number']} (Rev {d['submitted_revision']})")
        print(f"Title: {d['title']}")
        print(f"Effective Status: {d['effective_status']}")
        
        # Let's inspect the text inside the PDF
        pdf_path = os.path.join(DRAWINGS_DIR, d['pdf_filename'])
        if os.path.exists(pdf_path):
            doc = fitz.open(pdf_path)
            txt = doc[0].get_text()
            # Find key info: structure type, dimensions, skew, flow
            lines = [l.strip() for l in txt.split('\n') if l.strip()]
            # Find lines with BOX CULVERT, PIPE CULVERT, or dimensions
            info_lines = []
            for i, l in enumerate(lines):
                if any(k in l.upper() for k in ['BOX CULVERT', 'PIPE CULVERT', 'DIMENSIONS', 'SLOPE', 'SKEW', 'FLOW', 'DISCHARGE', 'Q100', 'DIAMETER']):
                    info_lines.append(l)
            print(f"Key lines in PDF: {info_lines[:10]}")
