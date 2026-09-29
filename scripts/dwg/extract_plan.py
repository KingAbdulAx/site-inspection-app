"""
Extract drainage from the design CAD (plan) into chainage, side and offset.

    python3 scripts/dwg/extract_plan.py \
        --drn  S02-DRN-LONG.dxf  --axis S02-TRA-PLAT.dxf \
        --sub DWKZ --out data/dwg/DWKZ_plan.json

Inputs are DXF converted from the project DWGs (see scripts/dwg/README.md):
  *-DRN-LONG     longitudinal drainage, one layer per type (DRN_DITCH_TYPE12 ...)
  *-TRA-PLAT     track plan: 25 m ticks (block S11, layer TRA-H-GTR_km-tick)
                 and 100 m chainage labels (block S35, attribute '19+800')

Nothing is interpreted from symbols: the type comes from the layer name, the
position from the drawn geometry (UTM 32N), and chainage/offset from the
official ticks. Left is positive when facing increasing chainage.
"""
import argparse
import collections
import json
import math
import re
import sys

import ezdxf
import numpy as np

# ------------------------------------------------------------------ layers
DITCH_LAYERS = {
    'DRN_DITCH_TYPE1': 'T1', 'DRN_DITCH_TYPE2': 'T2', 'DRN_DITCH_TYPE4': 'T4', 'DRN_DITCH_TYPE5': 'T5',
    'DRN_DITCH_TYPE6': 'T6', 'DRN_DITCH_TYPE7': 'T7', 'DRN_DITCH_TYPE8': 'T8', 'DRN_DITCH_TYPE9': 'T9',
    'DRN_DITCH_TYPE11': 'T11', 'DRN_DITCH_TYPE12': 'T12', 'DRN_DITCH_TYPE13': 'T13', 'DRN_DITCH_TYPE14': 'T14',
    'DRN_DITCH_TYPE15': 'T15', 'DRN_DITCH_TYPE16': 'T16',
}
POINT_LAYERS = {
    'DRN_DISSIPATOR': 'dissipator', 'DRN_MANHOLE_GRID_COVER': 'manhole_grid', 'MH': 'manhole',
    'DRN_PASS': 'water_passage', 'DRN_PIPE': 'pipe', 'DRN_BOXTRAPTRI': 'connection_box',
    'DRN_CONNECTION_BOX_1': 'connection_box', 'DRN_CONNECTION_BOX_2': 'connection_box',
    'DRN_CONNECTION_BOX_3': 'connection_box', 'DRN_CONNECTION_BOX_4': 'connection_box',
    'DRN_CONNECTION_BOX_5': 'connection_box', 'DRN_CONNECTION_BOX_6': 'connection_box',
}
RIPRAP_HATCH_LAYERS = {'Enrochement_Talus': 'riprap_slope', 'OUTLET-PROTECTION_HATCH': 'outlet_protection',
                       'Enrochement_Talus_BRIDGES': 'riprap_bridge'}
CH_RE = re.compile(r'^\s*(\d{1,3})\+(\d{3}(?:[.,]\d+)?)\s*$')


def xy(v):
    return (float(v[0]), float(v[1])) if not hasattr(v, 'x') else (float(v.x), float(v.y))


# ------------------------------------------------------------------ axis
class Axis:
    """Official chainage axis rebuilt from the 25 m ticks and 100 m labels."""

    def __init__(self, ch, pts):
        self.ch = np.asarray(ch, float)
        self.p = np.asarray(pts, float)
        d = np.diff(self.p, axis=0)
        self.seg = d
        self.seglen2 = (d ** 2).sum(1)

    @classmethod
    def from_dxf(cls, path, log):
        doc = ezdxf.readfile(path)
        msp = doc.modelspace()
        ticks = np.array([xy(t.dxf.insert) for t in msp.query('INSERT') if t.dxf.layer == 'TRA-H-GTR_km-tick' and t.dxf.name == 'S11'])
        labels = []
        for t in msp.query('INSERT'):
            if t.dxf.name != 'S35':
                continue
            for a in t.attribs:
                m = CH_RE.match(a.dxf.text or '')
                if m:
                    labels.append((int(m.group(1)) * 1000 + float(m.group(2).replace(',', '.')), xy(t.dxf.insert)))
        log(f'axis: {len(ticks)} ticks (25 m), {len(labels)} chainage labels (100 m)')
        # The same tick drawn twice (S03 has two) would make a zero-length step.
        keep = []
        for i, t in enumerate(ticks):
            if not keep or np.min(np.hypot(*(ticks[keep] - t).T)) > 0.5:
                keep.append(i)
        if len(keep) < len(ticks):
            log(f'  dropped {len(ticks) - len(keep)} duplicate ticks')
            ticks = ticks[keep]
        order = cls._chain(ticks)
        ticks = ticks[order]
        steps = np.hypot(*np.diff(ticks, axis=0).T)
        if np.any(np.abs(steps - 25) > 0.5):
            bad = np.where(np.abs(steps - 25) > 0.5)[0]
            log(f'  warning: {len(bad)} tick gaps not 25 m, e.g. {[round(float(steps[i]), 2) for i in bad[:5]]}')
        # Index by distance so a missing tick (a 50 m gap) still counts as two steps.
        idx = np.concatenate([[0], np.cumsum(np.round(steps / 25.0))]).astype(int)
        # Anchor and direction: each label votes for the chainage of tick 0 through its
        # nearest tick, once assuming chainage grows along the chain and once against it.
        best = None
        for sgn in (1, -1):
            votes = collections.Counter()
            for c, p in labels:
                i = int(np.argmin(np.hypot(*(ticks - p).T)))
                votes[round(c - sgn * 25 * idx[i], 1)] += 1
            c0, n = votes.most_common(1)[0]
            if best is None or n > best[1]:
                best = (c0, n, sgn, votes)
        c0, n, sgn, votes = best
        log(f'  tick 0 = {fmt(c0)}, chainage {"grows" if sgn > 0 else "falls"} along the chain; agreed by {n} of {len(labels)} labels; next {votes.most_common(3)[1:]}')
        ch = c0 + sgn * 25 * idx
        off = []
        for c, p in labels:
            i = int(np.argmin(np.hypot(*(ticks - p).T)))
            if abs(ch[i] - c) > 1 and len(off) < 40:
                off.append((fmt(c), fmt(ch[i]), round(float(np.min(np.hypot(*(ticks - p).T))), 1)))
        if off:
            log(f'  labels that disagree (label, axis there, distance to tick m): {off[:20]}')
        if sgn < 0:
            ch, ticks = ch[::-1], ticks[::-1]
        return cls(ch, ticks)

    @staticmethod
    def _chain(pts):
        """Order ticks into one chain by walking nearest neighbours from an end."""
        n = len(pts)
        # an end is the point farthest from the centroid
        start = int(np.argmax(np.hypot(*(pts - pts.mean(0)).T)))
        left = np.ones(n, bool)
        order = [start]
        left[start] = False
        cur = start
        for _ in range(n - 1):
            d = np.hypot(*(pts - pts[cur]).T)
            d[~left] = np.inf
            cur = int(np.argmin(d))
            left[cur] = False
            order.append(cur)
        return np.array(order)

    def orient(self, labels_ok=True):
        return self

    def project(self, P):
        """Chainage and signed offset (left +) of points P (N,2)."""
        P = np.atleast_2d(np.asarray(P, float))
        a = self.p[:-1]
        out_ch = np.empty(len(P))
        out_off = np.empty(len(P))
        for k, q in enumerate(P):
            t = ((q - a) * self.seg).sum(1) / self.seglen2
            t = np.clip(t, 0, 1)
            proj = a + self.seg * t[:, None]
            d2 = ((q - proj) ** 2).sum(1)
            i = int(np.argmin(d2))
            cross = self.seg[i, 0] * (q[1] - a[i, 1]) - self.seg[i, 1] * (q[0] - a[i, 0])
            out_ch[k] = self.ch[i] + t[i] * (self.ch[i + 1] - self.ch[i])
            out_off[k] = math.copysign(math.sqrt(d2[i]), cross)
        return out_ch, out_off


def fmt(m, d=0):
    km = int(m // 1000)
    return f'{km}+{m - km * 1000:0{4 + d if d else 3}.{d}f}'


# ------------------------------------------------------------------ extract
def densify(pts, step=2.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        n = max(1, int(L // step))
        for k in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    return out


def run_record(kind, code, layer, handle, pts, axis, extra=None):
    dens = densify(pts)
    ch, off = axis.project(dens)
    med = float(np.median(off))
    rec = {
        'kind': kind, 'code': code, 'layer': layer, 'handle': handle,
        'ch0': round(float(ch.min()), 2), 'ch1': round(float(ch.max()), 2),
        'side': 'C' if abs(med) < 1.75 else ('L' if med > 0 else 'R'),
        'offset': round(abs(med), 2), 'offset_min': round(float(np.abs(off).min()), 2), 'offset_max': round(float(np.abs(off).max()), 2),
        'drawn_length': round(sum(math.dist(a, b) for a, b in zip(pts, pts[1:])), 1),
        'x0y0': [round(pts[0][0], 3), round(pts[0][1], 3)], 'x1y1': [round(pts[-1][0], 3), round(pts[-1][1], 3)],
    }
    # A run that crosses the track or wanders far is flagged for review.
    if (off.max() > 1.75 and off.min() < -1.75):
        rec['flag'] = 'crosses the axis'
    elif rec['offset_max'] - rec['offset_min'] > 15 and kind == 'ditch':
        rec['flag'] = f"offset varies {rec['offset_min']}–{rec['offset_max']} m"
    if extra:
        rec.update(extra)
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--drn', required=True)
    ap.add_argument('--axis', required=True)
    ap.add_argument('--sub', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--max-offset', type=float, default=200.0, help='ignore geometry farther than this from the axis (m)')
    args = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr)

    axis = Axis.from_dxf(args.axis, log)
    doc = ezdxf.readfile(args.drn)
    msp = doc.modelspace()
    feats, skipped = [], collections.Counter()

    for e in msp.query('LWPOLYLINE POLYLINE LINE'):
        lay = e.dxf.layer
        if lay in DITCH_LAYERS:
            pts = [xy(p) for p in (e.get_points('xy') if e.dxftype() == 'LWPOLYLINE' else (e.points() if e.dxftype() == 'POLYLINE' else [e.dxf.start, e.dxf.end]))]
            if len(pts) < 2:
                continue
            r = run_record('ditch', DITCH_LAYERS[lay], lay, e.dxf.handle, pts, axis)
            if r['offset'] > args.max_offset:
                skipped['far from axis'] += 1
                continue
            feats.append(r)
        elif lay == 'MH' and e.dxftype() == 'LWPOLYLINE' and e.closed:
            # S03 draws manholes as closed squares rather than blocks: one point at the centre.
            q = [xy(v) for v in e.get_points('xy')]
            p = (sum(v[0] for v in q) / len(q), sum(v[1] for v in q) / len(q))
            ch, off = axis.project([p])
            o = float(off[0])
            if abs(o) > args.max_offset:
                skipped['far from axis'] += 1
                continue
            feats.append({'kind': 'point', 'code': 'manhole', 'layer': lay, 'block': None, 'handle': e.dxf.handle,
                          'ch0': round(float(ch[0]), 2), 'ch1': round(float(ch[0]), 2),
                          'side': 'C' if abs(o) < 1.75 else ('L' if o > 0 else 'R'), 'offset': round(abs(o), 2),
                          'xy': [round(p[0], 3), round(p[1], 3)]})
        elif lay == 'DRN_WATER_DISCHARGE' and (e.dxftype() == 'LINE' or (e.dxftype() == 'LWPOLYLINE' and len(e) == 2)):
            # A descent is one straight stroke down the slope: a LINE, or (S03) a two-point polyline.
            a, b = (xy(e.dxf.start), xy(e.dxf.end)) if e.dxftype() == 'LINE' else tuple(xy(v) for v in e.get_points('xy'))
            ch, off = axis.project([a, b])
            mid_ch = float(ch.mean())
            feats.append({'kind': 'descent', 'code': 'WD', 'layer': lay, 'handle': e.dxf.handle,
                          'ch0': round(mid_ch, 2), 'ch1': round(mid_ch, 2),
                          'side': 'L' if off.mean() > 0 else 'R', 'offset': round(float(np.abs(off).mean()), 2),
                          'offset_min': round(float(np.abs(off).min()), 2), 'offset_max': round(float(np.abs(off).max()), 2),
                          'drawn_length': round(math.dist(a, b), 1)})
    for e in msp.query('INSERT'):
        lay = e.dxf.layer
        if lay in POINT_LAYERS:
            p = xy(e.dxf.insert)
            ch, off = axis.project([p])
            if abs(off[0]) > args.max_offset:
                skipped['far from axis'] += 1
                continue
            o = float(off[0])
            feats.append({'kind': 'point', 'code': POINT_LAYERS[lay], 'layer': lay, 'block': e.dxf.name, 'handle': e.dxf.handle,
                          'ch0': round(float(ch[0]), 2), 'ch1': round(float(ch[0]), 2),
                          'side': 'C' if abs(o) < 1.75 else ('L' if o > 0 else 'R'), 'offset': round(abs(o), 2),
                          'xy': [round(p[0], 3), round(p[1], 3)]})
    for e in msp.query('HATCH'):
        lay = e.dxf.layer
        if lay not in RIPRAP_HATCH_LAYERS:
            continue
        pts = []
        for path in e.paths:
            if hasattr(path, 'vertices'):
                pts += [xy(v) for v in path.vertices]
            else:
                for ed in getattr(path, 'edges', []):
                    for attr in ('start', 'end'):
                        if hasattr(ed, attr):
                            pts.append(xy(getattr(ed, attr)))
        if len(pts) < 3:
            continue
        ch, off = axis.project(pts)
        med = float(np.median(off))
        if abs(med) > args.max_offset:
            skipped['far from axis'] += 1
            continue
        feats.append({'kind': 'riprap', 'code': RIPRAP_HATCH_LAYERS[lay], 'layer': lay, 'handle': e.dxf.handle,
                      'ch0': round(float(ch.min()), 2), 'ch1': round(float(ch.max()), 2),
                      'side': 'C' if abs(med) < 1.75 else ('L' if med > 0 else 'R'), 'offset': round(abs(med), 2),
                      'offset_min': round(float(np.abs(off).min()), 2), 'offset_max': round(float(np.abs(off).max()), 2)})

    # Notes (length and gradient) attach to the nearest ditch run.
    notes = []
    for m in msp.query('MULTILEADER'):
        try:
            txt = m.context.mtext.default_content if m.context.mtext else ''
            lines = m.context.leaders[0].lines if m.context.leaders else []
            tip = xy(lines[0].vertices[0]) if lines and lines[0].vertices else xy(m.context.mtext.insert)
        except Exception:
            continue
        txt = re.sub(r'\\P', ' ', txt or '').strip()
        ch, off = axis.project([tip])
        # S02 writes 'L:125m / i:0.3%', S03 'L=28M / I:0.10%'.
        L = re.search(r'\bL\s*[:=]\s*([\d.]+)\s*m', txt, re.I)
        i = re.search(r'\bi\s*[:=]\s*([\d.]+)\s*%', txt, re.I)
        notes.append({'text': txt, 'ch': round(float(ch[0]), 2), 'offset': round(float(off[0]), 2),
                      'stated_length': float(L.group(1)) if L else None, 'gradient_pct': float(i.group(1)) if i else None})
    # Riprap callouts ("SLOPE PROTECTION L:28m / D50=100mm") become riprap label
    # features; ditch notes ("HALF ROUND LINED DITCH L:125m / i:0.3%") attach to
    # the ditch run they point at. One run can carry several notes, one per slope.
    ditches = [f for f in feats if f['kind'] == 'ditch']
    for n in notes:
        t = re.sub(r'\\[A-Za-z][^;]*;|[{}]', '', n['text']).upper()
        n['clean'] = re.sub(r'\s+', ' ', t).strip()
        if 'SLOPE PROTECTION' in t or 'RIPRAP' in t:
            d50 = re.search(r'=\s*(\d+)\s*MM', t)
            o = n['offset']
            feats.append({'kind': 'riprap_note', 'code': 'RIP', 'layer': 'Notes_Longitudinal', 'handle': None,
                          'ch0': n['ch'], 'ch1': n['ch'], 'side': 'C' if abs(o) < 1.75 else ('L' if o > 0 else 'R'),
                          'offset': round(abs(o), 2), 'stated_length': n['stated_length'], 'd50_mm': int(d50.group(1)) if d50 else None,
                          'text': n['clean']})
            continue
        if 'DITCH' not in t:
            continue
        best, bd = None, 1e9
        for f in ditches:
            if f['ch0'] - 5 <= n['ch'] <= f['ch1'] + 5 and (f['side'] == ('L' if n['offset'] > 0 else 'R')):
                d = abs(abs(n['offset']) - f['offset'])
                if d < bd:
                    best, bd = f, d
        if best is not None and bd < 8:
            # A long run is called out once per plan sheet it crosses, with the same text: count it once.
            if n['clean'] in best.get('notes', []):
                continue
            best.setdefault('notes', []).append(n['clean'])
            best['noted_length'] = round(best.get('noted_length', 0) + (n['stated_length'] or 0), 1)
            if n['gradient_pct'] is not None:
                best.setdefault('gradients_pct', []).append(n['gradient_pct'])

    feats.sort(key=lambda f: (f['ch0'], f['side']))
    out = {
        'sub': args.sub, 'crs': 'EPSG:32632 (WGS84 UTM 32N)',
        'source': {'drainage': args.drn, 'axis': args.axis},
        'axis': {'ch_start': float(axis.ch[0]), 'ch_end': float(axis.ch[-1]), 'ticks': len(axis.ch),
                 'points': [[round(float(c), 1), round(float(p[0]), 3), round(float(p[1]), 3)] for c, p in zip(axis.ch, axis.p)]},
        'counts': dict(collections.Counter(f"{f['kind']}:{f['code']}" for f in feats)),
        'skipped': dict(skipped), 'notes_total': len(notes),
        'features': feats,
    }
    with open(args.out, 'w') as fh:
        json.dump(out, fh, indent=1)
    log(f"wrote {len(feats)} features to {args.out}")
    for k, v in sorted(out['counts'].items()):
        log(f'  {v:5} {k}')
    if skipped:
        log(f'  skipped: {dict(skipped)}')
    flagged = [f for f in feats if f.get('flag')]
    log(f'  flagged for review: {len(flagged)}')


if __name__ == '__main__':
    main()
