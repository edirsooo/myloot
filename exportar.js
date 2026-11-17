// Exportar e proteger: ZIP com tudo em Markdown (abre como cofre do Obsidian) e backup com senha.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// ---------- ZIP (deflate, sem biblioteca) ----------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

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
  md('LEIA-ME.md', `# Exportado do MyLoot\n\nCada item é um arquivo .md, numa pasta por tipo, com os anexos ao lado.\nPara usar no Obsidian: extraia este ZIP e abra a pasta como cofre (Abrir pasta como cofre).\n\nExportado em ${new Date().toLocaleString('pt-BR')}.\n`);
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

module.exports = { zip, markdown, cifrar, decifrar, crc32 };
