// Service worker mínimo: deixa o MyLoot ser instalado como app (tela inicial do celular ou do computador).
// Não guarda nada em cache: os dados moram no seu computador e o app sempre pega a versão mais nova.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
