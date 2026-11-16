// Páginas: lixeira, conquistas e configurações.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};

  // ----- lixeira -----
  M.pages.trash = () => {
    const v = $('#view'), T = M.db.trash;
    v.innerHTML = T.length ? `<div class="toolbar"><span class="grow"></span><button class="btn danger sm" id="empty">Esvaziar lixeira</button></div><div class="list">${T.map((e) => {
      const it = e.data, title = e.kind === 'item' ? (M.type(it.type).em + ' ' + (it.title || 'Sem título')) : '☑️ ' + it.text;
      return `<div class="card" style="--c:var(--faint);cursor:default"><div class="mid"><h3>${esc(title)}</h3></div><span class="tdate">${new Date(e.at).toLocaleString('pt-BR')}</span><button class="btn sm" data-r="${it.id}">↩ Restaurar</button></div>`;
    }).join('')}</div>` : '<div class="empty"><div class="big">🧹</div><h3>Lixeira vazia</h3><p>O que você apagar fica aqui para dar para voltar atrás.</p></div>';
    v.onclick = async (e) => {
      const r = e.target.closest('[data-r]'); if (r) return M.restoreFromTrash(r.dataset.r);
      if (e.target.id === 'empty' && await M.confirm('Apagar de vez tudo da lixeira? Não dá para desfazer. (Os anexos continuam na pasta data/anexos.)', 'Esvaziar')) { M.db.trash = []; M.save(); SFX.play('trash'); M.render(); }
    };
  };

  // ----- conquistas -----
  M.pages.ach = () => {
    const g = M.db.game, lv = M.levelOf(g.xp), v = $('#view');
    const days = Array.from({ length: 7 }, (_, i) => { const k = M.addDays(M.today(), i - 6); return [k, (g.log[k] || { xp: 0 }).xp]; });
    const max = Math.max(M.db.settings.dailyGoal, ...days.map((d) => d[1]), 1);
    v.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${lv}</b><small>Nível · ${esc(M.levelName(lv))}</small></div>
        <div class="stat"><b>${g.xp}</b><small>XP total</small></div>
        <div class="stat"><b>🔥 ${g.streak.count}</b><small>Dias seguidos</small></div>
        <div class="stat"><b>${g.counters.item || 0}</b><small>Itens criados</small></div>
        <div class="stat"><b>${g.counters.task || 0}</b><small>Tarefas concluídas</small></div>
        <div class="stat"><b>${g.counters.copy || 0}</b><small>Prompts copiados</small></div>
      </div>
      <h2 class="sec">XP dos últimos 7 dias ${M.hint('A linha tracejada é a sua meta do dia.')}</h2>
      <div class="stat" style="display:flex;gap:10px;align-items:flex-end;height:150px;position:relative">
        <div style="position:absolute;left:14px;right:14px;bottom:${14 + (M.db.settings.dailyGoal / max) * 100}px;border-top:2px dashed var(--green);opacity:.5"></div>
        ${days.map(([k, x]) => `<div style="flex:1;text-align:center"><div title="${x} XP" style="height:${Math.max(4, (x / max) * 100)}px;background:linear-gradient(var(--cyan),var(--accent));border-radius:4px 4px 0 0;border:2px solid #0004"></div><small style="font:10px var(--mono);color:var(--faint)">${k.slice(8)}/${k.slice(5, 7)}</small></div>`).join('')}
      </div>
      <h2 class="sec">Conquistas · ${Object.keys(g.achievements).length}/${M.ACH.length}</h2>
      <div class="ach">${M.ACH.map((a) => `<div class="a ${g.achievements[a.id] ? 'on' : 'off'}"><div class="ic">${a.em}</div><div><b>${a.n}</b><small>${a.d}${g.achievements[a.id] ? ' · ' + M.fmtDate(g.achievements[a.id]) : ''}</small></div></div>`).join('')}</div>`;
  };

  // ----- configurações -----
  M.pages.cfg = () => {
    const s = M.db.settings, v = $('#view');
    v.innerHTML = `<div style="max-width:760px;display:flex;flex-direction:column;gap:22px">
      <section class="stat"><div class="cfg-h">Aparência</div>
        <div class="cfg-row"><span class="l">Seguir o tema do aparelho ${M.hint('Fica claro ou escuro sozinho, igual ao Windows ou ao celular.')}</span>${M.sw('cAuto', s.themeAuto)}</div>
        <div class="cfg-row" id="rowTheme" style="${s.themeAuto ? 'opacity:.45;pointer-events:none' : ''}"><span class="l">Tema escuro</span>${M.sw('cTheme', s.theme === 'dark')}</div>
        <div class="cfg-row"><span class="l">Tamanho das letras ${M.hint('Aumenta ou diminui tudo na tela.')}</span><div class="seg" id="cFont">${[[0.9, 'A−'], [1, 'Normal'], [1.1, 'A+'], [1.25, 'A++']].map(([v, n]) => `<button data-f="${v}" class="${(+s.fontScale || 1) === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="cfg-row"><span class="l">Modo compacto ${M.hint('Deixa tudo mais apertadinho, cabe mais coisa na tela.')}</span>${M.sw('cCompact', s.compact)}</div>
      </section>
      <section class="stat"><div class="cfg-h">Diversão</div>
        <div class="cfg-row"><span class="l">Pontos e níveis ${M.hint('Desligando, somem o XP, a meta, a sequência e o level up. Suas conquistas ficam guardadas.')}</span>${M.sw('cGame', s.gamify)}</div>
        <div class="cfg-row"><span class="l">Sons de jogo ${M.hint('Sons curtinhos feitos no próprio navegador.')}</span>${M.sw('cSnd', s.sounds)}</div>
        <div class="cfg-row"><span class="l">Confete ${M.hint('Explosão de quadradinhos ao subir de nível ou concluir algo.')}</span>${M.sw('cConf', s.confetti)}</div>
        <div class="cfg-row"><span class="l">Meta do dia (XP) ${M.hint('Quantos pontos você quer fazer por dia.')}</span><input type="number" id="cGoal" min="10" max="500" step="10" value="${s.dailyGoal}" style="width:90px"></div>
      </section>
      <section class="stat"><div class="cfg-h">Categorias</div><div id="cCats"></div><button class="btn ghost sm" id="cCatAdd" style="margin-top:6px">＋ Nova categoria</button></section>
      ${M.intSection()}
      <section class="stat"><div class="cfg-h">Claude (IA)</div>
        <div class="cfg-row"><span class="l">Como falar com o Claude ${M.hint('Claude Code: usa a assinatura do Claude que já está logada neste computador, sem chave e sem pagar à parte (precisa do Claude Code instalado). Chave da API: cobra por uso na sua conta da Anthropic. Automático: usa o Claude Code se ele estiver instalado.')}</span><select id="aiVia" style="width:auto"><option value="auto">Automático</option><option value="code">Claude Code (sua assinatura)</option><option value="api">Chave da API</option></select></div>
        <div class="cfg-row"><span class="l">Claude Code neste computador</span><span id="aiCode" style="font:700 12px var(--mono)">…</span></div>
        <div class="cfg-row"><span class="l">Chave da API ${M.hint('Crie em console.anthropic.com → API Keys. Fica guardada só neste computador, em data/segredos.json, fora do backup e do Drive.')}</span><span id="aiSt" style="font:700 12px var(--mono)"></span></div>
        <div class="row" style="align-items:center"><input type="password" id="aiKey" placeholder="Cole aqui a sua chave (sk-ant-…)" autocomplete="off" style="flex:3"><button class="btn" id="aiSave" style="flex:none">Guardar</button><button class="btn ghost" id="aiDel" style="flex:none">Remover</button></div>
        <div class="cfg-row" style="margin-top:8px"><span class="l">Modelo ${M.hint('Opus: o mais caprichado. Sonnet: rápido e bom. Haiku: o mais barato.')}</span><select id="aiModel" style="width:auto"><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option><option value="claude-haiku-5-5">Claude Haiku 5.5</option></select></div>
        <small style="color:var(--dim);display:block;margin-top:6px">Use o botão <span style="font-weight:700">🤖 Pedir ao Claude</span> dentro de qualquer item para melhorar, corrigir, resumir ou reescrever o texto. Com o Claude Code, usa a sua assinatura; com a chave, cada pedido gasta créditos da sua conta da Anthropic.</small>
      </section>
      <section class="stat"><div class="cfg-h">Google Drive</div>
        <div class="cfg-row"><span class="l">Copiar para o Drive ${M.hint('Precisa do app “Google Drive para computador”. Cada item vira um arquivo .md numa pasta por tipo, com os anexos junto.')}</span>${M.sw('cDrive', s.drive.on)}</div>
        <div class="row" style="margin-top:8px;align-items:center"><input type="text" id="cPath" value="${esc(s.drive.path)}" placeholder="Ex: G:\\Meu Drive" style="flex:3"><button class="btn ghost" id="cFind" style="flex:none">🔎 Procurar</button><button class="btn" id="cSync" style="flex:none">☁️ Sincronizar agora</button></div>
        <small id="cDriveMsg" style="color:var(--dim);display:block;margin-top:8px"></small>
      </section>
      <section class="stat"><div class="cfg-h">Dados</div>
        <div class="row" style="align-items:center"><a class="btn ghost" id="cBak" href="/api/backup" download="myloot-backup.json" style="flex:none">⬇️ Baixar backup (.json)</a><button class="btn ghost" id="cRes" style="flex:none">⬆️ Restaurar backup</button><input type="file" id="cResF" accept=".json,application/json" hidden></div>
        <small style="color:var(--dim);display:block;margin-top:8px">Cópia automática todo dia em <code>data/backups</code> (guarda as 20 mais novas).</small>
      </section>
      <section class="stat"><div class="cfg-h">Atalhos</div><div class="sc">
        <kbd>Ctrl K</kbd><span>Busca global (ou a tecla <kbd>/</kbd>)</span><kbd>N</kbd><span>Novo item</span><kbd>H</kbd><span>Início</span><kbd>B</kbd><span>Biblioteca</span><kbd>T</kbd><span>Tarefas</span><kbd>C</kbd><span>Calendário</span><kbd>F</kbd><span>Começar ou parar o foco</span><kbd>Esc</kbd><span>Fechar janela</span><kbd>Clique direito</kbd><span>Menu do cartão</span></div></section>
      <section class="stat"><div class="cfg-h">Servidor</div><button class="btn danger" id="cOff">⏻ Desligar o MyLoot</button> ${M.hint('Desliga o servidor. Para abrir de novo, use o atalho da área de trabalho.')}</section>
    </div>`;
    const set = (k, val) => { s[k] = val; M.save(); M.applySettings(); };
    $('#cAuto').onchange = (e) => { set('themeAuto', e.target.checked); SFX.play('click'); M.render(); };
    $('#cFont').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; set('fontScale', +b.dataset.f); SFX.play('click'); M.render(); };
    $('#cTheme').onchange = (e) => { set('theme', e.target.checked ? 'dark' : 'light'); SFX.play('click'); };
    $('#cCompact').onchange = (e) => { set('compact', e.target.checked); SFX.play('click'); };
    $('#cGame').onchange = (e) => { set('gamify', e.target.checked); M.renderHud(); SFX.play('click'); };
    $('#cSnd').onchange = (e) => { set('sounds', e.target.checked); SFX.play('coin'); };
    $('#cConf').onchange = (e) => { set('confetti', e.target.checked); FX.burst(null, null, 30); };
    $('#cGoal').onchange = (e) => { set('dailyGoal', Math.max(10, Math.min(500, +e.target.value || 50))); M.renderHud(); };

    const aiSt = (on) => { const e = $('#aiSt'); if (!e) return; e.textContent = on ? '● conectada' : '○ sem chave'; e.style.color = on ? 'var(--green)' : 'var(--faint)'; };
    const codeSt = (c) => { const e = $('#aiCode'); if (!e) return; e.textContent = c && c.ok ? '● encontrado' + (c.versao ? ' (v' + c.versao + ')' : '') : '○ não instalado'; e.style.color = c && c.ok ? 'var(--green)' : 'var(--faint)'; };
    M.api('/api/ai/status?checar=1').then((r) => { aiSt(r.temChave); codeSt(r.code); }).catch(() => {});
    M.intBind();
    $('#aiVia').value = s.aiVia || 'auto';
    $('#aiVia').onchange = () => { s.aiVia = $('#aiVia').value; M.save(); M.toast('🤖 Pronto'); };
    $('#aiModel').value = s.aiModel || 'claude-opus-5-5';
    $('#aiModel').onchange = (e) => set('aiModel', e.target.value);
    const putKey = async (key) => { try { const r = await M.api('/api/ai/key', { method: 'POST', body: JSON.stringify({ key }) }); $('#aiKey').value = ''; aiSt(r.temChave); SFX.play(r.temChave ? 'coin' : 'click'); M.toast(r.temChave ? '🔑 Chave guardada' : 'Chave removida'); } catch (e) { M.toast('⚠️ ' + e.message); } };
    $('#aiSave').onclick = () => { const k = $('#aiKey').value.trim(); if (k) putKey(k); };
    $('#aiDel').onclick = () => putKey('');

    function drawCats() {
      $('#cCats').innerHTML = M.db.categories.map((c) => `<div class="catrow" data-id="${c.id}"><input type="text" class="ico" value="${esc(c.icon)}" maxlength="4"><input type="text" class="nm" value="${esc(c.name)}"><input type="color" value="${c.color}"><button class="xbtn" title="Apagar categoria">✕</button></div>`).join('') || '<small style="color:var(--faint)">Nenhuma categoria ainda.</small>';
    }
    drawCats();
    $('#cCats').oninput = (e) => {
      const row = e.target.closest('.catrow'); if (!row) return;
      const c = M.cat(row.dataset.id);
      if (e.target.classList.contains('ico')) c.icon = e.target.value; else if (e.target.classList.contains('nm')) c.name = e.target.value; else if (e.target.type === 'color') c.color = e.target.value;
      M.save();
    };
    $('#cCats').onclick = async (e) => {
      if (!e.target.classList.contains('xbtn')) return;
      const id = e.target.closest('.catrow').dataset.id;
      if (await M.confirm('Apagar esta categoria? Os itens dela ficam sem categoria.', 'Apagar')) {
        M.db.categories = M.db.categories.filter((c) => c.id !== id); M.db.items.forEach((i) => { if (i.cat === id) i.cat = ''; }); M.save(); drawCats();
      }
    };
    $('#cCatAdd').onclick = () => { M.db.categories.push({ id: M.uid(), name: 'Nova categoria', icon: '📁', color: '#8b5cf6' }); M.save(); SFX.play('pop'); drawCats(); const r = $$('.catrow .nm'); r[r.length - 1].select(); };

    const msg = (t, bad) => { const el = $('#cDriveMsg'); el.textContent = t; el.style.color = bad ? 'var(--red)' : 'var(--green)'; };
    $('#cDrive').onchange = (e) => { s.drive.on = e.target.checked; M.save(); SFX.play('click'); if (e.target.checked && !s.drive.path) $('#cFind').click(); };
    $('#cPath').oninput = (e) => { s.drive.path = e.target.value.trim(); M.save(); };
    $('#cFind').onclick = async () => {
      try {
        const r = await M.api('/api/drive/find');
        if (!r.pastas.length) return msg('Não achei o Google Drive. Instale o app “Google Drive para computador” ou digite a pasta.', true);
        s.drive.path = r.pastas[0]; $('#cPath').value = r.pastas[0]; M.save(); msg('Achei: ' + r.pastas.join('  |  ')); SFX.play('coin');
      } catch (e) { msg(e.message, true); }
    };
    $('#cSync').onclick = async () => {
      try {
        msg('Sincronizando…'); await M.api('/api/db', { method: 'PUT', body: JSON.stringify(M.db) });
        const r = await M.api('/api/drive/sync', { method: 'POST' });
        msg(`Pronto! ${r.itens} itens · ${r.escritos} arquivos atualizados · ${r.removidos} removidos.`); SFX.play('done');
      } catch (e) { msg(e.message, true); SFX.play('error'); }
    };
    $('#cRes').onclick = () => $('#cResF').click();
    $('#cResF').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!(await M.confirm('Trocar os dados atuais pelos desse backup? Uma cópia dos atuais é guardada antes.', 'Restaurar'))) return;
      try { await M.api('/api/restore', { method: 'POST', body: await f.text() }); await M.load(); M.applySettings(); M.toast('✅ Backup restaurado'); M.go('lib'); } catch (er) { M.toast('⚠️ ' + er.message); }
    };
    $('#cOff').onclick = async () => {
      if (!(await M.confirm('Desligar o servidor do MyLoot?', 'Desligar'))) return;
      try { await M.api('/api/shutdown', { method: 'POST' }); } catch (_) {}
      document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font:700 20px monospace;color:#aaa;background:#070b18">MyLoot desligado. Pode fechar esta aba. 👋</div>';
    };
  };
})();
