// Biblioteca: filtros e as 4 formas de ver (grade, lista, tabela, quadro).
(function () {
  const { esc, $, $$ } = M;

  const hex = (c) => c || '#8b5cf6';
  const progress = (it) => it.checklist.length ? Math.round((it.checklist.filter((c) => c.done).length / it.checklist.length) * 100) : -1;

  M.filtered = () => {
    const u = M.ui, q = M.norm(u.q);
    let L = M.db.items.filter((it) => {
      if (u.type && it.type !== u.type) return false;
      if (u.cat && it.cat !== u.cat) return false;
      if (u.status && it.status !== u.status) return false;
      if (u.tag && !it.tags.includes(u.tag)) return false;
      if (u.fav && !it.fav) return false;
      if (u.ref && !it.origem) return false;
      if (q && !M.norm(it.title + ' ' + it.desc + ' ' + it.content + ' ' + it.tags.join(' ') + ' ' + it.attachments.map((a) => a.name).join(' ')).includes(q)) return false;
      return true;
    });
    const { k, d } = u.sort;
    const val = (it) => k === 'cat' ? ((M.cat(it.cat) || {}).name || '') : k === 'type' ? M.type(it.type).name : k === 'tags' ? it.tags.join(',') : it[k] || '';
    L.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt')) * d; });
    return L;
  };

  function cardHTML(it, view) {
    const t = M.type(it.type), cat = M.cat(it.cat), p = progress(it);
    const st = M.STATUS.find((s) => s.id === it.status);
    const preview = it.desc || (it.type === 'link' ? it.content : it.content);
    const meta = `${cat ? `<span class="tag">${esc(cat.icon)} ${esc(cat.name)}</span>` : ''}<span class="st ${it.status}">${st.name}</span>${it.tags.slice(0, 3).map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}${it.date ? `<span class="mi">${M.ic('data', 14)} ${M.fmtDate(it.date)}</span>` : ''}${it.attachments.length ? `<span class="mi" title="Anexos">${M.ic('clipe', 14)} ${it.attachments.length}</span>` : ''}`;
    const fav = `<button class="favbtn ${it.fav ? 'on' : ''}" data-fav="${it.id}" title="Favorito">⭐</button>`;
    if (view === 'list') {
      return `<div class="card" style="--c:${hex(t.color)}" draggable="true" data-id="${it.id}"><div class="top"><span class="badge">${t.em} ${t.name}</span></div><div class="mid"><h3>${esc(it.title || 'Sem título')}</h3></div><div class="meta">${meta}</div>${fav}</div>`;
    }
    return `<div class="card" style="--c:${hex(cat ? cat.color : t.color)}" draggable="true" data-id="${it.id}"><div class="top"><span class="badge" style="--c:${t.color}">${t.em} ${t.name}</span>${fav}</div><h3>${esc(it.title || 'Sem título')}</h3>${preview ? `<p>${esc(preview)}</p>` : ''}${p >= 0 ? `<div class="prog"><i style="width:${p}%"></i></div>` : ''}<div class="meta">${meta}</div></div>`;
  }

  function emptyHTML() {
    return `<div class="empty"><div class="big">🕳️</div><h3>Nada por aqui</h3><p>Crie um item novo ou arraste um arquivo para a janela.</p></div>`;
  }

  function tableHTML(L) {
    const cols = [['title', 'Título'], ['type', 'Tipo'], ['cat', 'Categoria'], ['status', 'Status'], ['tags', 'Etiquetas'], ['date', 'Data'], ['updated', 'Alterado']];
    const s = M.ui.sort;
    return `<table class="tbl"><thead><tr>${cols.map(([k, n]) => `<th data-sort="${k}">${n} ${s.k === k ? (s.d > 0 ? '▲' : '▼') : ''}</th>`).join('')}</tr></thead><tbody>${L.map((it) => {
      const t = M.type(it.type), c = M.cat(it.cat), st = M.STATUS.find((x) => x.id === it.status);
      return `<tr data-id="${it.id}"><td>${it.fav ? '⭐ ' : ''}<b>${esc(it.title || 'Sem título')}</b></td><td><span class="badge" style="--c:${t.color}">${t.em} ${t.name}</span></td><td>${c ? esc(c.icon + ' ' + c.name) : '<span class="tdate">—</span>'}</td><td><span class="st ${it.status}">${st.name}</span></td><td>${it.tags.map((x) => `<span class="tag">#${esc(x)}</span>`).join(' ')}</td><td class="tdate">${M.fmtDate(it.date)}</td><td class="tdate">${new Date(it.updated).toLocaleDateString('pt-BR')}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function boardHTML(L) {
    const by = M.db.settings.boardBy;
    let cols;
    if (by === 'status') cols = M.STATUS.map((s) => ({ id: s.id, name: s.em + ' ' + s.name }));
    else if (by === 'type') cols = M.TYPES.map((t) => ({ id: t.id, name: t.em + ' ' + t.name }));
    else cols = [{ id: '', name: '📦 Sem categoria' }].concat(M.db.categories.map((c) => ({ id: c.id, name: c.icon + ' ' + c.name })));
    const key = by === 'status' ? 'status' : by === 'type' ? 'type' : 'cat';
    return `<div class="board">${cols.map((c) => {
      const its = L.filter((it) => (it[key] || '') === c.id);
      return `<div class="col" data-col="${esc(c.id)}"><h4>${esc(c.name)}<span class="n">${its.length}</span></h4><div class="cards">${its.map((it) => cardHTML(it)).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  M.renderResults = () => {
    const box = $('#libres'); if (!box) return;
    const L = M.filtered(), v = M.db.settings.view;
    $('#libcount').textContent = L.length + ' de ' + M.db.items.length;
    if (!L.length && v !== 'board') { box.innerHTML = emptyHTML(); return; }
    box.innerHTML = v === 'table' ? tableHTML(L) : v === 'board' ? boardHTML(L) : `<div class="${v === 'list' ? 'list' : 'grid'}">${L.map((it) => cardHTML(it, v)).join('')}</div>`;
  };

  M.pages = M.pages || {};
  M.pages.lib = () => {
    const u = M.ui, s = M.db.settings;
    const v = $('#view');
    const count = (id) => M.db.items.filter((i) => i.type === id).length;
    v.innerHTML = `
      <div class="hotbar" id="hotbar">
        <div class="slot ${!u.type ? 'on' : ''}" data-type="">📦 Tudo <span class="n">${M.db.items.length}</span></div>
        ${M.TYPES.map((t) => `<div class="slot ${u.type === t.id ? 'on' : ''}" data-type="${t.id}" style="--c:${t.color}">${t.em} ${t.name} <span class="n">${count(t.id)}</span></div>`).join('')}
      </div>
      <div class="toolbar">
        <input class="search" id="fq" type="search" placeholder="Filtrar esta lista…" value="${esc(u.q)}">
        <select id="fcat"><option value="">Todas as categorias</option>${M.db.categories.map((c) => `<option value="${c.id}" ${u.cat === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
        <select id="fst"><option value="">Qualquer status</option>${M.STATUS.map((x) => `<option value="${x.id}" ${u.status === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
        <select id="ftag"><option value="">Todas as etiquetas</option>${M.allTags().map((x) => `<option ${u.tag === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        ${M.sw('ffav', u.fav, '⭐ Favoritos', 'Mostra só os itens marcados com estrela.')}
        ${M.db.items.some((i) => i.origem) ? M.sw('fref', u.ref, '📥 Recebidos', 'Mostra só o que chegou de outro programa pelas Conexões.') : ''}
        <span class="grow"></span>
        <small id="libcount" style="color:var(--faint);font-family:var(--mono)"></small>
        ${s.view === 'board' ? `<select id="fby" title="Colunas do quadro"><option value="status" ${s.boardBy === 'status' ? 'selected' : ''}>Colunas: status</option><option value="cat" ${s.boardBy === 'cat' ? 'selected' : ''}>Colunas: categoria</option><option value="type" ${s.boardBy === 'type' ? 'selected' : ''}>Colunas: tipo</option></select>` : ''}
        <div class="seg" id="views">${[['grid', '▦ Grade'], ['list', '☰ Lista'], ['table', '▤ Tabela'], ['board', '▥ Quadro']].map(([k, n]) => `<button data-v="${k}" class="${s.view === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      </div>
      <div id="libres"></div>`;
    M.renderResults();

    $('#hotbar').onclick = (e) => { const x = e.target.closest('.slot'); if (!x) return; u.type = x.dataset.type; SFX.play('click'); M.render(); };
    const rr = () => M.renderResults();
    $('#fq').oninput = (e) => { u.q = e.target.value; rr(); };
    $('#fcat').onchange = (e) => { u.cat = e.target.value; rr(); };
    $('#fst').onchange = (e) => { u.status = e.target.value; rr(); };
    $('#ftag').onchange = (e) => { u.tag = e.target.value; rr(); };
    $('#ffav').onchange = (e) => { u.fav = e.target.checked; rr(); };
    if ($('#fref')) $('#fref').onchange = (e) => { u.ref = e.target.checked; rr(); };
    if ($('#fby')) $('#fby').onchange = (e) => { s.boardBy = e.target.value; M.save(); rr(); };
    $('#views').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; s.view = b.dataset.v; M.save(); SFX.play('click'); M.render(); };

    const res = $('#libres');
    res.onclick = (e) => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.stopPropagation(); M.toggleFav(fav.dataset.fav); return; }
      const th = e.target.closest('th[data-sort]');
      if (th) { const k = th.dataset.sort; u.sort = { k, d: u.sort.k === k ? -u.sort.d : 1 }; rr(); return; }
      const c = e.target.closest('[data-id]');
      if (c) M.openItem(c.dataset.id);
    };
    res.oncontextmenu = (e) => { const c = e.target.closest('[data-id]'); if (c) M.itemMenu(e, M.db.items.find((i) => i.id === c.dataset.id)); };

    // arrastar cartões entre colunas do quadro
    let dragId = null;
    res.ondragstart = (e) => { const c = e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.setData('text/x-myloot', dragId); e.dataTransfer.effectAllowed = 'move'; };
    res.ondragend = () => { dragId = null; $$('.dragging').forEach((x) => x.classList.remove('dragging')); $$('.col.over').forEach((x) => x.classList.remove('over')); };
    res.ondragover = (e) => { const col = e.target.closest('.col'); if (col && dragId) { e.preventDefault(); $$('.col.over').forEach((x) => { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); } };
    res.ondrop = (e) => {
      const col = e.target.closest('.col'); if (!col || !dragId) return;
      e.preventDefault(); e.stopPropagation();
      const it = M.db.items.find((i) => i.id === dragId); if (!it) return;
      const key = s.boardBy === 'status' ? 'status' : s.boardBy === 'type' ? 'type' : 'cat';
      if (it[key] !== col.dataset.col) { it[key] = col.dataset.col; it.updated = Date.now(); M.save(); SFX.play('drop'); }
      M.render();
    };
  };

  M.toggleFav = (id) => {
    const it = M.db.items.find((i) => i.id === id); if (!it) return;
    it.fav = !it.fav; it.updated = Date.now(); M.save(); SFX.play(it.fav ? 'star' : 'click'); M.render();
  };

  M.copyItem = async (it) => {
    const text = it.content || it.desc || it.title;
    try { await navigator.clipboard.writeText(text); } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    if (it.type === 'prompt') { if (!M.award('copy')) SFX.play('copy'); } else SFX.play('copy');
    M.toast('📋 Copiado!');
  };

  M.itemMenu = (e, it) => {
    if (!it) return;
    const cats = M.db.categories.filter((c) => c.id !== it.cat).map((c) => ({ em: c.icon, t: c.name, fn: () => { it.cat = c.id; it.updated = Date.now(); M.save(); SFX.play('drop'); M.render(); } }));
    if (it.cat) cats.unshift({ em: '📦', t: 'Sem categoria', fn: () => { it.cat = ''; it.updated = Date.now(); M.save(); M.render(); } });
    M.ctxMenu(e, [
      { em: '📂', t: 'Abrir', fn: () => M.openItem(it.id) },
      { em: '📋', t: 'Copiar conteúdo', fn: () => M.copyItem(it) },
      { em: '⭐', t: it.fav ? 'Tirar dos favoritos' : 'Favoritar', fn: () => M.toggleFav(it.id) },
      { em: '📒', t: 'Enviar para o Notion', fn: () => M.sendItem(it, 'notion') },
      { em: '📤', t: 'Enviar para o Trello', fn: () => M.sendItem(it, 'trello') },
      { em: '🧬', t: 'Duplicar', fn: () => { const c = M.newItem(JSON.parse(JSON.stringify(it))); c.id = M.uid(); c.title = (it.title || 'Sem título') + ' (cópia)'; c.checklist.forEach((x) => (x.id = M.uid())); M.db.items.push(c); M.save(); SFX.play('pop'); M.render(); M.toast('🧬 Duplicado'); } },
      ...(cats.length ? ['-', { sub: 'Mover para categoria' }, ...cats] : []),
      '-',
      { em: '🗑️', t: 'Mandar para a lixeira', fn: () => M.trashItem(it) },
    ]);
  };
})();
