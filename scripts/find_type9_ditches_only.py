import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Searching for Type 9 / Half-round / Shoulder in DITCH/CHANNEL features...")
matches = []
for f in data['features']:
    p = f['properties']
    cat = str(p.get('category') or '')
    if cat in ['Water Descent', 'Riprap Protection', 'Cross Drainage']:
        continue
    text = " ".join([str(v) for v in p.values()]).lower()
    if any(k in text for k in ['type 9', 'type-9', 'half-round', 'half round', 'shoulder']):
        matches.append(f)
        sub = str(p.get('subtype') or '')
        ch = str(p.get('chainage_str') or '')
        spk = float(p.get('start_pk') or 0)
        epk = float(p.get('end_pk') or 0)
        side = str(p.get('side') or '')
        specs = str(p.get('specs') or '')
        print(f"ID: {f['id']:<10} | Cat: {cat:<20} | CH: {ch:<25} | PK: {spk:8.1f}-{epk:8.1f} | Side: {side:<6} | Specs: {specs}")

print(f"\nTotal ditch/channel matches: {len(matches)}")
