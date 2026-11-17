// IAs locais (Claude Code e Codex): detecção, pop-up da primeira vez e escolha de qual usar.
(function () {
  const { esc, $ } = M;
  M.IAS = [
    { id: 'claude', nome: 'Claude Code', em: '🟠', dica: 'Usa a assinatura do Claude logada neste computador.' },
    { id: 'codex', nome: 'Codex (ChatGPT)', em: '🟢', dica: 'Usa a assinatura do ChatGPT logada neste computador.' },
  ];
  let st = null;
  M.iaStatus = async (force) => { if (!st || force) st = await M.api('/api/ai/status' + (force ? '?checar=1' : '')); return st; };
  const ligada = (id) => (M.db.settings.aiTools || {})[id] !== false;
  // IAs que dá para usar agora (instalada + ligada); a chave da API conta como uma opção a mais
  M.iaDisponiveis = async () => {
    const s = await M.iaStatus();
    const L = M.IAS.filter((i) => s[i.id] && s[i.id].ok && ligada(i.id)).map((i) => ({ id: i.id, nome: i.nome }));
    if (s.temChave) L.push({ id: 'api', nome: 'Claude (chave da API)' });
    return L;
  };

  // ----- pop-up da primeira vez -----
  M.iaSetup = async () => {
    let s; try { s = await M.iaStatus(true); } catch (_) { return; }
    const achadas = M.IAS.filter((i) => s[i.id] && s[i.id].ok);
    const linhas = M.IAS.map((i) => {
      const ok = s[i.id] && s[i.id].ok;
      return `<div class="cfg-row"><span class="l">${i.em} <span style="font-weight:700">${i.nome}</span><br><small style="color:var(--dim)">${ok ? '● encontrado' + (s[i.id].versao ? ' (v' + esc(s[i.id].versao) + ')' : '') + ' · ' + i.dica : '○ não encontrado neste computador'}</small></span>${ok ? M.sw('ia_' + i.id, ligada(i.id)) : ''}</div>`;
    }).join('');
    const B = (t) => `<span style="font-weight:700">${t}</span>`;
    const topo = achadas.length === 2 ? `Encontrei o ${B('Claude Code')} e o ${B('Codex')} neste computador. Quer usar os dois?`
      : achadas.length === 1 ? `Encontrei o ${B(achadas[0].nome)} neste computador.`
      : 'Não encontrei o Claude Code nem o Codex neste computador. Tudo bem: o MyLoot funciona sem IA, e você pode instalar depois ou usar uma chave da API do Claude nas Configurações.';
    const m = M.modal(`<div class="modal-h"><h2>🤖 Sua IA no MyLoot</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><p style="margin:0">${topo}</p>
      ${achadas.length ? '<p style="margin:0;color:var(--dim)">Ligue as que quiser usar para melhorar, corrigir e resumir textos dentro dos itens. Elas usam a sua própria assinatura, sem chave e sem custo extra.</p>' : ''}
      <div style="border:2px solid var(--edge);border-radius:12px;padding:4px 14px;background:var(--bg2)">${linhas}</div>
      <small style="color:var(--dim)">Dá para mudar quando quiser em Configurações → IA.</small>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" id="ok" style="flex:none">${achadas.length ? 'Salvar' : 'Entendi'}</button></div></div>`, { small: true });
    const fim = () => {
      const t = Object.assign({}, M.db.settings.aiTools || {});
      achadas.forEach((i) => { const c = $('#ia_' + i.id, m); if (c) t[i.id] = c.checked; });
      M.db.settings.aiTools = t; M.db.settings.aiSetupDone = true; M.save(); M.closeModal();
      const n = achadas.filter((i) => t[i.id] !== false).length;
      if (n) { SFX.play('coin'); M.toast(`🤖 ${n === 2 ? 'Claude e Codex prontos' : 'IA pronta'}! Use o botão “Pedir à IA” dentro de um item.`); }
    };
    $('#ok', m).onclick = fim; $('#x', m).onclick = fim;
  };

  // ----- seção nas Configurações -----
  M.iaSection = () => `<section class="stat"><div class="cfg-h">IA (Claude e Codex)</div>
    ${M.IAS.map((i) => `<div class="cfg-row"><span class="l">${i.em} ${i.nome} ${M.hint(i.dica + ' Precisa estar instalado e logado.')}<br><small id="iaSt_${i.id}" style="font:700 12px var(--mono);color:var(--faint)">…</small></span>${M.sw('iaOn_' + i.id, ligada(i.id))}</div>`).join('')}
    <div class="cfg-row"><span class="l">Qual usar ${M.hint('Automático: usa o Claude Code; se não tiver, o Codex; se não tiver nenhum, a chave da API. Dentro do item também dá para escolher na hora.')}</span><select id="aiVia" style="width:auto"><option value="auto">Automático</option><option value="claude">Claude Code</option><option value="codex">Codex</option><option value="api">Chave da API do Claude</option></select></div>
    <div class="cfg-row"><span class="l">Chave da API do Claude (opcional) ${M.hint('Só para quem não tem Claude Code nem Codex. Crie em console.anthropic.com → API Keys. Fica só neste computador, em data/segredos.json, fora do backup e do Drive.')}</span><span id="aiSt" style="font:700 12px var(--mono)"></span></div>
    <div class="row" style="align-items:center"><input type="password" id="aiKey" placeholder="Cole aqui a sua chave (sk-ant-…)" autocomplete="off" style="flex:3"><button class="btn" id="aiSave" style="flex:none">Guardar</button><button class="btn ghost" id="aiDel" style="flex:none">Remover</button></div>
    <div class="cfg-row" style="margin-top:8px"><span class="l">Modelo do Claude ${M.hint('Vale para o Claude Code e para a chave da API. Opus: o mais caprichado. Sonnet: rápido e bom. Haiku: o mais barato. O Codex usa o modelo configurado nele.')}</span><select id="aiModel" style="width:auto"><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option><option value="claude-haiku-5-5">Claude Haiku 5.5</option></select></div>
    <div class="row" style="margin-top:8px;gap:8px"><button class="btn ghost sm" id="iaRedo" style="flex:none">🔎 Procurar IAs de novo</button></div>
    <small style="color:var(--dim);display:block;margin-top:6px">Use o botão <span style="font-weight:700">🤖 Pedir à IA</span> dentro de qualquer item para melhorar, corrigir, resumir ou reescrever o texto.</small>
  </section>`;

  M.iaBind = async (set) => {
    const s = M.db.settings;
    const aiSt = (on) => { const e = $('#aiSt'); if (!e) return; e.textContent = on ? '● conectada' : '○ sem chave'; e.style.color = on ? 'var(--green)' : 'var(--faint)'; };
    const pinta = (r) => {
      aiSt(r.temChave);
      M.IAS.forEach((i) => { const e = $('#iaSt_' + i.id); if (!e) return; const ok = r[i.id] && r[i.id].ok; e.textContent = ok ? '● encontrado' + (r[i.id].versao ? ' (v' + r[i.id].versao + ')' : '') : '○ não instalado'; e.style.color = ok ? 'var(--green)' : 'var(--faint)'; });
    };
    M.iaStatus(true).then(pinta).catch(() => {});
    M.IAS.forEach((i) => { const c = $('#iaOn_' + i.id); if (c) c.onchange = () => { s.aiTools = Object.assign({}, s.aiTools || {}, { [i.id]: c.checked }); M.save(); SFX.play('click'); }; });
    $('#aiVia').value = s.aiVia === 'code' ? 'claude' : (s.aiVia || 'auto');
    $('#aiVia').onchange = () => { s.aiVia = $('#aiVia').value; M.save(); M.toast('🤖 Pronto'); };
    $('#aiModel').value = s.aiModel || 'claude-opus-5-5';
    $('#aiModel').onchange = (e) => set('aiModel', e.target.value);
    const putKey = async (key) => { try { const r = await M.api('/api/ai/key', { method: 'POST', body: JSON.stringify({ key }) }); $('#aiKey').value = ''; aiSt(r.temChave); st = null; SFX.play(r.temChave ? 'coin' : 'click'); M.toast(r.temChave ? '🔑 Chave guardada' : 'Chave removida'); } catch (e) { M.toast('⚠️ ' + e.message); } };
    $('#aiSave').onclick = () => { const k = $('#aiKey').value.trim(); if (k) putKey(k); else M.falta($('#aiKey'), '🔑 Cole a chave primeiro'); };
    $('#aiDel').onclick = () => putKey('');
    $('#iaRedo').onclick = () => M.iaSetup();
  };
})();
