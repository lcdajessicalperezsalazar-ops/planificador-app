# Genera la versión en inglés de la app: data/en/*.js, planner_en.js y auth_en.js.
import os, sys, subprocess
R = os.path.dirname(os.path.abspath(__file__)) + '/..'
sys.path.insert(0, R + '/tools')
from planner_en_pairs import PLANNER, AUTH, INDEX
subprocess.run([sys.executable, R + '/tools/build_en_data.py'], check=True)
for src, out, pairs in [('planner.js', 'planner_en.js', PLANNER), ('auth.js', 'auth_en.js', AUTH), ('index.html', 'en/index.html', INDEX)]:
    s = open(f'{R}/{src}').read(); bad = []
    for a, b in pairs:
        if a not in s: bad.append(a[:100])
        s = s.replace(a, b)
    open(f'{R}/{out}', 'w').write(s if out.endswith('.html') else '/* Generado por tools/build_en.py a partir de ' + src + ' — no editar a mano */\n' + s)
    print(out, 'reemplazos no encontrados:', len(bad)); [print('   ·', x) for x in bad]
