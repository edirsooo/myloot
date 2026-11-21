// Notion dentro do MyLoot: ver as bases (como quadro ou tabela) e as páginas que a pessoa ligou à integração, e mexer nelas.
// O segredo fica no computador (data/segredos.json); o app só pede ao MyLoot o que mostrar ou mudar.
(function () {
  const { esc, $ } = M;
  let lista = null, base = null, pagina = null, carregando = false, deNovo = false, erro = '', busca = '';
  const pilha = []; // páginas abertas antes (para o ← dentro das subpáginas)
  const COR = { default: '#9b9a97', gray: '#9b9a97', brown: '#ba856f', orange: '#ffa344', yellow: '#ffdc49', green: '#4dab9a', blue: '#529cca', purple: '#9a6dd7', pink: '#e255a1', red: '#ff7369' };
  const cor = (c) => COR[c] || COR.default;
  const api = (p, o) => M.api('/api/notion/' + p, o);
  const acao = (b) => api('acao', { method: 'POST', body: JSON.stringify(b) });
  const alvo = () => M.db.settings.notionAlvo || ''; // "b:<id>" (base) ou "p:<id>" (página)
  const EDITA = ['title', 'rich_text', 'select', 'status', 'multi_select', 'date', 'checkbox', 'number', 'url', 'email', 'phone_number'];
  const GRUPO = ['status', 'select']; // dá para montar o quadro por estes tipos
  const chip = (o) => `<span class="nt-chip" style="--c:${cor(o.cor)}">${esc(o.nome)}</span>`;
  const fmtData = (d) => { if (!d) return ''; const x = new Date(d.length === 10 ? d + 'T12:00' : d); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') + (d.length > 10 ? ' ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''); };
  // valor curto para mostrar no cartão ou na tabela
  function mostra(tipo, v) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
    if (tipo === 'select' || tipo === 'status') return chip(v);
    if (tipo === 'multi_select') return v.map(chip).join('');
    if (tipo === 'date') return `<span class="nt-dt">🗓️ ${esc(fmtData(v.ini))}${v.fim ? ' → ' + esc(fmtData(v.fim)) : ''}</span>`;
    if (tipo === 'checkbox') return v ? '<span class="nt-dt">☑</span>' : '';
    if (tipo === 'url') return `<span class="nt-dt">🔗 ${esc(String(v).replace(/^https?:\/\/(www\.)?/, '').slice(0, 30))}</span>`;
    if (tipo === 'relation' || tipo === 'files') return `<span class="nt-dt">${tipo === 'files' ? '📎' : '↗'} ${v}</span>`;
    if (tipo === 'created_time' || tipo === 'last_edited_time') return `<span class="nt-dt">${esc(fmtData(v))}</span>`;
    return `<span class="nt-dt">${esc(String(v).slice(0, 60))}</span>`;
  }

  // ----- passo a passo para cada pessoa ligar o PRÓPRIO Notion -----
  function conectarHTML(st) {
    return `<div class="tr-con">
      <h2>📓 Conecte o seu Notion</h2>
      <p class="pg-sub">Cada pessoa liga a própria conta. O segredo fica só neste computador (em data/segredos.json), fora do backup, do Drive e do GitHub.</p>
      <ol class="tr-passos">
        <li><b>Crie a integração</b> (de graça): abra <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener">notion.so/profile/integrations</a>, clique em <b>Nova integração</b>, dê o nome <i>MyLoot</i>, escolha o seu espaço de trabalho, deixe o tipo <b>Interna</b> e clique em <b>Salvar</b>.</li>
        <li><b>Pegue o segredo:</b> na página da integração, em <b>Recursos</b> deixe marcados <i>Ler, Atualizar e Inserir conteúdo</i>. Depois copie o <b>Segredo da integração interna</b> (começa com <code>ntn_</code>). Cole aqui:
          <div class="row" style="margin-top:6px"><input type="password" id="ntTok" autocomplete="off" placeholder="${st && st.temToken ? 'Segredo guardado ✔ (cole outro para trocar)' : 'Cole o segredo (ntn_…)'}" aria-label="Segredo da integração do Notion"></div></li>
        <li><b>Escolha o que o MyLoot pode ver:</b> no Notion, abra a página ou a base que você quer usar aqui, clique em <b>•••</b> (no canto de cima) → <b>Conexões</b> → procure <i>MyLoot</i> → <b>Confirmar</b>. Tudo o que estiver dentro dela também aparece. Dá para repetir em outras páginas quando quiser.</li>
        <li><b>Pronto:</b> <button type="button" class="btn" id="ntSalva">✔ Conectar</button></li>
      </ol>
      <small style="color:var(--dim)">Para cortar o acesso a qualquer hora: aqui em ⚙️ → “Desconectar”, ou no Notion, na página da integração.</small>
    </div>`;
  }
  function conectarBind() {
    $('#ntSalva').onclick = async () => {
      const token = $('#ntTok').value.trim();
      if (!token) return M.falta($('#ntTok'), '🔑 Cole o segredo (passo 2)');
      try {
        await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ notion: { token } }) });
        const eu = await api('eu');
        SFX.play('coin'); M.toast('✅ Notion conectado' + (eu.espaco ? ': ' + eu.espaco : ''));
        if (M.intStatus) await M.intStatus(true).catch(() => {});
        lista = null; erro = ''; M.render();
      } catch (e) { M.toast('⚠️ ' + e.message); }
    };
  }

  async function carregar(forcar) {
    if (carregando) { deNovo = true; return; } carregando = true; erro = '';
    try {
      if (!lista || forcar) lista = await api('lista');
      let a = alvo();
      // subpágina ou base aberta por dentro de uma página não aparece na busca do Notion: vale porque a pessoa clicou nela
      const existe = (x) => x === aberto || (x.startsWith('b:') ? lista.bases : lista.paginas).some((o) => o.id === x.slice(2)) || pilha.some((p) => 'p:' + p.id === x);
      if (!a || !existe(a)) { a = lista.bases[0] ? 'b:' + lista.bases[0].id : lista.paginas[0] ? 'p:' + lista.paginas[0].id : ''; M.db.settings.notionAlvo = a; M.save(); }
      if (a.startsWith('b:')) { base = await api('base?id=' + encodeURIComponent(a.slice(2))); pagina = null; }
      else if (a) { pagina = await api('pagina?id=' + encodeURIComponent(a.slice(2))); base = null; }
      else { base = pagina = null; }
    } catch (e) { erro = e.message; }
    carregando = false;
    if (deNovo) { deNovo = false; return carregar(); }
    if (M.ui.page === 'notion') M.render();
  }
  let aberto = ''; // o que a pessoa abriu por último clicando (subpágina ou base de dentro de uma página)
  const abrirAlvo = (a, empilha) => { if (empilha && pagina) pilha.push({ id: pagina.id, titulo: pagina.titulo }); else if (!empilha) pilha.length = 0; aberto = a; M.db.settings.notionAlvo = a; M.save(); base = pagina = null; carregar(); M.render(); };

  M.pages.notion = () => {
    const v = $('#view');
    M.intStatus().then((st) => {
      if (M.ui.page !== 'notion') return;
      if (!st.notion.temToken) { v.innerHTML = conectarHTML(st.notion); conectarBind(); return; }
      if (!lista && !carregando && !erro) { v.innerHTML = '<div class="empty"><div class="big">📓</div><h3>Abrindo o seu Notion…</h3></div>'; carregar(); return; }
      desenha(v);
    }).catch((e) => { v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Não consegui abrir o Notion</h3><p>${esc(e.message)}</p></div>`; });
  };

  function desenha(v) {
    if (erro && !lista) {
      v.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>O Notion não respondeu</h3><p>${esc(erro)}</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="ntDeNovo" style="flex:none">🔁 Tentar de novo</button><button class="btn ghost" id="ntRecon" style="flex:none">🔑 Conectar de novo</button></div></div>`;
      $('#ntDeNovo').onclick = () => { erro = ''; carregar(true); M.render(); };
      $('#ntRecon').onclick = desconectar;
      return;
    }
    const a = alvo(), vazio = !lista.bases.length && !lista.paginas.length;
    const opt = (pre, o) => `<option value="${pre}:${esc(o.id)}" ${a === pre + ':' + o.id ? 'selected' : ''}>${esc((o.icone ? o.icone + ' ' : '') + o.nome)}</option>`;
    const extra = pagina && !lista.paginas.some((o) => o.id === pagina.id) ? `<option value="p:${esc(pagina.id)}" selected>${esc((pagina.icone ? pagina.icone + ' ' : '') + pagina.titulo)}</option>`
      : base && !lista.bases.some((o) => o.id === base.base.id) ? `<option value="b:${esc(base.base.id)}" selected>${esc((base.base.icone ? base.base.icone + ' ' : '') + base.base.nome)}</option>` : '';
    const url = base ? base.base.url : pagina ? pagina.url : '';
    v.innerHTML = `
      <div class="toolbar tr-topo">
        <select id="ntQ" aria-label="Base ou página do Notion">${lista.bases.length ? `<optgroup label="🗃️ Bases">${lista.bases.map((o) => opt('b', o)).join('')}</optgroup>` : ''}${lista.paginas.length || extra ? `<optgroup label="📄 Páginas">${extra}${lista.paginas.map((o) => opt('p', o)).join('')}</optgroup>` : ''}</select>
        ${base ? `<input class="search" id="ntBusca" type="search" placeholder="Filtrar…" value="${esc(busca)}">` : ''}
        <button class="btn ghost sm" id="ntAtu" title="Buscar de novo no Notion">${carregando ? '⏳' : '🔄'} Atualizar</button>
        ${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">↗ Abrir no Notion</a>` : ''}
        <span class="grow"></span>
        <button class="btn ghost sm" id="ntCfg" title="Trocar o segredo ou desconectar">⚙️</button>
      </div>
      ${erro ? `<div class="carrega-erro" role="alert">⚠️ ${esc(erro)}</div>` : ''}
      <div id="ntCorpo">${vazio ? `<div class="empty"><div class="big">🔌</div><h3>O MyLoot ainda não enxerga nada no seu Notion</h3><p>No Notion, abra a página ou a base → <b>•••</b> → <b>Conexões</b> → adicione <i>MyLoot</i>. Depois clique em Atualizar.</p></div>`
        : carregando && !base && !pagina ? '<div class="empty"><div class="big">⏳</div><h3>Abrindo…</h3></div>'
        : base ? baseHTML() : pagina ? paginaHTML() : ''}</div>`;
    $('#ntQ').onchange = (e) => { busca = ''; abrirAlvo(e.target.value, false); };
    if ($('#ntBusca')) $('#ntBusca').oninput = (e) => { busca = e.target.value; const pos = e.target.selectionStart; M.render(); const i = $('#ntBusca'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } };
    $('#ntAtu').onclick = () => { SFX.play('click'); carregar(true); M.render(); };
    $('#ntCfg').onclick = (e) => M.ctxMenu(e, [
      { em: '🔄', t: 'Atualizar a lista do Notion', fn: () => carregar(true) },
      { em: '🔑', t: 'Trocar o segredo ou desconectar', fn: desconectar },
      { em: '⚙️', t: 'Configurações → Notion e Trello', fn: () => M.go('cfg') },
    ]);
    if (base) ligaBase(); else if (pagina) ligaPagina();
  }

  // ----- base (database): quadro ou tabela -----
  const vista = () => (M.db.settings.notionVista || {})[base.base.id] || {};
  const mudaVista = (o) => { const s = M.db.settings; s.notionVista = Object.assign({}, s.notionVista, { [base.base.id]: Object.assign({}, vista(), o) }); M.save(); M.render(); };
  const campoTitulo = () => (base.props.find((p) => p.tipo === 'title') || { nome: 'Name' }).nome;
  function baseHTML() {
    const grupos = base.props.filter((p) => GRUPO.includes(p.tipo));
    const vs = vista(), modo = vs.modo || (grupos.length ? 'quadro' : 'tabela');
    const g = grupos.find((p) => p.nome === vs.grupo) || grupos[0];
    const qb = M.norm(busca), L = base.linhas.filter((r) => !qb || M.norm(r.titulo).includes(qb));
    const outros = base.props.filter((p) => p.tipo !== 'title' && (!g || modo !== 'quadro' || p.nome !== g.nome));
    const cab = `<div class="row nt-vista" style="align-items:center;gap:8px;margin:0 0 10px">
      <h2 class="nt-tit">${esc((base.base.icone ? base.base.icone + ' ' : '') + base.base.nome)}</h2><span class="grow"></span>
      ${grupos.length ? `<div class="seg" role="group" aria-label="Como ver"><button type="button" data-modo="quadro" class="${modo === 'quadro' ? 'on' : ''}">▦ Quadro</button><button type="button" data-modo="tabela" class="${modo === 'tabela' ? 'on' : ''}">☰ Tabela</button></div>` : ''}
      ${modo === 'quadro' && grupos.length > 1 ? `<select id="ntGrupo" aria-label="Agrupar o quadro por" style="width:auto">${grupos.map((p) => `<option ${p === g ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>` : ''}
      <button type="button" class="btn sm" id="ntNova" style="flex:none">＋ Nova</button></div>
      ${base.mais ? '<small style="color:var(--faint);display:block;margin-bottom:8px">Mostrando as 500 primeiras linhas. O resto continua no Notion.</small>' : ''}`;
    if (modo === 'quadro' && g) {
      const cols = g.opcoes.map((o) => ({ k: o.nome, nome: o.nome, cor: o.cor }));
      if (g.tipo === 'select' || L.some((r) => !r.props[g.nome])) cols.push({ k: '', nome: 'Sem ' + g.nome, cor: 'default' });
      return cab + `<div class="tr-cols nt-cols" id="ntCols">${cols.map((c) => {
        const cs = L.filter((r) => ((r.props[g.nome] || {}).nome || '') === c.k);
        return `<div class="tr-col" data-g="${esc(c.k)}"><div class="tr-col-h"><b><span class="nt-bola" style="background:${cor(c.cor)}"></span>${esc(c.nome)}</b><span class="n">${cs.length}</span></div>
          <div class="tr-cards">${cs.map((r) => linhaCartao(r, outros)).join('')}</div>
          ${c.k || g.tipo === 'select' ? `<button type="button" class="tr-add" data-nova="${esc(c.k)}">＋ Nova</button>` : ''}</div>`;
      }).join('')}</div>`;
    }
    const vis = outros.filter((p) => !['relation', 'files', 'created_time'].includes(p.tipo)).slice(0, 5);
    return cab + `<div class="nt-tab-w"><table class="nt-tab"><thead><tr><th>${esc(campoTitulo())}</th>${vis.map((p) => `<th>${esc(p.nome)}</th>`).join('')}</tr></thead>
      <tbody>${L.map((r) => `<tr data-r="${esc(r.id)}" tabindex="0"><td class="nt-t">${r.icone ? esc(r.icone) + ' ' : ''}${esc(r.titulo)}</td>${vis.map((p) => `<td>${p.tipo === 'checkbox' ? `<input type="checkbox" data-cb="${esc(p.nome)}" ${r.props[p.nome] ? 'checked' : ''} aria-label="${esc(p.nome)}">` : mostra(p.tipo, r.props[p.nome])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${vis.length + 1}" style="color:var(--faint)">Nada por aqui.</td></tr>`}</tbody></table></div>`;
  }
  function linhaCartao(r, outros) {
    const extras = outros.map((p) => mostra(p.tipo, r.props[p.nome])).filter(Boolean).slice(0, 4).join('');
    return `<div class="tr-card nt-card" draggable="true" data-r="${esc(r.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(r.titulo)}"><div class="tr-nome">${r.icone ? esc(r.icone) + ' ' : ''}${esc(r.titulo)}</div>${extras ? `<div class="nt-ex">${extras}</div>` : ''}</div>`;
  }
  function ligaBase() {
    const corpo = $('#ntCorpo'), grupos = base.props.filter((p) => GRUPO.includes(p.tipo)), vs = vista();
    const g = grupos.find((p) => p.nome === vs.grupo) || grupos[0];
    if ($('#ntGrupo')) $('#ntGrupo').onchange = (e) => mudaVista({ grupo: e.target.value });
    $('#ntNova').onclick = () => novaLinha(null);
    corpo.onclick = (e) => {
      const b = (s) => e.target.closest(s); let x;
      if ((x = b('[data-modo]'))) return mudaVista({ modo: x.dataset.modo });
      if ((x = b('[data-nova]'))) return novaLinha(x.dataset.nova);
      if (b('[data-cb]')) return;
      if ((x = b('[data-r]'))) return abrirLinha(x.dataset.r);
    };
    corpo.onkeydown = (e) => { const r = e.target.closest && e.target.closest('[data-r]'); if (r && e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirLinha(r.dataset.r); } };
    corpo.onchange = (e) => { // caixinha da tabela: muda na hora
      const cb = e.target.closest('[data-cb]'); if (!cb) return;
      const r = base.linhas.find((x) => x.id === cb.closest('[data-r]').dataset.r), nome = cb.dataset.cb, antes = r.props[nome];
      r.props[nome] = cb.checked; SFX.play(cb.checked ? 'coin' : 'click');
      acao({ op: 'props', id: r.id, props: [{ nome, tipo: 'checkbox', v: cb.checked }] }).catch((er) => { r.props[nome] = antes; M.render(); M.toast('⚠️ ' + er.message); });
    };
    // arrastar entre colunas do quadro muda o status (ou a seleção) da linha
    const cols = $('#ntCols'); if (!cols || !g) return;
    let arr = null;
    cols.ondragstart = (e) => { const c = e.target.closest('[data-r]'); if (!c) return; arr = c.dataset.r; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arr); };
    cols.ondragend = () => { arr = null; cols.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); };
    cols.ondragover = (e) => { if (!arr) return; const col = e.target.closest('.tr-col[data-g]'); if (!col) return; e.preventDefault(); cols.querySelectorAll('.tr-col.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); };
    cols.ondrop = (e) => {
      if (!arr) return; const col = e.target.closest('.tr-col[data-g]'); if (!col) return; e.preventDefault();
      const id = arr; cols.ondragend(); mudaGrupo(id, g, col.dataset.g);
    };
  }
  function mudaGrupo(id, g, k) {
    const r = base.linhas.find((x) => x.id === id); if (!r) return;
    const antes = r.props[g.nome]; if (((antes || {}).nome || '') === k) return;
    if (!k && g.tipo === 'status') return M.toast('Status não pode ficar vazio no Notion');
    const op = g.opcoes.find((o) => o.nome === k);
    r.props[g.nome] = k ? { nome: k, cor: op ? op.cor : 'default' } : null; SFX.play('drop'); M.render();
    acao({ op: 'props', id, props: [{ nome: g.nome, tipo: g.tipo, v: k }] }).catch((e) => { r.props[g.nome] = antes; M.render(); M.toast('⚠️ ' + e.message); });
  }
  async function novaLinha(k) {
    const titulo = await pedeTexto('＋ Nova linha em ' + base.base.nome, '', 'Título');
    if (!titulo) return;
    const grupos = base.props.filter((p) => GRUPO.includes(p.tipo)), g = grupos.find((p) => p.nome === vista().grupo) || grupos[0];
    const props = k && g ? [{ nome: g.nome, tipo: g.tipo, v: k }] : [];
    try {
      const r = await acao({ op: 'linhaNova', base: base.base.id, campoTitulo: campoTitulo(), titulo, props });
      const pr = {}; base.props.forEach((p) => { pr[p.nome] = null; }); pr[campoTitulo()] = titulo;
      if (k && g) pr[g.nome] = { nome: k, cor: (g.opcoes.find((o) => o.nome === k) || {}).cor || 'default' };
      base.linhas.unshift({ id: r.id, url: r.url, titulo, icone: '', props: pr }); SFX.play('pop'); M.render(); M.toast('✅ Criado no Notion');
    } catch (e) { M.toast('⚠️ ' + e.message); }
  }

  // ----- conteúdo de uma página (blocos) -----
  function blocosHTML(B) {
    let n = 0;
    return B.map((b) => {
      if (b.tipo !== 'numbered_list_item') n = 0;
      const t = esc(b.texto), mais = b.filhos && !['child_page', 'child_database'].includes(b.tipo) ? ' <small class="nt-mais" title="Tem mais coisa dentro: abra no Notion">⋯</small>' : '';
      switch (b.tipo) {
        case 'paragraph': return t ? `<p>${t}${mais}</p>` : '<div class="nt-esp"></div>';
        case 'heading_1': return `<h3>${t}${mais}</h3>`;
        case 'heading_2': return `<h4>${t}${mais}</h4>`;
        case 'heading_3': return `<h5>${t}${mais}</h5>`;
        case 'bulleted_list_item': return `<div class="nt-li">•<span>${t}${mais}</span></div>`;
        case 'numbered_list_item': return `<div class="nt-li">${++n}.<span>${t}${mais}</span></div>`;
        case 'to_do': return `<label class="tr-ck nt-todo"><input type="checkbox" data-todo="${esc(b.id)}" ${b.ok ? 'checked' : ''}> <span>${t}</span>${mais}</label>`;
        case 'toggle': return `<div class="nt-li">▸<span>${t}${mais}</span></div>`;
        case 'quote': return `<blockquote class="nt-q">${t}${mais}</blockquote>`;
        case 'callout': return `<div class="nt-call">${esc(b.icone || '💡')}<span>${t}${mais}</span></div>`;
        case 'code': return `<pre class="nt-code">${t}</pre>`;
        case 'divider': return '<hr class="nt-hr">';
        case 'image': return b.url ? `<img class="nt-img" src="${esc(b.url)}" alt="${t}" loading="lazy">` : '';
        case 'bookmark': case 'link_preview': case 'embed': case 'video': case 'file': case 'pdf': return b.url ? `<a class="tr-anx" href="${esc(b.url)}" target="_blank" rel="noopener">🔗 ${t || esc(b.url)}</a>` : '';
        case 'child_page': return `<button type="button" class="nt-sub" data-sub="p:${esc(b.id)}">📄 ${t || 'Sem título'}</button>`;
        case 'child_database': return `<button type="button" class="nt-sub" data-sub="b:${esc(b.id)}">🗃️ ${t || 'Base sem título'}</button>`;
        default: return `<small class="nt-outro">[${esc(b.tipo.replace(/_/g, ' '))}: abra no Notion para ver]</small>`;
      }
    }).join('');
  }
  const novoBlocoHTML = () => `<div class="row nt-novo" style="margin-top:10px;align-items:center"><select data-ntipo style="width:auto;flex:none" aria-label="Tipo do bloco novo"><option value="paragraph">Texto</option><option value="to_do">☑ Tarefa</option></select><input type="text" data-nbloco placeholder="Escreva e aperte Enter para acrescentar no fim da página" aria-label="Texto do bloco novo"></div>`;
  function paginaHTML() {
    return `<div class="nt-pag">
      ${pilha.length ? `<button type="button" class="btn ghost sm" id="ntVolta" style="margin-bottom:8px">← ${esc(pilha[pilha.length - 1].titulo)}</button>` : ''}
      <h2 class="nt-tit">${esc((pagina.icone ? pagina.icone + ' ' : '') + pagina.titulo)}</h2>
      <div class="nt-blocos">${blocosHTML(pagina.blocos) || '<p style="color:var(--faint)">Página vazia.</p>'}</div>
      ${novoBlocoHTML()}
      <div class="row" style="margin-top:12px;gap:8px"><button type="button" class="btn ghost sm" id="ntSubNova" style="flex:none">＋ Subpágina</button><button type="button" class="btn ghost sm" id="ntPgMy" style="flex:none">📥 Guardar no MyLoot</button></div>
    </div>`;
  }
  function ligaBlocos(box, pg, redesenha) {
    box.addEventListener('change', async (e) => {
      const ck = e.target.closest('[data-todo]'); if (!ck) return;
      try { await acao({ op: 'todo', id: ck.dataset.todo, ok: ck.checked }); const b = pg.blocos.find((x) => x.id === ck.dataset.todo); if (b) b.ok = ck.checked; SFX.play(ck.checked ? 'coin' : 'click'); }
      catch (er) { ck.checked = !ck.checked; M.toast('⚠️ ' + er.message); }
    });
    box.addEventListener('keydown', async (e) => {
      const i = e.target.closest('[data-nbloco]'); if (!i || e.key !== 'Enter') return; e.preventDefault();
      const texto = i.value.trim(); if (!texto) return;
      const tipo = box.querySelector('[data-ntipo]').value;
      try { const r = await acao({ op: 'blocoNovo', pagina: pg.id, tipo, texto }); pg.blocos.push({ id: r.id, tipo, texto, ok: false }); SFX.play('pop'); redesenha(); const n = box.querySelector('[data-nbloco]'); if (n) n.focus(); }
      catch (er) { M.toast('⚠️ ' + er.message); }
    });
  }
  function ligaPagina() {
    const corpo = $('#ntCorpo');
    ligaBlocos(corpo, pagina, () => M.render());
    corpo.onclick = (e) => { const s = e.target.closest('[data-sub]'); if (s) abrirAlvo(s.dataset.sub, true); };
    if ($('#ntVolta')) $('#ntVolta').onclick = () => { const p = pilha.pop(); aberto = 'p:' + p.id; M.db.settings.notionAlvo = 'p:' + p.id; M.save(); pagina = null; carregar(); M.render(); };
    $('#ntSubNova').onclick = async () => {
      const titulo = await pedeTexto('＋ Subpágina em ' + pagina.titulo, '', 'Título'); if (!titulo) return;
      try { const r = await acao({ op: 'paginaNova', pai: pagina.id, titulo }); pagina.blocos.push({ id: r.id, tipo: 'child_page', texto: titulo }); SFX.play('pop'); M.render(); }
      catch (er) { M.toast('⚠️ ' + er.message); }
    };
    $('#ntPgMy').onclick = () => guardarNoMyLoot(pagina);
  }

  // ----- ficha de uma linha da base -----
  async function abrirLinha(id) {
    const m = M.modal(`<div class="modal-h"><h2>📓 Notion</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b" id="ntFb"><div class="empty"><div class="big">⏳</div><h3>Abrindo…</h3></div></div>`);
    $('#x', m).onclick = M.closeModal;
    let pg; try { pg = await api('pagina?id=' + encodeURIComponent(id)); } catch (e) { $('#ntFb', m).innerHTML = `<div class="carrega-erro" role="alert">⚠️ ${esc(e.message)}</div>`; return; }
    if (!m.isConnected) return;
    const schema = base ? base.props : [], ops = (nome) => (schema.find((p) => p.nome === nome) || { opcoes: [] }).opcoes;
    const novo = JSON.parse(JSON.stringify(pg.props)), tipos = pg.tipos;
    const tit = Object.keys(tipos).find((k) => tipos[k] === 'title');
    const ed = Object.keys(tipos).filter((k) => k !== tit);
    const campo = (k, i) => {
      const t = tipos[k], v = novo[k], idc = 'ntp' + i;
      const lab = `<label for="${idc}">${esc(k)}</label>`;
      if (t === 'select' || t === 'status') return `<div class="fld">${lab}<select id="${idc}" data-p="${esc(k)}">${t === 'select' ? '<option value="">—</option>' : ''}${ops(k).map((o) => `<option ${v && v.nome === o.nome ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></div>`;
      if (t === 'multi_select') return `<div class="fld"><div class="lbl">${esc(k)}</div><div class="tr-ets-ed">${ops(k).map((o) => `<button type="button" class="nt-chip nt-opc ${(v || []).some((x) => x.nome === o.nome) ? 'on' : ''}" data-ms="${esc(k)}" data-o="${esc(o.nome)}" style="--c:${cor(o.cor)}">${esc(o.nome)}</button>`).join('') || '<small style="color:var(--faint)">Sem opções nesta base.</small>'}</div></div>`;
      if (t === 'date') { const ini = (v && v.ini) || '', hora = ini.length > 10; return `<div class="fld">${lab}<input type="${hora ? 'datetime-local' : 'date'}" id="${idc}" data-p="${esc(k)}" value="${esc(hora ? ini.slice(0, 16) : ini)}"></div>`; }
      if (t === 'checkbox') return `<div class="fld" style="flex:none;align-self:flex-end;padding-bottom:6px"><label class="sw"><input type="checkbox" id="${idc}" data-p="${esc(k)}" ${v ? 'checked' : ''}><span class="t"></span><span>${esc(k)}</span></label></div>`;
      if (t === 'number') return `<div class="fld">${lab}<input type="number" id="${idc}" data-p="${esc(k)}" value="${v == null ? '' : esc(v)}"></div>`;
      if (['rich_text', 'url', 'email', 'phone_number'].includes(t)) return `<div class="fld">${lab}<input type="text" id="${idc}" data-p="${esc(k)}" value="${esc(v || '')}"></div>`;
      const mo = mostra(t, v); return mo ? `<div class="fld"><div class="lbl">${esc(k)}</div><div class="nt-ro">${mo}</div></div>` : '';
    };
    const draw = () => {
      $('#ntFb', m).innerHTML = `
        <div class="fld"><label for="ntTit">${esc(tit || 'Título')}</label><input type="text" id="ntTit" value="${esc(pg.titulo === 'Sem título' ? '' : pg.titulo)}" placeholder="Sem título"></div>
        <div class="row nt-props" style="flex-wrap:wrap">${ed.map(campo).join('')}</div>
        <div class="fld"><div class="lbl">Conteúdo</div><div class="nt-blocos">${blocosHTML(pg.blocos) || '<small style="color:var(--faint)">Sem conteúdo ainda.</small>'}</div>${novoBlocoHTML()}</div>
        <div class="row" style="justify-content:space-between;margin-top:6px">
          <span class="row" style="flex:none"><button class="btn ghost" id="ntLix" style="flex:none">🗑️ Lixeira do Notion</button><button class="btn ghost" id="ntMy" style="flex:none">📥 Guardar no MyLoot</button><a class="btn ghost" href="${esc(pg.url)}" target="_blank" rel="noopener" style="flex:none">↗ Abrir no Notion</a></span>
          <button class="btn" id="ntSalva" style="flex:none">✔ Salvar e fechar</button></div>`;
    };
    const le = () => { // o que está na tela vai para "novo"
      $$('[data-p]', m).forEach((el) => {
        const k = el.dataset.p, t = tipos[k];
        if (t === 'select' || t === 'status') { const o = ops(k).find((x) => x.nome === el.value); novo[k] = el.value ? { nome: el.value, cor: o ? o.cor : 'default' } : null; }
        else if (t === 'date') novo[k] = el.value ? { ini: el.value, fim: (pg.props[k] || {}).fim || '' } : null;
        else if (t === 'checkbox') novo[k] = el.checked;
        else if (t === 'number') novo[k] = el.value === '' ? null : Number(el.value);
        else novo[k] = el.value;
      });
      const ti = $('#ntTit', m); if (ti) novo[tit] = ti.value;
    };
    draw();
    const box = $('#ntFb', m);
    ligaBlocos(box, pg, () => { le(); draw(); });
    box.addEventListener('click', (e) => {
      const ms = e.target.closest('[data-ms]'); if (!ms) return;
      const k = ms.dataset.ms, L = novo[k] || (novo[k] = []), i = L.findIndex((x) => x.nome === ms.dataset.o);
      if (i < 0) L.push({ nome: ms.dataset.o, cor: (ops(k).find((o) => o.nome === ms.dataset.o) || {}).cor }); else L.splice(i, 1);
      ms.classList.toggle('on', i < 0); SFX.play('click');
    });
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'ntLix') {
        if (!(await M.confirm(`Mandar “${pg.titulo}” para a lixeira do Notion? Lá dá para restaurar por 30 dias.`, 'Mandar para a lixeira'))) return;
        try { await acao({ op: 'lixeira', id: pg.id }); if (base) base.linhas = base.linhas.filter((x) => x.id !== pg.id); SFX.play('trash'); M.closeModal(); M.render(); M.toast('🗑️ Na lixeira do Notion'); } catch (er) { M.toast('⚠️ ' + er.message); }
      }
      if (b.id === 'ntMy') guardarNoMyLoot(pg);
      if (b.id === 'ntSalva') {
        le();
        if (tit && !String(novo[tit] || '').trim()) return M.falta($('#ntTit', m), '✍️ Escreva o título');
        const mud = Object.keys(novo).filter((k) => EDITA.includes(tipos[k]) && JSON.stringify(novo[k]) !== JSON.stringify(pg.props[k]))
          .map((k) => ({ nome: k, tipo: tipos[k], v: tipos[k] === 'select' || tipos[k] === 'status' ? (novo[k] ? novo[k].nome : '') : tipos[k] === 'multi_select' ? (novo[k] || []).map((x) => x.nome) : novo[k] }));
        if (!mud.length) { M.closeModal(); return; }
        try {
          await acao({ op: 'props', id: pg.id, props: mud });
          const r = base && base.linhas.find((x) => x.id === pg.id); if (r) { Object.assign(r.props, novo); r.titulo = (tit && novo[tit]) || r.titulo; }
          SFX.play('coin'); M.closeModal(); M.render(); M.toast('✅ Salvo no Notion');
        } catch (er) { M.toast('⚠️ ' + er.message); }
      }
    });
  }
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  // a página do Notion vira uma nota na Biblioteca, com link para ela
  function guardarNoMyLoot(pg) {
    const txt = pg.blocos.filter((b) => !['to_do', 'child_page', 'child_database', 'divider'].includes(b.tipo)).map((b) => (b.tipo.startsWith('heading') ? '## ' : b.tipo.endsWith('list_item') ? '- ' : '') + (b.texto || (b.url || ''))).filter((s) => s.trim()).join('\n\n');
    const check = pg.blocos.filter((b) => b.tipo === 'to_do').map((b) => ({ id: M.uid(), t: b.texto, done: !!b.ok }));
    const de = base ? base.base.nome : 'página';
    const it = M.createItem({ cat: '', type: 'nota', title: pg.titulo, desc: 'Do Notion: ' + de, content: txt, checklist: check, links: pg.url ? [{ id: M.uid(), url: pg.url, label: 'Página no Notion' }] : [], tags: ['notion'] });
    M.save(); SFX.play('coin');
    M.confirm(`📥 “${pg.titulo}” foi guardado na Biblioteca, com o link para o Notion. Abrir agora?`, 'Abrir').then((ok) => { if (ok) { if (M.modalOpen()) M.closeModal(); M.openItem(it.id); } });
  }

  const pedeTexto = (titulo, valor, rot) => new Promise((ok) => {
    const m = M.modal(`<div class="modal-h"><h2>${esc(titulo)}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div><div class="modal-b"><div class="fld"><label for="ptV">${esc(rot || 'Nome')}</label><input type="text" id="ptV" maxlength="1900" value="${esc(valor || '')}"></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="ptNo" style="flex:none">Cancelar</button><button class="btn" id="ptOk" style="flex:none">✔ Criar</button></div></div>`, { small: true, onClose: () => ok(null) });
    const i = $('#ptV', m), fim = (v) => { const f = ok; ok = () => {}; M.closeModal(); f(v); };
    $('#x', m).onclick = $('#ptNo', m).onclick = () => fim(null);
    $('#ptOk', m).onclick = () => fim(i.value.trim());
    i.onkeydown = (e) => { if (e.key === 'Enter') fim(i.value.trim()); };
    setTimeout(() => i.focus(), 30);
  });

  async function desconectar() {
    if (!(await M.confirm('Desconectar o Notion deste MyLoot? O segredo sai deste computador. Suas páginas no Notion não mudam.', 'Desconectar'))) return;
    try { await M.api('/api/int/salvar', { method: 'POST', body: JSON.stringify({ notion: null }) }); lista = base = pagina = null; erro = ''; if (M.intStatus) await M.intStatus(true); M.render(); M.toast('Notion desconectado'); }
    catch (e) { M.toast('⚠️ ' + e.message); }
  }
})();
