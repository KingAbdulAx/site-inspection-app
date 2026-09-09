import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')

rp = fitz.open(r"Doc no. 1084\T2019-323-DD-KM-DWKZ-2200-RP-00001-06.pdf")

# Section 3.5 begins around page 38-45
for p in range(37, 45):
    txt = rp[p].get_text()
    if any(k in txt.lower() for k in ["3.5", "type 9", "type 8", "half round", "platform side", "water descent"]):
        print(f"\n==================== PAGE {p+1} ====================")
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        for l in lines:
            if any(k in l.lower() for k in ["3.5", "type 9", "type 8", "type 7", "type 4", "type 1", "half round", "platform", "descent", "chute"]):
                print("  ", l)
