import json
import os

assets_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'section03_assets.json')
with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find all water descents with PK >= 109000
descents = [f for f in data['features'] if f['properties'].get('category') == 'Water Descent' and f['properties'].get('start_pk', 0) >= 109000]

print(f"Total water descents >= PK 109+000: {len(descents)}")

# Group them by location / proximity to the Type 9 ditches
type9_assets = [f for f in data['features'] if f['id'] in ['asset_137', 'asset_141', 'asset_149', 'asset_156', 'asset_161', 'asset_172', 'asset_175']]

for t in type9_assets:
    tp = t['properties']
    tspk = tp['start_pk']
    tepk = tp['end_pk']
    tside = tp['side']
    print(f"\nType 9 Ditch: {t['id']} | {tp['chainage_str']} ({tspk} - {tepk}) | Side: {tside}")
    
    # Matching descents: within [tspk - 50, tepk + 50]
    matched = [d for d in descents if (tspk - 50) <= d['properties']['start_pk'] <= (tepk + 50)]
    print(f"  Matches ({len(matched)}):")
    for m in matched:
        mp = m['properties']
        print(f"    {m['id']}: {mp['chainage_str']} | PK: {mp['start_pk']} | Side: {mp['side']}")

# Are there any water descents >= 109000 that do NOT match any of these?
all_matched_ids = set()
for t in type9_assets:
    tp = t['properties']
    matched = [d['id'] for d in descents if (tp['start_pk'] - 50) <= d['properties']['start_pk'] <= (tp['end_pk'] + 50)]
    all_matched_ids.update(matched)

unmatched = [d for d in descents if d['id'] not in all_matched_ids]
print(f"\nDescents >= PK 109+000 NOT within Type 9 ranges ({len(unmatched)}):")
for u in unmatched:
    up = u['properties']
    print(f"  {u['id']}: {up['chainage_str']} | PK: {up['start_pk']} | Side: {up['side']}")
