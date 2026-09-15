import json

with open('app/data/section03_assets.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("Features around PK 86+200 (85900 - 86500):")
for feat in d['features']:
    p = feat['properties']
    spk = p.get('start_pk', 0)
    epk = p.get('end_pk', spk)
    if spk <= 86500 and epk >= 85900:
        print(f"ID: {p.get('id')}, cat: {p.get('category')}, typ: {p.get('typology')}, sc: {p.get('short_code')}, code: {p.get('typology_code')}, pk: {spk}-{epk}, side: {p.get('side')}, is_point: {p.get('is_point')}")
