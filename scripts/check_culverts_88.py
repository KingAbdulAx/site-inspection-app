import openpyxl
import os

excel_path = os.path.abspath(r"Doc no. 1211\_Analysis\KZDR_S03_Drainage_Master_Dataset.xlsx")
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws = wb['Cross-Drainage']

for row in ws.iter_rows(values_only=True):
    row_str = " | ".join([str(c) for c in row if c is not None])
    if any(k in row_str for k in ['87+', '88+', '89+']):
        print(row_str)
