import json
import re

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

# Words indicating actual structural / drainage construction activity:
target_keywords = [
    "culvert", "box culvert", "pipe culvert", "precast", "blinding", "bedding",
    "rebar", "reinforcement", "formwork", "shutter", "concrete", "casting",
    "ditch", "channel", "chute", "descent", "riprap", "rip-rap", "gabion",
    "wingwall", "headwall", "apron", "inlet", "outlet", "manhole",
    "water descent", "cascade", "stone pitching", "mortar"
]

# Earthworks boq phrases to ignore unless specific drainage structure is named:
general_earthworks_phrases = [
    "excavate any material except rock in cutting and side drains",
    "excavate and dispose unsuitable material under the bottom level of cutting and side drains",
    "excavate and disposed unsuitable material under bottom level of cutting and side drains",
    "after topsoil removal",
    "survey after cutting",
    "check the girth and cutting of trees"
]

meaningful_irs = []
for r in irs:
    desc = r["description"].lower()
    ch_from = str(r.get("ch_from") or "").lower()
    ch_to = str(r.get("ch_to") or "").lower()
    combined = f"{desc} {ch_from} {ch_to}"
    
    # Check if it matches a target keyword
    has_target = any(k in combined for k in target_keywords)
    
    # Check if it's purely generic railway formation earthwork
    is_generic_cut = any(phrase in desc for phrase in general_earthworks_phrases)
    
    # If generic cut, only keep if it specifically mentions a structure or ditch
    if is_generic_cut:
        # Check if structure is specifically mentioned
        if not any(k in ch_from or k in desc for k in ["bc", "pc", "dk", "culvert", "ditch", "chute"]):
            continue
            
    if has_target:
        meaningful_irs.append(r)

print(f"Total Meaningful Drainage / Culvert IRs: {len(meaningful_irs)}")

# Group by status
from collections import Counter
status_counts = Counter(r["status"] for r in meaningful_irs)
print("\n--- Status Counts ---")
for s, c in status_counts.items():
    print(f"  {s}: {c}")

# Let's inspect unique locations and descriptions
print("\n--- Sample 50 Meaningful Drainage IRs ---")
for r in meaningful_irs[:50]:
    ch = f"{r['ch_from']} - {r['ch_to']}" if r['ch_to'] else str(r['ch_from'])
    print(f"IR #{r['prog_n']:<5} | {r['status']:<15} | CH/Loc: {ch:<24} | Date: {r['receipt_date'][:10]} | Desc: {r['description']}")

with open("meaningful_drainage_irs.json", "w", encoding="utf-8") as f:
    json.dump(meaningful_irs, f, indent=2)
print("\nSaved meaningful_drainage_irs.json")
