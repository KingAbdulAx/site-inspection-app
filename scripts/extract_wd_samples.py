import sys
import os
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

html_path = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\kzdr-field\KZDR_Field.html"
with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()

# Find const FEATURES = {...}
match = re.search(r"const FEATURES\s*=\s*(\{.*?\});", text, re.DOTALL)
if match:
    data_str = match.group(1)
    print("Found FEATURES JSON string, length:", len(data_str))
    try:
        data = json.loads(data_str)
        print("Keys in FEATURES:", data.keys())
        features = data.get("features", [])
        print(f"Total features in FEATURES: {len(features)}")
        wd_features = [f for f in features if f.get("kind") == "water_descent" or f.get("type") == "water_descent" or "descent" in str(f).lower()]
        print(f"Water descent features count: {len(wd_features)}")
        if wd_features:
            print("First WD feature sample:", json.dumps(wd_features[0], indent=2))
            print("Second WD feature sample:", json.dumps(wd_features[1], indent=2))
            print("Last WD feature sample:", json.dumps(wd_features[-1], indent=2))
    except Exception as e:
        print("JSON parse error:", e)
else:
    print("Could not find const FEATURES = {...};")
