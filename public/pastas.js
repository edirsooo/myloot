// Pastas da Biblioteca: níveis dentro de níveis, com recolher e expandir.
// db.pastas = [{ id, name, parent, ord, fechada }]; item.pasta aponta para uma delas ('' = fora de pastas).
(function () {
  const { esc, $, $$ } = M;
  const lista = () => (M.db.pastas || (M.db.pastas = []));
  M.pasta = (id) => lista().find((p) => p.id === id);
  const ordena = (a, b) => (a.ord || 0) - (b.ord || 0) || String(a.name).localeCompare(String(b.name), 'pt');
  M.pastasDe = (pai) => lista().filter((p) => (pai ? p.parent === pai : !p.parent || !M.pasta(p.parent))).sort(ordena);
  // pasta que sumiu: o item cai para "fora de pastas" sem perder nada
  M.pastaDoItem = (it) => (it.pasta && M.pasta(it.pasta) ? it.pasta : '');
  // todas as pastas dentro de uma (para não deixar mover uma pasta para dentro dela mesma)
  const descendentes = (id) => { const r = new Set(), v = (x) => M.pastasDe(x).forEach((p) => { if (!r.has(p.id)) { r.add(p.id); v(p.id); } }); v(id); return r; };
  M.caminhoPasta = (id) => { const c = []; let p = M.pasta(id), n = 0; while (p && n++ < 30) { c.unshift(p.name); p = M.pasta(p.parent); } return c.join(' › '); };
  // opções de <select> com recuo por nível; "fora" tira da lista as pastas proibidas
  M.pastaOpcoes = (sel, fora) => {
    const proib = fora ? new Set([fora, ...descendentes(fora)]) : new Set(), out = [];
    const v = (pai, n) => M.pastasDe(pai).forEach((p) => { if (proib.has(p.id)) return; out.push(`<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${' '.repeat(n)}📁 ${esc(p.name)}</option>`); v(p.id, n + 1); });
    v('', 0); return out.join('');
  };

  // ----- criar, renomear, mover, excluir -----
  M.pastaEditar = (id, pai) => {
    const p = id ? M.pasta(id) : null;
    const m = M.modal(`<div class="modal-h"><h2>${p ? '✏️ Editar pasta' : '📁 Nova pasta'}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b">
      <div class="fld"><label for="paNome">Nome</label><input type="text" id="paNome" maxlength="60" value="${esc(p ? p.name : '')}" placeholder="Ex.: Clientes, Estudos, Prompts de vídeo"></div>
      <div class="fld"><label for="paPai">Dentro de ${M.hint('Pastas podem ficar dentro de outras, em quantos níveis você quiser.')}</label><select id="paPai"><option value="">— fora de todas (nível principal) —</option>${M.pastaOpcoes(p ? p.parent : pai || '', p && p.id)}</select></div>
      <div class="row" style="justify-content:space-between">${p ? '<button class="btn danger" id="paDel" style="flex:none">🗑️ Excluir pasta</button>' : '<span></span>'}<span class="row" style="flex:none"><button class="btn ghost" id="paNo" style="flex:none">Cancelar</button><button class="btn" id="paOk" style="flex:none">✔ Salvar</button></span></div></div>`, { small: true });
    const nome = $('#paNome', m);
    const ok = () => {
      const n = nome.value.replace(/[<>"'&]/g, '').trim();
      if (!n) return M.falta(nome, '✍️ Escreva o nome da pasta');
      const pai2 = $('#paPai', m).value, t = Date.now();
      if (p) { p.name = n; p.parent = pai2; p.updated = t; } else lista().push({ id: 'pa' + M.uid(), name: n, parent: pai2, ord: lista().length, fechada: false, updated: t });
      if (pai2) { const q = M.pasta(pai2); if (q && q.fechada) { q.fechada = false; q.updated = t; } } // a pasta nova aparece aberta
      M.save(); M.closeModal(); SFX.play('drop'); M.render();
    };
    $('#x', m).onclick = $('#paNo', m).onclick = M.closeModal; $('#paOk', m).onclick = ok;
    nome.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#paDel', m)) $('#paDel', m).onclick = () => { M.closeModal(); M.pastaExcluir(p); };
    setTimeout(() => { nome.focus(); nome.select(); }, 30);
  };
  // excluir a pasta não apaga nada: os itens e as subpastas sobem para a pasta de cima
  M.pastaExcluir = async (p) => {
    const itens = M.db.items.filter((i) => i.pasta === p.id).length, subs = M.pastasDe(p.id).length;
    const onde = p.parent ? `“${(M.pasta(p.parent) || {}).name || ''}”` : 'o nível principal';
    if (!(await M.confirm(`Excluir a pasta “${p.name}”? Os ${itens} ${itens === 1 ? 'item' : 'itens'} e ${subs} ${subs === 1 ? 'subpasta' : 'subpastas'} dela vão para ${onde}. Nada é apagado.`, 'Excluir pasta'))) return;
    const t = Date.now();
    M.db.items.forEach((i) => { if (i.pasta === p.id) { i.pasta = p.parent || ''; i.updated = t; } });
    lista().forEach((q) => { if (q.parent === p.id) { q.parent = p.parent || ''; q.updated = t; } });
    M.db.pastas = lista().filter((q) => q.id !== p.id);
    M.save(); SFX.play('trash'); M.render(); M.toast('🗑️ Pasta excluída; o conteúdo foi preservado');
  };
  M.itemParaPasta = (ids, pasta) => {
    const t = Date.now(); let n = 0;
    (Array.isArray(ids) ? ids : [ids]).forEach((id) => { const it = M.db.items.find((i) => i.id === id); if (it && (it.pasta || '') !== (pasta || '')) { it.pasta = pasta || ''; it.updated = t; n++; } });
    if (!n) return 0;
    M.save(); SFX.play('drop'); M.render(); return n;
  };
  M.pastaMover = (id, pai) => {
    const p = M.pasta(id); if (!p || (p.parent || '') === (pai || '')) return;
    if (pai && (pai === id || descendentes(id).has(pai))) return M.toast('⚠️ Uma pasta não pode ficar dentro dela mesma');
    p.parent = pai || ''; p.updated = Date.now();
    const q = M.pasta(pai); if (q && q.fechada) { q.fechada = false; q.updated = Date.now(); }
    M.save(); SFX.play('drop'); M.render();
  };
  M.pastaAlterna = (id, fechar) => { const p = M.pasta(id); if (!p) return; p.fechada = fechar == null ? !p.fechada : !!fechar; p.updated = Date.now(); M.save(); M.renderResults(); };
  M.pastasTodas = (fechar) => { const t = Date.now(); lista().forEach((p) => { p.fechada = fechar; p.updated = t; }); M.save(); SFX.play('click'); M.renderResults(); };
  // menu "Mover para pasta" (item e seleção)
  M.pastaMenuItens = (aplicar, atual) => {
    const out = [];
    if (atual) out.push({ em: '📦', t: 'Tirar da pasta', fn: () => aplicar('') });
    const v = (pai, n) => M.pastasDe(pai).forEach((p) => { if (p.id !== atual) out.push({ em: '📁', t: ' '.repeat(n) + p.name, fn: () => aplicar(p.id) }); v(p.id, n + 1); });
    v('', 0);
    return out;
  };

  // ----- a tela: árvore de pastas com os itens dentro -----
  M.pastasHTML = (L, cardHTML) => {
    const filtrando = L.length !== M.db.items.filter((i) => !!i.arq === !!M.ui.arq).length;
    const por = new Map(); // pasta -> itens dela (os que passaram pelos filtros)
    L.forEach((it) => { const k = M.pastaDoItem(it); if (!por.has(k)) por.set(k, []); por.get(k).push(it); });
    const total = new Map(); // pasta -> itens dela e das subpastas
    const conta = (id) => { if (total.has(id)) return total.get(id); let n = (por.get(id) || []).length; M.pastasDe(id).forEach((p) => { n += conta(p.id); }); total.set(id, n); return n; };
    const nivel = (pai, n) => M.pastasDe(pai).map((p) => {
      const c = conta(p.id); if (filtrando && !c) return ''; // com filtro, só aparecem as pastas que têm resultado
      const aberta = !p.fechada || (filtrando && c > 0 && M.ui.q);
      const its = por.get(p.id) || [], subs = nivel(p.id, n + 1);
      return `<div class="pasta" data-pa="${esc(p.id)}"><div class="pasta-h" data-pasta="${esc(p.id)}" draggable="true" tabindex="0" role="button" aria-expanded="${aberta}" aria-label="Pasta ${esc(p.name)}, ${c} ${c === 1 ? 'item' : 'itens'}. ${aberta ? 'Recolher' : 'Expandir'}">
        <span class="pasta-seta" aria-hidden="true">${aberta ? '▾' : '▸'}</span><span class="pasta-ic" aria-hidden="true">${aberta ? '📂' : '📁'}</span><b>${esc(p.name)}</b><span class="n">${c}</span>
        <span class="pasta-acoes"><button type="button" class="xbtn" data-pnova="${esc(p.id)}" title="Nova subpasta aqui" aria-label="Nova subpasta em ${esc(p.name)}">＋📁</button><button type="button" class="xbtn" data-pnovoit="${esc(p.id)}" title="Novo item nesta pasta" aria-label="Novo item em ${esc(p.name)}">＋</button><button type="button" class="xbtn" data-pedit="${esc(p.id)}" title="Renomear, mover ou excluir a pasta" aria-label="Editar a pasta ${esc(p.name)}">✏️</button></span></div>
        ${aberta ? `<div class="pasta-corpo">${subs}${its.length ? `<div class="list">${its.map((it) => cardHTML(it, 'list')).join('')}</div>` : (subs ? '' : '<div class="pasta-vazia">Pasta vazia. Arraste itens para cá.</div>')}</div>` : ''}</div>`;
    }).join('');
    const raiz = por.get('') || [], arv = nivel('', 0);
    return `<div class="pastas"><div class="pastas-barra"><button class="btn sm" data-pnova="">📁 Nova pasta</button><button class="btn ghost sm" data-ptodas="abrir">▾ Expandir tudo</button><button class="btn ghost sm" data-ptodas="fechar">▸ Recolher tudo</button></div>
      ${arv || ''}
      <div class="pasta pasta-raiz" data-pa=""><div class="pasta-h sem" data-pasta="" tabindex="-1"><span class="pasta-ic" aria-hidden="true">📦</span><b>Fora de pastas</b><span class="n">${raiz.length}</span></div>
      <div class="pasta-corpo">${raiz.length ? `<div class="list">${raiz.map((it) => cardHTML(it, 'list')).join('')}</div>` : `<div class="pasta-vazia">${lista().length ? 'Todos os itens estão em pastas. Arraste um para cá para tirar da pasta.' : 'Crie uma pasta e arraste os itens para dentro dela.'}</div>`}</div></div></div>`;
  };

  // cliques e arrastos da tela de pastas (chamado pela Biblioteca; devolve true se tratou)
  M.pastasClique = (e) => {
    const b = (s) => e.target.closest(s);
    let x;
    if ((x = b('[data-pnova]'))) { e.stopPropagation(); M.pastaEditar(null, x.dataset.pnova); return true; }
    if ((x = b('[data-pnovoit]'))) { e.stopPropagation(); M.newItemDialog({ pasta: x.dataset.pnovoit }); return true; }
    if ((x = b('[data-pedit]'))) { e.stopPropagation(); M.pastaEditar(x.dataset.pedit); return true; }
    if ((x = b('[data-ptodas]'))) { M.pastasTodas(x.dataset.ptodas === 'fechar'); return true; }
    if ((x = b('.pasta-h[data-pasta]')) && x.dataset.pasta) { M.pastaAlterna(x.dataset.pasta); return true; }
    return false;
  };
  M.pastasTecla = (e) => { const h = e.target.closest && e.target.closest('.pasta-h[data-pasta]'); if (!h || !h.dataset.pasta || e.target !== h) return; if (e.key === 'ArrowRight') M.pastaAlterna(h.dataset.pasta, false); else if (e.key === 'ArrowLeft') M.pastaAlterna(h.dataset.pasta, true); };
  M.pastasArrasto = { pasta: null };
})();
