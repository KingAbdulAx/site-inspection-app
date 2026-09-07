import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for f in data['features']:
    if f['id'] in ['asset_055', 'asset_058', 'asset_059', 'asset_060', 'asset_061']:
        print(f"{f['id']}: {f['properties']}")
