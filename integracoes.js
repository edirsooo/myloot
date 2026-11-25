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
async function tr(cfg, method, pth, params, body) {
  if (!cfg || !cfg.key || !cfg.token) throw new Error('Conecte o seu Trello primeiro.');
  const r = await req(method, 'api.trello.com', '/1' + pth + '?' + q(Object.assign({}, params || {}, { key: cfg.key, token: cfg.token })), {}, body);
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
    fields: 'name,url,prefs', lists: 'open', list_fields: 'name,pos', cards: 'visible', // visible: só cartões abertos de listas abertas (open trazia os de listas arquivadas)
   
    card_fields: 'name,desc,idList,pos,due,dueComplete,idLabels,idMembers,badges,shortUrl,cover,dateLastActivity', card_attachments: 'cover', card_attachment_fields: 'previews', labels: 'all', label_fields: 'name,color', members: 'all', member_fields: 'fullName,initials',
  });
  const pr = j.prefs || {};
  return {
    quadro: { id: j.id, nome: j.name, url: j.url, cor: pr.backgroundColor || '', img: ((pr.backgroundImageScaled || []).find((x) => x.width >= 1000) || {}).url || pr.backgroundImage || '' },
    listas: (j.lists || []).map((l) => ({ id: l.id, nome: l.name, pos: l.pos })).sort((a, b) => a.pos - b.pos),
    cartoes: (j.cards || []).map((c) => ({ capaImg: capaDe(c), ativ: c.dateLastActivity || '', id: c.id, nome: c.name, desc: !!c.desc, lista: c.idList, pos: c.pos, prazo: c.due || '', feito: !!c.dueComplete, etiquetas: c.idLabels || [], membros: c.idMembers || [], url: c.shortUrl,
      capa: (c.cover || {}).color || '', capaCheia: (c.cover || {}).size === 'full', check: [(c.badges || {}).checkItemsChecked || 0, (c.badges || {}).checkItems || 0], coment: (c.badges || {}).comments || 0, anexos: (c.badges || {}).attachments || 0 })),
    etiquetas: (j.labels || []).map((l) => ({ id: l.id, nome: l.name || '', cor: l.color || '' })),
    membros: (j.members || []).map((m) => ({ id: m.id, nome: m.fullName || '', ini: m.initials || '' })),
  };
}
// capa com imagem: o endereço fica guardado aqui no servidor (o app pede só pelo id do cartão) e o arquivo é buscado com o login do Trello
// o cache das imagens é por conta (troca de chave ou desconectar não entrega a capa antiga) e tem limite de 120 MB no total
const capas = new Map(), capaCache = new Map(); let capaBytes = 0;
function capaDe(c) {
  const idA = (c.cover || {}).idAttachment, a = idA && (c.attachments || []).find((x) => x.id === idA);
  const P = ((a && a.previews) || []).filter((p) => p.scaled && p.url), p = P.find((x) => x.width >= 300) || P[P.length - 1];
  if (!p) { capas.delete(c.id); return null; }
  capas.delete(c.id); capas.set(c.id, p.url); if (capas.size > 5000) capas.delete(capas.keys().next().value);
  return { v: idA, w: p.width, h: p.height };
}
async function trelloCapa(cfg, id) {
  if (!cfg.key || !cfg.token) throw new Error('Conecte o Trello primeiro.');
  let url = capas.get(tId(id));
  if (!url) { const c = await tr(cfg, 'GET', '/cards/' + id, { fields: 'cover', attachments: 'cover', attachment_fields: 'previews' }); capaDe(c); url = capas.get(id); }
  if (!url) throw new Error('Este cartão não tem capa.');
  const ck = cfg.token.slice(-12) + '|' + url;
  if (capaCache.has(ck)) return capaCache.get(ck);
  const u = new URL(url); if (!/(^|\.)trello\.com$/.test(u.hostname)) throw new Error('Capa fora do Trello.');
  const r = await new Promise((ok, no) => {
    const rq = https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 20000, headers: { Authorization: `OAuth oauth_consumer_key="${cfg.key}", oauth_token="${cfg.token}"` } }, (rs) => {
      const parts = []; let n = 0;
      rs.on('data', (c) => { n += c.length; if (n > 5e6) rq.destroy(new Error('Capa grande demais.')); else parts.push(c); });
      rs.on('end', () => (rs.statusCode === 200 ? ok({ buf: Buffer.concat(parts), tipo: rs.headers['content-type'] || 'image/jpeg' }) : no(new Error('O Trello não entregou a capa (' + rs.statusCode + ').'))));
    });
    rq.on('timeout', () => rq.destroy(new Error('Demorou demais.'))); rq.on('error', no);
  });
  if (!/^image\/(jpeg|png|gif|webp|avif)\s*(;|$)/i.test(r.tipo)) throw new Error('A capa não é uma imagem comum (JPG, PNG, GIF ou WebP).');
  while (capaCache.size && (capaCache.size >= 300 || capaBytes + r.buf.length > 120e6)) { const k = capaCache.keys().next().value; capaBytes -= capaCache.get(k).buf.length; capaCache.delete(k); }
  capaCache.set(ck, r); capaBytes += r.buf.length;
  return r;
}
async function trelloCartao(cfg, id) {
  const j = await tr(cfg, 'GET', '/cards/' + tId(id), { fields: 'name,desc,due,dueComplete,idList,idLabels,idMembers,shortUrl,idBoard,cover,dateLastActivity', checklists: 'all', attachments: 'true', attachment_fields: 'name,url,isUpload,date', actions: 'commentCard', actions_limit: '40' });
  return {
    capa: (j.cover || {}).color || '', capaCheia: (j.cover || {}).size === 'full', capaImg: (j.cover || {}).idAttachment || false, ativ: j.dateLastActivity || '',
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
    if (b.pos === 'top' || b.pos === 'bottom') p.pos = b.pos;
    if (Array.isArray(b.membros)) p.idMembers = b.membros.map(tId).join(',');
    let corpo; // capa e demais campos num pedido só: ou muda tudo, ou nada
    if (b.capa !== undefined) { // '' tira a capa; cor do Trello põe a faixa ou o cartão inteiro
      const CORES = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black'];
      if (b.capa && !CORES.includes(b.capa)) throw new Error('Cor de capa inválida.');
      corpo = { cover: b.capa ? { color: b.capa, size: b.capaCheia ? 'full' : 'normal' } : { color: null, idAttachment: null, idUploadedBackground: null } };
    }
    if (!Object.keys(p).length && !corpo) return { id: b.id };
    return tr(cfg, 'PUT', '/cards/' + tId(b.id), p, corpo);
  }
  if (op === 'cartaoArquivar') return tr(cfg, 'PUT', '/cards/' + tId(b.id), { closed: 'true' });
  if (op === 'cartaoRestaurar') return tr(cfg, 'PUT', '/cards/' + tId(b.id), { closed: 'false' });
  if (op === 'listaRestaurar') return tr(cfg, 'PUT', '/lists/' + tId(b.id) + '/closed', { value: 'false' });
  if (op === 'listaMover') { const n = Number(b.pos); if (!Number.isFinite(n) || n <= 0) throw new Error('Posição inválida.'); return tr(cfg, 'PUT', '/lists/' + tId(b.id), { pos: String(n) }); }
  if (op === 'checklistNova') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome do checklist.'); return tr(cfg, 'POST', '/checklists', { idCard: tId(b.id), name: txt(b.nome, 512) }); }
  if (op === 'checkItemApagar') return tr(cfg, 'DELETE', '/cards/' + tId(b.id) + '/checkItem/' + tId(b.item));
  if (op === 'anexoLink') { const u = String(b.url || '').trim(); if (!/^https?:\/\/\S+$/i.test(u)) throw new Error('Cole um link que comece com http.'); return tr(cfg, 'POST', '/cards/' + tId(b.id) + '/attachments', Object.assign({ url: u.slice(0, 2000) }, b.nome ? { name: txt(b.nome, 256) } : {})); }
  if (op === 'cartaoNovo') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome do cartão.'); return tr(cfg, 'POST', '/cards', { idList: tId(b.lista), name: txt(b.nome), pos: 'bottom' }); }
  if (op === 'comentar') { if (!String(b.texto || '').trim()) throw new Error('Escreva o comentário.'); return tr(cfg, 'POST', '/cards/' + tId(b.id) + '/actions/comments', { text: txt(b.texto) }); }
  if (op === 'checkItem') return tr(cfg, 'PUT', '/cards/' + tId(b.id) + '/checkItem/' + tId(b.item), { state: b.ok ? 'complete' : 'incomplete' });
  if (op === 'checkNovo') { if (!String(b.nome || '').trim()) throw new Error('Escreva o item.'); return tr(cfg, 'POST', '/checklists/' + tId(b.checklist) + '/checkItems', { name: txt(b.nome) }); }
  if (op === 'listaNova') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome da lista.'); return tr(cfg, 'POST', '/lists', { idBoard: tId(b.quadro), name: txt(b.nome, 512), pos: 'bottom' }); }
  if (op === 'listaRenomear') { if (!String(b.nome || '').trim()) throw new Error('Escreva o nome da lista.'); return tr(cfg, 'PUT', '/lists/' + tId(b.id), { name: txt(b.nome, 512) }); }
  if (op === 'listaArquivar') return tr(cfg, 'PUT', '/lists/' + tId(b.id) + '/closed', { value: 'true' });
  throw new Error('Ação desconhecida.');
}

// ---------------- Notion dentro do MyLoot: ver e mexer nas bases e páginas que a pessoa ligou à integração ----------------
const NID = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;
const nId = (x) => { x = String(x || ''); if (!NID.test(x)) throw new Error('Base, página ou bloco inválido.'); return x; };
async function nt(tok, method, pth, body) {
  if (!tok) throw new Error('Conecte o seu Notion primeiro.');
  const r = await req(method, 'api.notion.com', '/v1' + pth, nh(tok), body);
  if (r.st === 404) throw new Error('Não achei isso no Notion. No Notion, abra a página ou base → ••• → Conexões → adicione a integração.');
  if (r.st !== 200) throw nErr(r);
  return r.j;
}
const plano = (a) => (a || []).map((t) => t.plain_text || '').join('');
const icone = (o) => (o && o.icon && o.icon.type === 'emoji' ? o.icon.emoji : '');
const nomeDe = (o) => (o.object === 'database' ? plano(o.title) : titulo(o)) || 'Sem título';
// valor de uma propriedade em formato simples (o app só precisa mostrar e editar os tipos comuns)
function valor(p) {
  if (!p) return null;
  switch (p.type) {
    case 'title': case 'rich_text': return plano(p[p.type]);
    case 'select': case 'status': return p[p.type] ? { nome: p[p.type].name, cor: p[p.type].color } : null;
    case 'multi_select': return (p.multi_select || []).map((o) => ({ nome: o.name, cor: o.color }));
    case 'date': return p.date ? { ini: p.date.start, fim: p.date.end || '' } : null;
    case 'checkbox': return !!p.checkbox;
    case 'number': return p.number;
    case 'url': case 'email': case 'phone_number': return p[p.type] || '';
    case 'people': return (p.people || []).map((u) => u.name || '').filter(Boolean).join(', ');
    case 'relation': return (p.relation || []).length;
    case 'files': return (p.files || []).length;
    case 'formula': { const f = p.formula || {}; return f.type === 'date' ? (f.date ? f.date.start : '') : f[f.type]; }
    case 'created_time': case 'last_edited_time': return p[p.type];
    case 'unique_id': return p.unique_id ? (p.unique_id.prefix ? p.unique_id.prefix + '-' : '') + p.unique_id.number : '';
    default: return null;
  }
}
const linha = (pg) => {
  const props = {}; let tit = '';
  for (const [k, v] of Object.entries(pg.properties || {})) { props[k] = valor(v); if (v.type === 'title') tit = plano(v.title); }
  return { id: pg.id, url: pg.url, titulo: tit || 'Sem título', icone: icone(pg), props, editado: pg.last_edited_time };
};
async function notionEu(tok) { const j = await nt(tok, 'GET', '/users/me'); return { nome: j.name || '', espaco: (j.bot && j.bot.workspace_name) || '' }; }
// tudo o que a integração enxerga: bases (databases) e páginas soltas (as linhas das bases ficam de fora)
async function notionLista(tok) {
  const out = { bases: [], paginas: [] }; let cursor;
  for (let i = 0; i < 3; i++) {
    const j = await nt(tok, 'POST', '/search', Object.assign({ page_size: 100, sort: { direction: 'descending', timestamp: 'last_edited_time' } }, cursor ? { start_cursor: cursor } : {}));
    j.results.forEach((o) => {
      if (o.archived || o.in_trash) return;
      const x = { id: o.id, nome: nomeDe(o), icone: icone(o), url: o.url, editado: o.last_edited_time };
      if (o.object === 'database') out.bases.push(x);
      else if (!o.parent || o.parent.type !== 'database_id') out.paginas.push(x);
    });
    out.mais = !!j.has_more; // passou de 300 resultados: a tela avisa que pode faltar coisa
    if (!j.has_more) break; cursor = j.next_cursor;
  }
  return out;
}
async function notionBase(tok, id) {
  const db = await nt(tok, 'GET', '/databases/' + nId(id));
  const props = Object.entries(db.properties || {}).map(([nome, p]) => ({ nome, tipo: p.type, opcoes: ((p[p.type] || {}).options || []).map((o) => ({ nome: o.name, cor: o.color })) }));
  const linhas = []; let cursor, mais = false;
  for (let i = 0; i < 5; i++) { // até 500 linhas
    const j = await nt(tok, 'POST', '/databases/' + id + '/query', Object.assign({ page_size: 100 }, cursor ? { start_cursor: cursor } : {}));
    j.results.forEach((pg) => { if (!pg.archived && !pg.in_trash) linhas.push(linha(pg)); });
    mais = !!j.has_more; if (!j.has_more) break; cursor = j.next_cursor;
  }
  return { base: { id: db.id, nome: plano(db.title) || 'Sem título', icone: icone(db), url: db.url }, props, linhas, mais };
}
function bloco(b) {
  const t = b.type, d = b[t] || {};
  const o = { id: b.id, tipo: t, texto: plano(d.rich_text), filhos: !!b.has_children };
  if (t === 'to_do') o.ok = !!d.checked;
  if (t === 'code') o.lingua = d.language || '';
  if (t === 'callout') o.icone = icone(d);
  if (t === 'child_page' || t === 'child_database') o.texto = d.title || '';
  if (t === 'image' || t === 'video' || t === 'file' || t === 'pdf') { o.url = d.type === 'external' ? (d.external || {}).url : (d.file || {}).url; o.texto = plano(d.caption); }
  if (t === 'bookmark' || t === 'link_preview' || t === 'embed') o.url = d.url || '';
  return o;
}
async function notionPagina(tok, id) {
  const pg = await nt(tok, 'GET', '/pages/' + nId(id));
  const blocos = []; let cursor, mais = false;
  for (let i = 0; i < 10; i++) { // até 1.000 blocos; passou disso, a tela avisa
    const j = await nt(tok, 'GET', '/blocks/' + id + '/children?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''));
    j.results.forEach((b) => blocos.push(bloco(b)));
    mais = !!j.has_more; if (!j.has_more) break; cursor = j.next_cursor;
  }
  const tipos = {}; for (const [k, v] of Object.entries(pg.properties || {})) tipos[k] = v.type;
  return Object.assign(linha(pg), { base: pg.parent && pg.parent.type === 'database_id' ? pg.parent.database_id : '', tipos, blocos, mais });
}
// valor do app → formato do Notion, só para os tipos que dá para editar
function propNotion(tipo, v) {
  const s = (x, n) => String(x == null ? '' : x).slice(0, n || 2000);
  switch (tipo) {
    case 'title': if (!s(v).trim()) throw new Error('A página precisa de um título.'); return { title: rt(s(v)) };
    case 'rich_text': return { rich_text: s(v) ? rt(s(v)) : [] };
    case 'select': return { select: v ? { name: s(v, 100) } : null };
    case 'status': if (!v) throw new Error('Escolha um status.'); return { status: { name: s(v, 100) } };
    case 'multi_select': return { multi_select: (Array.isArray(v) ? v : []).slice(0, 100).map((n) => ({ name: s(n, 100) })) };
    case 'date': return { date: v && v.ini ? { start: s(v.ini, 40), end: v.fim ? s(v.fim, 40) : null } : null };
    case 'checkbox': return { checkbox: !!v };
    case 'number': { if (v === '' || v == null) return { number: null }; const n = Number(v); if (!Number.isFinite(n)) throw new Error('Número inválido.'); return { number: n }; }
    case 'url': return { url: s(v) || null };
    case 'email': return { email: s(v, 200) || null };
    case 'phone_number': return { phone_number: s(v, 60) || null };
    default: throw new Error('Este tipo de campo não dá para mudar pelo MyLoot.');
  }
}
async function notionAcao(tok, b) {
  const op = String(b.op || '');
  const props = (P) => { const o = {}; (Array.isArray(P) ? P : (P = [])).length > 100 ? (() => { throw new Error('São campos demais de uma vez (máximo 100).'); })() : P.forEach((p) => { o[String(p.nome).slice(0, 200)] = propNotion(String(p.tipo), p.v); }); return o; };
  if (op === 'linhaNova') {
    if (!String(b.titulo || '').trim()) throw new Error('Escreva o título.');
    const P = props(b.props); P[String(b.campoTitulo || 'Name')] = propNotion('title', b.titulo);
    const j = await nt(tok, 'POST', '/pages', { parent: { database_id: nId(b.base) }, properties: P }); return { id: j.id, url: j.url };
  }
  if (op === 'paginaNova') {
    if (!String(b.titulo || '').trim()) throw new Error('Escreva o título.');
    const j = await nt(tok, 'POST', '/pages', { parent: { page_id: nId(b.pai) }, properties: { title: propNotion('title', b.titulo) } }); return { id: j.id, url: j.url };
  }
  if (op === 'props') { await nt(tok, 'PATCH', '/pages/' + nId(b.id), { properties: props(b.props) }); return { id: b.id }; }
  if (op === 'lixeira') { await nt(tok, 'PATCH', '/pages/' + nId(b.id), { archived: true }); return { id: b.id }; }
  if (op === 'todo') { await nt(tok, 'PATCH', '/blocks/' + nId(b.id), { to_do: { checked: !!b.ok } }); return { id: b.id }; }
  if (op === 'blocoNovo') {
    const t = String(b.texto || '').trim(); if (!t) throw new Error('Escreva o texto.');
    const tipo = b.tipo === 'to_do' ? 'to_do' : 'paragraph', dado = { rich_text: rt(t.slice(0, 1900)) }; if (tipo === 'to_do') dado.checked = false;
    const j = await nt(tok, 'PATCH', '/blocks/' + nId(b.pagina) + '/children', { children: [{ object: 'block', type: tipo, [tipo]: dado }] });
    return { id: (j.results && j.results[0] && j.results[0].id) || '' };
  }
  throw new Error('Ação desconhecida.');
}

// o destino escolhido existe para esta conta? (lista do Trello ou página do Notion)
const trelloListaOk = (cfg, id) => tr(cfg, 'GET', '/lists/' + tId(id), { fields: 'id' });
const notionPaginaOk = (tok, id) => nt(tok, 'GET', '/pages/' + nId(id));
module.exports = { trelloListaOk, notionPaginaOk, notionPaginas, notionEnviar, trelloListas, trelloEnviar, trelloEu, trelloQuadros, trelloQuadro, trelloCartao, trelloAcao, trelloCapa, notionEu, notionLista, notionBase, notionPagina, notionAcao };
