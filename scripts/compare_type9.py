import json

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== ALL TYPE 9 / SHOULDER DITCHES BELOW PK 109 ===")
for f in data['features']:
    p = f['properties']
    cat = p.get('category')
    spk = p.get('start_pk', 0)
    if cat in ['Shoulder / Cascade', 'Berm Ditch'] and spk < 109000:
        print(f"{f['id']}: {p.get('chainage_str'):<22} | PK: {spk:8.1f}-{p.get('end_pk', 0):8.1f} | Side: {p.get('side')}")

print("\n=== ALL TYPE 9 / SHOULDER DITCHES AT OR ABOVE PK 109 ===")
for f in data['features']:
    p = f['properties']
    cat = p.get('category')
    spk = p.get('start_pk', 0)
    if cat in ['Shoulder / Cascade', 'Berm Ditch'] and spk >= 109000:
        print(f"{f['id']}: {p.get('chainage_str'):<22} | PK: {spk:8.1f}-{p.get('end_pk', 0):8.1f} | Side: {p.get('side')}")
