// Opções que a pessoa personaliza (v2.20.0): status dos itens, prioridades das tarefas, categorias e formas de pagamento
// do Financeiro e grupos de "Minhas ferramentas". Cada uma é uma lista de primeiro nível no banco (db.itemStatus,
// db.taskPrios, db.finCats, db.finFormas, db.toolGroups), então entra na sincronia entre aparelhos e no desfazer.
// Mesma receita das colunas do funil (clientes.js). Os padrão têm id fixo, iguais aos do servidor (server.js).
(function () {
  const { esc, $ } = M;
  const CORES = ['#ffbe46', '#3cffaa', '#3ad7ff', '#9aa3c9', '#ff7e00', '#ff5c8a', '#b388ff', '#7cd34b', '#ffe066', '#5c7cfa', '#ff486e'];
  const fc = (L) => L.map((o, i) => Object.assign({ ord: i, updated: 0 }, o));
  const PADRAO = {
    itemStatus: fc([{ id: 'ver', name: 'Para ver', em: '👀', color: '#ffbe46' }, { id: 'and', name: 'Em andamento', em: '⛏️', color: '#3ad7ff' }, { id: 'ok', name: 'Concluído', em: '✅', color: '#3cffaa' }]),
    taskPrios: fc([{ id: 'alta', name: 'Alta', em: '🔴', color: '#ff486e' }, { id: 'media', name: 'Média', em: '🟡', color: '#ffbe46' }, { id: 'baixa', name: 'Baixa', em: '🔵', color: '#3ad7ff' }]),
    finCats: fc([
      ['fe-servico', 'entrada', 'Serviço / cliente', '🤝'], ['fe-venda', 'entrada', 'Venda de produto', '🛍️'], ['fe-comissao', 'entrada', 'Comissão / parceria', '🤜'],
      ['fe-rend', 'entrada', 'Rendimento', '📈'], ['fe-outros', 'entrada', 'Outros', '➕'],
      ['fs-ferr', 'saida', 'Ferramentas e assinaturas', '🧰'], ['fs-imp', 'saida', 'Impostos e taxas', '🏛️'], ['fs-ads', 'saida', 'Anúncios e marketing', '📣'],
      ['fs-equip', 'saida', 'Equipamentos', '💻'], ['fs-pro', 'saida', 'Pró-labore / salário', '👤'], ['fs-equipe', 'saida', 'Equipe e freelas', '👥'],
      ['fs-casa', 'saida', 'Casa e contas', '🏠'], ['fs-alim', 'saida', 'Alimentação', '🍽️'], ['fs-transp', 'saida', 'Transporte', '🚗'], ['fs-outros', 'saida', 'Outros', '➖'],
    ].map(([id, tipo, name, em]) => ({ id, tipo, name, em, color: tipo === 'entrada' ? '#3cffaa' : '#ff7e00' }))),
    finFormas: fc([['fp-pix', 'PIX', '⚡'], ['fp-cartao', 'Cartão', '💳'], ['fp-boleto', 'Boleto', '🧾'], ['fp-transf', 'Transferência', '🏦'], ['fp-dinheiro', 'Dinheiro', '💵']].map(([id, name, em]) => ({ id, name, em, color: '#9aa3c9' }))),
    toolGroups: [], taskLists: [], cliCampos: [],
    itemTypes: fc([['estudo', 'Estudo / PDF', '📚', '#3ad7ff'], ['prompt', 'Prompt', '✨', '#a78bfa'], ['instrucao', 'Instrução', '📜', '#ffbe46'],
      ['comando', 'Comando', '⌨️', '#3cffaa'], ['link', 'Link', '🔗', '#ff7ac6'], ['nota', 'Nota', '📝', '#ff9d4a']].map(([id, name, em, color]) => ({ id, name, em, color, oculto: false }))),
  };

  // como cada lista se liga ao resto: o que usa a opção, como trocar por outra e o texto das janelas
  const fin = () => M.db.fin || [];
  const DEF = {
    itemStatus: { t: 'Status dos itens', um: 'status', em: '🏷️', min: 1, dica: 'Os status aparecem na ficha do item, nos filtros e no quadro da Biblioteca. Ex.: Ideia, Gravando, Publicado.',
      usa: (o) => M.db.items.filter((i) => stDe(i.status) === o.id), troca: (L, p) => L.forEach((i) => { i.status = p; i.updated = Date.now(); }), onde: 'itens' },
    taskPrios: { t: 'Prioridades das tarefas', um: 'prioridade', em: '🚦', min: 1, dica: 'A primeira da lista é a mais importante: tarefas com ela aparecem primeiro. Clicar na etiqueta da tarefa passa para a próxima.',
      usa: (o) => M.db.tasks.filter((t) => M.prio(t.prio).id === o.id), troca: (L, p) => L.forEach((t) => { t.prio = p; }), onde: 'tarefas' },
    finCats: { t: 'Categorias do Financeiro', um: 'categoria', em: '🧾', min: 1, tipo: true, porNome: 'cat', dica: 'Aparecem ao lançar uma entrada ou saída e no quadro “Para onde foi o dinheiro”. Renomear muda também os lançamentos que já usam a categoria.',
      usa: (o) => fin().filter((f) => f.tipo === o.tipo && f.cat === o.name), troca: (L, p) => L.forEach((f) => { f.cat = p; }), onde: 'lançamentos' },
    finFormas: { t: 'Formas de pagamento', um: 'forma de pagamento', em: '💳', min: 1, porNome: 'forma', dica: 'Ex.: PIX, Cartão Nubank, Boleto. Renomear muda também os lançamentos que já usam a forma.',
      usa: (o) => fin().filter((f) => f.forma === o.name), troca: (L, p) => L.forEach((f) => { f.forma = p; }), onde: 'lançamentos' },
    toolGroups: { t: 'Meus grupos de ferramentas', um: 'grupo', em: '🧰', min: 0, dica: 'Grupos seus para organizar “Minhas ferramentas”, além dos grupos das recomendadas.',
      usa: (o) => (M.db.tools || []).filter((f) => f.g === o.id), troca: (L, p) => L.forEach((f) => { f.g = p; }), onde: 'ferramentas',
      destinos: (o) => (M.toolGruposTodos ? M.toolGruposTodos() : []).filter((g) => g.id !== o.id).map((g) => ({ k: g.id, t: new DOMParser().parseFromString(`${g.em} ${g.nome}`, 'text/html').body.textContent })) }, // nome já vem escapado de ferramentas.js
  };

  DEF.itemTypes = { t: 'Tipos de item', um: 'tipo', em: '🧱', min: 6, fixos: true, limpa: true, dica: 'Os 6 tipos da Biblioteca. Mude o nome, o emoji, a cor e a ordem, ou esconda os que não usa (os itens continuam lá). O jeito de cada um funcionar não muda: Link abre o site, Prompt tem o botão de copiar.',
    usa: (o) => M.db.items.filter((i) => i.type === o.id), troca: () => {}, onde: 'itens' };
  DEF.taskLists = { t: 'Listas de tarefas', um: 'lista', em: '🗂️', min: 0, dica: 'Separe as tarefas por projeto ou área (ex.: Casa, Trabalho, Cliente X). A tela de Tarefas filtra por lista e pode agrupar por lista.',
    usa: (o) => M.db.tasks.filter((t) => t.lista === o.id), troca: (L, p) => L.forEach((t) => { t.lista = p === '_sem' ? '' : p; }), onde: 'tarefas',
    destinos: (o) => M.opc('taskLists').filter((x) => x.id !== o.id).map((x) => ({ k: x.id, t: `${x.em} ${x.name}` })).concat({ k: '_sem', t: '📥 Sem lista' }) };
  const CAMPO_TIPOS = [['texto', '🔤 Texto'], ['numero', '🔢 Número'], ['data', '📅 Data'], ['link', '🔗 Link']];
  M.CLI_FIXOS = [['empresa', 'Empresa / marca'], ['whats', 'WhatsApp'], ['email', 'E-mail'], ['insta', 'Instagram'], ['site', 'Site'], ['trello', 'Quadro do Trello'], ['pasta', 'Pasta do cliente']];
  DEF.cliCampos = { t: 'Campos da ficha do cliente', um: 'campo', em: '🪪', min: 0, tipoCampo: CAMPO_TIPOS, dica: 'Campos seus na ficha do cliente (ex.: CNPJ, Aniversário, Valor do contrato, Link do contrato). E esconda os campos que vêm prontos e você não usa.',
    usa: (o) => (M.db.clients || []).filter((c) => c.extra && c.extra[o.id]), troca: () => {}, onde: 'clientes com valor',
    rodape: () => { const oc = M.db.settings.cliOcultos || []; return `<h4 class="opc-h">Campos que já vêm na ficha</h4><div class="w-chk" id="opcFixos">${M.CLI_FIXOS.map(([k, n]) => `<label><input type="checkbox" data-fixo="${k}" ${oc.includes(k) ? '' : 'checked'}> ${n}</label>`).join('')}</div>`; },
    liga: (m) => { const b = m.querySelector('#opcFixos'); if (b) b.onchange = () => { M.db.settings.cliOcultos = [...b.querySelectorAll('[data-fixo]')].filter((x) => !x.checked).map((x) => x.dataset.fixo); M.save(); }; } };
  M.opc = (k) => {
    if (!M.db) return PADRAO[k].slice();
    if (!Array.isArray(M.db[k]) || (!M.db[k].length && PADRAO[k].length)) M.db[k] = PADRAO[k].map((o) => Object.assign({}, o));
    return M.db[k].slice().sort((a, b) => (a.ord || 0) - (b.ord || 0));
  };
  const stDe = (id) => { const L = M.opc('itemStatus'); return (L.find((s) => s.id === id) || L[0]).id; };
  // tipos de item: M.TYPES são os visíveis (na ordem da pessoa); M.TYPES_TODOS inclui os escondidos; M.type(id) acha em todos
  Object.defineProperty(M, 'TYPES_TODOS', { get: () => { const L = M.opc('itemTypes'); PADRAO.itemTypes.forEach((p) => { if (!L.some((x) => x.id === p.id)) L.push(Object.assign({}, p)); }); return L; }, configurable: true });
  Object.defineProperty(M, 'TYPES', { get: () => M.TYPES_TODOS.filter((t) => !t.oculto), configurable: true });
  M.type = (id) => { const L = M.TYPES_TODOS; return L.find((t) => t.id === id) || L.find((t) => t.id === 'nota') || L[0]; };
  Object.defineProperty(M, 'STATUS', { get: () => M.opc('itemStatus'), configurable: true });
  M.statusDe = (id) => { const L = M.opc('itemStatus'); return L.find((s) => s.id === id) || L[0]; };
  // prioridades: M.PRIOS são os ids em ordem (a primeira é a mais importante); M.prio(id) devolve a opção (ou a do meio)
  Object.defineProperty(M, 'PRIOS', { get: () => M.opc('taskPrios').map((p) => p.id), configurable: true });
  M.prio = (id) => { const L = M.opc('taskPrios'); return L.find((p) => p.id === id) || L.find((p) => p.id === 'media') || L[Math.floor((L.length - 1) / 2)]; };
  M.prioOrdem = (id) => M.opc('taskPrios').indexOf(M.prio(id));
  M.proxPrio = (id) => { const L = M.PRIOS, i = L.indexOf(M.prio(id).id); return L[(i + 1) % L.length]; };
  M.prioHTML = (t) => { const p = M.prio(t.prio); return `<span class="prio" data-a="prio" style="--pc:${esc(p.color)}" title="Prioridade ${esc(p.name)}. Clique para mudar.">${esc(p.name.toLowerCase())}</span>`; };
  Object.defineProperty(M, 'FIN_CAT', { get: () => { const L = M.opc('finCats'); return { entrada: L.filter((c) => c.tipo !== 'saida').map((c) => c.name), saida: L.filter((c) => c.tipo === 'saida').map((c) => c.name) }; }, configurable: true });
  Object.defineProperty(M, 'FORMAS', { get: () => M.opc('finFormas').map((f) => f.name), configurable: true });
  const reordena = (L) => L.forEach((s, i) => { if (s.ord !== i) { s.ord = i; s.updated = Date.now(); } });

  // ----- janela que lista e organiza as opções -----
  M.opcGerenciar = (k, depois) => {
    const d = DEF[k], todas = M.opc(k);
    const grupos = d.tipo ? [['entrada', '⬇️ Entradas'], ['saida', '⬆️ Saídas']] : [['', '']];
    const linha = (o, L) => { const i = L.indexOf(o), n = d.usa(o).length; return `<div class="opc-row" data-o="${esc(o.id)}" style="--c:${esc(o.color)}"><span class="opc-cor"></span><span class="opc-nm">${esc(o.em)} ${esc(o.name)}</span>${d.tipoCampo ? `<small>${esc((d.tipoCampo.find((x) => x[0] === o.tipo) || d.tipoCampo[0])[1])}</small>` : ''}${n ? `<small>${n} ${d.onde}</small>` : ''}
      <button type="button" class="icon-btn sm" data-a="up" ${i ? '' : 'disabled'} title="Subir" aria-label="Subir ${esc(o.name)}">↑</button><button type="button" class="icon-btn sm" data-a="down" ${i < L.length - 1 ? '' : 'disabled'} title="Descer" aria-label="Descer ${esc(o.name)}">↓</button>
      <button type="button" class="icon-btn sm" data-a="ed" title="Editar" aria-label="Editar ${esc(o.name)}">✏️</button>${d.fixos ? `<button type="button" class="icon-btn sm" data-a="ver" title="${o.oculto ? 'Mostrar' : 'Esconder'}" aria-label="${o.oculto ? 'Mostrar' : 'Esconder'} ${esc(o.name)}">${o.oculto ? '👁' : '🙈'}</button>` : `<button type="button" class="icon-btn sm" data-a="del" title="Apagar" aria-label="Apagar ${esc(o.name)}">🗑️</button>`}</div>`; };
    const m = M.modal(`<div class="modal-h"><h2>${d.em} ${esc(d.t)}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b"><p class="opc-dica">${esc(d.dica)}</p>
        ${grupos.map(([tp, nm]) => { const L = todas.filter((o) => !d.tipo || (o.tipo === 'saida') === (tp === 'saida')); return `${nm ? `<h4 class="opc-h">${nm}</h4>` : ''}<div class="opc-lista">${L.map((o) => linha(o, L)).join('') || '<small style="color:var(--faint)">Nenhum ainda.</small>'}</div>
          ${d.fixos ? '' : `<button type="button" class="btn ghost sm opc-novo" data-novo="${tp}">＋ ${d.tipo ? 'Nova categoria de ' + (tp === 'saida' ? 'saída' : 'entrada') : 'Adicionar ' + d.um}</button>`}`; }).join('')}
        ${d.rodape ? d.rodape() : ''}
        <div class="row" style="justify-content:space-between;margin-top:6px">${PADRAO[k].length ? '<button type="button" class="btn ghost sm" id="opcPad" style="flex:none">↺ Voltar ao padrão</button>' : '<span></span>'}<button class="btn" id="opcOk" style="flex:none">✔ Pronto</button></div>
      </div>`, { small: true });
    const volta = () => { M.render(); M.opcGerenciar(k, depois); };
    const fecha = () => { M.closeModal(); M.render(); if (depois) depois(); };
    $('#x', m).onclick = fecha; $('#opcOk', m).onclick = fecha;
    if (d.liga) d.liga(m);
    if ($('#opcPad', m)) $('#opcPad', m).onclick = async () => {
      if (!(await M.confirm(`Voltar ${d.t.toLowerCase()} ao padrão do MyLoot? As que você criou somem da lista (o que usava uma delas passa para a primeira). Dá para desfazer.`, '↺ Voltar ao padrão'))) return volta();
      M.db[k] = PADRAO[k].map((o) => Object.assign({}, o, { updated: Date.now() }));
      M.save(); SFX.play('undo'); M.toast(`↺ ${d.t} no padrão`); volta();
    };
    m.querySelectorAll('[data-novo]').forEach((b) => { b.onclick = () => M.opcEditar(k, null, { tipo: b.dataset.novo || undefined, depois: volta }); });
    m.querySelector('.modal-b').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'), r = e.target.closest('[data-o]'); if (!b || !r) return;
      const o = M.db[k].find((x) => x.id === r.dataset.o); if (!o) return;
      const L = M.opc(k).filter((x) => !d.tipo || (x.tipo === 'saida') === (o.tipo === 'saida'));
      if (b.dataset.a === 'ed') return M.opcEditar(k, o, { depois: volta });
      if (b.dataset.a === 'del') return M.opcApagar(k, o, volta);
      if (b.dataset.a === 'ver') { if (!o.oculto && M.opc(k).filter((x) => !x.oculto).length < 2) { M.toast('⚠️ Deixe pelo menos um visível'); return volta(); } o.oculto = !o.oculto; o.updated = Date.now(); M.save(); SFX.play('click'); return volta(); }
      const i = L.indexOf(o), j = i + (b.dataset.a === 'up' ? -1 : 1); if (j < 0 || j >= L.length) return;
      // a troca de lugar vale na lista inteira (nas categorias, entradas e saídas dividem a mesma ordem)
      const T = M.opc(k), a = T.indexOf(L[i]), c = T.indexOf(L[j]); [T[a], T[c]] = [T[c], T[a]]; reordena(T);
      M.save(); SFX.play('drop'); volta();
    });
  };

  // ----- criar ou editar uma opção -----
  M.opcEditar = (k, o, op) => {
    op = op || {};
    const d = DEF[k], nova = !o, L = M.opc(k);
    const s = o || { em: '📌', name: '', color: CORES[L.length % CORES.length], tipo: d.tipoCampo ? 'texto' : op.tipo || 'entrada' };
    const m = M.modal(`<div class="modal-h"><h2>${nova ? '＋ ' + (d.tipo ? 'Nova categoria' : 'Adicionar ' + d.um) : '✏️ Editar ' + d.um}</h2><button class="icon-btn" id="x" aria-label="Fechar">✕</button></div>
      <div class="modal-b">
        <div class="row"><div class="fld" style="flex:none;width:84px"><label for="opEm">Emoji</label><input id="opEm" type="text" maxlength="8" value="${esc(s.em || '')}" style="text-align:center;font-size:18px"></div>
          <div class="fld" style="flex:1"><label for="opNm">Nome</label><input id="opNm" type="text" maxlength="40" value="${esc(s.name)}" placeholder="Escreva o nome"></div></div>
        ${d.tipo && nova ? `<div class="fld"><label>Vale para</label><div class="seg" id="opTp"><button type="button" data-t="entrada" class="${s.tipo !== 'saida' ? 'on' : ''}">⬇️ Entradas</button><button type="button" data-t="saida" class="${s.tipo === 'saida' ? 'on' : ''}">⬆️ Saídas</button></div></div>` : ''}
        ${d.tipoCampo ? `<div class="fld"><label for="opTc">Tipo de campo</label><select id="opTc">${d.tipoCampo.map(([v, n]) => `<option value="${v}" ${v === (s.tipo || 'texto') ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}
        <div class="fld"><label>Cor</label><div class="col-cores" id="opCor">${CORES.map((c) => `<button type="button" class="col-cor ${c === s.color ? 'on' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}<input type="color" id="opCorL" value="${esc(s.color)}" title="Outra cor"></div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="opCn" style="flex:none">Cancelar</button><button class="btn" id="opOk" style="flex:none">${nova ? '＋ Adicionar' : '✔ Salvar'}</button></div>
      </div>`, { small: true });
    let cor = s.color, tipo = s.tipo;
    const pinta = () => m.querySelectorAll('.col-cor').forEach((b) => b.classList.toggle('on', b.dataset.cor === cor));
    $('#opCor', m).onclick = (e) => { const b = e.target.closest('[data-cor]'); if (!b) return; cor = b.dataset.cor; $('#opCorL', m).value = cor; pinta(); };
    $('#opCorL', m).oninput = (e) => { cor = e.target.value; pinta(); };
    if ($('#opTp', m)) $('#opTp', m).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; m.querySelectorAll('#opTp button').forEach((x) => x.classList.toggle('on', x === b)); };
    const sai = () => { M.closeModal(); if (op.depois) op.depois(); else M.render(); };
    $('#x', m).onclick = sai; $('#opCn', m).onclick = sai;
    $('#opOk', m).onclick = () => {
      const nm = $('#opNm', m).value.trim().slice(0, 40); if (!nm) return M.falta($('#opNm', m), '✍️ Escreva o nome');
      const em = $('#opEm', m).value.trim().replace(/[<>"'&]/g, '').slice(0, 8);
      const nmL = d.limpa ? nm.replace(/[<>"'&]/g, '') : nm; if (!nmL) return M.falta($('#opNm', m), '✍️ Escreva o nome');
      // nas listas guardadas pelo nome (categorias e formas), dois com o mesmo nome se confundiriam
      if (d.porNome && L.some((x) => x !== o && x.name.toLowerCase() === nm.toLowerCase() && (!d.tipo || (x.tipo === 'saida') === ((o ? o.tipo : tipo) === 'saida')))) return M.falta($('#opNm', m), '⚠️ Já existe uma com esse nome');
      if (nova) {
        const x = { id: k.slice(0, 3) + M.uid(), name: nm, em, color: cor, ord: L.length, updated: Date.now() };
        if (d.tipo) x.tipo = tipo === 'saida' ? 'saida' : 'entrada';
        if (d.tipoCampo) x.tipo = $('#opTc', m).value;
        M.db[k] = M.opc(k).concat(x);
        if (op.criou) op.criou(x);
      } else {
        if (d.porNome && o.name !== nm) { const usam = d.usa(o); d.troca(usam, nm); }
        Object.assign(o, { name: nmL, em, color: cor, updated: Date.now() });
        if (d.tipoCampo) o.tipo = $('#opTc', m).value;
      }
      M.save(); SFX.play('done'); M.toast(nova ? `${em} “${nm}” adicionad${d.um === 'status' || d.um === 'grupo' ? 'o' : 'a'}` : '✅ Salvo');
      sai();
    };
    $('#opNm', m).onkeydown = (e) => { if (e.key === 'Enter') $('#opOk', m).click(); };
    setTimeout(() => $('#opNm', m).focus(), 0);
  };

  // ----- apagar: se alguma coisa usa a opção, pergunta para qual ela vai -----
  M.opcApagar = async (k, o, depois) => {
    const d = DEF[k], todas = M.opc(k), mesmas = todas.filter((x) => !d.tipo || (x.tipo === 'saida') === (o.tipo === 'saida'));
    const fim = () => { if (depois) depois(); else M.render(); };
    if (mesmas.length <= d.min) { M.toast(`⚠️ Precisa ficar pelo menos ${d.min === 1 ? 'uma' : d.min} na lista`); return fim(); }
    const usam = d.usa(o);
    const outros = d.destinos ? d.destinos(o) : mesmas.filter((x) => x !== o).map((x) => ({ k: d.porNome ? x.name : x.id, t: `${x.em} ${x.name}` }));
    if (usam.length) {
      if (!outros.length) { M.toast('⚠️ Crie outra antes de apagar esta'); return fim(); }
      const destino = await M.escolha(`${usam.length} ${d.onde} usa${usam.length > 1 ? 'm' : ''} “${o.name}”. Para qual ${usam.length > 1 ? 'eles vão' : 'vai'}?`, outros, `Apagar “${o.name}”`);
      if (!destino) return fim();
      d.troca(usam, destino);
    } else if (!(await M.confirm(`Apagar “${o.name}”?`, '🗑️ Apagar'))) return fim();
    M.db[k] = M.db[k].filter((x) => x !== o); reordena(M.opc(k));
    M.save(); SFX.play('trash'); M.toast(`🗑️ “${o.name}” apagad${d.um === 'status' || d.um === 'grupo' ? 'o' : 'a'}`); fim();
  };

  // botão pequeno ⚙️ que abre a janela de uma lista (usado ao lado dos seletores)
  M.opcBtn = (k, txt) => `<button type="button" class="btn ghost sm opc-btn" data-opc="${k}" title="Criar, renomear, reordenar ou apagar" aria-label="Personalizar ${esc(DEF[k].t)}">⚙️${txt ? ' ' + esc(txt) : ''}</button>`;
  // ouvinte único: qualquer [data-opc] fora de janela abre a lista certa
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-opc]'); if (!b || b.closest('#overlay')) return;
    e.preventDefault(); e.stopPropagation(); M.opcGerenciar(b.dataset.opc);
  }, true);
  M.OPC_DEF = DEF;
})();
