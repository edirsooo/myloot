// Clientes (mini CRM): contatos, status do funil, atalhos (WhatsApp, e-mail, Instagram, Trello, pasta)
// e tudo o que é do cliente junto: tarefas e itens da Biblioteca ligados a ele.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  // colunas do funil (status): ficam em db.cliCols e a pessoa cria, renomeia, troca a cor, reordena e apaga, como listas do Trello
  const PADRAO = [
    { id: 'prospect', name: 'Prospect', em: '🎯', color: '#ffbe46', ord: 0 },
    { id: 'ativo', name: 'Ativo', em: '🟢', color: '#3cffaa', ord: 1 },
    { id: 'pausado', name: 'Pausado', em: '⏸️', color: '#3ad7ff', ord: 2 },
    { id: 'encerrado', name: 'Encerrado', em: '📁', color: '#9aa3c9', ord: 3 },
  ];
  const CORES = ['#ffbe46', '#3cffaa', '#3ad7ff', '#9aa3c9', '#ff7e00', '#ff5c8a', '#b388ff', '#7cd34b', '#ffe066', '#5c7cfa'];
  M.cliCols = () => {
    if (!Array.isArray(M.db.cliCols) || !M.db.cliCols.length) M.db.cliCols = PADRAO.map((o) => Object.assign({}, o));
    return M.db.cliCols.slice().sort((a, b) => (a.ord || 0) - (b.ord || 0));
  };
  Object.defineProperty(M, 'CST', { get: () => M.cliCols(), configurable: true });
  // cliente com status que não é mais coluna (ex.: coluna apagada em outro aparelho) aparece na primeira coluna
  const cst = (id) => { const L = M.cliCols(); return L.find((s) => s.id === id) || L[0]; };
  const colDe = (c) => cst(c.status).id;
  const reordena = (L) => { L.forEach((s, i) => { if (s.ord !== i) { s.ord = i; s.updated = Date.now(); } }); };

  M.editarColuna = (col) => {
    const nova = !col, L = M.cliCols();
    const s = col || { em: '📌', name: '', color: CORES[L.length % CORES.length] };
    const m = M.modal(`<div class="modal-h"><h2>${nova ? '＋ Nova coluna' : '✏️ Editar coluna'}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b">
        <div class="row"><div class="fld" style="flex:none;width:84px"><label for="colEm">Emoji</label><input id="colEm" type="text" maxlength="8" value="${esc(s.em)}" style="text-align:center;font-size:18px"></div>
          <div class="fld" style="flex:1"><label for="colNm">Nome da coluna</label><input id="colNm" type="text" maxlength="40" value="${esc(s.name)}" placeholder="Ex.: Lead, Proposta enviada, Fechado…"></div></div>
        <div class="fld"><label>Cor</label><div class="col-cores" id="colCor">${CORES.map((c) => `<button type="button" class="col-cor ${c === s.color ? 'on' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="color" id="colCorL" value="${esc(s.color)}" title="Outra cor"></div></div>
        ${nova ? '' : `<div class="row" style="gap:8px"><button class="btn ghost sm" id="colEsq" style="flex:none">◀ Mover para a esquerda</button><button class="btn ghost sm" id="colDir" style="flex:none">Mover para a direita ▶</button><span class="grow"></span><button class="btn danger sm" id="colDel" style="flex:none">🗑️ Apagar coluna</button></div>`}
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="colCn" style="flex:none">Cancelar</button><button class="btn" id="colOk" style="flex:none">${nova ? '＋ Criar' : '✔ Salvar'}</button></div>
      </div>`, { small: true });
    let cor = s.color;
    const pinta = () => m.querySelectorAll('.col-cor').forEach((b) => b.classList.toggle('on', b.dataset.cor === cor));
    $('#colCor', m).onclick = (e) => { const b = e.target.closest('[data-cor]'); if (!b) return; cor = b.dataset.cor; $('#colCorL', m).value = cor; pinta(); };
    $('#colCorL', m).oninput = (e) => { cor = e.target.value; pinta(); };
    $('#x', m).onclick = M.closeModal; $('#colCn', m).onclick = M.closeModal;
    $('#colOk', m).onclick = () => {
      const nm = $('#colNm', m).value.trim(); if (!nm) return M.falta($('#colNm', m), '✍️ Dê um nome à coluna');
      const em = $('#colEm', m).value.trim().replace(/[<>"'&]/g, '');
      if (nova) M.db.cliCols.push({ id: 'col' + M.uid(), name: nm, em, color: cor, ord: L.length, updated: Date.now() });
      else Object.assign(col, { name: nm, em, color: cor, updated: Date.now() });
      M.save(); M.closeModal(); SFX.play('done'); M.toast(nova ? `${em} Coluna “${nm}” criada` : '✅ Coluna salva'); M.render();
    };
    $('#colNm', m).onkeydown = (e) => { if (e.key === 'Enter') $('#colOk', m).click(); };
    if (!nova) {
      const move = (d) => { const i = L.indexOf(col), j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; reordena(L); M.save(); M.closeModal(); SFX.play('drop'); M.render(); };
      $('#colEsq', m).onclick = () => move(-1); $('#colDir', m).onclick = () => move(1);
      $('#colDel', m).onclick = () => { M.closeModal(); apagarColuna(col); };
    }
    setTimeout(() => $('#colNm', m).focus(), 0);
  };

  async function apagarColuna(col) {
    const L = M.cliCols(); if (L.length < 2) return M.toast('⚠️ O funil precisa de pelo menos uma coluna');
    const dentro = (M.db.clients || []).filter((c) => colDe(c) === col.id), outras = L.filter((s) => s !== col);
    let destino = outras[0].id;
    if (dentro.length) {
      destino = await M.escolha(`${dentro.length} cliente${dentro.length > 1 ? 's estão' : ' está'} em “${col.name}”. Para qual coluna ${dentro.length > 1 ? 'eles vão' : 'ele vai'}?`, outras.map((s) => ({ k: s.id, t: `${s.em} ${s.name}` })), `Apagar a coluna “${col.name}”`);
      if (!destino) return;
    } else if (!(await M.confirm(`Apagar a coluna “${col.name}”?`, '🗑️ Apagar'))) return;
    const t = Date.now();
    dentro.forEach((c) => { c.status = destino; c.updated = t; });
    M.db.cliCols = M.db.cliCols.filter((s) => s !== col);
    if (filtro === col.id) filtro = '';
    reordena(M.cliCols());
    M.save(); SFX.play('trash'); M.toast(`🗑️ Coluna “${col.name}” apagada`); M.render();
  }
  M.client = (id) => (M.db.clients || []).find((c) => c.id === id);
  let filtro = '', busca = '', modo = 'cards';

  // ----- atalhos de contato -----
  const soNum = (s) => String(s || '').replace(/\D/g, '');
  M.cliLinks = (c) => {
    const L = [];
    const w = soNum(c.whats);
    if (w) L.push(['💬', 'WhatsApp', 'https://wa.me/' + (w.length <= 11 ? '55' + w : w)]);
    if (c.email) L.push(['✉️', 'E-mail', 'mailto:' + c.email.trim()]);
    if (c.insta) L.push(['📸', 'Instagram', /^https?:/i.test(c.insta) ? c.insta : 'https://instagram.com/' + c.insta.trim().replace(/^@/, '')]);
    if (c.site) L.push(['🌐', 'Site', /^https?:/i.test(c.site) ? c.site : 'https://' + c.site.trim()]);
    if (c.trello) L.push(['📋', 'Trello', /^https?:/i.test(c.trello) ? c.trello : 'https://' + c.trello.trim()]);
    if (c.pasta) L.push(['📁', 'Pasta', /^https?:/i.test(c.pasta) ? c.pasta : '#pasta']);
    return L;
  };
  const botoes = (c) => M.cliLinks(c).map(([em, n, u]) => u === '#pasta'
    ? `<button class="cli-a" data-pasta="${c.id}" title="Abrir a pasta no computador">${em}<small>${n}</small></button>`
    : `<a class="cli-a" href="${esc(u)}" target="_blank" rel="noopener" title="${n}">${em}<small>${n}</small></a>`).join('');
  M.abrirPastaCliente = async (c) => {
    if (M.remoto) return M.toast('📁 A pasta abre só no computador.');
    try { await M.api('/api/abrir-pasta', { method: 'POST', body: JSON.stringify({ pasta: c.pasta }) }); SFX.play('open'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  };
  const iniciais = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const corDe = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 70% 55%)`; };

  function cardHTML(c) {
    const s = cst(c.status), tA = M.db.tasks.filter((t) => t.client === c.id && M.tarefaPendente(t)).length, nI = M.db.items.filter((i) => i.client === c.id).length;
    // quanto falta receber desse cliente (e se tem atrasado): aparece no cartão para cobrar sem abrir a ficha
    const hoje = M.today(), aReceber = (M.db.fin || []).filter((f) => f.client === c.id && f.tipo === 'entrada' && !f.pago);
    const somaR = aReceber.reduce((x, f) => x + (Number(f.valor) || 0), 0), atrasado = aReceber.some((f) => f.data < hoje);
    return `<div class="card cli" data-cli="${c.id}" draggable="true" style="--c:${s.color}">
      <div class="top"><span class="av" style="background:${corDe(c.nome)}">${esc(iniciais(c.nome))}</span><div style="min-width:0;flex:1"><h3>${esc(c.nome || 'Sem nome')}</h3>${c.empresa ? `<p style="-webkit-line-clamp:1">${esc(c.empresa)}</p>` : ''}</div><span class="badge">${esc(s.em)} ${esc(s.name)}</span></div>
      <div class="meta">${c.rascunho ? '<span class="tag rasc" title="Tem alterações não salvas. Abra para salvar ou descartar.">📝 rascunho</span>' : ''}${tA ? `<span class="mi">✅ ${tA} tarefa${tA > 1 ? 's' : ''}</span>` : ''}${nI ? `<span class="mi">📦 ${nI} ite${nI > 1 ? 'ns' : 'm'}</span>` : ''}${somaR ? `<span class="mi ${atrasado ? 'atras' : ''}" title="${atrasado ? 'Tem recebimento atrasado' : 'Recebimentos em aberto'}">💰 ${M.reais ? M.reais(somaR) : somaR} a receber${atrasado ? ' · atrasado' : ''}</span>` : ''}${c.tags.slice(0, 3).map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}</div>
      ${M.cliLinks(c).length ? `<div class="cli-bar">${botoes(c)}</div>` : ''}<div class="cli-abrir"><span>Abrir ficha →</span><button type="button" class="cli-del" data-del="${c.id}" title="Mandar para a lixeira" aria-label="Mandar ${esc(c.nome || 'cliente')} para a lixeira">🗑️</button></div></div>`;
  }

  M.pages.clients = () => {
    const v = $('#view'), C = M.db.clients || (M.db.clients = []);
    const q = M.norm(busca);
    const COLS = M.cliCols();
    if (filtro && !COLS.some((s) => s.id === filtro)) filtro = '';
    const L = C.filter((c) => (!filtro || colDe(c) === filtro) && (!q || M.norm([c.nome, c.empresa, c.email, c.insta, c.notas, c.tags.join(' ')].join(' ')).includes(q)))
      .sort((a, b) => b.updated - a.updated);
    const cnt = (id) => C.filter((c) => colDe(c) === id).length;
    v.innerHTML = `
      <div class="hotbar" id="cliF" data-lab="Status"><div class="slot ${!filtro ? 'on' : ''}" data-f="">👥 Todos <span class="n">${C.length}</span></div>${COLS.map((s) => `<div class="slot ${filtro === s.id ? 'on' : ''}" data-f="${esc(s.id)}" style="--c:${s.color}">${esc(s.em)} ${esc(s.name)} <span class="n">${cnt(s.id)}</span></div>`).join('')}<div class="slot col-mais" data-colnova="1" title="Criar uma coluna nova no funil">＋ Coluna</div></div>
      <div class="toolbar"><button class="btn" id="cliNovo">＋ Novo cliente</button>${M.opcBtn('cliCampos', 'Campos da ficha')}
        <input class="search" id="cliQ" type="search" placeholder="Buscar cliente…" value="${esc(busca)}">
        <span class="grow"></span><div class="seg" id="cliV"><button data-v="cards" class="${modo === 'cards' ? 'on' : ''}">▦ Cartões</button><button data-v="funil" class="${modo === 'funil' ? 'on' : ''}">▥ Funil</button></div>${M.hint('Cartões: todos os clientes lado a lado. Funil: uma coluna por status, como no Trello. Arraste o cliente de uma coluna para outra; crie colunas em “＋ Nova coluna”, edite ou apague no ⋯ da coluna e arraste o título para mudar a ordem.')}</div>
      <div id="cliRes">${!C.length ? `<div class="empty"><div class="big">👥</div><h3>Nenhum cliente ainda</h3><p>Guarde contato, status, link do Trello e a pasta de cada cliente,<br>e junte as tarefas e os itens dele num lugar só.</p><button class="btn" data-novo="1" style="margin-top:12px">＋ Cadastrar o primeiro</button></div>`
        : modo === 'funil' ? `<div class="board">${COLS.map((s) => { const cs = L.filter((c) => colDe(c) === s.id); return `<div class="col" data-col="${esc(s.id)}" style="--c:${s.color}"><h4 class="col-h" data-colh="${esc(s.id)}" draggable="true" title="Arraste para mudar a ordem"><span class="col-nm">${esc(s.em)} ${esc(s.name)}</span><span class="n">${cs.length}</span><button type="button" class="col-mn" data-coled="${esc(s.id)}" title="Editar, mover ou apagar a coluna" aria-label="Opções da coluna ${esc(s.name)}">⋯</button></h4><div class="cards">${cs.map(cardHTML).join('')}</div><button type="button" class="col-add" data-novo-em="${esc(s.id)}">＋ Cliente aqui</button></div>`; }).join('')}<div class="col col-nova"><button type="button" class="btn ghost" data-colnova="1">＋ Nova coluna</button></div></div>`
        : L.length ? `<div class="grid">${L.map(cardHTML).join('')}${L.length < 4 ? '<div class="cli-dica">💡 <span><b>Dica:</b> abra a ficha para ver as tarefas, os materiais e os pagamentos do cliente.</span></div>' : ''}</div>` : '<div class="empty"><div class="big">🔎</div><h3>Ninguém encontrado</h3></div>'}</div>`;
    $('#cliF').onclick = (e) => { const x = e.target.closest('[data-f]'); if (!x) return; filtro = x.dataset.f; SFX.play('click'); M.render(); };
    $('#cliQ').oninput = (e) => { busca = e.target.value; const p = e.target.selectionStart; M.render(); const i = $('#cliQ'); i.focus(); i.setSelectionRange(p, p); };
    $('#cliV').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; modo = b.dataset.v; SFX.play('click'); M.render(); };
    $('#cliNovo').onclick = () => M.novoCliente();
    v.onclick = (e) => {
      if (e.target.closest('[data-novo]')) return M.novoCliente();
      if (e.target.closest('[data-colnova]')) return M.editarColuna();
      const ne = e.target.closest('[data-novo-em]'); if (ne) return M.novoCliente({ status: ne.dataset.novoEm });
      const ce = e.target.closest('[data-coled]'); if (ce) { e.stopPropagation(); return colMenu(e, ce.dataset.coled); }
      const dl = e.target.closest('[data-del]'); if (dl) { e.stopPropagation(); const c = M.client(dl.dataset.del); if (c) M.trashClient(c); return; }
      const pa = e.target.closest('[data-pasta]'); if (pa) { e.stopPropagation(); return M.abrirPastaCliente(M.client(pa.dataset.pasta)); }
      if (e.target.closest('a')) return;
      const c = e.target.closest('[data-cli]'); if (c) M.openClient(c.dataset.cli);
    };
    v.oncontextmenu = (e) => {
      const h = e.target.closest('[data-colh]'); if (h) return colMenu(e, h.dataset.colh);
      const c = e.target.closest('[data-cli]'); if (c) M.clientMenu(e, M.client(c.dataset.cli));
    };
    let drag = null, dragCol = null;
    v.ondragstart = (e) => {
      const c = e.target.closest('[data-cli]'); if (c) { drag = c.dataset.cli; e.dataTransfer.setData('text/x-myloot', drag); return; }
      const h = e.target.closest('[data-colh]'); if (h) { dragCol = h.dataset.colh; e.dataTransfer.setData('text/x-myloot-col', dragCol); }
    };
    v.ondragover = (e) => { const col = e.target.closest('.col[data-col]'); if (col && (drag || dragCol)) { e.preventDefault(); $$('.col.over').forEach((x) => x.classList.remove('over')); col.classList.add('over'); } };
    v.ondrop = (e) => {
      const col = e.target.closest('.col[data-col]'); if (!col || !(drag || dragCol)) return; e.preventDefault();
      if (dragCol) { // muda a ordem das colunas: a arrastada entra no lugar da coluna onde foi solta
        const L = M.cliCols(), a = L.findIndex((s) => s.id === dragCol), b = L.findIndex((s) => s.id === col.dataset.col); dragCol = null;
        if (a >= 0 && b >= 0 && a !== b) { const [s] = L.splice(a, 1); L.splice(b, 0, s); reordena(L); M.save(); SFX.play('drop'); }
        return M.render();
      }
      const c = M.client(drag); drag = null;
      if (c && colDe(c) !== col.dataset.col) { c.status = col.dataset.col; c.updated = Date.now(); M.save(); SFX.play('drop'); M.toast(`${cst(c.status).em} ${c.nome}: ${cst(c.status).name}`); }
      M.render();
    };
    v.ondragend = () => { drag = null; dragCol = null; $$('.col.over').forEach((x) => x.classList.remove('over')); };
  };

  function colMenu(e, id) {
    const L = M.cliCols(), s = L.find((x) => x.id === id); if (!s) return;
    const i = L.indexOf(s);
    const move = (d) => { [L[i], L[i + d]] = [L[i + d], L[i]]; reordena(L); M.save(); SFX.play('drop'); M.render(); };
    M.ctxMenu(e, [
      { em: '✏️', t: 'Editar nome, emoji e cor', fn: () => M.editarColuna(s) },
      { em: '＋', t: 'Novo cliente nesta coluna', fn: () => M.novoCliente({ status: s.id }) },
      ...(i > 0 ? [{ em: '◀', t: 'Mover para a esquerda', fn: () => move(-1) }] : []),
      ...(i < L.length - 1 ? [{ em: '▶', t: 'Mover para a direita', fn: () => move(1) }] : []),
      { em: '➕', t: 'Nova coluna', fn: () => M.editarColuna() },
      '-', { em: '🗑️', t: 'Apagar coluna', fn: () => apagarColuna(s) },
    ]);
  };

  let novoAberto = null; // cliente recém-criado com a ficha ainda aberta (mostra "Descartar")
  M.novoCliente = (o) => {
    const t = Date.now();
    const L = M.cliCols(), pad = (L.find((s) => s.id === filtro) || L.find((s) => s.id === 'ativo') || L[0]).id;
    const c = Object.assign({ id: M.uid(), nome: '', empresa: '', status: pad, email: '', whats: '', insta: '', site: '', trello: '', pasta: '', notas: '', tags: [], created: t, updated: t, _novo: true }, o);
    (M.db.clients || (M.db.clients = [])).push(c);
    novoAberto = c.id;
    M.openClient(c.id);
  };

  M.clientMenu = (e, c) => {
    if (!c) return;
    M.ctxMenu(e, [
      { em: '📂', t: 'Abrir', fn: () => M.openClient(c.id) },
      ...M.cliLinks(c).map(([em, n, u]) => ({ em, t: 'Abrir ' + n, fn: () => (u === '#pasta' ? M.abrirPastaCliente(c) : open(u, '_blank', 'noopener')) })),
      { em: '📤', t: 'Enviar para o Trello', fn: () => enviarTrello(c) },
      '-', { sub: 'Mudar status' }, ...M.CST.filter((s) => s.id !== colDe(c)).map((s) => ({ em: s.em, t: s.name, fn: () => { c.status = s.id; c.updated = Date.now(); M.save(); M.render(); } })),
      '-', { em: '🗑️', t: 'Mandar para a lixeira', fn: () => M.trashClient(c) },
    ]);
  };
  async function enviarTrello(c) {
    try { const r = await M.api('/api/int/trello/enviar', { method: 'POST', body: JSON.stringify({ cliente: c.id }) }); SFX.play('done'); M.toast('📤 Cliente enviado para o Trello'); if (r.url) open(r.url, '_blank', 'noopener'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }
  // manda para a Lixeira já com a versão que está na tela (sem rascunho pendurado) e confere que saiu da lista
  M.trashClient = (c) => {
    if (!c) return;
    M.rasc.salvar(c); delete c._novo;
    M.paraLixeira('client', c);
    M.db.clients = M.db.clients.filter((x) => x !== c && x.id !== c.id);
    M.save(); SFX.play('trash'); M.toast(`🗑️ ${c.nome || 'Cliente'} foi para a lixeira`, () => M.restoreFromTrash(c.id, true)); M.render();
  };

  // ----- ficha do cliente -----
  M.openClient = (id) => {
    const c = M.client(id); if (!c) return;
    M.cliAberto = c.id;
    SFX.play('open');
    let base = M.rasc.abrir(c); // traz de volta o rascunho guardado (se houver) e tira a foto da versão salva
    const touch = () => { if (novoAberto !== c.id) M.rasc.tocar(c, base); c.updated = Date.now(); delete c._novo; M.save(); M.rodapePinta(m, c, novoAberto === c.id); };
    const m = M.modal('<div></div>', { onClose: () => {
      M.cliAberto = null;
      const eraNovo = novoAberto === c.id; novoAberto = null;
      if (c._novo && !c.nome.trim()) M.db.clients = M.db.clients.filter((x) => x !== c);
      else if (eraNovo && M.db.clients.includes(c)) M.toast('✅ Cliente salvo'); // fechou no ✕: avisa que ficou guardado
      // cliente que já existia e foi mudado sem "Salvar": fica a versão antiga e as mudanças viram rascunho
      if (!eraNovo && M.db.clients.includes(c) && M.rasc.guardar(c)) M.toast('📝 Alterações guardadas como rascunho. Abra a ficha de novo para salvar ou descartar.');
      delete c._novo; M.save(); M.render();
    } });
    const oc = M.db.settings.cliOcultos || []; // campos prontos que a pessoa escondeu (o que já estava escrito continua guardado)
    const campo = (k, lbl, ph, tipo) => oc.includes(k) && !c[k] ? '' : `<div class="fld"><label for="cf_${k}">${lbl}</label><input type="${tipo || 'text'}" id="cf_${k}" data-k="${k}" value="${esc(c[k])}" placeholder="${ph}"></div>`;
    const TIPO_IN = { texto: 'text', numero: 'text', data: 'date', link: 'url' };
    const extras = () => M.opc('cliCampos').map((f) => { const val = (c.extra || {})[f.id] || ''; const link = f.tipo === 'link' && /^https?:\/\//i.test(val) ? ` <a href="${esc(val)}" target="_blank" rel="noopener" title="Abrir">↗</a>` : ''; return `<div class="fld"><label for="cx_${esc(f.id)}">${esc(f.em)} ${esc(f.name)}${link}</label><input type="${TIPO_IN[f.tipo] || 'text'}" ${f.tipo === 'numero' ? 'inputmode="decimal"' : ''} id="cx_${esc(f.id)}" data-x="${esc(f.id)}" value="${esc(val)}"></div>`; }).join('');
    // redesenha a ficha (atalhos de contato, cabeçalho) sem perder o campo em que a pessoa entrou com Tab ou clique
    const redesenha = () => setTimeout(() => {
      const f = document.activeElement, id = f && m.contains(f) && f.id, pos = f && typeof f.selectionStart === 'number' ? f.selectionStart : null;
      draw();
      const e = id && m.querySelector('#' + CSS.escape(id));
      if (e) { e.focus(); if (pos != null) try { e.setSelectionRange(pos, pos); } catch (_) {} }
    }, 0);
    if (novoAberto !== c.id) M.versaoGuardar('client', c); // como a ficha estava ao abrir
    function draw() {
      const s = cst(c.status);
      const ts = M.db.tasks.filter((t) => t.client === c.id).sort((a, b) => a.done - b.done || (a.date || '9').localeCompare(b.date || '9'));
      const its = M.db.items.filter((i) => i.client === c.id).sort((a, b) => b.updated - a.updated);
      const soltos = M.db.items.filter((i) => !i.client && !i.modelo);
      m.innerHTML = `
        <div class="modal-h" style="border-bottom-color:${s.color}"><span class="av" style="background:${corDe(c.nome)}">${esc(iniciais(c.nome))}</span><h2>${esc(c.nome || 'Novo cliente')}</h2>
          ${novoAberto === c.id ? '' : '<button class="icon-btn" id="cVer" title="Versões anteriores desta ficha" aria-label="Versões anteriores">🕘</button>'}<button class="icon-btn" id="cDel" title="Lixeira">🗑️</button><button class="icon-btn" id="cX" title="Fechar (Esc)">✕</button></div>
        <div class="modal-b">
          <input class="title-in" id="cNome" type="text" placeholder="Nome do cliente" value="${esc(c.nome)}">
          <div class="types" id="cSt">${M.CST.map((x) => `<div class="slot ${x.id === colDe(c) ? 'on' : ''}" data-s="${esc(x.id)}" style="--c:${x.color}">${esc(x.em)} ${esc(x.name)}</div>`).join('')}</div>
          ${M.cliLinks(c).length ? `<div class="cli-bar big">${botoes(c)}</div>` : ''}
          <div class="row">${campo('empresa', 'Empresa / marca', 'Ex: Padaria do João')}${campo('whats', 'WhatsApp', '(11) 99999-9999', 'tel')}</div>
          <div class="row">${campo('email', 'E-mail', 'nome@email.com', 'email')}${campo('insta', 'Instagram', '@perfil')}</div>
          <div class="row">${campo('site', 'Site', 'site.com.br')}${campo('trello', 'Quadro do Trello', 'Cole o link do quadro')}</div>
          ${extras() ? `<div class="cli-extra">${extras()}</div>` : ''}
          ${oc.includes('pasta') && !c.pasta ? '' : `<div class="fld"><label>Pasta do cliente ${M.hint('Caminho da pasta no computador (ex.: D:\\Clientes\\João) ou link do Google Drive. O botão 📁 abre direto.')}</label><input type="text" data-k="pasta" value="${esc(c.pasta)}" placeholder="${M.sistema === 'win32' ? 'D:\\Clientes\\Nome' : '/Users/voce/Clientes/Nome'} ou link do Drive"></div>`}
          <div class="fld"><label>Etiquetas</label><input type="text" id="cTags" value="${esc(c.tags.join(', '))}" placeholder="social media, mensal…"></div>
          <div class="fld"><label>Anotações${M.micBtn('[data-k=notas]')}</label><textarea data-k="notas" style="font-family:var(--f);min-height:80px" placeholder="Briefing, combinados, valores, preferências…">${esc(c.notas)}</textarea></div>
          <div class="fld"><label>✅ Tarefas do cliente</label>
            ${ts.map(M.taskHTML).join('') || '<small style="color:var(--faint)">Nenhuma tarefa ainda.</small>'}
            <div class="row" style="margin-top:8px;align-items:center"><input type="text" id="cTk" placeholder="Nova tarefa… (ex.: Postar carrossel amanhã)" style="flex:3">${M.micBtn('#cTk')}<button class="btn" id="cTkGo" style="flex:none">＋ Adicionar</button></div></div>
          <div class="fld"><label>📦 Itens do cliente ${M.hint('Briefings, roteiros, prompts, arquivos e links deste cliente. Crie aqui ou ligue um item que já existe.')}</label>
            ${its.map((it) => `<div class="rowi" data-it="${it.id}" style="--c:${M.type(it.type).color}"><span class="ic">${M.type(it.type).em}</span><b>${esc(it.title || 'Sem título')}</b><button type="button" class="xbtn desv" data-solta="${it.id}" title="Desvincular do cliente (o item continua na Biblioteca)" aria-label="Desvincular ${esc(it.title || 'item sem título')} do cliente"><span class="dv-i" aria-hidden="true">🔗</span><span class="dv-t">Desvincular</span></button></div>`).join('') || '<small style="color:var(--faint)">Nenhum item ligado.</small>'}
            <div class="row" style="margin-top:8px;gap:8px"><button class="btn ghost sm" id="cItNovo" style="flex:none">＋ Novo item</button>${M.modelos().length ? '<button class="btn sm ghost" id="cItMod" style="flex:none">📐 Usar modelo</button>' : ''}
              ${soltos.length ? `<select id="cItLiga" style="flex:1;min-width:160px"><option value="">🔗 Ligar item que já existe…</option>${soltos.slice(0, 300).map((i) => `<option value="${i.id}">${M.type(i.type).em} ${esc(i.title || 'Sem título')}</option>`).join('')}</select>` : ''}</div></div>
          ${M.finDoCliente(c)}
          <div class="row" style="gap:8px"><button class="btn ghost sm" id="cTrello" style="flex:none">📤 Enviar para o Trello</button>${M.hint('Cria um cartão com os contatos, as anotações e as tarefas abertas na lista que você conectou em Configurações → Integrações.')}</div>
        </div>${M.rodapeSalvar(novoAberto === c.id)}`;
      bind();
      M.rodapePinta(m, c, novoAberto === c.id);
    }
    function bind() {
      $('#cX', m).onclick = M.closeModal;
      if ($('#cVer', m)) $('#cVer', m).onclick = () => { M.closeModal(); M.versoesAbrir('client', c.id); };
      $('#svOk', m).onclick = () => { if (!c.nome.trim()) return M.falta($('#cNome', m), '✍️ Dê um nome ao cliente primeiro'); const novo = novoAberto === c.id; novoAberto = null; delete c._novo; M.rasc.salvar(c); M.save(); M.versaoGuardar('client', c); M.closeModal(); M.toast(novo ? '✅ Cliente cadastrado' : '✅ Cliente salvo'); };
      if ($('#svRev', m)) $('#svRev', m).onclick = () => { M.rasc.reverter(c); base = M.rasc.foto(c); M.save(); SFX.play('undo'); draw(); M.toast('↩ Alterações descartadas: voltou a versão salva'); };
      if ($('#svNo', m)) $('#svNo', m).onclick = () => { M.db.clients = M.db.clients.filter((x) => x !== c); novoAberto = null; M.save(); M.closeModal(); M.toast('Cadastro descartado'); };
      // apaga ANTES de fechar: assim o fechamento da ficha (rascunho, "cliente salvo", volta para a ficha) não mexe mais nele
      $('#cDel', m).onclick = () => {
        const cheio = !!(c.nome.trim() || c.empresa || c.email || c.whats || c.insta || c.site || c.notas);
        novoAberto = null; M.cliAberto = null;
        if (!cheio) { M.rasc.salvar(c); M.db.clients = M.db.clients.filter((x) => x !== c); M.closeModal(); return M.toast('Cadastro vazio descartado'); }
        M.rasc.salvar(c); delete c._novo; M.paraLixeira('client', c); M.db.clients = M.db.clients.filter((x) => x !== c);
        M.closeModal(); // o onClose grava e redesenha a tela
        SFX.play('trash'); M.toast(`🗑️ ${c.nome || 'Cliente'} foi para a lixeira`, () => M.restoreFromTrash(c.id, true));
      };
      $('#cNome', m).oninput = (e) => { c.nome = e.target.value; touch(); $('.modal-h h2', m).textContent = c.nome || 'Novo cliente'; };
      $('#cNome', m).onchange = redesenha;
      m.querySelectorAll('[data-k]').forEach((el) => { el.oninput = () => { c[el.dataset.k] = el.value; touch(); }; el.onchange = () => { if (el.tagName === 'INPUT') redesenha(); }; });
      m.querySelectorAll('[data-x]').forEach((el) => { el.oninput = () => { c.extra = Object.assign({}, c.extra, { [el.dataset.x]: el.value.slice(0, 2000) }); if (!el.value) delete c.extra[el.dataset.x]; touch(); }; });
      $('#cTags', m).oninput = (e) => { c.tags = [...new Set(e.target.value.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean))]; touch(); };
      $('#cSt', m).onclick = (e) => { const x = e.target.closest('[data-s]'); if (!x) return; c.status = x.dataset.s; touch(); SFX.play('click'); draw(); };
      m.querySelectorAll('.cli-bar [data-pasta]').forEach((b) => { b.onclick = () => M.abrirPastaCliente(c); });
      const addT = () => { const i = $('#cTk', m); const t = M.addTask(i.value); if (t) { t.client = c.id; M.save(); draw(); $('#cTk', m).focus(); } else M.falta(i, '✍️ Escreva a tarefa primeiro'); };
      $('#cTkGo', m).onclick = addT; $('#cTk', m).onkeydown = (e) => { if (e.key === 'Enter') addT(); };
      m.querySelectorAll('.task').forEach((row) => {
        row.onclick = (e) => {
          const t = M.db.tasks.find((x) => x.id === row.dataset.id); if (!t) return;
          if (e.target.type === 'checkbox') { M.toggleTask(t, e); M.openClient(c.id); }
          else if (e.target.dataset.a === 'rm') { M.trashTask(t); M.openClient(c.id); }
          else if (e.target.dataset.a === 'prio') { t.prio = M.proxPrio(t.prio); M.save(); draw(); }
          else M.editTask(t, () => M.openClient(c.id));
        };
      });
      m.querySelectorAll('[data-it]').forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-solta]')) return; M.openItem(r.dataset.it); }; });
      m.querySelectorAll('[data-solta]').forEach((b) => { b.onclick = () => { const it = M.db.items.find((i) => i.id === b.dataset.solta); if (it) { it.client = ''; it.updated = Date.now(); M.save(); draw(); } }; });
      $('#cItNovo', m).onclick = () => { const it = M.createItem({ title: '', client: c.id, cat: '', _new: true }, true); M.openItem(it.id); };
      if ($('#cItMod', m)) $('#cItMod', m).onclick = () => M.novoComModelo({ client: c.id });
      if ($('#cItLiga', m)) $('#cItLiga', m).onchange = (e) => { const it = M.db.items.find((i) => i.id === e.target.value); if (it) { it.client = c.id; it.updated = Date.now(); M.save(); SFX.play('drop'); draw(); } };
      $('#cTrello', m).onclick = () => enviarTrello(c);
      M.finClienteLiga(m, c, draw); // pagamentos do cliente: abrir, marcar recebido/pago e ver todos (fica no financeiro.js)
    }
    draw();
    if (!c.nome) $('#cNome', m).focus();
  };
})();
