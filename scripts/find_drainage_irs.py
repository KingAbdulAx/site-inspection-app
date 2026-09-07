import openpyxl
import json
import re

wb_path = r"C:\Users\USER\Downloads\IR Registers\WSO-REG-COR-KMD-02-IRS-00 - Inspection Requests IN-OUT (S02,S03).xlsx"
print(f"Loading workbook: {wb_path}")

wb = openpyxl.load_workbook(wb_path, read_only=True, data_only=True)
sheet = wb["IR (0001-1000)"]

drainage_keywords = [
    "drain", "ditch", "culvert", "culv", "channel", "chute", "descent",
    "riprap", "rip-rap", "scour", "manhole", "inlet", "outlet", "headwall",
    "pipe", "box culvert", "pipe culvert", "toe ditch", "berm ditch", "crest"
]

all_sections = set()
all_work_types = set()
all_disciplines = set()
all_ir_statuses = set()

s03_rows = []
drainage_rows = []

row_idx = 0
for row in sheet.iter_rows(values_only=True):
    row_idx += 1
    if row_idx <= 10:
        continue
    
    # row index > 10 are data rows
    sn = row[0]
    section = str(row[4]).strip() if row[4] is not None else ""
    work_type = str(row[5]).strip() if row[5] is not None else ""
    prog_n = row[6]
    rev = row[7]
    ch_from = row[8]
    ch_to = row[9]
    str_type = str(row[10]).strip() if row[10] is not None else ""
    str_no = str(row[11]).strip() if row[11] is not None else ""
    discipline = str(row[12]).strip() if row[12] is not None else ""
    boq = str(row[13]).strip() if row[13] is not None else ""
    description = str(row[15]).strip() if row[15] is not None else ""
    department = str(row[16]).strip() if row[16] is not None else ""
    status = str(row[17]).strip() if row[17] is not None else ""
    receipt_date = str(row[18]) if row[18] is not None else ""
    response_date = str(row[21]) if row[21] is not None else ""
    remark = str(row[42]).strip() if len(row) > 42 and row[42] is not None else ""
    
    if section:
        all_sections.add(section)
    if work_type:
        all_work_types.add(work_type)
    if discipline:
        all_disciplines.add(discipline)
    if status:
        all_ir_statuses.add(status)
        
    full_text = f"{work_type} {str_type} {str_no} {discipline} {boq} {description} {remark}".lower()
    is_drainage = any(k in full_text for k in drainage_keywords)
    
    is_s03 = ("s03" in section.lower() or "s3" in section.lower() or "section 3" in section.lower() or "section 03" in section.lower())
    
    # Also check chainage: Section 3 is PK 82 to PK 110 approx (82000 to 110000)
    ch_num = None
    try:
        if ch_from is not None:
            ch_num = float(ch_from)
    except:
        pass
    
    if is_s03:
        s03_rows.append({
            "row": row_idx,
            "sn": sn,
            "section": section,
            "work_type": work_type,
            "prog_n": prog_n,
            "rev": rev,
            "ch_from": ch_from,
            "ch_to": ch_to,
            "str_type": str_type,
            "str_no": str_no,
            "discipline": discipline,
            "description": description,
            "status": status,
            "receipt_date": receipt_date,
            "response_date": response_date,
            "remark": remark,
            "is_drainage": is_drainage
        })
        
    if is_drainage:
        drainage_rows.append({
            "row": row_idx,
            "sn": sn,
            "section": section,
            "work_type": work_type,
            "prog_n": prog_n,
            "rev": rev,
            "ch_from": ch_from,
            "ch_to": ch_to,
            "str_type": str_type,
            "str_no": str_no,
            "discipline": discipline,
            "description": description,
            "status": status,
            "receipt_date": receipt_date,
            "response_date": response_date,
            "remark": remark,
            "is_s03": is_s03
        })

print(f"Total rows inspected: {row_idx}")
print(f"All Sections found: {all_sections}")
print(f"All Disciplines: {all_disciplines}")
print(f"All Work Types: {all_work_types}")
print(f"All Statuses: {all_ir_statuses}")
print(f"Total S03 rows: {len(s03_rows)}")
print(f"Total Drainage rows across workbook: {len(drainage_rows)}")

# S03 and drainage intersection:
s03_drainage = [r for r in s03_rows if r["is_drainage"]]
print(f"Total S03 DRAINAGE rows: {len(s03_drainage)}")

# Save s03_drainage to JSON for analysis
with open("s03_drainage_irs.json", "w", encoding="utf-8") as f:
    json.dump(s03_drainage, f, indent=2)

print("Saved s03_drainage_irs.json successfully.")
wb.close()
