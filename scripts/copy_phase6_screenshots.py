import shutil
import os

brain_dir = r"C:\Users\USER\.gemini\antigravity\brain\0f797080-f36a-492e-8690-cdaf16981958"
src_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\screenshots"

files = [
    "pwa_842_features_overview.png",
    "pwa_slope_protection_filter.png",
    "pwa_drawer_crest_descent.png",
    "pwa_drawer_riprap.png",
    "pwa_drawer_water_descent.png"
]

for f in files:
    src = os.path.join(src_dir, f)
    dst = os.path.join(brain_dir, f)
    if os.path.exists(src):
        shutil.copyfile(src, dst)
        print(f"Copied {f} to brain directory.")
    else:
        print(f"Source file not found: {src}")
