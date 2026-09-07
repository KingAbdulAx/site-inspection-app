import shutil
import os

brain_dir = r"C:\Users\USER\.gemini\antigravity\brain\0f797080-f36a-492e-8690-cdaf16981958"
src_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\screenshots"

files = [
    "pwa_cloud_sync_header.png",
    "pwa_cloud_settings_modal.png",
    "pwa_saved_inspection_cloud_pushed.png",
    "pwa_multi_device_cloud_pulled.png",
    "pwa_offline_pending_sync.png",
    "pwa_offline_reconnected_synced.png"
]

for f in files:
    src = os.path.join(src_dir, f)
    dst = os.path.join(brain_dir, f)
    if os.path.exists(src):
        shutil.copyfile(src, dst)
        print(f"Copied {f} to brain directory.")
    else:
        print(f"Source file not found: {src}")
