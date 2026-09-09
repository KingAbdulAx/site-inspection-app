import fitz
import glob
import os
import re
import sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
APP_DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

print("=== DETAILED EXTRACTION OF TYPE 9 (SHOULDER DITCHES & WATER DESCENTS) ===")

plan_pdfs = sorted(glob.glob(os.path.join(DRAWINGS_DIR, "*DW-03*.pdf")))

type9_shoulder_ditches = []
type8_bench_ditches = []
type9_water_descents = []

for p_pdf in plan_pdfs:
    fn = os.path.basename(p_pdf)
    doc = fitz.open(p_pdf)
    page = doc[0]
    words = page.get_text("words")
    blocks = page.get_text("blocks")
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
    
    # Track y levels
    track_y1, track_y2 = 332.0, 1202.0
    for drw in drawings:
        c_col = drw.get('color')
        if c_col and len(c_col)==3 and c_col[0]>0.8 and c_col[1]<0.2 and c_col[2]<0.2:
            r = drw.get('rect')
            if r.width > 200:
                if r.y0 < 850: track_y1 = r.y0
                else: track_y2 = r.y0

    # 1. Inspect text blocks for Half Round Ditches (Type 8 vs Type 9)
    for b in blocks:
        txt = b[4].strip()
        if "HALF ROUND" in txt.upper():
            # Determine PK and side
            if b[1] < 850 and m1 is not None:
                pk = (b[0] - c1) / m1
                side = "Left" if b[1] < track_y1 else "Right"
            elif b[1] >= 850 and m2 is not None:
                pk = (b[0] - c2) / m2
                side = "Left" if b[1] < track_y2 else "Right"
            else:
                continue
                
            m_len = re.search(r'L:?\s*(\d+)m?', txt, re.IGNORECASE)
            len_m = float(m_len.group(1)) if m_len else 50.0
            m_slope = re.search(r'i:?\s*([0-9\.]+)%?', txt, re.IGNORECASE)
            slope_s = f"{m_slope.group(1)}%" if m_slope else "Unstated"
            
            is_bench = "BENCH" in txt.upper()
            if is_bench:
                type8_bench_ditches.append({
                    "file": fn,
                    "pk": round(pk, 1),
                    "start_pk": round(pk - len_m/2.0, 1),
                    "end_pk": round(pk + len_m/2.0, 1),
                    "length_m": len_m,
                    "side": side,
                    "slope": slope_s,
                    "raw_text": txt.replace('\n', ' ')
                })
            else:
                type9_shoulder_ditches.append({
                    "file": fn,
                    "pk": round(pk, 1),
                    "start_pk": round(pk - len_m/2.0, 1),
                    "end_pk": round(pk + len_m/2.0, 1),
                    "length_m": len_m,
                    "side": side,
                    "slope": slope_s,
                    "raw_text": txt.replace('\n', ' ')
                })

    # 2. Extract transverse chutes / water descents from drawings
    # Chutes are steep transverse lines down the embankment slope (dy > 15, within y offset 20-150 from track)
    sheet_chutes = []
    for drw in drawings:
        items = drw.get('items', [])
        for it in items:
            if it[0] == 'l':
                p1, p2 = it[1], it[2]
                dx = abs(p1.x - p2.x)
                dy = abs(p1.y - p2.y)
                # Chutes have dy between 18 and 80, and dx < 30
                if 18.0 <= dy <= 90.0 and dx <= 35.0:
                    mid_y = (p1.y + p2.y) / 2.0
                    mid_x = (p1.x + p2.x) / 2.0
                    
                    if mid_y < 850 and m1 is not None:
                        # Check distance from track y
                        if 15.0 <= abs(mid_y - track_y1) <= 180.0:
                            pk = (mid_x - c1) / m1
                            side = "Left" if mid_y < track_y1 else "Right"
                            sheet_chutes.append((pk, side, mid_x, mid_y, dy))
                    elif mid_y >= 850 and m2 is not None:
                        if 15.0 <= abs(mid_y - track_y2) <= 180.0:
                            pk = (mid_x - c2) / m2
                            side = "Left" if mid_y < track_y2 else "Right"
                            sheet_chutes.append((pk, side, mid_x, mid_y, dy))

    # Cluster duplicate line segments for the same chute (within 10m PK)
    sheet_chutes.sort(key=lambda c: c[0])
    clustered_chutes = []
    for sc in sheet_chutes:
        if not clustered_chutes:
            clustered_chutes.append(sc)
            continue
        # If within 10m and same side, collapse
        if sc[1] == clustered_chutes[-1][1] and abs(sc[0] - clustered_chutes[-1][0]) <= 12.0:
            continue
        clustered_chutes.append(sc)
        
    for cc in clustered_chutes:
        type9_water_descents.append({
            "file": fn,
            "pk": round(cc[0], 1),
            "side": cc[1],
            "fall_pt": round(cc[4], 1)
        })

print(f"\nExtraction Results for Type 8 and Type 9:")
print(f"  Type 8 Half-Round Lined Bench Ditches: {len(type8_bench_ditches)}")
print(f"  Type 9 Half-Round Lined Platform Shoulder Ditches: {len(type9_shoulder_ditches)}")
print(f"  Type 9 Precast Water Descents (Chutes): {len(type9_water_descents)}")

print("\nSample Type 9 Platform Shoulder Ditches:")
for s in type9_shoulder_ditches[:5]:
    print(f"  PK {s['start_pk']}-{s['end_pk']} ({s['side']}): L={s['length_m']}m, slope={s['slope']} [{s['file']}]")

print("\nSample Type 9 Water Descents:")
for w in type9_water_descents[:5]:
    print(f"  PK {w['pk']} ({w['side']}): fall={w['fall_pt']}pt [{w['file']}]")
