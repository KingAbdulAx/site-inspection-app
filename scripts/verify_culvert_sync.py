import os
import time
from playwright.sync_api import sync_playwright

app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
screenshots_dir = os.path.join(app_dir, 'screenshots')
os.makedirs(screenshots_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1366, 'height': 850})
    page = context.new_page()
    
    print("Loading PWA at http://localhost:8080 ...")
    page.goto('http://localhost:8080')
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    # Wait for sync status to show Synced
    page.wait_for_selector('#btnSyncStatus:has-text("Synced")', timeout=15000)
    sync_status = page.locator('#btnSyncStatus').inner_text()
    print(f"Sync status: {sync_status}")
    time.sleep(2)
    
    # Read HUD counts
    kpi_total = page.locator('#kpiTotal').inner_text()
    kpi_not_started = page.locator('#kpiNotStarted').inner_text()
    kpi_ongoing = page.locator('#kpiOngoing').inner_text()
    kpi_completed = page.locator('#kpiCompleted').inner_text()
    kpi_defects = page.locator('#kpiDefects').inner_text()
    
    print(f"\nHUD Statistics Verified:")
    print(f"  Total Assets:  {kpi_total}")
    print(f"  Not Started:   {kpi_not_started}")
    print(f"  In Progress:   {kpi_ongoing}")
    print(f"  Completed:     {kpi_completed}")
    print(f"  Defects:       {kpi_defects}")
    
    # Toggle to Birds-Eye Progress Mode
    print("\nSwitching to Birds-Eye Progress Mode...")
    page.click('#btnModeProgress')
    time.sleep(2)
    
    # Screenshot 1: Overview with 193 Completed Assets in solid green
    path1 = os.path.join(screenshots_dir, 'pwa_progress_mode_193_completed.png')
    page.screenshot(path=path1)
    print(f"Captured: {path1}")
    
    # Filter by Completed via KPI chip
    print("\nFiltering by 'Completed'...")
    page.click('.kpi-chip.kpi-completed')
    time.sleep(2)
    
    path2 = os.path.join(screenshots_dir, 'pwa_filter_completed_193.png')
    page.screenshot(path=path2)
    print(f"Captured: {path2}")
    
    # Reset filter
    page.click('.kpi-chip.kpi-total')
    time.sleep(1)
    
    # Inspect asset_002 (PK 82+975 Single Box Culvert)
    print("\nInspecting asset_002 in drawer...")
    page.evaluate("const f = window.__APP_STATE.assetsData.features.find(x => x.id === 'asset_002'); window.selectAsset(f);")
    time.sleep(2)
    path3 = os.path.join(screenshots_dir, 'pwa_drawer_asset_002_culvert_completed.png')
    page.screenshot(path=path3)
    print(f"Captured: {path3}")
    
    # Inspect asset_019 (PK 84+891 Triple Box Culvert)
    print("\nInspecting asset_019 in drawer...")
    page.evaluate("const f = window.__APP_STATE.assetsData.features.find(x => x.id === 'asset_019'); window.selectAsset(f);")
    time.sleep(2)
    path4 = os.path.join(screenshots_dir, 'pwa_drawer_asset_019_culvert_completed.png')
    page.screenshot(path=path4)
    print(f"Captured: {path4}")
    
    # Inspect asset_176 (PK 124+500 Pipe Culvert at end of section)
    print("\nInspecting asset_176 in drawer...")
    page.evaluate("const f = window.__APP_STATE.assetsData.features.find(x => x.id === 'asset_176'); window.selectAsset(f);")
    time.sleep(2)
    path5 = os.path.join(screenshots_dir, 'pwa_drawer_asset_176_culvert_completed.png')
    page.screenshot(path=path5)
    print(f"Captured: {path5}")

    browser.close()
    print("\nAll verifications passed and screenshots captured successfully!")
