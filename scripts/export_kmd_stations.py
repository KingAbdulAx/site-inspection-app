import xml.etree.ElementTree as ET
import os
import re
import json

kml_path = os.path.join('KMZs KAMA', 'KMD.kml')
tree = ET.parse(kml_path)
root = tree.getroot()
ns = {'kml': 'http://www.opengis.net/kml/2.2'}

# 1. Mainline Kano-Maradi (TXT-KM)
txt_pms = []
for f in root.findall('.//kml:Folder', ns):
    n = f.find('kml:name', ns)
    if n is not None and n.text == 'TXT-KM':
        txt_pms.extend(f.findall('.//kml:Placemark', ns))

stations_km = []
for pm in txt_pms:
    name_el = pm.find('kml:name', ns)
    pt_el = pm.find('.//kml:coordinates', ns)
    if name_el is not None and pt_el is not None:
        name = name_el.text.strip()
        coords = [float(x) for x in pt_el.text.strip().split(',')[:2]]
        m = re.match(r'^(\d+)\+(\d{3})$', name)
        if m:
            pk = int(m.group(1)) * 1000 + int(m.group(2))
            stations_km.append({'pk': pk, 'label': f"PK {name}", 'lon': round(coords[0], 7), 'lat': round(coords[1], 7)})

stations_km.sort(key=lambda s: s['pk'])

# 2. Kano-Dutse Branch (R989)
r989_pms = []
for f in root.findall('.//kml:Folder', ns):
    n = f.find('kml:name', ns)
    if n is not None and n.text == 'R989':
        r989_pms.extend(f.findall('.//kml:Placemark', ns))

stations_kd = []
for pm in r989_pms:
    name_el = pm.find('kml:name', ns)
    pt_el = pm.find('.//kml:coordinates', ns)
    if name_el is not None and pt_el is not None:
        name = name_el.text.strip()
        coords = [float(x) for x in pt_el.text.strip().split(',')[:2]]
        m = re.match(r'^(\d+)\+(\d{3})$', name)
        if m:
            pk = int(m.group(1)) * 1000 + int(m.group(2))
            stations_kd.append({'pk': pk, 'label': f"PK {name}", 'lon': round(coords[0], 7), 'lat': round(coords[1], 7)})

stations_kd.sort(key=lambda s: s['pk'])

out_data = {
    'metadata': {
        'source': 'KMZs KAMA/KMD.kml',
        'generated_for': 'KMD Railway Drainage Inspector Linear Referencing Engine',
        'line_km_stations': len(stations_km),
        'line_kd_stations': len(stations_kd),
        'step_m': 500
    },
    'line_km': stations_km,
    'line_kd': stations_kd
}

out_path = os.path.join('app', 'data', 'kmd_alignment_stations.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out_data, f, indent=2)

print(f"Successfully saved {len(stations_km)} KM stations and {len(stations_kd)} KD stations to {out_path}")
