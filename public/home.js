// Início (painel do dia) montado com widgets, missões diárias, captura rápida e timer de foco.
// v2.20.0: a pessoa escolhe, acrescenta, tira, oculta, muda de tamanho e arrasta os quadros do Início (db.homeWidgets).
// Cada widget: { id, tipo, ord, tam: p|m|g|cheio, alto: ''|'duplo', oculto, soPc, soCel, titulo, cfg, updated }.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  let qcMode = 'tarefa', qcTxt = ''; // qcTxt: o que está digitado na captura; sobrevive quando a tela é redesenhada (trocar o tipo, sincronizar)
  let org = false; // modo "Organizar Início" ligado

  // ----- missões do dia -----
  // a pessoa escolhe as missões e os números no ⚙️ do widget Missões (cfg.missoes = ['task:2', 'item:1', …]; 0 desliga)
  const MISSOES = [
    ['task', '⚔️', (q) => `Concluir ${q} tarefa${q > 1 ? 's' : ''}`, 2], ['item', '🧱', (q) => `Guardar ${q} ite${q > 1 ? 'ns novos' : 'm novo'}`, 1],
    ['focus', '⏱', (q) => `Fazer ${q} foco${q > 1 ? 's' : ''}`, 1], ['habit', '🎯', (q) => `Marcar ${q} hábito${q > 1 ? 's' : ''}`, 0],
    ['check', '☑️', (q) => `Marcar ${q} passo${q > 1 ? 's' : ''} de checklist`, 0], ['attach', '📎', (q) => `Anexar ${q} arquivo${q > 1 ? 's' : ''}`, 0],
  ];
  M.MISSOES = MISSOES;
  const alvosMissoes = () => {
    const w = M.db && (M.db.homeWidgets || []).find((x) => x.tipo === 'missoes'), L = w && Array.isArray(w.cfg && w.cfg.missoes) ? w.cfg.missoes : null;
    const o = {}; MISSOES.forEach(([k, , , pad]) => { o[k] = pad; });
    if (L) { MISSOES.forEach(([k]) => { o[k] = 0; }); L.forEach((s) => { const [k, q] = String(s).split(':'); if (k in o) o[k] = Math.max(0, Math.min(50, +q || 0)); }); }
    return o;
  };
  M.quests = () => {
    const n = (M.dayLog().n) || {}, a = alvosMissoes();
    const L = MISSOES.filter(([k]) => a[k] > 0).map(([k, em, t]) => ({ em, t: t(a[k]), v: n[k] || 0, max: a[k] }));
    return L.length ? L : [{ em: '⚔️', t: 'Concluir 2 tarefas', v: n.task || 0, max: 2 }];
  };
  M.checkQuests = () => {
    const log = M.dayLog();
    if (log.bonus || !M.db.settings.gamify) return;
    if (M.quests().every((q) => q.v >= q.max)) {
      log.bonus = true;
      setTimeout(() => { M.award('bonus'); SFX.play('ach'); FX.rain(); M.toast('🎁 Missões do dia completas! Bônus de XP'); }, 900);
    }
  };

  function rowItem(it) {
    const t = M.type(it.type);
    return `<div class="rowi" data-id="${it.id}" style="--c:${t.color}"><span class="ic">${t.em}</span><b>${esc(it.title || 'Sem título')}</b><small>${new Date(it.updated).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small></div>`;
  }
  const vazio = (t) => `<small style="color:var(--faint)">${t}</small>`;
  const num = (v, pad, min, max) => { const n = Math.round(+v); return Number.isFinite(n) && n >= min && n <= max ? n : pad; };
  const tit = (w, pad) => esc(w.titulo || pad);
  const PAGINAS = [['lib', '📦', 'Biblioteca'], ['tasks', '✅', 'Tarefas'], ['rot', '🎯', 'Rotina'], ['cal', '🗓️', 'Calendário'], ['clients', '👥', 'Clientes'], ['fin', '💰', 'Financeiro'], ['tools', '🧰', 'Ferramentas'], ['ach', '🏆', 'Conquistas'], ['trash', '🗑️', 'Lixeira'], ['cfg', '⚙️', 'Configurações']];
  const MODOS = [['tarefa', '✅ Tarefa', 'algo para fazer'], ['nota', '📝 Nota', 'uma ideia ou lembrete'], ['prompt', '✨ Prompt', 'um texto para usar na IA'], ['link', '🔗 Link', 'um site para voltar depois']];

  // ----- catálogo de widgets -----
  // un: só pode ter um no Início. tam: tamanho quando acrescentado. aj: ajustes que aparecem na janela ⚙️.
  const W = {
    saudacao: { em: '👋', nome: 'Saudação e resumo', desc: 'Bom dia, a data, o resumo do dia, nível e meta de XP.', un: 1, tam: 'g', topo: 1,
      html(w, c) {
        const g = M.db.game, s = M.db.settings;
        return `<div class="hero"><img class="pix" src="/bau.png" alt="">
          <div class="grow"><h1>${c.hi}! 👋</h1><p style="text-transform:capitalize">${c.date}</p><p>${c.sum}${c.sumFin}${c.sumBk}</p>
            <div class="mini" style="margin-top:12px">${s.gamify ? `<div>Nv ${M.levelOf(g.xp)}<small>${esc(M.levelName(M.levelOf(g.xp)))}</small></div><div>🔥 ${$('#hudStreak b') ? $('#hudStreak b').textContent : 0}<small>dias seguidos</small></div>` : ''}<div>${M.db.items.length}<small>itens no loot</small></div><div>${c.open.length}<small>tarefas abertas</small></div></div>
          </div>
          ${s.gamify ? `<div class="ring" style="--p:${c.pct}" title="Meta de hoje: ${c.dayXp} / ${s.dailyGoal} XP"><span>${c.pct}%<small>META</small></span></div>` : ''}
        </div>`;
      } },
    captura: { em: '📥', nome: 'Guardar rápido', desc: 'O que você quer guardar? Tarefa, nota, prompt ou link, escrevendo ou falando.', un: 1, tam: 'g', topo: 1,
      aj: [['modos', 'modos', 'Tipos que aparecem']],
      html(w) {
        const ok = Array.isArray(w.cfg.modos) && w.cfg.modos.length ? w.cfg.modos : MODOS.map((m) => m[0]);
        const modes = MODOS.filter((m) => ok.includes(m[0])); if (!modes.some((m) => m[0] === qcMode)) qcMode = modes[0][0];
        const rot = { tarefa: 'Qual é a tarefa?', nota: 'Escreva a nota', prompt: 'Cole ou escreva o prompt', link: 'Cole o link' };
        const ph = { tarefa: 'Escreva a tarefa e aperte Enter…', nota: 'Anote uma ideia rápida…', prompt: 'Cole um prompt para guardar…', link: 'Cole um link…' };
        return `<div class="qc">
          <div class="qc-esq">
            <div class="qc-topo"><div class="qc-copy"><h2 id="qcTit"><span class="qc-l1"><span class="qc-3d" aria-hidden="true"><span class="qc-cubo"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="qc-f f1">📝</span><span class="qc-f f2">✨</span><span class="qc-f f3">🔗</span><span class="qc-f f4">✅</span></span><span>O que você quer</span></span> <b>guardar?</b></h2><p>Escolha o tipo, escreva ou fale. O MyLoot guarda no lugar certo.</p></div></div>
            ${modes.length > 1 ? `<div class="qc-tipos" id="qcM" role="group" aria-labelledby="qcTit">${modes.map(([k, n, d]) => `<button type="button" data-m="${k}" class="${qcMode === k ? 'on' : ''}" aria-pressed="${qcMode === k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>` : ''}
          </div>
          <div class="qc-dir">
            <label class="qc-lab" for="qcIn">${rot[qcMode]}</label>
            <textarea id="qcIn" rows="4" placeholder="${ph[qcMode]}" autocomplete="off">${esc(qcTxt)}</textarea>
            <div class="qc-linha">${M.micBtn('#qcIn') || '<button type="button" class="mic-in" id="qcVoz" title="Criar por voz" aria-label="Criar por voz">🎙️</button>'}<span class="qc-dica">Enter guarda · Shift + Enter pula linha</span><button class="btn" id="qcGo">Guardar ↵</button></div>
          </div>
        </div>`;
      } },
    mapa: { em: '🕸️', nome: 'Mapa de conexões', desc: 'As bolinhas dos seus itens e o que se liga com o quê.', un: 1, tam: 'p', alto: 'duplo',
      html: () => '<aside class="panel g-side" id="gSide"></aside>', depois: () => M.graphPanel($('#gSide')) },
    hoje: { em: '🌞', nome: 'Para hoje', desc: 'Tarefas de hoje e atrasadas, e os hábitos do dia.', un: 1, tam: 'm',
      aj: [['habitos', 'sim', 'Mostrar os hábitos de hoje', true]],
      html(w, c) { return `<div class="panel principal"><h4>${tit(w, '🌞 Para hoje')} <a data-go="tasks">ver todas →</a></h4>${[...c.late, ...c.now].map(M.taskHTML).join('') || '<div class="empty" style="padding:22px">Tudo em dia ✨</div>'}${w.cfg.habitos !== false && M.rotinaHojeHTML ? M.rotinaHojeHTML() : ''}</div>`; } },
    missoes: { em: '🎯', nome: 'Missões do dia', desc: 'Missões que dão bônus de XP quando você completa todas. Zeram todo dia.', un: 1, tam: 'm',
      aj: [['missoes', 'missoes', 'Missões (0 desliga)']],
      html(w) {
        if (!M.db.settings.gamify) return `<div class="panel"><h4>${tit(w, '🎯 Missões do dia')}</h4>${vazio('Os pontos estão desligados. Ligue em Configurações → Diversão.')}</div>`;
        return `<div class="panel"><h4>${tit(w, '🎯 Missões do dia')} ${M.hint('Complete todas para ganhar um bônus de XP. Zera todo dia. Escolha as missões no ⚙️ (em ✏️ Organizar Início).')}</h4>${M.quests().map((q) => `<div class="quest ${q.v >= q.max ? 'ok' : ''}"><span>${q.em} ${q.t}</span><div class="bar"><i style="width:${Math.min(100, (q.v / q.max) * 100)}%"></i></div><small>${q.v >= q.max ? '✔' : q.v + '/' + q.max}</small></div>`).join('')}</div>`;
      } },
    andamento: { em: '⛏️', nome: 'Itens por status', desc: 'Os itens de um status (por padrão, “Em andamento”).', tam: 'p',
      aj: [['status', 'status', 'Status'], ['n', 'n', 'Quantos mostrar', 5]],
      html(w) {
        const st = M.statusDe(w.cfg.status || 'and'), n = num(w.cfg.n, 5, 1, 30);
        const L = M.db.items.filter((i) => !i.arq && M.statusDe(i.status).id === st.id).sort((a, b) => b.updated - a.updated).slice(0, n);
        return `<div class="panel"><h4>${w.titulo ? esc(w.titulo) : `${esc(st.em)} ${esc(st.name)}`}</h4>${L.map(rowItem).join('') || vazio(`Nada em “${esc(st.name)}”.`)}</div>`;
      } },
    favoritos: { em: '⭐', nome: 'Favoritos', desc: 'Os itens marcados com a estrela.', un: 1, tam: 'p', aj: [['n', 'n', 'Quantos mostrar', 5]],
      html(w) { const L = M.db.items.filter((i) => i.fav).sort((a, b) => b.updated - a.updated).slice(0, num(w.cfg.n, 5, 1, 30)); return `<div class="panel"><h4>${tit(w, '⭐ Favoritos')}</h4>${L.map(rowItem).join('') || vazio('Marque um item com a estrela.')}</div>`; } },
    recentes: { em: '🕘', nome: 'Mexidos por último', desc: 'Os itens que você criou ou mudou por último (de um tipo, se quiser).', tam: 'p',
      aj: [['tipo', 'tipo', 'Só deste tipo'], ['n', 'n', 'Quantos mostrar', 6]],
      html(w) {
        const L = M.db.items.filter((i) => !w.cfg.tipo || i.type === w.cfg.tipo).sort((a, b) => b.updated - a.updated).slice(0, num(w.cfg.n, 6, 1, 30));
        return `<div class="panel"><h4>${tit(w, w.cfg.tipo ? `${M.type(w.cfg.tipo).em} ${M.type(w.cfg.tipo).name}: últimos` : '🕘 Mexidos por último')} <a data-go="lib">biblioteca →</a></h4>${L.map(rowItem).join('') || vazio('Seu loot está vazio.')}</div>`;
      } },
    habitos: { em: '🔁', nome: 'Hábitos de hoje', desc: 'Só os hábitos do dia, com o botão de marcar.', un: 1, tam: 'm',
      html(w) { const h = M.rotinaHojeHTML ? M.rotinaHojeHTML() : ''; return `<div class="panel w-hab">${h ? (w.titulo ? `<h4>${esc(w.titulo)}</h4>` : '') + h : `<h4>${tit(w, '🔁 Hábitos de hoje')}</h4>${vazio('Nenhum hábito para hoje. Crie na Rotina.')} <a data-go="rot">abrir a Rotina →</a>`}</div>`; } },
    agenda: { em: '📅', nome: 'Próximos compromissos', desc: 'Compromissos e tarefas com hora dos próximos dias.', un: 1, tam: 'm', aj: [['dias', 'n', 'Quantos dias', 7]],
      html(w, c) {
        const ate = M.addDays(c.today, num(w.cfg.dias, 7, 1, 60));
        const L = M.db.tasks.filter((t) => !t.done && t.date && t.date >= c.today && t.date <= ate && (t.ev || t.hora) && !M.evPassou(t)).sort((a, b) => a.date.localeCompare(b.date) || (a.hora || '').localeCompare(b.hora || '')).slice(0, 12);
        return `<div class="panel"><h4>${tit(w, '📅 Próximos compromissos')} <a data-go="cal">calendário →</a></h4>${L.map((t) => `<div class="w-ag" data-tk="${t.id}"><span class="w-ag-d">${t.date === c.today ? 'Hoje' : M.fmtDate(t.date)}</span><b>${esc(t.text)}</b><small>${esc(t.ev ? M.faixaHora(t) : '⏰ ' + t.hora)}</small></div>`).join('') || vazio('Nada marcado com hora nos próximos dias.')}</div>`;
      } },
    contas: { em: '💰', nome: 'Contas', desc: 'Contas atrasadas e dos próximos dias, e o saldo do mês.', un: 1, tam: 'm', aj: [['dias', 'n', 'Mostrar até quantos dias à frente', 7]],
      html(w, c) {
        const F = M.db.fin || [], ate = M.addDays(c.today, num(w.cfg.dias, 7, 0, 60)), mes = c.today.slice(0, 7);
        const L = F.filter((f) => !f.pago && f.data <= ate).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 10);
        const R = M.finResumo ? M.finResumo(F.filter((f) => (f.data || '').slice(0, 7) === mes)) : null;
        return `<div class="panel"><h4>${tit(w, '💰 Contas')} <a data-go="fin">financeiro →</a></h4>${R ? `<div class="w-saldo"><span>Saldo do mês</span><b class="${R.saldo >= 0 ? 'pos' : 'neg'}">${M.reais(R.saldo)}</b><small>previsão ${M.reais(R.prev)}</small></div>` : ''}
          ${L.map((f) => `<div class="w-ct ${f.data < c.today ? 'late' : ''}" data-fin="${f.id}"><span>${f.data === c.today ? 'Hoje' : f.data.slice(8) + '/' + f.data.slice(5, 7)}</span><b>${esc(f.desc || (f.tipo === 'entrada' ? 'Entrada' : 'Saída'))}</b><em class="${f.tipo === 'entrada' ? 'pos' : 'neg'}">${f.tipo === 'entrada' ? '+' : '−'} ${M.reais(f.valor)}</em></div>`).join('') || vazio('Nenhuma conta em aberto nesses dias. 🎉')}</div>`;
      } },
    metas: { em: '🏆', nome: 'Metas', desc: 'Barras das suas metas em aberto.', un: 1, tam: 'p',
      html(w) {
        const L = (M.db.goals || []).filter((g) => !g.arq && !(g.alvo > 0 && g.atual >= g.alvo)).slice(0, 6);
        return `<div class="panel"><h4>${tit(w, '🏆 Metas')} <a data-go="rot">rotina →</a></h4>${L.map((g) => { const p = g.alvo > 0 ? Math.min(100, Math.round(((Number(g.atual) || 0) / g.alvo) * 100)) : 0; return `<div class="quest"><span>${esc(g.em || '🎯')} ${esc(g.nome)}</span><div class="bar"><i style="width:${p}%"></i></div><small>${p}%</small></div>`; }).join('') || vazio('Nenhuma meta em aberto. Crie na Rotina.')}</div>`;
      } },
    funil: { em: '👥', nome: 'Funil de clientes', desc: 'Quantos clientes há em cada coluna do funil.', un: 1, tam: 'p',
      html(w) {
        const C = M.db.clients || [], cols = M.cliCols ? M.cliCols() : [];
        return `<div class="panel"><h4>${tit(w, '👥 Funil')} <a data-go="clients">clientes →</a></h4>${C.length ? `<div class="w-funil">${cols.map((s) => `<div style="--c:${esc(s.color)}" data-go="clients"><b>${C.filter((c) => (cols.find((x) => x.id === c.status) || cols[0]).id === s.id).length}</b><small>${esc(s.em)} ${esc(s.name)}</small></div>`).join('')}</div>` : vazio('Nenhum cliente ainda.')}</div>`;
      } },
    foco: { em: '⏱', nome: 'Modo foco', desc: 'Botão grande para começar um foco.', un: 1, tam: 'p',
      html(w) { return `<div class="panel w-foco"><h4>${tit(w, '⏱ Modo foco')}</h4><button type="button" class="btn w-foco-b" data-foco>▶ Começar um foco</button><small>O relógio também fica no topo da tela.</small></div>`; } },
    nota: { em: '🗒️', nome: 'Bloco de notas', desc: 'Um texto seu, sempre à vista. Pode ter vários.', tam: 'p', aj: [],
      html(w) { return `<div class="panel w-nota"><h4>${tit(w, '🗒️ Notas')}</h4><textarea id="wn-${esc(w.id)}" data-nota="${esc(w.id)}" placeholder="Escreva aqui. Salva sozinho." aria-label="${tit(w, 'Notas')}">${esc(w.cfg.texto || '')}</textarea></div>`; } },
    atalhos: { em: '🔗', nome: 'Atalhos', desc: 'Botões para as telas e os links que você mais usa. Pode ter vários.', tam: 'p',
      aj: [['abas', 'abas', 'Telas'], ['links', 'links', 'Links (um por linha: Nome | endereço)']],
      html(w) {
        const abas = (Array.isArray(w.cfg.abas) ? w.cfg.abas : ['tasks', 'fin', 'clients']).map((id) => PAGINAS.find((p) => p[0] === id)).filter(Boolean);
        const links = String(w.cfg.links || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((l) => l[0] && /^https?:\/\//i.test(l[1] || ''));
        return `<div class="panel"><h4>${tit(w, '🔗 Atalhos')}</h4><div class="w-at">${abas.map(([id, em, n]) => `<button type="button" class="btn ghost sm" data-go="${id}">${em} ${n}</button>`).join('')}${links.map(([n, u]) => `<a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener">↗ ${esc(n)}</a>`).join('')}</div>${abas.length || links.length ? '' : vazio('Abra ⚙️ Ajustes (em ✏️ Organizar) para escolher.')}</div>`;
      } },
  };
  M.HOME_W = W;
  M.organizarInicio = () => { org = true; M.go('home'); };
  const PADRAO = [['w-saudacao', 'saudacao', 'g', ''], ['w-mapa', 'mapa', 'p', 'duplo'], ['w-captura', 'captura', 'g', ''], ['w-hoje', 'hoje', 'm', ''],
    ['w-missoes', 'missoes', 'm', ''], ['w-andamento', 'andamento', 'p', ''], ['w-favoritos', 'favoritos', 'p', ''], ['w-recentes', 'recentes', 'p', '']]
    .map(([id, tipo, tam, alto], i) => ({ id, tipo, tam, alto, ord: i, oculto: false, soPc: false, soCel: false, titulo: '', cfg: {}, updated: 0 }));
  const lista = () => {
    if (!Array.isArray(M.db.homeWidgets)) M.db.homeWidgets = PADRAO.map((o) => Object.assign({}, o, { cfg: {} }));
    return M.db.homeWidgets.filter((w) => W[w.tipo]).sort((a, b) => (a.ord || 0) - (b.ord || 0));
  };
  const reordena = (L) => L.forEach((w, i) => { if (w.ord !== i) { w.ord = i; w.updated = Date.now(); } });
  const mexe = (w, o) => { Object.assign(w, o, { updated: Date.now() }); M.save(); };
  const celular = () => matchMedia('(max-width:700px)').matches;
  const TAMS = [['p', 'P', 'Pequeno'], ['m', 'M', 'Médio'], ['g', 'G', 'Grande'], ['cheio', '▭', 'Largura toda']];

  function barra(w, i, n) {
    const d = W[w.tipo];
    return `<div class="wdg-bar" role="toolbar" aria-label="Organizar ${esc(d.nome)}">
      <button type="button" class="wdg-mv" data-wa="mv" title="Arraste para mudar de lugar (ou use as setas do teclado)" aria-label="Mover ${esc(d.nome)}">⠿</button>
      <span class="wdg-nm">${esc(d.em)} ${esc(w.titulo || d.nome)}</span>
      <button type="button" class="icon-btn sm" data-wa="up" ${i ? '' : 'disabled'} title="Para antes" aria-label="Mover para antes">↑</button><button type="button" class="icon-btn sm" data-wa="down" ${i < n - 1 ? '' : 'disabled'} title="Para depois" aria-label="Mover para depois">↓</button>
      <span class="wdg-tams">${TAMS.map(([k, l, t]) => `<button type="button" data-wt="${k}" class="${w.tam === k ? 'on' : ''}" title="${t}" aria-label="Tamanho ${t}" aria-pressed="${w.tam === k}">${l}</button>`).join('')}</span>
      <button type="button" class="icon-btn sm" data-wa="aj" title="Ajustes" aria-label="Ajustes de ${esc(d.nome)}">⚙️</button>
      <button type="button" class="icon-btn sm" data-wa="ver" title="${w.oculto ? 'Mostrar' : 'Ocultar (fica guardado)'}" aria-label="${w.oculto ? 'Mostrar' : 'Ocultar'} ${esc(d.nome)}">${w.oculto ? '👁' : '🙈'}</button>
      <button type="button" class="icon-btn sm" data-wa="rm" title="Tirar do Início" aria-label="Tirar ${esc(d.nome)} do Início">✕</button>
    </div>`;
  }

  M.pages.home = () => {
    const v = $('#view'), g = M.db.game, s = M.db.settings, today = M.today();
    const h = new Date().getHours(), hi = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const open = M.db.tasks.filter(M.tarefaPendente); // compromisso que já passou não conta como pendente
    const late = open.filter((t) => t.date && t.date < today), now = open.filter((t) => t.date === today);
    const dayXp = (g.log[today] || { xp: 0 }).xp, pct = Math.min(100, Math.round((dayXp / (s.dailyGoal || 50)) * 100));
    const sum = late.length || now.length ? `${now.length} tarefa${now.length === 1 ? '' : 's'} para hoje${late.length ? ` · <b style="color:var(--red)">${late.length} atrasada${late.length === 1 ? '' : 's'}</b>` : ''}` : 'Nada marcado para hoje. Dia livre! 🎉';
    const contas = M.finHoje ? M.finHoje() : [];
    const sumFin = contas.length ? ` · <a data-go="fin" style="color:var(--amber);cursor:pointer">💰 ${contas.length} conta${contas.length > 1 ? 's' : ''} para hoje ou atrasada${contas.length > 1 ? 's' : ''}</a>` : '';
    // lembrete de backup: nunca fez (e já tem bastante coisa) ou o último backup tem mais de 14 dias
    const bk = s.bkUlt || 0, diasBk = bk ? Math.floor((Date.now() - bk) / 864e5) : -1;
    const sumBk = !M.remoto && ((!bk && M.db.items.length + M.db.tasks.length > 30) || diasBk > 14) ? ` · <a data-bk style="color:var(--amber);cursor:pointer" title="Abre Configurações → Dados e backup">💾 ${bk ? `último backup há ${diasBk} dias` : 'faça um backup'}</a>` : '';
    const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const c = { today, hi, date, sum, sumFin, sumBk, open, late, now, dayXp, pct };

    const cel = celular(), todos = lista();
    const L = todos.filter((w) => (org || !w.oculto) && !(cel ? w.soPc : w.soCel));
    const corpo = L.map((w, i) => {
      const d = W[w.tipo];
      let html; try { html = d.html(w, c); } catch (e) { html = `<div class="panel">${vazio('⚠️ Este widget não abriu: ' + esc(e.message))}</div>`; }
      return `<section class="wdg t-${w.tipo} tam-${w.tam}${w.alto === 'duplo' ? ' duplo' : ''}${d.topo ? ' home-topo' : ''}${w.oculto ? ' oculto' : ''}" data-w="${esc(w.id)}">${org ? barra(w, i, L.length) : ''}${html}</section>`;
    }).join('');
    v.innerHTML = `<div class="home-acoes${org ? ' on' : ''}">${org
      ? `<span class="home-org-t">🧩 Organizando o Início ${M.hint('Arraste pelo ⠿ (ou use ↑ ↓) para mudar a ordem. P, M, G e ▭ mudam o tamanho. ⚙️ tem os ajustes de cada um, 🙈 oculta sem perder e ✕ tira do Início (dá para pôr de volta em ＋ Adicionar). Tudo tem Desfazer.')}</span><span class="grow"></span><button class="btn ghost sm" id="hPad">↺ Voltar ao padrão</button><button class="btn ghost sm" id="hAdd">＋ Adicionar widget</button><button class="btn sm" id="hOrg">✔ Pronto</button>`
      : '<span class="grow"></span><button class="btn ghost sm" id="hOrg" title="Escolher, mover, mudar de tamanho e tirar os quadros do Início">✏️ Organizar Início</button>'}</div>
      <div class="home-g${org ? ' org' : ''}">${corpo || `<div class="empty wdg tam-cheio"><div class="big">🧩</div><h3>Seu Início está vazio</h3><p>Escolha os quadros que quer ver aqui.</p><button class="btn" id="hAdd2" style="margin-top:12px">＋ Adicionar widget</button></div>`}</div>`;
    L.forEach((w) => { const d = W[w.tipo]; if (d.depois && (!w.oculto || org)) try { d.depois(w); } catch (_) {} });

    // ----- guardar rápido -----
    const input = $('#qcIn');
    if (input) {
      const save = () => {
        const val = input.value.trim(); if (!val) return M.falta(input, '✍️ Escreva algo primeiro (ou fale no 🎙️)');
        const isUrl = /^(https?:\/\/|www\.)\S+$/i.test(val);
        const mode = isUrl ? 'link' : qcMode;
        if (mode === 'tarefa') { M.addTask(val); M.toast('✅ Tarefa criada'); }
        else {
          const title = mode === 'link' ? val.replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0] : val.split('\n')[0].slice(0, 60);
          const novoIt = M.createItem({ type: mode, title, content: mode === 'nota' && val.length <= 60 ? '' : (isUrl && !/^https?:/i.test(val) ? 'https://' + val : val), cat: '' });
          // link: troca o domínio pelo título real da página quando ele chegar (se não chegar, fica o domínio)
          if (mode === 'link' && novoIt && novoIt.id) M.api('/api/titulo?url=' + encodeURIComponent(novoIt.content)).then((r) => {
            const it = M.db.items.find((x) => x.id === novoIt.id);
            if (it && r && r.titulo && it.title === title) { it.title = r.titulo.slice(0, 140); it.updated = Date.now(); M.save(); if (M.ui.page === 'home' || M.ui.page === 'lib') M.render(); }
          }).catch(() => {});
          M.toast(`${M.type(mode).em} Guardado no loot`);
        }
        qcTxt = ''; M.render(); if ($('#qcIn')) $('#qcIn').focus();
      };
      $('#qcGo').onclick = save;
      if ($('#qcVoz')) $('#qcVoz').onclick = () => M.voz(); // no celular o áudio vai para o PC transcrever
      input.oninput = () => { qcTxt = input.value; };
      input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }; // Shift + Enter pula linha
      // trocar Tarefa/Nota/Prompt/Link redesenha a tela: o texto já digitado continua no campo, com o cursor no fim
      if ($('#qcM')) $('#qcM').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; qcTxt = input.value; qcMode = b.dataset.m; SFX.play('click'); M.render(); const i = $('#qcIn'); i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) {} };
    }
    // ----- bloco de notas: salva sozinho (espera a pessoa parar de digitar) -----
    $$('[data-nota]', v).forEach((ta) => {
      let t = 0;
      const grava = () => { clearTimeout(t); const w = M.db.homeWidgets.find((x) => x.id === ta.dataset.nota); if (!w || (w.cfg.texto || '') === ta.value) return; w.cfg = Object.assign({}, w.cfg, { texto: ta.value.slice(0, 4000) }); w.updated = Date.now(); M.save(); };
      ta.oninput = () => { clearTimeout(t); t = setTimeout(grava, 900); };
      ta.onblur = grava;
    });

    $('#hOrg').onclick = () => { org = !org; SFX.play('click'); M.render(); };
    if ($('#hAdd')) $('#hAdd').onclick = galeria;
    if ($('#hAdd2')) $('#hAdd2').onclick = galeria;
    if ($('#hPad')) $('#hPad').onclick = padrao;

    v.onclick = (e) => {
      const bar = e.target.closest('.wdg-bar');
      if (bar) return acaoBarra(e, bar.closest('[data-w]').dataset.w);
      if (org && e.target.closest('.wdg') && !e.target.closest('.qc textarea,.w-nota textarea')) { // organizando: os quadros não abrem nada (evita clique sem querer ao arrastar)
        if (e.target.closest('a,button,input,.rowi,.task')) { e.preventDefault(); return; }
      }
      const go = e.target.closest('[data-go]'); if (go) return M.go(go.dataset.go);
      if (e.target.closest('[data-bk]')) { M.ui.cfgSec = '💾 Dados e backup'; return M.go('cfg'); }
      if (e.target.closest('[data-foco]')) return M.focusToggle();
      const fi = e.target.closest('[data-fin]'); if (fi && M.finEditar) { const f = (M.db.fin || []).find((x) => x.id === fi.dataset.fin); if (f) return M.finEditar(f); }
      const ag = e.target.closest('[data-tk]'); if (ag) return M.abrirTarefa(ag.dataset.tk);
      const row = e.target.closest('.rowi'); if (row) return M.openItem(row.dataset.id);
      const hb = e.target.closest('[data-hab]'); if (hb) return M.rotinaMarca(hb.dataset.hab, e);
      const tk = e.target.closest('.task'); if (!tk) return;
      const t = M.db.tasks.find((x) => x.id === tk.dataset.id); if (!t) return;
      if (e.target.type === 'checkbox') M.toggleTask(t, e);
      else if (e.target.dataset.a === 'rm') M.trashTask(t);
      else if (e.target.dataset.a === 'prio') { t.prio = M.proxPrio(t.prio); M.save(); M.render(); }
      else M.abrirTarefa(t.id);
    };
    v.oncontextmenu = (e) => {
      const r = e.target.closest('.rowi'); if (r && !org) return M.itemMenu(e, M.db.items.find((i) => i.id === r.dataset.id));
      const wd = e.target.closest('.wdg[data-w]'); if (!wd || e.target.closest('textarea,input')) return;
      if (wd.querySelector('h4') && !e.target.closest('h4') && !org) return; // fora do título, o clique direito segue normal
      menuWidget(e, wd.dataset.w);
    };
    if (org) ligaArrastar(v);
  };

  // ----- ações de cada widget -----
  function acaoBarra(e, id) {
    const w = M.db.homeWidgets.find((x) => x.id === id); if (!w) return;
    const tb = e.target.closest('[data-wt]'); if (tb) { if (w.tam !== tb.dataset.wt) { mexe(w, { tam: tb.dataset.wt }); SFX.play('click'); M.render(); } return; }
    const b = e.target.closest('[data-wa]'); if (!b) return;
    const a = b.dataset.wa;
    if (a === 'up' || a === 'down') return move(w, a === 'up' ? -1 : 1);
    if (a === 'aj') return ajustes(w);
    if (a === 'ver') { mexe(w, { oculto: !w.oculto }); SFX.play('click'); M.toast(w.oculto ? '🙈 Widget oculto (continua guardado aqui)' : '👁 Widget de volta'); return M.render(); }
    if (a === 'rm') return tirar(w);
  }
  function move(w, d) {
    const cel = celular(), L = lista().filter((x) => (org || !x.oculto) && !(cel ? x.soPc : x.soCel)), i = L.indexOf(w), j = i + d;
    if (i < 0 || j < 0 || j >= L.length) return;
    const T = lista(), a = T.indexOf(L[i]), b = T.indexOf(L[j]); [T[a], T[b]] = [T[b], T[a]]; reordena(T);
    M.save(); SFX.play('drop'); M.render();
    const el = $(`.wdg[data-w="${CSS.escape(w.id)}"] [data-wa="${d < 0 ? 'up' : 'down'}"]`); if (el && !el.disabled) el.focus(); else { const m = $(`.wdg[data-w="${CSS.escape(w.id)}"] .wdg-mv`); if (m) m.focus(); }
  }
  function tirar(w) {
    M.db.homeWidgets = M.db.homeWidgets.filter((x) => x !== w); reordena(lista());
    M.save(); SFX.play('trash'); M.toast(`✕ “${w.titulo || W[w.tipo].nome}” saiu do Início`); M.render();
  }
  function menuWidget(e, id) {
    const w = M.db.homeWidgets.find((x) => x.id === id); if (!w) return;
    M.ctxMenu(e, [
      { em: '✏️', t: org ? 'Parar de organizar' : 'Organizar Início', fn: () => { org = !org; M.render(); } },
      { em: '⚙️', t: 'Ajustes deste widget', fn: () => ajustes(w) },
      { em: '↑', t: 'Para antes', fn: () => move(w, -1) }, { em: '↓', t: 'Para depois', fn: () => move(w, 1) },
      { em: '🙈', t: 'Ocultar', fn: () => { mexe(w, { oculto: true }); M.render(); } },
      { em: '＋', t: 'Adicionar widget', fn: galeria },
      '-', { em: '✕', t: 'Tirar do Início', fn: () => tirar(w) },
    ]);
  }
  async function padrao() {
    if (!(await M.confirm('Voltar o Início ao jeito de fábrica? Os widgets que você acrescentou e as notas dos blocos de notas saem (dá para desfazer).', '↺ Voltar ao padrão'))) return;
    M.db.homeWidgets = PADRAO.map((o) => Object.assign({}, o, { cfg: {}, updated: Date.now() }));
    M.save(); SFX.play('undo'); M.toast('↺ Início no padrão'); M.render();
  }

  // ----- galeria: escolher um widget para pôr no Início -----
  function galeria() {
    const L = lista();
    const m = M.modal(`<div class="modal-h"><h2>＋ Adicionar widget</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b"><p class="opc-dica">Escolha o que quer ver no Início. Depois arraste pelo ⠿ para pôr no lugar e use P, M, G ou ▭ para o tamanho.</p>
        <div class="w-gal">${Object.entries(W).map(([k, d]) => {
          const tem = L.filter((w) => w.tipo === k), oc = tem.find((w) => w.oculto);
          const bt = d.un && tem.length ? (oc ? `<button type="button" class="btn ghost sm" data-mostra="${esc(oc.id)}">👁 Mostrar</button>` : '<span class="w-gal-ja">✔ Já está no Início</span>') : `<button type="button" class="btn sm" data-add="${k}">＋ Adicionar</button>`;
          return `<div class="w-gal-c"><span class="w-gal-em">${d.em}</span><div><b>${esc(d.nome)}</b><small>${esc(d.desc)}</small></div>${bt}</div>`;
        }).join('')}</div></div>`);
    $('#x', m).onclick = M.closeModal;
    m.querySelector('.w-gal').onclick = (e) => {
      const mo = e.target.closest('[data-mostra]');
      if (mo) { const w = M.db.homeWidgets.find((x) => x.id === mo.dataset.mostra); if (w) mexe(w, { oculto: false }); M.closeModal(); SFX.play('pop'); M.render(); return foca(mo.dataset.mostra); }
      const b = e.target.closest('[data-add]'); if (!b) return;
      const k = b.dataset.add, d = W[k];
      const w = { id: (d.un ? 'w-' + k : 'w' + M.uid()), tipo: k, tam: d.tam || 'm', alto: d.alto || '', ord: lista().length, oculto: false, soPc: false, soCel: false, titulo: '', cfg: {}, updated: Date.now() };
      if (d.un && M.db.homeWidgets.some((x) => x.id === w.id)) w.id = 'w' + M.uid(); // id fixo já usado por outro (ex.: veio de outro aparelho)
      M.db.homeWidgets.push(w); M.save(); M.closeModal(); SFX.play('pop'); M.toast(`${d.em} “${d.nome}” no Início`);
      org = true; M.render(); foca(w.id);
    };
  }
  const foca = (id) => setTimeout(() => { const el = $(`.wdg[data-w="${CSS.escape(id)}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('novo'); setTimeout(() => el.classList.remove('novo'), 1600); } }, 60);

  // ----- ajustes de um widget -----
  function ajustes(w) {
    const d = W[w.tipo], cf = w.cfg || {};
    const campo = ([k, tp, rot, pad]) => {
      if (tp === 'n') return `<div class="fld"><label for="aj-${k}">${rot}</label><input type="number" id="aj-${k}" min="1" max="60" value="${esc(cf[k] != null ? cf[k] : pad)}"></div>`;
      if (tp === 'sim') return `<div class="cfg-row" style="border:0;padding:0"><span class="l">${rot}</span>${M.sw('aj-' + k, cf[k] != null ? !!cf[k] : pad !== false)}</div>`;
      if (tp === 'status') return `<div class="fld"><label for="aj-${k}">${rot}</label><select id="aj-${k}">${M.STATUS.map((s) => `<option value="${esc(s.id)}" ${s.id === M.statusDe(cf[k] || 'and').id ? 'selected' : ''}>${esc(s.em)} ${esc(s.name)}</option>`).join('')}</select></div>`;
      if (tp === 'tipo') return `<div class="fld"><label for="aj-${k}">${rot}</label><select id="aj-${k}"><option value="">Todos os tipos</option>${M.TYPES.map((t) => `<option value="${t.id}" ${t.id === cf[k] ? 'selected' : ''}>${t.em} ${t.name}</option>`).join('')}</select></div>`;
      if (tp === 'modos') { const on = Array.isArray(cf[k]) && cf[k].length ? cf[k] : MODOS.map((x) => x[0]); return `<div class="fld"><label>${rot}</label><div class="w-chk">${MODOS.map(([id, n]) => `<label><input type="checkbox" data-mod="${id}" ${on.includes(id) ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>`; }
      if (tp === 'abas') { const on = Array.isArray(cf[k]) ? cf[k] : ['tasks', 'fin', 'clients']; return `<div class="fld"><label>${rot}</label><div class="w-chk">${PAGINAS.map(([id, em, n]) => `<label><input type="checkbox" data-aba="${id}" ${on.includes(id) ? 'checked' : ''}> ${em} ${n}</label>`).join('')}</div></div>`; }
      if (tp === 'missoes') { const a = alvosMissoes(); return `<div class="fld"><label>${rot}</label><div class="w-mis">${MISSOES.map(([id, em, t]) => `<label><span>${em} ${esc(t(2).replace(/\d+/, 'N'))}</span><input type="number" min="0" max="50" data-mis="${id}" value="${a[id]}"></label>`).join('')}</div></div>`; }
      if (tp === 'links') return `<div class="fld"><label for="aj-${k}">${rot}</label><textarea id="aj-${k}" rows="3" placeholder="Canva | https://canva.com">${esc(cf[k] || '')}</textarea></div>`;
      return '';
    };
    const m = M.modal(`<div class="modal-h"><h2>⚙️ ${esc(d.em)} ${esc(d.nome)}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b">
        ${w.tipo === 'saudacao' || w.tipo === 'captura' || w.tipo === 'mapa' ? '' : `<div class="fld"><label for="ajT">Nome no título <small style="color:var(--faint)">(opcional)</small></label><input type="text" id="ajT" maxlength="60" value="${esc(w.titulo || '')}" placeholder="${esc(d.nome)}"></div>`}
        ${(d.aj || []).map(campo).join('')}
        <div class="row"><div class="fld"><label for="ajTam">Tamanho</label><select id="ajTam">${TAMS.map(([k, , t]) => `<option value="${k}" ${w.tam === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="fld"><label for="ajAl">Altura</label><select id="ajAl"><option value="">Normal</option><option value="duplo" ${w.alto === 'duplo' ? 'selected' : ''}>Dupla</option></select></div></div>
        <div class="fld"><label for="ajOnde">Onde aparece</label><select id="ajOnde"><option value="">No computador e no celular</option><option value="pc" ${w.soPc ? 'selected' : ''}>Só no computador</option><option value="cel" ${w.soCel ? 'selected' : ''}>Só no celular</option></select></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="ajCn" style="flex:none">Cancelar</button><button class="btn" id="ajOk" style="flex:none">✔ Salvar</button></div>
      </div>`, { small: true });
    $('#x', m).onclick = M.closeModal; $('#ajCn', m).onclick = M.closeModal;
    $('#ajOk', m).onclick = () => {
      const n = Object.assign({}, cf);
      (d.aj || []).forEach(([k, tp, , pad]) => {
        const el = $('#aj-' + k, m);
        if (tp === 'n') n[k] = num(el.value, pad, 1, 60);
        else if (tp === 'sim') n[k] = el.checked;
        else if (tp === 'status' || tp === 'tipo' || tp === 'links') n[k] = el.value;
        else if (tp === 'modos') { const L = [...m.querySelectorAll('[data-mod]:checked')].map((x) => x.dataset.mod); n[k] = L.length ? L : MODOS.map((x) => x[0]); }
        else if (tp === 'abas') n[k] = [...m.querySelectorAll('[data-aba]:checked')].map((x) => x.dataset.aba);
        else if (tp === 'missoes') n[k] = [...m.querySelectorAll('[data-mis]')].map((x) => x.dataset.mis + ':' + Math.max(0, Math.min(50, Math.round(+x.value) || 0)));
      });
      const onde = $('#ajOnde', m).value;
      mexe(w, { cfg: n, titulo: $('#ajT', m) ? $('#ajT', m).value.trim().slice(0, 60) : w.titulo, tam: $('#ajTam', m).value, alto: $('#ajAl', m).value, soPc: onde === 'pc', soCel: onde === 'cel' });
      M.closeModal(); SFX.play('done'); M.toast('✅ Widget ajustado'); M.render();
    };
  }

  // ----- arrastar para mudar de lugar (mouse, toque e caneta pelos Pointer Events; teclado pelas setas) -----
  function ligaArrastar(v) {
    const g = $('.home-g', v); if (!g) return;
    g.addEventListener('keydown', (e) => {
      const mv = e.target.closest('.wdg-mv'); if (!mv) return;
      const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!d) return;
      e.preventDefault(); const w = M.db.homeWidgets.find((x) => x.id === mv.closest('[data-w]').dataset.w); if (w) move(w, d);
    });
    g.addEventListener('pointerdown', (e) => {
      const mv = e.target.closest('.wdg-mv'); if (!mv || e.button > 0) return;
      e.preventDefault();
      const el = mv.closest('.wdg'), r = el.getBoundingClientRect();
      const ph = document.createElement('div'); ph.className = `wdg-ph ${[...el.classList].filter((c) => /^tam-|^duplo$/.test(c)).join(' ')}`; ph.style.height = r.height + 'px';
      el.after(ph);
      Object.assign(el.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 300, pointerEvents: 'none' });
      el.classList.add('arrasta');
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      let rola = 0, ux = e.clientX, uy = e.clientY;
      const scroller = $('#view');
      const posiciona = () => {
        el.style.left = ux - dx + 'px'; el.style.top = uy - dy + 'px';
        const alvo = document.elementFromPoint(ux, uy); const o = alvo && alvo.closest('.home-g > .wdg:not(.arrasta)');
        if (!o) return;
        const ro = o.getBoundingClientRect();
        const mesmaLinha = Math.abs(ro.top - ph.getBoundingClientRect().top) < 8;
        const antes = mesmaLinha ? ux < ro.left + ro.width / 2 : uy < ro.top + ro.height / 2;
        if (antes) { if (o.previousElementSibling !== ph) o.before(ph); } else if (o.nextElementSibling !== ph) o.after(ph);
      };
      const passo = () => {
        const m = 70, vel = uy < m ? -(m - uy) / 3 : uy > innerHeight - m ? (uy - (innerHeight - m)) / 3 : 0;
        if (vel) { scroller.scrollBy(0, vel); window.scrollBy(0, vel); posiciona(); }
        rola = requestAnimationFrame(passo);
      };
      rola = requestAnimationFrame(passo);
      const mexeu = (ev) => { ux = ev.clientX; uy = ev.clientY; posiciona(); };
      const solta = () => {
        cancelAnimationFrame(rola);
        removeEventListener('pointermove', mexeu); removeEventListener('pointerup', solta); removeEventListener('pointercancel', solta);
        ph.replaceWith(el); el.removeAttribute('style'); el.classList.remove('arrasta');
        const ids = [...g.querySelectorAll(':scope > .wdg[data-w]')].map((x) => x.dataset.w);
        const T = lista(), vistos = T.filter((w) => ids.includes(w.id)), fora = T.filter((w) => !ids.includes(w.id));
        // os que estão na tela ficam na ordem nova; os escondidos (outro tamanho de tela) mantêm a posição relativa no fim
        const nova = ids.map((id) => vistos.find((w) => w.id === id)).filter(Boolean).concat(fora);
        if (nova.some((w, i) => w !== T[i])) { reordena(nova); M.save(); SFX.play('drop'); }
        M.render();
      };
      addEventListener('pointermove', mexeu); addEventListener('pointerup', solta); addEventListener('pointercancel', solta);
    });
  }

  // ----- timer de foco (25 min) -----
  // O relógio fica no servidor: fechar a aba não para o foco, e o computador avisa quando acabar.
  let end = 0, min = 25, pref = 0, tick = 0, claiming = false; // pref: tempo escolhido com a rodinha do mouse, ainda não iniciado
  const passo = (v, d) => Math.max(5, Math.min(180, d > 0 ? Math.floor(v / 5) * 5 + 5 : Math.ceil(v / 5) * 5 - 5));
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  async function claim() {
    if (claiming) return; claiming = true;
    try {
      const r = await M.api('/api/focus/claim', { method: 'POST' });
      for (let i = 0; i < r.n; i++) M.award('focus');
      if (r.n) { SFX.play('goal'); FX.burst(null, null, 90, 11); M.toast(r.n > 1 ? `⏱ ${r.n} focos concluídos! XP na conta.` : '⏱ Foco concluído! Respire um pouco. 🌿'); if (M.ui.page === 'home') M.render(); }
    } catch (_) {}
    claiming = false;
  }
  function paint() {
    const el = $('#focus');
    if (!end) { el.classList.remove('run'); $('#focusT').textContent = String(pref || min).padStart(2, '0') + ':00'; document.title = 'MyLoot'; return; }
    const left = end - Date.now();
    if (left <= 0) { end = 0; paint(); setTimeout(claim, 1200); return; }
    el.classList.add('run'); $('#focusT').textContent = fmt(left); document.title = fmt(left) + ' · MyLoot';
  }
  async function sync() {
    try {
      const r = await M.api('/api/focus');
      end = r.end ? Date.now() + (r.end - r.agora) : 0; min = r.min || 25;
      paint();
      if (r.pendentes && M.db) claim();
    } catch (_) {}
  }
  M.focusStart = async (m) => {
    try {
      const r = await M.api('/api/focus/start', { method: 'POST', body: JSON.stringify({ min: m || 25 }) });
      end = Date.now() + (r.end - r.agora); min = r.min; pref = 0; SFX.play('star'); paint();
      M.toast(`⏱ Foco de ${min} min começou. Pode fechar a aba: o computador avisa no fim.`);
    } catch (e) { M.toast('⚠️ ' + e.message); }
  };
  M.focusToggle = async () => {
    if (end) {
      if (!(await M.confirm('Parar o foco agora? Esse tempo não vale XP.', 'Parar'))) return;
      await M.api('/api/focus/stop', { method: 'POST' }).catch(() => {});
      end = 0; SFX.play('click'); paint(); return;
    }
    let v = pref || min || 25;
    const m = M.modal(`<div class="modal-h"><h2>⏱ Modo foco</h2><button class="icon-btn" id="x" title="Fechar (Esc)" aria-label="Fechar">✕</button></div><div class="modal-b">
      <div>Quanto tempo? ${M.hint('O relógio roda no servidor do MyLoot. Você pode fechar o navegador: quando acabar, aparece um aviso no computador. Só para se você desligar o MyLoot ou o computador.')}</div>
      <div class="foco-num"><button class="icon-btn" id="fMenos" title="5 minutos a menos" aria-label="5 minutos a menos">−</button><b id="fVal"></b><button class="icon-btn" id="fMais" title="5 minutos a mais" aria-label="5 minutos a mais">＋</button></div>
      <small class="foco-dica">Role a bolinha do mouse (ou use − e ＋) para mudar de 5 em 5 minutos.</small>
      <div class="foco-grid">${[10, 15, 25, 45, 60, 90].map((n) => `<button class="btn ghost" data-m="${n}">${n} min</button>`).join('')}</div>
      <div class="row" style="justify-content:space-between;align-items:center;gap:8px"><button class="btn ghost sm" id="nt" style="flex:none">🔔 Testar o aviso</button><button class="btn" id="fGo" style="flex:none"></button></div></div>`, { small: true });
    const pinta = () => {
      $('#fVal', m).textContent = v + ' min'; $('#fGo', m).textContent = '▶ Começar ' + v + ' min';
      m.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('ghost', +b.dataset.m !== v));
    };
    const muda = (d) => { v = passo(v, d); pref = v; SFX.play('click'); pinta(); paint(); };
    const comeca = () => { M.closeModal(); M.focusStart(v); };
    $('#x', m).onclick = M.closeModal;
    $('#nt', m).onclick = () => M.api('/api/notify-test', { method: 'POST' }).then(() => M.toast('Aviso enviado. Olhe o canto da tela.'));
    $('#fMenos', m).onclick = () => muda(-1); $('#fMais', m).onclick = () => muda(1); $('#fGo', m).onclick = comeca;
    // clicar num tempo escolhe; clicar de novo no mesmo (ou em Começar) inicia
    m.querySelector('.foco-grid').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; const n = +b.dataset.m; if (n === v) return comeca(); v = n; pref = v; SFX.play('click'); pinta(); paint(); };
    m.addEventListener('wheel', (e) => { e.preventDefault(); muda(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    m.onkeydown = (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); muda(1); } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); muda(-1); } };
    pinta(); $('#fGo', m).focus();
  };
  $('#focus').onclick = M.focusToggle;
  // rodinha do mouse em cima do timer (parado) muda o tempo de 5 em 5 minutos
  $('#focus').addEventListener('wheel', (e) => { if (end) return; e.preventDefault(); pref = passo(pref || min, e.deltaY < 0 ? 1 : -1); paint(); }, { passive: false });
  tick = setInterval(paint, 1000);
  setInterval(sync, 30000);
  addEventListener('focus', sync);
  M.focusPaint = sync;
})();
