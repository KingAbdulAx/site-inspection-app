import fitz
import os
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"
doc = fitz.open(os.path.join(DRAWINGS_DIR, "T2019-323-DD-KM-DWKZ-2200-DW-03004-04.pdf"))
page = doc[0]
drawings = page.get_drawings()

print(f"Total drawings on DW-03004-04: {len(drawings)}")

# Look for blue filled paths
blue_fills = []
for d in drawings:
    f = d.get('fill')
    c = d.get('color')
    rect = d.get('rect')
    
    # Check if blue fill (R < 0.3, B > 0.6)
    is_blue_fill = f and len(f)==3 and f[0] < 0.3 and f[2] > 0.6
    is_blue_stroke = c and len(c)==3 and c[0] < 0.3 and c[2] > 0.6
    
    if is_blue_fill or is_blue_stroke:
        # Check size and items
        items = d.get('items', [])
        blue_fills.append({
            'fill': f,
            'color': c,
            'rect': (round(rect.x0, 1), round(rect.y0, 1), round(rect.width, 1), round(rect.height, 1)),
            'items_count': len(items),
            'item_types': [it[0] for it in items[:4]]
        })

print(f"Total blue elements found: {len(blue_fills)}")

# Group by rect size or shape
shapes = {}
for b in blue_fills:
    sz = (b['rect'][2], b['rect'][3], b['fill'] is not None)
    shapes[sz] = shapes.get(sz, 0) + 1

print("\nBlue element size clusters (width, height, has_fill): count:")
for sz, cnt in sorted(shapes.items(), key=lambda x: x[1], reverse=True)[:20]:
    print(f"  {sz}: {cnt}")
