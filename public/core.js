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
  const H = { 'X-Mochila': '1' };
  M.api = async (path, opt) => {
    const r = await fetch(path, Object.assign({ headers: H }, opt));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  };
  M.load = async () => { M.db = await M.api('/api/db'); };

  let saveT = 0, driveT = 0;
  M.save = (quick) => {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try {
        await M.api('/api/db', { method: 'PUT', body: JSON.stringify(M.db) });
        const dot = M.$('#savedot'); if (dot) { dot.classList.add('on'); setTimeout(() => dot.classList.remove('on'), 900); }
        const d = M.db.settings.drive;
        if (d && d.on && d.path) { clearTimeout(driveT); driveT = setTimeout(() => M.api('/api/drive/sync', { method: 'POST' }).catch(() => {}), 4000); }
      } catch (e) { M.toast('⚠️ Não consegui salvar: ' + e.message); }
    }, quick ? 0 : 350);
  };
  M.upload = async (file) => {
    const r = await fetch('/api/attach?name=' + encodeURIComponent(file.name), { method: 'POST', headers: Object.assign({ 'Content-Type': file.type || 'application/octet-stream' }, H), body: file });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro);
    return { id: M.uid(), name: j.name, file: j.file, size: j.size, mime: j.mime };
  };

  // ----- gamificação -----
  const LEVELS = ['Novato Pixel', 'Aprendiz de Bloco', 'Coletor de Cubos', 'Minerador', 'Artesão', 'Construtor', 'Explorador de Cavernas', 'Engenheiro Redstone', 'Mestre dos Blocos', 'Arquiteto Voxel', 'Domador de Creepers', 'Lenda da Mochila'];
  M.levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
  M.levelXp = (l) => 40 * (l - 1) * (l - 1);
  M.levelName = (l) => LEVELS[Math.min(l - 1, LEVELS.length - 1)];

  // quanto cada ação vale e o limite por dia (anti-farm)
  const RULES = { item: { xp: 10, cap: 100 }, task: { xp: 15, cap: 150 }, check: { xp: 2, cap: 20 }, copy: { xp: 3, cap: 15 }, attach: { xp: 5, cap: 25 }, focus: { xp: 20, cap: 80 }, bonus: { xp: 25, cap: 25 } };

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
    M.$('#hudGoal').title = `Meta de hoje: ${day} / ${goal} XP`;
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
    (e.kind === 'item' ? M.db.items : M.db.tasks).push(e.data);
    M.save(); SFX.play('undo'); M.render();
    if (!silent) M.toast('↩️ Restaurado');
  };

  M.allTags = () => {
    const s = new Set();
    M.db.items.forEach((i) => i.tags.forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  };
})();
