"""
Embankment height from the design longitudinal profile (TRA-PLONG) and the cross sections.

    python3 scripts/dwg/extract_profile.py --plong S02-TRA-PLONG.dxf --sub DWKZ \
        --sections data/sections_DWKZ.json --out data/heights_DWKZ.json

The PLONG's band table under the profile has a column every 25 m:
    S560  distance to origin (the chainage, '19825')
    S559  lowest rail level
    S581  sub-ballast bottom, i.e. formation level (left out at stations and bridges)
    S582  ground level at the centreline
Each column's blocks share one x, so the four are joined by x.

Height means formation to ground. At the centreline it is S581 - S582. On each
side it is the formation level less the ground level at that side's toe: the
toe distance ('L=11.15', S7002) and the ground line come from the cross section
at the same chainage, drawn relative to the rail level. Where a cross section
has no toe label on a side, that side is left empty and the app uses the
centreline height.

The platform's fall comes from the same cross section: the bottom platform
line 3.4 m either side of the axis. 'L' or 'R' is the side it drains to,
'both' a roof shape. On S02 the drawn Type 9 sits on that side at 569 of 577
stations that have it on one side only, so the app checks Type 9 there.

Where the profile gives no formation level (stations, bridges) the row keeps
fl = null: the app shows rail level - 0.97 m as an estimate and leaves those
stretches out of the Type 9 check.
"""
import argparse
import collections
import json
import sys

import ezdxf

FL_BELOW_RAIL = 0.971   # median rail level - formation level on S02, used only for estimates


def ground_at(lines, x):
    best = None
    for line in lines:
        for (x0, y0), (x1, y1) in zip(line, line[1:]):
            if x1 != x0 and min(x0, x1) - 1e-6 <= x <= max(x0, x1) + 1e-6:
                y = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                best = y if best is None else min(best, y)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plong', required=True)
    ap.add_argument('--sub', required=True)
    ap.add_argument('--sections', help="the app's sections_<SUB>.json, for the height on each side")
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr)

    msp = ezdxf.readfile(a.plong).modelspace()
    cols = collections.defaultdict(dict)
    for e in msp.query('INSERT'):
        if e.dxf.name in ('S559', 'S560', 'S581', 'S582') and e.attribs:
            cols[round(e.dxf.insert.x, 1)][e.dxf.name] = e.attribs[0].dxf.text
    stations = {}
    for c in cols.values():
        try:
            ch = float(c['S560'])
            stations[ch] = (float(c['S559']), float(c['S581']) if 'S581' in c else None, float(c['S582']))
        except (KeyError, ValueError):
            continue
    log(f'{len(stations)} profile stations {min(stations):.0f} → {max(stations):.0f}; '
        f'{sum(1 for v in stations.values() if v[1] is None)} without a formation level')

    sections = {}
    if a.sections:
        for s in json.load(open(a.sections))['sections']:
            sections[round(s['ch'], 3)] = s

    rows, sides = [], collections.Counter()
    for ch in sorted(stations):
        lrl, fl, gl = stations[ch]
        f = fl if fl is not None else lrl - FL_BELOW_RAIL
        hs = []
        s = sections.get(round(ch, 3))
        fall = None
        if s:
            plat = s['p'].get('platform', [])
            yl, yr = ground_at(plat, -3.4), ground_at(plat, 3.4)
            if yl is not None and yr is not None:
                fall = 'L' if yl < yr - 0.03 else 'R' if yr < yl - 0.03 else 'both'
        for key, sign in (('Ll', -1), ('Lr', 1)):
            h = None
            if s and s.get(key):
                y = ground_at(s['p'].get('ground', []), sign * max(s[key]))
                if y is not None:
                    h = round((f - lrl) - y, 2)   # the cross section is drawn relative to the rail level
                    sides[key] += 1
            hs.append(h)
        rows.append([ch, round(lrl, 3), None if fl is None else round(fl, 3), round(gl, 3), hs[0], hs[1], fall])
    log(f'per-side heights: left {sides["Ll"]}, right {sides["Lr"]} of {len(rows)}')
    out = {'sub': a.sub, 'source': a.plong.split('/')[-1], 'fl_below_rail': FL_BELOW_RAIL,
           'columns': ['ch', 'rail', 'formation', 'ground', 'h_left', 'h_right', 'falls_to'], 'rows': rows}
    with open(a.out, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    log(f'wrote {len(rows)} rows to {a.out}')


if __name__ == '__main__':
    main()
