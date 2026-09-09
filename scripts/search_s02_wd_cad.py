import fitz
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DRAWINGS_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1084"

# Target RGB: (0.0, 0.647059, 0.866667)
print("=== SEARCHING SECTION 02 FOR WATER DESCENT CAD BLOCKS (RGB 0.0, 0.647, 0.867) ===")

plan_pdfs = sorted(glob.glob(os.path.join(DRAWINGS_DIR, "*DW-03*.pdf")))

total_wd_blocks = 0
sheets_with_wd = []

for p_pdf in plan_pdfs:
    fn = os.path.basename(p_pdf)
    doc = fitz.open(p_pdf)
    page = doc[0]
    drawings = page.get_drawings()
    
    count = 0
    for d in drawings:
        f = d.get('fill')
        c = d.get('color')
        # Check fill or color matching (0, 0.647, 0.867)
        matches_blue = False
        for col in [f, c]:
            if col and len(col) == 3:
                if abs(col[0] - 0.0) < 0.05 and abs(col[1] - 0.647) < 0.05 and abs(col[2] - 0.867) < 0.05:
                    matches_blue = True
                    break
        if matches_blue:
            r = d.get('rect')
            # Look for the chute main stem (h > 15 or w > 15)
            if r.height > 15 or r.width > 15:
                count += 1
                
    if count > 0:
        total_wd_blocks += count
        sheets_with_wd.append((fn, count))

print(f"Total Water Descent elements found across Section 02: {total_wd_blocks}")
print(f"Sheets with Water Descents ({len(sheets_with_wd)}):")
for s in sheets_with_wd:
    print(f"  {s[0]}: {s[1]} elements")
