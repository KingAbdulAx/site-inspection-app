import openpyxl
import os

team_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
excel_path = os.path.join(team_dir, "Doc no. 1211", "_Analysis", "KZDR_S03_Drainage_Master_Dataset.xlsx")
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Ditch Segments']

types = set()
for row in ws.iter_rows(values_only=True):
    if len(row) > 3 and row[2]:
        types.add(str(row[2]))

print("Distinct Ditch Types in Excel 'Ditch Segments':", sorted(list(types)))
