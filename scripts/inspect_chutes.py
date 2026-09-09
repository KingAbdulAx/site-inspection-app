import fitz
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
doc = fitz.open(os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03004-04.pdf"))
page = doc[0]
drawings = page.get_drawings()

# Around CH 22+900 to 23+100 on Strip 1 (x: 1000 to 1400, y: 300 to 450)
print("=== INSPECTING TRACK SHOULDER & EMBANKMENT VECTORS ON DW-03004 (CH 22+800 to 23+200) ===")

shoulder_elements = []
for d in drawings:
    rect = d.get('rect')
    if 900 <= rect.x0 <= 1500 and 300 <= rect.y0 <= 450:
        c = d.get('color')
        f = d.get('fill')
        items = d.get('items', [])
        # Look for transverse lines or chutes (lines with dy > 10)
        for it in items:
            if it[0] == 'l':
                p1, p2 = it[1], it[2]
                dx = abs(p1.x - p2.x)
                dy = abs(p1.y - p2.y)
                # If steep transverse line (dy > 15)
                if dy > 15:
                    shoulder_elements.append({
                        'type': 'line',
                        'p1': (round(p1.x, 1), round(p1.y, 1)),
                        'p2': (round(p2.x, 1), round(p2.y, 1)),
                        'dx': round(dx, 1), 'dy': round(dy, 1),
                        'color': c, 'fill': f
                    })
            elif it[0] == 're':
                shoulder_elements.append({
                    'type': 'rect',
                    'rect': (round(rect.x0, 1), round(rect.y0, 1), round(rect.width, 1), round(rect.height, 1)),
                    'color': c, 'fill': f
                })

print(f"Transverse lines / chutes found: {len(shoulder_elements)}")
for se in shoulder_elements[:20]:
    print("  ", se)
