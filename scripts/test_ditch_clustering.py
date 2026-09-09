import fitz
import os
import sys
import re
import numpy as np
import json

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

# Let's test on DW-03003 and DW-03004
test_sheets = [
    "T2019-323-DD-KM-DWKZ-2200-DW-03003-05.pdf",
    "T2019-323-DD-KM-DWKZ-2200-DW-03004-04.pdf"
]

for fn in test_sheets:
    pdf_path = os.path.join(DRAWINGS_DIR, fn)
    doc = fitz.open(pdf_path)
    page = doc[0]
    words = page.get_text("words")
    
    # 1. Fit station bands
    # Find ticks for Strip 1 (y: 700-780) and Strip 2 (y: 1480-1560)
    s1_ticks = []
    s2_ticks = []
    for w in words:
        m = re.match(r'^(\d{2})\+(\d{3})$', w[4])
        if m:
            pk = float(m.group(1))*1000.0 + float(m.group(2))
            if 700 <= w[1] <= 780:
                s1_ticks.append((w[0], pk, w[4]))
            elif 1480 <= w[1] <= 1560:
                s2_ticks.append((w[0], pk, w[4]))
                
    s1_ticks.sort(key=lambda t: t[0])
    s2_ticks.sort(key=lambda t: t[0])
    
    # Fit line
    def fit_s(ticks):
        if len(ticks) < 2: return None, None
        xs = np.array([t[0] for t in ticks])
        pks = np.array([t[1] for t in ticks])
        m, c = np.polyfit(pks, xs, 1)
        return m, c

    m1, c1 = fit_s(s1_ticks)
    m2, c2 = fit_s(s2_ticks)
    
    # 2. Track y
    drawings = page.get_drawings()
    track_y1, track_y2 = 332.0, 1202.0
    for d in drawings:
        c = d.get('color')
        if c and len(c)==3 and c[0]>0.8 and c[1]<0.2 and c[2]<0.2:
            r = d.get('rect')
            if r.width > 200:
                if r.y0 < 850: track_y1 = r.y0
                else: track_y2 = r.y0

    # 3. Extract marker points
    markers = []
    for d in drawings:
        color = d.get('color')
        fill = d.get('fill')
        rect = d.get('rect')
        items = d.get('items', [])
        
        # Only small symbols
        if rect.width < 15 and rect.height < 15:
            # Determine strip
            if rect.y0 < 850 and m1 is not None:
                strip = 1
                pk = (rect.x0 - c1) / m1
                side = "Left" if rect.y0 < track_y1 else "Right"
            elif rect.y0 >= 850 and m2 is not None:
                strip = 2
                pk = (rect.x0 - c2) / m2
                side = "Left" if rect.y0 < track_y2 else "Right"
            else:
                continue
                
            is_black = color and max(color) < 0.15
            is_blue = color and len(color)==3 and color[2] > 0.6 and color[0] < 0.3
            
            # Type 7: Black X (2 line items)
            if len(items) == 2 and items[0][0] == 'l' and items[1][0] == 'l' and is_black:
                markers.append((pk, side, "Type 7", rect.x0, rect.y0))
            # Type 4: Blue X (2 line items)
            elif len(items) == 2 and items[0][0] == 'l' and items[1][0] == 'l' and is_blue:
                markers.append((pk, side, "Type 4", rect.x0, rect.y0))
            # Type 12: Black slash (1 line item)
            elif len(items) == 1 and items[0][0] == 'l' and is_black:
                # check if diagonal
                p1, p2 = items[0][1], items[0][2]
                if abs(p1.x - p2.x) > 1 and abs(p1.y - p2.y) > 1:
                    markers.append((pk, side, "Type 12", rect.x0, rect.y0))

    # Cluster markers by (side, type)
    # Sort markers by pk
    markers.sort(key=lambda x: x[0])
    
    runs = []
    # Cluster threshold: 16m
    for (side_filter, type_filter) in [
        ("Left", "Type 7"), ("Right", "Type 7"),
        ("Left", "Type 4"), ("Right", "Type 4"),
        ("Left", "Type 12"), ("Right", "Type 12")
    ]:
        filtered = [m for m in markers if m[1] == side_filter and m[2] == type_filter]
        if not filtered: continue
        
        current_run = [filtered[0]]
        for pt in filtered[1:]:
            # If distance <= 20m, group together
            if pt[0] - current_run[-1][0] <= 20.0:
                current_run.append(pt)
            else:
                # Minimum 3 markers to form a valid ditch run
                if len(current_run) >= 3:
                    runs.append({
                        "type": type_filter,
                        "side": side_filter,
                        "start_pk": round(current_run[0][0], 1),
                        "end_pk": round(current_run[-1][0], 1),
                        "length_m": round(current_run[-1][0] - current_run[0][0], 1),
                        "marker_count": len(current_run)
                    })
                current_run = [pt]
        if len(current_run) >= 3:
            runs.append({
                "type": type_filter,
                "side": side_filter,
                "start_pk": round(current_run[0][0], 1),
                "end_pk": round(current_run[-1][0], 1),
                "length_m": round(current_run[-1][0] - current_run[0][0], 1),
                "marker_count": len(current_run)
            })

    runs.sort(key=lambda r: r["start_pk"])
    print(f"\nExtracted {len(runs)} ditch runs from {fn}:")
    for r in runs:
        print(f"  {r['type']} ({r['side']}): PK {r['start_pk']} to PK {r['end_pk']} (L={r['length_m']}m, {r['marker_count']} markers)")
