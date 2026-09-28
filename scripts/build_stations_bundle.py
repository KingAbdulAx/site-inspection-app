import json
import os

in_path = os.path.join('app', 'data', 'kmd_alignment_stations.json')
out_path = os.path.join('app', 'data', 'kmd_alignment_stations_bundle.js')

with open(in_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('// Auto-generated surveyed 500m station dataset for KMD Railway Linear Referencing Engine\n')
    f.write('window.KMD_ALIGNMENT_STATIONS = ')
    json.dump(data, f)
    f.write(';\n')

print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")
