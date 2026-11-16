"""
The progress report's Excel appendix, from the figures build_report.js wrote (report.json):

    python3 scripts/report/report_xlsx.py data/report/out/report.json data/report/out/drainage_progress.xlsx

Sheets: Summary (section by type), Changes, Built (every stretch built or under way, by chainage), Design (every
drain of the design along the line with its state), Structures (culverts and others built or under way),
Networks (station and yard collector drains), Older records (left out of the figures).
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

R = json.load(open(sys.argv[1]))
out = sys.argv[2]
F = 'Arial'
HEAD = PatternFill('solid', fgColor='1F2A26')
SEC = PatternFill('solid', fgColor='E4E9E6')


def pk(v):
    if v is None:
        return ''
    v = round(v)
    s = '-' if v < 0 else ''
    v = abs(v)
    return '%s%d+%03d' % (s, v // 1000, v % 1000)


def side(s):
    return {'L': 'Left', 'R': 'Right'}.get(s, s or '')


def sheet(wb, title, cols, rows, widths, note=None):
    ws = wb.create_sheet(title)
    r0 = 1
    if note:
        ws.cell(1, 1, note).font = Font(name=F, italic=True, size=9, color='5D6963')
        r0 = 3
    for i, c in enumerate(cols, 1):
        cell = ws.cell(r0, i, c)
        cell.font = Font(name=F, bold=True, color='FFFFFF', size=10)
        cell.fill = HEAD
        cell.alignment = Alignment(vertical='center', wrap_text=True)
    for j, row in enumerate(rows, r0 + 1):
        for i, v in enumerate(row, 1):
            cell = ws.cell(j, i, v)
            cell.font = Font(name=F, size=10)
            cell.alignment = Alignment(vertical='top', wrap_text=isinstance(v, str) and len(v) > 40)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(r0 + 1, 1)
    ws.auto_filter.ref = '%s:%s' % (ws.cell(r0, 1).coordinate, ws.cell(r0 + max(1, len(rows)), len(cols)).coordinate)
    return ws, r0


wb = Workbook()
wb.remove(wb.active)
src = 'From the KMD Drainage Inspector app (%d records), as of %s. Lengths in metres along the main line chainage.' % (R['rows'], R['asof'])

# Summary: one row per section and type, with % as a formula
ws = wb.create_sheet('Summary')
ws.cell(1, 1, 'Drainage construction progress, Kano-Maradi, as of ' + R['asof']).font = Font(name=F, bold=True, size=13)
ws.cell(2, 1, src).font = Font(name=F, italic=True, size=9, color='5D6963')
cols = ['Section', 'Type', 'Unit', 'Design', 'Finished', 'Under way', '% finished']
for i, c in enumerate(cols, 1):
    cell = ws.cell(4, i, c)
    cell.font = Font(name=F, bold=True, color='FFFFFF', size=10)
    cell.fill = HEAD
r = 5
for s in R['sections']:
    for t in s['types']:
        if t['road'] or t['net']:
            continue
        if t['span']:
            vals = ['m', t['designM'], t['doneM'], round(max(0, t['startedM'] - t['doneM']), 1)]
        else:
            vals = ['no.', t['n'], t['done'], t['part']]
        row = [s['no'] + ' ' + s['name'], t['label']] + vals
        for i, v in enumerate(row, 1):
            ws.cell(r, i, v).font = Font(name=F, size=10)
        ws.cell(r, 7, '=IF(D%d=0,0,E%d/D%d)' % (r, r, r)).number_format = '0%'
        ws.cell(r, 7).font = Font(name=F, size=10)
        for c in (4, 5, 6):
            ws.cell(r, c).number_format = '#,##0.0' if t['span'] else '#,##0'
        if (t['span'] and (t['doneM'] or t['startedM'])) or (not t['span'] and (t['done'] or t['part'])):
            for c in range(1, 8):
                ws.cell(r, c).fill = SEC
        r += 1
ws.cell(r + 1, 1, 'Shaded rows have work recorded. % finished = Finished / Design.').font = Font(name=F, italic=True, size=9, color='5D6963')
for i, w in enumerate([26, 34, 6, 12, 12, 12, 11], 1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'A5'
ws.auto_filter.ref = 'A4:G%d' % (r - 1)

sheet(wb, 'Changes', ['No.', 'Kind', 'Section', 'From', 'To', 'Side', 'Where', 'Design', 'Built', 'Status'],
      [[c['no'], 'Built differently' if c['kind'] == 'site' else 'Instructed change', c.get('sub', ''), pk(c.get('ch0')), pk(c.get('ch1')), side(c.get('side')),
        c['where'], c['design'], c['built'], c['status']] for c in R['changes']],
      [5, 16, 8, 10, 10, 7, 20, 40, 48, 40], src)

built = []
for s in R['sections']:
    for x in s['stretches']:
        built.append([s['no'], pk(x['ch0']), pk(x['ch1']), x['ch0'], x['ch1'], side(x['side']), x['label'], x['len'], 'Finished' if x['done'] else x['stage'], x['date'], x['by'], x['id']])
sheet(wb, 'Built', ['Section', 'From', 'To', 'From (m)', 'To (m)', 'Side', 'Type', 'Length (m)', 'State', 'Last record', 'By', 'Drain id'], built,
      [8, 10, 10, 10, 10, 7, 30, 10, 18, 12, 24, 22], src + ' Every stretch built or under way.')

des = []
for s in R['sections']:
    for d in s['design']:
        st = {'done': 'Finished', 'none': 'Not started', 'moving': 'Under way', 'stalled': 'Under way, no record for 6 months'}.get(d['state'], d['state'])
        des.append([s['no'], pk(d['ch0']), pk(d['ch1']), side(d['side']), d['label'], d['len'], st, d['stage'], ('built ' + pk(d['built'][0]) + ' to ' + pk(d['built'][1])) if d['built'] else '', d['id']])
sheet(wb, 'Design', ['Section', 'From', 'To', 'Side', 'Type', 'Length (m)', 'State', 'Furthest stage', 'As built', 'Drain id'], des,
      [8, 10, 10, 7, 30, 10, 18, 22, 26, 22], src + ' Every drain of the design along the line, with its state.')

pts = []
for s in R['sections']:
    for p in s['points']:
        pts.append([s['no'], pk(p['ch']), side(p['side']), p['label'], p['name'], 'Finished' if p['done'] else p['stage'], p['date'], p['id']])
sheet(wb, 'Structures', ['Section', 'At', 'Side', 'Type', 'Name', 'State', 'Last record', 'Id'], pts, [8, 10, 7, 22, 40, 18, 12, 22], src + ' Culverts and other structures built or under way.')

nets = []
for n in R['networks']:
    for l in n['list']:
        nets.append([n['name'], l['name'], l['len'], l['dia'] or '', {'done': 'Finished', 'none': 'Not started'}.get(l['state'], 'Under way'), l['id']])
sheet(wb, 'Networks', ['Station or yard', 'Drain (manhole to manhole)', 'Length (m)', 'Pipe (mm)', 'State', 'Id'], nets, [24, 34, 10, 10, 14, 22],
      src + ' Type 6 collector drains, measured along each drain.')

sheet(wb, 'Older records', ['Id', 'Status', 'Date', 'By', 'Notes'], [[u['id'], u['status'], u['date'], u['by'], u['notes']] for u in R['unmatched']], [14, 22, 12, 24, 80],
      'Records under asset numbers of the first asset list, which the drawings have replaced. Left out of the figures until confirmed on site.')

wb.save(out)
print('wrote', out)
