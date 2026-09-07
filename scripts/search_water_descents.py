import sys
import os
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\Doc no. 1211\_Analysis"

# Check Half Round Ditches in Master Dataset
wb = openpyxl.load_workbook(os.path.join(base_dir, "KZDR_S03_Drainage_Master_Dataset.xlsx"), data_only=True)
ws_hr = wb["Half Round Ditches"]
print(f"Half Round Ditches max_row={ws_hr.max_row}")
for r in range(1, 10):
    print(f"HR Row {r}:", [cell.value for cell in ws_hr[r]])

# Check evidence directory
ev_dir = os.path.join(base_dir, "evidence")
if os.path.exists(ev_dir):
    print("Files in evidence:", os.listdir(ev_dir))

# Check for "310" or "water descent" in AGENT_PROMPT
agent_prompt = os.path.join(base_dir, "AGENT_PROMPT_kzdr_app_corrections.md")
with open(agent_prompt, "r", encoding="utf-8") as f:
    text = f.read()
    for line in text.splitlines():
        if "310" in line or "descent" in line.lower() or "water descent" in line.lower():
            print("AGENT_PROMPT line:", line)

# Check KZDR_App_Data_Handoff.html
handoff = os.path.join(base_dir, "KZDR_App_Data_Handoff.html")
with open(handoff, "r", encoding="utf-8") as f:
    text = f.read()
    for line in text.splitlines():
        if "310" in line or "water descent" in line.lower():
            print("HANDOFF line:", line[:120])
