// Central de ferramentas: "Minhas ferramentas" (as que a pessoa adicionou ou salvou) e "Recomendadas" (os links dos guias em PDF), com busca.
// Fonte: "Guia 04 · Ferramentas" e "Guia 05 · Segundo cérebro" (by Prestes Design). Preços mudam sempre: confira no site oficial.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  const gh = (p) => 'https://github.com/' + p;

  const GRUPOS = [
    { id: 'video', em: '🎬', nome: 'IAs de vídeo', cor: '#3ad7ff' },
    { id: 'imagem', em: '🖼️', nome: 'IAs de imagem', cor: '#ff7ac6' },
    { id: 'aberto', em: '🔓', nome: 'Código aberto', cor: '#3cffaa' },
    { id: 'artcraft', em: '🎨', nome: 'Pacote ArtCraft', cor: '#a78bfa' },
    { id: 'extras', em: '🧩', nome: 'Extras', cor: '#ffbe46' },
  ];
  const F = [
    // IAs de vídeo
    { g: 'video', n: 'Google Veo 3.1', onde: 'Gemini · Flow', p: 'Vídeo com áudio nativo (fala, som), segue bem o prompt, quadro inicial/final.', gr: 'Pouco', u: 'https://gemini.google.com' },
    { g: 'video', n: 'Kling 3.0', p: 'Movimento realista, personagem consistente, clipes longos.', gr: 'Sim, créditos diários', u: 'https://kling.ai' },
    { g: 'video', n: 'Wan (Alibaba)', onde: 'wan.video · ComfyUI', p: 'Vídeo de graça no seu PC (Wan 2.2, código aberto, uso comercial liberado).', gr: 'Sim, local e ilimitado', u: 'https://wan.video' },
    { g: 'video', n: 'MiniMax Hailuo 03', p: 'Vídeo barato com qualidade decente.', gr: 'Créditos no cadastro', u: 'https://hailuoai.video' },
    { g: 'video', n: 'Grok Imagine', onde: 'Grok · X', p: 'Imagem e vídeo rápidos com áudio, dentro do Grok/X.', gr: 'Incerto', u: 'https://grok.com' },
    { g: 'video', n: 'Seedance 2.5', onde: 'Dreamina · CapCut', p: 'Vídeo cinematográfico com som e vários planos.', gr: 'Teste', u: 'https://dreamina.capcut.com' },
    { g: 'video', n: 'Runway Gen-4.5', p: 'Ferramentas de controle e edição de vídeo.', gr: '125 créditos únicos', u: 'https://runwayml.com' },
    // IAs de imagem
    { g: 'imagem', n: 'Nano Banana 2 / Pro', onde: 'Gemini (Google)', p: 'Editar foto, manter o mesmo personagem, rápido.', gr: 'Sim, ~20–25 por dia', u: 'https://gemini.google.com' },
    { g: 'imagem', n: 'GPT Image 2', onde: 'ChatGPT', p: 'Texto dentro da imagem, seguir instruções, edições.', gr: 'Sim, poucas por dia', u: 'https://chatgpt.com' },
    { g: 'imagem', n: 'Midjourney V8', p: 'Imagem artística e estilizada; imagem→vídeo.', gr: 'Não', u: 'https://midjourney.com' },
    { g: 'imagem', n: 'Higgsfield', p: 'Agregador: Kling, Veo, Seedance, Nano Banana e outros num lugar só.', gr: 'Quase nada', u: 'https://higgsfield.ai' },
    // código aberto
    { g: 'aberto', n: 'OpenHiggsfield', s: 'Higgsfield', p: 'Estúdio grátis, mas a geração é paga com sua chave de API.', u: gh('wide-trace/open-higgsfield') },
    { g: 'aberto', n: 'VoiceStudio', s: 'ElevenLabs', u: gh('debpalash/VoiceStudio') },
    { g: 'aberto', n: 'Concat', s: 'CapCut', u: gh('jub0t/concat') },
    { g: 'aberto', n: 'OpenWhispr', s: 'Wispr Flow', u: gh('OpenWhispr/openwhispr') },
    { g: 'aberto', n: 'Cap', s: 'Loom', u: gh('CapSoftware/Cap') },
    { g: 'aberto', n: 'AppFlowy', s: 'Notion', u: gh('AppFlowy-IO/AppFlowy') },
    { g: 'aberto', n: 'OpenProject', s: 'Asana', u: gh('opf/openproject') },
    { g: 'aberto', n: 'Cal.diy', s: 'Calendly', u: gh('calcom/cal.diy') },
    { g: 'aberto', n: 'Chatwoot', s: 'Intercom', u: gh('chatwoot/chatwoot') },
    { g: 'aberto', n: 'OpenSEO', s: 'Semrush', p: 'Dados de SEO pagos por uso.', u: gh('every-app/open-seo') },
    // ArtCraft
    { g: 'artcraft', n: 'ArtCraft Launcher', p: 'Tudo num lugar só: instala e abre os apps do pacote.', u: gh('storytold/craft-launcher') },
    ...[['PhotoCraft', 'Photoshop', 'photocraft'], ['LightCraft', 'Lightroom', 'lightcraft'], ['VectorCraft', 'Illustrator', 'vectorcraft'], ['DesignCraft', 'InDesign', 'designcraft'],
      ['FilmCraft', 'Premiere', 'filmcraft'], ['EffectCraft', 'After Effects', 'effectcraft'], ['AniCraft', 'Animate', 'anicraft'], ['PdfCraft', 'Acrobat', 'pdfcraft'],
      ['SoundCraft', 'Audition / editor de áudio', 'soundcraft'], ['FigCraft', 'Figma', 'figcraft'], ['WordCraft', 'Word', 'wordcraft'], ['DeckCraft', 'PowerPoint', 'deckcraft'],
      ['GridCraft', 'Excel', 'gridcraft'], ['CADCraft', 'AutoCAD', 'cadcraft'], ['TextureCraft', 'Substance Painter', 'texturecraft'], ['MaterialCraft', 'Substance Designer', 'materialcraft'],
    ].map(([n, s, r]) => ({ g: 'artcraft', n, s, u: gh('storytold/' + r) })),
    { g: 'artcraft', n: 'Craft Anything', p: 'Estuda qualquer site ou app e cria sua própria versão com IA.', u: gh('storytold/craft-anything') },
    // extras
    { g: 'extras', n: 'SkillSpector (NVIDIA)', p: 'Verifica se uma skill tem algo malicioso antes de instalar.', u: gh('NVIDIA/SkillSpector') },
    { g: 'extras', n: 'Codex Plugin', p: 'Usa o Codex da OpenAI dentro do Claude Code.', u: gh('openai/codex-plugin-cc') },
    { g: 'extras', n: 'Obsidian', p: 'App de anotações para montar o seu segundo cérebro (Guia 05).', gr: 'Sim', u: 'https://obsidian.md/download' },
  ];
  M.FERRAMENTAS = F;
  GRUPOS.push({ id: 'outras', em: '📌', nome: 'Outras', cor: '#ff9d4a', minha: true }); // só aparece em "Minhas ferramentas"
  const st = { q: '', g: '', aba: '' }; // aba: 'minhas' ou 'rec' (vazio = decide ao abrir a tela)
  const host = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const grupo = (id) => GRUPOS.find((x) => x.id === id) || GRUPOS[GRUPOS.length - 1];
  const tem = (f) => (M.db.tools || []).some((t) => t.u === f.u && t.n === f.n);
  const copia = (f) => ({ id: M.uid(), n: f.n, u: f.u, p: f.p || '', s: f.s || '', gr: f.gr || '', onde: f.onde || '', g: f.g, de: 'rec', created: Date.now() });
  // Minhas ferramentas (M.db.tools): as que a pessoa incluiu (de: 'eu') e as recomendadas que ela salvou (de: 'rec').
  function minhas() {
    if (!Array.isArray(M.db.tools)) M.db.tools = [];
    if (!M.db.settings.toolsMigrado) { // quem já tinha guardado recomendações na Biblioteca começa com elas aqui
      const antigas = F.filter((f) => !tem(f) && M.db.items.some((it) => it.type === 'link' && String(it.content || '').trim() === f.u && it.title === f.n));
      const grava = () => { M.db.settings.toolsMigrado = true; antigas.forEach((f) => M.db.tools.push(copia(f))); if (antigas.length) M.save(); };
      if (M.hist) M.hist.silencio(grava); else grava();
    }
    return M.db.tools;
  }
  const fonte = () => (st.aba === 'minhas' ? minhas() : F);
  function lista() {
    const q = M.norm(st.q);
    return fonte().filter((f) => (!st.g || grupo(f.g).id === st.g) && (!q || M.norm([f.n, f.p, f.s, f.onde, f.u].join(' ')).includes(q)));
  }
  function cartao(f) {
    const g = grupo(f.g), meu = st.aba === 'minhas', ja = !meu && tem(f);
    const abrir = `<a class="btn sm" href="${esc(f.u)}" target="_blank" rel="noopener" style="flex:1">↗ Abrir</a>`;
    return `<div class="card tool" style="--c:${g.cor}" ${meu ? `data-id="${f.id}"` : `data-i="${F.indexOf(f)}"`}>
      <div class="top"><span class="badge">${g.em} ${g.nome}</span>${f.gr ? `<span class="tag" title="Dá para usar de graça?">🆓 ${esc(f.gr)}</span>` : ''}</div>
      <h3>${esc(f.n)}</h3>
      ${f.s ? `<p>Substitui <b style="color:var(--text)">${esc(f.s)}</b>${f.p ? ' · ' + esc(f.p) : ''}</p>` : f.p ? `<p style="-webkit-line-clamp:3">${esc(f.p)}</p>` : ''}
      <div class="meta"><span class="tdate" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(f.onde || host(f.u))}</span></div>
      <div class="row" style="margin-top:10px;gap:8px">${abrir}${meu
        ? `<button class="btn sm ghost" data-ed="${f.id}" style="flex:1" title="Mudar o nome, o link, a descrição ou o grupo">✏️ Editar</button><button class="btn sm ghost tool-x" data-rm="${f.id}" style="flex:none" title="Tirar das minhas ferramentas (dá para desfazer)" aria-label="Remover ${esc(f.n)} das minhas ferramentas">🗑️</button>`
        : `<button class="btn sm ghost" data-save="${F.indexOf(f)}" style="flex:1" ${ja ? 'disabled' : ''} title="${ja ? 'Já está em Minhas ferramentas' : 'Copia para Minhas ferramentas, onde você pode editar'}">${ja ? '✔ Nas minhas' : '⭐ Salvar'}</button>`}</div>
    </div>`;
  }
  function cartoes() {
    const L = lista(), base = fonte();
    $('#fCount').textContent = base.length ? L.length + ' de ' + base.length : '';
    if (st.aba === 'minhas' && !base.length) {
      $('#fRes').innerHTML = `<div class="empty"><div class="big">🧰</div><h3>Monte a sua caixa de ferramentas</h3><p>Adicione os sites e programas que você usa, ou salve os que gostar nas Recomendadas. Depois dá para editar, remover e desfazer.</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn" data-nova style="flex:none">＋ Adicionar ferramenta</button><button class="btn ghost" data-aba="rec" style="flex:none">💡 Ver as recomendadas</button></div></div>`;
      return;
    }
    $('#fRes').innerHTML = L.length ? `<div class="grid">${L.map(cartao).join('')}</div>` : '<div class="empty"><div class="big">🕳️</div><h3>Nada encontrado</h3><p>Tente outra palavra ou escolha “Tudo” nos grupos.</p></div>';
  }

  // janela de criar/editar uma ferramenta da pessoa
  function form(t) {
    const novo = !t; t = t || { n: '', u: '', p: '', g: 'outras', gr: '' };
    const m = M.modal(`<div class="modal-h"><h2>${novo ? '＋ Nova ferramenta' : '✏️ Editar ferramenta'}</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b">
        <div class="fld"><label>Nome</label><input type="text" id="tfN" value="${esc(t.n)}" placeholder="Ex.: Canva" maxlength="80"></div>
        <div class="fld"><label>Link ${M.hint('O endereço do site ou do programa. Pode colar só “canva.com”.')}</label><input type="text" id="tfU" value="${esc(t.u)}" placeholder="https://…" inputmode="url" autocapitalize="off" spellcheck="false"></div>
        <div class="fld"><label>Para que serve <small style="color:var(--faint)">(opcional)</small></label><textarea id="tfP" rows="2" maxlength="240" placeholder="Uma linha para você lembrar depois">${esc(t.p || '')}</textarea></div>
        <div class="row"><div class="fld"><label>Grupo</label><select id="tfG">${GRUPOS.map((g) => `<option value="${g.id}" ${grupo(t.g).id === g.id ? 'selected' : ''}>${g.em} ${g.nome}</option>`).join('')}</select></div>
          <div class="fld"><label>É grátis? <small style="color:var(--faint)">(opcional)</small></label><input type="text" id="tfGr" value="${esc(t.gr || '')}" placeholder="Ex.: Sim, com limite" maxlength="40"></div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="tfNo" style="flex:none">Cancelar</button><button class="btn" id="tfOk" style="flex:none">✔ Salvar</button></div>
      </div>`, { small: true });
    const ok = () => {
      const n = $('#tfN', m).value.trim(); let u = $('#tfU', m).value.trim();
      if (!n) return M.falta($('#tfN', m), '✍️ Dê um nome para a ferramenta');
      if (!u) return M.falta($('#tfU', m), '🔗 Cole o link da ferramenta');
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+|^https?:\/\/localhost/i.test(u)) return M.falta($('#tfU', m), '🔗 Esse link não parece um endereço. Ex.: https://canva.com');
      if (minhas().some((x) => x !== t && x.u === u)) return M.falta($('#tfU', m), '🧰 Esse link já está nas suas ferramentas');
      const d = { n, u, p: $('#tfP', m).value.trim(), g: $('#tfG', m).value, gr: $('#tfGr', m).value.trim() };
      if (novo) M.db.tools.unshift(Object.assign({ id: M.uid(), s: '', onde: '', de: 'eu', created: Date.now() }, d)); else Object.assign(t, d);
      M.save(); M.closeModal(); SFX.play('done');
      st.aba = 'minhas'; st.g = ''; st.q = '';
      M.toast(novo ? '🧰 Ferramenta adicionada' : '✔ Ferramenta salva'); M.render();
    };
    $('#x', m).onclick = $('#tfNo', m).onclick = M.closeModal;
    $('#tfOk', m).onclick = ok;
    m.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); ok(); } };
    setTimeout(() => $('#tfN', m).focus(), 30);
  }
  M.novaFerramenta = () => { minhas(); form(); };
  function salvar(f) {
    if (tem(f)) return;
    minhas().unshift(copia(f)); M.save(); SFX.play('done');
    M.toast('⭐ Salva em Minhas ferramentas'); M.render();
  }
  function remover(id) {
    const T = minhas(), i = T.findIndex((x) => x.id === id); if (i < 0) return;
    const [t] = T.splice(i, 1); M.save(); SFX.play('trash');
    M.toast('🗑️ Ferramenta removida', () => { M.db.tools.splice(Math.min(i, M.db.tools.length), 0, t); M.save(); SFX.play('undo'); M.render(); });
    M.render();
  }
  function paraBiblioteca(f) {
    const g = grupo(f.g);
    if (M.db.items.some((it) => it.type === 'link' && String(it.content || '').trim() === f.u && it.title === f.n)) return M.toast('🔗 Esse link já está na sua Biblioteca');
    M.createItem({ type: 'link', title: f.n, content: f.u, desc: [f.s ? 'Substitui ' + f.s + '.' : '', f.p || '', f.gr ? 'Grátis? ' + f.gr + '.' : ''].filter(Boolean).join(' '), tags: ['ferramenta', M.norm(g.nome).replace(/[^a-z0-9]+/g, '-')], cat: M.cat('c-guias') ? 'c-guias' : '' });
    M.toast('🔗 Guardado na Biblioteca');
  }

  M.pages.tools = () => {
    const v = $('#view'), T = minhas();
    if (M.parceiroHTML() === '' && !M._parceiroVisto) { M._parceiroVisto = true; M.parceiroCarregar().then((p) => { if (p && M.ui.page === 'tools') M.render(); }); }
    if (!st.aba) st.aba = T.length ? 'minhas' : 'rec';
    const meu = st.aba === 'minhas', base = fonte();
    const gs = GRUPOS.filter((g) => (meu ? base.some((f) => grupo(f.g).id === g.id) : !g.minha));
    if (st.g && !gs.some((g) => g.id === st.g)) st.g = '';
    v.innerHTML = `${M.parceiroHTML()}
      <div class="tool-abas"><div class="seg" role="tablist" aria-label="Quais ferramentas mostrar"><button type="button" role="tab" aria-selected="${meu}" class="${meu ? 'on' : ''}" data-aba="minhas">⭐ Minhas ferramentas <span class="n">${T.length}</span></button><button type="button" role="tab" aria-selected="${!meu}" class="${meu ? '' : 'on'}" data-aba="rec">💡 Recomendadas <span class="n">${F.length}</span></button></div>
        <span class="grow"></span><button class="btn sm" id="fNova" title="Incluir um site ou programa seu">＋ Adicionar ferramenta</button></div>
      ${base.length ? `<div class="hotbar" id="fG" data-lab="Grupo"><div class="slot ${!st.g ? 'on' : ''}" data-g="">🧰 Tudo <span class="n">${base.length}</span></div>${gs.map((g) => `<div class="slot ${st.g === g.id ? 'on' : ''}" data-g="${g.id}" style="--c:${g.cor}">${g.em} ${g.nome} <span class="n">${base.filter((f) => grupo(f.g).id === g.id).length}</span></div>`).join('')}</div>
      <div class="toolbar"><input class="search" id="fQ" type="search" placeholder="Buscar ferramenta… (ex.: vídeo, Photoshop)" value="${esc(st.q)}" style="max-width:340px">
        ${M.hint(meu ? 'As suas ferramentas: as que você adicionou e as recomendadas que salvou. Dá para editar e remover (com desfazer). Clique com o botão direito num cartão para guardar o link na Biblioteca.' : 'Sugestões tiradas dos guias em PDF que vêm no MyLoot. “Salvar” copia a ferramenta para Minhas ferramentas, onde você pode editar. Preços e planos mudam sempre: confira no site oficial.')}
        <span class="grow"></span><small id="fCount" style="color:var(--faint);font-family:var(--mono)"></small></div>` : '<small id="fCount" hidden></small>'}
      <div id="fRes"></div>`;
    cartoes();
    if ($('#fQ')) $('#fQ').oninput = (e) => { st.q = e.target.value; cartoes(); };
    if ($('#fG')) $('#fG').onclick = (e) => { const s = e.target.closest('.slot'); if (!s) return; st.g = s.dataset.g; SFX.play('click'); M.render(); };
    v.onclick = (e) => {
      const q = (s) => e.target.closest(s);
      const a = q('[data-aba]'); if (a) { st.aba = a.dataset.aba; st.g = ''; st.q = ''; SFX.play('click'); return M.render(); }
      if (q('#fNova,[data-nova]')) return form();
      const s = q('[data-save]'); if (s) return salvar(F[+s.dataset.save]);
      const ed = q('[data-ed]'); if (ed) return form(T.find((x) => x.id === ed.dataset.ed));
      const rm = q('[data-rm]'); if (rm) return remover(rm.dataset.rm);
    };
    v.oncontextmenu = (e) => {
      const c = e.target.closest('.card.tool'); if (!c) return;
      const f = c.dataset.id ? T.find((x) => x.id === c.dataset.id) : F[+c.dataset.i]; if (!f) return;
      M.ctxMenu(e, [{ em: '↗', t: 'Abrir o site', fn: () => window.open(f.u, '_blank', 'noopener') },
        ...(c.dataset.id ? [{ em: '✏️', t: 'Editar', fn: () => form(f) }] : tem(f) ? [] : [{ em: '⭐', t: 'Salvar em Minhas ferramentas', fn: () => salvar(f) }]),
        { em: '📦', t: 'Guardar o link na Biblioteca', fn: () => paraBiblioteca(f) },
        ...(c.dataset.id ? ['-', { em: '🗑️', t: 'Remover das minhas', fn: () => remover(f.id) }] : [])]);
    };
  };
})();
