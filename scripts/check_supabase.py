import urllib.request
import urllib.error
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc4NzM4OSwiZXhwIjoyMTA0MzYzMzg5fQ.ZofYdxXjlxp6YJqfjORYZ2gaXMauippXohmaeT5VnE0"

print(f"Testing connection to Supabase: {SUPABASE_URL}")

# 1. Test GET /rest/v1/inspections with ANON_KEY
url = f"{SUPABASE_URL}/rest/v1/inspections?select=*"
req = urllib.request.Request(url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
})

try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode('utf-8')
        print(f"HTTP {resp.status} OK! Table exists!")
        print("Response body:", body)
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print(f"HTTP Error {e.code}: {e.reason}")
    print("Error body:", err_body)
except Exception as ex:
    print(f"Connection error: {ex}")
