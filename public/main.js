// Início: navegação, atalhos e arrastar arquivos.
(function () {
  const { esc, $, $$ } = M;
  const PAGES = [
    ['home', '🏠', 'Início'], ['lib', '📦', 'Biblioteca'], ['tasks', '✅', 'Tarefas'], ['rot', '🎯', 'Rotina'], ['cal', '🗓️', 'Calendário'], ['clients', '👥', 'Clientes'], ['fin', '💰', 'Financeiro'], ['trello', '📋', 'Trello'], ['tools', '🧰', 'Ferramentas'],
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
    if (M.pet) M.pet.aplica();
  };

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (M.db && M.db.settings.themeAuto) M.applySettings(); });
  // ----- trocar de tela, com voltar e avançar (botões do topo, do navegador e Alt + setas) -----
  let hN = 0, hMax = 0; // posição atual e última posição do histórico desta aba
  // o voltar só apaga no Início sem tela anterior (no celular ele some); fora do Início ele sempre leva a algum lugar
  const pintaNav = () => { const v = $('#navVolta'), a = $('#navAvanca'); if (v) v.disabled = hN <= 0 && (!M.ui || M.ui.page === 'home'); if (a) a.disabled = hN >= hMax; };
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
  // abriu direto numa tela (sem anterior nesta aba): o voltar leva ao Início, sem criar histórico
  $('#navVolta').onclick = () => {
    if (hN > 0) return history.back();
    if (M.ui.page === 'home') return;
    try { history.replaceState({ p: 'home', n: 0 }, '', '#home'); } catch (_) {}
    trocar('home');
  };
  // contorno de foco só para quem navega pelo teclado: depois de um toque ou clique ele não fica preso na tela
  addEventListener('pointerdown', () => document.documentElement.classList.add('toque'), true);
  addEventListener('keydown', (e) => { if (e.key === 'Tab') document.documentElement.classList.remove('toque'); }, true);
  $('#navAvanca').onclick = () => history.forward();

  M.render = () => {
    const p = M.ui.page, v = $('#view');
    if (!M.modalOpen()) M.rasc.arruma();
    ['onclick', 'onkeydown', 'oncontextmenu', 'ondragstart', 'ondragover', 'ondrop', 'ondragend'].forEach((k) => { v[k] = null; });
    // ordem e telas escondidas do menu são da pessoa (settings.navOrdem, settings.navOculto); com ordem própria, os títulos de grupo saem
    const s = M.db.settings, proprio = Array.isArray(s.navOrdem) && s.navOrdem.length;
    const GRUPO = proprio ? {} : { lib: 'Organização', clients: 'Gestão', tools: 'Extras', cfg: 'Sistema' }; // o título entra antes da primeira tela de cada grupo
    $('#nav').innerHTML = M.paginasMenu().filter(([id]) => !(s.navOculto || []).includes(id) || id === p).map(([id, em, n]) => {
      const c = id === 'tasks' ? M.db.tasks.filter(M.tarefaPendente).length : id === 'lib' ? M.db.items.length : id === 'trash' ? M.db.trash.length : id === 'clients' ? (M.db.clients || []).length : '';
      return `${GRUPO[id] ? `<div class="nav-g">${GRUPO[id]}</div>` : ''}<button class="nav-i ${p === id ? 'on' : ''}" data-p="${id}"><span class="em">${em}</span>${n}<span class="cnt">${c || ''}</span></button>`;
    }).join('');
    $('#pageTitle').textContent = (PAGES.find((x) => x[0] === p) || [])[2] || '';
    const top = v.scrollTop;
    M.pages[p]();
    v.scrollTop = top;
    M.renderHud();
    if (M.onRender) M.onRender(p);
  };

  // menu na ordem da pessoa: telas que ela nunca moveu ficam no lugar de sempre (inclusive telas novas de versões futuras)
  M.PAGINAS = PAGES;
  M.paginasMenu = () => {
    const o = Array.isArray(M.db.settings.navOrdem) ? M.db.settings.navOrdem : [];
    const pos = (id) => { const i = o.indexOf(id); return i < 0 ? 1000 + PAGES.findIndex((x) => x[0] === id) : i; };
    return PAGES.slice().sort((a, b) => pos(a[0]) - pos(b[0]));
  };
  const FIXAS = ['home', 'cfg']; // sempre no menu (sem elas a pessoa não volta para arrumar)
  M.BN_PAD = ['home', 'lib', 'tasks'];
  M.menuEditar = () => {
    const s = M.db.settings;
    let ordem = M.paginasMenu().map((x) => x[0]), oc = (s.navOculto || []).slice(), bn = (Array.isArray(s.bnav) && s.bnav.length === 3 ? s.bnav : M.BN_PAD).slice();
    const nome = (id) => { const x = PAGES.find((p) => p[0] === id); return x ? x[1] + ' ' + x[2] : id; };
    const m = M.modal(`<div class="modal-h"><h2>🧭 Menu e barra do celular</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b"><p class="opc-dica">Mude a ordem das telas no menu e esconda as que não usa. Início e Configurações ficam sempre. A tela escondida continua funcionando (pela busca, Ctrl+K).</p>
        <div class="opc-lista" id="mnL"></div>
        <h4 class="opc-h">📱 Barra de baixo do celular</h4><p class="opc-dica">Os 3 atalhos ao lado do ＋ (o ☰ Mais continua no fim).</p>
        <div class="row">${[0, 1, 2].map((i) => `<div class="fld"><label for="bn${i}">${['Primeiro', 'Segundo', 'Terceiro'][i]}</label><select id="bn${i}">${PAGES.filter((x) => x[0] !== 'cfg').map(([id]) => `<option value="${id}" ${bn[i] === id ? 'selected' : ''}>${esc(nome(id))}</option>`).join('')}</select></div>`).join('')}</div>
        <div class="row" style="justify-content:space-between"><button class="btn ghost sm" id="mnPad" style="flex:none">↺ Voltar ao padrão</button><button class="btn" id="mnOk" style="flex:none">✔ Salvar</button></div></div>`, { small: true });
    const pinta = () => {
      $('#mnL', m).innerHTML = ordem.map((id, i) => `<div class="opc-row" data-o="${id}"><span class="opc-nm" style="${oc.includes(id) ? 'opacity:.45;text-decoration:line-through' : ''}">${esc(nome(id))}</span>
        <button type="button" class="icon-btn sm" data-a="up" ${i ? '' : 'disabled'} aria-label="Subir ${esc(nome(id))}">↑</button><button type="button" class="icon-btn sm" data-a="down" ${i < ordem.length - 1 ? '' : 'disabled'} aria-label="Descer ${esc(nome(id))}">↓</button>
        ${FIXAS.includes(id) ? '<span class="mn-fixa" title="Fica sempre no menu">📌</span>' : `<button type="button" class="icon-btn sm" data-a="ver" title="${oc.includes(id) ? 'Mostrar no menu' : 'Esconder do menu'}" aria-label="${oc.includes(id) ? 'Mostrar' : 'Esconder'} ${esc(nome(id))}">${oc.includes(id) ? '👁' : '🙈'}</button>`}</div>`).join('');
    };
    pinta();
    $('#mnL', m).onclick = (e) => {
      const b = e.target.closest('[data-a]'), r = e.target.closest('[data-o]'); if (!b || !r) return;
      const id = r.dataset.o, i = ordem.indexOf(id);
      if (b.dataset.a === 'ver') oc = oc.includes(id) ? oc.filter((x) => x !== id) : oc.concat(id);
      else { const j = i + (b.dataset.a === 'up' ? -1 : 1); if (j < 0 || j >= ordem.length) return; [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
      SFX.play('click'); pinta(); $('#mnL', m).dispatchEvent(new Event('change', { bubbles: true }));
      const f = $(`#mnL [data-o="${id}"] [data-a="${b.dataset.a}"]`, m); if (f && !f.disabled) f.focus();
    };
    $('#x', m).onclick = M.closeModal;
    $('#mnPad', m).onclick = () => { delete s.navOrdem; delete s.navOculto; delete s.bnav; M.save(); M.closeModal(); SFX.play('undo'); M.toast('↺ Menu no padrão'); M.render(); };
    $('#mnOk', m).onclick = () => {
      s.navOrdem = ordem; s.navOculto = oc.filter((x) => !FIXAS.includes(x)); s.bnav = [0, 1, 2].map((i) => $('#bn' + i, m).value);
      M.save(); M.closeModal(); SFX.play('done'); M.toast('🧭 Menu salvo'); M.render();
    };
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (M.modalOpen()) { M.fecharPeloUsuario(); if (M.modalOpen()) return; } M.openSearch(); return; } // janela com mudança não salva pergunta antes
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
    M.render(); pintaNav();
    if (hash.startsWith('item=')) M.openItem(hash.slice(5));
    M.focusPaint();
    await M.recuperarNaoSalvo(); // mudanças que não chegaram a ser salvas da última vez
    // o arquivo do banco estava estragado (queda de energia, disco) e o servidor voltou para a cópia automática mais nova
    if (!M.remoto) M.api('/api/recuperado').then((r) => {
      if (!r || !r.recuperado) return;
      const mostrar = () => (M.modalOpen() ? setTimeout(mostrar, 2000) : M.escolha(`O arquivo dos seus dados estava danificado e o MyLoot voltou para a cópia automática "${r.recuperado.de}". Confira se falta algo recente. As cópias ficam em Configurações → Dados e backup, e a sincronização entre computadores fica parada até você religar.`, [{ k: 'ok', t: 'Entendi' }], '🛟 Dados recuperados'));
      mostrar();
      M.api('/api/recuperado', { method: 'POST' }).catch(() => {});
    }).catch(() => {});
    // ordem da abertura: 1) novidades da versão, 2) pop-up das IAs, 3) tutorial (só com tudo fechado)
    M.inicioPronto = false;
    const liberaTutorial = () => { M.inicioPronto = true; M.tourTalvez(M.ui.page); };
    if (!M.remoto) {
      const temNovidade = await M.mostrarNovidades();
      // com novidade na tela, o pop-up das IAs abre quando ela fechar (onClose em atualiza.js)
      // espera a abertura dos mascotes e qualquer janela fecharem (antes tentava uma vez só e, com a abertura na frente, desistia)
      if (!temNovidade && !M.db.settings.aiSetupDone) {
        const ini = Date.now();
        const tenta = () => {
          if (M.db.settings.aiSetupDone || Date.now() - ini > 120000) return;
          if (M.modalOpen() || document.querySelector('.pet-ola')) return setTimeout(tenta, 800);
          M.iaSetup();
        };
        setTimeout(tenta, 1200);
      }
      setTimeout(() => M.checarAtualizacao(false), 5000);
      setTimeout(() => M.vozFila(), 6000); // áudios que chegaram do celular com o PC fechado
    }
    setTimeout(liberaTutorial, 1800);
  })();
})();
