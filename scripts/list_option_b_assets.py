import json
import os

assets_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'section03_assets.json')
with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find all Type 9 / Shoulder / Berm ditches with PK <= 109000
type9_ditches = []
for f in data['features']:
    p = f['properties']
    cat = p.get('category')
    spk = p.get('start_pk', 0)
    if cat in ['Shoulder / Cascade', 'Berm Ditch'] and spk <= 109000:
        type9_ditches.append(f)

# Sort by PK descending (from PK 109 down)
type9_ditches.sort(key=lambda x: x['properties'].get('start_pk', 0), reverse=True)

print(f"Total Type 9 / Shoulder / Berm ditches <= PK 109+000: {len(type9_ditches)}")
print("="*90)
print(f"{'ID':<12} | {'Chainage':<25} | {'Side':<6} | {'Length':<8} | {'Category':<18} | {'Specs'}")
print("="*90)

water_descents = [f for f in data['features'] if f['properties'].get('category') == 'Water Descent' and f['properties'].get('start_pk', 0) <= 109000]

total_connected_descents = set()

for d in type9_ditches:
    p = d['properties']
    spk = p.get('start_pk', 0)
    epk = p.get('end_pk', 0)
    side = p.get('side', '')
    specs = p.get('specs', '')[:40]
    
    # Find matching water descents: start_pk between spk-50 and epk+50
    # and either same side or side == 'Center' or within 20m of ditch
    min_pk = min(spk, epk) - 30
    max_pk = max(spk, epk) + 30
    matched_wd = [w for w in water_descents if min_pk <= w['properties'].get('start_pk', 0) <= max_pk]
    
    print(f"{d['id']:<12} | {p.get('chainage_str'):<25} | {side:<6} | {p.get('length_m', 0):<8} | {p.get('category'):<18} | {specs}")
    if matched_wd:
        print(f"   --> {len(matched_wd)} connected water descents: {', '.join([w['id'] for w in matched_wd])}")
        for w in matched_wd:
            total_connected_descents.add(w['id'])
    else:
        print("   --> 0 connected water descents")

print("="*90)
print(f"Total unique connected water descents: {len(total_connected_descents)}")
