// Usar no celular: libera o MyLoot na rede Wi-Fi de casa, protegido por um código.
// Desligado por padrão (o servidor só aceita o próprio computador). Ligado, quem não é o próprio PC
// precisa entrar uma vez pelo QR Code (que leva um token) ou digitando o código de 6 números.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

module.exports = function (DATA) {
  const ARQ = path.join(DATA, 'rede.json');
  const cfg = { on: false, token: '', pin: '' };
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(ARQ, 'utf8'))); } catch (_) {}
  const salvar = () => { const t = ARQ + '.tmp'; fs.writeFileSync(t, JSON.stringify(cfg)); fs.renameSync(t, ARQ); };
  const novoCodigo = () => { cfg.token = crypto.randomBytes(16).toString('hex'); cfg.pin = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); salvar(); };

  // IPs desta máquina na rede (os de casa primeiro)
  function ips() {
    const L = [];
    for (const lista of Object.values(os.networkInterfaces())) for (const i of lista || []) {
      if ((i.family === 'IPv4' || i.family === 4) && !i.internal && !i.address.startsWith('169.254.')) L.push(i.address);
    }
    const casa = (a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a) ? 0 : 1;
    return L.sort((a, b) => casa(a) - casa(b));
  }

  const loopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  function hostOk(host) {
    if (host === '127.0.0.1' || host === 'localhost') return true;
    if (!cfg.on) return false;
    return ips().includes(host) || host === os.hostname().toLowerCase() + '.local' || /\.ts\.net$/i.test(host);
  }
  const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const cookie = (req) => ((req.headers.cookie || '').match(/(?:^|;\s*)myloot=([a-f0-9]{32})/) || [])[1] || '';
  const autorizado = (req) => loopback(req) || (cfg.on && !!cfg.token && igual(cookie(req), cfg.token));

  // tentativas erradas do código: 8 erros seguidos travam esse aparelho por 15 minutos
  const erros = new Map();
  function tentar(req, pin) {
    const ip = req.socket.remoteAddress, e = erros.get(ip) || { n: 0, ate: 0 };
    if (e.ate > Date.now()) return 'travado';
    if (cfg.on && cfg.pin && igual(String(pin || '').replace(/\D/g, ''), cfg.pin)) { erros.delete(ip); return 'ok'; }
    e.n++; if (e.n >= 8) { e.n = 0; e.ate = Date.now() + 15 * 60e3; }
    erros.set(ip, e); return 'errado';
  }
  const setCookie = () => `myloot=${cfg.token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`;

  function paginaEntrar(msg) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar no MyLoot</title>
<link rel="icon" href="/icon.png"><meta name="theme-color" content="#070b18">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b18;color:#eaeeff;font:16px system-ui,sans-serif;padding:20px}
.c{width:min(360px,100%);background:#0e1630;border:2px solid #2a3d6b;border-radius:18px;padding:26px;text-align:center;box-shadow:0 6px 0 #04070f}
img{width:72px;image-rendering:pixelated}h1{font-size:20px;margin:10px 0 4px}p{color:#9aa3c9;margin:0 0 18px;font-size:14px}
input{width:100%;box-sizing:border-box;font:700 28px monospace;letter-spacing:8px;text-align:center;padding:12px;border-radius:12px;border:2px solid #2a3d6b;background:#070b18;color:#fff}
button{margin-top:14px;width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(#ff9a2e,#ff7e00);color:#1a0d00;font:700 16px system-ui;cursor:pointer}
.m{color:#ff486e;font-weight:600;margin-top:12px;min-height:1em}</style></head><body>
<form class="c" method="post" action="/entrar"><img src="/icon.png" alt=""><h1>Entrar no MyLoot</h1>
<p>Digite o código de 6 números que aparece no computador, em Configurações → Usar no celular.</p>
<input name="pin" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required autofocus placeholder="000000">
<button>Entrar</button><div class="m">${msg || ''}</div></form></body></html>`;
  }

  return {
    cfg, ips, loopback, hostOk, autorizado, tentar, setCookie, paginaEntrar,
    host: () => (cfg.on ? '0.0.0.0' : '127.0.0.1'),
    tokenOk: (t) => cfg.on && !!cfg.token && igual(t, cfg.token),
    ligar(on) { cfg.on = !!on; if (cfg.on && !cfg.token) novoCodigo(); else salvar(); },
    trocar() { novoCodigo(); },
    status(porta) {
      const L = ips();
      return { on: cfg.on, pin: cfg.on ? cfg.pin : '', ips: L, porta, link: cfg.on && L[0] ? `http://${L[0]}:${porta}/entrar?c=${cfg.token}` : '' };
    },
  };
};
