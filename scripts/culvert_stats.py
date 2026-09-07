import json
from collections import Counter

with open("culvert_ir_progress_table.json", "r", encoding="utf-8") as f:
    culverts = json.load(f)

print(f"Total Culverts: {len(culverts)}")
counts = Counter(c["highest_milestone"] for c in culverts)
for m, n in counts.items():
    print(f"  {m}: {n}")

print("\n--- By Typology (Pipe Culvert vs Box Culvert) ---")
pipe_counts = Counter(c["highest_milestone"] for c in culverts if "pipe" in c["typology"].lower())
box_counts = Counter(c["highest_milestone"] for c in culverts if "box" in c["typology"].lower())

print("PIPE CULVERTS:")
for m, n in pipe_counts.items():
    print(f"  {m}: {n}")

print("BOX CULVERTS:")
for m, n in box_counts.items():
    print(f"  {m}: {n}")
