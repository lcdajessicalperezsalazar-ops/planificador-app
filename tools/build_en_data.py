# Genera data/en/*.js traduciendo data/*.js con el diccionario alineado del libro (ES->EN) y ajustes manuales.
import json, re, os
R = os.path.dirname(os.path.abspath(__file__)) + '/..'
D = json.load(open(f'{R}/tools/es_en_dict.json')); D.update(json.load(open(f'{R}/tools/manual_en.json')))
Dn = {re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', k)).strip(): v for k, v in D.items()}
KEEP = {'e', 'es', 'parece', 'verb', 'en', 'sigla', 't_voc', 'x_voc'}   # campos que ya están en inglés o que son el equivalente en español
miss = set()
def tr(s):
    k = s.strip()
    if k in D: return D[k]
    if k in Dn: return Dn[k]
    if re.fullmatch(r'[\d\W]+', k) or re.fullmatch(r'[A-Z0-9\-_.]+', k): return s
    miss.add(k); return s
def walk(x, field=None, ctx=None):
    if isinstance(x, str): return x if field in KEEP or (ctx == 'voc' and field in ('t', 'x')) or (ctx == 'ph' and field == 'en') or field in ('id', 'k', 's') else tr(x)
    if isinstance(x, list): return [walk(i, field, ctx) for i in x]
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            out[k] = walk(v, k, ctx)
        return out
    return x
def load(f): return json.loads(open(f'{R}/data/{f}').read().split('=', 1)[1].rstrip().rstrip(';'))
os.makedirs(f'{R}/data/en', exist_ok=True)
spec = load('spec.js')
for s in spec:
    for t in s['tools']: t['key'] = t['n']          # conserva la clave de almacenamiento de la versión en español
spec_en = walk(spec)
for s, se in zip(spec, spec_en):
    for t, te in zip(s['tools'], se['tools']): te['key'] = t['n']
data = load('content.js')
data_en = {'caps': {k: [tr(v[0]), tr(v[1])] for k, v in data['caps'].items()},
           'micro': [{'t': tr(m['t']), 'h': tr(m['h']), 'x': tr(m['x'])} for m in data['micro']],
           'retos': [{'t': tr(r['t']), 'p': [tr(p) for p in r['p']]} for r in data['retos']],
           'voc': [{**v, 'd': tr(v['d']), 'g': tr(v['g'])} for v in data['voc']]}
extra = load('extra.js')
extra_en = {'ff': [{**x, 'significa': tr(x['significa'])} for x in extra['ff']],
            'vb': extra['vb'],
            'ph': [{'grupo': tr(g['grupo']), 'items': g['items']} for g in extra['ph']],
            'ac': [{**x, 'es': tr(x['es'])} for x in extra['ac']]}
for name, var, obj in [('spec.js', 'SPEC', spec_en), ('content.js', 'DATA', data_en), ('extra.js', 'EXTRA', extra_en)]:
    open(f'{R}/data/en/{name}', 'w').write(f'const {var}=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('sin traducir:', len(miss)); [print('  ·', m[:110]) for m in sorted(miss)]
