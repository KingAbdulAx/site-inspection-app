import json

with open("ir_categorized_details.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("==================================================")
print("1. DITCHES AND FRENCH DRAINS (22 IRs)")
print("==================================================")
for r in data["ditches_and_french_drains"]:
    ch = f"{r.get('ch_from')} - {r.get('ch_to')}" if r.get('ch_to') else str(r.get('ch_from'))
    print(f"IR #{r.get('prog_n'):<6} | {r.get('status'):<15} | Loc: {ch:<22} | Date: {str(r.get('receipt_date'))[:10]}")
    print(f"   Desc: {r.get('description')}\n")

print("==================================================")
print("2. CHANNELS (Sample first 25 of 95 IRs)")
print("==================================================")
for r in data["channels"][:25]:
    ch = f"{r.get('ch_from')} - {r.get('ch_to')}" if r.get('ch_to') else str(r.get('ch_from'))
    print(f"IR #{r.get('prog_n'):<6} | {r.get('status'):<15} | Loc: {ch:<22} | Date: {str(r.get('receipt_date'))[:10]}")
    print(f"   Desc: {r.get('description')}\n")

print("==================================================")
print("3. STONE PITCHING AND RIPRAP (20 IRs)")
print("==================================================")
for r in data["stone_pitching_riprap"]:
    ch = f"{r.get('ch_from')} - {r.get('ch_to')}" if r.get('ch_to') else str(r.get('ch_from'))
    print(f"IR #{r.get('prog_n'):<6} | {r.get('status'):<15} | Loc: {ch:<22} | Date: {str(r.get('receipt_date'))[:10]}")
    print(f"   Desc: {r.get('description')}\n")
