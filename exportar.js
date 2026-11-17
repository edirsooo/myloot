// Exportar e proteger: ZIP com tudo em Markdown (abre como cofre do Obsidian), backup com senha
// e backup completo (banco + anexos num ZIP feito e lido em fluxo, sem carregar tudo na memória).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const stream = require('stream');

// ---------- ZIP (deflate, sem biblioteca) ----------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
// o segundo valor é o CRC do pedaço anterior: assim dá para somar um arquivo grande aos poucos (o Node novo já traz isso pronto e rápido)
const crc32 = zlib.crc32 ? (buf, ant) => zlib.crc32(buf, ant || 0)
  : (buf, ant) => { let c = ~(ant || 0); for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function zip(arquivos) { // [{nome, dados: Buffer}]
  const partes = [], central = [];
  let pos = 0;
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const dia = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(a.dados);
    const comp = zlib.deflateRawSync(a.dados);
    const usa = comp.length < a.dados.length; // arquivo já comprimido (PDF, imagem) vai guardado como está
    const corpo = usa ? comp : a.dados, metodo = usa ? 8 : 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(metodo, 8);
    h.writeUInt16LE(hora, 10); h.writeUInt16LE(dia, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(corpo.length, 18);
    h.writeUInt32LE(a.dados.length, 22); h.writeUInt16LE(nome.length, 26); h.writeUInt16LE(0, 28);
    partes.push(h, nome, corpo);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(metodo, 10);
    c.writeUInt16LE(hora, 12); c.writeUInt16LE(dia, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(corpo.length, 20);
    c.writeUInt32LE(a.dados.length, 24); c.writeUInt16LE(nome.length, 28); c.writeUInt32LE(pos, 42);
    central.push(c, nome);
    pos += 30 + nome.length + corpo.length;
  }
  const cd = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, cd, fim]);
}

// ---------- ZIP em fluxo (sem compactar): para o backup completo, que pode ter gigabytes ----------
// Nada é montado na memória: cada arquivo é lido duas vezes (uma para o CRC, outra para enviar) e o tamanho total sai antes, pelo plano.
// Passou de 4 GB ou de 65 mil arquivos, entra o ZIP64. O "limite" só existe para o teste forçar esse caminho com arquivos pequenos.
const u64 = (b, n, p) => b.writeBigUInt64LE(BigInt(n), p);
const dosData = (d) => [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];

function zipPlano(entradas, limite = 0xffffffff) { // [{ nome, dados: Buffer }] ou [{ nome, arquivo, tamanho, mtime }]
  let pos = 0;
  const L = entradas.map((e) => {
    const nome = Buffer.from(e.nome.replace(/\\/g, '/'), 'utf8'), tam = e.dados ? e.dados.length : e.tamanho;
    const x = { e, nome, tam, pos, grande: tam >= limite, longe: pos >= limite };
    pos += 30 + nome.length + (x.grande ? 20 : 0) + tam;
    return x;
  });
  const cd = L.reduce((s, x) => s + 46 + x.nome.length + (x.grande || x.longe ? 4 + (x.grande ? 16 : 0) + (x.longe ? 8 : 0) : 0), 0);
  const z64 = L.length >= 0xffff || cd >= limite || pos >= limite;
  return { L, cdPos: pos, cd, z64, limite, total: pos + cd + (z64 ? 76 : 0) + 22 };
}

// CRC e tamanho de um arquivo, lendo aos pedaços
async function crcArquivo(arquivo) {
  let crc = 0, n = 0;
  for await (const b of fs.createReadStream(arquivo)) { crc = crc32(b, crc); n += b.length; }
  return { crc, n };
}

// escreve respeitando o ritmo de quem recebe; se a conexão cair no meio, para em vez de ficar esperando para sempre
function escritor(saida) {
  let caiu = false, falha = null;
  const fim = () => { caiu = true; if (falha) falha(new Error('A conexão fechou no meio do envio.')); };
  saida.on('close', fim); saida.on('error', fim);
  return (buf) => new Promise((ok, no) => {
    if (caiu || saida.destroyed) return no(new Error('A conexão fechou no meio do envio.'));
    if (saida.write(buf)) return ok();
    falha = no; saida.once('drain', () => { falha = null; ok(); });
  });
}

async function zipFluxo(saida, entradas, limite) {
  const p = zipPlano(entradas, limite), w = escritor(saida), central = [];
  const mudou = (x) => new Error('O arquivo "' + x.e.nome + '" mudou durante o backup. Tente de novo.');
  for (const x of p.L) {
    const e = x.e, [hora, dia] = dosData(e.mtime || new Date());
    let crc = 0;
    if (e.dados) crc = crc32(e.dados);
    else if (x.tam) { const r = await crcArquivo(e.arquivo); if (r.n !== x.tam) throw mudou(x); crc = r.crc; }
    const t32 = x.grande ? 0xffffffff : x.tam;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(x.grande ? 45 : 20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(hora, 10); h.writeUInt16LE(dia, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(t32, 18); h.writeUInt32LE(t32, 22);
    h.writeUInt16LE(x.nome.length, 26); h.writeUInt16LE(x.grande ? 20 : 0, 28);
    await w(h); await w(x.nome);
    if (x.grande) { const ex = Buffer.alloc(20); ex.writeUInt16LE(1, 0); ex.writeUInt16LE(16, 2); u64(ex, x.tam, 4); u64(ex, x.tam, 12); await w(ex); }
    if (e.dados) { if (x.tam) await w(e.dados); }
    else if (x.tam) {
      let n = 0, c2 = 0;
      for await (const b of fs.createReadStream(e.arquivo)) { n += b.length; if (n > x.tam) throw mudou(x); c2 = crc32(b, c2); await w(b); }
      if (n !== x.tam || c2 !== crc) throw mudou(x);
    }
    const ex = Buffer.alloc(x.grande || x.longe ? 4 + (x.grande ? 16 : 0) + (x.longe ? 8 : 0) : 0);
    if (ex.length) { ex.writeUInt16LE(1, 0); ex.writeUInt16LE(ex.length - 4, 2); if (x.grande) { u64(ex, x.tam, 4); u64(ex, x.tam, 12); } if (x.longe) u64(ex, x.pos, ex.length - 8); }
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(45, 4); c.writeUInt16LE(ex.length ? 45 : 20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(hora, 12); c.writeUInt16LE(dia, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(t32, 20); c.writeUInt32LE(t32, 24);
    c.writeUInt16LE(x.nome.length, 28); c.writeUInt16LE(ex.length, 30); c.writeUInt32LE(x.longe ? 0xffffffff : x.pos, 42);
    central.push(c, x.nome, ex);
  }
  const cd = Buffer.concat(central), n = p.L.length;
  await w(cd);
  if (p.z64) {
    const f = Buffer.alloc(76);
    f.writeUInt32LE(0x06064b50, 0); u64(f, 44, 4); f.writeUInt16LE(45, 12); f.writeUInt16LE(45, 14);
    u64(f, n, 24); u64(f, n, 32); u64(f, cd.length, 40); u64(f, p.cdPos, 48);
    f.writeUInt32LE(0x07064b50, 56); u64(f, p.cdPos + cd.length, 64); f.writeUInt32LE(1, 72);
    await w(f);
  }
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Math.min(n, 0xffff), 8); fim.writeUInt16LE(Math.min(n, 0xffff), 10);
  fim.writeUInt32LE(cd.length >= p.limite ? 0xffffffff : cd.length, 12); fim.writeUInt32LE(p.cdPos >= p.limite ? 0xffffffff : p.cdPos, 16);
  await w(fim);
  return p.total;
}

// ---------- ler um ZIP que está em disco: só o índice vai para a memória, cada arquivo sai em fluxo ----------
const RUIM = 'Esse arquivo ZIP está danificado ou incompleto.';
function zipAbrir(arq) {
  const fd = fs.openSync(arq, 'r'), tam = fs.fstatSync(fd).size;
  const le = (pos, n) => {
    if (pos < 0 || pos + n > tam) throw new Error(RUIM);
    const b = Buffer.alloc(n); let k = 0;
    while (k < n) { const r = fs.readSync(fd, b, k, n - k, pos + k); if (!r) throw new Error(RUIM); k += r; }
    return b;
  };
  try {
    const n = Math.min(tam, 65557), rabo = le(tam - n, n);
    let i = n - 22;
    while (i >= 0 && rabo.readUInt32LE(i) !== 0x06054b50) i--;
    if (i < 0) throw new Error(RUIM);
    let qtd = rabo.readUInt16LE(i + 10), cdTam = rabo.readUInt32LE(i + 12), cdPos = rabo.readUInt32LE(i + 16);
    const fimPos = tam - n + i;
    if (fimPos >= 20) { // ZIP64: os números de verdade ficam num registro à parte, apontado logo antes do fim
      const loc = le(fimPos - 20, 20);
      if (loc.readUInt32LE(0) === 0x07064b50) {
        const r = le(Number(loc.readBigUInt64LE(8)), 56);
        if (r.readUInt32LE(0) !== 0x06064b50) throw new Error(RUIM);
        qtd = Number(r.readBigUInt64LE(32)); cdTam = Number(r.readBigUInt64LE(40)); cdPos = Number(r.readBigUInt64LE(48));
      }
    }
    if (cdTam > 300e6) throw new Error('Esse ZIP tem arquivos demais para o MyLoot abrir.');
    const cd = le(cdPos, cdTam), entradas = [];
    let o = 0;
    for (let k = 0; k < qtd; k++) {
      if (o + 46 > cd.length || cd.readUInt32LE(o) !== 0x02014b50) throw new Error(RUIM);
      const nl = cd.readUInt16LE(o + 28), el = cd.readUInt16LE(o + 30), cl = cd.readUInt16LE(o + 32);
      const x = { nome: cd.toString('utf8', o + 46, o + 46 + nl), flags: cd.readUInt16LE(o + 8), metodo: cd.readUInt16LE(o + 10), crc: cd.readUInt32LE(o + 16), comp: cd.readUInt32LE(o + 20), tam: cd.readUInt32LE(o + 24), pos: cd.readUInt32LE(o + 42) };
      let y = o + 46 + nl; const fy = y + el;
      if (fy + cl > cd.length) throw new Error(RUIM);
      while (y + 4 <= fy) {
        const id = cd.readUInt16LE(y), sz = cd.readUInt16LE(y + 2);
        if (id === 1) { // campo ZIP64: traz, nesta ordem, só os números que não couberam
          let q = y + 4;
          for (const campo of ['tam', 'comp', 'pos']) if (x[campo] === 0xffffffff && q + 8 <= y + 4 + sz) { x[campo] = Number(cd.readBigUInt64LE(q)); q += 8; }
        }
        y += 4 + sz;
      }
      entradas.push(x);
      o = fy + cl;
    }
    return { arq, tam, le, entradas, fechar: () => { try { fs.closeSync(fd); } catch (_) {} } };
  } catch (e) { try { fs.closeSync(fd); } catch (_) {} throw e; }
}

// tira um arquivo do ZIP conferindo tamanho e CRC. Com destino, grava direto no disco; sem destino, devolve o conteúdo (só para arquivo pequeno)
async function zipExtrair(z, e, destino, max) {
  if (e.flags & 1) throw new Error('ZIP protegido por senha não é aceito aqui.');
  if (e.metodo !== 0 && e.metodo !== 8) throw new Error('Esse ZIP usa um tipo de compactação que o MyLoot não abre.');
  if (max != null && e.tam > max) throw new Error(RUIM);
  const h = z.le(e.pos, 30);
  if (h.readUInt32LE(0) !== 0x04034b50) throw new Error(RUIM);
  const ini = e.pos + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
  if (ini + e.comp > z.tam) throw new Error(RUIM);
  const estragado = 'O arquivo "' + e.nome + '" está danificado dentro do backup.';
  let crc = 0, n = 0;
  const partes = [];
  const confere = new stream.Transform({ transform(b, _, cb) { n += b.length; if (n > e.tam) return cb(new Error(estragado)); crc = crc32(b, crc); cb(null, b); } });
  const fim = destino ? fs.createWriteStream(destino) : new stream.Writable({ write(b, _, cb) { partes.push(b); cb(); } });
  const cadeia = [e.comp ? fs.createReadStream(z.arq, { start: ini, end: ini + e.comp - 1 }) : stream.Readable.from([])];
  if (e.metodo === 8) cadeia.push(zlib.createInflateRaw());
  try { await stream.promises.pipeline([...cadeia, confere, fim]); }
  catch (er) { // erro de leitura ou de descompactação é arquivo estragado; o resto (disco cheio, sem permissão) é dito como é
    if (er.code === 'ENOSPC') throw new Error('Acabou o espaço no disco no meio da restauração.');
    throw new Error(er.message === estragado || /^Z_/.test(er.code || '') ? estragado : 'Não consegui gravar "' + e.nome + '": ' + er.message);
  }
  if (n !== e.tam || crc !== e.crc) throw new Error(estragado);
  return destino ? n : Buffer.concat(partes);
}

// move sem apagar nada do caminho; entre discos diferentes, copia e só então tira o original
function mover(de, para) {
  try { fs.renameSync(de, para); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(de, para); fs.unlinkSync(de); }
}

// ---------- backup completo: banco + pasta de anexos num ZIP só ----------
// O primeiro arquivo do ZIP é a "etiqueta": diz que é um backup do MyLoot e o que tem dentro (a tela lê só o começo do arquivo para mostrar a prévia).
const ETIQUETA = 'myloot-backup.json';
const NAO_E = 'Esse ZIP não é um backup completo do MyLoot. Use o arquivo baixado no botão “Backup completo (com anexos)”.';
function backupPlano(db, ANX) {
  const anexos = [];
  let bytes = 0;
  for (const f of fs.readdirSync(ANX).sort()) {
    try { const st = fs.statSync(path.join(ANX, f)); if (st.isFile()) { anexos.push({ nome: 'anexos/' + f, arquivo: path.join(ANX, f), tamanho: st.size, mtime: st.mtime }); bytes += st.size; } } catch (_) {}
  }
  const n = (k) => (Array.isArray(db[k]) ? db[k].length : 0);
  const etiqueta = { formato: 'myloot-completo', v: 1, criado: new Date().toISOString(), itens: n('items'), tarefas: n('tasks'), clientes: n('clients'), anexos: anexos.length, bytesAnexos: bytes };
  const entradas = [{ nome: ETIQUETA, dados: Buffer.from(JSON.stringify(etiqueta), 'utf8') }, { nome: 'db.json', dados: Buffer.from(JSON.stringify(db, null, 1), 'utf8') }, ...anexos];
  return { entradas, etiqueta, total: zipPlano(entradas).total };
}

// nome de anexo que pode ser gravado: um nome simples, sem pasta, sem ".." e sem nome reservado do Windows
const nomeSeguro = (n) => !!n && n.length <= 255 && !/[\\/:*?"<>|\x00-\x1f]/.test(n) && !/^\.+$/.test(n) && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(n) && path.basename(n) === n;
const livre = (pasta) => { try { const s = fs.statfsSync(pasta); return Number(s.bavail) * Number(s.bsize); } catch (_) { return null; } };
const MB = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB');

// 1ª parte da restauração: confere o ZIP inteiro e deixa prontos, na pasta de trabalho, só os anexos que ainda não existem aqui.
// Não mexe no banco nem na pasta de anexos: se algo estiver errado, nada mudou.
async function restaurarCompleto(zipArq, o) { // o = { ANX, tmp }
  let z;
  try { z = zipAbrir(zipArq); } catch (_) { // começa como ZIP mas não abre: veio cortado ou estragado; senão, nem ZIP é
    let pk = false; try { const fd = fs.openSync(zipArq, 'r'), b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); pk = b.readUInt32LE(0) === 0x04034b50; } catch (_) {}
    throw new Error(pk ? RUIM + ' Baixe o backup de novo e tente outra vez.' : NAO_E);
  }
  try {
    // ZIP refeito à mão (o Safari, por exemplo, abre o ZIP sozinho ao baixar): tudo pode ter ido para dentro de uma pasta, então vale o caminho da etiqueta
    const eEt = z.entradas.find((e) => e.nome === ETIQUETA || e.nome.endsWith('/' + ETIQUETA)), pre = eEt ? eEt.nome.slice(0, -ETIQUETA.length) : '';
    const eDb = z.entradas.find((e) => e.nome === pre + 'db.json');
    if (!eEt || !eDb) throw new Error(NAO_E);
    let etiqueta = null, db = null;
    try { etiqueta = JSON.parse((await zipExtrair(z, eEt, null, 1e6)).toString('utf8')); } catch (_) {}
    if (!etiqueta || etiqueta.formato !== 'myloot-completo') throw new Error(NAO_E);
    try { db = JSON.parse((await zipExtrair(z, eDb, null, 400e6)).toString('utf8')); } catch (_) {}
    if (!db || !Array.isArray(db.items)) throw new Error('O backup está danificado: não consegui ler os registros de dentro dele.');
    const r = { novos: 0, pulados: 0, trocados: 0, ignorados: 0 }, falta = [];
    // o Mac regrava os acentos dos nomes de outro jeito: o anexo entra com o nome exatamente como o banco cita
    const citados = new Map();
    JSON.stringify(db, (k, v) => { if (k === 'file' && typeof v === 'string') citados.set(v.normalize('NFC'), v); return v; });
    for (const e of z.entradas) {
      if (!e.nome.startsWith(pre + 'anexos/') || e.nome.endsWith('/')) continue;
      let nome = e.nome.slice(pre.length + 7);
      nome = citados.get(nome.normalize('NFC')) || nome;
      const dst = path.join(o.ANX, nome);
      if (!nomeSeguro(nome) || nome[0] === '.' || path.dirname(path.resolve(dst)) !== path.resolve(o.ANX)) { r.ignorados++; continue; }
      let st = null; try { st = fs.statSync(dst); } catch (_) {}
      if (st && !st.isFile()) { r.ignorados++; continue; }
      if (st && st.size === e.tam && (await crcArquivo(dst)).crc === e.crc) { r.pulados++; continue; } // mesmo nome e mesmo conteúdo: já está aqui
      falta.push({ e, nome, dst, existe: !!st });
    }
    const precisa = falta.reduce((s, x) => s + x.e.tam, 0), tem = livre(o.tmp);
    if (tem != null && precisa > tem - 50e6) throw new Error(`Falta espaço no disco: os anexos do backup ocupam ${MB(precisa)} e há ${MB(tem)} livres.`);
    const prontos = [];
    for (const x of falta) {
      const tmp = path.join(o.tmp, 'a' + prontos.length);
      await zipExtrair(z, x.e, tmp);
      prontos.push({ tmp, dst: x.dst, nome: x.nome, existe: x.existe });
    }
    return { db, etiqueta, r, prontos };
  } finally { z.fechar(); }
}
// 2ª parte: põe os anexos novos no lugar. Se já havia um arquivo com o mesmo nome e conteúdo diferente, ele vai para a pasta "guarda" (nada é apagado).
function aplicarAnexos(res, guarda) {
  for (const x of res.prontos) {
    if (x.existe && fs.existsSync(x.dst)) { fs.mkdirSync(guarda, { recursive: true }); mover(x.dst, path.join(guarda, x.nome)); res.r.trocados++; } else res.r.novos++;
    mover(x.tmp, x.dst);
  }
  return res.r;
}

// ---------- Markdown de tudo ----------
function markdown(db, h) { // h = { itemToMd, TYPE_DIR, slug, safeName, ANX, anexos }
  const out = [];
  const md = (nome, txt) => out.push({ nome, dados: Buffer.from(txt, 'utf8') });
  for (const it of db.items) {
    const dir = h.TYPE_DIR[it.type] || 'Outros';
    md(`${dir}/${h.slug(it.title)}-${it.id}.md`, h.itemToMd(it, db));
    if (!h.anexos) continue;
    for (const a of it.attachments) {
      const src = path.join(h.ANX, path.basename(a.file || ''));
      try { out.push({ nome: `${dir}/anexos/${it.id}/${h.safeName(a.name)}`, dados: fs.readFileSync(src) }); } catch (_) {}
    }
  }
  const nomeCli = (id) => ((db.clients || []).find((c) => c.id === id) || {}).nome || '';
  for (const c of db.clients || []) {
    const L = ['---', `nome: ${JSON.stringify(c.nome)}`, `status: ${c.status}`];
    for (const k of ['empresa', 'email', 'whats', 'insta', 'site', 'trello', 'pasta']) if (c[k]) L.push(`${k}: ${JSON.stringify(c[k])}`);
    L.push(`id: ${c.id}`, '---', '', `# ${c.nome || 'Cliente'}`, '');
    if (c.notas) L.push(c.notas, '');
    const its = db.items.filter((i) => i.client === c.id);
    if (its.length) { L.push('## Itens'); its.forEach((i) => L.push(`- [[${h.slug(i.title)}-${i.id}|${i.title || 'Sem título'}]]`)); L.push(''); }
    const ts = db.tasks.filter((t) => t.client === c.id);
    if (ts.length) { L.push('## Tarefas'); ts.forEach((t) => L.push(`- [${t.done ? 'x' : ' '}] ${t.text}${t.date ? ' 📅 ' + t.date : ''}`)); L.push(''); }
    md(`Clientes/${h.slug(c.nome)}-${c.id}.md`, L.join('\n'));
  }
  const T = ['# Tarefas', ''];
  for (const t of [...db.tasks].sort((a, b) => (a.date || '9').localeCompare(b.date || '9'))) {
    T.push(`- [${t.done ? 'x' : ' '}] ${t.text}${t.date ? ' 📅 ' + t.date : ''}${t.hora ? ' ⏰ ' + t.hora : ''}${t.rep ? ' 🔁 ' + t.rep : ''}${t.client ? ' 👤 ' + nomeCli(t.client) : ''}`);
  }
  md('Tarefas.md', T.join('\n') + '\n');
  if ((db.fin || []).length) { // financeiro em CSV (abre no Excel e no Google Planilhas)
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const L = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Cliente', 'Forma', 'Valor', 'Situação', 'Parcela'].map(q).join(';')];
    [...db.fin].sort((a, b) => a.data.localeCompare(b.data)).forEach((f) => L.push([f.data, f.tipo === 'entrada' ? 'Entrada' : 'Saída', f.desc, f.cat, nomeCli(f.client), f.forma,
      (f.tipo === 'entrada' ? f.valor : -f.valor).toFixed(2).replace('.', ','), f.pago ? 'Pago' : 'Pendente', f.parc].map(q).join(';')));
    out.push({ nome: 'Financeiro.csv', dados: Buffer.from('﻿' + L.join('\r\n'), 'utf8') });
  }
  // Rotina (hábitos e metas) e as ferramentas que a pessoa guardou
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const num = (v) => String(Math.round((Number(v) || 0) * 100) / 100).replace('.', ',');
  const habitos = db.habits || [], metas = db.goals || [], ferr = db.tools || [];
  if (habitos.length) {
    const L = ['# Hábitos', ''];
    for (const hb of habitos) {
      const dias = Object.keys(hb.log || {}).filter((d) => Number(hb.log[d]) > 0).sort().reverse();
      const freq = hb.freq === 'semana' ? ((hb.dias || []).length === 7 ? 'Todo dia' : (hb.dias || []).slice().sort().map((i) => DOW[i]).join(', ')) : hb.freq === 'vezes' ? `${hb.vezes || 1}x por semana` : 'Todo dia';
      L.push(`## ${hb.em || '🎯'} ${hb.nome || 'Hábito'}${hb.arq ? ' (arquivado)' : hb.pausa ? ' (pausado)' : ''}`, '', `- Frequência: ${freq}`);
      if ((Number(hb.alvo) || 1) > 1) L.push(`- Meta do dia: ${num(hb.alvo)} ${hb.un || ''}`.trim());
      if (hb.hora) L.push(`- Lembrete: ${hb.hora}`);
      if (hb.criado) L.push(`- Criado em: ${hb.criado}`);
      L.push(`- Dias marcados: ${dias.length}`, '');
      if (dias.length) { L.push('| Data | Feito |', '|---|---|'); dias.forEach((d) => L.push(`| ${d} | ${num(hb.log[d])} |`)); L.push(''); }
    }
    md('Rotina/Habitos.md', L.join('\n'));
  }
  if (metas.length) {
    const L = ['# Metas', ''];
    for (const g of metas) {
      const alvo = Number(g.alvo) || 0, atual = Number(g.atual) || 0;
      L.push(`## ${g.em || '🏁'} ${g.nome || 'Meta'}${g.arq ? ' (arquivada)' : ''}`, '', `- Progresso: ${num(atual)} de ${num(alvo)} ${g.un || ''}`.trim() + (alvo ? ` (${Math.min(100, Math.round((atual / alvo) * 100))}%)` : ''));
      if (g.prazo) L.push(`- Prazo: ${g.prazo}`);
      if (g.criado) L.push(`- Criada em: ${g.criado}`);
      if (g.feitoEm) L.push(`- Concluída em: ${g.feitoEm}`);
      L.push('');
      if ((g.hist || []).length) { L.push('### Avanços', ''); g.hist.forEach((x) => L.push(`- ${x.d || ''}: ${Number(x.v) < 0 ? '' : '+'}${num(x.v)}`)); L.push(''); }
    }
    md('Rotina/Metas.md', L.join('\n'));
  }
  if (ferr.length) {
    const GR = { video: 'IAs de vídeo', imagem: 'IAs de imagem', aberto: 'Código aberto', artcraft: 'Pacote ArtCraft', extras: 'Extras' };
    const L = ['# Minhas ferramentas', ''], grupos = {};
    for (const f of ferr) (grupos[GR[f.g] || 'Outras'] = grupos[GR[f.g] || 'Outras'] || []).push(f);
    for (const g of Object.keys(grupos)) {
      L.push(`## ${g}`, '');
      for (const f of grupos[g]) {
        const tx = [f.s ? 'Substitui ' + f.s + '.' : '', f.p || '', f.gr ? 'Grátis? ' + f.gr + '.' : '', f.onde ? 'Onde: ' + f.onde + '.' : ''].filter(Boolean).join(' ');
        L.push(`- ${f.u ? `[${f.n || f.u}](${f.u})` : f.n || 'Ferramenta'}${f.arq ? ' (arquivada)' : ''}${tx ? ': ' + tx : ''}`);
      }
      L.push('');
    }
    md('Ferramentas.md', L.join('\n'));
  }
  const dentro = [`- ${db.items.length} itens da Biblioteca, um arquivo .md por item, numa pasta por tipo${h.anexos ? ', com os anexos ao lado' : ' (sem os anexos)'}`,
    `- ${(db.clients || []).length} clientes, na pasta Clientes`, `- ${db.tasks.length} tarefas, em Tarefas.md`,
    `- ${(db.fin || []).length} lançamentos do Financeiro, em Financeiro.csv (abre no Excel e no Google Planilhas)`,
    `- ${habitos.length} hábitos e ${metas.length} metas, na pasta Rotina`, `- ${ferr.length} ferramentas guardadas, em Ferramentas.md`];
  md('LEIA-ME.md', `# Exportado do MyLoot\n\nO que vem neste ZIP:\n${dentro.join('\n')}\n\nO que não vem: a Lixeira, os pontos e conquistas e as configurações. Esta exportação serve para ler e usar fora do MyLoot; ela não volta para dentro do app. Para guardar tudo e poder restaurar, use Configurações → Dados e backup → Backup completo.\n\nPara usar no Obsidian: extraia este ZIP e abra a pasta como cofre (Abrir pasta como cofre).\n\nExportado em ${new Date().toLocaleString('pt-BR')}.\n`);
  return zip(out);
}

// ---------- backup com senha (AES-256-GCM, chave pelo scrypt) ----------
function cifrar(texto, senha) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const chave = crypto.scryptSync(String(senha), salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([c.update(Buffer.from(texto, 'utf8')), c.final()]);
  return { formato: 'myloot-cripto', v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), dados: dados.toString('base64') };
}
function decifrar(o, senha) {
  try {
    const chave = crypto.scryptSync(String(senha), Buffer.from(o.salt, 'base64'), 32);
    const d = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(o.iv, 'base64'));
    d.setAuthTag(Buffer.from(o.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(o.dados, 'base64')), d.final()]).toString('utf8');
  } catch (_) { throw new Error('Senha errada ou arquivo danificado.'); }
}

module.exports = { zip, markdown, cifrar, decifrar, crc32, zipPlano, zipFluxo, zipAbrir, zipExtrair, crcArquivo, mover, backupPlano, restaurarCompleto, aplicarAnexos, livre, MB };
