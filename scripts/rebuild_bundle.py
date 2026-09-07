import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/section03_centerline.json', 'r', encoding='utf-8') as f:
    centerline = json.load(f)

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    assets = json.load(f)

print(f"Rebuilding data/bundle.js with {len(assets['features'])} assets and {len(centerline['dense_points'])} centerline points...")

with open('data/bundle.js', 'w', encoding='utf-8') as f:
    f.write('window.SECTION03_CENTERLINE = ')
    json.dump(centerline, f, indent=2, ensure_ascii=False)
    f.write(';\n\nwindow.SECTION03_ASSETS = ')
    json.dump(assets, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print("data/bundle.js rebuilt successfully!")
