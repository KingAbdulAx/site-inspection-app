import openpyxl
import os

team_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
excel_path = os.path.join(team_dir, "Doc no. 1211", "_Analysis", "KZDR_S03_Drainage_Master_Dataset.xlsx")
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Ditch Segments']

print("ALL DITCH SEGMENTS IN EXCEL WITH 'Type 9' OR 'Half-round':")
for row in ws.iter_rows(values_only=True):
    row_str = " | ".join([str(c) for c in row if c is not None])
    if 'type 9' in row_str.lower() or 'half-round' in row_str.lower() or 'half round' in row_str.lower():
        print(row_str)
