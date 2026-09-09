import fitz
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Let's inspect Section 03 drawing DW-03001-05 at PK 82+911 (where asset_533 is located)
s03_pdf = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc. No 1052\T2019-323-DD-KM-KZDR-2200-DW-03001-05.pdf"

if os.path.exists(s03_pdf):
    doc = fitz.open(s03_pdf)
    page = doc[0]
    drawings = page.get_drawings()
    print("=== INSPECTING S03 ASSET_533 (PK 82+911) SYMBOL IN CAD ===")
    
    # Let's look for elements around PK 82+911
    # On DW-03001, PK 82+902 is at start (left side of Strip 1, x ~ 200-400)
    for d in drawings:
        rect = d.get('rect')
        if 200 <= rect.x0 <= 500 and 200 <= rect.y0 <= 700:
            f = d.get('fill')
            c = d.get('color')
            # Check if blue
            is_blue = (f and len(f)==3 and f[0]<0.2 and f[2]>0.6) or (c and len(c)==3 and c[0]<0.2 and c[2]>0.6)
            if is_blue:
                items = d.get('items', [])
                if rect.width > 2 or rect.height > 2:
                    print(f"  Blue element: rect=({rect.x0:.1f}, {rect.y0:.1f}, w={rect.width:.1f}, h={rect.height:.1f}), fill={f}, color={c}, items={items}")
else:
    print(f"File not found: {s03_pdf}")
