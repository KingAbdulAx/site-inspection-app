import json
import os

app_dir = r"c:\Users\USER\WORKSPACE\00_INBOX\000\TEAM\app"

def clean_section03():
    path = os.path.join(app_dir, "data", "section03_assets.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    modified_count = 0
    for feat in data["features"]:
        p = feat["properties"]
        
        # 1. Fix asset_018
        if p.get("id") == "asset_018":
            p["category"] = "Shoulder Ditch"
            p["typology"] = "Half-Round Platform Shoulder Ditch (Type 9)"
            p["short_code"] = "Type 9"
            p["typology_code"] = "TYPE_9"
            p["position"] = "Platform Shoulder"
            p["is_point"] = False
            p["color"] = "#38BDF8"
            p["specs"] = "Precast half-round ditch (D=0.30m, DW-10020) with stepped cascades along shoulder (L=360m)"
            feat["geometry"]["type"] = "LineString"
            modified_count += 1
            continue

        # 2. Standardize Shoulder / Cascade -> Shoulder Ditch
        if p.get("category") == "Shoulder / Cascade":
            p["category"] = "Shoulder Ditch"
            p["typology_code"] = "TYPE_9"
            modified_count += 1

        # 3. Clean Water Descent typology & position
        if p.get("category") == "Water Descent" or p.get("typology_code") == "WATER_DESCENT":
            p["category"] = "Water Descent"
            p["typology"] = "Precast Water Descent (DW-10003)"
            p["short_code"] = "Descent"
            p["typology_code"] = "WATER_DESCENT"
            pos = p.get("position", "")
            if "Chute" in pos or "Shoulder" in pos:
                p["position"] = "Embankment Slope Face (Water Descent)"
            p["specs"] = "Precast stepped water descent down embankment slope connecting Type 9 shoulder ditch / Type 8 bench ditch to toe dissipator per Drawing T2019-323-DD-MD-MDDT-2200-DW-10003-04-A."
            modified_count += 1

        # 4. Standardize Riprap typology code
        if p.get("category") == "Riprap Protection":
            p["typology_code"] = "RIPRAP"
            p["short_code"] = "Riprap"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Section 03 updated: {modified_count} features modified.")
    return data

def clean_section02():
    path = os.path.join(app_dir, "data", "section02_assets.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    modified_count = 0
    for feat in data["features"]:
        p = feat["properties"]

        # 1. Standardize Shoulder / Cascade -> Shoulder Ditch
        if p.get("category") == "Shoulder / Cascade":
            p["category"] = "Shoulder Ditch"
            p["typology_code"] = "TYPE_9"
            modified_count += 1

        # 2. Clean Water Descent typology & position
        if p.get("category") == "Water Descent" or p.get("typology_code") == "WATER_DESCENT":
            p["category"] = "Water Descent"
            p["typology"] = "Precast Water Descent (DW-10003)"
            p["short_code"] = "Descent"
            p["typology_code"] = "WATER_DESCENT"
            pos = p.get("position", "")
            if "Chute" in pos:
                p["position"] = pos.replace("(Shoulder Chute)", "(Water Descent)")
            p["specs"] = "Precast stepped water descent down embankment slope connecting Type 9 shoulder ditch / Type 8 bench ditch to toe dissipator per Drawing T2019-323-DD-MD-MDDT-2200-DW-10003-04-A."
            modified_count += 1

        # 3. Standardize Riprap typology code
        if p.get("category") == "Riprap Protection":
            p["typology_code"] = "RIPRAP"
            p["short_code"] = "Riprap"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Section 02 updated: {modified_count} features modified.")
    return data

def clean_section02_features():
    path = os.path.join(app_dir, "data", "section02_features.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        feats = data.get("features", []) if isinstance(data, dict) else data
        for feat in feats:
            if isinstance(feat, dict):
                p = feat.get("properties", feat)
                if p.get("typology") == "Precast Water Descent (Type 9 Chute)":
                    p["typology"] = "Precast Water Descent (DW-10003)"
                    p["short_code"] = "Descent"
                if p.get("category") == "Shoulder / Cascade":
                    p["category"] = "Shoulder Ditch"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print("section02_features.json updated.")

def rebuild_bundles(s03_data, s02_data):
    # Rebuild bundle.js
    bundle_path = os.path.join(app_dir, "data", "bundle.js")
    with open(os.path.join(app_dir, "data", "section03_centerline.json"), "r", encoding="utf-8") as f:
        cl03 = json.load(f)
    
    with open(bundle_path, "w", encoding="utf-8") as f:
        f.write("// Bundled Data for Section 03\n")
        f.write("window.SECTION03_CENTERLINE = ")
        json.dump(cl03, f)
        f.write(";\n\n")
        f.write("window.SECTION03_ASSETS = ")
        json.dump(s03_data, f)
        f.write(";\n")
    print("bundle.js rebuilt.")

    # Rebuild section02_bundle.js
    s02_bundle_path = os.path.join(app_dir, "data", "section02_bundle.js")
    with open(os.path.join(app_dir, "data", "section02_centerline.json"), "r", encoding="utf-8") as f:
        cl02 = json.load(f)
    with open(os.path.join(app_dir, "data", "section02_drawing_register.json"), "r", encoding="utf-8") as f:
        dr02 = json.load(f)

    with open(s02_bundle_path, "w", encoding="utf-8") as f:
        f.write("// Bundled Data for Section 02 (DWKZ)\n")
        f.write("window.SECTION02_CENTERLINE = ")
        json.dump(cl02, f)
        f.write(";\n\n")
        f.write("window.SECTION02_ASSETS = ")
        json.dump(s02_data, f)
        f.write(";\n\n")
        f.write("window.SECTION02_DRAWING_REGISTER = ")
        json.dump(dr02, f)
        f.write(";\n")
    print("section02_bundle.js rebuilt.")

if __name__ == "__main__":
    s03 = clean_section03()
    s02 = clean_section02()
    clean_section02_features()
    rebuild_bundles(s03, s02)
    print("All datasets cleaned and bundles rebuilt.")
