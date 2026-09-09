import fitz
import os
import sys
import re
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
pdf_path = os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03004-04.pdf")
doc = fitz.open(pdf_path)
page = doc[0]

print("=== INSPECTING STRIPS, TRACK, AND MARKERS ON DW-03004-04 ===")

# 1. Extract words and ticks
words = page.get_text("words")
# Find ticks for Strip 1 (upper) and Strip 2 (lower)
# Let's inspect all chainage words:
pk_words = []
for w in words:
    # w: x0, y0, x1, y1, text, block, line, word
    m = re.match(r'^(\d{2})\+(\d{3})$', w[4])
    if m:
        pk = float(m.group(1))*1000.0 + float(m.group(2))
        pk_words.append((w[0], w[1], pk, w[4]))

strip1_ticks = [t for t in pk_words if t[1] < 850]
strip2_ticks = [t for t in pk_words if t[1] >= 850]

print(f"Strip 1 ticks ({len(strip1_ticks)}): {[(t[3], int(t[0]), int(t[1])) for t in strip1_ticks[:5]]} ... {[(t[3], int(t[0]), int(t[1])) for t in strip1_ticks[-2:]]}")
print(f"Strip 2 ticks ({len(strip2_ticks)}): {[(t[3], int(t[0]), int(t[1])) for t in strip2_ticks[:5]]} ... {[(t[3], int(t[0]), int(t[1])) for t in strip2_ticks[-2:]]}")

# Fit scales
def fit_line(ticks):
    xs = np.array([t[0] for t in ticks])
    pks = np.array([t[2] for t in ticks])
    m, c = np.polyfit(pks, xs, 1)
    res = xs - (m*pks + c)
    max_res = np.max(np.abs(res))
    return m, c, max_res

m1, c1, res1 = fit_line(strip1_ticks)
m2, c2, res2 = fit_line(strip2_ticks)
print(f"Strip 1: x = {m1:.5f} * pk + ({c1:.2f})  [Scale: {m1:.5f} pt/m, Max residual: {res1:.2f} pt]")
print(f"Strip 2: x = {m2:.5f} * pk + ({c2:.2f})  [Scale: {m2:.5f} pt/m, Max residual: {res2:.2f} pt]")

# Find track red lines
drawings = page.get_drawings()
red_lines_s1 = []
red_lines_s2 = []
for d in drawings:
    c = d.get('color')
    if c and len(c) == 3 and c[0] > 0.8 and c[1] < 0.2 and c[2] < 0.2:
        r = d.get('rect')
        if r.width > 50: # track line
            if r.y0 < 850:
                red_lines_s1.append(r)
            else:
                red_lines_s2.append(r)

print(f"Track red lines in Strip 1: y ranges = {[(round(r.y0, 1), round(r.y1, 1)) for r in red_lines_s1[:3]]}")
print(f"Track red lines in Strip 2: y ranges = {[(round(r.y0, 1), round(r.y1, 1)) for r in red_lines_s2[:3]]}")
