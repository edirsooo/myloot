// Tarefas e calendário mensal.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};

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

  M.toggleTask = (t, ev) => {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
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
    return `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}"><input type="checkbox" ${t.done ? 'checked' : ''}><span class="tx">${esc(t.text)}</span>${t.date ? `<span class="tdate" data-a="date" style="${late ? 'color:var(--red)' : ''};cursor:pointer" title="Mudar data">📅 ${M.fmtDate(t.date)}</span>` : `<span class="tdate" data-a="date" style="cursor:pointer;opacity:.6" title="Definir data">📅 —</span>`}<span class="prio ${t.prio}" data-a="prio" title="Clique para mudar a prioridade">${t.prio}</span><button class="xbtn" data-a="rm" title="Lixeira">✕</button></div>`;
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
      <div class="tnew">
        <input type="text" id="tIn" placeholder="Nova tarefa… (termine com “hoje” ou “amanhã” para marcar a data)" autocomplete="off">
        <select id="tPr" title="Prioridade"><option value="alta">🔴 Alta</option><option value="media" selected>🟡 Média</option><option value="baixa">🔵 Baixa</option></select>
        <input type="date" id="tDt" style="width:auto" title="Data (opcional)">
        <button class="btn" id="tAdd">＋ Adicionar</button>
        ${M.hint('Dica: escreva “Pagar conta amanhã” e a data entra sozinha.')}
      </div>
      ${G.map(([k, n, L]) => L.length ? `<div class="tgroup ${k}"><h4>${n} <span>${L.length}</span></h4>${L.map(taskHTML).join('')}</div>` : '').join('')}
      ${!open.length ? '<div class="empty"><div class="big">🎉</div><h3>Nenhuma tarefa pendente</h3></div>' : ''}
      ${done.length ? `<div class="tgroup"><h4>✅ Concluídas recentemente</h4>${done.map(taskHTML).join('')}</div>` : ''}`;
    const add = () => { const i = $('#tIn'); if (M.addTask(i.value, $('#tDt').value, $('#tPr').value)) { M.render(); $('#tIn').focus(); } };
    $('#tAdd').onclick = add;
    $('#tIn').onkeydown = (e) => { if (e.key === 'Enter') add(); };
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

  function editTask(t) {
    const m = M.modal(`<div class="modal-h"><h2>Editar tarefa</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><input type="text" id="et" value="${esc(t.text)}"><div class="row"><div class="fld"><label>Data</label><input type="date" id="ed" value="${t.date}"></div><div class="fld"><label>Prioridade</label><select id="ep">${M.PRIOS.map((p) => `<option ${p === t.prio ? 'selected' : ''}>${p}</option>`).join('')}</select></div></div><div class="row" style="justify-content:space-between"><button class="btn danger" id="dl" style="flex:none">🗑️ Lixeira</button><button class="btn" id="ok" style="flex:none">Salvar</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    $('#et', m).focus();
    const ok = () => { t.text = $('#et', m).value.trim() || t.text; t.date = $('#ed', m).value; t.prio = $('#ep', m).value; M.save(); M.closeModal(); M.render(); };
    $('#ok', m).onclick = ok; $('#et', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    $('#dl', m).onclick = () => { M.closeModal(); M.trashTask(t); };
  }

  // ----- calendário -----
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
        return `<div class="day ${d.getMonth() !== Mo ? 'out' : ''} ${k === today ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'we' : ''}" data-d="${k}"><span class="dn">${d.getDate()}</span>${ts.map((t) => `<div class="chip ${t.prio} ${t.done ? 'done' : ''}" draggable="true" data-t="${t.id}" title="${esc(t.text)}">${esc(t.text)}</div>`).join('')}${its.map((i) => `<div class="chip it" style="--c:${M.type(i.type).color}" data-i="${i.id}" title="${esc(i.title)}">${M.type(i.type).em} ${esc(i.title || 'Sem título')}</div>`).join('')}</div>`;
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
    const m = M.modal(`<div class="modal-h"><h2>Nova tarefa · ${M.fmtDate(date)}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><input type="text" id="qt" placeholder="O que precisa ser feito?"><div class="row" style="align-items:center"><select id="qp"><option value="alta">🔴 Alta</option><option value="media" selected>🟡 Média</option><option value="baixa">🔵 Baixa</option></select><button class="btn" id="qa" style="flex:none">＋ Criar</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal; $('#qt', m).focus();
    const ok = () => { if (M.addTask($('#qt', m).value, date, $('#qp', m).value)) { M.closeModal(); M.render(); } };
    $('#qa', m).onclick = ok; $('#qt', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  }
})();
