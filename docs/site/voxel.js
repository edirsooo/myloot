// Desenho voxel dos mascotes do MyLoot, copiado de public/pet.js (mesmo projeto, mesma licença).
// Caixas em projeção oblíqua desenhadas em canvas, sem imagens. Exporta window.Voxel.
(function () {
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
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

  function pose(a, t, o) {
    o = o || {};
    const p = { bob: 0, pe: 0, pd: 0, be: 0, bd: 0, bey: 0, bdy: 0, olho: 'aberto', lx: o.lx || 0, ly: o.ly || 0, boca: 'sorriso', senta: false, prop: false, amassa: 0, extra: '', incl: 0, beira: !!o.beira };
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
    else if (a === 'pendurado') { p.be = p.bd = 1; p.pe = -0.8 + s(t * 6) * 0.3; p.pd = -0.8 - s(t * 6) * 0.3; p.olho = o.tonto ? 'tonto' : 'arregalado'; p.boca = 'aberta'; p.amassa = -0.8; }
    else if (a === 'cai') { p.be = p.bd = 1; p.pe = p.pd = -0.4; p.olho = o.tonto ? 'tonto' : 'arregalado'; p.boca = 'aberta'; p.amassa = -0.5; }
    else if (a === 'aceno') { p.bd = 1; p.bdy = Math.abs(s(t * 9)) * 0.9; if (!pisca) p.olho = 'feliz'; p.boca = 'aberta'; p.amassa = s(t * 9) * 0.4; p.bob = bal * 0.2; }
    else if (a === 'tonto') { p.senta = true; p.olho = 'tonto'; p.boca = 'reta'; p.extra = 'estrelas'; p.incl = s(t * 4) * 0.12; }
    return p;
  }

  // desenha o personagem k na pose a, com o ponto de apoio em (cx, cy) e unidade u
  function desenha(c, k, a, t, u, cx, cy, o) {
    const p = pose(a, t, o), L = ordena(MOD[k](p, t));
    for (const b of L) caixa(c, b, u, cx - 3.5 * KX * u, cy + apoio(L) * u);
    return p;
  }
  window.Voxel = { MOD, TOPO, LARG, pose, ordena, caixa, apoio, desenha, KX };
})();
