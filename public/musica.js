// Música de fundo: trilhas da pasta public/musica num player leve no topo.
// Clicar no 🔈 (ou passar o mouse) abre um pop-up com tocar/pausar, faixa anterior/próxima e volume (começa em 20%).
// O navegador só deixa tocar som depois de um clique; se a música estava ligada, ela volta no primeiro clique.
(function () {
  let lista = null, i = 0, el = null;
  const $ = (s) => document.querySelector(s);
  const nomeDe = (f) => String(f || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const S = () => (M.db ? M.db.settings : {});
  // começa em 20%; só usa outro valor depois que a pessoa mexe na barra
  const vol = () => { const v = +S().musicaVol; return S().musicaVolMexeu && v >= 0 && v <= 1 ? v : 0.2; };

  async function carrega() {
    if (lista) return lista;
    try { lista = (await (await fetch('/api/musicas')).json()).faixas || []; } catch (_) { lista = []; }
    for (let k = lista.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [lista[k], lista[j]] = [lista[j], lista[k]]; }
    const ult = lista.indexOf(S().musicaFaixa); if (ult >= 0) i = ult;
    return lista;
  }
  function audio() {
    if (el) return el;
    el = new Audio(); el.preload = 'none';
    el.onended = () => troca(1);
    el.onplay = el.onpause = pinta;
    return el;
  }
  const fonte = () => '/musica/' + encodeURIComponent(lista[i]);
  function pinta() {
    const on = !!(el && !el.paused), b = $('#musBtn'); if (!b) return;
    b.textContent = on ? '🔊' : '🔈'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Música de fundo: ' + nomeDe(lista && lista[i]) : 'Música de fundo';
    const p = $('#musPlay'); if (p) { p.textContent = on ? '⏸' : '▶'; p.title = on ? 'Pausar' : 'Tocar'; }
    const n = $('#musNome'); if (n) n.textContent = lista && lista.length ? nomeDe(lista[i]) : 'Sem músicas na pasta';
    const v = $('#musVol'), pc = $('#musPct'); if (v && document.activeElement !== v) v.value = vol(); if (pc) pc.textContent = Math.round(vol() * 100) + '%';
    const c = $('#musCont'); if (c) c.textContent = lista && lista.length ? `${i + 1} de ${lista.length}` : '';
  }
  async function tocar(salvar = true) {
    const L = await carrega();
    if (!L.length) { M.toast('🎵 Ainda não há músicas. Coloque arquivos .mp3 na pasta public/musica do MyLoot.'); pinta(); return false; }
    const a = audio(); if (!a.src || !a.src.endsWith(fonte())) a.src = fonte();
    a.volume = vol();
    let ok = true; try { await a.play(); } catch (_) { ok = false; }
    if (salvar && M.db) { M.db.settings.musica = ok; M.db.settings.musicaFaixa = L[i]; M.save(); }
    pinta(); return ok;
  }
  function pausar() { if (el) el.pause(); if (M.db) { M.db.settings.musica = false; M.save(); } pinta(); }
  async function troca(passo) {
    const L = await carrega(); if (!L.length) return;
    i = (i + passo + L.length) % L.length;
    const a = audio(); a.src = fonte();
    if (M.db) { M.db.settings.musicaFaixa = L[i]; M.save(); }
    await tocar(true);
  }
  M.musica = {
    ligar: tocar, desligar: pausar, proxima: () => troca(1), anterior: () => troca(-1),
    volume(v) { if (M.db) { M.db.settings.musicaVol = v; M.db.settings.musicaVolMexeu = true; } if (el) el.volume = vol(); pinta(); },
    ligada: () => !!(el && !el.paused),
  };

  // ----- pop-up -----
  let fechaT = null, porHover = false;
  const pop = () => $('#musPop');
  async function abre(hover) {
    const p = pop(); if (!p) return;
    clearTimeout(fechaT); porHover = hover && p.hidden ? true : (p.hidden ? false : porHover);
    p.hidden = false; $('#musBtn').setAttribute('aria-expanded', 'true');
    await carrega(); pinta();
  }
  function fecha() { const p = pop(); if (!p) return; p.hidden = true; porHover = false; $('#musBtn').setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#musBtn');
    if (b) { if (pop().hidden || porHover) { porHover = false; abre(false); } else fecha(); return; }
    const m = e.target.closest('#musPop [data-m]');
    if (m) { const a = m.dataset.m; if (a === 'play') M.musica.ligada() ? pausar() : tocar(); else troca(a === 'prox' ? 1 : -1); return; }
    if (pop() && !pop().hidden && !e.target.closest('#mus')) fecha();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop() && !pop().hidden) fecha(); });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'musVol') return;
    M.musica.volume(+e.target.value);
    clearTimeout(M._musVolT); M._musVolT = setTimeout(() => M.save(), 400);
  });
  // passar o mouse abre; sair fecha (só quando foi aberto pelo mouse)
  const ligaHover = () => {
    const m = $('#mus'); if (!m || m._ok) return; m._ok = true;
    m.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) abre(true); });
    m.addEventListener('mouseleave', () => { if (porHover) fechaT = setTimeout(fecha, 350); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligaHover); else ligaHover();

  const volta = (e) => {
    document.removeEventListener('pointerdown', volta, true);
    if (e.target.closest && e.target.closest('#mus')) return;
    if (M.db && M.db.settings.musica && !M.musica.ligada()) tocar(false);
  };
  document.addEventListener('pointerdown', volta, true);
})();
