// Extras: modelos de item e a seção Dados e backup das Configurações (backup completo, só dos registros, cópias automáticas, exportar).
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
      <div class="modal-b novo-b"><div class="mod-grid">
        <button class="mod destaque" data-m=""><span class="em">📄</span><span class="tx"><b>Em branco</b><small>Começar do zero</small></span></button>
        <button class="mod destaque" data-m="voz"><span class="em">🎙️</span><span class="tx"><b>Por voz</b><small>Fale e a IA organiza</small></span></button>
        ${L.map((it) => { const d = it.desc || M.type(it.type).name; return `<button class="mod" data-m="${it.id}" style="--c:${M.type(it.type).color}" title="${esc(d)}"><span class="em">${M.type(it.type).em}</span><span class="tx"><b>${esc((it.title || 'Sem título').replace(/^modelo:?\s*/i, ''))}</b><small>${esc(d)}</small></span></button>`; }).join('')}
      </div><small style="color:var(--faint)">Os modelos são exemplos para adaptar à sua marca. Para criar o seu, abra um item e ligue “📐 Usar como modelo”.</small></div>`);
    $('#x', m).onclick = M.closeModal;
    m.onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'voz') { M.closeModal(); return M.voz(); }
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

  // ----- Configurações → Dados e backup -----
  // Do mais completo ao mais leve: backup completo (.zip com os anexos), backup só dos registros (.json ou .myloot com senha),
  // as cópias automáticas que o servidor guarda sozinho e a exportação em Markdown. Restaurar é um botão só: o arquivo escolhido decide o caminho.
  const tam = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1).replace('.', ',') + ' GB' : M.size(n));
  const plural = (n, um, varios) => { n = Number(n) || 0; return n + ' ' + (n === 1 ? um : varios); }; // número de fora do arquivo nunca vira HTML
  const contagem = (o) => [plural(o.itens, 'item', 'itens'), plural(o.tarefas, 'tarefa', 'tarefas'), plural(o.clientes, 'cliente', 'clientes')].join(' · ');
  const agora = () => ({ itens: M.db.items.length, tarefas: M.db.tasks.length, clientes: M.db.clients.length });
  const dataHora = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`; };
  // espera a gravação normal terminar (a que usa revisão); devolve false se passou de 15 s e ainda não terminou
  M.salvou = () => new Promise((ok) => { const t0 = Date.now(); (function ve() { if (!M.salvando()) return ok(true); if (Date.now() - t0 > 15000) return ok(false); setTimeout(ve, 80); })(); });

  M.dadosExtras = () => {
    const n = (k) => (M.db[k] || []).length;
    return `
    <div class="bk-bloco">
      <div class="bk-t">💾 Backup completo <span class="tag">recomendado</span></div>
      <p class="bk-p">Um arquivo .zip com tudo: os registros e os arquivos anexados (PDFs, imagens, áudios). É o que serve para trocar de computador ou guardar num HD externo.</p>
      <div class="row bk-btns"><a class="btn" id="cBakC" href="/api/backup/completo" download style="flex:none">💾 Backup completo (com anexos)</a>${M.hint('As chaves da IA, do Notion e do Trello não entram no backup. No outro computador, conecte de novo.')}</div>
      <small class="bk-info" id="cBakInfo"></small>
    </div>
    <div class="bk-bloco">
      <div class="bk-t">📄 Backup só dos registros (sem anexos)</div>
      <p class="bk-p">Arquivo pequeno com itens, tarefas, clientes, Financeiro e Rotina. Os arquivos anexados não vão junto: em outro computador os itens abrem, mas os anexos ficam faltando.</p>
      <div class="row bk-btns"><a class="btn ghost" id="cBak" href="/api/backup" download="myloot-backup.json" style="flex:none">⬇️ Baixar registros (.json)</a><button class="btn ghost" id="cBakS" style="flex:none">🔒 Baixar registros com senha</button>${M.hint('O arquivo .myloot só abre com a senha (criptografia AES-256). Bom para guardar no Drive ou mandar por e-mail. Se esquecer a senha, não tem como recuperar.')}</div>
    </div>
    <div class="bk-bloco so-pc">
      <div class="bk-t">⬆️ Restaurar um backup</div>
      <p class="bk-p">Escolha o arquivo que você baixou: o .zip do backup completo, ou o .json ou .myloot dos registros. Antes de trocar, o MyLoot guarda uma cópia do que está aqui agora.</p>
      <div class="row bk-btns"><button class="btn ghost" id="cRes" style="flex:none">⬆️ Restaurar backup</button><input type="file" id="cResF" accept=".zip,.json,.myloot,application/zip,application/json" hidden></div>
    </div>
    <div class="bk-bloco so-pc">
      <div class="bk-t">🕘 Cópias automáticas</div>
      <p class="bk-p">O MyLoot guarda sozinho uma cópia dos registros por dia (ficam as 20 mais novas) e mais uma sempre que você restaura algo. Voltar para uma cópia não mexe nos arquivos anexados.</p>
      <div class="bk-lista" id="cCopias"><small style="color:var(--faint)">Procurando as cópias…</small></div>
    </div>
    <div class="bk-bloco">
      <div class="bk-t">🗂️ Exportar para usar fora do MyLoot</div>
      <p class="bk-p">Vem dentro do .zip: ${plural(n('items'), 'item', 'itens')} da Biblioteca (um arquivo .md por item, com os anexos), ${plural(n('clients'), 'cliente', 'clientes')}, ${plural(n('tasks'), 'tarefa', 'tarefas')}, ${plural(n('fin'), 'lançamento', 'lançamentos')} do Financeiro (planilha .csv), ${plural(n('habits'), 'hábito', 'hábitos')}, ${plural(n('goals'), 'meta', 'metas')} e ${plural(n('tools'), 'ferramenta sua', 'ferramentas suas')}. Não vem: Lixeira, pontos e configurações. Serve para ler no Obsidian ou em outro app. Para guardar e restaurar, use o backup completo.</p>
      <div class="row bk-btns">${M.remoto ? '<small style="color:var(--faint)">💻 Só dá para exportar no computador onde o MyLoot está instalado.</small>' : '<a class="btn ghost" id="cExp" href="/api/exportar-md" style="flex:none">🗂️ Exportar tudo em Markdown (.zip)</a>'}${M.hint('Extraia o .zip e abra a pasta no Obsidian como cofre. Dentro vem um LEIA-ME com a lista do que foi exportado.')}</div>
    </div>`;
  };

  // pergunta antes de trocar os dados, dizendo o que entra e o que sai (as linhas já chegam prontas e com o texto de fora escapado)
  const confirmaTroca = (titulo, linhas, botao) => new Promise((res) => {
    let feito = false; const fim = (v) => { if (!feito) { feito = true; res(v); } };
    const m = M.modal(`<div class="modal-h"><h2>${esc(titulo)}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><ul class="bk-troca">${linhas.filter(Boolean).map((l) => `<li>${l}</li>`).join('')}</ul>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="cn" style="flex:none">Cancelar</button><button class="btn danger" id="cy" style="flex:none">${esc(botao)}</button></div></div>`, { small: true, onClose: () => fim(false) });
    $('#x', m).onclick = M.closeModal; $('#cn', m).onclick = M.closeModal;
    $('#cy', m).onclick = () => { fim(true); M.closeModal(); };
  });
  const saiAgora = () => `<b>Sai:</b> o que está no MyLoot agora (${contagem(agora())}). Fica guardado em Cópias automáticas, como “guardada antes de restaurar”.`;
  const recarrega = async (msg) => { await M.load(); M.applySettings(); M.toast(msg); M.go('lib'); };

  // a etiqueta é o primeiro arquivo do ZIP e não é compactada: dá para ler só o começo, sem carregar o backup inteiro
  async function lerEtiqueta(f) {
    try {
      const b = new Uint8Array(await f.slice(0, 4096).arrayBuffer()), v = new DataView(b.buffer), dec = new TextDecoder();
      if (v.getUint32(0, true) !== 0x04034b50) return null;
      const nl = v.getUint16(26, true), ini = 30 + nl + v.getUint16(28, true);
      if (dec.decode(b.subarray(30, 30 + nl)) !== 'myloot-backup.json') return null;
      const j = JSON.parse(dec.decode(b.subarray(ini, ini + v.getUint32(18, true))));
      return j.formato === 'myloot-completo' ? j : null;
    } catch (_) { return null; }
  }
  // manda o ZIP direto do disco (não passa pela memória) e mostra o andamento
  function enviarZip(f) {
    const m = M.modal(`<div class="modal-h"><h2>⬆️ Restaurando o backup</h2></div><div class="modal-b"><div class="bk-barra"><i id="bkP"></i></div><small id="bkT" style="color:var(--dim)" aria-live="polite">Enviando o arquivo…</small><small style="color:var(--faint)">Não feche o MyLoot até terminar. Backup grande pode levar alguns minutos.</small></div>`, { small: true });
    const fecha = () => { if (m.isConnected) M.closeModal(); };
    return new Promise((ok, no) => {
      const x = new XMLHttpRequest();
      x.open('POST', '/api/restore/completo'); x.setRequestHeader('X-MyLoot', '1'); x.setRequestHeader('Content-Type', 'application/zip');
      x.upload.onprogress = (e) => {
        if (!e.lengthComputable || !m.isConnected) return;
        const p = Math.round((e.loaded / e.total) * 100);
        $('#bkP', m).style.width = p + '%'; $('#bkT', m).textContent = p < 100 ? `Enviando o arquivo… ${p}% de ${tam(e.total)}` : 'Conferindo o backup e copiando os anexos…';
      };
      x.onload = () => { fecha(); let j = {}; try { j = JSON.parse(x.responseText); } catch (_) {} if (x.status === 200) ok(j); else no(new Error(j.erro || 'erro ' + x.status)); };
      x.onerror = () => { fecha(); no(new Error('A conexão com o MyLoot caiu no meio do envio. Tente de novo.')); };
      x.send(f);
    });
  }
  // restaurar: .zip é o backup completo; .json e .myloot são só os registros
  M.restaurarArquivo = async (f) => {
    try {
      const pk = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (/\.zip$/i.test(f.name) || (pk[0] === 0x50 && pk[1] === 0x4b && pk[2] === 3 && pk[3] === 4)) {
        const et = await lerEtiqueta(f);
        // sem a etiqueta no começo, pode ser um backup que alguém abriu e compactou de novo: o nome dela aparece no índice, no fim do arquivo
        if (!et && !new TextDecoder('latin1').decode(await f.slice(Math.max(0, f.size - 4e6)).arrayBuffer()).includes('myloot-backup.json')) throw new Error('Esse ZIP não é um backup completo do MyLoot. Use o arquivo baixado no botão “Backup completo (com anexos)”.');
        const ok = await confirmaTroca('⬆️ Restaurar backup completo', [
          et ? `<b>Entra:</b> o backup completo de ${dataHora(Date.parse(et.criado) || f.lastModified)}, com ${contagem(et)} e ${plural(et.anexos || 0, 'anexo', 'anexos')} (${tam(f.size)}).`
            : `<b>Entra:</b> o backup completo do arquivo ${esc(f.name)} (${tam(f.size)}). Ele foi compactado de novo fora do MyLoot, então o resumo só aparece depois. O MyLoot confere tudo antes de trocar qualquer coisa.`, saiAgora(),
          '<b>Anexos:</b> os do backup entram na pasta de anexos. Arquivo igual que já existe é pulado e nada é apagado.'], '⬆️ Restaurar');
        if (!ok) return;
        await M.salvou();
        const r = await enviarZip(f), a = r.anexos || {};
        return await recarrega(`✅ Backup completo restaurado: ${contagem(r)} · ${plural((a.novos || 0) + (a.trocados || 0), 'anexo copiado', 'anexos copiados')}${a.pulados ? ' · ' + plural(a.pulados, 'já estava aqui', 'já estavam aqui') : ''}${a.ignorados ? ' · ' + plural(a.ignorados, 'arquivo de nome inválido ficou de fora', 'arquivos de nome inválido ficaram de fora') : ''}`);
      }
      const corpo = await M.corpoRestaurar(f);
      let j = null; try { j = JSON.parse(corpo); } catch (_) {}
      if (!j || (!j.cripto && !Array.isArray(j.items))) throw new Error('Esse arquivo não parece um backup do MyLoot.');
      const ok = await confirmaTroca('⬆️ Restaurar backup dos registros', [
        `<b>Entra:</b> o arquivo ${esc(f.name)}${j.cripto ? '' : `, com ${contagem({ itens: j.items.length, tarefas: (j.tasks || []).length, clientes: (j.clients || []).length })}`}.`, saiAgora(),
        '<b>Anexos:</b> este backup não traz arquivos anexados. Os que já estão neste computador continuam onde estão.'], '⬆️ Restaurar');
      if (!ok) return;
      await M.salvou();
      await M.api('/api/restore', { method: 'POST', body: corpo });
      await recarrega('✅ Backup dos registros restaurado');
    } catch (er) { if (er.message !== 'Cancelado.') { M.toast('⚠️ ' + er.message); SFX.play('error'); } }
  };

  // lista das cópias que o servidor guarda sozinho, com o que tem dentro de cada uma
  async function desenhaCopias() {
    const box = $('#cCopias'); if (!box || M.remoto) return;
    let L;
    try { L = (await M.api('/api/backups')).copias; } catch (e) { if (box.isConnected) box.innerHTML = `<small style="color:var(--dim)">⚠️ Não consegui ler as cópias: ${esc(e.message)}</small>`; return; }
    if (!box.isConnected) return;
    if (!L.length) { box.innerHTML = '<small style="color:var(--faint)">Ainda não há cópias. A primeira é feita no dia em que você salvar algo.</small>'; return; }
    const anx = (c) => (c.anexosFaltando ? ` · ⚠️ ${plural(c.anexosFaltando, 'anexo não está', 'anexos não estão')} mais na pasta` : c.anexos ? ` · ${plural(c.anexos, 'anexo', 'anexos')} na pasta` : '');
    const linha = (c) => `<div class="bk-copia"><div class="bk-ct"><span class="bk-q">${c.ruim ? esc(c.arquivo) : dataHora(c.quando)}</span><span class="tag">${c.tipo === 'antes' ? 'guardada antes de restaurar' : c.tipo === 'nuvem' ? 'guardada antes de sincronizar' : 'cópia do dia'}</span>
      <small>${c.ruim ? '⚠️ Não consegui abrir esta cópia.' : contagem(c) + ' · ' + tam(c.tamanho) + anx(c)}</small></div>
      ${c.ruim ? '' : `<button class="btn ghost sm" data-copia="${esc(c.arquivo)}" style="flex:none">↩ Restaurar esta cópia</button>`}</div>`;
    const N = 6;
    box.innerHTML = L.slice(0, N).map(linha).join('') + (L.length > N ? `<div class="bk-mais" hidden>${L.slice(N).map(linha).join('')}</div><button class="btn ghost sm" id="cCopMais" style="align-self:flex-start">Ver as outras ${L.length - N} cópias</button>` : '');
    box.onclick = async (e) => {
      if (e.target.id === 'cCopMais') { box.querySelector('.bk-mais').hidden = false; e.target.remove(); return; }
      const b = e.target.closest('[data-copia]'), c = b && L.find((x) => x.arquivo === b.dataset.copia);
      if (!c) return;
      const ok = await confirmaTroca('↩ Restaurar esta cópia', [
        `<b>Entra:</b> a cópia de ${dataHora(c.quando)}, com ${contagem(c)}.`, saiAgora(),
        '<b>Anexos:</b> os arquivos anexados não mudam.' + (c.anexosFaltando ? ` ⚠️ ${plural(c.anexosFaltando, 'anexo citado nessa cópia não está', 'anexos citados nessa cópia não estão')} mais na pasta.` : '')], '↩ Restaurar');
      if (!ok) return;
      try {
        await M.salvou();
        await M.api('/api/backups/restaurar', { method: 'POST', body: JSON.stringify({ arquivo: c.arquivo }) });
        await recarrega(`✅ Voltei para a cópia de ${dataHora(c.quando)}. O que estava antes ficou em Cópias automáticas.`);
      } catch (er) { M.toast('⚠️ ' + er.message); SFX.play('error'); }
    };
  }

  M.dadosBind = () => {
    const b = $('#cBakS'); if (!b) return;
    // baixar logo depois de mexer em algo: espera a gravação terminar para o arquivo sair com a última mudança
    ['#cBakC', '#cBak', '#cExp'].forEach((s) => { const a = $(s); if (a) a.onclick = async (e) => {
      if (M.salvando()) { e.preventDefault(); await M.salvou(); a.click(); return; }
      // backup feito: guarda a data (o Início lembra depois de 14 dias) e avisa, porque um backup grande demora a começar a baixar
      if (s !== '#cExp') { M.db.settings.bkUlt = Date.now(); M.save(); M.toast('⏳ Preparando o backup… o download começa em instantes'); }
    }; });
    M.api('/api/backup/completo?info=1').then((r) => { const el = $('#cBakInfo'); if (el) el.textContent = `Hoje o backup completo leva ${contagem(r)} e ${plural(r.anexos, 'anexo', 'anexos')}: cerca de ${tam(r.bytes)}.`; }).catch(() => {});
    const rs = $('#cRes'), rf = $('#cResF');
    if (rs && rf) { rs.onclick = () => rf.click(); rf.onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) M.restaurarArquivo(f); }; }
    desenhaCopias();
    b.onclick = () => {
      const m = M.modal(`<div class="modal-h"><h2>🔒 Backup com senha</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
        <input type="password" id="s1" placeholder="Senha (mínimo 6 caracteres)" autocomplete="new-password"><input type="password" id="s2" placeholder="Repita a senha" autocomplete="new-password">
        <small style="color:var(--dim)">Anote a senha num lugar seguro. Sem ela, o backup não abre. Este arquivo leva só os registros, sem os anexos.</small>
        <div class="row" style="justify-content:flex-end"><button class="btn" id="ok" style="flex:none">⬇️ Baixar</button></div></div>`, { small: true });
      $('#x', m).onclick = M.closeModal; $('#s1', m).focus();
      $('#ok', m).onclick = async () => {
        const s = $('#s1', m).value;
        if (s.length < 6) return M.toast('Use pelo menos 6 caracteres.');
        if (s !== $('#s2', m).value) return M.toast('As senhas não são iguais.');
        try {
          await M.salvou();
          const r = await M.api('/api/backup/senha', { method: 'POST', body: JSON.stringify({ senha: s }) });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(r)], { type: 'application/octet-stream' }));
          a.download = `myloot-backup-${M.today()}.myloot`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          M.closeModal(); SFX.play('done'); M.toast('🔒 Backup dos registros com senha baixado');
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
