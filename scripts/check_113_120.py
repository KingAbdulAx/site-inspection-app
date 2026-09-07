import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for f in data['features']:
    p = f['properties']
    cat = p.get('category')
    spk = p.get('start_pk', 0)
    if 113000 <= spk <= 120000:
        print(f"{f['id']}: {cat:<20} | {p.get('chainage_str'):<20} | PK: {spk} | Side: {p.get('side')}")
