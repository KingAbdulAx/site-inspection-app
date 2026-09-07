import json
import math

with open('data/section03_centerline.json', 'r', encoding='utf-8') as f:
    centerline_data = json.load(f)

dense_points = centerline_data['dense_points']
pks = [p['pk'] for p in dense_points]

def get_track_point(target_pk):
    if target_pk <= pks[0]:
        return dense_points[0]['lon'], dense_points[0]['lat'], dense_points[0]['bearing']
    if target_pk >= pks[-1]:
        return dense_points[-1]['lon'], dense_points[-1]['lat'], dense_points[-1]['bearing']
    idx = 0
    while idx < len(pks) - 1 and pks[idx+1] < target_pk:
        idx += 1
    p1 = dense_points[idx]
    p2 = dense_points[idx+1]
    denom = p2['pk'] - p1['pk']
    frac = (target_pk - p1['pk']) / denom if denom > 0 else 0
    t_lon = p1['lon'] + frac * (p2['lon'] - p1['lon'])
    t_lat = p1['lat'] + frac * (p2['lat'] - p1['lat'])
    return t_lon, t_lat, p1['bearing']

def offset_point(lon, lat, bearing, dist_m):
    R = 6371000.0
    offset_bearing = (bearing + (90 if dist_m >= 0 else -90)) % 360
    d = abs(dist_m)
    phi1 = math.radians(lat)
    lam1 = math.radians(lon)
    brg = math.radians(offset_bearing)
    delta = d / R
    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(brg))
    lam2 = lam1 + math.atan2(math.sin(brg) * math.sin(delta) * math.cos(phi1), math.cos(delta) - math.sin(phi1) * math.sin(phi2))
    return math.degrees(lam2), math.degrees(phi2)

def regenerate_linestring(start_pk, end_pk, offset_dist):
    coords = []
    span_m = end_pk - start_pk
    steps = max(2, int(math.ceil(abs(span_m) / 25.0)))
    for s in range(steps + 1):
        cur_pk = start_pk + (s / steps) * span_m
        t_lon, t_lat, brg = get_track_point(cur_pk)
        p_off = offset_point(t_lon, t_lat, brg, offset_dist)
        coords.append([round(p_off[0], 7), round(p_off[1], 7)])
    return {
        'type': 'LineString',
        'coordinates': coords
    }

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    assets_data = json.load(f)

features = assets_data['features']
print(f'Starting features count in Phase 5: {len(features)}')

with open('data/field_data_snapshot.json', 'r', encoding='utf-8') as f:
    snapshot = json.load(f)

changelog_entries = []

# 1. Tighten asset_014
for feat in features:
    if feat['properties']['id'] == 'asset_014':
        p = feat['properties']
        p['chainage_str'] = 'PK 84+444 – PK 84+569'
        p['start_pk'] = 84444.0
        p['end_pk'] = 84569.0
        p['length_m'] = 125.0
        p['typology'] = 'Concrete Lined Crest Ditch (Type 11 / Type 5)'
        p['short_code'] = 'Type 11/5'
        p['drawing_ref'] = 'DW-03002-07 / MDDTDW220010001'
        p['specs'] = 'Concrete lined crest ditch (Type 11 / Type 5 per DW-03000-05) at cutting crest (H=0.50m, 1:1.5). Exact levels per DW-03002-07: falls at 0.30% from 462.88m (CH 84+444) to low point 462.66m (CH 84+519), then descends at 2.25% from 462.73m (CH 84+544) to outfall at 463.30m (CH 84+569).'
        feat['geometry'] = regenerate_linestring(84444.0, 84569.0, -22.0)
        changelog_entries.append(
            '| sset_014 | PK 84+444 – PK 84+569 | EDIT EXTENT | Crest Ditch (Row 13) | DW-03002-07 | Tightened extent from 84+406–84+620 to 84+444–84+569 (-89m). Geometry regenerated on Left (-22m). Quoted verbatim levels and 2.25% descent in specs. Initial field data intact. |'
        )

# 2. Flag asset_071 and asset_092
flag_updates = [
    ('asset_071', 'PK 89+700 – PK 89+980', 'DW-03006-05', 'Row 14', '[FLAG] Unsubstantiated by sheet DW-03006-05; no crest ditch drawn or annotated. Retained pending site verification.'),
    ('asset_092', 'PK 93+500 – PK 94+300', 'DW-03008-06', 'Row 15', '[FLAG] Unsubstantiated by sheet DW-03008-06; alignment intersects railway bridge BRG-2602 at CH 93+678–93+731 and no crest ditch exists on centerline. Retained pending site verification.')
]

for fid, ch_str, sheet_ref, reg_row, note_text in flag_updates:
    for feat in features:
        if feat['properties']['id'] == fid:
            curr_notes = feat['properties'].get('notes', '')
            if note_text not in curr_notes:
                feat['properties']['notes'] = (curr_notes + ' ' + note_text).strip()
            changelog_entries.append(
                f'| {fid} | {ch_str} | FLAG | Crest Ditch ({reg_row}) | {sheet_ref} | {note_text} Existing record retained. |'
            )

# Field data verification
for fid, s_data in snapshot.items():
    matching = [f for f in features if f['properties']['id'] == fid]
    assert len(matching) == 1, f'Missing feature {fid}'
    f_props = matching[0]['properties']
    assert f_props['status'] == s_data['status'], f'Status modified for {fid}'
    assert f_props['inspection_date'] == s_data['inspection_date'], f'Inspection date modified for {fid}'

print('Field data verification passed! 0 records lost or overwritten.')

with open('data/section03_assets.json', 'w', encoding='utf-8') as f:
    json.dump(assets_data, f, indent=2, ensure_ascii=False)

with open('CORRECTIONS_CHANGELOG.md', 'a', encoding='utf-8') as f:
    f.write('\n### Phase 5 — Crest Ditch Corrections (Crest Ditch Tab)\n\n')
    f.write('| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |\n')
    f.write('|:---|:---|:---|:---|:---|:---|\n')
    for line in changelog_entries:
        f.write(line + '\n')

print('Phase 5 completed and CORRECTIONS_CHANGELOG.md updated successfully.')
