// Página do MyLoot: abas que trocam a tela, barra de XP do Slime, abas de sistema, menu do celular e a palavra de cada seção.
(function () {
  const q = (s, r) => (r || document).querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ALT = {
    inicio: 'Tela Início do MyLoot com o bloco “O que você quer guardar?” e o mapa de conexões',
    biblioteca: 'Biblioteca com cartões de prompts, notas e links, com etiquetas e filtros',
    busca: 'Busca aberta com Ctrl K mostrando resultados para “brief”',
    ficha: 'Ficha de uma nota com conteúdo, categoria, status e etiquetas',
    tarefas: 'Tela Tarefas com as colunas Hoje, Próximas e Concluídas',
    calendario: 'Calendário de novembro com compromissos e tarefas nos dias',
    rotina: 'Rotina com hábitos do dia, metas com barra de progresso e o mapa do mês',
    foco: 'Janela do Modo foco com o timer de 25 minutos',
    cliente: 'Ficha da cliente Ana Souza com status, contato e anotações',
    financeiro: 'Financeiro de novembro com saldo do mês, lançamentos e gráfico',
    ia: 'Ficha de prompt com o painel da IA para melhorar, resumir e traduzir',
    ferramentas_rec: 'Ferramentas recomendadas em cartões, com Abrir e Salvar',
    drive: 'Configuração do Google Drive para copiar a pasta do MyLoot',
    enviar: 'Menu de uma nota com Enviar para o Notion e Enviar para o Trello',
    celular: 'Usar no celular: QR Code e código de 6 números',
    conquistas: 'Tela Conquistas com XP dos últimos 7 dias e as medalhas',
    mascote: 'Configurações de Diversão com a escolha entre os seis mascotes',
    musica: 'Player de música aberto no topo do app',
    desfazer: 'Aviso de tarefa concluída com o botão Desfazer',
    historico: 'Histórico de ações com Desfazer em cada linha',
    lixeira: 'Lixeira com itens e tarefas apagados e o botão Restaurar',
    backup: 'Dados e backup: backup completo, cópias automáticas e restaurar',
    novidades: 'Janela de novidades da versão 2.15',
  };

  // abas das seções: trocam a imagem da janela
  qa('.secao').forEach((sec) => {
    const abas = qa('[data-tela]', sec), img = q('.janela img', sec);
    const pre = new Set();
    const ativa = (b, foco) => {
      abas.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      const t = b.dataset.tela, src = 'site/telas/' + t + '.webp';
      if (img.getAttribute('src') !== src) {
        img.classList.remove('troca'); void img.offsetWidth;
        img.src = src; img.alt = ALT[t] || ''; if (!calmo) img.classList.add('troca');
      }
      if (foco) b.focus();
    };
    abas.forEach((b, i) => {
      b.id = b.id || sec.id + '-aba-' + i; b.setAttribute('aria-controls', sec.id + '-tela'); b.tabIndex = i ? -1 : 0;
      b.addEventListener('click', () => ativa(b));
      b.addEventListener('pointerenter', () => { if (!pre.has(b)) { pre.add(b); new Image().src = 'site/telas/' + b.dataset.tela + '.webp'; } });
      b.addEventListener('keydown', (e) => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!d) return;
        e.preventDefault(); ativa(abas[(i + d + abas.length) % abas.length], true);
      });
    });
    const fig = q('.janela', sec); fig.id = sec.id + '-tela'; fig.setAttribute('role', 'tabpanel');
  });

  // palavra grande de cada seção: letras em blocos que caem uma vez quando a seção chega
  qa('[data-letras]').forEach((el) => {
    const t = el.textContent; el.textContent = '';
    [...t].forEach((c, i) => { const s = document.createElement('span'); s.textContent = c; s.style.setProperty('--i', i); el.appendChild(s); });
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('caiu'); io.unobserve(e.target); } }), { threshold: 0.4 });
  qa('.palavra').forEach((p) => (calmo ? p.classList.add('caiu') : io.observe(p)));

  // XP do Slime: carinho e pouso na seção dão XP; 50 XP sobem de nível com confete
  const div = q('#diversao');
  if (div) {
    let xp = 0, nivel = 1;
    const ganha = (n, pet) => {
      xp += n;
      if (xp >= 50) { xp -= 50; nivel++; q('#xpNivel').textContent = nivel; if (pet) pet.festa(3, true, 'LEVEL UP!!'); }
      q('#xpNum').textContent = xp; q('#xpBarra').style.width = (xp / 50 * 100) + '%';
      const bar = q('.xp'); bar.classList.remove('ganhou'); void bar.offsetWidth; bar.classList.add('ganhou');
    };
    div.addEventListener('pet:carinho', (e) => ganha(10, e.detail));
    div.addEventListener('pet:pousou', (e) => ganha(e.detail.el && e.detail.el.classList.contains('xp') ? 25 : 10, e.detail.pet));
  }

  // abas de sistema na instalação (já abre no sistema de quem visita)
  const sos = qa('.so [role=tab]');
  const mostra = (b, foco) => {
    sos.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; q('#' + x.getAttribute('aria-controls')).hidden = !on; });
    if (foco) b.focus();
  };
  sos.forEach((b, i) => {
    b.addEventListener('click', () => mostra(b));
    b.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); mostra(sos[(i + d + sos.length) % sos.length], true); } });
  });
  const ua = navigator.userAgent;
  if (sos.length) mostra(/Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? sos[1] : /Linux/.test(ua) && !/Android/.test(ua) ? sos[2] : sos[0]);

  // os seis comemoram quando alguém clica para baixar
  const baixar = q('#btnBaixar');
  if (baixar) baixar.addEventListener('click', () => { if (window.Mascotes) Mascotes.festa(q('#baixar'), true); });

  // menu do celular
  const bt = q('.menu-bt'), menu = q('#menu');
  const fecha = () => { document.body.classList.remove('menu-aberto'); bt.setAttribute('aria-expanded', 'false'); bt.setAttribute('aria-label', 'Abrir o menu'); };
  bt.addEventListener('click', () => {
    const abre = !document.body.classList.contains('menu-aberto');
    document.body.classList.toggle('menu-aberto', abre); bt.setAttribute('aria-expanded', abre); bt.setAttribute('aria-label', abre ? 'Fechar o menu' : 'Abrir o menu');
    if (abre) q('a', menu).focus();
  });
  qa('a', menu).forEach((a) => a.addEventListener('click', fecha));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) { fecha(); bt.focus(); } });

  // pausar: os mascotes param de passear e os cubos param de flutuar (pegar e soltar continua valendo)
  const pausa = q('.pausa');
  pausa.addEventListener('click', () => {
    const on = pausa.getAttribute('aria-pressed') !== 'true';
    pausa.setAttribute('aria-pressed', on); const t = on ? 'Retomar animações' : 'Pausar animações'; pausa.setAttribute('aria-label', t); pausa.title = t; pausa.firstChild.textContent = on ? '▶' : '❚❚';
    document.body.classList.toggle('pausado', on); if (window.Mascotes) Mascotes.estado.pausado = on;
  });

  // topo com fundo depois de rolar
  const topo = q('#topo'), rola = () => topo.classList.toggle('cheio', scrollY > 20);
  addEventListener('scroll', rola, { passive: true }); rola();
})();
