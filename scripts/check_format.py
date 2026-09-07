import json
import os

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for f in data['features']:
    ch = f['properties'].get('chainage_str', '')
    if '88+276' in ch or '88+2' in ch or '88+3' in ch:
        p = f['properties']
        print(f"{f['id']}: start_pk={p.get('start_pk')} ({type(p.get('start_pk'))}), end_pk={p.get('end_pk')}, ch={ch}, cat={p.get('category')}, side={p.get('side')}")
