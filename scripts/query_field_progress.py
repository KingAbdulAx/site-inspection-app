import json
import os

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_file = os.path.join(app_dir, 'data', 'section03_assets.json')

with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total features loaded: {len(data['features'])}")

print("\n" + "="*80)
print("1. ASSETS AROUND BC 88.3 (PK 88+000 TO PK 88+600)")
print("="*80)
for feat in data['features']:
    p = feat['properties']
    ch = p.get('chainage_str', '')
    start_pk = p.get('start_pk', 0)
    end_pk = p.get('end_pk', 0)
    name = p.get('name', '')
    cat = p.get('category', '')
    sub = p.get('subtype', '')
    side = p.get('side', '')
    offset = p.get('offset_m', 0)
    
    if (88.1 <= start_pk <= 88.5) or (88.1 <= end_pk <= 88.5) or ('88+' in ch and ('88+2' in ch or '88+3' in ch or '88+4' in ch)):
        print(f"ID: {feat['id']:<10} | Name: {name:<20} | Cat: {cat:<20} | Sub: {sub:<25} | CH: {ch:<22} | Side: {side:<6} | Offset: {offset}")

print("\n" + "="*80)
print("2. ALL TYPE 9 DITCHES ACROSS SECTION 03")
print("="*80)
type9_features = []
for feat in data['features']:
    p = feat['properties']
    sub = str(p.get('subtype', '')).lower()
    name = str(p.get('name', '')).lower()
    spec = str(p.get('specs', '')).lower()
    
    if 'type 9' in sub or 'type 9' in name or 'type 9' in spec or 'type-9' in sub:
        type9_features.append(feat)
        print(f"ID: {feat['id']:<10} | Name: {p.get('name', ''):<25} | Cat: {p.get('category', ''):<18} | Sub: {p.get('subtype', ''):<20} | CH: {p.get('chainage_str', ''):<22} | PK: {p.get('start_pk'):.3f}-{p.get('end_pk'):.3f} | Side: {p.get('side')}")

print(f"\nTotal Type 9 ditches found: {len(type9_features)}")

print("\n" + "="*80)
print("3. WATER DESCENTS NEAR TYPE 9 DITCHES (PK 109+000 TO END / PK 124+521)")
print("="*80)
# Check water descents from PK 109 onwards, or around Type 9 ditches
descents = []
for feat in data['features']:
    p = feat['properties']
    cat = p.get('category', '')
    start_pk = p.get('start_pk', 0)
    if cat == 'Water Descent' and start_pk >= 108.0:
        descents.append(feat)

print(f"Found {len(descents)} water descents from PK 108+000 to PK 124+521")
for d in descents[:20]:
    p = d['properties']
    print(f"ID: {d['id']:<10} | Name: {p.get('name', ''):<20} | CH: {p.get('chainage_str', ''):<15} | PK: {p.get('start_pk'):.3f} | Side: {p.get('side'):<5} | Offset: {p.get('offset_m')}")
if len(descents) > 20:
    print(f"... and {len(descents) - 20} more water descents.")
