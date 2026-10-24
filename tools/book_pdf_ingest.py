"""Convierte el PDF del libro "El Derecho de Inmigración en los Estados Unidos" en bloques para la consulta.
Uso: python3 book_pdf_ingest.py libro.pdf salida.json
Reglas del PDF (Word → PDF, Amasis MT Pro):
- 15 pt negrita = capítulo; 13 pt negrita = sección (I., II., …); 12 pt negrita en línea propia = subtítulo.
- 9 pt cursiva arriba = encabezado de página (se descarta); número de página abajo (se guarda como página impresa).
- Tablas: se extraen con find_tables y se escriben como "Etiqueta: contenido"."""
import sys, re, json
import pymupdf

src, out = sys.argv[1], sys.argv[2]
d = pymupdf.open(src)
START, END = 6, 776          # págs. 7–776 del PDF: introducción + 21 capítulos (sin índice ni bibliografía)
SKIP = range(14, 44)         # tabla de contenido e índice de tablas
TARGET = 330

def clean(t):
    t = t.replace('­', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', t).strip()

def table_text(tab):
    rows = tab.extract(); outl, pending = [], None
    for r in rows:
        cells = [clean(c or '') for c in r]
        nz = [c for c in cells if c]
        if not nz: continue
        if len(cells) >= 2 and not cells[0] and cells[1]:
            if pending: outl.append(pending)
            pending = cells[1]; continue
        if len(nz) == 1 and pending and cells[0]:
            outl.append(f'{cells[0]}: {pending}'); pending = None; continue
        if pending: outl.append(pending); pending = None
        outl.append(' — '.join(nz))
    if pending: outl.append(pending)
    return outl

# 1) líneas con estilo, en orden de lectura
items = []   # (kind, text, page_label, y_gap)
for pi in range(START, END):
    if pi in SKIP: continue
    p = d[pi]
    try: tabs = p.find_tables().tables
    except Exception: tabs = []
    tboxes = [pymupdf.Rect(t.bbox) for t in tabs]
    label = None
    lines = []
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = clean(''.join(s['text'] for s in l['spans']))
            if not t: continue
            s0 = max(l['spans'], key=lambda s: len(s['text'].strip()))
            y0, y1 = l['bbox'][1], l['bbox'][3]
            if y0 < 45 and s0['size'] < 10: continue                       # encabezado
            if y0 > 630 and re.fullmatch(r'\d{1,3}', t): label = int(t); continue   # número de página
            r = pymupdf.Rect(l['bbox'])
            ti = next((i for i, tb in enumerate(tboxes) if tb.intersects(r) and (r & tb).get_area() > .5 * r.get_area()), None)
            bold = all((s['flags'] & 16) or not s['text'].strip() for s in l['spans'])
            lines.append(dict(t=t, y=y0, y1=y1, size=round(s0['size']), bold=bold, tab=ti))
    lines.sort(key=lambda x: x['y'])
    done_tabs = set()
    prev_y1 = None
    for ln in lines:
        if ln['tab'] is not None:
            if ln['tab'] not in done_tabs:
                done_tabs.add(ln['tab'])
                for row in table_text(tabs[ln['tab']]): items.append(('tab', row, label, 99))
                prev_y1 = None
            continue
        gap = 99 if prev_y1 is None else ln['y'] - prev_y1
        prev_y1 = ln['y1']
        if ln['size'] >= 15 and ln['bold']: kind = 'chap'
        elif ln['size'] == 13 and ln['bold']: kind = 'sec'
        elif ln['bold'] and ln['size'] >= 11 and len(ln['t']) < 140: kind = 'sub'
        else: kind = 'txt'
        items.append((kind, ln['t'], label, gap))

# 2) unir líneas en títulos y párrafos
blocks = []  # (kind, text, page)
for k, t, pg, gap in items:
    if blocks and blocks[-1][0] == k and k in ('chap', 'sec', 'sub') and gap < 12:
        blocks[-1][1] += ' ' + t; continue
    if blocks and k == 'txt' and blocks[-1][0] == 'txt' and gap < 12:
        prev = blocks[-1][1]
        blocks[-1][1] = (prev[:-1] + t) if prev.endswith('-') and not prev.endswith(' -') else prev + ' ' + t
        continue
    blocks.append([k, t, pg])

# 3) bloques de consulta
chunks = []; chap_no, chap_title, sec, sub = 0, 'Introducción', '', ''
buf, buf_pg = [], None
def flush():
    global buf, buf_pg
    body = '\n'.join(buf).strip()
    if len(body.split()) >= 15:
        heading = sub or sec or chap_title
        chunks.append(dict(chapter=chap_no, chapter_title=chap_title, section=sec, heading=heading, page=buf_pg, body=body))
    buf, buf_pg = [], None

for k, t, pg in blocks:
    if k == 'chap':
        flush()
        m = re.match(r'CAP[ÍI]TULO\s+(\d+)\s*[:.]\s*(.*)', t, re.I)
        if m: chap_no, chap_title = int(m.group(1)), m.group(2).strip().capitalize()
        elif t.upper().startswith('INTRODUCCI'): chap_no, chap_title = 0, 'Introducción'
        else: chap_title = t.capitalize()
        sec, sub = '', ''
        continue
    if k == 'sec':
        flush(); sec, sub = t, ''; continue
    if k == 'sub':
        flush(); sub = t; continue
    if k == 'tab' and buf and not buf[-1].startswith('•'):
        pass
    if buf_pg is None: buf_pg = pg
    buf.append(t)
    if sum(len(x.split()) for x in buf) >= TARGET and k == 'txt': flush()
flush()

def nicecap(s):
    s = s.lower()
    s = re.sub(r'\b(cat|dhs|doj|uscis|bia|eoir|ice|cbp)\b', lambda m: m.group(1).upper(), s)
    s = re.sub(r'\(([a-z])', lambda m: '(' + m.group(1).upper(), s)
    return s[:1].upper() + s[1:]
for c in chunks: c['chapter_title'] = nicecap(c['chapter_title'])
json.dump(chunks, open(out, 'w'), ensure_ascii=False)
print(len(chunks), 'bloques;', sum(len(c['body'].split()) for c in chunks), 'palabras;', len({c['chapter'] for c in chunks}), 'capítulos')
