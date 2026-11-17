// Tarefas e calendário mensal.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};

  const PRIO_DICA = 'Alta: urgente, aparece primeiro e em vermelho. Média: o normal. Baixa: pode esperar. Dá para mudar depois clicando na etiqueta da tarefa.';
  const PRIO_NOME = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🔵 Baixa' };

  // "hoje" ou "amanhã" no fim do texto define a data sozinho
  M.parseTask = (raw) => {
    let text = raw.trim(), date = '';
    const m = /\s+(hoje|amanh[ãa]|depois de amanh[ãa])$/i.exec(' ' + text);
    if (m) {
      const w = M.norm(m[1]);
      date = w === 'hoje' ? M.today() : w === 'amanha' ? M.addDays(M.today(), 1) : M.addDays(M.today(), 2);
      text = text.slice(0, text.length - m[1].length).trim();
    }
    return { text, date };
  };

  M.addTask = (raw, date, prio) => {
    const p = M.parseTask(raw);
    if (!p.text) return null;
    const t = { id: M.uid(), text: p.text, date: p.date || date || '', prio: prio || 'media', done: false, created: Date.now() };
    M.db.tasks.push(t); M.save(); SFX.play('pop');
    return t;
  };

  // tarefas que repetem: ao concluir, nasce a próxima
  M.REP = [['', 'Não repete'], ['dia', 'Todo dia'], ['uteis', 'Dias úteis (seg a sex)'], ['dias', 'Dias que eu escolher'], ['semana', 'Toda semana'], ['mes', 'Todo mês']];
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dowDe = (k) => new Date(k + 'T12:00:00').getDay();
  // próximo dia (depois de "base", ou o próprio se "inclusive") que cai num dos dias da semana escolhidos
  const proxDia = (base, dias, inclusive) => {
    if (!dias || !dias.length) return M.addDays(base, 7);
    let n = inclusive ? base : M.addDays(base, 1);
    for (let k = 0; k < 7 && !dias.includes(dowDe(n)); k++) n = M.addDays(n, 1);
    return n;
  };
  M.repNome = (t) => t.rep === 'dias' ? 'Toda ' + (t.repDias || []).slice().sort().map((i) => DOW[i]).join(', ') : ((M.REP.find((r) => r[0] === t.rep) || [])[1] || '');
  const diasHTML = (id, sel, hidden) => `<div class="tn-data rep-dias" id="${id}" ${hidden ? 'hidden' : ''} title="Em quais dias da semana a tarefa volta">${DOW.map((n, i) => `<button type="button" class="chip-b ${sel.includes(i) ? 'on' : ''}" data-i="${i}">${n}</button>`).join('')}</div>`;
  const ligaDias = (box, sel) => { box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i); b.classList.toggle('on', sel.includes(i)); SFX.play('click'); }; };
  M.proximaData = (d, rep, dias) => {
    const base = d || M.today();
    if (rep === 'dias') return proxDia(base, dias);
    if (rep === 'dia') return M.addDays(base, 1);
    if (rep === 'semana') return M.addDays(base, 7);
    if (rep === 'uteis') { let n = M.addDays(base, 1); while ([0, 6].includes(new Date(n + 'T12:00:00').getDay())) n = M.addDays(n, 1); return n; }
    if (rep === 'mes') { const [y, m, dd] = base.split('-').map(Number); const x = new Date(y, m, 1); const fim = new Date(y, m + 1, 0).getDate(); return M.ymd(new Date(y, m, Math.min(dd, fim))) || M.ymd(x); }
    return '';
  };

  M.toggleTask = (t, ev) => {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    if (t.done && t.rep && !t.repFeita) {
      t.repFeita = true;
      const nova = Object.assign({}, t, { id: M.uid(), done: false, doneAt: null, xpd: false, repFeita: false, date: M.proximaData(t.date, t.rep, t.repDias), created: Date.now() });
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

  function taskHTML(t) {
    const late = !t.done && t.date && t.date < M.today();
    const cli = t.client && M.client ? M.client(t.client) : null;
    const extra = `${t.hora ? `<span class="tdate" title="Lembrete">⏰ ${esc(t.hora)}</span>` : ''}${t.rep ? `<span class="tdate" title="Repete: ${esc(M.repNome(t))}">🔁${t.rep === 'dias' ? ' ' + esc((t.repDias || []).slice().sort().map((i) => DOW[i]).join(' ')) : ''}</span>` : ''}${cli ? `<span class="tag" title="Cliente">👤 ${esc(cli.nome)}</span>` : ''}`;
    return `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}"><input type="checkbox" ${t.done ? 'checked' : ''} title="Marcar como feita" aria-label="Marcar como feita"><div class="tcorpo"><span class="tx">${esc(t.text)}</span><span class="tmeta">${extra}${t.date ? `<span class="tdate" data-a="date" style="${late ? 'color:var(--red)' : ''};cursor:pointer" title="Mudar data">📅 ${M.fmtDate(t.date)}</span>` : `<span class="tdate" data-a="date" style="cursor:pointer;opacity:.6" title="Definir data">📅 —</span>`}<span class="prio ${t.prio}" data-a="prio" title="Prioridade ${t.prio === 'media' ? 'média' : t.prio}. Clique para mudar (baixa, média, alta).">${t.prio === 'media' ? 'média' : t.prio}</span></span></div><button class="xbtn" data-a="rm" title="Mandar para a lixeira" aria-label="Mandar para a lixeira">✕</button></div>`;
  }

  M.taskHTML = taskHTML;
  M.pages.tasks = () => {
    const v = $('#view'), today = M.today();
    const open = M.db.tasks.filter((t) => !t.done);
    const order = { alta: 0, media: 1, baixa: 2 };
    const srt = (a, b) => (a.date || '9').localeCompare(b.date || '9') || order[a.prio] - order[b.prio];
    const G = [
      ['late', '🔥 Atrasadas', open.filter((t) => t.date && t.date < today).sort(srt)],
      ['today', '🌞 Hoje', open.filter((t) => t.date === today).sort(srt)],
      ['next', '🗓️ Próximas', open.filter((t) => t.date > today).sort(srt)],
      ['none', '📥 Sem data', open.filter((t) => !t.date).sort(srt)],
    ];
    const done = M.db.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 12);
    v.innerHTML = `
      <div class="tnova">
        <div class="tn-t">✅ Nova tarefa ${M.hint('1) Escreva (ou fale no 🎙️) o que precisa fazer. 2) Se quiser, escolha data, hora, prioridade e repetição. 3) Aperte Enter ou clique em Adicionar. Dica: “Pagar conta amanhã” já entra com a data de amanhã.')}</div>
        <div class="tn-l1">
          <input type="text" id="tIn" placeholder="Escreva aqui o que você precisa fazer…" autocomplete="off">${M.micBtn('#tIn')}
          <button class="btn" id="tAdd">＋ Adicionar</button>
        </div>
        <div class="tn-l2">
          <div class="tn-op"><span class="lbl">📅 Quando ${M.hint('Opcional. Clique em Hoje, em Amanhã ou no calendário para escolher outro dia.')}</span>
            <span class="tn-data" id="tDias"><button type="button" class="chip-b" data-d="0">Hoje</button><button type="button" class="chip-b" data-d="1">Amanhã</button><input type="date" id="tDt" title="Escolher outro dia"></span></div>
          <div class="tn-op"><span class="lbl">⏰ Hora ${M.hint('Opcional. No horário marcado o computador mostra um aviso, mesmo com a aba fechada. Sem data, vale para hoje.')}</span><input type="time" id="tHr" title="Escolher o horário do lembrete"></div>
          <div class="tn-op"><span class="lbl">🚦 Prioridade ${M.hint(PRIO_DICA)}</span><select id="tPr"><option value="alta">🔴 Alta</option><option value="media" selected>🟡 Média</option><option value="baixa">🔵 Baixa</option></select></div>
          <div class="tn-op"><span class="lbl">🔁 Repetir ${M.hint('Para o que volta sempre (ex.: postar todo dia, pagar o aluguel todo mês). Quando você conclui, a próxima já nasce na data certa.')}</span><select id="tRp">${M.REP.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
        </div>
        ${diasHTML('tRpD', [], true)}
      </div>
      ${!open.length ? '<div class="empty" style="padding:26px 20px"><div class="big">🎉</div><h3>Nenhuma tarefa pendente</h3></div>' : ''}
      <div class="tcols">${G.map(([k, n, L]) => L.length ? `<div class="tgroup ${k}"><h4>${n} <span class="cnt">${L.length}</span></h4>${L.map(taskHTML).join('')}</div>` : '').join('')}
      ${done.length ? `<div class="tgroup feitas"><h4>✅ Concluídas recentemente</h4>${done.map(taskHTML).join('')}</div>` : ''}</div>`;
    const add = () => {
      const i = $('#tIn'), hora = $('#tHr').value, rep = $('#tRp').value;
      if (rep === 'dias' && !novosDias.length) return M.falta($('#tRpD'), '🗓️ Escolha pelo menos um dia da semana');
      const t = M.addTask(i.value, $('#tDt').value, $('#tPr').value);
      if (!t) return M.falta(i, '✍️ Escreva a tarefa primeiro (ou fale no 🎙️)');
      if (hora) t.hora = hora;
      if (rep) t.rep = rep;
      if (rep === 'dias') { t.repDias = novosDias.slice(); if (!t.date) t.date = proxDia(M.today(), t.repDias, true); }
      if ((hora || rep) && !t.date) t.date = M.today(); // lembrete e repetição precisam de um dia
      M.save(); M.toast('✅ Tarefa criada'); M.render(); $('#tIn').focus();
    };
    const novosDias = [new Date().getDay()];
    $$('#tRpD .chip-b').forEach((b) => b.classList.toggle('on', novosDias.includes(+b.dataset.i)));
    ligaDias($('#tRpD'), novosDias);
    $('#tRp').onchange = () => { $('#tRpD').hidden = $('#tRp').value !== 'dias'; };
    $('#tAdd').onclick = add;
    $('#tIn').onkeydown = (e) => { if (e.key === 'Enter') add(); };
    // o botão fica apagado enquanto o campo está vazio: deixa claro que primeiro se escreve
    const pintaBtn = () => $('#tAdd').classList.toggle('apagado', !$('#tIn').value.trim());
    $('#tIn').oninput = pintaBtn; pintaBtn();
    const pintaDias = () => { const d = $('#tDt').value; $$('#tDias .chip-b').forEach((b) => b.classList.toggle('on', d === M.addDays(M.today(), +b.dataset.d))); };
    $('#tDias').onclick = (e) => { const b = e.target.closest('.chip-b'); if (!b) return; const d = M.addDays(M.today(), +b.dataset.d); $('#tDt').value = $('#tDt').value === d ? '' : d; SFX.play('click'); pintaDias(); };
    $('#tDt').onchange = pintaDias;
    $('#tIn').focus();
    v.onclick = (e) => {
      const row = e.target.closest('.task'); if (!row) return;
      const t = M.db.tasks.find((x) => x.id === row.dataset.id); if (!t) return;
      const a = e.target.dataset.a;
      if (e.target.type === 'checkbox') M.toggleTask(t, e);
      else if (a === 'rm') M.trashTask(t);
      else if (a === 'prio') { t.prio = M.PRIOS[(M.PRIOS.indexOf(t.prio) + 1) % 3]; M.save(); SFX.play('click'); M.render(); }
      else if (a === 'date') editTask(t);
      else if (e.target.classList.contains('tx')) editTask(t);
    };
  };

  function editTask(t, depois) {
    const C = M.db.clients || [];
    const m = M.modal(`<div class="modal-h"><h2>Editar tarefa</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><div class="com-mic"><input type="text" id="et" value="${esc(t.text)}">${M.micBtn('#et')}</div>
      <div class="row"><div class="fld"><label>Data</label><input type="date" id="ed" value="${t.date}"></div><div class="fld"><label>Lembrete ${M.hint('No horário, aparece um aviso no computador (mesmo com a aba fechada). Precisa ter data.')}</label><input type="time" id="eh" value="${esc(t.hora || '')}"></div></div>
      <div class="row"><div class="fld"><label>Repetir ${M.hint('Quando você conclui, a próxima já nasce na data certa.')}</label><select id="er">${M.REP.map(([k, n]) => `<option value="${k}" ${k === (t.rep || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="fld"><label>Prioridade ${M.hint(PRIO_DICA)}</label><select id="ep">${M.PRIOS.map((p) => `<option value="${p}" ${p === t.prio ? 'selected' : ''}>${PRIO_NOME[p]}</option>`).join('')}</select></div></div>
      ${diasHTML('erD', t.repDias || [], t.rep !== 'dias')}
      ${C.length ? `<div class="fld"><label>Cliente</label><select id="ec"><option value="">— nenhum —</option>${C.map((c) => `<option value="${c.id}" ${c.id === t.client ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
      <div class="row" style="justify-content:space-between"><button class="btn danger" id="dl" style="flex:none">🗑️ Lixeira</button><button class="btn" id="ok" style="flex:none">Salvar</button></div></div>`, { small: true });
    $('#x', m).onclick = () => { M.closeModal(); if (depois) depois(); };
    $('#et', m).focus();
    const eDias = (t.repDias || []).slice();
    if (!eDias.length) eDias.push(t.date ? dowDe(t.date) : new Date().getDay());
    $$('#erD .chip-b', m).forEach((b) => b.classList.toggle('on', eDias.includes(+b.dataset.i)));
    ligaDias($('#erD', m), eDias);
    $('#er', m).onchange = () => { $('#erD', m).hidden = $('#er', m).value !== 'dias'; };
    const ok = () => {
      if ($('#er', m).value === 'dias' && !eDias.length) return M.falta($('#erD', m), '🗓️ Escolha pelo menos um dia da semana');
      t.text = $('#et', m).value.trim() || t.text; t.date = $('#ed', m).value; t.prio = $('#ep', m).value; t.hora = $('#eh', m).value; t.rep = $('#er', m).value;
      if (t.rep === 'dias') { t.repDias = eDias.slice(); if (!t.date) t.date = proxDia(M.today(), t.repDias, true); } else delete t.repDias;
      if (t.rep && !t.date) t.date = M.today();
      if ($('#ec', m)) t.client = $('#ec', m).value;
      M.save(); M.closeModal(); M.render(); if (depois) depois();
    };
    $('#ok', m).onclick = ok; $('#et', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
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
  M.pages.cal = () => {
    const u = M.ui; if (!u.calMonth) { const n = new Date(); u.calMonth = [n.getFullYear(), n.getMonth()]; }
    const [Y, Mo] = u.calMonth, first = new Date(Y, Mo, 1), start = new Date(Y, Mo, 1 - first.getDay());
    const title = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const today = M.today();
    const v = $('#view');
    v.innerHTML = `<div class="cal-h"><button class="icon-btn" id="cp">‹</button><h3>${title}</h3><button class="icon-btn" id="cn">›</button><button class="btn ghost sm" id="ct">Hoje</button>${M.hint('Clique em um dia para criar uma tarefa. Arraste uma tarefa para outro dia para remarcar.')}</div>
      <div class="cal">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => `<div class="dow">${d}</div>`).join('')}${days.map((d) => {
        const k = M.ymd(d);
        const ts = M.db.tasks.filter((t) => t.date === k), its = M.db.items.filter((i) => i.date === k);
        return `<div class="day ${d.getMonth() !== Mo ? 'out' : ''} ${k === today ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'we' : ''}" data-d="${k}"><span class="dn">${d.getDate()}</span>${rotDia(k, today)}${ts.map((t) => `<div class="chip ${t.prio} ${t.done ? 'done' : ''}" draggable="true" data-t="${t.id}" title="${esc(t.text)}">${esc(t.text)}</div>`).join('')}${its.map((i) => `<div class="chip it" style="--c:${M.type(i.type).color}" data-i="${i.id}" title="${esc(i.title)}">${M.type(i.type).em} ${esc(i.title || 'Sem título')}</div>`).join('')}</div>`;
      }).join('')}</div>`;
    const go = (n) => { const d = new Date(Y, Mo + n, 1); u.calMonth = [d.getFullYear(), d.getMonth()]; M.render(); };
    $('#cp').onclick = () => go(-1); $('#cn').onclick = () => go(1);
    $('#ct').onclick = () => { u.calMonth = null; M.render(); };
    let drag = null;
    v.onclick = (e) => {
      const chip = e.target.closest('.chip');
      if (chip && chip.dataset.i) return M.openItem(chip.dataset.i);
      if (chip && chip.dataset.t) { const t = M.db.tasks.find((x) => x.id === chip.dataset.t); return editTask(t); }
      const day = e.target.closest('.day'); if (day) quickAdd(day.dataset.d);
    };
    v.ondragstart = (e) => { const c = e.target.closest('[data-t]'); if (c) { drag = c.dataset.t; e.dataTransfer.setData('text/x-myloot', drag); } };
    v.ondragover = (e) => { const d = e.target.closest('.day'); if (d && drag) { e.preventDefault(); $$('.day.over').forEach((x) => x.classList.remove('over')); d.classList.add('over'); } };
    v.ondrop = (e) => {
      const d = e.target.closest('.day'); if (!d || !drag) return;
      e.preventDefault(); e.stopPropagation();
      const t = M.db.tasks.find((x) => x.id === drag); drag = null;
      if (t && t.date !== d.dataset.d) { t.date = d.dataset.d; M.save(); SFX.play('drop'); M.toast('📅 Remarcada para ' + M.fmtDate(t.date)); }
      M.render();
    };
    v.ondragend = () => { drag = null; };
  };

  function quickAdd(date) {
    const m = M.modal(`<div class="modal-h"><h2>Nova tarefa · ${M.fmtDate(date)}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><div class="com-mic"><input type="text" id="qt" placeholder="O que precisa ser feito?">${M.micBtn('#qt')}</div><div class="row" style="align-items:flex-end"><div class="fld"><label>Prioridade ${M.hint(PRIO_DICA)}</label><select id="qp"><option value="alta">🔴 Alta</option><option value="media" selected>🟡 Média</option><option value="baixa">🔵 Baixa</option></select></div><div class="fld"><label>Hora ${M.hint('Opcional. No horário marcado o computador mostra um aviso.')}</label><input type="time" id="qh"></div><button class="btn" id="qa" style="flex:none">＋ Criar</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal; $('#qt', m).focus();
    const ok = () => { const t = M.addTask($('#qt', m).value, date, $('#qp', m).value); if (!t) return M.falta($('#qt', m), '✍️ Escreva a tarefa primeiro'); if ($('#qh', m).value) { t.hora = $('#qh', m).value; M.save(); } M.closeModal(); M.render(); };
    $('#qa', m).onclick = ok; $('#qt', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  }
})();
