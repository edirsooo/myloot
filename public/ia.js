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

  // ----- como instalar (o app do ChatGPT ou do Claude para computador NÃO traz o Codex nem o Claude Code: são programas de terminal à parte) -----
  const GUIA = {
    codex: { nome: 'Codex', pacote: 'npm install -g @openai/codex', login: 'codex', conta: 'ChatGPT (Plus, Pro, Business ou Edu)',
      aviso: 'O aplicativo do ChatGPT para computador não traz o Codex. O Codex é um programa à parte, que roda no terminal e entra com a mesma conta do ChatGPT.' },
    claude: { nome: 'Claude Code', pacote: 'npm install -g @anthropic-ai/claude-code', login: 'claude', conta: 'Claude (Pro ou Max)',
      aviso: 'O aplicativo do Claude para computador não traz o Claude Code. O Claude Code é um programa à parte, que roda no terminal e entra com a mesma conta do Claude.' },
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
    ligaComo(m);
  };

  // ----- seção nas Configurações -----
  M.iaSection = () => `<section class="stat"><div class="cfg-h">🤖 IA (Claude e Codex)</div>
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
    const putKey = async (key) => { try { const r = await M.api('/api/ai/key', { method: 'POST', body: JSON.stringify({ key }) }); $('#aiKey').value = ''; aiSt(r.temChave); st = null; SFX.play(r.temChave ? 'coin' : 'click'); M.toast(r.temChave ? '🔑 Chave guardada' : 'Chave removida'); } catch (e) { M.toast('⚠️ ' + e.message); } };
    $('#aiSave').onclick = () => { const k = $('#aiKey').value.trim(); if (k) putKey(k); else M.falta($('#aiKey'), '🔑 Cole a chave primeiro'); };
    $('#aiDel').onclick = () => putKey('');
    $('#iaRedo').onclick = () => M.iaSetup();
  };
})();
