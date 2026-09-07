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
    # Match patterns like DK88+712, PK 88+712, 88712, BC88.3
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

# Extract structure name or number
def extract_str_tag(s):
    if not s:
        return None
    s = str(s).strip().upper()
    m = re.search(r'([BP]C\s*\d+\.?\d*)', s)
    if m:
        return m.group(1).replace(" ", "")
    m2 = re.search(r'(DK\s*\d+\+\d+)', s)
    if m2:
        return m2.group(1).replace(" ", "")
    return None

# Build asset index
# Culverts have structure_no, chainage_km, chainage_str
# Ditches have from_km, to_km, chainage_str
asset_by_str = {}
asset_by_chainage = {}

for a in assets:
    p = a["properties"]
    str_no = (p.get("structure_no") or "").strip().upper()
    if str_no:
        asset_by_str[str_no.replace(" ", "")] = a
    
    # Try chainage
    ch_km = p.get("chainage_km")
    if ch_km is not None:
        ch_m = int(round(ch_km * 1000))
        asset_by_chainage.setdefault(ch_m, []).append(a)
    
    from_km = p.get("from_km")
    to_km = p.get("to_km")
    if from_km is not None and to_km is not None:
        f_m = int(round(from_km * 1000))
        t_m = int(round(to_km * 1000))
        # range
        # We can store range bounds
        pass

print(f"Indexed {len(asset_by_str)} assets by structure_no")
print(f"Indexed {len(asset_by_chainage)} distinct culvert chainages")

# Map IRs to assets
ir_matches = []
unmatched_irs = []

for r in irs:
    ch_from = str(r.get("ch_from") or "").strip()
    ch_to = str(r.get("ch_to") or "").strip()
    desc = r.get("description") or ""
    
    tag = extract_str_tag(ch_from) or extract_str_tag(desc)
    ch_val = parse_chainage(ch_from)
    
    matched_asset = None
    match_reason = None
    
    if tag and tag in asset_by_str:
        matched_asset = asset_by_str[tag]
        match_reason = f"Structure No Tag: {tag}"
    elif ch_val and ch_val in asset_by_chainage:
        # Exact chainage match
        candidates = asset_by_chainage[ch_val]
        matched_asset = candidates[0]
        match_reason = f"Exact Chainage: {ch_val} (matches {matched_asset['id']})"
    elif ch_val:
        # Search nearby (+- 25m)
        for d in range(-25, 26):
            if (ch_val + d) in asset_by_chainage:
                matched_asset = asset_by_chainage[ch_val + d][0]
                match_reason = f"Nearby Chainage: {ch_val} vs {ch_val + d} ({matched_asset['id']})"
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

# Inspect matched assets breakdown
matched_asset_ids = set(m["asset_id"] for m in ir_matches)
print(f"Unique assets matched: {len(matched_asset_ids)}")

# Let's inspect matched assets and their IR milestones
asset_ir_summary = {}
for m in ir_matches:
    aid = m["asset_id"]
    r = m["ir"]
    asset_ir_summary.setdefault(aid, []).append(r)

print("\n--- Summary of Matched Assets with IRs ---")
for aid, rows in sorted(asset_ir_summary.items()):
    p = [a for a in assets if a["id"] == aid][0]["properties"]
    print(f"\nAsset: {aid} | {p.get('structure_no', '')} | CH: {p.get('chainage_str', '')} | Typology: {p.get('typology', '')}")
    print(f"  Total IRs: {len(rows)}")
    for r in rows:
        print(f"    - IR #{r['prog_n']} ({r['status']}) [{r['receipt_date'][:10]}]: {r['description'][:75]}")

# Save detailed output
with open("matched_irs_report.json", "w", encoding="utf-8") as f:
    json.dump({
        "matched_count": len(ir_matches),
        "unique_assets_count": len(matched_asset_ids),
        "asset_summaries": {
            aid: {
                "asset_id": aid,
                "structure_no": [a for a in assets if a["id"] == aid][0]["properties"].get("structure_no"),
                "chainage": [a for a in assets if a["id"] == aid][0]["properties"].get("chainage_str"),
                "typology": [a for a in assets if a["id"] == aid][0]["properties"].get("typology"),
                "irs": rows
            }
            for aid, rows in asset_ir_summary.items()
        }
    }, f, indent=2)

print("\nSaved matched_irs_report.json")
