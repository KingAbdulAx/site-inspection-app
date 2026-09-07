import urllib.request
import json

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/inspections?select=*&limit=3",
    headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
)

with urllib.request.urlopen(req) as resp:
    records = json.loads(resp.read().decode("utf-8"))

print("First record keys & sample in Supabase:")
if records:
    for k, v in records[0].items():
        print(f"  {k}: {v}")
