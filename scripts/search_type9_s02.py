import fitz
import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

print("=== SEARCHING FOR TYPE 9 IN DESIGN REPORT RP-00001-06 ===")
rp_path = os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf")
doc_rp = fitz.open(rp_path)

for p in range(len(doc_rp)):
    txt = doc_rp[p].get_text()
    if "type 9" in txt.lower():
        print(f"\n--- Page {p+1} ---")
        lines = txt.split('\n')
        for i, l in enumerate(lines):
            if "type 9" in l.lower():
                # Print context
                ctx = " | ".join([lines[j].strip() for j in range(max(0, i-3), min(len(lines), i+4)) if lines[j].strip()])
                print(f"  Line {i}: {ctx}")

print("\n=== SEARCHING FOR TYPE 9 IN 47 PLAN DRAWINGS ===")
plan_pdfs = sorted(glob.glob(os.path.join(DRAWINGS_DIR, "*DW-03*.pdf")))

plan_mentions = []
for p_pdf in plan_pdfs:
    fn = os.path.basename(p_pdf)
    doc = fitz.open(p_pdf)
    txt = doc[0].get_text()
    if any(k in txt.lower() for k in ["type 9", "type-9", "type nine", "descent", "chute", "water descent", "cascade"]):
        print(f"\nPlan {fn}:")
        for line in txt.split('\n'):
            l_s = line.strip()
            if any(k in l_s.lower() for k in ["type 9", "type-9", "descent", "chute", "water descent", "cascade"]):
                print(f"  {l_s}")
                plan_mentions.append((fn, l_s))

print(f"\nTotal plan mentions of Type 9 / Descents / Chutes: {len(plan_mentions)}")
