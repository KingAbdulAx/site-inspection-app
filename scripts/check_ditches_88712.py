import json
import openpyxl
import os

print("=== CHECKING EXCEL FOR DITCHES NEAR 88+712 ===")
team_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
excel_path = os.path.join(team_dir, "Doc no. 1211", "_Analysis", "KZDR_S03_Drainage_Master_Dataset.xlsx")
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Ditch Segments']
for row in ws.iter_rows(values_only=True):
    row_str = " | ".join([str(c) for c in row if c is not None])
    if any(k in row_str for k in ['88+5', '88+6', '88+7', '88+8']):
        print(row_str)

print("\n=== CHECKING SECTION03_ASSETS.JSON FOR ASSETS NEAR 88+712 ===")
assets_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'section03_assets.json')
with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

for f in data['features']:
    p = f['properties']
    spk = p.get('start_pk', 0)
    epk = p.get('end_pk', 0)
    if (88500 <= spk <= 88900) or (88500 <= epk <= 88900):
        print(f"{f['id']}: {p.get('name')} | {p.get('category')} | {p.get('chainage_str')} | Side: {p.get('side')} | Specs: {p.get('specs')}")
