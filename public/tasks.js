// Tarefas, compromissos e calendário mensal.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};

  const PRIO_DICA = 'Alta: urgente, aparece primeiro e em vermelho. Média: o normal. Baixa: pode esperar. Dá para mudar depois clicando na etiqueta da tarefa.';
  const TIPO_DICA = 'Tarefa: algo para fazer e marcar como feito. Compromisso: tem dia e hora para acontecer (reunião, consulta, aula). Quando o horário passa, ele sai das pendentes sem virar atrasado e continua no calendário.';
  const FIM_DICA = 'Opcional. Tem que ser depois do início. Sem fim, o MyLoot considera 1 hora de duração.';
  const TIPOS = [['t', '✅ Tarefa'], ['e', '📅 Compromisso']];
  const tipoHTML = (id) => `<div class="seg tipo-seg" id="${id}">${TIPOS.map(([k, n]) => `<button type="button" data-k="${k}">${n}</button>`).join('')}</div>`;

  // data e hora escritas em qualquer parte da frase: "Ligar para o contador amanhã às 9h", "reunião sexta 14:30",
  // "pagar aluguel dia 10", "entregar 20/11". O que foi entendido sai do título.
  const DSEM = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  M.parseTask = (raw) => {
    let text = ' ' + String(raw || '').trim() + ' ', date = '', hora = '';
    const tira = (m) => { text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length); };
    const hoje = M.today(), [hy, hm, hd] = hoje.split('-').map(Number);
    let m;
    // dia: depois de amanhã, amanhã, hoje, dia da semana, 20/11, "dia 10"
    if ((m = /\s(depois de amanh[ãa]|amanh[ãa]|hoje)(?=[\s,.!?])/i.exec(text))) {
      const w = M.norm(m[1]); date = w === 'hoje' ? hoje : w === 'amanha' ? M.addDays(hoje, 1) : M.addDays(hoje, 2); tira(m);
    } else if ((m = /\s(?:(?:na|nesta|nessa|pr[óo]xima)\s+)?(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?(?=[\s,.!?])/i.exec(text))) {
      const alvo = DSEM[M.norm(m[1])], hojeD = new Date(hy, hm - 1, hd).getDay();
      date = M.addDays(hoje, ((alvo - hojeD + 7) % 7) || 7); tira(m);
    } else if ((m = /\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.!?])/.exec(text))) {
      const d = +m[1], mes = +m[2]; let y = m[3] ? +m[3] : hy; if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12) {
        let ds = `${y}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!m[3] && ds < hoje) ds = `${y + 1}-${ds.slice(5)}`;
        date = ds; tira(m);
      }
    } else if ((m = /\s(?:no\s+)?dia\s+(\d{1,2})(?=[\s,.!?])/i.exec(text))) {
      const d = +m[1];
      if (d >= 1 && d <= 31) {
        let y = hy, mes = hm; if (d < hd) { mes++; if (mes > 12) { mes = 1; y++; } }
        const fim = new Date(y, mes, 0).getDate();
        date = `${y}-${String(mes).padStart(2, '0')}-${String(Math.min(d, fim)).padStart(2, '0')}`; tira(m);
      }
    }
    // hora: 9h, 9h30, 14:30, "às 9", "7 horas"
    if ((m = /\s(?:(?:[àáa]s?|ao)\s+)?(\d{1,2})(?:(?:h|:)(\d{2})|h(?:oras?|rs?)?|\s+horas?)(?=[\s,.!?])/i.exec(text)) || (m = /\s(?:[àáa]s)\s+(\d{1,2})(?=[\s,.!?])/i.exec(text))) {
      const h = +m[1], mi = m[2] ? +m[2] : 0;
      if (h <= 23 && mi <= 59) { hora = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; tira(m); }
    }
    text = text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/[\s,]+(às|as|de|no|na|para|pra)\s*$/i, '').trim();
    if (!text) text = String(raw || '').trim(); // a frase era só a data ("amanhã"): fica como título
    return { text, date, hora };
  };

  M.addTask = (raw, date, prio) => {
    const p = M.parseTask(raw);
    if (!p.text) return null;
    const t = { id: M.uid(), text: p.text, date: p.date || date || '', prio: prio || 'media', done: false, created: Date.now() };
    if (p.hora) { t.hora = p.hora; if (!t.date) t.date = M.today(); } // lembrete precisa de um dia
    M.db.tasks.push(t); M.save(); SFX.play('pop');
    return t;
  };

  // ----- compromissos -----
  // Compromisso é uma tarefa com ev: true, hora (início) e timeEnd (fim, opcional). Ele não se conclui:
  // quando o horário passa, sai das pendentes sem virar "Atrasada" e continua no dia do calendário.
  const HM = /^\d\d:\d\d$/, p2 = (n) => String(n).padStart(2, '0');
  const agoraHM = () => { const d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  // sem fim marcado, o compromisso vale por 1 hora (no máximo até o fim do dia)
  const fimDe = (t) => { if (HM.test(t.timeEnd || '')) return t.timeEnd; if (!HM.test(t.hora || '')) return '23:59'; const [h, m] = t.hora.split(':').map(Number); return h >= 23 ? '23:59' : p2(h + 1) + ':' + p2(m); };
  M.evPassou = (t) => { if (!t.ev || !t.date) return false; const hoje = M.today(); return t.date < hoje || (t.date === hoje && fimDe(t) <= agoraHM()); };
  // o que ainda conta como "a fazer": não concluída e que não é compromisso já passado (as outras telas contam por aqui)
  M.tarefaPendente = (t) => !t.done && !M.evPassou(t);
  M.faixaHora = (t) => (t.hora || '') + (t.ev && t.hora && t.timeEnd ? '–' + t.timeEnd : '');
  // confere os campos de um compromisso; devolve true se pode gravar
  const evValido = (elData, temData, elIni, elFim) => {
    if (!temData) { M.falta(elData, '📅 Escolha o dia do compromisso'); return false; }
    if (!elIni.value) { M.falta(elIni, '🕘 Diga a que horas começa'); return false; }
    if (elFim.value && elFim.value <= elIni.value) { M.falta(elFim, '🏁 O fim precisa ser depois do início'); return false; }
    return true;
  };
  const evAviso = (t) => (M.evPassou(t) ? '📅 Compromisso guardado no calendário (esse horário já passou)' : '📅 Compromisso marcado');

  // ----- tarefas que repetem: ao concluir (ou pular), a tarefa vai para a próxima data -----
  M.REP = [['', 'Não repete'], ['dia', 'Todo dia'], ['uteis', 'Dias úteis (seg a sex)'], ['dias', 'Dias que eu escolher'], ['semana', 'Toda semana'], ['mes', 'Todo mês']];
  const REP_CURTO = { dia: 'todo dia', uteis: 'dias úteis', semana: 'toda semana', mes: 'todo mês' };
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dowDe = (k) => new Date(k + 'T12:00:00').getDay();
  const diaDe = (k) => +String(k || '').slice(8, 10) || 0; // dia do mês de uma data "aaaa-mm-dd"
  const dm = (k) => k.slice(8, 10) + '/' + k.slice(5, 7); // data curta, para os selos da linha
  const diasTx = (t, sep) => (t.repDias || []).slice().sort().map((i) => DOW[i]).join(sep);
  // próximo dia (depois de "base", ou o próprio se "inclusive") que cai num dos dias da semana escolhidos
  const proxDia = (base, dias, inclusive) => {
    if (!dias || !dias.length) return M.addDays(base, 7);
    let n = inclusive ? base : M.addDays(base, 1);
    for (let k = 0; k < 7 && !dias.includes(dowDe(n)); k++) n = M.addDays(n, 1);
    return n;
  };
  const diaMes = (t) => t.repDia || diaDe(t.date);
  M.repNome = (t) => t.rep === 'dias' ? 'Toda ' + diasTx(t, ', ') : t.rep === 'mes' && diaMes(t) ? 'Todo mês, no dia ' + diaMes(t) : ((M.REP.find((r) => r[0] === t.rep) || [])[1] || '');
  const diasHTML = (id, sel, hidden) => `<div class="tn-data rep-dias" id="${id}" ${hidden ? 'hidden' : ''} title="Em quais dias da semana a tarefa volta">${DOW.map((n, i) => `<button type="button" class="chip-b ${sel.includes(i) ? 'on' : ''}" data-i="${i}">${n}</button>`).join('')}</div>`;
  const ligaDias = (box, sel) => { box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i); b.classList.toggle('on', sel.includes(i)); SFX.play('click'); }; };
  // "noDia" é o dia do mês em que a repetição mensal nasceu (repDia): depois de um mês curto, ela volta para ele.
  // Sem ele (tarefa antiga), vale o dia da própria data, como antes.
  M.proximaData = (d, rep, dias, noDia) => {
    const base = d || M.today();
    if (rep === 'dias') return proxDia(base, dias);
    if (rep === 'dia') return M.addDays(base, 1);
    if (rep === 'semana') return M.addDays(base, 7);
    if (rep === 'uteis') { let n = M.addDays(base, 1); while ([0, 6].includes(new Date(n + 'T12:00:00').getDay())) n = M.addDays(n, 1); return n; }
    if (rep === 'mes') { const [y, m, dd] = base.split('-').map(Number); const fim = new Date(y, m + 1, 0).getDate(); return M.ymd(new Date(y, m, Math.min(noDia || dd, fim))); }
    return '';
  };
  const proxDe = (t) => M.proximaData(t.date, t.rep, t.repDias, t.repDia);
  // para onde a tarefa vai ao pular: a próxima data da repetição que ainda não passou
  const proxPulo = (t) => { const hoje = M.today(); let d = proxDe(t); for (let k = 0; k < 4000 && d && d < hoje; k++) d = M.proximaData(d, t.rep, t.repDias, t.repDia); return d; };
  // repetição mensal guarda o dia em que nasceu. "manter" = a pessoa não mexeu na data: o dia guardado fica como está
  const fixaRepDia = (t, manter) => { if (t.rep === 'mes' && t.date) { if (!manter || !t.repDia) t.repDia = diaDe(t.date); } else delete t.repDia; };

  M.toggleTask = (t, ev) => {
    if (t.ev) return; // compromisso não se conclui
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    // reabriu pela caixinha: a próxima que tinha nascido (e ainda não foi mexida) sai, para não ficar duplicada
    if (!t.done && t.repFeita) {
      const prox = t.repProx && M.db.tasks.find((x) => x.id === t.repProx && !x.done);
      if (prox) M.db.tasks = M.db.tasks.filter((x) => x !== prox);
      t.repFeita = false; delete t.repProx;
    }
    if (t.done && t.rep && !t.repFeita) {
      t.repFeita = true;
      if (t.rep === 'mes' && !t.repDia && t.date) t.repDia = diaDe(t.date); // tarefa antiga: passa a guardar o dia a partir de agora
      // concluída atrasada: a próxima vai para a primeira data da repetição a partir de hoje (antes nascia já atrasada)
      const nova = Object.assign({}, t, { id: M.uid(), done: false, doneAt: null, xpd: false, repFeita: false, date: proxPulo(t), created: Date.now() });
      delete nova.repProx;
      t.repProx = nova.id;
      M.db.tasks.push(nova);
      setTimeout(() => M.toast('🔁 Próxima: ' + M.fmtDate(nova.date)), 900);
    }
    if (t.done) {
      const at = ev ? { x: ev.clientX, y: ev.clientY } : null;
      if (!t.xpd) { t.xpd = true; M.award('task', at); } else { SFX.play('done'); M.save(); }
      FX.burst(at ? at.x : null, at ? at.y : null, 30, 6);
      M.toast('✅ Tarefa concluída', () => { t.done = false; t.doneAt = null; M.save(); SFX.play('undo'); M.render(); });
    } else { SFX.play('click'); M.save(); }
    M.render();
  };

  // pular esta vez: a tarefa vai para a próxima data da repetição que ainda não passou, sem contar como concluída e sem XP
  M.pularTask = (t) => {
    if (!t || !t.rep || t.done || t.ev) return;
    if (t.rep === 'mes' && !t.repDia && t.date) t.repDia = diaDe(t.date);
    const d = proxPulo(t); if (!d) return;
    t.date = d; M.save(); SFX.play('click');
    M.toast('⏭ Pulada desta vez. Volta em ' + M.fmtDate(d));
    M.render();
  };
  // o botão de pular funciona em qualquer tela que mostre a linha da tarefa (Início, Tarefas, ficha do cliente)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.task [data-a="pular"]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const t = M.db.tasks.find((x) => x.id === b.closest('.task').dataset.id); if (!t) return;
    M.pularTask(t);
    if (M.cliAberto && M.modalOpen() && M.openClient) M.openClient(M.cliAberto); // dentro da ficha do cliente, redesenha a ficha
  }, true);

  function taskHTML(t) {
    const foi = M.evPassou(t), late = !t.done && !t.ev && t.date && t.date < M.today();
    const cli = t.client && M.client ? M.client(t.client) : null;
    const prox = t.rep && !t.done && !t.ev ? proxDe(t) : '';
    const hora = !t.hora ? '' : t.ev ? `<span class="tdate tfaixa" title="Horário do compromisso${foi ? ' (já passou)' : ''}">🕘 ${esc(M.faixaHora(t))}</span>` : `<span class="tdate" title="Lembrete">⏰ ${esc(t.hora)}</span>`;
    const rep = t.rep && !t.ev ? `<span class="tdate trep" title="Repete: ${esc(M.repNome(t))}.${prox ? ' Quando você concluir, a próxima nasce em ' + M.fmtDate(prox) + '.' : ''}">🔁 ${esc(t.rep === 'dias' ? diasTx(t, ' ') : t.rep === 'mes' && diaMes(t) ? 'todo dia ' + diaMes(t) : REP_CURTO[t.rep] || '')}${prox ? ' · próxima ' + dm(prox) : ''}</span>` : '';
    const data = t.date ? `<span class="tdate" data-a="date" style="${late ? 'color:var(--red)' : ''};cursor:pointer" title="Mudar data">📅 ${M.fmtDate(t.date)}</span>` : `<span class="tdate" data-a="date" style="cursor:pointer;opacity:.6" title="Definir data">📅 —</span>`;
    const prio = t.ev ? '' : M.prioHTML(t);
    const pular = prox ? `<button type="button" class="tpula" data-a="pular" title="A tarefa vai para ${M.fmtDate(proxPulo(t))}, sem contar como concluída e sem dar XP" aria-label="Pular esta vez">⏭ Pular esta vez</button>` : '';
    const feita = t.done ? 'Reabrir a tarefa' : 'Marcar como feita';
    const marca = t.ev ? `<span class="tev" data-a="date" title="Compromisso${foi ? ' (já passou)' : ''}. Clique para editar." aria-label="Compromisso">📅</span>` : `<input type="checkbox" ${t.done ? 'checked' : ''} title="${feita}" aria-label="${feita}">`;
    return `<div class="task ${t.done ? 'done' : ''} ${t.ev ? 'ev' : ''} ${foi ? 'passou' : ''}" data-id="${t.id}">${marca}<div class="tcorpo"><span class="tx">${esc(t.text)}</span><span class="tmeta">${hora}${rep}${cli ? `<span class="tag" title="Cliente">👤 ${esc(cli.nome)}</span>` : ''}${data}${prio}${pular}</span></div><button class="xbtn" data-a="rm" title="Mandar para a lixeira" aria-label="Mandar para a lixeira">🗑️</button></div>`;
  }

  M.taskHTML = taskHTML;
  // concluídas: a tela mostra as 12 mais recentes e "Mostrar mais" traz as seguintes, de 30 em 30
  const FEITAS_1 = 12, FEITAS_MAIS = 30;
  const feitasOrd = () => M.db.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  M.pages.tasks = () => {
    const v = $('#view'), today = M.today(), u = M.ui;
    const open = M.db.tasks.filter(M.tarefaPendente);
    const srt = (a, b) => (a.date || '9').localeCompare(b.date || '9') || M.prioOrdem(a.prio) - M.prioOrdem(b.prio) || (a.hora || '99').localeCompare(b.hora || '99');
    const G = [
      ['late', '🔥 Atrasadas', open.filter((t) => t.date && t.date < today).sort(srt)],
      ['today', '🌞 Hoje', open.filter((t) => t.date === today).sort(srt)],
      ['next', '🗓️ Próximas', open.filter((t) => t.date > today).sort(srt)],
      ['none', '📥 Sem data', open.filter((t) => !t.date).sort(srt)],
    ];
    const feitas = feitasOrd(), nF = Math.max(FEITAS_1, u.tasksFeitas || 0), done = feitas.slice(0, nF), resto = feitas.length - done.length;
    v.innerHTML = `
      <div class="tnova">
        <div class="tn-t">${tipoHTML('tTipo')}${M.hint(TIPO_DICA + ' Para criar: 1) escreva (ou fale no 🎙️). 2) Se quiser, escolha data, hora, prioridade e repetição. 3) Aperte Enter ou clique em Adicionar. Dica: “Pagar conta amanhã” já entra com a data de amanhã.')}</div>
        <div class="tn-l1">
          <input type="text" id="tIn" placeholder="Escreva aqui o que você precisa fazer…" autocomplete="off">${M.micBtn('#tIn')}
          <button class="btn" id="tAdd">＋ Adicionar</button>
        </div>
        <div class="tn-l2">
          <div class="tn-op"><span class="lbl">📅 Quando <span id="tQdo">${M.hint('Opcional. Clique em Hoje, em Amanhã ou no calendário para escolher outro dia.')}</span></span>
            <span class="tn-data" id="tDias"><button type="button" class="chip-b" data-d="0">Hoje</button><button type="button" class="chip-b" data-d="1">Amanhã</button><input type="date" id="tDt" title="Escolher outro dia"></span></div>
          <div class="tn-op" id="tOpHr"><span class="lbl">⏰ Hora ${M.hint('Opcional. No horário marcado o computador mostra um aviso, mesmo com a aba fechada. Sem data, vale para hoje.')}</span><input type="time" id="tHr" title="Escolher o horário do lembrete"></div>
          <div class="tn-op" id="tOpIni" hidden><span class="lbl">🕘 Início ${M.hint('A que horas o compromisso começa. Nesse horário o computador mostra um aviso, mesmo com a aba fechada.')}</span><input type="time" id="tIni" title="Hora em que começa"></div>
          <div class="tn-op" id="tOpFim" hidden><span class="lbl">🏁 Fim ${M.hint(FIM_DICA)}</span><input type="time" id="tFim" title="Hora em que termina (opcional)"></div>
          <div class="tn-op" id="tOpPr"><span class="lbl">🚦 Prioridade ${M.hint(PRIO_DICA)}</span><select id="tPr">${M.opc('taskPrios').map((p) => `<option value="${esc(p.id)}" ${p.id === M.prio('media').id ? 'selected' : ''}>${esc(p.em)} ${esc(p.name)}</option>`).join('')}</select>${M.opcBtn('taskPrios')}</div>
          <div class="tn-op" id="tOpRp"><span class="lbl">🔁 Repetir ${M.hint('Para o que volta sempre (ex.: postar todo dia, pagar o aluguel todo mês). Quando você conclui, a próxima já nasce na data certa. Se não der para fazer num dia, use “Pular esta vez” na linha da tarefa. Todo mês: volta sempre no mesmo dia; em mês mais curto, cai no último dia.')}</span><select id="tRp">${M.REP.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
        </div>
        ${diasHTML('tRpD', [], true)}
      </div>
      ${!open.length ? '<div class="empty" style="padding:26px 20px"><div class="big">🎉</div><h3>Nenhuma tarefa pendente</h3></div>' : ''}
      <div class="tcols">${G.map(([k, n, L]) => L.length ? `<div class="tgroup ${k}"><h4>${n} <span class="cnt">${L.length}</span>${k === 'late' && L.length > 1 ? '<button type="button" class="btn ghost sm tg-hoje" data-todas-hoje title="Muda a data de todas as atrasadas para hoje, de uma vez (dá para desfazer)">→ Todas para hoje</button>' : ''}</h4>${L.map(taskHTML).join('')}</div>` : '').join('')}
      ${feitas.length ? `<div class="tgroup feitas"><h4>✅ Concluídas <span class="cnt">${feitas.length}</span></h4>${done.map(taskHTML).join('')}
        ${feitas.length > FEITAS_1 ? `<div class="tmais"><small>Mostrando ${done.length} de ${feitas.length}</small>${resto > 0 ? `<button type="button" class="btn ghost sm" id="tMais" title="Traz as ${Math.min(FEITAS_MAIS, resto)} concluídas seguintes">⬇ Mostrar mais</button>` : ''}${nF > FEITAS_1 ? `<button type="button" class="btn ghost sm" id="tMenos" title="Volta a mostrar só as ${FEITAS_1} mais recentes">⬆ Mostrar menos</button>` : ''}</div>` : ''}</div>` : ''}</div>`;
    const ehEv = () => u.novoTipo === 'e';
    const pintaTipo = () => {
      const e = ehEv();
      $$('#tTipo button').forEach((b) => b.classList.toggle('on', (b.dataset.k === 'e') === e));
      $('#tIn').placeholder = e ? 'Escreva o compromisso (ex.: Reunião com a Ana)…' : 'Escreva aqui o que você precisa fazer…';
      $('#tOpHr').hidden = $('#tOpPr').hidden = $('#tOpRp').hidden = $('#tQdo').hidden = e;
      $('#tOpIni').hidden = $('#tOpFim').hidden = !e;
      $('#tRpD').hidden = e || $('#tRp').value !== 'dias';
    };
    const add = () => {
      const i = $('#tIn'), ev = ehEv(), hora = ev ? $('#tIni').value : $('#tHr').value, rep = ev ? '' : $('#tRp').value;
      if (rep === 'dias' && !novosDias.length) return M.falta($('#tRpD'), '🗓️ Escolha pelo menos um dia da semana');
      const p = M.parseTask(i.value);
      if (!p.text) return M.falta(i, ev ? '✍️ Escreva o compromisso primeiro (ou fale no 🎙️)' : '✍️ Escreva a tarefa primeiro (ou fale no 🎙️)');
      if (ev && !evValido($('#tDt'), p.date || $('#tDt').value, $('#tIni'), $('#tFim'))) return;
      const t = M.addTask(i.value, $('#tDt').value, ev ? 'media' : $('#tPr').value);
      if (hora) t.hora = hora;
      if (ev) { t.ev = true; if ($('#tFim').value) t.timeEnd = $('#tFim').value; }
      if (rep) t.rep = rep;
      if (rep === 'dias') { t.repDias = novosDias.slice(); if (!t.date) t.date = proxDia(M.today(), t.repDias, true); }
      if ((hora || rep) && !t.date) t.date = M.today(); // lembrete e repetição precisam de um dia
      fixaRepDia(t);
      M.save(); M.toast(ev ? evAviso(t) : '✅ Tarefa criada'); M.render(); $('#tIn').focus();
    };
    const novosDias = [new Date().getDay()];
    $$('#tRpD .chip-b').forEach((b) => b.classList.toggle('on', novosDias.includes(+b.dataset.i)));
    ligaDias($('#tRpD'), novosDias);
    $('#tRp').onchange = () => { $('#tRpD').hidden = $('#tRp').value !== 'dias'; };
    $('#tTipo').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; u.novoTipo = b.dataset.k; SFX.play('click'); pintaTipo(); $('#tIn').focus(); };
    pintaTipo();
    $('#tAdd').onclick = add;
    $('#tIn').onkeydown = (e) => { if (e.key === 'Enter') add(); };
    // o botão fica apagado enquanto o campo está vazio: deixa claro que primeiro se escreve
    const pintaBtn = () => $('#tAdd').classList.toggle('apagado', !$('#tIn').value.trim());
    $('#tIn').oninput = pintaBtn; pintaBtn();
    const pintaDias = () => { const d = $('#tDt').value; $$('#tDias .chip-b').forEach((b) => b.classList.toggle('on', d === M.addDays(M.today(), +b.dataset.d))); };
    $('#tDias').onclick = (e) => { const b = e.target.closest('.chip-b'); if (!b) return; const d = M.addDays(M.today(), +b.dataset.d); $('#tDt').value = $('#tDt').value === d ? '' : d; SFX.play('click'); pintaDias(); };
    $('#tDt').onchange = pintaDias;
    if ($('#tMais')) $('#tMais').onclick = () => { u.tasksFeitas = nF + FEITAS_MAIS; SFX.play('click'); M.render(); };
    if ($('#tMenos')) $('#tMenos').onclick = () => { u.tasksFeitas = 0; SFX.play('click'); M.render(); };
    $('#tIn').focus();
    v.onclick = (e) => {
      if (e.target.closest('[data-todas-hoje]')) { // remarcar as atrasadas numa gravação só (um Desfazer volta todas)
        const hoje = M.today(), L = M.db.tasks.filter((t) => M.tarefaPendente(t) && t.date && t.date < hoje);
        L.forEach((t) => { t.date = hoje; fixaRepDia(t); });
        M.save(); SFX.play('click'); M.render(); M.toast(`📅 ${L.length} tarefa${L.length > 1 ? 's' : ''} para hoje`);
        return;
      }
      const row = e.target.closest('.task'); if (!row) return;
      const t = M.db.tasks.find((x) => x.id === row.dataset.id); if (!t) return;
      const a = e.target.dataset.a;
      if (e.target.type === 'checkbox') M.toggleTask(t, e);
      else if (a === 'rm') M.trashTask(t);
      else if (a === 'prio') { t.prio = M.proxPrio(t.prio); M.save(); SFX.play('click'); M.render(); }
      else if (a === 'date') editTask(t);
      else if (e.target.classList.contains('tx')) editTask(t);
    };
  };

  // vai para a tela de Tarefas e abre a janela de edição daquela tarefa (a busca global usa). Devolve false se ela não existe mais.
  M.abrirTarefa = (id) => {
    const t = M.db.tasks.find((x) => x.id === id);
    if (!t) { M.toast('🤷 Essa tarefa não existe mais. Veja se ela está na Lixeira.'); return false; }
    // concluída antiga: abre a lista de concluídas até ela aparecer
    if (t.done) { const i = feitasOrd().findIndex((x) => x.id === id); if (i >= Math.max(FEITAS_1, M.ui.tasksFeitas || 0)) M.ui.tasksFeitas = FEITAS_1 + Math.ceil((i + 1 - FEITAS_1) / FEITAS_MAIS) * FEITAS_MAIS; }
    M.go('tasks');
    const row = $$('#view .task').find((r) => r.dataset.id === id);
    if (row) { row.classList.add('achada'); row.scrollIntoView({ block: 'center' }); }
    editTask(t);
    return true;
  };

  function editTask(t, depois) {
    const C = M.db.clients || [];
    let ev = !!t.ev;
    const m = M.modal(`<div class="modal-h"><h2 id="eTit">Editar tarefa</h2><button class="icon-btn" id="x" title="Fechar" aria-label="Fechar">✕</button></div><div class="modal-b">
      ${t.done ? '' : `<div class="tn-t">${tipoHTML('eTipo')}${M.hint(TIPO_DICA)}</div>`}
      <div class="com-mic"><input type="text" id="et" value="${esc(t.text)}">${M.micBtn('#et')}</div>
      <div class="row"><div class="fld"><label>Data</label><input type="date" id="ed" value="${t.date}"></div><div class="fld"><label id="ehT">Lembrete ${M.hint('No horário, aparece um aviso no computador (mesmo com a aba fechada). Precisa ter data.')}</label><label id="ehE" hidden>Início ${M.hint('A que horas começa. Nesse horário aparece um aviso no computador, mesmo com a aba fechada.')}</label><input type="time" id="eh" value="${esc(t.hora || '')}"></div><div class="fld" id="eFF" hidden><label>Fim ${M.hint(FIM_DICA)}</label><input type="time" id="ef" value="${esc(t.timeEnd || '')}"></div></div>
      <div class="row" id="eRowR"><div class="fld"><label>Repetir ${M.hint('Quando você conclui, a próxima já nasce na data certa.')}</label><select id="er">${M.REP.map(([k, n]) => `<option value="${k}" ${k === (t.rep || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="fld"><label>Prioridade ${M.hint(PRIO_DICA)}</label><select id="ep">${M.opc('taskPrios').map((p) => `<option value="${esc(p.id)}" ${p.id === M.prio(t.prio).id ? 'selected' : ''}>${esc(p.em)} ${esc(p.name)}</option>`).join('')}</select></div></div>
      ${diasHTML('erD', t.repDias || [], t.rep !== 'dias')}
      <div class="rep-nota" id="eNota" hidden></div>
      ${t.rep && !t.done && !t.ev ? `<div class="rep-acoes" id="eRepB"><button type="button" class="btn ghost sm" id="epu" title="A tarefa vai para a próxima data, sem contar como concluída e sem dar XP">⏭ Pular esta vez</button><button type="button" class="btn ghost sm" id="eer" title="Salva e encerra a repetição: a tarefa continua na lista, mas não volta mais depois de concluída">⏹ Encerrar repetição</button></div>` : ''}
      ${C.length ? `<div class="fld"><label>Cliente</label><select id="ec"><option value="">— nenhum —</option>${C.map((c) => `<option value="${c.id}" ${c.id === t.client ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
      <div class="row" style="justify-content:space-between"><button class="btn danger" id="dl" style="flex:none">🗑️ Lixeira</button><button class="btn" id="ok" style="flex:none">✔ Salvar</button></div></div>`, { small: true });
    $('#x', m).onclick = () => { M.closeModal(); if (depois) depois(); };
    $('#et', m).focus();
    const eDias = (t.repDias || []).slice();
    if (!eDias.length) eDias.push(t.date ? dowDe(t.date) : new Date().getDay());
    $$('#erD .chip-b', m).forEach((b) => b.classList.toggle('on', eDias.includes(+b.dataset.i)));
    ligaDias($('#erD', m), eDias);
    // o que está na janela agora, para saber se a pessoa mudou algo
    const foto = () => [ev, $('#et', m).value, $('#ed', m).value, $('#eh', m).value, $('#ef', m).value, $('#er', m).value, $('#ep', m).value, $('#ec', m) ? $('#ec', m).value : '', eDias.slice().sort()].join('|');
    // trocar o tipo ou os dias da semana também conta como mudança para o aviso de "não salvou" (ui.js só vê campos de digitar)
    const tocou = () => $('#et', m).dispatchEvent(new Event('change', { bubbles: true }));
    // dia em que a repetição mensal volta: o guardado, se a data não mudou; senão o dia da data escolhida
    const diaRep = () => { const d = $('#ed', m).value; return (t.rep === 'mes' && d === t.date && t.repDia) || diaDe(d) || new Date().getDate(); };
    const pinta = () => {
      const rep = ev ? '' : $('#er', m).value, n = $('#eNota', m);
      $('#eTit', m).textContent = ev ? 'Editar compromisso' : 'Editar tarefa';
      $$('#eTipo button', m).forEach((b) => b.classList.toggle('on', (b.dataset.k === 'e') === ev));
      $('#ehT', m).hidden = ev; $('#ehE', m).hidden = $('#eFF', m).hidden = !ev; $('#eRowR', m).hidden = ev;
      $('#erD', m).hidden = rep !== 'dias';
      if ($('#eRepB', m)) $('#eRepB', m).hidden = ev;
      n.textContent = ev && t.rep ? '🔁 Compromisso não repete: ao salvar, a repetição desta tarefa acaba.' : rep === 'mes' ? `🔁 Volta todo dia ${diaRep()}. Em mês mais curto, cai no último dia.` : '';
      n.hidden = !n.textContent;
    };
    if ($('#eTipo', m)) $('#eTipo', m).onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; ev = b.dataset.k === 'e'; SFX.play('click'); pinta(); tocou(); };
    $('#erD', m).addEventListener('click', tocou);
    $('#er', m).onchange = pinta; $('#ed', m).onchange = pinta;
    pinta();
    const antes = foto();
    // fimRep = true: salva e encerra a repetição (a tarefa fica)
    const ok = (fimRep) => {
      const data = $('#ed', m).value, rep = ev || fimRep ? '' : $('#er', m).value;
      if (rep === 'dias' && !eDias.length) return M.falta($('#erD', m), '🗓️ Escolha pelo menos um dia da semana');
      if (ev && !evValido($('#ed', m), data, $('#eh', m), $('#ef', m))) return;
      const manter = t.rep === 'mes' && rep === 'mes' && data === t.date;
      t.text = $('#et', m).value.trim() || t.text; t.date = data; t.hora = $('#eh', m).value; t.rep = rep;
      if (ev) { t.ev = true; if ($('#ef', m).value) t.timeEnd = $('#ef', m).value; else delete t.timeEnd; } else { delete t.ev; delete t.timeEnd; t.prio = $('#ep', m).value; }
      if (t.rep === 'dias') { t.repDias = eDias.slice(); if (!t.date) t.date = proxDia(M.today(), t.repDias, true); } else delete t.repDias;
      if (t.rep && !t.date) t.date = M.today();
      fixaRepDia(t, manter);
      if ($('#ec', m)) t.client = $('#ec', m).value;
      M.save();
      if (fimRep) M.toast('⏹ Repetição encerrada. A tarefa continua na lista.');
      M.closeModal(); M.render(); if (depois) depois();
    };
    $('#ok', m).onclick = () => ok(); $('#et', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#eer', m)) $('#eer', m).onclick = () => ok(true);
    // pular mexe na data: se há mudança sem salvar na janela, pede para salvar antes (para não perder o que foi digitado)
    if ($('#epu', m)) $('#epu', m).onclick = () => { if (foto() !== antes) return M.falta($('#ok', m), '✍️ Salve primeiro o que você mudou, depois pule'); M.closeModal(); M.pularTask(t); if (depois) depois(); };
    $('#dl', m).onclick = () => { M.closeModal(); M.trashTask(t); if (depois) depois(); };
  }
  M.editTask = editTask;

  // ----- calendário -----
  // resumo da rotina no dia (quantos hábitos foram cumpridos)
  const rotDia = (k, today) => {
    if (!M.rotinaDia || k > today) return '';
    const r = M.rotinaDia(k); if (!r.total) return '';
    const nv = r.feitos === 0 ? 0 : Math.max(1, Math.round((r.feitos / r.total) * 4));
    return `<span class="rot-chip n${nv}" title="Rotina: ${r.feitos} de ${r.total} hábito${r.total > 1 ? 's' : ''} cumprido${r.feitos === 1 ? '' : 's'}">🎯 ${r.feitos}/${r.total}</span>`;
  };
  // tarefa ou compromisso dentro do dia. Compromisso mostra 📅 e a faixa de horário; o que já passou fica mais apagado, mas continua ali
  const chipHTML = (t) => {
    const foi = M.evPassou(t);
    const dica = (t.ev ? '📅 ' + M.faixaHora(t) + (foi ? ' (já passou)' : '') + ' · ' : t.hora ? '⏰ ' + t.hora + ' · ' : '') + t.text;
    return `<div class="chip ${t.ev ? 'ev' : 'pr'} ${t.done ? 'done' : ''} ${foi ? 'passou' : ''}" ${t.ev ? '' : `style="--pc:${esc(M.prio(t.prio).color)}"`} draggable="true" data-t="${t.id}" title="${esc(dica)}">${t.ev ? `<span class="ch-e">📅 </span><span class="ch-h">${esc(t.hora || '')}${t.hora && t.timeEnd ? `<span class="ch-fim">–${esc(t.timeEnd)}</span>` : ''}</span> ` : ''}${esc(t.text)}</div>`;
  };
  M.pages.cal = () => {
    const u = M.ui; if (!u.calMonth) { const n = new Date(); u.calMonth = [n.getFullYear(), n.getMonth()]; }
    const [Y, Mo] = u.calMonth, first = new Date(Y, Mo, 1), start = new Date(Y, Mo, 1 - first.getDay());
    const title = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const today = M.today();
    const v = $('#view');
    v.innerHTML = `<div class="cal-h"><button class="icon-btn" id="cp">‹</button><h3>${title}</h3><button class="icon-btn" id="cn">›</button><button class="btn ghost sm" id="ct">Hoje</button>${M.hint('Clique em um dia para adicionar uma tarefa ou um compromisso (com hora de início e fim). Arraste para outro dia para remarcar. O compromisso que já passou continua no dia, mais apagado.')}</div>
      <div class="cal">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => `<div class="dow">${d}</div>`).join('')}${days.map((d) => {
        const k = M.ymd(d);
        // o que tem hora vem primeiro, na ordem do relógio
        const ts = M.db.tasks.filter((t) => t.date === k).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')), its = M.db.items.filter((i) => i.date === k);
        // contas em aberto do dia (a pagar e a receber): abrem o lançamento
        const fs = (M.db.fin || []).filter((f) => !f.pago && f.data === k);
        return `<div class="day ${d.getMonth() !== Mo ? 'out' : ''} ${k === today ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'we' : ''}" data-d="${k}"><span class="dn">${d.getDate()}</span>${rotDia(k, today)}${ts.map(chipHTML).join('')}${fs.map((f) => `<div class="chip fin ${f.tipo}" data-f="${f.id}" title="${f.tipo === 'saida' ? 'A pagar' : 'A receber'}: ${esc(f.desc || 'lançamento')} · ${M.reais ? M.reais(f.valor) : f.valor}">${f.tipo === 'saida' ? '🔻' : '💰'} ${esc(f.desc || (f.tipo === 'saida' ? 'Conta' : 'Receber'))}</div>`).join('')}${its.map((i) => `<div class="chip it" style="--c:${M.type(i.type).color}" data-i="${i.id}" title="${esc(i.title)}">${M.type(i.type).em} ${esc(i.title || 'Sem título')}</div>`).join('')}</div>`;
      }).join('')}</div>`;
    const go = (n) => { const d = new Date(Y, Mo + n, 1); u.calMonth = [d.getFullYear(), d.getMonth()]; M.render(); };
    $('#cp').onclick = () => go(-1); $('#cn').onclick = () => go(1);
    $('#ct').onclick = () => { u.calMonth = null; M.render(); };
    let drag = null;
    v.onclick = (e) => {
      const chip = e.target.closest('.chip');
      if (chip && chip.dataset.i) return M.openItem(chip.dataset.i);
      if (chip && chip.dataset.f) { const f = (M.db.fin || []).find((x) => x.id === chip.dataset.f); if (f && M.finEditar) return M.finEditar(f); }
      if (chip && chip.dataset.t) { const t = M.db.tasks.find((x) => x.id === chip.dataset.t); return editTask(t); }
      const day = e.target.closest('.day'); if (day) quickAdd(day.dataset.d);
    };
    v.ondragstart = (e) => { const c = e.target.closest('[data-t]'); if (c) { drag = c.dataset.t; e.dataTransfer.setData('text/x-myloot', drag); } };
    v.ondragover = (e) => { const d = e.target.closest('.day'); if (d && drag) { e.preventDefault(); $$('.day.over').forEach((x) => x.classList.remove('over')); d.classList.add('over'); } };
    v.ondrop = (e) => {
      const d = e.target.closest('.day'); if (!d || !drag) return;
      e.preventDefault(); e.stopPropagation();
      const t = M.db.tasks.find((x) => x.id === drag); drag = null;
      // remarcar uma repetição mensal muda também o dia em que ela volta
      if (t && t.date !== d.dataset.d) { t.date = d.dataset.d; fixaRepDia(t); M.save(); SFX.play('drop'); M.toast((t.ev ? '📅 Compromisso remarcado para ' : '📅 Remarcada para ') + M.fmtDate(t.date)); }
      M.render();
    };
    v.ondragend = () => { drag = null; };
  };

  // janela do dia no calendário: cria tarefa ou compromisso naquela data
  function quickAdd(date) {
    const u = M.ui;
    const m = M.modal(`<div class="modal-h"><h2 id="qTit">Nova tarefa · ${M.fmtDate(date)}</h2><button class="icon-btn" id="x" title="Fechar" aria-label="Fechar">✕</button></div><div class="modal-b">
      <div class="tn-t">${tipoHTML('qTipo')}${M.hint(TIPO_DICA)}</div>
      <div class="com-mic"><input type="text" id="qt" placeholder="O que precisa ser feito?">${M.micBtn('#qt')}</div>
      <div class="row" id="qRowT"><div class="fld"><label>Prioridade ${M.hint(PRIO_DICA)}</label><select id="qp"><option value="alta">🔴 Alta</option><option value="media" selected>🟡 Média</option><option value="baixa">🔵 Baixa</option></select></div><div class="fld"><label>Hora ${M.hint('Opcional. No horário marcado o computador mostra um aviso.')}</label><input type="time" id="qh"></div></div>
      <div class="row" id="qRowE" hidden><div class="fld"><label>Início ${M.hint('A que horas começa. Nesse horário o computador mostra um aviso.')}</label><input type="time" id="qi"></div><div class="fld"><label>Fim ${M.hint(FIM_DICA)}</label><input type="time" id="qf"></div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" id="qa" style="flex:none">＋ Adicionar</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    const ehEv = () => u.novoTipo === 'e';
    const pinta = () => {
      const e = ehEv();
      $$('#qTipo button', m).forEach((b) => b.classList.toggle('on', (b.dataset.k === 'e') === e));
      $('#qTit', m).textContent = (e ? 'Novo compromisso · ' : 'Nova tarefa · ') + M.fmtDate(date);
      $('#qt', m).placeholder = e ? 'Qual é o compromisso? (ex.: Reunião com a Ana)' : 'O que precisa ser feito?';
      $('#qRowT', m).hidden = e; $('#qRowE', m).hidden = !e;
    };
    $('#qTipo', m).onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; u.novoTipo = b.dataset.k; SFX.play('click'); pinta(); $('#qt', m).focus(); };
    pinta(); $('#qt', m).focus();
    const ok = () => {
      const ev = ehEv(), q = $('#qt', m);
      if (!M.parseTask(q.value).text) return M.falta(q, ev ? '✍️ Escreva o compromisso primeiro' : '✍️ Escreva a tarefa primeiro');
      if (ev && !evValido(q, date, $('#qi', m), $('#qf', m))) return;
      const t = M.addTask(q.value, date, ev ? 'media' : $('#qp', m).value);
      if (ev) { t.ev = true; t.hora = $('#qi', m).value; if ($('#qf', m).value) t.timeEnd = $('#qf', m).value; }
      else if ($('#qh', m).value) t.hora = $('#qh', m).value;
      M.save(); M.toast(ev ? evAviso(t) : '✅ Tarefa criada');
      M.closeModal(); M.render();
    };
    $('#qa', m).onclick = ok; $('#qt', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  }
})();
