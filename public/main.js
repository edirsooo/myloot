// Início: navegação, atalhos e arrastar arquivos.
(function () {
  const { esc, $, $$ } = M;
  const PAGES = [
    ['home', '🏠', 'Início'], ['lib', '📦', 'Biblioteca'], ['tasks', '✅', 'Tarefas'], ['cal', '🗓️', 'Calendário'], ['tools', '🧰', 'Ferramentas'],
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
  M.go = (p) => { M.ui.page = p; document.body.classList.remove('menu'); M.render(); };

  M.render = () => {
    const p = M.ui.page, v = $('#view');
    ['onclick', 'oncontextmenu', 'ondragstart', 'ondragover', 'ondrop', 'ondragend'].forEach((k) => { v[k] = null; });
    $('#nav').innerHTML = PAGES.map(([id, em, n]) => {
      const c = id === 'tasks' ? M.db.tasks.filter((t) => !t.done).length : id === 'lib' ? M.db.items.length : id === 'trash' ? M.db.trash.length : '';
      return `<button class="nav-i ${p === id ? 'on' : ''}" data-p="${id}"><span class="em">${em}</span>${n}<span class="cnt">${c || ''}</span></button>`;
    }).join('');
    $('#pageTitle').textContent = (PAGES.find((x) => x[0] === p) || [])[2] || '';
    const top = v.scrollTop;
    M.pages[p]();
    v.scrollTop = top;
    M.renderHud();
  };

  $('#nav').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { SFX.play('click'); M.go(b.dataset.p); } };
  $('#btnNew').onclick = () => { M.ui.page = 'lib'; M.render(); M.newItemDialog(); };
  $('#btnSearch').onclick = M.openSearch;
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu');
  $('#main').addEventListener('click', () => document.body.classList.remove('menu'));

  // atalhos
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (M.modalOpen()) M.closeModal(); M.openSearch(); return; }
    if (e.key === 'Escape') { if (!$('#levelup').hidden) $('#levelup').hidden = true; else if (M.modalOpen()) M.closeModal(); $('#ctx').hidden = true; return; }
    if (typing || e.ctrlKey || e.altKey || e.metaKey || M.modalOpen()) return;
    if (e.key === '/') { e.preventDefault(); M.openSearch(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); M.ui.page = 'lib'; M.render(); M.newItemDialog(); }
    else if (e.key.toLowerCase() === 'h') M.go('home');
    else if (e.key.toLowerCase() === 'c') M.go('cal');
    else if (e.key.toLowerCase() === 'f') M.focusToggle();
    else if (e.key.toLowerCase() === 't') M.go('tasks');
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
    M.applySettings();
    // endereço direto: #lib, #tasks, #cal, #ach, #cfg ou #item=ID
    const hash = location.hash.slice(1);
    if (M.pages[hash]) M.ui.page = hash;
    M.render();
    if (hash.startsWith('item=')) M.openItem(hash.slice(5));
    M.focusPaint();
    if (!M.db.settings.aiSetupDone) setTimeout(() => { if (!M.modalOpen()) M.iaSetup(); }, 1200);
  })();
})();
