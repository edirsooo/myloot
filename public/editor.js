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

  // devolve { ok: [anexos que entraram], falhas: [{ name, erro }] }, para quem precisa saber se o arquivo chegou (voz);
  // quem não usa o retorno continua igual: o aviso de cada falha e o de sucesso aparecem como antes
  M.attachFiles = async (it, files, after) => {
    const ok = [], falhas = [], repetidos = [];
    for (const f of files) {
      // mesmo nome e mesmo tamanho já anexado neste item: não sobe de novo
      if (it.attachments.some((a) => a.name === f.name && a.size === f.size)) { repetidos.push(f.name); continue; }
      try { const a = await M.upload(f); it.attachments.push(a); ok.push(a); M.award('attach'); } catch (e) { falhas.push({ name: f.name, erro: e.message }); M.toast('⚠️ ' + f.name + ': ' + e.message); }
    }
    const n = ok.length;
    if (n) { it.updated = Date.now(); M.save(); SFX.play('drop'); M.toast(`📎 ${n} arquivo${n > 1 ? 's' : ''} anexado${n > 1 ? 's' : ''}`); }
    if (repetidos.length) M.toast(`ℹ️ Já estava anexado: ${repetidos.join(', ')}`);
    if (after) after();
    return { ok, falhas, repetidos };
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

  M.newItemDialog = (o) => { const it = M.createItem(Object.assign({ title: '', _new: true }, o), true); M.openItem(it.id); }; // _new antes de salvar: a ficha em branco não entra no histórico

  // "?" de ajuda dentro de um rótulo ligado a um campo (label for): ver a dica não leva o foco para o campo (no celular abriria o teclado)
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('label[for] .hint')) e.preventDefault(); }, true);

  M.openItem = (id) => {
    const it = M.db.items.find((i) => i.id === id);
    if (!it) return;
    if (M.fichaRestaurar && M.fichaRestaurar(id)) return; // já estava aberta (minimizada): volta para ela
    M.cur = it;
    SFX.play('open');
    let base = M.rasc.abrir(it); // traz de volta o rascunho guardado (se houver) e tira a foto da versão salva
    const touch = () => { if (!it._new) M.rasc.tocar(it, base); it.updated = Date.now(); M.save(); M.rodapePinta(m, it, it._new); };
    let novoPasso = '', novoLink = '', linkEd = null, attEd = null, prevId = null; // texto ainda não incorporado em "Novo passo" e "Novo link"; link e anexo em edição
    const m = M.modal('<div></div>', { onClose: () => {
      M.cur = null;
      // item que já existia e foi mudado sem "Salvar": o cartão fica com a versão antiga e as mudanças viram rascunho
      if (!it._new && M.db.items.includes(it)) { if (M.rasc.guardar(it)) M.toast('📝 Alterações guardadas como rascunho. Abra o item de novo para salvar ou descartar.'); M.save(); }
      // item novo vazio e sem nada: descarta sem barulho
      if (it._new && !it.title && !it.desc && !it.content && !it.attachments.length && !it.checklist.length && !it.links.length) {
        M.db.items = M.db.items.filter((x) => x.id !== it.id); M.save();
      } else if (it._new && M.db.items.includes(it)) M.toast('✅ Item salvo na Biblioteca'); // fechou no ✕: avisa que ficou guardado
      delete it._new; delete it._xp;
      M.render();
      // item aberto de dentro da ficha do cliente: volta para a ficha
      if (M.cliAberto && M.client && M.client(M.cliAberto)) setTimeout(() => { if (!M.modalOpen()) M.openClient(M.cliAberto); }, 0);
    }, ficha: it });

    M.versaoGuardar('item', it); // como a ficha estava ao abrir
    function draw() {
      const t = M.type(it.type);
      m.innerHTML = `
        <div class="modal-h" style="border-bottom-color:${t.color}">
          <span style="font-size:22px">${t.em}</span>
          <h2>${t.name}</h2>
          <span class="savedot" id="savedot">✔ salvo</span>
          <button class="icon-btn" id="eClip" title="Anexar arquivo (PDF, imagem, documento)" aria-label="Anexar arquivo">📎</button>
          ${it._new ? '' : '<button class="icon-btn" id="eVer" title="Versões anteriores desta ficha" aria-label="Versões anteriores">🕘</button>'}
          <button class="icon-btn" id="eFav" title="Favorito" aria-label="Favorito" aria-pressed="${it.fav ? 'true' : 'false'}">${it.fav ? '⭐' : '☆'}</button>
          ${it._new ? '' : `<button class="icon-btn" id="eArq" title="${it.arq ? 'Desarquivar: volta para a lista do dia a dia' : 'Arquivar: sai da lista do dia a dia, mas continua guardado'}" aria-label="${it.arq ? 'Desarquivar' : 'Arquivar'}">${it.arq ? '📤' : '🗃️'}</button>`}
          <button class="icon-btn" id="eDel" title="Mandar para a Lixeira" aria-label="Mandar para a Lixeira">🗑️</button>
          <button class="icon-btn" id="eMin" title="Minimizar: a ficha fica na barra de baixo e você abre outra. Dá para trabalhar em várias ao mesmo tempo." aria-label="Minimizar a ficha">➖</button>
          <button class="icon-btn" id="eX" title="Fechar (Esc)" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-b">
          <div class="types" id="eTypes">${M.TYPES_TODOS.filter((x) => !x.oculto || x.id === it.type).map((x) => `<div class="slot ${x.id === it.type ? 'on' : ''}" data-t="${x.id}" style="--c:${x.color}">${x.em} ${x.name}</div>`).join('')}</div>
          <div class="com-mic"><input class="title-in" id="eTitle" type="text" placeholder="Título" aria-label="Título" value="${esc(it.title)}">${M.micBtn('#eTitle')}</div>
          ${M.vozErroHTML ? M.vozErroHTML(it) : ''}
          <div class="fld"><label for="eDesc">Descrição ${M.hint('Um resumo curto. Aparece no cartão.')}${M.micBtn('#eDesc')}</label><textarea id="eDesc" style="min-height:56px;font-family:var(--f)" placeholder="Sobre o que é?">${esc(it.desc)}</textarea></div>
          <div class="fld"><label for="eContent">${it.type === 'link' ? 'Endereço (URL)' : 'Conteúdo'} ${M.hint(it.type === 'prompt' ? 'Copiar este prompt dá XP.' : 'O texto principal. Use o botão Copiar para levar para outro lugar.')}${it.type === 'link' ? '' : M.micBtn('#eContent')}</label>
            <div class="copybox"><textarea id="eContent" placeholder="${it.type === 'link' ? 'https://…' : it.type === 'comando' ? 'Cole o comando aqui' : 'Escreva ou cole aqui'}">${esc(it.content)}</textarea>
            <button class="btn sm" id="eCopy">📋 Copiar</button><button type="button" class="btn sm ghost" id="eExp" title="Aumentar a caixa de escrita (a janela fica larga e a caixa alta)" aria-pressed="false">⤢ Expandir</button></div>
            <div id="eAi" style="margin-top:8px"></div>
            ${it.type === 'link' && /^https?:\/\//i.test(it.content.trim()) ? `<a class="btn sm ghost" style="margin-top:8px" href="${esc(it.content.trim())}" target="_blank" rel="noopener">↗ Abrir link</a>` : ''}
          </div>
          <div class="row">
            ${(M.db.pastas || []).length ? `<div class="fld"><label for="ePasta">Pasta</label><select id="ePasta"><option value="">— fora de pastas —</option>${M.pastaOpcoes(M.pastaDoItem(it))}</select></div>` : ''}
            <div class="fld"><label for="eCat">Categoria</label><select id="eCat"><option value="">— nenhuma —</option>${M.db.categories.map((c) => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></div>
            <div class="fld"><label for="eSt">Status</label><select id="eSt">${M.STATUS.map((s) => `<option value="${esc(s.id)}" ${s.id === M.statusDe(it.status).id ? 'selected' : ''}>${esc(s.em)} ${esc(s.name)}</option>`).join('')}</select></div>
            <div class="fld"><label for="eDate">Data</label><input type="date" id="eDate" value="${it.date}"></div>
            ${(M.db.clients || []).length ? `<div class="fld"><label for="eCli">Cliente</label><select id="eCli"><option value="">— nenhum —</option>${M.db.clients.map((c) => `<option value="${c.id}" ${c.id === it.client ? 'selected' : ''}>👤 ${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
          </div>
          <div class="cfg-row" style="border:0;padding:0"><span class="l" style="font-size:13px">📐 Usar como modelo ${M.hint('Modelos aparecem em ＋ Novo item: o item novo já nasce com o texto e o checklist deste. Bom para briefing, roteiro, checklist de post.')}</span>${M.sw('eMod', it.modelo)}</div>
          <div class="fld"><label for="eTags">Etiquetas ${M.hint('Separe com vírgula. Ex: ia, estudo, urgente')}</label><input type="text" id="eTags" value="${esc(it.tags.join(', '))}" placeholder="ia, estudo…" list="tagList"><datalist id="tagList">${M.allTags().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
          <div class="fld"><label for="eCheckNew">Checklist</label><div id="eCheck"></div></div>
          <div class="fld"><label for="eLinkNew">Links</label><div id="eLinks"></div></div>
          ${M.origemHTML(it)}
          <div class="fld" role="group" aria-labelledby="eAttLab"><div class="lbl" id="eAttLab">Anexos ${M.hint('Arraste arquivos para cá. Eles são copiados para a pasta data/anexos.')}</div><div id="eAtt"></div><div id="ePrev"></div></div>
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
      box.innerHTML = `<div class="ai"><div class="ai-h">🤖 IA ${M.hint('Usa o Claude Code, o Codex ou o Gemini CLI (a sua assinatura) ou uma chave de API, conforme as Configurações. O texto do campo acima só é enviado quando você clica.')}<span style="flex:1"></span><select id="aiUse" hidden style="width:auto;padding:2px 8px;font-size:12px;margin-right:6px"></select><button class="xbtn" id="aiX" title="Fechar a IA" aria-label="Fechar a IA">✕</button></div>
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
      // texto que ficou em "Novo passo" ou "Novo link" sem Enter nem ＋ entra no item antes de salvar ou de fechar (não some)
      const pend = () => { addPasso(true); addLink(true); };
      $('#eX', m).onclick = () => { pend(); M.closeModal(); };
      $('#eMin', m).onclick = () => { pend(); M.fichaMinimizar(); };
      $('#svOk', m).onclick = () => {
        pend();
        if (!it.title.trim() && !it.desc && !it.content && !it.attachments.length && !it.checklist.length && !it.links.length) return M.falta($('#eTitle', m), '✍️ Escreva pelo menos um título');
        const novo = it._new, mudou = M.rasc.pendente(it);
        delete it._new; M.rasc.salvar(it); M.save(); M.versaoGuardar('item', it); M.closeModal();
        if (novo) M.toast('✅ Item salvo na Biblioteca'); else if (mudou) M.toast('✅ Alterações salvas');
      };
      if ($('#svRev', m)) $('#svRev', m).onclick = () => { M.rasc.reverter(it); base = M.rasc.foto(it); M.save(); SFX.play('undo'); draw(); M.toast('↩ Alterações descartadas: voltou a versão salva'); };
      if ($('#svNo', m)) $('#svNo', m).onclick = () => { M.db.items = M.db.items.filter((x) => x.id !== it.id); delete it._new; M.save(); M.closeModal(); M.toast('Item descartado'); };
      $('#eDel', m).onclick = () => { M.closeModal(); M.trashItem(it); };
      if ($('#eVer', m)) $('#eVer', m).onclick = () => { pend(); M.closeModal(); M.versoesAbrir('item', it.id); };
      if ($('#eArq', m)) $('#eArq', m).onclick = () => { $('#eX', m).click(); M.arquivarItem(it); }; // fecha a ficha (guardando rascunho, se houver) e arquiva
      $('#eClip', m).onclick = () => { const fi = $('#eFile', m); if (fi) fi.click(); };
      $('#eFav', m).onclick = () => { it.fav = !it.fav; touch(); SFX.play(it.fav ? 'star' : 'click'); $('#eFav', m).textContent = it.fav ? '⭐' : '☆'; $('#eFav', m).setAttribute('aria-pressed', it.fav ? 'true' : 'false'); };
      // áudio que não foi transcrito (voz: 'erro'): tenta de novo sem sair da ficha
      const vz = $('#vzDeNovo', m);
      if (vz) vz.onclick = async () => {
        vz.disabled = true; vz.textContent = '⏳ Transcrevendo…';
        await M.vozDeNovo(it);
        if (M.cur !== it) return;
        if (!it._salvo) base = M.rasc.foto(it); // o resultado já está salvo: a próxima mudança da pessoa parte dele
        draw();
      };
      $('#eCopy', m).onclick = () => M.copyItem(it);
      // expandir: janela larga e caixa de escrita alta, para quem escreve muito (o texto não muda, só o tamanho da caixa)
      $('#eExp', m).onclick = () => {
        const on = !m.classList.contains('wide'); m.classList.toggle('wide', on); m.classList.toggle('exp', on);
        const b = $('#eExp', m); b.textContent = on ? '⤡ Recolher' : '⤢ Expandir'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        M.db.settings.escritaGrande = on; M.save(); SFX.play('click'); $('#eContent', m).focus();
      };
      const expAplica = () => { const on = !!M.db.settings.escritaGrande, b = $('#eExp', m); m.classList.toggle('wide', on); m.classList.toggle('exp', on); if (b) { b.textContent = on ? '⤡ Recolher' : '⤢ Expandir'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
      expAplica();
      m.onfichavolta = expAplica; // ficha minimizada que volta: segue a escolha atual de Expandir
      if ($('#eCopiaIA', m)) $('#eCopiaIA', m).onclick = () => { navigator.clipboard.writeText(M.PROMPT_MARCA).catch(() => {}); SFX.play('copy'); M.toast('📋 Comando copiado. Cole na sua IA junto com o documento.'); };
      $('#eTypes', m).onclick = (e) => { const x = e.target.closest('.slot'); if (!x) return; it.type = x.dataset.t; touch(); SFX.play('click'); draw(); };
      $('#eTitle', m).oninput = (e) => {
        it.title = e.target.value; touch(); if (M.fichasPinta) M.fichasPinta();
        if (it._new && !it._xp && it.title.trim().length > 2) { it._xp = true; M.award('item'); }
      };
      $('#eDesc', m).oninput = (e) => { it.desc = e.target.value; touch(); };
      $('#eContent', m).oninput = (e) => { it.content = e.target.value; touch(); };
      $('#eCat', m).onchange = (e) => { it.cat = e.target.value; touch(); };
      if ($('#ePasta', m)) $('#ePasta', m).onchange = (e) => { it.pasta = e.target.value; touch(); SFX.play('click'); };
      $('#eSt', m).onchange = (e) => { it.status = e.target.value; touch(); SFX.play('click'); };
      $('#eDate', m).onchange = (e) => { it.date = e.target.value; touch(); };
      if ($('#eCli', m)) $('#eCli', m).onchange = (e) => { it.client = e.target.value; touch(); SFX.play('click'); };
      $('#eMod', m).onchange = (e) => { it.modelo = e.target.checked; touch(); SFX.play('click'); if (it.modelo) M.toast('📐 Agora aparece em ＋ Novo item'); };
      $('#eTags', m).oninput = (e) => { it.tags = [...new Set(e.target.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean))]; touch(); };
    }

    // ----- linhas de checklist, links e anexos: tudo o que muda aqui passa por touch() (rascunho) -----
    const move = (L, id, d) => { const i = L.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= L.length) return false; [L[i], L[j]] = [L[j], L[i]]; return true; };
    // ↑ ↓ de uma linha (passo ou link): botões, para funcionar igual no clique, no toque e no teclado
    const ordHTML = (i, n, oque) => `<button type="button" class="xbtn ord" data-a="up" ${i ? '' : 'disabled'} title="Subir ${oque}" aria-label="Subir ${oque}">↑</button><button type="button" class="xbtn ord" data-a="dn" ${i < n - 1 ? '' : 'disabled'} title="Descer ${oque}" aria-label="Descer ${oque}">↓</button>`;
    const lixo = (oque) => `<button type="button" class="xbtn lx" data-a="rm" title="Remover ${oque}" aria-label="Remover ${oque}">🗑️</button>`;
    // depois de subir ou descer, o foco continua na mesma linha (quem usa teclado segue apertando)
    const focaOrd = (box, id, a) => { const r = box.querySelector(`[data-id="${id}"]`), x = r && (r.querySelector(`[data-a="${a}"]:not(:disabled)`) || r.querySelector('.ord:not(:disabled)')); if (x) x.focus(); };
    // só http(s), mailto e tel viram link; qualquer outro esquema (javascript:, data:…) recebe https:// na frente
    const urlDe = (v) => (/^(https?:\/\/|mailto:|tel:)/i.test(v) ? v : 'https://' + String(v).replace(/^(javascript|data|vbscript|file|blob):\/*/i, ''));
    const sitio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
    const nomeExt = (n) => { const i = String(n || '').lastIndexOf('.'); return i > 0 ? [n.slice(0, i), n.slice(i)] : [String(n || ''), '']; };

    function addPasso(quieto) {
      const el = $('#eCheckNew', m), v = (el ? el.value : novoPasso).trim();
      if (!v) { if (!quieto) M.falta(el, '✍️ Escreva o passo primeiro'); return; }
      novoPasso = ''; it.checklist.push({ id: M.uid(), t: v, done: false }); touch(); drawCheck();
      if (!quieto) { SFX.play('click'); $('#eCheckNew', m).focus(); }
    }
    function drawCheck() {
      const box = $('#eCheck', m), n = it.checklist.length;
      box.innerHTML = it.checklist.map((c, i) => `<div class="chk ${c.done ? 'done' : ''}" data-id="${c.id}"><input type="checkbox" ${c.done ? 'checked' : ''} aria-label="Passo feito"><input type="text" value="${esc(c.t)}" aria-label="Texto do passo">${ordHTML(i, n, 'passo')}${lixo('passo')}</div>`).join('') +
        `<div class="add-linha"><input type="text" id="eCheckNew" value="${esc(novoPasso)}" placeholder="Novo passo (Enter ou ＋)"><button type="button" class="icon-btn" id="eCheckAdd" title="Adicionar passo" aria-label="Adicionar passo">＋</button></div>`;
      box.onchange = (e) => {
        const row = e.target.closest('.chk'); if (!row) return;
        const c = it.checklist.find((x) => x.id === row.dataset.id);
        if (e.target.type === 'checkbox') { c.done = e.target.checked; row.classList.toggle('done', c.done); touch(); if (c.done) M.award('check', { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 }); }
      };
      box.oninput = (e) => {
        if (e.target.id === 'eCheckNew') { novoPasso = e.target.value; return; }
        const row = e.target.closest('.chk'); if (row && e.target.type === 'text') { it.checklist.find((x) => x.id === row.dataset.id).t = e.target.value; touch(); }
      };
      box.onclick = (e) => {
        const b = e.target.closest('[data-a]'), row = b && b.closest('.chk'); if (!row) return;
        const id = row.dataset.id, a = b.dataset.a;
        if (a === 'rm') { it.checklist = it.checklist.filter((x) => x.id !== id); touch(); drawCheck(); }
        else if (move(it.checklist, id, a === 'up' ? -1 : 1)) { touch(); SFX.play('click'); drawCheck(); focaOrd(box, id, a); }
      };
      $('#eCheckNew', m).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addPasso(); } };
      $('#eCheckAdd', m).onclick = () => addPasso();
    }

    function addLink(quieto) {
      const el = $('#eLinkNew', m); let v = (el ? el.value : novoLink).trim();
      if (!v) { if (!quieto) M.falta(el, '✍️ Cole ou escreva o link primeiro'); return; }
      v = urlDe(v);
      novoLink = ''; it.links.push({ id: M.uid(), url: v, label: sitio(v) }); touch(); drawLinks();
      if (!quieto) { SFX.play('click'); $('#eLinkNew', m).focus(); }
    }
    function drawLinks() {
      const box = $('#eLinks', m), n = it.links.length;
      // o link em edição (✏️) troca a linha por dois campos: nome e endereço; o que se digita já vale, como no resto da ficha
      box.innerHTML = it.links.map((l, i) => (l.id === linkEd
        ? `<div class="chk lk-ed" data-id="${l.id}"><span>🔗</span><div class="lk-campos"><input type="text" data-k="label" value="${esc(l.label || '')}" placeholder="Nome (opcional)" aria-label="Nome do link"><input type="text" data-k="url" inputmode="url" value="${esc(l.url)}" placeholder="https://…" aria-label="Endereço do link"></div><button type="button" class="btn sm" data-a="ok" title="Concluir a edição do link">✔ OK</button></div>`
        : `<div class="chk" data-id="${l.id}"><span>🔗</span><a href="${esc(l.url)}" target="_blank" rel="noopener" style="flex:1;color:var(--cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.label || l.url)}</a><button type="button" class="xbtn" data-a="ed" title="Editar nome e endereço" aria-label="Editar link">✏️</button>${ordHTML(i, n, 'link')}${lixo('link')}</div>`)).join('') +
        `<div class="add-linha"><input type="text" id="eLinkNew" inputmode="url" value="${esc(novoLink)}" placeholder="Cole um link (Enter ou ＋)"><button type="button" class="icon-btn" id="eLinkAdd" title="Adicionar link" aria-label="Adicionar link">＋</button></div>`;
      box.oninput = (e) => {
        if (e.target.id === 'eLinkNew') { novoLink = e.target.value; return; }
        const row = e.target.closest('.lk-ed'), l = row && it.links.find((x) => x.id === row.dataset.id); if (!l) return;
        const v = e.target.value.trim();
        if (e.target.dataset.k === 'label') l.label = v;
        else if (!v) return; // endereço vazio não vale: fica o anterior
        else { const auto = !l.label || l.label === sitio(l.url); l.url = urlDe(v); if (auto) { l.label = sitio(l.url); row.querySelector('[data-k=label]').value = l.label; } } // nome que era só o site acompanha o endereço novo
        touch();
      };
      box.onkeydown = (e) => { if (e.key === 'Enter' && e.target.closest('.lk-ed')) { e.preventDefault(); linkEd = null; drawLinks(); } };
      box.onclick = (e) => {
        const b = e.target.closest('[data-a]'), row = b && b.closest('.chk'); if (!row) return;
        const id = row.dataset.id, a = b.dataset.a;
        if (a === 'rm') { it.links = it.links.filter((x) => x.id !== id); touch(); drawLinks(); }
        else if (a === 'ed') { linkEd = id; drawLinks(); const i = box.querySelector('.lk-ed input'); if (i) { i.focus(); i.select(); } }
        else if (a === 'ok') { linkEd = null; drawLinks(); }
        else if (move(it.links, id, a === 'up' ? -1 : 1)) { touch(); SFX.play('click'); drawLinks(); focaOrd(box, id, a); }
      };
      $('#eLinkNew', m).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } };
      $('#eLinkAdd', m).onclick = () => addLink();
    }

    function drawAtt() {
      const box = $('#eAtt', m);
      // renomear (✏️) muda só o nome mostrado: a extensão fica e o arquivo no disco (a.file) não é tocado
      box.innerHTML = it.attachments.map((a) => `<div class="attach" data-id="${a.id}"><span class="ic">${M.fileIcon(a)}</span>${a.id === attEd
        ? `<span class="nm-ed"><input type="text" id="eAttNome" value="${esc(nomeExt(a.name)[0])}" maxlength="120" aria-label="Nome do anexo"><small>${esc(nomeExt(a.name)[1])}</small></span><button type="button" class="btn sm" data-a="renok" title="Concluir a troca de nome">✔ OK</button>`
        : `<span class="nm" title="${esc(a.name)}">${esc(a.name)}</span><small>${M.size(a.size)}</small>${prevBtn(a)}<button class="btn sm ghost" data-a="open" title="Abrir no programa do computador">${M.ic('abrir')} Abrir</button><button class="btn sm ghost" data-a="show" title="Mostrar na pasta">${M.ic('pasta')} Pasta</button><button type="button" class="xbtn" data-a="ren" title="Renomear (muda só o nome mostrado aqui)" aria-label="Renomear anexo">✏️</button>${lixo('anexo')}`}</div>`).join('<div style="height:6px"></div>') +
        `<div class="dz" id="eDz" role="button" tabindex="0" aria-label="Escolher arquivos para anexar" style="margin-top:8px">${M.ic('clipe')} Arraste arquivos aqui ou clique para escolher</div><input type="file" id="eFile" multiple hidden>`;
      box.oninput = (e) => {
        if (e.target.id !== 'eAttNome') return;
        const a = it.attachments.find((x) => x.id === attEd), v = e.target.value.trim(); if (!a || !v) return; // nome vazio não vale: fica o anterior
        a.name = v + nomeExt(a.name)[1]; touch();
      };
      box.onkeydown = (e) => { if (e.key === 'Enter' && e.target.id === 'eAttNome') { e.preventDefault(); attEd = null; drawAtt(); } };
      box.onclick = async (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = it.attachments.find((x) => x.id === b.closest('.attach').dataset.id);
        if (b.dataset.a === 'rm') { it.attachments = it.attachments.filter((x) => x !== a); touch(); if (prevId === a.id) { $('#ePrev', m).innerHTML = ''; prevId = null; } drawAtt(); }
        else if (b.dataset.a === 'ren') { attEd = a.id; drawAtt(); const i = $('#eAttNome', m); if (i) { i.focus(); i.select(); } }
        else if (b.dataset.a === 'renok') { attEd = null; drawAtt(); }
        else if (b.dataset.a === 'open') M.api('/api/open', { method: 'POST', body: JSON.stringify({ file: a.file }) }).catch((er) => M.toast('⚠️ ' + er.message));
        else if (b.dataset.a === 'show') M.api('/api/reveal', { method: 'POST', body: JSON.stringify({ file: a.file }) }).catch((er) => M.toast('⚠️ ' + er.message));
        else preview(a);
      };
      const dz = $('#eDz', m), fi = $('#eFile', m);
      dz.onclick = () => fi.click();
      dz.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } };
      fi.onchange = () => M.attachFiles(it, [...fi.files], () => { touch(); drawAtt(); });
      dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); M.attachFiles(it, [...e.dataTransfer.files], () => { touch(); drawAtt(); }); };
    }

    // Ver abre a prévia; clicar de novo (ou em "Fechar prévia") recolhe
    function prevAberta(a) { const box = $('#ePrev', m); return !!(a && prevId === a.id && box && box.firstElementChild); }
    function prevBtn(a) {
      if (M.isText(a.name)) return `<button class="btn sm ghost" data-a="prev" title="Ler em blocos">${M.ic('livro')} Ler</button>`;
      const on = prevAberta(a);
      return `<button class="btn sm ghost${on ? ' on' : ''}" data-a="prev" aria-expanded="${on}" title="${on ? 'Fechar a prévia' : 'Ver aqui dentro'}">${on ? '▴ Fechar' : M.ic('olho') + ' Ver'}</button>`;
    }
    function prevFecha() { const box = $('#ePrev', m); if (box) box.innerHTML = ''; prevId = null; drawAtt(); }
    function preview(a) {
      if (M.isText(a.name)) return M.openReader(a);
      if (prevAberta(a)) return prevFecha();
      const url = '/anexos/' + encodeURIComponent(a.file), n = a.name.toLowerCase(), box = $('#ePrev', m);
      let h = '';
      if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) h = `<img src="${url}" alt="">`;
      else if (/\.pdf$/.test(n)) h = `<iframe src="${url}"></iframe>`;
      else if (/\.(mp4|webm)$/.test(n)) h = `<video src="${url}" controls style="width:100%;max-height:60vh"></video>`;
      else if (/\.(mp3|wav|ogg|m4a)$/.test(n)) h = `<audio src="${url}" controls style="width:100%"></audio>`;
      else if (/\.(txt|md|json|csv|log)$/.test(n)) h = `<iframe src="${url}" style="background:#fff"></iframe>`;
      else { M.toast('Sem pré-visualização para esse tipo. Use “Abrir”.'); return; }
      box.innerHTML = `<div class="preview" style="margin-top:10px"><div class="prev-bar"><b title="${esc(a.name)}">${esc(a.name)}</b><button type="button" class="btn sm ghost" data-pfecha title="Recolher a prévia">▴ Fechar prévia</button></div>${h}</div>`;
      box.querySelector('[data-pfecha]').onclick = prevFecha;
      prevId = a.id; drawAtt();
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    draw();
    if (!it.title) $('#eTitle', m).focus();
  };
})();
