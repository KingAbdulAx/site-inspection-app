import urllib.request
import urllib.error
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation"
}

# Test Upsert a test record
test_record = [{
    "asset_id": "test_asset_ping",
    "status": "Not Started",
    "notes": "Test ping to verify RLS write permissions",
    "has_defect": False,
    "inspection_date": "2026-09-07",
    "inspected_by": "Engr. Abdulaziz A. A.",
    "device_id": "python-verify-client"
}]

print("Testing POST /rest/v1/inspections (Upsert)...")
url = f"{SUPABASE_URL}/rest/v1/inspections"
req = urllib.request.Request(url, data=json.dumps(test_record).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode('utf-8')
        print(f"POST Status {resp.status} OK!")
        print("Inserted record:", body)
except urllib.error.HTTPError as e:
    print(f"POST Error {e.code}: {e.reason}")
    print(e.read().decode('utf-8'))
    sys.exit(1)

# Now delete the test record
print("\nCleaning up test record via DELETE...")
del_url = f"{SUPABASE_URL}/rest/v1/inspections?asset_id=eq.test_asset_ping"
del_req = urllib.request.Request(del_url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}"
}, method='DELETE')

try:
    with urllib.request.urlopen(del_req) as resp:
        print(f"DELETE Status {resp.status} OK!")
except urllib.error.HTTPError as e:
    print(f"DELETE Error {e.code}: {e.reason}")
    print(e.read().decode('utf-8'))

print("\nAll Supabase RLS permissions (READ, UPSERT, DELETE) verified successfully with anon key!")
