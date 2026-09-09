import fitz
import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

print("=== INVESTIGATING ALL HALF ROUND DITCH CALLOUTS ACROSS 47 PLAN SHEETS ===")
plan_pdfs = sorted(glob.glob(os.path.join(DRAWINGS_DIR, "*DW-03*.pdf")))

hr_callouts = []
for p_pdf in plan_pdfs:
    fn = os.path.basename(p_pdf)
    doc = fitz.open(p_pdf)
    page = doc[0]
    blocks = page.get_text("blocks")
    for b in blocks:
        txt = b[4].strip()
        if "HALF ROUND" in txt.upper():
            hr_callouts.append({
                "file": fn,
                "text": txt.replace('\n', '  '),
                "x": b[0], "y": b[1]
            })

print(f"Total HALF ROUND callouts found: {len(hr_callouts)}")
bench_count = sum(1 for c in hr_callouts if "BENCH" in c["text"].upper())
non_bench_count = sum(1 for c in hr_callouts if "BENCH" not in c["text"].upper())
print(f"Callouts with 'BENCH' (Type 8): {bench_count}")
print(f"Callouts WITHOUT 'BENCH' (Type 9 platform shoulder / ditch): {non_bench_count}")

print("\nSample NON-BENCH callouts (Type 9):")
for c in [c for c in hr_callouts if "BENCH" not in c["text"].upper()][:15]:
    print(f"  [{c['file']}] {c['text']}")

print("\nSample BENCH callouts (Type 8):")
for c in [c for c in hr_callouts if "BENCH" in c["text"].upper()][:10]:
    print(f"  [{c['file']}] {c['text']}")
