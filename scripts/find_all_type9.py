import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Searching for Type 9 in all 842 features...")
matches = []
for f in data['features']:
    p = f['properties']
    # Check all fields
    text = " ".join([str(v) for v in p.values()]).lower()
    if 'type 9' in text or 'type-9' in text or 'half-round' in text or 'half round' in text:
        matches.append(f)
        cat = str(p.get('category') or '')
        sub = str(p.get('subtype') or '')
        ch = str(p.get('chainage_str') or '')
        spk = str(p.get('start_pk') or '')
        epk = str(p.get('end_pk') or '')
        side = str(p.get('side') or '')
        print(f"ID: {f['id']:<10} | Cat: {cat:<20} | Sub: {sub:<15} | CH: {ch:<25} | PK: {spk}-{epk} | Side: {side}")

print(f"\nTotal matches: {len(matches)}")
