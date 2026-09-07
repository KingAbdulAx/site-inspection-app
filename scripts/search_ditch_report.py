with open('KZDR_Section03_Comprehensive_Ditch_Report.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'type 9' in line.lower() or 'type-9' in line.lower() or 'pk 109' in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
