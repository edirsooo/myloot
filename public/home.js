// Início (painel do dia), missões diárias, captura rápida e timer de foco.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  let qcMode = 'tarefa';

  // ----- missões do dia -----
  M.quests = () => {
    const n = (M.dayLog().n) || {};
    return [
      { em: '⚔️', t: 'Concluir 2 tarefas', v: n.task || 0, max: 2 },
      { em: '🧱', t: 'Guardar 1 item novo', v: n.item || 0, max: 1 },
      { em: '⏱', t: 'Fazer 1 foco de 25 min', v: n.focus || 0, max: 1 },
    ];
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

  M.pages.home = () => {
    const v = $('#view'), g = M.db.game, s = M.db.settings, today = M.today();
    const h = new Date().getHours(), hi = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const open = M.db.tasks.filter((t) => !t.done);
    const late = open.filter((t) => t.date && t.date < today), now = open.filter((t) => t.date === today);
    const dayXp = (g.log[today] || { xp: 0 }).xp, pct = Math.min(100, Math.round((dayXp / (s.dailyGoal || 50)) * 100));
    const doing = M.db.items.filter((i) => i.status === 'and').sort((a, b) => b.updated - a.updated).slice(0, 5);
    const favs = M.db.items.filter((i) => i.fav).sort((a, b) => b.updated - a.updated).slice(0, 5);
    const recent = [...M.db.items].sort((a, b) => b.updated - a.updated).slice(0, 6);
    const sum = late.length || now.length ? `${now.length} tarefa${now.length === 1 ? '' : 's'} para hoje${late.length ? ` · <b style="color:var(--red)">${late.length} atrasada${late.length === 1 ? '' : 's'}</b>` : ''}` : 'Nada marcado para hoje. Dia livre! 🎉';
    const contas = M.finHoje ? M.finHoje() : [];
    const sumFin = contas.length ? ` · <a data-go="fin" style="color:var(--amber);cursor:pointer">💰 ${contas.length} conta${contas.length > 1 ? 's' : ''} para hoje ou atrasada${contas.length > 1 ? 's' : ''}</a>` : '';
    const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const modes = [['tarefa', '✅ Tarefa'], ['nota', '📝 Nota'], ['prompt', '✨ Prompt'], ['link', '🔗 Link']];
    const ph = { tarefa: 'Nova tarefa… (termine com “hoje” ou “amanhã”)', nota: 'Anote uma ideia rápida…', prompt: 'Cole um prompt para guardar…', link: 'Cole um link…' };
    v.innerHTML = `<div class="home-wrap"><div class="home">
      <div class="hero wide"><img class="pix" src="/bau.png" alt="">
        <div class="grow"><h1>${hi}! 👋</h1><p style="text-transform:capitalize">${date}</p><p>${sum}${sumFin}</p>
          <div class="mini" style="margin-top:12px">${s.gamify ? `<div>Nv ${M.levelOf(g.xp)}<small>${esc(M.levelName(M.levelOf(g.xp)))}</small></div><div>🔥 ${$('#hudStreak b').textContent}<small>dias seguidos</small></div>` : ''}<div>${M.db.items.length}<small>itens no loot</small></div><div>${open.length}<small>tarefas abertas</small></div></div>
        </div>
        ${s.gamify ? `<div class="ring" style="--p:${pct}" title="Meta de hoje: ${dayXp} / ${s.dailyGoal} XP"><span>${pct}%<small>META</small></span></div>` : ''}
      </div>
      <div class="qc wide"><div class="seg" id="qcM">${modes.map(([k, n]) => `<button data-m="${k}" class="${qcMode === k ? 'on' : ''}">${n}</button>`).join('')}</div><input type="text" id="qcIn" placeholder="${ph[qcMode]}" autocomplete="off"><button class="btn ghost qc-voz" id="qcVoz" title="Criar falando (V)" aria-label="Criar por voz">🎙️</button><button class="btn" id="qcGo">Guardar ↵</button></div>
      <div class="panel"><h4>🌞 Para hoje <a data-go="tasks">ver todas →</a></h4>${[...late, ...now].map(M.taskHTML).join('') || '<div class="empty" style="padding:22px">Tudo em dia ✨</div>'}</div>
      <div class="panel">${s.gamify ? `<h4>🎯 Missões do dia ${M.hint('Complete as três para ganhar um bônus de XP. Zera todo dia.')}</h4>${M.quests().map((q) => `<div class="quest ${q.v >= q.max ? 'ok' : ''}"><span>${q.em} ${q.t}</span><div class="bar"><i style="width:${Math.min(100, (q.v / q.max) * 100)}%"></i></div><small>${q.v >= q.max ? '✔' : q.v + '/' + q.max}</small></div>`).join('')}<div style="height:10px"></div>` : ''}
        <h4>⛏️ Em andamento</h4>${doing.map(rowItem).join('') || '<small style="color:var(--faint)">Nada em andamento.</small>'}</div>
      <div class="panel"><h4>⭐ Favoritos</h4>${favs.map(rowItem).join('') || '<small style="color:var(--faint)">Marque um item com a estrela.</small>'}</div>
      <div class="panel"><h4>🕘 Mexidos por último <a data-go="lib">biblioteca →</a></h4>${recent.map(rowItem).join('') || '<small style="color:var(--faint)">Seu loot está vazio.</small>'}</div>
    </div><aside class="panel g-side" id="gSide"></aside></div>`;
    M.graphPanel($('#gSide'));

    const input = $('#qcIn');
    const save = () => {
      const val = input.value.trim(); if (!val) return;
      const isUrl = /^(https?:\/\/|www\.)\S+$/i.test(val);
      const mode = isUrl ? 'link' : qcMode;
      if (mode === 'tarefa') { M.addTask(val); M.toast('✅ Tarefa criada'); }
      else {
        const title = mode === 'link' ? val.replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0] : val.split('\n')[0].slice(0, 60);
        M.createItem({ type: mode, title, content: mode === 'nota' && val.length <= 60 ? '' : (isUrl && !/^https?:/i.test(val) ? 'https://' + val : val), cat: '' });
        M.toast(`${M.type(mode).em} Guardado no loot`);
      }
      M.render(); $('#qcIn').focus();
    };
    $('#qcGo').onclick = save;
    $('#qcVoz').onclick = () => M.voz();
    input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    $('#qcM').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; qcMode = b.dataset.m; SFX.play('click'); M.render(); $('#qcIn').focus(); };
    v.onclick = (e) => {
      const go = e.target.closest('[data-go]'); if (go) return M.go(go.dataset.go);
      const row = e.target.closest('.rowi'); if (row) return M.openItem(row.dataset.id);
      const tk = e.target.closest('.task'); if (!tk) return;
      const t = M.db.tasks.find((x) => x.id === tk.dataset.id); if (!t) return;
      if (e.target.type === 'checkbox') M.toggleTask(t, e);
      else if (e.target.dataset.a === 'rm') M.trashTask(t);
      else if (e.target.dataset.a === 'prio') { t.prio = M.PRIOS[(M.PRIOS.indexOf(t.prio) + 1) % 3]; M.save(); M.render(); }
      else M.go('tasks');
    };
    v.oncontextmenu = (e) => { const r = e.target.closest('.rowi'); if (r) M.itemMenu(e, M.db.items.find((i) => i.id === r.dataset.id)); };
  };

  // ----- timer de foco (25 min) -----
  // O relógio fica no servidor: fechar a aba não para o foco, e o computador avisa quando acabar.
  let end = 0, min = 25, tick = 0, claiming = false;
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
    if (!end) { el.classList.remove('run'); $('#focusT').textContent = String(min).padStart(2, '0') + ':00'; document.title = 'MyLoot'; return; }
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
      end = Date.now() + (r.end - r.agora); min = r.min; SFX.play('star'); paint();
      M.toast(`⏱ Foco de ${min} min começou. Pode fechar a aba: o computador avisa no fim.`);
    } catch (e) { M.toast('⚠️ ' + e.message); }
  };
  M.focusToggle = async () => {
    if (end) {
      if (!(await M.confirm('Parar o foco agora? Esse tempo não vale XP.', 'Parar'))) return;
      await M.api('/api/focus/stop', { method: 'POST' }).catch(() => {});
      end = 0; SFX.play('click'); paint(); return;
    }
    const m = M.modal(`<div class="modal-h"><h2>⏱ Modo foco</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b"><div>Quanto tempo? ${M.hint('O relógio roda no servidor do MyLoot. Você pode fechar o navegador: quando acabar, aparece um aviso no computador. Só para se você desligar o MyLoot ou o computador.')}</div><div class="row">${[15, 25, 45, 60].map((n) => `<button class="btn ${n === 25 ? '' : 'ghost'}" data-m="${n}">${n} min</button>`).join('')}</div><button class="btn ghost sm" id="nt" style="align-self:flex-start">🔔 Testar o aviso</button></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    $('#nt', m).onclick = () => M.api('/api/notify-test', { method: 'POST' }).then(() => M.toast('Aviso enviado. Olhe o canto da tela.'));
    m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { M.closeModal(); M.focusStart(+b.dataset.m); } };
  };
  $('#focus').onclick = M.focusToggle;
  tick = setInterval(paint, 1000);
  setInterval(sync, 30000);
  addEventListener('focus', sync);
  M.focusPaint = sync;
})();
