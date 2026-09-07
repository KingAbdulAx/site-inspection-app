import json

with open("culvert_ir_progress_table.json", "r", encoding="utf-8") as f:
    culverts = json.load(f)

print(f"Total culverts: {len(culverts)}")

# Generate markdown table
md_rows = []
md_rows.append("| Asset ID | Chainage | Typology | Progress Milestone | Latest Approved IR | Date | Scope Inspected & Approved |")
md_rows.append("|:---|:---|:---|:---:|:---:|:---:|:---|")

for c in culverts:
    aid = c["asset_id"]
    ch = c["chainage"]
    typ = c["typology"].split("(")[0].strip()
    m_stone = c["highest_milestone"]
    lat_ir = c.get("latest_ir") or {}
    ir_num = f"IR #{lat_ir.get('prog_n', 'N/A')}"
    ir_date = str(lat_ir.get("receipt_date", "N/A"))[:10]
    ir_desc = str(lat_ir.get("description", "N/A")).replace("\n", " ").strip()
    status = lat_ir.get("status", "")
    
    md_rows.append(f"| `{aid}` | **{ch}** | {typ} | **{m_stone}** | `{ir_num}` ({status}) | {ir_date} | {ir_desc} |")

with open("culvert_ir_markdown_table.md", "w", encoding="utf-8") as f:
    f.write("\n".join(md_rows))

print(f"Generated culvert_ir_markdown_table.md with {len(md_rows)} rows.")
