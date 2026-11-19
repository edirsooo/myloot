// Histórico de ações, com desfazer e refazer.
// Toda vez que o app salva, este arquivo compara as listas do banco com a "foto" anterior e anota o que mudou
// (criou, alterou, apagou), guardando o antes e o depois de cada objeto. Assim qualquer ação pode ser desfeita
// sem cada tela programar o seu próprio desfazer. A lista vale para a aba aberta (fica no sessionStorage):
// fechar o MyLoot limpa o histórico; o que foi para a Lixeira continua lá.
(function () {
  const { esc, $ } = M;
  // lista do banco: [singular, plural, gênero]
  const COL = { items: ['item', 'itens', 'o'], tasks: ['tarefa', 'tarefas', 'a'], clients: ['cliente', 'clientes', 'o'], fin: ['lançamento', 'lançamentos', 'o'], habits: ['hábito', 'hábitos', 'o'], goals: ['meta', 'metas', 'a'], categories: ['coleção', 'coleções', 'a'], tools: ['ferramenta', 'ferramentas', 'a'], cliCols: ['coluna do funil', 'colunas do funil', 'a'],
    itemStatus: ['status de item', 'status de item', 'o'], taskPrios: ['prioridade', 'prioridades', 'a'], finCats: ['categoria do financeiro', 'categorias do financeiro', 'a'],
    finFormas: ['forma de pagamento', 'formas de pagamento', 'a'], toolGroups: ['grupo de ferramentas', 'grupos de ferramentas', 'o'], homeWidgets: ['widget do Início', 'widgets do Início', 'o'], trash: ['', '', 'o'] };
  const EM = { cliCols: '▥', itemStatus: '🏷️', taskPrios: '🚦', finCats: '🧾', finFormas: '💳', toolGroups: '🧰', homeWidgets: '🧩', items: '📦', tasks: '✅', clients: '👥', fin: '💰', habits: '🎯', goals: '🏆', categories: '🗂️', tools: '🧰' };
  const LIX = { items: 'item', tasks: 'task', clients: 'client', fin: 'fin', habits: 'habit', goals: 'goal', tools: 'tool' }; // o que a Lixeira sabe guardar
  const FORA = ['_salvo', 'rascunho', '_new', '_novo', '_xp', 'updated', 'id'];
  const MAX = 40, CHAVE = 'myloot-historico';
  const FICA = ['xpd']; // campos que o desfazer não mexe (o XP já ganho não volta, então a marca de "já pontuou" também fica)
  const J = JSON.stringify;
  const chave = (k, o) => (k === 'trash' ? (o && o.data ? o.kind + ':' + o.data.id + ':' + o.at : '') : o && o.id);
  // versão "que vale": ficha aberta em edição (rascunho) conta como a versão salva; ficha nova só entra quando é salva
  const vale = (k, o) => {
    if (k === 'trash') return J(o);
    if (o._salvo) return o._salvo;
    const c = {}; for (const x of Object.keys(o).sort()) if (!FORA.includes(x)) c[x] = o[x];
    return J(c);
  };
  function tira() {
    const f = {};
    for (const k of Object.keys(COL)) {
      const m = new Map();
      (M.db[k] || []).forEach((o, i) => { const id = o && chave(k, o); if (id && !o._new && !o._novo) m.set(id, { v: vale(k, o), i, o }); });
      f[k] = m;
    }
    return f;
  }

  let foto = null, mudo = 0, sinc = false, pend = null, digitou = 0, lazy = 0;
  let H = []; // mais recente primeiro: { id, at, em, txt, recs, desfeito }
  const guarda = () => { try { let s = J(H); while (s.length > 1500000 && H.length > 1) { H.pop(); s = J(H); } sessionStorage.setItem(CHAVE, s); } catch (_) {} };
  try { H = JSON.parse(sessionStorage.getItem(CHAVE) || '[]') || []; } catch (_) { H = []; }

  function compara() {
    const nova = tira(), recs = [];
    for (const k of Object.keys(COL)) {
      const a = foto[k] || new Map(), b = nova[k];
      for (const [id, x] of b) { const y = a.get(id); if (!y) recs.push({ k, id, t: 'add', obj: J(x.o), i: x.i }); else if (y.v !== x.v) recs.push({ k, id, t: 'mud', a: y.v, d: x.v }); }
      for (const [id, y] of a) if (!b.has(id)) recs.push({ k, id, t: 'del', obj: J(y.o), i: y.i });
    }
    foto = nova;
    return recs;
  }
  const nome = (k, o) => { o = k === 'trash' ? o.data || {} : o; const s = String(o.title || o.text || o.nome || o.name || o.n || o.desc || '').trim(); return s ? ' “' + (s.length > 40 ? s.slice(0, 38) + '…' : s) + '”' : ''; };
  function rotulo(recs) {
    const lx = recs.filter((r) => r.k === 'trash'), rs = recs.filter((r) => r.k !== 'trash');
    const P = (r) => JSON.parse(r.obj || r.d);
    if (!rs.length) {
      const d = lx.filter((r) => r.t === 'del');
      if (d.length > 1) return ['🧹', `Lixeira esvaziada (${d.length})`];
      if (d.length === 1) return ['🔥', 'Apagado de vez da lixeira:' + nome('trash', P(d[0]))];
      return ['🗑️', 'Lixeira alterada'];
    }
    const ks = [...new Set(rs.map((r) => r.k))];
    // concluir uma tarefa repetida cria a próxima na mesma ação
    const feita = rs.length === 2 && rs.find((r) => r.k === 'tasks' && r.t === 'mud' && JSON.parse(r.d).done && !JSON.parse(r.a).done);
    if (feita && rs.some((r) => r.k === 'tasks' && r.t === 'add')) return ['✅', 'Tarefa concluída:' + nome('tasks', JSON.parse(feita.d)) + ' (criou a próxima repetição)'];
    if (rs.length > 1) {
      if (ks.length > 1) return ['✏️', `${rs.length} mudanças de uma vez`];
      const [, mu, g] = COL[ks[0]];
      const t = rs.every((r) => r.t === 'add') ? (lx.some((x) => x.t === 'del') ? `restaurad${g}s da lixeira` : `criad${g}s`) : rs.every((r) => r.t === 'del') ? (lx.some((x) => x.t === 'add') ? 'para a lixeira' : `removid${g}s`) : `alterad${g}s`;
      return [EM[ks[0]], `${rs.length} ${mu} ${t}`];
    }
    const r = rs[0], [um, , g] = COL[r.k], o = P(r), N = nome(r.k, o), U = um[0].toUpperCase() + um.slice(1);
    if (r.t === 'add') return lx.some((x) => x.t === 'del') ? ['↩️', `${U} restaurad${g} da lixeira:${N}`] : ['➕', `${U} ${r.k === 'tools' ? 'adicionad' : 'criad'}${g}:${N}`];
    if (r.t === 'del') return lx.some((x) => x.t === 'add') ? ['🗑️', `${U} para a lixeira:${N}`] : ['🗑️', `${U} removid${g}:${N}`];
    const a = JSON.parse(r.a), campos = Object.keys(Object.assign({}, a, o)).filter((c) => J(a[c]) !== J(o[c]));
    if (r.k === 'tasks' && campos.includes('done')) return o.done ? ['✅', `Tarefa concluída:${N}`] : ['↩️', `Tarefa reaberta:${N}`];
    if (r.k === 'items') {
      const st = M.STATUS.find((s) => s.id === o.status);
      if (campos.length === 1 && campos[0] === 'status' && st) return [st.em, `Item marcado como “${st.name}”:${N}`];
      if (campos.length === 1 && campos[0] === 'fav') return ['⭐', (o.fav ? 'Item favoritado:' : 'Item tirado dos favoritos:') + N];
      if (campos.includes('attachments')) { const x = (o.attachments || []).length - (a.attachments || []).length; if (x > 0) return ['📎', `Arquivo anexado em${N}`]; if (x < 0) return ['📎', `Anexo removido de${N}`]; }
    }
    if (r.k === 'habits' && campos.includes('pausa')) return o.pausa ? ['⏸', `Hábito pausado:${N}`] : ['▶', `Hábito retomado:${N}`];
    if ((r.k === 'goals' || r.k === 'tools' || r.k === 'items') && campos.includes('arq')) return ['📦', `${U} ${o.arq ? 'arquivad' : 'desarquivad'}${g}:${N}`];
    if (r.k === 'goals' && campos.includes('hist')) return ['🎯', `Avanço da meta:${N}`];
    if (r.k === 'tasks' && campos.includes('date') && campos.length <= 3 && !campos.includes('text')) return ['🗓️', `Tarefa mudou de dia:${N}`];
    if (r.k === 'fin' && campos.includes('pago')) return ['💰', (o.pago ? 'Lançamento marcado como pago:' : 'Lançamento voltou para “a pagar”:') + N];
    return ['✏️', `${U} alterad${g}:${N}`];
  }

  // anota o que mudou desde a última foto. `clique` = ação na hora (não é digitação): ganha o aviso com Desfazer.
  function registra(clique) {
    clearTimeout(lazy); lazy = 0;
    if (!foto || !M.db) return;
    const recs = compara();
    if (!recs.length || recs.length > 400) return; // restaurar backup ou importar pacote não entra no histórico
    const [em, txt] = rotulo(recs), agora = Date.now(), u = H[0];
    // várias alterações seguidas na mesma ficha viram uma linha só
    if (u && !u.desfeito && recs.length === 1 && recs[0].t === 'mud' && u.recs.length === 1 && u.recs[0].t === 'mud' && u.recs[0].k === recs[0].k && u.recs[0].id === recs[0].id && agora - u.at < 120000 && /alterad[oa]:/.test(u.txt) && /alterad[oa]:/.test(txt)) {
      u.recs[0].d = recs[0].d; u.at = agora; u.txt = txt;
      if (u.recs[0].a === u.recs[0].d) H.shift();
      guarda(); return;
    }
    // a primeira alteração logo depois de criar (ficha nova sendo preenchida) fica na mesma linha da criação
    if (u && !u.desfeito && recs.length === 1 && recs[0].t === 'mud' && u.recs.length === 1 && u.recs[0].t === 'add' && u.recs[0].k === recs[0].k && u.recs[0].id === recs[0].id && agora - u.at < 120000) {
      const o = (M.db[recs[0].k] || []).find((x) => chave(recs[0].k, x) === recs[0].id);
      if (o) { u.recs[0].obj = J(o); u.at = agora; const r2 = rotulo(u.recs); u.em = r2[0]; u.txt = r2[1]; guarda(); return; }
    }
    const e = { id: M.uid(), at: agora, em, txt, recs, desfeito: false };
    H.unshift(e); if (H.length > MAX) H.length = MAX;
    guarda();
    if (clique) {
      pend = e;
      setTimeout(() => {
        if (pend === e) pend = null;
        // a tela não avisou nada: o histórico avisa, com o botão de desfazer (menos quando só criou algo)
        if (!e.avisado && !e.desfeito && !recs.every((r) => r.t === 'add')) { e.avisado = true; toast0.call(M, `${em} ${txt}`, () => desfazer(e.id, true)); }
      }, 0);
    }
  }
  const silencio = (fn) => { mudo++; try { return fn(); } finally { mudo--; if (M.db) foto = tira(); } };

  // volta = true desfaz; false refaz. Devolve [quantas mudanças aplicou, quantos campos pulou por já terem mudado depois].
  function aplica(e, volta) {
    let n = 0, pulou = 0;
    const semLixo = !e.recs.some((r) => r.k === 'trash'), soCria = e.recs.every((r) => r.t === 'add');
    mudo++;
    try {
      for (const r of volta ? [...e.recs].reverse() : e.recs) {
        const fazer = volta ? { add: 'del', del: 'add', mud: 'mud' }[r.t] : r.t;
        const L = Array.isArray(M.db[r.k]) ? M.db[r.k] : (M.db[r.k] = []);
        const i = L.findIndex((o) => chave(r.k, o) === r.id);
        const noLixo = () => M.db.trash.findIndex((x) => x.kind === LIX[r.k] && x.data && x.data.id === r.id);
        if (fazer === 'del') {
          if (i < 0) continue;
          const [o] = L.splice(i, 1); n++;
          // desfazer uma criação não apaga de vez: o que a pessoa criou vai para a Lixeira
          // (o que nasceu junto com outra ação, como a próxima tarefa repetida, só some)
          if (volta && r.t === 'add' && semLixo && soCria && LIX[r.k]) M.db.trash.unshift({ kind: LIX[r.k], data: o, at: Date.now() });
        } else if (fazer === 'add') {
          if (i >= 0) continue;
          let o = null;
          if (semLixo && LIX[r.k]) { const x = noLixo(); if (x >= 0) o = M.db.trash.splice(x, 1)[0].data; }
          L.splice(Math.min(r.i == null ? L.length : r.i, L.length), 0, o || JSON.parse(r.obj)); n++;
        } else {
          if (i < 0) continue;
          // só os campos que esta ação mexeu voltam, e só se ainda estão como ela deixou:
          // o que foi mudado de novo depois (naquele campo ou em outros) fica como está
          const de = JSON.parse(volta ? r.d : r.a), para = JSON.parse(volta ? r.a : r.d), o = L[i];
          let mexeu = 0;
          for (const c of new Set([...Object.keys(de), ...Object.keys(para)])) {
            if (J(de[c]) === J(para[c]) || FICA.includes(c)) continue;
            if (J(o[c]) !== J(de[c])) { pulou++; continue; }
            if (c in para) o[c] = para[c]; else delete o[c];
            mexeu++;
          }
          if (mexeu) { if (o.updated) o.updated = Date.now(); n++; }
        }
      }
    } finally { mudo--; }
    foto = tira();
    return [n, pulou];
  }
  function troca(id, volta, quieto) {
    const e = H.find((x) => x.id === id);
    if (!e || !!e.desfeito === volta) return false;
    const [n, pulou] = aplica(e, volta);
    if (!n) { toast0.call(M, '🤷 Não deu: isso já foi mudado ou apagado de outro jeito.'); return false; }
    e.desfeito = volta; e.seq = Date.now(); guarda();
    M.save(); SFX.play('undo');
    if (M.modalOpen() && $('#overlay .hist')) desenha();
    if (M.render) M.render();
    if (M.cliAberto && M.modalOpen() && $('#overlay #cNome') && M.openClient) M.openClient(M.cliAberto); // ficha de cliente aberta: redesenha com o que voltou
    if (!quieto || pulou) toast0.call(M, (volta ? '↩ Desfeito: ' : '↪ Refeito: ') + e.txt + (pulou ? ' (uma parte já tinha sido mudada depois e ficou como está)' : ''));
    return true;
  }
  const desfazer = (id, quieto) => troca(id, true, quieto);
  const refazer = (id, quieto) => troca(id, false, quieto);

  // ----- ganchos -----
  const load0 = M.load;
  let carregou = false;
  // recarregar o banco no meio do uso (restaurar backup) zera o histórico: as ações antigas não valem para os dados novos
  M.load = async function () { const r = await load0.apply(this, arguments); if (carregou) { H.length = 0; guarda(); } carregou = true; foto = tira(); return r; };
  const sinc0 = M.sincronizar;
  // o que chega de outro aparelho não é ação desta pessoa nesta aba: não entra no histórico
  M.sincronizar = function () { if (lazy) registra(false); sinc = true; return sinc0.apply(this, arguments).finally(() => { sinc = false; if (M.db) foto = tira(); }); };
  const save0 = M.save;
  M.save = function () {
    const r = save0.apply(this, arguments);
    if (!mudo && !sinc && foto) { if (Date.now() - digitou < 600) { clearTimeout(lazy); lazy = setTimeout(() => registra(false), 700); } else registra(true); }
    return r;
  };
  document.addEventListener('input', (e) => { const t = e.target; if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(checkbox|radio|range|file|color)$/.test(t.type)))) digitou = Date.now(); }, true);
  // aviso mostrado logo depois de uma ação: ganha o botão Desfazer sozinho
  const toast0 = M.toast;
  M.toast = function (msg, undo) {
    const e = pend;
    if (e && !e.avisado && !/^⚠️/.test(String(msg))) {
      e.avisado = true;
      // a tela já tinha o seu desfazer: ele roda e o histórico completa o que ele não cobre (ex.: a próxima tarefa repetida que nasceu junto)
      if (undo) { const u = undo; undo = () => { silencio(u); aplica(e, true); e.desfeito = true; e.seq = Date.now(); guarda(); M.save(); if (M.render) M.render(); }; }
      else if (!e.recs.every((r) => r.t === 'add') || e.recs.length === 1) undo = () => desfazer(e.id, true);
    }
    return toast0.call(this, msg, undo);
  };

  // ----- janela do histórico -----
  const quando = (at) => { const s = (Date.now() - at) / 1000; return s < 50 ? 'agora há pouco' : s < 3300 ? `há ${Math.max(1, Math.round(s / 60))} min` : 'às ' + new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  function desenha() {
    const b = $('#overlay .hist'); if (!b) return;
    b.querySelector('.hist-lista').innerHTML = H.length ? H.map((e) => `<div class="hist-row ${e.desfeito ? 'off' : ''}"><span class="em">${esc(e.em)}</span><div class="tx"><b>${esc(e.txt)}</b><small>${quando(e.at)}${e.desfeito ? ' · desfeito' : ''}</small></div>
      <button type="button" class="btn sm ${e.desfeito ? 'ghost' : ''}" data-h="${e.id}">${e.desfeito ? '↪ Refazer' : '↩ Desfazer'}</button></div>`).join('')
      : '<div class="empty" style="padding:26px 10px"><div class="big">🕘</div><h3>Nada por aqui ainda</h3><p>Crie, altere ou apague alguma coisa e a ação aparece nesta lista, com o botão de desfazer.</p></div>';
  }
  function abrir() {
    if (lazy) registra(false);
    const m = M.modal(`<div class="modal-h"><h2>🕘 Histórico de ações</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b hist"><p class="hist-dica">O que você fez desde que abriu o MyLoot nesta aba. <b>Desfazer</b> volta aquela ação; ela continua na lista e dá para <b>refazer</b>. <kbd>Ctrl</kbd> + <kbd>Z</kbd> desfaz a última.</p>
      <div class="hist-lista"></div>
      <div class="row hist-pe"><button type="button" class="btn ghost sm" id="hLix" style="flex:none">🗑️ Abrir a Lixeira</button><span style="flex:1"></span><small>Fechar o MyLoot limpa esta lista. A Lixeira continua guardando o que foi apagado.</small></div></div>`);
    desenha();
    $('#x', m).onclick = M.closeModal;
    $('#hLix', m).onclick = () => { M.closeModal(); M.go('trash'); };
    m.onclick = (ev) => { const b = ev.target.closest('[data-h]'); if (!b) return; const e = H.find((x) => x.id === b.dataset.h); if (e) (e.desfeito ? refazer : desfazer)(e.id); };
  }
  M.hist = { abrir, desfazer, refazer, silencio, lista: () => H, ultimo: () => H.find((e) => !e.desfeito) };

  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#histBtn,[data-hist]')) abrir(); });
  // Ctrl+Z desfaz a última ação; Ctrl+Y (ou Ctrl+Shift+Z) refaz. Dentro de um campo de texto vale o desfazer do próprio campo.
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
    const t = e.target || {};
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable || (M.modalOpen() && !$('#overlay .hist'))) return;
    if (lazy) registra(false);
    // refazer pega a ação desfeita por último, para voltar na ordem certa
    const re = k === 'y' || e.shiftKey, alvo = re ? H.filter((x) => x.desfeito).sort((a, b) => (b.seq || 0) - (a.seq || 0))[0] : H.find((x) => !x.desfeito);
    e.preventDefault();
    if (!alvo) return toast0.call(M, re ? '↪ Nada para refazer.' : '↩ Nada para desfazer.');
    (re ? refazer : desfazer)(alvo.id);
  });
})();
