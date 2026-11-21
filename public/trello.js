// Trello dentro do MyLoot: ver os quadros, as listas e os cartões da própria pessoa e mexer neles (mover, criar, editar, comentar).
// A chave e o token ficam no computador (data/segredos.json); o app só pede ao MyLoot o que mostrar ou mudar.
(function () {
  const { esc, $ } = M;
  let quadros = null, dados = null, carregando = false, erro = '', busca = '', eu = null;
  const COR = { green: '#4bce97', yellow: '#e2b203', orange: '#fea362', red: '#f87168', purple: '#9f8fef', blue: '#579dff', sky: '#6cc3e0', lime: '#94c748', pink: '#e774bb', black: '#8590a2' };
  const FUNDO = { blue: '#0079bf', orange: '#d29034', green: '#519839', red: '#b04632', purple: '#89609e', pink: '#cd5a91', lime: '#4bbf6b', sky: '#00aecc', grey: '#838c91' }; // cores de fundo dos quadros, como no Trello
  const cor = (c) => COR[String(c || '').replace(/_(dark|light)$/, '')] || '#8590a2';
  const api = (p, o) => M.api('/api/trello/' + p, o);
  const acao = (b) => api('acao', { method: 'POST', body: JSON.stringify(b) });
  const qAtual = () => M.db.settings.trelloQuadro || '';
  const fmtPrazo = (d) => { if (!d) return ''; const x = new Date(d); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); };
  const prazoCls = (c) => { if (!c.prazo) return ''; if (c.feito) return 'ok'; const ms = new Date(c.prazo) - Date.now(); return ms < 0 ? 'atr' : ms < 864e5 ? 'logo' : ''; };

  // ----- passo a passo para cada pessoa ligar o PRÓPRIO Trello -----
  function conectarHTML(st) {
    return `<div class="tr-con">
      <h2>📋 Conecte o seu Trello</h2>
      <p class="pg-sub">Cada pessoa liga a própria conta. A chave e o token ficam só neste computador (em data/segredos.json), fora do backup, do Drive e do GitHub.</p>
      <ol class="tr-passos">
        <li><b>Crie o seu “Power-Up”</b> (é só um cadastro, de graça): abra <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener">trello.com/power-ups/admin</a>, clique em <b>Novo</b>, dê o nome <i>MyLoot</i>, escolha o seu espaço de trabalho, preencha o e-mail e clique em <b>Criar</b>.</li>
        <li><b>Pegue a chave:</b> na página do Power-Up, abra a aba <b>Chave de API</b> (API key), clique em <b>Gerar nova chave de API</b> e copie a <b>Chave</b>. Cole aqui:
          <div class="row" style="margin-top:6px"><input type="password" id="trKey" autocomplete="off" placeholder="${st && st.temChave ? 'Chave guardada ✔ (cole outra para trocar)' : 'Cole a chave (API key)'}" aria-label="Chave da API do Trello"></div></li>
        <li><b>Autorize a sua conta:</b> clique no botão abaixo. Abre o Trello pedindo permissão para o MyLoot ler e mudar os seus quadros. Clique em <b>Permitir</b> e copie o token que aparece.
          <div class="row" style="margin-top:6px;align-items:center"><button type="button" class="btn ghost" id="trGera" style="flex:none">🔑 Gerar token</button><input type="password" id="trTok" autocomplete="off" placeholder="${st && st.temChave ? 'Token guardado ✔' : 'Cole o token'}" aria-label="Token do Trello"></div></li>
        <li><b>Pronto:</b> <button type="button" class="btn" id="trSalva">✔ Conectar</button></li>
      </ol>
      <small style="color:var(--dim)">O token dá ao MyLoot acesso aos seus quadros. Para cortar o acesso a qualquer hora: aqui em ⚙️ → “Desconectar”, ou no Trello em Configurações da conta → Aplicativos.</small>
    </div>`;
  }
  function conectarBind() {
    $('#trGera').onclick = () => {
      const k = $('#trKey').value.trim();
      if (!k) return M.falta($('#trKey'), '🔑 Cole a chave primeiro (passo 2)');
      open('https://trello.com/1/authorize?' + new URLSearchParams({ expiration: 'never', scope: 'read,write', response_type: 'token', name: 'MyLoot', key: k }), '_blank', 'noopener');
    };
    $('#trSalva').onclick = async () => {
      const key = $('#trKey').value.trim(), token = $('#trTok').value.trim();
      if (!key) return M.falta($('#trKey'), '🔑 Cole a chave (passo 2)');
      if (!token) return M.falta($('#trTok'), '🔑 Cole o token (passo 3)');
      try {
        await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ trello: { key, token } }) });
        eu = await api('eu');
        SFX.play('coin'); M.toast('✅ Trello conectado' + (eu.nome ? ': ' + eu.nome : ''));
        if (M.intStatus) M.intStatus(true).catch(() => {});
        quadros = null; erro = ''; M.render();
      } catch (e) { M.toast('⚠️ ' + e.message); }
    };
  }

  let deNovo = false;
  async function carregar(forcar) {
    if (carregando) { deNovo = true; return; } carregando = true; erro = '';
    try {
      if (!quadros || forcar) quadros = (await api('quadros')).quadros.sort((a, b) => (b.fav - a.fav) || String(b.ult).localeCompare(String(a.ult)));
      let q = qAtual();
      if (!quadros.some((b) => b.id === q)) { q = quadros[0] ? quadros[0].id : ''; M.db.settings.trelloQuadro = q; M.save(); }
      dados = q ? await api('quadro?id=' + encodeURIComponent(q)) : null;
    } catch (e) { erro = e.message; }
    carregando = false;
    if (deNovo) { deNovo = false; return carregar(); } // a pessoa trocou de quadro no meio do caminho
    if (M.ui.page === 'trello') M.render();
  }

  function cartaoHTML(c) {
    const et = dados.etiquetas.filter((l) => c.etiquetas.includes(l.id));
    const mb = dados.membros.filter((m) => c.membros.includes(m.id));
    const bad = [
      c.prazo ? `<span class="tr-b ${prazoCls(c)}" title="Prazo">🕒 ${fmtPrazo(c.prazo)}</span>` : '',
      c.desc ? '<span class="tr-b" title="Tem descrição">≡</span>' : '',
      c.check[1] ? `<span class="tr-b ${c.check[0] === c.check[1] ? 'ok' : ''}" title="Checklist">☑ ${c.check[0]}/${c.check[1]}</span>` : '',
      c.coment ? `<span class="tr-b" title="Comentários">💬 ${c.coment}</span>` : '',
      c.anexos ? `<span class="tr-b" title="Anexos">📎 ${c.anexos}</span>` : '',
    ].join('');
    const cheia = c.capa && c.capaCheia; // capa "cheia" no Trello: o cartão inteiro fica na cor, com o nome por cima
    return `<div class="tr-card${cheia ? ' cheio' : ''}" draggable="true" data-c="${esc(c.id)}" tabindex="0" role="button" aria-label="Abrir o cartão ${esc(c.nome)}"${cheia ? ` style="--capa:${cor(c.capa)}"` : ''}>
      ${c.capa && !cheia ? `<div class="tr-capa" style="background:${cor(c.capa)}"></div>` : ''}
      ${et.length ? `<div class="tr-ets">${et.map((l) => `<span class="tr-et" style="background:${cor(l.cor)}" title="${esc(l.nome || l.cor)}">${esc(l.nome)}</span>`).join('')}</div>` : ''}
      <div class="tr-nome">${esc(c.nome)}</div>
      ${bad || mb.length ? `<div class="tr-rod">${bad}<span class="tr-mbs">${mb.map((m) => `<span class="tr-mb" title="${esc(m.nome)}">${esc(m.ini)}</span>`).join('')}</span></div>` : ''}
    </div>`;
  }

  M.pages.trello = () => {
    const v = $('#view');
    M.intStatus().then((st) => {
      if (M.ui.page !== 'trello') return;
      if (!st.trello.temChave) { v.innerHTML = conectarHTML(st.trello); conectarBind(); return; }
      if (!quadros && !carregando && !erro) { v.innerHTML = '<div class="empty"><div class="big">📋</div><h3>Abrindo o seu Trello…</h3></div>'; carregar(); return; }
      desenha(v);
    }).catch((e) => { v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Não consegui abrir o Trello</h3><p>${esc(e.message)}</p></div>`; });
  };

  function desenha(v) {
    if (erro && !dados) {
      v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>O Trello não respondeu</h3><p>${esc(erro)}</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="trDeNovo" style="flex:none">🔁 Tentar de novo</button><button class="btn ghost" id="trRecon" style="flex:none">🔑 Conectar de novo</button></div></div>`;
      $('#trDeNovo').onclick = () => { erro = ''; carregar(true); M.render(); };
      $('#trRecon').onclick = desconectar;
      return;
    }
    const d = dados, qb = M.norm(busca);
    const fundo = d && d.quadro.img ? `url('${String(d.quadro.img).replace(/'/g, '%27')}') center/cover` : d && d.quadro.cor ? (FUNDO[d.quadro.cor] || cor(d.quadro.cor)) : '';
    v.innerHTML = `
      <div class="toolbar tr-topo">
        <select id="trQ" aria-label="Quadro do Trello">${(quadros || []).map((b) => `<option value="${esc(b.id)}" ${b.id === qAtual() ? 'selected' : ''}>${b.fav ? '⭐ ' : ''}${esc(b.nome)}</option>`).join('')}</select>
        <input class="search" id="trBusca" type="search" placeholder="Filtrar cartões…" value="${esc(busca)}">
        <button class="btn ghost sm" id="trAtu" title="Buscar de novo no Trello">${carregando ? '⏳' : '🔄'} Atualizar</button>
        ${d ? `<a class="btn ghost sm" href="${esc(d.quadro.url)}" target="_blank" rel="noopener">↗ Abrir no Trello</a>` : ''}
        <span class="grow"></span>
        <button class="btn ghost sm" id="trCfg" title="Trocar a conta ou desconectar">⚙️</button>
      </div>
      ${erro ? `<div class="carrega-erro" role="alert">⚠️ ${esc(erro)}</div>` : ''}
      ${!d ? (carregando ? '<div class="empty"><div class="big">⏳</div><h3>Abrindo o quadro…</h3></div>' : '<div class="empty"><div class="big">📋</div><h3>Nenhum quadro aberto na sua conta</h3><p>Crie um quadro no Trello e clique em Atualizar.</p></div>') : `
      <div class="tr-quadro" style="${fundo ? esc('--trbg:' + fundo) : ''}">
        <div class="tr-cols" id="trCols">${d.listas.map((l) => {
          const cs = d.cartoes.filter((c) => c.lista === l.id && (!qb || M.norm(c.nome).includes(qb))).sort((a, b) => a.pos - b.pos);
          return `<div class="tr-col" data-l="${esc(l.id)}"><div class="tr-col-h"><b>${esc(l.nome)}</b><span class="n">${cs.length}</span><button type="button" class="xbtn" data-lmais="${esc(l.id)}" title="Renomear ou arquivar a lista" aria-label="Opções da lista ${esc(l.nome)}">⋯</button></div>
            <div class="tr-cards">${cs.map(cartaoHTML).join('')}</div>
            <button type="button" class="tr-add" data-add="${esc(l.id)}">＋ Adicionar um cartão</button></div>`;
        }).join('')}
          <div class="tr-col tr-col-nova"><button type="button" class="tr-add" id="trLNova">＋ Adicionar outra lista</button></div>
        </div>
      </div>`}`;
    $('#trQ').onchange = (e) => { M.db.settings.trelloQuadro = e.target.value; M.save(); dados = null; carregar(); M.render(); };
    $('#trBusca').oninput = (e) => { busca = e.target.value; const pos = e.target.selectionStart; M.render(); const i = $('#trBusca'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } };
    $('#trAtu').onclick = () => { SFX.play('click'); carregar(true); M.render(); };
    $('#trCfg').onclick = (e) => M.ctxMenu(e, [
      { em: '🔄', t: 'Atualizar os quadros', fn: () => carregar(true) },
      { em: '🔑', t: 'Trocar a conta ou o token', fn: desconectar },
      { em: '⚙️', t: 'Configurações → Notion e Trello', fn: () => M.go('cfg') },
    ]);
    if (!d) return;
    const cols = $('#trCols');
    cols.onclick = (e) => {
      const b = (s) => e.target.closest(s); let x;
      if ((x = b('[data-add]'))) return novoCartao(x);
      if ((x = b('[data-lmais]'))) return listaMenu(e, x.dataset.lmais);
      if (b('#trLNova')) return novaLista(b('#trLNova'));
      if ((x = b('[data-c]'))) return abrirCartao(x.dataset.c);
    };
    cols.onkeydown = (e) => { const c = e.target.closest && e.target.closest('[data-c]'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirCartao(c.dataset.c); } };
    cols.oncontextmenu = (e) => { const c = e.target.closest('[data-c]'); if (!c) return; e.preventDefault(); cartaoMenu(e, c.dataset.c); };
    // arrastar cartões entre listas (no celular: ⋯ / segurar → Mover para…)
    let arr = null;
    cols.ondragstart = (e) => { const c = e.target.closest('[data-c]'); if (!c) return; arr = c.dataset.c; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arr); };
    cols.ondragend = () => { arr = null; cols.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); cols.querySelectorAll('.tr-marca').forEach((x) => x.remove()); };
    const alvo = (e) => {
      const col = e.target.closest('.tr-col[data-l]'); if (!col) return null;
      const L = [...col.querySelectorAll('.tr-card:not(.dragging)')];
      const depois = L.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      return { col, depois };
    };
    cols.ondragover = (e) => {
      if (!arr) return; const a = alvo(e); if (!a) return; e.preventDefault();
      cols.querySelectorAll('.tr-col.over').forEach((x) => x !== a.col && x.classList.remove('over')); a.col.classList.add('over');
      let mk = cols.querySelector('.tr-marca'); if (!mk) { mk = document.createElement('div'); mk.className = 'tr-marca'; }
      const box = a.col.querySelector('.tr-cards'); if (a.depois) box.insertBefore(mk, a.depois); else box.appendChild(mk);
    };
    cols.ondrop = (e) => {
      if (!arr) return; const a = alvo(e); if (!a) return; e.preventDefault();
      const id = arr, lista = a.col.dataset.l, antes = a.depois ? a.depois.dataset.c : null;
      cols.ondragend(); moverCartao(id, lista, antes);
    };
  }

  // posição no Trello: entre o cartão de cima e o de baixo (ou no fim)
  function moverCartao(id, lista, antesDe) {
    const c = dados.cartoes.find((x) => x.id === id); if (!c) return;
    const L = dados.cartoes.filter((x) => x.lista === lista && x.id !== id).sort((a, b) => a.pos - b.pos);
    const i = antesDe ? L.findIndex((x) => x.id === antesDe) : L.length;
    const cima = i > 0 ? L[i - 1].pos : 0, baixo = i < L.length ? L[i].pos : (L.length ? L[L.length - 1].pos + 65536 : 65536);
    const pos = i < L.length ? (cima + baixo) / 2 : baixo;
    if (c.lista === lista && Math.abs(c.pos - pos) < 1e-9) return;
    const antes = { lista: c.lista, pos: c.pos };
    c.lista = lista; c.pos = pos; SFX.play('drop'); M.render(); // muda na tela na hora; se o Trello recusar, volta
    acao({ op: 'cartaoMover', id, lista, pos }).catch((e) => { Object.assign(c, antes); M.render(); M.toast('⚠️ ' + e.message); });
  }

  function novoCartao(btn) {
    const lista = btn.dataset.add, box = document.createElement('div'); box.className = 'tr-novo';
    box.innerHTML = '<textarea rows="2" placeholder="Nome do cartão (Enter para criar)" aria-label="Nome do cartão novo"></textarea><div class="row"><button class="btn sm" style="flex:none">＋ Criar</button><button class="btn ghost sm" style="flex:none">Cancelar</button></div>';
    btn.replaceWith(box); const ta = box.querySelector('textarea'); ta.focus();
    const criar = async () => {
      const nome = ta.value.trim(); if (!nome) return ta.focus();
      ta.value = ''; ta.focus();
      try {
        const r = await acao({ op: 'cartaoNovo', lista, nome });
        const L = dados.cartoes.filter((x) => x.lista === lista);
        dados.cartoes.push({ id: r.id, nome, desc: false, lista, pos: (L.length ? Math.max(...L.map((x) => x.pos)) : 0) + 65536, prazo: '', feito: false, etiquetas: [], membros: [], url: '', capa: '', check: [0, 0], coment: 0, anexos: 0 });
        SFX.play('pop');
        const col = $(`.tr-col[data-l="${CSS.escape(lista)}"] .tr-cards`); if (col) col.insertAdjacentHTML('beforeend', cartaoHTML(dados.cartoes[dados.cartoes.length - 1]));
      } catch (e) { M.toast('⚠️ ' + e.message); }
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); criar(); } else if (e.key === 'Escape') M.render(); };
    const [ok, no] = box.querySelectorAll('button'); ok.onclick = criar; no.onclick = () => M.render();
  }

  async function novaLista(btn) {
    const box = document.createElement('div'); box.className = 'tr-novo';
    box.innerHTML = '<input type="text" placeholder="Nome da lista" aria-label="Nome da lista nova"><div class="row"><button class="btn sm" style="flex:none">＋ Criar lista</button><button class="btn ghost sm" style="flex:none">Cancelar</button></div>';
    btn.replaceWith(box); const i = box.querySelector('input'); i.focus();
    const criar = async () => {
      const nome = i.value.trim(); if (!nome) return i.focus();
      try { const r = await acao({ op: 'listaNova', quadro: dados.quadro.id, nome }); dados.listas.push({ id: r.id, nome, pos: (dados.listas.length ? Math.max(...dados.listas.map((x) => x.pos)) : 0) + 65536 }); SFX.play('pop'); M.render(); }
      catch (e) { M.toast('⚠️ ' + e.message); }
    };
    i.onkeydown = (e) => { if (e.key === 'Enter') criar(); else if (e.key === 'Escape') M.render(); };
    const [ok, no] = box.querySelectorAll('button'); ok.onclick = criar; no.onclick = () => M.render();
  }

  function listaMenu(e, id) {
    const l = dados.listas.find((x) => x.id === id); if (!l) return;
    M.ctxMenu(e, [
      { em: '✏️', t: 'Renomear a lista', fn: async () => {
        const nome = await pedeNome('✏️ Renomear a lista', l.nome); if (!nome || nome === l.nome) return;
        const antes = l.nome; l.nome = nome; M.render();
        acao({ op: 'listaRenomear', id, nome }).catch((er) => { l.nome = antes; M.render(); M.toast('⚠️ ' + er.message); });
      } },
      { em: '📦', t: 'Arquivar a lista', fn: async () => {
        const n = dados.cartoes.filter((c) => c.lista === id).length;
        if (!(await M.confirm(`Arquivar a lista “${l.nome}”${n ? ` com ${n} ${n === 1 ? 'cartão' : 'cartões'}` : ''}? No Trello dá para desarquivar depois (menu do quadro → Itens arquivados).`, 'Arquivar'))) return;
        try { await acao({ op: 'listaArquivar', id }); dados.listas = dados.listas.filter((x) => x.id !== id); dados.cartoes = dados.cartoes.filter((c) => c.lista !== id); SFX.play('trash'); M.render(); M.toast('📦 Lista arquivada no Trello'); }
        catch (er) { M.toast('⚠️ ' + er.message); }
      } },
    ]);
  }

  // caixinha de texto do próprio MyLoot (no lugar do prompt do navegador)
  const pedeNome = (titulo, valor) => new Promise((ok) => {
    const m = M.modal(`<div class="modal-h"><h2>${esc(titulo)}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b"><div class="fld"><label for="pnV">Nome</label><input type="text" id="pnV" maxlength="512" value="${esc(valor || '')}"></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="pnNo" style="flex:none">Cancelar</button><button class="btn" id="pnOk" style="flex:none">✔ Salvar</button></div></div>`, { small: true, onClose: () => ok(null) });
    const i = $('#pnV', m), fim = (v) => { const f = ok; ok = () => {}; M.closeModal(); f(v); };
    $('#x', m).onclick = $('#pnNo', m).onclick = () => fim(null);
    $('#pnOk', m).onclick = () => fim(i.value.trim());
    i.onkeydown = (e) => { if (e.key === 'Enter') fim(i.value.trim()); };
    setTimeout(() => { i.focus(); i.select(); }, 30);
  });

  function cartaoMenu(e, id) {
    const c = dados.cartoes.find((x) => x.id === id); if (!c) return;
    M.ctxMenu(e, [
      { em: '📂', t: 'Abrir', fn: () => abrirCartao(id) },
      '-', { sub: 'Mover para' },
      ...dados.listas.filter((l) => l.id !== c.lista).map((l) => ({ em: '➡️', t: l.nome, fn: () => moverCartao(id, l.id, null) })),
      '-',
      { em: '📥', t: 'Guardar no MyLoot', fn: () => guardarNoMyLoot(id) },
      { em: '📦', t: 'Arquivar o cartão', fn: () => arquivar(id) },
    ]);
  }

  async function arquivar(id, depois) {
    const c = dados.cartoes.find((x) => x.id === id); if (!c) return;
    try { await acao({ op: 'cartaoArquivar', id }); dados.cartoes = dados.cartoes.filter((x) => x.id !== id); SFX.play('trash'); M.render(); M.toast('📦 Cartão arquivado no Trello'); if (depois) depois(); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }

  // o inverso do "Enviar para o Trello": o cartão vira uma nota na Biblioteca, com link para o cartão
  async function guardarNoMyLoot(id) {
    try {
      const c = await api('cartao?id=' + encodeURIComponent(id));
      const lista = (dados.listas.find((l) => l.id === c.lista) || {}).nome || '';
      const check = c.checklists.flatMap((k) => k.itens.map((i) => ({ id: M.uid(), t: i.nome, done: i.ok })));
      const it = M.createItem({ cat: '', type: 'nota', title: c.nome, desc: `Do Trello: ${dados.quadro.nome}${lista ? ' → ' + lista : ''}`, content: c.desc, checklist: check, links: c.url ? [{ id: M.uid(), url: c.url, label: 'Cartão no Trello' }] : [], tags: ['trello'] });
      M.save(); SFX.play('coin');
      if (await M.confirm(`📥 “${c.nome}” foi guardado na Biblioteca, com o link para o cartão. Abrir agora?`, 'Abrir')) { if (M.modalOpen()) M.closeModal(); M.openItem(it.id); }
    } catch (e) { M.toast('⚠️ ' + e.message); }
  }

  // ----- ficha do cartão -----
  async function abrirCartao(id) {
    const base = dados.cartoes.find((x) => x.id === id); if (!base) return;
    const m = M.modal(`<div class="modal-h"><h2>📋 Cartão do Trello</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b" id="trCb"><div class="empty"><div class="big">⏳</div><h3>Abrindo o cartão…</h3></div></div>`);
    $('#x', m).onclick = M.closeModal;
    let c;
    try { c = await api('cartao?id=' + encodeURIComponent(id)); } catch (e) { $('#trCb', m).innerHTML = `<div class="carrega-erro" role="alert">⚠️ ${esc(e.message)}</div>`; return; }
    if (!m.isConnected) return;
    const dt = (iso) => { if (!iso) return ''; const d = new Date(iso), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const draw = () => {
      $('#trCb', m).innerHTML = `
        <div class="fld"><label for="tcNome">Nome</label><input type="text" id="tcNome" value="${esc(c.nome)}"></div>
        <div class="row">
          <div class="fld"><label for="tcLista">Lista</label><select id="tcLista">${dados.listas.map((l) => `<option value="${esc(l.id)}" ${l.id === c.lista ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>
          <div class="fld"><label for="tcPrazo">Prazo</label><input type="datetime-local" id="tcPrazo" value="${dt(c.prazo)}"></div>
          <div class="fld" style="flex:none;align-self:flex-end;padding-bottom:6px">${M.sw('tcFeito', c.feito, 'Concluído')}</div>
        </div>
        ${dados.etiquetas.length ? `<div class="fld"><div class="lbl">Etiquetas</div><div class="tr-ets-ed">${dados.etiquetas.map((l) => `<button type="button" class="tr-et ${c.etiquetas.includes(l.id) ? 'on' : ''}" data-et="${esc(l.id)}" style="background:${cor(l.cor)}" aria-pressed="${c.etiquetas.includes(l.id)}">${esc(l.nome || '·')}</button>`).join('')}</div></div>` : ''}
        <div class="fld"><label for="tcDesc">Descrição</label><textarea id="tcDesc" style="min-height:110px" placeholder="Escreva mais detalhes…">${esc(c.desc)}</textarea></div>
        ${c.checklists.map((k) => `<div class="fld"><div class="lbl">☑ ${esc(k.nome)} <small style="color:var(--faint)">${k.itens.filter((i) => i.ok).length}/${k.itens.length}</small></div>
          ${k.itens.map((i) => `<label class="tr-ck"><input type="checkbox" data-ck="${esc(i.id)}" ${i.ok ? 'checked' : ''}> <span>${esc(i.nome)}</span></label>`).join('')}
          <div class="row" style="margin-top:4px"><input type="text" data-cknovo="${esc(k.id)}" placeholder="＋ Novo item (Enter)" aria-label="Novo item em ${esc(k.nome)}"></div></div>`).join('')}
        ${c.anexos.length ? `<div class="fld"><div class="lbl">📎 Anexos</div>${c.anexos.map((a) => `<a class="tr-anx" href="${esc(a.url)}" target="_blank" rel="noopener">${a.upload ? '📄' : '🔗'} ${esc(a.nome || a.url)}</a>`).join('')}<small style="color:var(--faint)">Arquivos enviados ao Trello abrem no próprio Trello (pedem o seu login lá).</small></div>` : ''}
        <div class="fld"><div class="lbl">💬 Comentários</div>
          <div class="row"><textarea id="tcCom" rows="2" placeholder="Escreva um comentário…"></textarea><button class="btn sm" id="tcComOk" style="flex:none">Enviar</button></div>
          ${c.comentarios.map((x) => `<div class="tr-com"><b>${esc(x.quem)}</b> <small>${new Date(x.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small><div>${esc(x.texto)}</div></div>`).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:6px">
          <span class="row" style="flex:none"><button class="btn ghost" id="tcArq" style="flex:none">📦 Arquivar</button><button class="btn ghost" id="tcMy" style="flex:none" title="Cria uma nota na Biblioteca com este cartão">📥 Guardar no MyLoot</button><a class="btn ghost" href="${esc(c.url)}" target="_blank" rel="noopener" style="flex:none">↗ Abrir no Trello</a></span>
          <button class="btn" id="tcSalva" style="flex:none">✔ Salvar e fechar</button></div>`;
      $('#trCb', m).onclick = (e) => {
        const t = e.target.closest('[data-et]'); if (!t) return;
        const i = c.etiquetas.indexOf(t.dataset.et); if (i < 0) c.etiquetas.push(t.dataset.et); else c.etiquetas.splice(i, 1);
        t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', i < 0); SFX.play('click');
      };
      $('#trCb', m).onchange = async (e) => {
        const ck = e.target.closest('[data-ck]'); if (!ck) return;
        try { await acao({ op: 'checkItem', id: c.id, item: ck.dataset.ck, ok: ck.checked }); SFX.play(ck.checked ? 'coin' : 'click'); const it = c.checklists.flatMap((k) => k.itens).find((i) => i.id === ck.dataset.ck); if (it) it.ok = ck.checked; atualizaResumo(); }
        catch (er) { ck.checked = !ck.checked; M.toast('⚠️ ' + er.message); }
      };
      $('#trCb', m).onkeydown = async (e) => {
        const nv = e.target.closest('[data-cknovo]'); if (!nv || e.key !== 'Enter') return; e.preventDefault();
        const nome = nv.value.trim(); if (!nome) return;
        try { const r = await acao({ op: 'checkNovo', checklist: nv.dataset.cknovo, nome }); const k = c.checklists.find((x) => x.id === nv.dataset.cknovo); k.itens.push({ id: r.id, nome, ok: false }); guarda(); draw(); atualizaResumo(); const n2 = $(`[data-cknovo="${CSS.escape(k.id)}"]`, m); if (n2) n2.focus(); }
        catch (er) { M.toast('⚠️ ' + er.message); }
      };
      $('#tcComOk', m).onclick = async () => {
        const t = $('#tcCom', m).value.trim(); if (!t) return M.falta($('#tcCom', m), '✍️ Escreva o comentário');
        try { await acao({ op: 'comentar', id: c.id, texto: t }); c.comentarios.unshift({ id: '', texto: t, quem: (eu && eu.nome) || 'Você', quando: new Date().toISOString() }); base.coment++; guarda(); draw(); SFX.play('pop'); }
        catch (er) { M.toast('⚠️ ' + er.message); }
      };
      $('#tcArq', m).onclick = async () => { if (await M.confirm(`Arquivar o cartão “${c.nome}”? No Trello dá para desarquivar depois.`, 'Arquivar')) arquivar(c.id, () => M.closeModal()); };
      $('#tcMy', m).onclick = () => guardarNoMyLoot(c.id);
      $('#tcSalva', m).onclick = salvar;
    };
    // o que foi digitado continua lá quando a ficha redesenha (depois de comentar ou criar item)
    const guarda = () => { const g = (s) => { const x = $(s, m); return x ? x.value : null; }; const n = g('#tcNome'); if (n != null) { c.nome = n; c.desc = g('#tcDesc'); c.lista = g('#tcLista'); const pz = g('#tcPrazo'); c.prazo = pz ? new Date(pz).toISOString() : ''; c.feito = $('#tcFeito', m).checked; } };
    const atualizaResumo = () => { const its = c.checklists.flatMap((k) => k.itens); base.check = [its.filter((i) => i.ok).length, its.length]; };
    async function salvar() {
      guarda();
      if (!c.nome.trim()) return M.falta($('#tcNome', m), '✍️ O cartão precisa de um nome');
      const b = { op: 'cartaoSalvar', id: c.id, nome: c.nome, desc: c.desc, prazo: c.prazo, feito: c.feito, etiquetas: c.etiquetas, lista: c.lista };
      if (c.lista !== base.lista) b.pos = 'bottom';
      try {
        await acao(b);
        Object.assign(base, { nome: c.nome, desc: !!c.desc.trim(), prazo: c.prazo, feito: c.feito, etiquetas: c.etiquetas.slice() });
        if (base.lista !== c.lista) { const L = dados.cartoes.filter((x) => x.lista === c.lista); base.lista = c.lista; base.pos = (L.length ? Math.max(...L.map((x) => x.pos)) : 0) + 65536; }
        SFX.play('coin'); M.closeModal(); M.render(); M.toast('✅ Cartão salvo no Trello');
      } catch (e) { M.toast('⚠️ ' + e.message); }
    }
    draw();
  }

  async function desconectar() {
    if (!(await M.confirm('Desconectar o Trello deste MyLoot? A chave e o token saem deste computador. Os seus quadros no Trello não mudam.', 'Desconectar'))) return;
    try { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ trello: null }) }); quadros = null; dados = null; erro = ''; if (M.intStatus) await M.intStatus(true); M.render(); M.toast('Trello desconectado'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }
})();
