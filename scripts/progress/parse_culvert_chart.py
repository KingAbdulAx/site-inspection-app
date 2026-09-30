"""
Read a 'Culvert Monitoring & Execution Status' chart (PDF) into rows.

    pdftotext -bbox 'Culvert Monitoring & Execution Status-Section 01 - 25_09_26.pdf' S01.bbox.html
    python3 scripts/progress/parse_culvert_chart.py S01.bbox.html   # writes S01.rows.json

Columns are found from their header words on each page (the sections lay them
out differently), and every tick or 'Ongoing' in a row is given to the nearest
stage column. The chainage is the one in the Chainage column; a comment can
carry another. Road and yard crossings are kept here and filtered later.
"""
import re, html, json, sys
KEYS = [('excavation','Excav'),('bedding','Blinding'),('installed','Installation'),('haunch','Haunch'),('apron','Apron'),('wings','Wing'),('joints','Joints'),('paint','Bituminous'),('backfill','Backfilling')]
CH = re.compile(r'^-?\d{1,3}\+\d{3}(?:[.,]\d+)?$')
def words(f):
    s=open(f).read(); out=[]
    for pg,body in enumerate(re.findall(r'<page[^>]*>(.*?)</page>',s,re.S)):
        for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>',body):
            out.append(dict(pg=pg,x0=float(m[1]),y0=float(m[2]),x1=float(m[3]),y1=float(m[4]),t=html.unescape(m[5])))
    return out
def parse(f):
    W=words(f)
    rows=[]
    for pg in sorted(set(w['pg'] for w in W)):
        P=[w for w in W if w['pg']==pg]
        cols={}
        for k,tok in KEYS:
            c=[w for w in P if w['t'].startswith(tok) and w['y0']<140]
            if c: cols[k]=(c[0]['x0']+c[0]['x1'])/2
        if pg>0 and len(cols)<5: cols=last_cols
        last_cols=cols
        xs=sorted(cols.values())
        hdr_bottom=max([w['y1'] for w in P if w['t'] in ('Excav','Blinding','Installation','Joints') and w['y0']<140]+[0])
        # plan column (right boundary)
        plan=[w for w in P if w['t']=='Plan' and w['y0']<140]
        xmax=(plan[0]['x0']-2) if plan else xs[-1]+30
        chh=[w for w in P if w['t']=='Chainage' and w['y0']<140]
        chx=(chh[0]['x0']+chh[0]['x1'])/2 if chh else None
        if pg>0 and chx is None: chx=last_chx
        last_chx=chx
        # the chainage in the Chainage column; comments can carry another
        chs=[w for w in P if CH.match(w['t']) and w['y0']>hdr_bottom and (chx is None or abs((w['x0']+w['x1'])/2-chx)<30)]
        for c in chs:
            yc=(c['y0']+c['y1'])/2
            line=[w for w in P if abs((w['y0']+w['y1'])/2-yc)<4.5]
            name=' '.join(w['t'] for w in sorted(line,key=lambda w:w['x0']) if w['x1']<c['x0'] and not re.match(r'^(Box|Pipe|Culverts?|Cattle|Crossing|Underpass|Slab|Water|Passage|Arch)$',w['t'],re.I))
            typ=' '.join(w['t'] for w in sorted(line,key=lambda w:w['x0']) if w['x1']<c['x0'] and re.match(r'^(Box|Pipe|Culverts?|Cattle|Crossing|Underpass|Slab|Water|Passage|Arch)$',w['t'],re.I))
            cells={}
            lo=min(xs)-20
            for w in line:
                xm=(w['x0']+w['x1'])/2
                if xm<lo or xm>xmax: continue
                k=min(cols,key=lambda k:abs(cols[k]-xm))
                if abs(cols[k]-xm)>25: continue
                v='done' if w['t'] in ('✓','√','✔') else ('ongoing' if w['t'].lower().startswith('ongo') else w['t'])
                if k in cells and cells[k]!='done': cells[k]=cells[k]+' '+w['t']
                else: cells[k]=v
            after=[w for w in sorted(line,key=lambda w:w['x0']) if w['x0']>xmax]
            mid=[w['t'] for w in sorted(line,key=lambda w:w['x0']) if c['x1']<w['x0']<lo]
            rows.append(dict(page=pg,name=name.strip(),type=typ,ch=c['t'],mid=' '.join(mid),cells=cells,plan_comment=' '.join(w['t'] for w in after)))
    return rows, cols
if __name__ == '__main__':
    for f in sys.argv[1:]:
        rows,cols=parse(f)
        print('==',f,len(rows),'rows; cols',{k:round(v) for k,v in cols.items()})
        for r in rows[:3]+rows[-2:]: print(r)
        json.dump(rows,open(f.replace('.bbox.html','.rows.json'),'w'),indent=1)
