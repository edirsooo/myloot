// MyLoot - servidor local (só módulos nativos do Node).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PORT = Number(process.env.MYLOOT_PORT || process.env.MOCHILA_PORT) || 4321;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = process.env.MYLOOT_DATA || process.env.MOCHILA_DATA || path.join(ROOT, 'data');
const DB = path.join(DATA, 'db.json');
const BAK = path.join(DATA, 'backups');
const ANX = path.join(DATA, 'anexos');
const MANIFEST = path.join(DATA, 'drive-manifest.json');
const DB_VERSION = 3;

for (const d of [DATA, BAK, ANX]) fs.mkdirSync(d, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

// ---------- dados ----------
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function defaults() {
  return {
    version: DB_VERSION,
    settings: { theme: 'dark', themeAuto: true, fontScale: 1, compact: false, sounds: true, confetti: true, gamify: true, dailyGoal: 50,
      view: 'grid', boardBy: 'status', aiModel: 'claude-opus-5-5', drive: { on: false, path: '' } },
    categories: [], items: [], tasks: [], trash: [],
    game: { xp: 0, log: {}, streak: { last: '', count: 0 }, achievements: {}, counters: {}, goalDays: 0 },
  };
}

// exemplos que vêm na primeira abertura (só quando ainda não existe db.json)
function seed() {
  const d = defaults();
  const now = Date.now();
  const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  d.categories = [
    { id: 'c-ia', name: 'Inteligência Artificial', icon: '🤖', color: '#8b5cf6' },
    { id: 'c-est', name: 'Estudos', icon: '🎓', color: '#3ad7ff' },
    { id: 'c-dev', name: 'Programação', icon: '💻', color: '#3cffaa' },
    { id: 'c-vida', name: 'Vida pessoal', icon: '🏡', color: '#ffbe46' },
  ];
  const mk = (i, o) => Object.assign({ id: 's' + i, type: 'nota', title: '', desc: '', content: '', checklist: [], links: [], attachments: [], cat: '', status: 'ver', tags: [], date: '', fav: false, created: now - i * 3600e3, updated: now - i * 3600e3 }, o);
  d.items = [
    mk(1, { type: 'prompt', title: 'Resumir texto em 5 tópicos', cat: 'c-ia', status: 'ok', fav: true, tags: ['resumo', 'chatgpt'], desc: 'Prompt curto para resumir qualquer texto.', content: 'Resuma o texto abaixo em 5 tópicos curtos, em português simples, destacando o que é mais importante:\n\n[COLE O TEXTO AQUI]' }),
    mk(2, { type: 'prompt', title: 'Explique como se eu tivesse 12 anos', cat: 'c-ia', status: 'and', tags: ['estudo'], desc: 'Para entender assuntos difíceis.', content: 'Explique [ASSUNTO] como se eu tivesse 12 anos. Use um exemplo do dia a dia e termine com 3 perguntas para eu testar o que aprendi.' }),
    mk(3, { type: 'comando', title: 'Ver quem usa uma porta no Windows', cat: 'c-dev', tags: ['windows', 'rede'], desc: 'Descobre qual programa está ocupando a porta.', content: 'netstat -ano | findstr :4321' }),
    mk(4, { type: 'comando', title: 'Criar pasta de projeto Node', cat: 'c-dev', tags: ['node'], content: 'mkdir meu-app && cd meu-app && npm init -y' }),
    mk(5, { type: 'estudo', title: 'Material de estudo (exemplo)', cat: 'c-est', status: 'ver', tags: ['pdf'], desc: 'Arraste um PDF aqui para anexar. Dá para pré-visualizar e abrir no Windows.', checklist: [{ id: 'k1', t: 'Ler o capítulo 1', done: true }, { id: 'k2', t: 'Fazer resumo', done: false }, { id: 'k3', t: 'Revisar no fim de semana', done: false }] }),
    mk(6, { type: 'instrucao', title: 'Passo a passo: publicar um site', cat: 'c-dev', status: 'and', tags: ['deploy'], desc: 'Checklist para publicar sem esquecer nada.', content: '1) Testar tudo localmente\n2) Conferir variáveis secretas\n3) Publicar\n4) Abrir o site e clicar em tudo', checklist: [{ id: 'k4', t: 'Testar localmente', done: true }, { id: 'k5', t: 'Conferir segredos', done: true }, { id: 'k6', t: 'Publicar', done: false }, { id: 'k7', t: 'Teste final', done: false }] }),
    mk(7, { type: 'link', title: 'Documentação do Node.js', cat: 'c-dev', tags: ['docs', 'node'], content: 'https://nodejs.org/docs/latest/api/', links: [{ id: 'l1', url: 'https://developer.mozilla.org', label: 'developer.mozilla.org' }] }),
    mk(8, { type: 'nota', title: 'Ideias para a semana', cat: 'c-vida', fav: true, tags: ['ideias'], date: day(2), desc: 'Anote tudo aqui antes de esquecer.', content: '• Organizar a mesa\n• Marcar consulta\n• Montar a rotina de estudos' }),
    mk(9, { type: 'nota', title: 'Bem-vindo ao MyLoot! 🎁', cat: 'c-vida', status: 'ver', fav: true, tags: ['comece-aqui'], desc: 'Guarde tudo num lugar só.', content: 'Dicas rápidas:\n• Ctrl+K busca em tudo\n• Arraste um arquivo para a janela para criar um item\n• Clique direito no cartão abre o menu\n• Concluir tarefas dá XP — suba de nível!' }),
  ];
  d.tasks = [
    { id: 't1', text: 'Revisar o capítulo 2', date: day(-1), prio: 'alta', done: false, created: now },
    { id: 't2', text: 'Responder mensagens importantes', date: day(0), prio: 'media', done: false, created: now },
    { id: 't3', text: 'Separar documentos para o curso', date: day(1), prio: 'baixa', done: false, created: now },
    { id: 't4', text: 'Estudar 30 minutos', date: day(3), prio: 'media', done: false, created: now },
    { id: 't5', text: 'Pesquisar ideias de projeto', date: '', prio: 'baixa', done: false, created: now },
  ];
  return d;
}

// migra qualquer formato antigo para o atual, sem perder nada
function migrate(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const out = Object.assign({}, d, raw);
  out.settings = Object.assign({}, d.settings, raw.settings || {});
  out.settings.drive = Object.assign({}, d.settings.drive, (raw.settings || {}).drive || {});
  out.game = Object.assign({}, d.game, raw.game || {});
  out.game.streak = Object.assign({}, d.game.streak, out.game.streak || {});
  for (const k of ['categories', 'items', 'tasks', 'trash']) if (!Array.isArray(out[k])) out[k] = [];
  out.items.forEach((it) => {
    it.id = it.id || uid();
    it.type = it.type || 'nota';
    it.title = it.title || '';
    it.desc = it.desc || '';
    it.content = it.content || '';
    it.checklist = Array.isArray(it.checklist) ? it.checklist : [];
    it.links = Array.isArray(it.links) ? it.links : [];
    it.attachments = Array.isArray(it.attachments) ? it.attachments : [];
    it.tags = Array.isArray(it.tags) ? it.tags : [];
    it.status = it.status || 'ver';
    it.cat = it.cat || '';
    it.date = it.date || '';
    it.fav = !!it.fav;
    it.created = it.created || Date.now();
    it.updated = it.updated || it.created;
  });
  out.tasks.forEach((t) => { t.id = t.id || uid(); t.text = t.text || ''; t.date = t.date || ''; t.prio = t.prio || 'media'; t.done = !!t.done; t.created = t.created || Date.now(); });
  out.version = DB_VERSION;
  return out;
}

function readDB() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB, 'utf8'));
    return { db: migrate(raw), fresh: false };
  } catch (e) {
    if (e.code === 'ENOENT') return { db: seed(), fresh: true };
    // arquivo corrompido: guarda cópia e tenta o último backup
    try { fs.copyFileSync(DB, path.join(DATA, 'db.corrompido-' + Date.now() + '.json')); } catch (_) {}
    const baks = fs.readdirSync(BAK).filter((f) => f.endsWith('.json')).sort().reverse();
    for (const b of baks) {
      try { return { db: migrate(JSON.parse(fs.readFileSync(path.join(BAK, b), 'utf8'))), fresh: false }; } catch (_) {}
    }
    return { db: defaults(), fresh: true };
  }
}

function writeDB(db) {
  const tmp = DB + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB);
  dailyBackup();
}

function dailyBackup() {
  const f = path.join(BAK, 'db-' + today() + '.json');
  if (fs.existsSync(f) || !fs.existsSync(DB)) return;
  try {
    fs.copyFileSync(DB, f);
    const all = fs.readdirSync(BAK).filter((x) => /^db-.*\.json$/.test(x)).sort();
    // mantém os 20 mais recentes (arquivos extras são movidos para _antigos, nunca apagados)
    const extra = all.slice(0, Math.max(0, all.length - 20));
    if (extra.length) {
      const old = path.join(BAK, '_antigos');
      fs.mkdirSync(old, { recursive: true });
      extra.forEach((x) => { try { fs.renameSync(path.join(BAK, x), path.join(old, x)); } catch (_) {} });
    }
  } catch (_) {}
}

// ---------- utilitários http ----------
function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}
const readBody = (req, max = 50e6) => new Promise((ok, no) => {
  const parts = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > max) { no(new Error('grande demais')); req.destroy(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts)));
  req.on('error', no);
});
const safeName = (n) => String(n || 'arquivo').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'arquivo';

function serveFile(req, res, file, extraHeaders) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { erro: 'não achei' });
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const h = Object.assign({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }, extraHeaders || {});
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      let s = range[1] ? parseInt(range[1], 10) : 0;
      let e = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (s >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      e = Math.min(e, st.size - 1);
      res.writeHead(206, Object.assign(h, { 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }));
      return fs.createReadStream(file, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, Object.assign(h, { 'Content-Length': st.size }));
    fs.createReadStream(file).pipe(res);
  });
}

function inside(base, p) {
  const rel = path.relative(base, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ---------- Google Drive ----------
function findDrive() {
  const out = [];
  for (let c = 65; c <= 90; c++) {
    const L = String.fromCharCode(c);
    for (const n of ['Meu Drive', 'My Drive']) {
      const p = `${L}:\\${n}`;
      try { if (fs.statSync(p).isDirectory()) out.push(p); } catch (_) {}
    }
  }
  const home = process.env.USERPROFILE || '';
  for (const p of [path.join(home, 'Google Drive'), path.join(home, 'My Drive'), path.join(home, 'Meu Drive')]) {
    try { if (fs.statSync(p).isDirectory()) out.push(p); } catch (_) {}
  }
  return out;
}

const TYPE_DIR = { estudo: 'Estudo-PDF', prompt: 'Prompts', instrucao: 'Instrucoes', comando: 'Comandos', link: 'Links', nota: 'Notas' };
const STATUS = { ver: 'Para ver', and: 'Em andamento', ok: 'Concluído' };
const slug = (s) => String(s || 'sem-titulo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'item';

function itemToMd(it, db) {
  const cat = db.categories.find((c) => c.id === it.cat);
  const L = [];
  L.push('---');
  L.push(`titulo: ${JSON.stringify(it.title)}`);
  L.push(`tipo: ${it.type}`);
  if (cat) L.push(`categoria: ${JSON.stringify(cat.name)}`);
  L.push(`status: ${STATUS[it.status] || it.status}`);
  if (it.tags.length) L.push(`etiquetas: [${it.tags.map((t) => JSON.stringify(t)).join(', ')}]`);
  if (it.date) L.push(`data: ${it.date}`);
  if (it.fav) L.push('favorito: true');
  L.push(`criado: ${new Date(it.created).toISOString()}`);
  L.push(`id: ${it.id}`);
  L.push('---', '', `# ${it.title || 'Sem título'}`, '');
  if (it.desc) L.push(it.desc, '');
  if (it.content) L.push(it.type === 'link' || it.type === 'nota' ? it.content : '```\n' + it.content + '\n```', '');
  if (it.checklist.length) { L.push('## Checklist'); it.checklist.forEach((c) => L.push(`- [${c.done ? 'x' : ' '}] ${c.t}`)); L.push(''); }
  if (it.links.length) { L.push('## Links'); it.links.forEach((l) => L.push(`- [${l.label || l.url}](${l.url})`)); L.push(''); }
  if (it.attachments.length) { L.push('## Anexos'); it.attachments.forEach((a) => L.push(`- [${a.name}](anexos/${it.id}/${encodeURIComponent(safeName(a.name))})`)); L.push(''); }
  return L.join('\n');
}

function driveSync(db) {
  const cfg = db.settings.drive || {};
  if (!cfg.path) throw new Error('Escolha a pasta do Drive.');
  if (!fs.existsSync(cfg.path)) throw new Error('A pasta do Drive não existe: ' + cfg.path);
  const antigo = path.join(cfg.path, 'Mochila'), base = fs.existsSync(antigo) && !fs.existsSync(path.join(cfg.path, 'MyLoot')) ? antigo : path.join(cfg.path, 'MyLoot');
  fs.mkdirSync(base, { recursive: true });
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (_) {}
  const next = {};
  let written = 0;
  for (const it of db.items) {
    const dir = path.join(base, TYPE_DIR[it.type] || 'Outros');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug(it.title)}-${it.id}.md`);
    const md = itemToMd(it, db);
    let same = false;
    try { same = fs.readFileSync(file, 'utf8') === md; } catch (_) {}
    if (!same) { fs.writeFileSync(file, md); written++; }
    next[file] = true;
    for (const a of it.attachments) {
      const src = path.join(ANX, path.basename(a.file || ''));
      if (!fs.existsSync(src)) continue;
      const adir = path.join(dir, 'anexos', it.id);
      fs.mkdirSync(adir, { recursive: true });
      const dst = path.join(adir, safeName(a.name));
      try {
        const s1 = fs.statSync(src), s2 = fs.existsSync(dst) ? fs.statSync(dst) : null;
        if (!s2 || s2.size !== s1.size) { fs.copyFileSync(src, dst); written++; }
      } catch (_) {}
      next[dst] = true;
    }
  }
  // remove do Drive o que foi apagado no app (só o que o app mesmo criou)
  let removed = 0;
  for (const f of Object.keys(manifest)) {
    if (!next[f] && inside(base, f)) { try { fs.unlinkSync(f); removed++; } catch (_) {} }
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(next));
  return { escritos: written, removidos: removed, itens: db.items.length, pasta: base };
}

// ---------- Claude (API da Anthropic) ----------
// A chave fica em data/segredos.json, fora do db.json: não entra no backup nem vai para o Drive.
const https = require('https');
const INT = require('./integracoes');
const SECRETS = path.join(DATA, 'segredos.json');
const AI_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const readSecrets = () => { try { return JSON.parse(fs.readFileSync(SECRETS, 'utf8')); } catch (_) { return {}; } };
function writeSecrets(s) { const tmp = SECRETS + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s)); fs.renameSync(tmp, SECRETS); }

const AI_ACTIONS = {
  melhorar: 'Melhore o texto: mais claro, direto e bem escrito, mantendo o sentido, o idioma e o tamanho aproximado.',
  corrigir: 'Corrija ortografia, gramática e pontuação. Não mude o estilo nem o conteúdo.',
  resumir: 'Resuma o texto em poucos tópicos curtos, no mesmo idioma.',
  encurtar: 'Deixe o texto mais curto, cortando o que sobra e mantendo o essencial.',
  prompt: 'O texto é um prompt para uma IA. Reescreva-o para ficar mais claro e eficaz: diga o objetivo, o contexto, o formato da resposta e as restrições. Mantenha os marcadores entre colchetes.',
  checklist: 'Transforme o texto em uma lista de passos práticos, um por linha, sem numeração nem marcadores.',
  titulo: 'Sugira um título curto (até 8 palavras) para o texto. Responda só com o título.',
  livre: '',
};

function callClaude(key, model, system, user) {
  const body = { model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] };
  const headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2026-10-21' };
  if (model !== 'claude-haiku-5-5') { // se o modelo recusar, a API tenta sozinha num modelo reserva
    body.output_config = { effort: 'medium' };
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  const data = Buffer.from(JSON.stringify(body));
  headers['Content-Length'] = data.length;
  return new Promise((ok, no) => {
    const rq = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers, timeout: 180000 }, (rs) => {
      const parts = [];
      rs.on('data', (c) => parts.push(c));
      rs.on('end', () => {
        let j = {};
        try { j = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (_) {}
        const st = rs.statusCode;
        if (st === 401) return no(new Error('A chave da API não foi aceita. Confira nas Configurações.'));
        if (st === 429) return no(new Error('Muitos pedidos ou sem crédito na conta. Tente de novo daqui a pouco.'));
        if (st === 529 || st >= 500) return no(new Error('O Claude está sobrecarregado agora. Tente de novo em instantes.'));
        if (st !== 200) return no(new Error((j.error && j.error.message) || 'Erro ' + st + ' na API.'));
        if (j.stop_reason === 'refusal') return no(new Error('O Claude não pôde atender a esse pedido.'));
        const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
        if (!text) return no(new Error('A resposta veio vazia.'));
        ok({ texto: text, modelo: j.model, cortado: j.stop_reason === 'max_tokens' });
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('Demorou demais. Tente de novo.')));
    rq.on('error', (e) => no(new Error(e.code === 'ENOTFOUND' ? 'Sem internet.' : e.message)));
    rq.end(data);
  });
}

// ---------- IAs locais: Claude Code e Codex (usam a assinatura já logada no computador, sem chave da API) ----------
const IA_CMD = { claude: 'claude --version', codex: 'codex --version' };
const iaCache = {};
function iaInfo(nome, force) {
  if (iaCache[nome] && !force) return iaCache[nome];
  try {
    const out = cp.execSync(IA_CMD[nome], { encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const v = (out.match(/\d+\.\d+[\d.]*/) || [''])[0];
    iaCache[nome] = { ok: !!out.trim(), versao: v };
  } catch (_) { iaCache[nome] = { ok: false }; }
  return iaCache[nome];
}
const claudeCodeInfo = (force) => iaInfo('claude', force);
const pastaIA = (n) => { const d = path.join(require('os').tmpdir(), 'myloot-' + n); fs.mkdirSync(d, { recursive: true }); return d; };
function callCodex(system, user) {
  return new Promise((ok, no) => {
    // pasta vazia, só leitura, sem histórico: o Codex só escreve a resposta
    const dir = pastaIA('codex'), saida = path.join(dir, 'resposta.txt');
    try { fs.writeFileSync(saida, ''); } catch (_) {}
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--color', 'never', '-C', '"' + dir + '"', '-o', '"' + saida + '"', '-'];
    const ch = cp.spawn('codex', args, { cwd: dir, shell: true, windowsHide: true });
    const err = [];
    const t = setTimeout(() => { ch.kill(); no(new Error('O Codex demorou demais. Tente de novo.')); }, 240000);
    ch.stdout.on('data', (c) => err.push(c));
    ch.stderr.on('data', (c) => err.push(c));
    ch.on('error', () => { clearTimeout(t); no(new Error('Não achei o Codex neste computador.')); });
    ch.on('close', (code) => {
      clearTimeout(t);
      let txt = ''; try { txt = fs.readFileSync(saida, 'utf8').trim(); } catch (_) {}
      if (code === 0 && txt) return ok({ texto: txt, modelo: 'codex', via: 'codex' });
      const msg = Buffer.concat(err).toString('utf8').trim();
      if (/log ?in|auth|unauthorized/i.test(msg)) return no(new Error('O Codex não está logado. Abra um terminal, rode "codex" e faça o login.'));
      no(new Error('O Codex respondeu com erro: ' + (msg.split(/\r?\n/).slice(-3).join(' ') || 'código ' + code).slice(0, 300)));
    });
    ch.stdin.end(system + '\n\n' + user);
  });
}
function callClaudeCode(model, system, user) {
  return new Promise((ok, no) => {
    // pasta vazia como diretório de trabalho: o Claude Code não enxerga nenhum projeto
    const dir = pastaIA('claude');
    const args = ['-p', '--output-format', 'json', '--model', model, '--system-prompt', JSON.stringify(system), '--tools', '""', '--no-session-persistence', '--strict-mcp-config'];
    const ch = cp.spawn('claude', args, { cwd: dir, shell: true, windowsHide: true });
    const out = [], err = [];
    const t = setTimeout(() => { ch.kill(); no(new Error('O Claude Code demorou demais. Tente de novo.')); }, 240000);
    ch.stdout.on('data', (c) => out.push(c));
    ch.stderr.on('data', (c) => err.push(c));
    ch.on('error', () => { clearTimeout(t); no(new Error('Não achei o Claude Code neste computador.')); });
    ch.on('close', (code) => {
      clearTimeout(t);
      const txt = Buffer.concat(out).toString('utf8').trim();
      let j = null; try { j = JSON.parse(txt.slice(txt.indexOf('{'))); } catch (_) {}
      if (j && !j.is_error && j.result) return ok({ texto: String(j.result).trim(), modelo: model, via: 'claude' });
      const msg = (j && j.result) || Buffer.concat(err).toString('utf8').trim() || txt;
      if (/log ?in|auth|login/i.test(msg)) return no(new Error('O Claude Code não está logado. Abra um terminal, rode "claude" e faça o login.'));
      no(new Error('O Claude Code respondeu com erro: ' + (msg || 'código ' + code).slice(0, 300)));
    });
    ch.stdin.end(user);
  });
}

// ---------- foco (o relógio mora no servidor: continua contando com a aba fechada) ----------
const FOCO = path.join(DATA, 'foco.json');
let foco = { end: 0, min: 25, pendentes: 0 };
let focoT = null;
try { foco = Object.assign(foco, JSON.parse(fs.readFileSync(FOCO, 'utf8'))); } catch (_) {}
const saveFoco = () => { try { fs.writeFileSync(FOCO, JSON.stringify(foco)); } catch (_) {} };

// aviso na área de trabalho do Windows (toast; se não der, balão na bandeja)
function notify(title, text) {
  if (process.platform !== 'win32' || (process.env.MYLOOT_SEM_AVISO || process.env.MOCHILA_SEM_AVISO)) return;
  const q = (s) => String(s).replace(/'/g, "''");
  const ico = path.join(ROOT, 'MyLoot.ico');
  const ps = `
$t='${q(title)}'; $m='${q(text)}'
try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
  $x = New-Object Windows.Data.Xml.Dom.XmlDocument
  $x.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$([Security.SecurityElement]::Escape($t))</text><text>$([Security.SecurityElement]::Escape($m))</text></binding></visual><audio src='ms-winsoundevent:Notification.Reminder'/></toast>")
  $n = [Windows.UI.Notifications.ToastNotification]::new($x)
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($n)
} catch {
  Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
  $i = New-Object System.Windows.Forms.NotifyIcon
  try { $i.Icon = New-Object System.Drawing.Icon('${q(ico)}') } catch { $i.Icon = [System.Drawing.SystemIcons]::Information }
  $i.Visible = $true; $i.ShowBalloonTip(8000, $t, $m, 'Info'); Start-Sleep 9; $i.Dispose()
}`;
  try {
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', b64], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (_) {}
}

function armFoco() {
  clearTimeout(focoT);
  if (!foco.end) return;
  const left = foco.end - Date.now();
  const done = (avisar) => {
    foco.end = 0; foco.pendentes = (foco.pendentes || 0) + 1; saveFoco();
    if (avisar) notify('⏱ Foco concluído!', `Você ficou ${foco.min} minutos focado. Abra o MyLoot para pegar seu XP.`);
  };
  if (left <= 0) return done(false); // terminou enquanto o servidor estava desligado
  focoT = setTimeout(() => done(true), left);
}
armFoco();

// ---------- pacotes de conteúdo (pasta exemplos/): entram uma vez só, sem duplicar ----------
function applyPacks(db) {
  const dir = path.join(ROOT, 'exemplos');
  let changed = false;
  let packs = [];
  try { packs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (_) { return false; }
  db.packs = Array.isArray(db.packs) ? db.packs : [];
  for (const f of packs) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
    if (!p.id || db.packs.includes(p.id)) continue;
    if (p.categoria && !db.categories.find((c) => c.id === p.categoria.id)) db.categories.push(p.categoria);
    const now = Date.now();
    (p.itens || []).forEach((it, i) => {
      const attachments = [];
      for (const a of it.arquivos || []) {
        const src = path.join(dir, path.basename(p.pasta || ''), path.basename(a));
        if (!fs.existsSync(src)) continue;
        const file = uid() + '-' + safeName(a);
        try { fs.copyFileSync(src, path.join(ANX, file)); attachments.push({ id: uid(), name: a, file, size: fs.statSync(src).size, mime: MIME[path.extname(a).toLowerCase()] || '' }); } catch (_) {}
      }
      db.items.push({ id: p.id + '-' + i, type: it.tipo || 'estudo', title: it.titulo || '', desc: it.descricao || '', content: it.conteudo || '', checklist: [], links: it.links || [], attachments,
        cat: p.categoria ? p.categoria.id : '', status: 'ver', tags: it.etiquetas || [], date: '', fav: !!it.favorito, created: now - i * 1000, updated: now - i * 1000 });
    });
    db.packs.push(p.id);
    changed = true;
  }
  return changed;
}

// ---------- rotas ----------
const server = http.createServer(async (req, res) => {
  try {
    const host = (req.headers.host || '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, { erro: 'host' });
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);

    if (p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers['x-myloot'] !== '1' && req.headers['x-mochila'] !== '1') return send(res, 403, { erro: 'cabeçalho' });
      if (p === '/api/ping') return send(res, 200, { ok: true, app: 'myloot' });
      if (p === '/api/db' && req.method === 'GET') {
        const { db, fresh } = readDB();
        if (fresh) writeDB(db);
        return send(res, 200, db);
      }
      if (p === '/api/db' && req.method === 'PUT') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        writeDB(migrate(body));
        return send(res, 200, { ok: true });
      }
      if (p === '/api/attach' && req.method === 'POST') {
        const name = safeName(u.searchParams.get('name'));
        const file = uid() + '-' + name;
        const dst = path.join(ANX, file);
        await new Promise((ok, no) => {
          const ws = fs.createWriteStream(dst);
          req.pipe(ws); ws.on('finish', ok); ws.on('error', no); req.on('error', no);
        });
        return send(res, 200, { file, name, size: fs.statSync(dst).size, mime: req.headers['content-type'] || '' });
      }
      if ((p === '/api/open' || p === '/api/reveal') && req.method === 'POST') {
        const { file } = JSON.parse((await readBody(req)).toString('utf8'));
        const full = path.join(ANX, path.basename(String(file || '')));
        if (!inside(ANX, full) || !fs.existsSync(full)) return send(res, 404, { erro: 'arquivo não achado' });
        const args = p === '/api/open' ? [full] : ['/select,' + full];
        cp.spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
        return send(res, 200, { ok: true });
      }
      if (p === '/api/backup') {
        const { db } = readDB();
        return send(res, 200, JSON.stringify(db, null, 1), 'application/json');
      }
      if (p === '/api/restore' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (!body || !Array.isArray(body.items)) return send(res, 400, { erro: 'Esse arquivo não parece um backup do MyLoot.' });
        if (fs.existsSync(DB)) fs.copyFileSync(DB, path.join(BAK, 'antes-de-restaurar-' + Date.now() + '.json'));
        writeDB(migrate(body));
        return send(res, 200, { ok: true });
      }
      if (p === '/api/drive/find') return send(res, 200, { pastas: findDrive() });
      if (p === '/api/drive/sync' && req.method === 'POST') {
        try {
          const { db } = readDB();
          return send(res, 200, driveSync(db));
        } catch (e) { return send(res, 400, { erro: e.message }); }
      }
      if (p === '/api/focus' && req.method === 'GET') return send(res, 200, { end: foco.end, min: foco.min, pendentes: foco.pendentes || 0, agora: Date.now() });
      if (p === '/api/focus/start' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        foco.min = Math.max(1, Math.min(180, Number(b.min) || 25));
        foco.end = Date.now() + (Number(b.ms) > 0 ? Number(b.ms) : foco.min * 60000);
        saveFoco(); armFoco();
        return send(res, 200, { end: foco.end, min: foco.min, agora: Date.now() });
      }
      if (p === '/api/focus/stop' && req.method === 'POST') { foco.end = 0; clearTimeout(focoT); saveFoco(); return send(res, 200, { ok: true }); }
      if (p === '/api/focus/claim' && req.method === 'POST') { const n = foco.pendentes || 0; foco.pendentes = 0; saveFoco(); return send(res, 200, { n }); }
      if (p === '/api/notify-test' && req.method === 'POST') { notify('🎁 MyLoot', 'É assim que o aviso do foco aparece.'); return send(res, 200, { ok: true }); }
      if (p === '/api/ai/status') {
        const f = u.searchParams.get('checar') === '1';
        const claude = iaInfo('claude', f), codex = iaInfo('codex', f);
        return send(res, 200, { temChave: !!readSecrets().anthropicKey, modelos: AI_MODELS, code: claude, claude, codex });
      }
      if (p === '/api/ai/key' && req.method === 'POST') {
        const { key } = JSON.parse((await readBody(req)).toString('utf8'));
        const s = readSecrets();
        const k = String(key || '').trim();
        if (k) s.anthropicKey = k; else delete s.anthropicKey;
        writeSecrets(s);
        return send(res, 200, { temChave: !!k });
      }
      if (p === '/api/ai' && req.method === 'POST') {
        const key = readSecrets().anthropicKey;
        const b = JSON.parse((await readBody(req)).toString('utf8'));
        // qual IA: a escolhida no pedido, ou a das Configurações; "auto" pega a primeira ligada e instalada
        const st = readDB().db.settings, ligadas = st.aiTools || {};
        let pref = b.via || st.aiVia || 'auto'; if (pref === 'code') pref = 'claude';
        const pode = (n) => ligadas[n] !== false && iaInfo(n).ok;
        let via = pref === 'api' ? 'api' : pref === 'auto' ? (['claude', 'codex'].find(pode) || 'api') : (pode(pref) ? pref : null);
        if (!via) return send(res, 400, { erro: (pref === 'codex' ? 'O Codex' : 'O Claude Code') + ' não está instalado ou está desligado nas Configurações.' });
        if (via === 'api' && !key) return send(res, 400, { erro: 'Nenhuma IA encontrada. Instale o Claude Code ou o Codex, ou coloque uma chave da API do Claude nas Configurações.' });
        const texto = String(b.texto || ''), pedido = String(b.pedido || '').trim();
        const inst = b.acao === 'livre' ? pedido : AI_ACTIONS[b.acao];
        if (!inst) return send(res, 400, { erro: 'Escreva o que você quer que a IA faça.' });
        const { db } = readDB();
        const model = AI_MODELS.includes(db.settings.aiModel) ? db.settings.aiModel : AI_MODELS[0];
        const system = 'Você é o assistente de escrita de um app pessoal de notas chamado MyLoot. Responda só com o texto final, pronto para colar: sem introdução, sem explicação, sem aspas em volta e sem cercas de código. Use o idioma do texto (por padrão, português do Brasil).';
        const user = texto.trim() ? `Pedido: ${inst}\n\n<texto>\n${texto}\n</texto>` : `Pedido: ${inst}`;
        try { return send(res, 200, via === 'claude' ? await callClaudeCode(model, system, user) : via === 'codex' ? await callCodex(system, user) : await callClaude(key, model, system, user)); }
        catch (e) { return send(res, 502, { erro: e.message }); }
      }
      // ----- integrações (Notion e Trello) -----
      if (p === '/api/int/status') {
        const x = readSecrets(), n = x.notion || {}, t = x.trello || {};
        return send(res, 200, { notion: { ok: !!(n.token && n.alvo), temToken: !!n.token, alvoNome: n.alvoNome || '' }, trello: { ok: !!(t.key && t.token && t.alvo), temChave: !!(t.key && t.token), alvoNome: t.alvoNome || '' } });
      }
      if (p.startsWith('/api/int/') && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        const x = readSecrets();
        try {
          if (p === '/api/int/notion/paginas') return send(res, 200, { paginas: await INT.notionPaginas(b.token || (x.notion || {}).token || '') });
          if (p === '/api/int/trello/listas') {
            const o = x.trello || {};
            return send(res, 200, { listas: await INT.trelloListas(b.key || o.key || '', b.token || o.token || '') });
          }
          if (p === '/api/int/salvar') {
            for (const k of ['notion', 'trello']) {
              if (!(k in b)) continue;
              if (b[k] === null) { delete x[k]; continue; }
              const novo = Object.assign({}, x[k] || {});
              for (const [kk, v] of Object.entries(b[k])) if (v) novo[kk] = String(v);
              x[k] = novo;
            }
            writeSecrets(x);
            return send(res, 200, { ok: true });
          }
          const m = p.match(/^\/api\/int\/(notion|trello)\/enviar$/);
          if (m) {
            const it = readDB().db.items.find((i) => i.id === b.id);
            if (!it) return send(res, 404, { erro: 'Item não encontrado.' });
            const cfg = x[m[1]] || {};
            if (!cfg.alvo) return send(res, 400, { erro: 'Conecte nas Configurações primeiro.' });
            return send(res, 200, m[1] === 'notion' ? await INT.notionEnviar(cfg, it) : await INT.trelloEnviar(cfg, it));
          }
        } catch (e) { return send(res, 502, { erro: e.message }); }
      }
      if (p === '/api/shutdown' && req.method === 'POST') {
        send(res, 200, { ok: true });
        setTimeout(() => process.exit(0), 250);
        return;
      }
      return send(res, 404, { erro: 'rota' });
    }

    if (p.startsWith('/anexos/')) {
      const full = path.join(ANX, path.basename(p));
      const down = u.searchParams.get('baixar') ? { 'Content-Disposition': 'attachment' } : {};
      return serveFile(req, res, full, down);
    }

    let rel = p === '/' ? '/index.html' : p;
    const full = path.join(PUB, rel);
    if (!inside(PUB, full)) return send(res, 403, { erro: 'caminho' });
    return serveFile(req, res, full);
  } catch (e) {
    send(res, 500, { erro: String(e.message || e) });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log('O MyLoot já está aberto na porta ' + PORT + '.'); process.exit(0); }
  console.error(e); process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`MyLoot rodando em http://${HOST}:${PORT}  (feche esta janela para desligar)`);
  const { db, fresh } = readDB();
  const novos = applyPacks(db);
  if (fresh || novos) writeDB(db); else dailyBackup();
});
