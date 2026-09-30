"""
Read the ditch progress spreadsheets ('Ditch Progress - Type 1.xlsx', '... Type 9.xlsx')
into one JSON list: code, from/to chainage, side, executed metres, IRs, date.

    python3 scripts/progress/read_ditch_progress.py T1='Ditch Progress - Type 1.xlsx' T9='Ditch Progress - Type 9.xlsx' > ditch_rows.json
"""
import datetime
import json
import sys

import openpyxl

out = []
for arg in sys.argv[1:]:
    code, path = arg.split('=', 1)
    ws = openpyxl.load_workbook(path, data_only=True).active
    for r in list(ws.iter_rows(values_only=True))[1:]:
        if not r[2]:
            continue
        out.append(dict(code=code, date=r[1].strftime('%Y-%m-%d') if isinstance(r[1], datetime.datetime) else None,
                        a=str(r[2]), b=str(r[3]), total=r[4], side=r[5], executed=r[6], ir1=r[8], ir2=r[9], remark=r[10]))
json.dump(out, sys.stdout, indent=1)
