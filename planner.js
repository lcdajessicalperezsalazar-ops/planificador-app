
/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const monday = d => addDays(d, -((d.getDay()+6)%7));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g,' ');
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const longDate = d => `${cap(DIAS[d.getDay()])}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const START = new Date(2026, 11, 28);
function weekNo(d){
  const n = Math.floor((monday(d) - START) / 864e5 / 7) + 1;
  if (n >= 1 && n <= 53) return n;                       // semanas del planner 2027 (la 1 empieza el 28 dic 2026)
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); // semana ISO para otros años
}
const capsuleFor = d => DATA.caps[`${pad(d.getMonth()+1)}-${pad(d.getDate())}`] || ['Ética','Verifica antes de afirmar.'];
const quarter = d => Math.floor(d.getMonth()/3) + 1;

/* ---------- almacenamiento: Supabase ---------- */
const store = {
  cache:{}, timers:{}, mode:'nube',
  async get(key, fallback){
    if (key in this.cache) return this.cache[key];
    let v;
    try{ const { data } = await sb.from('planner_docs').select('value').eq('key', key).maybeSingle(); v = data ? data.value : undefined; }catch(e){}
    v = v ?? structuredClone(fallback);
    if (v !== null) this.cache[key] = v;
    return v;
  },
  save(key){
    clearTimeout(this.timers[key]); setStatus('Guardando…');
    this.timers[key] = setTimeout(async () => {
      const { error } = await sb.from('planner_docs').upsert({ user_id: SESSION.user.id, key, value: this.cache[key], updated_at: new Date().toISOString() });
      setStatus(error ? 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' : undefined);
    }, 600);
  }
};
function setStatus(msg){
  const el = document.getElementById('status'); if (!el) return;
  el.textContent = msg || 'Guardado en tu cuenta. Solo tú puedes verlo.';
}
const statusEl = '<p class="status" id="status"></p>';

function bind(obj, key, root){
  root.querySelectorAll('[data-f]').forEach(el => {
    const path = el.dataset.f.split('.');
    let o = obj; for (let i=0;i<path.length-1;i++){ if (o[path[i]] == null) o[path[i]] = /^\d+$/.test(path[i+1]) ? [] : {}; o = o[path[i]]; }
    const k = path[path.length-1];
    if (el.type === 'checkbox'){ el.checked = !!o[k]; el.addEventListener('change', () => { o[k] = el.checked; store.save(key); if (el.dataset.re) render(); }); }
    else { el.value = o[k] ?? ''; el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { o[k] = el.value; store.save(key); }); }
  });
}
const field = (id, label, f, rows=2) => `<label class="lab" for="${id}">${esc(label)}</label>` + (rows > 1 ? `<textarea id="${id}" data-f="${f}" rows="${Math.min(rows,6)}"></textarea>` : `<input type="text" id="${id}" data-f="${f}">`);

/* ---------- MI TIEMPO ---------- */
let cur = new Date(); cur.setHours(0,0,0,0);
const HORAS = ['8 AM','9','10','11','12 PM','1','2','3','4','5','6'];
async function vDia(){
  const k = 'dia-'+iso(cur);
  const s = await store.get(k, {p:[{t:'',d:false},{t:'',d:false},{t:'',d:false}], h:Array(11).fill(''), tareas:'', seg:'', plazos:'', llam:'', notas:''});
  const [cat, txt] = capsuleFor(cur);
  const doy = Math.round((cur - new Date(cur.getFullYear(),0,1))/864e5)+1;
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Mi día · día ${doy} del año</div><h1>${longDate(cur)}</h1></div></div>
    <div class="capsule"><span class="eyebrow">Cápsula del día · ${esc(cat)}</span>${esc(txt)}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Mis 3 prioridades</h2>
        ${s.p.map((_,i)=>`<div class="prio"><input type="checkbox" class="chk" data-f="p.${i}.d" aria-label="Hecha"><input type="text" id="p${i}" data-f="p.${i}.t" placeholder="Prioridad ${i+1}"></div>`).join('')}
        ${field('tareas','Casos / tareas','tareas',3)}${field('seg','Seguimiento','seg',3)}${field('pl','Plazos de hoy','plazos',3)}</div>
      <div class="card"><h2>Horario</h2>
        <div class="sched">${HORAS.map((h,i)=>`<span>${h}</span><input type="text" id="h${i}" data-f="h.${i}" aria-label="${h}">`).join('')}</div>
        ${field('llam','Llamadas / correos','llam',3)}${field('notas','Notas','notas',4)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

const REVIEW = ['Caso que más atención necesita','Caso estancado','Cliente esperando','Documento pendiente','Plazo próximo','Caso para discutir con alguien','Caso que puede cerrar'];
const VIERNES = ['Cumplí los plazos','Respondí comunicaciones importantes','Documenté','Revisé pendientes','Supervisé','Aprendí','Hice seguimiento'];
async function vSemana(){
  const mon = monday(cur), wn = weekNo(cur), k = 'semana-'+iso(mon);
  const s = await store.get(k, {r:Array(7).fill(''), q:'', v:Array(7).fill(false), mejor:'', corregir:'', prox:'', p:['','',''], aud:'', ent:'', cons:'', pl:''});
  const micro = DATA.micro[(wn-1) % DATA.micro.length];
  const days = [];
  for (let i=0;i<7;i++){ const d = addDays(mon,i); const ds = await store.get('dia-'+iso(d), null); days.push({d, done: ds ? ds.p.filter(p=>p.d).length : 0, tot: ds ? ds.p.filter(p=>p.t).length : 0}); }
  const end = addDays(mon,6);
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Semana ${wn}</div><h1>Mi semana</h1></div><div class="muted">${mon.getDate()} ${MESES[mon.getMonth()].slice(0,3)} – ${end.getDate()} ${MESES[end.getMonth()].slice(0,3)} ${end.getFullYear()}</div></div>
    <div class="grid g2">
      <div class="card"><div class="eyebrow">Micro-lección · ${esc(micro.t)}</div><h2 style="margin-top:4px">${esc(micro.h)}</h2><p style="margin:0">${esc(micro.x)}</p></div>
      <div class="card"><h2>Los días</h2>
        ${days.map(x=>`<div class="weekday" data-go="${iso(x.d)}" role="button" tabindex="0"><b>${cap(DIAS[x.d.getDay()])} ${x.d.getDate()}</b><span class="pill ${x.tot && x.done===x.tot ? 'p-ok':'p-mute'}">${x.done}/${x.tot || 3} prioridades</span></div>`).join('')}</div>
      <div class="card"><h2>Plan de la semana</h2>
        ${[0,1,2].map(i=>`<div class="prio"><span class="gold" style="font-family:var(--display);font-weight:700">${i+1}</span><input type="text" id="wp${i}" data-f="p.${i}" placeholder="Prioridad de la semana"></div>`).join('')}
        ${field('aud','Audiencias','aud',2)}${field('ent','Entrevistas','ent',2)}${field('cons','Consultas','cons',2)}${field('wpl','Plazos','pl',2)}</div>
      <div class="card"><h2>Revisión de casos</h2>
        <div class="ar">Usa iniciales o un número interno. No escribas nombres completos ni A-numbers.</div>
        ${REVIEW.map((t,i)=>field('rv'+i,t,'r.'+i,1)).join('')}
        ${field('q','¿Qué puede convertirse en un problema la próxima semana si no lo atiendo hoy?','q',3)}</div>
      <div class="card"><h2>Revisión del viernes</h2>
        ${VIERNES.map((t,i)=>`<div class="prio"><input type="checkbox" class="chk" id="v${i}" data-f="v.${i}"><label for="v${i}">${t}</label></div>`).join('')}
        ${field('mej','Mi mejor decisión','mejor',1)}${field('cor','Algo que debo corregir','corregir',1)}${field('prx','Prioridad de la próxima semana','prox',1)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
  main.querySelectorAll('[data-go]').forEach(el => { const go = () => { cur = parse(el.dataset.go); openTool('tiempo','dia'); }; el.onclick = go; el.onkeydown = e => { if (e.key==='Enter') go(); }; });
}

const PLAN = ['Casos que necesitan atención','Plazos importantes','Audiencias','Entrevistas','Consultas','Seguimientos','Clientes esperando documentos','Documentos que yo estoy esperando','Cuentas / honorarios pendientes','Formación del mes','Proceso que quiero mejorar','Algo que debo delegar','Persona con quien debo conectar'];
const CIERRE = ['¿Qué funcionó?','¿Qué no funcionó?','¿Dónde perdí tiempo?','¿Qué proceso necesito?','¿Qué debo dejar de hacer?','¿Qué debo delegar?','¿Qué aprendí?','¿Qué necesita aprender mi equipo?','¿A quién conocí?','¿Qué relación debo cultivar?','¿Qué curso avancé?','¿Qué leí?','¿Qué error no quiero repetir?'];
async function vMes(){
  const y = cur.getFullYear(), m = cur.getMonth(), k = `mes-${y}-${pad(m+1)}`;
  const s = await store.get(k, {palabra:'', p:['','',''], plan:Array(PLAN.length).fill(''), reto:[false,false,false], cierre:Array(CIERRE.length).fill(''), leccion:''});
  const reto = DATA.retos[m];
  const first = new Date(y, m, 1), lead = (first.getDay()+6)%7, ndays = new Date(y, m+1, 0).getDate();
  const cells = [];
  for (let i=0;i<lead;i++) cells.push('<div class="cal-c empty"></div>');
  for (let d=1; d<=ndays; d++){
    const ds = await store.get('dia-'+iso(new Date(y,m,d)), null);
    const n = ds ? ds.p.filter(p=>p.t).length : 0, done = ds ? ds.p.filter(p=>p.d).length : 0;
    const today = iso(new Date(y,m,d)) === iso(new Date());
    cells.push(`<button class="cal-c ${today?'today':''}" data-go="${iso(new Date(y,m,d))}"><b>${d}</b>${n?`<span class="dot ${done===n?'full':''}">${done}/${n}</span>`:''}</button>`);
  }
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Mi mes</div><h1>${cap(MESES[m])} ${y}</h1></div></div>
    <div class="grid g2">
      <div class="card"><h2>Calendario</h2><div class="cal">${['L','M','X','J','V','S','D'].map(d=>`<div class="cal-h">${d}</div>`).join('')}${cells.join('')}</div>
        <p class="muted" style="font-size:12.5px;margin-bottom:0">Toca un día para abrirlo. El número indica prioridades cumplidas.</p></div>
      <div class="card"><div class="eyebrow">Reto profesional del mes</div><h2 style="margin-top:4px">${esc(reto.t)}</h2>
        ${reto.p.map((p,i)=>`<div class="prio"><input type="checkbox" class="chk" id="rt${i}" data-f="reto.${i}"><label for="rt${i}">${esc(p)}</label></div>`).join('')}
        ${field('pal','Una palabra para este mes','palabra',1)}</div>
      <div class="card"><h2>Plan mensual de la práctica</h2>
        ${[0,1,2].map(i=>`<div class="prio"><span class="gold" style="font-family:var(--display);font-weight:700">${i+1}</span><input type="text" id="mp${i}" data-f="p.${i}" placeholder="Prioridad del mes"></div>`).join('')}
        ${PLAN.map((t,i)=>field('pl'+i,t,'plan.'+i,2)).join('')}</div>
      <div class="card"><h2>Cierre del mes</h2>${CIERRE.map((t,i)=>field('ci'+i,t,'cierre.'+i,2)).join('')}${field('lec','Mi principal lección del mes','leccion',2)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
  main.querySelectorAll('[data-go]').forEach(el => el.onclick = () => { cur = parse(el.dataset.go); openTool('tiempo','dia'); });
}

const TRIM = [['Clientes',['Comunicación','Expectativas','Quejas','Seguimiento']],['Casos',['Casos acumulados','Plazos','Errores','Resultados']],['Equipo',['Carga de trabajo','Supervisión','Capacitación','Retroalimentación']],['Procesos',['Qué funciona','Qué falta','Qué automatizar','Qué eliminar']],['Conocimiento',['Qué aprendí','Qué debo aprender','Cursos','Jurisprudencia']],['Capital social',['Personas nuevas','Relaciones','Referidos','Colaboraciones']]];
const AUD = ['Calendario','Expedientes','Notas de casos','Comunicación con clientes','Plazos','Facturación','Supervisión','Tecnología','Seguridad','Ejercicio no autorizado','Capacitación','Casos cerrados'];
async function vTrimestre(){
  const y = cur.getFullYear(), q = quarter(cur), k = `trim-${y}-${q}`;
  const s = await store.get(k, {r:{}, refl:['','','',''], aud:AUD.map(()=>({e:'',a:''})), foco:'', proy:'', apr:'', rel:''});
  const REF = ['¿Qué estoy haciendo mejor?','¿Qué sigo evitando?','¿Dónde necesito ayuda?','¿Qué no debo volver a hacer?'];
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Mi trimestre</div><h1>Trimestre ${q} · ${y}</h1></div><div class="muted">${MESES.slice((q-1)*3,q*3).map(cap).join(' · ')}</div></div>
    <div class="grid g2">
      <div class="card"><h2>Plan del trimestre</h2>${field('tf','Mi foco','foco',2)}${field('tp','Proyecto principal','proy',2)}${field('ta','Lo que voy a aprender','apr',2)}${field('tr','Relación que quiero cultivar','rel',2)}</div>
      <div class="card"><h2>Reflexión</h2>${REF.map((t,i)=>field('rf'+i,t,'refl.'+i,2)).join('')}</div>
      ${TRIM.map(([g,it],gi)=>`<div class="card"><h2>${g}</h2>${it.map((t,i)=>field(`tq${gi}_${i}`,t,`r.${slug(g)}-${i}`,2)).join('')}</div>`).join('')}
      <div class="card" style="grid-column:1/-1"><h2>Auditoría de la oficina</h2><div class="scroll"><table><thead><tr><th>Área</th><th>Estado</th><th>Acción requerida</th></tr></thead><tbody>
        ${AUD.map((a,i)=>`<tr><td><b>${a}</b></td><td><select id="au${i}" data-f="aud.${i}.e" aria-label="Estado"><option value="">—</option><option>Necesita atención</option><option>Funciona</option><option>Fuerte</option></select></td><td><input type="text" id="aa${i}" data-f="aud.${i}.a" aria-label="Acción"></td></tr>`).join('')}
      </tbody></table></div></div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

const ANO = [['Mi visión para 2027','vision',4],['Tres palabras para mi año','palabras',1],['Mis 3 metas profesionales','prof',3],['Mis 3 metas de formación','form',3],['Mis 3 metas financieras o de la práctica','fin',3],['Mis metas de red profesional','red',3],['Mis metas de bienestar profesional','bien',3],['Lo que quiero aprender','apr',2],['Lo que quiero dejar de hacer','dejar',2],['Lo que quiero empezar a hacer','empezar',2],['Cómo sabré que fue un buen año','exito',3]];
async function vAno(){
  const y = cur.getFullYear(), k = 'ano-'+y;
  const s = await store.get(k, {});
  main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">Mi año</div><h1>Mi ${y}</h1></div></div>
    <div class="grid g2">${[ANO.slice(0,6), ANO.slice(6)].map(col=>`<div class="card">${col.map(([t,f,n])=>field('a-'+f,t,f,n)).join('')}</div>`).join('')}</div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

/* ---------- MIS CASOS: control de plazos y seguimiento ---------- */
async function vPlazos(){
  const list = await store.get('plazos', []);
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = list.map((p,i)=>({...p,i})).sort((a,b)=> (a.hecho-b.hecho) || (a.fecha||'9').localeCompare(b.fecha||'9'));
  const chip = p => { if (p.hecho) return '<span class="pill p-ok">Cumplido</span>'; if (!p.fecha) return '<span class="pill p-mute">Sin fecha</span>';
    const n = Math.round((parse(p.fecha)-today)/864e5);
    if (n < 0) return `<span class="pill p-bad">Vencido hace ${-n} d</span>`;
    if (n === 0) return '<span class="pill p-bad">Vence hoy</span>';
    return `<span class="pill ${n<=7?'p-warn':'p-mute'}">En ${n} d</span>`; };
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Mis casos</div><h1>Control de plazos</h1></div></div>
    <div class="notice"><b>Verifica siempre la regla aplicable.</b><span>Esta herramienta no calcula plazos: registra cómo se calculó cada uno, con qué regla y quién lo verificó.</span></div>
    <form class="card" id="fp">
      <div class="row"><div><label class="lab" for="fc">Caso (iniciales o n.º interno)</label><input type="text" id="fc" required></div>
        <div><label class="lab" for="fe">Evento / documento</label><input type="text" id="fe" required></div>
        <div><label class="lab" for="ff">Fecha límite</label><input type="date" id="ff"></div></div>
      <div class="row"><div><label class="lab" for="fr">Regla y fuente consultada</label><input type="text" id="fr"></div>
        <div><label class="lab" for="fv">Verificado por (segunda persona)</label><input type="text" id="fv"></div></div>
      <div style="margin-top:12px"><button class="btn" type="submit">Agregar plazo</button></div>
    </form>
    <div class="card scroll" style="margin-top:14px">
      ${rows.length ? `<table><thead><tr><th>Estado</th><th>Fecha</th><th>Caso</th><th>Evento</th><th>Regla / fuente</th><th>Verificó</th><th>Hecho</th><th></th></tr></thead><tbody>
      ${rows.map(p=>`<tr><td>${chip(p)}</td><td style="white-space:nowrap">${p.fecha ? parse(p.fecha).getDate()+' '+MESES[parse(p.fecha).getMonth()].slice(0,3)+' '+p.fecha.slice(0,4) : '—'}</td><td>${esc(p.caso)}</td><td>${esc(p.evento)}</td><td>${esc(p.regla)||'<span class="muted">Falta</span>'}</td><td>${esc(p.verif)||'<span class="muted">Falta</span>'}</td>
      <td><input type="checkbox" class="chk" data-i="${p.i}" ${p.hecho?'checked':''} aria-label="Cumplido"></td><td><button class="x" data-del="${p.i}" aria-label="Eliminar">×</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="margin:0">Aún no hay plazos. Agrega el primero con el formulario de arriba.</p>'}
    </div>${statusEl}</section>`;
  $('#fp').addEventListener('submit', e => { e.preventDefault();
    list.push({caso:$('#fc').value.trim(), evento:$('#fe').value.trim(), fecha:$('#ff').value, regla:$('#fr').value.trim(), verif:$('#fv').value.trim(), hecho:false});
    store.save('plazos'); render(); });
  main.querySelectorAll('[data-i]').forEach(el => el.onchange = () => { list[el.dataset.i].hecho = el.checked; store.save('plazos'); render(); });
  armDelete(list, 'plazos');
  setStatus();
}
function armDelete(list, key){
  main.querySelectorAll('[data-del]').forEach(el => el.onclick = () => { if (el.dataset.armed){ list.splice(el.dataset.del,1); store.save(key); render(); } else { el.dataset.armed = 1; el.textContent = '¿Eliminar?'; el.style.fontSize='12px'; } });
}
const ESTADOS = ['Entrevista inicial','Preparación','Presentado','En espera','Audiencia / entrevista','Decisión','Cerrado'];
async function vCasos(){
  const list = await store.get('casos', []);
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Mis casos</div><h1>Seguimiento de casos</h1></div><div class="muted">${list.length} en seguimiento</div></div>
    <div class="ar">Usa iniciales o un número interno y lleva el expediente completo en el sistema de tu oficina.</div>
    <div class="chips">${ESTADOS.map(e=>`<span class="pill p-mute">${e}: ${list.filter(c=>c.estado===e).length}</span>`).join('')}</div>
    <form class="card" id="fcs"><div class="row">
      <div><label class="lab" for="cr">Referencia</label><input type="text" id="cr" required placeholder="Ej.: J.M. · 2027-014"></div>
      <div><label class="lab" for="ct">Tipo</label><input type="text" id="ct" placeholder="Ej.: Petición familiar"></div>
      <div><label class="lab" for="cs">Etapa</label><select id="cs">${ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select></div>
    </div><div class="row">
      <div><label class="lab" for="cp">Próxima acción</label><input type="text" id="cp"></div>
      <div><label class="lab" for="cf">Fecha</label><input type="date" id="cf"></div>
    </div><div style="margin-top:12px"><button class="btn" type="submit">Agregar caso</button></div></form>
    <div class="card scroll" style="margin-top:14px">${list.length ? `<table><thead><tr><th>Referencia</th><th>Tipo</th><th>Etapa</th><th>Próxima acción</th><th>Fecha</th><th></th></tr></thead><tbody>
      ${list.map((c,i)=>`<tr><td><b>${esc(c.ref)}</b></td><td>${esc(c.tipo)}</td><td><select data-f="${i}.estado" aria-label="Etapa">${ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select></td>
      <td><input type="text" data-f="${i}.prox" aria-label="Próxima acción"></td><td><input type="date" data-f="${i}.fecha" aria-label="Fecha"></td><td><button class="x" data-del="${i}" aria-label="Eliminar">×</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="margin:0">Aún no hay casos. Agrega el primero con el formulario de arriba.</p>'}</div>${statusEl}</section>`;
  $('#fcs').addEventListener('submit', e => { e.preventDefault(); list.push({ref:$('#cr').value.trim(), tipo:$('#ct').value.trim(), estado:$('#cs').value, prox:$('#cp').value.trim(), fecha:$('#cf').value}); store.save('casos'); render(); });
  bind(list, 'casos', main); armDelete(list, 'casos'); setStatus();
}

/* ---------- herramientas generadas a partir del planner ---------- */
function blocksHTML(blocks, pfx, ro){
  return blocks.map((b, bi) => {
    const id = `${pfx}_${bi}`;
    switch (b.k){
      case 'txt': return b.s === 'quote' ? `<p class="quote">${md(b.t)}</p>` : b.s === 'lead' ? `<p class="lead">${md(b.t)}</p>` : `<p class="${b.s==='note'?'muted small':''}">${md(b.t)}</p>`;
      case 'sub': return `<h3>${md(b.t)}</h3>`;
      case 'ar': return `<div class="ar">${md(b.t)}</div>`;
      case 'list': return `<ul class="ul">${b.i.map(x=>`<li>${md(x)}</li>`).join('')}</ul>`;
      case 'area': return field(id, b.l, id, b.n);
      case 'ck': return `<div class="ckl">${b.i.map((x,i)=>`<div class="item"><input type="checkbox" class="chk" id="${id}_${i}" data-f="${id}.${i}"><label for="${id}_${i}">${md(x)}</label></div>`).join('')}</div>`;
      case 'cklist': return `<div data-dyn="${id}" data-kind="ck"></div>`;
      case 'tab': if (!b.f && b.r === 1) return `<div class="row">${b.h.map((h,i)=> b.c.includes(i) ? `<div style="flex:0 0 auto"><label class="lab">${esc(h)}</label><input type="checkbox" class="chk" data-f="${id}.${i}" aria-label="${esc(h)}"></div>` : `<div><label class="lab" for="${id}_${i}">${esc(h)}</label><input type="text" id="${id}_${i}" data-f="${id}.${i}"></div>`).join('')}</div>`;
        return b.f ? fixedTable(b, id) : `<div data-dyn="${id}" data-kind="tab" data-h='${esc(JSON.stringify(b.h))}' data-c='${JSON.stringify(b.c)}'></div>`;
      case 'grid': return `<div class="grid g2 inner">${blocksHTML(b.c, id, ro)}</div>`;
      case 'box': return `<div class="soft-box">${blocksHTML(b.c, id, ro)}</div>`;
      case 'ref': return `<div class="scroll"><table><thead><tr>${b.h.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map((c,i)=>`<td>${i?esc(c):'<b>'+esc(c)+'</b>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return '';
  }).join('');
}
function fixedTable(b, id){
  return `<div class="scroll"><table><thead><tr>${b.h.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${b.f.map((r,ri)=>`<tr><td><b>${esc(r)}</b></td>${b.h.slice(1).map((_,ci)=>{ const c = ci+1, f = `${id}.${ri}.${c}`;
      return b.c.includes(c) ? `<td class="c"><input type="checkbox" class="chk" data-f="${f}" aria-label="${esc(b.h[c])}"></td>` : `<td><input type="text" data-f="${f}" aria-label="${esc(b.h[c])}"></td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
function dynWidgets(root, v, key){
  root.querySelectorAll('[data-dyn]').forEach(el => {
    const id = el.dataset.dyn;
    if (el.dataset.kind === 'ck'){
      v[id] = v[id] || [{t:'',d:false}];
      el.innerHTML = v[id].map((r,i)=>`<div class="prio"><input type="checkbox" class="chk" data-f="${id}.${i}.d" aria-label="Hecho"><input type="text" data-f="${id}.${i}.t" aria-label="Elemento ${i+1}"></div>`).join('') + `<button class="btn ghost small" data-add>+ Agregar</button>`;
      el.querySelector('[data-add]').onclick = () => { v[id].push({t:'',d:false}); store.save(key); render(); };
    } else {
      const h = JSON.parse(el.dataset.h), checks = JSON.parse(el.dataset.c);
      v[id] = v[id] || [h.map(()=> '')];
      el.innerHTML = `<div class="scroll"><table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join('')}<th></th></tr></thead><tbody>
        ${v[id].map((r,ri)=>`<tr>${h.map((_,ci)=> checks.includes(ci) ? `<td class="c"><input type="checkbox" class="chk" data-f="${id}.${ri}.${ci}" aria-label="${esc(h[ci])}"></td>` : `<td><input type="text" data-f="${id}.${ri}.${ci}" aria-label="${esc(h[ci])}"></td>`).join('')}<td><button class="x" data-rm="${ri}" aria-label="Quitar fila">×</button></td></tr>`).join('')}
      </tbody></table></div><button class="btn ghost small" data-add>+ Agregar fila</button>`;
      el.querySelector('[data-add]').onclick = () => { v[id].push(h.map(()=> '')); store.save(key); render(); };
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (v[id].length > 1){ v[id].splice(b.dataset.rm,1); store.save(key); render(); } });
    }
  });
}
const entrySel = {};
async function vTool(sec, tool){
  const key = 'tool-' + slug(tool.n);
  if (tool.ref){
    main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">${esc(sec.n)}</div><h1>${esc(tool.n)}</h1></div></div>
      ${tool.pages.map((p,pi)=>`<div class="card page">${pi||tool.pages.length>1?`<h2>${md(p.t)}</h2>`:''}${blocksHTML(p.b,'r'+pi,true)}</div>`).join('')}</section>`;
    return;
  }
  const data = await store.get(key, {entries:[]});
  let sel = entrySel[key] ?? data.entries.length - 1;
  if (sel >= data.entries.length) sel = data.entries.length - 1;
  const e = data.entries[sel];
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">${esc(sec.n)}</div><h1>${esc(tool.n)}</h1></div>
      <div class="entries">${data.entries.length ? `<select id="esel" aria-label="Entrada">${data.entries.map((x,i)=>`<option value="${i}" ${i===sel?'selected':''}>${esc(x.nombre||('Entrada '+(i+1)))} · ${x.fecha}</option>`).join('')}</select>` : ''}
      <button class="btn" id="enew">+ Nueva</button></div></div>
    ${e ? `<div class="card"><div class="row"><div><label class="lab" for="enom">Nombre de esta entrada</label><input type="text" id="enom" placeholder="Ej.: iniciales del caso, tema o fecha"></div></div></div>
      ${tool.pages.map((p,pi)=>`<div class="card page">${tool.pages.length>1?`<h2>${md(p.t)}</h2>`:''}${blocksHTML(p.b,'p'+pi,false)}</div>`).join('')}
      <div style="display:flex;justify-content:flex-end"><button class="x" id="edel" style="font-size:13px">Eliminar esta entrada</button></div>`
    : `<div class="card empty-state"><p>Aún no tienes entradas en esta herramienta.</p><p class="muted">Cada entrada es una copia de la página del planner: por ejemplo, una consulta, una audiencia o un mes.</p><button class="btn" id="enew2">Crear la primera</button></div>`}
    ${statusEl}</section>`;
  const add = () => { data.entries.push({nombre:'', fecha: new Date().toLocaleDateString('es-US',{day:'numeric',month:'short',year:'numeric'}), v:{}}); entrySel[key] = data.entries.length-1; store.save(key); render(); };
  $('#enew').onclick = add; if ($('#enew2')) $('#enew2').onclick = add;
  if ($('#esel')) $('#esel').onchange = ev => { entrySel[key] = +ev.target.value; render(); };
  if (e){
    $('#enom').value = e.nombre || ''; $('#enom').oninput = ev => { e.nombre = ev.target.value; store.save(key); };
    dynWidgets(main, e.v, key);
    bind(e.v, key, main.querySelector('section'));
    $('#edel').onclick = ev => { const b = ev.target; if (b.dataset.armed){ data.entries.splice(sel,1); entrySel[key] = data.entries.length-1; store.save(key); render(); } else { b.dataset.armed = 1; b.textContent = 'Confirmar: eliminar'; } };
  }
  setStatus();
}

/* ---------- vocabulario ---------- */
let vq = '', vt = '';
function vVocab(){
  const temas = [...new Set(DATA.voc.map(v=>v.g))].sort();
  const draw = () => {
    const q = vq.toLowerCase();
    const hits = DATA.voc.filter(v => (!vt || v.g===vt) && (!q || (v.t+' '+v.e+' '+v.d).toLowerCase().includes(q)));
    $('#vlist').innerHTML = hits.length ? hits.map(v=>`<div class="voc"><div><b>${esc(v.t)}</b><span class="es">${esc(v.e)}</span></div><div>${esc(v.d)}</div><div class="ex">${esc(v.x)}</div></div>`).join('') : '<p class="muted">No hay términos que coincidan.</p>';
    $('#vcount').textContent = `${hits.length} de ${DATA.voc.length} términos`;
  };
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Inglés jurídico de inmigración</div><h1>Vocabulario esencial</h1></div><div class="muted" id="vcount"></div></div>
    <div class="card"><label class="lab" for="vs">Buscar en inglés o en español</label><input type="text" id="vs" placeholder="Ej.: fianza, removal, asilo">
      <div class="chips"><button data-t="" aria-pressed="${!vt}">Todos</button>${temas.map(t=>`<button data-t="${esc(t)}" aria-pressed="${t===vt}">${esc(t)}</button>`).join('')}</div>
      <div id="vlist"></div></div></section>`;
  $('#vs').value = vq; $('#vs').oninput = e => { vq = e.target.value; draw(); };
  main.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { vt = b.dataset.t; main.querySelectorAll('[data-t]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.t===vt)); draw(); });
  draw();
}
const refTable = (title, eyebrow, heads, rows, note) => () => { main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div></div>
  ${note?`<p class="muted">${note}</p>`:''}<div class="card scroll"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows().map(r=>`<tr>${r.map((c,i)=>`<td>${i?esc(c):'<b>'+esc(c)+'</b>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`; };
function vFrases(){
  main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">Inglés jurídico de inmigración</div><h1>Frases útiles</h1></div></div>
    <p class="muted">Estructuras de lenguaje para reconocer y practicar. No son modelos para presentar sin la revisión de quien está autorizado.</p>
    ${EXTRA.ph.map(g=>`<div class="card page"><h2>${esc(g.grupo)}</h2><div class="scroll"><table><thead><tr><th>En inglés</th><th>En español</th></tr></thead><tbody>${g.items.map(x=>`<tr><td>${esc(x.en)}</td><td>${esc(x.es)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</section>`;
}

/* ---------- navegación ---------- */
const SYS = [
  {id:'tiempo', n:'Mi tiempo', tools:[{id:'dia',n:'Mi día',f:vDia,date:'d'},{id:'semana',n:'Mi semana',f:vSemana,date:'w'},{id:'mes',n:'Mi mes',f:vMes,date:'m'},{id:'trimestre',n:'Mi trimestre',f:vTrimestre,date:'q'},{id:'ano',n:'Mi año',f:vAno,date:'y'}]},
  {id:'casos', n:'Mis casos', tools:[{id:'seguimiento',n:'Seguimiento de casos',f:vCasos},{id:'control-plazos',n:'Control de plazos',f:vPlazos}]},
  {id:'practica', n:'Mi práctica', tools:[]},
  {id:'conocimiento', n:'Mi conocimiento', tools:[]},
  {id:'vocab', n:'Vocabulario', tools:[{id:'terminos',n:'Vocabulario esencial',f:vVocab},
     {id:'falsos',n:'Falsos amigos',f:refTable('Falsos amigos','Inglés jurídico',['Término','Parece','En realidad significa'],()=>EXTRA.ff.map(x=>[x.en,x.parece,x.significa]),'Palabras que se parecen al español pero significan otra cosa en el contexto jurídico.')},
     {id:'verbos',n:'Verbos jurídicos',f:refTable('Verbos jurídicos','Inglés jurídico',['Verbo','Español','Ejemplo'],()=>EXTRA.vb.map(x=>[x.verb,x.es,x.ex]))},
     {id:'frases',n:'Frases útiles',f:vFrases},
     {id:'siglas',n:'Siglas',f:refTable('Siglas de inmigración','Inglés jurídico',['Sigla','Nombre en inglés','Qué es'],()=>EXTRA.ac.map(x=>[x.sigla,x.en,x.es]),'Las agencias y programas cambian de nombre o de estructura. Verifica la sigla vigente en la fuente oficial.')}]},
  {id:'crecimiento', n:'Mi crecimiento', tools:[]},
  {id:'capital', n:'Mi capital social', tools:[]},
  {id:'biblioteca', n:'Biblioteca', tools:[]},
];
SPEC.forEach(sec => { const sys = SYS.find(s => s.id === sec.id); sec.tools.forEach(t => sys.tools.push({id: slug(t.n), n: t.n, f: () => vTool(sec, t)})); });

const main = document.getElementById('main');
let sys = 'tiempo', tool = 'dia';
try{ const s = JSON.parse(localStorage.getItem('pl_nav')||'null'); if (s && SYS.find(x=>x.id===s[0])?.tools.find(t=>t.id===s[1])) [sys, tool] = s; }catch(e){}
function openTool(s, t){ sys = s; tool = t; try{ localStorage.setItem('pl_nav', JSON.stringify([s,t])); }catch(e){} render(); window.scrollTo(0,0); }
function drawNav(){
  $('#tabs').innerHTML = SYS.map(s=>`<button role="tab" data-s="${s.id}" aria-selected="${s.id===sys}">${s.n}</button>`).join('');
  $('#tabs').querySelectorAll('[data-s]').forEach(b => b.onclick = () => openTool(b.dataset.s, SYS.find(s=>s.id===b.dataset.s).tools[0].id));
  const S = SYS.find(s=>s.id===sys);
  $('#side').innerHTML = `<div class="side-t">${S.n}</div>` + S.tools.map(t=>`<button data-t="${t.id}" aria-current="${t.id===tool}">${esc(t.n)}</button>`).join('');
  $('#side').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openTool(sys, b.dataset.t));
  const sel = $('#side [aria-current="true"]'); if (sel && sel.scrollIntoView && window.innerWidth < 760) sel.scrollIntoView({inline:'center', block:'nearest'});
}
async function render(){
  drawNav();
  const T = SYS.find(s=>s.id===sys).tools.find(t=>t.id===tool);
  $('#datenav').hidden = !T.date;
  $('#datepick').value = iso(cur);
  await T.f();
}
const step = () => ({d:1, w:7}[SYS.find(s=>s.id===sys).tools.find(t=>t.id===tool).date]);
function move(dir){
  const k = SYS.find(s=>s.id===sys).tools.find(t=>t.id===tool).date;
  if (k === 'm') cur = new Date(cur.getFullYear(), cur.getMonth()+dir, 1);
  else if (k === 'q') cur = new Date(cur.getFullYear(), cur.getMonth()+3*dir, 1);
  else if (k === 'y') cur = new Date(cur.getFullYear()+dir, 0, 1);
  else cur = addDays(cur, dir*step());
  render();
}
$('#prev').onclick = () => move(-1);
$('#next').onclick = () => move(1);
$('#today').onclick = () => { cur = new Date(); cur.setHours(0,0,0,0); render(); };
$('#datepick').onchange = e => { if (e.target.value){ cur = parse(e.target.value); render(); } };

