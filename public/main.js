// Início: navegação, atalhos e arrastar arquivos.
(function () {
  const { esc, $, $$ } = M;
  const PAGES = [
    ['home', '🏠', 'Início'], ['lib', '📦', 'Biblioteca'], ['tasks', '✅', 'Tarefas'], ['rot', '🎯', 'Rotina'], ['cal', '🗓️', 'Calendário'], ['clients', '👥', 'Clientes'], ['fin', '💰', 'Financeiro'], ['tools', '🧰', 'Ferramentas'],
    ['ach', '🏆', 'Conquistas'], ['trash', '🗑️', 'Lixeira'], ['cfg', '⚙️', 'Configurações'],
  ];

  M.applySettings = () => {
    const s = M.db.settings;
    const claro = s.themeAuto ? matchMedia('(prefers-color-scheme: light)').matches : s.theme === 'light';
    document.body.classList.toggle('light', claro);
    document.documentElement.style.zoom = [0.9, 1, 1.1, 1.25].includes(+s.fontScale) ? s.fontScale : 1;
    document.body.classList.toggle('compact', !!s.compact);
    SFX.on = !!s.sounds; FX.confetti = !!s.confetti;
    M.renderHud();
  };

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (M.db && M.db.settings.themeAuto) M.applySettings(); });
  // ----- trocar de tela, com voltar e avançar (botões do topo, do navegador e Alt + setas) -----
  let hN = 0, hMax = 0; // posição atual e última posição do histórico desta aba
  const pintaNav = () => { const v = $('#navVolta'), a = $('#navAvanca'); if (v) v.disabled = hN <= 0; if (a) a.disabled = hN >= hMax; };
  const fichaAberta = () => ({ cli: M.cliAberto || null, item: M.cur ? M.cur.id : null });
  const trocar = (p) => {
    // ficha aberta fica como estava (rascunho, se mudou) e sai da frente da tela nova
    if (M.modalOpen()) { M.cliAberto = null; M.closeModal(); }
    M.ui.page = p; document.body.classList.remove('menu'); M.render(); pintaNav();
  };
  M.go = (p) => {
    if (!M.pages[p]) return;
    if (p !== M.ui.page) {
      // guarda na tela de onde saiu qual ficha estava aberta: ao voltar, ela reabre
      try { history.replaceState(Object.assign({ p: M.ui.page, n: hN }, fichaAberta()), ''); history.pushState({ p, n: ++hN }, '', '#' + p); hMax = hN; } catch (_) {}
    }
    trocar(p);
  };
  addEventListener('popstate', (e) => {
    const s = e.state || {}, p = s.p || location.hash.slice(1);
    if (!M.db || !M.pages[p]) return;
    hN = s.n || 0; if (hN > hMax) hMax = hN;
    trocar(p);
    if (s.cli && M.client && M.client(s.cli)) M.openClient(s.cli);
    else if (s.item && M.db.items.some((i) => i.id === s.item)) M.openItem(s.item);
  });
  $('#navVolta').onclick = () => history.back();
  $('#navAvanca').onclick = () => history.forward();

  M.render = () => {
    const p = M.ui.page, v = $('#view');
    if (!M.modalOpen()) M.rasc.arruma();
    ['onclick', 'onkeydown', 'oncontextmenu', 'ondragstart', 'ondragover', 'ondrop', 'ondragend'].forEach((k) => { v[k] = null; });
    const GRUPO = { lib: 'Organização', clients: 'Gestão', tools: 'Extras', cfg: 'Sistema' }; // o título entra antes da primeira tela de cada grupo
    $('#nav').innerHTML = PAGES.map(([id, em, n]) => {
      const c = id === 'tasks' ? M.db.tasks.filter((t) => !t.done).length : id === 'lib' ? M.db.items.length : id === 'trash' ? M.db.trash.length : id === 'clients' ? (M.db.clients || []).length : '';
      return `${GRUPO[id] ? `<div class="nav-g">${GRUPO[id]}</div>` : ''}<button class="nav-i ${p === id ? 'on' : ''}" data-p="${id}"><span class="em">${em}</span>${n}<span class="cnt">${c || ''}</span></button>`;
    }).join('');
    $('#pageTitle').textContent = (PAGES.find((x) => x[0] === p) || [])[2] || '';
    const top = v.scrollTop;
    M.pages[p]();
    v.scrollTop = top;
    M.renderHud();
    if (M.onRender) M.onRender(p);
  };

  $('#nav').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { SFX.play('click'); M.go(b.dataset.p); } };
  $('#btnNew').onclick = () => { document.body.classList.remove('menu'); M.novoComModelo(); };
  $('#btnSearch').onclick = M.openSearch;
  $('#btnVoz').onclick = () => M.voz();
  $('#btnBug').onclick = () => M.reportar();
  $('#btnUpd').onclick = () => { document.body.classList.remove('menu'); M.checarAtualizacao(true); };
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu');
  $('#main').addEventListener('click', () => document.body.classList.remove('menu'));

  // atalhos
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (M.modalOpen()) M.closeModal(); M.openSearch(); return; }
    if (e.key === 'Escape') { if (!$('#levelup').hidden) $('#levelup').hidden = true; else if (M.modalOpen()) M.fecharPeloUsuario(); $('#ctx').hidden = true; return; }
    if (typing || e.ctrlKey || e.altKey || e.metaKey || M.modalOpen()) return;
    if (e.key === '/') { e.preventDefault(); M.openSearch(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); M.novoComModelo(); }
    else if (e.key.toLowerCase() === 'v') { e.preventDefault(); M.voz(); }
    else if (e.key.toLowerCase() === 'l') M.go('clients');
    else if (e.key.toLowerCase() === 'm') M.go('fin');
    else if (e.key.toLowerCase() === 'h') M.go('home');
    else if (e.key.toLowerCase() === 'c') M.go('cal');
    else if (e.key.toLowerCase() === 'f') M.focusToggle();
    else if (e.key.toLowerCase() === 't') M.go('tasks');
    else if (e.key.toLowerCase() === 'r') M.go('rot');
    else if (e.key.toLowerCase() === 'b') M.go('lib');
  });

  // arrastar arquivo para qualquer lugar da janela
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; $('#dropHint').hidden = false; } });
  addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; $('#dropHint').hidden = true; } });
  addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; $('#dropHint').hidden = true;
    const files = [...e.dataTransfer.files]; if (!files.length) return;
    if (M.cur) { const it = M.cur; M.attachFiles(it, files, () => M.openItem(it.id)); }
    else { M.ui.page = 'lib'; M.itemFromFiles(files); }
  });

  // iniciar
  (async () => {
    try { await M.load(); } catch (e) { document.body.innerHTML = '<p style="padding:30px;font:16px monospace">Não consegui falar com o servidor. Abra pelo atalho do MyLoot.</p>'; return; }
    await M.iniciarCelular();
    M.applySettings();
    // endereço direto: #lib, #tasks, #cal, #ach, #cfg ou #item=ID
    const hash = location.hash.slice(1);
    if (M.pages[hash]) M.ui.page = hash;
    try { history.replaceState({ p: M.ui.page, n: 0 }, ''); } catch (_) {}
    M.render();
    if (hash.startsWith('item=')) M.openItem(hash.slice(5));
    M.focusPaint();
    // ordem da abertura: 1) novidades da versão, 2) pop-up das IAs, 3) tutorial (só com tudo fechado)
    M.inicioPronto = false;
    const liberaTutorial = () => { M.inicioPronto = true; M.tourTalvez(M.ui.page); };
    if (!M.remoto) {
      const temNovidade = await M.mostrarNovidades();
      // com novidade na tela, o pop-up das IAs abre quando ela fechar (onClose em atualiza.js)
      if (!temNovidade && !M.db.settings.aiSetupDone) setTimeout(() => { if (!M.modalOpen()) M.iaSetup(); }, 1200);
      setTimeout(() => M.checarAtualizacao(false), 5000);
      setTimeout(() => M.vozFila(), 6000); // áudios que chegaram do celular com o PC fechado
    }
    setTimeout(liberaTutorial, 1800);
  })();
})();
