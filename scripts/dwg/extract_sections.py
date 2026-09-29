"""
Extract the cross sections from the alignment CAD.

    python3 scripts/dwg/extract_sections.py --xs S02-ALG-CROSS-SECTIONS.dxf \
        --sub DWKZ --plan data/dwg/DWKZ_plan.json \
        --out data/dwg/DWKZ_sections.json --app data/sections_DWKZ.json

Each section panel in model space carries its chainage (block S985,
'Pk=22+875'); the panel's centreline is the label's x. Around it:
  S591  'HEIGHT TO THE LRL: 5.29m'     S7002 'L=11.15' (toe distances)
  S7008 '1:1.50' (slopes)              S594/S595 '4.0%' (cross-falls)
  L68 slopes · L45/L46 platform layers · L66 ground
  L50 toe-ditch excavation · L320/L431 concrete lining
  L446/L176 Type 1 side ditch · L168 crest ditch
Layer roles were confirmed against the plan drainage, section by section.
Sections are drawn looking up-chainage: left of the centreline is negative x.
"""
import argparse
import bisect
import collections
import json
import math
import re
import sys

import numpy as np
from ezdxf import recover

LAYER_ROLE = {
    'L68': 'slope', 'L45': 'platform', 'L46': 'platform', 'L67': 'platform', 'L66': 'ground',
    'L50': 'toe_ditch', 'L320': 'lining', 'L431': 'lining', 'L446': 'side_ditch', 'L176': 'side_ditch', 'L168': 'crest_ditch',
}
PROFILE_ROLES = ('slope', 'platform', 'ground', 'toe_ditch', 'lining', 'side_ditch', 'crest_ditch')
# S02 labels sections 'Pk=19+825.000', S03 'CH=82+925.000'.
PK_RE = re.compile(r'\s*(?:Pk|CH)\s*=\s*(\d+)\+(\d+(?:[.,]\d+)?)', re.I)
NUM_RE = re.compile(r'([\d.]+)')


def load(path, log):
    doc, aud = recover.readfile(path)
    log(f'{path}: read, {len(aud.errors)} audit errors')
    msp = doc.modelspace()
    ents = []
    for e in msp:
        t = e.dxftype()
        try:
            if t == 'LWPOLYLINE':
                ents.append((e.dxf.layer, 'poly', np.array([(p[0], p[1]) for p in e.get_points('xy')]), None))
            elif t == 'LINE':
                ents.append((e.dxf.layer, 'poly', np.array([(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]), None))
            elif t == 'INSERT':
                txt = [a.dxf.text for a in e.attribs]
                ents.append((e.dxf.layer, 'ins', np.array([(e.dxf.insert.x, e.dxf.insert.y)]), (e.dxf.name, txt[0] if txt else '')))
        except Exception:
            pass
    return ents


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xs', required=True)
    ap.add_argument('--sub', required=True)
    ap.add_argument('--plan', help='plan extraction, for the cross-check')
    ap.add_argument('--out', required=True)
    ap.add_argument('--app', help='compact file the app draws its Section view from')
    ap.add_argument('--half-width', type=float, default=35.0, help='profile kept within ± this of the centreline (m)')
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr)
    ents = load(a.xs, log)

    labels = []
    for L, t, P, ex in ents:
        if t == 'ins' and ex[0] == 'S985':
            m = PK_RE.match(ex[1] or '')
            if m:
                labels.append((int(m.group(1)) * 1000 + float(m.group(2).replace(',', '.')), float(P[0, 0]), float(P[0, 1])))
    labels.sort(key=lambda l: l[2])
    ly = np.array([l[2] for l in labels])
    lx = np.array([l[1] for l in labels])
    log(f'{len(labels)} sections, {fmt(min(l[0] for l in labels))} → {fmt(max(l[0] for l in labels))}')

    def panel(x, y):
        lo = bisect.bisect_left(ly, y - 45)
        hi = bisect.bisect_right(ly, y + 6)
        best, bd = None, 90.0
        for i in range(lo, hi):
            d = abs(x - lx[i])
            if d <= bd:
                best, bd = i, d
        return best

    sec = [{'ch': l[0], 'items': collections.defaultdict(list), 'ins': []} for l in labels]
    for L, t, P, ex in ents:
        c = P.mean(0)
        i = panel(c[0], c[1])
        if i is None:
            continue
        if t == 'poly' and L in LAYER_ROLE:
            sec[i]['items'][LAYER_ROLE[L]].append(P - [lx[i], ly[i]])
        elif t == 'ins' and ex[0] in ('S591', 'S7002', 'S7008', 'S594', 'S595'):
            sec[i]['ins'].append((ex[0], ex[1], float(P[0, 0] - lx[i])))

    out, app = [], []
    for s in sec:
        it = s['items']
        rec = {'ch': round(s['ch'], 3)}
        for name, txt, dx in s['ins']:
            if name == 'S591':
                m = NUM_RE.search(txt.split(':')[-1])
                if m:
                    rec['height'] = float(m.group(1))
            elif name == 'S7002':
                m = NUM_RE.search(txt)
                if m:
                    rec.setdefault('L_left' if dx < 0 else 'L_right', []).append(float(m.group(1)))
        # platform top level, for a stable vertical reference
        plat = [p for p in it.get('platform', []) if len(p)]
        ref = float(np.max(np.concatenate(plat)[:, 1])) if plat else 0.0
        ditches = []
        for role, group in (('toe_ditch', 'toe'), ('side_ditch', 'side'), ('crest_ditch', 'crest')):
            for P in it.get(role, []):
                w = float(np.ptp(P[:, 0]))
                if w > 8 or len(P) < 3:
                    continue
                cx = float(P[:, 0].mean())
                low = P[:, 1].min()
                bottom = P[P[:, 1] < low + 0.05][:, 0]
                d = {'group': group, 'side': 'L' if cx < 0 else 'R', 'offset': round(abs(cx), 2),
                     'top_width': round(w, 2), 'depth': round(float(np.ptp(P[:, 1])), 2), 'bottom_width': round(float(np.ptp(bottom)), 2),
                     'invert': round(float(low - ref), 2)}
                lin = [q for q in it.get('lining', []) if abs(q[:, 0].mean() - cx) < 2.5]
                d['lined'] = bool(lin)
                if lin:
                    q = lin[0]
                    qlow = q[:, 1].min()
                    d['lining_bottom_width'] = round(float(np.ptp(q[q[:, 1] < qlow + 0.05][:, 0])), 2)
                d['type'] = guess(d)
                ditches.append(d)
        # side ditches are drawn twice (L446 + L176): keep one per position
        seen, uniq = set(), []
        for d in sorted(ditches, key=lambda d: (d['side'], d['offset'])):
            k = (d['side'], d['group'], round(d['offset']))
            if k not in seen:
                seen.add(k)
                uniq.append(d)
        rec['ditches'] = uniq
        out.append(rec)
        # compact profile for the app: polylines per role, relative to the platform top
        prof = {}
        for role in PROFILE_ROLES:
            lines = []
            for P in it.get(role, []):
                Q = P[(P[:, 0] > -a.half_width) & (P[:, 0] < a.half_width)]
                if len(Q) >= 2:
                    Q = simplify(Q, 0.05)
                    lines.append([[round(float(x), 2), round(float(y - ref), 2)] for x, y in Q])
            if lines:
                prof[role] = lines
        app.append({'ch': rec['ch'], 'h': rec.get('height'), 'Ll': rec.get('L_left'), 'Lr': rec.get('L_right'),
                    'd': [[d['side'], d['group'], d['offset'], d['type'], 1 if d['lined'] else 0] for d in uniq], 'p': prof})

    out.sort(key=lambda r: r['ch'])
    app.sort(key=lambda r: r['ch'])
    report = cross_check(out, a.plan, log) if a.plan else None
    with open(a.out, 'w') as fh:
        json.dump({'sub': a.sub, 'source': a.xs, 'sections': out, 'cross_check': report}, fh, indent=1)
    if a.app:
        with open(a.app, 'w') as fh:
            json.dump({'sub': a.sub, 'sections': app}, fh, separators=(',', ':'))
    n = collections.Counter(d['type'] for r in out for d in r['ditches'])
    log(f'wrote {len(out)} sections; ditches by type {dict(n)}; with height {sum(1 for r in out if "height" in r)}')


def guess(d):
    if d['group'] == 'side':
        return 'T1'
    if d['group'] == 'crest':
        return 'T11' if d['lined'] else 'T5'
    if not d['lined']:
        return 'T4'
    return 'T12' if d.get('lining_bottom_width', 0) > 0.8 else 'T7'


def simplify(P, tol):
    """Douglas–Peucker, enough to keep ditches and slopes, drop surveyed noise."""
    if len(P) < 3:
        return P
    a, b = P[0], P[-1]
    ab = b - a
    n = math.hypot(*ab) or 1e-9
    d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= tol:
        return np.array([a, b])
    return np.vstack([simplify(P[:i + 1], tol)[:-1], simplify(P[i:], tol)])


def cross_check(sections, plan_path, log):
    plan = [f for f in json.load(open(plan_path))['features'] if f['kind'] == 'ditch']
    GROUP = {'T1': 'side', 'T9': 'plat', 'T4': 'toe', 'T7': 'toe', 'T12': 'toe', 'T13': 'toe', 'T14': 'toe', 'T5': 'crest', 'T11': 'crest', 'T8': 'berm', 'T6': 'track'}
    res = collections.Counter()
    offs = []
    confusion = collections.Counter()
    for s in sections:
        for side in 'LR':
            for g in ('toe', 'side', 'crest'):
                p = [f for f in plan if f['side'] == side and GROUP.get(f['code']) == g and f['ch0'] + 1 <= s['ch'] <= f['ch1'] - 1]
                x = [d for d in s['ditches'] if d['side'] == side and d['group'] == g]
                if p and x:
                    res['both'] += 1
                    confusion[(p[0]['code'], x[0]['type'])] += 1
                    offs.append(x[0]['offset'] - p[0]['offset'])
                elif p:
                    res['plan_only'] += 1
                elif x:
                    res['section_only'] += 1
    agree = sum(v for (a, b), v in confusion.items() if a == b)
    rep = {'section_sides': dict(res), 'type_agreement': round(agree / max(1, res['both']), 3),
           'offset_diff_median': round(float(np.median(offs)), 2) if offs else None,
           'offset_diff_p90': round(float(np.percentile(np.abs(offs), 90)), 2) if offs else None,
           'confusion': {f'{a}->{b}': v for (a, b), v in confusion.most_common(20)}}
    log(f"cross-check with plan: {rep['section_sides']}, type agreement {rep['type_agreement']:.0%}, "
        f"offset diff median {rep['offset_diff_median']} m (90% within {rep['offset_diff_p90']} m)")
    log(f"  confusion (plan->section): {rep['confusion']}")
    return rep


def fmt(m):
    km = int(m // 1000)
    return f'{km}+{m - km * 1000:07.3f}'


if __name__ == '__main__':
    main()
