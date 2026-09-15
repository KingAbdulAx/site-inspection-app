import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
data_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app\data"

# 1. Standardize Section 03
s03_path = os.path.join(data_dir, "section03_assets.json")
with open(s03_path, "r", encoding="utf-8") as f:
    s03 = json.load(f)

print(f"Standardizing Section 03 ({len(s03['features'])} features)...")

for feat in s03["features"]:
    p = feat["properties"]
    cat = p.get("category", "")
    typ = p.get("typology", "")
    code = p.get("short_code", "")

    # Bridges & Grade Separation Structures (Must precede Riprap check)
    if cat == "Bridge Crossing" or "bridge" in cat.lower() or "brg" in typ.lower() or "brg" in p.get("position", "").lower() or p.get("typology_code") == "BRIDGE" or ("bridge" in typ.lower() and "ditch" not in typ.lower()):
        p["category"] = "Bridge Crossing"
        p["typology_code"] = "BRIDGE"
        p["short_code"] = "BRG-2601" if ("2601" in typ or "2601" in p.get("position", "") or "2601" in p.get("specs", "") or p.get("id") == "asset_046") else (p.get("short_code") or "Bridge")
        p["position"] = "Bridge BRG-2601 (PK 87+580)" if p["short_code"] == "BRG-2601" else p.get("position", "Bridge Crossing")
        p["typology"] = "Railway Bridge BRG-2601 Deck & Slope Armor" if p["short_code"] == "BRG-2601" else p.get("typology", "Railway Bridge Structure")
        p["color"] = "#0F172A"
        p["drawing_ref"] = "KZDRDW26011001 / KZDRDW22003004 (DW-03004)" if p["short_code"] == "BRG-2601" else p.get("drawing_ref", "KZDRDW26011001")
        p["specs"] = "Railway Bridge Structure BRG-2601 @ PK 87+580 (CH 87+496 – 87+663, L=167m). Deck scuppers Ø150mm + Pier & Heavy Riprap Slope Protection at Abutments A1/A2 per Drawing KZDRDW26011001 / KZDRDW22003004." if p["short_code"] == "BRG-2601" else p.get("specs", "")
        p["is_point"] = False

    # Water Descents
    elif cat == "Water Descent" or "Chute" in typ or "Descent" in typ:
        p["category"] = "Water Descent"
        p["typology"] = "Precast Water Descent (DW-10003)"
        p["short_code"] = "Descent"
        p["typology_code"] = "WATER_DESCENT"
        p["specs"] = "Precast stepped water descent down embankment slope connecting Type 9 shoulder ditch to Type 8 bench ditch or toe dissipator per Drawing T2019-323-DD-MD-MDDT-2200-DW-10003-04-A."

    # Riprap Scour Protection
    elif cat == "Riprap Protection" or "Riprap" in typ or code == "Riprap" or p.get("typology_code") == "RIPRAP":
        p["category"] = "Riprap Protection"
        p["typology"] = "Embankment Riprap Armor & Scour Protection"
        p["short_code"] = "Riprap"
        p["typology_code"] = "RIPRAP"
        p["is_point"] = False
        l = p.get("length_m", 0)
        if l <= 0:
            l = 28.0
            p["length_m"] = 28.0
        p["end_pk"] = p["start_pk"] + l
        km1 = int(p["start_pk"] // 1000)
        m1 = int(p["start_pk"] % 1000)
        km2 = int(p["end_pk"] // 1000)
        m2 = int(p["end_pk"] % 1000)
        p["chainage_str"] = f"PK {km1}+{m1:03d} – PK {km2}+{m2:03d}"
        p["position"] = "Embankment Toe & Slope Armor (Longitudinal)"
        p["specs"] = f"Embankment riprap armor & scour protection (MDDT DW-10004-02-A). Loose stone D50=100-200mm over separation geotextile, L={l:.1f}m."

    # Channels
    elif cat == "Diversion Channel" or "Channel" in typ or "Chan" in code or "Zone I" in typ or "Zone III" in typ:
        p["category"] = "Diversion Channel"
        p["typology_code"] = "CHANNEL"
        p["position"] = "Outer Diversion Corridor (Channel)"

    # Energy Dissipators
    elif cat == "Energy Dissipator" or "Dissipator" in typ:
        p["category"] = "Energy Dissipator"
        p["typology_code"] = "DISSIPATOR"
        p["is_point"] = True
        p["position"] = "Ditch / Channel Outfall Terminus"

with open(s03_path, "w", encoding="utf-8") as f:
    json.dump(s03, f, indent=2, ensure_ascii=False)
print("Section 03 standardized!")

# 2. Standardize Section 02
s02_path = os.path.join(data_dir, "section02_assets.json")
with open(s02_path, "r", encoding="utf-8") as f:
    s02 = json.load(f)

print(f"Standardizing Section 02 ({len(s02['features'])} features)...")

for feat in s02["features"]:
    p = feat["properties"]
    cat = p.get("category", "")
    typ = p.get("typology", "")
    code = p.get("short_code", "")

    # Water Descents
    if cat == "Water Descent" or "Chute" in typ or "Descent" in typ:
        p["category"] = "Water Descent"
        p["typology"] = "Precast Water Descent (DW-10003)"
        p["short_code"] = "Descent"
        p["typology_code"] = "WATER_DESCENT"
        p["specs"] = "Precast stepped water descent down embankment slope connecting Type 9 shoulder ditch to Type 8 bench ditch or toe dissipator per Drawing T2019-323-DD-MD-MDDT-2200-DW-10003-04-A."

    # Riprap Scour Protection
    elif cat == "Riprap Protection" or "Riprap" in typ or code == "Riprap" or p.get("typology_code") == "RIPRAP":
        p["category"] = "Riprap Protection"
        p["typology"] = "Embankment Riprap Armor & Scour Protection"
        p["short_code"] = "Riprap"
        p["typology_code"] = "RIPRAP"
        p["is_point"] = False
        l = p.get("length_m", 0)
        if l <= 0:
            l = 28.0
            p["length_m"] = 28.0
        p["end_pk"] = p["start_pk"] + l
        p["position"] = "Embankment Toe & Slope Armor (Longitudinal)"
        p["specs"] = f"Embankment riprap armor & scour protection (MDDT DW-10004-02-A). Loose stone D50=100-200mm over separation geotextile, L={l:.1f}m."

    # Channels
    elif cat == "Diversion Channel" or "Channel" in typ or "Chan" in code:
        p["category"] = "Diversion Channel"
        p["typology_code"] = "CHANNEL"
        p["position"] = "Outer Diversion Corridor (Channel)"

    # Energy Dissipators
    elif cat == "Energy Dissipator" or "Dissipator" in typ:
        p["category"] = "Energy Dissipator"
        p["typology_code"] = "DISSIPATOR"
        p["is_point"] = True
        p["position"] = "Ditch / Channel Outfall Terminus"

with open(s02_path, "w", encoding="utf-8") as f:
    json.dump(s02, f, indent=2, ensure_ascii=False)
print("Section 02 standardized!")

# 3. Rebuild JS bundles
print("Rebuilding JS bundles...")
with open(os.path.join(data_dir, 'section03_centerline.json'), 'r', encoding='utf-8') as f:
    cl03 = json.load(f)
with open(os.path.join(data_dir, 'bundle.js'), 'w', encoding='utf-8') as f:
    f.write('window.SECTION03_CENTERLINE = ')
    json.dump(cl03, f, indent=2, ensure_ascii=False)
    f.write(';\n\nwindow.SECTION03_ASSETS = ')
    json.dump(s03, f, indent=2, ensure_ascii=False)
    f.write(';\n')
print("bundle.js updated successfully!")

with open(os.path.join(data_dir, 'section02_centerline.json'), 'r', encoding='utf-8') as f:
    cl02 = json.load(f)
with open(os.path.join(data_dir, 'section02_bundle.js'), 'w', encoding='utf-8') as f:
    f.write('window.SECTION02_CENTERLINE = ')
    json.dump(cl02, f, indent=2, ensure_ascii=False)
    f.write(';\n\nwindow.SECTION02_ASSETS = ')
    json.dump(s02, f, indent=2, ensure_ascii=False)
    f.write(';\n')
print("section02_bundle.js updated successfully!")
