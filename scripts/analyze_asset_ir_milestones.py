import json
import re

with open("culvert_ir_matches.json", "r", encoding="utf-8") as f:
    culvert_data = json.load(f)["culverts"]

# Define milestones hierarchy
# 0: Ground compaction / Excavation
# 1: Blinding / Soil exchange / Rockfill
# 2: Rebar / Reinforcement
# 3: Formwork / Shuttering
# 4: Concreting / Casting (haunch support, body, frame, wingwalls, headwalls)
# 5: Completed (Survey after casting / Backfilled / All elements cast)

def determine_milestone(ir_desc):
    d = ir_desc.lower()
    # Concreting / Casting
    if "survey after concrete casting" in d or "backfill" in d:
        return ("Completed", 5)
    if "concrete casting" in d or "casting (c" in d or "casting (20/25" in d or "place grade c" in d or "concreting" in d or "concrete (c30" in d:
        return ("Concreted", 4)
    if "formwork" in d or "mould" in d or "shutter" in d:
        return ("Shuttered", 3)
    if "rebar" in d or "reinforcement" in d:
        return ("Rebar", 2)
    if "blinding" in d or "soil exchange" in d or "rockfill" in d or "bedding" in d or "geotextile" in d:
        return ("Blinding", 1)
    if "excavat" in d or "compact" in d or "natural ground" in d:
        return ("Excavation", 0)
    return ("Unknown", -1)

asset_progress = {}

for aid, cinfo in culvert_data.items():
    irs = cinfo["irs"]
    # Sort IRs by date
    valid_irs = [r for r in irs if r.get("receipt_date")]
    valid_irs.sort(key=lambda x: str(x.get("receipt_date")))
    
    highest_stage = -1
    highest_milestone = "Not Started"
    latest_approved_ir = None
    all_stages = []
    
    for r in valid_irs:
        status = r.get("status")
        # Consider APPROVED or APPD AS NOTED
        is_approved = status in ["APPROVED", "APPD AS NOTED"]
        m_name, m_stage = determine_milestone(r.get("description", ""))
        
        all_stages.append({
            "prog_n": r.get("prog_n"),
            "status": status,
            "date": str(r.get("receipt_date"))[:10],
            "milestone": m_name,
            "stage_idx": m_stage,
            "desc": r.get("description"),
            "approved": is_approved
        })
        
        if is_approved and m_stage > highest_stage:
            highest_stage = m_stage
            highest_milestone = m_name
            latest_approved_ir = r
            
    asset_progress[aid] = {
        "asset_id": aid,
        "chainage": cinfo["chainage"],
        "start_pk": cinfo["start_pk"],
        "typology": cinfo["typology"],
        "total_irs": len(irs),
        "highest_milestone": highest_milestone,
        "highest_stage": highest_stage,
        "latest_ir": latest_approved_ir,
        "history": all_stages
    }

print(f"Total culverts analyzed: {len(asset_progress)}")

# Group by highest milestone
from collections import Counter
milestone_counts = Counter(p["highest_milestone"] for p in asset_progress.values())
print("\n--- Culvert Progress by Highest Milestone ---")
for m, count in milestone_counts.most_common():
    print(f"  {m:<20}: {count} culverts")

print("\n--- Culverts with 'Completed' or 'Concreted' ---")
concreted_or_done = [p for p in asset_progress.values() if p["highest_milestone"] in ["Completed", "Concreted"]]
for p in concreted_or_done:
    ir = p["latest_ir"]
    print(f"Asset: {p['asset_id']:<10} | CH: {p['chainage']:<12} | Typology: {p['typology'][:30]:<30} | Milestone: {p['highest_milestone']:<10} | IR #{ir['prog_n']} ({ir['status']}) [{str(ir['receipt_date'])[:10]}]: {ir['description'][:60]}")

print("\n--- Culverts with 'Rebar' or 'Shuttered' ---")
rebar_or_shutter = [p for p in asset_progress.values() if p["highest_milestone"] in ["Rebar", "Shuttered"]]
for p in rebar_or_shutter:
    ir = p["latest_ir"]
    print(f"Asset: {p['asset_id']:<10} | CH: {p['chainage']:<12} | Typology: {p['typology'][:30]:<30} | Milestone: {p['highest_milestone']:<10} | IR #{ir['prog_n']} ({ir['status']}) [{str(ir['receipt_date'])[:10]}]: {ir['description'][:60]}")

print("\n--- Culverts with 'Blinding' ---")
blinding = [p for p in asset_progress.values() if p["highest_milestone"] == "Blinding"]
for p in blinding:
    ir = p["latest_ir"]
    print(f"Asset: {p['asset_id']:<10} | CH: {p['chainage']:<12} | Typology: {p['typology'][:30]:<30} | Milestone: {p['highest_milestone']:<10} | IR #{ir['prog_n']} ({ir['status']}) [{str(ir['receipt_date'])[:10]}]: {ir['description'][:60]}")

print("\n--- Culverts with 'Excavation' only ---")
excav = [p for p in asset_progress.values() if p["highest_milestone"] == "Excavation"]
for p in excav:
    ir = p["latest_ir"]
    print(f"Asset: {p['asset_id']:<10} | CH: {p['chainage']:<12} | Typology: {p['typology'][:30]:<30} | Milestone: {p['highest_milestone']:<10} | IR #{ir['prog_n']} ({ir['status']}) [{str(ir['receipt_date'])[:10]}]: {ir['description'][:60]}")

with open("culvert_milestones_detailed.json", "w", encoding="utf-8") as f:
    json.dump(asset_progress, f, indent=2)

print("\nSaved culvert_milestones_detailed.json successfully.")
