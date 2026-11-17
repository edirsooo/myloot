// Núcleo: estado, API, utilitários e gamificação.
(function () {
  const M = (window.M = { db: null, ui: { page: 'home', q: '', type: '', cat: '', status: '', tag: '', fav: false, sort: { k: 'updated', d: -1 }, calMonth: null } });

  M.TYPES = [
    { id: 'estudo', name: 'Estudo / PDF', em: '📚', color: '#3ad7ff' },
    { id: 'prompt', name: 'Prompt', em: '✨', color: '#a78bfa' },
    { id: 'instrucao', name: 'Instrução', em: '📜', color: '#ffbe46' },
    { id: 'comando', name: 'Comando', em: '⌨️', color: '#3cffaa' },
    { id: 'link', name: 'Link', em: '🔗', color: '#ff7ac6' },
    { id: 'nota', name: 'Nota', em: '📝', color: '#ff9d4a' },
  ];
  M.STATUS = [{ id: 'ver', name: 'Para ver', em: '👀' }, { id: 'and', name: 'Em andamento', em: '⛏️' }, { id: 'ok', name: 'Concluído', em: '✅' }];
  M.PRIOS = ['baixa', 'media', 'alta'];
  M.type = (id) => M.TYPES.find((t) => t.id === id) || M.TYPES[5];
  M.cat = (id) => M.db.categories.find((c) => c.id === id);

  // ----- utilitários -----
  M.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  M.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  M.today = () => M.ymd(new Date());
  M.addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return M.ymd(d); };
  M.fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  M.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  M.$ = (s, r) => (r || document).querySelector(s);
  M.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  M.size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  M.fileIcon = (a) => {
    const n = (a.name || '').toLowerCase();
    if (/\.pdf$/.test(n)) return '📕';
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return '🖼️';
    if (/\.(mp3|wav|ogg|m4a)$/.test(n)) return '🎵';
    if (/\.(mp4|webm|mov|mkv)$/.test(n)) return '🎬';
    if (/\.(zip|rar|7z)$/.test(n)) return '🗜️';
    if (/\.(md|markdown|txt)$/.test(n)) return '📖';
    if (/\.(docx?|odt)$/.test(n)) return '📘';
    if (/\.(xlsx?|csv)$/.test(n)) return '📗';
    return '📄';
  };

  // ----- API -----
  const H = { 'X-MyLoot': '1' };
  M.api = async (path, opt) => {
    const r = await fetch(path, Object.assign({ headers: H }, opt));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  };
  // ----- sincronia entre aparelhos (PC e celular abertos ao mesmo tempo) -----
  // Cada gravação no servidor tem uma REV. Se outro aparelho salvou antes, o servidor recusa (409) e o app junta:
  // o que só mudou lá entra aqui, o que só mudou aqui vai junto, e o que mudou nos dois fica com a versão daqui.
  M.rev = '';
  let base = null; // como o banco estava na última vez que este aparelho e o servidor concordaram
  const J = (o) => JSON.stringify(o);
  const chave = (k, o) => (k === 'trash' ? o && o.data && (o.kind + ':' + o.data.id + ':' + o.at) : o && o.id);
  const ehLista = (k, a) => Array.isArray(a) && a.length > 0 && a.every((o) => o && typeof o === 'object' && chave(k, o));
  const troca = (alvo, novo) => { for (const x of Object.keys(alvo)) if (!(x in novo)) delete alvo[x]; Object.assign(alvo, novo); };
  function juntarLista(k, b, l, s) {
    const bm = new Map((b || []).map((o) => [chave(k, o), o])), lm = new Map((l || []).map((o) => [chave(k, o), o])), sm = new Set();
    const out = [];
    for (const so of s || []) {
      const id = chave(k, so); sm.add(id);
      const lo = lm.get(id), bo = bm.get(id);
      if (lo) { if (bo && J(lo) === J(bo)) troca(lo, so); out.push(lo); } // mantém o mesmo objeto (a janela aberta continua apontando para ele)
      else if (!bo) out.push(so); // novo no outro aparelho
      // se estava na base e sumiu daqui, foi apagado aqui: fica apagado
    }
    for (const lo of l || []) {
      const id = chave(k, lo); if (sm.has(id)) continue;
      const bo = bm.get(id);
      if (!bo || J(lo) !== J(bo)) out.push(lo); // novo aqui, ou mudou aqui depois de apagado lá
    }
    if (k === 'trash') out.sort((x, y) => (y.at || 0) - (x.at || 0));
    return out;
  }
  function juntar(b, l, s) { // b = base, l = este aparelho (mudado no lugar), s = servidor
    for (const k of new Set([...Object.keys(s), ...Object.keys(l)])) {
      const bv = b[k], lv = l[k], sv = s[k];
      if (!(k in s)) continue;
      if (J(lv) === J(sv)) continue;
      if (J(lv) === J(bv)) { l[k] = sv; continue; }
      if (J(sv) === J(bv)) continue;
      if (ehLista(k, lv) || ehLista(k, sv)) l[k] = juntarLista(k, bv, lv, sv);
      else if (lv && sv && typeof lv === 'object' && typeof sv === 'object' && !Array.isArray(lv)) {
        for (const x of new Set([...Object.keys(sv), ...Object.keys(lv)])) {
          const bb = (bv || {})[x];
          if (J(lv[x]) === J(bb) && x in sv) lv[x] = sv[x];
        }
      }
    }
  }
  async function lerServidor() {
    const r = await fetch('/api/db', { headers: H, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
    return { db: j, rev: r.headers.get('X-Rev') || '' };
  }
  M.load = async () => { const r = await lerServidor(); M.db = r.db; M.rev = r.rev; base = JSON.parse(J(r.db)); };
  // busca o que mudou no servidor e junta com o que está aqui; devolve true se trouxe novidade
  let sincronizando = null;
  M.sincronizar = () => sincronizando || (sincronizando = (async () => {
    try {
      const r = await lerServidor();
      const antes = J(M.db);
      if (base) juntar(base, M.db, r.db); else Object.assign(M.db, r.db);
      base = JSON.parse(J(r.db)); M.rev = r.rev;
      if (J(M.db) !== J(r.db)) M.save(true); // ainda tem mudança daqui para mandar
      return J(M.db) !== antes;
    } finally { sincronizando = null; }
  })());
  let enviando = false;
  async function enviar(tentativa = 0) {
    const corpo = J(M.db);
    const r = await fetch('/api/db', { method: 'PUT', headers: Object.assign({ 'X-Rev': M.rev }, H), body: corpo });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && tentativa < 3) { await M.sincronizar(); return enviar(tentativa + 1); }
    if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
    M.rev = j.rev || M.rev; base = JSON.parse(corpo);
  }
  M.salvando = () => !!saveT || enviando;
  // olha o servidor a cada 4 s (só com a aba visível e sem janela aberta) e na volta para a aba
  let mudouFora = false;
  const ocupado = () => M.modalOpen() || (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') && document.activeElement.value);
  async function olhar() {
    if (document.hidden || !base || M.salvando() || (M.modalOpen && M.modalOpen())) return;
    try {
      const { rev } = await M.api('/api/rev');
      if (rev && rev !== M.rev && !M.salvando()) mudouFora = (await M.sincronizar()) || mudouFora;
    } catch (_) { return; }
    if (mudouFora && !ocupado() && M.render) {
      mudouFora = false;
      // redesenhar a tela não pode apagar o que a pessoa já digitou nos campos (ex.: a tarefa nova antes de clicar em Adicionar)
      const guardados = M.$$('#view input[id], #view textarea[id], #view select[id]').filter((e) => e.type !== 'checkbox' && e.type !== 'file').map((e) => [e.id, e.value]);
      const foco = document.activeElement && document.activeElement.id;
      M.render();
      for (const [id, v] of guardados) { const e = document.getElementById(id); if (e && v && e.value !== v) e.value = v; }
      if (foco) { const e = document.getElementById(foco); if (e && e.closest('#view')) e.focus(); }
      if (M.aoSincronizar) M.aoSincronizar();
    }
  }
  setInterval(olhar, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) olhar(); });
  window.addEventListener('focus', olhar);

  let saveT = 0, driveT = 0;
  M.save = (quick) => {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      saveT = 0;
      if (enviando) { M.save(); return; } // espera a gravação anterior terminar
      enviando = true;
      try {
        await enviar();
        const dot = M.$('#savedot'); if (dot) { dot.classList.add('on'); setTimeout(() => dot.classList.remove('on'), 900); }
        const d = M.db.settings.drive;
        if (d && d.on && d.path) { clearTimeout(driveT); driveT = setTimeout(() => M.api('/api/drive/sync', { method: 'POST' }).catch(() => {}), 4000); }
      } catch (e) { M.toast('⚠️ Não consegui salvar: ' + e.message); }
      finally { enviando = false; }
    }, quick ? 0 : 350);
  };
  M.upload = async (file) => {
    const r = await fetch('/api/attach?name=' + encodeURIComponent(file.name), { method: 'POST', headers: Object.assign({ 'Content-Type': file.type || 'application/octet-stream' }, H), body: file });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro);
    return { id: M.uid(), name: j.name, file: j.file, size: j.size, mime: j.mime };
  };

  // ----- gamificação -----
  const LEVELS = ['Novato Pixel', 'Aprendiz de Bloco', 'Coletor de Cubos', 'Minerador', 'Artesão', 'Construtor', 'Explorador de Cavernas', 'Engenheiro Redstone', 'Mestre dos Blocos', 'Arquiteto Voxel', 'Domador de Creepers', 'Lenda do Loot'];
  M.levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
  M.levelXp = (l) => 40 * (l - 1) * (l - 1);
  M.levelName = (l) => LEVELS[Math.min(l - 1, LEVELS.length - 1)];

  // quanto cada ação vale e o limite por dia (anti-farm)
  const RULES = { item: { xp: 10, cap: 100 }, task: { xp: 15, cap: 150 }, check: { xp: 2, cap: 20 }, copy: { xp: 3, cap: 15 }, attach: { xp: 5, cap: 25 }, focus: { xp: 20, cap: 80 }, bonus: { xp: 25, cap: 25 }, habit: { xp: 5, cap: 40 }, goal: { xp: 25, cap: 50 } };

  M.ACH = [
    { id: 'first', em: '🌱', n: 'Primeiro bloco', d: 'Crie seu primeiro item', t: (g) => g.counters.item >= 1 },
    { id: 'items10', em: '🧱', n: 'Pilha de blocos', d: 'Crie 10 itens', t: (g) => g.counters.item >= 10 },
    { id: 'items50', em: '🏰', n: 'Castelo', d: 'Crie 50 itens', t: (g) => g.counters.item >= 50 },
    { id: 'task1', em: '🎯', n: 'Missão cumprida', d: 'Conclua 1 tarefa', t: (g) => g.counters.task >= 1 },
    { id: 'task10', em: '⚔️', n: 'Aventureiro', d: 'Conclua 10 tarefas', t: (g) => g.counters.task >= 10 },
    { id: 'task50', em: '👑', n: 'Herói das tarefas', d: 'Conclua 50 tarefas', t: (g) => g.counters.task >= 50 },
    { id: 'streak3', em: '🔥', n: 'Pegando fogo', d: '3 dias seguidos', t: (g) => g.streak.count >= 3 },
    { id: 'streak7', em: '☄️', n: 'Imparável', d: '7 dias seguidos', t: (g) => g.streak.count >= 7 },
    { id: 'copy10', em: '🪄', n: 'Mago dos prompts', d: 'Copie 10 prompts', t: (g) => g.counters.copy >= 10 },
    { id: 'check25', em: '☑️', n: 'Mestre da lista', d: 'Marque 25 itens de checklist', t: (g) => g.counters.check >= 25 },
    { id: 'goal', em: '⭐', n: 'Meta batida', d: 'Bata a meta do dia', t: (g) => g.goalDays >= 1 },
    { id: 'lvl5', em: '💎', n: 'Diamante', d: 'Chegue ao nível 5', t: (g) => M.levelOf(g.xp) >= 5 },
    { id: 'attach', em: '📎', n: 'Colecionador', d: 'Anexe um arquivo', t: (g) => g.counters.attach >= 1 },
    { id: 'hab1', em: '🌱', n: 'Primeiro passo', d: 'Marque um hábito como feito', t: (g) => g.counters.habit >= 1 },
    { id: 'hab7', em: '🔥', n: 'Hábito de ferro', d: 'Cumpra um hábito 7 dias seguidos', t: () => !!M.rotinaMaiorSeq && M.rotinaMaiorSeq() >= 7 },
    { id: 'meta1', em: '🏆', n: 'Meta batida', d: 'Chegue a 100% numa meta', t: (g) => g.counters.goal >= 1 },
  ];

  M.dayLog = () => {
    const g = M.db.game, k = M.today();
    return g.log[k] || (g.log[k] = { xp: 0, by: {} });
  };

  // concede XP; retorna quanto realmente deu (0 se bateu o limite)
  M.award = (kind, at) => {
    const g = M.db.game;
    g.counters[kind] = (g.counters[kind] || 0) + 1;
    const dl = M.dayLog(); dl.n = dl.n || {}; dl.n[kind] = (dl.n[kind] || 0) + 1;
    if (kind !== 'bonus' && M.checkQuests) M.checkQuests();
    let given = 0;
    if (M.db.settings.gamify) {
      const r = RULES[kind], log = M.dayLog();
      const used = log.by[kind] || 0;
      given = Math.max(0, Math.min(r.xp, r.cap - used));
      if (given > 0) {
        const before = M.levelOf(g.xp), goalBefore = log.xp >= M.db.settings.dailyGoal;
        g.xp += given; log.xp += given; log.by[kind] = used + given;
        touchStreak();
        if (at) FX.float('+' + given + ' XP', at.x, at.y);
        else FX.float('+' + given + ' XP', innerWidth - 120, 70);
        SFX.play(kind === 'task' ? 'done' : kind === 'check' ? 'check' : kind === 'copy' ? 'copy' : 'coin');
        const after = M.levelOf(g.xp);
        if (after > before) setTimeout(() => M.levelUp(after), 250);
        if (!goalBefore && log.xp >= M.db.settings.dailyGoal) {
          g.goalDays++; setTimeout(() => { SFX.play('goal'); FX.burst(null, null, 70); M.toast('⭐ Meta do dia batida!'); }, 400);
        }
      }
    }
    M.checkAch();
    M.renderHud();
    M.save();
    return given;
  };

  function touchStreak() {
    const s = M.db.game.streak, t = M.today();
    if (s.last === t) return;
    s.count = s.last === M.addDays(t, -1) ? s.count + 1 : 1;
    s.last = t;
  }

  M.checkAch = () => {
    const g = M.db.game;
    M.ACH.forEach((a) => {
      if (!g.achievements[a.id] && a.t(g)) {
        g.achievements[a.id] = M.today();
        setTimeout(() => { SFX.play('ach'); FX.burst(null, null, 40, 7); M.toast(`🏆 Conquista: ${a.em} ${a.n}`); }, 700);
      }
    });
  };

  M.levelUp = (lvl) => {
    const el = document.getElementById('levelup');
    el.innerHTML = `<div class="lu"><div class="big">LEVEL UP!</div><div class="lvbox">${lvl}</div><div class="nm">${M.esc(M.levelName(lvl))}</div></div>`;
    el.hidden = false;
    SFX.play('level'); FX.burst(innerWidth / 2, innerHeight / 2, 140, 13); setTimeout(() => FX.rain(), 300);
    const close = () => { el.hidden = true; el.onclick = null; };
    el.onclick = close; setTimeout(close, 3600);
    M.checkAch();
  };

  M.renderHud = () => {
    const g = M.db.game, xp = g.xp, lv = M.levelOf(xp);
    document.body.classList.toggle('nogame', !M.db.settings.gamify);
    const from = M.levelXp(lv), to = M.levelXp(lv + 1), pct = (xp - from) / (to - from);
    M.$('#lvlBadge').textContent = lv;
    M.$('#lvlName').textContent = M.levelName(lv);
    M.$('#xpbar').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < Math.floor(pct * 12) ? 'on' : ''}"></i>`).join('');
    M.$('#xpText').textContent = `${xp - from} / ${to - from} XP`;
    const live = g.streak.last === M.today() || g.streak.last === M.addDays(M.today(), -1) ? g.streak.count : 0;
    M.$('#hudStreak b').textContent = live;
    const day = (g.log[M.today()] || { xp: 0 }).xp, goal = M.db.settings.dailyGoal || 50;
    const on = Math.min(8, Math.floor((day / goal) * 8));
    M.$('#goalSlots').innerHTML = Array.from({ length: 8 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
    M.$('#hudGoal').title = `Meta de hoje: ${day} / ${goal} XP. Ganhe XP concluindo tarefas, hábitos e guardando itens.`;
    if (M.$('#goalTxt')) M.$('#goalTxt').textContent = `${Math.min(day, goal)}/${goal} XP`;
    if (M._lastXp != null && xp > M._lastXp) { const b = M.$('#lvlBadge'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    M._lastXp = xp;
  };

  // ----- ações sobre itens/tarefas (com lixeira) -----
  M.newItem = (o) => {
    const t = Date.now();
    return Object.assign({ id: M.uid(), type: 'nota', title: '', desc: '', content: '', checklist: [], links: [], attachments: [], cat: '', status: 'ver', tags: [], date: '', fav: false, created: t, updated: t }, o);
  };
  M.trashItem = (it) => {
    M.db.items = M.db.items.filter((x) => x.id !== it.id);
    M.db.trash.unshift({ kind: 'item', data: it, at: Date.now() });
    M.save(); SFX.play('trash');
    M.toast('🗑️ Item para a lixeira', () => M.restoreFromTrash(it.id, true));
    M.render();
  };
  M.trashTask = (t) => {
    M.db.tasks = M.db.tasks.filter((x) => x.id !== t.id);
    M.db.trash.unshift({ kind: 'task', data: t, at: Date.now() });
    M.save(); SFX.play('trash');
    M.toast('🗑️ Tarefa para a lixeira', () => M.restoreFromTrash(t.id, true));
    M.render();
  };
  M.restoreFromTrash = (id, silent) => {
    const i = M.db.trash.findIndex((x) => x.data.id === id);
    if (i < 0) return;
    const [e] = M.db.trash.splice(i, 1);
    (e.kind === 'item' ? M.db.items : e.kind === 'client' ? (M.db.clients || (M.db.clients = [])) : e.kind === 'fin' ? (M.db.fin || (M.db.fin = [])) : M.db.tasks).push(e.data);
    M.save(); SFX.play('undo'); M.render();
    if (!silent) M.toast('↩️ Restaurado');
  };

  M.allTags = () => {
    const s = new Set();
    M.db.items.forEach((i) => i.tags.forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  };
})();
