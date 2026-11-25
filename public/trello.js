// Trello dentro do MyLoot: ver os quadros, as listas e os cartões da própria pessoa e mexer neles (mover, criar, editar, comentar).
// A chave e o token ficam no computador (data/segredos.json); o app só pede ao MyLoot o que mostrar ou mudar.
// v2.25.0: layout no padrão do Trello (largura fixa, capas com imagem), mais ações e sincronização sozinha (a cada 30 s).
(function () {
  const { esc, $ } = M;
  let quadros = null, dados = null, carregando = false, deNovo = false, erro = '', busca = '', eu = null;
  let mexeu = 0, ocupado = 0, arrastando = false, sincEm = 0, relogio = 0; // controle da sincronização
  const COR = { green: '#4bce97', yellow: '#e2b203', orange: '#fea362', red: '#f87168', purple: '#9f8fef', blue: '#579dff', sky: '#6cc3e0', lime: '#94c748', pink: '#e774bb', black: '#8590a2' };
  const FUNDO = { blue: '#0079bf', orange: '#d29034', green: '#519839', red: '#b04632', purple: '#89609e', pink: '#cd5a91', lime: '#4bbf6b', sky: '#00aecc', grey: '#838c91' }; // cores de fundo dos quadros, como no Trello
  const cor = (c) => COR[String(c || '').replace(/_(dark|light)$/, '')] || '#8590a2';
  const api = (p, o) => M.api('/api/trello/' + p, o);
  // toda mudança passa por aqui: enquanto houver uma em andamento, a sincronização espera (não traz dado velho por cima)
  // enquanto algo vai para o Trello, a ficha aberta fica travada (inert): nada de dois envios cruzados nem texto sumindo no meio
  let fichaPresa = false; // Salvar e fechar / Guardar no MyLoot em andamento: a ficha fica travada até terminar, mesmo que outro envio acabe antes
  const trava = () => { const mb = document.querySelector('#trCb'), on = ocupado > 0 || fichaPresa; if (mb) { mb.inert = on; mb.setAttribute('aria-busy', String(on)); } };
  const acao = async (b) => { mexeu++; ocupado++; trava(); try { return await api('acao', { method: 'POST', body: JSON.stringify(b) }); } finally { ocupado--; mexeu++; trava(); } };
  const qAtual = () => M.db.settings.trelloQuadro || '';
  const fmtPrazo = (d) => { if (!d) return ''; const x = new Date(d); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); };
  const prazoCls = (c) => { if (!c.prazo) return ''; if (c.feito) return 'ok'; const ms = new Date(c.prazo) - Date.now(); return ms < 0 ? 'atr' : ms < 864e5 ? 'logo' : ''; };
  const doCartao = (id) => dados && dados.cartoes.find((x) => x.id === id);
  const daLista = (id, menos) => dados.cartoes.filter((x) => x.lista === id && x.id !== menos).sort((a, b) => a.pos - b.pos);

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
        M.trelloReset(); eu = await api('eu');
        SFX.play('coin'); M.toast('✅ Trello conectado' + (eu.nome ? ': ' + eu.nome : ''));
        if (M.intStatus) M.intStatus(true).catch(() => {});
        M.render();
      } catch (e) { M.toast('⚠️ ' + e.message); }
    };
  }

  let ger = 0; // muda ao trocar de conta: resposta que chega depois disso é da conta anterior e vai fora
  async function carregar(forcar) {
    if (carregando) { deNovo = true; return; } carregando = true; erro = '';
    const g = ger;
    try {
      let qs = quadros;
      if (!qs || forcar) qs = (await api('quadros')).quadros.sort((a, b) => (b.fav - a.fav) || String(b.ult).localeCompare(String(a.ult)));
      if (g !== ger) throw 0;
      quadros = qs;
      let q = qAtual();
      if (!quadros.some((b) => b.id === q)) { q = quadros[0] ? quadros[0].id : ''; M.db.settings.trelloQuadro = q; M.save(); }
      const nd = q ? await api('quadro?id=' + encodeURIComponent(q)) : null;
      if (g !== ger) throw 0;
      dados = nd; sincEm = Date.now();
    } catch (e) { if (e !== 0) erro = e.message; }
    carregando = false;
    if (deNovo) { deNovo = false; return carregar(); } // a pessoa trocou de quadro no meio do caminho
    if (g !== ger) return;
    if (M.ui.page === 'trello') M.render();
  }

  // ----- sincronização: o que mudou no Trello aparece aqui sozinho -----
  const parado = () => M.ui.page === 'trello' && dados && !carregando && !ocupado && !arrastando && !M.modalOpen() && document.visibilityState === 'visible' && !document.querySelector('.tr-novo') && !(document.activeElement && document.activeElement.id === 'trBusca');
  let lendo = false; // uma leitura por vez (o relógio de 30 s e a volta para a aba não se atropelam)
  async function sincroniza() {
    if (!parado() || lendo) return;
    const q = dados.quadro.id, m0 = mexeu, t0 = Date.now(), g = ger;
    let novo; lendo = true;
    try { novo = await api('quadro?id=' + encodeURIComponent(q)); } catch (_) { return; } finally { lendo = false; } // sem internet agora: tenta na próxima
    if (m0 !== mexeu || g !== ger || sincEm > t0 || !parado() || !dados || dados.quadro.id !== q) return; // a pessoa mexeu (ou atualizou) enquanto buscava: fica o mais novo
    sincEm = Date.now();
    if (JSON.stringify(novo) === JSON.stringify(dados)) return pintaSinc();
    dados = novo; M.render();
  }
  M.trelloSinc = sincroniza;
  // trocou ou desligou a conta (aqui ou em Configurações): nada da conta anterior fica na tela
  M.trelloReset = () => { quadros = dados = eu = null; erro = ''; mexeu++; ger++; busca = ''; if (carregando) deNovo = true; }; // busca em andamento da conta antiga: ao terminar, já busca a nova
  const pintaSinc = () => { const b = $('#trAtu'); if (b && sincEm) b.title = 'Sincronizado com o Trello às ' + new Date(sincEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (atualiza sozinho a cada 30 s)'; };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - sincEm > 10000) sincroniza(); });

  function cartaoHTML(c) {
    const et = dados.etiquetas.filter((l) => c.etiquetas.includes(l.id));
    const mb = dados.membros.filter((m) => c.membros.includes(m.id));
    const bad = [
      c.prazo ? `<span class="tr-b pz ${prazoCls(c)}" title="Prazo${c.feito ? ' (concluído)' : ''}">🕒 ${fmtPrazo(c.prazo)}</span>` : '',
      c.desc ? '<span class="tr-b" title="Tem descrição">≡</span>' : '',
      c.coment ? `<span class="tr-b" title="Comentários">💬 ${c.coment}</span>` : '',
      c.anexos ? `<span class="tr-b" title="Anexos">📎 ${c.anexos}</span>` : '',
      c.check[1] ? `<span class="tr-b ${c.check[0] === c.check[1] ? 'ok' : ''}" title="Checklist">☑ ${c.check[0]}/${c.check[1]}</span>` : '',
    ].join('');
    const cheia = c.capa && c.capaCheia && !c.capaImg; // capa "cheia" no Trello: o cartão inteiro fica na cor, com o nome por cima
    const img = c.capaImg ? `<div class="tr-img" style="aspect-ratio:${c.capaImg.w}/${c.capaImg.h}"><img src="/api/trello/capa?id=${esc(c.id)}&v=${esc(c.capaImg.v)}" loading="lazy" decoding="async" alt="" draggable="false"></div>` : '';
    return `<div class="tr-card${cheia ? ' cheio' : ''}${c.feito ? ' feito' : ''}" draggable="true" data-c="${esc(c.id)}" tabindex="0" role="button" aria-label="Abrir o cartão ${esc(c.nome)}"${cheia ? ` style="--capa:${cor(c.capa)}"` : ''}>
      ${img || (c.capa && !cheia ? `<div class="tr-capa" style="background:${cor(c.capa)}"></div>` : '')}
      <div class="tr-cc">${et.length ? `<div class="tr-ets">${et.map((l) => `<span class="tr-et" style="background:${cor(l.cor)}" title="${esc(l.nome || l.cor)}">${esc(l.nome)}</span>`).join('')}</div>` : ''}
      <div class="tr-nome">${c.feito ? '<span class="tr-ok" title="Concluído">✔</span>' : ''}${esc(c.nome)}</div>
      ${bad || mb.length ? `<div class="tr-rod">${bad}<span class="tr-mbs">${mb.map((m) => `<span class="tr-mb" title="${esc(m.nome)}">${esc(m.ini)}</span>`).join('')}</span></div>` : ''}</div>
    </div>`;
  }

  M.pages.trello = () => {
    const v = $('#view');
    if (!relogio) relogio = setInterval(sincroniza, 30000);
    M.intStatus().then((st) => {
      if (M.ui.page !== 'trello') return;
      if (!st.trello.temChave) { v.innerHTML = conectarHTML(st.trello); conectarBind(); return; }
      if (!quadros && !carregando && !erro) { v.innerHTML = '<div class="empty"><div class="big">📋</div><h3>Abrindo o seu Trello…</h3></div>'; carregar(); return; }
      desenha(v);
    }).catch((e) => { if (M.ui.page === 'trello') v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Não consegui abrir o Trello</h3><p>${esc(e.message)}</p></div>`; });
  };

  // filtro sem redesenhar: só esconde os cartões que não batem e acerta os contadores
  function aplicaFiltro() {
    const qb = M.norm(busca), porId = new Map(dados ? dados.cartoes.map((c) => [c.id, c]) : []);
    document.querySelectorAll('#trCols .tr-col[data-l]').forEach((col) => {
      let n = 0;
      col.querySelectorAll('.tr-card').forEach((el) => { const c = porId.get(el.dataset.c), ok = !qb || (c && M.norm(c.nome).includes(qb)); el.hidden = !ok; if (ok) n++; });
      col.querySelector('.n').textContent = n;
    });
  }

  function desenha(v) {
    if (erro && !dados) {
      v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>O Trello não respondeu</h3><p>${esc(erro)}</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="trDeNovo" style="flex:none">🔁 Tentar de novo</button><button class="btn ghost" id="trRecon" style="flex:none">🔑 Conectar de novo</button></div></div>`;
      $('#trDeNovo').onclick = () => { erro = ''; carregar(true); M.render(); };
      $('#trRecon').onclick = desconectar;
      return;
    }
    // guarda onde a pessoa estava (rolagem do quadro e de cada lista) para a tela não pular ao redesenhar
    const antes = $('#trCols'), rol = antes && antes.dataset.q === (dados && dados.quadro.id) ? { x: antes.scrollLeft, y: {} } : null;
    if (rol) antes.querySelectorAll('.tr-col[data-l]').forEach((c) => { rol.y[c.dataset.l] = c.querySelector('.tr-cards').scrollTop; });
    const d = dados;
    const fundo = d && d.quadro.img ? `url('${String(d.quadro.img).replace(/'/g, '%27')}') center/cover` : d && d.quadro.cor ? (FUNDO[d.quadro.cor] || cor(d.quadro.cor)) : '';
    v.innerHTML = `
      <div class="toolbar tr-topo">
        <select id="trQ" aria-label="Quadro do Trello">${(quadros || []).map((b) => `<option value="${esc(b.id)}" ${b.id === qAtual() ? 'selected' : ''}>${b.fav ? '⭐ ' : ''}${esc(b.nome)}</option>`).join('')}</select>
        <input class="search" id="trBusca" type="search" placeholder="Filtrar cartões…" value="${esc(busca)}">
        <button class="btn ghost sm" id="trAtu" title="Buscar de novo no Trello">${carregando ? '⏳' : '🔄'} Atualizar</button>
        ${d && M.urlOk(d.quadro.url) ? `<a class="btn ghost sm" href="${esc(M.urlOk(d.quadro.url))}" target="_blank" rel="noopener">↗ Abrir no Trello</a>` : ''}
        <span class="grow"></span>
        <button class="btn ghost sm" id="trCfg" title="Trocar a conta ou desconectar">⚙️</button>
      </div>
      ${erro ? `<div class="carrega-erro" role="alert">⚠️ ${esc(erro)}</div>` : ''}
      ${!d ? (carregando ? '<div class="empty"><div class="big">⏳</div><h3>Abrindo o quadro…</h3></div>' : '<div class="empty"><div class="big">📋</div><h3>Nenhum quadro aberto na sua conta</h3><p>Crie um quadro no Trello e clique em Atualizar.</p></div>') : `
      <div class="tr-quadro" style="${fundo ? esc('--trbg:' + fundo) : ''}">
        <div class="tr-cols" id="trCols" data-q="${esc(d.quadro.id)}">${d.listas.map((l) => {
          const cs = daLista(l.id);
          return `<div class="tr-col" data-l="${esc(l.id)}"><div class="tr-col-h"><b>${esc(l.nome)}</b><span class="n">${cs.length}</span><button type="button" class="xbtn" data-lmais="${esc(l.id)}" title="Opções da lista" aria-label="Opções da lista ${esc(l.nome)}">⋯</button></div>
            <div class="tr-cards">${cs.map(cartaoHTML).join('')}</div>
            <button type="button" class="tr-add" data-add="${esc(l.id)}">＋ Adicionar um cartão</button></div>`;
        }).join('')}
          <div class="tr-col tr-col-nova"><button type="button" class="tr-add" id="trLNova">＋ Adicionar outra lista</button></div>
        </div>
      </div>`}`;
    pintaSinc();
    $('#trQ').onchange = (e) => { M.db.settings.trelloQuadro = e.target.value; M.save(); dados = null; busca = ''; carregar(); M.render(); };
    $('#trBusca').oninput = (e) => { busca = e.target.value; aplicaFiltro(); };
    $('#trAtu').onclick = () => { SFX.play('click'); carregar(true); M.render(); };
    $('#trCfg').onclick = (e) => M.ctxMenu(e, [
      { em: '🔄', t: 'Atualizar os quadros', fn: () => carregar(true) },
      { em: '🔑', t: 'Trocar a conta ou o token', fn: desconectar },
      { em: '⚙️', t: 'Configurações → Notion e Trello', fn: () => M.go('cfg') },
    ]);
    if (!d) return;
    const cols = $('#trCols');
    if (busca) aplicaFiltro();
    if (rol) { cols.scrollLeft = rol.x; cols.querySelectorAll('.tr-col[data-l]').forEach((c) => { if (rol.y[c.dataset.l]) c.querySelector('.tr-cards').scrollTop = rol.y[c.dataset.l]; }); }
    cols.onclick = (e) => {
      const b = (s) => e.target.closest(s); let x;
      if ((x = b('[data-add]'))) return novoCartao(x);
      if ((x = b('[data-lmais]'))) return listaMenu(e, x.dataset.lmais);
      if (b('#trLNova')) return novaLista(b('#trLNova'));
      if ((x = b('[data-c]'))) return abrirCartao(x.dataset.c);
    };
    cols.onkeydown = (e) => { const c = e.target.closest && e.target.closest('[data-c]'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirCartao(c.dataset.c); } };
    cols.oncontextmenu = (e) => { const c = e.target.closest('[data-c]'); if (!c) return; e.preventDefault(); cartaoMenu(e, c.dataset.c); };
    // arrastar cartões entre listas e dentro da lista (no celular: segurar o cartão → Mover para…)
    let arr = null;
    cols.ondragstart = (e) => { const c = e.target.closest('[data-c]'); if (!c) return; arr = c.dataset.c; arrastando = true; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arr); };
    cols.ondragend = () => { arr = null; arrastando = false; cols.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); cols.querySelectorAll('.tr-marca').forEach((x) => x.remove()); };
    const alvo = (e) => {
      const col = e.target.closest('.tr-col[data-l]'); if (!col) return null;
      const L = [...col.querySelectorAll('.tr-card:not(.dragging):not([hidden])')];
      const depois = L.find((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      return { col, depois };
    };
    cols.ondragover = (e) => {
      if (!arr) return; const a = alvo(e); if (!a) return; e.preventDefault();
      cols.querySelectorAll('.tr-col.over').forEach((x) => x !== a.col && x.classList.remove('over')); a.col.classList.add('over');
      let mk = cols.querySelector('.tr-marca'); if (!mk) { mk = document.createElement('div'); mk.className = 'tr-marca'; }
      const box = a.col.querySelector('.tr-cards');
      if (a.depois ? mk.nextSibling !== a.depois || mk.parentNode !== box : box.lastChild !== mk) { if (a.depois) box.insertBefore(mk, a.depois); else box.appendChild(mk); }
    };
    cols.ondrop = (e) => {
      if (!arr) return; const a = alvo(e); if (!a) return; e.preventDefault();
      const id = arr, lista = a.col.dataset.l, antesDe = a.depois ? a.depois.dataset.c : null;
      cols.ondragend(); moverCartao(id, lista, antesDe);
    };
  }

  // posição no Trello: entre o cartão de cima e o de baixo (ou no fim). antesDe: id do cartão que fica logo abaixo, '_topo' ou null (fim)
  function moverCartao(id, lista, antesDe) {
    const c = doCartao(id); if (!c) return;
    const L = daLista(lista, id);
    const i = antesDe === '_topo' ? 0 : antesDe ? Math.max(0, L.findIndex((x) => x.id === antesDe)) : L.length;
    const cima = i > 0 ? L[i - 1].pos : 0, baixo = i < L.length ? L[i].pos : (L.length ? L[L.length - 1].pos + 65536 : 65536);
    const pos = i < L.length ? (cima + baixo) / 2 : baixo;
    if (c.lista === lista && ((L[i - 1] ? L[i - 1].pos < c.pos : true) && (L[i] ? c.pos < L[i].pos : true))) return; // já está nesse lugar
    const antes = { lista: c.lista, pos: c.pos };
    c.lista = lista; c.pos = pos; SFX.play('drop'); M.render(); // muda na tela na hora; se o Trello recusar, volta
    acao({ op: 'cartaoMover', id, lista, pos }).catch((e) => { Object.assign(c, antes); M.render(); M.toast('⚠️ Não deu para mover: ' + e.message + ' O cartão voltou para o lugar.'); });
  }

  function novoCartao(btn) {
    const lista = btn.dataset.add, box = document.createElement('div'); box.className = 'tr-novo';
    box.innerHTML = '<textarea rows="2" placeholder="Nome do cartão (Enter para criar)" aria-label="Nome do cartão novo"></textarea><div class="row"><button class="btn sm" style="flex:none">＋ Criar</button><button class="btn ghost sm" style="flex:none">Cancelar</button></div>';
    btn.replaceWith(box); const ta = box.querySelector('textarea'); ta.focus();
    const criar = async () => {
      const nome = ta.value.trim(); if (!nome) return ta.focus();
      ta.value = ''; ta.focus();
      const q = dados.quadro.id;
      try {
        const r = await acao({ op: 'cartaoNovo', lista, nome });
        if (!dados || dados.quadro.id !== q) return M.toast(`✅ “${nome.slice(0, 40)}” criado no outro quadro`); // trocou de quadro enquanto esperava
        if (doCartao(r.id)) return SFX.play('pop'); // a sincronização já trouxe o cartão
        const L = daLista(lista);
        dados.cartoes.push({ id: r.id, nome, desc: false, lista, pos: (L.length ? L[L.length - 1].pos : 0) + 65536, prazo: '', feito: false, etiquetas: [], membros: [], url: '', capa: '', capaCheia: false, capaImg: null, ativ: '', check: [0, 0], coment: 0, anexos: 0 });
        SFX.play('pop');
        const col = $(`.tr-col[data-l="${CSS.escape(lista)}"] .tr-cards`); if (col) { col.insertAdjacentHTML('beforeend', cartaoHTML(dados.cartoes[dados.cartoes.length - 1])); col.scrollTop = col.scrollHeight; aplicaFiltro(); }
      } catch (e) { ta.value = nome; M.toast('⚠️ Não deu para criar: ' + e.message); }
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); criar(); } else if (e.key === 'Escape') M.render(); };
    const [ok, no] = box.querySelectorAll('button'); ok.onclick = criar; no.onclick = () => M.render();
  }

  async function novaLista(btn) {
    const box = document.createElement('div'); box.className = 'tr-novo';
    box.innerHTML = '<input type="text" placeholder="Nome da lista" aria-label="Nome da lista nova"><div class="row"><button class="btn sm" style="flex:none">＋ Criar lista</button><button class="btn ghost sm" style="flex:none">Cancelar</button></div>';
    btn.replaceWith(box); const i = box.querySelector('input'); i.focus();
    const criar = async () => {
      const nome = i.value.trim(); if (!nome || box.dataset.indo) return i.focus();
      const q = dados.quadro.id; box.dataset.indo = '1'; i.disabled = true;
      try { const r = await acao({ op: 'listaNova', quadro: q, nome }); if (!dados || dados.quadro.id !== q) return M.toast(`✅ Lista “${nome.slice(0, 40)}” criada no outro quadro`); if (!dados.listas.some((x) => x.id === r.id)) dados.listas.push({ id: r.id, nome, pos: (dados.listas.length ? Math.max(...dados.listas.map((x) => x.pos)) : 0) + 65536 }); SFX.play('pop'); M.render(); const c = $('#trCols'); if (c) c.scrollLeft = c.scrollWidth; }
      catch (e) { M.toast('⚠️ ' + e.message); delete box.dataset.indo; i.disabled = false; i.focus(); }
    };
    i.onkeydown = (e) => { if (e.key === 'Enter') criar(); else if (e.key === 'Escape') M.render(); };
    const [ok, no] = box.querySelectorAll('button'); ok.onclick = criar; no.onclick = () => M.render();
  }

  // muda a ordem das listas: a lista troca de lugar com a vizinha (d = -1 esquerda, +1 direita)
  function moverLista(id, d) {
    const L = dados.listas, i = L.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= L.length) return;
    const l = L[i], antes = l.pos;
    const pos = d < 0 ? ((j > 0 ? L[j - 1].pos : 0) + L[j].pos) / 2 : (L[j].pos + (j < L.length - 1 ? L[j + 1].pos : L[j].pos + 131072)) / 2;
    l.pos = pos; L.sort((a, b) => a.pos - b.pos); SFX.play('drop'); M.render();
    acao({ op: 'listaMover', id, pos }).catch((e) => { l.pos = antes; L.sort((a, b) => a.pos - b.pos); M.render(); M.toast('⚠️ Não deu para mover a lista: ' + e.message); });
  }

  function listaMenu(e, id) {
    const l = dados.listas.find((x) => x.id === id); if (!l) return;
    const i = dados.listas.indexOf(l);
    M.ctxMenu(e, [
      { em: '＋', t: 'Adicionar um cartão', fn: () => { const b = $(`.tr-col[data-l="${CSS.escape(id)}"] [data-add]`); if (b) novoCartao(b); } },
      { em: '✏️', t: 'Renomear a lista', fn: async () => {
        const nome = await pedeNome('✏️ Renomear a lista', l.nome); if (!nome || nome === l.nome) return;
        const antes = l.nome; l.nome = nome; M.render();
        acao({ op: 'listaRenomear', id, nome }).catch((er) => { l.nome = antes; M.render(); M.toast('⚠️ ' + er.message); });
      } },
      ...(i > 0 ? [{ em: '⬅️', t: 'Mover a lista para a esquerda', fn: () => moverLista(id, -1) }] : []),
      ...(i < dados.listas.length - 1 ? [{ em: '➡️', t: 'Mover a lista para a direita', fn: () => moverLista(id, 1) }] : []),
      '-',
      { em: '📦', t: 'Arquivar a lista', fn: async () => {
        const n = dados.cartoes.filter((c) => c.lista === id).length;
        if (!(await M.confirm(`Arquivar a lista “${l.nome}”${n ? ` com ${n} ${n === 1 ? 'cartão' : 'cartões'}` : ''}? Dá para desfazer logo em seguida.`, 'Arquivar'))) return;
        try {
          await acao({ op: 'listaArquivar', id }); dados.listas = dados.listas.filter((x) => x.id !== id); dados.cartoes = dados.cartoes.filter((c) => c.lista !== id); SFX.play('trash'); M.render();
          M.toast('📦 Lista arquivada no Trello', async () => { try { await acao({ op: 'listaRestaurar', id }); await carregar(true); M.toast('↩️ Lista de volta'); } catch (er) { M.toast('⚠️ ' + er.message); } });
        } catch (er) { M.toast('⚠️ ' + er.message); }
      } },
    ]);
  }

  // caixinha de texto do próprio MyLoot (no lugar do prompt do navegador)
  const pedeNome = (titulo, valor, rot) => new Promise((ok) => {
    const m = M.modal(`<div class="modal-h"><h2>${esc(titulo)}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b"><div class="fld"><label for="pnV">${esc(rot || 'Nome')}</label><input type="text" id="pnV" maxlength="2000" value="${esc(valor || '')}"></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="pnNo" style="flex:none">Cancelar</button><button class="btn" id="pnOk" style="flex:none">✔ Salvar</button></div></div>`, { small: true, onClose: () => ok(null) });
    const i = $('#pnV', m), fim = (v) => { const f = ok; ok = () => {}; M.closeModal(); f(v); };
    $('#x', m).onclick = $('#pnNo', m).onclick = () => fim(null);
    $('#pnOk', m).onclick = () => fim(i.value.trim());
    i.onkeydown = (e) => { if (e.key === 'Enter') fim(i.value.trim()); };
    setTimeout(() => { i.focus(); i.select(); }, 30);
  });

  function cartaoMenu(e, id) {
    const c = doCartao(id); if (!c) return;
    M.ctxMenu(e, [
      { em: '📂', t: 'Abrir', fn: () => abrirCartao(id) },
      { em: c.feito ? '◻️' : '✔️', t: c.feito ? 'Desmarcar concluído' : 'Marcar como concluído', fn: () => { const a = c.feito; c.feito = !a; M.render(); acao({ op: 'cartaoSalvar', id, feito: !a }).catch((er) => { c.feito = a; M.render(); M.toast('⚠️ ' + er.message); }); } },
      { em: '⏫', t: 'Para o começo da lista', fn: () => moverCartao(id, c.lista, '_topo') },
      { em: '⏬', t: 'Para o fim da lista', fn: () => moverCartao(id, c.lista, null) },
      '-', { sub: 'Mover para' },
      ...dados.listas.filter((l) => l.id !== c.lista).map((l) => ({ em: '➡️', t: l.nome, fn: () => moverCartao(id, l.id, null) })),
      '-',
      { em: '📥', t: 'Guardar no MyLoot', fn: () => guardarNoMyLoot(id) },
      ...(c.url ? [{ em: '↗', t: 'Abrir no Trello', fn: () => open(c.url, '_blank', 'noopener') }] : []),
      { em: '📦', t: 'Arquivar o cartão', fn: () => arquivar(id) },
    ]);
  }

  async function arquivar(id, depois) {
    const c = doCartao(id); if (!c) return;
    try {
      await acao({ op: 'cartaoArquivar', id }); dados.cartoes = dados.cartoes.filter((x) => x.id !== id); SFX.play('trash'); M.render(); if (depois) depois();
      M.toast('📦 Cartão arquivado no Trello', async () => { try { await acao({ op: 'cartaoRestaurar', id }); if (dados && !doCartao(id)) dados.cartoes.push(c); M.render(); M.toast('↩️ Cartão de volta'); } catch (e) { M.toast('⚠️ ' + e.message); } });
    } catch (e) { M.toast('⚠️ ' + e.message); }
  }

  // o inverso do "Enviar para o Trello": o cartão vira uma nota na Biblioteca, com link para o cartão
  // pelo menu do cartão: busca o cartão e guarda. Pela ficha: usa o cartão já aberto (sem esperar nada, então não há corrida
  // com o que a pessoa faz na ficha) e depois() reabre a ficha como estava se ela não for abrir a nota nova
  async function guardarNoMyLoot(id, depois, doCartaoAberto) {
    try {
      const c = doCartaoAberto || await api('cartao?id=' + encodeURIComponent(id));
      const lista = (dados.listas.find((l) => l.id === c.lista) || {}).nome || '';
      const check = c.checklists.flatMap((k) => k.itens.map((i) => ({ id: M.uid(), t: i.nome, done: i.ok })));
      const it = M.createItem({ cat: '', type: 'nota', title: c.nome, desc: `Do Trello: ${dados.quadro.nome}${lista ? ' → ' + lista : ''}`, content: c.desc, checklist: check, links: c.url ? [{ id: M.uid(), url: c.url, label: 'Cartão no Trello' }] : [], tags: ['trello'] });
      M.save(); SFX.play('coin');
      const reabrir = depois ? depois() : null;
      if (reabrir === 'fechou') return M.toast(`📥 “${c.nome}” foi guardado na Biblioteca`); // a pessoa fechou a ficha durante a busca: sem pergunta por cima de outra janela
      if (await M.confirm(`📥 “${c.nome}” foi guardado na Biblioteca, com o link para o cartão. Abrir agora?`, 'Abrir')) { if (M.modalOpen()) M.closeModal(); M.openItem(it.id); } else if (reabrir) reabrir();
    } catch (e) { M.toast('⚠️ ' + e.message); }
  }

  // ----- ficha do cartão -----
  let volta = null; // ficha que reabre com o que já estava digitado (depois de uma caixinha de pergunta)
  async function abrirCartao(id) {
    const base = doCartao(id); if (!base) return;
    const m = M.modal(`<div class="modal-h"><h2>📋 Cartão do Trello</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b" id="trCb"><div class="empty"><div class="big">⏳</div><h3>Abrindo o cartão…</h3></div></div>`);
    $('#x', m).onclick = M.closeModal;
    const dt = (iso) => { if (!iso) return ''; const d = new Date(iso), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const minuto = (x) => { x.prazo = x.prazo ? new Date(dt(x.prazo)).toISOString() : ''; return x; }; // prazo só até o minuto, como o campo da tela
    const CAMPOS = ['nome', 'desc', 'prazo', 'feito', 'etiquetas', 'membros', 'lista', 'capa', 'capaCheia', 'capaImg'];
    const igual = (a, b) => JSON.stringify(Array.isArray(a) ? a.slice().sort() : a) === JSON.stringify(Array.isArray(b) ? b.slice().sort() : b);
    let c, orig; // orig: como o cartão estava quando abriu. Só o que a pessoa mudar vai para o Trello
    let ex = null; // textos ainda não enviados (comentário, item novo de checklist) que voltam junto com a ficha
    if (volta && volta.id === id) { c = volta.c; orig = volta.orig; ex = volta.ex; volta = null; if (M.marcarSujo && (CAMPOS.some((k) => !igual(c[k], orig[k])) || (ex && (ex.com || Object.values(ex.ck || {}).some(Boolean))))) setTimeout(M.marcarSujo, 0); } // texto em digitação também conta: sair avisa
    else {
      volta = null;
      try { c = minuto(await api('cartao?id=' + encodeURIComponent(id))); } catch (e) { $('#trCb', m).innerHTML = `<div class="carrega-erro" role="alert">⚠️ ${esc(e.message)}</div>`; return; }
      if (!m.isConnected) return;
      orig = {}; CAMPOS.forEach((k) => { orig[k] = Array.isArray(c[k]) ? c[k].slice() : c[k]; });
    }
    const extras = () => ({ com: ($('#tcCom', m) || {}).value || '', ck: Object.fromEntries([...m.querySelectorAll('[data-cknovo]')].map((i) => [i.dataset.cknovo, i.value])) });
    const reabre = () => { volta = { id, c, orig, ex: extras() }; if (M.modalOpen()) M.closeModal(); abrirCartao(id); };
    const draw = () => {
      const capaSel = c.capaImg ? '_img' : c.capa || '';
      $('#trCb', m).innerHTML = `
        <div class="fld"><label for="tcNome">Nome</label><input type="text" id="tcNome" value="${esc(c.nome)}"></div>
        <div class="row">
          <div class="fld"><label for="tcLista">Lista</label><select id="tcLista">${dados.listas.some((l) => l.id === c.lista) ? '' : `<option value="${esc(c.lista)}" selected>📍 Lista atual (fora deste quadro)</option>`}${dados.listas.map((l) => `<option value="${esc(l.id)}" ${l.id === c.lista ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>
          <div class="fld"><label for="tcPrazo">Prazo</label><input type="datetime-local" id="tcPrazo" value="${dt(c.prazo)}"></div>
          <div class="fld" style="flex:none;align-self:flex-end;padding-bottom:6px">${M.sw('tcFeito', c.feito, 'Concluído')}</div>
        </div>
        ${dados.etiquetas.length ? `<div class="fld"><div class="lbl">Etiquetas</div><div class="tr-ets-ed">${dados.etiquetas.map((l) => `<button type="button" class="tr-et ${c.etiquetas.includes(l.id) ? 'on' : ''}" data-et="${esc(l.id)}" style="background:${cor(l.cor)}" aria-pressed="${c.etiquetas.includes(l.id)}">${esc(l.nome || '·')}</button>`).join('')}</div></div>` : ''}
        ${dados.membros.length ? `<div class="fld"><div class="lbl">Membros</div><div class="tr-ets-ed">${dados.membros.map((u) => `<button type="button" class="tr-mbt ${c.membros.includes(u.id) ? 'on' : ''}" data-mb="${esc(u.id)}" aria-pressed="${c.membros.includes(u.id)}"><span class="tr-mb">${esc(u.ini)}</span>${esc(u.nome)}</button>`).join('')}</div></div>` : ''}
        <div class="fld"><div class="lbl">Capa</div><div class="tr-ets-ed tr-capas">
          <button type="button" class="tr-cp sem ${capaSel === '' ? 'on' : ''}" data-capa="" aria-pressed="${capaSel === ''}">Sem capa</button>
          ${c.capaImg ? '<button type="button" class="tr-cp sem on" data-capa="_img" aria-pressed="true">🖼️ Imagem atual</button>' : ''}
          ${Object.keys(COR).map((k) => `<button type="button" class="tr-cp ${capaSel === k ? 'on' : ''}" data-capa="${k}" style="background:${COR[k]}" title="${k}" aria-label="Capa ${k}" aria-pressed="${capaSel === k}"></button>`).join('')}
          <label class="tr-cheia"><input type="checkbox" id="tcCheia" ${c.capaCheia ? 'checked' : ''}> cartão inteiro na cor</label></div>
          <small style="color:var(--faint)">Para pôr uma imagem como capa, use o Trello (↗ Abrir no Trello).</small></div>
        <div class="fld"><label for="tcDesc">Descrição</label><textarea id="tcDesc" style="min-height:110px" placeholder="Escreva mais detalhes…">${esc(c.desc)}</textarea></div>
        ${c.checklists.map((k) => `<div class="fld"><div class="lbl">☑ ${esc(k.nome)} <small style="color:var(--faint)">${k.itens.filter((i) => i.ok).length}/${k.itens.length}</small></div>
          ${k.itens.map((i) => `<div class="tr-ckl"><label class="tr-ck"><input type="checkbox" data-ck="${esc(i.id)}" ${i.ok ? 'checked' : ''}> <span>${esc(i.nome)}</span></label><button type="button" class="xbtn" data-ckdel="${esc(i.id)}" title="Apagar este item" aria-label="Apagar o item ${esc(i.nome.slice(0, 40))}">✕</button></div>`).join('')}
          <div class="row" style="margin-top:4px"><input type="text" data-cknovo="${esc(k.id)}" placeholder="＋ Novo item (Enter)" aria-label="Novo item em ${esc(k.nome)}"></div></div>`).join('')}
        <div class="row" style="gap:8px"><button type="button" class="btn ghost sm" id="tcCkNovo" style="flex:none">☑ Novo checklist</button><button type="button" class="btn ghost sm" id="tcAnx" style="flex:none">🔗 Anexar um link</button></div>
        ${c.anexos.length ? `<div class="fld"><div class="lbl">📎 Anexos</div>${c.anexos.map((a) => `<a class="tr-anx" href="${esc(M.urlOk(a.url) || '#')}" target="_blank" rel="noopener noreferrer">${a.upload ? '📄' : '🔗'} ${esc(a.nome || a.url)}</a>`).join('')}<small style="color:var(--faint)">Arquivos enviados ao Trello abrem no próprio Trello (pedem o seu login lá).</small></div>` : ''}
        <div class="fld"><div class="lbl">💬 Comentários</div>
          <div class="row"><textarea id="tcCom" rows="2" placeholder="Escreva um comentário…"></textarea><button class="btn sm" id="tcComOk" style="flex:none">Enviar</button></div>
          ${c.comentarios.map((x) => `<div class="tr-com"><b>${esc(x.quem)}</b> <small>${new Date(x.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small><div>${esc(x.texto)}</div></div>`).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:6px">
          <span class="row" style="flex:none"><button class="btn ghost" id="tcArq" style="flex:none">📦 Arquivar</button><button class="btn ghost" id="tcMy" style="flex:none" title="Cria uma nota na Biblioteca com este cartão">📥 Guardar no MyLoot</button><a class="btn ghost" href="${esc(M.urlOk(c.url) || '#')}" target="_blank" rel="noopener" style="flex:none">↗ Abrir no Trello</a></span>
          <button class="btn" id="tcSalva" style="flex:none">✔ Salvar e fechar</button></div>`;
      $('#tcComOk', m).onclick = async () => {
        const t = $('#tcCom', m).value.trim(); if (!t) return M.falta($('#tcCom', m), '✍️ Escreva o comentário');
        const bt = $('#tcComOk', m); if (bt.disabled) return; bt.disabled = true; $('#tcCom', m).readOnly = true; // um envio por vez
        try { await acao({ op: 'comentar', id: c.id, texto: t }); c.comentarios.unshift({ id: '', texto: t, quem: (eu && eu.nome) || 'Você', quando: new Date().toISOString() }); base.coment++; guarda(); draw(); SFX.play('pop'); }
        catch (er) { M.toast('⚠️ Não deu para comentar: ' + er.message + ' O texto continua aí.'); if (bt.isConnected) { bt.disabled = false; $('#tcCom', m).readOnly = false; } }
      };
      $('#tcArq', m).onclick = async () => {
        if (espera()) return; guarda(); const v = { id, c, orig, ex: extras() };
        if (await M.confirm(`Arquivar o cartão “${c.nome}”? Dá para desfazer logo em seguida.`, 'Arquivar')) arquivar(c.id, () => { if (m.isConnected) M.closeModal(); }); // nunca fecha a ficha de outro cartão
        else { volta = v; abrirCartao(id); } // cancelou: a ficha volta como estava
      };
      // estas três trocam a ficha por uma pergunta: esperam terminar o que ainda está indo para o Trello (comentário, item, marcação)
      const espera = () => (ocupado ? (M.toast('⏳ Espere terminar de enviar para o Trello e tente de novo.'), true) : false);
      // busca o cartão atualizado no Trello (como antes) com a ficha travada: nada muda nela enquanto isso
      $('#tcMy', m).onclick = async () => {
        if (espera()) return; guarda(); const v = { id, c, orig, ex: extras() };
        fichaPresa = true; trava();
        try { await guardarNoMyLoot(c.id, () => { fichaPresa = false; if (!m.isConnected) return 'fechou'; return () => { volta = v; abrirCartao(id); }; }); } finally { fichaPresa = false; trava(); }
      };
      $('#tcSalva', m).onclick = salvar;
      $('#tcCkNovo', m).onclick = async () => {
        if (espera()) return;
        guarda(); const nome = await pedeNome('☑ Novo checklist', 'Checklist'); if (!nome) return reabre();
        try { const r = await acao({ op: 'checklistNova', id: c.id, nome }); c.checklists.push({ id: r.id, nome, itens: [] }); SFX.play('pop'); } catch (er) { M.toast('⚠️ ' + er.message); }
        reabre();
      };
      $('#tcAnx', m).onclick = async () => {
        if (espera()) return;
        guarda(); const url = await pedeNome('🔗 Anexar um link', '', 'Endereço (https://…)'); if (!url) return reabre();
        try { const r = await acao({ op: 'anexoLink', id: c.id, url }); c.anexos.push({ id: r.id, nome: url, url, upload: false }); base.anexos++; SFX.play('pop'); } catch (er) { M.toast('⚠️ ' + er.message); }
        reabre();
      };
    };
    const box = $('#trCb', m);
    box.onclick = async (e) => {
      const b = (s) => e.target.closest(s); let t;
      if ((t = b('[data-et]'))) { const i = c.etiquetas.indexOf(t.dataset.et); if (i < 0) c.etiquetas.push(t.dataset.et); else c.etiquetas.splice(i, 1); t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', i < 0); return SFX.play('click'); }
      if ((t = b('[data-mb]'))) { const i = c.membros.indexOf(t.dataset.mb); if (i < 0) c.membros.push(t.dataset.mb); else c.membros.splice(i, 1); t.classList.toggle('on', i < 0); t.setAttribute('aria-pressed', i < 0); return SFX.play('click'); }
      if ((t = b('[data-capa]'))) { if (t.dataset.capa === '_img') return; guarda(); c.capa = t.dataset.capa; c.capaImg = false; if (!c.capa) c.capaCheia = false; SFX.play('click'); return draw(); }
      if ((t = b('[data-ckdel]'))) {
        if (t.disabled) return; t.disabled = true;
        try { await acao({ op: 'checkItemApagar', id: c.id, item: t.dataset.ckdel }); c.checklists.forEach((k) => { k.itens = k.itens.filter((i) => i.id !== t.dataset.ckdel); }); atualizaResumo(); guarda(); draw(); SFX.play('trash'); }
        catch (er) { t.disabled = false; M.toast('⚠️ ' + er.message); }
      }
    };
    box.onchange = async (e) => {
      const ck = e.target.closest('[data-ck]'); if (!ck) return;
      // um envio por item: a caixinha fica travada até o Trello responder (marcar e desmarcar rápido não embaralha o estado)
      const v = ck.checked; ck.disabled = true;
      try { await acao({ op: 'checkItem', id: c.id, item: ck.dataset.ck, ok: v }); SFX.play(v ? 'coin' : 'click'); const it = c.checklists.flatMap((k) => k.itens).find((i) => i.id === ck.dataset.ck); if (it) it.ok = v; atualizaResumo(); }
      catch (er) { ck.checked = !v; M.toast('⚠️ ' + er.message); }
      finally { ck.disabled = false; }
    };
    box.onkeydown = async (e) => {
      const nv = e.target.closest('[data-cknovo]'); if (!nv || e.key !== 'Enter') return; e.preventDefault();
      const nome = nv.value.trim(); if (!nome || nv.readOnly) return;
      nv.readOnly = true;
      try { const r = await acao({ op: 'checkNovo', checklist: nv.dataset.cknovo, nome }); const k = c.checklists.find((x) => x.id === nv.dataset.cknovo); k.itens.push({ id: r.id, nome, ok: false }); guarda(); draw(); atualizaResumo(); const n2 = $(`[data-cknovo="${CSS.escape(k.id)}"]`, m); if (n2) n2.focus(); }
      catch (er) { nv.readOnly = false; M.toast('⚠️ ' + er.message); }
    };
    // o que foi digitado continua lá quando a ficha redesenha (depois de comentar ou criar item)
    const guarda = () => { const g = (s) => { const x = $(s, m); return x ? x.value : null; }; const n = g('#tcNome'); if (n != null) { c.nome = n; c.desc = g('#tcDesc'); c.lista = g('#tcLista'); const pz = g('#tcPrazo'); c.prazo = pz ? new Date(pz).toISOString() : ''; c.feito = $('#tcFeito', m).checked; if (c.capa) c.capaCheia = $('#tcCheia', m).checked; else if (!c.capaImg) c.capaCheia = false; } }; // capa de imagem: o tamanho dela fica como está
    const atualizaResumo = () => { const its = c.checklists.flatMap((k) => k.itens); base.check = [its.filter((i) => i.ok).length, its.length]; };
    async function salvar() {
      if (ocupado) return M.toast('⏳ Espere terminar de enviar para o Trello e tente de novo.'); // comentário ou item ainda indo
      guarda();
      if (!c.nome.trim()) return M.falta($('#tcNome', m), '✍️ O cartão precisa de um nome');
      const mud = CAMPOS.filter((k) => !igual(c[k], orig[k]));
      if (!mud.length) { M.closeModal(); M.render(); return; }
      const btn = $('#tcSalva', m); btn.disabled = true; btn.textContent = '⏳ Salvando…';
      fichaPresa = true; trava(); // nada muda na ficha enquanto confere e grava
      const solta = () => { fichaPresa = false; trava(); if (btn.isConnected) { btn.disabled = false; btn.textContent = '✔ Salvar e fechar'; } };
      try {
        // alguém mexeu no MESMO campo lá no Trello enquanto a ficha estava aberta? pergunta antes de passar por cima
        const agora = minuto(await api('cartao?id=' + encodeURIComponent(c.id)));
        const NOMES = { nome: 'nome', desc: 'descrição', prazo: 'prazo', feito: 'concluído', etiquetas: 'etiquetas', membros: 'membros', lista: 'lista', capa: 'capa', capaCheia: 'capa', capaImg: 'capa' };
        // a capa vai inteira (cor, tamanho e imagem juntos): mexeu em qualquer parte dela, qualquer mudança de capa lá conta como conflito
        const grupo = (k) => (k.startsWith('capa') ? ['capa', 'capaCheia', 'capaImg'] : [k]);
        const bate = [...new Set([...new Set(mud.flatMap(grupo))].filter((k) => !igual(agora[k], orig[k]) && !igual(agora[k], c[k])).map((k) => NOMES[k]))];
        if (bate.length) {
          volta = { id, c, orig, ex: extras() };
          const sim = await M.confirm(`Este cartão mudou no Trello enquanto você editava (${bate.join(', ')}). Salvar a sua versão por cima?`, 'Salvar a minha');
          if (!sim) return reabre();
          // mudou de novo enquanto a pergunta estava aberta? pergunta outra vez com a versão mais nova
          const depois = minuto(await api('cartao?id=' + encodeURIComponent(c.id)));
          if (CAMPOS.some((k) => !igual(depois[k], agora[k]))) { // o que a pessoa não mexeu fica com o valor novo do Trello; o que ela mexeu continua dela
            M.toast('⚠️ O cartão mudou de novo no Trello. Confira e salve outra vez.');
            // o que ela mexeu (a capa conta inteira) fica como base antiga: o próximo Salvar pergunta de novo se lá mudou
            const mg = new Set(mud.flatMap(grupo));
            CAMPOS.forEach((k) => { if (mg.has(k)) return; c[k] = Array.isArray(depois[k]) ? depois[k].slice() : depois[k]; orig[k] = Array.isArray(depois[k]) ? depois[k].slice() : depois[k]; });
            return reabre();
          }
          volta = null;
        }
        const b = { op: 'cartaoSalvar', id: c.id };
        mud.forEach((k) => { if (k.startsWith('capa')) { b.capa = c.capa; b.capaCheia = c.capaCheia; } else b[k] = c[k]; });
        if (mud.includes('lista')) b.pos = 'bottom';
        await acao(b);
        Object.assign(base, { nome: c.nome, desc: !!c.desc.trim(), prazo: c.prazo, feito: c.feito, etiquetas: c.etiquetas.slice(), membros: c.membros.slice(), capa: c.capa, capaCheia: c.capaCheia });
        if (!c.capaImg) base.capaImg = null;
        if (base.lista !== c.lista) { const L = daLista(c.lista); base.lista = c.lista; base.pos = (L.length ? L[L.length - 1].pos : 0) + 65536; }
        SFX.play('coin'); if (m.isConnected) M.closeModal(); M.render(); M.toast('✅ Cartão salvo no Trello');
      } catch (e) {
        M.toast('⚠️ Não salvou: ' + e.message + ' O que você escreveu continua na ficha: tente de novo.');
        if (m.isConnected) solta(); else reabre();
      } finally { fichaPresa = false; trava(); } // saiu por qualquer caminho (salvou, reabriu, erro): destrava
    }
    // sem "guardar rascunho" aqui: etiquetas, membros e capa são botões e não caberiam num rascunho; ao sair, a janela avisa (continuar ou descartar)
    m.dataset.rkOk = '1'; draw(); trava(); // abriu com um envio ainda em andamento: já começa travada
    if (ex) { const t = $('#tcCom', m); if (t && ex.com) t.value = ex.com; for (const [k, v] of Object.entries(ex.ck || {})) { const i = m.querySelector(`[data-cknovo="${CSS.escape(k)}"]`); if (i && v) i.value = v; } }
  }

  async function desconectar() {
    if (!(await M.confirm('Desconectar o Trello deste MyLoot? A chave e o token saem deste computador. Os seus quadros no Trello não mudam.', 'Desconectar'))) return;
    try { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ trello: null }) }); M.trelloReset(); if (M.intStatus) await M.intStatus(true); M.render(); M.toast('Trello desconectado'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }
})();
