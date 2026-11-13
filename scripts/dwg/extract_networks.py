"""
Drainage that is not a straight run beside the line: the Type 6 networks of stations and yards (Phase 8)
and the drainage of the roads that cross the line (Phase 9), with their true shape -> data/networks.json.

    python3 scripts/dwg/extract_networks.py --out data/networks.json \
        --t6 S02-DRN-LONG.dxf S03-DRN-LONG.dxf S04-DRN-LONG.dxf S05-DRN-LONG.dxf S02-DWYD.dxf S02-KZYD.dxf \
        --rail S01-DRN-LONG.dxf S02-DRN-LONG.dxf S03-DRN-LONG.dxf S04-DRN-LONG.dxf S05-DRN-LONG.dxf \
        --roads S01-ROD.dxf S02-ROD.dxf S03-ROD.dxf S04-ROD.dxf S05-ROD.dxf

Each drawing converted with dwg2dxf, then scripts/dwg/fix_dxf.py:
    --t6     T2019-0323-S0x-DD-DRN-LONG.dwg and the yards' STI-DWYD_DRN_LONG, STI-KZYD_DRN_LONG
    --rail   the DRN-LONG drawings again: the railway ditches, whole, where road drains run into them
    --roads  T2019-0323-S0x-DD-ROD-DRAINAGE.dwg (S04: ROD-DRAINAGE_REV03)

Type 6 (French drain, collector drain):
    DRN_DITCH_TYPE6, DRN_F_YARD_DITCH_TYPE6, _S02-DRN-DITCH_TYPE6 (yards)    the drain, with its turns
    DRN__F_YARD_PIPE                                                        a yard's collector pipe
    MH (blocks, or closed polylines in S03), DRN_MANHOLE_GRID_COVER, DRN_F_YARD_MANHOLE_COVER   manholes
    DRN_MANHOLE TEXT                                                        a yard manhole's name
  A drain is cut at every manhole within 2.5 m of it: each piece between two manholes (or an end) is a leg,
  with its own length measured along it. A manhole keeps its drawing handle, so the app joins it to the
  manhole it already has from the plans (data/connectors.json: cn_<SUB>_<handle>).

Roads:
    _S0x-DRN-DITCH_TYPE<n>[...], _S0x-DRN-DITCH DICHARGE, _S0x_DRN_Drainage Trench, CONT-DITCH-REG-SERV
                                    a road's drains; the layer's number is the drain type
    VT<n>-<m> [(Concrete)]          the road drain's name, on a leader near it: type n, lined if '(Concrete)'
    DR-DIS-ENR-AT (blocks)          riprap dissipators, where a road drain ends on the ground
    _S02_PH-Planta, DRE_PH_CX       road culverts (box or pipe), with 'CH=0+351' on the road where given
  Layers of other drawings bound in ('...$0$...', '...|...') and the railway's own (DRN_DITCH_TYPE7...) are
  left out; a drain drawn in two sections' files is kept once. Each road drain belongs to the road crossing
  (data/structures.js) nearest where it comes closest to the line, within 1 km. A road drain end within 3 m of
  a railway ditch of the DRN-LONG drawings runs into it: kept as that ditch's type, side and chainage, which
  the app turns into its own feature.

Everything is projected onto the main-line axes of data/dwg/<SUB>_plan.json joined end to end (as the
stations are): chainage, and offset positive to the left.
"""
import argparse
import json
import math
import os
import re
import sys

import ezdxf

sys.path.insert(0, os.path.dirname(__file__))
from extract_stations import Axes, pts, text  # noqa: E402  (also patches ezdxf's MTEXT columns)

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
r1 = lambda v: round(v, 1)  # noqa: E731


def plen(p):
    return sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) for i in range(len(p) - 1))


def seg_dist(q, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2))
    return math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy), t


def along(p, q):
    """distance along polyline p of the point nearest q, and how far q is from it"""
    best, s = None, 0.0
    for i in range(len(p) - 1):
        d, t = seg_dist(q, p[i], p[i + 1])
        L = math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])
        if best is None or d < best[1]:
            best = (s + t * L, d)
        s += L
    return best


def cut(p, s0, s1):
    """the part of polyline p between distances s0 and s1 along it"""
    out, s = [], 0.0
    for i in range(len(p) - 1):
        a, b = p[i], p[i + 1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L == 0:
            continue
        e0, e1 = max(s0, s), min(s1, s + L)
        if e1 > e0 or (e1 == e0 and s0 == s1):
            pa = (a[0] + (b[0] - a[0]) * (e0 - s) / L, a[1] + (b[1] - a[1]) * (e0 - s) / L)
            pb = (a[0] + (b[0] - a[0]) * (e1 - s) / L, a[1] + (b[1] - a[1]) * (e1 - s) / L)
            if not out:
                out.append(pa)
            out.append(pb)
        s += L
    return out


def foreign(lay):
    return '$0$' in lay or '|' in lay


def centre(e):
    if e.dxftype() == 'INSERT':
        return (e.dxf.insert.x, e.dxf.insert.y)
    p = pts(e)
    return (sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)) if p else None


# ------------------------------------------------------------------ Type 6
T6_LAYER = re.compile(r'(^|_)DITCH_TYPE ?6$|^DRN_F_YARD_DITCH_TYPE6$|^DRN_DITCH_TYPE6$', re.I)
PIPE_LAYER = re.compile(r'^DRN__F_YARD_PIPE$', re.I)
MH_LAYER = re.compile(r'^(MH|DRN_MANHOLE_GRID_COVER|DRN_F_YARD_MANHOLE_COVER.*)$', re.I)


def t6(paths, axes):
    legs, nodes, seen = [], [], []
    for path, src in paths:
        doc = ezdxf.readfile(path)
        msp = doc.modelspace()
        mhs = []
        for e in msp:
            lay = e.dxf.layer
            if foreign(lay) or not MH_LAYER.match(lay):
                continue
            if e.dxftype() not in ('INSERT', 'LWPOLYLINE'):
                continue
            c = centre(e)
            if not c or any(math.hypot(c[0] - m['xy'][0], c[1] - m['xy'][1]) < 0.5 for m in mhs):
                continue
            mhs.append({'xy': c, 'handle': e.dxf.handle, 'grid': 'GRID' in lay.upper() or 'COVER' in lay.upper(), 'name': None})
        names = [(e.dxf.insert.x, e.dxf.insert.y, text(e).strip()) for e in msp if e.dxftype() in ('TEXT', 'MTEXT') and re.search(r'MANHOLE TEXT', e.dxf.layer, re.I)]
        for m in mhs:
            n = min(names, key=lambda t: math.hypot(t[0] - m['xy'][0], t[1] - m['xy'][1]), default=None)
            if n and math.hypot(n[0] - m['xy'][0], n[1] - m['xy'][1]) < 15:
                m['name'] = n[2]
        for e in msp:
            lay = e.dxf.layer
            if foreign(lay) or e.dxftype() not in ('LWPOLYLINE', 'POLYLINE'):
                continue
            kind = 'T6' if T6_LAYER.search(lay) else 'pipe' if PIPE_LAYER.match(lay) else None
            if not kind:
                continue
            p = pts(e)
            if len(p) < 2 or plen(p) < 1:
                continue
            key = (round(p[0][0]), round(p[0][1]), round(p[-1][0]), round(p[-1][1]))
            if key in seen or key[2:] + key[:2] in seen:
                continue                                 # the same drain in a second drawing
            seen.append(key)
            L = plen(p)
            on = sorted([(along(p, m['xy']), m) for m in mhs], key=lambda x: x[0][0])
            on = [(s, m) for (s, d), m in on if d <= 2.5]
            cuts = [0.0] + [s for s, m in on if 0.5 < s < L - 0.5] + [L]
            at = {round(s, 1): m for s, m in on}
            for k in range(len(cuts) - 1):
                s0, s1 = cuts[k], cuts[k + 1]
                if s1 - s0 < 0.5:
                    continue
                q = cut(p, s0, s1)
                pr = [axes.at(*v) for v in q]
                if not all(r[0] for r in pr) or max(r[3] for r in pr) > 1500:
                    continue
                end = lambda s: next((m for ss, m in on if abs(ss - s) <= 2.5), None)  # noqa: E731
                ma, mb = end(s0), end(s1)
                offs = [r[2] for r in pr]
                legs.append({'id': '%s_%s_%s_%d' % (kind.lower(), pr[0][0], e.dxf.handle, k + 1), 'kind': kind, 'sub': max(set(r[0] for r in pr), key=[r[0] for r in pr].count),
                             'pts': [[r1(r[1]), r1(r[2])] for r in pr], 'len': r1(s1 - s0), 'side': 'L' if sum(offs) / len(offs) > 0 else 'R',
                             'from': ma and ma['handle'], 'to': mb and mb['handle'], 'src': src})
        for m in mhs:
            sub, ch, off, d = axes.at(*m['xy'])
            if sub and d < 1500:
                nodes.append({'handle': m['handle'], 'sub': sub, 'ch': r1(ch), 'off': r1(off), 'grid': m['grid'], 'name': m['name'], 'src': src})
    return legs, nodes


# ------------------------------------------------------------------ railway ditches, whole
RAIL = re.compile(r'^DRN_DITCH_TYPE(\d+[L]?)$')


def railway(paths, axes):
    out = []
    for path, src in paths:
        doc = ezdxf.readfile(path)
        for e in doc.modelspace():
            m = RAIL.match(e.dxf.layer)
            if not m or e.dxftype() not in ('LWPOLYLINE', 'POLYLINE'):
                continue
            p = pts(e)
            if len(p) >= 2:
                out.append({'code': 'T' + m.group(1), 'p': p})
    return out


# ------------------------------------------------------------------ roads
ROAD = re.compile(r'^_S0\d[-_]DRN[-_](DITCH[ _]?(TYPE(\d+)|DICHARGE)|Drainage Trench)', re.I)
LABEL = re.compile(r'^VT(\d+)[A-Z]?(?:-(\d+(?:\.\d+)?[a-z]?))?\s*(\(?concrete\)?)?', re.I)


def road_type(lay):
    if 'CONT-DITCH-REG-SERV' in lay:
        return 'service'
    m = ROAD.match(lay)
    if not m:
        return None
    if 'DICHARGE' in lay.upper():
        return 'discharge'
    if 'TRENCH' in lay.upper():
        return 'trench'
    return lay.upper().split('TYPE')[1].strip(' _')     # '6', '4_11', '4_11_12', '7_8_9_10'


def roads(paths, axes, refs, rail):
    items, seen = [], []
    for path, src in paths:
        doc = ezdxf.readfile(path)
        msp = doc.modelspace()
        labels = []
        for e in msp:
            if e.dxftype() != 'MULTILEADER':
                continue
            try:
                s = re.sub(r'\s+', ' ', e.context.mtext.default_content.replace('^J', ' ').replace('\\P', ' ')).strip()
                i = e.context.mtext.insert
            except Exception:
                continue
            m = LABEL.match(s)
            if m:
                # the leader's arrow points at the drain; its text sits beside it
                tip = None
                try:
                    tip = e.context.leaders[0].lines[0].vertices[0]
                except Exception:
                    pass
                labels.append({'xy': (tip.x, tip.y) if tip is not None else (i.x, i.y), 'type': m.group(1), 'name': s.split('(')[0].strip().replace(' ', ''), 'concrete': bool(m.group(3))})
        for e in msp:
            lay = e.dxf.layer
            if foreign(lay):
                continue
            if e.dxftype() in ('LWPOLYLINE', 'POLYLINE', 'LINE'):
                rt = road_type(lay)
                if not rt:
                    continue
                p = pts(e)
                if len(p) < 2 or plen(p) < 2:
                    continue
                key = tuple(round(v) for v in (p[0][0], p[0][1], p[-1][0], p[-1][1]))
                if key in seen or key[2:] + key[:2] in seen:
                    continue
                seen.append(key)
                pr = [axes.at(*v) for v in p]
                if not all(r[0] for r in pr) or min(r[3] for r in pr) > 1500:
                    continue
                lab = min(labels, key=lambda l: along(p, l['xy'])[1], default=None)
                lab = lab if lab and along(p, lab['xy'])[1] < 12 else None
                near = min(pr, key=lambda r: abs(r[2]))
                # where its ends land on a railway ditch
                joins = []
                for q, end in ((p[0], 'a'), (p[-1], 'b')):
                    best = None
                    for d in rail:
                        for i in range(len(d['p']) - 1):
                            dd, _ = seg_dist(q, d['p'][i], d['p'][i + 1])
                            if dd <= 3 and (best is None or dd < best[0]):
                                best = (dd, d['code'])
                    if best:
                        r = axes.at(*q)
                        joins.append({'end': end, 'code': best[1], 'ch': r1(r[1]), 'off': r1(r[2]), 'side': 'L' if r[2] > 0 else 'R'})
                items.append({'kind': 'drain', 'rtype': rt, 'label': lab and lab['name'], 'ltype': lab and lab['type'], 'concrete': bool(lab and lab['concrete']),
                              'sub': near[0], 'near': [r1(near[1]), r1(near[2])], 'pts': [[r1(r[1]), r1(r[2])] for r in pr], 'len': r1(plen(p)),
                              'joins': joins, 'handle': e.dxf.handle, 'src': src})
            elif e.dxftype() == 'INSERT':
                name = e.dxf.name
                if 'DIS-ENR' in name:
                    k = 'riprap'
                elif lay in ('_S02_PH-Planta',) or lay.startswith('DRE_PH_CX'):
                    k = 'culvert'
                else:
                    continue
                c = (e.dxf.insert.x, e.dxf.insert.y)
                key = ('p', round(c[0]), round(c[1]))
                if key in seen:
                    continue
                seen.append(key)
                r = axes.at(*c)
                if not r[0] or r[3] > 1500:
                    continue
                att = {}
                try:
                    att = {a.dxf.tag: a.dxf.text for a in e.attribs}
                except Exception:
                    pass
                rch = next((re.sub(r'^CH\s*=\s*', '', v) for v in att.values() if re.match(r'^\s*CH\s*=', v)), None)
                what = next((v for v in att.values() if re.search(r'PIPE|BOX|\d', v) and not re.match(r'^\s*CH', v)), None)
                items.append({'kind': k, 'sub': r[0], 'near': [r1(r[1]), r1(r[2])], 'block': None if name.startswith('*') else name,
                              'what': what, 'road_ch': rch, 'handle': e.dxf.handle, 'src': src})
    # each to the road crossing nearest where it comes closest to the line
    cross = [r for r in refs if r['kind'] in ('overpass', 'underpass', 'crossing')]
    for it in items:
        ch = it['near'][0]
        best = min(cross, key=lambda r: abs(r['ch'] - ch), default=None)
        it['road'] = best['id'] if best and abs(best['ch'] - ch) <= 1000 else None
    return items


def load_refs():
    src = open(os.path.join(ROOT, 'data', 'structures.js')).read()
    j = json.loads(src[src.index('=') + 1:src.index(';\n')])
    out = []
    for sub, v in j.items():
        for s in v['structures']:
            out.append(dict(s, sub=sub, ch=s.get('ch', (s['ch0'] + s['ch1']) / 2)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--t6', nargs='*', default=[])
    ap.add_argument('--rail', nargs='*', default=[])
    ap.add_argument('--roads', nargs='*', default=[])
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'networks.json'))
    a = ap.parse_args()
    split = lambda s: s.split('=', 1) if '=' in s else (s, re.sub(r'\.dxf$', '', os.path.basename(s)))  # noqa: E731
    axes = Axes()
    legs, nodes = t6([split(p) for p in a.t6], axes)
    rail = railway([split(p) for p in a.rail], axes)
    rd = roads([split(p) for p in a.roads], axes, load_refs(), rail)
    json.dump({'source': 'scripts/dwg/extract_networks.py', 't6': legs, 'manholes': nodes, 'roads': rd}, open(a.out, 'w'))
    print('Type 6 legs', len(legs), 'of', round(sum(l['len'] for l in legs)), 'm;', sum(1 for l in legs if l['kind'] == 'pipe'), 'collector pipes;', len(nodes), 'manholes')
    print('road drains', sum(1 for i in rd if i['kind'] == 'drain'), 'of', round(sum(i.get('len', 0) for i in rd)), 'm;',
          sum(1 for i in rd if i['kind'] == 'riprap'), 'riprap dissipators;', sum(1 for i in rd if i['kind'] == 'culvert'), 'road culverts;',
          sum(len(i.get('joins', [])) for i in rd), 'ends on a railway ditch;', sum(1 for i in rd if not i['road']), 'not near a crossing')


if __name__ == '__main__':
    main()
