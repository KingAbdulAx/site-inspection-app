import sys
import os
import glob

sys.stdout.reconfigure(encoding='utf-8')

team_dir = r"C:\Users\USER\WORKSPACE\00_INBOX\000\TEAM"

# Search in python scripts, markdown, text, html in TEAM
patterns = ["*.py", "*.md", "*.txt", "*.html", "*.json"]
for root, dirs, files in os.walk(team_dir):
    # skip .git and node_modules
    if ".git" in root or "node_modules" in root:
        continue
    for f in files:
        if any(f.endswith(ext[1:]) for ext in patterns):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    if "water descent" in content.lower() or "310" in content:
                        for line in content.splitlines():
                            if "water descent" in line.lower() or ("310" in line and "descent" in line.lower()):
                                print(f"{os.path.relpath(path, team_dir)}: {line.strip()[:140]}")
            except Exception as e:
                pass
