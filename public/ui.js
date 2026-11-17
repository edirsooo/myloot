// Componentes de interface: dica "?", chaves, avisos, janelas, menu de clique direito e busca global.
(function () {
  const { esc, $, $$ } = M;

  const IC = {
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
    clipe: '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.9-8.9a3.7 3.7 0 015.2 5.2l-8.8 8.8a1.8 1.8 0 01-2.6-2.6l8.1-8.1"/>',
    pasta: '<path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    abrir: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
    livro: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5"/><path d="M8.5 8h7M8.5 12h5"/>',
    data: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  };
  M.ic = (n, t) => `<svg class="ic" viewBox="0 0 24 24" width="${t || 16}" height="${t || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  M.hint = (t) => `<span class="hint" data-tip="${esc(t)}">?</span>`;
  M.sw = (id, on, label, tip) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="t"></span>${label ? `<span>${label}</span>` : ''}${tip ? M.hint(tip) : ''}</label>`;

  M.toast = (msg, undo) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    if (!undo) { setTimeout(() => el.remove(), 2800); return; }
    // aviso com Desfazer: fica 5 segundos, com uma barrinha mostrando o tempo; o mouse em cima segura o aviso
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = 'Desfazer';
    b.onclick = () => { el.remove(); undo(); };
    el.appendChild(b);
    let t = 0;
    const conta = () => { el.classList.remove('com-undo'); void el.offsetWidth; el.classList.add('com-undo'); clearTimeout(t); t = setTimeout(() => el.remove(), 5000); };
    el.onmouseenter = () => { clearTimeout(t); el.classList.remove('com-undo'); };
    el.onmouseleave = conta;
    conta();
  };

  // campo obrigatório vazio: avisa, balança o campo e põe o cursor nele (o botão nunca fica "mudo")
  M.falta = (el, msg) => { if (!el) return; M.toast(msg); el.classList.remove('falta'); void el.offsetWidth; el.classList.add('falta'); el.focus(); SFX.play('error'); setTimeout(() => el.classList.remove('falta'), 900); };

  // clicar em qualquer parte de um campo de data ou hora abre o calendário / relógio (não só no ícone pequeno)
  document.addEventListener('click', (e) => { const el = e.target; if (el && el.tagName === 'INPUT' && (el.type === 'date' || el.type === 'time') && el.showPicker) { try { el.showPicker(); } catch (_) {} } });

  // rodapé das fichas que salvam sozinhas (item e cliente): mostra que está salvo e dá um botão claro para concluir
  M.rodapeSalvar = (novo) => `<div class="salvar-bar"><span class="sv-st" id="svSt"></span><span style="flex:1"></span>${novo ? '<button class="btn ghost" id="svNo" style="flex:none">Descartar</button>' : '<button class="btn ghost" id="svRev" style="flex:none" hidden>↩ Descartar alterações</button>'}<button class="btn" id="svOk" style="flex:none">✔ Salvar e fechar</button></div>`;
  M.rodapePinta = (m, o, novo) => {
    const st = m && $('#svSt', m); if (!st) return;
    const p = !novo && M.rasc.pendente(o);
    st.textContent = novo ? '🆕 Ficha nova: clique em Salvar para concluir' : p ? '📝 Alterações ainda não salvas (ficam guardadas como rascunho)' : '✔ Tudo salvo';
    st.parentElement.classList.toggle('pend', !!p);
    const r = $('#svRev', m); if (r) r.hidden = !p;
  };

  // ----- rascunho das fichas (item e cliente), no estilo do Trello -----
  // O que a pessoa muda numa ficha que já existia fica como rascunho até ela clicar em "Salvar".
  // Fechar sem salvar deixa o cartão com a versão antiga e guarda o rascunho; ao reabrir, ele volta para ela decidir.
  // Enquanto a ficha está aberta: os campos têm a versão em edição e `_salvo` guarda a versão salva.
  // Com a ficha fechada: os campos têm a versão salva e `rascunho` guarda a versão em edição.
  const FORA = ['_salvo', 'rascunho', '_new', '_novo', '_xp', 'updated', 'id'];
  // chaves em ordem alfabética: a comparação não depende da ordem em que os campos foram criados
  const foto = (o) => { const c = {}; for (const k of Object.keys(o).sort()) if (!FORA.includes(k)) c[k] = o[k]; return JSON.stringify(c); };
  const aplica = (o, json) => { const d = JSON.parse(json); for (const k of Object.keys(o)) if (!FORA.includes(k) && !(k in d)) delete o[k]; Object.assign(o, d); };
  M.rasc = {
    foto,
    abrir(o) { if (o.rascunho) { const r = o.rascunho; delete o.rascunho; if (!o._salvo) o._salvo = foto(o); try { aplica(o, r); } catch (_) {} } return foto(o); },
    tocar(o, base) { if (!o._salvo) o._salvo = base; },
    pendente: (o) => !!o._salvo && o._salvo !== foto(o),
    salvar(o) { delete o._salvo; delete o.rascunho; },
    reverter(o) { if (o._salvo) { try { aplica(o, o._salvo); } catch (_) {} } delete o._salvo; delete o.rascunho; },
    guardar(o) {
      if (M.rasc.pendente(o)) { const r = foto(o); try { aplica(o, o._salvo); } catch (_) {} o.rascunho = r; delete o._salvo; return true; }
      delete o._salvo; return false;
    },
    // ficha que ficou "em edição" sem janela (aba fechada no meio, queda de energia): vira rascunho.
    // Espera 2 minutos sem mexer, para não atrapalhar quem está editando a mesma ficha em outro aparelho.
    arruma() {
      if (!M.db) return;
      let mudou = false;
      const aberto = (o) => (M.cur && M.cur.id === o.id) || M.cliAberto === o.id;
      for (const o of [...M.db.items, ...(M.db.clients || [])]) if (o._salvo && !aberto(o) && Date.now() - (o.updated || 0) > 120000) { M.rasc.guardar(o); mudou = true; }
      if (mudou) M.save();
    },
  };

  // ----- janelas -----
  let onClose = null;
  M.modal = (html, opt) => {
    opt = opt || {};
    const ov = $('#overlay');
    document.body.classList.remove('menu'); // no celular o menu lateral fica por cima das janelas: fecha antes de abrir qualquer uma
    ov.innerHTML = `<div class="modal ${opt.small ? 'sm' : ''}">${html}</div>`;
    ov.classList.add('on');
    ov.onmousedown = (e) => { if (e.target === ov) M.fecharPeloUsuario(); };
    onClose = opt.onClose || null;
    sujo = false;
    return ov.firstElementChild;
  };
  // ----- não perder o que foi digitado -----
  // Fichas de item e de cliente guardam rascunho sozinhas. As janelas pequenas com botão de salvar (tarefa, lançamento, hábito, meta)
  // não têm rascunho: se a pessoa mudou algo e tenta sair pelo ✕, Esc ou clicando fora, a janela pergunta antes de fechar.
  let sujo = false;
  const temSalvar = (m) => !m.querySelector('#eX,#cX') && [...m.querySelectorAll('button')].some((b) => /Salvar|Lançar|Adicionar/.test(b.textContent));
  const marca = (e) => { const m = e.target.closest && e.target.closest('#overlay.on .modal'); if (m && e.target.matches('input,textarea,select') && e.target.type !== 'search' && temSalvar(m)) sujo = true; };
  document.addEventListener('input', marca, true); document.addEventListener('change', marca, true);
  const avisaSujo = (m) => {
    if (m.querySelector('.sair-aviso')) return M.falta(m.querySelector('.sair-aviso'), '✍️ Salve ou escolha “Sair sem salvar”');
    const d = document.createElement('div'); d.className = 'sair-aviso';
    d.innerHTML = '<span>✍️ Você mudou algo aqui e ainda não salvou.</span><span class="sa-b"><button type="button" class="btn ghost sm" data-sa="fica">Continuar editando</button><button type="button" class="btn danger sm" data-sa="sai">Sair sem salvar</button></span>';
    m.prepend(d); d.scrollIntoView({ block: 'nearest' });
    d.onclick = (e) => { const a = e.target.dataset.sa; if (a === 'fica') d.remove(); if (a === 'sai') { sujo = false; const x = m.querySelector('.modal-h #x'); if (x) x.click(); else M.closeModal(); } };
  };
  M.fecharPeloUsuario = () => { const m = $('#overlay.on .modal'); if (m && sujo && temSalvar(m)) return avisaSujo(m); const x = m && m.querySelector('.modal-h #x,.modal-h #eX,.modal-h #cX'); if (x) x.click(); else M.closeModal(); };
  document.addEventListener('click', (e) => { const x = e.target.closest && e.target.closest('#overlay.on .modal-h #x'); if (!x || !sujo) return; const m = x.closest('.modal'); if (!temSalvar(m)) return; e.stopPropagation(); e.preventDefault(); avisaSujo(m); }, true);
  M.closeModal = () => {
    const ov = $('#overlay');
    if (!ov.classList.contains('on')) return;
    ov.classList.remove('on'); ov.innerHTML = ''; sujo = false;
    const f = onClose; onClose = null;
    if (f) f();
    // janela aberta de dentro da ficha de um cliente (tarefa, lançamento, modelos, confirmação): ao fechar de qualquer jeito
    // (✕, Esc ou clique fora), volta para a ficha em vez de sumir com ela
    setTimeout(() => { if (!M.modalOpen() && M.cliAberto && M.client && M.client(M.cliAberto)) M.openClient(M.cliAberto); }, 0);
  };
  M.modalOpen = () => $('#overlay').classList.contains('on');
  M.confirm = (msg, okLabel) => new Promise((res) => {
    const m = M.modal(`<div class="modal-b"><div style="font-size:15px">${esc(msg)}</div><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="cn" style="flex:none">Cancelar</button><button class="btn danger" id="cy" style="flex:none">${esc(okLabel || 'Confirmar')}</button></div></div>`, { small: true });
    $('#cn', m).onclick = () => { M.closeModal(); res(false); };
    $('#cy', m).onclick = () => { M.closeModal(); res(true); };
  });

  // ----- menu de clique direito -----
  M.ctxMenu = (e, entries) => {
    e.preventDefault();
    const c = $('#ctx');
    c.innerHTML = '';
    entries.forEach((en) => {
      if (en === '-') { c.appendChild(document.createElement('hr')); return; }
      if (en.sub) { const s = document.createElement('div'); s.className = 'sub'; s.textContent = en.sub; c.appendChild(s); return; }
      const b = document.createElement('button');
      b.innerHTML = `<span>${en.em || ''}</span><span>${esc(en.t)}</span>`;
      b.onclick = () => { c.hidden = true; en.fn(); };
      c.appendChild(b);
    });
    c.hidden = false;
    const r = c.getBoundingClientRect();
    c.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
    c.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
  };
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#ctx')) $('#ctx').hidden = true; });
  document.addEventListener('scroll', () => { $('#ctx').hidden = true; }, true);

  // ----- busca global (Ctrl+K ou /) -----
  M.openSearch = () => {
    const m = M.modal(`<div class="pal"><input id="gq" type="search" placeholder="Buscar ou dar um comando…" autocomplete="off"><div class="res" id="gres"></div></div>`);
    m.style.cssText = 'background:none;border:0;box-shadow:none;width:min(620px,100%)';
    const input = $('#gq', m), res = $('#gres', m);
    let list = [], sel = 0;
    const hi = (s, q) => { const t = esc(s); if (!q) return t; const i = M.norm(s).indexOf(q); return i < 0 ? t : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length)); };
    const CMDS = [
      ['＋', 'Novo item', 'N', () => { M.ui.page = 'lib'; M.render(); M.newItemDialog(); }],
      ['🏠', 'Ir para Início', 'H', () => M.go('home')],
      ['📦', 'Ir para Biblioteca', 'B', () => M.go('lib')],
      ['✅', 'Ir para Tarefas', 'T', () => M.go('tasks')],
      ['🎯', 'Ir para Rotina (hábitos e metas)', 'R', () => M.go('rot')],
      ['🗓️', 'Ir para Calendário', 'C', () => M.go('cal')],
      ['👥', 'Ir para Clientes', 'L', () => M.go('clients')],
      ['💰', 'Ir para Financeiro', 'M', () => M.go('fin')],
      ['➕', 'Lançar entrada ou saída', '', () => { M.go('fin'); M.finEditar({ tipo: 'entrada' }); }],
      ['🧮', 'Calcular preço (valor da hora)', '', () => M.calcPreco()],
      ['👤', 'Novo cliente', '', () => { M.go('clients'); M.novoCliente(); }],
      ['🧰', 'Ir para Ferramentas', '', () => M.go('tools')],
      ['🏆', 'Ver Conquistas', '', () => M.go('ach')],
      ['⚙️', 'Abrir Configurações', '', () => M.go('cfg')],
      ['⏱', 'Começar ou parar o foco', 'F', () => M.focusToggle()],
      ['🌗', 'Trocar tema claro / escuro', '', () => { const s = M.db.settings; const claro = document.body.classList.contains('light'); s.themeAuto = false; s.theme = claro ? 'dark' : 'light'; M.save(); M.applySettings(); }],
    ];
    function run() {
      const q = M.norm(input.value.trim());
      list = CMDS.filter((c) => !q || M.norm(c[1]).includes(q)).map((c) => ({ kind: 'cmd', c, score: q ? 3 : 0 }));
      if (q) {
        M.db.items.forEach((it) => {
          let where = '';
          if (M.norm(it.title).includes(q)) where = 'título';
          else if (M.norm(it.tags.join(' ')).includes(q)) where = 'etiqueta';
          else if (M.norm(it.attachments.map((a) => a.name).join(' ')).includes(q)) where = 'anexo';
          else if (M.norm(it.desc + ' ' + it.content + ' ' + it.checklist.map((c) => c.t).join(' ') + ' ' + it.links.map((l) => l.url + l.label).join(' ')).includes(q)) where = 'texto';
          if (where) list.push({ kind: 'item', it, where, score: where === 'título' ? 0 : 1 });
        });
        M.db.tasks.forEach((t) => { if (M.norm(t.text).includes(q)) list.push({ kind: 'task', t, where: 'tarefa', score: 2 }); });
        (M.db.clients || []).forEach((c) => { if (M.norm([c.nome, c.empresa, c.email, c.insta].join(' ')).includes(q)) list.push({ kind: 'cli', c, score: 0.5 }); });
        list.sort((a, b) => a.score - b.score);
        list = list.slice(0, 40);
      }
      sel = 0; draw(q);
    }
    function draw(q) {
      if (!list.length) { res.innerHTML = '<div class="empty" style="padding:26px">Nada encontrado 🕳️</div>'; return; }
      res.innerHTML = (q ? '' : '<div class="sub">Comandos · digite para buscar em tudo</div>') + list.map((r, i) => r.kind === 'cmd'
        ? `<div class="r ${i === sel ? 'on' : ''}" data-i="${i}"><span>${r.c[0]}</span><span>${hi(r.c[1], q)}</span>${r.c[2] ? `<kbd>${r.c[2]}</kbd>` : '<small>comando</small>'}</div>`
        : r.kind === 'item'
        ? `<div class="r ${i === sel ? 'on' : ''}" data-i="${i}"><span>${M.type(r.it.type).em}</span><span>${hi(r.it.title || 'Sem título', q)}</span><small>${r.where}</small></div>`
        : r.kind === 'cli'
        ? `<div class="r ${i === sel ? 'on' : ''}" data-i="${i}"><span>👤</span><span>${hi(r.c.nome || 'Sem nome', q)}${r.c.empresa ? ' · ' + esc(r.c.empresa) : ''}</span><small>cliente</small></div>`
        : `<div class="r ${i === sel ? 'on' : ''}" data-i="${i}"><span>${r.t.done ? '✅' : '☐'}</span><span>${hi(r.t.text, q)}</span><small>tarefa</small></div>`).join('');
    }
    function go(i) {
      const r = list[i]; if (!r) return;
      M.closeModal();
      if (r.kind === 'cmd') r.c[3](); else if (r.kind === 'item') M.openItem(r.it.id); else if (r.kind === 'cli') { M.go('clients'); M.openClient(r.c.id); } else M.go('tasks');
    }
    input.oninput = run;
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); draw(M.norm(input.value.trim())); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(M.norm(input.value.trim())); e.preventDefault(); }
      else if (e.key === 'Enter') go(sel);
      const on = $('.r.on', res); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    res.onclick = (e) => { const r = e.target.closest('.r'); if (r) go(+r.dataset.i); };
    run(); input.focus();
  };
})();
