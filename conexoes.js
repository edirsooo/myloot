// Conexões: porta para outros programas do computador mandarem itens para o MyLoot.
// Cada app conectado tem um código próprio (data/conexoes.json). A rota /api/entrada só ACRESCENTA ou atualiza
// itens marcados com a origem (app + id); nunca regrava o banco inteiro nem lê o que a pessoa guardou.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FORMATO = 'myloot-entrada-1';
const TIPOS = ['estudo', 'prompt', 'instrucao', 'comando', 'link', 'nota'];
const txt = (v, max) => String(v == null ? '' : v).slice(0, max);

module.exports = (DATA) => {
  const ARQ = path.join(DATA, 'conexoes.json');
  const ler = () => { try { const j = JSON.parse(fs.readFileSync(ARQ, 'utf8')); return Array.isArray(j) ? j : []; } catch (_) { return []; } };
  const gravar = (L) => { const tmp = ARQ + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(L, null, 1)); fs.renameSync(tmp, ARQ); };

  const listar = () => ler();
  function criar(nome) {
    const L = ler();
    const c = { id: crypto.randomBytes(4).toString('hex'), nome: txt(nome, 40).trim() || 'App conectado', codigo: 'ml_' + crypto.randomBytes(16).toString('hex'), on: true, criado: Date.now(), ultimoUso: 0, recebidos: 0 };
    L.push(c); gravar(L);
    return c;
  }
  function mudar(id, o) { const L = ler(); const c = L.find((x) => x.id === id); if (!c) return null; if ('on' in o) c.on = !!o.on; if (o.nome) c.nome = txt(o.nome, 40).trim() || c.nome; gravar(L); return c; }
  function apagar(id) { const L = ler(); gravar(L.filter((x) => x.id !== id)); }
  // comparação em tempo constante, para não dar pista do código pelo tempo de resposta
  function achar(codigo) {
    const a = Buffer.from(String(codigo || ''));
    if (a.length < 10) return null;
    return ler().find((c) => { const b = Buffer.from(c.codigo); return c.on && a.length === b.length && crypto.timingSafeEqual(a, b); }) || null;
  }
  function usou(id, n) { const L = ler(); const c = L.find((x) => x.id === id); if (c) { c.ultimoUso = Date.now(); c.recebidos = (c.recebidos || 0) + n; gravar(L); } }

  // junta os itens recebidos ao banco (muda `db` no lugar) e devolve o resumo
  function receber(db, cx, corpo, uid) {
    if (!corpo || corpo.formato !== FORMATO) throw new Error('Formato desconhecido. Use "' + FORMATO + '".');
    const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 200) : [];
    if (!itens.length) throw new Error('Nenhum item no pedido.');
    const app = txt(corpo.app || cx.nome, 40).trim() || cx.nome;
    const out = { ok: true, criados: 0, atualizados: 0, itens: [] };
    const agora = Date.now();
    for (const x of itens) {
      if (!x || typeof x !== 'object') continue;
      const oid = txt(x.id, 200).trim();
      const tags = (Array.isArray(x.etiquetas) ? x.etiquetas : []).map((t) => txt(t, 40).trim().replace(/^#/, '')).filter(Boolean).slice(0, 30);
      const links = (Array.isArray(x.links) ? x.links : []).filter((l) => l && /^https?:\/\//i.test(l.url || '')).slice(0, 20).map((l) => ({ id: uid(), url: txt(l.url, 2000), label: txt(l.label, 80) }));
      const check = (Array.isArray(x.checklist) ? x.checklist : []).map((t) => txt(typeof t === 'string' ? t : t && t.t, 300).trim()).filter(Boolean).slice(0, 100);
      const url = /^https?:\/\//i.test(x.url || '') ? txt(x.url, 2000) : '';
      const type = TIPOS.includes(x.tipo) ? x.tipo : (url && !x.conteudo ? 'link' : 'nota');
      const cliente = txt(x.cliente, 80).trim().toLowerCase();
      const cli = cliente ? (db.clients || []).find((c) => String(c.nome || '').trim().toLowerCase() === cliente || String(c.empresa || '').trim().toLowerCase() === cliente) : null;
      let it = oid ? db.items.find((i) => i.origem && i.origem.app === app && i.origem.id === oid) : null;
      const novo = !it;
      if (novo) {
        it = { id: uid(), type, title: '', desc: '', content: '', checklist: [], links: [], attachments: [], cat: '', status: 'ver', tags: [], date: '', fav: false, client: '', created: agora, updated: agora };
        db.items.push(it);
      }
      it.type = type;
      it.title = txt(x.titulo, 200).trim() || it.title || 'Recebido de ' + app;
      it.desc = txt(x.descricao, 4000);
      it.content = txt(x.conteudo, 400000) || (type === 'link' ? url : '');
      it.tags = [...new Set([...(it.tags || []), ...tags])];
      // checklist e links: acrescenta o que ainda não está (não apaga o que a pessoa marcou ou escreveu)
      for (const t of check) if (!it.checklist.some((c) => c.t === t)) it.checklist.push({ id: uid(), t, done: false });
      for (const l of links) if (!it.links.some((k) => k.url === l.url)) it.links.push(l);
      if (url && type !== 'link' && !it.links.some((k) => k.url === url)) it.links.unshift({ id: uid(), url, label: txt(x.rotulo, 80) || app });
      if (/^\d{4}-\d\d-\d\d$/.test(x.data || '')) it.date = x.data;
      if (cli) it.client = cli.id;
      it.origem = { app, id: oid, url, em: agora };
      it.updated = agora;
      out[novo ? 'criados' : 'atualizados']++;
      out.itens.push({ id: oid, item: it.id, novo });
    }
    if (!out.itens.length) throw new Error('Nenhum item válido no pedido.');
    return out;
  }

  return { FORMATO, listar, criar, mudar, apagar, achar, usou, receber };
};
