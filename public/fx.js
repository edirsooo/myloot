// Efeitos visuais: fundo de cubos voxel flutuando + confete pixelado.
(function () {
  const bg = document.getElementById('bg'), fx = document.getElementById('fx');
  const bctx = bg.getContext('2d'), fctx = fx.getContext('2d');
  const FX = { confetti: true };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, cubes = [], parts = [], raf = 0;
  const COLORS = ['#ff7e00', '#ffb36b', '#8b5cf6', '#a78bfa', '#3ad7ff', '#3cffaa', '#ff7e00'];

  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    [bg, fx].forEach((c) => { c.width = W * d; c.height = H * d; });
    bctx.setTransform(d, 0, 0, d, 0, 0); fctx.setTransform(d, 0, 0, d, 0, 0);
    cubes = Array.from({ length: Math.max(8, Math.floor(W / 110)) }, () => ({
      x: Math.random() * W, y: Math.random() * H, s: 10 + Math.random() * 22, v: 0.08 + Math.random() * 0.22,
      c: COLORS[(Math.random() * COLORS.length) | 0], a: 0.05 + Math.random() * 0.12, w: Math.random() * 6.28,
    }));
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * k) | 0, g = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function iso(ctx, x, y, s, c, a) {
    ctx.globalAlpha = a;
    const h = s * 0.5;
    ctx.fillStyle = shade(c, 1.15); ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y - h); ctx.lineTo(x, y); ctx.lineTo(x - s, y - h); ctx.fill();
    ctx.fillStyle = shade(c, 0.8); ctx.beginPath(); ctx.moveTo(x - s, y - h); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y + h); ctx.fill();
    ctx.fillStyle = shade(c, 0.55); ctx.beginPath(); ctx.moveTo(x + s, y - h); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x + s, y + h); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function frame(t) {
    bctx.clearRect(0, 0, W, H);
    for (const q of cubes) {
      if (!still) { q.y -= q.v; q.x += Math.sin(t / 2500 + q.w) * 0.15; }
      if (q.y < -q.s * 2) { q.y = H + q.s * 2; q.x = Math.random() * W; }
      iso(bctx, q.x, q.y, q.s, q.c, q.a);
    }
    fctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.life--;
      fctx.globalAlpha = Math.max(0, Math.min(1, p.life / 25));
      fctx.fillStyle = p.c; fctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      fctx.fillStyle = 'rgba(0,0,0,.25)'; fctx.fillRect(Math.round(p.x), Math.round(p.y) + p.s - 2, p.s, 2);
      if (p.life <= 0 || p.y > H + 20) parts.splice(i, 1);
    }
    fctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  FX.burst = function (x, y, n, power) {
    if (!FX.confetti) return;
    x = x == null ? W / 2 : x; y = y == null ? H * 0.35 : y; n = n || 60; power = power || 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * power;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.6, s: 5 + ((Math.random() * 3) | 0) * 2, c: COLORS[(Math.random() * COLORS.length) | 0], life: 70 + Math.random() * 50 });
    }
  };
  FX.rain = function () {
    if (!FX.confetti) return;
    for (let i = 0; i < 90; i++) parts.push({ x: Math.random() * W, y: -10 - Math.random() * 200, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 3, s: 6 + ((Math.random() * 3) | 0) * 2, c: COLORS[(Math.random() * COLORS.length) | 0], life: 160 });
  };
  // "+10 XP" flutuando
  FX.float = function (text, x, y, color) {
    const e = document.createElement('div');
    e.textContent = text;
    e.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9998;font:700 16px JBMono,monospace;color:${color || '#3cffaa'};text-shadow:0 2px 0 #000a;pointer-events:none;transition:transform .9s ease-out,opacity .9s;transform:translate(-50%,0)`;
    document.body.appendChild(e);
    requestAnimationFrame(() => { e.style.transform = 'translate(-50%,-50px)'; e.style.opacity = '0'; });
    setTimeout(() => e.remove(), 1000);
  };
  addEventListener('resize', size);
  size(); raf = requestAnimationFrame(frame);
  window.FX = FX;
})();
