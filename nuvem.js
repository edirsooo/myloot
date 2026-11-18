// Sincronizar entre computadores por uma pasta da nuvem (Google Drive para computador, OneDrive, Dropbox…).
//
// Na pasta escolhida fica MyLoot-sync/:
//   aparelhos/<id>.json  um arquivo por computador; cada um escreve SÓ o seu (o Drive nunca vê dois gravando o mesmo arquivo)
//   anexos/<arquivo>     os anexos, com o mesmo nome único que têm em data/anexos
//
// Cada registro (item, tarefa, cliente, lançamento, hábito, meta, ferramenta, categoria e entrada da Lixeira) leva a marca de tempo
// de cada campo. Ao juntar, campo a campo, fica o valor com a marca mais nova. Apagar vira "marca de apagado" (o registro já foi para a
// Lixeira no aparelho que apagou, e a entrada da Lixeira também viaja): se alguém editou depois de apagar, a edição mais nova vence.
// Configurações, XP e segredos (data/segredos.json) nunca vão para a nuvem.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const LISTAS = ['categories', 'items', 'tasks', 'clients', 'fin', 'habits', 'goals', 'tools', 'trash'];
const J = (o) => JSON.stringify(o);
const chave = (k, o) => (k === 'trash' ? o && o.data && o.data.id != null && 'trash:' + o.kind + ':' + o.data.id + ':' + o.at : o && o.id != null && k + ':' + o.id);

module.exports = function (DATA, ctx) {
  // ctx: { readDB, writeDB, migrate, ANX, guardarCopia }
  const CFG = path.join(DATA, 'nuvem.json');
  const ESTADO = path.join(DATA, 'nuvem-estado.json');
  const gravar = (f, o) => { const tmp = f + '.tmp'; fs.writeFileSync(tmp, typeof o === 'string' ? o : J(o)); fs.renameSync(tmp, f); };
  const ler = (f, pad) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return pad; } };

  function cfg() {
    const c = Object.assign({ on: false, pasta: '', id: '', nome: '', ultima: 0, erro: '', resumo: null }, ler(CFG, {}));
    // a identidade é deste computador E desta pasta de dados: se a pasta data/ foi copiada para outro PC (ou restaurada lá),
    // o outro ganha uma identidade nova; senão os dois se achariam o mesmo aparelho e um nunca leria o que o outro mudou
    const maquina = os.hostname() + '|' + path.resolve(DATA);
    if (!c.id || (c.maquina && c.maquina !== maquina)) {
      if (c.id) { try { fs.renameSync(ESTADO, ESTADO.replace(/\.json$/, '') + '-de-outro-aparelho-' + Date.now() + '.json'); } catch (_) {} c.nome = os.hostname(); }
      c.id = crypto.randomBytes(6).toString('hex'); c.nome = c.nome || os.hostname(); c.maquina = maquina; gravar(CFG, c);
    } else if (!c.maquina) { c.maquina = maquina; gravar(CFG, c); }
    return c;
  }
  const salvarCfg = (c) => gravar(CFG, c);
  const base = (c) => path.join(c.pasta, 'MyLoot-sync');

  // registro do banco -> { v: valor, t: { campo: marca }, del: marca de apagado (0 = vivo) }
  const vivo = (r) => { const m = Math.max(0, ...Object.values(r.t || {})); return !r.del || m > r.del; };

  // 1) compara o banco com o que foi publicado da última vez e marca a hora nos campos que mudaram aqui
  function carimbar(db, reg, primeira) {
    const agora = Date.now(), visto = new Set();
    for (const k of LISTAS) for (const o of db[k] || []) {
      const id = chave(k, o); if (!id || visto.has(id)) continue; visto.add(id);
      const r = reg[id];
      if (!r || !vivo(r)) {
        // primeira vez neste computador: usa a data do próprio registro, para não passar por cima de um mais novo de outro PC
        const t0 = primeira ? (o.updated || o.created || o.at || 1) : agora;
        const t = {}; for (const f of Object.keys(o)) t[f] = Math.max(t0, r && r.del ? r.del + 1 : 0);
        reg[id] = { v: o, t, del: r ? r.del || 0 : 0 };
        continue;
      }
      for (const f of new Set([...Object.keys(o), ...Object.keys(r.v)])) if (J(o[f]) !== J(r.v[f])) r.t[f] = agora;
      r.v = o;
    }
    const sumiram = Object.entries(reg).filter(([id, r]) => !visto.has(id) && vivo(r));
    if (!primeira) {
      // apagar de verdade passa pela Lixeira (a ficha some da lista e aparece no trash); sumir sem Lixeira é sinal de banco estragado
      const naLixeira = new Set((db.trash || []).map((t) => t && t.data && t.data.id));
      const vivosAntes = Object.entries(reg).filter(([id, r]) => !id.startsWith('trash:') && vivo(r)).length;
      const semLixeira = sumiram.filter(([id]) => !id.startsWith('trash:') && !naLixeira.has(id.slice(id.indexOf(':') + 1))).length;
      if (semLixeira > 20 && semLixeira > vivosAntes * 0.3) {
        throw new Error(`${semLixeira} registros sumiram deste computador de uma vez, sem passar pela Lixeira. A sincronização parou para não apagar nos outros computadores. Se foi de propósito (restaurou uma cópia antiga), desligue e ligue a sincronização: ela junta de novo sem apagar nada.`);
      }
    }
    for (const [, r] of sumiram) r.del = agora; // sumiu daqui: foi apagado aqui
  }

  // 2) junta o registro de outro computador: campo a campo, a marca mais nova vence
  function juntar(reg, outro) {
    let mudou = false;
    for (const [id, ro] of Object.entries(outro || {})) {
      if (!ro || typeof ro !== 'object' || !ro.t) continue;
      const r = reg[id];
      if (!r) { reg[id] = JSON.parse(J(ro)); mudou = true; continue; }
      const v = Object.assign({}, r.v);
      for (const f of new Set([...Object.keys(ro.t), ...Object.keys(r.t)])) {
        const a = r.t[f] || 0, b = ro.t[f] || 0;
        // empate de horário com valores diferentes: desempata pelo texto, para todos os PCs chegarem ao mesmo resultado
        if (b > a || (b === a && b && String(J(ro.v[f])) > String(J(r.v[f])))) {
          if (f in ro.v) v[f] = ro.v[f]; else delete v[f];
          r.t[f] = b; mudou = true;
        }
      }
      r.v = v;
      if ((ro.del || 0) > (r.del || 0)) { r.del = ro.del; mudou = true; }
    }
    return mudou;
  }

  // 3) monta as listas do banco a partir do registro, mantendo a ordem que já existe aqui
  function aplicar(db, reg) {
    const porLista = {};
    for (const [id, r] of Object.entries(reg)) {
      if (!vivo(r)) continue;
      const k = id.startsWith('trash:') ? 'trash' : id.slice(0, id.indexOf(':'));
      if (!LISTAS.includes(k)) continue;
      (porLista[k] || (porLista[k] = new Map())).set(id, r.v);
    }
    // a mesma ficha viva e na Lixeira (um PC apagou, outro editou depois): a entrada velha da Lixeira sai
    const vivos = new Set(); for (const k of LISTAS) if (k !== 'trash') for (const id of (porLista[k] || new Map()).keys()) vivos.add(id.slice(id.indexOf(':') + 1));
    const LIXO = { item: 'items', task: 'tasks', client: 'clients', fin: 'fin', habit: 'habits', goal: 'goals', tool: 'tools' };
    for (const [id, v] of [...(porLista.trash || new Map())]) {
      const alvo = LIXO[v.kind], vid = alvo && alvo + ':' + v.data.id, rv = vid && reg[vid];
      if (rv && vivo(rv) && Math.max(...Object.values(rv.t)) > (v.at || 0)) { porLista.trash.delete(id); reg[id].del = Date.now(); }
    }
    let mudou = false;
    for (const k of LISTAS) {
      const m = porLista[k] || new Map(), atual = db[k] || [], out = [];
      for (const o of atual) { const id = chave(k, o); if (m.has(id)) { out.push(m.get(id)); m.delete(id); } }
      for (const v of m.values()) out.push(v);
      if (k === 'trash') out.sort((x, y) => (y.at || 0) - (x.at || 0));
      if (J(out) !== J(atual)) { db[k] = out; mudou = true; }
    }
    return mudou;
  }

  // anexos: manda os que faltam na nuvem e traz os que faltam aqui (nomes únicos, então nunca sobrescreve nada)
  function anexos(db, dirN) {
    fs.mkdirSync(dirN, { recursive: true });
    let enviados = 0, recebidos = 0, faltando = 0;
    const nomes = new Set();
    for (const it of db.items) for (const a of it.attachments || []) if (a && a.file) nomes.add(path.basename(String(a.file)));
    for (const n of nomes) {
      const aqui = path.join(ctx.ANX, n), la = path.join(dirN, n);
      const ea = fs.existsSync(aqui), el = fs.existsSync(la);
      try {
        if (ea && !el) { fs.copyFileSync(aqui, la + '.tmp'); fs.renameSync(la + '.tmp', la); enviados++; }
        else if (!ea && el) { fs.copyFileSync(la, aqui + '.tmp'); fs.renameSync(aqui + '.tmp', aqui); recebidos++; }
        else if (!ea && !el) faltando++; // ainda não chegou pelo Drive: tenta na próxima
      } catch (_) { faltando++; }
    }
    return { enviados, recebidos, faltando };
  }

  let rodando = false;
  function sincronizar() {
    const c = cfg();
    if (!c.on) throw new Error('A sincronização entre computadores está desligada.');
    if (!c.pasta) throw new Error('Escolha a pasta do Google Drive (ou de outra nuvem).');
    if (!fs.existsSync(c.pasta)) throw new Error('Não achei a pasta ' + c.pasta + '. O Google Drive para computador está aberto?');
    if (rodando) return c.resumo;
    rodando = true;
    try {
      const b = base(c), dirA = path.join(b, 'aparelhos');
      fs.mkdirSync(dirA, { recursive: true });
      const leia = path.join(b, 'LEIA-ME.txt');
      if (!fs.existsSync(leia)) fs.writeFileSync(leia, 'Pasta de sincronização do MyLoot.\r\nCada computador grava só o seu arquivo em "aparelhos" e os anexos vão para "anexos".\r\nNão mexa nestes arquivos à mão. Senhas e chaves nunca vêm para cá.\r\n');
      const est = ler(ESTADO, null);
      const primeira = !est || est.pasta !== b;
      const reg = primeira ? {} : est.reg || {};
      const { db } = ctx.readDB();
      if (primeira) ctx.guardarCopia(); // antes de juntar pela primeira vez: cópia automática do banco (aparece em Cópias automáticas)
      carimbar(db, reg, primeira);
      const outros = [];
      for (const f of fs.readdirSync(dirA)) {
        if (!/^[a-z0-9]+\.json$/i.test(f) || f === c.id + '.json') continue;
        const o = ler(path.join(dirA, f), null); // arquivo ainda chegando pelo Drive: fica para a próxima
        if (o && o.reg) { juntar(reg, o.reg); outros.push({ nome: o.nome || f, quando: o.quando || 0 }); }
      }
      const mudou = aplicar(db, reg);
      if (mudou) ctx.writeDB(ctx.migrate(db), true);
      const ax = anexos(db, path.join(b, 'anexos'));
      const agora = Date.now();
      const hash = crypto.createHash('sha1').update(J(reg)).digest('hex'), meu = path.join(dirA, c.id + '.json');
      if (primeira || mudou || hash !== (est && est.hash) || !fs.existsSync(meu)) {
        gravar(meu, { app: 'myloot', formato: 1, id: c.id, nome: c.nome, quando: agora, reg });
        gravar(ESTADO, { pasta: b, reg, hash });
      }
      const resumo = { mudou, outros, anexos: ax, registros: Object.keys(reg).length };
      Object.assign(c, { ultima: agora, erro: '', resumo }); salvarCfg(c);
      return resumo;
    } catch (e) {
      const c2 = cfg(); c2.erro = e.message; salvarCfg(c2); throw e;
    } finally { rodando = false; }
  }

  // a cada gravação: marca a hora dos campos mudados já agora (assim vale a hora da edição, mesmo com a nuvem fora do ar)
  function marcar(db) {
    try {
      const c = cfg(); if (!c.on || !c.pasta) return;
      const est = ler(ESTADO, null); if (!est || est.pasta !== base(c)) return; // primeira vez: quem marca é a sincronização
      carimbar(db, est.reg || (est.reg = {}), false);
      est.hash = ''; // mudou aqui: a próxima rodada publica
      gravar(ESTADO, est);
    } catch (_) {}
  }

  // de tempos em tempos (60 s) e alguns segundos depois de cada gravação
  let tAgenda = 0;
  const tentar = () => { try { if (cfg().on) sincronizar(); } catch (_) {} };
  function agendar(ms) { clearTimeout(tAgenda); tAgenda = setTimeout(tentar, ms == null ? 5000 : ms); }
  setInterval(tentar, 60000).unref();

  function status() {
    const c = cfg();
    let aparelhos = [];
    if (c.pasta) { try { const d = path.join(base(c), 'aparelhos'); aparelhos = fs.readdirSync(d).filter((f) => /\.json$/.test(f)).map((f) => { const o = ler(path.join(d, f), {}); return { nome: o.nome || f, quando: o.quando || 0, este: f === c.id + '.json' }; }); } catch (_) {} }
    return { on: c.on, pasta: c.pasta, nome: c.nome, id: c.id, ultima: c.ultima, erro: c.erro, resumo: c.resumo, aparelhos, rodando };
  }
  function configurar(b) {
    const c = cfg();
    if ('pasta' in b) c.pasta = String(b.pasta || '').trim();
    if ('nome' in b) c.nome = String(b.nome || '').trim().slice(0, 40) || os.hostname();
    if ('on' in b) {
      if (b.on && !c.on) { try { fs.renameSync(ESTADO, ESTADO.replace(/\.json$/, '') + '-antes-de-religar-' + Date.now() + '.json'); } catch (_) {} }
      c.on = !!b.on;
      if (c.on) c.erro = '';
    }
    salvarCfg(c);
    return status();
  }
  return { sincronizar, agendar, status, configurar, marcar };
};
