import json

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    s03 = json.load(f)

rips = [f for f in s03["features"] if f["properties"].get("category") == "Riprap Protection" or "Riprap" in f["properties"].get("typology", "")]
print(f"Total ripraps in S03: {len(rips)}")

has_len = 0
zero_len = 0
lengths = []

for r in rips:
    p = r["properties"]
    l = p.get("length_m", 0)
    if l > 0:
        has_len += 1
        lengths.append(l)
    else:
        zero_len += 1

print(f"With length > 0: {has_len}, with zero length: {zero_len}")
if lengths:
    print(f"Sample lengths: {lengths[:10]}")
