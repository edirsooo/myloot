// Extras: modelos de item, exportar tudo em Markdown (Obsidian) e backup com senha.
(function () {
  const { esc, $ } = M;

  // ----- modelos -----
  M.modelos = () => M.db.items.filter((i) => i.modelo).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt'));
  M.novoComModelo = (o) => {
    o = o || {};
    const L = M.modelos();
    const irLib = () => { if (!o.client && M.ui.page !== 'lib') { M.ui.page = 'lib'; M.render(); } };
    if (!L.length) { irLib(); return M.newItemDialog(o); }
    const m = M.modal(`<div class="modal-h"><h2>＋ Novo item</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b"><div class="mod-grid">
        <button class="mod" data-m=""><span>📄</span><b>Em branco</b><small>Começar do zero</small></button>
        ${L.map((it) => `<button class="mod" data-m="${it.id}" style="--c:${M.type(it.type).color}"><span>${M.type(it.type).em}</span><b>${esc((it.title || 'Sem título').replace(/^modelo:?\s*/i, ''))}</b><small>${esc(it.desc || M.type(it.type).name)}</small></button>`).join('')}
      </div><small style="color:var(--faint)">Para criar um modelo, abra um item e ligue “📐 Usar como modelo”.</small></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    m.onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      M.closeModal(); irLib();
      const base = M.db.items.find((i) => i.id === b.dataset.m);
      if (!base) return M.newItemDialog(o);
      const it = M.createItem(Object.assign({
        type: base.type, title: (base.title || '').replace(/^modelo:?\s*/i, ''), desc: base.desc, content: base.content, cat: base.cat, tags: base.tags.slice(),
        checklist: base.checklist.map((c) => ({ id: M.uid(), t: c.t, done: false })), links: base.links.map((l) => Object.assign({}, l, { id: M.uid() })),
      }, o));
      M.openItem(it.id);
      setTimeout(() => { const t = $('#eTitle'); if (t) { t.focus(); t.select(); } }, 50);
    };
  };

  // ----- Configurações → Dados: exportar e backup com senha -----
  M.dadosExtras = () => `
    <div class="row" style="align-items:center;margin-top:10px"><a class="btn ghost" href="/api/exportar-md" style="flex:none">🗂️ Exportar tudo em Markdown (.zip)</a>${M.hint('Cada item vira um arquivo .md numa pasta por tipo, com os anexos, mais os clientes e as tarefas. Extraia e abra a pasta no Obsidian como cofre.')}</div>
    <div class="row" style="align-items:center;margin-top:10px"><button class="btn ghost" id="cBakS" style="flex:none">🔒 Baixar backup com senha</button>${M.hint('O arquivo .myloot só abre com a senha (criptografia AES-256). Bom para guardar no Drive ou mandar por e-mail. Se esquecer a senha, não tem como recuperar.')}</div>`;
  M.dadosBind = () => {
    const b = $('#cBakS'); if (!b) return;
    b.onclick = () => {
      const m = M.modal(`<div class="modal-h"><h2>🔒 Backup com senha</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
        <input type="password" id="s1" placeholder="Senha (mínimo 6 caracteres)" autocomplete="new-password"><input type="password" id="s2" placeholder="Repita a senha" autocomplete="new-password">
        <small style="color:var(--dim)">Anote a senha num lugar seguro. Sem ela, o backup não abre.</small>
        <div class="row" style="justify-content:flex-end"><button class="btn" id="ok" style="flex:none">⬇️ Baixar</button></div></div>`, { small: true });
      $('#x', m).onclick = M.closeModal; $('#s1', m).focus();
      $('#ok', m).onclick = async () => {
        const s = $('#s1', m).value;
        if (s.length < 6) return M.toast('Use pelo menos 6 caracteres.');
        if (s !== $('#s2', m).value) return M.toast('As senhas não são iguais.');
        try {
          const r = await M.api('/api/backup/senha', { method: 'POST', body: JSON.stringify({ senha: s }) });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(r)], { type: 'application/octet-stream' }));
          a.download = `myloot-backup-${M.today()}.myloot`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          M.closeModal(); SFX.play('done'); M.toast('🔒 Backup com senha baixado');
        } catch (e) { M.toast('⚠️ ' + e.message); }
      };
    };
  };
  // restaurar aceita o .json comum e o .myloot com senha
  M.corpoRestaurar = async (f) => {
    const txt = await f.text();
    let j; try { j = JSON.parse(txt); } catch (_) { throw new Error('Esse arquivo não parece um backup do MyLoot.'); }
    if (j.formato !== 'myloot-cripto') return txt;
    const senha = await new Promise((ok) => {
      const m = M.modal(`<div class="modal-h"><h2>🔒 Senha do backup</h2></div><div class="modal-b"><input type="password" id="sp" placeholder="Senha"><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no" style="flex:none">Cancelar</button><button class="btn" id="ok" style="flex:none">Abrir</button></div></div>`, { small: true });
      $('#sp', m).focus();
      $('#no', m).onclick = () => { M.closeModal(); ok(null); };
      const go = () => { const v = $('#sp', m).value; M.closeModal(); ok(v); };
      $('#ok', m).onclick = go; $('#sp', m).onkeydown = (e) => { if (e.key === 'Enter') go(); };
    });
    if (senha == null) throw new Error('Cancelado.');
    return JSON.stringify({ cripto: j, senha });
  };
})();
