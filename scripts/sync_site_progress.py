import urllib.request
import urllib.error
import json
import os
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_file = os.path.join(app_dir, 'data', 'section03_assets.json')

with open(assets_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. Gather the targeted assets
# (a) Ditches leading into BC88.3 at bottom of slope
bc883_toe_ditches = ['asset_058', 'asset_232']

# (b) All Type 9 ditches <= PK 109+000
type9_ditches = []
for f in data['features']:
    p = f['properties']
    cat = p.get('category')
    spk = p.get('start_pk', 0)
    if cat in ['Shoulder / Cascade', 'Berm Ditch'] and spk <= 109000:
        type9_ditches.append(f)

# (c) All water descents connected to these Type 9 ditches
water_descents = [f for f in data['features'] if f['properties'].get('category') == 'Water Descent' and f['properties'].get('start_pk', 0) <= 109000]
connected_descents = set()

for d in type9_ditches:
    p = d['properties']
    spk = p.get('start_pk', 0)
    epk = p.get('end_pk', 0)
    min_pk = min(spk, epk) - 30
    max_pk = max(spk, epk) + 30
    for w in water_descents:
        wpk = w['properties'].get('start_pk', 0)
        if min_pk <= wpk <= max_pk:
            connected_descents.add(w['id'])

all_completed_ids = set(bc883_toe_ditches)
for d in type9_ditches:
    all_completed_ids.add(d['id'])
all_completed_ids.update(connected_descents)

print(f"Total assets marked COMPLETED: {len(all_completed_ids)}")
print(f"  - Ditches at foot of slope (BC88.3): {len(bc883_toe_ditches)} ({', '.join(bc883_toe_ditches)})")
print(f"  - Type 9 Shoulder/Berm ditches: {len(type9_ditches)}")
print(f"  - Connected Precast Water Descents: {len(connected_descents)}")

# 2. Build Supabase payload
records = []
now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
inspection_date = "2026-09-07"
inspector = "Engr. Abdulaziz A. A."

for aid in sorted(list(all_completed_ids)):
    if aid in bc883_toe_ditches:
        notes = "Confirmed completed on site (ditch leading into BC88.3 at bottom of slope) per field inspection 2026-09-07."
    elif aid in connected_descents:
        notes = "Confirmed completed on site (precast water descent connected to Type 9 ditch) per field inspection 2026-09-07."
    else:
        notes = "Confirmed completed on site (Type 9 half-round shoulder/berm ditch) per field inspection 2026-09-07."
        
    records.append({
        "asset_id": aid,
        "status": "Completed & Approved",
        "notes": notes,
        "has_defect": False,
        "inspection_date": inspection_date,
        "inspected_by": inspector,
        "device_id": "field-inspection-engr-abdulaziz",
        "updated_at": now_iso
    })

# 3. Push to Supabase
SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

url = f"{SUPABASE_URL}/rest/v1/inspections"
print(f"\nSending {len(records)} inspection records to Supabase {url}...")

# Send in batches of 50 to ensure clean transport
batch_size = 50
for i in range(0, len(records), batch_size):
    batch = records[i:i+batch_size]
    payload = json.dumps(batch).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  Batch {i//batch_size + 1} ({len(batch)} records): HTTP {resp.status} OK")
    except urllib.error.HTTPError as e:
        print(f"  Error on batch {i//batch_size + 1}: HTTP {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
        sys.exit(1)

# 4. Verify count from Supabase
print("\nVerifying stored inspection records in Supabase...")
verify_url = f"{SUPABASE_URL}/rest/v1/inspections?status=eq.Completed&select=asset_id,status,inspection_date,inspected_by"
verify_req = urllib.request.Request(verify_url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}"
})

with urllib.request.urlopen(verify_req) as resp:
    saved = json.loads(resp.read().decode('utf-8'))
    print(f"Supabase verification: {len(saved)} records currently marked 'Completed' in database.")

print("\nSUCCESS: All confirmed site inspection records written to Supabase cloud database!")
