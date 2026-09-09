import fitz
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r"Doc no. 1084\T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf"
doc = fitz.open(pdf_path)

print("=== INSPECTING REPORT TABLES 3.27, 3.28, 3.29 (pages 58 to 65) ===")
for p in range(57, 65):
    txt = doc[p].get_text()
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    header_lines = [l for l in lines if 'Table 3.' in l or '3.5.' in l]
    print(f"\n--- Page {p+1} --- Headers: {header_lines}")
    # Print sample text
    for l in lines[:25]:
        print("  ", l)
