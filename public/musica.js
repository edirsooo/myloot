// Música de fundo: trilhas instrumentais da pasta public/musica, ligadas e desligadas no botão 🔈 do topo.
// O navegador só deixa tocar som depois de um clique; se a música estava ligada, ela volta no primeiro clique.
(function () {
  let lista = null, i = 0, el = null;
  const pinta = (on) => {
    const b = M.$('#musBtn'); if (!b) return;
    b.textContent = on ? '🔊' : '🔈';
    b.classList.toggle('on', on);
    b.title = on ? 'Música de fundo ligada. Clique para desligar.' : 'Música de fundo desligada. Clique para ligar.';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  async function carrega() {
    if (lista) return lista;
    try { lista = (await (await fetch('/api/musicas')).json()).faixas || []; } catch (_) { lista = []; }
    for (let k = lista.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [lista[k], lista[j]] = [lista[j], lista[k]]; }
    return lista;
  }
  const vol = () => { const v = +(M.db && M.db.settings.musicaVol); return v > 0 ? Math.min(1, v) : 0.25; };
  const fonte = (L) => '/musica/' + encodeURIComponent(L[i]);
  async function toca() {
    const L = await carrega();
    if (!L.length) { M.toast('🎵 Ainda não há músicas. Coloque arquivos .mp3 na pasta public/musica do MyLoot.'); return false; }
    if (!el) {
      el = new Audio();
      el.onended = () => { i = (i + 1) % L.length; el.src = fonte(L); el.play().catch(() => {}); };
      el.src = fonte(L);
    }
    el.volume = vol();
    try { await el.play(); return true; } catch (_) { return false; }
  }
  M.musica = {
    async ligar(salvar = true) { const ok = await toca(); pinta(ok); if (salvar && M.db) { M.db.settings.musica = ok; M.save(); } return ok; },
    desligar() { if (el) el.pause(); pinta(false); if (M.db) { M.db.settings.musica = false; M.save(); } },
    volume(v) { if (M.db) M.db.settings.musicaVol = v; if (el) el.volume = vol(); },
    ligada: () => !!(el && !el.paused),
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#musBtn')) return;
    if (M.musica.ligada()) M.musica.desligar(); else M.musica.ligar();
  });
  const volta = (e) => {
    document.removeEventListener('pointerdown', volta, true);
    if (e.target.closest && e.target.closest('#musBtn')) return;
    if (M.db && M.db.settings.musica && !M.musica.ligada()) M.musica.ligar(false);
  };
  document.addEventListener('pointerdown', volta, true);
})();
