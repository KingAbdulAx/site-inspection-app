"""
Type 1 side ditches come in two sizes, and the DRN-LONG drawings tell them apart only by the line: the normal
one (b = 0.75 m, h = 0.75 m, 1:1) is drawn as a thin polyline on DRN_DITCH_TYPE1, the larger one (B = 4.0 to
4.5 m, H = 0.60 m, 1:2; 'Type 1 Larger' in the asset register, the app's T1L) with a constant width
(0.2 to 0.3). The larger one carries on where a normal one ends, a little further out, towards an outlet.

    python3 scripts/dwg/extract_t1_large.py S01-DRN-LONG.dxf S02-DRN-LONG.dxf ... S05-DRN-LONG.dxf
    node scripts/dwg/bundle_structures.js        # puts them in data/structures.js (KMD_T1_LARGE)

Each drawing converted with dwg2dxf, then scripts/dwg/fix_dxf.py. Writes data/dwg/t1_large.json: every Type 1
polyline with its handle, chainage, side and width, and whether it is the larger one.
"""
import json
import math
import os
import re
import sys

import ezdxf

sys.path.insert(0, os.path.dirname(__file__))
from extract_stations import Axes, pts  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
WIDE = 0.15     # constant width above which the polyline is the larger Type 1
r1 = lambda v: round(v, 1)  # noqa: E731


def main():
    axes = Axes()
    runs = []
    for path in sys.argv[1:]:
        src = re.sub(r'\.dxf$', '', os.path.basename(path))
        doc = ezdxf.readfile(path)
        for e in doc.modelspace().query('LWPOLYLINE POLYLINE'):
            if e.dxf.layer != 'DRN_DITCH_TYPE1':
                continue
            p = pts(e)
            if len(p) < 2:
                continue
            w = e.dxf.const_width if e.dxftype() == 'LWPOLYLINE' else e.dxf.default_start_width
            pr = [axes.at(x, y) for x, y in p]
            n = sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) for i in range(len(p) - 1))
            if n < 1:
                continue
            off = sum(q[2] for q in pr) / len(pr)
            runs.append({'src': src, 'sub': axes.sub_at((pr[0][1] + pr[-1][1]) / 2), 'handle': e.dxf.handle,
                         'ch0': r1(min(q[1] for q in pr)), 'ch1': r1(max(q[1] for q in pr)), 'side': 'L' if off >= 0 else 'R',
                         'off': r1(off), 'len': r1(n), 'width': round(w or 0, 2), 'large': (w or 0) > WIDE})
    runs.sort(key=lambda r: r['ch0'])
    json.dump({'source': 'DRN_DITCH_TYPE1 of the DRN-LONG drawings', 'wide_from': WIDE, 'runs': runs},
              open(os.path.join(ROOT, 'data', 'dwg', 't1_large.json'), 'w'), indent=0)
    big = [r for r in runs if r['large']]
    print('Type 1 polylines', len(runs), '; larger', len(big), 'of', round(sum(r['len'] for r in big)), 'm; normal',
          round(sum(r['len'] for r in runs if not r['large'])), 'm')


if __name__ == '__main__':
    main()
