import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

with open(os.path.join(DATA_DIR, 'section02_centerline.json'), 'r', encoding='utf-8') as f:
    centerline = json.load(f)

with open(os.path.join(DATA_DIR, 'section02_assets.json'), 'r', encoding='utf-8') as f:
    assets = json.load(f)

out_file = os.path.join(DATA_DIR, 'section02_bundle.js')
print(f"Building {out_file} with {len(assets['features'])} assets and {len(centerline['dense_points'])} centerline points...")

with open(out_file, 'w', encoding='utf-8') as f:
    f.write('window.SECTION02_CENTERLINE = ')
    json.dump(centerline, f, indent=2, ensure_ascii=False)
    f.write(';\n\nwindow.SECTION02_ASSETS = ')
    json.dump(assets, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print(f"{out_file} created successfully! Size: {os.path.getsize(out_file):,} bytes")
