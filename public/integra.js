// Enviar itens para o Notion e o Trello (as chaves ficam só neste computador, em data/segredos.json).
(function () {
  const { esc, $ } = M;
  let st = null; // status das integrações

  M.intStatus = async (force) => { if (!st || force) st = await M.api('/api/int/status'); return st; };

  M.sendItem = async (it, para) => {
    const s = await M.intStatus();
    if (!s[para].ok) { M.toast(`⚙️ Conecte o ${para === 'notion' ? 'Notion' : 'Trello'} nas Configurações primeiro`); return M.go('cfg'); }
    M.toast(`📤 Enviando para o ${para === 'notion' ? 'Notion' : 'Trello'}…`);
    try {
      const r = await M.api('/api/int/' + para + '/enviar', { method: 'POST', body: JSON.stringify({ id: it.id }) });
      it.sent = it.sent || {}; it.sent[para] = { url: r.url, at: Date.now() }; M.save();
      SFX.play('coin');
      M.toast(`✅ Enviado para o ${para === 'notion' ? 'Notion' : 'Trello'}`);
      if (r.url) setTimeout(() => { if (confirm('Enviado! Abrir lá agora?')) open(r.url, '_blank'); }, 50);
    } catch (e) { M.toast('⚠️ ' + e.message); }
  };

  M.sendMenu = (e, it) => M.ctxMenu(e, [
    { em: '📓', t: 'Enviar para o Notion', fn: () => M.sendItem(it, 'notion') },
    { em: '📋', t: 'Enviar para o Trello', fn: () => M.sendItem(it, 'trello') },
  ]);

  // ----- seção nas Configurações -----
  M.intSection = () => `<section class="stat" id="intSec"><div class="cfg-h">Integrações: Notion e Trello</div><div id="intBody"><small style="color:var(--dim)">Carregando…</small></div></section>`;

  M.intBind = async () => {
    const box = $('#intBody'); if (!box) return;
    const s = await M.intStatus(true);
    const dot = (ok) => `<span style="font:700 12px var(--mono);color:${ok ? 'var(--green)' : 'var(--faint)'}">${ok ? '● conectado' : '○ não conectado'}</span>`;
    box.innerHTML = `
      <div class="cfg-row"><span class="l">📓 Notion ${M.hint('1) Em notion.so/profile/integrations crie uma integração interna e copie o “Internal Integration Secret”. 2) No Notion, abra a página onde os itens vão cair → ••• → Conexões → adicione a integração. 3) Cole o segredo aqui e escolha a página.')}</span>${dot(s.notion.ok)}</div>
      <div class="row" style="align-items:center"><input type="password" id="nTok" placeholder="${s.notion.temToken ? 'Segredo guardado ✔ (cole outro para trocar)' : 'Cole o segredo da integração (ntn_…)'}" autocomplete="off" style="flex:3"><button class="btn ghost" id="nLoad" style="flex:none">Buscar páginas</button></div>
      <div class="row" style="align-items:center;margin-top:6px"><select id="nPage" style="flex:3"><option value="">${s.notion.alvoNome ? esc(s.notion.alvoNome) : '— escolha a página de destino —'}</option></select><button class="btn" id="nSave" style="flex:none">Guardar</button><button class="btn ghost" id="nDel" style="flex:none">Remover</button></div>
      <div style="height:14px"></div>
      <div class="cfg-row"><span class="l">📋 Trello ${M.hint('1) Em trello.com/power-ups/admin crie um Power-Up e gere a chave da API (API key). 2) Na mesma página, clique em “Token” e autorize. 3) Cole a chave e o token aqui e escolha a lista onde os cartões vão cair.')}</span>${dot(s.trello.ok)}</div>
      <div class="row" style="align-items:center"><input type="password" id="tKey" placeholder="${s.trello.temChave ? 'Chave guardada ✔' : 'API key'}" autocomplete="off" style="flex:1"><input type="password" id="tTok" placeholder="${s.trello.temChave ? 'Token guardado ✔' : 'Token'}" autocomplete="off" style="flex:2"><button class="btn ghost" id="tLoad" style="flex:none">Buscar listas</button></div>
      <div class="row" style="align-items:center;margin-top:6px"><select id="tList" style="flex:3"><option value="">${s.trello.alvoNome ? esc(s.trello.alvoNome) : '— escolha a lista de destino —'}</option></select><button class="btn" id="tSave" style="flex:none">Guardar</button><button class="btn ghost" id="tDel" style="flex:none">Remover</button></div>
      <small style="color:var(--dim);display:block;margin-top:8px">Depois de conectar, clique com o botão direito num item (ou use <span style="font-weight:700">📤 Enviar para…</span> dentro dele). As chaves ficam só neste computador, em data/segredos.json, fora do backup, do Drive e do GitHub.</small>`;
    const err = (e) => M.toast('⚠️ ' + e.message);
    $('#nLoad').onclick = async () => {
      try {
        const r = await M.api('/api/int/notion/paginas', { method: 'POST', body: JSON.stringify({ token: $('#nTok').value.trim() }) });
        if (!r.paginas.length) return M.toast('Nenhuma página encontrada. Conecte a integração a uma página no Notion (••• → Conexões).');
        $('#nPage').innerHTML = r.paginas.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
        M.toast(`📓 ${r.paginas.length} página(s) encontrada(s)`);
      } catch (e) { err(e); }
    };
    $('#nSave').onclick = async () => {
      const sel = $('#nPage'); if (!sel.value) return M.toast('Escolha a página primeiro (Buscar páginas).');
      try { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ notion: { token: $('#nTok').value.trim(), alvo: sel.value, alvoNome: sel.selectedOptions[0].textContent } }) }); SFX.play('coin'); M.toast('✅ Notion conectado'); M.intBind(); } catch (e) { err(e); }
    };
    $('#nDel').onclick = async () => { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ notion: null }) }); M.toast('Notion desconectado'); M.intBind(); };
    $('#tLoad').onclick = async () => {
      try {
        const r = await M.api('/api/int/trello/listas', { method: 'POST', body: JSON.stringify({ key: $('#tKey').value.trim(), token: $('#tTok').value.trim() }) });
        if (!r.listas.length) return M.toast('Nenhuma lista encontrada nos seus quadros.');
        $('#tList').innerHTML = r.listas.map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');
        M.toast(`📋 ${r.listas.length} lista(s) encontrada(s)`);
      } catch (e) { err(e); }
    };
    $('#tSave').onclick = async () => {
      const sel = $('#tList'); if (!sel.value) return M.toast('Escolha a lista primeiro (Buscar listas).');
      try { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ trello: { key: $('#tKey').value.trim(), token: $('#tTok').value.trim(), alvo: sel.value, alvoNome: sel.selectedOptions[0].textContent } }) }); SFX.play('coin'); M.toast('✅ Trello conectado'); M.intBind(); } catch (e) { err(e); }
    };
    $('#tDel').onclick = async () => { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ trello: null }) }); M.toast('Trello desconectado'); M.intBind(); };
  };
})();
