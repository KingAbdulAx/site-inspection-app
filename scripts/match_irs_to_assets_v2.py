import json
import re

# Load assets
with open("data/section03_assets.json", "r", encoding="utf-8") as f:
    assets_data = json.load(f)

assets = assets_data["features"]
print(f"Total PWA Assets loaded: {len(assets)}")

# Load meaningful IRs
with open("meaningful_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

print(f"Total meaningful IRs loaded: {len(irs)}")

# Helper to normalize chainage from string
def parse_chainage(s):
    if not s:
        return None
    s = str(s).strip().upper()
    # Try direct numeric
    try:
        val = float(s)
        return int(val)
    except:
        pass
    m = re.search(r'(?:DK|PK|CH)?\s*(\d+)\+(\d+)', s)
    if m:
        km = int(m.group(1))
        m_val = int(m.group(2))
        return km * 1000 + m_val
    m_num = re.search(r'(\d{5,6})', s)
    if m_num:
        return int(m_num.group(1))
    return None

def normalize_tag(s):
    if not s:
        return ""
    # strip spaces, dots, upper
    return re.sub(r'[^A-Z0-9]', '', str(s).upper())

# Index assets
asset_by_tag = {}
culvert_assets_by_pk = {}
all_assets_by_pk_range = []

for a in assets:
    p = a["properties"]
    aid = a["id"]
    typology = p.get("typology") or ""
    ch_str = p.get("chainage_str") or ""
    start_pk = p.get("start_pk")
    end_pk = p.get("end_pk")
    
    # Check for BC / PC tag in typology
    # e.g. "(BC 82.975)", "(PC 88.1)", "BC88.3"
    m_tag = re.search(r'([BP]C\s*\d+(?:\.\d+)?)', typology)
    if m_tag:
        tag_norm = normalize_tag(m_tag.group(1))
        asset_by_tag[tag_norm] = a
        
    # Also tag from chainage_str if DK / PK
    m_dk = re.search(r'([BP]C\s*\d+(?:\.\d+)?)', ch_str)
    if m_dk:
        tag_norm = normalize_tag(m_dk.group(1))
        asset_by_tag[tag_norm] = a

    if start_pk is not None:
        spk = int(round(start_pk))
        epk = int(round(end_pk)) if end_pk is not None else spk
        if p.get("category") == "Cross Drainage" or p.get("is_point"):
            culvert_assets_by_pk[spk] = a
        all_assets_by_pk_range.append((min(spk, epk), max(spk, epk), a))

print(f"Indexed {len(asset_by_tag)} assets by structure tag (e.g. BC88.3, PC88.1): {list(asset_by_tag.keys())[:15]}")
print(f"Indexed {len(culvert_assets_by_pk)} culvert assets by exact PK meter")

# Map IRs to assets
ir_matches = []
unmatched_irs = []

for r in irs:
    ch_from = str(r.get("ch_from") or "").strip()
    ch_to = str(r.get("ch_to") or "").strip()
    desc = r.get("description") or ""
    
    # Extract tags from ch_from, ch_to, desc
    m_tag1 = re.search(r'([BP]C\s*\d+(?:\.\d+)?)', ch_from, re.I)
    m_tag2 = re.search(r'([BP]C\s*\d+(?:\.\d+)?)', desc, re.I)
    
    tag = None
    if m_tag1:
        tag = normalize_tag(m_tag1.group(1))
    elif m_tag2:
        tag = normalize_tag(m_tag2.group(1))
        
    ch_val = parse_chainage(ch_from)
    
    matched_asset = None
    match_reason = None
    
    if tag and tag in asset_by_tag:
        matched_asset = asset_by_tag[tag]
        match_reason = f"Tag: {tag}"
    elif ch_val and ch_val in culvert_assets_by_pk:
        matched_asset = culvert_assets_by_pk[ch_val]
        match_reason = f"Exact Culvert PK: {ch_val}"
    elif ch_val:
        # Search nearby (+- 30m) for culverts
        for d in range(-30, 31):
            if (ch_val + d) in culvert_assets_by_pk:
                matched_asset = culvert_assets_by_pk[ch_val + d]
                match_reason = f"Nearby Culvert PK: {ch_val} vs {ch_val + d}"
                break
        # If still not found, search if within linear asset range
        if not matched_asset:
            for s, e, a in all_assets_by_pk_range:
                if s <= ch_val <= e:
                    matched_asset = a
                    match_reason = f"Within Line Range: PK {ch_val} in [{s}, {e}]"
                    break
                    
    if matched_asset:
        ir_matches.append({
            "ir": r,
            "asset_id": matched_asset["id"],
            "asset_props": matched_asset["properties"],
            "match_reason": match_reason
        })
    else:
        unmatched_irs.append(r)

print(f"\n--- MATCH RESULTS ---")
print(f"Total matched IRs: {len(ir_matches)}")
print(f"Total unmatched IRs: {len(unmatched_irs)}")

# Unique assets matched
matched_asset_ids = set(m["asset_id"] for m in ir_matches)
print(f"Unique assets matched: {len(matched_asset_ids)}")

# Group by asset
asset_ir_summary = {}
for m in ir_matches:
    aid = m["asset_id"]
    asset_ir_summary.setdefault(aid, []).append(m)

# Print culverts specifically
print("\n--- Cross Drainage Culverts with IRs ---")
culvert_matches = {}
for aid, matches in asset_ir_summary.items():
    props = matches[0]["asset_props"]
    if props.get("category") == "Cross Drainage" or "culvert" in props.get("typology", "").lower():
        culvert_matches[aid] = matches
        print(f"\nCulvert Asset: {aid} | {props.get('chainage_str')} | Typology: {props.get('typology')}")
        print(f"  Match Reason: {matches[0]['match_reason']}")
        print(f"  Total IRs: {len(matches)}")
        for m in matches:
            r = m["ir"]
            print(f"    - IR #{r['prog_n']:<5} | {r['status']:<15} | Date: {r['receipt_date'][:10]} | Desc: {r['description'][:75]}")

print(f"\nTotal Culvert Assets with IRs: {len(culvert_matches)}")

# Save matched summary
with open("culvert_ir_matches.json", "w", encoding="utf-8") as f:
    json.dump({
        "culverts_count": len(culvert_matches),
        "culverts": {
            aid: {
                "asset_id": aid,
                "chainage": matches[0]["asset_props"].get("chainage_str"),
                "start_pk": matches[0]["asset_props"].get("start_pk"),
                "typology": matches[0]["asset_props"].get("typology"),
                "irs_count": len(matches),
                "irs": [m["ir"] for m in matches]
            }
            for aid, matches in culvert_matches.items()
        }
    }, f, indent=2)

print("Saved culvert_ir_matches.json successfully.")
