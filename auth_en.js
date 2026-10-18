/* Generado por tools/build_en.py a partir de auth.js — no editar a mano */
/* Acceso: inicio de sesión, activación con el código del libro y vencimiento de la edición */
const sb = supabase.createClient(window.PLANNER_CONFIG.supabaseUrl, window.PLANNER_CONFIG.supabaseKey);
let SESSION = null;

const gate = document.getElementById('gate');
const card = document.getElementById('gatecard');
const appEl = document.getElementById('app');

function show(which){ gate.hidden = which !== 'gate'; appEl.hidden = which !== 'app'; }
function msg(text, kind = 'err'){ const el = card.querySelector('.msg'); if (el){ el.className = 'msg ' + kind; el.textContent = text; el.hidden = !text; } }
const brand = `<span class="eyebrow">Immigration Professional Planner · 2027</span>`;

/* ---------- pantallas ---------- */
function screenLogin(mode = 'login'){
  show('gate');
  const isNew = mode === 'signup';
  card.innerHTML = `${brand}
    <h1>${isNew ? 'Create your account' : 'Welcome'}</h1>
    <p class="muted">${isNew ? 'Use an email you can access: we will send you a link to confirm it.' : 'Sign in with your account email and password.'}</p>
    <form id="f">
      <label class="lab" for="em">Email</label><input type="text" id="em" inputmode="email" autocomplete="email" required>
      <label class="lab" for="pw">Password</label><input type="password" id="pw" autocomplete="${isNew ? 'new-password' : 'current-password'}" minlength="8" required style="width:100%;border:0;border-bottom:1px solid var(--line);padding:6px 2px;background:transparent;outline:none">
      ${isNew ? '<p class="muted small">At least 8 characters.</p>' : ''}
      <button class="btn" type="submit">${isNew ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="or"><span>or</span></div>
    <button class="btn ghost gbtn" id="google" type="button"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Continue with Google</button>
    <p class="msg" hidden></p>
    <p>${isNew ? '<button class="link" id="sw">I already have an account</button>' : '<button class="link" id="sw">Create a new account</button> · <button class="link" id="fg">Forgot my password</button>'}</p>`;
  card.querySelector('#google').onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) msg('Google sign-in is not available yet. Please use your email and password.');
  };
  card.querySelector('#sw').onclick = () => screenLogin(isNew ? 'login' : 'signup');
  const fg = card.querySelector('#fg');
  if (fg) fg.onclick = async () => {
    const email = card.querySelector('#em').value.trim();
    if (!email) return msg('Enter your email and tap "Forgot my password" again.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(error ? 'We could not send the email. Check the address and try again.' : 'We sent you an email with a link to create a new password.', error ? 'err' : 'ok');
  };
  card.querySelector('#f').onsubmit = async e => {
    e.preventDefault();
    const email = card.querySelector('#em').value.trim(), password = card.querySelector('#pw').value;
    const btn = card.querySelector('.btn'); btn.disabled = true;
    if (isNew){
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) return msg(error.message.includes('registered') ? 'An account with that email already exists. Tap "I already have an account".' : 'We could not create the account. Check your details and try again.');
      if (!data.session) return msg('Done. Check your email and tap the confirmation link; then sign in here with your password.', 'ok');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) return msg(error.message.toLowerCase().includes('confirm') ? 'Please confirm your email first with the link we sent you.' : 'Incorrect email or password.');
    }
  };
}

function screenNewPassword(){
  show('gate');
  card.innerHTML = `${brand}<h1>New password</h1>
    <form id="f"><label class="lab" for="pw">New password (at least 8 characters)</label>
    <input type="password" id="pw" minlength="8" required autocomplete="new-password" style="width:100%;border:0;border-bottom:1px solid var(--line);padding:6px 2px;background:transparent;outline:none">
    <button class="btn" type="submit">Save password</button></form><p class="msg" hidden></p>`;
  card.querySelector('#f').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: card.querySelector('#pw').value });
    if (error) return msg('Could not save. Please try again.');
    route();
  };
}

let CHALLENGE = null;
function screenActivate(){
  show('gate');
  card.innerHTML = `${brand}<h1>Activate your app</h1>
    <p>Your planner includes access to the app. Enter the <b>access code</b> shown on the page “Your planner is also an app”.</p>
    <form id="f1"><label class="lab" for="code">Access code</label><input type="text" id="code" autocomplete="off" style="text-transform:uppercase" required>
      <button class="btn" type="submit">Continue</button></form>
    <div id="step2" hidden></div>
    <p class="msg" hidden></p>
    <p><button class="link" id="out">Sign out</button></p>`;
  card.querySelector('#out').onclick = () => sb.auth.signOut();
  card.querySelector('#f1').onsubmit = async e => {
    e.preventDefault();
    const code = card.querySelector('#code').value.trim();
    const { data: rc } = await sb.rpc('redeem_access_code', { p_code: code });
    if (rc === 'ok') return route();
    if (rc === 'used') return msg('That access code has already been used. If it is yours, please contact us.');
    if (rc === 'too_many') return msg('Too many attempts. Please wait an hour and try again.');
    if (rc === 'bad_code') return msg('That code is no longer valid.');
    const { data, error } = await sb.rpc('get_challenge', { p_code: code });
    if (error || !data || !data.length) return msg('That code is not valid or the edition has expired. Check it in your planner.');
    CHALLENGE = { code, ...data[0] };
    const s2 = card.querySelector('#step2'); s2.hidden = false; msg('');
    const EN = !/^PLANIFICADOR/i.test(code);
    s2.innerHTML = `<div class="challenge" style="margin-top:14px">${EN
      ? `To confirm you own the book, open your planner to <b>page ${CHALLENGE.page}</b>. In the <b>micro-lesson of the week</b> (the box at the bottom of the page), type <b>word number ${CHALLENGE.word_index}</b> of the text, not counting the title.`
      : `Para confirmar que tienes el libro, abre tu planner en la <b>página ${CHALLENGE.page}</b>. En la <b>micro-lección de la semana</b> (el recuadro al final de la página), escribe la <b>palabra número ${CHALLENGE.word_index}</b> del texto, sin contar el título.`}</div>
      <form id="f2"><label class="lab" for="ans">${EN ? "Word" : "Palabra"}</label><input type="text" id="ans" autocomplete="off" required>
      <button class="btn" type="submit">${EN ? "Activate my access" : "Activar mi acceso"}</button></form>`;
    s2.querySelector('#f2').onsubmit = async ev => {
      ev.preventDefault();
      const { data: r, error: er } = await sb.rpc('redeem_code', { p_code: CHALLENGE.code, p_question_id: CHALLENGE.question_id, p_answer: s2.querySelector('#ans').value });
      if (er) return msg('We could not verify your access. Please try again in a few minutes.');
      const texts = { bad_code: 'That code is not valid or the edition has expired.', bad_answer: 'That word does not match. Check the page and try again.', too_many: 'Too many attempts. Please wait an hour and try again.', no_session: 'Your session ended. Please sign in again.' };
      if (r !== 'ok') return msg(texts[r] || 'We could not activate your access.');
      route();
    };
  };
}

function screenExpired(p){
  show('gate');
  const d = new Date(p.expires_at).toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' });
  card.innerHTML = `${brand}<h1>Your edition has ended</h1>
    <p>Access for the ${esc(p.edition_code)} edition was valid until ${d}. To keep using the app, activate the code from your new planner.</p>
    <button class="btn" id="new">Activate a new code</button><p><button class="link" id="out">Sign out</button></p>`;
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
  document.getElementById('acc').textContent = `${session.user.email} · access until ${new Date(p.expires_at).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' })}`;
  if (!started){ started = true; store.cache = {}; }
  render();
}

document.getElementById('logout').onclick = () => sb.auth.signOut();
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') return screenNewPassword();
  if (event === 'SIGNED_OUT'){ store.cache = {}; started = false; }
  if (['SIGNED_IN', 'SIGNED_OUT', 'INITIAL_SESSION'].includes(event)) setTimeout(route, 0);
});

/* ---------- Mi libro: PDF privado, solo para cuentas con acceso activo ---------- */
const libroModal = document.getElementById('libromodal');
document.getElementById('libro').onclick = () => { libroModal.hidden = false; };
document.getElementById('librocerrar').onclick = () => { libroModal.hidden = true; };
libroModal.addEventListener('click', e => { if (e.target === libroModal) libroModal.hidden = true; });
libroModal.querySelectorAll('[data-libro]').forEach(b => b.onclick = async () => {
  const m = document.getElementById('libromsg'); m.hidden = false; m.className = 'msg ok'; m.textContent = 'Preparing your book…';
  const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('libro').createSignedUrl(b.dataset.libro, 3600);
  if (error || !data) { if (w) w.close(); m.className = 'msg err'; m.textContent = 'We could not open the book. Check that your access is active.'; return; }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  m.hidden = true;
});
