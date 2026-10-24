/* Consulta: preguntas respondidas con el texto del libro "El Derecho de Inmigración en los Estados Unidos".
   La búsqueda corre en la base de datos (función search_book) y solo devuelve texto del libro. */
(function () {
  const ED = 'es';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mark = s => esc(s).replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
  const para = s => esc(s).split(/\n{1,}/).filter(x => x.trim()).map(x => `<p>${x}</p>`).join('');
  const where = r => [r.chapter ? `Capítulo ${r.chapter}` : '', r.chapter_title || '', r.section ? `§ ${r.section}` : ''].filter(Boolean).join(' · ');

  const modal = document.createElement('div');
  modal.className = 'modal consulta'; modal.id = 'consultamodal'; modal.hidden = true;
  modal.innerHTML = `<div class="modal-card wide" role="dialog" aria-labelledby="consultatit">
    <div class="eyebrow">El Derecho de Inmigración en los Estados Unidos</div>
    <h2 id="consultatit">Consulta mi libro</h2>
    <form id="consultaform" class="consulta-form">
      <input id="consultaq" type="search" placeholder="Escribe tu pregunta. Ej.: requisitos de la cancelación de remoción" autocomplete="off" aria-label="Tu pregunta">
      <button class="btn" type="submit">Buscar</button>
    </form>
    <div id="consultaout" class="consulta-out"></div>
    <p class="muted small">Las respuestas son el texto del libro de la Lcda. Jessica L. Pérez-Salazar. Es material educativo y no constituye asesoría legal: verifica siempre que la autoridad citada siga vigente.</p>
    <button class="link" id="consultacerrar">Cerrar</button>
  </div>`;
  document.body.appendChild(modal);
  const out = modal.querySelector('#consultaout');
  const close = () => { modal.hidden = true; };
  modal.querySelector('#consultacerrar').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  let last = [];
  async function search(q) {
    out.innerHTML = '<p class="muted">Buscando en el libro…</p>';
    const { data, error } = await sb.rpc('search_book', { q, ed: ED, n: 6 });
    if (error) { out.innerHTML = '<p class="msg err">No pudimos consultar el libro. Verifica que tu acceso esté activo.</p>'; return; }
    last = data || [];
    if (!last.length) { out.innerHTML = '<p class="muted">El libro no trata este tema con esas palabras. Prueba con otros términos, por ejemplo el nombre del alivio, del formulario o del caso.</p>'; return; }
    out.innerHTML = `<div class="muted small">Lo que dice el libro sobre tu pregunta:</div>` + last.map((r, i) => `
      <article class="hit">
        <div class="hit-where">${esc(where(r))}</div>
        ${r.heading ? `<h3>${esc(r.heading)}</h3>` : ''}
        <div class="hit-txt">${mark(r.snippet)}</div>
        <button class="link" data-read="${r.ord}">Leer la sección completa</button>
      </article>`).join('');
    out.querySelectorAll('[data-read]').forEach(b => b.onclick = () => read(+b.dataset.read));
  }

  async function read(ord) {
    out.innerHTML = '<p class="muted">Abriendo la sección…</p>';
    const { data, error } = await sb.from('book_chunks').select('ord,chapter,chapter_title,section,heading,body').eq('edition', ED).eq('ord', ord).maybeSingle();
    if (error || !data) { out.innerHTML = '<p class="msg err">No pudimos abrir esta sección.</p>'; return; }
    out.innerHTML = `<article class="reader">
      <div class="hit-where">${esc(where(data))}</div>
      ${data.heading ? `<h3>${esc(data.heading)}</h3>` : ''}
      <div class="reader-txt">${para(data.body)}</div>
      <div class="reader-nav">
        <button class="btn ghost small" data-go="${ord - 1}">‹ Anterior</button>
        ${last.length ? '<button class="btn ghost small" id="volver">Volver a los resultados</button>' : ''}
        <button class="btn ghost small" data-go="${ord + 1}">Siguiente ›</button>
      </div></article>`;
    out.querySelectorAll('[data-go]').forEach(b => b.onclick = () => read(+b.dataset.go));
    const v = out.querySelector('#volver'); if (v) v.onclick = () => render();
    out.scrollIntoView({ block: 'start' });
  }
  function render() { search(modal.querySelector('#consultaq').value.trim()); }

  modal.querySelector('#consultaform').onsubmit = e => {
    e.preventDefault();
    const q = modal.querySelector('#consultaq').value.trim();
    if (q.length < 3) return;
    search(q);
  };

  const btn = document.getElementById('consulta');
  if (btn) btn.onclick = () => { modal.hidden = false; setTimeout(() => modal.querySelector('#consultaq').focus(), 50); };
})();
