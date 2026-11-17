// Service worker mínimo: deixa o MyLoot ser instalado como app e receber o "Compartilhar" do celular.
// Não guarda nada em cache (os dados moram no seu computador e o app sempre pega a versão mais nova).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // "Compartilhar" do celular abre /?title=…&text=…&url=…: marca como "salvar" para o app abrir a janela de salvar
  if (e.request.mode === 'navigate' && u.pathname === '/' && !u.searchParams.has('salvar') && (u.searchParams.has('url') || u.searchParams.has('text'))) {
    u.searchParams.set('salvar', '1');
    e.respondWith(Response.redirect(u.href, 302));
  }
});
