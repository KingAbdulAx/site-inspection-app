import json
import os

app_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"

for fn in ["data/section02_assets.json", "data/section03_assets.json"]:
    fp = os.path.join(app_dir, fn)
    if not os.path.exists(fp):
        print(f"File not found: {fp}")
        continue
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"\n=== {fn} (Total: {len(data['features'])}) ===")
    typologies = {}
    categories = {}
    chutes = []
    ripraps = []
    dissipators = []
    channels = []
    
    for feat in data["features"]:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        cat = props.get("category")
        typ = props.get("typology")
        code = props.get("typology_code") or props.get("short_code")
        
        categories[cat] = categories.get(cat, 0) + 1
        typologies[str(code) + " | " + str(typ)] = typologies.get(str(code) + " | " + str(typ), 0) + 1
        
        text = f"{cat} {typ} {code} {props.get('name')} {props.get('id')}".lower()
        if "chute" in text or "descent" in text or "cascade" in text:
            chutes.append((props.get("id"), props.get("short_code"), props.get("typology"), props.get("is_point"), gtype, props.get("start_pk"), props.get("end_pk"), props.get("side")))
        if "riprap" in text or "rip" in text or "scour" in text:
            ripraps.append((props.get("id"), props.get("short_code"), props.get("typology"), props.get("is_point"), gtype, props.get("start_pk"), props.get("end_pk"), props.get("side"), geom.get("coordinates")[:2] if geom.get("coordinates") else None))
        if "dissipat" in text or "basin" in text or "sink" in text or "energy" in text:
            dissipators.append((props.get("id"), props.get("short_code"), props.get("typology"), props.get("is_point"), gtype, props.get("start_pk"), props.get("end_pk"), props.get("side"), geom.get("coordinates")[:2] if geom.get("coordinates") else None))
        if "channel" in text:
            channels.append((props.get("id"), props.get("short_code"), props.get("typology"), props.get("is_point"), gtype, props.get("start_pk"), props.get("end_pk"), props.get("side")))

    print(f"Categories: {categories}")
    print(f"\nAll Typologies found:")
    for k, v in sorted(typologies.items()):
        print(f"  {k}: {v}")
        
    print(f"\nSample Chutes ({len(chutes)}):", chutes[:5])
    print(f"\nSample Ripraps ({len(ripraps)}):", ripraps[:5])
    print(f"\nSample Dissipators ({len(dissipators)}):", dissipators[:5])
    print(f"\nSample Channels ({len(channels)}):", channels[:5])
