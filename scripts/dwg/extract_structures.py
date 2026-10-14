"""
Bridges, overpasses and underpasses from the track plan (TRA-PLAT), for reference on the strip.

    python3 scripts/dwg/extract_structures.py --plat S02-TRA-PLAT.dxf --sub DWKZ --out data/dwg/DWKZ_structures.json
    node scripts/dwg/bundle_structures.js          # all data/dwg/*_structures.json -> data/structures.js

Convert the track plan with LibreDWG built from master: 0.13.3 drops the anonymous ('*U') block
definitions, and with them the bridges' outlines that give S01 its bridge limits.

The track plans of S01-S05 draw them on the same layers:
    BRIDGES                         one block per bridge, drawn between its abutments
    BRIDGE-TXT                      its name ('BRG-2602') and, from S02 on, its limits ('36+077 - 36+628')
    OVERPASS_UNDERPASS (_TEXT 1)    one block per road crossing, attributes 'OVR-2801' (road over the
                                    railway) or 'UDR-3001' (road under it) and 'CH=25+850'
    UNDERPASS-UDR                   S03: underpasses drawn without attributes
    UNDEPASS-3X3                    3x3 m underpasses, 'CH=24+650': the execution charts' cattle
                                    crossings, already in the data as culverts, so kept only by --all
    ALG-H-PLA_OverpassScheme        the overpass deck outline, which gives its width along the line

Chainage comes from the same 25 m ticks as the drainage (extract_plan.Axis). A bridge takes its limits
from the drawing's text where there is one, else from its block's extent.
"""
import argparse
import json
import os
import re
import sys

import ezdxf

sys.path.insert(0, os.path.dirname(__file__))
from extract_plan import Axis, xy  # noqa: E402

RANGE_RE = re.compile(r'^\s*(-?\d+)\+(\d+(?:\.\d+)?)\s*-\s*(-?\d+)\+(\d+(?:\.\d+)?)\s*$')
CH_RE = re.compile(r'CH\s*=\s*(-?\d+)\+(\d+(?:\.\d+)?)', re.I)


def pk(km, m):
    v = abs(int(km)) * 1000 + float(m)
    return -v if str(km).startswith('-') else v


def points(e):
    """Every vertex an entity draws, through nested blocks."""
    t = e.dxftype()
    try:
        if t == 'INSERT':
            out = []
            try:
                for v in e.virtual_entities():
                    out += points(v)
            except Exception:
                pass
            return out or [xy(e.dxf.insert)]
        if t == 'LWPOLYLINE':
            return [(p[0], p[1]) for p in e.get_points('xy')]
        if t == 'LINE':
            return [xy(e.dxf.start), xy(e.dxf.end)]
        if t == 'POLYLINE':
            return [xy(v.dxf.location) for v in e.vertices]
        if t in ('CIRCLE', 'ARC'):
            return [xy(e.dxf.center)]
        if t in ('TEXT', 'MTEXT'):
            return [xy(e.dxf.insert)]
    except Exception:
        pass
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plat', required=True, help='track plan DXF (holds the axis too)')
    ap.add_argument('--sub', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--all', action='store_true', help='keep the 3x3 underpasses (cattle crossings)')
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr)

    axis = Axis.from_dxf(a.plat, log)
    msp = ezdxf.readfile(a.plat).modelspace()
    proj = lambda P: axis.project(P)
    lo, hi = float(axis.ch[0]), float(axis.ch[-1])

    names, ranges = [], []
    for e in msp.query('TEXT MTEXT'):
        if e.dxf.layer != 'BRIDGE-TXT':
            continue
        txt = (e.dxf.text if e.dxftype() == 'TEXT' else e.plain_text()).strip()
        ch = float(proj([xy(e.dxf.insert)])[0][0])
        m = RANGE_RE.match(txt)
        if m:
            ranges.append((ch, pk(m.group(1), m.group(2)), pk(m.group(3), m.group(4))))
        elif re.match(r'^BRG-\d+', txt):
            names.append((ch, txt))

    out = []
    for e in msp.query('INSERT'):
        if e.dxf.layer != 'BRIDGES':
            continue
        P = points(e)
        ch, off = proj(P)
        c0, c1 = float(ch.min()), float(ch.max())
        mid = (c0 + c1) / 2
        name = min(names, key=lambda n: abs(n[0] - mid))[1] if names else ''
        rng = min(ranges, key=lambda r: abs((r[1] + r[2]) / 2 - mid)) if ranges else None
        src = 'block extent'
        if rng and rng[1] - 60 <= mid <= rng[2] + 60:
            c0, c1, src = rng[1], rng[2], 'drawing text'
        out.append({'kind': 'bridge', 'name': name, 'ch0': round(c0, 1), 'ch1': round(c1, 1), 'src': src})

    decks = []
    for e in msp:
        if e.dxf.layer == 'ALG-H-PLA_OverpassScheme':
            P = points(e)
            if P:
                ch, _ = proj(P)
                decks.append((float(ch.min()), float(ch.max())))

    for e in msp.query('INSERT'):
        lay = e.dxf.layer
        att = {x.dxf.tag: (x.dxf.text or '').strip() for x in e.attribs}
        if lay.startswith('OVERPASS_UNDERPASS') and att:
            name = att.get('OVERPASS_UNDEPASS', '')
            # 'OVR-' passes over the railway, 'UDR-' under it; S01 also names two 'ROAD CROSSING' and
            # 'SERVICE ROAD' without saying which
            kind = 'overpass' if name.startswith('OVR') else 'underpass' if name.startswith('UDR') else 'crossing'
        elif lay == 'UNDERPASS-UDR':
            name, kind = '', 'underpass'
        elif lay == 'UNDEPASS-3X3':
            if not a.all:
                continue
            name, kind = 'Underpass 3×3 m', 'underpass'
        else:
            continue
        m = CH_RE.search(att.get('CH', ''))
        ch = pk(m.group(1), m.group(2)) if m else float(proj([xy(e.dxf.insert)])[0][0])
        deck = [d for d in decks if d[0] - 15 <= ch <= d[1] + 15]
        c0, c1 = (min(d[0] for d in deck), max(d[1] for d in deck)) if deck else (ch - 6, ch + 6)
        out.append({'kind': kind, 'name': name, 'ch': round(ch, 1), 'ch0': round(min(c0, ch - 3), 1), 'ch1': round(max(c1, ch + 3), 1),
                    'src': 'CH attribute' if m else 'block position'})

    # one per structure: a block drawn twice on two layers keeps the named one
    out.sort(key=lambda s: (s['ch0'], s['kind']))
    keep = []
    for s in out:
        dup = next((k for k in keep if k['kind'] == s['kind'] and abs((k['ch0'] + k['ch1']) / 2 - (s['ch0'] + s['ch1']) / 2) < 20), None)
        if dup:
            if not dup['name'] and s['name']:
                keep[keep.index(dup)] = s
            continue
        keep.append(s)
    keep = [s for s in keep if s['ch1'] >= lo - 50 and s['ch0'] <= hi + 50]
    # The railway's own bridge over an underpass road (S05, 181+459) is the underpass already listed.
    under = [s for s in keep if s['kind'] == 'underpass']
    keep = [s for s in keep if not (s['kind'] == 'bridge' and any(s['ch0'] - 30 <= u['ch'] <= s['ch1'] + 30 for u in under))]
    for s in keep:
        if s['kind'] == 'bridge' and s['ch1'] - s['ch0'] < 1:
            log(f"  {s['name']}: no extent in this DXF (its block definition is missing; convert with LibreDWG master)")
    for i, s in enumerate(keep):
        s['id'] = f"ref_{a.sub}_{s['kind']}_{i + 1:02d}"
    json.dump({'sub': a.sub, 'source': os.path.basename(a.plat), 'structures': keep}, open(a.out, 'w'), indent=1)
    by = {}
    for s in keep:
        by[s['kind']] = by.get(s['kind'], 0) + 1
    log(f'{a.sub}: {by}')
    for s in keep:
        log(f"  {s['kind']:9s} {s['name']:10s} {s['ch0']:9.1f} {s['ch1']:9.1f}  {s['src']}")


if __name__ == '__main__':
    main()
