// Financeiro: fluxo de caixa do mês (entradas e saídas, recebido/pago e a receber/a pagar),
// contas que se repetem e parcelas, ligação com clientes, calculadora de preço e exportar CSV.
(function () {
  const { esc, $, $$ } = M;
  M.pages = M.pages || {};
  M.FIN_CAT = {
    entrada: ['Serviço / cliente', 'Venda de produto', 'Comissão / parceria', 'Rendimento', 'Outros'],
    saida: ['Ferramentas e assinaturas', 'Impostos e taxas', 'Anúncios e marketing', 'Equipamentos', 'Pró-labore / salário', 'Equipe e freelas', 'Casa e contas', 'Alimentação', 'Transporte', 'Outros'],
  };
  M.FORMAS = ['PIX', 'Cartão', 'Boleto', 'Transferência', 'Dinheiro'];
  const fin = () => M.db.fin || (M.db.fin = []);
  M.reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  M.lerValor = (s) => { s = String(s || '').replace(/[^\d,.-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const mesDe = (ymd) => ymd.slice(0, 7);
  const nomeMes = (ym) => new Date(ym + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const somaMes = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const diaNoMes = (ym, dia) => { const [y, m] = ym.split('-').map(Number); const fim = new Date(y, m, 0).getDate(); return ym + '-' + String(Math.min(dia, fim)).padStart(2, '0'); };
  let mes = null, filtro = '';

  M.finResumo = (L) => {
    const r = { rec: 0, pag: 0, aRec: 0, aPag: 0 };
    L.forEach((f) => { if (f.tipo === 'entrada') f.pago ? (r.rec += f.valor) : (r.aRec += f.valor); else f.pago ? (r.pag += f.valor) : (r.aPag += f.valor); });
    r.saldo = r.rec - r.pag; r.prev = r.rec + r.aRec - r.pag - r.aPag;
    return r;
  };
  M.finHoje = () => { const h = M.today(); return fin().filter((f) => !f.pago && f.data <= h); };

  M.pages.fin = () => {
    if (!mes) mes = mesDe(M.today());
    const v = $('#view'), hoje = M.today();
    const doMes = fin().filter((f) => mesDe(f.data) === mes).sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'entrada' ? -1 : 1));
    const R = M.finResumo(doMes);
    const L = doMes.filter((f) => !filtro || (filtro === 'pend' ? !f.pago : f.tipo === filtro));
    const atras = fin().filter((f) => !f.pago && f.data < hoje && mesDe(f.data) < mes);
    // 6 meses para o gráfico
    const meses = Array.from({ length: 6 }, (_, i) => somaMes(mes, i - 5));
    const graf = meses.map((m) => { const x = M.finResumo(fin().filter((f) => mesDe(f.data) === m)); return { m, e: x.rec + x.aRec, s: x.pag + x.aPag }; });
    const max = Math.max(1, ...graf.map((g) => Math.max(g.e, g.s)));
    const porCat = {};
    doMes.filter((f) => f.tipo === 'saida').forEach((f) => { porCat[f.cat || 'Outros'] = (porCat[f.cat || 'Outros'] || 0) + f.valor; });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const totS = cats.reduce((s, c) => s + c[1], 0) || 1;
    v.innerHTML = `
      <div class="cal-h fin-h"><button class="icon-btn" id="fp">‹</button><h3>${nomeMes(mes)}</h3><button class="icon-btn" id="fn">›</button><button class="btn ghost sm" id="fh">Hoje</button>
        <span class="grow" style="flex:1"></span>
        <button class="btn sm fin-e" id="fAddE">＋ Entrada</button><button class="btn sm fin-s" id="fAddS">− Saída</button>
        <button class="btn ghost sm" id="fCalc">🧮 Calcular preço</button><a class="btn ghost sm" id="fCsv" href="#">⬇️ Planilha (CSV)</a></div>
      ${atras.length ? `<div class="fin-alerta">⚠️ ${atras.length} conta${atras.length > 1 ? 's' : ''} de meses anteriores ainda em aberto (${M.reais(atras.reduce((s, f) => s + (f.tipo === 'entrada' ? f.valor : -f.valor), 0))}). <a data-atras="1">ver</a></div>` : ''}
      <div class="stats fin-stats">
        <div class="stat"><b class="pos">${M.reais(R.rec)}</b><small>Recebido</small></div>
        <div class="stat"><b class="neg">${M.reais(R.pag)}</b><small>Pago</small></div>
        <div class="stat"><b class="${R.saldo >= 0 ? 'pos' : 'neg'}">${M.reais(R.saldo)}</b><small>Saldo do mês ${M.hint('Recebido menos pago, só o que já aconteceu.')}</small></div>
        <div class="stat"><b>${M.reais(R.aRec)}</b><small>A receber</small></div>
        <div class="stat"><b>${M.reais(R.aPag)}</b><small>A pagar</small></div>
        <div class="stat"><b class="${R.prev >= 0 ? 'pos' : 'neg'}">${M.reais(R.prev)}</b><small>Previsão do mês ${M.hint('Como o mês fecha se tudo o que está previsto for recebido e pago.')}</small></div>
      </div>
      <div class="fin-grid">
        <div class="panel"><h4>📒 Lançamentos <span class="seg" id="fF" style="margin-left:auto">${[['', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas'], ['pend', 'Pendentes']].map(([k, n]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${n}</button>`).join('')}</span></h4>
          ${L.length ? L.map((f) => {
            const cli = f.client && M.client ? M.client(f.client) : null, late = !f.pago && f.data < hoje;
            return `<div class="fin-row ${f.pago ? 'ok' : ''} ${late ? 'late' : ''}" data-f="${f.id}"><input type="checkbox" ${f.pago ? 'checked' : ''} title="${f.tipo === 'entrada' ? 'Recebido' : 'Pago'}">
              <span class="fd">${f.data.slice(8)}/${f.data.slice(5, 7)}</span><span class="fx"><b>${esc(f.desc || (f.tipo === 'entrada' ? 'Entrada' : 'Saída'))}</b><small>${esc(f.cat || '')}${f.forma ? ' · ' + esc(f.forma) : ''}${cli ? ' · 👤 ' + esc(cli.nome) : ''}${f.parc ? ' · ' + esc(f.parc) : ''}${f.serie && !f.parc ? ' · 🔁' : ''}${late ? ' · <i>atrasado</i>' : ''}</small></span>
              <span class="fv ${f.tipo === 'entrada' ? 'pos' : 'neg'}">${f.tipo === 'entrada' ? '+' : '−'} ${M.reais(f.valor)}</span></div>`;
          }).join('') : `<div class="empty" style="padding:30px"><div class="big">💰</div><h3>Nada lançado em ${nomeMes(mes)}</h3><p>Lance o que entrou e o que saiu. Contas fixas podem repetir todo mês.</p></div>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="panel"><h4>📊 Últimos 6 meses</h4><div class="fin-graf">${graf.map((g) => `<div class="fg" title="${nomeMes(g.m)}: entrou ${M.reais(g.e)} · saiu ${M.reais(g.s)}"><div class="fb"><i class="e" style="height:${(g.e / max) * 100}%"></i><i class="s" style="height:${(g.s / max) * 100}%"></i></div><small>${new Date(g.m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></div>`).join('')}</div>
            <div class="g-leg" style="margin-top:8px"><span><i style="background:var(--green)"></i>Entradas</span><span><i style="background:var(--red)"></i>Saídas</span></div></div>
          <div class="panel"><h4>🧾 Para onde foi o dinheiro</h4>${cats.length ? cats.map(([c, val]) => `<div class="quest"><span>${esc(c)}</span><div class="bar"><i style="width:${(val / totS) * 100}%;background:linear-gradient(90deg,var(--red),#ff9a8a)"></i></div><small style="width:auto">${M.reais(val)}</small></div>`).join('') : '<small style="color:var(--faint)">Sem saídas neste mês.</small>'}</div>
        </div>
      </div>`;
    const go = (n) => { mes = somaMes(mes, n); M.render(); };
    $('#fp').onclick = () => go(-1); $('#fn').onclick = () => go(1); $('#fh').onclick = () => { mes = mesDe(M.today()); M.render(); };
    $('#fAddE').onclick = () => M.finEditar({ tipo: 'entrada', data: mes === mesDe(hoje) ? hoje : mes + '-01' });
    $('#fAddS').onclick = () => M.finEditar({ tipo: 'saida', data: mes === mesDe(hoje) ? hoje : mes + '-01' });
    $('#fCalc').onclick = () => M.calcPreco();
    $('#fCsv').onclick = (e) => { e.preventDefault(); csv(); };
    $('#fF').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filtro = b.dataset.f; SFX.play('click'); M.render(); };
    v.onclick = (e) => {
      if (e.target.closest('[data-atras]')) { const a = fin().filter((f) => !f.pago && f.data < hoje).sort((x, y) => x.data.localeCompare(y.data))[0]; if (a) { mes = mesDe(a.data); filtro = 'pend'; M.render(); } return; }
      const row = e.target.closest('.fin-row'); if (!row) return;
      const f = fin().find((x) => x.id === row.dataset.f); if (!f) return;
      if (e.target.type === 'checkbox') return M.finPago(f, e.target.checked);
      M.finEditar(f);
    };
  };

  M.finPago = (f, on) => {
    f.pago = on; f.pagoEm = on ? M.today() : '';
    M.save(); SFX.play(on ? (f.tipo === 'entrada' ? 'coin' : 'click') : 'undo');
    if (on && f.tipo === 'entrada') FX.burst(null, null, 24, 5);
    M.render();
  };

  // ----- lançar / editar -----
  M.finEditar = (o) => {
    const novo = !o.id;
    const f = novo ? Object.assign({ id: M.uid(), tipo: 'entrada', desc: '', valor: 0, data: M.today(), pago: false, pagoEm: '', cat: '', client: '', forma: '', serie: '', parc: '', obs: '' }, o) : o;
    const C = M.db.clients || [];
    const m = M.modal(`<div class="modal-h"><h2>${novo ? 'Novo lançamento' : 'Editar lançamento'}</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
      <div class="seg fin-tipo" id="ft"><button data-t="entrada" class="${f.tipo === 'entrada' ? 'on' : ''}">＋ Entrada</button><button data-t="saida" class="${f.tipo === 'saida' ? 'on' : ''}">− Saída</button></div>
      <div class="com-mic"><input type="text" id="fd" placeholder="Descrição (ex.: Mensalidade Padaria, Adobe, DAS do MEI)" value="${esc(f.desc)}">${M.micBtn('#fd')}</div>
      <div class="row"><div class="fld"><label>Valor (R$)</label><input type="text" id="fv" inputmode="decimal" placeholder="0,00" value="${f.valor ? String(f.valor.toFixed(2)).replace('.', ',') : ''}"></div>
        <div class="fld"><label>${f.tipo === 'entrada' ? 'Data / vencimento' : 'Vencimento'}</label><input type="date" id="fdt" value="${f.data}"></div></div>
      <div class="row"><div class="fld"><label>Categoria</label><select id="fc"></select></div><div class="fld"><label>Forma</label><select id="ffo"><option value="">—</option>${M.FORMAS.map((x) => `<option ${x === f.forma ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      ${C.length ? `<div class="fld"><label>Cliente</label><select id="fcl"><option value="">— nenhum —</option>${C.map((c) => `<option value="${c.id}" ${c.id === f.client ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
      ${novo ? `<div class="row"><div class="fld"><label>Repetir ${M.hint('Todo mês: cria os próximos 12 meses (bom para mensalidades e contas fixas). Parcelado: você coloca o valor total e ele divide em parcelas mensais.')}</label><select id="fr"><option value="">Não repete</option><option value="mes">Todo mês (12 meses)</option><option value="parc">Parcelado</option></select></div><div class="fld" id="fnp" hidden><label>Nº de parcelas</label><input type="number" id="fpn" min="2" max="48" value="3"></div></div>` : ''}
      <div class="cfg-row" style="border:0;padding:0"><span class="l">${f.tipo === 'entrada' ? 'Já recebi' : 'Já paguei'}</span>${M.sw('fpg', f.pago)}</div>
      <textarea id="fo" placeholder="Observação (opcional)" style="min-height:50px;font-family:var(--f)">${esc(f.obs || '')}</textarea>
      <div class="row" style="justify-content:space-between">${novo ? '<span></span>' : '<button class="btn danger" id="fdel" style="flex:none">🗑️ Apagar</button>'}<button class="btn" id="fok" style="flex:none">Salvar</button></div></div>`, { small: true });
    const cats = () => { $('#fc', m).innerHTML = M.FIN_CAT[f.tipo].map((c) => `<option ${c === f.cat ? 'selected' : ''}>${c}</option>`).join(''); };
    cats();
    $('#x', m).onclick = () => { M.closeModal(); if (M.cliAberto) M.openClient(M.cliAberto); };
    $('#fd', m).focus();
    $('#ft', m).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; f.tipo = b.dataset.t; $$('#ft button', m).forEach((x) => x.classList.toggle('on', x === b)); cats(); };
    if ($('#fr', m)) $('#fr', m).onchange = (e) => { $('#fnp', m).hidden = e.target.value !== 'parc'; };
    const ok = () => {
      const valor = M.lerValor($('#fv', m).value);
      if (!valor) return M.falta($('#fv', m), '💰 Coloque o valor primeiro');
      Object.assign(f, { desc: $('#fd', m).value.trim(), valor, data: $('#fdt', m).value || M.today(), cat: $('#fc', m).value, forma: $('#ffo', m).value, pago: $('#fpg', m).checked, obs: $('#fo', m).value.trim() });
      f.pagoEm = f.pago ? (f.pagoEm || M.today()) : '';
      if ($('#fcl', m)) f.client = $('#fcl', m).value;
      if (novo) {
        const rep = $('#fr', m) ? $('#fr', m).value : '';
        const n = rep === 'mes' ? 12 : rep === 'parc' ? Math.max(2, Math.min(48, +$('#fpn', m).value || 2)) : 1;
        const serie = n > 1 ? M.uid() : '', dia = +f.data.slice(8), ym = mesDe(f.data);
        const total = f.valor, cada = rep === 'parc' ? Math.floor((total / n) * 100) / 100 : total;
        for (let i = 0; i < n; i++) {
          const x = Object.assign({}, f, { valor: rep === 'parc' && i === n - 1 ? Math.round((total - cada * (n - 1)) * 100) / 100 : cada, id: i ? M.uid() : f.id, serie, data: i ? diaNoMes(somaMes(ym, i), dia) : f.data, pago: i ? false : f.pago, pagoEm: i ? '' : f.pagoEm, parc: rep === 'parc' ? `${i + 1}/${n}` : '' });
          fin().push(x);
        }
        if (n > 1) M.toast(rep === 'mes' ? '🔁 Lançado nos próximos 12 meses' : `💳 ${n} parcelas de ${M.reais(cada)}`);
      }
      M.save(); SFX.play('pop'); M.closeModal(); M.render();
      if (M.cliAberto) M.openClient(M.cliAberto);
    };
    $('#fok', m).onclick = ok; $('#fv', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#fdel', m)) $('#fdel', m).onclick = async () => {
      let alvo = [f];
      if (f.serie) {
        const futuros = fin().filter((x) => x.serie === f.serie && x.data >= f.data);
        if (futuros.length > 1 && await M.confirm(`Apagar também os próximos ${futuros.length - 1} lançamentos desta série?`, 'Apagar todos os próximos')) alvo = futuros;
      }
      const ids = new Set(alvo.map((x) => x.id));
      M.db.fin = fin().filter((x) => !ids.has(x.id));
      alvo.forEach((x) => M.db.trash.unshift({ kind: 'fin', data: x, at: Date.now() }));
      M.save(); SFX.play('trash'); M.closeModal(); M.render();
      M.toast(`🗑️ ${alvo.length > 1 ? alvo.length + ' lançamentos' : 'Lançamento'} para a lixeira`, () => { alvo.forEach((x) => M.restoreFromTrash(x.id, true)); });
    };
  };

  // ----- calculadora de preço (valor da hora e do projeto) -----
  M.calcPreco = () => {
    const s = M.db.settings, c = Object.assign({ pro: 3000, custos: 500, imp: 6, res: 10, h: 6, d: 5, f: 4, horas: 10 }, s.calc || {});
    const m = M.modal(`<div class="modal-h"><h2>🧮 Quanto cobrar</h2><button class="icon-btn" id="x">✕</button></div><div class="modal-b">
      <div class="row"><div class="fld"><label>Quanto quer ganhar por mês (R$)</label><input type="text" inputmode="decimal" data-k="pro" value="${c.pro}"></div><div class="fld"><label>Custos fixos do trabalho (R$/mês) ${M.hint('Ferramentas, internet, luz, equipamento dividido por mês, contador…')}</label><input type="text" inputmode="decimal" data-k="custos" value="${c.custos}"></div></div>
      <div class="row"><div class="fld"><label>Horas de trabalho por dia</label><input type="number" data-k="h" value="${c.h}" min="1" max="16"></div><div class="fld"><label>Dias por semana</label><input type="number" data-k="d" value="${c.d}" min="1" max="7"></div><div class="fld"><label>Semanas de folga por ano</label><input type="number" data-k="f" value="${c.f}" min="0" max="20"></div></div>
      <div class="row"><div class="fld"><label>Impostos e taxas (%) ${M.hint('Ex.: MEI paga um valor fixo (coloque 0 e some o DAS nos custos); Simples começa perto de 6%; maquininha/plataforma 3 a 5%.')}</label><input type="number" data-k="imp" value="${c.imp}" min="0" max="60"></div><div class="fld"><label>Reserva para imprevistos (%)</label><input type="number" data-k="res" value="${c.res}" min="0" max="100"></div></div>
      <div class="calc-res" id="cr"></div>
      <div class="row" style="align-items:flex-end"><div class="fld"><label>Horas estimadas de um projeto</label><input type="number" data-k="horas" value="${c.horas}" min="1"></div><div class="calc-proj" id="cp"></div></div>
      <small style="color:var(--dim)">Conte tudo: reuniões, criação, ajustes, mensagens e entrega. Na dúvida, some 20%.</small></div>`, { small: true });
    $('#x', m).onclick = M.closeModal;
    const calc = () => {
      $$('[data-k]', m).forEach((i) => { c[i.dataset.k] = i.type === 'number' ? +i.value || 0 : M.lerValor(i.value); });
      s.calc = c; M.save();
      const horasMes = (c.h * c.d * Math.max(1, 52 - c.f)) / 12;
      const hora = ((c.pro + c.custos) / Math.max(1, horasMes)) / Math.max(0.05, 1 - c.imp / 100) * (1 + c.res / 100);
      $('#cr', m).innerHTML = `<div><small>Você trabalha</small><b>${Math.round(horasMes)} h/mês</b></div><div><small>Sua hora vale</small><b class="pos">${M.reais(hora)}</b></div><div><small>Dia de trabalho</small><b>${M.reais(hora * c.h)}</b></div>`;
      $('#cp', m).innerHTML = `<small>Preço do projeto</small><b class="pos">${M.reais(hora * c.horas)}</b>`;
    };
    m.oninput = calc; calc();
  };

  // ----- planilha (CSV abre no Excel e no Google Planilhas) -----
  function csv() {
    const L = fin().filter((f) => mesDe(f.data) === mes).sort((a, b) => a.data.localeCompare(b.data));
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Cliente', 'Forma', 'Valor', 'Situação', 'Pago em', 'Parcela', 'Observação'].map(q).join(';')];
    L.forEach((f) => linhas.push([f.data.split('-').reverse().join('/'), f.tipo === 'entrada' ? 'Entrada' : 'Saída', f.desc, f.cat, f.client && M.client(f.client) ? M.client(f.client).nome : '', f.forma,
      (f.tipo === 'entrada' ? f.valor : -f.valor).toFixed(2).replace('.', ','), f.pago ? (f.tipo === 'entrada' ? 'Recebido' : 'Pago') : 'Pendente', f.pagoEm ? f.pagoEm.split('-').reverse().join('/') : '', f.parc, f.obs].map(q).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `myloot-financeiro-${mes}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    M.toast('⬇️ Planilha baixada');
  }

  // ----- dentro da ficha do cliente -----
  M.finDoCliente = (c) => {
    const L = fin().filter((f) => f.client === c.id);
    const rec = L.filter((f) => f.tipo === 'entrada' && f.pago).reduce((s, f) => s + f.valor, 0);
    const aRec = L.filter((f) => f.tipo === 'entrada' && !f.pago).reduce((s, f) => s + f.valor, 0);
    const prox = L.filter((f) => !f.pago).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 4);
    return `<div class="fld"><label>💰 Financeiro do cliente</label>
      <div class="mini" style="margin-bottom:8px"><div class="pos">${M.reais(rec)}<small>já recebido</small></div><div>${M.reais(aRec)}<small>a receber</small></div></div>
      ${prox.map((f) => `<div class="fin-row mini-row ${f.data < M.today() ? 'late' : ''}"><span class="fd">${f.data.slice(8)}/${f.data.slice(5, 7)}</span><span class="fx"><b>${esc(f.desc || 'Entrada')}</b></span><span class="fv ${f.tipo === 'entrada' ? 'pos' : 'neg'}">${M.reais(f.valor)}</span></div>`).join('')}
      <button class="btn sm ghost" id="cFin" style="margin-top:6px">＋ Lançar recebimento</button></div>`;
  };
})();
