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
      ${M.listaNovidades(r.novidades)}
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

  // lista de novidades com o emoji em destaque (o versao.json já traz cada linha começando com emoji)
  M.listaNovidades = (L) => `<div class="novs">${(L || []).map((n) => {
    const m = String(n).match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
    return `<div class="nov"><span>${m ? m[1] : '✨'}</span><p>${esc(m ? m[2] : n)}</p></div>`;
  }).join('')}</div>`;

  // depois de atualizar: mostra uma vez o resumo do que entrou nesta versão
  M.mostrarNovidades = async () => {
    let v; try { v = await M.api('/api/versao'); } catch (_) { return; }
    const s = M.db.settings;
    if (s.versaoVista === v.versao) return;
    const jaUsava = s.versaoVista || s.aiSetupDone; // instalação nova não precisa do resumo
    s.versaoVista = v.versao; M.save();
    if (!jaUsava || !(v.novidades || []).length) return;
    const abrir = () => {
      if (M.modalOpen()) return setTimeout(abrir, 4000);
      const m = M.modal(`<div class="modal-h"><h2>🎉 MyLoot atualizado: versão ${esc(v.versao)}</h2><button class="icon-btn" id="x">✕</button></div>
        <div class="modal-b"><p style="margin:0;color:var(--dim)">Olha o que entrou agora:</p>${M.listaNovidades(v.novidades)}
        <div class="row" style="justify-content:flex-end"><button class="btn" id="ok" style="flex:none">Bora usar! 🚀</button></div></div>`, { small: true });
      SFX.play('ach'); FX.burst(null, null, 60, 9);
      $('#x', m).onclick = M.closeModal; $('#ok', m).onclick = M.closeModal;
    };
    setTimeout(abrir, 900);
  };

  M.versaoSection = () => `<section class="stat"><div class="cfg-h">Versão</div>
    <div class="cfg-row"><span class="l">MyLoot <span id="verAtual" style="font:700 12px var(--mono)">…</span> ${M.hint('O app olha o GitHub quando abre e avisa quando sai versão nova. A atualização troca só os arquivos do app: seus itens, anexos e chaves (pasta data) ficam como estão.')}</span><button class="btn ghost sm" id="verChk" style="flex:none">🔎 Procurar atualização</button></div></section>`;
  M.versaoBind = () => {
    M.api('/api/versao').then((v) => { const e = $('#verAtual'); if (e) e.textContent = 'v' + v.versao; }).catch(() => {});
    const b = $('#verChk'); if (b) b.onclick = () => { M.toast('🔎 Olhando o GitHub…'); M.checarAtualizacao(true); };
  };
})();
