import json
import os

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_file = os.path.join(app_dir, 'data', 'section03_assets.json')

with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("ASSETS AROUND PK 88+276 (BC 88.3):")
for f in data['features']:
    p = f['properties']
    start_pk = p.get('start_pk', 0)
    end_pk = p.get('end_pk', 0)
    if (88.1 <= start_pk <= 88.5) or (88.1 <= end_pk <= 88.5):
        print(f"ID: {f['id']} | Cat: {p.get('category')} | Sub: {p.get('subtype')} | Side: {p.get('side')} | CH: {p.get('chainage_str')} | Specs: {p.get('specs')}")
