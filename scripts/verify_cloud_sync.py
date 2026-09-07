import asyncio
from playwright.async_api import async_playwright
import urllib.request
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://jefbmllqgxofppjqxmhy.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZmJtbGxxZ3hvZnBwanF4bWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODczODksImV4cCI6MjEwNDM2MzM4OX0.XcHjZVdGyuE5DUGOOxO6t2swLjBOD4hTEJ5yRlLVgSc"

def query_supabase(asset_id=None):
    url = f"{SUPABASE_URL}/rest/v1/inspections?select=*"
    if asset_id:
        url += f"&asset_id=eq.{asset_id}"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}"
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def upsert_supabase_direct(record):
    url = f"{SUPABASE_URL}/rest/v1/inspections"
    req = urllib.request.Request(url, data=json.dumps([record]).encode('utf-8'), headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

async def main():
    os.makedirs("screenshots", exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)
        
        url = "http://localhost:8080/index.html"
        print(f"1. Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_selector("#btnSyncStatus")
        
        # 1. Check Header Sync Pill
        sync_text = await page.inner_text("#syncText")
        print(f"Header Sync Pill initial text: '{sync_text}'")
        await page.screenshot(path="screenshots/pwa_cloud_sync_header.png")
        print("Captured: screenshots/pwa_cloud_sync_header.png")
        
        # 2. Test Cloud Settings Modal
        print("\n2. Opening Cloud Settings Modal...")
        await page.click("#btnCloudSettings")
        await page.wait_for_selector("#modalCloudSettings", state="visible")
        
        sb_url = await page.input_value("#cfgSupabaseUrl")
        insp_name = await page.input_value("#cfgInspectorName")
        dev_id = await page.inner_text("#cfgDeviceId")
        print(f"Modal prefilled: URL={sb_url}, Inspector={insp_name}, DeviceID={dev_id}")
        
        # Test Connection button in modal
        print("Testing connection via modal button...")
        await page.click("#btnTestCloudConn")
        await page.wait_for_selector("#toast", state="visible")
        toast_msg = await page.inner_text("#toast")
        print(f"Toast message on connection test: '{toast_msg}'")
        await page.screenshot(path="screenshots/pwa_cloud_settings_modal.png")
        print("Captured: screenshots/pwa_cloud_settings_modal.png")
        
        # Close modal
        await page.click("#btnCloseCloudSettings")
        await page.wait_for_selector("#modalCloudSettings", state="hidden")
        
        # 3. Field Save & Automatic Cloud Push Test
        print("\n3. Testing Field Inspection Save & Cloud Push on asset_014...")
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_014');
            window.selectAsset(feat);
        }""")
        await page.wait_for_timeout(500)
        
        # Select "Excavation" milestone
        await page.click("button.btn-milestone[data-status='Excavation']")
        await page.fill("#defectNotes", "Verified alignment cut crest excavation on Left side.")
        await page.check("#chkDefect")
        await page.click("#btnSaveInspection")
        await page.wait_for_timeout(2000) # wait for debounced sync push
        
        await page.screenshot(path="screenshots/pwa_saved_inspection_cloud_pushed.png")
        print("Captured: screenshots/pwa_saved_inspection_cloud_pushed.png")
        
        # Verify in Supabase directly
        print("Verifying asset_014 in Supabase directly...")
        records = query_supabase("asset_014")
        print(f"Supabase returned {len(records)} record(s) for asset_014:")
        if records:
            r = records[0]
            print(f"  -> status: {r.get('status')}")
            print(f"  -> notes: {r.get('notes')}")
            print(f"  -> has_defect: {r.get('has_defect')}")
            print(f"  -> inspected_by: {r.get('inspected_by')}")
            print(f"  -> updated_at: {r.get('updated_at')}")
            assert r.get('status') == 'Excavation'
            assert r.get('has_defect') == True
            print("  SUCCESS: Cloud record matches exact client save!")
        else:
            raise Exception("Record not found in Supabase!")
            
        # 4. Multi-Device Simulation: Remote Office Update & Local Pull
        print("\n4. Simulating Remote Office Update on asset_265 (Crest Descent)...")
        office_record = {
            "asset_id": "asset_265",
            "status": "Concreted",
            "notes": "Office QC sign-off: concrete drop descent poured and cured.",
            "has_defect": False,
            "inspection_date": "2026-09-07",
            "inspected_by": "Resident Engineer",
            "device_id": "office-workstation-cad",
            "updated_at": "2026-09-07T16:00:00.000Z"
        }
        upsert_supabase_direct(office_record)
        print("Remote record inserted into Supabase. Triggering syncNow() in client...")
        
        await page.evaluate("window.syncEngine.syncNow()")
        await page.wait_for_timeout(2000)
        
        # Select asset_265 and verify drawer shows remote update
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_265');
            window.selectAsset(feat);
        }""")
        await page.wait_for_timeout(500)
        
        local_asset_265 = await page.evaluate("window.appState.inspections['asset_265']")
        print("Client local state for asset_265 after pull:", local_asset_265)
        assert local_asset_265['status'] == 'Concreted'
        print("  SUCCESS: Client successfully pulled remote update (status: Concreted)!")
        await page.screenshot(path="screenshots/pwa_multi_device_cloud_pulled.png")
        print("Captured: screenshots/pwa_multi_device_cloud_pulled.png")

        # 5. Offline Priority Test
        print("\n5. Testing Offline Priority: Disconnecting network...")
        await context.set_offline(True)
        await page.wait_for_timeout(300)
        
        # Inspect and save asset_002 while offline
        print("Saving asset_002 while offline...")
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_002');
            window.selectAsset(feat);
        }""")
        await page.wait_for_timeout(300)
        await page.click("button.btn-milestone[data-status='Blinding']")
        await page.fill("#defectNotes", "Blinding concrete placed under box culvert 82.975 while offline in the bush.")
        await page.click("#btnSaveInspection")
        await page.wait_for_timeout(500)
        
        pending_count = await page.evaluate("window.syncEngine.getPendingCount()")
        print(f"Pending sync queue count while offline: {pending_count}")
        assert pending_count >= 1
        await page.screenshot(path="screenshots/pwa_offline_pending_sync.png")
        print("Captured: screenshots/pwa_offline_pending_sync.png")
        
        # Reconnect network
        print("Reconnecting network (Restoring online state)...")
        await context.set_offline(False)
        await page.wait_for_timeout(500)
        
        print("Triggering syncNow() post-reconnect...")
        await page.evaluate("window.syncEngine.syncNow()")
        await page.wait_for_timeout(2000)
        
        pending_count_after = await page.evaluate("window.syncEngine.getPendingCount()")
        print(f"Pending sync queue count after reconnect: {pending_count_after}")
        assert pending_count_after == 0
        
        # Verify asset_002 in Supabase
        records_002 = query_supabase("asset_002")
        print("Supabase verification for asset_002:", records_002[0] if records_002 else "None")
        assert records_002 and records_002[0]['status'] == 'Blinding'
        print("  SUCCESS: Offline changes pushed to Supabase upon reconnect!")
        await page.screenshot(path="screenshots/pwa_offline_reconnected_synced.png")
        print("Captured: screenshots/pwa_offline_reconnected_synced.png")
        
        # Clean up test rows from Supabase
        print("\n6. Cleaning up test records from Supabase...")
        for aid in ['asset_014', 'asset_265', 'asset_002']:
            del_url = f"{SUPABASE_URL}/rest/v1/inspections?asset_id=eq.{aid}"
            del_req = urllib.request.Request(del_url, headers={
                "apikey": ANON_KEY,
                "Authorization": f"Bearer {ANON_KEY}"
            }, method='DELETE')
            urllib.request.urlopen(del_req)
        print("Cleaned up test rows.")
        
        print("\nConsole errors encountered:", len(errors))
        for err in errors:
            print("  ->", err)
            
        await browser.close()
        print("\nALL OFFLINE-FIRST & CLOUD SYNC TESTS PASSED AT 100%!")

asyncio.run(main())
