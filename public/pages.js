// Páginas: lixeira, conquistas e configurações.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};

  // ----- lixeira -----
  M.pages.trash = () => {
    const v = $('#view'), T = M.db.trash;
    if (!T.length) { v.innerHTML = '<div class="empty"><div class="big">🧹</div><h3>Lixeira vazia</h3><p>O que você apagar fica aqui para dar para voltar atrás.</p></div>'; return; }
    // um painel por tipo, lado a lado: o olho não precisa atravessar a tela para achar o botão
    const GR = [['item', '📦 Itens'], ['task', '✅ Tarefas'], ['client', '👥 Clientes'], ['fin', '💰 Lançamentos']];
    const tipo = (e) => (['item', 'client', 'fin'].includes(e.kind) ? e.kind : 'task');
    const quando = (ms) => { const d = new Date(ms); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
    const linha = (e) => {
      const it = e.data, k = tipo(e);
      const [em, nome, sub] = k === 'item' ? [M.type(it.type).em, it.title || 'Sem título', M.type(it.type).name]
        : k === 'client' ? ['👤', it.nome || 'Cliente', it.empresa || 'Cliente']
        : k === 'fin' ? [it.tipo === 'saida' ? '💸' : '💵', it.desc || 'Lançamento', M.reais(it.valor)] : ['☑️', it.text || 'Tarefa', 'Tarefa'];
      return `<div class="lix-row"><span class="em">${em}</span><div class="tx"><b>${esc(nome)}</b><small>${esc(sub)} · apagado em ${quando(e.at)}</small></div>
        <button class="btn sm" data-r="${it.id}" title="Devolve para o lugar de onde saiu">↩ Restaurar</button><button class="xbtn" data-x="${it.id}" title="Apagar de vez (não dá para desfazer)" aria-label="Apagar de vez">✕</button></div>`;
    };
    v.innerHTML = `<div class="toolbar"><button class="btn danger sm" id="empty">🧹 Esvaziar lixeira</button>
        <span style="color:var(--dim)">${T.length} ${T.length === 1 ? 'coisa apagada' : 'coisas apagadas'}</span>${M.hint('O que você apaga fica aqui até esvaziar a lixeira. “Restaurar” devolve para o lugar de onde saiu; o ✕ apaga só aquela coisa de vez.')}</div>
      <div class="lix-grid">${GR.map(([k, n]) => { const L = T.filter((e) => tipo(e) === k); return L.length ? `<section class="panel"><h4>${n} <span class="rot-n">${L.length}</span></h4>${L.map(linha).join('')}</section>` : ''; }).join('')}</div>`;
    v.onclick = async (e) => {
      const r = e.target.closest('[data-r]'); if (r) return M.restoreFromTrash(r.dataset.r);
      const x = e.target.closest('[data-x]');
      if (x) { if (await M.confirm('Apagar isto de vez? Não dá para desfazer.', 'Apagar de vez')) { M.db.trash = M.db.trash.filter((y) => y.data.id !== x.dataset.x); M.save(); SFX.play('trash'); M.render(); } return; }
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
    v.innerHTML = `<div class="cfg-wrap"><nav class="cfg-menu" id="cfgMenu" aria-label="Seções das configurações"></nav><div class="cfg-cols" id="cfgCols">
      <section class="stat"><div class="cfg-h">🎨 Aparência</div>
        <div class="cfg-row"><span class="l">Seguir o tema do aparelho ${M.hint('Fica claro ou escuro sozinho, igual ao sistema do computador ou do celular.')}</span>${M.sw('cAuto', s.themeAuto)}</div>
        <div class="cfg-row" id="rowTheme" style="${s.themeAuto ? 'opacity:.45;pointer-events:none' : ''}"><span class="l">Tema escuro</span>${M.sw('cTheme', s.theme === 'dark')}</div>
        <div class="cfg-row"><span class="l">Tamanho das letras ${M.hint('Aumenta ou diminui tudo na tela.')}</span><div class="seg" id="cFont">${[[0.9, 'A−'], [1, 'Normal'], [1.1, 'A+'], [1.25, 'A++']].map(([v, n]) => `<button data-f="${v}" class="${(+s.fontScale || 1) === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="cfg-row"><span class="l">Modo compacto ${M.hint('Deixa tudo mais apertadinho, cabe mais coisa na tela.')}</span>${M.sw('cCompact', s.compact)}</div>
      </section>
      <section class="stat"><div class="cfg-h">🎮 Diversão</div>
        <div class="cfg-row"><span class="l">Pontos e níveis ${M.hint('Desligando, somem o XP, a meta, a sequência e o level up. Suas conquistas ficam guardadas.')}</span>${M.sw('cGame', s.gamify)}</div>
        <div class="cfg-row"><span class="l">Sons de jogo ${M.hint('Sons curtinhos feitos no próprio navegador.')}</span>${M.sw('cSnd', s.sounds)}</div>
        <div class="cfg-row"><span class="l">Volume da música de fundo ${M.hint('A música liga e desliga no botão 🔈 do topo. As faixas ficam na pasta public/musica do MyLoot.')}</span><input type="range" id="cMusV" min="0.05" max="1" step="0.05" value="${s.musicaVol || 0.25}" style="max-width:160px"></div>
        <div class="cfg-row"><span class="l">Confete ${M.hint('Explosão de quadradinhos ao subir de nível ou concluir algo.')}</span>${M.sw('cConf', s.confetti)}</div>
        <div class="cfg-row"><span class="l">Meta do dia (XP) ${M.hint('Quantos pontos você quer fazer por dia.')}</span><input type="number" id="cGoal" min="10" max="500" step="10" value="${s.dailyGoal}" style="width:90px"></div>
      </section>
      <section class="stat"><div class="cfg-h">🏷️ Categorias</div><div id="cCats"></div><button class="btn ghost sm" id="cCatAdd" style="margin-top:6px">＋ Nova categoria</button></section>
      ${M.celSection()}
      ${M.tourSection()}
      <div class="so-pc" style="display:contents">${M.intSection()}</div>
      ${M.cnxSection()}
      ${M.iaSection()}
      <section class="stat so-pc"><div class="cfg-h">☁️ Google Drive</div>
        <div class="cfg-row"><span class="l">Copiar para o Drive ${M.hint('Precisa do app “Google Drive para computador”. Cada item vira um arquivo .md numa pasta por tipo, com os anexos junto.')}</span>${M.sw('cDrive', s.drive.on)}</div>
        <div class="row" style="margin-top:8px;align-items:center"><input type="text" id="cPath" value="${esc(s.drive.path)}" placeholder="Ex: G:\\Meu Drive" style="flex:3"><button class="btn ghost" id="cFind" style="flex:none">🔎 Procurar</button><button class="btn" id="cSync" style="flex:none">☁️ Sincronizar agora</button></div>
        <small id="cDriveMsg" style="color:var(--dim);display:block;margin-top:8px"></small>
      </section>
      <section class="stat"><div class="cfg-h">💾 Dados e backup</div>
        <div class="row" style="align-items:center"><a class="btn ghost" id="cBak" href="/api/backup" download="myloot-backup.json" style="flex:none">⬇️ Baixar backup (.json)</a><button class="btn ghost so-pc" id="cRes" style="flex:none">⬆️ Restaurar backup</button><input type="file" id="cResF" accept=".json,.myloot,application/json" hidden></div>
        ${M.dadosExtras()}
        <small style="color:var(--dim);display:block;margin-top:8px">Cópia automática todo dia em <code>data/backups</code> (guarda as 20 mais novas).</small>
      </section>
      <div class="so-pc" style="display:contents">${M.versaoSection()}</div>
      ${M.suporteSection()}
      <section class="stat"><div class="cfg-h">⚡ Atalhos do teclado</div><div class="sc">
        <kbd>Ctrl K</kbd><span>Busca global (ou a tecla <kbd>/</kbd>)</span><kbd>N</kbd><span>Novo item</span><kbd>V</kbd><span>Criar por voz</span><kbd>H</kbd><span>Início</span><kbd>B</kbd><span>Biblioteca</span><kbd>T</kbd><span>Tarefas</span><kbd>R</kbd><span>Rotina</span><kbd>C</kbd><span>Calendário</span><kbd>F</kbd><span>Começar ou parar o foco</span><kbd>Esc</kbd><span>Fechar janela</span><kbd>Clique direito</kbd><span>Menu do cartão</span></div></section>
      <section class="stat so-pc"><div class="cfg-h">🖥️ Servidor</div><button class="btn danger" id="cOff">⏻ Desligar o MyLoot</button> ${M.hint('Desliga o servidor. Para abrir de novo, use o atalho da área de trabalho.')}</section>
    </div></div>`;
    const set = (k, val) => { s[k] = val; M.save(); M.applySettings(); };
    $('#cAuto').onchange = (e) => { set('themeAuto', e.target.checked); SFX.play('click'); M.render(); };
    $('#cFont').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; set('fontScale', +b.dataset.f); SFX.play('click'); M.render(); };
    $('#cTheme').onchange = (e) => { set('theme', e.target.checked ? 'dark' : 'light'); SFX.play('click'); };
    $('#cCompact').onchange = (e) => { set('compact', e.target.checked); SFX.play('click'); };
    $('#cGame').onchange = (e) => { set('gamify', e.target.checked); M.renderHud(); SFX.play('click'); };
    $('#cSnd').onchange = (e) => { set('sounds', e.target.checked); SFX.play('coin'); };
    $('#cMusV').oninput = (e) => { if (M.musica) M.musica.volume(+e.target.value); };
    $('#cMusV').onchange = (e) => set('musicaVol', +e.target.value);
    $('#cConf').onchange = (e) => { set('confetti', e.target.checked); FX.burst(null, null, 30); };
    $('#cGoal').onchange = (e) => { set('dailyGoal', Math.max(10, Math.min(500, +e.target.value || 50))); M.renderHud(); };

    M.intBind();
    M.iaBind(set);
    M.versaoBind();
    M.celBind();
    M.tourBind();
    M.dadosBind();
    M.suporteBind();
    M.cnxBind();

    // menu das seções (à esquerda no computador, em cima no celular): um clique leva até o cartão
    const secs = $$('#cfgCols section.stat').filter((x) => x.offsetParent !== null);
    $('#cfgMenu').innerHTML = secs.map((x, i) => { if (!x.id) x.id = 'cfgS' + i; const h = x.querySelector('.cfg-h'); return `<button data-s="${x.id}">${esc(((h && h.firstChild && h.firstChild.textContent) || '').trim())}</button>`; }).join('');
    $('#cfgMenu').onclick = (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const x = document.getElementById(b.dataset.s); if (!x) return;
      x.scrollIntoView({ block: 'center', behavior: 'smooth' }); x.classList.remove('pisca'); void x.offsetWidth; x.classList.add('pisca'); SFX.play('click');
    };

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
      e.target.value = '';
      if (!(await M.confirm('Trocar os dados atuais pelos desse backup? Uma cópia dos atuais é guardada antes.', 'Restaurar'))) return;
      try { await M.api('/api/restore', { method: 'POST', body: await M.corpoRestaurar(f) }); await M.load(); M.applySettings(); M.toast('✅ Backup restaurado'); M.go('lib'); } catch (er) { M.toast('⚠️ ' + er.message); }
    };
    $('#cOff').onclick = async () => {
      if (!(await M.confirm('Desligar o servidor do MyLoot?', 'Desligar'))) return;
      try { await M.api('/api/shutdown', { method: 'POST' }); } catch (_) {}
      document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font:700 20px monospace;color:#aaa;background:#070b18">MyLoot desligado. Pode fechar esta aba. 👋</div>';
    };
  };
})();
