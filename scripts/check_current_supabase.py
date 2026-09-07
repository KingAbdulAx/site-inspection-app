import urllib.request
import json

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/inspections?select=*",
    headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
)

with urllib.request.urlopen(req) as resp:
    records = json.loads(resp.read().decode("utf-8"))

print(f"Total inspections in Supabase currently: {len(records)}")
from collections import Counter
st_counts = Counter(r.get("status") for r in records)
for st, cnt in st_counts.items():
    print(f"  {st}: {cnt}")
