import json
import re

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

print(f"Total S03 drainage IRs: {len(irs)}")

# Look specifically for ditches, channels, chutes, riprap, descents
ditch_keywords = ["ditch", "channel", "chute", "descent", "riprap", "rip-rap", "gabion", "pitching", "drain"]
ditch_irs = []

for r in irs:
    desc = r.get("description", "").lower()
    ch_from = str(r.get("ch_from") or "").lower()
    disc = str(r.get("discipline") or "").lower()
    
    # Check if any ditch keywords are present
    matches = [k for k in ditch_keywords if k in desc or k in ch_from]
    if matches:
        ditch_irs.append((r, matches))

print(f"Total matching ditch/channel/etc: {len(ditch_irs)}")

# Group by the specific matched terms and descriptions
exclude_phrases = [
    "excavate any material except rock in cutting and side drains",
    "excavate and dispose unsuitable material under the bottom level of cutting and side drains",
    "excavate and disposed unsuitable material under bottom level of cutting and side drains",
    "compact existing ground below drains and culverts",
    "compacting of existing ground below drains and culverts"
]

actual_ditch_irs = []
for r, m in ditch_irs:
    desc = r.get("description", "").lower()
    if any(p in desc for p in exclude_phrases):
        continue
    actual_ditch_irs.append((r, m))

print(f"Actual specific ditch/channel/chute/riprap IRs: {len(actual_ditch_irs)}")

for r, m in actual_ditch_irs:
    print(f"IR #{r.get('prog_n')} | {r.get('status')} | Loc: {r.get('ch_from')} - {r.get('ch_to')} | Disc: {r.get('discipline')} | Date: {str(r.get('receipt_date'))[:10]}")
    print(f"   Desc: {r.get('description')}\n")
