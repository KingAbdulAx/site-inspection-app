import json

with open('app/data/section03_assets.json', 'r', encoding='utf-8') as f:
    s03 = json.load(f)

ditches = []
descents = []
for f in s03['features']:
    p = f['properties']
    cat = (p.get('category') or '').lower()
    typ = (p.get('typology') or '').lower()
    code = (p.get('typology_code') or p.get('short_code') or '').lower()
    
    # classify
    if cat == 'riprap protection' or 'riprap' in typ or code == 'riprap':
        kind = 'riprap'
    elif cat == 'water descent' or 'water descent' in typ or 'chute' in typ or code in ['desc', 'descent']:
        kind = 'waterDescent'
    elif cat == 'energy dissipator' or 'dissipator' in typ or code in ['bs1', 'bs2']:
        kind = 'dissipator'
    elif cat in ['diversion channel', 'open channel'] or 'channel' in typ or code.startswith('chan'):
        kind = 'channel'
    elif cat == 'cross drainage' or 'culvert' in typ or 'underpass' in typ or 'bridge' in typ or p.get('is_point'):
        kind = 'cross'
    else:
        kind = 'ditch'
        
    if kind == 'ditch':
        ditches.append(f)
    elif kind == 'waterDescent':
        descents.append(f)

print(f"Total ditches: {len(ditches)}, Total descents: {len(descents)}")

t9_ditches = []
for d in ditches:
    dp = d['properties']
    code = (dp.get('typology_code') or dp.get('short_code') or '').upper()
    typ = (dp.get('typology') or '').upper()
    if ('TYPE 9' in code or 'TYPE 9' in typ) and 'CHUTE' not in typ and 'DESCENT' not in typ:
        t9_ditches.append((dp['id'], dp.get('start_pk'), dp.get('end_pk'), dp.get('side'), typ))

print(f"Found {len(t9_ditches)} Type 9 ditches in ditches list:")
for item in t9_ditches[:10]:
    print(" ", item)

connected = 0
unconnected = 0
for wd in descents:
    p = wd['properties']
    pk = p.get('start_pk', 0)
    side = p.get('side', '')
    has_t9 = any(
        (t[3] == side or t[3] == 'Center' or side == 'Center') and (pk >= t[1] - 15 and pk <= t[2] + 15)
        for t in t9_ditches
    )
    if has_t9:
        connected += 1
    else:
        unconnected += 1

print(f"Connected to Type 9: {connected}, Unconnected: {unconnected}")
