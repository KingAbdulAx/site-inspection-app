import json
import os

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_file = os.path.join(app_dir, 'data', 'section03_assets.json')

with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("="*80)
print("1. DETAILS OF ASSETS AT BC 88.3 (PK 88+200 - 88+500)")
print("="*80)
for feat in data['features']:
    p = feat['properties']
    start_pk = p.get('start_pk', 0)
    end_pk = p.get('end_pk', 0)
    ch = p.get('chainage_str', '')
    if (88.1 <= start_pk <= 88.6) or (88.1 <= end_pk <= 88.6):
        cat = p.get('category', '')
        if cat in ['Toe Ditch', 'Cross Drainage', 'Miscellaneous', 'Shoulder / Cascade', 'Cutting Ditch']:
            print(f"ID: {feat['id']}")
            print(f"  Name: {p.get('name')}")
            print(f"  Category: {cat} | Subtype: {p.get('subtype')}")
            print(f"  Chainage: {ch} (start_pk: {start_pk}, end_pk: {end_pk})")
            print(f"  Side: {p.get('side')} | Offset: {p.get('offset_m')}")
            print(f"  Specs: {p.get('specs')}")
            print(f"  Drawing: {p.get('drawing_ref')}")
            print(f"  Notes: {p.get('notes')}")
            print()

print("="*80)
print("2. ALL DITCHES (NOT WATER DESCENT, NOT RIPRAP) WITH PK >= 108.0")
print("="*80)
for feat in data['features']:
    p = feat['properties']
    start_pk = p.get('start_pk', 0)
    end_pk = p.get('end_pk', 0)
    cat = p.get('category', '')
    if cat not in ['Water Descent', 'Riprap Protection', 'Cross Drainage']:
        # Note start_pk might be in km (e.g. 109.2) or meters (109200)
        pk_val = start_pk if start_pk < 1000 else start_pk / 1000.0
        if pk_val >= 108.0:
            print(f"ID: {feat['id']:<10} | Cat: {cat:<20} | Sub: {p.get('subtype', ''):<15} | PK: {pk_val:.3f} | Side: {p.get('side'):<6} | CH: {p.get('chainage_str')}")
            print(f"    Name: {p.get('name')}")
            print(f"    Specs: {p.get('specs')}")
            print(f"    Drawing: {p.get('drawing_ref')}")
