import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

kf_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\kzdr-field"
print("kzdr-field exists?", os.path.exists(kf_dir))
if os.path.exists(kf_dir):
    print("Files in kzdr-field:", os.listdir(kf_dir))
    html_path = os.path.join(kf_dir, "KZDR_Field.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
            print(f"KZDR_Field.html size: {len(content)} chars")
            # check occurrences of water_descent
            count_wd = content.count("water_descent")
            print("Occurrences of 'water_descent':", count_wd)
