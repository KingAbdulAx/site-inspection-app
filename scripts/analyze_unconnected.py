import json

with open('app/data/section03_assets.json', 'r', encoding='utf-8') as f:
    s03 = json.load(f)

t9_spans = []
t8_spans = []
all_ditches = []
for f in s03['features']:
    p = f['properties']
    typ = (p.get('typology') or '').upper()
    code = (p.get('short_code') or '').upper()
    cat = (p.get('category') or '').upper()
    if 'TYPE 9' in typ or 'TYPE 9' in code:
        if 'CHUTE' not in typ and 'DESCENT' not in typ:
            t9_spans.append((p.get('start_pk'), p.get('end_pk'), p.get('side'), p.get('id')))
    if 'TYPE 8' in typ or 'TYPE 8' in code:
        t8_spans.append((p.get('start_pk'), p.get('end_pk'), p.get('side'), p.get('id')))
    if 'DITCH' in cat or 'DITCH' in typ:
        all_ditches.append((p.get('start_pk'), p.get('end_pk'), p.get('side'), p.get('id'), p.get('typology')))

print(f"Total T9 spans: {len(t9_spans)}, Total T8 spans: {len(t8_spans)}, Total Ditch spans: {len(all_ditches)}")

unconnected_samples = []
for f in s03['features']:
    p = f['properties']
    if p.get('category') == 'Water Descent':
        pk = p.get('start_pk', 0)
        side = p.get('side', '')
        has_t9 = any((s[2] == side or s[2] == 'Center' or side == 'Center') and (pk >= s[0] - 15 and pk <= s[1] + 15) for s in t9_spans)
        has_t8 = any((s[2] == side or s[2] == 'Center' or side == 'Center') and (pk >= s[0] - 15 and pk <= s[1] + 15) for s in t8_spans)
        has_any_ditch = any((s[2] == side or s[2] == 'Center' or side == 'Center') and (pk >= s[0] - 15 and pk <= s[1] + 15) for s in all_ditches)
        if not has_t9:
            unconnected_samples.append((p.get('id'), pk, side, has_t8, has_any_ditch))

print(f"Total unconnected to T9: {len(unconnected_samples)}")
print("Has T8 instead:", sum(1 for x in unconnected_samples if x[3]))
print("Has any other ditch at that PK:", sum(1 for x in unconnected_samples if x[4]))
print("First 20 unconnected water descents:")
for u in unconnected_samples[:20]:
    print(" ", u)
