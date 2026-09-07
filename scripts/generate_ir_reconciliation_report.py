import json
import re

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = json.load(f)["features"]

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    all_s03_irs = json.load(f)

with open("culvert_milestones_detailed.json", "r", encoding="utf-8") as f:
    culvert_progress = json.load(f)

# Build lookup of assets
asset_lookup = {a["id"]: a for a in assets}

# Let's categorize all S03 drainage IRs into:
# 1. Culvert Works (Cross Drainage)
# 2. Longitudinal Ditches & French Drains (Underdrains)
# 3. Channels (Trapezoidal Channels Type A/B/C)
# 4. Stone Pitching / Riprap / Protection Works
# 5. Precast Yard Production (Kazaure Camp Site)
# 6. General Cut/Ditch Excavation (Topsoil/Earthworks)

categorized_irs = {
    "culvert_structures": [],
    "ditches_and_french_drains": [],
    "channels": [],
    "stone_pitching_riprap": [],
    "precast_camp_site": [],
    "general_earthworks": []
}

for r in all_s03_irs:
    desc = r.get("description", "")
    d_lower = desc.lower()
    ch_from = str(r.get("ch_from") or "").strip()
    loc_lower = ch_from.lower()
    
    # Check precast yard
    if "camp" in loc_lower or "camp" in d_lower or "workshop" in d_lower:
        categorized_irs["precast_camp_site"].append(r)
        continue
        
    # Check stone pitching / riprap
    if "stone pitching" in d_lower or "riprap" in d_lower or "rip-rap" in d_lower or "gabion" in d_lower:
        categorized_irs["stone_pitching_riprap"].append(r)
        continue
        
    # Check channels
    if "channel" in d_lower:
        categorized_irs["channels"].append(r)
        continue
        
    # Check ditches and french drains
    if "french drain" in d_lower or "platform ditch" in d_lower or "ditch type" in d_lower or "concrete_surround_ditch" in d_lower or "drainage channels & ditches" in d_lower or "drainage channels and ditches" in d_lower:
        categorized_irs["ditches_and_french_drains"].append(r)
        continue
        
    # Check culvert specific works
    if any(k in d_lower for k in ["culvert", "precast pipe", "hdpe pipe", "pipe haunch", "wingwall", "headwall", "apron", "soil exchange below culvert", "rockfill below culvert", "c30 concrete in box culvert", "c30/37 concrete in box culvert"]):
        categorized_irs["culvert_structures"].append(r)
        continue
        
    # Check if chainage points to a culvert structure
    if any(k in loc_lower for k in ["bc", "pc", "dk"]):
        if any(w in d_lower for w in ["compact existing ground below drains and culverts", "survey after", "blinding", "formwork", "concrete"]):
            categorized_irs["culvert_structures"].append(r)
            continue

    categorized_irs["general_earthworks"].append(r)

print("--- Categorization Summary of All 1,066 S03 IRs ---")
for cat, rlist in categorized_irs.items():
    approved = sum(1 for r in rlist if r.get("status") in ["APPROVED", "APPD AS NOTED"])
    rejected = sum(1 for r in rlist if r.get("status") == "REJECTED")
    pending = sum(1 for r in rlist if r.get("status") == "PENDING")
    print(f"  {cat:<28}: Total {len(rlist):<4} | Approved/AppdAsNoted: {approved:<4} | Rejected: {rejected:<3} | Pending: {pending:<3}")

with open("ir_categorized_summary.json", "w", encoding="utf-8") as f:
    json.dump({cat: len(rlist) for cat, rlist in categorized_irs.items()}, f, indent=2)

# Save details for report
with open("ir_categorized_details.json", "w", encoding="utf-8") as f:
    json.dump(categorized_irs, f, indent=2)

print("\nSaved ir_categorized_summary.json and ir_categorized_details.json")
