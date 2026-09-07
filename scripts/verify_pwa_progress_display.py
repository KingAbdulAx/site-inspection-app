import os
import time
from playwright.sync_api import sync_playwright

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
screenshots_dir = os.path.join(app_dir, 'screenshots')
os.makedirs(screenshots_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    
    print("Loading PWA at http://localhost:8080 ...")
    page.goto('http://localhost:8080')
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    # Wait for sync status to show Synced
    page.wait_for_selector('#btnSyncStatus:has-text("Synced")', timeout=10000)
    print("Sync status is Synced!")
    time.sleep(2)
    
    # Check HUD counts
    total_text = page.locator('#kpiTotal').inner_text()
    not_started = page.locator('#kpiNotStarted').inner_text()
    completed = page.locator('#kpiCompleted').inner_text()
    print(f"HUD KPIs -> Total: {total_text} | Not Started: {not_started} | Completed: {completed}")
    
    # Toggle to Progress Mode
    print("Toggling to Birds-Eye Progress Mode...")
    page.click('#btnModeProgress')
    time.sleep(2)
    
    # Capture map overview
    progress_map_png = os.path.join(screenshots_dir, 'pwa_progress_mode_113_completed.png')
    page.screenshot(path=progress_map_png)
    print(f"Captured: {progress_map_png}")
    
    # Filter by Completed
    print("Filtering by 'Completed'...")
    page.click('.kpi-chip.kpi-completed')
    time.sleep(2)
    
    filtered_completed_png = os.path.join(screenshots_dir, 'pwa_filter_completed_green.png')
    page.screenshot(path=filtered_completed_png)
    print(f"Captured: {filtered_completed_png}")
    
    # Select asset_058 (BC 88.3 toe ditch)
    print("Inspecting asset_058 in drawer...")
    page.evaluate("const f = window.__APP_STATE.assetsData.features.find(x => x.id === 'asset_058'); window.selectAsset(f);")
    time.sleep(2)
    
    drawer_bc883_png = os.path.join(screenshots_dir, 'pwa_drawer_asset_058_completed.png')
    page.screenshot(path=drawer_bc883_png)
    print(f"Captured: {drawer_bc883_png}")
    
    # Also select asset_057 (Type 9 ditch at PK 88+000 - 88+350)
    print("Inspecting asset_057 in drawer...")
    page.evaluate("const f = window.__APP_STATE.assetsData.features.find(x => x.id === 'asset_057'); window.selectAsset(f);")
    time.sleep(2)
    
    drawer_asset57_png = os.path.join(screenshots_dir, 'pwa_drawer_asset_057_type9_completed.png')
    page.screenshot(path=drawer_asset57_png)
    print(f"Captured: {drawer_asset57_png}")

    browser.close()
    print("Verification completed successfully!")
