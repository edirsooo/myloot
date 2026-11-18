// MyLoot - servidor local (só módulos nativos do Node).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const crypto = require('crypto');
const stream = require('stream');
const zlib = require('zlib');
const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';

const PORT = Number(process.env.MYLOOT_PORT || process.env.MOCHILA_PORT) || 4321;
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = process.env.MYLOOT_DATA || process.env.MOCHILA_DATA || path.join(ROOT, 'data');
const DB = path.join(DATA, 'db.json');
const BAK = path.join(DATA, 'backups');
const ANX = path.join(DATA, 'anexos');
const MANIFEST = path.join(DATA, 'drive-manifest.json');
const DB_VERSION = 3;

for (const d of [DATA, BAK, ANX]) fs.mkdirSync(d, { recursive: true });

// anexos que podem abrir dentro do app (o resto sempre baixa como arquivo)
const ANEXO_NA_TELA = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.txt', '.md', '.mp3', '.wav', '.ogg', '.opus', '.m4a', '.mp4', '.webm']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

// ---------- dados ----------
const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }; // dia local
// id de item usado em nome de pasta/arquivo (Drive, exportar): só letras, números, _ e -; nunca sai da pasta
const idSeg = (id) => String(id == null ? '' : id).replace(/[^\w-]/g, '_').slice(0, 80) || 'item';
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function defaults() {
  return {
    version: DB_VERSION,
    settings: { theme: 'dark', themeAuto: true, fontScale: 1, compact: false, sounds: true, musica: false, musicaVol: 0.2, musicaLoop: false, confetti: true, gamify: true, dailyGoal: 50,
      view: 'grid', boardBy: 'status', janela: 'app', aiModel: 'claude-opus-5-5', drive: { on: false, path: '' } },
    categories: [], items: [], tasks: [], trash: [], clients: [], fin: [], habits: [], goals: [], tools: [],
    game: { xp: 0, log: {}, streak: { last: '', count: 0 }, achievements: {}, counters: {}, goalDays: 0 },
  };
}

// primeira abertura (só quando ainda não existe db.json): categorias básicas e a nota de boas-vindas.
// Tarefas, clientes e financeiro nascem vazios; os materiais prontos entram pelos pacotes da pasta exemplos/.
function seed() {
  const d = defaults();
  const now = Date.now();
  d.categories = [
    { id: 'c-ia', name: 'Inteligência Artificial', icon: '🤖', color: '#8b5cf6' },
    { id: 'c-est', name: 'Estudos', icon: '📘', color: '#3ad7ff' },
    { id: 'c-dev', name: 'Programação', icon: '💻', color: '#3cffaa' },
    { id: 'c-vida', name: 'Vida pessoal', icon: '🏡', color: '#ffbe46' },
  ];
  const mk = (i, o) => Object.assign({ id: 's' + i, type: 'nota', title: '', desc: '', content: '', checklist: [], links: [], attachments: [], cat: '', status: 'ver', tags: [], date: '', fav: false, created: now - i * 3600e3, updated: now - i * 3600e3 }, o);
  d.items = [
    mk(9, { type: 'nota', title: 'Bem-vindo ao MyLoot! 🎁', cat: 'c-vida', status: 'ver', fav: true, tags: ['comece-aqui'], desc: 'Guarde tudo num lugar só.', content: 'Dicas rápidas:\n• Ctrl+K busca em tudo\n• Arraste um arquivo para a janela para criar um item\n• Clique direito no cartão abre o menu\n• Concluir tarefas dá XP — suba de nível!' }),
  ];
  return d;
}

// ids e valores que a tela põe dentro de atributos HTML: só caracteres seguros (dado vindo de backup, nuvem ou outro programa
// não consegue injetar código). A mesma troca vale para o id e para quem aponta para ele, então as ligações continuam.
const SEGURO = /^[\w.:-]{1,100}$/;
const sid = (v) => (v == null || v === '' ? v : SEGURO.test(String(v)) ? v : String(v).replace(/[^\w.:-]/g, '_').slice(0, 100));
const COR = /^#[0-9a-f]{3,8}$/i;
const umDe = (v, L, pad) => (L.includes(v) ? v : pad);
const TIPOS = ['estudo', 'prompt', 'instrucao', 'comando', 'link', 'nota'], ST_ITEM = ['ver', 'and', 'ok'], ST_CLI = ['prospect', 'ativo', 'pausado', 'encerrado'], PRIOS = ['baixa', 'media', 'alta'];
function limparIds(out) {
  for (const k of ['categories', 'items', 'tasks', 'clients', 'fin', 'habits', 'goals', 'tools']) for (const o of out[k]) { if (o.id != null) o.id = sid(o.id); }
  for (const c of out.categories) { if (c.color != null && !COR.test(String(c.color))) c.color = '#8b5cf6'; }
  for (const t of out.trash) { if (t.data && typeof t.data === 'object' && t.data.id != null) t.data.id = sid(t.data.id); if (t.kind != null) t.kind = sid(t.kind); }
  for (const k of ['items', 'tasks', 'fin']) for (const o of out[k]) { if (o.client) o.client = sid(o.client); if (o.serie) o.serie = sid(o.serie); }
  for (const it of out.items) { if (it.cat) it.cat = sid(it.cat); }
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
  for (const k of ['categories', 'items', 'tasks', 'trash', 'clients', 'fin', 'habits', 'goals', 'tools']) out[k] = Array.isArray(out[k]) ? out[k].filter((o) => o && typeof o === 'object' && !Array.isArray(o)) : [];
  out.fin.forEach((f) => {
    f.id = f.id || uid(); f.tipo = f.tipo === 'saida' ? 'saida' : 'entrada'; f.valor = Math.round((Number(f.valor) || 0) * 100) / 100;
    f.data = /^\d{4}-\d\d-\d\d$/.test(f.data || '') ? f.data : today(); f.pago = !!f.pago;
    for (const k of ['desc', 'pagoEm', 'cat', 'client', 'forma', 'serie', 'parc', 'obs']) f[k] = f[k] || '';
  });
  out.clients.forEach((c) => {
    c.id = c.id || uid(); c.nome = c.nome || ''; c.status = c.status || 'ativo';
    for (const k of ['empresa', 'email', 'whats', 'insta', 'site', 'trello', 'pasta', 'notas']) c[k] = c[k] || '';
    c.tags = Array.isArray(c.tags) ? c.tags : []; c.created = c.created || Date.now(); c.updated = c.updated || c.created;
    c.status = umDe(c.status, ST_CLI, 'ativo');
  });
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
    it.status = umDe(it.status || 'ver', ST_ITEM, 'ver');
    it.type = umDe(it.type, TIPOS, 'nota');
    it.cat = it.cat || '';
    it.date = it.date || '';
    it.fav = !!it.fav;
    it.client = it.client || '';
    it.created = it.created || Date.now();
    it.updated = it.updated || it.created;
  });
  out.tasks.forEach((t) => { t.id = t.id || uid(); t.text = t.text || ''; t.date = t.date || ''; t.prio = t.prio || 'media'; t.done = !!t.done; t.created = t.created || Date.now(); t.client = t.client || ''; t.rep = t.rep || ''; t.hora = t.hora || ''; t.prio = umDe(t.prio, PRIOS, 'media'); });
  limparIds(out);
  out.version = DB_VERSION;
  return out;
}

function readDB() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB, 'utf8'));
    return { db: migrate(raw), fresh: false };
  } catch (e) {
    if (e.code === 'ENOENT') return { db: seed(), fresh: true };
    // arquivo corrompido: guarda cópia, volta para a cópia automática mais nova e grava ela no lugar
    // (uma vez só; antes cada leitura fazia outra cópia do arquivo estragado). A nuvem fica parada até a pessoa conferir.
    try { fs.copyFileSync(DB, path.join(DATA, 'db.corrompido-' + Date.now() + '.json')); } catch (_) {}
    const baks = fs.readdirSync(BAK).filter((f) => RE_COPIA.test(f)).map((f) => ({ f, t: fs.statSync(path.join(BAK, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f: b } of baks) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(BAK, b), 'utf8'));
        if (!raw || !Array.isArray(raw.items)) continue;
        const db = migrate(raw);
        gravarArquivo(DB, JSON.stringify(db, null, 1));
        REV++;
        RECUPERADO = { de: b, em: Date.now() };
        logErro('db.json ilegível: recuperado da cópia ' + b + ' (' + e.message + ')');
        return { db, fresh: false };
      } catch (_) {}
    }
    return { db: defaults(), fresh: true };
  }
}

// REV muda a cada gravação: o PC e o celular comparam para não salvar um por cima do outro
let REV = Date.now();
let RECUPERADO = null; // { de, em } quando o db.json estava ilegível e voltou de uma cópia
const ERROS = path.join(DATA, 'erros.log');
function logErro(msg) { try { fs.appendFileSync(ERROS, new Date().toISOString() + ' ' + String(msg).slice(0, 2000) + '\n'); } catch (_) {} }
// grava em .tmp, força o disco (queda de energia não deixa arquivo vazio) e só então troca
function gravarArquivo(f, txt) {
  const tmp = f + '.tmp', fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, txt); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, f);
}
function writeDB(db, daNuvem) {
  dailyBackup(); // a cópia do dia guarda o banco de ANTES da primeira gravação do dia
  gravarArquivo(DB, JSON.stringify(db, null, 1));
  REV++;
  if (!daNuvem) { NUVEM.marcar(db); NUVEM.agendar(); } // mandou para a nuvem alguns segundos depois de salvar
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
// compressão só para quem vem pela rede (celular): no próprio PC comprimir custa mais do que economiza
const TEXTO = /^(text\/|application\/json|application\/javascript|image\/svg)/;
function comprimir(req, tipo, n) {
  if (!req || n < 2048 || !TEXTO.test(tipo || '')) return false;
  const ip = String(req.socket && req.socket.remoteAddress || '');
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return false;
  return /\bgzip\b/.test(req.headers['accept-encoding'] || '');
}
function send(res, code, body, type, extra) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const h = Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {});
  if (!h['Content-Encoding'] && !h['Content-Disposition'] && comprimir(res.req, h['Content-Type'], buf.length)) {
    buf = zlib.gzipSync(buf, { level: 5 }); h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding';
  }
  h['Content-Length'] = buf.length;
  res.writeHead(code, h);
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
    // no-cache + ETag: o navegador guarda e só pergunta se mudou (304); atualização do app continua aparecendo na hora
    const etag = 'W/"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
    const h = Object.assign({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ETag: etag }, extraHeaders || {});
    if (req.headers['if-none-match'] === etag && !req.headers.range) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      let s = range[1] ? parseInt(range[1], 10) : 0;
      let e = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (s >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      e = Math.min(e, st.size - 1);
      if (e < s) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, Object.assign(h, { 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }));
      return fs.createReadStream(file, { start: s, end: e }).on('error', () => res.destroy()).pipe(res);
    }
    if (st.size < 4e6 && comprimir(req, type, st.size)) {
      return fs.readFile(file, (e2, b) => {
        if (e2) return send(res, 500, { erro: 'não consegui ler' });
        const z = zlib.gzipSync(b, { level: 6 });
        res.writeHead(200, Object.assign(h, { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': z.length }));
        res.end(z);
      });
    }
    res.writeHead(200, Object.assign(h, { 'Content-Length': st.size }));
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

function inside(base, p) {
  const rel = path.relative(base, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ---------- Google Drive ----------
function findDrive() {
  const out = [];
  const tem = (p) => { try { if (fs.statSync(p).isDirectory() && !out.includes(p)) out.push(p); } catch (_) {} };
  const home = os.homedir();
  if (WIN) {
    for (let c = 65; c <= 90; c++) for (const n of ['Meu Drive', 'My Drive']) tem(`${String.fromCharCode(c)}:\\${n}`);
  }
  if (MAC) {
    // Google Drive para Mac: ~/Library/CloudStorage/GoogleDrive-<conta>/Meu Drive (ou o antigo /Volumes/GoogleDrive)
    const cs = path.join(home, 'Library', 'CloudStorage');
    try { for (const d of fs.readdirSync(cs)) if (/^GoogleDrive/i.test(d)) for (const n of ['Meu Drive', 'My Drive']) tem(path.join(cs, d, n)); } catch (_) {}
    for (const n of ['Meu Drive', 'My Drive']) tem(path.join('/Volumes', 'GoogleDrive', n));
  }
  for (const n of ['Google Drive', 'My Drive', 'Meu Drive', 'GoogleDrive', 'google-drive']) tem(path.join(home, n));
  return out;
}

// abre um arquivo/pasta no programa padrão do sistema (Windows, Mac ou Linux); "mostrar" seleciona na pasta
function abrirNoSistema(alvo, mostrar) {
  const solto = { detached: true, stdio: 'ignore' };
  const ch = WIN ? cp.spawn('explorer.exe', mostrar ? ['/select,' + alvo] : [alvo], solto)
    : MAC ? cp.spawn('open', mostrar ? ['-R', alvo] : [alvo], solto)
      : cp.spawn('xdg-open', [mostrar ? path.dirname(alvo) : alvo], solto);
  ch.on('error', () => {}); ch.unref();
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
  if (it.attachments.length) { L.push('## Anexos'); it.attachments.forEach((a) => L.push(`- [${a.name}](anexos/${idSeg(it.id)}/${encodeURIComponent(safeName(a.name))})`)); L.push(''); }
  return L.join('\n');
}

// O Drive é uma cópia, mas a pessoa pode ter mexido nela. O manifesto (data/drive-manifest.json) guarda a marca do que o app
// escreveu da última vez em cada arquivo: o hash do texto nos .md; tamanho e data nos anexos (ler anexo grande a cada cópia seria lento).
// Arquivo diferente dessa marca (editado por fora) ou que saiu da exportação nunca é sobrescrito nem apagado: vai para _substituidos/<data>/.
const marcaTxt = (s) => 'h:' + crypto.createHash('sha1').update(s).digest('hex');
const marcaArq = (st) => 'a:' + st.size + ':' + Math.round(st.mtimeMs);
const intacto = (m, st) => { const x = /^a:(\d+):(\d+)$/.exec(m || ''); return !!x && +x[1] === st.size && Math.abs(+x[2] - st.mtimeMs) < 2000; };
function hashArquivo(f) { // aos pedaços, para não carregar um anexo grande inteiro
  const h = crypto.createHash('sha1'), b = Buffer.alloc(1 << 20), fd = fs.openSync(f, 'r');
  try { let n; while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
}
const hojeLocal = today;

function driveSync(db) {
  const cfg = db.settings.drive || {};
  if (!cfg.path) throw new Error('Escolha a pasta do Drive.');
  if (!fs.existsSync(cfg.path)) throw new Error('A pasta do Drive não existe: ' + cfg.path);
  const antigo = path.join(cfg.path, 'Mochila'), base = fs.existsSync(antigo) && !fs.existsSync(path.join(cfg.path, 'MyLoot')) ? antigo : path.join(cfg.path, 'MyLoot');
  fs.mkdirSync(base, { recursive: true });
  const rel = (f) => path.relative(base, f).split(path.sep).join('/');
  let velho = {};
  try { velho = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) || {}; } catch (_) {}
  const antes = {};
  if (velho.v === 2) { if (velho.base === base) Object.assign(antes, velho.arquivos); }
  else for (const f of Object.keys(velho)) if (inside(base, f)) antes[rel(f)] = ''; // manifesto antigo: sabia o que o app criou, mas não o conteúdo
  const depois = {}, dia = hojeLocal();
  let written = 0, movidos = 0, erros = 0;
  // tira o arquivo do caminho sem apagar. Se não conseguir, devolve false e ninguém escreve por cima dele.
  const guardar = (file) => {
    try {
      let dst = path.join(base, '_substituidos', dia, path.relative(base, file));
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      if (fs.existsSync(dst)) { const e = path.extname(dst); dst = dst.slice(0, dst.length - e.length) + '-' + Date.now() + e; }
      EXP.mover(file, dst); movidos++;
      return true;
    } catch (_) { erros++; return false; }
  };
  for (const it of db.items) {
    const dir = path.join(base, TYPE_DIR[it.type] || 'Outros');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug(it.title)}-${idSeg(it.id)}.md`);
    if (!inside(base, file)) continue;
    const md = itemToMd(it, db), r = rel(file), marca = marcaTxt(md);
    let atual = null, ilegivel = false;
    if (fs.existsSync(file)) { try { atual = fs.readFileSync(file, 'utf8'); } catch (_) { ilegivel = true; erros++; } }
    if (atual === md) depois[r] = marca;
    else if (!ilegivel && (atual === null || (antes[r] && marcaTxt(atual) === antes[r]) || guardar(file))) { fs.writeFileSync(file, md); written++; depois[r] = marca; }
    else depois[r] = antes[r] || ''; // não deu para ler ou para guardar a versão de fora: fica como está e tenta na próxima
    for (const a of it.attachments) {
      const src = path.join(ANX, path.basename(a.file || ''));
      if (!fs.existsSync(src)) continue;
      const adir = path.join(dir, 'anexos', idSeg(it.id));
      fs.mkdirSync(adir, { recursive: true });
      const dst = path.join(adir, safeName(a.name)), ra = rel(dst);
      if (!inside(base, dst)) continue;
      if (ra in depois) continue; // dois anexos com o mesmo nome no mesmo item: vale o primeiro (senão um ficaria trocando o outro a cada cópia)
      try {
        const s1 = fs.statSync(src);
        let s2 = null; try { s2 = fs.statSync(dst); } catch (_) {}
        if (s2) {
          const meu = intacto(antes[ra], s2), semMarca = !/^a:/.test(antes[ra] || '');
          // já está igual: como o app deixou ou, com a data mexida, com o mesmo conteúdo (sem marca antiga, vale o tamanho, como era antes)
          if (s2.size === s1.size && (meu || semMarca || hashArquivo(src) === hashArquivo(dst))) { depois[ra] = marcaArq(s2); continue; }
          if (!meu && !guardar(dst)) { depois[ra] = antes[ra] || ''; continue; }
        }
        fs.copyFileSync(src, dst); written++;
        depois[ra] = marcaArq(fs.statSync(dst));
      } catch (_) { erros++; if (antes[ra] != null) depois[ra] = antes[ra]; }
    }
  }
  // o que o app tinha criado e saiu da exportação (item apagado, título ou tipo trocado) vai para _substituidos em vez de ser apagado
  for (const r of Object.keys(antes)) {
    if (r in depois || r.startsWith('_substituidos/')) continue;
    const f = path.join(base, r);
    if (inside(base, f) && fs.existsSync(f) && !guardar(f)) depois[r] = antes[r];
  }
  const tmp = MANIFEST + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ v: 2, base, arquivos: depois }));
  fs.renameSync(tmp, MANIFEST);
  return { escritos: written, movidos, erros, itens: db.items.length, pasta: base };
}

// ---------- cópias automáticas (data/backups): listar e voltar para uma delas ----------
const RE_COPIA = /^(db-\d{4}-\d\d-\d\d|antes-de-(restaurar|sincronizar)-\d+)\.json$/;
const copiasLidas = new Map(); // contar os registros pede abrir o arquivo: guarda o resultado enquanto ele não mudar
function listarCopias() {
  let anexos = new Set();
  try { anexos = new Set(fs.readdirSync(ANX)); } catch (_) {}
  const out = [];
  for (const f of fs.readdirSync(BAK)) {
    if (!RE_COPIA.test(f)) continue;
    try {
      const st = fs.statSync(path.join(BAK, f)), k = f + '|' + st.size + '|' + st.mtimeMs;
      let c = copiasLidas.get(k);
      if (!c) {
        const d = JSON.parse(fs.readFileSync(path.join(BAK, f), 'utf8'));
        const n = (x) => (Array.isArray(d[x]) ? d[x].length : 0), antes = /^antes-de-(?:restaurar|sincronizar)-(\d+)/.exec(f);
        c = { arquivo: f, tipo: antes ? (f.includes('sincronizar') ? 'nuvem' : 'antes') : 'diaria', quando: antes ? Number(antes[1]) : Math.round(st.mtimeMs), tamanho: st.size, itens: n('items'), tarefas: n('tasks'), clientes: n('clients'),
          arqs: (Array.isArray(d.items) ? d.items : []).flatMap((i) => (i.attachments || []).map((a) => path.basename(a.file || ''))) };
        copiasLidas.set(k, c);
      }
      out.push({ arquivo: c.arquivo, tipo: c.tipo, quando: c.quando, tamanho: c.tamanho, itens: c.itens, tarefas: c.tarefas, clientes: c.clientes, anexos: c.arqs.length, anexosFaltando: c.arqs.filter((a) => !anexos.has(a)).length });
    } catch (_) { out.push({ arquivo: f, tipo: f.startsWith('db-') ? 'diaria' : 'antes', quando: 0, ruim: true }); }
  }
  return out.sort((a, b) => b.quando - a.quando);
}
// antes de qualquer restauração, o banco de agora vira uma cópia em data/backups (e aparece na lista de cópias automáticas)
function guardarAtual() { if (fs.existsSync(DB)) fs.copyFileSync(DB, path.join(BAK, 'antes-de-restaurar-' + Date.now() + '.json')); }
// ---------- sincronizar entre computadores pela pasta da nuvem (nuvem.js) ----------
const NUVEM = require('./nuvem')(DATA, { readDB, writeDB, migrate, ANX, guardarCopia: () => { if (fs.existsSync(DB)) fs.copyFileSync(DB, path.join(BAK, 'antes-de-sincronizar-' + Date.now() + '.json')); } });
let restaurando = false;

// ---------- Claude (API da Anthropic) ----------
// A chave fica em data/segredos.json, fora do db.json: não entra no backup nem vai para o Drive.
const https = require('https');
const INT = require('./integracoes');
const UPD = require('./atualizar');
const EXP = require('./exportar');
const REDE = require('./celular')(DATA);
const CNX = require('./conexoes')(DATA);
const SECRETS = path.join(DATA, 'segredos.json');
const AI_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const readSecrets = (paraGravar) => {
  try { return JSON.parse(fs.readFileSync(SECRETS, 'utf8')) || {}; }
  catch (e) { if (paraGravar && e.code !== 'ENOENT') throw new Error('O arquivo de chaves (data/segredos.json) está danificado; nada foi gravado para não perder as outras chaves.'); return {}; }
};
function writeSecrets(s) { gravarArquivo(SECRETS, JSON.stringify(s)); }

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
// O servidor herda o PATH de quando foi aberto: quem instala o Claude Code ou o Codex depois (ou abre o MyLoot por um atalho)
// pode ficar com um PATH velho. Por isso a busca junta o PATH atual, o PATH gravado no Windows (registro) e as pastas onde
// esses programas costumam ficar, e guarda o caminho completo do comando para usar na hora de chamar.
const IA_NOMES = { claude: 'claude', codex: 'codex', gemini: 'gemini' };
const IAS_LOCAIS = ['claude', 'codex', 'gemini'];
// o Antigravity (editor do Google) não responde pedidos por linha de comando; só detectamos para sugerir o Gemini CLI, que usa a mesma conta Google
function temAntigravity() {
  const H = os.homedir(), E = process.env;
  const L = WIN ? [E.LOCALAPPDATA && path.join(E.LOCALAPPDATA, 'Programs', 'antigravity', 'Antigravity.exe')] : MAC ? ['/Applications/Antigravity.app', path.join(H, 'Applications', 'Antigravity.app')] : [path.join(H, '.local', 'share', 'antigravity'), '/usr/share/antigravity', '/opt/antigravity'];
  return L.filter(Boolean).some((f) => { try { fs.statSync(f); return true; } catch (_) { return false; } });
}
const iaCache = {};
const iaRodando = {};
function pathRegistro() {
  if (!WIN) return '';
  const le = (k) => { try { const o = cp.execSync(`reg query "${k}" /v Path`, { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }); const m = o.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i); return m ? m[1].trim().replace(/%([^%]+)%/g, (_, v) => process.env[v] || '') : ''; } catch (_) { return ''; } };
  return [le('HKCU\Environment'), le('HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment')].filter(Boolean).join(';');
}
function pastasExtras() {
  const H = os.homedir(), E = process.env;
  if (WIN) return [E.APPDATA && path.join(E.APPDATA, 'npm'), path.join(H, '.local', 'bin'), E.LOCALAPPDATA && path.join(E.LOCALAPPDATA, 'Programs', 'claude'), E.LOCALAPPDATA && path.join(E.LOCALAPPDATA, 'pnpm'), path.join(H, 'scoop', 'shims'), E.ProgramFiles && path.join(E.ProgramFiles, 'nodejs')].filter(Boolean);
  return [path.join(H, '.local', 'bin'), path.join(H, '.npm-global', 'bin'), path.join(H, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', path.join(H, '.bun', 'bin'), path.join(H, '.volta', 'bin')];
}
let pathIA = null;
function pathCompleto() {
  if (pathIA) return pathIA;
  const sep = WIN ? ';' : ':', vistos = new Set(), L = [];
  for (const d of [process.env.PATH || process.env.Path || '', pathRegistro(), pastasExtras().join(sep)].join(sep).split(sep)) {
    const k = d.trim(); if (k && !vistos.has(k.toLowerCase())) { vistos.add(k.toLowerCase()); L.push(k); }
  }
  return (pathIA = L.join(sep));
}
const envIA = () => Object.assign({}, process.env, { PATH: pathCompleto(), Path: pathCompleto() });
function acharComando(nome) {
  const exts = WIN ? ['.cmd', '.exe', '.bat', '.ps1', ''] : [''];
  for (const d of pathCompleto().split(WIN ? ';' : ':')) {
    for (const e of exts) {
      const f = path.join(d, nome + e);
      // atalho de app da Microsoft Store (pasta WindowsApps) não abre com stat; lstat basta para saber que existe
      try { if (fs.statSync(f).isFile() && (WIN ? e !== '' : true)) return f; } catch (_) { try { if (WIN && e === '.exe' && fs.lstatSync(f)) return f; } catch (__) {} }
    }
  }
  return dentroDeApp(nome);
}
// O app do ChatGPT/Codex para computador traz o Codex dentro dele (Windows: pacote da Store "OpenAI.Codex", em
// app\resources\codex.exe; Mac: dentro do .app), já logado na conta do ChatGPT. Ele não entra no PATH, então procuramos lá.
let appsCodex = null;
function dentroDeApp(nome) {
  if (nome !== 'codex') return null;
  const L = [];
  if (WIN) {
    if (appsCodex === null) {
      try {
        appsCodex = cp.execSync('powershell -NoProfile -NonInteractive -Command "Get-AppxPackage -Name OpenAI.* | ForEach-Object { $_.InstallLocation }"', { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] })
          .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      } catch (_) { appsCodex = []; }
    }
    for (const d of appsCodex) L.push(path.join(d, 'app', 'resources', 'codex.exe'));
  } else if (MAC) {
    for (const a of ['/Applications', path.join(os.homedir(), 'Applications')]) for (const n of ['ChatGPT.app', 'Codex.app']) L.push(path.join(a, n, 'Contents', 'Resources', 'codex'));
  }
  for (const f of L) { try { if (fs.statSync(f).isFile()) return f; } catch (_) {} }
  return null;
}
const aspas = (f) => (/\s/.test(f) ? '"' + f + '"' : f);
// sem travar o servidor: a checagem roda em paralelo e o app continua respondendo enquanto isso
function iaInfo(nome, force) {
  if (iaCache[nome] && !force) return Promise.resolve(iaCache[nome]);
  if (iaRodando[nome]) return iaRodando[nome];
  if (force) { pathIA = null; appsCodex = null; }          // "Procurar de novo" relê o PATH do Windows e os apps instalados depois de abrir o MyLoot
  iaRodando[nome] = new Promise((ok) => {
    const cmd = acharComando(IA_NOMES[nome]);
    if (!cmd) { iaCache[nome] = { ok: false, motivo: 'ausente' }; delete iaRodando[nome]; return ok(iaCache[nome]); }
    cp.exec(aspas(cmd) + ' --version', { encoding: 'utf8', timeout: 20000, windowsHide: true, env: envIA() }, (err, out) => {
      out = String(out || '');
      iaCache[nome] = err || !out.trim() ? { ok: false, motivo: 'falhou', caminho: cmd } : { ok: true, versao: (out.match(/\d+\.\d+[\d.]*/) || [''])[0], cmd };
      delete iaRodando[nome];
      ok(iaCache[nome]);
    });
  });
  return iaRodando[nome];
}
const cmdIA = (nome) => aspas((iaCache[nome] && iaCache[nome].cmd) || acharComando(IA_NOMES[nome]) || IA_NOMES[nome]);
const pastaIA = (n) => { const d = path.join(os.tmpdir(), 'myloot-' + n); fs.mkdirSync(d, { recursive: true }); return d; };
// shell: true no Windows: ch.kill() mataria só o cmd.exe e a IA ficaria rodando
function matar(ch) { try { if (WIN && ch.pid) cp.spawn('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {}); else ch.kill(); } catch (_) {} }
function entrada(ch, txt) { ch.stdin.on('error', () => {}); ch.stdin.end(txt); } // a IA pode sair antes de ler tudo
function callCodex(system, user) {
  return new Promise((ok, no) => {
    // pasta vazia, só leitura, sem histórico: o Codex só escreve a resposta
    // uma pasta por pedido: dois pedidos ao mesmo tempo não trocam as respostas
    const dir = fs.mkdtempSync(path.join(pastaIA('codex'), 'p-')), saida = path.join(dir, 'resposta.txt');
    try { fs.writeFileSync(saida, ''); } catch (_) {}
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--color', 'never', '-C', '"' + dir + '"', '-o', '"' + saida + '"', '-'];
    const ch = cp.spawn(cmdIA('codex'), args, { cwd: dir, shell: true, windowsHide: true, env: envIA() });
    const err = [];
    const t = setTimeout(() => { matar(ch); no(new Error('O Codex demorou demais. Tente de novo.')); }, 240000);
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
    entrada(ch, system + '\n\n' + user);
  });
}
function callClaudeCode(model, system, user) {
  return new Promise((ok, no) => {
    // pasta vazia como diretório de trabalho: o Claude Code não enxerga nenhum projeto
    const dir = pastaIA('claude');
    const args = ['-p', '--output-format', 'json', '--model', model, '--system-prompt', JSON.stringify(system), '--tools', '""', '--no-session-persistence', '--strict-mcp-config'];
    const ch = cp.spawn(cmdIA('claude'), args, { cwd: dir, shell: true, windowsHide: true, env: envIA() });
    const out = [], err = [];
    const t = setTimeout(() => { matar(ch); no(new Error('O Claude Code demorou demais. Tente de novo.')); }, 240000);
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
    entrada(ch, user);
  });
}
// Gemini CLI: entra com a conta Google (a mesma do Antigravity), com uso gratuito
function callGeminiCli(system, user) {
  return new Promise((ok, no) => {
    const dir = pastaIA('gemini');
    // o texto vai pela entrada padrão; o -p só fecha o pedido e liga o modo sem conversa
    const args = ['--output-format', 'json', '-p', '"Responda seguindo as instruções acima."'];
    const ch = cp.spawn(cmdIA('gemini'), args, { cwd: dir, shell: true, windowsHide: true, env: envIA() });
    const out = [], err = [];
    const t = setTimeout(() => { matar(ch); no(new Error('O Gemini demorou demais. Tente de novo.')); }, 240000);
    ch.stdout.on('data', (c) => out.push(c));
    ch.stderr.on('data', (c) => err.push(c));
    ch.on('error', () => { clearTimeout(t); no(new Error('Não achei o Gemini CLI neste computador.')); });
    ch.on('close', (code) => {
      clearTimeout(t);
      const txt = Buffer.concat(out).toString('utf8').trim();
      let j = null; try { j = JSON.parse(txt.slice(txt.indexOf('{'))); } catch (_) {}
      const resp = j ? j.response : (code === 0 ? txt : '');
      if (resp && String(resp).trim() && !(j && j.error)) return ok({ texto: String(resp).trim(), modelo: 'gemini', via: 'gemini' });
      const msg = (j && j.error && (j.error.message || JSON.stringify(j.error))) || Buffer.concat(err).toString('utf8').trim() || txt;
      if (/log ?in|auth|credential|GEMINI_API_KEY/i.test(msg)) return no(new Error('O Gemini CLI não está logado. Abra um terminal, rode "gemini" e entre com a sua conta Google.'));
      no(new Error('O Gemini respondeu com erro: ' + (msg.split(/\r?\n/).slice(-3).join(' ') || 'código ' + code).slice(0, 300)));
    });
    entrada(ch, system + '\n\n' + user);
  });
}

// ---------- chaves de API de outras IAs (Gemini e ChatGPT): pela internet, cada uma com a sua chave ----------
function postJSON(hostname, pth, headers, body, nome) {
  const data = Buffer.from(JSON.stringify(body));
  return new Promise((ok, no) => {
    const rq = https.request({ hostname, path: pth, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': data.length }, headers), timeout: 180000 }, (rs) => {
      const parts = [];
      rs.on('data', (c) => parts.push(c));
      rs.on('end', () => {
        let j = {}; try { j = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (_) {}
        const st = rs.statusCode, em = (j.error && j.error.message) || '';
        if (st === 400 && /api key/i.test(em) || st === 401 || st === 403) return no(new Error(`A chave do ${nome} não foi aceita. Confira nas Configurações.`));
        if (st === 429) return no(new Error(`Muitos pedidos ou sem crédito na conta do ${nome}. Tente de novo daqui a pouco.`));
        if (st >= 500) return no(new Error(`O ${nome} está sobrecarregado agora. Tente de novo em instantes.`));
        if (st !== 200) return no(new Error(em || 'Erro ' + st + ' na API do ' + nome + '.'));
        ok(j);
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('Demorou demais. Tente de novo.')));
    rq.on('error', (e) => no(new Error(e.code === 'ENOTFOUND' ? 'Sem internet.' : e.message)));
    rq.end(data);
  });
}
async function callGeminiApi(key, system, user) {
  const j = await postJSON('generativelanguage.googleapis.com', '/v1beta/models/gemini-flash-latest:generateContent', { 'x-goog-api-key': key },
    { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] }, 'Gemini');
  const c = (j.candidates || [])[0] || {};
  const text = ((c.content && c.content.parts) || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(c.finishReason === 'SAFETY' ? 'O Gemini não pôde atender a esse pedido.' : 'A resposta veio vazia.');
  return { texto: text, modelo: j.modelVersion || 'gemini', cortado: c.finishReason === 'MAX_TOKENS', via: 'api-gemini' };
}
async function callOpenAiApi(key, system, user) {
  const j = await postJSON('api.openai.com', '/v1/chat/completions', { Authorization: 'Bearer ' + key },
    { model: 'gpt-5-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, 'ChatGPT');
  const c = (j.choices || [])[0] || {};
  const text = String((c.message && c.message.content) || '').trim();
  if (!text) throw new Error('A resposta veio vazia.');
  return { texto: text, modelo: j.model || 'gpt', cortado: c.finish_reason === 'length', via: 'api-openai' };
}

// ---------- título de um link (a captura rápida guardava só o domínio) ----------
// Só endereços públicos (nada de 127.0.0.1, rede de casa ou roteador), lê no máximo 96 KB e desiste em 5 s.
const dns = require('dns');
const ipPrivado = (ip) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || /^(::1|::|f[cd]|fe80|::ffff:(127|10|192\.168)\.)/i.test(ip);
const entidades = (t) => t.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, c) => {
  const k = c.toLowerCase(); if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === 'apos') return "'"; if (k === 'nbsp') return ' ';
  const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
});
function tituloDe(url, voltas = 0) {
  return new Promise((ok) => {
    let u; try { u = new URL(url); } catch (_) { return ok(''); }
    if (!/^https?:$/.test(u.protocol) || voltas > 4) return ok('');
    dns.lookup(u.hostname, { all: true }, (e, ends) => {
      if (e || !ends.length || ends.some((x) => ipPrivado(x.address))) return ok('');
      const mod = u.protocol === 'https:' ? https : http;
      const rq = mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (MyLoot; título do link)', Accept: 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5' }, timeout: 5000 }, (rs) => {
        if ([301, 302, 303, 307, 308].includes(rs.statusCode) && rs.headers.location) { rs.resume(); return ok(tituloDe(new URL(rs.headers.location, u).href, voltas + 1)); }
        if (rs.statusCode !== 200 || !/html/i.test(rs.headers['content-type'] || '')) { rs.resume(); return ok(''); }
        const parts = []; let n = 0;
        const fim = () => {
          const h = Buffer.concat(parts).toString('utf8');
          const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(h) || /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i.exec(h);
          const ti = /<title[^>]*>([\s\S]{1,400}?)<\/title>/i.exec(h);
          ok(entidades(((og && og[1]) || (ti && ti[1]) || '').replace(/\s+/g, ' ').trim()).slice(0, 200));
        };
        rs.on('data', (c) => { parts.push(c); n += c.length; if (n > 96 * 1024) { rs.destroy(); fim(); } });
        rs.on('end', fim); rs.on('error', () => ok(''));
      });
      rq.on('timeout', () => rq.destroy()); rq.on('error', () => ok(''));
    });
  });
}

// ---------- foco (o relógio mora no servidor: continua contando com a aba fechada) ----------
const FOCO = path.join(DATA, 'foco.json');
let foco = { end: 0, min: 25, pendentes: 0 };
let focoT = null;
try { foco = Object.assign(foco, JSON.parse(fs.readFileSync(FOCO, 'utf8'))); } catch (_) {}
const saveFoco = () => { try { fs.writeFileSync(FOCO, JSON.stringify(foco)); } catch (_) {} };

// aviso na área de trabalho: Windows (toast ou balão), Mac (Central de Notificações) ou Linux (notify-send)
function notify(title, text) {
  if (process.env.MYLOOT_SEM_AVISO || process.env.MOCHILA_SEM_AVISO) return;
  if (MAC) {
    const a = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    try { cp.spawn('osascript', ['-e', `display notification "${a(text)}" with title "${a(title)}" sound name "Glass"`], { detached: true, stdio: 'ignore' }).unref(); } catch (_) {}
    return;
  }
  if (!WIN) {
    try { const ch = cp.spawn('notify-send', ['-i', path.join(PUB, 'icon.png'), String(title), String(text)], { detached: true, stdio: 'ignore' }); ch.on('error', () => {}); ch.unref(); } catch (_) {}
    return;
  }
  // o título e o texto vão por variável de ambiente: nada do que a pessoa escreveu entra no código do PowerShell
  const ps = `
$t=$env:MYLOOT_AVISO_T; $m=$env:MYLOOT_AVISO_M
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
  try { $i.Icon = New-Object System.Drawing.Icon($env:MYLOOT_AVISO_ICO) } catch { $i.Icon = [System.Drawing.SystemIcons]::Information }
  $i.Visible = $true; $i.ShowBalloonTip(8000, $t, $m, 'Info'); Start-Sleep 9; $i.Dispose()
}`;
  try {
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    const env = Object.assign({}, process.env, { MYLOOT_AVISO_T: String(title), MYLOOT_AVISO_M: String(text), MYLOOT_AVISO_ICO: path.join(ROOT, 'MyLoot.ico') });
    // sem detached: com ele o PowerShell saía sem mostrar nada
    const ch = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', b64], { stdio: 'ignore', windowsHide: true, env });
    ch.on('error', () => {}); ch.unref();
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

// ---------- lembretes: tarefa de hoje com horário avisa na área de trabalho (mesmo com a aba fechada) ----------
const AVISOS = path.join(DATA, 'avisos.json');
let avisados = [];
try { avisados = JSON.parse(fs.readFileSync(AVISOS, 'utf8')); } catch (_) {}
function lembretes() {
  let db; try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (_) { return; }
  const agora = new Date(), pad = (n) => String(n).padStart(2, '0');
  const hoje = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
  const min = agora.getHours() * 60 + agora.getMinutes();
  let mudou = false;
  for (const t of db.tasks || []) {
    if (t.done || t.date !== hoje || !/^\d\d:\d\d$/.test(t.hora || '')) continue;
    const [h, m] = t.hora.split(':').map(Number), k = `${t.id}|${hoje}|${t.hora}`;
    if (min < h * 60 + m || min > h * 60 + m + 180 || avisados.includes(k)) continue;
    notify('⏰ ' + t.text, `Lembrete do MyLoot · hoje às ${t.hora}`);
    avisados.push(k); mudou = true;
  }
  // hábitos da Rotina com lembrete: avisa no horário se o hábito do dia ainda não foi marcado
  const ds = agora.getDay();
  for (const h of db.habits || []) {
    if (h.pausa || !/^\d\d:\d\d$/.test(h.hora || '') || (h.criado && hoje < h.criado)) continue;
    if (h.freq === 'semana' && !(h.dias || []).includes(ds)) continue;
    if ((Number((h.log || {})[hoje]) || 0) >= Math.max(1, Number(h.alvo) || 1)) continue;
    const [hh, mm] = h.hora.split(':').map(Number), k = `hab|${h.id}|${hoje}|${h.hora}`;
    if (min < hh * 60 + mm || min > hh * 60 + mm + 180 || avisados.includes(k)) continue;
    notify(`${h.em || '🎯'} ${h.nome}`, `Hábito da sua Rotina · hoje às ${h.hora}`);
    avisados.push(k); mudou = true;
  }
  // contas a pagar e a receber que vencem hoje: um aviso só, a partir das 9h
  if (agora.getHours() >= 9) {
    const hojeFin = (db.fin || []).filter((f) => !f.pago && f.data === hoje);
    const k = 'fin|' + hoje;
    if (hojeFin.length && !avisados.includes(k)) {
      const pagar = hojeFin.filter((f) => f.tipo === 'saida'), receber = hojeFin.filter((f) => f.tipo === 'entrada');
      const R = (L) => 'R$ ' + L.reduce((s, f) => s + f.valor, 0).toFixed(2).replace('.', ',');
      notify('💰 Contas de hoje', [pagar.length ? `${pagar.length} a pagar (${R(pagar)})` : '', receber.length ? `${receber.length} a receber (${R(receber)})` : ''].filter(Boolean).join(' · '));
      avisados.push(k); mudou = true;
    }
  }
  if (mudou) { avisados = avisados.slice(-500); try { fs.writeFileSync(AVISOS, JSON.stringify(avisados)); } catch (_) {} }
}
const lembretesSeguro = () => { try { lembretes(); } catch (e) { logErro('lembretes: ' + (e.stack || e.message)); } };
setInterval(lembretesSeguro, 30000);
setTimeout(lembretesSeguro, 5000);

// ---------- pacotes de conteúdo (pasta exemplos/): entram uma vez só, sem duplicar ----------
// pacote já instalado: se um arquivo dele mudou (ex.: PDF refeito), troca a cópia do anexo pela nova.
// Só mexe em anexo com o mesmo nome do arquivo do pacote, nos itens que vieram do pacote.
function atualizarArquivosDoPacote(db, p, dir) {
  let mudou = false;
  (p.itens || []).forEach((it, i) => {
    const item = db.items.find((x) => x.id === p.id + '-' + i);
    if (!item) return;
    for (const a of it.arquivos || []) {
      const src = path.join(dir, path.basename(p.pasta || ''), path.basename(a));
      const anexo = item.attachments.find((x) => x.name === a);
      if (!anexo || !fs.existsSync(src)) continue;
      const dst = path.join(ANX, path.basename(anexo.file || ''));
      try {
        const novo = fs.statSync(src).size;
        if (fs.existsSync(dst) && fs.statSync(dst).size === novo) continue;
        fs.copyFileSync(src, dst); anexo.size = novo; mudou = true;
      } catch (_) {}
    }
  });
  return mudou;
}

function applyPacks(db) {
  const dir = path.join(ROOT, 'exemplos');
  let changed = false;
  let packs = [];
  try { packs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (_) { return false; }
  db.packs = Array.isArray(db.packs) ? db.packs : [];
  for (const f of packs) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
    if (p.id && db.packs.includes(p.id)) { if (atualizarArquivosDoPacote(db, p, dir)) changed = true; continue; }
    if (!p.id) continue;
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
      db.items.push({ id: p.id + '-' + i, type: it.tipo || 'estudo', title: it.titulo || '', desc: it.descricao || '', content: it.conteudo || '', links: it.links || [], attachments,
        checklist: (it.checklist || []).map((t, k) => ({ id: p.id + '-' + i + '-' + k, t, done: false })), modelo: !!it.modelo, client: '',
        cat: p.categoria ? p.categoria.id : '', status: 'ver', tags: it.etiquetas || [], date: '', fav: !!it.favorito, created: now - i * 1000, updated: now - i * 1000 });
    });
    db.packs.push(p.id);
    changed = true;
  }
  return changed;
}

// ---------- rotas ----------
// o que só o próprio computador pode fazer (o celular usa e mexe nos dados, mas não desliga, não troca chaves nem abre coisas no PC)
const EXECUTAVEL = /\.(bat|cmd|com|exe|msi|msp|scr|pif|lnk|url|hta|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|reg|cpl|jar|appref-ms|sh|command|app|desktop|run|bin)$/i;
const SO_PC = ['/api/shutdown', '/api/open', '/api/reveal', '/api/abrir-pasta', '/api/atualizacao/aplicar', '/api/rede', '/api/rede/trocar', '/api/ai/key', '/api/int/salvar', '/api/restore', '/api/restore/completo', '/api/backups', '/api/backups/restaurar', '/api/drive/sync', '/api/nuvem', '/api/nuvem/sync', '/api/notify-test', '/api/conexoes', '/api/conexoes/mudar', '/api/conexoes/apagar', '/api/int/notion/paginas', '/api/int/trello/listas', '/api/drive/find'];

async function app(req, res) {
  try {
    const host = (req.headers.host || '').split(':')[0].toLowerCase().replace(/^\[|\]$/g, '');
    if (!REDE.hostOk(host)) return send(res, 403, { erro: 'host' });
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    const pc = REDE.loopback(req);

    // ----- entrada do celular (QR Code ou código de 6 números) -----
    if (p === '/entrar') {
      if (pc || REDE.autorizado(req)) { res.writeHead(302, { Location: '/' }); return res.end(); }
      const c = u.searchParams.get('c');
      if (req.method === 'GET' && c && REDE.tokenOk(c)) { res.writeHead(302, { Location: '/', 'Set-Cookie': REDE.setCookie() }); return res.end(); }
      if (req.method === 'POST') {
        const pin = new URLSearchParams((await readBody(req, 4096)).toString('utf8')).get('pin');
        const r = REDE.tentar(req, pin);
        if (r === 'ok') { res.writeHead(302, { Location: '/', 'Set-Cookie': REDE.setCookie() }); return res.end(); }
        return send(res, 200, REDE.paginaEntrar(r === 'travado' ? 'Muitas tentativas. Espere 15 minutos.' : 'Código errado. Confira no computador.'), 'text/html; charset=utf-8');
      }
      return send(res, 200, REDE.paginaEntrar(c ? 'Esse QR Code é antigo. Digite o código atual.' : ''), 'text/html; charset=utf-8');
    }
    if (!REDE.autorizado(req)) {
      // arquivos do visual podem carregar (ícone, manifesto); o resto pede o código
      if (/^\/(icon\.png|bau\.png|manifest\.json|icon-\d+\.png)$/.test(p)) return serveFile(req, res, path.join(PUB, p));
      if (p.startsWith('/api/')) return send(res, 401, { erro: 'Entre com o código do MyLoot.' });
      res.writeHead(302, { Location: '/entrar' }); return res.end();
    }

    // ----- Conexões: outro programa deste computador manda itens (só acrescenta; exige o código da conexão) -----
    if (p === '/api/entrada' || p === '/api/entrada/ping') {
      if (!pc) return send(res, 403, { erro: 'A entrada de outros apps só funciona no computador onde o MyLoot está instalado.' });
      const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': 'content-type, x-myloot-conexao', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const cx = CNX.achar(req.headers['x-myloot-conexao']);
      if (!cx) return send(res, 401, { erro: 'Código de conexão inválido ou desligado. Gere um em Configurações → Conexões.' }); // sem CORS: página nenhuma lê esta resposta
      if (p === '/api/entrada/ping') return send(res, 200, { ok: true, app: 'myloot', versao: UPD.local(ROOT).versao, formato: CNX.FORMATO, conexao: cx.nome }, null, cors);
      if (req.method !== 'POST') return send(res, 405, { erro: 'Use POST.' }, null, cors);
      try {
        const corpo = JSON.parse((await readBody(req, 8e6)).toString('utf8'));
        const { db } = readDB();
        const r = CNX.receber(db, cx, corpo, uid);
        writeDB(db); CNX.usou(cx.id, r.itens.length);
        return send(res, 200, r, null, cors);
      } catch (e) { return send(res, 400, { erro: e.message }, null, cors); }
    }

    const sfs = req.headers['sec-fetch-site'];
    if ((p.startsWith('/api/') || p.startsWith('/anexos/')) && (sfs === 'cross-site' || sfs === 'same-site')) return send(res, 403, { erro: 'origem' });
    if (p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers['x-myloot'] !== '1' && req.headers['x-mochila'] !== '1') return send(res, 403, { erro: 'cabeçalho' });
      if (!pc && SO_PC.includes(p)) return send(res, 403, { erro: 'Isso só dá para fazer no computador onde o MyLoot está instalado.' });
      if (p === '/api/ping') return send(res, 200, { ok: true, app: 'myloot', versao: UPD.local(ROOT).versao, remoto: !pc, sistema: process.platform });
      // o lançador do Windows (MyLoot.ps1) pergunta onde abrir: janela própria ou navegador
      if (p === '/api/janela') return send(res, 200, { modo: readDB().db.settings.janela === 'navegador' ? 'navegador' : 'app' });
      // ----- Conexões (gerenciar os códigos; só no PC) -----
      if (p === '/api/conexoes' && req.method === 'GET') return send(res, 200, { formato: CNX.FORMATO, porta: PORT, conexoes: CNX.listar() });
      if (p === '/api/conexoes' && req.method === 'POST') { const b = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); return send(res, 200, CNX.criar(b.nome)); }
      if (p === '/api/conexoes/mudar' && req.method === 'POST') { const b = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); return send(res, 200, CNX.mudar(b.id, b) || { erro: 'não achei' }); }
      if (p === '/api/conexoes/apagar' && req.method === 'POST') { const b = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}'); CNX.apagar(b.id); return send(res, 200, { ok: true }); }
      // ----- celular / rede -----
      if (p === '/api/rede' && req.method === 'GET') return send(res, 200, REDE.status(PORT));
      if (p === '/api/rede' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        REDE.ligar(b.on); send(res, 200, REDE.status(PORT)); setTimeout(ouvir, 200); return;
      }
      if (p === '/api/rede/trocar' && req.method === 'POST') { REDE.trocar(); return send(res, 200, REDE.status(PORT)); }
      // ----- exportar, backup com senha, pasta do cliente -----
      if (p === '/api/exportar-md') {
        const { db } = readDB();
        const buf = EXP.markdown(db, { itemToMd, TYPE_DIR, slug, safeName, idSeg, ANX, anexos: u.searchParams.get('anexos') !== '0' });
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': buf.length, 'Content-Disposition': `attachment; filename="myloot-markdown-${today()}.zip"`, 'Cache-Control': 'no-store' });
        return res.end(buf);
      }
      if (p === '/api/backup/senha' && req.method === 'POST') {
        const { senha } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        if (!senha || String(senha).length < 6) return send(res, 400, { erro: 'Use uma senha com pelo menos 6 caracteres.' });
        const { db } = readDB();
        return send(res, 200, EXP.cifrar(JSON.stringify(db), senha));
      }
      if (p === '/api/abrir-pasta' && req.method === 'POST') {
        const { pasta } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        let ok = false; try { ok = fs.statSync(String(pasta || '')).isDirectory(); } catch (_) {}
        if (!ok) return send(res, 404, { erro: 'Essa pasta não existe neste computador.' });
        abrirNoSistema(path.resolve(String(pasta)));
        return send(res, 200, { ok: true });
      }
      if (p === '/api/db' && req.method === 'GET') {
        const { db, fresh } = readDB();
        if (fresh) writeDB(db);
        return send(res, 200, db, null, { 'X-Rev': String(REV) });
      }
      if (p === '/api/rev') return send(res, 200, { rev: String(REV) });
      if (p === '/api/recuperado') { const r = RECUPERADO; if (req.method === 'POST') RECUPERADO = null; return send(res, 200, { recuperado: r }); }
      if (p === '/api/db' && req.method === 'PUT') {
        // quem salva manda a REV que leu; se outro aparelho salvou no meio, devolve 409 e o app junta as mudanças
        const rv = req.headers['x-rev'];
        if (rv && String(rv) !== String(REV)) return send(res, 409, { erro: 'conflito', rev: String(REV) });
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (!body || typeof body !== 'object' || !Array.isArray(body.items) || !Array.isArray(body.tasks)) return send(res, 400, { erro: 'Dados incompletos: nada foi gravado.' });
        if (rv && String(rv) !== String(REV)) return send(res, 409, { erro: 'conflito', rev: String(REV) }); // outro salvou enquanto este chegava
        const novo = migrate(body);
        if (!pc) { const atual = readDB().db; novo.settings.drive = atual.settings.drive; } // a pasta do Drive só se escolhe no PC
        writeDB(novo);
        return send(res, 200, { ok: true, rev: String(REV) });
      }
      if (p === '/api/attach' && req.method === 'POST') {
        const name = safeName(u.searchParams.get('name'));
        const file = uid() + '-' + name;
        const dst = path.join(ANX, file);
        const parte = dst + '.part';
        try { await stream.promises.pipeline(req, fs.createWriteStream(parte)); }
        catch (e) { try { fs.unlinkSync(parte); } catch (_) {} return send(res, 400, { erro: 'O envio do arquivo foi interrompido. Tente de novo.' }); }
        fs.renameSync(parte, dst);
        return send(res, 200, { file, name, size: fs.statSync(dst).size, mime: req.headers['content-type'] || '' });
      }
      if ((p === '/api/open' || p === '/api/reveal') && req.method === 'POST') {
        const { file } = JSON.parse((await readBody(req)).toString('utf8'));
        const full = path.join(ANX, path.basename(String(file || '')));
        if (!inside(ANX, full) || !fs.existsSync(full)) return send(res, 404, { erro: 'arquivo não achado' });
        const exec = EXECUTAVEL.test(full);
        abrirNoSistema(full, p === '/api/reveal' || exec);
        return send(res, 200, { ok: true, naPasta: exec && p === '/api/open' });
      }
      if (p === '/api/backup') {
        const { db } = readDB();
        return send(res, 200, JSON.stringify(db, null, 1), 'application/json');
      }
      if (p === '/api/restore' && req.method === 'POST') {
        let body = JSON.parse((await readBody(req)).toString('utf8'));
        if (body && body.cripto) {
          try { body = JSON.parse(EXP.decifrar(body.cripto, body.senha)); } catch (e) { return send(res, 400, { erro: e.message }); }
        }
        if (!body || !Array.isArray(body.items)) return send(res, 400, { erro: 'Esse arquivo não parece um backup do MyLoot.' });
        guardarAtual();
        writeDB(migrate(body));
        return send(res, 200, { ok: true });
      }
      // ----- backup completo: um ZIP com o banco e a pasta de anexos, feito em fluxo (pode ter gigabytes) -----
      if (p === '/api/backup/completo' && req.method === 'GET') {
        const b = EXP.backupPlano(readDB().db, ANX);
        if (u.searchParams.get('info') === '1') return send(res, 200, Object.assign({ bytes: b.total }, b.etiqueta));
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': b.total, 'Content-Disposition': `attachment; filename="myloot-backup-completo-${hojeLocal()}.zip"`, 'Cache-Control': 'no-store' });
        // o tamanho já foi avisado: se um arquivo mudar no meio, o download falha em vez de entregar um ZIP errado
        try { await EXP.zipFluxo(res, b.entradas); res.end(); } catch (_) { res.destroy(); }
        return;
      }
      if (p === '/api/restore/completo' && req.method === 'POST') {
        // o envio vai direto para o disco; o banco e os anexos só mudam depois que o ZIP inteiro foi conferido
        const engole = () => new Promise((ok) => { req.on('end', ok).on('close', ok).on('error', ok); req.resume(); });
        if (restaurando) { await engole(); return send(res, 409, { erro: 'Já tem uma restauração em andamento. Espere ela terminar.' }); }
        const len = Number(req.headers['content-length']) || 0, tem = EXP.livre(DATA);
        if (tem != null && len > tem - 50e6) { await engole(); return send(res, 507, { erro: `Falta espaço no disco para receber o backup: ele tem ${EXP.MB(len)} e há ${EXP.MB(tem)} livres.` }); }
        restaurando = true;
        // sobra de uma restauração interrompida (o servidor foi fechado no meio): a pasta de trabalho antiga sai antes de começar outra
        for (const f of fs.readdirSync(DATA)) if (/^tmp-restaurar-\d+$/.test(f)) { try { fs.rmSync(path.join(DATA, f), { recursive: true, force: true }); } catch (_) {} }
        const tmp = path.join(DATA, 'tmp-restaurar-' + Date.now());
        try {
          fs.mkdirSync(tmp, { recursive: true });
          const zipArq = path.join(tmp, 'envio.zip');
          await stream.promises.pipeline(req, fs.createWriteStream(zipArq));
          const r = await EXP.restaurarCompleto(zipArq, { ANX, tmp });
          guardarAtual();
          const anexos = EXP.aplicarAnexos(r, path.join(BAK, 'anexos-antes-de-restaurar-' + Date.now()));
          const novo = migrate(r.db);
          writeDB(novo);
          return send(res, 200, { ok: true, itens: novo.items.length, tarefas: novo.tasks.length, clientes: novo.clients.length, anexos });
        } catch (e) { return send(res, 400, { erro: e.message }); }
        finally { restaurando = false; try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
      }
      // ----- cópias automáticas: ver as que existem e voltar para uma -----
      if (p === '/api/backups' && req.method === 'GET') return send(res, 200, { copias: listarCopias() });
      if (p === '/api/backups/restaurar' && req.method === 'POST') {
        const nome = path.basename(String(JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}').arquivo || ''));
        const f = path.join(BAK, nome);
        if (!RE_COPIA.test(nome) || !fs.existsSync(f)) return send(res, 404, { erro: 'Não achei essa cópia.' });
        let body = null;
        try { body = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) {}
        if (!body || !Array.isArray(body.items)) return send(res, 400, { erro: 'Essa cópia está danificada. Escolha outra.' });
        guardarAtual();
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
      if (p === '/api/nuvem' && req.method === 'GET') return send(res, 200, NUVEM.status());
      if (p === '/api/nuvem' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}');
        const st = NUVEM.configurar(b);
        if (st.on) NUVEM.agendar(300);
        return send(res, 200, st);
      }
      if (p === '/api/nuvem/sync' && req.method === 'POST') {
        try { const r = NUVEM.sincronizar(); return send(res, 200, Object.assign({ rev: String(REV) }, NUVEM.status(), { resumo: r })); }
        catch (e) { return send(res, 400, { erro: e.message }); }
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
        const [claude, codex, gemini] = await Promise.all(IAS_LOCAIS.map((n) => iaInfo(n, f)));
        const so = (x) => ({ ok: x.ok, versao: x.versao, motivo: x.motivo });      // o caminho do programa fica só no servidor
        const sec = readSecrets();
        return send(res, 200, { temChave: !!sec.anthropicKey, temGemini: !!sec.geminiKey, temOpenai: !!sec.openaiKey, modelos: AI_MODELS, code: so(claude), claude: so(claude), codex: so(codex), gemini: so(gemini), antigravity: temAntigravity() });
      }
      if (p === '/api/ai/key' && req.method === 'POST') {
        const { key, qual } = JSON.parse((await readBody(req)).toString('utf8'));
        const campo = { gemini: 'geminiKey', openai: 'openaiKey' }[qual] || 'anthropicKey';
        const s = readSecrets(true);
        const k = String(key || '').trim();
        if (k) s[campo] = k; else delete s[campo];
        writeSecrets(s);
        return send(res, 200, { temChave: !!k });
      }
      if (p === '/api/ai' && req.method === 'POST') {
        const sec = readSecrets(), key = sec.anthropicKey;
        const b = JSON.parse((await readBody(req)).toString('utf8'));
        // qual IA: a escolhida no pedido, ou a das Configurações; "auto" pega a primeira ligada e instalada, depois as chaves
        const st = readDB().db.settings, ligadas = st.aiTools || {};
        let pref = b.via || st.aiVia || 'auto'; if (pref === 'code') pref = 'claude';
        const tem = {};
        for (const n of IAS_LOCAIS) tem[n] = (await iaInfo(n)).ok;
        const pode = (n) => ligadas[n] !== false && tem[n];
        const chaves = { api: key, 'api-gemini': sec.geminiKey, 'api-openai': sec.openaiKey };
        const NOME = { claude: 'O Claude Code', codex: 'O Codex', gemini: 'O Gemini CLI' };
        let via;
        if (pref in chaves) via = pref;
        else if (pref === 'auto') via = IAS_LOCAIS.find(pode) || Object.keys(chaves).find((c) => chaves[c]) || 'api';
        else via = pode(pref) ? pref : null;
        if (!via) return send(res, 400, { erro: (NOME[pref] || 'Essa IA') + ' não está instalado ou está desligado nas Configurações.' });
        if (via in chaves && !chaves[via]) return send(res, 400, { erro: via === 'api' ? 'Nenhuma IA encontrada. Instale o Claude Code, o Codex ou o Gemini CLI, ou coloque uma chave de API nas Configurações.' : 'Coloque a chave dessa IA nas Configurações primeiro.' });
        const texto = String(b.texto || ''), pedido = String(b.pedido || '').trim();
        const inst = b.acao === 'livre' ? pedido : AI_ACTIONS[b.acao];
        if (!inst) return send(res, 400, { erro: 'Escreva o que você quer que a IA faça.' });
        const { db } = readDB();
        const model = AI_MODELS.includes(db.settings.aiModel) ? db.settings.aiModel : AI_MODELS[0];
        const system = 'Você é o assistente de escrita de um app pessoal de notas chamado MyLoot. Responda só com o texto final, pronto para colar: sem introdução, sem explicação, sem aspas em volta e sem cercas de código. Use o idioma do texto (por padrão, português do Brasil).';
        const user = texto.trim() ? `Pedido: ${inst}\n\n<texto>\n${texto}\n</texto>` : `Pedido: ${inst}`;
        try {
          const r = via === 'claude' ? await callClaudeCode(model, system, user) : via === 'codex' ? await callCodex(system, user) : via === 'gemini' ? await callGeminiCli(system, user)
            : via === 'api-gemini' ? await callGeminiApi(sec.geminiKey, system, user) : via === 'api-openai' ? await callOpenAiApi(sec.openaiKey, system, user) : await callClaude(key, model, system, user);
          return send(res, 200, r);
        }
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
            Object.assign(x, readSecrets(true));
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
            const dbx = readDB().db;
            let it = dbx.items.find((i) => i.id === b.id);
            const cli = b.cliente && dbx.clients.find((c) => c.id === b.cliente);
            if (cli) { // cliente vira um cartão/página: contatos + anotações + tarefas abertas
              const contatos = [['Empresa', cli.empresa], ['WhatsApp', cli.whats], ['E-mail', cli.email], ['Instagram', cli.insta], ['Site', cli.site], ['Pasta', cli.pasta]].filter((x) => x[1]).map((x) => x[0] + ': ' + x[1]).join('\n');
              it = { id: cli.id, type: 'nota', title: '👤 ' + (cli.nome || 'Cliente'), desc: contatos, content: cli.notas || '', tags: cli.tags || [], attachments: [],
                links: [cli.site, cli.trello].filter((u) => /^https?:/i.test(u || '')).map((u) => ({ url: u, label: u })),
                checklist: dbx.tasks.filter((t) => t.client === cli.id && !t.done).map((t) => ({ t: t.text + (t.date ? ' (' + t.date.split('-').reverse().join('/') + ')' : ''), done: false })) };
            }
            if (!it) return send(res, 404, { erro: 'Item não encontrado.' });
            const cfg = x[m[1]] || {};
            if (!cfg.alvo) return send(res, 400, { erro: 'Conecte nas Configurações primeiro.' });
            return send(res, 200, m[1] === 'notion' ? await INT.notionEnviar(cfg, it) : await INT.trelloEnviar(cfg, it));
          }
        } catch (e) { return send(res, 502, { erro: e.message }); }
      }
      // ----- atualização pelo GitHub -----
      if (p === '/api/titulo') return send(res, 200, { titulo: await tituloDe(String(u.searchParams.get('url') || '')) });
      if (p === '/api/versao') return send(res, 200, UPD.local(ROOT));
      if (p === '/api/musicas') {
        let faixas = [];
        try { faixas = fs.readdirSync(path.join(PUB, 'musica')).filter((f) => /\.(mp3|ogg|m4a|wav)$/i.test(f)).sort(); } catch (_) {}
        return send(res, 200, { faixas });
      }
      if (p === '/api/atualizacao') return send(res, 200, await UPD.checar(ROOT, u.searchParams.get('forcar') === '1'));
      if (p === '/api/atualizacao/aplicar' && req.method === 'POST') {
        try { const v = await UPD.aplicar(ROOT); send(res, 200, { ok: true, versao: v }); UPD.reiniciar(ROOT); return; }
        catch (e) { return send(res, 500, { erro: e.message }); }
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
      const h = { 'X-Content-Type-Options': 'nosniff' }; // html, svg e afins nunca abrem como página: sempre baixam
      const ext = path.extname(full).toLowerCase();
      if (u.searchParams.get('baixar') || !ANEXO_NA_TELA.has(ext)) Object.assign(h, { 'Content-Disposition': 'attachment', 'Content-Type': 'application/octet-stream' });
      return serveFile(req, res, full, h);
    }

    let rel = p === '/' ? '/index.html' : p;
    const full = path.join(PUB, rel);
    if (!inside(PUB, full)) return send(res, 403, { erro: 'caminho' });
    return serveFile(req, res, full, { 'X-Frame-Options': 'SAMEORIGIN', 'X-Content-Type-Options': 'nosniff' });
  } catch (e) {
    send(res, 500, { erro: String(e.message || e) });
  }
}

// escuta só no próprio PC ou, com "Usar no celular" ligado, na rede de casa (troca sem reiniciar)
process.on('uncaughtException', (e) => { logErro('uncaughtException: ' + (e && e.stack || e)); });
process.on('unhandledRejection', (e) => { logErro('unhandledRejection: ' + (e && e.stack || e)); });
let server = null, primeira = true;
function ouvir() {
  const host = REDE.host();
  if (server && server._host === host) return;
  const velho = server;
  server = http.createServer(app); server._host = host;
  server.requestTimeout = 0; // o Node corta envios que passam de 5 minutos; um backup completo ou um anexo grande pode demorar mais que isso
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && primeira) { console.log('O MyLoot já está aberto na porta ' + PORT + '.'); process.exit(0); }
    if (e.code === 'EADDRINUSE') return setTimeout(() => server.listen(PORT, host), 500);
    console.error(e); process.exit(1);
  });
  const ligar = () => server.listen(PORT, host, () => {
    if (!primeira) return console.log(host === '0.0.0.0' ? 'Celular liberado na rede de casa.' : 'Só este computador acessa agora.');
    primeira = false;
    console.log(`MyLoot rodando em http://127.0.0.1:${PORT}  (feche esta janela para desligar)`);
    if (host === '0.0.0.0') console.log('Celular: ' + REDE.ips().map((i) => `http://${i}:${PORT}`).join('  '));
    const { db, fresh } = readDB();
    const novos = applyPacks(db);
    if (fresh || novos) writeDB(db); else dailyBackup();
    NUVEM.agendar(1500); // ao abrir: traz o que os outros computadores mudaram
  });
  if (velho) { velho.close(); if (velho.closeAllConnections) velho.closeAllConnections(); setTimeout(ligar, 300); } else ligar();
}
ouvir();
