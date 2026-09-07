import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1211\_Analysis"

handoff = os.path.join(base_dir, "KZDR_App_Data_Handoff.html")
with open(handoff, "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, l in enumerate(lines):
        if "Water descents" in l:
            for j in range(max(0, idx - 5), min(len(lines), idx + 40)):
                print(f"Handoff {j}: {lines[j].strip()}")

report = os.path.join(base_dir, "KZDR_S03_Drainage_Analysis_Report.html")
if os.path.exists(report):
    with open(report, "r", encoding="utf-8") as f:
        rlines = f.readlines()
        for idx, l in enumerate(rlines):
            if "water descent" in l.lower() or "descent" in l.lower():
                print(f"Report {idx}: {rlines[idx].strip()[:140]}")
