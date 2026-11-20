// Integrações do MyLoot: enviar itens para o Notion e o Trello.
// As chaves ficam em data/segredos.json (fora do db.json, do backup, do Drive e do GitHub).
const https = require('https');

function req(method, host, pth, headers, body) {
  const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const h = Object.assign({ Accept: 'application/json' }, headers);
  if (data) { h['Content-Type'] = h['Content-Type'] || 'application/json'; h['Content-Length'] = data.length; }
  return new Promise((ok, no) => {
    const rq = https.request({ hostname: host, path: pth, method, headers: h, timeout: 30000 }, (rs) => {
      const parts = [];
      rs.on('data', (c) => parts.push(c));
      rs.on('end', () => {
        const txt = Buffer.concat(parts).toString('utf8');
        let j = null; try { j = JSON.parse(txt); } catch (_) {}
        ok({ st: rs.statusCode, j, txt });
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('Demorou demais. Tente de novo.')));
    rq.on('error', (e) => no(new Error(e.code === 'ENOTFOUND' ? 'Sem internet.' : e.message)));
    rq.end(data || undefined);
  });
}

const TIPOS = { estudo: '📚 Estudo / PDF', prompt: '✨ Prompt', instrucao: '📜 Instrução', comando: '⌨️ Comando', link: '🔗 Link', nota: '📝 Nota' };

// ---------------- Notion ----------------
const NV = '2022-06-28';
const nh = (tok) => ({ Authorization: 'Bearer ' + tok, 'Notion-Version': NV });
const nErr = (r) => {
  if (r.st === 401) return new Error('O Notion não aceitou o segredo da integração. Confira e cole de novo.');
  if (r.st === 404) return new Error('Página não encontrada. No Notion, conecte a integração à página (••• → Conexões).');
  if (r.st === 429) return new Error('O Notion pediu uma pausa. Tente de novo daqui a pouco.');
  return new Error((r.j && r.j.message) || 'Erro ' + r.st + ' no Notion.');
};
const titulo = (p) => {
  const props = p.properties || {};
  for (const k in props) if (props[k].type === 'title') return (props[k].title || []).map((t) => t.plain_text).join('') || 'Sem título';
  return 'Sem título';
};

async function notionPaginas(tok) {
  const r = await req('POST', 'api.notion.com', '/v1/search', nh(tok), { filter: { property: 'object', value: 'page' }, page_size: 100 });
  if (r.st !== 200) throw nErr(r);
  return r.j.results.filter((p) => !p.archived && p.parent && p.parent.type !== 'database_id').map((p) => ({ id: p.id, nome: (p.icon && p.icon.emoji ? p.icon.emoji + ' ' : '') + titulo(p) }));
}

const rt = (s) => [{ type: 'text', text: { content: s } }];
function blocos(it, url) {
  const B = [];
  const para = (s) => { for (let i = 0; i < s.length; i += 1900) B.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(s.slice(i, i + 1900)) } }); };
  B.push({ object: 'block', type: 'callout', callout: { icon: { emoji: '🎁' }, rich_text: rt(`${TIPOS[it.type] || 'Item'} · enviado do MyLoot${(it.tags || []).length ? ' · #' + it.tags.join(' #') : ''}`) } });
  if (it.desc) para(it.desc);
  if (url) B.push({ object: 'block', type: 'bookmark', bookmark: { url } });
  const txt = String(it.content || '');
  if (txt.trim()) {
    if (it.type === 'comando' || it.type === 'prompt') {
      for (let i = 0; i < txt.length; i += 1900) B.push({ object: 'block', type: 'code', code: { language: it.type === 'comando' ? 'shell' : 'plain text', rich_text: rt(txt.slice(i, i + 1900)) } });
    } else txt.split(/\n{2,}/).forEach((p) => p.trim() && para(p.trim()));
  }
  (it.checklist || []).forEach((c) => B.push({ object: 'block', type: 'to_do', to_do: { checked: !!c.done, rich_text: rt(String(c.t || '').slice(0, 1900)) } }));
  if ((it.attachments || []).length) B.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt('📎 Anexos no MyLoot: ' + it.attachments.map((a) => a.name).join(', ')) } });
  return B.slice(0, 100);
}

async function notionEnviar(cfg, it) {
  const url = it.type === 'link' && /^https?:\/\//i.test(String(it.content || '').trim()) ? String(it.content).trim().split(/\s/)[0] : '';
  const body = { parent: { page_id: cfg.alvo }, icon: { emoji: (TIPOS[it.type] || '📝').split(' ')[0] }, properties: { title: { title: rt((it.title || 'Sem título').slice(0, 1900)) } }, children: blocos(it, url) };
  const r = await req('POST', 'api.notion.com', '/v1/pages', nh(cfg.token), body);
  if (r.st !== 200) throw nErr(r);
  return { url: r.j.url };
}

// ---------------- Trello ----------------
const q = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const tErr = (r) => {
  if (r.st === 401) return new Error('O Trello não aceitou a chave ou o token. Confira e cole de novo.');
  if (r.st === 404) return new Error('Lista não encontrada no Trello. Escolha a lista de novo nas Configurações.');
  if (r.st === 429) return new Error('O Trello pediu uma pausa. Tente de novo daqui a pouco.');
  return new Error((r.j && r.j.message) || r.txt.slice(0, 200) || 'Erro ' + r.st + ' no Trello.');
};

async function trelloListas(key, token) {
  const r = await req('GET', 'api.trello.com', '/1/members/me/boards?' + q({ filter: 'open', fields: 'name', lists: 'open', list_fields: 'name', key, token }), {});
  if (r.st !== 200) throw tErr(r);
  const out = [];
  r.j.forEach((b) => (b.lists || []).forEach((l) => out.push({ id: l.id, nome: b.name + ' → ' + l.name })));
  return out;
}

async function trelloEnviar(cfg, it) {
  const L = [];
  L.push(`${TIPOS[it.type] || 'Item'} · enviado do MyLoot`);
  if ((it.tags || []).length) L.push('#' + it.tags.join(' #'));
  if (it.desc) L.push('', it.desc);
  const txt = String(it.content || '');
  if (txt.trim()) L.push('', it.type === 'comando' || it.type === 'prompt' ? '```\n' + txt + '\n```' : txt);
  if ((it.attachments || []).length) L.push('', '📎 Anexos no MyLoot: ' + it.attachments.map((a) => a.name).join(', '));
  const params = { idList: cfg.alvo, name: (it.title || 'Sem título').slice(0, 16384), desc: L.join('\n').slice(0, 16000), pos: 'top', key: cfg.key, token: cfg.token };
  const url = it.type === 'link' && /^https?:\/\//i.test(txt.trim()) ? txt.trim().split(/\s/)[0] : '';
  if (url) params.urlSource = url;
  const r = await req('POST', 'api.trello.com', '/1/cards?' + q(params), {});
  if (r.st !== 200) throw tErr(r);
  const card = r.j;
  const itens = (it.checklist || []).filter((c) => c.t);
  if (itens.length) {
    const c = await req('POST', 'api.trello.com', '/1/checklists?' + q({ idCard: card.id, name: 'Checklist', key: cfg.key, token: cfg.token }), {});
    if (c.st === 200) for (const x of itens) await req('POST', 'api.trello.com', `/1/checklists/${c.j.id}/checkItems?` + q({ name: String(x.t).slice(0, 16384), checked: !!x.done, key: cfg.key, token: cfg.token }), {});
  }
  return { url: card.shortUrl || card.url };
}

// ---------------- Trello dentro do MyLoot: ver e mexer nos quadros da própria pessoa ----------------
const TID = /^[0-9a-fA-F]{24}$/;
const tId = (x) => { x = String(x || ''); if (!TID.test(x)) throw new Error('Quadro, lista ou cartão inválido.'); return x; };
const txt = (x, n) => String(x == null ? '' : x).slice(0, n || 16384);
async function tr(cfg, method, pth, params) {
  if (!cfg || !cfg.key || !cfg.token) throw new Error('Conecte o seu Trello primeiro.');
  const r = await req(method, 'api.trello.com', '/1' + pth + '?' + q(Object.assign({}, params || {}, { key: cfg.key, token: cfg.token })), {});
  if (r.st === 404) throw new Error('Não achei isso no Trello (talvez tenha sido apagado ou arquivado). Atualize a tela.');
  if (r.st !== 200) throw tErr(r);
  return r.j;
}
async function trelloEu(cfg) { const j = await tr(cfg, 'GET', '/members/me', { fields: 'fullName,username' }); return { nome: j.fullName || j.username || '', usuario: j.username || '' }; }
async function trelloQuadros(cfg) {
  const j = await tr(cfg, 'GET', '/members/me/boards', { filter: 'open', fields: 'name,prefs,starred,dateLastActivity,url' });
  return j.map((b) => ({ id: b.id, nome: b.name, fav: !!b.starred, url: b.url, ult: b.dateLastActivity || '', cor: (b.prefs || {}).backgroundColor || '', img: (((b.prefs || {}).backgroundImageScaled || []).find((x) => x.width >= 400) || {}).url || (b.prefs || {}).backgroundImage || '' }));
}
async function trelloQuadro(cfg, id) {
  const j = await tr(cfg, 'GET', '/boards/' + tId(id), {
    fields: 'name,url,prefs', lists: 'open', list_fields: 'name,pos', cards: 'open',
    card_fields: 'name,desc,idList,pos,due,dueComplete,idLabels,idMembers,badges,shortUrl,cover', labels: 'all', label_fields: 'name,color', members: 'all', member_fields: 'fullName,initials',
  });
  const pr = j.prefs || {};
  return {
    quadro: { id: j.id, nome: j.name, url: j.url, cor: pr.backgroundColor || '', img: ((pr.backgroundImageScaled || []).find((x) => x.width >= 1000) || {}).url || pr.backgroundImage || '' },
    listas: (j.lists || []).map((l) => ({ id: l.id, nome: l.name, pos: l.pos })).sort((a, b) => a.pos - b.pos),
    cartoes: (j.cards || []).map((c) => ({ id: c.id, nome: c.name, desc: !!c.desc, lista: c.idList, pos: c.pos, prazo: c.due || '', feito: !!c.dueComplete, etiquetas: c.idLabels || [], membros: c.idMembers || [], url: c.shortUrl,
      capa: (c.cover || {}).color || '', check: [(c.badges || {}).checkItemsChecked || 0, (c.badges || {}).checkItems || 0], coment: (c.badges || {}).comments || 0, anexos: (c.badges || {}).attachments || 0 })),
    etiquetas: (j.labels || []).map((l) => ({ id: l.id, nome: l.name || '', cor: l.color || '' })),
    membros: (j.members || []).map((m) => ({ id: m.id, nome: m.fullName || '', ini: m.initials || '' })),
  };
}
async function trelloCartao(cfg, id) {
  const j = await tr(cfg, 'GET', '/cards/' + tId(id), { fields: 'name,desc,due,dueComplete,idList,idLabels,idMembers,shortUrl,idBoard', checklists: 'all', attachments: 'true', attachment_fields: 'name,url,isUpload,date', actions: 'commentCard', actions_limit: '40' });
  return {
    id: j.id, nome: j.name, desc: j.desc || '', prazo: j.due || '', feito: !!j.dueComplete, lista: j.idList, quadro: j.idBoard, etiquetas: j.idLabels || [], membros: j.idMembers || [], url: j.shortUrl,
    checklists: (j.checklists || []).map((c) => ({ id: c.id, nome: c.name, itens: (c.checkItems || []).sort((a, b) => a.pos - b.pos).map((i) => ({ id: i.id, nome: i.name, ok: i.state === 'complete' })) })),
    anexos: (j.attachments || []).map((a) => ({ id: a.id, nome: a.name, url: a.url, upload: !!a.isUpload })),
    comentarios: (j.actions || []).map((a) => ({ id: a.id, texto: (a.data || {}).text || '', quem: (a.memberCreator || {}).fullName || '', quando: a.date })),
  };
}
// ações que mudam o Trello: só estas, com ids conferidos
async function trelloAcao(cfg, b) {
  const op = String(b.op || '');
  if (op === 'cartaoMover') return tr(cfg, 'PUT', '/cards/' + tId(b.id), Object.assign({ idList: tId(b.lista) }, b.pos != null ? { pos: String(b.pos) } : {}));
  if (op === 'cartaoSalvar') {
    const p = {};
    if (b.nome != null) { if (!String(b.nome).trim()) throw new Error('O cartão precisa de um nome.'); p.name = txt(b.nome); }
    if (b.desc != null) p.desc = txt(b.desc);
    if (b.prazo != null) p.due = b.prazo ? new Date(b.prazo).toISOString() : 'null';
    if (b.feito != null) p.dueComplete = String(!!b.feito);
    if (Array.isArray(b.etiquetas)) p.idLabels = b.etiquetas.map(tId).join(',');
    if (b.lista) p.idList = tId(b.lista);
    return tr(cfg, 'PUT', '/cards/' + tId(b.id), p);
  }
  if (op === 'cartaoArquivar') return tr(cfg, 'PUT', '/cards/' + tId(b.id), { closed: 'true' });
  if (op === 'cartaoNovo') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome do cartão.'); return tr(cfg, 'POST', '/cards', { idList: tId(b.lista), name: txt(b.nome), pos: 'bottom' }); }
  if (op === 'comentar') { if (!String(b.texto || '').trim()) throw new Error('Escreva o comentário.'); return tr(cfg, 'POST', '/cards/' + tId(b.id) + '/actions/comments', { text: txt(b.texto) }); }
  if (op === 'checkItem') return tr(cfg, 'PUT', '/cards/' + tId(b.id) + '/checkItem/' + tId(b.item), { state: b.ok ? 'complete' : 'incomplete' });
  if (op === 'checkNovo') { if (!String(b.nome || '').trim()) throw new Error('Escreva o item.'); return tr(cfg, 'POST', '/checklists/' + tId(b.checklist) + '/checkItems', { name: txt(b.nome) }); }
  if (op === 'listaNova') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome da lista.'); return tr(cfg, 'POST', '/lists', { idBoard: tId(b.quadro), name: txt(b.nome, 512), pos: 'bottom' }); }
  if (op === 'listaRenomear') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome da lista.'); return tr(cfg, 'PUT', '/lists/' + tId(b.id), { name: txt(b.nome, 512) }); }
  if (op === 'listaArquivar') return tr(cfg, 'PUT', '/lists/' + tId(b.id) + '/closed', { value: 'true' });
  throw new Error('Ação desconhecida.');
}

module.exports = { notionPaginas, notionEnviar, trelloListas, trelloEnviar, trelloEu, trelloQuadros, trelloQuadro, trelloCartao, trelloAcao };
