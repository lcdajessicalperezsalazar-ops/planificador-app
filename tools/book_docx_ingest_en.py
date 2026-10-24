"""Converts the English book (Word) into blocks for the app's consultation search.
Usage: python3 book_docx_ingest_en.py book.docx out.json
Heading 1 = "Chapter N: …" (chapter) or "I. …" (section); Heading 2/3 = subheading.
Tables are written as "Label: content" rows. Front matter before INTRODUCTION, the list of tables,
the bibliography and About the Author are skipped."""
import sys, re, json
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

src, out = sys.argv[1], sys.argv[2]
d = Document(src)
TARGET = 330

def clean(t): return re.sub(r'\s+', ' ', (t or '').replace('­', '')).strip()

def iter_blocks(doc):
    for el in doc.element.body.iterchildren():
        tag = el.tag.split('}')[-1]
        if tag == 'p': yield Paragraph(el, doc)
        elif tag == 'tbl': yield Table(el, doc)

def table_rows(t):
    out = []
    for r in t.rows:
        cells = []
        for c in r.cells:
            tx = clean(c.text)
            if tx and (not cells or cells[-1] != tx): cells.append(tx)
        if not cells: continue
        if len(cells) == 2 and len(cells[0]) < 60: out.append(f'{cells[0]}: {cells[1]}')
        else: out.append(' — '.join(cells))
    return out

chunks = []; state = 'front'
chap_no, chap_title, sec, sub = 0, 'Introduction', '', ''
buf = []
def flush():
    global buf
    body = '\n'.join(buf).strip()
    if len(body.split()) >= 15:
        chunks.append(dict(chapter=chap_no, chapter_title=chap_title, section=sec, heading=sub or sec or chap_title, page=None, body=body))
    buf = []

for b in iter_blocks(d):
    if isinstance(b, Table):
        if state == 'body':
            buf.extend(table_rows(b))
        continue
    t = clean(b.text)
    if not t: continue
    st = b.style.name if b.style is not None else ''
    if state == 'front':
        if t.upper() == 'INTRODUCTION': state = 'intro'; sec = ''; sub = ''
        continue
    if state == 'intro':
        if t.upper() == 'TABLES': flush(); state = 'tables'; continue
        if len(t) < 70 and not t.endswith('.') and st == 'Normal' and len(t.split()) <= 9:
            flush(); sub = t; continue
        buf.append(t);
        if sum(len(x.split()) for x in buf) >= TARGET: flush()
        continue
    if state == 'tables':
        if st == 'Heading 1' and t.lower().startswith('chapter'): state = 'body'
        else: continue
    # some chapters (e.g. Chapter 8) use Normal style for headings: detect them by pattern
    if st == 'Normal' and len(t) < 170 and not t.endswith(('.', ':', ';')):
        if re.match(r'chapter\s+\d+\s*:', t, re.I): st = 'Heading 1'
        elif re.match(r'[IVXL]+\.\s+[A-Z]', t): st = 'Heading 1'
        elif re.match(r'([A-Z]|\d{1,2})\.\s+[A-Z]', t) and len(t.split()) <= 22: st = 'Heading 2'
    if st == 'Heading 1' and t.upper() in ('GENERAL BIBLIOGRAPHY', 'ABOUT THE AUTHOR'):
        flush(); break
    if st == 'Heading 1':
        flush()
        m = re.match(r'chapter\s+(\d+)\s*[:.\-–—]\s*(.*)', t, re.I)
        if m: chap_no, chap_title, sec, sub = int(m.group(1)), m.group(2).strip(), '', ''
        else: sec, sub = t, ''
        continue
    if st in ('Heading 2', 'Heading 3', 'Heading 4'):
        flush(); sub = t; continue
    buf.append(t)
    if sum(len(x.split()) for x in buf) >= TARGET: flush()
flush()

# split oversized blocks at paragraph boundaries
final = []
for x in chunks:
    if len(x['body'].split()) <= 600: final.append(x); continue
    cur = []
    for p in x['body'].split('\n'):
        cur.append(p)
        if sum(len(q.split()) for q in cur) >= 330: final.append(dict(x, body='\n'.join(cur))); cur = []
    if cur:
        if sum(len(q.split()) for q in cur) < 60 and final: final[-1]['body'] += '\n' + '\n'.join(cur)
        else: final.append(dict(x, body='\n'.join(cur)))
for i, x in enumerate(final, 1): x['ord'] = i
json.dump(final, open(out, 'w'), ensure_ascii=False)
print(len(final), 'blocks;', sum(len(c['body'].split()) for c in final), 'words;', len({c['chapter'] for c in final}), 'chapters')
