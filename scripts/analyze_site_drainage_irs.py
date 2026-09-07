import json
import re

with open("s03_drainage_irs.json", "r", encoding="utf-8") as f:
    irs = json.load(f)

print(f"Total S03 drainage IRs: {len(irs)}")

# Group by location / chainage
locations = {}
for r in irs:
    ch_from = str(r.get("ch_from") or "").strip()
    ch_to = str(r.get("ch_to") or "").strip()
    loc = f"{ch_from} - {ch_to}" if ch_to else ch_from
    if not loc:
        loc = "UNKNOWN"
    locations.setdefault(loc, []).append(r)

print(f"Total unique locations: {len(locations)}")
print("\nTop 25 locations by IR count:")
for loc, rows in sorted(locations.items(), key=lambda x: len(x[1]), reverse=True)[:25]:
    disciplines = set(r["discipline"] for r in rows)
    print(f"  {loc:<35}: {len(rows)} IRs (Disciplines: {disciplines})")

# Now let's find IRs with specific drainage keywords in description, EXCLUDING general topsoil/borrow pit earthworks!
print("\n--- Specific Drainage Structural / Site Installation Works ---")
site_structural_irs = []
exclude_words = ["topsoil", "borrow pit", "tree", "girth"]

for r in irs:
    desc = r["description"].lower()
    if any(ew in desc for ew in exclude_words):
        continue
    site_structural_irs.append(r)

print(f"Non-earthwork/non-clearing Drainage IRs: {len(site_structural_irs)}")

# Group non-earthwork by location
site_locs = {}
for r in site_structural_irs:
    ch_from = str(r.get("ch_from") or "").strip()
    ch_to = str(r.get("ch_to") or "").strip()
    loc = f"{ch_from} - {ch_to}" if ch_to else ch_from
    site_locs.setdefault(loc, []).append(r)

print(f"\nNon-earthwork locations count: {len(site_locs)}")
for loc, rows in sorted(site_locs.items(), key=lambda x: len(x[1]), reverse=True)[:35]:
    print(f"  {loc:<35}: {len(rows)} IRs")

# Let's see some samples of these site_structural_irs where location is NOT Kazaure Camp Site:
print("\n--- Site Installation IRs (Non-Camp) Sample ---")
non_camp = [r for r in site_structural_irs if "camp" not in str(r.get("ch_from", "")).lower() and "camp" not in str(r.get("description", "")).lower()]
print(f"Total non-camp site structural IRs: {len(non_camp)}")
for r in non_camp[:30]:
    ch = f"{r['ch_from']} - {r['ch_to']}"
    print(f"IR #{r['prog_n']} | {r['status']:<15} | CH: {ch:<22} | Disc: {r['discipline']} | Date: {r['receipt_date'][:10]} | Desc: {r['description']}")
