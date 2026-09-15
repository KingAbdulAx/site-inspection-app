import json

with open('app/data/section03_assets.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("Checking Section 03 fields containing 'chute':")
for feat in d['features']:
    pr = feat['properties']
    for k, v in pr.items():
        if 'chute' in str(v).lower():
            print(f"ID: {pr.get('id')}, key: {k} -> {v}")
            break
    else:
        continue
    break

with open('app/data/section02_assets.json', 'r', encoding='utf-8') as f:
    d2 = json.load(f)

print("Checking Section 02 fields containing 'chute':")
for feat in d2['features']:
    pr = feat['properties']
    for k, v in pr.items():
        if 'chute' in str(v).lower():
            print(f"ID: {pr.get('id')}, key: {k} -> {v}")
            break
    else:
        continue
    break
