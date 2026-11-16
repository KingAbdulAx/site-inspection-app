"""
What the design's Type 6 networks (data/networks.json, scripts/dwg/extract_networks.py) get from later drawings.
Run it after extract_networks.py:

    python3 scripts/dwg/apply_settings.py [--dawanau DW-FD.dxf]

1. Dawanau station as set out on site: 'S02 - FD - Dawanau ST - Settings 260715' (15 Jul 2026). Its layer
   '_Lines Final' draws the two collector drains, one 3D polyline each, a vertex at every manhole; its
   profiles name them (1.1 to 1.28, 2.1 to 2.22) and give each pipe's diameter. Two transverse runs join them
   (1.7 to 2.1 at 20+175, 2.17 to 1.25 at 20+975) and two outlets leave them (1.8 to Exit 1, 1.24 to Exit 2).
   With --dawanau the drawing (dwg2dxf, then fix_dxf.py) is read again into data/dwg/dawanau_settings.json;
   without it that file is used. The design's DRN-LONG legs and manholes of the station (20+000 to 21+250,
   right of the line) give way to these. A leg drawn the same in both keeps its id, so records stay on it.
   The yard (DWYD) is not on that drawing: it stays as designed.
2. The collector drain sheets' diameters (data/dwg/collector_profiles.json: KZDR-2200-DW-08001..08003):
   each leg between two manholes of a profile, by their names, takes the pipe's diameter ('dia', mm).
3. S03's DRN-LONG also draws an outline 'MH' about 12 m before each named manhole, off the drains: an older
   layout. No drain runs to them; those within 25 m of a named manhole are left out.
"""
import argparse
import json
import math
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
NET = os.path.join(ROOT, 'data', 'networks.json')
DW = os.path.join(ROOT, 'data', 'dwg', 'dawanau_settings.json')
PROF = os.path.join(ROOT, 'data', 'dwg', 'collector_profiles.json')
SRC_DW = 'S02-FD-Dawanau-ST-Settings-260715'
r1 = lambda v: round(v, 1)  # noqa: E731


def read_dawanau(path):
    """The two polylines of '_Lines Final' and the outlets, as chainage and offset."""
    sys.path.insert(0, os.path.dirname(__file__))
    from extract_stations import Axes, pts  # noqa: E402
    import ezdxf
    doc = ezdxf.readfile(path)
    axes = Axes()
    lines = []
    for e in doc.modelspace().query('POLYLINE LWPOLYLINE'):
        if e.dxf.layer == '_Lines Final':
            lines.append([[r1(c) for c in axes.at(x, y)[1:3]] for x, y in pts(e)])
    lines.sort(key=len, reverse=True)       # line 1 (29 vertices), then line 2 (23)
    exit2 = None
    for e in doc.modelspace().query('CIRCLE'):
        _, ch, off, d = axes.at(e.dxf.center.x, e.dxf.center.y)
        if 20900 < ch < 21050 and -60 < off < -30:
            exit2 = [r1(ch), r1(off)]
    exit1 = None
    for e in doc.modelspace().query('LINE'):
        if e.dxf.layer != '_3d Polys MH':
            continue
        for p in (e.dxf.start, e.dxf.end):
            _, ch, off, d = axes.at(p.x, p.y)
            if abs(ch - 20175) < 3 and -70 < off < -40:
                exit1 = [r1(ch), r1(off)]
    return {'source': 'S02 - FD - Dawanau ST - Settings 260715.dwg', 'line1': lines[0], 'line2': lines[1], 'exit1': exit1, 'exit2': exit2}


def dawanau(j, dw):
    L1, L2 = dw['line1'], dw['line2']
    assert len(L1) == 29 and len(L2) == 23, (len(L1), len(L2))
    # profile 1: 1.1 .. 1.28; profile 2: Exit 1, 1.8, 1.7, 2.1 .. 2.22; profile 3: 2.17, 1.25, 1.24, Exit 2
    d1 = [400, 600, 600, 800, 800, 800, 1000] + [600] * 16 + [1000, 600, 600, 400]
    d2 = [800, 800, 800, 800, 800, 600, 600, 400, 400, 600, 600, 800, 800, 1000, 1000, 1000, 1000, 1000, 1000, 600, 600, 600, 400, 400]
    nodes, legs = {}, []

    def node(key, name, p):
        nodes[key] = {'handle': 'DWST' + key, 'sub': 'DWKZ', 'ch': p[0], 'off': p[1], 'grid': False, 'name': name, 'src': SRC_DW}
        return 'DWST' + key

    for i in range(28):
        node('1.%d' % (i + 1), 'MH1.%d-DW' % (i + 1), L1[i])
    for i in range(22):
        node('2.%d' % (i + 1), 'MH2.%d-DW' % (i + 1), L2[i])
    node('E1', 'Exit 1-DW', dw['exit1'])
    node('E2', 'Exit 2-DW', dw['exit2'])
    node('E3', None, L2[22])
    nodes['2.20']['name'] = 'MH1.28/MH2.20-DW'   # where line 1 ends on line 2

    def leg(a, b, dia, pts=None):
        A, B = nodes[a], nodes[b]
        p = pts or [[A['ch'], A['off']], [B['ch'], B['off']]]
        n = sum(math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]) for k in range(len(p) - 1))
        legs.append({'kind': 'T6', 'sub': 'DWKZ', 'pts': p, 'len': r1(n), 'side': 'R', 'from': A['handle'], 'to': B['handle'], 'src': SRC_DW, 'dia': dia})

    for i in range(27):
        leg('1.%d' % (i + 1), '1.%d' % (i + 2), d1[i])
    leg('1.28', '2.20', None, [L1[27], L1[28]])
    for i in range(21):
        leg('2.%d' % (i + 1), '2.%d' % (i + 2), d2[3 + i])
    leg('2.22', 'E3', None)
    leg('1.8', 'E1', d2[0])
    leg('1.7', '2.1', d2[2])
    leg('2.17', '1.25', 1000)
    leg('1.24', 'E2', 1000)

    # the design's legs and manholes of the station give way
    def inbox(ch, off):
        return 19900 <= ch <= 21300 and -60 <= off <= 10
    old = [l for l in j['t6'] if l['sub'] == 'DWKZ' and ('DRN-LONG' in l['src'] or l['src'] == SRC_DW) and all(inbox(*p) for p in l['pts'])]
    old_ids = {}
    for l in old:
        a, b = l['pts'][0], l['pts'][-1]
        old_ids[(r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1]))] = l['id']
    j['t6'] = [l for l in j['t6'] if l not in old and l.get('src') != SRC_DW]
    old = [l for l in old if l['src'] != SRC_DW]
    gone = {m['handle'] for m in j['manholes'] if m['sub'] == 'DWKZ' and 'DRN-LONG' in m['src'] and inbox(m['ch'], m['off'])}
    j['manholes'] = [m for m in j['manholes'] if m['handle'] not in gone and m.get('src') != SRC_DW] + list(nodes.values())
    kept = 0
    for k, l in enumerate(legs):
        a, b = l['pts'][0], l['pts'][-1]
        same = [v for (c0, o0, c1, o1), v in old_ids.items() if
                (abs(c0 - a[0]) < 1 and abs(o0 - a[1]) < 1 and abs(c1 - b[0]) < 1 and abs(o1 - b[1]) < 1) or
                (abs(c0 - b[0]) < 1 and abs(o0 - b[1]) < 1 and abs(c1 - a[0]) < 1 and abs(o1 - a[1]) < 1)]
        l['id'] = same[0] if same else 't6_DWKZ_DWST_%d' % (k + 1)
        kept += bool(same)
    j['t6'] += legs
    print('Dawanau station: %d legs (%d m), %d manholes and exits; %d design legs and %d manholes replaced, %d leg ids kept'
          % (len(legs), round(sum(l['len'] for l in legs)), len(nodes), len(old), len(gone), kept))


def atoms(name):
    """'MH1.12-YD/MH2.1-YD' -> {'1.12-YD', '2.1-YD'}; 'MH1.1/MH2.1_KZ' -> {'1.1-KZ', '2.1-KZ'}; 'ES1' -> {'ES1'}"""
    if not name:
        return set()
    suf = re.search(r'[-_ ]([A-Z]{2,4})\s*$', name)
    suf = suf.group(1) if suf else ''
    out = {m + '-' + suf for m in re.findall(r'MH-?\s*(\d+\.\d+[A-Z]?)', name)}
    out |= {m for m in re.findall(r'\b((?:ES|DP)\d+)', name)}
    return out


def diameters(j, prof):
    names = {m['handle']: atoms(m.get('name')) for m in j['manholes']}
    gaps = {}
    for p in prof['profiles']:
        for k, dia in enumerate(p['dia']):
            a, b = atoms(p['mh'][k]), atoms(p['mh'][k + 1])
            for x in a:
                for y in b:
                    gaps[frozenset((x, y))] = dia
    n = 0
    for l in j['t6']:
        if l.get('src') == SRC_DW:
            continue
        A, B = names.get(l.get('from'), set()), names.get(l.get('to'), set())
        hit = [gaps[frozenset((x, y))] for x in A for y in B if frozenset((x, y)) in gaps]
        if hit:
            l['dia'] = hit[0]
            n += 1
    print('legs given a diameter from the collector drain sheets:', n)


def outlines(j):
    used = {h for l in j['t6'] for h in (l.get('from'), l.get('to'))}
    named = [m for m in j['manholes'] if m.get('name')]
    drop = {m['handle'] for m in j['manholes'] if 'S03' in m['src'] and not m.get('name') and m['handle'] not in used and
            any(n['sub'] == m['sub'] and abs(n['ch'] - m['ch']) < 25 and abs(n['off'] - m['off']) < 25 for n in named)}
    j['manholes'] = [m for m in j['manholes'] if m['handle'] not in drop]
    print("S03's outline manholes of an older layout left out:", len(drop))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dawanau', help='the settings drawing, converted to DXF')
    a = ap.parse_args()
    if a.dawanau:
        json.dump(read_dawanau(a.dawanau), open(DW, 'w'))
    j = json.load(open(NET))
    dawanau(j, json.load(open(DW)))
    outlines(j)
    diameters(j, json.load(open(PROF)))
    json.dump(j, open(NET, 'w'))


if __name__ == '__main__':
    main()
