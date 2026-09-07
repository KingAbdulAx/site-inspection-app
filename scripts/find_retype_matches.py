import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/section03_assets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Let's inspect assets in the specific ranges
ranges = [
    ('Row 12: CH 85+640 to 120+450, Type 7 -> Type 12 (600m)', 85640, 120450, 'Type 7'),
    ('Row 13: CH 86+720 to 100+560, Type 12 -> Type 7 (520m)', 86720, 100560, 'Type 12'),
    ('Row 14: CH 89+770 to 90+200, Type 1 -> Type 12 (500m)', 89770, 90200, 'Type 1'),
    ('Row 15: CH 84+070 to 84+410, Type 1 -> Type 1L (360m)', 84070, 84410, 'Type 1'),
    ('Row 16: CH 85+810 to 87+110, Type 7 -> Type 1 (310m)', 85810, 87110, 'Type 7'),
    ('Row 17: CH 90+950 to 120+270, Type 7 -> Type 4 (230m)', 90950, 120270, 'Type 7'),
    ('Row 18: CH 87+020 to 87+100, Type 12 -> Type 1 (90m)', 87020, 87100, 'Type 12'),
    ('Row 19: CH 88+800 to 105+570, Type 4 -> Type 12 (40m)', 88800, 105570, 'Type 4'),
    ('Row 20: CH 120+280 to 120+280, Type 7 -> Type 12/Type 4 (10m)', 120280, 120280, 'Type 7'),
]

for label, s_pk, e_pk, target_type in ranges:
    print('=== ' + label + ' ===')
    for feat in data['features']:
        p = feat['properties']
        if not p.get('is_point', False) and target_type in p.get('typology', ''):
            if max(p['start_pk'], s_pk) <= min(p['end_pk'], e_pk):
                print('  ' + p['id'] + ': ' + p['chainage_str'] + ' (' + p['side'] + ') - ' + p['typology'])
