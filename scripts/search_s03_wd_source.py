import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

search_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM"

def search_text(term):
    print(f"=== Searching for '{term}' ===")
    for root, dirs, files in os.walk(search_dir):
        if '.git' in root or 'node_modules' in root or '__pycache__' in root:
            continue
        for fn in files:
            if fn.endswith('.py') or fn.endswith('.js') or fn.endswith('.md') or fn.endswith('.txt') or fn.endswith('.json'):
                fp = os.path.join(root, fn)
                try:
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if term in content:
                            print(f"Found in: {os.path.relpath(fp, search_dir)}")
                except:
                    pass

search_text("solid-blue")
search_text("asset_533")
search_text("Type 9 Chute")
