// Rotina: hábitos com sequência de dias, metas com progresso e o mapa do mês.
// Inspirada no HabitNow. Os dados moram em db.habits e db.goals.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  const H = () => M.db.habits || (M.db.habits = []);
  const G = () => M.db.goals || (M.db.goals = []);

  let dia = ''; // dia que está na tela (vazio = hoje)
  const D = () => dia || M.today();
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dow = (d) => new Date(d + 'T12:00:00').getDay();
  const EM_HAB = ['💧', '🏃', '📚', '🧘', '🥗', '💪', '😴', '🧹', '✍️', '🎸', '💰', '📵', '🦷', '🚶', '☀️', '🙏', '💊', '🧠', '🎨', '📞'];
  const EM_META = ['🎯', '💰', '👥', '📈', '🏋️', '📚', '✈️', '🏠', '🚗', '💻', '❤️', '🏆'];
  const UN_HAB = ['vez', 'min', 'h', 'copos', 'L', 'km', 'páginas'];
  const UN_META = ['R$', 'clientes', 'vendas', 'posts', 'kg', 'km', 'livros', 'vezes'];

  // ----- contas dos hábitos -----
  const alvo = (h) => Math.max(1, Number(h.alvo) || 1);
  const valor = (h, d) => Number((h.log || {})[d]) || 0;
  const feito = (h, d) => valor(h, d) >= alvo(h);
  const semanaDe = (d) => { const ini = M.addDays(d, -dow(d)); return Array.from({ length: 7 }, (_, i) => M.addDays(ini, i)); };
  const naSemana = (h, d) => semanaDe(d).filter((x) => feito(h, x)).length;
  // o hábito vale neste dia? (todo dia · dias da semana escolhidos · X vezes por semana, em qualquer dia)
  const previsto = (h, d) => {
    if (h.criado && d < h.criado) return false;
    if (h.freq === 'semana') return (h.dias || []).includes(dow(d));
    if (h.freq === 'vezes') return feito(h, d) || naSemana(h, d) < (h.vezes || 1);
    return true;
  };
  // sequência: dias seguidos cumprindo (dias de folga não quebram); em "X vezes por semana", semanas seguidas batendo o número
  const sequencia = (h) => {
    const hoje = M.today();
    if (h.freq === 'vezes') {
      let n = 0, d = hoje;
      if (naSemana(h, d) < (h.vezes || 1)) d = M.addDays(d, -7); // a semana atual ainda está em aberto
      for (let i = 0; i < 104; i++) { if (naSemana(h, d) >= (h.vezes || 1)) n++; else break; d = M.addDays(d, -7); if (h.criado && semanaDe(d)[6] < h.criado) break; }
      return n;
    }
    let n = 0, d = hoje;
    if (!feito(h, d)) d = M.addDays(d, -1); // hoje ainda está em aberto
    for (let i = 0; i < 730; i++) {
      if (h.criado && d < h.criado) break;
      if (h.freq === 'semana' && !(h.dias || []).includes(dow(d))) { d = M.addDays(d, -1); continue; }
      if (!feito(h, d)) break;
      n++; d = M.addDays(d, -1);
    }
    return n;
  };
  M.rotinaMaiorSeq = () => Math.max(0, ...H().filter((h) => h.freq !== 'vezes').map(sequencia));
  const freqNome = (h) => (h.freq === 'semana' ? (h.dias || []).length === 7 ? 'Todo dia' : (h.dias || []).slice().sort().map((i) => DOW[i]).join(', ')
    : h.freq === 'vezes' ? `${h.vezes || 1}x por semana` : 'Todo dia');
  const doDia = (d) => H().filter((h) => !h.pausa && previsto(h, d));
  M.rotinaDia = (d) => { const L = doDia(d); return { total: L.length, feitos: L.filter((h) => feito(h, d)).length }; };

  // marca, desmarca ou soma (hábitos com quantidade)
  function marcar(h, d, modo, ev) {
    if (d > M.today()) return M.toast('🗓️ Esse dia ainda não chegou. Dá para marcar hoje ou dias que já passaram.');
    const antes = feito(h, d), a = alvo(h), v = valor(h, d);
    const passo = a <= 12 ? 1 : a <= 60 ? 5 : 10;
    let novo = modo === 'mais' ? Math.min(a * 3, v + passo) : modo === 'menos' ? Math.max(0, v - passo) : (antes ? 0 : a);
    h.log = h.log || {};
    if (novo > 0) h.log[d] = novo; else delete h.log[d];
    const agora = feito(h, d);
    if (agora && !antes) {
      const at = ev ? { x: ev.clientX, y: ev.clientY } : null;
      if (d === M.today()) M.award('habit', at); else SFX.play('check');
      FX.burst(at ? at.x : null, at ? at.y : null, 22, 5);
      const dl = M.dayLog(), r = M.rotinaDia(d);
      if (d === M.today() && r.total > 1 && r.feitos === r.total && !dl.rot) { dl.rot = true; setTimeout(() => { SFX.play('goal'); FX.rain(); M.toast('🎯 Rotina de hoje completa!'); }, 500); }
    } else SFX.play('click');
    M.save(); M.render();
  }
  M.rotinaMarca = (id, ev) => { const h = H().find((x) => x.id === id); if (h) marcar(h, M.today(), 'alterna', ev); };

  // ----- pedaços de tela -----
  function pontos(h, d) {
    return `<div class="hab-sem" title="Últimos 7 dias">${Array.from({ length: 7 }, (_, i) => M.addDays(d, i - 6)).map((x) => {
      const ok = feito(h, x), pv = previsto(h, x) || ok;
      return `<i class="${ok ? 'ok' : !pv ? 'folga' : x < M.today() ? 'falhou' : ''} ${x === d ? 'hj' : ''}" title="${DOW[dow(x)]} ${x.slice(8)}/${x.slice(5, 7)}: ${ok ? 'feito' : !pv ? 'folga' : x < M.today() ? 'não feito' : 'em aberto'}"></i>`;
    }).join('')}</div>`;
  }
  function habHTML(h, d, folga) {
    const ok = feito(h, d), a = alvo(h), v = valor(h, d), s = sequencia(h);
    return `<div class="hab ${ok ? 'ok' : ''} ${folga ? 'folga' : ''}" data-h="${h.id}">
      <button class="hab-chk" data-a="chk" title="${ok ? 'Desmarcar' : 'Marcar como feito'}" aria-label="${ok ? 'Desmarcar' : 'Marcar como feito'}: ${esc(h.nome)}">${ok ? '✔' : ''}</button>
      <span class="hab-em">${esc(h.em || '🎯')}</span>
      <div class="hab-tx"><b>${esc(h.nome)}</b><small>${folga ? (h.freq === 'vezes' ? 'semana já completa · ' : 'hoje não é dia · ') : ''}${freqNome(h)}${a > 1 ? ` · ${v} de ${a} ${esc(h.un || '')}` : ''}${h.hora ? ` · ⏰ ${esc(h.hora)}` : ''}</small>
        ${a > 1 ? `<div class="hab-bar"><i style="width:${Math.min(100, (v / a) * 100)}%"></i></div>` : ''}</div>
      ${a > 1 ? `<button class="icon-btn" data-a="menos" title="Tirar um pouco" aria-label="Diminuir">−</button><button class="icon-btn" data-a="mais" title="Somar um pouco" aria-label="Aumentar">＋</button>` : ''}
      ${pontos(h, d)}
      <span class="hab-seq ${s ? 'on' : ''}" title="${h.freq === 'vezes' ? 'Semanas seguidas batendo a meta' : 'Dias seguidos cumprindo'}">🔥 ${s}</span>
      <button class="icon-btn" data-a="ed" title="Editar hábito" aria-label="Editar hábito">✏️</button>
    </div>`;
  }
  const fmtMeta = (g, v) => (g.un === 'R$' ? M.reais(v) : (Number(v) || 0).toLocaleString('pt-BR') + (g.un ? ' ' + g.un : ''));
  function metaHTML(g) {
    const pct = g.alvo > 0 ? Math.min(100, Math.round((g.atual / g.alvo) * 100)) : 0, hoje = M.today();
    const falta = g.prazo ? Math.round((new Date(g.prazo + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5) : null;
    const prazo = g.prazo ? ` · até ${M.fmtDate(g.prazo)}${pct >= 100 ? '' : falta < 0 ? ' (prazo passou)' : falta === 0 ? ' (é hoje)' : ` (faltam ${falta} dia${falta === 1 ? '' : 's'})`}` : '';
    return `<div class="meta-c ${pct >= 100 ? 'ok' : ''} ${g.prazo && falta < 0 && pct < 100 ? 'late' : ''}" data-g="${g.id}">
      <div class="mc-top"><span class="hab-em">${esc(g.em || '🎯')}</span><div class="hab-tx"><b>${esc(g.nome)}</b><small>${g.un === 'R$' ? esc(fmtMeta(g, g.atual)) : (Number(g.atual) || 0).toLocaleString('pt-BR')} de ${esc(fmtMeta(g, g.alvo))}${prazo}</small></div>
        <b class="mc-pct">${pct >= 100 ? '🏆 ' : ''}${pct}%</b><button class="icon-btn" data-a="ged" title="Editar meta" aria-label="Editar meta">✏️</button></div>
      <div class="mc-bar"><i style="width:${pct}%"></i></div>
      <div class="mc-add"><input type="text" inputmode="decimal" id="gIn-${g.id}" placeholder="Quanto você avançou?" aria-label="Valor para somar na meta ${esc(g.nome)}"><button class="btn sm" data-a="soma">＋ Somar</button>${(g.hist || []).length ? '<button class="btn sm ghost" data-a="tira" title="Tira o último valor que você somou">↩ Desfazer</button>' : ''}</div>
    </div>`;
  }
  function mesHTML(d) {
    const [Y, Mo] = d.split('-').map(Number), prim = new Date(Y, Mo - 1, 1), n = new Date(Y, Mo, 0).getDate(), hoje = M.today();
    const cel = [];
    for (let i = 0; i < prim.getDay(); i++) cel.push('<i class="vz"></i>');
    for (let k = 1; k <= n; k++) {
      const x = `${Y}-${String(Mo).padStart(2, '0')}-${String(k).padStart(2, '0')}`, r = M.rotinaDia(x), fut = x > hoje;
      const nv = fut || !r.total ? '' : 'n' + (r.feitos === 0 ? 0 : Math.max(1, Math.round((r.feitos / r.total) * 4)));
      cel.push(`<button class="${nv} ${x === d ? 'sel' : ''} ${x === hoje ? 'hj' : ''}" data-d="${x}" ${fut ? 'disabled' : ''} title="${k}/${Mo}: ${fut ? 'ainda não chegou' : r.total ? `${r.feitos} de ${r.total} hábito${r.total > 1 ? 's' : ''}` : 'sem hábitos'}">${k}</button>`);
    }
    return `<div class="rot-cal">${DOW.map((x) => `<span>${x}</span>`).join('')}${cel.join('')}</div>
      <div class="rot-leg"><i class="n0"></i> nada <i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i> tudo feito</div>`;
  }

  // ----- tela -----
  M.pages.rot = () => {
    const v = $('#view'), d = D(), hoje = M.today();
    const todos = H().filter((h) => !h.pausa), L = todos.filter((h) => previsto(h, d)), folga = todos.filter((h) => !previsto(h, d) && !(h.criado && d < h.criado));
    const ok = L.filter((h) => feito(h, d)).length;
    const nomeDia = d === hoje ? 'Hoje' : d === M.addDays(hoje, -1) ? 'Ontem' : DOW[dow(d)];
    const dataLonga = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    v.innerHTML = `
      <div class="rot-top">
        <button class="btn" id="hNovo">＋ Novo hábito</button><button class="btn ghost" id="gNovo">＋ Nova meta</button>
        <div class="cal-h rot-nav"><button class="icon-btn" id="rP" title="Dia anterior" aria-label="Dia anterior">‹</button><h3><b>${nomeDia}</b> <small>${dataLonga}</small></h3><button class="icon-btn" id="rN" title="Dia seguinte" aria-label="Dia seguinte" ${d >= hoje ? 'disabled' : ''}>›</button>${d !== hoje ? '<button class="btn ghost sm" id="rH">Voltar para hoje</button>' : ''}${M.hint('Esqueceu de marcar ontem? Use as setas para voltar o dia e marcar. Dias que ainda não chegaram ficam travados.')}</div>
      </div>
      <div class="rot-grid">
        <section class="panel rot-hab"><h4>🔁 Hábitos ${L.length ? `<span class="rot-n">${ok} de ${L.length}</span>` : ''} ${M.hint('Hábito é o que você quer repetir: beber água, ler, treinar. Clique no círculo para marcar como feito. 🔥 mostra há quantos dias seguidos você cumpre; as bolinhas são os últimos 7 dias.')}</h4>
          ${L.map((h) => habHTML(h, d)).join('')}${folga.map((h) => habHTML(h, d, true)).join('')}
          ${todos.length && !L.length && !folga.length ? '<small style="color:var(--faint)">Nenhum hábito tinha sido criado até este dia.</small>' : ''}
          ${!todos.length ? `<div class="empty" style="padding:26px 10px"><div class="big">🌱</div><h3>Nenhum hábito ainda</h3><p>Comece com um só. Alguns exemplos para criar com um clique:</p>
            <div class="rot-ex">${[['💧', 'Beber água', 8, 'copos'], ['📚', 'Ler', 10, 'páginas'], ['🏃', 'Treinar', 1, 'vez'], ['🧘', 'Meditar', 10, 'min']].map(([e, n, a, u]) => `<button class="chip-b" data-ex="${e}|${n}|${a}|${u}">${e} ${n}</button>`).join('')}</div></div>` : ''}</section>
        <section class="panel rot-metas"><h4>🎯 Metas ${M.hint('Meta é um número para alcançar até uma data: faturar 10 mil no mês, fechar 5 clientes, ler 12 livros. Vá somando o que avançou; ao chegar em 100% tem comemoração.')}</h4>
          ${G().map(metaHTML).join('') || '<div class="empty" style="padding:26px 10px"><div class="big">🎯</div><h3>Nenhuma meta ainda</h3><p>Crie uma meta com número e prazo e vá somando o progresso.</p></div>'}</section>
        <section class="panel rot-mes"><h4>🗓️ ${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} ${M.hint('Cada quadradinho é um dia. Quanto mais forte a cor, mais hábitos você cumpriu. Clique num dia para ver e marcar aquele dia.')}</h4>${mesHTML(d)}</section>
      </div>`;
    const ir = (x) => { dia = x >= hoje ? '' : x; SFX.play('click'); M.render(); };
    $('#rP').onclick = () => ir(M.addDays(d, -1));
    $('#rN').onclick = () => ir(M.addDays(d, 1));
    if ($('#rH')) $('#rH').onclick = () => ir(hoje);
    $('#hNovo').onclick = () => editarHabito();
    $('#gNovo').onclick = () => editarMeta();
    v.onclick = (e) => {
      const ex = e.target.closest('[data-ex]');
      if (ex) { const [em, nome, a, un] = ex.dataset.ex.split('|'); return editarHabito(null, { em, nome, alvo: +a, un }); }
      const cd = e.target.closest('.rot-cal [data-d]'); if (cd) return ir(cd.dataset.d);
      const a = (e.target.closest('[data-a]') || {}).dataset; if (!a) return;
      const hr = e.target.closest('.hab');
      if (hr) {
        const h = H().find((x) => x.id === hr.dataset.h); if (!h) return;
        if (a.a === 'ed') return editarHabito(h);
        if (hr.classList.contains('folga') && a.a === 'chk' && h.freq !== 'vezes') return M.toast('Hoje não é dia desse hábito. Para mudar os dias, clique no ✏️.');
        return marcar(h, d, a.a === 'chk' ? 'alterna' : a.a, e);
      }
      const gr = e.target.closest('.meta-c'); if (!gr) return;
      const g = G().find((x) => x.id === gr.dataset.g); if (!g) return;
      if (a.a === 'ged') return editarMeta(g);
      if (a.a === 'soma') somar(g, $('#gIn-' + g.id), e);
      if (a.a === 'tira') { const u = (g.hist || []).pop(); if (u) { g.atual = Math.max(0, Math.round((g.atual - u.v) * 100) / 100); if (g.atual < g.alvo) g.feitoEm = ''; M.save(); SFX.play('undo'); M.render(); M.toast('↩ Tirei ' + fmtMeta(g, u.v)); } }
    };
    v.onkeydown = (e) => { if (e.key === 'Enter' && e.target.id && e.target.id.startsWith('gIn-')) { const g = G().find((x) => 'gIn-' + x.id === e.target.id); if (g) somar(g, e.target, e); } };
  };
  function somar(g, campo, ev) {
    const n = M.lerValor(campo.value);
    if (!n) return M.falta(campo, '✍️ Escreva quanto você avançou (ex.: 500)');
    const antes = g.atual >= g.alvo;
    g.atual = Math.round((g.atual + n) * 100) / 100; (g.hist = g.hist || []).push({ d: M.today(), v: n });
    if (!antes && g.atual >= g.alvo) {
      g.feitoEm = M.today(); M.award('goal');
      setTimeout(() => { SFX.play('goal'); FX.rain(); FX.burst(null, null, 120, 12); M.toast('🏆 Meta batida: ' + g.nome + '!'); }, 250);
    } else { SFX.play('coin'); M.toast('＋ ' + fmtMeta(g, n) + ' na meta'); }
    M.save(); M.render();
  }

  // ----- janelas: hábito e meta -----
  const escolheEmoji = (L, atual) => `<div class="em-grade" id="emG">${L.map((e) => `<button type="button" class="${e === atual ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>`;
  function editarHabito(h, pre) {
    const novo = !h;
    const o = Object.assign({ em: '💧', nome: '', freq: 'dia', dias: [1, 2, 3, 4, 5], vezes: 3, alvo: 1, un: 'vez', hora: '' }, pre || {}, h ? JSON.parse(JSON.stringify(h)) : {});
    const m = M.modal(`<div class="modal-h"><h2>${novo ? '🌱 Novo hábito' : '✏️ Editar hábito'}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
      <div class="fld"><label>Ícone</label>${escolheEmoji(EM_HAB.includes(o.em) ? EM_HAB : [o.em, ...EM_HAB], o.em)}</div>
      <div class="fld"><label>Nome do hábito</label><div class="com-mic"><input type="text" id="hNome" placeholder="Ex.: Beber água, Ler, Treinar" value="${esc(o.nome)}">${M.micBtn('#hNome')}</div></div>
      <div class="fld"><label>Com que frequência? ${M.hint('Todo dia: vale sempre. Dias da semana: só nos dias que você escolher (os outros são folga e não quebram a sequência). X vezes por semana: em qualquer dia, até completar o número.')}</label>
        <div class="seg" id="hFreq"><button data-f="dia" class="${o.freq === 'dia' ? 'on' : ''}">Todo dia</button><button data-f="semana" class="${o.freq === 'semana' ? 'on' : ''}">Dias da semana</button><button data-f="vezes" class="${o.freq === 'vezes' ? 'on' : ''}">X vezes por semana</button></div>
        <div class="tn-data" id="hDias" style="margin-top:8px" ${o.freq === 'semana' ? '' : 'hidden'}>${DOW.map((n, i) => `<button type="button" class="chip-b ${o.dias.includes(i) ? 'on' : ''}" data-i="${i}">${n}</button>`).join('')}</div>
        <div class="row" id="hVz" style="margin-top:8px;align-items:center;gap:8px" ${o.freq === 'vezes' ? '' : 'hidden'}><input type="number" id="hVezes" min="1" max="7" value="${o.vezes}" style="width:80px;flex:none"><span>vezes por semana</span></div></div>
      <div class="row">
        <div class="fld"><label>Quanto por dia? ${M.hint('Para hábitos de “fiz ou não fiz”, deixe 1 vez. Para contar (8 copos de água, 30 minutos de leitura), coloque o número e a unidade: aparecem os botões − e ＋ para ir somando.')}</label>
          <div class="row" style="gap:8px"><input type="number" id="hAlvo" min="1" max="999" value="${alvo(o)}" style="flex:1"><select id="hUn" style="flex:1">${(UN_HAB.includes(o.un) ? UN_HAB : [o.un, ...UN_HAB]).map((u) => `<option ${u === o.un ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div></div>
        <div class="fld"><label>Lembrete ${M.hint('Opcional. No horário, o computador mostra um aviso se o hábito do dia ainda não foi marcado.')}</label><input type="time" id="hHora" value="${esc(o.hora || '')}"></div>
      </div>
      <div class="row" style="justify-content:space-between">${novo ? '<span></span>' : '<button class="btn danger" id="hDel" style="flex:none">🗑️ Apagar</button>'}<button class="btn" id="hOk" style="flex:none">✔ Salvar hábito</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    $('#emG', m).onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; o.em = b.dataset.e; $$('#emG button', m).forEach((x) => x.classList.toggle('on', x === b)); SFX.play('click'); };
    $('#hFreq', m).onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; o.freq = b.dataset.f; $$('#hFreq button', m).forEach((x) => x.classList.toggle('on', x === b)); $('#hDias', m).hidden = o.freq !== 'semana'; $('#hVz', m).hidden = o.freq !== 'vezes'; SFX.play('click'); };
    $('#hDias', m).onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; o.dias = o.dias.includes(i) ? o.dias.filter((x) => x !== i) : [...o.dias, i]; b.classList.toggle('on', o.dias.includes(i)); SFX.play('click'); };
    const ok = () => {
      o.nome = $('#hNome', m).value.trim();
      if (!o.nome) return M.falta($('#hNome', m), '✍️ Dê um nome ao hábito');
      if (o.freq === 'semana' && !o.dias.length) return M.toast('Escolha pelo menos um dia da semana.');
      o.vezes = Math.max(1, Math.min(7, +$('#hVezes', m).value || 1));
      o.alvo = Math.max(1, Math.min(999, Math.round(+$('#hAlvo', m).value || 1))); o.un = $('#hUn', m).value; o.hora = $('#hHora', m).value;
      if (novo) H().push(Object.assign({ id: M.uid(), criado: M.today(), log: {} }, o)); else Object.assign(h, o, { log: h.log || {} });
      M.save(); SFX.play('pop'); M.closeModal(); M.render(); M.toast(novo ? '🌱 Hábito criado. Marque quando fizer!' : '✅ Hábito salvo');
    };
    $('#hOk', m).onclick = ok; $('#hNome', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#hDel', m)) $('#hDel', m).onclick = () => { const i = H().indexOf(h); M.db.habits = H().filter((x) => x !== h); M.save(); SFX.play('trash'); M.closeModal(); M.render(); M.toast('🗑️ Hábito apagado', () => { H().splice(Math.max(0, i), 0, h); M.save(); M.render(); }); };
    if (novo && !o.nome) $('#hNome', m).focus();
  }
  function editarMeta(g) {
    const novo = !g;
    const o = Object.assign({ em: '🎯', nome: '', alvo: 0, atual: 0, un: 'R$', prazo: '' }, g ? JSON.parse(JSON.stringify(g)) : {});
    const num = (v) => (v ? String(v).replace('.', ',') : '');
    const m = M.modal(`<div class="modal-h"><h2>${novo ? '🎯 Nova meta' : '✏️ Editar meta'}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
      <div class="fld"><label>Ícone</label>${escolheEmoji(EM_META.includes(o.em) ? EM_META : [o.em, ...EM_META], o.em)}</div>
      <div class="fld"><label>O que você quer alcançar?</label><div class="com-mic"><input type="text" id="gNome" placeholder="Ex.: Faturar 10 mil em dezembro" value="${esc(o.nome)}">${M.micBtn('#gNome')}</div></div>
      <div class="row">
        <div class="fld"><label>Número da meta ${M.hint('O total que você quer alcançar. Ex.: 10000 (reais), 5 (clientes), 12 (livros).')}</label><input type="text" inputmode="decimal" id="gAlvo" placeholder="10000" value="${num(o.alvo)}"></div>
        <div class="fld"><label>Em quê? ${M.hint('A unidade do número: reais, clientes, quilos… Escolha da lista ou escreva a sua.')}</label><input type="text" id="gUn" list="gUnL" value="${esc(o.un)}" placeholder="R$"><datalist id="gUnL">${UN_META.map((u) => `<option value="${u}">`).join('')}</datalist></div>
      </div>
      <div class="row">
        <div class="fld"><label>Quanto já tem ${M.hint('Se você já começou, coloque quanto já alcançou. Senão, deixe vazio.')}</label><input type="text" inputmode="decimal" id="gAtual" placeholder="0" value="${num(o.atual)}"></div>
        <div class="fld"><label>Prazo ${M.hint('Opcional. A meta mostra quantos dias faltam e avisa se o prazo passou.')}</label><input type="date" id="gPrazo" value="${esc(o.prazo || '')}"></div>
      </div>
      <div class="row" style="justify-content:space-between">${novo ? '<span></span>' : '<button class="btn danger" id="gDel" style="flex:none">🗑️ Apagar</button>'}<button class="btn" id="gOk" style="flex:none">✔ Salvar meta</button></div></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    $('#emG', m).onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; o.em = b.dataset.e; $$('#emG button', m).forEach((x) => x.classList.toggle('on', x === b)); SFX.play('click'); };
    const ok = () => {
      o.nome = $('#gNome', m).value.trim();
      if (!o.nome) return M.falta($('#gNome', m), '✍️ Escreva o que você quer alcançar');
      o.alvo = M.lerValor($('#gAlvo', m).value);
      if (!(o.alvo > 0)) return M.falta($('#gAlvo', m), '🔢 Coloque o número da meta (ex.: 10000)');
      o.atual = Math.max(0, M.lerValor($('#gAtual', m).value)); o.un = $('#gUn', m).value.trim(); o.prazo = $('#gPrazo', m).value;
      o.feitoEm = o.atual >= o.alvo ? (o.feitoEm || M.today()) : '';
      if (novo) G().push(Object.assign({ id: M.uid(), criado: M.today(), hist: [] }, o)); else Object.assign(g, o, { hist: g.hist || [] });
      M.save(); SFX.play('pop'); M.closeModal(); M.render(); M.toast(novo ? '🎯 Meta criada. Vá somando o que avançar!' : '✅ Meta salva');
    };
    $('#gOk', m).onclick = ok; $('#gNome', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#gDel', m)) $('#gDel', m).onclick = () => { const i = G().indexOf(g); M.db.goals = G().filter((x) => x !== g); M.save(); SFX.play('trash'); M.closeModal(); M.render(); M.toast('🗑️ Meta apagada', () => { G().splice(Math.max(0, i), 0, g); M.save(); M.render(); }); };
    if (novo) $('#gNome', m).focus();
  }

  // ----- Início: rotina de hoje em botões -----
  M.rotinaHojeHTML = () => {
    const d = M.today(), L = doDia(d);
    if (!L.length) return '';
    const ok = L.filter((h) => feito(h, d)).length;
    return `<h4 style="margin-top:14px">🎯 Rotina de hoje <span class="rot-n">${ok} de ${L.length}</span> <a data-go="rot">abrir →</a></h4>
      <div class="rot-mini">${L.map((h) => `<button class="hab-mini ${feito(h, d) ? 'ok' : ''}" data-hab="${h.id}" title="${feito(h, d) ? 'Feito. Clique para desmarcar.' : 'Clique para marcar como feito'}">${esc(h.em || '🎯')} ${esc(h.nome)}${feito(h, d) ? ' ✔' : ''}</button>`).join('')}</div>`;
  };
})();
