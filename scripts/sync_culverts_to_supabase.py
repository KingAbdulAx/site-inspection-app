import json
import urllib.request
import datetime

# Load all 80 culvert IDs
with open("all_section03_culvert_ids.json", "r", encoding="utf-8") as f:
    culvert_ids = json.load(f)

# Load culvert IR details
with open("culvert_milestones_detailed.json", "r", encoding="utf-8") as f:
    culvert_ir_data = json.load(f)

# Load assets
with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = {a["id"]: a for a in json.load(f)["features"]}

print(f"Total culvert IDs to update: {len(culvert_ids)}")

timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
inspection_date = datetime.date.today().isoformat()
records_to_push = []

for aid in culvert_ids:
    asset = assets[aid]
    p = asset["properties"]
    ch = p.get("chainage_str", "")
    typ = p.get("typology", "")
    
    # Check if IR data exists
    ir_info = culvert_ir_data.get(aid)
    if ir_info and ir_info.get("latest_ir"):
        lat_ir = ir_info["latest_ir"]
        ir_num = lat_ir.get("prog_n")
        ir_date = str(lat_ir.get("receipt_date"))[:10]
        ir_desc = lat_ir.get("description", "").strip()
        notes = f"Confirmed complete on site by Engr. Abdulaziz A. A. Official IR register verification: IR #{ir_num} ({lat_ir.get('status')}) on {ir_date}: {ir_desc}."
    else:
        notes = "Confirmed complete on site by Engr. Abdulaziz A. A."
        
    record = {
        "asset_id": aid,
        "status": "Completed & Approved",
        "notes": notes,
        "has_defect": False,
        "inspection_date": inspection_date,
        "inspected_by": "Engr. Abdulaziz A. A.",
        "device_id": "field-sync-py",
        "updated_at": timestamp
    }
    records_to_push.append(record)

print(f"Prepared {len(records_to_push)} inspection records.")
print("\nSample record:")
print(json.dumps(records_to_push[0], indent=2))

# Push to Supabase in batches of 40
SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

batch_size = 40
for i in range(0, len(records_to_push), batch_size):
    batch = records_to_push[i:i + batch_size]
    data = json.dumps(batch).encode("utf-8")
    
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/inspections",
        data=data,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
    )
    with urllib.request.urlopen(req) as resp:
        print(f"Batch {i//batch_size + 1} ({len(batch)} records) pushed: HTTP {resp.status}")

print("\nAll 80 culvert inspection records successfully synchronized to Supabase!")
