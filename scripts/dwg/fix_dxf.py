"""
Repair a DXF written by LibreDWG's dwg2dxf when a text value contains a raw
line break (seen in MTEXT with embedded objects). DXF is strictly pairs of
lines (group code, value); a line where a group code is expected but which is
not an integer belongs to the previous value, so it is joined back.

    python3 scripts/dwg/fix_dxf.py in.dxf out.dxf
"""
import sys


def repair(src, dst):
    fixed = 0
    last = None          # the last complete [code, value] pair, not yet written
    code = None          # a group code waiting for its value
    with open(src, 'r', encoding='utf-8', errors='replace', newline='') as fi, \
            open(dst, 'w', encoding='utf-8', newline='') as fo:
        for raw in fi:
            line = raw.rstrip('\r\n')
            if code is None:
                if line.strip().lstrip('-').isdigit():
                    code = line.strip()
                elif last is not None:
                    last[1] += ' ' + line.strip()   # spilled text: rejoin
                    fixed += 1
                continue
            if last is not None:
                fo.write(last[0] + '\n' + last[1] + '\n')
            last, code = [code, line], None
        if last is not None:
            fo.write(last[0] + '\n' + last[1] + '\n')
    return fixed


if __name__ == '__main__':
    n = repair(sys.argv[1], sys.argv[2])
    print(f'{sys.argv[1]}: rejoined {n} stray line(s) -> {sys.argv[2]}', file=sys.stderr)
