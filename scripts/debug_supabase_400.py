import json
import urllib.request
import urllib.error

with open("all_section03_culvert_ids.json", "r", encoding="utf-8") as f:
    culvert_ids = json.load(f)

with open("culvert_milestones_detailed.json", "r", encoding="utf-8") as f:
    culvert_ir_data = json.load(f)

with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets = {a["id"]: a for a in json.load(f)["features"]}

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

# Test a single record to inspect error
aid = culvert_ids[0]
record = [{
    "asset_id": aid,
    "status": "Completed & Approved",
    "notes": "Test notes",
    "defect_flag": False,
    "inspector": "Engr. Abdulaziz A. A.",
    "updated_at": "2026-09-07T16:28:00.000Z"
}]

data = json.dumps(record).encode("utf-8")

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

try:
    with urllib.request.urlopen(req) as resp:
        print("Success:", resp.status, resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print("Response Body:", e.read().decode("utf-8"))
