// Gráfico de conexões (estilo Obsidian): itens como bolinhas coloridas por tipo,
// ligados automaticamente por etiquetas em comum, categoria e menções no texto.
(function () {
  const { esc } = M;

  // ----- monta nós e ligações a partir da biblioteca -----
  // guardado: a Início redesenha a cada tarefa marcada, e com milhares de itens recalcular levava segundos
  let memo = null;
  M.graphData = () => {
    const items = M.db.items;
    let soma = items.length; for (const it of items) soma += (it.updated || 0) % 1e9;
    const assin = soma + '|' + (M.db.categories || []).length + '|' + (M.db.pastas || []).map((p) => p.id + p.name + (p.updated || 0)).join(',');
    if (memo && memo.assin === assin && memo.items === items) return memo.r;
    const nodes = items.map((it) => ({ id: it.id, it, deg: 0 }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = new Map(); // "a|b" -> {a,b,why:Set}
    const link = (a, b, why) => {
      if (a === b) return;
      const k = a < b ? a + '|' + b : b + '|' + a;
      let e = edges.get(k);
      if (!e) { e = { a: byId.get(a < b ? a : b), b: byId.get(a < b ? b : a), why: new Set() }; edges.set(k, e); }
      e.why.add(why);
    };
    // etiquetas em comum
    const tagMap = new Map();
    items.forEach((it) => (it.tags || []).forEach((t) => { t = String(t).toLowerCase(); if (!tagMap.has(t)) tagMap.set(t, []); tagMap.get(t).push(it.id); }));
    tagMap.forEach((ids, t) => { if (ids.length > 40) return; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(ids[i], ids[j], '#' + t); });
    // mesma categoria: liga em corrente (evita virar um novelo)
    const catMap = new Map();
    items.forEach((it) => { if (!it.cat) return; if (!catMap.has(it.cat)) catMap.set(it.cat, []); catMap.get(it.cat).push(it); });
    catMap.forEach((list, c) => {
      const nome = (M.db.categories || []).find((x) => x.id === c);
      list.sort((a, b) => a.created - b.created);
      for (let i = 1; i < list.length; i++) link(list[i - 1].id, list[i].id, 'categoria ' + (nome ? nome.name : c));
    });
    // mesma pasta: também em corrente
    const pastaMap = new Map();
    items.forEach((it) => { const p = M.pastaDoItem ? M.pastaDoItem(it) : ''; if (!p) return; if (!pastaMap.has(p)) pastaMap.set(p, []); pastaMap.get(p).push(it); });
    pastaMap.forEach((list, p) => {
      list.sort((a, b) => a.created - b.created);
      for (let i = 1; i < list.length; i++) link(list[i - 1].id, list[i].id, 'pasta ' + (M.pasta(p) || {}).name);
    });
    // menções: [[Título]] ou o título de outro item escrito no texto
    const titled = items.filter((it) => (it.title || '').trim().length >= 5).map((it) => ({ id: it.id, t: it.title.trim().toLowerCase() }));
    const porTitulo = new Map(titled.map((o) => [o.t, o]));
    // título escrito no texto: comparação de todos com todos só até 400 títulos; acima disso vale só o [[Título]]
    const procurarTitulos = titled.length <= 400;
    items.forEach((it) => {
      const txt = ((it.content || '') + ' ' + (it.desc || '')).toLowerCase();
      if (!txt.trim()) return;
      (txt.match(/\[\[([^\]]+)\]\]/g) || []).forEach((m) => { const o = porTitulo.get(m.slice(2, -2).trim()); if (o) link(it.id, o.id, 'menção'); });
      if (procurarTitulos) titled.forEach((o) => { if (o.id !== it.id && txt.includes(o.t)) link(it.id, o.id, 'menção'); });
    });
    const E = [...edges.values()];
    E.forEach((e) => { e.a.deg++; e.b.deg++; });
    const r = { nodes, edges: E };
    memo = { assin, items, r };
    return r;
  };

  // ----- desenho com física simples (sem bibliotecas) -----
  const mapas = new Set(); // mapas desenhados agora (para soltar os que saíram da tela)
  M.graph = (host, opt) => {
    opt = opt || {};
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const tip = document.createElement('div'); tip.className = 'g-tip'; tip.hidden = true;
    // zoom por botão: no toque não existe rodinha do mouse
    const zb = document.createElement('div'); zb.className = 'g-zoom';
    zb.innerHTML = '<button type="button" data-z="in" title="Aproximar" aria-label="Aproximar o mapa">＋</button><button type="button" data-z="out" title="Afastar" aria-label="Afastar o mapa">−</button><button type="button" data-z="fit" title="Mostrar o mapa inteiro" aria-label="Centralizar o mapa">Centralizar</button>';
    host.classList.add('g-host'); host.append(cv, tip, zb);
    let { nodes, edges } = M.graphData();
    if (opt.only) { nodes = nodes.filter((n) => opt.only.has(n.id)); edges = edges.filter((e) => opt.only.has(e.a.id) && opt.only.has(e.b.id)); }
    const nb = new Map(nodes.map((n) => [n, new Set()]));
    edges.forEach((e) => { nb.get(e.a).add(e.b); nb.get(e.b).add(e.a); });
    const R = (n) => 5 + Math.sqrt(n.deg) * 2.4;
    let W = 0, H = 0, dpr = 1, cam = { x: 0, y: 0, k: 1 }, hover = null, drag = null, pan = null, alpha = 1, raf = 0, fitted = false;
    // posição inicial em espiral
    const mem = M._gpos || (M._gpos = {});
    let lembrados = 0;
    nodes.forEach((n, i) => { const o = mem[n.id]; if (o) { n.x = o.x; n.y = o.y; lembrados++; } else { const a = i * 2.4, r = 14 * Math.sqrt(i + 1); n.x = Math.cos(a) * r; n.y = Math.sin(a) * r; } n.vx = n.vy = 0; });
    if (nodes.length && lembrados >= nodes.length * 0.8) alpha = 0.12; // já estava arrumado: só um ajuste fino
    const guardar = () => { nodes.forEach((n) => { mem[n.id] = { x: n.x, y: n.y }; }); };
    let sujo = true; // só redesenha quando algo mudou (economiza processador com o mapa parado)

    const resize = () => {
      const b = host.getBoundingClientRect(); dpr = devicePixelRatio || 1;
      W = b.width; H = b.height; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      if (!fitted) { cam.x = W / 2; cam.y = H / 2; if (lembrados && W > 20) { fit(); fitted = 2; } }
      kick(lembrados ? 0.05 : 0.3); sujo = true;
    };
    const ro = new ResizeObserver(resize); ro.observe(host);
    // voltou para o app (iPhone apaga o desenho dos canvas em segundo plano): refaz a área e redesenha
    const volta = () => { if (document.visibilityState === 'visible' && host.isConnected) resize(); };
    document.addEventListener('visibilitychange', volta); addEventListener('pageshow', volta);
    // a tela foi redesenhada e este mapa saiu: libera a memória do canvas na hora (o iPhone tem limite e, sem isso, o mapa novo ficava em branco)
    const solta = () => { cancelAnimationFrame(raf); ro.disconnect(); guardar(); document.removeEventListener('visibilitychange', volta); removeEventListener('pageshow', volta); cv.width = cv.height = 0; };
    mapas.forEach((m) => { if (!m.host.isConnected) { m.solta(); mapas.delete(m); } });
    mapas.add({ host, solta });

    function step() {
      const k = alpha;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01;
          if (d2 > 90000) continue;
          const f = (900 / d2) * k; dx *= f; dy *= f; a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
        }
        a.vx -= a.x * 0.012 * k; a.vy -= a.y * 0.012 * k; // gravidade para o centro
      }
      edges.forEach((e) => {
        const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = ((d - 46) / d) * 0.035 * k;
        e.a.vx += dx * f; e.a.vy += dy * f; e.b.vx -= dx * f; e.b.vy -= dy * f;
      });
      nodes.forEach((n) => { if (n === drag) return; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; });
      alpha *= 0.985;
    }

    function fit() {
      if (!nodes.length) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      nodes.forEach((n) => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
      const k = Math.min(2.2, Math.min(W / (x1 - x0 + 70), H / (y1 - y0 + 70)));
      cam.k = k; cam.x = W / 2 - ((x0 + x1) / 2) * k; cam.y = H / 2 - ((y0 + y1) / 2) * k;
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.k, cam.k);
      const near = hover ? nb.get(hover) : null;
      ctx.lineWidth = 1 / cam.k;
      edges.forEach((e) => {
        const on = hover && (e.a === hover || e.b === hover);
        ctx.strokeStyle = on ? M.type(hover.it.type).color : hover ? 'rgba(160,170,200,.06)' : 'rgba(160,170,200,.22)';
        ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      });
      nodes.forEach((n) => {
        const dim = hover && n !== hover && !near.has(n);
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.fillStyle = M.type(n.it.type).color;
        ctx.beginPath(); ctx.arc(n.x, n.y, R(n), 0, 7); ctx.fill();
        if (n === hover) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / cam.k; ctx.stroke(); ctx.lineWidth = 1 / cam.k; }
        if ((cam.k > 1.3 || n === hover || (near && near.has(n)) || (opt.full && n.deg > 3)) && !dim) {
          ctx.fillStyle = 'rgba(230,235,255,.85)'; ctx.font = `${11 / cam.k}px system-ui, sans-serif`; ctx.textAlign = 'center';
          ctx.fillText((n.it.title || 'Sem título').slice(0, 28), n.x, n.y + R(n) + 12 / cam.k);
        }
      });
      ctx.globalAlpha = 1; ctx.restore();
    }

    function loop() {
      if (!host.isConnected) { solta(); mapas.forEach((m) => { if (m.host === host) mapas.delete(m); }); return; }
      if (alpha > 0.02 || drag) { for (let i = 0; i < 2; i++) step(); if (!fitted && alpha < 0.35) { fit(); fitted = 1; } if (fitted === 1 && alpha < 0.03) { fit(); fitted = 2; guardar(); } sujo = true; }
      if (sujo) { draw(); sujo = false; }
      raf = requestAnimationFrame(loop);
    }
    function kick(a) { alpha = Math.max(alpha, a); }

    const toWorld = (e) => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left - cam.x) / cam.k, y: (e.clientY - b.top - cam.y) / cam.k, sx: e.clientX - b.left, sy: e.clientY - b.top }; };
    const pick = (p) => { let best = null, bd = 1e9; nodes.forEach((n) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < R(n) + 5 / cam.k && d < bd) { bd = d; best = n; } }); return best; };

    function showTip(n, p) {
      if (!n) { tip.hidden = true; return; }
      const t = M.type(n.it.type), ls = [...nb.get(n)];
      const why = edges.filter((e) => e.a === n || e.b === n).flatMap((e) => [...e.why]);
      const motivos = [...new Set(why)].slice(0, 4).join(' · ');
      tip.innerHTML = `<b style="color:${t.color}">${t.em} ${esc(n.it.title || 'Sem título')}</b><small>${t.name} · ${ls.length} conex${ls.length === 1 ? 'ão' : 'ões'}</small>${ls.length ? `<div>${ls.slice(0, 6).map((o) => `<span style="--c:${M.type(o.it.type).color}">${esc((o.it.title || 'Sem título').slice(0, 30))}</span>`).join('')}${ls.length > 6 ? `<span>+${ls.length - 6}</span>` : ''}</div>` : ''}${motivos ? `<em>${esc(motivos)}</em>` : ''}<i>clique para abrir</i>`;
      tip.hidden = false;
      const x = Math.min(p.sx + 14, W - tip.offsetWidth - 6), y = Math.min(p.sy + 14, H - tip.offsetHeight - 6);
      tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px';
    }

    let moved = false;
    cv.onpointerdown = (e) => {
      cv.setPointerCapture(e.pointerId); moved = false;
      const p = toWorld(e), n = pick(p);
      if (n) { drag = n; kick(0.3); } else pan = { x: e.clientX - cam.x, y: e.clientY - cam.y };
    };
    cv.onpointermove = (e) => {
      sujo = true;
      const p = toWorld(e);
      if (drag) { drag.x = p.x; drag.y = p.y; drag.vx = drag.vy = 0; moved = true; kick(0.2); return; }
      if (pan) { cam.x = e.clientX - pan.x; cam.y = e.clientY - pan.y; moved = true; return; }
      const n = pick(p); hover = n; cv.style.cursor = n ? 'pointer' : 'grab'; showTip(n, p);
    };
    cv.onpointerup = (e) => {
      const n = drag; drag = null; pan = null; sujo = true; guardar();
      if (n && !moved) { SFX.play('click'); if (opt.onOpen) opt.onOpen(); M.openItem(n.id); }
    };
    cv.onpointercancel = () => { drag = null; pan = null; sujo = true; }; // o navegador tomou o gesto (toque): solta o que estava preso
    cv.onpointerleave = () => { if (!drag) { hover = null; tip.hidden = true; sujo = true; } };
    // aproxima ou afasta mantendo parado o ponto (sx, sy) da tela; fitted = 2 impede o ajuste automático de desfazer o zoom da pessoa
    const zoom = (f, sx, sy) => {
      const k = Math.min(5, Math.max(0.2, cam.k * f));
      cam.x = sx - ((sx - cam.x) / cam.k) * k; cam.y = sy - ((sy - cam.y) / cam.k) * k; cam.k = k; fitted = 2; sujo = true;
    };
    cv.onwheel = (e) => {
      e.preventDefault();
      const b = cv.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - b.left, e.clientY - b.top);
    };
    zb.onclick = (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      SFX.play('click'); tip.hidden = true;
      if (b.dataset.z === 'fit') { fit(); fitted = 2; sujo = true; } else zoom(b.dataset.z === 'in' ? 1.3 : 1 / 1.3, W / 2, H / 2);
    };
    cv.ondblclick = (e) => { if (!pick(toWorld(e))) { fit(); sujo = true; } };

    resize(); loop();
    const api = { nodes, edges, fit: () => { fit(); sujo = true; }, toScreen: (n) => ({ x: cam.x + n.x * cam.k, y: cam.y + n.y * cam.k }) };
    host._g = api; // usado pelas capturas de tela do vídeo
    return api;
  };

  const legend = () => `<div class="g-leg">${M.TYPES.map((t) => `<span><i style="background:${t.color}"></i>${t.name.replace(' / PDF', '')}</span>`).join('')}</div>`;

  // painel lateral da tela inicial
  M.graphPanel = (el) => {
    const n = M.db.items.length;
    el.innerHTML = `<h4>🕸️ Conexões ${M.hint('Cada bolinha é um item da sua Biblioteca. Itens com etiquetas iguais, da mesma categoria ou que citam o título de outro (ou usam [[Título]]) ficam ligados. Passe o mouse para ver as ligações, clique para abrir, arraste e use a rodinha do mouse ou os botões ＋ e − para dar zoom.')}<a id="gFull">tela cheia ⛶</a></h4><p class="pg-dica">Cada bolinha é um item; as linhas mostram o que se relaciona. Clique para abrir.</p>
      ${n ? '<div class="g-box" id="gBox"></div>' : '<div class="empty" style="padding:22px">Guarde alguns itens para ver as conexões.</div>'}${legend()}`;
    if (n) M.graph(el.querySelector('#gBox'));
    el.querySelector('#gFull').onclick = M.graphFull;
  };

  M.graphFull = () => {
    SFX.play('click');
    const m = M.modal(`<div class="modal-h"><h2>🕸️ Mapa de conexões</h2><span class="g-count" id="gc"></span><button class="icon-btn" id="x" title="Fechar (Esc)" aria-label="Fechar">✕</button></div><div class="g-full" id="gF"></div>${legend()}`);
    m.classList.add('g-modal');
    const g = M.graph(m.querySelector('#gF'), { full: true, onOpen: M.closeModal });
    m.querySelector('#gc').textContent = `${g.nodes.length} itens · ${g.edges.length} ligações`;
    m.querySelector('#x').onclick = M.closeModal;
  };
})();
