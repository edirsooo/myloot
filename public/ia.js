// IAs locais (Claude Code e Codex): detecção, pop-up da primeira vez e escolha de qual usar.
(function () {
  const { esc, $ } = M;
  M.IAS = [
    { id: 'claude', nome: 'Claude Code', em: '🟠', dica: 'Usa a assinatura do Claude logada neste computador.' },
    { id: 'codex', nome: 'Codex (ChatGPT)', em: '🟢', dica: 'Usa a assinatura do ChatGPT logada neste computador.' },
    { id: 'gemini', nome: 'Gemini CLI (Google)', em: '🔵', dica: 'Usa a sua conta Google (a mesma do Antigravity), com uso gratuito.' },
  ];
  // chaves de API: funcionam sem nada instalado, pela internet, cada uma na conta de quem criou a chave
  M.IA_CHAVES = [
    { id: 'api', qual: 'claude', tem: 'temChave', nome: 'Claude (chave da API)', curto: 'Claude', ph: 'sk-ant-…', onde: 'console.anthropic.com → API Keys. Cobra por uso.' },
    { id: 'api-gemini', qual: 'gemini', tem: 'temGemini', nome: 'Gemini (chave da API)', curto: 'Gemini', ph: 'AIza…', onde: 'aistudio.google.com → Get API key. Tem uso gratuito.' },
    { id: 'api-openai', qual: 'openai', tem: 'temOpenai', nome: 'ChatGPT (chave da API)', curto: 'ChatGPT', ph: 'sk-…', onde: 'platform.openai.com → API keys. Cobra por uso (a assinatura Plus não vale para a API).' },
  ];
  let st = null;
  M.iaStatus = async (force) => { if (!st || force) st = await M.api('/api/ai/status' + (force ? '?checar=1' : '')); return st; };
  const ligada = (id) => (M.db.settings.aiTools || {})[id] !== false;
  // IAs que dá para usar agora (instalada + ligada); a chave da API conta como uma opção a mais
  M.iaDisponiveis = async () => {
    const s = await M.iaStatus();
    const L = M.IAS.filter((i) => s[i.id] && s[i.id].ok && ligada(i.id)).map((i) => ({ id: i.id, nome: i.nome }));
    M.IA_CHAVES.forEach((c) => { if (s[c.tem]) L.push({ id: c.id, nome: c.nome }); });
    return L;
  };

  // ----- como instalar (o app do ChatGPT/Codex para computador traz o Codex dentro dele e o servidor acha; o app do Claude não traz o Claude Code) -----
  const GUIA = {
    codex: { nome: 'Codex', pacote: 'npm install -g @openai/codex', login: 'codex', conta: 'ChatGPT (Plus, Pro, Business ou Edu)',
      aviso: 'Tem o aplicativo do ChatGPT (ou do Codex) para computador? Abra o app uma vez, entre na sua conta e clique em “Procurar de novo”: o MyLoot usa o Codex que vem dentro dele. Sem o app, dá para instalar o Codex pelo terminal:' },
    claude: { nome: 'Claude Code', pacote: 'npm install -g @anthropic-ai/claude-code', login: 'claude', conta: 'Claude (Pro ou Max)',
      aviso: 'O aplicativo do Claude para computador não traz o Claude Code. O Claude Code é um programa à parte, que roda no terminal e entra com a mesma conta do Claude:' },
    gemini: { nome: 'Gemini CLI', pacote: 'npm install -g @google/gemini-cli', login: 'gemini', conta: 'Google (escolha “Login with Google”; tem uso gratuito)',
      aviso: 'O Antigravity é um editor e não aceita pedidos de outros programas, então o MyLoot não consegue falar com ele. O Gemini CLI é o programa do Google feito para isso e entra com a mesma conta Google do Antigravity:' },
  };
  M.iaComoInstalar = (id) => {
    const g = GUIA[id]; if (!g) return;
    const cmd = (c) => `<div class="row" style="align-items:center;gap:8px;margin-top:6px"><code style="flex:1;padding:8px 10px;border-radius:8px;background:var(--bg2);border:2px solid var(--edge);font:700 13px var(--mono);user-select:all">${esc(c)}</code><button class="btn ghost sm" data-copia="${esc(c)}" style="flex:none">Copiar</button></div>`;
    const m = M.modal(`<div class="modal-h"><h2>🧩 Como instalar o ${g.nome}</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><p style="margin:0">${g.aviso}</p>
      <ol style="margin:0;padding-left:20px;display:grid;gap:10px">
        <li>Abra o terminal (no Windows: tecla <span style="font-weight:700">Windows</span>, digite <span style="font-weight:700">PowerShell</span> e aperte Enter) e rode:${cmd(g.pacote)}</li>
        <li>Ainda no terminal, rode o comando abaixo e entre com a sua conta do ${g.conta}:${cmd(g.login)}</li>
        <li>Volte aqui e clique em <span style="font-weight:700">🔎 Procurar de novo</span>. Não precisa reiniciar o MyLoot.</li>
      </ol>
      <small style="color:var(--dim)">O comando usa o Node.js, o mesmo que o MyLoot já usa. Se o terminal disser que não conhece o <span style="font-weight:700">npm</span>, feche e abra o terminal de novo.</small>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" id="redo" style="flex:none">🔎 Procurar de novo</button><button class="btn" id="ok" style="flex:none">Entendi</button></div></div>`, { small: true });
    m.querySelectorAll('[data-copia]').forEach((b) => { b.onclick = () => { navigator.clipboard.writeText(b.dataset.copia).then(() => M.toast('📋 Copiado'), () => M.toast('Selecione o texto e copie com Ctrl + C')); }; });
    $('#x', m).onclick = () => M.closeModal(); $('#ok', m).onclick = () => M.closeModal();
    $('#redo', m).onclick = async () => {
      const b = $('#redo', m); b.disabled = true; b.textContent = 'Procurando…';
      try {
        const r = await M.iaStatus(true);
        if (r[id] && r[id].ok) { M.closeModal(); SFX.play('coin'); M.toast(`✅ ${g.nome} encontrado${r[id].versao ? ' (v' + r[id].versao + ')' : ''}!`); if (M.ui.page === 'cfg') M.render(); return; }
        b.disabled = false; b.textContent = '🔎 Procurar de novo';
        M.toast(r[id] && r[id].motivo === 'falhou' ? `⚠️ Achei o ${g.nome}, mas ele não respondeu. Rode "${g.login}" no terminal para ver o erro.` : `Ainda não achei o ${g.nome}. Confira o passo 1.`);
      } catch (e) { b.disabled = false; b.textContent = '🔎 Procurar de novo'; M.toast('⚠️ ' + e.message); }
    };
  };
  const comoLink = (id) => ` · <a href="#" data-como="${id}" style="color:var(--accent);font-weight:700">como instalar</a>`;
  const ligaComo = (raiz) => raiz.querySelectorAll('[data-como]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); M.iaComoInstalar(a.dataset.como); }; });

  // ----- pop-up da primeira vez -----
  M.iaSetup = async () => {
    let s; try { s = await M.iaStatus(true); } catch (_) { return; }
    const achadas = M.IAS.filter((i) => s[i.id] && s[i.id].ok);
    const linhas = M.IAS.map((i) => {
      const ok = s[i.id] && s[i.id].ok;
      return `<div class="cfg-row"><span class="l">${i.em} <span style="font-weight:700">${i.nome}</span><br><small style="color:var(--dim)">${ok ? '● encontrado' + (s[i.id].versao ? ' (v' + esc(s[i.id].versao) + ')' : '') + ' · ' + i.dica : '○ não encontrado neste computador' + comoLink(i.id)}</small></span>${ok ? M.sw('ia_' + i.id, ligada(i.id)) : ''}</div>`;
    }).join('');
    const B = (t) => `<span style="font-weight:700">${t}</span>`;
    const lista = achadas.map((i) => B(i.nome));
    const topo = achadas.length > 1 ? `Encontrei ${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]} neste computador. Quer usar?`
      : achadas.length === 1 ? `Encontrei o ${B(achadas[0].nome)} neste computador.`
      : 'Não encontrei Claude Code, Codex nem Gemini CLI neste computador. Tudo bem: o MyLoot funciona sem IA, e você pode instalar depois ou usar uma chave de API (Claude, Gemini ou ChatGPT) nas Configurações.';
    const agv = s.antigravity && !(s.gemini && s.gemini.ok) ? `<small style="color:var(--dim)">🪐 Vi o ${B('Antigravity')} aqui. Ele não aceita pedidos de outros programas, mas o Gemini CLI entra com a mesma conta Google e funciona no MyLoot${comoLink('gemini')}.</small>` : '';
    const m = M.modal(`<div class="modal-h"><h2>🤖 Sua IA no MyLoot</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><p style="margin:0">${topo}</p>
      ${achadas.length ? '<p style="margin:0;color:var(--dim)">Ligue as que quiser usar para melhorar, corrigir e resumir textos dentro dos itens. Elas usam a sua própria assinatura, sem chave e sem custo extra.</p>' : ''}
      <div style="border:2px solid var(--edge);border-radius:12px;padding:4px 14px;background:var(--bg2)">${linhas}</div>
      ${agv}
      <small style="color:var(--dim)">Dá para mudar quando quiser em Configurações → IA.</small>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" id="ok" style="flex:none">${achadas.length ? 'Salvar' : 'Entendi'}</button></div></div>`, { small: true });
    const fim = () => {
      const t = Object.assign({}, M.db.settings.aiTools || {});
      achadas.forEach((i) => { const c = $('#ia_' + i.id, m); if (c) t[i.id] = c.checked; });
      M.db.settings.aiTools = t; M.db.settings.aiSetupDone = true; M.save(); M.closeModal();
      const n = achadas.filter((i) => t[i.id] !== false).length;
      if (n) { SFX.play('coin'); M.toast(`🤖 ${n > 1 ? n + ' IAs prontas' : 'IA pronta'}! Use o botão “Pedir à IA” dentro de um item.`); }
    };
    $('#ok', m).onclick = fim; $('#x', m).onclick = fim;
    ligaComo(m);
  };

  // ----- seção nas Configurações -----
  M.iaSection = () => `<section class="stat"><div class="cfg-h">🤖 IA (Claude, Codex e Gemini)</div>
    ${M.IAS.map((i) => `<div class="cfg-row"><span class="l">${i.em} ${i.nome} ${M.hint(i.dica + ' Precisa estar instalado e logado.')}<br><small id="iaSt_${i.id}" style="font:700 12px var(--mono);color:var(--faint)">…</small></span>${M.sw('iaOn_' + i.id, ligada(i.id))}</div>`).join('')}
    <small id="iaAgv" hidden style="color:var(--dim);display:block;margin:2px 0 6px"></small>
    <div class="cfg-row"><span class="l">Qual usar ${M.hint('Automático: usa o Claude Code; se não tiver, o Codex; depois o Gemini CLI; se não tiver nenhum, a primeira chave de API guardada. Dentro do item também dá para escolher na hora.')}</span><select id="aiVia" style="width:auto"><option value="auto">Automático</option>${M.IAS.map((i) => `<option value="${i.id}">${i.nome}</option>`).join('')}${M.IA_CHAVES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
    <div class="cfg-row"><span class="l">Chaves de API (opcional) ${M.hint('Para quem não tem nenhuma das IAs acima instalada. As versões de conversa (Claude.ai, ChatGPT, Gemini) não deixam outros programas usar a assinatura; a chave de API deixa. Fica só neste computador, em data/segredos.json, fora do backup e do Drive.')}</span><select id="aiQual" style="width:auto">${M.IA_CHAVES.map((c) => `<option value="${c.qual}">${c.curto}</option>`).join('')}</select></div>
    <div class="row" style="align-items:center"><input type="password" id="aiKey" autocomplete="off" style="flex:3"><button class="btn" id="aiSave" style="flex:none">Guardar</button><button class="btn ghost" id="aiDel" style="flex:none">Remover</button></div>
    <small id="aiSt" style="display:block;margin-top:4px;font:700 12px var(--mono)"></small>
    <div class="cfg-row" style="margin-top:8px"><span class="l">Modelo do Claude ${M.hint('Vale para o Claude Code e para a chave da API do Claude. Opus: o mais caprichado. Sonnet: rápido e bom. Haiku: o mais barato. Codex e Gemini usam o modelo configurado neles.')}</span><select id="aiModel" style="width:auto"><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option><option value="claude-haiku-5-5">Claude Haiku 5.5</option></select></div>
    <div class="row" style="margin-top:8px;gap:8px"><button class="btn ghost sm" id="iaRedo" style="flex:none">🔎 Procurar IAs de novo</button></div>
    <small style="color:var(--dim);display:block;margin-top:6px">Use o botão <span style="font-weight:700">🤖 Pedir à IA</span> dentro de qualquer item para melhorar, corrigir, resumir ou reescrever o texto.</small>
  </section>`;

  M.iaBind = async (set) => {
    const s = M.db.settings;
    let ult = null;
    const chave = () => M.IA_CHAVES.find((c) => c.qual === ($('#aiQual') || {}).value) || M.IA_CHAVES[0];
    const aiSt = () => {
      const e = $('#aiSt'); if (!e) return; const c = chave();
      $('#aiKey').placeholder = `Cole aqui a chave do ${c.curto} (${c.ph})`;
      e.textContent = M.IA_CHAVES.map((k) => (ult && ult[k.tem] ? '● ' : '○ ') + k.curto).join('   ') + '  ·  crie em ' + c.onde;
      e.style.color = 'var(--dim)';
    };
    const pinta = (r) => {
      ult = r; aiSt();
      const ag = $('#iaAgv');
      if (ag) { ag.hidden = !(r.antigravity && !(r.gemini && r.gemini.ok)); ag.innerHTML = '🪐 Vi o Antigravity aqui. Ele não aceita pedidos de outros programas, mas o Gemini CLI entra com a mesma conta Google e funciona no MyLoot' + comoLink('gemini') + '.'; ligaComo(ag); }
      M.IAS.forEach((i) => {
        const e = $('#iaSt_' + i.id); if (!e) return; const ok = r[i.id] && r[i.id].ok;
        if (ok) e.textContent = '● encontrado' + (r[i.id].versao ? ' (v' + r[i.id].versao + ')' : '');
        else { e.innerHTML = (r[i.id] && r[i.id].motivo === 'falhou' ? '○ achei, mas não respondeu' : '○ não encontrado neste computador') + comoLink(i.id); ligaComo(e); }
        e.style.color = ok ? 'var(--green)' : 'var(--faint)';
        // sem a IA instalada, a chave fica desligada e travada (antes ficava acesa com "não instalado" do lado)
        const c = $('#iaOn_' + i.id);
        if (c) { c.disabled = !ok; c.checked = ok && ligada(i.id); const sw = c.closest('label'); if (sw) { sw.style.opacity = ok ? '' : '.45'; sw.title = ok ? '' : 'Instale o ' + i.nome + ' para ligar'; } }
      });
    };
    M.iaStatus(true).then(pinta).catch(() => {});
    M.IAS.forEach((i) => { const c = $('#iaOn_' + i.id); if (c) c.onchange = () => { s.aiTools = Object.assign({}, s.aiTools || {}, { [i.id]: c.checked }); M.save(); SFX.play('click'); }; });
    $('#aiVia').value = s.aiVia === 'code' ? 'claude' : (s.aiVia || 'auto');
    $('#aiVia').onchange = () => { s.aiVia = $('#aiVia').value; M.save(); M.toast('🤖 Pronto'); };
    $('#aiModel').value = s.aiModel || 'claude-opus-5-5';
    $('#aiModel').onchange = (e) => set('aiModel', e.target.value);
    $('#aiQual').onchange = aiSt; aiSt();
    const putKey = async (key) => { const c = chave(); try { const r = await M.api('/api/ai/key', { method: 'POST', body: JSON.stringify({ key, qual: c.qual }) }); $('#aiKey').value = ''; st = null; if (ult) ult[c.tem] = r.temChave; aiSt(); SFX.play(r.temChave ? 'coin' : 'click'); M.toast(r.temChave ? `🔑 Chave do ${c.curto} guardada` : `Chave do ${c.curto} removida`); } catch (e) { M.toast('⚠️ ' + e.message); } };
    $('#aiSave').onclick = () => { const k = $('#aiKey').value.trim(); if (k) putKey(k); else M.falta($('#aiKey'), '🔑 Cole a chave primeiro'); };
    $('#aiDel').onclick = () => putKey('');
    $('#iaRedo').onclick = () => M.iaSetup();
  };
})();
