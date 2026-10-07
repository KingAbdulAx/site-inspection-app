"""
Rebuild a sub-section's centreline in the app bundle from the CAD chainage axis.

The axis is the official 25 m ticks on the track plan (see extract_plan.py),
so the line the phone projects GPS onto is the design line itself. The app
stores features by chainage, side and offset, so they keep their chainages
and are simply drawn in the right place.

    python3 scripts/dwg/centreline_from_cad.py --plan data/dwg/KZDR_plan.json \
        --lead data/dwg/DWKZ_plan.json --bundle data/bundle.js --var SECTION03_CENTERLINE \
        --start 82800 --section "Section 03: Kazaure to Daura (KZDR)"

--lead takes the neighbouring sub-section's axis to fill the chainage before
this plan's first tick (the two track plans meet between ticks). --tail and
--end do the same at the far end: S03's track plan stops at 124+500, and its
sub-section runs on to 124+521, so the S04 axis fills those 21 m.
"""
import argparse
import json
import math
import re
import sys

import numpy as np
from pyproj import Geod, Transformer


def fmt(m):
    sign, m = ('-', -m) if m < 0 else ('', m)
    km = int(m // 1000)
    return f'{sign}{km}+{m - km * 1000:03.0f}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plan', required=True)
    ap.add_argument('--lead', help='neighbouring plan extraction whose axis fills the start')
    ap.add_argument('--bundle', required=True)
    ap.add_argument('--var', required=True)
    ap.add_argument('--start', type=float, required=True, help='first chainage to write')
    ap.add_argument('--section', required=True)
    ap.add_argument('--tail', help='neighbouring plan extraction whose axis fills the end')
    ap.add_argument('--end', type=float, help='last chainage to write (with --tail)')
    ap.add_argument('--step', type=float, default=25.0)
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr)

    plan = json.load(open(a.plan))
    pts = [tuple(p) for p in plan['axis']['points']]
    if a.lead:
        lead = [tuple(p) for p in json.load(open(a.lead))['axis']['points'] if a.start - 1 <= p[0] < pts[0][0]]
        log(f'lead-in from {a.lead}: {len(lead)} ticks ({fmt(lead[0][0])} → {fmt(lead[-1][0])})' if lead else 'no lead-in ticks')
        pts = lead + pts
    if a.tail and a.end is not None:
        last = pts[-1][0]
        tail = [tuple(p) for p in json.load(open(a.tail))['axis']['points'] if last < p[0] <= a.end + 25]
        log(f'tail from {a.tail}: {len(tail)} ticks ({fmt(tail[0][0])} → {fmt(tail[-1][0])})' if tail else 'no tail ticks')
        pts = pts + tail
    ch = np.array([p[0] for p in pts])
    xy = np.array([(p[1], p[2]) for p in pts])
    order = np.argsort(ch)
    ch, xy = ch[order], xy[order]
    # Every tick should be 25 m of chainage and about 25 m of ground apart.
    dch = np.diff(ch)
    dxy = np.hypot(*np.diff(xy, axis=0).T)
    bad = np.where(np.abs(dxy - dch) > 0.5)[0]
    log(f'{len(ch)} ticks {fmt(ch[0])} → {fmt(ch[-1])}; steps of {sorted(set(np.round(dch).astype(int)))} m; '
        f'{len(bad)} where ground and chainage differ by > 0.5 m' + (f', e.g. {[(fmt(ch[i]), round(float(dch[i]), 1), round(float(dxy[i]), 2)) for i in bad[:5]]}' if len(bad) else ''))

    end = float(ch[-1]) if a.end is None else min(float(ch[-1]), a.end)
    want = np.arange(a.start, end + 0.01, a.step)
    if want[-1] < end - 0.01:
        want = np.append(want, end)
    # Linear along the ticks; straight extension before the first one.
    x = np.interp(want, ch, xy[:, 0], left=np.nan)
    y = np.interp(want, ch, xy[:, 1], left=np.nan)
    pre = want < ch[0]
    if pre.any():
        u = (xy[1] - xy[0]) / np.hypot(*(xy[1] - xy[0]))
        x[pre] = xy[0, 0] + u[0] * (want[pre] - ch[0])
        y[pre] = xy[0, 1] + u[1] * (want[pre] - ch[0])
        log(f'extended straight back from {fmt(ch[0])} to {fmt(want[0])}')

    to_ll = Transformer.from_crs(32632, 4326, always_xy=True)
    lon, lat = to_ll.transform(x, y)
    geod = Geod(ellps='WGS84')
    brg = []
    for i in range(len(want)):
        j0, j1 = max(0, i - 1), min(len(want) - 1, i + 1)
        az, _, _ = geod.inv(lon[j0], lat[j0], lon[j1], lat[j1])
        brg.append(round(az % 360, 2))
    dense = [{'pk': round(float(c), 3), 'lon': round(float(o), 7), 'lat': round(float(t), 7), 'bearing': b} for c, o, t, b in zip(want, lon, lat, brg)]

    def tick(p, major):
        lab = fmt(p['pk'])
        return dict(pk=p['pk'], label=lab, full_label='PK ' + lab, lon=p['lon'], lat=p['lat'], bearing=p['bearing'], is_major=major)
    t100 = [tick(p, False) for p in dense if abs(p['pk'] / 100 - round(p['pk'] / 100)) < 1e-6]
    t1k = [tick(p, True) for p in dense if abs(p['pk'] / 1000 - round(p['pk'] / 1000)) < 1e-6]
    arc = float(np.hypot(*np.diff(np.c_[x, y], axis=0).T).sum())
    cl = {
        'metadata': {
            'section': a.section, 'start_pk': float(want[0]), 'end_pk': end, 'total_points': len(dense), 'step_meters': a.step,
            'interpolation': 'CAD track plan 25 m ticks (block S11, layer TRA-H-GTR_km-tick), chained and anchored by the 100 m labels; linear between ticks',
            'source_model': plan['source']['axis'].split('/')[-1] + (' (+ lead-in ' + a.lead.split('/')[-1] + ')' if a.lead else '') + (' (+ tail ' + a.tail.split('/')[-1] + ')' if a.tail else ''),
            'crs_source': 'EPSG:32632 (WGS84 UTM 32N)', 'arc_length_m': round(arc, 3),
            'generated_at': 'September 2026', 'datum': 'WGS84',
        },
        'dense_points': dense, 'ticks_100m': t100, 'ticks_1km': t1k,
        'geojson': {'type': 'FeatureCollection', 'features': [{'type': 'Feature',
                    'properties': {'name': 'Kano-Maradi Railway Centerline (' + a.section.split(':')[0] + ' - CAD axis)', 'start_pk': float(want[0]), 'end_pk': end},
                    'geometry': {'type': 'LineString', 'coordinates': [[p['lon'], p['lat']] for p in dense]}}]},
    }

    src = open(a.bundle).read()
    m = re.search(r'window\.' + re.escape(a.var) + r' = .*?;\n(?=\nwindow\.)', src, re.S)
    if not m:
        sys.exit(f'{a.var} block not found in {a.bundle}')
    src = src[:m.start()] + 'window.' + a.var + ' = ' + json.dumps(cl, indent=2) + ';\n' + src[m.end():]
    open(a.bundle, 'w').write(src)
    log(f'wrote {a.var}: {len(dense)} points {fmt(want[0])} → {fmt(end)}, arc {arc:.1f} m, into {a.bundle}')


if __name__ == '__main__':
    main()
