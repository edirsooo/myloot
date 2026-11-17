// Aviso de versão nova do MyLoot e atualização com um clique (a pasta data/ nunca é tocada).
(function () {
  const { esc, $ } = M;

  M.checarAtualizacao = async (manual) => {
    let r;
    try { r = await M.api('/api/atualizacao' + (manual ? '?forcar=1' : '')); } catch (e) { if (manual) M.toast('⚠️ ' + e.message); return; }
    if (r.erro) { if (manual) M.toast('⚠️ Não consegui olhar o GitHub: ' + r.erro); return; }
    if (!r.temNova) { if (manual) { SFX.play('coin'); M.toast(`✅ Você já está na versão mais nova (${r.atual}).`); } return; }
    if (!manual && M.db.settings.updPulada === r.nova) return;
    const nums = (x) => String(x || '0').split('.').map((n) => parseInt(n, 10) || 0);
    const acima = (x, y) => { const a = nums(x), b = nums(y); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); return false; };
    r.novidades = (r.novidades || []).concat(...Object.keys(r.historico || {}).filter((v) => acima(v, r.atual)).sort((x, y) => (acima(x, y) ? -1 : 1)).map((v) => r.historico[v]));
    // versão só com correções não tem lista própria: mostra os destaques da última versão com novidades
    let titLista = 'O que tem de novo:';
    if (!r.novidades.length) { const ult = Object.keys(r.historico || {}).sort((x, y) => (acima(x, y) ? -1 : 1))[0]; if (ult) { r.novidades = r.historico[ult]; titLista = 'Destaques do MyLoot:'; } }
    if (M.modalOpen() && !manual) { setTimeout(() => M.checarAtualizacao(false), 15000); return; }
    const m = M.modal(`<div class="modal-h"><h2>🎁 Saiu o MyLoot ${esc(r.nova)}</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><p style="margin:0;color:var(--dim)">Você está na versão ${esc(r.atual)}. ${titLista}</p>
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
    if (s.versaoVista === v.versao) return false;
    const jaUsava = s.versaoVista || s.aiSetupDone; // instalação nova não precisa do resumo
    s.versaoVistaAntes = s.versaoVista; s.versaoVista = v.versao; M.save();
    // junta as novidades de todas as versões que a pessoa pulou (ex.: da 2.3 direto para a 2.4.1)
    const num = (x) => String(x || '0').split('.').map((n) => parseInt(n, 10) || 0);
    const maior = (x, y) => { const a = num(x), b = num(y); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); return false; };
    const lista = (v.novidades || []).slice();
    Object.keys(v.historico || {}).sort((x, y) => (maior(x, y) ? -1 : 1)).forEach((ver) => { if (!s.versaoVistaAntes || maior(ver, s.versaoVistaAntes)) lista.push(...v.historico[ver]); });
    v.novidades = lista;
    if (!jaUsava || !(v.novidades || []).length) return false;
    const abrir = () => {
      if (M.modalOpen()) return setTimeout(abrir, 1500);
      const m = M.modal(`<div class="modal-h"><h2>🎉 MyLoot atualizado: versão ${esc(v.versao)}</h2><button class="icon-btn" id="x">✕</button></div>
        <div class="modal-b"><p style="margin:0;color:var(--dim)">Olha o que entrou agora:</p>${M.listaNovidades(v.novidades)}
        <div class="row" style="justify-content:flex-end"><button class="btn" id="ok" style="flex:none">Bora usar! 🚀</button></div></div>`, { small: true, onClose: () => { if (!M.db.settings.aiSetupDone) setTimeout(M.iaSetup, 300); } });
      SFX.play('ach'); FX.burst(null, null, 60, 9);
      $('#x', m).onclick = M.closeModal; $('#ok', m).onclick = M.closeModal;
    };
    abrir();
    return true;
  };

  M.versaoSection = () => `<section class="stat"><div class="cfg-h">Versão</div>
    <div class="cfg-row"><span class="l">MyLoot <span id="verAtual" style="font:700 12px var(--mono)">…</span> ${M.hint('O app olha o GitHub quando abre e avisa quando sai versão nova. A atualização troca só os arquivos do app: seus itens, anexos e chaves (pasta data) ficam como estão.')}</span><button class="btn ghost sm" id="verChk" style="flex:none">🔎 Procurar atualização</button></div></section>`;
  M.versaoBind = () => {
    M.api('/api/versao').then((v) => { const e = $('#verAtual'); if (e) e.textContent = 'v' + v.versao; }).catch(() => {});
    const b = $('#verChk'); if (b) b.onclick = () => { M.toast('🔎 Olhando o GitHub…'); M.checarAtualizacao(true); };
  };
})();
