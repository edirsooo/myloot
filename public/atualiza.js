// Aviso de versão nova do MyLoot e atualização com um clique (a pasta data/ nunca é tocada).
(function () {
  const { esc, $ } = M;

  M.checarAtualizacao = async (manual) => {
    let r;
    try { r = await M.api('/api/atualizacao' + (manual ? '?forcar=1' : '')); } catch (e) { if (manual) M.toast('⚠️ ' + e.message); return; }
    if (r.erro) { if (manual) M.toast('⚠️ Não consegui olhar o GitHub: ' + r.erro); return; }
    if (!r.temNova) { if (manual) { SFX.play('coin'); M.toast(`✅ Você já está na versão mais nova (${r.atual}).`); } return; }
    if (!manual && M.db.settings.updPulada === r.nova) return;
    if (M.modalOpen() && !manual) { setTimeout(() => M.checarAtualizacao(false), 15000); return; }
    const m = M.modal(`<div class="modal-h"><h2>🎁 Saiu o MyLoot ${esc(r.nova)}</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><p style="margin:0;color:var(--dim)">Você está na versão ${esc(r.atual)}. O que tem de novo:</p>
      <ul style="margin:0;padding-left:20px;display:grid;gap:6px">${r.novidades.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      ${r.git ? '<p style="margin:0;color:var(--yellow,#ffbe46)">Esta pasta é uma cópia de desenvolvimento (Git). Atualize com <code>git pull</code>.</p>'
        : '<p style="margin:0;color:var(--dim)">Seus itens, anexos, tarefas e chaves ficam como estão: a atualização só troca os arquivos do app.</p>'}
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" id="dep" style="flex:none">Depois</button>${r.git ? '' : '<button class="btn" id="ok" style="flex:none">⬇️ Atualizar agora</button>'}</div></div>`, { small: true });
    const depois = () => { M.db.settings.updPulada = r.nova; M.save(); M.closeModal(); };
    $('#dep', m).onclick = depois; $('#x', m).onclick = depois;
    if (!r.git) $('#ok', m).onclick = () => aplicar(r.nova);
  };

  async function aplicar(nova) {
    const m = M.modal(`<div class="modal-b" style="text-align:center;padding:30px"><div style="font-size:40px">⬇️</div><h2 style="margin:8px 0">Atualizando o MyLoot…</h2><p style="color:var(--dim);margin:0" id="upMsg">Baixando a versão ${esc(nova)} do GitHub. Não feche esta aba.</p></div>`, { small: true });
    try { await M.api('/api/atualizacao/aplicar', { method: 'POST' }); }
    catch (e) { $('#upMsg', m).textContent = '⚠️ ' + e.message + ' Nada foi trocado.'; return; }
    $('#upMsg', m).textContent = 'Pronto! Reabrindo o app…';
    const ini = Date.now();
    const tenta = async () => {
      try { const r = await fetch('/api/ping', { cache: 'no-store' }).then((x) => x.json()); if (r.versao === nova) { location.reload(); return; } } catch (_) {}
      if (Date.now() - ini > 60000) { $('#upMsg', m).textContent = 'A atualização terminou, mas o app não reabriu sozinho. Feche esta aba e abra pelo atalho do MyLoot.'; return; }
      setTimeout(tenta, 1000);
    };
    setTimeout(tenta, 2000);
  }

  M.versaoSection = () => `<section class="stat"><div class="cfg-h">Versão</div>
    <div class="cfg-row"><span class="l">MyLoot <span id="verAtual" style="font:700 12px var(--mono)">…</span> ${M.hint('O app olha o GitHub quando abre e avisa quando sai versão nova. A atualização troca só os arquivos do app: seus itens, anexos e chaves (pasta data) ficam como estão.')}</span><button class="btn ghost sm" id="verChk" style="flex:none">🔎 Procurar atualização</button></div></section>`;
  M.versaoBind = () => {
    M.api('/api/versao').then((v) => { const e = $('#verAtual'); if (e) e.textContent = 'v' + v.versao; }).catch(() => {});
    const b = $('#verChk'); if (b) b.onclick = () => { M.toast('🔎 Olhando o GitHub…'); M.checarAtualizacao(true); };
  };
})();
