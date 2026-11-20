// Biblioteca: filtros, as 4 formas de ver (grade, lista, tabela, quadro), arquivados e seleção de vários itens.
(function () {
  const { esc, $, $$ } = M;

  const hex = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#8b5cf6');
  const POR_VEZ = 200; // cartões desenhados de cada vez (com milhares de itens a tela travava)
  const sel = new Set(); // itens marcados no modo "Selecionar vários"
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
      if (!!it.arq !== !!u.arq) return false; // arquivado só aparece no filtro "Arquivados"
      if (q && !M.norm(it.title + ' ' + it.desc + ' ' + it.content + ' ' + it.tags.join(' ') + ' ' + it.attachments.map((a) => a.name).join(' ')).includes(q)) return false;
      return true;
    });
    const { k, d } = u.sort;
    if (k === 'ord') { // "minha ordem": os que a pessoa já arrumou primeiro; os outros depois, do mais novo para o mais velho
      const o = (it) => (Number.isFinite(it.ord) ? it.ord : Infinity);
      return L.sort((a, b) => o(a) - o(b) || (b.updated || 0) - (a.updated || 0));
    }
    const val = (it) => k === 'cat' ? ((M.cat(it.cat) || {}).name || '') : k === 'type' ? M.type(it.type).name : k === 'tags' ? it.tags.join(',') : it[k] || '';
    L.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt')) * d; });
    return L;
  };

  function cardHTML(it, view) {
    const t = M.type(it.type), cat = M.cat(it.cat), p = progress(it);
    const st = M.statusDe(it.status), st0 = M.STATUS[0];
    const preview = it.desc || (it.type === 'link' ? it.content : it.content);
    const col = cat ? `<div class="colec">${esc(cat.icon)} ${esc(cat.name)}</div>` : '';
    const meta = `${it.rascunho ? '<span class="tag rasc" title="Tem alterações não salvas. Abra para salvar ou descartar.">📝 rascunho</span>' : ''}${view === 'list' && cat ? `<span class="tag">${esc(cat.icon)} ${esc(cat.name)}</span>` : ''}${st !== st0 ? `<span class="st" style="--sc:${hex(st.color)}">${esc(st.em)} ${esc(st.name)}</span>` : ''}${it.tags.slice(0, 2).map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}${it.date ? `<span class="mi">${M.ic('data', 14)} ${M.fmtDate(it.date)}</span>` : ''}${it.attachments.length ? `<span class="mi" title="Anexos">${M.ic('clipe', 14)} ${it.attachments.length}</span>` : ''}`;
    const nomeIt = esc(it.title || 'item sem título');
    // no modo de seleção o cartão mostra a caixinha; fora dele, a estrela e o botão "⋯" (as mesmas ações do clique direito, para o toque)
    const fav = M.ui.selModo ? `<span class="selbox ${sel.has(it.id) ? 'on' : ''}" aria-hidden="true">${sel.has(it.id) ? '✔' : ''}</span>`
      : `<button class="favbtn ${it.fav ? 'on' : ''}" data-fav="${it.id}" title="Favorito" aria-label="${it.fav ? 'Tirar dos favoritos' : 'Favoritar'}: ${nomeIt}">⭐</button><button class="maisbtn" data-mais="${it.id}" title="Mais ações" aria-label="Mais ações de ${nomeIt}">⋯</button>`;
    const at = `tabindex="0" role="button" aria-label="${M.ui.selModo ? 'Selecionar' : 'Abrir'} ${nomeIt}" data-id="${it.id}"`, cls = `card${sel.has(it.id) ? ' sel' : ''}${it.arq ? ' arq' : ''}`;
    if (view === 'list') {
      return `<div class="${cls}" style="--c:${hex(t.color)}" draggable="true" ${at}><div class="top"><span class="badge">${t.em} ${t.name}</span></div><div class="mid"><h3>${esc(it.title || 'Sem título')}</h3></div><div class="meta">${meta}</div>${fav}</div>`;
    }
    return `<div class="${cls}" style="--c:${hex(cat ? cat.color : t.color)}" draggable="true" ${at}><div class="top"><span class="badge" style="--c:${t.color}">${t.em} ${t.name}</span>${fav}</div><h3>${esc(it.title || 'Sem título')}</h3>${preview ? `<p>${esc(preview)}</p>` : ''}${p >= 0 ? `<div class="prog"><i style="width:${p}%"></i></div>` : ''}${col}<div class="meta">${meta}</div><span class="abrir">Abrir →</span></div>`;
  }

  // filtros ligados agora (para dizer "o filtro escondeu" em vez de "não tem nada")
  const filtrando = () => { const u = M.ui; return !!(u.q || u.type || u.cat || u.status || u.tag || u.fav || u.ref || u.arq); };
  function emptyHTML() {
    if (filtrando()) return `<div class="empty"><div class="big">🔎</div><h3>Nenhum item com estes filtros</h3><p>${M.ui.arq ? 'Você está vendo só os arquivados.' : 'Seus itens continuam guardados: é o filtro que está escondendo.'}</p><button class="btn" data-limpa style="margin-top:12px">✖ Limpar filtros</button></div>`;
    return `<div class="empty"><div class="big">🕳️</div><h3>Sua Biblioteca ainda está vazia</h3><p>Crie o primeiro item ou arraste um arquivo para a janela.</p><button class="btn" data-novo style="margin-top:12px">＋ Novo item</button></div>`;
  }

  function tableHTML(L) {
    const cols = [['title', 'Título'], ['type', 'Tipo'], ['cat', 'Categoria'], ['status', 'Status'], ['tags', 'Etiquetas'], ['date', 'Data'], ['updated', 'Alterado']];
    const s = M.ui.sort;
    return `<table class="tbl"><thead><tr>${cols.map(([k, n]) => `<th data-sort="${k}">${n} ${s.k === k ? (s.d > 0 ? '▲' : '▼') : ''}</th>`).join('')}</tr></thead><tbody>${L.map((it) => {
      const t = M.type(it.type), c = M.cat(it.cat), st = M.statusDe(it.status);
      return `<tr data-id="${it.id}" tabindex="0" role="button" class="${sel.has(it.id) ? 'sel' : ''}"><td>${M.ui.selModo ? `<span class="selbox ${sel.has(it.id) ? 'on' : ''}" aria-hidden="true">${sel.has(it.id) ? '✔' : ''}</span> ` : ''}${it.fav ? '⭐ ' : ''}<b>${esc(it.title || 'Sem título')}</b></td><td><span class="badge" style="--c:${t.color}">${t.em} ${t.name}</span></td><td>${c ? esc(c.icon + ' ' + c.name) : '<span class="tdate">—</span>'}</td><td><span class="st" style="--sc:${hex(st.color)}">${esc(st.em)} ${esc(st.name)}</span></td><td>${it.tags.map((x) => `<span class="tag">#${esc(x)}</span>`).join(' ')}</td><td class="tdate">${M.fmtDate(it.date)}</td><td class="tdate">${new Date(it.updated).toLocaleDateString('pt-BR')}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function boardHTML(L) {
    const by = M.db.settings.boardBy;
    let cols;
    if (by === 'status') cols = M.STATUS.map((s) => ({ id: s.id, name: s.em + ' ' + s.name, opc: 1 }));
    else if (by === 'type') cols = M.TYPES.map((t) => ({ id: t.id, name: t.em + ' ' + t.name }));
    else cols = [{ id: '', name: '📦 Sem categoria' }].concat(M.db.categories.map((c) => ({ id: c.id, name: c.icon + ' ' + c.name })));
    const key = by === 'status' ? 'status' : by === 'type' ? 'type' : 'cat';
    return `<div class="board">${cols.map((c) => {
      const its = L.filter((it) => (key === 'status' ? M.statusDe(it.status).id : it[key] || '') === c.id); // status que não existe mais cai na primeira coluna
      return `<div class="col" data-col="${esc(c.id)}"><h4>${esc(c.name)}<span class="n">${its.length}</span></h4><div class="cards">${its.map((it) => cardHTML(it)).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  M.renderResults = () => {
    const box = $('#libres'); if (!box) return;
    const L = M.filtered(), v = M.db.settings.view;
    $('#libcount').textContent = L.length + ' de ' + M.db.items.filter((i) => !!i.arq === !!M.ui.arq).length;
    pintaSel();
    if (!L.length && v !== 'board' && !(v === 'pastas' && !filtrando())) { box.innerHTML = emptyHTML(); return; }
    const max = M.ui.libMax || POR_VEZ, V = L.length > max ? L.slice(0, max) : L;
    const mais = L.length > max ? `<div class="lib-mais"><button class="btn ghost" data-libmais>Mostrar mais ${Math.min(POR_VEZ, L.length - max)} (de ${L.length - max} que faltam)</button></div>` : '';
    if (v === 'map') { // mapa de conexões (como o grafo do Obsidian), só com o que passou pelos filtros
      box.innerHTML = '<div class="g-box g-lib" id="libMapa"></div><div class="g-leg" style="margin-top:8px">' + M.TYPES.map((t) => `<span><i style="background:${t.color}"></i>${esc(t.name.replace(' / PDF', ''))}</span>`).join('') + '</div><p class="pg-dica">Cada bolinha é um item. Linhas: mesma etiqueta, categoria ou pasta, ou citação do título. Clique para abrir, arraste, use a rodinha para o zoom.</p>';
      M.graph(box.querySelector('#libMapa'), { full: true, only: new Set(L.map((i) => i.id)) });
      return;
    }
    box.innerHTML = (v === 'table' ? tableHTML(V) : v === 'board' ? boardHTML(V) : v === 'pastas' ? M.pastasHTML(V, cardHTML) : `<div class="${v === 'list' ? 'list' : 'grid'}">${V.map((it) => cardHTML(it, v)).join('')}</div>`) + mais;
  };

  M.pages = M.pages || {};
  M.pages.lib = () => {
    const u = M.ui, s = M.db.settings;
    if (!u._ordLida) { u._ordLida = true; if (s.libOrdem && s.libOrdem.k) u.sort = { k: String(s.libOrdem.k), d: s.libOrdem.d === 1 ? 1 : -1 }; } // a ordem escolhida volta ao abrir o MyLoot
    const v = $('#view');
    const vivos = M.db.items.filter((i) => !!i.arq === !!u.arq), nArq = M.db.items.filter((i) => i.arq).length;
    if (u.arq && !nArq) u.arq = false;
    const count = (id) => vivos.filter((i) => i.type === id).length;
    v.innerHTML = `
      <p class="pg-sub">Seus materiais guardados: prompts, PDFs, instruções, links e notas. Clique num cartão para abrir.</p>
      <div class="lib-topo"><div class="hotbar" id="hotbar" data-lab="Tipo">
        <div class="slot ${!u.type ? 'on' : ''}" data-type="" tabindex="0" role="button">📦 Tudo <span class="n">${vivos.length}</span></div>
        ${M.TYPES.map((t) => `<div class="slot ${u.type === t.id ? 'on' : ''}" data-type="${t.id}" style="--c:${t.color}" tabindex="0" role="button">${t.em} ${t.name} <span class="n">${count(t.id)}</span></div>`).join('')}
      ${M.opcBtn('itemTypes')}</div>
        <div class="lib-ver">${s.view === 'board' ? `<select id="fby" title="Colunas do quadro"><option value="status" ${s.boardBy === 'status' ? 'selected' : ''}>Colunas: status</option><option value="cat" ${s.boardBy === 'cat' ? 'selected' : ''}>Colunas: categoria</option><option value="type" ${s.boardBy === 'type' ? 'selected' : ''}>Colunas: tipo</option></select>` : ''}
        <select id="fso" title="Ordem dos itens" aria-label="Ordem dos itens">${[['updated:-1', '🕘 Mexidos por último'], ['created:-1', '🆕 Mais novos'], ['created:1', '📜 Mais antigos'], ['title:1', '🔤 Nome (A–Z)'], ['ord:1', '✋ Minha ordem']].map(([v, n]) => `<option value="${v}" ${v === u.sort.k + ':' + u.sort.d ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <div class="seg" id="views" title="Jeito de ver">${[['grid', '▦ Grade'], ['list', '☰ Lista'], ['pastas', '📁 Pastas'], ['table', '▤ Tabela'], ['board', '▥ Quadro'], ['map', '🕸️ Mapa']].map(([k, n]) => `<button data-v="${k}" class="${s.view === k ? 'on' : ''}">${n}</button>`).join('')}</div></div></div>
      <div class="toolbar barra" data-lab="Filtrar">
        <input class="search" id="fq" type="search" placeholder="Filtrar esta lista…" value="${esc(u.q)}">
        <select id="fcat"><option value="">Todas as categorias</option>${M.db.categories.map((c) => `<option value="${c.id}" ${u.cat === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
        <select id="fst"><option value="">Qualquer status</option>${M.STATUS.map((x) => `<option value="${esc(x.id)}" ${u.status === x.id ? 'selected' : ''}>${esc(x.em)} ${esc(x.name)}</option>`).join('')}</select>${M.opcBtn('itemStatus')}
        <select id="ftag"><option value="">Todas as etiquetas</option>${M.allTags().map((x) => `<option ${u.tag === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        ${M.sw('ffav', u.fav, '⭐ Favoritos', 'Mostra só os itens marcados com estrela.')}
        ${M.db.items.some((i) => i.origem) ? M.sw('fref', u.ref, '📥 Recebidos', 'Mostra só o que chegou de outro programa pelas Conexões.') : ''}
        ${nArq ? M.sw('farq', u.arq, `📦 Arquivados <span class="n">${nArq}</span>`, 'Itens que você arquivou: saem da lista do dia a dia, mas continuam guardados. Clique com o botão direito (ou no ⋯) para desarquivar.') : ''}
        ${u.tag ? '<button class="btn ghost sm" id="tagRen" title="Trocar o nome desta etiqueta em todos os itens e clientes (ou juntar com outra)">✏️ Renomear etiqueta</button>' : ''}
        <button class="btn ghost sm ${u.selModo ? 'on' : ''}" id="selBt" title="Marcar vários itens para mover, etiquetar, arquivar ou apagar de uma vez" aria-pressed="${!!u.selModo}">☑ Selecionar vários</button>
        <span class="grow"></span>
        <small id="libcount" style="color:var(--faint);font-family:var(--mono)"></small>
      </div>
      <div class="sel-bar" id="selBar" hidden></div>
      <div id="libres"></div>`;
    M.renderResults();

    $('#hotbar').onclick = (e) => { const x = e.target.closest('.slot'); if (!x) return; u.type = x.dataset.type; u.libMax = 0; SFX.play('click'); M.render(); };
    const rr = () => { u.libMax = 0; M.renderResults(); };
    let tq = 0; // filtro por texto espera uma pausa curta na digitação
    $('#fq').oninput = (e) => { u.q = e.target.value; clearTimeout(tq); tq = setTimeout(rr, M.db.items.length > 300 ? 180 : 0); };
    $('#fcat').onchange = (e) => { u.cat = e.target.value; rr(); };
    $('#fst').onchange = (e) => { u.status = e.target.value; rr(); };
    $('#ftag').onchange = (e) => { u.tag = e.target.value; rr(); };
    $('#ffav').onchange = (e) => { u.fav = e.target.checked; rr(); };
    if ($('#fref')) $('#fref').onchange = (e) => { u.ref = e.target.checked; rr(); };
    if ($('#farq')) $('#farq').onchange = (e) => { u.arq = e.target.checked; sel.clear(); M.render(); };
    $('#selBt').onclick = () => { u.selModo = !u.selModo; sel.clear(); SFX.play('click'); M.render(); };
    if ($('#tagRen')) $('#tagRen').onclick = () => renomearEtiqueta(u.tag);
    $('#selBar').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) acaoSel(b.dataset.s); };
    $('#selBar').onchange = (e) => { if (e.target.dataset.sv) acaoSel(e.target.dataset.sv, e.target.value); };
    if ($('#fby')) $('#fby').onchange = (e) => { s.boardBy = e.target.value; M.save(); rr(); };
    $('#fso').onchange = (e) => { const [k, d] = e.target.value.split(':'); u.sort = { k, d: +d }; M.db.settings.libOrdem = u.sort; M.save(); if (k === 'ord') M.toast('✋ Arraste os cartões para mudar a ordem (no celular: ⋯ → Subir ou Descer)'); M.render(); };
    $('#views').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; s.view = b.dataset.v; M.save(); SFX.play('click'); M.render(); };

    const res = $('#libres');
    res.onclick = (e) => {
      if (s.view === 'pastas' && M.pastasClique(e)) return;
      if (e.target.closest('[data-limpa]')) { Object.assign(u, { q: '', type: '', cat: '', status: '', tag: '', fav: false, ref: false, arq: false }); return M.render(); }
      if (e.target.closest('[data-novo]')) return M.novoComModelo();
      if (e.target.closest('[data-libmais]')) { u.libMax = (u.libMax || POR_VEZ) + POR_VEZ; return M.renderResults(); }
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.stopPropagation(); M.toggleFav(fav.dataset.fav); return; }
      const mais = e.target.closest('[data-mais]');
      if (mais) { e.stopPropagation(); return M.itemMenu(e, M.db.items.find((i) => i.id === mais.dataset.mais)); }
      const th = e.target.closest('th[data-sort]');
      if (th) { const k = th.dataset.sort; u.sort = { k, d: u.sort.k === k ? -u.sort.d : 1 }; rr(); return; }
      const c = e.target.closest('[data-id]');
      if (c && u.selModo) { const id = c.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id); SFX.play('click'); return rr(); }
      if (c) M.openItem(c.dataset.id);
    };
    res.onkeydown = (e) => { if (s.view === 'pastas') M.pastasTecla(e); };
    res.oncontextmenu = (e) => { const c = e.target.closest('[data-id]'); if (c) M.itemMenu(e, M.db.items.find((i) => i.id === c.dataset.id)); };

    // arrastar cartões entre colunas do quadro
    let dragId = null;
    res.ondragstart = (e) => {
      const ph = e.target.closest('.pasta-h[data-pasta]');
      if (ph && ph.dataset.pasta) { M.pastasArrasto.pasta = ph.dataset.pasta; e.dataTransfer.setData('text/x-myloot-pasta', ph.dataset.pasta); e.dataTransfer.effectAllowed = 'move'; return; }
      const c = e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.setData('text/x-myloot', dragId); e.dataTransfer.effectAllowed = 'move'; };
    res.ondragend = () => { dragId = null; M.pastasArrasto.pasta = null; $$('.pasta-h.alvo').forEach((x) => x.classList.remove('alvo')); $$('.dragging').forEach((x) => x.classList.remove('dragging')); $$('.col.over').forEach((x) => x.classList.remove('over')); };
    const manual = () => u.sort.k === 'ord' && s.view !== 'board' && s.view !== 'table' && s.view !== 'pastas';
    res.ondragover = (e) => {
      if (s.view === 'pastas' && (dragId || M.pastasArrasto.pasta)) { const h = e.target.closest('.pasta-h[data-pasta]') || (e.target.closest('.pasta-raiz') || {}).firstElementChild; if (h) { e.preventDefault(); $$('.pasta-h.alvo').forEach((x) => x !== h && x.classList.remove('alvo')); h.classList.add('alvo'); } return; }
      if (manual() && dragId) { const c = e.target.closest('.card[data-id]'); if (c) { e.preventDefault(); $$('.card.alvo').forEach((x) => x !== c && x.classList.remove('alvo')); c.classList.add('alvo'); } return; }
      const col = e.target.closest('.col'); if (col && dragId) { e.preventDefault(); $$('.col.over').forEach((x) => { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); } };
    res.ondrop = (e) => {
      if (s.view === 'pastas' && (dragId || M.pastasArrasto.pasta)) {
        const h = e.target.closest('.pasta-h[data-pasta]') || (e.target.closest('.pasta-raiz') || {}).firstElementChild; $$('.pasta-h.alvo').forEach((x) => x.classList.remove('alvo'));
        if (!h) return; e.preventDefault(); e.stopPropagation();
        const alvo = h.dataset.pasta, pa = M.pastasArrasto.pasta; M.pastasArrasto.pasta = null;
        if (pa) { M.pastaMover(pa, alvo); return; }
        const ids = M.ui.selModo && sel.has(dragId) ? [...sel] : [dragId]; sel.clear();
        const n = M.itemParaPasta(ids, alvo); if (n) M.toast(alvo ? `📁 ${n} ${n === 1 ? 'item movido' : 'itens movidos'} para “${(M.pasta(alvo) || {}).name}”` : `📦 ${n} ${n === 1 ? 'item saiu' : 'itens saíram'} da pasta`);
        return;
      }
      if (manual() && dragId) { const c = e.target.closest('.card[data-id]'); $$('.card.alvo').forEach((x) => x.classList.remove('alvo')); if (!c || c.dataset.id === dragId) return; e.preventDefault(); e.stopPropagation(); const r = c.getBoundingClientRect(); M.ordemMover(dragId, c.dataset.id, s.view === 'list' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2); return; }
      const col = e.target.closest('.col'); if (!col || !dragId) return;
      e.preventDefault(); e.stopPropagation();
      const it = M.db.items.find((i) => i.id === dragId); if (!it) return;
      const key = s.boardBy === 'status' ? 'status' : s.boardBy === 'type' ? 'type' : 'cat';
      if (it[key] !== col.dataset.col) { it[key] = col.dataset.col; it.updated = Date.now(); M.save(); SFX.play('drop'); }
      M.render();
    };
  };

  // ----- seleção de vários itens: uma ação só para todos (e um só desfazer no histórico) -----
  function pintaSel() {
    const b = $('#selBar'); if (!b) return;
    b.hidden = !M.ui.selModo; if (b.hidden) return;
    const n = sel.size, L = M.filtered();
    b.innerHTML = `<b>${n ? n + (n === 1 ? ' selecionado' : ' selecionados') : 'Clique nos itens para marcar'}</b>
      <button class="btn ghost sm" data-s="todos">${n === L.length && n ? 'Desmarcar todos' : 'Marcar todos (' + L.length + ')'}</button>
      <select data-sv="cat" ${n ? '' : 'disabled'} aria-label="Mover os selecionados para uma categoria"><option value="-">📂 Mover para…</option><option value="">📦 Sem categoria</option>${M.db.categories.map((c) => `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
      <select data-sv="status" ${n ? '' : 'disabled'} aria-label="Mudar o status dos selecionados"><option value="-">🏷️ Status…</option>${M.STATUS.map((x) => `<option value="${esc(x.id)}">${esc(x.em)} ${esc(x.name)}</option>`).join('')}</select>
      <select data-sv="pasta" ${n ? '' : 'disabled'} aria-label="Mover os selecionados para uma pasta"><option value="-">📁 Pasta…</option><option value="">📦 Fora de pastas</option>${M.pastaOpcoes('')}</select>
      <button class="btn ghost sm" data-s="tag" ${n ? '' : 'disabled'}>＃ Etiquetar</button>
      <button class="btn ghost sm" data-s="arq" ${n ? '' : 'disabled'}>${M.ui.arq ? '📤 Desarquivar' : '📦 Arquivar'}</button>
      <button class="btn danger sm" data-s="lixo" ${n ? '' : 'disabled'}>🗑️ Lixeira</button>
      <span class="grow"></span><button class="btn ghost sm" data-s="sair">Concluir</button>`;
  }
  function acaoSel(a, v) {
    const u = M.ui, its = M.db.items.filter((i) => sel.has(i.id)), n = its.length, t = Date.now();
    if (a === 'sair') { u.selModo = false; sel.clear(); return M.render(); }
    if (a === 'todos') { const L = M.filtered(); if (sel.size === L.length) sel.clear(); else L.forEach((i) => sel.add(i.id)); return M.renderResults(); }
    if (!n || v === '-') return;
    const fim = (msg) => { sel.clear(); M.save(); SFX.play('drop'); M.render(); M.toast(msg); };
    if (a === 'cat') { its.forEach((i) => { i.cat = v; i.updated = t; }); return fim(`📂 ${n} ${n === 1 ? 'item movido' : 'itens movidos'}`); }
    if (a === 'pasta') { its.forEach((i) => { i.pasta = v; i.updated = t; }); return fim(`📁 ${n} ${n === 1 ? 'item movido' : 'itens movidos'}`); }
    if (a === 'status') { its.forEach((i) => { i.status = v; i.updated = t; }); return fim(`🏷️ Status de ${n} ${n === 1 ? 'item' : 'itens'} alterado`); }
    if (a === 'arq') { its.forEach((i) => { if (u.arq) { delete i.arq; delete i.arqEm; } else { i.arq = true; i.arqEm = t; } i.updated = t; }); return fim(u.arq ? `📤 ${n} desarquivado${n === 1 ? '' : 's'}` : `📦 ${n} arquivado${n === 1 ? '' : 's'}`); }
    if (a === 'lixo') { its.forEach((i) => M.paraLixeira('item', i)); SFX.play('trash'); return fim(`🗑️ ${n} ${n === 1 ? 'item' : 'itens'} para a lixeira`); }
    if (a === 'tag') {
      const m = M.modal(`<div class="modal-h"><h2>＃ Etiquetar ${n} ${n === 1 ? 'item' : 'itens'}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><div class="fld"><label for="selTag">Etiqueta</label><input type="text" id="selTag" list="selTags" placeholder="Ex.: cliente-novo" maxlength="40" autocapitalize="off"><datalist id="selTags">${M.allTags().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="selTagTira" style="flex:none" title="Tira esta etiqueta dos itens marcados">Tirar dos marcados</button><button class="btn" id="selTagOk" style="flex:none">＋ Adicionar</button></div></div>`, { small: true });
      const vai = (tira) => { const g = M.norm($('#selTag', m).value.trim()).replace(/^#/, '').replace(/\s+/g, '-'); if (!g) return M.falta($('#selTag', m), '✍️ Escreva a etiqueta'); its.forEach((i) => { i.tags = tira ? i.tags.filter((x) => x !== g) : [...new Set([...i.tags, g])]; i.updated = t; }); M.closeModal(); fim(tira ? `＃ Etiqueta tirada de ${n}` : `＃ ${n} ${n === 1 ? 'item etiquetado' : 'itens etiquetados'}`); };
      $('#x', m).onclick = M.closeModal; $('#selTagOk', m).onclick = () => vai(false); $('#selTagTira', m).onclick = () => vai(true);
      $('#selTag', m).onkeydown = (e) => { if (e.key === 'Enter') vai(false); };
      setTimeout(() => $('#selTag', m).focus(), 30);
    }
  }
  // troca o nome de uma etiqueta em todos os itens e clientes; se o nome novo já existe, as duas viram uma
  function renomearEtiqueta(tag) {
    const usa = (o) => (o.tags || []).includes(tag), n = M.db.items.filter(usa).length + (M.db.clients || []).filter(usa).length;
    const m = M.modal(`<div class="modal-h"><h2>✏️ Renomear etiqueta</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><p style="margin:0 0 10px;color:var(--dim)">A etiqueta <b>#${esc(tag)}</b> está em ${n} ${n === 1 ? 'lugar' : 'lugares'}. Se o nome novo já existir, as duas se juntam.</p>
      <div class="fld"><label for="tagNovo">Nome novo</label><input type="text" id="tagNovo" value="${esc(tag)}" maxlength="40" autocapitalize="off"></div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="tagNo" style="flex:none">Cancelar</button><button class="btn" id="tagOk" style="flex:none">✔ Salvar</button></div></div>`, { small: true });
    const ok = () => {
      const g = M.norm($('#tagNovo', m).value.trim()).replace(/^#/, '').replace(/\s+/g, '-');
      if (!g) return M.falta($('#tagNovo', m), '✍️ Escreva o nome novo');
      if (g === tag) return M.closeModal();
      const t = Date.now();
      [...M.db.items, ...(M.db.clients || [])].filter(usa).forEach((o) => { o.tags = [...new Set(o.tags.map((x) => (x === tag ? g : x)))]; o.updated = t; });
      M.ui.tag = g; M.save(); M.closeModal(); M.render(); M.toast(`✏️ Etiqueta renomeada para #${g}`);
    };
    $('#x', m).onclick = $('#tagNo', m).onclick = M.closeModal; $('#tagOk', m).onclick = ok;
    $('#tagNovo', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    setTimeout(() => { $('#tagNovo', m).focus(); $('#tagNovo', m).select(); }, 30);
  }
  // arquivar: o item sai das listas do dia a dia e fica no filtro "Arquivados" (não é apagar)
  M.arquivarItem = (it, sim) => {
    if (sim === false || (sim == null && it.arq)) { delete it.arq; delete it.arqEm; } else { it.arq = true; it.arqEm = Date.now(); }
    it.updated = Date.now(); M.save(); SFX.play('drop'); M.render();
    M.toast(it.arq ? '📦 Item arquivado' : '📤 Item desarquivado');
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

  // "minha ordem": põe o item antes (ou depois) de outro e renumera a lista inteira do jeito que está na tela
  M.ordemMover = (id, alvo, depois) => {
    const u = M.ui, ant = u.sort; u.sort = { k: 'ord', d: 1 };
    const T = M.db.items.slice(); const vis = (() => { const q = u; return T.filter((it) => !!it.arq === !!q.arq); })();
    const o = (it) => (Number.isFinite(it.ord) ? it.ord : Infinity);
    const L = vis.sort((a, b) => o(a) - o(b) || (b.updated || 0) - (a.updated || 0)); u.sort = ant;
    const a = L.findIndex((x) => x.id === id); if (a < 0) return; const [it] = L.splice(a, 1);
    let b = alvo === '_ini' ? 0 : alvo === '_fim' ? L.length : L.findIndex((x) => x.id === alvo); if (b < 0) return; if (depois) b++;
    L.splice(b, 0, it); L.forEach((x, i) => { if (x.ord !== i) x.ord = i; });
    M.save(); SFX.play('drop'); M.render();
  };
  M.itemMenu = (e, it) => {
    if (!it) return;
    const ordem = M.ui.sort.k === 'ord' && M.ui.page === 'lib' ? (() => { const L = M.filtered(), i = L.indexOf(it); return [...(i > 0 ? [{ em: '⬆', t: 'Subir na minha ordem', fn: () => M.ordemMover(it.id, L[i - 1].id, false) }, { em: '⏫', t: 'Para o começo', fn: () => M.ordemMover(it.id, '_ini') }] : []), ...(i >= 0 && i < L.length - 1 ? [{ em: '⬇', t: 'Descer na minha ordem', fn: () => M.ordemMover(it.id, L[i + 1].id, true) }] : [])]; })() : [];
    const cats = M.db.categories.filter((c) => c.id !== it.cat).map((c) => ({ em: c.icon, t: c.name, fn: () => { it.cat = c.id; it.updated = Date.now(); M.save(); SFX.play('drop'); M.render(); } }));
    if (it.cat) cats.unshift({ em: '📦', t: 'Sem categoria', fn: () => { it.cat = ''; it.updated = Date.now(); M.save(); M.render(); } });
    M.ctxMenu(e, [
      { em: '📂', t: 'Abrir', fn: () => M.openItem(it.id) },
      ...ordem,
      { em: '📋', t: 'Copiar conteúdo', fn: () => M.copyItem(it) },
      { em: '⭐', t: it.fav ? 'Tirar dos favoritos' : 'Favoritar', fn: () => M.toggleFav(it.id) },
      { em: '📒', t: 'Enviar para o Notion', fn: () => M.sendItem(it, 'notion') },
      { em: '📤', t: 'Enviar para o Trello', fn: () => M.sendItem(it, 'trello') },
      { em: it.arq ? '📤' : '📦', t: it.arq ? 'Desarquivar' : 'Arquivar', fn: () => M.arquivarItem(it) },
      { em: '🧬', t: 'Duplicar', fn: () => { const c = M.newItem(JSON.parse(JSON.stringify(it))); c.id = M.uid(); c.title = (it.title || 'Sem título') + ' (cópia)'; c.checklist.forEach((x) => (x.id = M.uid())); M.db.items.push(c); M.save(); SFX.play('pop'); M.render(); M.toast('🧬 Duplicado'); } },
      ...(M.db.pastas && M.db.pastas.length ? ['-', { sub: 'Mover para pasta' }, ...M.pastaMenuItens((p) => { M.itemParaPasta(it.id, p); }, M.pastaDoItem(it))] : []),
      ...(cats.length ? ['-', { sub: 'Mover para categoria' }, ...cats] : []),
      '-',
      { em: '🗑️', t: 'Mandar para a lixeira', fn: () => M.trashItem(it) },
    ]);
  };
})();
