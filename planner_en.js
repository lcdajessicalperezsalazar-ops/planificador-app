/* Generado por tools/build_en.py a partir de planner.js — no editar a mano */

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const MESES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DIAS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const monday = d => addDays(d, -((d.getDay()+6)%7));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g,' ');
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const longDate = d => `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const START = new Date(2026, 11, 28);
function weekNo(d){
  const n = Math.floor((monday(d) - START) / 864e5 / 7) + 1;
  if (n >= 1 && n <= 53) return n;                       // semanas del planner 2027 (la 1 empieza el 28 dic 2026)
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); // semana ISO para otros años
}
const capsuleFor = d => DATA.caps[`${pad(d.getMonth()+1)}-${pad(d.getDate())}`] || ['Ethics','Verify before you assert.'];
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
    clearTimeout(this.timers[key]); setStatus('Saving…');
    this.timers[key] = setTimeout(async () => {
      const { error } = await sb.from('planner_docs').upsert({ user_id: SESSION.user.id, key, value: this.cache[key], updated_at: new Date().toISOString() });
      setStatus(error ? 'Could not save. Check your connection and try again.' : undefined);
    }, 600);
  }
};
function setStatus(msg){
  const el = document.getElementById('status'); if (!el) return;
  el.textContent = msg || 'Saved to your account. Only you can see it.';
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
    <div class="head"><div><div class="eyebrow">My day · day ${doy} of the year</div><h1>${longDate(cur)}</h1></div></div>
    <div class="capsule"><span class="eyebrow">Capsule of the day · ${esc(cat)}</span>${esc(txt)}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>My 3 priorities</h2>
        ${s.p.map((_,i)=>`<div class="prio"><input type="checkbox" class="chk" data-f="p.${i}.d" aria-label="Done"><input type="text" id="p${i}" data-f="p.${i}.t" placeholder="Priority ${i+1}"></div>`).join('')}
        ${field('tareas','Cases / tasks','tareas',3)}${field('seg','Follow-up','seg',3)}${field('pl','Today’s deadlines','plazos',3)}</div>
      <div class="card"><h2>Schedule</h2>
        <div class="sched">${HORAS.map((h,i)=>`<span>${h}</span><input type="text" id="h${i}" data-f="h.${i}" aria-label="${h}">`).join('')}</div>
        ${field('llam','Calls / emails','llam',3)}${field('notas','Notes','notas',4)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

const REVIEW = ['Case that needs the most attention','Stalled case','Client waiting','Pending document','Upcoming deadline','Case to discuss with someone','Case I can close'];
const VIERNES = ['I met my deadlines','I answered important communications','I documented','I reviewed pending items','I supervised','I learned','I followed up'];
async function vSemana(){
  const mon = monday(cur), wn = weekNo(cur), k = 'semana-'+iso(mon);
  const s = await store.get(k, {r:Array(7).fill(''), q:'', v:Array(7).fill(false), mejor:'', corregir:'', prox:'', p:['','',''], aud:'', ent:'', cons:'', pl:''});
  const micro = DATA.micro[(wn-1) % DATA.micro.length];
  const days = [];
  for (let i=0;i<7;i++){ const d = addDays(mon,i); const ds = await store.get('dia-'+iso(d), null); days.push({d, done: ds ? ds.p.filter(p=>p.d).length : 0, tot: ds ? ds.p.filter(p=>p.t).length : 0}); }
  const end = addDays(mon,6);
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Week ${wn}</div><h1>My week</h1></div><div class="muted">${MESES[mon.getMonth()].slice(0,3)} ${mon.getDate()} – ${MESES[end.getMonth()].slice(0,3)} ${end.getDate()}, ${end.getFullYear()}</div></div>
    <div class="grid g2">
      <div class="card"><div class="eyebrow">Micro-lesson · ${esc(micro.t)}</div><h2 style="margin-top:4px">${esc(micro.h)}</h2><p style="margin:0">${esc(micro.x)}</p></div>
      <div class="card"><h2>The days</h2>
        ${days.map(x=>`<div class="weekday" data-go="${iso(x.d)}" role="button" tabindex="0"><b>${cap(DIAS[x.d.getDay()])} ${x.d.getDate()}</b><span class="pill ${x.tot && x.done===x.tot ? 'p-ok':'p-mute'}">${x.done}/${x.tot || 3} priorities</span></div>`).join('')}</div>
      <div class="card"><h2>Plan for the week</h2>
        ${[0,1,2].map(i=>`<div class="prio"><span class="gold" style="font-family:var(--display);font-weight:700">${i+1}</span><input type="text" id="wp${i}" data-f="p.${i}" placeholder="Priority for the week"></div>`).join('')}
        ${field('aud','Hearings','aud',2)}${field('ent','Interviews','ent',2)}${field('cons','Consultations','cons',2)}${field('wpl','Deadlines','pl',2)}</div>
      <div class="card"><h2>Case review</h2>
        <div class="ar">Use initials or an internal number. Do not write full names or A-numbers.</div>
        ${REVIEW.map((t,i)=>field('rv'+i,t,'r.'+i,1)).join('')}
        ${field('q','What could become a problem next week if I don’t handle it today?','q',3)}</div>
      <div class="card"><h2>Friday review</h2>
        ${VIERNES.map((t,i)=>`<div class="prio"><input type="checkbox" class="chk" id="v${i}" data-f="v.${i}"><label for="v${i}">${t}</label></div>`).join('')}
        ${field('mej','My best decision','mejor',1)}${field('cor','Something I need to fix','corregir',1)}${field('prx','Priority for next week','prox',1)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
  main.querySelectorAll('[data-go]').forEach(el => { const go = () => { cur = parse(el.dataset.go); openTool('tiempo','dia'); }; el.onclick = go; el.onkeydown = e => { if (e.key==='Enter') go(); }; });
}

const PLAN = ['Cases that need attention','Important deadlines','Hearings','Interviews','Consultations','Follow-ups','Clients waiting for documents','Documents I am waiting for','Pending accounts / fees','Training this month','Process I want to improve','Something I should delegate','Person I should connect with'];
const CIERRE = ['What worked?','What didn’t work?','Where did I lose time?','What process do I need?','What should I stop doing?','What should I delegate?','What did I learn?','What does my team need to learn?','Whom did I meet?','What relationship should I cultivate?','What course did I advance?','What did I read?','What mistake don’t I want to repeat?'];
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
    <div class="head"><div><div class="eyebrow">My month</div><h1>${cap(MESES[m])} ${y}</h1></div></div>
    <div class="grid g2">
      <div class="card"><h2>Calendar</h2><div class="cal">${['M','T','W','T','F','S','S'].map(d=>`<div class="cal-h">${d}</div>`).join('')}${cells.join('')}</div>
        <p class="muted" style="font-size:12.5px;margin-bottom:0">Tap a day to open it. The number shows completed priorities.</p></div>
      <div class="card"><div class="eyebrow">Professional challenge of the month</div><h2 style="margin-top:4px">${esc(reto.t)}</h2>
        ${reto.p.map((p,i)=>`<div class="prio"><input type="checkbox" class="chk" id="rt${i}" data-f="reto.${i}"><label for="rt${i}">${esc(p)}</label></div>`).join('')}
        ${field('pal','One word for this month','palabra',1)}</div>
      <div class="card"><h2>Monthly practice plan</h2>
        ${[0,1,2].map(i=>`<div class="prio"><span class="gold" style="font-family:var(--display);font-weight:700">${i+1}</span><input type="text" id="mp${i}" data-f="p.${i}" placeholder="Priority for the month"></div>`).join('')}
        ${PLAN.map((t,i)=>field('pl'+i,t,'plan.'+i,2)).join('')}</div>
      <div class="card"><h2>Month-end review</h2>${CIERRE.map((t,i)=>field('ci'+i,t,'cierre.'+i,2)).join('')}${field('lec','My main lesson this month','leccion',2)}</div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
  main.querySelectorAll('[data-go]').forEach(el => el.onclick = () => { cur = parse(el.dataset.go); openTool('tiempo','dia'); });
}

const TRIM = [['Clientes',['Communication','Expectations','Complaints','Follow-up']],['Casos',['Backlog','Deadlines','Errors','Results']],['Equipo',['Workload','Supervision','Training','Feedback']],['Procesos',['What works','What’s missing','What to automate','What to eliminate']],['Conocimiento',['What I learned','What I need to learn','Courses','Case law']],['Capital social',['New people','Relationships','Referrals','Collaborations']]];
const TRIM_N = {'Clientes':'Clients','Casos':'Cases','Equipo':'Team','Procesos':'Processes','Conocimiento':'Knowledge','Capital social':'Social capital'};
const AUD = ['Calendar','Files','Case notes','Client communication','Deadlines','Billing','Supervision','Technology','Security','Unauthorized practice','Training','Closed cases'];
async function vTrimestre(){
  const y = cur.getFullYear(), q = quarter(cur), k = `trim-${y}-${q}`;
  const s = await store.get(k, {r:{}, refl:['','','',''], aud:AUD.map(()=>({e:'',a:''})), foco:'', proy:'', apr:'', rel:''});
  const REF = ['What am I doing better?','What do I keep avoiding?','Where do I need help?','What must I not do again?'];
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">My quarter</div><h1>Quarter ${q} · ${y}</h1></div><div class="muted">${MESES.slice((q-1)*3,q*3).map(cap).join(' · ')}</div></div>
    <div class="grid g2">
      <div class="card"><h2>Quarter plan</h2>${field('tf','My focus','foco',2)}${field('tp','Main project','proy',2)}${field('ta','What I will learn','apr',2)}${field('tr','Relationship I want to cultivate','rel',2)}</div>
      <div class="card"><h2>Reflection</h2>${REF.map((t,i)=>field('rf'+i,t,'refl.'+i,2)).join('')}</div>
      ${TRIM.map(([g,it],gi)=>`<div class="card"><h2>${TRIM_N[g]}</h2>${it.map((t,i)=>field(`tq${gi}_${i}`,t,`r.${slug(g)}-${i}`,2)).join('')}</div>`).join('')}
      <div class="card" style="grid-column:1/-1"><h2>Office audit</h2><div class="scroll"><table><thead><tr><th>Area</th><th>Status</th><th>Action required</th></tr></thead><tbody>
        ${AUD.map((a,i)=>`<tr><td><b>${a}</b></td><td><select id="au${i}" data-f="aud.${i}.e" aria-label="Status"><option value="">—</option><option value="Necesita atención">Needs attention</option><option value="Funciona">Works</option><option value="Fuerte">Strong</option></select></td><td><input type="text" id="aa${i}" data-f="aud.${i}.a" aria-label="Action"></td></tr>`).join('')}
      </tbody></table></div></div>
    </div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

const ANO = [['My vision for 2027','vision',4],['Three words for my year','palabras',1],['My 3 professional goals','prof',3],['My 3 learning goals','form',3],['My 3 financial or practice goals','fin',3],['My professional network goals','red',3],['My professional well-being goals','bien',3],['What I want to learn','apr',2],['What I want to stop doing','dejar',2],['What I want to start doing','empezar',2],['How I will know it was a good year','exito',3]];
async function vAno(){
  const y = cur.getFullYear(), k = 'ano-'+y;
  const s = await store.get(k, {});
  main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">My year</div><h1>My ${y}</h1></div></div>
    <div class="grid g2">${[ANO.slice(0,6), ANO.slice(6)].map(col=>`<div class="card">${col.map(([t,f,n])=>field('a-'+f,t,f,n)).join('')}</div>`).join('')}</div>${statusEl}</section>`;
  bind(s, k, main); setStatus();
}

/* ---------- MIS CASOS: control de plazos y seguimiento ---------- */
async function vPlazos(){
  const list = await store.get('plazos', []);
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = list.map((p,i)=>({...p,i})).sort((a,b)=> (a.hecho-b.hecho) || (a.fecha||'9').localeCompare(b.fecha||'9'));
  const chip = p => { if (p.hecho) return '<span class="pill p-ok">Done</span>'; if (!p.fecha) return '<span class="pill p-mute">No date</span>';
    const n = Math.round((parse(p.fecha)-today)/864e5);
    if (n < 0) return `<span class="pill p-bad">Overdue ${-n} d</span>`;
    if (n === 0) return '<span class="pill p-bad">Due today</span>';
    return `<span class="pill ${n<=7?'p-warn':'p-mute'}">In ${n} d</span>`; };
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">My cases</div><h1>Deadline control</h1></div></div>
    <div class="notice"><b>Always verify the applicable rule.</b><span>This tool does not calculate deadlines: it records how each one was calculated, under which rule and who verified it.</span></div>
    <form class="card" id="fp">
      <div class="row"><div><label class="lab" for="fc">Case (initials or internal no.)</label><input type="text" id="fc" required></div>
        <div><label class="lab" for="fe">Event / document</label><input type="text" id="fe" required></div>
        <div><label class="lab" for="ff">Deadline</label><input type="date" id="ff"></div></div>
      <div class="row"><div><label class="lab" for="fr">Rule and source consulted</label><input type="text" id="fr"></div>
        <div><label class="lab" for="fv">Verified by (second person)</label><input type="text" id="fv"></div></div>
      <div style="margin-top:12px"><button class="btn" type="submit">Add deadline</button></div>
    </form>
    <div class="card scroll" style="margin-top:14px">
      ${rows.length ? `<table><thead><tr><th>Status</th><th>Date</th><th>Case</th><th>Event</th><th>Rule / source</th><th>Verified</th><th>Done</th><th></th></tr></thead><tbody>
      ${rows.map(p=>`<tr><td>${chip(p)}</td><td style="white-space:nowrap">${p.fecha ? MESES[parse(p.fecha).getMonth()].slice(0,3)+' '+parse(p.fecha).getDate()+', '+p.fecha.slice(0,4) : '—'}</td><td>${esc(p.caso)}</td><td>${esc(p.evento)}</td><td>${esc(p.regla)||'<span class="muted">Missing</span>'}</td><td>${esc(p.verif)||'<span class="muted">Missing</span>'}</td>
      <td><input type="checkbox" class="chk" data-i="${p.i}" ${p.hecho?'checked':''} aria-label="Done"></td><td><button class="x" data-del="${p.i}" aria-label="Delete">×</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="margin:0">No deadlines yet. Add the first one with the form above.</p>'}
    </div>${statusEl}</section>`;
  $('#fp').addEventListener('submit', e => { e.preventDefault();
    list.push({caso:$('#fc').value.trim(), evento:$('#fe').value.trim(), fecha:$('#ff').value, regla:$('#fr').value.trim(), verif:$('#fv').value.trim(), hecho:false});
    store.save('plazos'); render(); });
  main.querySelectorAll('[data-i]').forEach(el => el.onchange = () => { list[el.dataset.i].hecho = el.checked; store.save('plazos'); render(); });
  armDelete(list, 'plazos');
  setStatus();
}
function armDelete(list, key){
  main.querySelectorAll('[data-del]').forEach(el => el.onclick = () => { if (el.dataset.armed){ list.splice(el.dataset.del,1); store.save(key); render(); } else { el.dataset.armed = 1; el.textContent = 'Delete?'; el.style.fontSize='12px'; } });
}
const ESTADOS = ['Entrevista inicial','Preparación','Presentado','En espera','Audiencia / entrevista','Decisión','Cerrado'];
const EST_N = {'Entrevista inicial':'Intake','Preparación':'Preparation','Presentado':'Filed','En espera':'Pending','Audiencia / entrevista':'Hearing / interview','Decisión':'Decision','Cerrado':'Closed'};
async function vCasos(){
  const list = await store.get('casos', []);
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">My cases</div><h1>Case tracking</h1></div><div class="muted">${list.length} being tracked</div></div>
    <div class="ar">Use initials or an internal number, and keep the complete file in your office system.</div>
    <div class="chips">${ESTADOS.map(e=>`<span class="pill p-mute">${EST_N[e]}: ${list.filter(c=>c.estado===e).length}</span>`).join('')}</div>
    <form class="card" id="fcs"><div class="row">
      <div><label class="lab" for="cr">Reference</label><input type="text" id="cr" required placeholder="E.g., J.M. · 2027-014"></div>
      <div><label class="lab" for="ct">Type</label><input type="text" id="ct" placeholder="E.g., Family petition"></div>
      <div><label class="lab" for="cs">Stage</label><select id="cs">${ESTADOS.map(e=>`<option value="${e}">${EST_N[e]}</option>`).join('')}</select></div>
    </div><div class="row">
      <div><label class="lab" for="cp">Next action</label><input type="text" id="cp"></div>
      <div><label class="lab" for="cf">Date</label><input type="date" id="cf"></div>
    </div><div style="margin-top:12px"><button class="btn" type="submit">Add case</button></div></form>
    <div class="card scroll" style="margin-top:14px">${list.length ? `<table><thead><tr><th>Reference</th><th>Type</th><th>Stage</th><th>Next action</th><th>Date</th><th></th></tr></thead><tbody>
      ${list.map((c,i)=>`<tr><td><b>${esc(c.ref)}</b></td><td>${esc(c.tipo)}</td><td><select data-f="${i}.estado" aria-label="Stage">${ESTADOS.map(e=>`<option value="${e}">${EST_N[e]}</option>`).join('')}</select></td>
      <td><input type="text" data-f="${i}.prox" aria-label="Next action"></td><td><input type="date" data-f="${i}.fecha" aria-label="Date"></td><td><button class="x" data-del="${i}" aria-label="Delete">×</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="margin:0">No cases yet. Add the first one with the form above.</p>'}</div>${statusEl}</section>`;
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
      el.innerHTML = v[id].map((r,i)=>`<div class="prio"><input type="checkbox" class="chk" data-f="${id}.${i}.d" aria-label="Done"><input type="text" data-f="${id}.${i}.t" aria-label="Item ${i+1}"></div>`).join('') + `<button class="btn ghost small" data-add>+ Add</button>`;
      el.querySelector('[data-add]').onclick = () => { v[id].push({t:'',d:false}); store.save(key); render(); };
    } else {
      const h = JSON.parse(el.dataset.h), checks = JSON.parse(el.dataset.c);
      v[id] = v[id] || [h.map(()=> '')];
      el.innerHTML = `<div class="scroll"><table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join('')}<th></th></tr></thead><tbody>
        ${v[id].map((r,ri)=>`<tr>${h.map((_,ci)=> checks.includes(ci) ? `<td class="c"><input type="checkbox" class="chk" data-f="${id}.${ri}.${ci}" aria-label="${esc(h[ci])}"></td>` : `<td><input type="text" data-f="${id}.${ri}.${ci}" aria-label="${esc(h[ci])}"></td>`).join('')}<td><button class="x" data-rm="${ri}" aria-label="Remove row">×</button></td></tr>`).join('')}
      </tbody></table></div><button class="btn ghost small" data-add>+ Add row</button>`;
      el.querySelector('[data-add]').onclick = () => { v[id].push(h.map(()=> '')); store.save(key); render(); };
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (v[id].length > 1){ v[id].splice(b.dataset.rm,1); store.save(key); render(); } });
    }
  });
}
const entrySel = {};
async function vTool(sec, tool){
  const key = 'tool-' + slug(tool.key || tool.n);
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
      <div class="entries">${data.entries.length ? `<select id="esel" aria-label="Entry">${data.entries.map((x,i)=>`<option value="${i}" ${i===sel?'selected':''}>${esc(x.nombre||('Entry '+(i+1)))} · ${x.fecha}</option>`).join('')}</select>` : ''}
      <button class="btn" id="enew">+ New</button></div></div>
    ${e ? `<div class="card"><div class="row"><div><label class="lab" for="enom">Name of this entry</label><input type="text" id="enom" placeholder="E.g., case initials, topic or date"></div></div></div>
      ${tool.pages.map((p,pi)=>`<div class="card page">${tool.pages.length>1?`<h2>${md(p.t)}</h2>`:''}${blocksHTML(p.b,'p'+pi,false)}</div>`).join('')}
      <div style="display:flex;justify-content:flex-end"><button class="x" id="edel" style="font-size:13px">Delete this entry</button></div>`
    : `<div class="card empty-state"><p>You don’t have any entries in this tool yet.</p><p class="muted">Each entry is a copy of the planner page: for example, a consultation, a hearing or a month.</p><button class="btn" id="enew2">Create the first one</button></div>`}
    ${statusEl}</section>`;
  const add = () => { data.entries.push({nombre:'', fecha: new Date().toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}), v:{}}); entrySel[key] = data.entries.length-1; store.save(key); render(); };
  $('#enew').onclick = add; if ($('#enew2')) $('#enew2').onclick = add;
  if ($('#esel')) $('#esel').onchange = ev => { entrySel[key] = +ev.target.value; render(); };
  if (e){
    $('#enom').value = e.nombre || ''; $('#enom').oninput = ev => { e.nombre = ev.target.value; store.save(key); };
    dynWidgets(main, e.v, key);
    bind(e.v, key, main.querySelector('section'));
    $('#edel').onclick = ev => { const b = ev.target; if (b.dataset.armed){ data.entries.splice(sel,1); entrySel[key] = data.entries.length-1; store.save(key); render(); } else { b.dataset.armed = 1; b.textContent = 'Confirm: delete'; } };
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
    $('#vlist').innerHTML = hits.length ? hits.map(v=>`<div class="voc"><div><b>${esc(v.t)}</b><span class="es">${esc(v.e)}</span></div><div>${esc(v.d)}</div><div class="ex">${esc(v.x)}</div></div>`).join('') : '<p class="muted">No matching terms.</p>';
    $('#vcount').textContent = `${hits.length} of ${DATA.voc.length} terms`;
  };
  main.innerHTML = `<section class="view">
    <div class="head"><div><div class="eyebrow">Immigration vocabulary</div><h1>Essential vocabulary</h1></div><div class="muted" id="vcount"></div></div>
    <div class="card"><label class="lab" for="vs">Search in English or Spanish</label><input type="text" id="vs" placeholder="E.g., bond, removal, asilo">
      <div class="chips"><button data-t="" aria-pressed="${!vt}">All</button>${temas.map(t=>`<button data-t="${esc(t)}" aria-pressed="${t===vt}">${esc(t)}</button>`).join('')}</div>
      <div id="vlist"></div></div></section>`;
  $('#vs').value = vq; $('#vs').oninput = e => { vq = e.target.value; draw(); };
  main.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { vt = b.dataset.t; main.querySelectorAll('[data-t]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.t===vt)); draw(); });
  draw();
}
const refTable = (title, eyebrow, heads, rows, note) => () => { main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div></div>
  ${note?`<p class="muted">${note}</p>`:''}<div class="card scroll"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows().map(r=>`<tr>${r.map((c,i)=>`<td>${i?esc(c):'<b>'+esc(c)+'</b>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`; };
function vFrases(){
  main.innerHTML = `<section class="view"><div class="head"><div><div class="eyebrow">Immigration vocabulary</div><h1>Useful phrases</h1></div></div>
    <p class="muted">Language structures to recognize and practice. They are not models to file without review by an authorized person.</p>
    ${EXTRA.ph.map(g=>`<div class="card page"><h2>${esc(g.grupo)}</h2><div class="scroll"><table><thead><tr><th>English</th><th>Spanish</th></tr></thead><tbody>${g.items.map(x=>`<tr><td>${esc(x.en)}</td><td>${esc(x.es)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</section>`;
}

/* ---------- navegación ---------- */
const SYS = [
  {id:'tiempo', n:'My Time', tools:[{id:'dia',n:'My day',f:vDia,date:'d'},{id:'semana',n:'My week',f:vSemana,date:'w'},{id:'mes',n:'My month',f:vMes,date:'m'},{id:'trimestre',n:'My quarter',f:vTrimestre,date:'q'},{id:'ano',n:'My year',f:vAno,date:'y'}]},
  {id:'casos', n:'My Cases', tools:[{id:'seguimiento',n:'Case tracking',f:vCasos},{id:'control-plazos',n:'Deadline control',f:vPlazos}]},
  {id:'practica', n:'My Practice', tools:[]},
  {id:'conocimiento', n:'My Knowledge', tools:[]},
  {id:'vocab', n:'Vocabulary', tools:[{id:'terminos',n:'Essential vocabulary',f:vVocab},
     {id:'falsos',n:'Terms that can confuse',f:refTable('Terms that can confuse','Immigration vocabulary',['Term','Looks like (Spanish)','What it really means'],()=>EXTRA.ff.map(x=>[x.en,x.parece,x.significa]),'Words that look like Spanish but mean something else in a legal context.')},
     {id:'verbos',n:'Legal verbs',f:refTable('Legal verbs','Immigration vocabulary',['Verb','Spanish','Example'],()=>EXTRA.vb.map(x=>[x.verb,x.es,x.ex]))},
     {id:'frases',n:'Useful phrases',f:vFrases},
     {id:'siglas',n:'Acronyms',f:refTable('Immigration acronyms','Immigration vocabulary',['Acronym','Full name','What it is'],()=>EXTRA.ac.map(x=>[x.sigla,x.en,x.es]),'Agencies and programs change names or structure. Verify the current acronym in the official source.')}]},
  {id:'crecimiento', n:'My Growth', tools:[]},
  {id:'capital', n:'My Social Capital', tools:[]},
  {id:'biblioteca', n:'Library', tools:[]},
];
SPEC.forEach(sec => { const sys = SYS.find(s => s.id === sec.id); sec.tools.forEach(t => sys.tools.push({id: slug(t.key || t.n), n: t.n, f: () => vTool(sec, t)})); });

const main = document.getElementById('main');
let sys = 'tiempo', tool = 'dia';
try{ const s = JSON.parse(localStorage.getItem('pl_nav_en')||'null'); if (s && SYS.find(x=>x.id===s[0])?.tools.find(t=>t.id===s[1])) [sys, tool] = s; }catch(e){}
function openTool(s, t){ sys = s; tool = t; try{ localStorage.setItem('pl_nav_en', JSON.stringify([s,t])); }catch(e){} render(); window.scrollTo(0,0); }
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

