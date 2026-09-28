with open('preview.html', 'r', encoding='utf-8') as f:
    content = f.read()

if 'position_engine.js' not in content:
    target = '<script src="data_store.js"></script>'
    replacement = '<script src="data_store.js"></script>\n    <script src="data/kmd_alignment_stations_bundle.js"></script>\n    <script src="position_engine.js"></script>'
    content = content.replace(target, replacement)
    with open('preview.html', 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print("Added position_engine to preview.html")
else:
    print("Already contains position_engine.js")
