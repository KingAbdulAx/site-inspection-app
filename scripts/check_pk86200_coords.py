import json

with open('app/data/section03_assets.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for feat in d['features']:
    if feat['properties']['id'] in ['asset_031', 'asset_033']:
        p = feat['properties']
        geom = feat['geometry']
        print(f"ID: {p['id']}, cat: {p['category']}, typ: {p['typology']}, coords count: {len(geom['coordinates'])}")
        print(f"  First coord: {geom['coordinates'][0]}")
        print(f"  Last coord: {geom['coordinates'][-1]}")
