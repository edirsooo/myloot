// Central de ferramentas: os links dos guias em PDF, num lugar só, com busca.
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
  const st = { q: '', g: '' };
  const host = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  function lista() {
    const q = M.norm(st.q);
    return F.filter((f) => (!st.g || f.g === st.g) && (!q || M.norm([f.n, f.p, f.s, f.onde, f.u].join(' ')).includes(q)));
  }
  function cartoes() {
    const L = lista();
    $('#fCount').textContent = L.length + ' de ' + F.length;
    $('#fRes').innerHTML = L.length ? `<div class="grid">${L.map((f) => {
      const g = GRUPOS.find((x) => x.id === f.g), i = F.indexOf(f);
      const tem = M.db.items.some((it) => it.type === 'link' && it.content.trim() === f.u && it.title === f.n);
      return `<div class="card tool" style="--c:${g.cor}" data-i="${i}">
        <div class="top"><span class="badge">${g.em} ${g.nome}</span>${f.gr ? `<span class="tag" title="Dá para usar de graça?">🆓 ${esc(f.gr)}</span>` : ''}</div>
        <h3>${esc(f.n)}</h3>
        ${f.s ? `<p>Substitui <b style="color:var(--text)">${esc(f.s)}</b>${f.p ? ' · ' + esc(f.p) : ''}</p>` : f.p ? `<p style="-webkit-line-clamp:3">${esc(f.p)}</p>` : ''}
        <div class="meta"><span class="tdate" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(f.onde || host(f.u))}</span></div>
        <div class="row" style="margin-top:10px;gap:8px"><a class="btn sm" href="${esc(f.u)}" target="_blank" rel="noopener" style="flex:1">↗ Abrir</a><button class="btn sm ghost" data-save="${i}" style="flex:1" ${tem ? 'disabled' : ''}>${tem ? '✔ Na mochila' : '＋ Guardar'}</button></div>
      </div>`;
    }).join('')}</div>` : '<div class="empty"><div class="big">🕳️</div><h3>Nada encontrado</h3></div>';
  }

  M.pages.tools = () => {
    const v = $('#view');
    v.innerHTML = `
      <div class="hotbar" id="fG"><div class="slot ${!st.g ? 'on' : ''}" data-g="">🧰 Tudo <span class="n">${F.length}</span></div>${GRUPOS.map((g) => `<div class="slot ${st.g === g.id ? 'on' : ''}" data-g="${g.id}" style="--c:${g.cor}">${g.em} ${g.nome} <span class="n">${F.filter((f) => f.g === g.id).length}</span></div>`).join('')}</div>
      <div class="toolbar"><input class="search" id="fQ" type="search" placeholder="Buscar ferramenta… (ex.: vídeo, Photoshop)" value="${esc(st.q)}" style="max-width:340px">
        ${M.hint('Links tirados dos guias em PDF que vêm na Mochila. “Guardar” cria um item do tipo Link na sua Biblioteca. Preços e planos mudam sempre: confira no site oficial.')}
        <span class="grow"></span><small id="fCount" style="color:var(--faint);font-family:var(--mono)"></small></div>
      <div id="fRes"></div>`;
    cartoes();
    $('#fQ').oninput = (e) => { st.q = e.target.value; cartoes(); };
    $('#fG').onclick = (e) => { const s = e.target.closest('.slot'); if (!s) return; st.g = s.dataset.g; SFX.play('click'); M.render(); };
    v.onclick = (e) => {
      const b = e.target.closest('[data-save]'); if (!b) return;
      const f = F[+b.dataset.save], g = GRUPOS.find((x) => x.id === f.g);
      M.createItem({ type: 'link', title: f.n, content: f.u, desc: [f.s ? 'Substitui ' + f.s + '.' : '', f.p || '', f.gr ? 'Grátis? ' + f.gr + '.' : ''].filter(Boolean).join(' '), tags: ['ferramenta', M.norm(g.nome).replace(/[^a-z0-9]+/g, '-')], cat: M.cat('c-guias') ? 'c-guias' : '' });
      M.toast('🔗 Guardado na Biblioteca'); cartoes();
    };
  };
})();
