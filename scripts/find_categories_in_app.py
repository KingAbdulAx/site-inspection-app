import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if any(k in line for k in ["categoryColors", "getAssetColor", "getAssetIcon", "activeFilter", "renderFilter", "category"]):
        print(f"{idx+1}: {line.strip()[:100]}")
