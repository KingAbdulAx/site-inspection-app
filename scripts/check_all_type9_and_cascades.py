import json

for sec in ['02', '03']:
    path = f'app/data/section{sec}_assets.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"=== SECTION {sec} ===")
    for feat in data['features']:
        p = feat['properties']
        typ = (p.get('typology') or '').lower()
        cat = (p.get('category') or '').lower()
        sc = (p.get('short_code') or '').lower()
        if any(w in typ or w in cat or w in sc for w in ['stepped', 'cascade', 'dissipator', 'type 9']):
            if p.get('length_m', 0) > 0 or feat.get('geometry', {}).get('type') == 'LineString':
                print(f"  {p.get('id')}: cat={p.get('category')}, typ={p.get('typology')}, sc={p.get('short_code')}, pk={p.get('start_pk')}-{p.get('end_pk')}, L={p.get('length_m')}, geom={feat.get('geometry',{}).get('type')}")
