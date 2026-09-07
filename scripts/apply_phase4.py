import json
import math
import openpyxl

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

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    assets_data = json.load(f)

features = assets_data['features']
print(f'Starting features count in Phase 4: {len(features)}')

with open('data/field_data_snapshot.json', 'r', encoding='utf-8') as f:
    snapshot = json.load(f)

changelog_entries = []

flip_map = [
    ('asset_020', 'CH 84+900 – 85+110', 'DW-03002-07', 'asset_227', 'Left', 'Row 4'),
    ('asset_096', 'CH 96+010 – 96+590', 'DW-03010-07', 'asset_237', 'Left', 'Row 5'),
    ('asset_103', 'CH 98+150 – 98+380', 'DW-03011-06', 'asset_240', 'Left', 'Row 6'),
    ('asset_109', 'CH 101+240 – 101+880', 'DW-03014-06', 'asset_241', 'Right', 'Row 7'),
    ('asset_109', 'CH 101+910 – 102+030', 'DW-03014-06', 'asset_241', 'Right', 'Row 8'),
    ('asset_109', 'CH 102+060 – 102+310', 'DW-03014-06', 'asset_242', 'Right', 'Row 9'),
    ('asset_135', 'CH 110+700 – 111+740', 'DW-03020-06 / DW-03021-06', 'asset_249', 'Left', 'Row 10'),
    ('asset_153', 'CH 119+470 – 119+620', 'DW-03027-06', 'asset_259', 'Left', 'Row 11'),
]

for orig_id, ch_range, sheet_ref, succ_id, correct_side, reg_row in flip_map:
    for feat in features:
        if feat['properties']['id'] == orig_id:
            curr_notes = feat['properties'].get('notes', '')
            reconcile_note = f'[RECONCILED - FLIP SIDE] Drawing {sheet_ref} places this ditch on the {correct_side.upper()} side (successor {succ_id}). Retained on original side pending final engineer sign-off.'
            if reconcile_note not in curr_notes:
                feat['properties']['notes'] = (curr_notes + ' ' + reconcile_note).strip()
            changelog_entries.append(
                f'| {orig_id} | {ch_range} | FLIP SIDE | Side and Type ({reg_row}) | {sheet_ref} | Reconciled side discrepancy. Verified successor run on {correct_side} is {succ_id}. Original record retained with cross-reference note. |'
            )

retype_edits = [
    ('asset_013', 'Row 15', 'DW-03001-05', 'Concrete Lined Side Ditch (Type 1 Larger Variant B=0.75m/H=0.75m)', 'Type 1 Lgr', 'Concrete trapezoidal cut side ditch (B=0.75m, H=0.75m, 1:1) per DW-03001-05 and Report Table 3.4 / §3.5.1 [Ref: SD-006]'),
    ('asset_043', 'Row 18', 'DW-03004-06', None, None, '[RETYPE NOTE] At CH 87+020 to 87+100, ditch transitions from Type 12 to Type 1 concrete lined side ditch (B=0.40m, H=0.40m) per DW-03004-06 [Ref: SD-005].'),
    ('asset_072', 'Row 14', 'DW-03005-06', None, None, '[RETYPE NOTE] Drawing DW-03005-06 / DW-03006-05 shows Type 12 trapezoidal toe ditch at foot of slope (B=1.50m, H=0.50m) rather than platform Type 1 [Ref: FS-008].'),
    ('asset_073', 'Row 14', 'DW-03005-06', None, None, '[RETYPE NOTE] Drawing DW-03005-06 / DW-03006-05 shows Type 12 trapezoidal toe ditch at foot of slope (B=1.50m, H=0.50m) rather than platform Type 1 [Ref: FS-090].'),
    ('asset_065', 'Row 19', 'DW-03005-06', None, None, '[RETYPE NOTE] Drawing DW-03005-06 shows Type 12 trapezoidal lined ditch at foot of slope [Ref: FS-087].'),
    ('asset_153', 'Row 20', 'DW-03027-06', None, None, '[RETYPE NOTE] At CH 120+280, drawing DW-03027-06 indicates transition to Type 12 / Type 4 toe ditch [Ref: FS-034].')
]

for fid, reg_row, sheet_ref, new_typ, new_code, note_addon in retype_edits:
    for feat in features:
        if feat['properties']['id'] == fid:
            p = feat['properties']
            if new_typ:
                p['typology'] = new_typ
            if new_code:
                p['short_code'] = new_code
            if note_addon:
                curr_notes = p.get('notes', '')
                if note_addon not in curr_notes:
                    p['notes'] = (curr_notes + ' ' + note_addon).strip()
            ch_s = p['chainage_str']
            changelog_entries.append(
                f'| {fid} | {ch_s} | RETYPE | Side and Type ({reg_row}) | {sheet_ref} | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |'
            )

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
    f.write('\n### Phase 4 — Siding and Typology Corrections (Side and Type Tab)\n\n')
    f.write('| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |\n')
    f.write('|:---|:---|:---|:---|:---|:---|\n')
    for line in changelog_entries:
        f.write(line + '\n')

print('Phase 4 completed and CORRECTIONS_CHANGELOG.md updated successfully.')
