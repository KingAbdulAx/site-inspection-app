with open('KZDR_Section03_Master_Ditch_Schedule.md', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()
for i, l in enumerate(lines):
    if '88+' in l:
        for j in range(max(0, i-2), min(len(lines), i+3)):
            print(lines[j])
        print('-'*40)
