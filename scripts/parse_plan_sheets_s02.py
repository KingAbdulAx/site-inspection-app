import os
import sys
import re
import json
import fitz
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

print("=== PARSING 47 SECTION 02 PLAN SHEETS (DW-03001 to DW-03047) ===")

# Load drawing register
with open(os.path.join(APP_DATA_DIR, "section02_drawing_register.json"), encoding='utf-8') as f:
    reg = json.load(f)

docs = reg.get("documents", [])
plan_sheets = [d for d in docs if "DW-03" in d.get("doc_number", "")]
print(f"Total plan sheets to parse: {len(plan_sheets)}")

# Plan sheets inspection helper
# Each sheet has 2 strips:
# Strip 1: y in [200, 800]
# Strip 2: y in [850, 1500]

def parse_chainage_ticks(words, strip_y_range):
    # Find chainage labels like "20+000", "20+100", "82+900" in strip
    ticks = []
    for w in words:
        # w is (x0, y0, x1, y1, word, block_no, line_no, word_no)
        x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4].strip()
        if strip_y_range[0] <= y0 <= strip_y_range[1]:
            m = re.match(r'^(\d{2})\+(\d{3})$', text)
            if m:
                pk_val = float(m.group(1)) * 1000.0 + float(m.group(2))
                ticks.append((x0, pk_val))
    # Sort by x
    ticks.sort(key=lambda t: t[0])
    return ticks

def fit_scale(ticks):
    if len(ticks) < 2:
        return None, None
    xs = np.array([t[0] for t in ticks])
    pks = np.array([t[1] for t in ticks])
    # Linear fit: x = m * pk + c  =>  pk = (x - c) / m
    # slope m in pt / m
    m, c = np.polyfit(pks, xs, 1)
    return m, c
