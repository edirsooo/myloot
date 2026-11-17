// Clientes (mini CRM): contatos, status do funil, atalhos (WhatsApp, e-mail, Instagram, Trello, pasta)
// e tudo o que é do cliente junto: tarefas e itens da Biblioteca ligados a ele.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  M.CST = [
    { id: 'prospect', name: 'Prospect', em: '🎯', color: '#ffbe46' },
    { id: 'ativo', name: 'Ativo', em: '🟢', color: '#3cffaa' },
    { id: 'pausado', name: 'Pausado', em: '⏸️', color: '#3ad7ff' },
    { id: 'encerrado', name: 'Encerrado', em: '📁', color: '#9aa3c9' },
  ];
  const cst = (id) => M.CST.find((s) => s.id === id) || M.CST[1];
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
    const s = cst(c.status), tA = M.db.tasks.filter((t) => t.client === c.id && !t.done).length, nI = M.db.items.filter((i) => i.client === c.id).length;
    return `<div class="card cli" data-cli="${c.id}" draggable="true" style="--c:${s.color}">
      <div class="top"><span class="av" style="background:${corDe(c.nome)}">${esc(iniciais(c.nome))}</span><div style="min-width:0;flex:1"><h3>${esc(c.nome || 'Sem nome')}</h3>${c.empresa ? `<p style="-webkit-line-clamp:1">${esc(c.empresa)}</p>` : ''}</div><span class="badge">${s.em} ${s.name}</span></div>
      <div class="meta">${c.rascunho ? '<span class="tag rasc" title="Tem alterações não salvas. Abra para salvar ou descartar.">📝 rascunho</span>' : ''}${tA ? `<span class="mi">✅ ${tA} tarefa${tA > 1 ? 's' : ''}</span>` : ''}${nI ? `<span class="mi">📦 ${nI} ite${nI > 1 ? 'ns' : 'm'}</span>` : ''}${c.tags.slice(0, 3).map((x) => `<span class="tag">#${esc(x)}</span>`).join('')}</div>
      ${M.cliLinks(c).length ? `<div class="cli-bar">${botoes(c)}</div>` : ''}<div class="cli-abrir">Abrir ficha →</div></div>`;
  }

  M.pages.clients = () => {
    const v = $('#view'), C = M.db.clients || (M.db.clients = []);
    const q = M.norm(busca);
    const L = C.filter((c) => (!filtro || c.status === filtro) && (!q || M.norm([c.nome, c.empresa, c.email, c.insta, c.notas, c.tags.join(' ')].join(' ')).includes(q)))
      .sort((a, b) => b.updated - a.updated);
    const cnt = (id) => C.filter((c) => c.status === id).length;
    v.innerHTML = `
      <div class="hotbar" id="cliF" data-lab="Status"><div class="slot ${!filtro ? 'on' : ''}" data-f="">👥 Todos <span class="n">${C.length}</span></div>${M.CST.map((s) => `<div class="slot ${filtro === s.id ? 'on' : ''}" data-f="${s.id}" style="--c:${s.color}">${s.em} ${s.name} <span class="n">${cnt(s.id)}</span></div>`).join('')}</div>
      <div class="toolbar"><button class="btn" id="cliNovo">＋ Novo cliente</button>
        <input class="search" id="cliQ" type="search" placeholder="Buscar cliente…" value="${esc(busca)}">
        <span class="grow"></span><div class="seg" id="cliV"><button data-v="cards" class="${modo === 'cards' ? 'on' : ''}">▦ Cartões</button><button data-v="funil" class="${modo === 'funil' ? 'on' : ''}">▥ Funil</button></div>${M.hint('Cartões: todos os clientes lado a lado. Funil: uma coluna por status (Prospect, Ativo, Pausado, Encerrado); arraste o cliente de uma coluna para outra.')}</div>
      <div id="cliRes">${!C.length ? `<div class="empty"><div class="big">👥</div><h3>Nenhum cliente ainda</h3><p>Guarde contato, status, link do Trello e a pasta de cada cliente,<br>e junte as tarefas e os itens dele num lugar só.</p><button class="btn" data-novo="1" style="margin-top:12px">＋ Cadastrar o primeiro</button></div>`
        : modo === 'funil' ? `<div class="board">${M.CST.map((s) => { const cs = L.filter((c) => c.status === s.id); return `<div class="col" data-col="${s.id}"><h4>${s.em} ${s.name}<span class="n">${cs.length}</span></h4><div class="cards">${cs.map(cardHTML).join('')}</div></div>`; }).join('')}</div>`
        : L.length ? `<div class="grid">${L.map(cardHTML).join('')}${L.length < 4 ? '<div class="cli-dica">💡 <span><b>Dica:</b> abra a ficha para ver as tarefas, os materiais e os pagamentos do cliente.</span></div>' : ''}</div>` : '<div class="empty"><div class="big">🔎</div><h3>Ninguém encontrado</h3></div>'}</div>`;
    $('#cliF').onclick = (e) => { const x = e.target.closest('[data-f]'); if (!x) return; filtro = x.dataset.f; SFX.play('click'); M.render(); };
    $('#cliQ').oninput = (e) => { busca = e.target.value; const p = e.target.selectionStart; M.render(); const i = $('#cliQ'); i.focus(); i.setSelectionRange(p, p); };
    $('#cliV').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; modo = b.dataset.v; SFX.play('click'); M.render(); };
    $('#cliNovo').onclick = () => M.novoCliente();
    v.onclick = (e) => {
      if (e.target.closest('[data-novo]')) return M.novoCliente();
      const pa = e.target.closest('[data-pasta]'); if (pa) { e.stopPropagation(); return M.abrirPastaCliente(M.client(pa.dataset.pasta)); }
      if (e.target.closest('a')) return;
      const c = e.target.closest('[data-cli]'); if (c) M.openClient(c.dataset.cli);
    };
    v.oncontextmenu = (e) => { const c = e.target.closest('[data-cli]'); if (c) M.clientMenu(e, M.client(c.dataset.cli)); };
    let drag = null;
    v.ondragstart = (e) => { const c = e.target.closest('[data-cli]'); if (c) { drag = c.dataset.cli; e.dataTransfer.setData('text/x-myloot', drag); } };
    v.ondragover = (e) => { const col = e.target.closest('.col'); if (col && drag) { e.preventDefault(); $$('.col.over').forEach((x) => x.classList.remove('over')); col.classList.add('over'); } };
    v.ondrop = (e) => {
      const col = e.target.closest('.col'); if (!col || !drag) return; e.preventDefault();
      const c = M.client(drag); drag = null;
      if (c && c.status !== col.dataset.col) { c.status = col.dataset.col; c.updated = Date.now(); M.save(); SFX.play('drop'); M.toast(`${cst(c.status).em} ${c.nome}: ${cst(c.status).name}`); }
      M.render();
    };
    v.ondragend = () => { drag = null; };
  };

  let novoAberto = null; // cliente recém-criado com a ficha ainda aberta (mostra "Descartar")
  M.novoCliente = (o) => {
    const t = Date.now();
    const c = Object.assign({ id: M.uid(), nome: '', empresa: '', status: 'ativo', email: '', whats: '', insta: '', site: '', trello: '', pasta: '', notas: '', tags: [], created: t, updated: t, _novo: true }, o);
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
      '-', { sub: 'Mudar status' }, ...M.CST.filter((s) => s.id !== c.status).map((s) => ({ em: s.em, t: s.name, fn: () => { c.status = s.id; c.updated = Date.now(); M.save(); M.render(); } })),
      '-', { em: '🗑️', t: 'Mandar para a lixeira', fn: () => M.trashClient(c) },
    ]);
  };
  async function enviarTrello(c) {
    try { const r = await M.api('/api/int/trello/enviar', { method: 'POST', body: JSON.stringify({ cliente: c.id }) }); SFX.play('done'); M.toast('📤 Cliente enviado para o Trello'); if (r.url) open(r.url, '_blank', 'noopener'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }
  M.trashClient = (c) => {
    M.db.clients = M.db.clients.filter((x) => x.id !== c.id);
    M.db.trash.unshift({ kind: 'client', data: c, at: Date.now() });
    M.save(); SFX.play('trash'); M.toast('🗑️ Cliente para a lixeira', () => M.restoreFromTrash(c.id, true)); M.render();
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
    const campo = (k, lbl, ph, tipo) => `<div class="fld"><label>${lbl}</label><input type="${tipo || 'text'}" data-k="${k}" value="${esc(c[k])}" placeholder="${ph}"></div>`;
    function draw() {
      const s = cst(c.status);
      const ts = M.db.tasks.filter((t) => t.client === c.id).sort((a, b) => a.done - b.done || (a.date || '9').localeCompare(b.date || '9'));
      const its = M.db.items.filter((i) => i.client === c.id).sort((a, b) => b.updated - a.updated);
      const soltos = M.db.items.filter((i) => !i.client && !i.modelo);
      m.innerHTML = `
        <div class="modal-h" style="border-bottom-color:${s.color}"><span class="av" style="background:${corDe(c.nome)}">${esc(iniciais(c.nome))}</span><h2>${esc(c.nome || 'Novo cliente')}</h2>
          <button class="icon-btn" id="cDel" title="Lixeira">🗑️</button><button class="icon-btn" id="cX" title="Fechar (Esc)">✕</button></div>
        <div class="modal-b">
          <input class="title-in" id="cNome" type="text" placeholder="Nome do cliente" value="${esc(c.nome)}">
          <div class="types" id="cSt">${M.CST.map((x) => `<div class="slot ${x.id === c.status ? 'on' : ''}" data-s="${x.id}" style="--c:${x.color}">${x.em} ${x.name}</div>`).join('')}</div>
          ${M.cliLinks(c).length ? `<div class="cli-bar big">${botoes(c)}</div>` : ''}
          <div class="row">${campo('empresa', 'Empresa / marca', 'Ex: Padaria do João')}${campo('whats', 'WhatsApp', '(11) 99999-9999', 'tel')}</div>
          <div class="row">${campo('email', 'E-mail', 'nome@email.com', 'email')}${campo('insta', 'Instagram', '@perfil')}</div>
          <div class="row">${campo('site', 'Site', 'site.com.br')}${campo('trello', 'Quadro do Trello', 'Cole o link do quadro')}</div>
          <div class="fld"><label>Pasta do cliente ${M.hint('Caminho da pasta no computador (ex.: D:\\Clientes\\João) ou link do Google Drive. O botão 📁 abre direto.')}</label><input type="text" data-k="pasta" value="${esc(c.pasta)}" placeholder="${M.sistema === 'win32' ? 'D:\\Clientes\\Nome' : '/Users/voce/Clientes/Nome'} ou link do Drive"></div>
          <div class="fld"><label>Etiquetas</label><input type="text" id="cTags" value="${esc(c.tags.join(', '))}" placeholder="social media, mensal…"></div>
          <div class="fld"><label>Anotações${M.micBtn('[data-k=notas]')}</label><textarea data-k="notas" style="font-family:var(--f);min-height:80px" placeholder="Briefing, combinados, valores, preferências…">${esc(c.notas)}</textarea></div>
          <div class="fld"><label>✅ Tarefas do cliente</label>
            ${ts.map(M.taskHTML).join('') || '<small style="color:var(--faint)">Nenhuma tarefa ainda.</small>'}
            <div class="row" style="margin-top:8px;align-items:center"><input type="text" id="cTk" placeholder="Nova tarefa… (ex.: Postar carrossel amanhã)" style="flex:3">${M.micBtn('#cTk')}<button class="btn" id="cTkGo" style="flex:none">＋ Adicionar</button></div></div>
          <div class="fld"><label>📦 Itens do cliente ${M.hint('Briefings, roteiros, prompts, arquivos e links deste cliente. Crie aqui ou ligue um item que já existe.')}</label>
            ${its.map((it) => `<div class="rowi" data-it="${it.id}" style="--c:${M.type(it.type).color}"><span class="ic">${M.type(it.type).em}</span><b>${esc(it.title || 'Sem título')}</b><button class="xbtn" data-solta="${it.id}" title="Desligar do cliente">✕</button></div>`).join('') || '<small style="color:var(--faint)">Nenhum item ligado.</small>'}
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
      $('#svOk', m).onclick = () => { if (!c.nome.trim()) return M.falta($('#cNome', m), '✍️ Dê um nome ao cliente primeiro'); const novo = novoAberto === c.id; novoAberto = null; delete c._novo; M.rasc.salvar(c); M.save(); M.closeModal(); M.toast(novo ? '✅ Cliente cadastrado' : '✅ Cliente salvo'); };
      if ($('#svRev', m)) $('#svRev', m).onclick = () => { M.rasc.reverter(c); base = M.rasc.foto(c); M.save(); SFX.play('undo'); draw(); M.toast('↩ Alterações descartadas: voltou a versão salva'); };
      if ($('#svNo', m)) $('#svNo', m).onclick = () => { M.db.clients = M.db.clients.filter((x) => x !== c); novoAberto = null; M.save(); M.closeModal(); M.toast('Cadastro descartado'); };
      $('#cDel', m).onclick = () => { M.closeModal(); if (c.nome.trim()) M.trashClient(c); };
      $('#cNome', m).oninput = (e) => { c.nome = e.target.value; touch(); $('.modal-h h2', m).textContent = c.nome || 'Novo cliente'; };
      $('#cNome', m).onchange = () => draw();
      m.querySelectorAll('[data-k]').forEach((el) => { el.oninput = () => { c[el.dataset.k] = el.value; touch(); }; el.onchange = () => { if (el.tagName === 'INPUT') draw(); }; });
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
          else if (e.target.dataset.a === 'prio') { t.prio = M.PRIOS[(M.PRIOS.indexOf(t.prio) + 1) % 3]; M.save(); draw(); }
          else M.editTask(t, () => M.openClient(c.id));
        };
      });
      m.querySelectorAll('[data-it]').forEach((r) => { r.onclick = (e) => { if (e.target.dataset.solta) return; M.openItem(r.dataset.it); }; });
      m.querySelectorAll('[data-solta]').forEach((b) => { b.onclick = () => { const it = M.db.items.find((i) => i.id === b.dataset.solta); if (it) { it.client = ''; it.updated = Date.now(); M.save(); draw(); } }; });
      $('#cItNovo', m).onclick = () => { const it = M.createItem({ title: '', client: c.id, cat: '' }, true); it._new = true; M.openItem(it.id); };
      if ($('#cItMod', m)) $('#cItMod', m).onclick = () => M.novoComModelo({ client: c.id });
      if ($('#cItLiga', m)) $('#cItLiga', m).onchange = (e) => { const it = M.db.items.find((i) => i.id === e.target.value); if (it) { it.client = c.id; it.updated = Date.now(); M.save(); SFX.play('drop'); draw(); } };
      $('#cTrello', m).onclick = () => enviarTrello(c);
      $('#cFin', m).onclick = () => M.finEditar({ tipo: 'entrada', client: c.id, desc: 'Pagamento ' + (c.nome || ''), cat: 'Serviço / cliente' });
    }
    draw();
    if (!c.nome) $('#cNome', m).focus();
  };
})();
