// Mascotes da página: cada seção é um palco com o seu bichinho voxel (desenho em voxel.js, o mesmo do app).
// Dá para pegar e arrastar (mouse ou toque), balançar, chacoalhar até ficar tonto, soltar em cima dos quadros,
// fazer carinho com um clique e, pelo teclado: Enter comemora, setas andam e pulam.
// <section data-palco="claude"> ou data-palco="claude,gpt,..."; superfícies com [data-piso]; falas em data-fala.
(function () {
  const V = window.Voxel;
  if (!V) return;
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOMES = { claude: 'Claude', gpt: 'GPT', gemini: 'Gemini', pinguim: 'Pinguim', coruja: 'Coruja', slime: 'Slime' };
  const MENINA = { claude: 1, gpt: 1, gemini: 1 };
  const flex = (txt, k) => String(txt).replace(/\{o\}/g, MENINA[k] ? 'a' : 'o');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const um = (L) => L[(Math.random() * L.length) | 0];
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const F = {
    pega: ['Ei!', 'Uooou!', 'Me leva!', 'Opa!'], chacoalha: ['Eita!', 'Paraaa!', 'Vou ficar tont{o}!'], tonto: ['Tudo girando…', 'Tô tont{o}…'],
    chao: ['Ufa!', 'Chão firme.', 'Pousei!'], quadro: ['Cantinho novo!', 'Gostei daqui.', 'Boa vista!'], carinho: ['Hehe!', 'Mais um!', 'Gosto de você!', 'Oba!'],
    festa: ['Isso!', 'Bora!', 'Uhuu!', 'Mandou bem!'], oi: ['Oi!', 'Olá!', 'Oi, oi!', 'Chegamos!', 'Boas-vindas!', 'Bora!'],
  };
  const palcos = [], estado = { pausado: false };

  function Palco(sec) {
    this.sec = sec;
    this.ks = sec.dataset.palco.split(',').map((s) => s.trim()).filter((k) => V.MOD[k]);
    this.ativo = false; this.raf = 0; this.ult = 0; this.lista = null; this.listaT = 0;
    this.camada = document.createElement('div'); this.camada.className = 'palco';
    sec.appendChild(this.camada);
    this.pets = this.ks.map((k, i) => new Pet(this, k, i));
    this.visto = false;
  }
  Palco.prototype.dims = function () { return { w: this.sec.clientWidth, h: this.sec.clientHeight }; };
  Palco.prototype.chao = function () { return this.sec.clientHeight - (parseFloat(getComputedStyle(this.sec).getPropertyValue('--chao')) || 10); };
  // superfícies em coordenadas da seção: topo de cada [data-piso] e o chão
  Palco.prototype.superficies = function () {
    const now = performance.now();
    if (this.lista && now - this.listaT < 150) return this.lista;
    const sr = this.sec.getBoundingClientRect(), out = [];
    this.sec.querySelectorAll('[data-piso]').forEach((e) => {
      if (!e.offsetParent && e.tagName !== 'BODY') return;
      const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 8) return;
      out.push({ el: e, l: r.left - sr.left, r: r.right - sr.left, y: r.top - sr.top });
    });
    out.push({ el: null, l: 0, r: sr.width, y: this.chao() });
    this.lista = out; this.listaT = now; return out;
  };
  Palco.prototype.liga = function (on) {
    if (on === this.ativo) return; this.ativo = on;
    if (on) {
      this.lista = null; this.ult = performance.now();
      const passo = (now) => { this.raf = requestAnimationFrame(passo); this.quadro(now); };
      this.raf = requestAnimationFrame(passo);
      if (!this.visto) { this.visto = true; this.pets.forEach((p) => p.chega()); }
    } else cancelAnimationFrame(this.raf);
  };
  Palco.prototype.quadro = function (now) {
    const dt = Math.min(0.05, (now - this.ult) / 1000 || 0); this.ult = now;
    for (const p of this.pets) p.passo(dt, now);
  };
  Palco.prototype.festa = function (grande) { this.pets.forEach((p, i) => setTimeout(() => p.festa(2.2, grande && i === 0, um(F.festa)), i * 90)); };

  function Pet(palco, k, i) {
    this.palco = palco; this.k = k; this.i = i;
    const n = palco.ks.length;
    this.U = 0; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = i % 2 ? 1 : -1;
    this.modo = 'espera'; this.surf = null; this.tm = rnd(1, 3); this.alvo = 0; this.esp = 0; this.ang = 0; this.av = 0;
    this.tonto = 0; this.tontoPend = false; this.festaT = 0; this.solto = false; this.quiques = 0; this.pulo = null; this.ultPulo = 0;
    this.aceno = 0; this.olhar = { x: 0, y: 0 }; this.seg = null; this.hist = []; this.mvx = 0; this.par = i % 2;
    this.fracao = n > 1 ? (i + 0.5) / n : parseFloat(palco.sec.dataset.inicio || '0.8');
    const el = (this.el = document.createElement('div')); el.className = 'pet';
    el.innerHTML = '<canvas aria-hidden="true"></canvas><button type="button" class="pet-hit"></button><div class="pet-fala" hidden></div>';
    palco.camada.appendChild(el);
    this.cv = el.children[0]; this.c2 = this.cv.getContext('2d'); this.hit = el.children[1]; this.balao = el.children[2];
    this.hit.setAttribute('aria-label', NOMES[k] + ', mascote. Clique para carinho, arraste para levar. Teclado: Enter comemora, setas andam e pulam.');
    this.mede(); this.eventos();
    el.hidden = true;
  }
  const P = Pet.prototype;
  P.alt = function () { return V.TOPO[this.k] * this.U; };
  P.meia = function () { return V.LARG[this.k] * this.U / 2; };
  P.mede = function () {
    const s = parseFloat(this.palco.sec.dataset.tam || '1'), w = innerWidth;
    this.U = (w < 560 ? 2.7 : w < 1000 ? 3.3 : 4) * s;
    const U = this.U; this.CW = Math.ceil(30 * U); this.CH = Math.ceil(34 * U); this.BASE = Math.ceil(5 * U);
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = this.CW * this.dpr; this.cv.height = this.CH * this.dpr;
    this.cv.style.cssText = `width:${this.CW}px;height:${this.CH}px;left:${-this.CW / 2}px;top:${-(this.CH - this.BASE)}px`;
    const hw = V.LARG[this.k] * U, hh = V.TOPO[this.k] * U;
    this.hit.style.cssText = `left:${-hw / 2}px;top:${-hh}px;width:${hw}px;height:${hh}px`;
  };
  P.poe = function () { this.el.style.transform = `translate(${this.x.toFixed(1)}px,${(this.y - this.salto()).toFixed(1)}px)`; };
  P.salto = function () { return this.festaT > 0 && this.surf && !calmo ? Math.abs(Math.sin(performance.now() / 125)) * 4 * this.U : 0; };

  // chega: cai do alto da seção (com um pouco de atraso para cada um) e acena
  P.chega = function () {
    const { w } = this.palco.dims(); this.el.hidden = false;
    this.x = lim(w * this.fracao, this.meia() + 4, w - this.meia() - 4);
    const L = this.palco.superficies(), s = this.palco.sec.dataset.chega === 'chao' ? L[L.length - 1] : L.filter((o) => this.x >= o.l && this.x <= o.r).sort((a, b) => a.y - b.y)[0];
    if (calmo) { this.pousa(s || this.palco.superficies().slice(-1)[0], true); this.aceno = 1.5; return; }
    this.y = Math.max(this.alt() + 4, (s ? s.y : this.palco.chao()) - 340); this.alvoChega = s; this.vx = this.vy = 0;
    this.modo = 'espera'; this.tm = 0.15 + this.i * 0.22; this.chegando = true;
  };
  P.diz = function (txt, ms) {
    const b = this.balao; b.textContent = flex(txt, this.k); b.hidden = false;
    const { w } = this.palco.dims(), meia = b.offsetWidth / 2 + 6;
    b.style.bottom = (this.alt() + 10) + 'px';
    b.style.marginLeft = (lim(this.x, meia, w - meia) - this.x) + 'px';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(this.tFala); this.tFala = setTimeout(() => { b.hidden = true; }, ms || 2200);
  };
  P.festa = function (s, grande, fala) {
    this.festaT = Math.max(this.festaT, s); if (this.modo === 'anda' || this.modo === 'senta') { this.modo = 'parado'; this.tm = 2; }
    if (fala) this.diz(fala);
    if (grande) confete(this.palco.sec, this.x, this.y - this.alt());
  };
  P.carinho = function () {
    this.festa(0.9);
    coracao(this.palco.camada, this.x, this.y - this.alt() - 6);
    if (Math.random() < 0.7) this.diz(um(F.carinho));
    this.palco.sec.dispatchEvent(new CustomEvent('pet:carinho', { detail: this }));
  };
  P.pousa = function (s, quieto) {
    this.surf = s; this.y = s.y; this.vx = this.vy = 0; this.modo = 'parado'; this.tm = rnd(1.2, 3); this.esp = quieto ? 0.2 : 0.45; this.quiques = 0; this.pulo = null;
    this.el.classList.remove('pego');
    if (this.chegando) { this.chegando = false; this.aceno = 1.6; if (this.palco.ks.length > 1 || Math.random() < 0.9) setTimeout(() => this.diz(this.palco.ks.length > 1 ? F.oi[this.i % F.oi.length] : (this.palco.sec.dataset.oi || 'Oi!'), 1800), 120 + this.i * 110); }
    else if (this.tontoPend) { this.tonto = 3; this.tontoPend = false; this.diz(um(F.tonto)); }
    else if (this.solto) this.reage(s);
    this.solto = false;
  };
  P.reage = function (s) {
    const e = s.el; let f = F.chao;
    if (e) {
      f = e.dataset.fala ? e.dataset.fala.split('|') : F.quadro;
      e.classList.remove('pisou'); void e.offsetWidth; e.classList.add('pisou'); setTimeout(() => e.classList.remove('pisou'), 500);
      if (e.matches('[data-tela]')) e.click();
      if (e.hasAttribute('data-festa')) this.festa(2, true);
    }
    this.diz(um(f));
    this.palco.sec.dispatchEvent(new CustomEvent('pet:pousou', { detail: { pet: this, el: e } }));
  };
  P.atualiza = function (s) {
    if (!s.el) { s.y = this.palco.chao(); s.l = 0; s.r = this.palco.dims().w; return true; }
    if (!s.el.isConnected || !s.el.offsetParent) return false;
    const sr = this.palco.sec.getBoundingClientRect(), r = s.el.getBoundingClientRect();
    s.y = r.top - sr.top; s.l = r.left - sr.left; s.r = r.right - sr.left; return r.width > 0;
  };
  P.cai = function (dt) {
    const m = this.meia(), y0 = this.y, { w } = this.palco.dims();
    this.vy += 2300 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx) * 0.5; } else if (this.x > w - m) { this.x = w - m; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.vy < 0 && this.y < this.alt()) { this.y = this.alt(); this.vy = Math.abs(this.vy) * 0.4; }
    if (this.vy <= 0) return;
    let s = null; for (const o of (this.chegando && this.alvoChega ? [this.alvoChega] : this.palco.superficies())) if (this.x >= o.l - 2 && this.x <= o.r + 2 && y0 <= o.y + 1 && this.y >= o.y && (!s || o.y < s.y)) s = o;
    if (!s) { if (this.y > this.palco.chao()) s = this.palco.superficies().slice(-1)[0]; else return; }
    this.y = s.y;
    if (this.vy > 560 && this.quiques < 2) { this.vy = -this.vy * 0.32; this.vx *= 0.6; this.quiques++; this.esp = 0.4; }
    else this.pousa(s);
  };
  P.pula = function (o, x1) {
    const d = Math.hypot(x1 - this.x, o.y - this.y);
    this.pulo = { x0: this.x, y0: this.y, x1, o, t: 0, T: lim(d / 620, 0.38, 0.85), h: 46 + Math.max(0, this.y - o.y) * 0.3 };
    this.modo = 'pulo'; this.surf = null; this.ultPulo = performance.now(); if (Math.abs(x1 - this.x) > 4) this.dir = x1 > this.x ? 1 : -1; this.esp = 0.3;
  };
  P.voa = function (dt) {
    const j = this.pulo; if (!j || !this.atualiza(j.o)) { this.modo = 'cai'; this.vx = this.vy = 0; return; }
    j.t += dt; const k = Math.min(1, j.t / j.T);
    this.x = j.x0 + (lim(j.x1, j.o.l + 4, j.o.r - 4) - j.x0) * k; this.y = j.y0 + (j.o.y - j.y0) * k - 4 * j.h * k * (1 - k);
    if (k >= 1) { this.pousa(j.o, true); if (j.reage) this.reage(j.o); }
  };
  P.pensa = function (dt, now) {
    let s = this.surf; const m = this.meia();
    if (!s || !this.atualiza(s)) { this.surf = null; this.modo = 'cai'; this.vx = this.vy = 0; return; }
    this.y = s.y;
    let l = s.l + m * 0.6, r = s.r - m * 0.6; if (r < l) l = r = (s.l + s.r) / 2;
    if (this.x < s.l - 24 || this.x > s.r + 24) { this.surf = null; this.modo = 'cai'; this.vx = this.vy = 0; return; }
    this.x = lim(this.x, l, r);
    if (this.tonto > 0) { this.tonto -= dt; return; }
    if (this.festaT > 0 || this.aceno > 0) return;
    if (estado.pausado && (this.modo === 'anda' || this.modo === 'jeito')) this.modo = 'parado';
    if (this.modo === 'anda') {
      const dx = this.alvo - this.x;
      if (Math.abs(dx) < 3) { this.modo = 'parado'; this.tm = rnd(1.5, 4); } else { this.dir = dx > 0 ? 1 : -1; this.x = lim(this.x + this.dir * 50 * dt, l, r); if (this.x === l || this.x === r) this.alvo = this.x; }
      return;
    }
    this.tm -= dt; if (this.tm > 0) return;
    if (calmo || estado.pausado) { this.modo = 'parado'; this.tm = 2; return; }
    const z = Math.random(), jeito = this.palco.sec.dataset.jeito;
    if (z < 0.4 && r - l > 30) { this.modo = 'anda'; this.alvo = rnd(l, r); }
    else if (z < 0.58) { this.modo = jeito ? 'jeito' : 'senta'; this.tm = rnd(3, 6); }
    else if (z < 0.72) { this.modo = 'senta'; this.tm = rnd(3, 7); }
    else if (z < 0.86 && now - this.ultPulo > 5000) {
      const L = this.palco.superficies().filter((o) => o !== s && o.el !== (s && s.el) && o.r - o.l > m * 2.5 && Math.abs((o.l + o.r) / 2 - this.x) < 520);
      if (L.length) { const o = um(L); this.pula(o, rnd(o.l + m, o.r - m)); } else { this.modo = 'parado'; this.tm = 2; }
    } else { this.modo = 'parado'; this.tm = rnd(2, 4); }
  };
  // ----- pegar, balançar, chacoalhar e soltar -----
  P.local = function (e) { const r = this.palco.sec.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  P.segura = function (dt) {
    const { w, h } = this.palco.dims(), tx = lim(this.mx, this.meia(), w - this.meia()), ty = lim(this.my + this.alt() * 0.82, this.alt(), h), k = Math.min(1, dt * 24);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    const alvo = lim(-this.mvx * 0.0011, -1.1, 1.1);
    this.av += ((alvo - this.ang) * 70 - this.av * 5) * dt; this.ang += this.av * dt; this.mvx *= Math.exp(-dt * 8);
  };
  P.ativa = function () {
    this.seg.ativo = true; this.surf = null; this.modo = 'parado'; this.tonto = 0; this.festaT = 0; this.aceno = 0; this.el.classList.add('pego');
    if (Math.random() < 0.5) this.diz(um(F.pega), 1200);
  };
  P.larga = function (semJogar) {
    const s = this.seg; if (!s) return; this.seg = null;
    try { this.hit.releasePointerCapture(s.id); } catch (_) {}
    if (!s.ativo) { if (!semJogar && performance.now() - s.t0 < 450) this.carinho(); return; }
    let vx = 0, vy = 0; const h = this.hist, now = performance.now(), a = h.find((p) => now - p.t < 110), b = h[h.length - 1];
    if (!semJogar && a && b && b.t - a.t > 8) { vx = (b.x - a.x) / (b.t - a.t) * 1000; vy = (b.y - a.y) / (b.t - a.t) * 1000; }
    this.vx = lim(vx, -1600, 1600); this.vy = lim(vy, -1600, 1600); this.modo = 'cai'; this.surf = null; this.solto = true; this.quiques = 0; this.palco.lista = null;
  };
  P.eventos = function () {
    const hit = this.hit;
    hit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.seg) return;
      e.preventDefault(); try { hit.setPointerCapture(e.pointerId); } catch (_) {}
      const p = this.local(e), now = performance.now();
      this.mx = p.x; this.my = p.y; this.mvx = 0; this.hist = [{ x: p.x, y: p.y, t: now }];
      this.seg = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, ativo: false, sinal: 0, viradas: [] };
      this.chegando = false; if (this.modo === 'espera') this.modo = 'cai';
    });
    hit.addEventListener('pointermove', (e) => {
      const s = this.seg; if (!s || e.pointerId !== s.id) return;
      const p = this.local(e), now = performance.now(), u = this.hist[this.hist.length - 1], dtm = Math.max(1, now - u.t), vx = (p.x - u.x) / dtm * 1000;
      this.mx = p.x; this.my = p.y; this.mvx = this.mvx * 0.5 + vx * 0.5;
      this.hist.push({ x: p.x, y: p.y, t: now }); if (this.hist.length > 12) this.hist.shift();
      if (!s.ativo && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > 6) this.ativa();
      if (s.ativo && Math.abs(vx) > 650 && Math.sign(vx) !== s.sinal) {
        s.sinal = Math.sign(vx); s.viradas.push(now); s.viradas = s.viradas.filter((t) => now - t < 1400);
        if (s.viradas.length >= 6 && !this.tontoPend) { this.tontoPend = true; this.diz(um(F.chacoalha), 1500); }
      }
    });
    hit.addEventListener('pointerup', () => this.larga(false));
    hit.addEventListener('pointercancel', () => this.larga(true));
    hit.addEventListener('click', (e) => { if (e.detail === 0) { this.festa(1.6, true, um(F.festa)); } }); // Enter ou espaço pelo teclado
    hit.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); if (!this.surf) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.dir = e.key === 'ArrowRight' ? 1 : -1; const m = this.meia(), s = this.surf;
        const nx = this.x + this.dir * 36;
        if (nx < s.l || nx > s.r) { this.surf = null; this.modo = 'cai'; this.vx = this.dir * 260; this.vy = -300; this.solto = true; this.x = nx; }
        else { this.x = lim(nx, s.l + m * 0.6, s.r - m * 0.6); this.modo = 'parado'; this.tm = 3; }
      } else {
        // para cima: pula no quadro mais próximo acima; para baixo: desce para o de baixo
        const sobe = e.key === 'ArrowUp', L = this.palco.superficies().filter((o) => (sobe ? o.y < this.y - 10 : o.y > this.y + 10));
        L.sort((a, b) => Math.abs(a.y - this.y) + Math.abs((a.l + a.r) / 2 - this.x) * 0.3 - (Math.abs(b.y - this.y) + Math.abs((b.l + b.r) / 2 - this.x) * 0.3));
        if (L[0]) { const o = L[0]; this.pula(o, lim(this.x, o.l + this.meia(), o.r - this.meia())); this.pulo.reage = true; }
      }
    });
  };
  // ----- poses e desenho -----
  P.anim = function () {
    if (this.seg && this.seg.ativo) return 'pendurado';
    if (this.modo === 'cai' || this.modo === 'pulo' || (this.modo === 'espera' && this.chegando)) return 'cai';
    if (this.tonto > 0) return 'tonto';
    if (this.festaT > 0) return 'festa';
    if (this.aceno > 0) return 'aceno';
    if (this.modo === 'anda') return 'anda';
    if (this.modo === 'jeito') return this.palco.sec.dataset.jeito;
    return this.modo === 'senta' ? 'senta' : 'parado';
  };
  P.desenha = function (a, t) {
    const U = this.U, c = this.c2, o = { lx: this.olhar.x, ly: this.olhar.y, beira: !!(this.surf && this.surf.el), tonto: this.tontoPend };
    const p = V.pose(a, t, o), L = V.ordena(V.MOD[this.k](p, t)), chao = this.CH - this.BASE, oy = chao + V.apoio(L) * U, ox = this.CW / 2 - 3.5 * V.KX * U, pend = this.seg && this.seg.ativo;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.CW, this.CH);
    if (this.surf && !this.salto()) { c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(this.CW / 2, chao - U * 0.15, V.LARG[this.k] * U * 0.5, U * 0.55, 0, 0, 6.3); c.fill(); }
    for (const b of L) V.caixa(c, b, U, ox, oy);
    const e = this.esp, sx = (1 + e * 0.5) * -this.dir, sy = 1 - e * 0.45;
    this.cv.style.transformOrigin = `50% ${pend ? chao - V.TOPO[this.k] * U * 0.85 : chao}px`;
    this.cv.style.transform = `rotate(${(this.ang + (pend ? 0 : p.incl)).toFixed(3)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
  };
  P.passo = function (dt, now) {
    if (this.el.hidden) return;
    if (this.seg && !this.seg.ativo && now - this.seg.t0 > 220) this.ativa();
    if (this.seg && this.seg.ativo) this.segura(dt);
    else {
      if (this.modo === 'espera') { this.tm -= dt; if (this.tm <= 0) { this.modo = 'cai'; this.vy = 0; } }
      else if (this.modo === 'cai') this.cai(dt); else if (this.modo === 'pulo') this.voa(dt); else if (!this.seg) this.pensa(dt, now);
      this.ang += (0 - this.ang) * Math.min(1, dt * 9); this.av = 0;
    }
    if (this.festaT > 0) this.festaT -= dt;
    if (this.aceno > 0) this.aceno -= dt;
    this.esp += (0 - this.esp) * Math.min(1, dt * 9);
    const m = cursor.dentro(this.palco.sec);
    if (m) { this.olhar.x += (lim((m.x - this.x) / 240, -1, 1) * -this.dir - this.olhar.x) * 0.2; this.olhar.y += (lim((this.y - this.alt() * 0.6 - m.y) / 240, -1, 1) - this.olhar.y) * 0.2; }
    this.poe();
    const a = this.anim();
    this.par = !this.par; if (this.par || a === 'pendurado' || a === 'cai' || a === 'festa') this.desenha(a, now / 1000 + this.i * 0.37);
  };

  // cursor: para os olhos seguirem
  const cursor = { x: -1e4, y: -1e4, dentro(sec) { const r = sec.getBoundingClientRect(); return this.x < -1e3 ? null : { x: this.x - r.left, y: this.y - r.top }; } };
  addEventListener('pointermove', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; }, { passive: true });

  // ----- efeitos: coração e confete (somem sozinhos; nada com movimento reduzido) -----
  function coracao(cam, x, y) {
    if (calmo) return;
    const s = document.createElement('span'); s.className = 'coracao'; s.textContent = '❤'; s.style.left = x + 'px'; s.style.top = y + 'px';
    cam.appendChild(s); s.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 1 }, { transform: 'translate(-50%,-46px) scale(1.2)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => s.remove();
  }
  const CORES = ['#ff7e00', '#ffb36b', '#8f74ff', '#35d68a', '#ffd84a', '#2fc9a0', '#ff8fa3'];
  function confete(sec, x, y) {
    if (calmo) return;
    const cam = sec.querySelector('.palco');
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i'); s.className = 'confete'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = um(CORES);
      cam.appendChild(s);
      const a = rnd(-Math.PI, 0), v = rnd(90, 230), dx = Math.cos(a) * v, dy = Math.sin(a) * v;
      s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rnd(90, 360)}deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx * 1.3}px,${dy + 220}px) rotate(${rnd(360, 720)}deg)`, opacity: 0 }], { duration: rnd(1000, 1500), easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => s.remove();
    }
  }

  // ----- liga só os palcos que estão na tela -----
  function inicia() {
    document.querySelectorAll('[data-palco]').forEach((sec) => palcos.push(new Palco(sec)));
    const io = new IntersectionObserver((es) => es.forEach((e) => { const p = palcos.find((x) => x.sec === e.target); if (p) p.liga(e.isIntersecting); }), { rootMargin: '0px 0px -25% 0px' });
    palcos.forEach((p) => io.observe(p.sec));
    let tr = 0;
    addEventListener('resize', () => { clearTimeout(tr); tr = setTimeout(() => palcos.forEach((p) => { p.lista = null; p.pets.forEach((x) => { x.mede(); if (x.surf) { x.surf = null; x.modo = 'cai'; } }); }), 150); });
    addEventListener('scroll', () => palcos.forEach((p) => { p.lista = null; }), { passive: true });
  }
  window.Mascotes = { palcos, estado, confete, festa: (sec, grande) => { const p = palcos.find((x) => x.sec === sec); if (p) p.festa(grande); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicia); else inicia();
})();
