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

  // seção ativa: troca a música e toca a transição (raios na cor do personagem, nome grande e o mascote numa nuvem de cubos)
  const secoes = qa('main > section'), tr = q('.trans'), tcv = q('.t-cv'), NOMES = { guardar: 'Guardar', organizar: 'Organizar', trabalho: 'Trabalho', conectar: 'Conectar', diversao: 'Diversão', seguranca: 'Segurança' };
  let ativa = null, tRaf = 0, tFim = 0;
  // cfg: { cor, parte, nome, sub, ks: [mascotes] }; um mascote grande acenando ou a turma toda comemorando
  function anima(cfg) {
    const varios = cfg.ks.length > 1;
    tr.style.setProperty('--cor', cfg.cor); tr.classList.toggle('varios', varios);
    q('.t-parte', tr).textContent = cfg.parte; q('.t-nome', tr).textContent = cfg.nome; q('.t-sub', tr).textContent = cfg.sub;
    tr.classList.remove('on'); void tr.offsetWidth; tr.classList.add('on');
    clearTimeout(tFim); tFim = setTimeout(() => tr.classList.remove('on'), 1750);
    cancelAnimationFrame(tRaf);
    const V = window.Voxel, d = Math.min(devicePixelRatio || 1, 2), W = tcv.clientWidth, H = tcv.clientHeight, c = tcv.getContext('2d'), t0 = performance.now();
    if (!V || !W) return;
    tcv.width = W * d; tcv.height = H * d;
    const cubos = Array.from({ length: 18 }, (_, j) => ({ a: j * 0.349 + Math.random() * 0.3, v: 0.5 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.6, cor: ['#ff7e00', '#8b5cf6', '#3ad7ff', '#ffffff'][j % 4] }));
    const mola = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : 1 + Math.pow(2, -9 * v) * Math.sin((v * 7 - 0.75) * 2.094));
    const n = cfg.ks.length, passoX = W / n;
    const passo = (now) => {
      const t = (now - t0) / 1000; if (t > 1.75) { c.clearRect(0, 0, tcv.width, tcv.height); return; }
      tRaf = requestAnimationFrame(passo);
      c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
      const u = Math.min(1, t / 0.6), cy = H * 0.86;
      cfg.ks.forEach((k, i) => {
        const s = Math.min(1.08, mola((t - 0.12 - i * 0.07) / 0.7)), U = Math.min(W / 30, passoX / 16) * s, cx = passoX * (i + 0.5);
        if (s > 0.02) V.desenha(c, k, varios ? (i % 2 ? 'aceno' : 'festa') : (t > 0.35 ? 'aceno' : 'festa'), t * 1.2 + i * 0.4, U, cx, cy - (varios ? Math.abs(Math.sin(t * 7 + i)) * 10 : 0), {});
      });
      if (u < 1) {           // nuvem de cubos e anel
        const e = 1 - Math.pow(1 - u, 3), R = 20 + Math.min(W, 420) * 0.42 * e, cx = W / 2;
        c.globalAlpha = 1 - u; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, 10 * (1 - u)); c.beginPath(); c.arc(cx, cy - H * 0.3, R, 0, 6.3); c.stroke();
        for (const b of cubos) { const r = R * b.v * 1.3, x = cx + Math.cos(b.a) * r, y = cy - H * 0.3 + Math.sin(b.a) * r - 30 * u, l = 14 * b.s * (1 - u * 0.6); c.fillStyle = b.cor; c.fillRect(x - l / 2, y - l / 2, l, l); }
        c.globalAlpha = 1;
      }
    };
    tRaf = requestAnimationFrame(passo);
  }
  // no celular não tem transição de seção: a página só rola (pedido de 17/11/2026)
  const celular = matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)');
  const quieto = () => calmo || celular.matches || document.body.classList.contains('pausado');
  function cfgDe(sec) {
    if (sec.dataset.parte) return { cor: getComputedStyle(sec).getPropertyValue('--cor').trim(), parte: 'PARTE ' + sec.dataset.parte + ' DE 6', nome: NOMES[sec.id] || '', sub: sec.dataset.sub || '', ks: [sec.dataset.palco] };
    if (sec.id === 'baixar') return { cor: '#ff7e00', parte: 'GRÁTIS · SEM CONTA · CÓDIGO ABERTO', nome: 'Baixar', sub: 'Windows · Mac · Linux', ks: ['claude', 'gpt', 'gemini', 'pinguim', 'coruja', 'slime'] };
    return null;
  }
  function transicao(sec) {
    const cfg = !quieto() && cfgDe(sec); if (!cfg) return false;
    anima(cfg); return true;
  }

  // música: uma faixa do app por personagem, como no vídeo; troca com crossfade quando a seção muda
  const som = q('.som'), vol = q('.vol'), players = [new Audio(), new Audio()]; let atual = 0, faixa = '', tocando = false, volume = 0.35;
  try { const v = parseFloat(localStorage.getItem('myloot-site-volume')); if (v >= 0 && v <= 1) { volume = v; vol.value = Math.round(v * 100); } } catch (_) {}
  // barrinha de volume (computador); no celular vale o volume do próprio aparelho
  vol.addEventListener('input', () => { volume = vol.value / 100; players[atual].volume = volume; vol.style.setProperty('--v', vol.value + '%'); try { localStorage.setItem('myloot-site-volume', volume); } catch (_) {} });
  vol.style.setProperty('--v', vol.value + '%');
  players.forEach((a) => { a.loop = true; a.preload = 'none'; a.volume = 0; });
  function fade(a, alvo, ms, fim) {
    const v0 = a.volume, t0 = performance.now();
    const f = (now) => { const k = Math.min(1, (now - t0) / ms); a.volume = v0 + (alvo - v0) * k; if (k < 1) requestAnimationFrame(f); else if (fim) fim(); };
    requestAnimationFrame(f);
  }
  function toca(nome) {
    if (!tocando || nome === faixa) return;
    if (!nome) { faixa = ''; players.forEach((a) => fade(a, 0, 600, () => a.pause())); return; }   // seção do vídeo: a música do site sai
    faixa = nome; const velho = players[atual]; atual = 1 - atual; const novo = players[atual];
    novo.src = 'site/musica/' + nome + '.mp3'; novo.currentTime = 0; novo.volume = 0;
    novo.play().then(() => fade(novo, volume, 700)).catch(() => {});
    fade(velho, 0, 700, () => velho.pause());
  }
  function liga(on) {
    tocando = on; som.setAttribute('aria-pressed', on); document.body.classList.toggle('com-som', on); const t = on ? 'Parar a música' : 'Tocar a música'; som.setAttribute('aria-label', t); som.title = t;
    try { localStorage.setItem('myloot-site-musica', on ? '1' : '0'); } catch (_) {}
    if (on) { faixa = ''; toca((ativa || secoes[0]).dataset.faixa); } else { faixa = ''; players.forEach((a) => fade(a, 0, 400, () => a.pause())); }
  }
  som.addEventListener('click', () => liga(!tocando));
  // o vídeo tem som próprio: ao dar play, a música do site para
  const vid = q('.tela-video video');
  if (vid && matchMedia('(max-width: 700px) and (orientation: portrait)').matches) vid.poster = 'site/video/apresentacao-2-15-vertical.jpg?v=5'; if (vid) vid.addEventListener('play', () => { if (tocando) liga(false); });
  // quem ligou a música antes volta com ela no primeiro toque ou tecla (o navegador não deixa tocar sozinho)
  let lembra = false; try { lembra = localStorage.getItem('myloot-site-musica') === '1'; } catch (_) {}
  if (lembra) { const um = (e) => { if (e.target.closest && e.target.closest('.som')) return; removeEventListener('pointerdown', um, true); removeEventListener('keydown', um, true); if (!tocando) liga(true); }; addEventListener('pointerdown', um, true); addEventListener('keydown', um, true); }

  // seção ativa = a última cujo topo já passou de 80% da altura da tela. Assim a transição toca logo que a seção
  // começa a aparecer (antes de a pessoa começar a ler), e não quando ela já está no meio da tela.
  // Descendo: transição + o mascote cai quando a transição está acabando. Subindo: só troca a música.
  let ordem = -1, rTick = 0, pulo = null;   // pulo: navegação por link em andamento (as seções do caminho não animam)
  function confere() {
    rTick = 0; const linha = innerHeight * 0.8; let i = 0;
    secoes.forEach((s, n) => { if (s.getBoundingClientRect().top <= linha) i = n; });
    if (i === ordem) return;
    const desce = i > ordem, primeira = ordem < 0; ordem = i; ativa = secoes[i];
    if (pulo && ativa !== pulo.dest) return;                                  // passando por cima: nada
    const comTrans = pulo ? pulo.anim : !primeira && desce && transicao(ativa);
    if (pulo) pulo = null;
    ativa.dispatchEvent(new CustomEvent('secao:entra', { detail: { transicao: comTrans } }));
    toca(ativa.dataset.faixa);
  }
  addEventListener('scroll', () => { if (!rTick) rTick = requestAnimationFrame(confere); }, { passive: true });
  // clique em link interno (menu, Baixar, Ver o vídeo): a animação do destino cobre a tela e a página pula direto
  // para lá por baixo dela, sem passar mostrando as seções do meio
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented) return;
    const dest = document.getElementById(a.getAttribute('href').slice(1));
    if (!dest || !secoes.includes(dest) || dest === ativa) return;
    e.preventDefault();
    const cfg = !quieto() && cfgDe(dest);
    pulo = { dest, anim: !!cfg };
    const vai = () => { scrollTo({ top: dest.getBoundingClientRect().top + scrollY, behavior: 'instant' }); history.replaceState(null, '', '#' + dest.id); confere(); setTimeout(() => { pulo = null; }, 400); };
    if (cfg) { anima(cfg); setTimeout(vai, 260); } else vai();
  });
  addEventListener('resize', () => { if (!rTick) rTick = requestAnimationFrame(confere); });
  confere();

  // topo com fundo depois de rolar
  const topo = q('#topo'), rola = () => topo.classList.toggle('cheio', scrollY > 20);
  addEventListener('scroll', rola, { passive: true }); rola();
})();
