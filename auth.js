/* Acceso: inicio de sesión, activación con el código del libro y vencimiento de la edición */
const sb = supabase.createClient(window.PLANNER_CONFIG.supabaseUrl, window.PLANNER_CONFIG.supabaseKey);
let SESSION = null;

const gate = document.getElementById('gate');
const card = document.getElementById('gatecard');
const appEl = document.getElementById('app');

function show(which){ gate.hidden = which !== 'gate'; appEl.hidden = which !== 'app'; }
function msg(text, kind = 'err'){ const el = card.querySelector('.msg'); if (el){ el.className = 'msg ' + kind; el.textContent = text; el.hidden = !text; } }
const brand = `<span class="eyebrow">Planificador Profesional de Inmigración · 2027</span>`;

/* ---------- pantallas ---------- */
function screenLogin(mode = 'login'){
  show('gate');
  const isNew = mode === 'signup';
  card.innerHTML = `${brand}
    <h1>${isNew ? 'Crea tu cuenta' : 'Bienvenida, bienvenido'}</h1>
    <p class="muted">${isNew ? 'Usa un correo al que tengas acceso: te enviaremos un enlace para confirmarlo.' : 'Entra con el correo y la contraseña de tu cuenta.'}</p>
    <form id="f">
      <label class="lab" for="em">Correo electrónico</label><input type="text" id="em" inputmode="email" autocomplete="email" required>
      <label class="lab" for="pw">Contraseña</label><input type="password" id="pw" autocomplete="${isNew ? 'new-password' : 'current-password'}" minlength="8" required style="width:100%;border:0;border-bottom:1px solid var(--line);padding:6px 2px;background:transparent;outline:none">
      ${isNew ? '<p class="muted small">Mínimo 8 caracteres.</p>' : ''}
      <button class="btn" type="submit">${isNew ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
    <p class="msg" hidden></p>
    <p>${isNew ? '<button class="link" id="sw">Ya tengo cuenta</button>' : '<button class="link" id="sw">Crear una cuenta nueva</button> · <button class="link" id="fg">Olvidé mi contraseña</button>'}</p>`;
  card.querySelector('#sw').onclick = () => screenLogin(isNew ? 'login' : 'signup');
  const fg = card.querySelector('#fg');
  if (fg) fg.onclick = async () => {
    const email = card.querySelector('#em').value.trim();
    if (!email) return msg('Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(error ? 'No pudimos enviar el correo. Revisa la dirección e inténtalo de nuevo.' : 'Te enviamos un correo con un enlace para crear una contraseña nueva.', error ? 'err' : 'ok');
  };
  card.querySelector('#f').onsubmit = async e => {
    e.preventDefault();
    const email = card.querySelector('#em').value.trim(), password = card.querySelector('#pw').value;
    const btn = card.querySelector('.btn'); btn.disabled = true;
    if (isNew){
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) return msg(error.message.includes('registered') ? 'Ya existe una cuenta con ese correo. Toca "Ya tengo cuenta".' : 'No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.');
      if (!data.session) return msg('Listo. Revisa tu correo y toca el enlace de confirmación; después entra aquí con tu contraseña.', 'ok');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) return msg(error.message.toLowerCase().includes('confirm') ? 'Primero confirma tu correo con el enlace que te enviamos.' : 'Correo o contraseña incorrectos.');
    }
  };
}

function screenNewPassword(){
  show('gate');
  card.innerHTML = `${brand}<h1>Nueva contraseña</h1>
    <form id="f"><label class="lab" for="pw">Contraseña nueva (mínimo 8 caracteres)</label>
    <input type="password" id="pw" minlength="8" required autocomplete="new-password" style="width:100%;border:0;border-bottom:1px solid var(--line);padding:6px 2px;background:transparent;outline:none">
    <button class="btn" type="submit">Guardar contraseña</button></form><p class="msg" hidden></p>`;
  card.querySelector('#f').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: card.querySelector('#pw').value });
    if (error) return msg('No se pudo guardar. Inténtalo de nuevo.');
    route();
  };
}

let CHALLENGE = null;
function screenActivate(){
  show('gate');
  card.innerHTML = `${brand}<h1>Activa tu app</h1>
    <p>Tu planner incluye el acceso a la app. Escribe el <b>código de acceso</b> que aparece en la página “Tu planner también es una app”.</p>
    <form id="f1"><label class="lab" for="code">Código de acceso</label><input type="text" id="code" autocomplete="off" style="text-transform:uppercase" required>
      <button class="btn" type="submit">Continuar</button></form>
    <div id="step2" hidden></div>
    <p class="msg" hidden></p>
    <p><button class="link" id="out">Cerrar sesión</button></p>`;
  card.querySelector('#out').onclick = () => sb.auth.signOut();
  card.querySelector('#f1').onsubmit = async e => {
    e.preventDefault();
    const code = card.querySelector('#code').value.trim();
    const { data, error } = await sb.rpc('get_challenge', { p_code: code });
    if (error || !data || !data.length) return msg('Ese código no es válido o la edición ya venció. Revísalo en tu planner.');
    CHALLENGE = { code, ...data[0] };
    const s2 = card.querySelector('#step2'); s2.hidden = false; msg('');
    s2.innerHTML = `<div class="challenge" style="margin-top:14px">Para confirmar que tienes el libro, abre tu planner en la <b>página ${CHALLENGE.page}</b> y escribe la <b>palabra número ${CHALLENGE.word_index}</b> del texto de esa página (sin contar el número de página).</div>
      <form id="f2"><label class="lab" for="ans">Palabra</label><input type="text" id="ans" autocomplete="off" required>
      <button class="btn" type="submit">Activar mi acceso</button></form>`;
    s2.querySelector('#f2').onsubmit = async ev => {
      ev.preventDefault();
      const { data: r, error: er } = await sb.rpc('redeem_code', { p_code: CHALLENGE.code, p_question_id: CHALLENGE.question_id, p_answer: s2.querySelector('#ans').value });
      if (er) return msg('No pudimos verificar el acceso. Inténtalo de nuevo en unos minutos.');
      const texts = { bad_code: 'Ese código no es válido o la edición ya venció.', bad_answer: 'Esa palabra no coincide. Revisa la página y vuelve a intentarlo.', too_many: 'Hiciste demasiados intentos. Espera una hora y vuelve a intentarlo.', no_session: 'Tu sesión terminó. Vuelve a entrar.' };
      if (r !== 'ok') return msg(texts[r] || 'No pudimos activar el acceso.');
      route();
    };
  };
}

function screenExpired(p){
  show('gate');
  const d = new Date(p.expires_at).toLocaleDateString('es-US', { day:'numeric', month:'long', year:'numeric' });
  card.innerHTML = `${brand}<h1>Tu edición terminó</h1>
    <p>El acceso de la edición ${esc(p.edition_code)} estuvo vigente hasta el ${d}. Para seguir usando la app, activa el código de tu nuevo planner.</p>
    <button class="btn" id="new">Activar un código nuevo</button><p><button class="link" id="out">Cerrar sesión</button></p>`;
  card.querySelector('#new').onclick = screenActivate;
  card.querySelector('#out').onclick = () => sb.auth.signOut();
}

/* ---------- ruta según el estado de la cuenta ---------- */
let started = false;
async function route(){
  const { data: { session } } = await sb.auth.getSession();
  SESSION = session;
  if (!session) return screenLogin();
  const { data: p } = await sb.from('profiles').select('edition_code, expires_at').maybeSingle();
  if (!p) return screenActivate();
  if (new Date(p.expires_at) <= new Date()) return screenExpired(p);
  show('app');
  document.getElementById('acc').textContent = `${session.user.email} · acceso hasta el ${new Date(p.expires_at).toLocaleDateString('es-US', { day:'numeric', month:'short', year:'numeric' })}`;
  if (!started){ started = true; store.cache = {}; }
  render();
}

document.getElementById('logout').onclick = () => sb.auth.signOut();
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') return screenNewPassword();
  if (event === 'SIGNED_OUT'){ store.cache = {}; started = false; }
  if (['SIGNED_IN', 'SIGNED_OUT', 'INITIAL_SESSION'].includes(event)) setTimeout(route, 0);
});
