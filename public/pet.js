// Mascote: um bichinho voxel que mora na tela, reage ao que você faz e pode ser pego, balançado e solto em cima dos quadros.
// Tudo é desenhado por código (caixas em projeção oblíqua), sem imagens. Ajustes em settings.pet = { on, tipo, nome, tam } (vem ligado).
// Na primeira vez (settings.petVisto) toca a abertura de boas-vindas e abre a escolha do mascote.
(function () {
  const q = (s) => document.querySelector(s);
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TIPOS = [['claude', 'Claude'], ['gpt', 'GPT'], ['gemini', 'Gemini'], ['pinguim', 'Pinguim'], ['coruja', 'Coruja'], ['slime', 'Slime']];
  const cfg = () => Object.assign({ on: true, tipo: 'claude', nome: '', tam: 1 }, (M.db && M.db.settings.pet) || {});
  const rnd = (a, b) => a + Math.random() * (b - a);
  const um = (L) => L[(Math.random() * L.length) | 0];
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const F = {
    pega: ['Ei!', 'Uooou!', 'Me leva!', 'Opa!'], chacoalha: ['Eita!', 'Paraaa!', 'Vou ficar tonto!'], tonto: ['Tudo girando…', 'Tô tonto…'],
    tarefa: ['Bora fazer essa?', 'Essa é rapidinha!', 'Eu ajudo nessa!'], item: ['Esse loot é bom!', 'Guardadinho aqui.', 'Posso ler?'], cliente: ['Cliente bom esse!', 'Vamos cuidar bem dele.'],
    notas: ['Hmm, suas notas…', 'Quanta coisa conectada!'], quadro: ['Cantinho novo!', 'Gostei daqui.', 'Boa vista!'], dentro: ['Entrei!', 'Aqui dentro é legal.'], chao: ['Ufa!', 'Chão firme.', 'Pousei!'],
    carinho: ['Hehe!', 'Mais um!', 'Bom trabalho hoje!', 'Gosto de você!'], tarefaFeita: ['Boa!', 'Mais uma!', 'Mandou bem!', 'Tarefa a menos!'], xp: ['+XP!', 'Isso!', 'Boa!'],
    nivel: ['LEVEL UP!!', 'Subimos de nível!'], digita: ['Anotando…', 'Tec tec tec…', 'Escrevo junto!'], ia: ['Pensando junto…', 'Deixa a IA pensar…'], musica: ['♪ Essa é boa!', '♪ Solta o som!'],
    foco: ['Modo foco! Tô junto.'], acorda: ['Opa, voltei!', 'Cochilei…'], escolhido: ['Cheguei!', 'Oi, oi!', 'Bora trabalhar!'],
  };

  // ----- desenho voxel: caixas [x, y, z, largura, altura, fundo, cor]; x para a direita, y para cima, z para o fundo -----
  const KX = 0.34, KY = 0.3, tons = {};
  function tom(hex, k) {
    const id = hex + k; if (tons[id]) return tons[id];
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, v * k)) | 0;
    return (tons[id] = `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`);
  }
  function caixa(c, b, u, ox, oy) {
    const x = b[0], y = b[1], z = b[2], w = b[3], h = b[4], d = b[5], cor = b[6];
    const X = (px, pz) => ox + (px + pz * KX) * u, Y = (py, pz) => oy - (py + pz * KY) * u;
    c.lineWidth = 0.6; c.lineJoin = 'round';
    c.fillStyle = c.strokeStyle = tom(cor, 1.2); c.beginPath(); c.moveTo(X(x, z), Y(y + h, z)); c.lineTo(X(x + w, z), Y(y + h, z)); c.lineTo(X(x + w, z + d), Y(y + h, z + d)); c.lineTo(X(x, z + d), Y(y + h, z + d)); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = c.strokeStyle = tom(cor, 0.7); c.beginPath(); c.moveTo(X(x + w, z), Y(y, z)); c.lineTo(X(x + w, z), Y(y + h, z)); c.lineTo(X(x + w, z + d), Y(y + h, z + d)); c.lineTo(X(x + w, z + d), Y(y, z + d)); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = c.strokeStyle = cor; c.beginPath(); c.rect(X(x, z), Y(y + h, z), w * u, h * u); c.fill(); c.stroke();
  }
  // ordem do pintor: quem está atrás, embaixo ou à esquerda é desenhado antes
  function ordena(L) {
    const n = L.length, ok = new Array(n).fill(false), out = [], e = 1e-6;
    const antes = (a, b) => a[2] >= b[2] + b[5] - e || a[1] + a[4] <= b[1] + e || a[0] + a[3] <= b[0] + e;
    for (let k = 0; k < n; k++) {
      let pick = -1;
      for (let i = 0; i < n && pick < 0; i++) {
        if (ok[i]) continue; let livre = true;
        for (let j = 0; j < n; j++) { if (j === i || ok[j]) continue; if (antes(L[j], L[i]) && !antes(L[i], L[j])) { livre = false; break; } }
        if (livre) pick = i;
      }
      if (pick < 0) pick = ok.indexOf(false);
      ok[pick] = true; out.push(L[pick]);
    }
    return out;
  }
  // ponto mais baixo do desenho (em unidades): é ele que encosta na linha onde o mascote pisa
  function apoio(L) { let g = Infinity; for (const b of L) if (!b[7]) g = Math.min(g, b[1] + b[2] * KY); return g === Infinity ? 0 : g; }
  function mk() { const L = []; let ox = 0, oy = 0, oz = 0; const b = (x, y, z, w, h, d, c, f) => { L.push([x + ox, y + oy, z + oz, w, h, d, c, f || 0]); }; b.em = (x, y, z) => { ox = x || 0; oy = y || 0; oz = z || 0; }; b.L = L; return b; }

  function olhos(b, p, ex, ey, zf, t, cor, branco) {
    for (const s of [-1, 1]) {
      const cx = s * ex;
      if (branco) b(cx - t * 0.5 - 0.35, ey - 0.35, zf - 0.2, t + 0.7, t + 0.7, 0.2, branco);
      if (p.olho === 'fechado') b(cx - t * 0.5, ey + t * 0.36, zf - 0.4, t, t * 0.3, 0.2, cor);
      else if (p.olho === 'feliz') { b(cx - t * 0.5, ey + t * 0.2, zf - 0.4, t * 0.34, t * 0.4, 0.2, cor); b(cx - t * 0.17, ey + t * 0.55, zf - 0.4, t * 0.34, t * 0.34, 0.2, cor); b(cx + t * 0.16, ey + t * 0.2, zf - 0.4, t * 0.34, t * 0.4, 0.2, cor); }
      else if (p.olho === 'tonto') { b(cx - t * 0.5, ey + t * 0.34, zf - 0.4, t, t * 0.32, 0.2, cor); b(cx - t * 0.16, ey, zf - 0.6, t * 0.32, t, 0.2, cor); }
      else {
        const w = t * (p.olho === 'arregalado' ? 1.2 : 1), x0 = cx - w / 2 + p.lx * 0.4, y0 = ey + (t - w) / 2 + p.ly * 0.3;
        b(x0, y0, zf - 0.4, w, w, 0.2, cor); b(x0 + w * 0.55, y0 + w * 0.55, zf - 0.5, w * 0.32, w * 0.32, 0.1, '#ffffff');
      }
    }
  }
  function boca(b, p, y, zf, cor) {
    if (p.boca === 'aberta') b(-0.8, y - 0.5, zf - 0.2, 1.6, 1.1, 0.2, cor);
    else if (p.boca === 'reta') b(-0.7, y, zf - 0.2, 1.4, 0.4, 0.2, cor);
    else { b(-0.9, y, zf - 0.2, 1.8, 0.45, 0.2, cor); b(-1.3, y + 0.4, zf - 0.2, 0.45, 0.45, 0.2, cor); b(0.85, y + 0.4, zf - 0.2, 0.45, 0.45, 0.2, cor); }
  }
  function note(b, y, z, cor, f) { b.em(0, 0, 0); b(-3.2, y, z, 6.4, 0.5, 3.2, '#aab2c5', f); b(-3.2, y + 0.5, z - 0.4, 6.4, 3, 0.4, '#3b4257', f); b(-0.6, y + 1.4, z - 0.55, 1.2, 1.2, 0.15, cor || '#ff7e00', f); }
  function extras(b, p, topo, t) {
    b.em(0, 0, 0);
    if (p.extra === 'estrelas') for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.09; b(Math.cos(a) * 4.5 - 0.5, topo + 1.2, 3 + Math.sin(a) * 3, 1, 1, 1, '#ffd84a'); }
    if (p.extra === 'pontos') for (let i = 0; i < 3; i++) b(-2.6 + i * 2.1, topo + 1.4 + Math.max(0, Math.sin(t * 6 - i * 0.9)) * 1.2, 2.5, 1.1, 1.1, 1.1, '#ffffff');
  }

  // pessoinha de cabeça grande (Claude e GPT)
  function humano(p, t, o) {
    const b = mk(), by = (p.senta ? -1 : 0) + Math.max(0, p.bob);
    if (p.senta && p.beira) [-3, 0.8].forEach((x) => { b(x, 0, -1.6, 2.2, 2, 3.6, o.calca); b(x, -2.4, -1.6, 2.2, 2.4, 1.6, o.calca, 1); b(x, -3.3, -2.2, 2.2, 0.9, 2.2, o.tenis, 1); }); // na beirada: canelas penduradas
    else if (p.senta) { b(-3, 0, -1, 2.2, 2, 3, o.calca); b(0.8, 0, -1, 2.2, 2, 3, o.calca); b(-3, 0, -2, 2.2, 2.4, 1, o.tenis); b(0.8, 0, -2, 2.2, 2.4, 1, o.tenis); }
    else [[-3, p.pe], [0.8, p.pd]].forEach(([x, l]) => { l = Math.min(1.4, l); b(x, 1 + l, 1, 2.2, 2 - l, 3, o.calca); b(x, l, 0.2, 2.2, 1, 3.8, o.tenis); });
    b.em(0, by, 0);
    b(-3.5, 3, 0.6, 7, 5, 4, o.roupa); b(-1.3, 5.6, 0.35, 2.6, 2.4, 0.25, o.detalhe);
    [[-1, p.be, p.bey], [1, p.bd, p.bdy]].forEach(([s, m, dy]) => {
      const e = Math.abs(dy || 0);
      if (m === 1) { const x = s < 0 ? -5.6 : 4.1; b(x, 6.5, -2.6, 1.5, 3 + e, 1.6, o.roupa); b(x, 9.5 + e, -2.6, 1.5, 1.2, 1.6, o.pele); }
      else if (m === 2) { const x = s < 0 ? -5 : 3.5; b(x, 5 + e, -1.6, 1.5, 1.5, 3, o.roupa); b(x, 5 + e, -2.8, 1.5, 1.3, 1.2, o.pele); }
      else { const x = s < 0 ? -5 : 3.5; b(x, 4.5 - e, 1.6, 1.5, 3.5, 2.2, o.roupa); b(x, 3.4 - e, 1.6, 1.5, 1.1, 2.2, o.pele); }
    });
    b(-5, 8, -0.6, 10, 7.2, 6.6, o.pele);
    olhos(b, p, 2.4, 10.3, -0.6, 1.6, o.olho);
    if (o.rosa) { b(-4.3, 9.4, -0.75, 1.3, 0.8, 0.15, o.rosa); b(3, 9.4, -0.75, 1.3, 0.8, 0.15, o.rosa); }
    boca(b, p, 8.9, o.zb, o.boca);
    o.cabelo(b);
    extras(b, p, o.topo, t);
    if (p.prop) note(b, 2.1, -3.6, o.logo, 1);
    return b.L;
  }
  // Claude: ruiva de cabelo cacheado, presilha de invader e suéter laranja. GPT: cabelo branco com mechas verdes e presilha de nó.
  const CLAUDE = {
    pele: '#f6c9a5', olho: '#8a3a10', rosa: '#f79a8c', boca: '#c2453a', zb: -0.6, roupa: '#e2622a', detalhe: '#f08a4a', calca: '#3b2a2c', tenis: '#f1ece4', topo: 19.4, logo: '#ff7e00',
    cabelo(b) {
      const H = '#e8702a', H2 = '#c4551a', H3 = '#ff9248', R = '#ff8fa3', E = '#7a2c3c';
      b(-5.6, 15.2, -1.2, 11.2, 2.3, 7.8, H); b(-5.6, 5, 6, 11.2, 10.2, 1.6, H2);
      b(-6.6, 5.2, 0.4, 1.6, 10, 5.6, H); b(5, 5.2, 0.4, 1.6, 10, 5.6, H);
      b(-5, 13.9, -1.2, 3.6, 1.3, 0.6, H); b(1.4, 14.3, -1.2, 3.6, 0.9, 0.6, H);
      b(-7.3, 8.5, 1.5, 0.7, 2.2, 2, H3); b(6.6, 10.5, 2, 0.7, 2.2, 2, H3); b(-7.3, 12.6, 3, 0.7, 1.8, 2, H3); b(6.6, 6.4, 1.2, 0.7, 1.8, 2, H3); b(-7.3, 5.2, 3.4, 0.7, 1.6, 2, H3);
      b(-3.6, 17.5, 1, 2.6, 0.7, 3, H3); b(2.2, 17.5, 3, 2.4, 0.7, 3, H3);
      b(-0.5, 17.5, 2.5, 1, 1.5, 1, H); b(0.5, 18.5, 2.5, 1.5, 0.7, 1, H); // fio rebelde
      b(-4.5, 15.7, -1.4, 2.4, 0.9, 0.2, R); b(-4.5, 15.3, -1.4, 0.5, 0.4, 0.2, R); b(-2.6, 15.3, -1.4, 0.5, 0.4, 0.2, R); b(-4.1, 16.6, -1.4, 0.5, 0.4, 0.2, R); b(-3, 16.6, -1.4, 0.5, 0.4, 0.2, R); // presilha de invader
      b(-4, 15.95, -1.5, 0.4, 0.4, 0.1, E); b(-3, 15.95, -1.5, 0.4, 0.4, 0.1, E);
    },
  };
  const GPT = {
    pele: '#f8d2b2', olho: '#1c7a5f', rosa: '#f79a8c', boca: '#c2453a', zb: -0.6, roupa: '#f1ebe0', detalhe: '#2fc9a0', calca: '#1f5b4a', tenis: '#f6f3ec', topo: 19.6, logo: '#2fc9a0',
    cabelo(b) {
      const C = '#f0eadf', C2 = '#d8d0c2', T = '#2fc9a0', T2 = '#1f9e80', N = '#0f6b57';
      b(-5.6, 15.2, -1.2, 11.2, 2.3, 7.8, C);
      b(-5.6, 10, 6, 11.2, 5.2, 1.6, C2); b(-5.6, 4.5, 6, 11.2, 5.5, 1.6, T2);
      b(-6.6, 10, 0.4, 1.6, 5.2, 5.6, C); b(-6.6, 5, 0.4, 1.6, 5, 5.6, T); b(5, 10, 0.4, 1.6, 5.2, 5.6, C); b(5, 5, 0.4, 1.6, 5, 5.6, T);
      b(-5, 13.9, -1.2, 3.4, 1.3, 0.6, C); b(-1.4, 13.5, -1.2, 1, 1.7, 0.6, T); b(1.6, 14.3, -1.2, 3.4, 0.9, 0.6, C);
      b(-1.4, 17.5, 2.5, 0.7, 1.5, 1, C); b(-1.4, 19, 2.5, 2.8, 0.6, 1, C); b(0.7, 17.5, 2.5, 0.7, 1.5, 1, C); // laço do topo
      b(2.4, 15.5, -1.5, 2.2, 2.2, 0.3, T); b(3.15, 16.25, -1.6, 0.7, 0.7, 0.1, N); // presilha de nó
      b(-7.3, 6.5, 2, 0.7, 2, 2, T); b(6.6, 8, 1.5, 0.7, 2, 2, T);
    },
  };
  const GEMINI = {
    pele: '#f8d2b2', olho: '#5a2fc0', rosa: '#f79ab0', boca: '#c2453a', zb: -0.6, roupa: '#7a55d6', detalhe: '#9b7cf0', calca: '#3a2a5a', tenis: '#efeaf6', topo: 18.4, logo: '#b79cff',
    cabelo(b) {
      const V = '#6a4bd8', V2 = '#4c33a8', V3 = '#8f74ff', S = '#e2d8ff';
      b(-5.6, 15.2, -1.2, 11.2, 2.3, 7.8, V); b(-5.6, 4.5, 6, 11.2, 10.7, 1.6, V2);
      b(-6.6, 4.8, 0.4, 1.6, 10.4, 5.6, V); b(5, 4.8, 0.4, 1.6, 10.4, 5.6, V);
      b(-5, 13.9, -1.2, 3, 1.3, 0.6, V); b(-1.2, 14.4, -1.2, 2, 0.8, 0.6, V); b(1.6, 13.9, -1.2, 3.4, 1.3, 0.6, V);
      b(-7.3, 7, 1.5, 0.7, 2.2, 2, V3); b(6.6, 9.5, 2, 0.7, 2.2, 2, V3); b(6.6, 5, 1.2, 0.7, 1.8, 2, V3); b(-7.3, 11.5, 3, 0.7, 1.8, 2, V3);
      b(-3.4, 17.5, 1.5, 2.6, 0.7, 3, V3); b(0.8, 17.5, 3, 2.6, 0.7, 3, V3);
      b(2.95, 15.3, -1.5, 0.5, 2.1, 0.3, S); b(2.15, 16.1, -1.5, 2.1, 0.5, 0.3, S); // presilha de estrela
    },
  };
  function ave(p, t, o) {
    const b = mk(), by = Math.max(0, p.bob);
    [[o.pes[0], p.pe], [o.pes[1], p.pd]].forEach(([x, l]) => b(x, l, -1.9, 2.5, 1, 1.5, o.bico));
    b.em(0, by, 0);
    o.corpo(b, p);
    [[-1, p.be, p.bey], [1, p.bd, p.bdy]].forEach(([s, m, dy]) => {
      const e = Math.abs(dy || 0), A = o.asa;
      if (m === 1) b(s < 0 ? -A[0] - 1.8 : A[0] + 0.5, 6.5 + e, 1.8, 1.3, 6, 3.4, o.corAsa);
      else if (m === 2) b(s < 0 ? -4.4 : 3.1, 4 + e, -2.3, 1.3, 1.3, 2, o.corAsa);
      else b(s < 0 ? -A[0] - 1.3 : A[0], 3.6 - e, 1.8, 1.3, 6, 3.4, o.corAsa);
    });
    extras(b, p, o.topo, t);
    if (p.prop) note(b, 2.6, -3.9, o.logo, 1);
    return b.L;
  }
  const PINGUIM = {
    bico: '#ff9a2e', pes: [-4, 1.5], asa: [5], corAsa: '#232c4f', topo: 14,
    corpo(b, p) {
      const N = '#2c3760', W = '#f4f6fb';
      b(-5, 0.5, 0, 10, 12.5, 7, N); b(-3.6, 1, -0.3, 7.2, 6.8, 0.3, W); b(-4, 7.8, -0.3, 8, 3.8, 0.3, W);
      olhos(b, p, 2.1, 9, -0.3, 1.5, '#1a1d2e');
      b(-1.1, p.boca === 'aberta' ? 7.5 : 7.9, -1.9, 2.2, p.boca === 'aberta' ? 1.5 : 1, 1, '#ff9a2e');
      b(-4.6, 8.3, -0.45, 1.1, 0.7, 0.15, '#ffb3c0'); b(3.5, 8.3, -0.45, 1.1, 0.7, 0.15, '#ffb3c0');
      b(-1, 13, 2.5, 2, 0.9, 2, N);
    },
  };
  const CORUJA = {
    bico: '#ffb02e', pes: [-3.7, 1.2], asa: [5.5], corAsa: '#6f4630', topo: 14,
    corpo(b, p) {
      const A = '#8a5a3c', B2 = '#b98a5e', C = '#f3e3c8';
      b(-5.5, 0.5, 0, 11, 11.5, 7, A); b(-3.4, 1, -0.3, 6.8, 4.8, 0.3, C);
      [[-2.4, 4], [-0.5, 3], [1.4, 4], [-0.5, 5], [-2.4, 2], [1.4, 2]].forEach(([x, y]) => b(x, y, -0.5, 1, 0.55, 0.2, B2));
      b(-5, 6.2, -0.3, 4.7, 4.7, 0.3, C); b(0.3, 6.2, -0.3, 4.7, 4.7, 0.3, C);
      olhos(b, p, 2.65, 7.4, -0.3, 2.3, '#2a1c14');
      b(-0.8, 5.9, -1.6, 1.6, 1.2, 0.9, '#ffb02e');
      b(-5.5, 12, 1, 2.4, 2, 3, A); b(3.1, 12, 1, 2.4, 2, 3, A);
    },
  };
  function slime(p, t) {
    const b = mk(), G = '#35d68a', s = lim(p.amassa, -1, 1), w = 1 + s * 0.16, h = 1 - s * 0.2;
    b(-6 * w, 0, 0, 12 * w, 5 * h, 8, G); b(-5 * w, 5 * h, 0.6, 10 * w, 3 * h, 6.8, G); b(-3.4 * w, 8 * h, 1.4, 6.8 * w, 1.5 * h, 5.2, G);
    b(-4.4 * w, 5.7 * h, 0.4, 1.5, 1, 0.2, '#d6ffe8');
    b.em(0, (h - 1) * 2.2, 0);
    olhos(b, p, 2.5 * w, 2.2, 0, 1.8, '#113322'); boca(b, p, 1.2, 0, '#113322');
    b(-4.9 * w, 1.5, -0.15, 1.2, 0.7, 0.15, '#ff9ab0'); b(3.7 * w, 1.5, -0.15, 1.2, 0.7, 0.15, '#ff9ab0');
    extras(b, p, 9.6 * h, t);
    if (p.prop) note(b, 0, -3.6, '#35d68a');
    return b.L;
  }
  const MOD = { claude: (p, t) => humano(p, t, CLAUDE), gpt: (p, t) => humano(p, t, GPT), gemini: (p, t) => humano(p, t, GEMINI), pinguim: (p, t) => ave(p, t, PINGUIM), coruja: (p, t) => ave(p, t, CORUJA), slime };
  const TOPO = { claude: 19.4, gpt: 19.6, gemini: 18.4, pinguim: 14, coruja: 14, slime: 9.6 };
  const LARG = { claude: 13.5, gpt: 13.5, gemini: 13.5, pinguim: 12.5, coruja: 13.5, slime: 13 };

  // ----- estado -----
  const P = { x: 0, y: 0, vx: 0, vy: 0, dir: -1, modo: 'cai', surf: null, tm: 1, alvo: 0, salto: 0, esp: 0, ang: 0, av: 0, tonto: 0, tontoPend: false, festa: 0, solto: false, quiques: 0, corre: false, ultPulo: 0, pulo: null };
  const mouse = { x: 0, y: 0, vx: 0, down: false, t0: 0, hist: [] }, olhar = { x: 0, y: 0 };
  let el, cv, c2, hit, balao, U = 3, CW = 0, CH = 0, BASE = 0, dpr = 1, K = 1, tipo = 'claude', ligado = false, raf = 0, ult = 0, par = false;
  let seg = null, ultTecla = -1e9, ultAcao = performance.now(), iaPend = 0, lista = [], listaT = 0, tocava = false, focava = false;
  const alt = () => TOPO[tipo] * U * K, meia = () => LARG[tipo] * U * K / 2;
  const foco = () => { const f = q('#focus'); return !!(f && f.classList.contains('run')); };

  function monta() {
    if (el) return;
    el = document.createElement('div'); el.id = 'pet';
    el.innerHTML = '<canvas class="pet-cv"></canvas><div class="pet-hit" role="img" aria-label="Mascote"></div><div class="pet-fala" hidden></div>';
    document.body.appendChild(el);
    cv = el.children[0]; c2 = cv.getContext('2d'); hit = el.children[1]; balao = el.children[2];
    eventos();
  }
  function mede() {
    const c = cfg(); tipo = MOD[c.tipo] ? c.tipo : 'claude';
    U = 3 * (+c.tam || 1) * (innerWidth < 700 ? 0.85 : 1);
    CW = Math.ceil(30 * U); CH = Math.ceil(32 * U); BASE = Math.ceil(5 * U);
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = CW * dpr; cv.height = CH * dpr;
    cv.style.cssText = `width:${CW}px;height:${CH}px;left:${-CW / 2}px;top:${-(CH - BASE)}px`;
    const hw = LARG[tipo] * U, hh = TOPO[tipo] * U;
    hit.style.cssText = `left:${-hw / 2}px;top:${-hh}px;width:${hw}px;height:${hh}px`;
    hit.setAttribute('aria-label', c.nome ? 'Mascote ' + c.nome : 'Mascote');
    // escala real na tela: o tamanho das letras (zoom) muda a conta
    el.style.transform = 'translate(100px,100px)'; const r = el.getBoundingClientRect(); K = r.left > 1 ? r.left / 100 : 1;
  }
  const poe = () => { el.style.transform = `translate(${(P.x / K).toFixed(1)}px,${((P.y - P.salto) / K).toFixed(1)}px)`; };

  function diz(txt, ms) {
    if (!el || !ligado) return;
    balao.textContent = txt; balao.hidden = false;
    const lado = P.y - (TOPO[tipo] * U + 46) * K < 4;      // sem espaço em cima: o balão vai para o lado
    balao.classList.toggle('lado', lado);
    if (lado) { balao.style.bottom = (TOPO[tipo] * U * 0.45) + 'px'; balao.style.marginLeft = ((P.x > innerWidth / 2 ? -1 : 1) * (LARG[tipo] * U / 2 + balao.offsetWidth / 2 + 10)) + 'px'; }
    else { balao.style.bottom = (TOPO[tipo] * U + 12) + 'px'; balao.style.marginLeft = ((lim(P.x, 90, innerWidth - 90) - P.x) / K) + 'px'; }
    balao.classList.remove('on'); void balao.offsetWidth; balao.classList.add('on');
    clearTimeout(diz.t); diz.t = setTimeout(() => { balao.hidden = true; }, ms || 2400);
  }
  function festa(s, grande) {
    if (!ligado) return;
    P.festa = Math.max(P.festa, s); if (P.modo === 'dorme' || P.modo === 'anda') P.modo = 'parado'; ultAcao = performance.now();
    if (grande && window.FX) FX.burst(P.x, P.y - alt(), 26, 6);
  }
  function carinho() {
    P.festa = Math.max(P.festa, 0.9);
    if (window.FX) FX.float('❤', P.x / K, (P.y - alt() - 8) / K, '#ff6b9d');
    if (window.SFX) SFX.play('pop');
    if (Math.random() < 0.6) diz(um(F.carinho));
  }

  // ----- onde ele pode pisar: a borda de cima dos quadros, o fundo de dentro dos quadros grandes e o chão -----
  const SEL = '#view .card, #view .panel, #view .hero, #view .qc, #view .task, #view .stat, #view .cnx, #view .quest, #nav button, #btnNew';
  const SELM = '#overlay .modal, #overlay .panel, #overlay .stat, #overlay .task';
  function piso() { const b = q('#bnav'), r = b && b.getBoundingClientRect(); return (r && r.height > 0 ? r.top : innerHeight) - 2; }
  function superficies() {
    const out = [], vw = innerWidth, ch = piso(), view = q('#view'), vr = view ? view.getBoundingClientRect() : null, a = alt();
    const modal = !!(M.modalOpen && M.modalOpen());
    document.querySelectorAll(modal ? SELM : SEL).forEach((e) => {
      const r = e.getBoundingClientRect(); if (r.width < 44 || r.height < 12) return;
      const cl = !modal && vr && view.contains(e) ? vr : { top: 0, bottom: ch, left: 0, right: vw };
      const l = Math.max(r.left, cl.left), d = Math.min(r.right, cl.right, vw), fim = Math.min(cl.bottom, ch) - 6; if (d - l < 40) return;
      if (r.top > cl.top + 8 && r.top < fim) out.push({ el: e, k: 'topo', l, r: d, y: r.top });
      const y2 = r.bottom - 3;
      if (e.matches('.panel,.hero,.stat,.card,.cnx,.modal') && r.height > a + 16 && y2 > cl.top + a && y2 < fim) out.push({ el: e, k: 'dentro', l: l + 4, r: d - 4, y: y2 });
    });
    out.push({ el: null, k: 'chao', l: 0, r: vw, y: ch });
    return out;
  }
  const mesma = (a, b) => !!a && !!b && a.el === b.el && a.k === b.k;
  function atualiza(s) {
    if (s.k === 'chao') { s.y = piso(); s.l = 0; s.r = innerWidth; return true; }
    if (!s.el.isConnected || !!(M.modalOpen && M.modalOpen()) !== !!s.el.closest('#overlay')) return false;
    const r = s.el.getBoundingClientRect(); if (!r.width) return false;
    const m = s.k === 'dentro' ? 4 : 0; s.y = s.k === 'topo' ? r.top : r.bottom - 3; s.l = r.left + m; s.r = r.right - m;
    const view = q('#view');
    if (view && view.contains(s.el)) { const vr = view.getBoundingClientRect(); if (s.y < vr.top + 8 || s.y > vr.bottom) return false; }
    return s.y < piso() + 1;
  }
  function reage(s) {
    const e = s.el; let f = F.chao;
    if (e) {
      if (e.matches('.task')) f = F.tarefa;
      else if (e.matches('.cnx')) f = F.notas;
      else if (e.matches('#nav button')) f = ['Vamos pra ' + (e.textContent || '').replace(/[^\p{L} ]/gu, '').trim() + '?'];
      else if (e.matches('.card.cli')) f = F.cliente;
      else if (e.matches('.card')) f = F.item;
      else f = s.k === 'dentro' ? F.dentro : F.quadro;
      e.classList.remove('pet-pisou'); void e.offsetWidth; e.classList.add('pet-pisou'); setTimeout(() => e.classList.remove('pet-pisou'), 500);
    }
    diz(um(f)); if (window.SFX) SFX.play('drop');
  }
  function pousa(s, quieto) {
    P.surf = s; P.y = s.y; P.vx = P.vy = 0; P.modo = 'parado'; P.tm = rnd(1.4, 3); P.esp = quieto ? 0.25 : 0.45; P.quiques = 0; P.pulo = null;
    el.classList.remove('pego');
    if (P.tontoPend) { P.tonto = 3.4; P.tontoPend = false; diz(um(F.tonto)); }
    else if (P.solto) reage(s);
    P.solto = false;
  }
  function cai(dt) {
    const m = meia(), y0 = P.y;
    P.vy += 2300 * K * dt; P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.x < m) { P.x = m; P.vx = Math.abs(P.vx) * 0.5; } else if (P.x > innerWidth - m) { P.x = innerWidth - m; P.vx = -Math.abs(P.vx) * 0.5; }
    if (P.vy < 0 && P.y < alt()) { P.y = alt(); P.vy = Math.abs(P.vy) * 0.4; }
    if (P.vy <= 0) return;
    const now = performance.now(); if (now - listaT > 120) { lista = superficies(); listaT = now; }
    let s = null; for (const o of lista) if (P.x >= o.l - 2 && P.x <= o.r + 2 && y0 <= o.y + 1 && P.y >= o.y && (!s || o.y < s.y)) s = o;
    if (!s) { if (P.y > piso()) s = { el: null, k: 'chao', l: 0, r: innerWidth, y: piso() }; else return; }
    P.y = s.y;
    if (P.vy > 560 * K && P.quiques < 2) { P.vy = -P.vy * 0.32; P.vx *= 0.6; P.quiques++; P.esp = 0.4; }
    else pousa(s);
  }
  function pula(o, x1) {
    const d = Math.hypot(x1 - P.x, o.y - P.y);
    P.pulo = { x0: P.x, y0: P.y, x1, o, t: 0, T: lim(d / (620 * K), 0.38, 0.85), h: 46 * K + Math.max(0, P.y - o.y) * 0.3 };
    P.modo = 'pulo'; P.surf = null; P.ultPulo = performance.now(); if (Math.abs(x1 - P.x) > 4) P.dir = x1 > P.x ? 1 : -1; P.esp = 0.3;
  }
  function voa(dt) {
    const j = P.pulo; if (!j || !atualiza(j.o)) { P.modo = 'cai'; P.vx = P.vy = 0; return; }
    j.t += dt; const k = Math.min(1, j.t / j.T);
    P.x = j.x0 + (lim(j.x1, j.o.l + 4, j.o.r - 4) - j.x0) * k; P.y = j.y0 + (j.o.y - j.y0) * k - 4 * j.h * k * (1 - k);
    if (k >= 1) pousa(j.o, true);
  }
  function sobCursor() {
    let s = null; for (const o of superficies()) if (mouse.x >= o.l && mouse.x <= o.r && o.y >= mouse.y - 10 && (!s || o.y < s.y)) s = o;
    return s;
  }
  function pensa(dt, now) {
    let s = P.surf; const m = meia();
    if (!s || !atualiza(s)) {
      const n = superficies().find((o) => o.k !== 'chao' && Math.abs(o.y - P.y) < 8 && P.x >= o.l && P.x <= o.r);
      if (n) s = P.surf = n; else { P.surf = null; P.modo = 'cai'; P.vx = P.vy = 0; return; }
    }
    P.y = s.y;
    let l = s.l + m * 0.6, r = s.r - m * 0.6; if (r < l) l = r = (s.l + s.r) / 2;
    if (P.x < s.l - 24 || P.x > s.r + 24) { P.surf = null; P.modo = 'cai'; P.vx = P.vy = 0; return; }
    P.x = lim(P.x, l, r); P.corre = false;
    if (P.tonto > 0) { P.tonto -= dt; return; }
    if (P.festa > 0 || now - ultTecla < 1600 || iaPend > 0) { if (P.modo === 'anda' || P.modo === 'dorme') P.modo = 'parado'; return; }
    // com o botão segurado em outro lugar, ele corre atrás do cursor (e pula para o quadro onde o cursor está)
    if (mouse.down && now - mouse.t0 > 280 && !calmo) {
      const dx = mouse.x - P.x; P.modo = 'parado'; P.tm = 1.5;
      if (Math.abs(dx) > 14) { P.dir = dx > 0 ? 1 : -1; const nx = lim(P.x + P.dir * 230 * K * dt, l, r); P.corre = Math.abs(nx - P.x) > 0.1; P.x = nx; }
      if (now - P.ultPulo > 900 && now - mouse.t0 > 620) { const o = sobCursor(); if (o && !mesma(o, s)) pula(o, lim(mouse.x, o.l + m * 0.6, o.r - m * 0.6)); }
      return;
    }
    if (P.modo === 'anda') {
      const dx = P.alvo - P.x;
      if (Math.abs(dx) < 3) { P.modo = 'parado'; P.tm = rnd(1.5, 5); } else { P.dir = dx > 0 ? 1 : -1; P.x = lim(P.x + P.dir * 46 * K * dt, l, r); if (P.x === l || P.x === r) P.alvo = P.x; }
      return;
    }
    if (P.modo === 'dorme') { if (now - ultAcao < 1500) { P.modo = 'parado'; P.tm = rnd(2, 4); diz(um(F.acorda)); } return; }
    P.tm -= dt; if (P.tm > 0) return;
    if (now - ultAcao > 90000) { P.modo = 'dorme'; return; }
    if (calmo) { P.modo = 'parado'; P.tm = 5; return; }
    if (foco()) { P.modo = 'senta'; P.tm = 6; return; }
    const z = Math.random();
    if (z < 0.5 && r - l > 30) { P.modo = 'anda'; P.alvo = rnd(l, r); }
    else if (z < 0.68) { P.modo = 'senta'; P.tm = rnd(4, 9); }
    else if (z < 0.8 && now - P.ultPulo > 6000) {
      const L = superficies().filter((o) => !mesma(o, s) && o.r - o.l > m * 2.5 && Math.abs((o.l + o.r) / 2 - P.x) < 560 * K && (o.k === 'chao' || (o.k === 'topo' && o.el.matches('.panel,.hero,.qc,.stat,.card'))));
      if (L.length) { const o = um(L); pula(o, rnd(o.l + m, o.r - m)); } else { P.modo = 'parado'; P.tm = 2; }
    } else { P.modo = 'parado'; P.tm = rnd(2, 5); }
  }

  // ----- pegar, balançar, chacoalhar e soltar -----
  function segura(dt) {
    const tx = mouse.x, ty = mouse.y + alt() * 0.82, k = Math.min(1, dt * 24);
    P.x += (tx - P.x) * k; P.y += (ty - P.y) * k;
    const alvo = lim(-mouse.vx * 0.0011 / K, -1.1, 1.1);
    P.av += ((alvo - P.ang) * 70 - P.av * 5) * dt; P.ang += P.av * dt;
    mouse.vx *= Math.exp(-dt * 8);
  }
  function ativa() {
    seg.ativo = true; P.surf = null; P.modo = 'parado'; P.tonto = 0; P.festa = 0; el.classList.add('pego');
    if (Math.random() < 0.5) diz(um(F.pega), 1200);
  }
  function larga(semJogar) {
    if (!seg) return; const s = seg; seg = null; clearTimeout(s.toque);
    try { hit.releasePointerCapture(s.id); } catch (_) {}
    if (!s.ativo) { if (!semJogar && performance.now() - s.t0 < 450) carinho(); return; }
    let vx = 0, vy = 0; const h = mouse.hist, now = performance.now(), a = h.find((p) => now - p.t < 110), b = h[h.length - 1];
    if (!semJogar && a && b && b.t - a.t > 8) { vx = (b.x - a.x) / (b.t - a.t) * 1000; vy = (b.y - a.y) / (b.t - a.t) * 1000; }
    P.vx = lim(vx, -1600 * K, 1600 * K); P.vy = lim(vy, -1600 * K, 1600 * K); P.modo = 'cai'; P.surf = null; P.solto = true; P.quiques = 0; lista = []; listaT = 0;
  }
  function menu(e) {
    if (!M.ctxMenu) return;
    M.ctxMenu(e, [
      { sub: cfg().nome || 'Mascote' },
      { em: '🐾', t: 'Trocar de mascote', fn: () => { M.ui.cfgSec = '🎮 Diversão'; M.go('cfg'); } },
      { em: '💤', t: P.modo === 'dorme' ? 'Acordar' : 'Colocar para dormir', fn: () => { if (P.modo === 'dorme') ultAcao = performance.now(); else if (P.surf) { P.modo = 'dorme'; ultAcao = performance.now() - 5000; } } },
      { em: '🙈', t: 'Guardar o mascote', fn: () => { muda({ on: false }); M.toast('🐾 Mascote guardado. Para trazer de volta: Configurações → Diversão.'); } },
    ]);
  }
  function eventos() {
    hit.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || seg) return;
      e.preventDefault(); e.stopPropagation(); try { hit.setPointerCapture(e.pointerId); } catch (_) {}
      const now = performance.now(); ultAcao = now;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.vx = 0; mouse.hist = [{ x: e.clientX, y: e.clientY, t: now }];
      seg = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, ativo: false, sinal: 0, viradas: [] };
      seg.toque = setTimeout(() => { if (seg && !seg.ativo && e.pointerType !== 'mouse') { larga(true); menu(e); } }, 650);
    });
    hit.addEventListener('pointermove', (e) => {
      if (!seg || e.pointerId !== seg.id) return;
      const now = performance.now(), u = mouse.hist[mouse.hist.length - 1], dtm = Math.max(1, now - u.t), vx = (e.clientX - u.x) / dtm * 1000;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.vx = mouse.vx * 0.5 + vx * 0.5;
      mouse.hist.push({ x: e.clientX, y: e.clientY, t: now }); if (mouse.hist.length > 12) mouse.hist.shift();
      if (!seg.ativo && Math.hypot(e.clientX - seg.x0, e.clientY - seg.y0) > 6) ativa();
      if (seg.ativo && Math.abs(vx) > 650 * K && Math.sign(vx) !== seg.sinal) {
        seg.sinal = Math.sign(vx); seg.viradas.push(now); seg.viradas = seg.viradas.filter((t) => now - t < 1400);
        if (seg.viradas.length >= 6 && !P.tontoPend) { P.tontoPend = true; diz(um(F.chacoalha), 1500); }
      }
    });
    hit.addEventListener('pointerup', () => larga(false));
    hit.addEventListener('pointercancel', () => larga(true));
    hit.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); larga(true); menu(e); });
    document.addEventListener('pointerdown', (e) => { ultAcao = performance.now(); if (e.target === hit || e.button !== 0) return; mouse.down = true; mouse.t0 = ultAcao; mouse.x = e.clientX; mouse.y = e.clientY; }, true);
    document.addEventListener('pointermove', (e) => { if (!seg) { mouse.x = e.clientX; mouse.y = e.clientY; } }, true);
    const sobe = () => { mouse.down = false; };
    document.addEventListener('pointerup', sobe, true); document.addEventListener('pointercancel', sobe, true); addEventListener('blur', sobe);
    document.addEventListener('keydown', (e) => {
      const now = performance.now(), t = e.target; ultAcao = now;
      if (!ligado || !t || !t.matches || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!(t.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])') || t.isContentEditable)) return;
      if (e.key.length !== 1 && e.key !== 'Backspace' && e.key !== 'Enter') return;
      if (now - ultTecla > 9000 && Math.random() < 0.35) diz(um(F.digita), 1600);
      ultTecla = now;
    }, true);
    document.addEventListener('scroll', () => { listaT = 0; }, true);
    addEventListener('resize', () => { if (ligado) { mede(); P.x = lim(P.x, meia(), innerWidth - meia()); } });
  }

  // ----- poses -----
  function anim(now) {
    if (seg && seg.ativo) return 'pendurado';
    if (P.modo === 'cai' || P.modo === 'pulo') return 'cai';
    if (P.tonto > 0) return 'tonto';
    if (P.festa > 0) return 'festa';
    if (now - ultTecla < 1600) return 'digita';
    if (iaPend > 0) return 'pensa';
    if (P.corre) return 'corre';
    if (P.modo === 'anda') return 'anda';
    if (P.modo === 'dorme') return 'dorme';
    if (foco()) return 'digita';
    if (tocava) return 'danca';
    return P.modo === 'senta' ? 'senta' : 'parado';
  }
  function pose(a, t) {
    const p = { bob: 0, pe: 0, pd: 0, be: 0, bd: 0, bey: 0, bdy: 0, olho: 'aberto', lx: olhar.x, ly: olhar.y, boca: 'sorriso', senta: false, prop: false, amassa: 0, extra: '', incl: 0, beira: !!(P.surf && P.surf.k === 'topo') };
    const s = Math.sin, pisca = (t % 3.7) < 0.14, bal = (s(t * 2.2) + 1) / 2;
    if (pisca) p.olho = 'fechado';
    if (a === 'parado') { p.bob = bal * 0.25; p.amassa = (bal - 0.5) * 0.5; }
    else if (a === 'anda' || a === 'corre') { const c = t * (a === 'corre' ? 17 : 9); p.pe = Math.max(0, s(c)) * 1.1; p.pd = Math.max(0, -s(c)) * 1.1; p.bob = Math.abs(s(c)) * 0.4; p.bey = Math.max(0, s(c)) * 0.6; p.bdy = Math.max(0, -s(c)) * 0.6; p.amassa = s(c * 2) * 0.6; p.lx = -0.7; p.ly = 0; if (a === 'corre') p.boca = 'aberta'; }
    else if (a === 'senta') { p.senta = true; p.bob = bal * 0.15; p.amassa = 0.3 + (bal - 0.5) * 0.3; }
    else if (a === 'digita') { p.senta = true; p.prop = true; p.be = p.bd = 2; p.bey = s(t * 24) > 0 ? 0.6 : 0; p.bdy = s(t * 24 + 2) > 0 ? 0.6 : 0; p.lx = s(t * 3) * 0.4; p.ly = -1; p.bob = Math.abs(s(t * 12)) * 0.12; p.amassa = s(t * 12) * 0.25; }
    else if (a === 'festa') { p.be = p.bd = 1; p.bey = p.bdy = Math.abs(s(t * 8)) * 0.8; p.olho = 'feliz'; p.boca = 'aberta'; p.amassa = 0.2 - Math.abs(s(t * 8)) * 0.8; }
    else if (a === 'danca') { const k = s(t * 5.2) > 0; p.be = k ? 1 : 0; p.bd = k ? 0 : 1; p.pe = k ? 0.5 : 0; p.pd = k ? 0 : 0.5; p.bob = Math.abs(s(t * 5.2)) * 0.5; p.incl = s(t * 5.2) * 0.1; if (!pisca) p.olho = 'feliz'; p.amassa = s(t * 10.4) * 0.5; }
    else if (a === 'pensa') { p.bd = 2; p.lx = -0.6; p.ly = 1; p.boca = 'reta'; p.extra = 'pontos'; p.bob = bal * 0.2; }
    else if (a === 'dorme') { p.senta = true; p.olho = 'fechado'; p.boca = 'reta'; p.bob = (s(t * 1.3) + 1) * 0.12; p.amassa = 0.5 + s(t * 1.3) * 0.25; p.extra = 'zzz'; }
    else if (a === 'pendurado') { p.be = p.bd = 1; p.pe = -0.8 + s(t * 6) * 0.3; p.pd = -0.8 - s(t * 6) * 0.3; p.olho = P.tontoPend ? 'tonto' : 'arregalado'; p.boca = 'aberta'; p.amassa = -0.8; }
    else if (a === 'cai') { p.be = p.bd = 1; p.pe = p.pd = -0.4; p.olho = P.tontoPend ? 'tonto' : 'arregalado'; p.boca = 'aberta'; p.amassa = -0.5; }
    else if (a === 'aceno') { p.bd = 1; p.bdy = Math.abs(s(t * 9)) * 0.9; if (!pisca) p.olho = 'feliz'; p.boca = 'aberta'; p.amassa = s(t * 9) * 0.4; p.bob = bal * 0.2; }
    else if (a === 'tonto') { p.senta = true; p.olho = 'tonto'; p.boca = 'reta'; p.extra = 'estrelas'; p.incl = s(t * 4) * 0.12; }
    return p;
  }
  function desenha(a, t) {
    const p = pose(a, t), L = ordena(MOD[tipo](p, t)), chao = CH - BASE, oy = chao + apoio(L) * U, ox = CW / 2 - 3.5 * KX * U, pend = seg && seg.ativo;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, CW, CH);
    if (P.surf && !P.salto) { c2.fillStyle = 'rgba(0,0,0,.3)'; c2.beginPath(); c2.ellipse(CW / 2, chao - U * 0.15, LARG[tipo] * U * 0.5, U * 0.55, 0, 0, 6.3); c2.fill(); } // sombra de contato
    for (const b of L) caixa(c2, b, U, ox, oy);
    if (p.extra === 'zzz') {
      c2.save(); if (P.dir > 0) { c2.translate(CW, 0); c2.scale(-1, 1); }
      c2.font = `700 ${(U * 3.4).toFixed(1)}px JBMono,monospace`; c2.fillStyle = '#9db4ff';
      for (let i = 0; i < 3; i++) { const k = (t * 0.45 + i / 3) % 1; c2.globalAlpha = 1 - k; c2.fillText('z', CW / 2 + U * (4 + k * 5), oy - TOPO[tipo] * U * 0.8 - k * U * 6); }
      c2.restore();
    }
    const e = P.esp, sx = (1 + e * 0.5) * -P.dir, sy = 1 - e * 0.45; // o desenho base olha para a esquerda: espelha quando vai para a direita
    cv.style.transformOrigin = `50% ${pend ? CH - BASE - TOPO[tipo] * U * 0.85 : CH - BASE}px`;
    cv.style.transform = `rotate(${(P.ang + (pend ? 0 : p.incl)).toFixed(3)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
  }
  function quadro(now) {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (now - ult) / 1000 || 0); ult = now;
    if (document.hidden || !ligado) return;
    if (seg && !seg.ativo && now - seg.t0 > 220) ativa();
    if (seg && seg.ativo) segura(dt);
    else {
      if (P.modo === 'cai') cai(dt); else if (P.modo === 'pulo') voa(dt); else if (!seg) pensa(dt, now);
      P.ang += (0 - P.ang) * Math.min(1, dt * 9); P.av = 0;
    }
    if (P.festa > 0) P.festa -= dt;
    P.esp += (0 - P.esp) * Math.min(1, dt * 9);
    const toca = !!(M.musica && M.musica.ligada()), fc = foco();
    if (toca && !tocava && P.surf) diz(um(F.musica)); tocava = toca;
    if (fc && !focava) diz(um(F.foco)); focava = fc;
    olhar.x += (lim((mouse.x - P.x) / 240, -1, 1) * -P.dir - olhar.x) * 0.2; olhar.y += (lim((P.y - alt() * 0.6 - mouse.y) / 240, -1, 1) - olhar.y) * 0.2;
    const a = anim(now), t = now / 1000;
    P.salto = a === 'festa' && P.surf ? Math.abs(Math.sin(t * 8)) * 5 * U * K : 0;
    poe();
    par = !par; if (par || a === 'pendurado' || a === 'cai') desenha(a, t);
  }

  // ----- ligar, desligar e Configurações -----
  function aplica() {
    if (!M.db) return;
    if (!iniciou) { iniciou = true; entrada(); }
    const c = cfg();
    if (!c.on) { if (ligado) { ligado = false; cancelAnimationFrame(raf); el.hidden = true; larga(true); } return; }
    monta(); el.hidden = false; mede();
    if (!ligado) {
      ligado = true; P.x = Math.max(70, innerWidth - 120); P.y = alt() + 10; P.vx = P.vy = 0; P.modo = 'cai'; P.surf = null; P.dir = -1; P.tonto = 0; P.festa = 0;
      ult = performance.now(); ultAcao = ult; raf = requestAnimationFrame(quadro);
      setTimeout(() => diz(c.nome ? `Oi! Eu sou ${c.nome}!` : 'Oi!'), 900);
    }
  }
  function muda(patch) { M.db.settings.pet = Object.assign(cfg(), patch); M.save(); aplica(); }
  function retrato(c, k, a, t) {
    const x = c.getContext('2d'), u = c.width / 28, p = pose(a || 'parado', t || 1); p.lx = p.ly = 0; if (!a) p.olho = 'aberto';
    x.clearRect(0, 0, c.width, c.height);
    const L = ordena(MOD[k](p, t || 1));
    for (const b of L) caixa(x, b, u, c.width / 2 - 3.5 * KX * u, c.height - u * 3.6 + apoio(L) * u);
  }
  function cfgHTML(semAbertura) {
    const c = cfg();
    return `<div class="cfg-row"><span class="l">Mascote ${M.hint('Um bichinho que mora na tela: escreve junto quando você digita e comemora quando você conclui uma tarefa. Dá para pegar, balançar e soltar em cima dos quadros.')}</span>${M.sw('cPet', c.on)}</div>
        <div class="pet-cfg" id="petCfg"${c.on ? '' : ' hidden'}>
          <div class="pet-esc" id="petEsc" role="radiogroup" aria-label="Escolha o mascote">${TIPOS.map(([k, n]) => `<button type="button" role="radio" aria-checked="${c.tipo === k}" data-pet="${k}" class="${c.tipo === k ? 'on' : ''}"><canvas width="104" height="104"></canvas><span>${n}</span></button>`).join('')}</div>
          <div class="cfg-row"><span class="l">Nome do mascote</span><input type="text" id="petNome" maxlength="16" placeholder="Dê um nome" value="${M.esc(c.nome)}" style="width:150px"></div>
          <div class="cfg-row"><span class="l">Tamanho</span><div class="seg" id="petTam">${[[0.8, 'P'], [1, 'M'], [1.35, 'G']].map(([v, n]) => `<button data-t="${v}" class="${(+c.tam || 1) === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <small class="pet-dica">Clique nele para fazer carinho. Segure para levantar, balance e solte em cima de uma tarefa ou de um quadro. Segure o botão do mouse em outro lugar e ele corre atrás. Com o botão direito você troca ou guarda.</small>
          ${semAbertura ? '' : '<button type="button" class="btn ghost sm" id="petOla" style="margin-top:10px">▶ Ver a abertura dos mascotes</button>'}
        </div>`;
  }
  function cfgBind() {
    const sw = q('#cPet'); if (!sw) return;
    document.querySelectorAll('#petEsc canvas').forEach((c) => retrato(c, c.parentNode.dataset.pet));
    sw.onchange = (e) => { muda({ on: e.target.checked }); q('#petCfg').hidden = !e.target.checked; if (window.SFX) SFX.play('coin'); };
    q('#petEsc').onclick = (e) => {
      const b = e.target.closest('[data-pet]'); if (!b) return;
      muda({ tipo: b.dataset.pet });
      document.querySelectorAll('#petEsc [data-pet]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      festa(1); diz(um(F.escolhido));
    };
    q('#petNome').onchange = (e) => { muda({ nome: e.target.value.trim().slice(0, 16) }); if (cfg().nome) diz(cfg().nome + '? Gostei!'); };
    const ola = q('#petOla'); if (ola) ola.onclick = () => abertura();
    q('#petTam').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; muda({ tam: +b.dataset.t }); [...b.parentNode.children].forEach((x) => x.classList.toggle('on', x === b)); };
  }

  // ----- boas-vindas: abertura animada (uma vez) e a escolha do mascote -----
  // Os seis aparecem em roda, olhando para quem está na frente da tela; a câmera se afasta, eles acenam, entra a marca e abre o app.
  let pendente = true, tourAdiado = null, iniciou = false;
  function balaoC(x, txt, cx, cy, tam) {
    x.font = '700 ' + tam + 'px system-ui,sans-serif'; const w = x.measureText(txt).width + tam * 1.3, h = tam * 1.9;
    x.fillStyle = '#ffffff'; x.strokeStyle = '#141826'; x.lineWidth = 2; x.beginPath();
    if (x.roundRect) x.roundRect(cx - w / 2, cy - h, w, h, 8); else x.rect(cx - w / 2, cy - h, w, h);
    x.fill(); x.stroke(); x.fillStyle = '#141826'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, cx, cy - h / 2);
  }
  function abertura(fim) {
    if (calmo || q('.pet-ola')) { if (fim) fim(); return; }
    const ov = document.createElement('div'); ov.className = 'pet-ola';
    ov.innerHTML = '<canvas></canvas><div class="pet-ola-logo"><div class="ln"><img class="ic" src="/icon.png" alt=""><b>MyLoot</b></div><small>by <img src="/prestes.png" alt=""> prestes design</small></div><button type="button" class="pet-ola-pular">Pular</button>';
    document.body.appendChild(ov);
    const c = ov.firstChild, x = c.getContext('2d'), logo = ov.children[1], ks = TIPOS.map((a) => a[0]), n = ks.length, t0 = performance.now();
    const FALAS = ['Oi!', 'Olá!', 'Bem-vindo!', 'Chegamos!', 'Oi, oi!', 'Bora!'];
    let W = 0, H = 0, d = 1, id = 0, fora = false;
    const mede2 = () => { d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; };
    const tecla = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); sai(); } };
    const sai = () => {
      if (fora) return; fora = true; ov.classList.add('sai'); document.removeEventListener('keydown', tecla, true);
      setTimeout(() => {
        cancelAnimationFrame(id); removeEventListener('resize', mede2); ov.remove();
        if (ligado) { Object.assign(P, { x: Math.max(70, innerWidth - 120), y: alt() + 10, vx: 0, vy: 0, modo: 'cai', surf: null, dir: -1 }); setTimeout(() => diz('Oi!'), 900); }
        if (fim) fim();
      }, 460);
    };
    mede2(); addEventListener('resize', mede2); ov.onclick = sai; document.addEventListener('keydown', tecla, true);
    const suave = (v) => { v = lim(v, 0, 1); return v * v * (3 - 2 * v); };
    const mola = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : 1 + Math.pow(2, -9 * v) * Math.sin((v * 7 - 0.75) * 2.094));
    function passo(now) {
      id = requestAnimationFrame(passo);
      const t = (now - t0) / 1000, m = Math.min(W, H), z = suave((t - 2.7) / 1.2);        // z: 0 = roda de perto, 1 = fileira de longe
      x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
      const cols = W < H * 0.8 ? Math.ceil(n / 2) : n, lin = Math.ceil(n / cols);                 // em tela em pé, duas fileiras
      const u1 = m / 38, u2 = Math.min(W / (cols * 17.5), H / (lin > 1 ? 80 : 52)), u = u1 + (u2 - u1) * z, R = 26 * u1, yFila = H * 0.74;
      for (let i = 0; i < n; i++) {
        const k = ks[i], a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / n, ent = mola((t - 0.15 - i * 0.2) / 0.75);
        if (ent <= 0) continue;
        const acena = t > 4.0, tp = t + i * 0.37, p = pose(acena ? 'aceno' : 'parado', tp); p.lx = 0; p.ly = 0; p.beira = false;
        const sobe = acena ? Math.abs(Math.sin((t - 4.0) * 5 - i * 0.6)) * (t < 5.6 ? 1.6 : 0.5) * u : 0, longe = (1 - ent) * 13 * u1 * (1 - z);
        const cx = (W / 2 + Math.cos(a) * (R + longe)) * (1 - z) + (W / 2 + ((i % cols) - (cols - 1) / 2) * 17 * u2) * z;
        const cy = (H / 2 + Math.sin(a) * (R + longe)) * (1 - z) + (yFila - (lin - 1 - Math.floor(i / cols)) * 25 * u2) * z - sobe;
        let r = a - Math.PI / 2; if (r > Math.PI) r -= 2 * Math.PI; if (r < -Math.PI) r += 2 * Math.PI;      // cabeça para o centro da roda
        const L = ordena(MOD[k](p, tp)), g = apoio(L);
        x.save(); x.translate(cx, cy); x.rotate(r * (1 - z)); for (const b of L) caixa(x, b, u, -3.5 * KX * u, g * u); x.restore();
        if (acena && t > 4.1 + i * 0.12 && t < 5.7) balaoC(x, FALAS[i % FALAS.length], cx, cy - TOPO[k] * u - 10, Math.max(11, u * 1.5));
      }
      if (t > 5.3) logo.classList.add('on');
      if (t > 7.6) sai();
    }
    id = requestAnimationFrame(passo);
  }
  function escolha(fim) {
    const feito = () => { M.db.settings.petVisto = true; M.save(); if (fim) fim(); };
    if (!M.modal || q('#cPet')) return feito();
    const m = M.modal(`<div class="modal-h"><h2>🐾 Você ganhou um mascote</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b pet-boas"><p>Ele mora na sua tela: digita junto com você, comemora cada tarefa e dá para pegar e soltar em cima dos quadros. Escolha o seu, ou desligue na chavinha.</p>
      ${cfgHTML(true)}<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="petOk" style="flex:none">Concluir</button></div></div>`, { small: true, onClose: feito });
    cfgBind(); m.querySelector('#x').onclick = M.closeModal; m.querySelector('#petOk').onclick = M.closeModal;
  }
  // na primeira vez: espera as janelas da entrada (novidades e IA) fecharem, mostra a abertura e a escolha; o tutorial fica para depois
  function entrada() {
    if (M.db.settings.petVisto) { pendente = false; return; }
    let livre = 0;
    const tenta = () => {
      if (M.modalOpen && M.modalOpen()) { livre = 0; return setTimeout(tenta, 700); }
      if (++livre < 2) return setTimeout(tenta, 700);
      abertura(() => escolha(() => { pendente = false; if (tourAdiado && M.tourTalvez) { const pg = tourAdiado; tourAdiado = null; M.tourTalvez(pg); } }));
    };
    setTimeout(tenta, 1500);
  }
  if (typeof M.tourTalvez === 'function') { const tt = M.tourTalvez; M.tourTalvez = function (pg) { if (pendente) { tourAdiado = pg; return; } return tt.apply(this, arguments); }; }

  // ----- reações ao uso: XP, tarefa concluída, subir de nível e IA trabalhando -----
  function embrulha(nome, depois) {
    const f = M[nome]; if (typeof f !== 'function') return;
    M[nome] = function () { const r = f.apply(this, arguments); try { if (ligado) depois(r, arguments); } catch (_) {} return r; };
  }
  embrulha('award', (dado, a) => { festa(a[0] === 'task' ? 1.8 : 1); if (a[0] === 'task' || Math.random() < 0.3) diz(um(a[0] === 'task' ? F.tarefaFeita : F.xp)); });
  embrulha('levelUp', () => { festa(4, true); diz(um(F.nivel), 3500); });
  embrulha('api', (r, a) => {
    if (a[0] !== '/api/ai' || !r || !r.finally) return;
    iaPend++; if (iaPend === 1) diz(um(F.ia));
    r.finally(() => { iaPend = Math.max(0, iaPend - 1); }).catch(() => {});
  });

  M.pet = { TIPOS, aplica, diz, festa, cfgHTML, cfgBind, retrato, abertura, estado: P };
})();
