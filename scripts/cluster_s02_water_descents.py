import fitz
import glob
import os
import re
import sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

print("=== EXTRACTING DISCRETE TYPE 9 WATER DESCENT STRUCTURES ===")
plan_pdfs = sorted(glob.glob(os.path.join(DRAWINGS_DIR, "*DW-03*.pdf")))

water_descents = []

for p_pdf in plan_pdfs:
    fn = os.path.basename(p_pdf)
    doc = fitz.open(p_pdf)
    page = doc[0]
    words = page.get_text("words")
    drawings = page.get_drawings()
    
    # Fit station ticks
    s1_ticks, s2_ticks = [], []
    for w in words:
        m = re.match(r'^(\d{2})\+(\d{3})$', w[4])
        if m:
            pk = float(m.group(1))*1000.0 + float(m.group(2))
            if 700 <= w[1] <= 780: s1_ticks.append((w[0], pk))
            elif 1480 <= w[1] <= 1560: s2_ticks.append((w[0], pk))
    s1_ticks.sort(key=lambda t: t[0])
    s2_ticks.sort(key=lambda t: t[0])
    
    def fit_s(ticks):
        if len(ticks) < 2: return None, None
        xs = np.array([t[0] for t in ticks])
        pks = np.array([t[1] for t in ticks])
        return np.polyfit(pks, xs, 1)

    m1, c1 = fit_s(s1_ticks)
    m2, c2 = fit_s(s2_ticks)
    
    track_y1, track_y2 = 332.0, 1202.0
    for drw in drawings:
        c_col = drw.get('color')
        if c_col and len(c_col)==3 and c_col[0]>0.8 and c_col[1]<0.2 and c_col[2]<0.2:
            r = drw.get('rect')
            if r.width > 200:
                if r.y0 < 850: track_y1 = r.y0
                else: track_y2 = r.y0

    sheet_chutes = []
    for d in drawings:
        f = d.get('fill')
        c = d.get('color')
        # Check fill or color matching (0, 0.647, 0.867)
        is_blue = False
        for col in [f, c]:
            if col and len(col) == 3:
                if abs(col[0] - 0.0) < 0.05 and abs(col[1] - 0.647) < 0.05 and abs(col[2] - 0.867) < 0.05:
                    is_blue = True
                    break
        if is_blue:
            r = d.get('rect')
            # The chute stem or step rect
            if r.height > 10 or r.width > 10:
                mid_x = (r.x0 + r.x1) / 2.0
                mid_y = (r.y0 + r.y1) / 2.0
                
                if mid_y < 850 and m1 is not None:
                    pk = (mid_x - c1) / m1
                    side = "Left" if mid_y < track_y1 else "Right"
                    sheet_chutes.append((pk, side, mid_x, mid_y))
                elif mid_y >= 850 and m2 is not None:
                    pk = (mid_x - c2) / m2
                    side = "Left" if mid_y < track_y2 else "Right"
                    sheet_chutes.append((pk, side, mid_x, mid_y))

    # Cluster duplicate rects of the same chute (within 10m PK)
    sheet_chutes.sort(key=lambda c: c[0])
    clustered = []
    for sc in sheet_chutes:
        if not clustered:
            clustered.append(sc)
            continue
        # If same side and within 12m, it's the same chute structure
        if sc[1] == clustered[-1][1] and abs(sc[0] - clustered[-1][0]) <= 12.0:
            continue
        clustered.append(sc)
        
    for c in clustered:
        water_descents.append({
            "file": fn,
            "pk": round(c[0], 1),
            "side": c[1]
        })

print(f"Total discrete Type 9 Water Descent structures found: {len(water_descents)}")
water_descents.sort(key=lambda w: w["pk"])
for w in water_descents[:10]:
    print(f"  PK {w['pk']} ({w['side']}) [{w['file']}]")
