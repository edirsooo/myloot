// Quem pode usar o MyLoot: só o próprio computador (127.0.0.1).
// Até a 2.27 havia "Usar no celular" (rede Wi-Fi de casa com QR Code e código); saiu na 2.28 a pedido do dono:
// o servidor nunca escuta na rede e não aceita visita de outro aparelho.
'use strict';

module.exports = function () {
  // "o próprio PC" = conexão local, endereço local e sem proxy na frente (com um proxy todo visitante chegaria como 127.0.0.1)
  const loopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && !req.headers['x-forwarded-for'] && !req.headers.forwarded
    && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(req.headers.host || '127.0.0.1'));
  const hostOk = (host) => host === '127.0.0.1' || host === 'localhost' || host === '::1';
  return { loopback, hostOk, autorizado: loopback, host: () => '127.0.0.1' };
};
