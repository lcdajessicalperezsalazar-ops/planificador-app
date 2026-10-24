/* Consulta: preguntas respondidas con el texto del libro "El Derecho de Inmigración en los Estados Unidos".
   La búsqueda corre en la base de datos (función consulta_libro) y solo devuelve texto del libro. */
(function () {
  const ED = (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
  const T = ED === 'en' ? {
    eyebrow: 'From the book U.S. Immigration Law: A Comprehensive Legal Guide', title: 'Consult U.S. Immigration Law',
    ph: 'Type your question. E.g.: requirements for non-LPR cancellation of removal', ask: 'Your question', go: 'Search',
    note: 'Answers are the text of the book by Jessica L. Pérez-Salazar, Esq. This is educational material and not legal advice: always verify that the cited authority is still current.',
    close: 'Close', searching: 'Searching the book…', err: 'We could not search the book. Please check that your access is active.',
    none: 'The book does not address this topic in those words. Try other terms, such as the name of the relief, the form, or the case.',
    lead: 'What the book says about your question:', read: 'Read the full section', opening: 'Opening the section…', openerr: 'We could not open this section.',
    prev: '‹ Previous', next: 'Next ›', back: 'Back to results', chap: 'Chapter', intro: 'Introduction', pg: 'p.'
  } : {
    eyebrow: 'Del libro El Derecho de Inmigración en los Estados Unidos', title: 'Consulta el Derecho de Inmigración',
    ph: 'Escribe tu pregunta. Ej.: requisitos de la cancelación de remoción', ask: 'Tu pregunta', go: 'Buscar',
    note: 'Las respuestas son el texto del libro de la Lcda. Jessica L. Pérez-Salazar. Es material educativo y no constituye asesoría legal: verifica siempre que la autoridad citada siga vigente.',
    close: 'Cerrar', searching: 'Buscando en el libro…', err: 'No pudimos consultar el libro. Verifica que tu acceso esté activo.',
    none: 'El libro no trata este tema con esas palabras. Prueba con otros términos, por ejemplo el nombre del alivio, del formulario o del caso.',
    lead: 'Lo que dice el libro sobre tu pregunta:', read: 'Leer la sección completa', opening: 'Abriendo la sección…', openerr: 'No pudimos abrir esta sección.',
    prev: '‹ Anterior', next: 'Siguiente ›', back: 'Volver a los resultados', chap: 'Capítulo', intro: 'Introducción', pg: 'pág.'
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mark = s => esc(s).replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
  // une líneas partidas por un salto de página del PDF (sin punto final y la siguiente empieza en minúscula)
  const joinBreaks = s => String(s ?? '').replace(/([^.:;?!”")\]])\n(?=[a-záéíóúñü(])/g, '$1 ');
  const para = s => esc(joinBreaks(s)).split(/\n+/).filter(x => x.trim()).map(x => `<p>${x}</p>`).join('');
  const where = r => [r.chapter ? `${T.chap} ${r.chapter}` : T.intro, r.chapter ? (r.chapter_title || '') : '', r.page ? `${T.pg} ${r.page}` : ''].filter(Boolean).join(' · ');

  const modal = document.createElement('div');
  modal.className = 'modal consulta'; modal.id = 'consultamodal'; modal.hidden = true;
  modal.innerHTML = `<div class="modal-card wide" role="dialog" aria-labelledby="consultatit">
    <div class="eyebrow">${T.eyebrow}</div>
    <h2 id="consultatit">${T.title}</h2>
    <form id="consultaform" class="consulta-form">
      <input id="consultaq" type="search" placeholder="${T.ph}" autocomplete="off" aria-label="${T.ask}">
      <button class="btn" type="submit">${T.go}</button>
    </form>
    <div id="consultaout" class="consulta-out"></div>
    <p class="muted small">${T.note}</p>
    <button class="link" id="consultacerrar">${T.close}</button>
  </div>`;
  document.body.appendChild(modal);
  const out = modal.querySelector('#consultaout');
  const close = () => { modal.hidden = true; };
  modal.querySelector('#consultacerrar').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  let last = [];
  async function search(q) {
    out.innerHTML = `<p class="muted">${T.searching}</p>`;
    const { data, error } = await sb.rpc('consulta_libro', { q, ed: ED, n: 6 });
    if (error) { out.innerHTML = `<p class="msg err">${T.err}</p>`; return; }
    last = data || [];
    if (!last.length) { out.innerHTML = `<p class="muted">${T.none}</p>`; return; }
    out.innerHTML = `<div class="muted small">${T.lead}</div>` + last.map((r, i) => `
      <article class="hit">
        <div class="hit-where">${esc(where(r))}</div>
        ${r.section && r.section !== r.heading ? `<div class="hit-sec">${esc(r.section)}</div>` : ''}
        ${r.heading ? `<h3>${esc(r.heading)}</h3>` : ''}
        <div class="hit-txt">${mark(r.snippet)}</div>
        <button class="link" data-read="${r.ord}">${T.read}</button>
      </article>`).join('');
    out.querySelectorAll('[data-read]').forEach(b => b.onclick = () => read(+b.dataset.read));
  }

  async function read(ord) {
    out.innerHTML = `<p class="muted">${T.opening}</p>`;
    const { data, error } = await sb.from('book_chunks').select('ord,chapter,chapter_title,section,heading,page,body').eq('edition', ED).eq('ord', ord).maybeSingle();
    if (error || !data) { out.innerHTML = `<p class="msg err">${T.openerr}</p>`; return; }
    out.innerHTML = `<article class="reader">
      <div class="hit-where">${esc(where(data))}</div>
      ${data.section && data.section !== data.heading ? `<div class="hit-sec">${esc(data.section)}</div>` : ''}
      ${data.heading ? `<h3>${esc(data.heading)}</h3>` : ''}
      <div class="reader-txt">${para(data.body)}</div>
      <div class="reader-nav">
        <button class="btn ghost small" data-go="${ord - 1}">${T.prev}</button>
        ${last.length ? `<button class="btn ghost small" id="volver">${T.back}</button>` : ''}
        <button class="btn ghost small" data-go="${ord + 1}">${T.next}</button>
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
