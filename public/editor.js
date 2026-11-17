// Cartão do item (estilo Trello) com salvamento automático.
(function () {
  const { esc, $, $$ } = M;
  M.cur = null; // item aberto
  // materiais que vêm prontos (kits e modelos): são exemplos para a pessoa adaptar
  M.ehMaterial = (it) => /^(kit-|modelos-)/.test(it.id) || ['c-negocio', 'c-lancamento'].includes(it.cat);
  M.PROMPT_MARCA = 'Utilize este documento como referência e adapte o conteúdo para a minha empresa. Mantenha a estrutura e as informações relevantes, mas personalize a linguagem, a apresentação e a identidade visual para a minha marca. Minha empresa: [NOME E O QUE FAZ]. Cores e fontes: [SE TIVER]. Tom de voz: [EX.: próximo e direto]. Entregue pronto para eu enviar ao meu cliente.';

  M.createItem = (o, defer) => {
    const it = M.newItem(Object.assign({ cat: M.ui.cat || '', type: M.ui.type || 'nota' }, o));
    M.db.items.push(it);
    if (!defer) M.award('item');
    M.save();
    SFX.play('pop');
    return it;
  };

  M.attachFiles = async (it, files, after) => {
    let n = 0;
    for (const f of files) {
      try { it.attachments.push(await M.upload(f)); n++; M.award('attach'); } catch (e) { M.toast('⚠️ ' + f.name + ': ' + e.message); }
    }
    if (n) { it.updated = Date.now(); M.save(); SFX.play('drop'); M.toast(`📎 ${n} arquivo${n > 1 ? 's' : ''} anexado${n > 1 ? 's' : ''}`); }
    if (after) after();
  };

  M.itemFromFiles = async (files) => {
    let last = null;
    for (const f of files) {
      const isDoc = /\.(pdf|docx?|pptx?|epub|txt)$/i.test(f.name);
      const it = M.createItem({ type: isDoc ? 'estudo' : 'nota', title: f.name.replace(/\.[^.]+$/, '') });
      await M.attachFiles(it, [f]);
      last = it;
    }
    M.render();
    if (last && files.length === 1) M.openItem(last.id);
    else M.toast(`📥 ${files.length} itens criados`);
  };

  M.newItemDialog = (o) => { const it = M.createItem(Object.assign({ title: '' }, o), true); it._new = true; M.openItem(it.id); };

  M.openItem = (id) => {
    const it = M.db.items.find((i) => i.id === id);
    if (!it) return;
    M.cur = it;
    SFX.play('open');
    let base = M.rasc.abrir(it); // traz de volta o rascunho guardado (se houver) e tira a foto da versão salva
    const touch = () => { if (!it._new) M.rasc.tocar(it, base); it.updated = Date.now(); M.save(); M.rodapePinta(m, it, it._new); };
    const m = M.modal('<div></div>', { onClose: () => {
      M.cur = null;
      // item que já existia e foi mudado sem "Salvar": o cartão fica com a versão antiga e as mudanças viram rascunho
      if (!it._new && M.db.items.includes(it)) { if (M.rasc.guardar(it)) M.toast('📝 Alterações guardadas como rascunho. Abra o item de novo para salvar ou descartar.'); M.save(); }
      // item novo vazio e sem nada: descarta sem barulho
      if (it._new && !it.title && !it.desc && !it.content && !it.attachments.length && !it.checklist.length) {
        M.db.items = M.db.items.filter((x) => x.id !== it.id); M.save();
      } else if (it._new && M.db.items.includes(it)) M.toast('✅ Item salvo na Biblioteca'); // fechou no ✕: avisa que ficou guardado
      delete it._new; delete it._xp;
      M.render();
      // item aberto de dentro da ficha do cliente: volta para a ficha
      if (M.cliAberto && M.client && M.client(M.cliAberto)) setTimeout(() => { if (!M.modalOpen()) M.openClient(M.cliAberto); }, 0);
    } });

    function draw() {
      const t = M.type(it.type);
      m.innerHTML = `
        <div class="modal-h" style="border-bottom-color:${t.color}">
          <span style="font-size:22px">${t.em}</span>
          <h2>${t.name}</h2>
          <span class="savedot" id="savedot">✔ salvo</span>
          <button class="icon-btn" id="eFav" title="Favorito">${it.fav ? '⭐' : '☆'}</button>
          <button class="icon-btn" id="eDel" title="Lixeira">🗑️</button>
          <button class="icon-btn" id="eX" title="Fechar (Esc)">✕</button>
        </div>
        <div class="modal-b">
          <div class="types" id="eTypes">${M.TYPES.map((x) => `<div class="slot ${x.id === it.type ? 'on' : ''}" data-t="${x.id}" style="--c:${x.color}">${x.em} ${x.name}</div>`).join('')}</div>
          <div class="com-mic"><input class="title-in" id="eTitle" type="text" placeholder="Título" value="${esc(it.title)}">${M.micBtn('#eTitle')}</div>
          <div class="fld"><label>Descrição ${M.hint('Um resumo curto. Aparece no cartão.')}${M.micBtn('#eDesc')}</label><textarea id="eDesc" style="min-height:56px;font-family:var(--f)" placeholder="Sobre o que é?">${esc(it.desc)}</textarea></div>
          <div class="fld"><label>${it.type === 'link' ? 'Endereço (URL)' : 'Conteúdo'} ${M.hint(it.type === 'prompt' ? 'Copiar este prompt dá XP.' : 'O texto principal. Use o botão Copiar para levar para outro lugar.')}${it.type === 'link' ? '' : M.micBtn('#eContent')}</label>
            <div class="copybox"><textarea id="eContent" placeholder="${it.type === 'link' ? 'https://…' : it.type === 'comando' ? 'Cole o comando aqui' : 'Escreva ou cole aqui'}">${esc(it.content)}</textarea>
            <button class="btn sm" id="eCopy">📋 Copiar</button></div>
            <div id="eAi" style="margin-top:8px"></div>
            ${it.type === 'link' && /^https?:\/\//i.test(it.content.trim()) ? `<a class="btn sm ghost" style="margin-top:8px" href="${esc(it.content.trim())}" target="_blank" rel="noopener">↗ Abrir link</a>` : ''}
          </div>
          <div class="row">
            <div class="fld"><label>Categoria</label><select id="eCat"><option value="">— nenhuma —</option>${M.db.categories.map((c) => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></div>
            <div class="fld"><label>Status</label><select id="eSt">${M.STATUS.map((s) => `<option value="${s.id}" ${s.id === it.status ? 'selected' : ''}>${s.em} ${s.name}</option>`).join('')}</select></div>
            <div class="fld"><label>Data</label><input type="date" id="eDate" value="${it.date}"></div>
            ${(M.db.clients || []).length ? `<div class="fld"><label>Cliente</label><select id="eCli"><option value="">— nenhum —</option>${M.db.clients.map((c) => `<option value="${c.id}" ${c.id === it.client ? 'selected' : ''}>👤 ${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
          </div>
          <div class="cfg-row" style="border:0;padding:0"><span class="l" style="font-size:13px">📐 Usar como modelo ${M.hint('Modelos aparecem em ＋ Novo item: o item novo já nasce com o texto e o checklist deste. Bom para briefing, roteiro, checklist de post.')}</span>${M.sw('eMod', it.modelo)}</div>
          <div class="fld"><label>Etiquetas ${M.hint('Separe com vírgula. Ex: ia, estudo, urgente')}</label><input type="text" id="eTags" value="${esc(it.tags.join(', '))}" placeholder="ia, estudo…" list="tagList"><datalist id="tagList">${M.allTags().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
          <div class="fld"><label>Checklist</label><div id="eCheck"></div></div>
          <div class="fld"><label>Links</label><div id="eLinks"></div></div>
          ${M.origemHTML(it)}
          <div class="fld"><label>Anexos ${M.hint('Arraste arquivos para cá. Eles são copiados para a pasta data/anexos.')}</label><div id="eAtt"></div><div id="ePrev"></div></div>
          ${M.ehMaterial(it) ? `<div class="dica-ia"><b>💡 Dica: personalize este documento com IA</b><p>Este material é um exemplo de referência (o PDF vem com a identidade da Prestes Design). Use como ponto de partida: mande o texto ou o PDF para o Claude, o Codex ou outra IA e peça para adaptar à sua marca, à sua identidade visual, à sua linguagem e às suas necessidades.</p><div class="cmd" id="ePromptIA">${esc(M.PROMPT_MARCA)}</div><button class="btn sm ghost" id="eCopiaIA">📋 Copiar comando</button></div>` : ''}
        </div>${M.rodapeSalvar(it._new)}`;
      bind();
      drawCheck(); drawLinks(); drawAtt(); drawAi();
      M.rodapePinta(m, it, it._new);
    }

    // ----- Claude: melhorar, resumir, corrigir… -----
    function drawAi(state) {
      const box = $('#eAi', m); if (!box) return;
      const acts = [['melhorar', '✨ Melhorar'], ['corrigir', '🩹 Corrigir'], ['encurtar', '✂️ Encurtar'], ['resumir', '📌 Resumir'], ...(it.type === 'prompt' ? [['prompt', '🪄 Turbinar prompt']] : []), ['checklist', '☑️ Virar checklist'], ['titulo', '🏷️ Sugerir título']];
      if (!state) { box.innerHTML = `<div class="row" style="gap:8px"><button class="btn sm violet" id="aiOpen" style="flex:none">🤖 Pedir à IA</button><button class="btn sm ghost" id="sendTo" style="flex:none">📤 Enviar para…</button></div>`; $('#aiOpen', box).onclick = () => drawAi({ open: true }); $('#sendTo', box).onclick = (e) => M.sendMenu(e, it); return; }
      box.innerHTML = `<div class="ai"><div class="ai-h">🤖 IA ${M.hint('Usa o Claude Code ou o Codex (a sua assinatura) ou a chave da API, conforme as Configurações. O texto do campo acima só é enviado quando você clica.')}<span style="flex:1"></span><select id="aiUse" hidden style="width:auto;padding:2px 8px;font-size:12px;margin-right:6px"></select><button class="xbtn" id="aiX">✕</button></div>
        <div class="ai-acts">${acts.map(([k, n]) => `<button data-k="${k}">${n}</button>`).join('')}</div>
        <div class="ai-ask"><input type="text" id="aiQ" placeholder="Ou peça do seu jeito: “traduza para inglês”, “deixe mais formal”…"><button class="btn sm violet" id="aiGo" style="flex:none">Enviar</button></div>
        <div id="aiRes">${state.load ? '<div class="ai-load"><i></i><i></i><i></i> A IA está pensando…</div>' : state.err ? `<div style="color:var(--red);font-weight:600">⚠️ ${esc(state.err)}</div>` : state.out != null ? `<div class="ai-out">${esc(state.out)}</div><div class="row" style="margin-top:8px;gap:8px">${state.k === 'titulo' ? '<button class="btn sm" data-u="title" style="flex:none">Usar como título</button>' : state.k === 'checklist' ? '<button class="btn sm" data-u="check" style="flex:none">Adicionar ao checklist</button>' : '<button class="btn sm" data-u="rep" style="flex:none">Substituir</button><button class="btn sm ghost" data-u="add" style="flex:none">Inserir abaixo</button>'}<button class="btn sm ghost" data-u="copy" style="flex:none">📋 Copiar</button><button class="btn sm ghost" data-u="no" style="flex:none">Descartar</button></div>` : ''}</div></div>`;
      $('#aiX', box).onclick = () => drawAi();
      M.iaDisponiveis().then((L) => {
        const sel = $('#aiUse', box); if (!sel || L.length < 2) { if (M.db.settings.aiUltima && !L.some((x) => x.id === M.db.settings.aiUltima)) M.db.settings.aiUltima = ''; return; }
        sel.innerHTML = '<option value="">Automático</option>' + L.map((x) => `<option value="${x.id}">${x.nome}</option>`).join('');
        sel.value = L.some((x) => x.id === M.db.settings.aiUltima) ? M.db.settings.aiUltima : '';
        sel.hidden = false; sel.onchange = () => { M.db.settings.aiUltima = sel.value; M.save(); };
      }).catch(() => {});
      const ask = async (k, pedido) => {
        const texto = it.content || it.desc || it.title;
        if (k !== 'livre' && !texto.trim()) return drawAi({ err: 'Escreva algo no conteúdo primeiro.' });
        drawAi({ load: true });
        try {
          const r = await M.api('/api/ai', { method: 'POST', body: JSON.stringify({ acao: k, pedido, texto, via: M.db.settings.aiUltima || undefined }) });
          if (M.cur !== it) return;
          SFX.play('star'); drawAi({ out: r.texto + (r.cortado ? '\n\n[resposta cortada por tamanho]' : ''), k });
        } catch (e) { if (M.cur === it) { SFX.play('error'); drawAi({ err: e.message }); } }
      };
      $('.ai-acts', box).onclick = (e) => { const b = e.target.closest('button'); if (b) ask(b.dataset.k); };
      const go = () => { const q = $('#aiQ', box).value.trim(); if (q) ask('livre', q); else M.falta($('#aiQ', box), '✍️ Escreva o que você quer pedir à IA'); };
      $('#aiGo', box).onclick = go; $('#aiQ', box).onkeydown = (e) => { if (e.key === 'Enter') go(); };
      $('#aiRes', box).onclick = (e) => {
        const u = e.target.dataset.u; if (!u) return;
        const out = state.out;
        if (u === 'copy') { navigator.clipboard.writeText(out).catch(() => {}); SFX.play('copy'); return M.toast('📋 Copiado!'); }
        if (u === 'no') return drawAi({ open: true });
        const before = { title: it.title, content: it.content, checklist: it.checklist.slice() };
        if (u === 'rep') it.content = out;
        else if (u === 'add') it.content = (it.content ? it.content + '\n\n' : '') + out;
        else if (u === 'title') it.title = out.replace(/^["“]|["”]$/g, '').split('\n')[0];
        else if (u === 'check') out.split('\n').map((l) => l.replace(/^[-*•\d.)\s[\]x]+/i, '').trim()).filter(Boolean).forEach((t) => it.checklist.push({ id: M.uid(), t, done: false }));
        touch(); SFX.play('drop'); draw();
        M.toast('✨ Aplicado', () => { Object.assign(it, before); touch(); if (M.cur === it) draw(); });
      };
    }

    function bind() {
      $('#eX', m).onclick = M.closeModal;
      $('#svOk', m).onclick = () => {
        if (!it.title.trim() && !it.desc && !it.content && !it.attachments.length && !it.checklist.length) return M.falta($('#eTitle', m), '✍️ Escreva pelo menos um título');
        const novo = it._new, mudou = M.rasc.pendente(it);
        delete it._new; M.rasc.salvar(it); M.save(); M.closeModal();
        if (novo) M.toast('✅ Item salvo na Biblioteca'); else if (mudou) M.toast('✅ Alterações salvas');
      };
      if ($('#svRev', m)) $('#svRev', m).onclick = () => { M.rasc.reverter(it); base = M.rasc.foto(it); M.save(); SFX.play('undo'); draw(); M.toast('↩ Alterações descartadas: voltou a versão salva'); };
      if ($('#svNo', m)) $('#svNo', m).onclick = () => { M.db.items = M.db.items.filter((x) => x.id !== it.id); delete it._new; M.save(); M.closeModal(); M.toast('Item descartado'); };
      $('#eDel', m).onclick = () => { M.closeModal(); M.trashItem(it); };
      $('#eFav', m).onclick = () => { it.fav = !it.fav; touch(); SFX.play(it.fav ? 'star' : 'click'); $('#eFav', m).textContent = it.fav ? '⭐' : '☆'; };
      $('#eCopy', m).onclick = () => M.copyItem(it);
      if ($('#eCopiaIA', m)) $('#eCopiaIA', m).onclick = () => { navigator.clipboard.writeText(M.PROMPT_MARCA).catch(() => {}); SFX.play('copy'); M.toast('📋 Comando copiado. Cole na sua IA junto com o documento.'); };
      $('#eTypes', m).onclick = (e) => { const x = e.target.closest('.slot'); if (!x) return; it.type = x.dataset.t; touch(); SFX.play('click'); draw(); };
      $('#eTitle', m).oninput = (e) => {
        it.title = e.target.value; touch();
        if (it._new && !it._xp && it.title.trim().length > 2) { it._xp = true; M.award('item'); }
      };
      $('#eDesc', m).oninput = (e) => { it.desc = e.target.value; touch(); };
      $('#eContent', m).oninput = (e) => { it.content = e.target.value; touch(); };
      $('#eCat', m).onchange = (e) => { it.cat = e.target.value; touch(); };
      $('#eSt', m).onchange = (e) => { it.status = e.target.value; touch(); SFX.play('click'); };
      $('#eDate', m).onchange = (e) => { it.date = e.target.value; touch(); };
      if ($('#eCli', m)) $('#eCli', m).onchange = (e) => { it.client = e.target.value; touch(); SFX.play('click'); };
      $('#eMod', m).onchange = (e) => { it.modelo = e.target.checked; touch(); SFX.play('click'); if (it.modelo) M.toast('📐 Agora aparece em ＋ Novo item'); };
      $('#eTags', m).oninput = (e) => { it.tags = [...new Set(e.target.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean))]; touch(); };
    }

    function drawCheck() {
      const box = $('#eCheck', m);
      box.innerHTML = it.checklist.map((c) => `<div class="chk ${c.done ? 'done' : ''}" data-id="${c.id}"><input type="checkbox" ${c.done ? 'checked' : ''}><input type="text" value="${esc(c.t)}"><button class="xbtn" title="Remover">✕</button></div>`).join('') +
        `<input type="text" id="eCheckNew" placeholder="＋ Novo passo (Enter)" style="margin-top:6px">`;
      box.onchange = (e) => {
        const row = e.target.closest('.chk'); if (!row) return;
        const c = it.checklist.find((x) => x.id === row.dataset.id);
        if (e.target.type === 'checkbox') { c.done = e.target.checked; row.classList.toggle('done', c.done); touch(); if (c.done) M.award('check', { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 }); }
      };
      box.oninput = (e) => { const row = e.target.closest('.chk'); if (row && e.target.type === 'text') { it.checklist.find((x) => x.id === row.dataset.id).t = e.target.value; touch(); } };
      box.onclick = (e) => { if (e.target.classList.contains('xbtn')) { it.checklist = it.checklist.filter((x) => x.id !== e.target.closest('.chk').dataset.id); touch(); drawCheck(); } };
      $('#eCheckNew', m).onkeydown = (e) => { if (e.key === 'Enter' && e.target.value.trim()) { it.checklist.push({ id: M.uid(), t: e.target.value.trim(), done: false }); touch(); SFX.play('click'); drawCheck(); $('#eCheckNew', m).focus(); } };
    }

    function drawLinks() {
      const box = $('#eLinks', m);
      box.innerHTML = it.links.map((l) => `<div class="chk" data-id="${l.id}"><span>🔗</span><a href="${esc(l.url)}" target="_blank" rel="noopener" style="flex:1;color:var(--cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.label || l.url)}</a><button class="xbtn" title="Remover">✕</button></div>`).join('') +
        `<input type="text" id="eLinkNew" placeholder="＋ Cole um link e aperte Enter" style="margin-top:6px">`;
      box.onclick = (e) => { if (e.target.classList.contains('xbtn')) { it.links = it.links.filter((x) => x.id !== e.target.closest('.chk').dataset.id); touch(); drawLinks(); } };
      $('#eLinkNew', m).onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        let v = e.target.value.trim(); if (!v) return;
        if (!/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
        let label = ''; try { label = new URL(v).hostname.replace(/^www\./, ''); } catch (_) {}
        it.links.push({ id: M.uid(), url: v, label }); touch(); SFX.play('click'); drawLinks(); $('#eLinkNew', m).focus();
      };
    }

    function drawAtt() {
      const box = $('#eAtt', m);
      box.innerHTML = it.attachments.map((a) => `<div class="attach" data-id="${a.id}"><span class="ic">${M.fileIcon(a)}</span><span class="nm" title="${esc(a.name)}">${esc(a.name)}</span><small>${M.size(a.size)}</small><button class="btn sm ghost" data-a="prev" title="${M.isText(a.name) ? 'Ler em blocos' : 'Ver aqui dentro'}">${M.isText(a.name) ? M.ic('livro') + ' Ler' : M.ic('olho') + ' Ver'}</button><button class="btn sm ghost" data-a="open" title="Abrir no programa do computador">${M.ic('abrir')} Abrir</button><button class="btn sm ghost" data-a="show" title="Mostrar na pasta">${M.ic('pasta')} Pasta</button><button class="xbtn" data-a="rm" title="Remover">✕</button></div>`).join('<div style="height:6px"></div>') +
        `<div class="dz" id="eDz" style="margin-top:8px">${M.ic('clipe')} Arraste arquivos aqui ou clique para escolher</div><input type="file" id="eFile" multiple hidden>`;
      box.onclick = async (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = it.attachments.find((x) => x.id === b.closest('.attach').dataset.id);
        if (b.dataset.a === 'rm') { it.attachments = it.attachments.filter((x) => x !== a); touch(); drawAtt(); $('#ePrev', m).innerHTML = ''; }
        else if (b.dataset.a === 'open') M.api('/api/open', { method: 'POST', body: JSON.stringify({ file: a.file }) }).catch((er) => M.toast('⚠️ ' + er.message));
        else if (b.dataset.a === 'show') M.api('/api/reveal', { method: 'POST', body: JSON.stringify({ file: a.file }) }).catch((er) => M.toast('⚠️ ' + er.message));
        else preview(a);
      };
      const dz = $('#eDz', m), fi = $('#eFile', m);
      dz.onclick = () => fi.click();
      fi.onchange = () => M.attachFiles(it, [...fi.files], () => { touch(); drawAtt(); });
      dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); M.attachFiles(it, [...e.dataTransfer.files], () => { touch(); drawAtt(); }); };
    }

    function preview(a) {
      if (M.isText(a.name)) return M.openReader(a);
      const url = '/anexos/' + encodeURIComponent(a.file), n = a.name.toLowerCase(), box = $('#ePrev', m);
      let h = '';
      if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) h = `<img src="${url}" alt="">`;
      else if (/\.pdf$/.test(n)) h = `<iframe src="${url}"></iframe>`;
      else if (/\.(mp4|webm)$/.test(n)) h = `<video src="${url}" controls style="width:100%;max-height:60vh"></video>`;
      else if (/\.(mp3|wav|ogg|m4a)$/.test(n)) h = `<audio src="${url}" controls style="width:100%"></audio>`;
      else if (/\.(txt|md|json|csv|log)$/.test(n)) h = `<iframe src="${url}" style="background:#fff"></iframe>`;
      else { M.toast('Sem pré-visualização para esse tipo. Use “Abrir”.'); return; }
      box.innerHTML = `<div class="preview" style="margin-top:10px">${h}</div>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    draw();
    if (!it.title) $('#eTitle', m).focus();
  };
})();
