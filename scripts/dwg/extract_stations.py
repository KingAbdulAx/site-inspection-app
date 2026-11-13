"""
Stations and freight yards from the STATIONS_YARDS drawings, for reference on the strip and the map.

    python3 scripts/dwg/extract_stations.py --out data/dwg/stations.json \
        S02-SY.dxf=T2019-0323-S02-DD-STATIONS_YARDS_DAWANAU-KAZAURE \
        S03-SY.dxf=T2019-0323-S03-DD-STATIONS_YARDS_KAZAURE-DAURA \
        S04-SY.dxf=T2019-0323-S04-DD-STATIONS_YARDS_DAURA-MUDURU \
        S05-SY.dxf=T2019-0323-S05-DD-STATIONS_YARDS_MUDURU-JIBIYA \
        --yards S02-STI.dxf=T2019-0323-S02-DD-STI-DAWANAU-KAZAURE_INFRASTR
    (file=drawing: the drawing's name is kept as each one's source)
    node scripts/dwg/bundle_structures.js          # adds them to data/structures.js

The drawings are T2019-0323-S0x-DD-STATIONS_YARDS_<FROM>-<TO>.dwg (one per section, S02-S05; S01 has
none, and Kano station is drawn on the old line's DK chainage). Converted with dwg2dxf, then
scripts/dwg/fix_dxf.py. They use the same layers:

    STATION_NAME, STATION_NAME_NOTE, -<NAME>-STATION   the station's name ('DAURA STATION')
    STATION_PLATAFORM_OUTLINE   each platform: about 350 m long, 7-17 m off the main line
    STATION_LIMITS              the station's buildings and access (S04, S05): 400 m, on one side
    HORIZONTAL_GEOMETRY_STATION, SECONDARY-RAILWAYS, SIDING_TRACKS, -<NAME>-STATION lines
                                the loops and sidings: where the station's tracks are
    FREIGHT_YARD_LIMITS         a freight yard's outline, off to one side
    FREIGHT_YARD_LINES, YARD_LINES_LINES, ROLLING_STOCK_LINES, STABLING_LINES, INTEGRATED_M_CENTER_LINES
                                a yard's tracks, where the drawing has no outline (Katsina)
    '(BUILDINGS AND ROAD ACCESSES UNDER DEVELOPMENT)'   a note under the name of a station still being
                                designed; kept as 'note'
LONG-TERM layers (later stages) are left out.

Chainage and offset come from projecting onto the main-line axes of data/dwg/<SUB>_plan.json (the same
25 m ticks as the drainage): offset is positive to the left, as in the app. A station spans its
tracks: from the first turnout of its loops to the last, joined to its platforms; the platforms and
the buildings' limits are kept too. An outline is kept as [chainage, offset] pairs, so the app draws
it on the map from its own centreline.
"""
import argparse
import json
import math
import os
import re

import ezdxf
import ezdxf.entities.mtext as _mtext

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SUBS = ['KNDW', 'DWKZ', 'KZDR', 'DRMR', 'MRJB']

# Some MTEXT in these drawings carries a column type ezdxf does not know; the columns are not needed.
_cols = _mtext.load_columns_from_embedded_object


def _safe_cols(*a, **k):
    try:
        return _cols(*a, **k)
    except Exception:
        return None


_mtext.load_columns_from_embedded_object = _safe_cols


class Axes:
    """The five main-line axes, chainage and left-positive offset of any point."""

    def __init__(self):
        self.ax = {}
        for s in SUBS:
            p = os.path.join(ROOT, 'data', 'dwg', s + '_plan.json')
            if os.path.exists(p):
                self.ax[s] = [(q[1], q[2], q[0]) for q in json.load(open(p))['axis']['points']]

    @staticmethod
    def _one(P, x, y):
        i = min(range(len(P) - 1), key=lambda k: (P[k][0] - x) ** 2 + (P[k][1] - y) ** 2)
        best = None
        for j in (i - 1, i):
            if j < 0 or j >= len(P) - 1:
                continue
            (x0, y0, c0), (x1, y1, c1) = P[j], P[j + 1]
            dx, dy = x1 - x0, y1 - y0
            L = math.hypot(dx, dy) or 1
            t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / (L * L)))
            off = -((x - x0) * dy - (y - y0) * dx) / L
            d = math.hypot(x - x0 - t * dx, y - y0 - t * dy)
            if best is None or d < best[2]:
                best = (c0 + t * (c1 - c0), off, d)
        return best

    def at(self, x, y):
        """(sub, chainage, offset, distance) on the main line: the five axes joined end to end, so a
        point in the 25 m between one sub-section's axis and the next is not clamped to either end."""
        if not (math.isfinite(x) and math.isfinite(y)) or abs(x) > 1e8 or abs(y) > 1e8:
            return (None, 0.0, 0.0, 1e12)     # stray geometry far off the drawing
        if not hasattr(self, 'line'):
            self.line = sorted([p for P in self.ax.values() for p in P], key=lambda p: p[2])
            self.rng = {s: (min(p[2] for p in P), max(p[2] for p in P)) for s, P in self.ax.items()}
        ch, off, d = self._one(self.line, x, y)
        return (self.sub_at(ch), ch, off, d)

    def sub_at(self, ch):
        for s, (lo, hi) in self.rng.items():
            if lo <= ch <= hi:
                return s
        # in a gap between two axes, or past an end: the nearest one
        return min(self.rng, key=lambda s: min(abs(ch - self.rng[s][0]), abs(ch - self.rng[s][1])))


def pts(e):
    t = e.dxftype()
    if t == 'LWPOLYLINE':
        return [(v[0], v[1]) for v in e.get_points()]
    if t == 'POLYLINE':
        return [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
    if t == 'LINE':
        return [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]
    if t == 'ARC':
        c, r = e.dxf.center, e.dxf.radius
        a0, a1 = math.radians(e.dxf.start_angle), math.radians(e.dxf.end_angle)
        if a1 < a0:
            a1 += 2 * math.pi
        return [(c.x + r * math.cos(a0 + (a1 - a0) * k / 8), c.y + r * math.sin(a0 + (a1 - a0) * k / 8)) for k in range(9)]
    return []


def text(e):
    try:
        if e.dxftype() == 'TEXT':
            return e.dxf.text
        if e.dxftype() == 'MTEXT':
            return e.plain_text()
    except Exception:
        return ''
    return ''


def is_station_layer(lay):
    return bool(re.match(r'^-.*STATION$', lay))


TRACK_LAYERS = {'HORIZONTAL_GEOMETRY_STATION', 'SECONDARY-RAILWAYS', 'SIDING_TRACKS'}
YARD_TRACK_LAYERS = {'FREIGHT_YARD_LINES', 'YARD_LINES_LINES', 'ROLLING_STOCK_LINES', 'STABLING_LINES', 'INTEGRATED_M_CENTER_LINES'}


def r1(v):
    return round(v, 1)


def read(path, axes):
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    names, notes, plats, limits, tracks, yards, ytracks, ylabels = [], [], [], [], [], [], [], []
    for e in msp:
        lay = e.dxf.layer
        if 'LONG-TERM' in lay:
            continue
        s = text(e)
        if s and e.dxftype() in ('TEXT', 'MTEXT'):
            i = e.dxf.insert
            sub, ch, off, d = axes.at(i.x, i.y)
            if d > 400:
                continue        # the title block
            s1 = re.sub(r'\s+', ' ', s).strip()
            if re.search(r'\bSTATION\s*$', s1, re.I):
                names.append({'name': s1.title(), 'sub': sub, 'ch': ch, 'off': off})
            elif re.search(r'UNDER DEVELOPMENT', s1, re.I):
                notes.append({'text': s1.strip('()').capitalize(), 'ch': ch, 'off': off})
            elif re.search(r'FREIGHT YARD', s1, re.I):
                ylabels.append({'sub': sub, 'ch': ch, 'off': off, 'what': 'freight'})
            elif re.search(r'MAINTENANCE CENT', s1, re.I):
                ylabels.append({'sub': sub, 'ch': ch, 'off': off, 'what': 'maintenance'})
            continue
        p = pts(e)
        if len(p) < 2:
            continue
        pr = [r for r in (axes.at(*q) for q in p) if r[0]]
        if len(pr) < 2 or max(r[3] for r in pr) > 3000:
            continue
        sub = max(set(r[0] for r in pr), key=[r[0] for r in pr].count)
        item = {'sub': sub, 'ch0': min(r[1] for r in pr), 'ch1': max(r[1] for r in pr),
                'off0': min(r[2] for r in pr), 'off1': max(r[2] for r in pr),
                'poly': [[r1(r[1]), r1(r[2])] for r in pr], 'closed': e.dxftype() == 'LWPOLYLINE' and e.closed}
        if lay == 'STATION_PLATAFORM_OUTLINE' or (is_station_layer(lay) and 300 <= item['ch1'] - item['ch0'] <= 400 and 6 <= min(abs(item['off0']), abs(item['off1'])) and max(abs(item['off0']), abs(item['off1'])) <= 18):
            plats.append(item)
        elif lay == 'STATION_LIMITS' and max(abs(item['off0']), abs(item['off1'])) < 300:
            limits.append(item)
        elif lay == 'FREIGHT_YARD_LIMITS':
            yards.append(item)
        elif (lay in TRACK_LAYERS or is_station_layer(lay)) and max(abs(item['off0']), abs(item['off1'])) <= 40:
            if max(abs(item['off0']), abs(item['off1'])) >= 1.5:     # not the main line drawn through the sheet
                tracks.append(item)
        elif lay in YARD_TRACK_LAYERS:
            item['what'] = 'freight' if lay in ('FREIGHT_YARD_LINES', 'YARD_LINES_LINES') else 'maintenance'
            ytracks.append(item)
    return names, notes, plats, limits, tracks, yards, ytracks, ylabels


def side_of(off0, off1):
    if off0 > 0:
        return 'L'
    if off1 < 0:
        return 'R'
    return 'both'


def stations(path, axes, source):
    names, notes, plats, limits, tracks, yards, ytracks, ylabels = read(path, axes)
    out = []
    for n in names:
        # chainage runs on across the sub-sections, so a station at a boundary keeps both halves
        near = [p for p in plats if abs((p['ch0'] + p['ch1']) / 2 - n['ch']) < 600]
        pos_only = False
        if near:
            pc = sum((p['ch0'] + p['ch1']) / 2 for p in near) / len(near)
            p0, p1 = min(p['ch0'] for p in near), max(p['ch1'] for p in near)
        else:
            # no platform drawn yet: the loops near the name, else only where the name is
            tr = [t for t in tracks if t['ch1'] > n['ch'] - 800 and t['ch0'] < n['ch'] + 800]
            if tr:
                p0, p1 = min(t['ch0'] for t in tr), max(t['ch1'] for t in tr)
            else:
                p0, p1, pos_only = n['ch'] - 175, n['ch'] + 175, True
            pc = (p0 + p1) / 2
        lim = [l for l in limits if abs((l['ch0'] + l['ch1']) / 2 - pc) < 600]
        # the station's tracks: loops and sidings that reach the platforms, then those that reach them
        a, b = p0, p1
        cand = [t for t in tracks if t['ch1'] > pc - 2000 and t['ch0'] < pc + 2000]
        grew = True
        while grew:
            grew = False
            for t in cand:
                if t['ch0'] <= b + 5 and t['ch1'] >= a - 5 and (t['ch0'] < a - 0.5 or t['ch1'] > b + 0.5):
                    a, b = min(a, t['ch0']), max(b, t['ch1'])
                    grew = True
        if b - a > 3000:
            a, b = p0, p1
        sub = axes_sub(axes, pc)
        note = next((x['text'] for x in notes if abs(x['ch'] - n['ch']) < 300), None)
        st = {'kind': 'station', 'name': n['name'], 'sub': sub, 'ch0': r1(a), 'ch1': r1(b), 'ch': r1(pc),
              'src': source, 'outline': [p['poly'] for p in near] + [l['poly'] for l in lim]}
        if near:
            st['platform'] = [r1(p0), r1(p1)]
            st['platform_side'] = side_of(min(p['off0'] for p in near), max(p['off1'] for p in near))
        if lim:
            st['limits'] = [r1(min(l['ch0'] for l in lim)), r1(max(l['ch1'] for l in lim))]
            st['side'] = side_of(min(l['off0'] for l in lim), max(l['off1'] for l in lim))
        notes_ = [x for x in [note, 'Where its name is on the drawing; no platform or loop drawn yet' if pos_only else None] if x]
        if notes_:
            st['note'] = '. '.join(notes_)
        out.append(st)
    # yards: an outline where the drawing has one, else the extent of the yard's tracks. Pieces of one
    # outline (a gate, an annex) less than 250 m apart on the same side are one yard.
    found = []
    for y in sorted(yards, key=lambda y: y['ch0']):
        last = found[-1] if found else None
        if last and y['ch0'] - last['ch1'] < 250 and side_of(y['off0'], y['off1']) == side_of(last['off0'], last['off1']):
            last['ch0'], last['ch1'] = min(last['ch0'], y['ch0']), max(last['ch1'], y['ch1'])
            last['off0'], last['off1'] = min(last['off0'], y['off0']), max(last['off1'], y['off1'])
            last['polys'].append(y['poly'])
        else:
            found.append(dict(y, polys=[y['poly']], what='freight'))
    for lab in ylabels:
        if any(y['ch0'] - 300 <= lab['ch'] <= y['ch1'] + 300 and y['what'] == lab['what'] for y in found):
            continue
        tr = [t for t in ytracks if t['what'] == lab['what'] and t['ch1'] > lab['ch'] - 1500 and t['ch0'] < lab['ch'] + 1500 and abs(t['off0'] + t['off1']) / 2 > 15]
        if not tr:
            continue
        a, b = min(t['ch0'] for t in tr), max(t['ch1'] for t in tr)
        o0, o1 = min(t['off0'] for t in tr), max(t['off1'] for t in tr)
        found.append({'sub': lab['sub'], 'ch0': a, 'ch1': b, 'off0': o0, 'off1': o1, 'what': lab['what'],
                      'polys': [[[r1(a), r1(o0)], [r1(b), r1(o0)], [r1(b), r1(o1)], [r1(a), r1(o1)], [r1(a), r1(o0)]]], 'from_tracks': True})
    for y in found:
        mid = (y['ch0'] + y['ch1']) / 2
        out.append({'kind': 'yard', 'what': y['what'], 'name': 'Freight yard' if y['what'] == 'freight' else 'Maintenance centre',
                    'sub': axes_sub(axes, mid), 'ch0': r1(y['ch0']), 'ch1': r1(y['ch1']), 'ch': r1(mid),
                    'side': side_of(y['off0'], y['off1']), 'off': [r1(y['off0']), r1(y['off1'])],
                    'src': source, 'outline': y['polys'],
                    **({'note': 'Extent of its tracks (the drawing has no outline)'} if y.get('from_tracks') else {})})
    return out


def axes_sub(axes, ch):
    """The sub-section a chainage is in."""
    if not hasattr(axes, 'rng'):
        axes.at(0, 0)
    return axes.sub_at(ch)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dxf', nargs='+', help='STATIONS_YARDS drawings, converted')
    ap.add_argument('--yards', nargs='*', default=[], help='other drawings with FREIGHT_YARD_LIMITS (yards only)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'dwg', 'stations.json'))
    a = ap.parse_args()
    axes = Axes()
    allst = []
    def split(arg):
        return arg.split('=', 1) if '=' in arg else (arg, re.sub(r'\.dxf$', '', os.path.basename(arg)))
    for p, name in map(split, a.dxf):
        allst += stations(p, axes, name)
    for p, name in map(split, a.yards):
        for y in [s for s in stations(p, axes, name) if s['kind'] == 'yard']:
            if not any(z['kind'] == 'yard' and z['sub'] == y['sub'] and z['ch0'] < y['ch1'] and y['ch0'] < z['ch1'] for z in allst):
                allst.append(y)
    # name yards after the station nearest them, over all drawings
    sts = [s for s in allst if s['kind'] == 'station']
    for y in [s for s in allst if s['kind'] == 'yard']:
        near = min(sts, key=lambda s: abs(s['ch'] - y['ch']), default=None)
        if near and abs(near['ch'] - y['ch']) < 4000:
            y['name'] = near['name'].replace(' Station', '') + ' ' + y['name'].lower()
    allst.sort(key=lambda s: (SUBS.index(s['sub']), s['ch0']))
    by = {}
    for s in allst:
        k = by.setdefault((s['sub'], s['kind']), 0) + 1
        by[(s['sub'], s['kind'])] = k
        s['id'] = 'ref_%s_%s_%02d' % (s['sub'], s['kind'], k)
    json.dump({'source': 'STATIONS_YARDS drawings (S02-S05)', 'stations': allst}, open(a.out, 'w'), indent=1)
    for s in allst:
        print('%-4s %-8s %-26s %9.1f %9.1f %5s %s' % (s['sub'], s['kind'], s['name'], s['ch0'], s['ch1'], s.get('side', s.get('platform_side', '')), s.get('note', '')))


if __name__ == '__main__':
    main()
