// Central de ferramentas: "Minhas ferramentas" (as que a pessoa adicionou ou salvou) e "Recomendadas" (os links dos guias em PDF), com busca.
// Fonte: "Guia 04 · Ferramentas" e "Guia 05 · Segundo cérebro" (by Prestes Design). Preços mudam sempre: confira no site oficial.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  const gh = (p) => 'https://github.com/' + p;

  const GRUPOS = [
    { id: 'video', em: '🎬', nome: 'IAs de vídeo', cor: '#3ad7ff' },
    { id: 'imagem', em: '🖼️', nome: 'IAs de imagem', cor: '#ff7ac6' },
    { id: 'audio', em: '🎙️', nome: 'Voz e música', cor: '#ffd166' },
    { id: 'chat', em: '🧠', nome: 'Assistentes de IA', cor: '#7aa2ff' },
    { id: 'aberto', em: '🔓', nome: 'Código aberto', cor: '#3cffaa' },
    { id: 'artcraft', em: '🎨', nome: 'Pacote ArtCraft', cor: '#a78bfa' },
    { id: 'extras', em: '🧩', nome: 'Extras', cor: '#ffbe46' },
  ];
  const F = [
    // fr: 'sim' dá para usar de graça sempre (com limite) · 'pouco' teste ou limite bem baixo · 'nao' só pagando · 'local' grátis rodando no seu PC
    // gs: outros grupos onde a mesma ferramenta também aparece (ex.: um hub que faz imagem e vídeo)
    // IAs de vídeo
    { g: 'video', n: 'Google Veo 3.1', onde: 'Gemini · Flow', p: 'Vídeo com áudio nativo (fala, som), segue bem o prompt, quadro inicial/final.', fr: 'pouco', gr: 'Poucos vídeos', u: 'https://gemini.google.com' },
    { g: 'video', n: 'Kling 3.0', p: 'Movimento realista, personagem consistente, clipes longos.', fr: 'sim', gr: 'Créditos diários', u: 'https://kling.ai' },
    { g: 'video', n: 'Wan (Alibaba)', onde: 'wan.video · ComfyUI', p: 'Vídeo de graça no seu PC (Wan 2.2, código aberto, uso comercial liberado).', fr: 'local', gr: 'Ilimitado no PC', u: 'https://wan.video' },
    { g: 'video', n: 'HappyHorse 1.0 (Alibaba)', onde: 'Arena · fal · sites parceiros', p: 'Modelo de vídeo novo que liderou os rankings de 2026. O acesso é por sites parceiros; para testar sem pagar, use a Arena.', fr: 'pouco', gr: 'Teste na Arena', u: 'https://artificialanalysis.ai/video/arena' },
    { g: 'video', n: 'MiniMax Hailuo 03', p: 'Vídeo barato com qualidade decente.', fr: 'pouco', gr: 'Créditos no cadastro', u: 'https://hailuoai.video' },
    { g: 'video', n: 'Grok Imagine', onde: 'Grok · X', gs: ['imagem'], p: 'Imagem e vídeo rápidos com áudio, dentro do Grok/X.', fr: 'pouco', gr: 'Limite baixo', u: 'https://grok.com' },
    { g: 'video', n: 'Seedance 2.5', onde: 'Dreamina · CapCut', p: 'Vídeo cinematográfico com som e vários planos.', fr: 'pouco', gr: 'Créditos diários', u: 'https://dreamina.capcut.com' },
    { g: 'video', n: 'Runway Gen-4.5', p: 'Ferramentas de controle e edição de vídeo.', fr: 'pouco', gr: '125 créditos, uma vez', u: 'https://runwayml.com' },
    { g: 'video', n: 'Higgsfield', gs: ['imagem'], p: 'Hub de IA: Kling, Veo, Seedance, Nano Banana, GPT Image e outros num lugar só, para imagem e vídeo, com efeitos e movimentos de câmera prontos.', fr: 'nao', gr: 'Plano grátis sem créditos', u: 'https://higgsfield.ai' },
    { g: 'video', n: 'Magnific (antigo Freepik)', gs: ['imagem'], p: 'Hub de IA com vários modelos de imagem e vídeo, banco de imagens e o upscaler que aumenta a resolução. O Freepik virou Magnific em abril de 2026.', fr: 'pouco', gr: 'Limite diário, sem uso comercial', u: 'https://www.magnific.com' },
    { g: 'video', n: 'Artlist AI', gs: ['imagem', 'audio'], p: 'Hub de IA de quem edita vídeo: imagem, vídeo, voz e música, junto com o banco de trilhas e efeitos.', fr: 'nao', gr: 'Só uma amostra', u: 'https://artlist.io' },
    { g: 'video', n: 'Meta AI · Vibes', gs: ['imagem', 'chat'], onde: 'meta.ai · WhatsApp · Instagram', p: 'A IA do Meta: conversa, cria imagem e vídeo curto (Vibes), direto no site ou nos apps.', fr: 'sim', gr: 'Grátis por enquanto', u: 'https://www.meta.ai' },
    { g: 'video', n: 'Pika', p: 'Vídeos curtos com efeitos prontos e divertidos.', fr: 'pouco', gr: 'Créditos por mês', u: 'https://pika.art' },
    { g: 'video', n: 'Luma Dream Machine', gs: ['imagem'], p: 'Vídeo e imagem com boa noção de câmera e de 3D.', fr: 'pouco', gr: 'Muda sempre: confira', u: 'https://lumalabs.ai/dream-machine' },
    { g: 'video', n: 'PixVerse', p: 'Vídeo rápido, com efeitos virais prontos.', fr: 'sim', gr: 'Créditos diários', u: 'https://pixverse.ai' },
    { g: 'video', n: 'HeyGen', p: 'Avatar que fala: você escreve o texto e ele apresenta, com a sua voz clonada se quiser.', fr: 'pouco', gr: 'Bem pouco, com marca d’água', u: 'https://www.heygen.com' },
    { g: 'video', n: 'CapCut', p: 'Editor de vídeo com legenda automática, corte de silêncio e recursos de IA.', fr: 'sim', gr: 'Editor grátis; IA com limite', u: 'https://www.capcut.com' },
    { g: 'video', n: 'LTX-2 (Lightricks)', onde: 'ltx.studio · ComfyUI', p: 'Vídeo com áudio de código aberto, leve o bastante para rodar em PC de casa.', fr: 'local', gr: 'Grátis no PC', u: 'https://ltx.studio' },
    // IAs de imagem
    { g: 'imagem', n: 'Nano Banana 2 / Pro', onde: 'Gemini (Google)', p: 'Editar foto, manter o mesmo personagem, rápido.', fr: 'sim', gr: '~20 a 25 por dia', u: 'https://gemini.google.com' },
    { g: 'imagem', n: 'GPT Image 2', onde: 'ChatGPT', p: 'Texto dentro da imagem, seguir instruções, edições.', fr: 'sim', gr: 'Poucas por dia', u: 'https://chatgpt.com' },
    { g: 'imagem', n: 'Midjourney V8', p: 'Imagem artística e estilizada; imagem→vídeo.', fr: 'nao', gr: 'Só pagando', u: 'https://midjourney.com' },
    { g: 'imagem', n: 'FLUX.2 (Black Forest Labs)', onde: 'bfl.ai · ComfyUI · hubs', p: 'Imagem realista com texto bem escrito. Os modelos abertos (klein, dev) rodam no seu PC; o Kontext edita foto por instrução.', fr: 'local', gr: 'Grátis no PC; no site é pago', u: 'https://bfl.ai' },
    { g: 'imagem', n: 'Seedream', onde: 'Dreamina · CapCut', p: 'Imagem em alta resolução, boa em pôster e texto.', fr: 'pouco', gr: 'Créditos diários', u: 'https://dreamina.capcut.com' },
    { g: 'imagem', n: 'Qwen Image (Alibaba)', onde: 'chat.qwen.ai · ComfyUI', p: 'Imagem e edição com texto bem escrito; também é código aberto.', fr: 'sim', gr: 'Grátis no chat', u: 'https://chat.qwen.ai' },
    { g: 'imagem', n: 'Ideogram', p: 'O melhor para texto dentro da imagem: logos, pôsteres, capas.', fr: 'pouco', gr: 'Créditos grátis limitados', u: 'https://ideogram.ai' },
    { g: 'imagem', n: 'Recraft', p: 'Vetor (SVG), ícones e ilustração com estilo de marca consistente.', fr: 'pouco', gr: 'Créditos diários', u: 'https://www.recraft.ai' },
    { g: 'imagem', n: 'Leonardo', p: 'Estúdio de imagem com muitos estilos prontos e controle fino.', fr: 'pouco', gr: 'Créditos diários', u: 'https://leonardo.ai' },
    { g: 'imagem', n: 'Krea', gs: ['video'], p: 'Imagem em tempo real enquanto você desenha, upscale e vários modelos num lugar.', fr: 'pouco', gr: 'Créditos diários', u: 'https://www.krea.ai' },
    { g: 'imagem', n: 'Adobe Firefly', gs: ['video'], p: 'Imagem e vídeo com uso comercial seguro, ligado ao Photoshop e ao Express.', fr: 'pouco', gr: 'Créditos por mês', u: 'https://firefly.adobe.com' },
    { g: 'imagem', n: 'Canva IA', p: 'Gera imagem e arte pronta dentro do Canva (Estúdio Mágico).', fr: 'pouco', gr: 'Alguns usos grátis', u: 'https://www.canva.com' },
    { g: 'imagem', n: 'Microsoft Designer', onde: 'Bing Image Creator', p: 'Imagem de graça com a conta Microsoft.', fr: 'sim', gr: 'Grátis com a conta', u: 'https://designer.microsoft.com' },
    // voz e música
    { g: 'audio', n: 'ElevenLabs', p: 'Narração realista, clonagem de voz, dublagem e efeitos sonoros.', fr: 'pouco', gr: '10 mil créditos/mês, sem uso comercial', u: 'https://elevenlabs.io' },
    { g: 'audio', n: 'Suno', p: 'Música completa com letra e voz a partir de um texto.', fr: 'sim', gr: 'Créditos diários, sem uso comercial', u: 'https://suno.com' },
    { g: 'audio', n: 'Udio', p: 'Música com IA, com bom controle de estilo.', fr: 'pouco', gr: 'Créditos grátis limitados', u: 'https://www.udio.com' },
    { g: 'audio', n: 'Adobe Podcast (Enhance)', p: 'Limpa o áudio gravado: tira ruído e eco da voz.', fr: 'sim', gr: 'Grátis com limite', u: 'https://podcast.adobe.com/enhance' },
    { g: 'audio', n: 'Whisper (OpenAI)', p: 'Transcreve áudio e vídeo no seu PC, em português.', fr: 'local', gr: 'Grátis no PC', u: gh('openai/whisper') },
    // assistentes
    { g: 'chat', n: 'ChatGPT', p: 'Texto, pesquisa, imagem, planilhas e código.', fr: 'sim', gr: 'Com limite', u: 'https://chatgpt.com' },
    { g: 'chat', n: 'Claude', p: 'Escrita, análise de documentos longos e programação.', fr: 'sim', gr: 'Com limite', u: 'https://claude.ai' },
    { g: 'chat', n: 'Gemini', p: 'Assistente do Google, ligado ao Gmail, Drive e YouTube.', fr: 'sim', gr: 'Com limite', u: 'https://gemini.google.com' },
    { g: 'chat', n: 'Google AI Studio', p: 'Testar os modelos do Google direto, com mais controle.', fr: 'sim', gr: 'Grátis para testar', u: 'https://aistudio.google.com' },
    { g: 'chat', n: 'NotebookLM', p: 'Estuda os seus PDFs e links: resumo, perguntas e podcast em áudio.', fr: 'sim', gr: 'Com limite', u: 'https://notebooklm.google.com' },
    { g: 'chat', n: 'Grok', p: 'Assistente do X, bom em assunto do momento.', fr: 'sim', gr: 'Com limite', u: 'https://grok.com' },
    { g: 'chat', n: 'Perplexity', p: 'Pesquisa na internet com as fontes citadas.', fr: 'sim', gr: 'Com limite', u: 'https://www.perplexity.ai' },
    { g: 'chat', n: 'Microsoft Copilot', p: 'Assistente da Microsoft, ligado ao Windows e ao Office.', fr: 'sim', gr: 'Com limite', u: 'https://copilot.microsoft.com' },
    { g: 'chat', n: 'DeepSeek', p: 'Assistente chinês forte em raciocínio e código.', fr: 'sim', gr: 'Grátis', u: 'https://chat.deepseek.com' },
    { g: 'chat', n: 'Le Chat (Mistral)', p: 'Assistente europeu, rápido.', fr: 'sim', gr: 'Com limite', u: 'https://chat.mistral.ai' },
    // código aberto
    { g: 'aberto', n: 'ComfyUI', p: 'Roda no seu PC os modelos abertos de imagem e vídeo (FLUX, Wan, LTX, Qwen).', fr: 'local', gr: 'Grátis no PC', u: gh('comfyanonymous/ComfyUI') },
    { g: 'aberto', n: 'Upscayl', s: 'upscaler pago (Magnific, Topaz)', p: 'Aumenta a resolução da imagem no seu PC.', fr: 'local', gr: 'Grátis no PC', u: gh('upscayl/upscayl') },
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
    { g: 'extras', n: 'MarkItDown (Microsoft)', p: 'Converte PDF, Word, Excel, PowerPoint, imagem e áudio em Markdown, o formato que as IAs leem melhor.', fr: 'local', gr: 'Grátis no PC', u: gh('microsoft/markitdown') },
    { g: 'extras', n: 'Obsidian', p: 'App de anotações para montar o seu segundo cérebro (Guia 05).', fr: 'sim', gr: 'Grátis', u: 'https://obsidian.md/download' },
  ];
  M.FERRAMENTAS = F;
  GRUPOS.push({ id: 'outras', em: '📌', nome: 'Outras', cor: '#ff9d4a', minha: true }); // só aparece em "Minhas ferramentas"
  const st = { q: '', g: '', aba: '', arq: false, fr: '' }; // fr: filtro "dá para usar de graça" // aba: 'minhas' ou 'rec' (vazio = decide ao abrir a tela); arq: seção "Arquivadas" aberta
  const host = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  // grupos oficiais (das recomendadas) + os grupos que a pessoa criou para as dela (db.toolGroups, opcoes.js)
  const todos = () => GRUPOS.concat(M.opc('toolGroups').map((g) => ({ id: g.id, em: esc(g.em), nome: esc(g.name), cor: esc(g.color), minha: true, meu: true }))); // já escapados: a tela põe nome e emoji do grupo direto no HTML
  M.toolGruposTodos = todos;
  const grupo = (id) => todos().find((x) => x.id === id) || GRUPOS.find((x) => x.id === 'outras');
  // etiqueta "é grátis?": nas recomendadas vem pronta (fr); nas da pessoa, sai do que ela escreveu no campo
  const NIVEL = { sim: ['🟢', 'Grátis'], local: ['💻', 'Grátis no PC'], pouco: ['🟡', 'Grátis limitado'], nao: ['🔴', 'Pago'] };
  const nivel = (f) => {
    if (NIVEL[f.fr]) return f.fr;
    const t = M.norm(f.gr || ''); if (!t) return '';
    if (/^(nao|pago|so pag)/.test(t)) return 'nao';
    if (/local|no pc|ilimitad/.test(t)) return 'local';
    if (/^(sim|gratis|gratuit|free)/.test(t) && !/pouc|teste|limitad/.test(t)) return 'sim';
    return 'pouco';
  };
  const selo = (f) => { const k = nivel(f); if (!k) return ''; const [em, nome] = NIVEL[k], det = f.gr && M.norm(f.gr) !== M.norm(nome) ? f.gr : ''; return `<span class="tool-fr ${k}" title="Dá para usar de graça? ${esc(nome)}${det ? ': ' + esc(det) : ''}">${em} ${nome}${det ? `<small>${esc(det)}</small>` : ''}</span>`; };
  const noGrupo = (f, id) => grupo(f.g).id === id || (f.gs || []).includes(id);
  const tem = (f) => (M.db.tools || []).some((t) => t.u === f.u && t.n === f.n);
  const copia = (f) => ({ id: M.uid(), n: f.n, u: f.u, p: f.p || '', s: f.s || '', gr: f.gr || '', fr: f.fr || '', onde: f.onde || '', g: f.g, de: 'rec', created: Date.now() });
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
  const ativas = () => minhas().filter((t) => !t.arq); // arquivada sai da lista, mas continua em M.db.tools (e contando como "já salva")
  const fonte = () => (st.aba === 'minhas' ? ativas() : F);
  const bate = (f, q) => !q || M.norm([f.n, f.p, f.s, f.onde, f.u].join(' ')).includes(q);
  function lista() {
    const q = M.norm(st.q);
    const gratis = (f) => !st.fr || ['sim', 'local'].includes(nivel(f)) || (st.fr === 'todos' && nivel(f) === 'pouco');
    return fonte().filter((f) => (!st.g || noGrupo(f, st.g)) && gratis(f) && bate(f, q));
  }
  function cartao(f) {
    const g = grupo(f.g), meu = st.aba === 'minhas', ja = !meu && tem(f);
    const abrir = `<a class="btn sm" href="${esc(f.u)}" target="_blank" rel="noopener" style="flex:1">↗ Abrir</a>`;
    return `<div class="card tool${f.arq ? ' arq' : ''}" style="--c:${g.cor}" ${meu ? `data-id="${f.id}"` : `data-i="${F.indexOf(f)}"`}>
      <div class="top"><span class="badge">${g.em} ${g.nome}</span><button type="button" class="maisbtn" data-mais title="Mais ações" aria-label="Mais ações" aria-haspopup="menu">⋯</button></div>
      <h3>${esc(f.n)}</h3>
      ${selo(f)}
      ${f.s ? `<p>Substitui <b style="color:var(--text)">${esc(f.s)}</b>${f.p ? ' · ' + esc(f.p) : ''}</p>` : f.p ? `<p style="-webkit-line-clamp:3">${esc(f.p)}</p>` : ''}
      <div class="meta"><span class="tdate" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(f.onde || host(f.u))}</span></div>
      <div class="row" style="margin-top:10px;gap:8px">${abrir}${!meu
        ? `<button class="btn sm ghost" data-save="${F.indexOf(f)}" style="flex:1" ${ja ? 'disabled' : ''} title="${ja ? 'Já está em Minhas ferramentas' : 'Copia para Minhas ferramentas, onde você pode editar'}">${ja ? '✔ Nas minhas' : '⭐ Salvar'}</button>`
        : f.arq ? `<button class="btn sm ghost" data-arq="${f.id}" style="flex:1" title="Volta para a lista das suas ferramentas">📤 Desarquivar</button>`
        : `<button class="btn sm ghost" data-ed="${f.id}" style="flex:1" title="Mudar o nome, o link, a descrição ou o grupo">✏️ Editar</button><button class="btn sm ghost tool-x" data-rm="${f.id}" style="flex:none" title="Mandar para a Lixeira (dá para restaurar)" aria-label="Remover ${esc(f.n)} das minhas ferramentas">🗑️</button>`}</div>
    </div>`;
  }
  function cartoes() {
    const L = lista(), base = fonte(), meu = st.aba === 'minhas', q = M.norm(st.q);
    // arquivadas: seção recolhida no fim de "Minhas" (a busca também vale para elas e abre a seção se só achar ali)
    const A = meu ? minhas().filter((t) => t.arq && bate(t, q)) : [];
    const arq = A.length ? `<details class="arq-sec" id="fArq" ${st.arq || (q && !L.length) ? 'open' : ''}><summary>📦 Arquivadas (${A.length})</summary><div class="grid">${A.map(cartao).join('')}</div></details>` : '';
    $('#fCount').textContent = base.length ? L.length + ' de ' + base.length : '';
    $('#fRes').innerHTML = (meu && !base.length
      ? `<div class="empty"><div class="big">🧰</div><h3>Monte a sua caixa de ferramentas</h3><p>Adicione os sites e programas que você usa, ou salve os que gostar nas Recomendadas. Depois dá para editar, duplicar, arquivar e remover.</p>
        <div class="row" style="justify-content:center;gap:8px;margin-top:12px"><button class="btn" data-nova style="flex:none">＋ Adicionar ferramenta</button><button class="btn ghost" data-aba="rec" style="flex:none">💡 Ver as recomendadas</button></div></div>`
      : L.length ? `<div class="grid">${L.map(cartao).join('')}</div>` : `<div class="empty"><div class="big">🕳️</div><h3>Nada encontrado</h3><p>${st.fr ? 'O filtro de preço pode estar escondendo o que você procura.' : 'Tente outra palavra ou escolha “Tudo” nos grupos.'}</p>${st.q || st.g || st.fr ? '<button type="button" class="btn" data-limpaf style="margin-top:12px">✖ Limpar filtros</button>' : ''}</div>`) + arq;
    if ($('#fArq')) $('#fArq summary').onclick = () => { st.arq = !$('#fArq').open; }; // lembra se a pessoa abriu ou recolheu
  }

  // janela de criar/editar uma ferramenta da pessoa
  function form(t) {
    const novo = !t; t = t || { n: '', u: '', p: '', g: 'outras', gr: '' };
    const desc = [t.s ? 'Substitui ' + t.s + '.' : '', t.p || ''].filter(Boolean).join(' '); // numa recomendada salva, "substitui X" vira texto editável
    const m = M.modal(`<div class="modal-h"><h2>${novo ? '＋ Nova ferramenta' : '✏️ Editar ferramenta'}</h2><button class="icon-btn" id="x" title="Fechar" aria-label="Fechar">✕</button></div>
      <div class="modal-b">
        <div class="fld"><label for="tfN">Nome</label><input type="text" id="tfN" value="${esc(t.n)}" placeholder="Ex.: Canva" maxlength="80"></div>
        <div class="fld"><label for="tfU">Link ${M.hint('O endereço do site ou do programa. Pode colar só “canva.com”.')}</label><input type="text" id="tfU" value="${esc(t.u)}" placeholder="https://…" inputmode="url" autocapitalize="off" spellcheck="false"></div>
        <div class="fld"><label for="tfP">Para que serve <small style="color:var(--faint)">(opcional)</small></label><textarea id="tfP" rows="2" maxlength="240" placeholder="Uma linha para você lembrar depois">${esc(desc)}</textarea></div>
        <div class="row"><div class="fld"><label for="tfG">Grupo</label><select id="tfG">${todos().map((g) => `<option value="${g.id}" ${grupo(t.g).id === g.id ? 'selected' : ''}>${g.em} ${g.nome}</option>`).join('')}</select></div>
          <div class="fld"><label for="tfGr">É grátis? <small style="color:var(--faint)">(opcional)</small></label><input type="text" id="tfGr" value="${esc(t.gr || '')}" placeholder="Ex.: Sim, com limite · Não · Teste" maxlength="40"></div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="tfNo" style="flex:none">Cancelar</button><button class="btn" id="tfOk" style="flex:none">${novo ? '＋ Adicionar ferramenta' : '✔ Salvar'}</button></div>
      </div>`, { small: true });
    const ok = () => {
      const n = $('#tfN', m).value.trim(); let u = $('#tfU', m).value.trim();
      if (!n) return M.falta($('#tfN', m), '✍️ Dê um nome para a ferramenta');
      if (!u) return M.falta($('#tfU', m), '🔗 Cole o link da ferramenta');
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+|^https?:\/\/localhost/i.test(u)) return M.falta($('#tfU', m), '🔗 Esse link não parece um endereço. Ex.: https://canva.com');
      // duas ferramentas podem ter o mesmo link (ex.: as do Gemini); só não pode repetir nome e link juntos
      const rep = minhas().find((x) => x !== t && x.u === u && M.norm(x.n) === M.norm(n));
      if (rep) return M.falta($('#tfN', m), rep.arq ? '🧰 Você já tem essa ferramenta: ela está em “Arquivadas”, no fim da lista' : '🧰 Você já tem uma ferramenta com esse nome e esse link');
      const d = { n, u, p: $('#tfP', m).value.trim(), g: $('#tfG', m).value, gr: $('#tfGr', m).value.trim() };
      if (!novo && d.gr !== (t.gr || '')) d.fr = '';
      if (novo) M.db.tools.unshift(Object.assign({ id: M.uid(), s: '', onde: '', de: 'eu', created: Date.now() }, d)); else Object.assign(t, d, { s: '', onde: '' });
      M.save(); M.closeModal(); SFX.play('done');
      st.aba = 'minhas'; st.g = ''; st.q = ''; st.fr = ''; // a ferramenta recém-salva aparece mesmo se for paga
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
  const acha = (id) => minhas().find((x) => x.id === id);
  // remover manda para a Lixeira (dá para restaurar mesmo depois de fechar o MyLoot); o Desfazer do aviso vem do histórico
  function remover(t) {
    if (!t) return;
    M.paraLixeira('tool', t); M.save(); SFX.play('trash');
    M.toast('🗑️ Ferramenta para a lixeira'); M.render();
  }
  // arquivar: sai da lista e fica na seção "Arquivadas"; continua em M.db.tools, então a recomendada segue como "já salva"
  function arquivar(t, liga) {
    if (!t) return;
    if (liga) { t.arq = true; t.arqEm = Date.now(); } else { delete t.arq; delete t.arqEm; }
    M.save(); SFX.play('click');
    M.toast(liga ? '📦 Ferramenta arquivada. Ela fica em “Arquivadas”, no fim da lista.' : '📤 Ferramenta de volta para a lista'); M.render();
  }
  // duplicar: a cópia nasce logo depois da original, com "(cópia)" no nome para não bater na regra de nome e link repetidos
  function duplicar(t) {
    const T = minhas(), i = T.indexOf(t); if (i < 0) return;
    let n = t.n + ' (cópia)', k = 2;
    while (T.some((x) => x.u === t.u && M.norm(x.n) === M.norm(n))) n = `${t.n} (cópia ${k++})`;
    const c = Object.assign(JSON.parse(JSON.stringify(t)), { id: M.uid(), n, de: 'eu', created: Date.now() }); delete c.arq; delete c.arqEm;
    T.splice(i + 1, 0, c); M.save(); SFX.play('done');
    M.toast('📑 Ferramenta duplicada'); M.render();
  }
  function paraBiblioteca(f) {
    const g = grupo(f.g);
    if (M.db.items.some((it) => it.type === 'link' && String(it.content || '').trim() === f.u && it.title === f.n)) return M.toast('🔗 Esse link já está na sua Biblioteca');
    M.createItem({ type: 'link', title: f.n, content: f.u, desc: [f.s ? 'Substitui ' + f.s + '.' : '', f.p || '', nivel(f) ? 'Grátis? ' + NIVEL[nivel(f)][1] + (f.gr ? ' (' + f.gr + ')' : '') + '.' : ''].filter(Boolean).join(' '), tags: ['ferramenta', M.norm(g.nome).replace(/[^a-z0-9]+/g, '-')], cat: M.cat('c-guias') ? 'c-guias' : '' });
    M.toast('🔗 Guardado na Biblioteca');
  }
  // menu de ações do cartão: o mesmo no clique direito e no botão ⋯
  function menu(e, c) {
    if (!c) return;
    const meu = !!c.dataset.id, f = meu ? acha(c.dataset.id) : F[+c.dataset.i]; if (!f) return;
    M.ctxMenu(e, [{ em: '↗', t: 'Abrir', fn: () => window.open(f.u, '_blank', 'noopener') },
      ...(meu ? [{ em: '✏️', t: 'Editar', fn: () => form(f) }, { em: '📑', t: 'Duplicar', fn: () => duplicar(f) }] : tem(f) ? [] : [{ em: '⭐', t: 'Salvar em Minhas ferramentas', fn: () => salvar(f) }]),
      { em: '🔗', t: 'Guardar o link na Biblioteca', fn: () => paraBiblioteca(f) },
      ...(meu ? [{ em: f.arq ? '📤' : '📦', t: f.arq ? 'Desarquivar' : 'Arquivar', fn: () => arquivar(f, !f.arq) }, '-', { em: '🗑️', t: 'Remover', fn: () => remover(f) }] : [])]);
  }

  M.pages.tools = () => {
    const v = $('#view'), T = minhas();
    if (M.parceiroHTML() === '' && !M._parceiroVisto) { M._parceiroVisto = true; M.parceiroCarregar().then((p) => { if (p && M.ui.page === 'tools') M.render(); }); }
    if (!st.aba) st.aba = T.length ? 'minhas' : 'rec';
    const meu = st.aba === 'minhas', base = fonte();
    const gs = todos().filter((g) => (meu ? base.some((f) => noGrupo(f, g.id)) : !g.minha));
    if (st.g && !gs.some((g) => g.id === st.g)) st.g = '';
    v.innerHTML = `${M.parceiroHTML()}
      <div class="tool-abas"><div class="seg" role="tablist" aria-label="Quais ferramentas mostrar"><button type="button" role="tab" aria-selected="${meu}" class="${meu ? 'on' : ''}" data-aba="minhas">⭐ Minhas ferramentas <span class="n">${T.filter((t) => !t.arq).length}</span></button><button type="button" role="tab" aria-selected="${!meu}" class="${meu ? '' : 'on'}" data-aba="rec">💡 Recomendadas <span class="n">${F.length}</span></button></div>
        <span class="grow"></span>${meu ? M.opcBtn('toolGroups', 'Meus grupos') : ''}<button class="btn sm" id="fNova" title="Incluir um site ou programa seu">＋ Adicionar ferramenta</button></div>
      ${base.length ? `<div class="hotbar" id="fG" data-lab="Grupo"><div class="slot ${!st.g ? 'on' : ''}" data-g="">🧰 Tudo <span class="n">${base.length}</span></div>${gs.map((g) => `<div class="slot ${st.g === g.id ? 'on' : ''}" data-g="${g.id}" style="--c:${g.cor}">${g.em} ${g.nome} <span class="n">${base.filter((f) => noGrupo(f, g.id)).length}</span></div>`).join('')}</div>
      <div class="toolbar"><input class="search" id="fQ" type="search" aria-label="Buscar ferramenta" placeholder="Buscar ferramenta… (ex.: vídeo, Photoshop)" value="${esc(st.q)}" style="max-width:340px">
        <div class="seg" id="fFr" role="group" aria-label="Filtrar por preço"><button type="button" data-fr="" class="${!st.fr ? 'on' : ''}">Todas</button><button type="button" data-fr="todos" class="${st.fr === 'todos' ? 'on' : ''}" title="Tudo o que dá para usar sem pagar, mesmo com limite ou só para testar">🆓 Dá para usar grátis</button><button type="button" data-fr="so" class="${st.fr === 'so' ? 'on' : ''}" title="Só as que são grátis de verdade: uso recorrente ou no seu PC">🟢 Grátis de verdade</button></div>
        ${M.hint(meu ? 'As suas ferramentas: as que você adicionou e as recomendadas que salvou. Dá para editar e remover (o que sai vai para a Lixeira). O botão ⋯ de cada cartão tem mais ações: duplicar, arquivar e guardar o link na Biblioteca.' : 'Sugestões tiradas dos guias em PDF que vêm no MyLoot. “Salvar” copia a ferramenta para Minhas ferramentas, onde você pode editar. O botão ⋯ do cartão também guarda o link na sua Biblioteca. Preços e planos mudam sempre: confira no site oficial.')}
        <span class="grow"></span><small id="fCount" style="color:var(--faint);font-family:var(--mono)"></small></div>` : '<small id="fCount" hidden></small>'}
      <div id="fRes"></div>`;
    cartoes();
    if ($('#fQ')) $('#fQ').oninput = (e) => { st.q = e.target.value; cartoes(); };
    if ($('#fFr')) $('#fFr').onclick = (e) => { const b = e.target.closest('[data-fr]'); if (!b) return; st.fr = b.dataset.fr; SFX.play('click'); M.render(); };
    if ($('#fG')) $('#fG').onclick = (e) => { const s = e.target.closest('.slot'); if (!s) return; st.g = s.dataset.g; SFX.play('click'); M.render(); };
    v.onclick = (e) => {
      const q = (s) => e.target.closest(s);
      const a = q('[data-aba]'); if (a) { st.aba = a.dataset.aba; st.g = ''; st.q = ''; SFX.play('click'); return M.render(); }
      if (q('[data-limpaf]')) { st.q = ''; st.g = ''; st.fr = ''; SFX.play('click'); return M.render(); }
      if (q('#fNova,[data-nova]')) return form();
      const mb = q('[data-mais]');
      if (mb) { // ⋯ abre o mesmo menu do clique direito, logo abaixo do botão; pelo teclado, o foco vai para a primeira opção
        const r = mb.getBoundingClientRect(); menu({ preventDefault() {}, clientX: r.left, clientY: r.bottom + 4 }, mb.closest('.card.tool'));
        if (!e.detail && $('#ctx button')) $('#ctx button').focus();
        return;
      }
      const s = q('[data-save]'); if (s) return salvar(F[+s.dataset.save]);
      const ed = q('[data-ed]'); if (ed) { const t = acha(ed.dataset.ed); return t && form(t); }
      const rm = q('[data-rm]'); if (rm) return remover(acha(rm.dataset.rm));
      const ar = q('[data-arq]'); if (ar) return arquivar(acha(ar.dataset.arq), false);
    };
    v.oncontextmenu = (e) => { const c = e.target.closest('.card.tool'); if (c) menu(e, c); };
  };
})();
