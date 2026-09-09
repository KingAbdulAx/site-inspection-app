import fitz
import os
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

samples = [
    "T2019-323-DD-KM-DWKZ-2200-DW-04002-02.pdf",
    "T2019-323-DD-KM-DWKZ-2200-DW-04003-02.pdf",
    "T2019-323-DD-KM-DWKZ-2200-DW-04005-02.pdf",
    "T2019-323-DD-KM-DWKZ-2200-DW-04050-02.pdf",
    "T2019-323-DD-KM-DWKZ-2200-DW-04123-01.pdf"
]

for s in samples:
    p = os.path.join(DRAWINGS_DIR, s)
    if not os.path.exists(p):
        print(f"File not found: {s}")
        continue
    doc = fitz.open(p)
    txt = doc[0].get_text()
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    print(f"\n==================== {s} ====================")
    for l in lines:
        if any(k in l.upper() for k in [
            'CH=', 'CH =', 'BOX CULVERT', 'PIPE CULVERT', 'Ø', 'DIMENSION', 
            'SLOPE', 'SKEW', 'INLET', 'OUTLET', 'LEVEL', 'LENGTH', 'FLOW', 'Q100', 'PROTECTION', 'RIPRAP'
        ]):
            print("  ", l)
