import json

with open("culvert_milestones_detailed.json", "r", encoding="utf-8") as f:
    culverts = json.load(f)

# Sort culverts by start_pk
sorted_culverts = sorted(culverts.values(), key=lambda x: x["start_pk"])

print(f"Total Culverts with IR records: {len(sorted_culverts)}")
print("\nDetailed Culvert Progress Table from Official IR Register:")
print(f"{'Asset ID':<10} | {'Chainage':<12} | {'Typology':<36} | {'Highest Milestone':<15} | {'Latest Approved IR Date':<12} | {'Latest Approved IR Description'}")
print("-" * 130)

for c in sorted_culverts:
    aid = c["asset_id"]
    ch = c["chainage"]
    typ = c["typology"][:36]
    m_stone = c["highest_milestone"]
    lat_ir = c.get("latest_ir")
    ir_date = str(lat_ir.get("receipt_date", ""))[:10] if lat_ir else "N/A"
    ir_desc = (lat_ir.get("description", "")[:45] if lat_ir else "None")
    ir_num = (lat_ir.get("prog_n") if lat_ir else "")
    print(f"{aid:<10} | {ch:<12} | {typ:<36} | {m_stone:<15} | {ir_date:<12} | IR #{ir_num}: {ir_desc}")

# Save this summary to json
with open("culvert_ir_progress_table.json", "w", encoding="utf-8") as f:
    json.dump(sorted_culverts, f, indent=2)

print("\nSaved culvert_ir_progress_table.json successfully.")
