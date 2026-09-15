import json

for sec in ['02', '03']:
    path = f'app/data/section{sec}_assets.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"=== Section {sec} (total {len(data['features'])}) ===")
    cats = {}
    typs = {}
    geom_types = {}
    chute_props = []
    riprap_props = []
    dissipator_props = []
    channel_props = []

    for feat in data['features']:
        pr = feat['properties']
        geom = feat.get('geometry') or {}
        gtype = geom.get('type')
        c = pr.get('category')
        t = pr.get('typology')
        code = pr.get('typology_code')
        sc = pr.get('short_code')
        cats[c] = cats.get(c, 0) + 1
        typs[t] = typs.get(t, 0) + 1
        geom_types[gtype] = geom_types.get(gtype, 0) + 1

        if any(w in str(x).lower() for x in [t, c, code, sc] for w in ['chute', 'descent']):
            chute_props.append((pr.get('id'), c, t, code, sc, gtype, pr.get('start_pk'), pr.get('end_pk'), pr.get('side')))
        if any(w in str(x).lower() for x in [t, c, code, sc] for w in ['riprap']):
            riprap_props.append((pr.get('id'), c, t, code, sc, gtype, pr.get('start_pk'), pr.get('end_pk'), pr.get('side'), pr.get('length_m')))
        if any(w in str(x).lower() for x in [t, c, code, sc] for w in ['dissipator']):
            dissipator_props.append((pr.get('id'), c, t, code, sc, gtype, pr.get('start_pk'), pr.get('side')))
        if any(w in str(x).lower() for x in [t, c, code, sc] for w in ['channel']):
            channel_props.append((pr.get('id'), c, t, code, sc, gtype, pr.get('start_pk'), pr.get('end_pk'), pr.get('side')))

    print("Categories:", cats)
    print("Geom types:", geom_types)
    print(f"Chutes / Descents count: {len(chute_props)}")
    if chute_props:
        print("Sample chutes:", chute_props[:5])
    print(f"Riprap count: {len(riprap_props)}")
    if riprap_props:
        print("Sample riprap:", riprap_props[:5])
    print(f"Dissipator count: {len(dissipator_props)}")
    if dissipator_props:
        print("Sample dissipator:", dissipator_props[:5])
    print(f"Channel count: {len(channel_props)}")
    if channel_props:
        print("Sample channel:", channel_props[:5])
