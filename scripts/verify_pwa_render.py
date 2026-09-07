import asyncio
from playwright.async_api import async_playwright
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)
        
        url = "http://localhost:8080/index.html"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle")
        
        await page.wait_for_selector("#kpiTotal")
        total_text = await page.inner_text("#kpiTotal")
        not_started_text = await page.inner_text("#kpiNotStarted")
        print(f"HUD KPI Total: {total_text}, Not Started: {not_started_text}")
        
        os.makedirs("screenshots", exist_ok=True)
        await page.screenshot(path="screenshots/pwa_842_features_overview.png")
        print("Overview screenshot captured: screenshots/pwa_842_features_overview.png")
        
        # Test Filter: Riprap & Water Descents
        print("Testing slope_protection filter...")
        await page.select_option("#selectFilter", "slope_protection")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="screenshots/pwa_slope_protection_filter.png")
        print("Slope protection filter screenshot captured: screenshots/pwa_slope_protection_filter.png")
        
        # Check feature selection in drawer via window.selectAsset
        print("Selecting asset_265 (Crest Descent) via appState...")
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_265');
            if (feat && window.selectAsset) {
                window.selectAsset(feat);
            }
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path="screenshots/pwa_drawer_crest_descent.png")
        print("Crest descent drawer screenshot captured: screenshots/pwa_drawer_crest_descent.png")
        
        # Check Riprap selection
        print("Selecting asset_266 (Riprap SP-001)...")
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_266');
            if (feat && window.selectAsset) {
                window.selectAsset(feat);
            }
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path="screenshots/pwa_drawer_riprap.png")
        print("Riprap drawer screenshot captured: screenshots/pwa_drawer_riprap.png")

        # Check Water Descent selection
        print("Selecting asset_533 (Water Descent WD-001)...")
        await page.evaluate("""() => {
            const feat = window.appState.assetsData.features.find(f => f.properties.id === 'asset_533');
            if (feat && window.selectAsset) {
                window.selectAsset(feat);
            }
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path="screenshots/pwa_drawer_water_descent.png")
        print("Water descent drawer screenshot captured: screenshots/pwa_drawer_water_descent.png")

        print("\nConsole errors encountered:", len(errors))
        for err in errors:
            print("  ->", err)
            
        await browser.close()

asyncio.run(main())
