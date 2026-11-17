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
    if (undo) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Desfazer';
      b.onclick = () => { undo(); el.remove(); };
      el.appendChild(b);
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), undo ? 6500 : 2800);
  };

  // ----- janelas -----
  let onClose = null;
  M.modal = (html, opt) => {
    opt = opt || {};
    const ov = $('#overlay');
    ov.innerHTML = `<div class="modal ${opt.small ? 'sm' : ''}">${html}</div>`;
    ov.classList.add('on');
    ov.onmousedown = (e) => { if (e.target === ov) M.closeModal(); };
    onClose = opt.onClose || null;
    return ov.firstElementChild;
  };
  M.closeModal = () => {
    const ov = $('#overlay');
    if (!ov.classList.contains('on')) return;
    ov.classList.remove('on'); ov.innerHTML = '';
    const f = onClose; onClose = null;
    if (f) f();
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
