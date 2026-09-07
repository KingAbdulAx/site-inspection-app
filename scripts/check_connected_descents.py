import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find all water descents and which ditches they overlap with
water_descents = [f for f in data['features'] if f['properties'].get('category') == 'Water Descent']
print(f"Total Water Descents: {len(water_descents)}")

# Check water descents from PK 109+000 onwards
wd_above_109 = [f for f in water_descents if f['properties'].get('start_pk', 0) >= 109000]
print(f"Water descents with PK >= 109+000: {len(wd_above_109)}")

# Check water descents below PK 109+000
wd_below_109 = [f for f in water_descents if f['properties'].get('start_pk', 0) < 109000]
print(f"Water descents with PK < 109+000: {len(wd_below_109)}")

# Let's inspect where the Type 9 ditches and their connected water descents are located above 109:
type9_above_109 = []
for f in data['features']:
    p = f['properties']
    cat = p.get('category', '')
    specs = p.get('specs', '')
    if cat in ['Shoulder / Cascade', 'Berm Ditch'] and p.get('start_pk', 0) >= 109000:
        type9_above_109.append(f)

print(f"\nType 9 ditches with PK >= 109+000: {len(type9_above_109)}")
for t in type9_above_109:
    p = t['properties']
    print(f"  {t['id']}: {p.get('chainage_str')} ({p.get('start_pk')}-{p.get('end_pk')}) | Side: {p.get('side')}")
    # Find matching water descents within this range on the same side
    matched_wd = [w for w in water_descents if p.get('start_pk') <= w['properties'].get('start_pk') <= p.get('end_pk') and (w['properties'].get('side') == p.get('side') or p.get('side') == 'Center')]
    print(f"    --> Connected Water Descents: {len(matched_wd)}")
    for m in matched_wd:
        print(f"        {m['id']}: {m['properties'].get('chainage_str')} | Side: {m['properties'].get('side')}")
