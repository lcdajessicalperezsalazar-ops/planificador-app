"""Convierte el libro (Word) en secciones para la consulta de la app.
Uso: python3 book_ingest.py libro.docx salida.sql [edicion]
- Título 1 = capítulo; Título 2/3 = sección; los párrafos se agrupan en bloques de ~350 palabras
  sin partir párrafos, para que cada resultado sea legible por sí solo."""
import sys, re, json
from docx import Document

src, out = sys.argv[1], sys.argv[2]
ED = sys.argv[3] if len(sys.argv) > 3 else 'es'
TARGET, MAXW = 350, 520
doc = Document(src)

def level(p):
    n = (p.style.name or '').lower()
    m = re.search(r'(heading|título|titulo)\s*(\d)', n)
    if m: return int(m.group(2))
    if n in ('title', 'título', 'titulo'): return 1
    return 0

chunks, chap_no, chap_title, sec, head, buf = [], 0, '', '', '', []
def flush():
    global buf
    if buf and sum(len(x.split()) for x in buf) >= 12:
        chunks.append(dict(chapter=chap_no or None, chapter_title=chap_title, section=sec, heading=head, body='\n'.join(buf)))
    buf = []

for p in doc.paragraphs:
    t = re.sub(r'\s+', ' ', p.text).strip()
    if not t: continue
    lv = level(p)
    if lv == 1:
        flush()
        m = re.match(r'(cap[ií]tulo|chapter)\s+(\d+|[ivxlc]+)\s*[:.\-–—]?\s*(.*)', t, re.I)
        chap_no += 1
        if m and m.group(2).isdigit(): chap_no = int(m.group(2))
        chap_title = (m.group(3) if m and m.group(3) else t).strip()
        sec, head = '', ''
        continue
    if lv in (2, 3, 4):
        flush()
        m = re.match(r'(\d+(?:\.\d+)+)\.?\s+(.*)', t)
        sec, head = (m.group(1), m.group(2)) if m else ('', t)
        continue
    buf.append(t)
    if sum(len(x.split()) for x in buf) >= TARGET: flush()
flush()

# tablas: cada tabla como un bloque de texto bajo el último encabezado conocido no es trivial de ubicar;
# se añaden al final del capítulo correspondiente solo si el libro las tiene (se revisa a mano).

def q(s): return 'null' if s is None or s == '' else "'" + str(s).replace("'", "''") + "'"
with open(out, 'w') as f:
    for i, c in enumerate(chunks, 1):
        f.write(f"insert into public.book_chunks(edition, ord, chapter, chapter_title, section, heading, body) values ({q(ED)}, {i}, {c['chapter'] or 'null'}, {q(c['chapter_title'])}, {q(c['section'])}, {q(c['heading'])}, {q(c['body'])});\n")
words = sum(len(c['body'].split()) for c in chunks)
print(f'{len(chunks)} bloques, {words} palabras, {len(set(c["chapter"] for c in chunks))} capítulos')
json.dump(chunks[:3], sys.stdout, ensure_ascii=False, indent=1)
