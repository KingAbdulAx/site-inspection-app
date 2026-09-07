import json
import os

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_file = os.path.join(app_dir, 'data', 'section03_assets.json')

with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total features: {len(data['features'])}")

# Check category counts
cats = {}
for feat in data['features']:
    c = feat['properties'].get('category', 'Unknown')
    cats[c] = cats.get(c, 0) + 1

print("\nAsset Category Distribution:")
for c, cnt in sorted(cats.items()):
    print(f"  {c}: {cnt}")

print("\n" + "="*80)
print("ASSETS AT BC 88.3 (PK 88+200 TO 88+500)")
print("="*80)
for feat in data['features']:
    p = feat['properties']
    start_pk = p.get('start_pk', 0)
    end_pk = p.get('end_pk', 0)
    ch = p.get('chainage_str', '')
    if (88.1 <= start_pk <= 88.5) or (88.1 <= end_pk <= 88.5):
        print(f"ID: {feat['id']}")
        print(f"  Name: {p.get('name')}")
        print(f"  Category: {p.get('category')} | Subtype: {p.get('subtype')}")
        print(f"  Chainage: {ch} (start_pk: {start_pk}, end_pk: {end_pk})")
        print(f"  Side: {p.get('side')} | Offset: {p.get('offset_m')}")
        print(f"  Specs: {p.get('specs')}")
        print(f"  Drawing: {p.get('drawing_ref')}")
        print(f"  Notes: {p.get('notes')}")
        print("-" * 60)

print("\n" + "="*80)
print("ALL 'Shoulder / Cascade' and 'Platform' and 'Half-Round' FEATURES:")
print("="*80)
for feat in data['features']:
    p = feat['properties']
    cat = p.get('category', '')
    sub = p.get('subtype', '')
    name = p.get('name', '')
    specs = p.get('specs', '')
    notes = p.get('notes', '')
    combined = f"{cat} {sub} {name} {specs} {notes}".lower()
    
    if any(k in combined for k in ['shoulder', 'cascade', 'type 9', 'half-round', 'half round', 'toe ditch']):
        start_pk = p.get('start_pk', 0)
        end_pk = p.get('end_pk', 0)
        print(f"ID: {feat['id']:<10} | Cat: {cat:<20} | Sub: {sub:<15} | PK: {start_pk:.3f}-{end_pk:.3f} | Side: {p.get('side'):<6} | CH: {p.get('chainage_str')}")
