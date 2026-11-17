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
  M.lerValor = (s) => { s = String(s || '').replace(/[^\d,.-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); /* "10.000" é dez mil, não dez */ const n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const mesDe = (ymd) => ymd.slice(0, 7);
  const nomeMes = (ym) => new Date(ym + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const somaMes = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const diaNoMes = (ym, dia) => { const [y, m] = ym.split('-').map(Number); const fim = new Date(y, m, 0).getDate(); return ym + '-' + String(Math.min(dia, fim)).padStart(2, '0'); };
  let mes = null, filtro = '', fCli = ''; // fCli: mostra só os lançamentos de um cliente (de todos os meses)

  // ----- séries: a conta fixa (todo mês) e as parcelas guardam o mesmo `serie` em cada lançamento -----
  const serieDe = (f) => (f.serie ? fin().filter((x) => x.serie === f.serie).sort((a, b) => a.data.localeCompare(b.data)) : []);
  const proximos = (f) => serieDe(f).filter((x) => x.id !== f.id && x.data >= f.data); // os que vêm depois deste
  const mmAAAA = (ymd) => ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
  const eProx = (n) => (n > 1 ? `os próximos ${n}` : 'o próximo');
  // cria mais n meses depois do último da conta fixa, iguais a ele e ainda não pagos; devolve a data do novo último
  M.finRenovar = (f, n) => {
    const S = serieDe(f), ult = S[S.length - 1]; if (!ult) return '';
    // dia do vencimento: o mais comum da série (mês curto encolhe o dia 31, e um lançamento movido à mão não muda a regra)
    const vezes = {}; S.forEach((x) => { const d = +x.data.slice(8); vezes[d] = (vezes[d] || 0) + 1; });
    const dia = +Object.keys(vezes).sort((a, b) => vezes[b] - vezes[a] || b - a)[0], ym = mesDe(ult.data);
    let fim = ult.data;
    for (let i = 1; i <= (n || 12); i++) { fim = diaNoMes(somaMes(ym, i), dia); fin().push(Object.assign({}, ult, { id: M.uid(), data: fim, pago: false, pagoEm: '', parc: '' })); }
    return fim;
  };

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
    const cliF = fCli && M.client ? M.client(fCli) : null; if (!cliF) fCli = ''; // cliente apagado: o filtro some junto
    const doMes = fin().filter((f) => mesDe(f.data) === mes).sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'entrada' ? -1 : 1));
    const R = M.finResumo(doMes);
    // com filtro de cliente a lista mostra todos os meses dele: primeiro o que está pendente (o mais antigo em cima), depois o que já foi pago
    const base = cliF ? fin().filter((f) => f.client === fCli).sort((a, b) => !!a.pago - !!b.pago || (a.pago ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data))) : doMes;
    const FILTROS = [['', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas'], ['pend', 'Pendentes']];
    const L = base.filter((f) => !filtro || (filtro === 'pend' ? !f.pago : f.tipo === filtro));
    const comFin = (M.db.clients || []).filter((c) => c.id === fCli || fin().some((f) => f.client === c.id)); // só clientes que têm lançamento
    const atras = fin().filter((f) => !f.pago && f.data < hoje && mesDe(f.data) < mes);
    // 6 meses para o gráfico: em cada mês, o que já aconteceu (cor cheia) e o que ainda é previsão (riscado)
    const meses = Array.from({ length: 6 }, (_, i) => somaMes(mes, i - 5));
    const graf = meses.map((m) => Object.assign({ m }, M.finResumo(fin().filter((f) => mesDe(f.data) === m))));
    const max = Math.max(1, ...graf.map((g) => Math.max(g.rec + g.aRec, g.pag + g.aPag)));
    const curto = (n) => n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(n));
    const col = (cls, feito, prev) => { const t = Math.max(0, feito + prev); return `<span class="fc ${cls}" style="height:${(t / max) * 100}%"><i class="p" style="flex:${t ? (prev / t) * 100 : 0} 1 0"></i><i class="r" style="flex:${t ? (feito / t) * 100 : 0} 1 0"></i></span>`; };
    // saídas por categoria: as pagas mostram para onde o dinheiro foi; as pendentes ficam à parte, como previsão
    const porCat = (pago) => { const o = {}; doMes.filter((f) => f.tipo === 'saida' && !!f.pago === pago).forEach((f) => { o[f.cat || 'Outros'] = (o[f.cat || 'Outros'] || 0) + f.valor; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    const barras = (cs, cls) => { const tot = cs.reduce((s, c) => s + c[1], 0) || 1; return cs.map(([c, val]) => `<div class="quest"><span>${esc(c)}</span><div class="bar"><i class="${cls}" style="width:${(val / tot) * 100}%"></i></div><small style="width:auto">${M.reais(val)}</small></div>`).join(''); };
    const catsP = porCat(true), catsA = porCat(false);
    // lista vazia: ou ainda não há lançamento, ou os filtros esconderam os que existem (aí o botão limpa os filtros)
    const vazio = !base.length
      ? (cliF ? `<div class="empty" style="padding:30px"><div class="big">👤</div><h3>Ainda não há lançamentos de ${esc(cliF.nome || 'este cliente')}</h3><p>Abra a ficha do cliente para adicionar um recebimento, ou limpe o filtro para ver os lançamentos de todos.</p><button class="btn ghost" data-limpa="1" style="margin-top:12px">🧹 Limpar filtros</button></div>`
        : `<div class="empty" style="padding:30px"><div class="big">💰</div><h3>Ainda não há lançamentos em ${nomeMes(mes)}</h3><p>Lance o que entrou e o que saiu. Contas fixas podem repetir todo mês.</p></div>`)
      : `<div class="empty" style="padding:30px"><div class="big">🔎</div><h3>Os filtros esconderam tudo</h3><p>${cliF ? esc(cliF.nome || 'Este cliente') + ' tem' : 'Há'} ${base.length} lançamento${base.length > 1 ? 's' : ''}${cliF ? '' : ' em ' + nomeMes(mes)}, mas nenhum aparece em “${(FILTROS.find((x) => x[0] === filtro) || [])[1] || 'Tudo'}”.</p><button class="btn" data-limpa="1" style="margin-top:12px">🧹 Limpar filtros</button></div>`;
    const linha = (f) => {
      const cli = !cliF && f.client && M.client ? M.client(f.client) : null, late = !f.pago && f.data < hoje, pg = f.tipo === 'entrada' ? 'Recebido' : 'Pago', nome = f.desc || (f.tipo === 'entrada' ? 'Entrada' : 'Saída');
      return `<div class="fin-row ${f.pago ? 'ok' : ''} ${late ? 'late' : ''}" data-f="${f.id}"><input type="checkbox" ${f.pago ? 'checked' : ''} title="${pg}" aria-label="${pg}: ${esc(nome)}">
              <span class="fd">${f.data.slice(8)}/${f.data.slice(5, 7)}${cliF ? '/' + f.data.slice(2, 4) : ''}</span><span class="fx"><b>${esc(nome)}</b><small>${esc(f.cat || '')}${f.forma ? ' · ' + esc(f.forma) : ''}${cli ? ' · 👤 ' + esc(cli.nome) : ''}${f.parc ? ' · parcela ' + esc(f.parc) : ''}${f.serie && !f.parc ? ' · 🔁 conta fixa' : ''}${late ? ' · <i>atrasado</i>' : ''}</small></span>
              <span class="fv ${f.tipo === 'entrada' ? 'pos' : 'neg'}">${f.tipo === 'entrada' ? '+' : '−'} ${M.reais(f.valor)}</span></div>`;
    };
    v.innerHTML = `
      <div class="cal-h fin-h"><button class="icon-btn" id="fp">‹</button><h3>${nomeMes(mes)}</h3><button class="icon-btn" id="fn">›</button><button class="btn ghost sm" id="fh">Hoje</button>
        <button class="btn sm fin-e" id="fAddE">＋ Entrada</button><button class="btn sm fin-s" id="fAddS">− Saída</button>
        <span class="grow" style="flex:1"></span>
        <button class="btn ghost sm" id="fCalc">🧮 Calcular preço</button><a class="btn ghost sm" id="fCsv" href="#">⬇️ Planilha (CSV)</a></div>
      ${atras.length ? `<div class="fin-alerta">⚠️ ${atras.length} conta${atras.length > 1 ? 's' : ''} de meses anteriores ainda em aberto (${M.reais(atras.reduce((s, f) => s + (f.tipo === 'entrada' ? f.valor : -f.valor), 0))}). <a data-atras="1">ver</a></div>` : ''}
      <div class="fin-resumo">
        <div class="stat fr-saldo"><span class="fr-t">💰 Saldo do mês ${M.hint('Recebido menos pago, só o que já aconteceu.')}</span><b class="${R.saldo >= 0 ? 'pos' : 'neg'}">${M.reais(R.saldo)}</b><small>recebido menos pago</small></div>
        <div class="stat fr-grupo"><span class="fr-t">⬇️ Entradas</span><div class="fr-par"><div><small>Recebido</small><b class="pos">${M.reais(R.rec)}</b></div><div><small>A receber</small><b>${M.reais(R.aRec)}</b></div></div></div>
        <div class="stat fr-grupo"><span class="fr-t">⬆️ Saídas</span><div class="fr-par"><div><small>Pago</small><b class="neg">${M.reais(R.pag)}</b></div><div><small>A pagar</small><b>${M.reais(R.aPag)}</b></div></div></div>
        <div class="stat fr-prev"><span class="fr-t">📅 Previsão do mês ${M.hint('Como o mês fecha se tudo o que está previsto for recebido e pago.')}</span><b class="${R.prev >= 0 ? 'pos' : 'neg'}">${M.reais(R.prev)}</b></div>
      </div>
      <div class="fin-grid">
        <div class="panel ${cliF ? 'fin-ano' : ''}"><h4>📒 Lançamentos <span class="seg" id="fF" style="margin-left:auto">${FILTROS.map(([k, n]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${n}</button>`).join('')}</span>${comFin.length ? `<select id="fCliS" class="fin-cli" title="Mostrar só os lançamentos de um cliente" aria-label="Filtrar por cliente"><option value="">👤 Todos os clientes</option>${comFin.map((c) => `<option value="${c.id}" ${c.id === fCli ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select>` : ''}</h4>
          ${cliF ? `<div class="fin-filtro"><span>👤 Só os lançamentos de <b>${esc(cliF.nome || 'Sem nome')}</b>, de todos os meses.</span><button class="btn ghost sm" data-limpa="1">🧹 Limpar filtros</button></div>` : ''}
          ${L.length ? '<div class="fin-cab"><span class="c1">Pago?</span><span class="fd">Data</span><span class="fx">Descrição</span><span>Valor</span></div>' + L.map(linha).join('') : vazio}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="panel"><h4>📊 Últimos 6 meses ${M.hint('Cor cheia: o que já foi recebido ou pago. Riscado: o que ainda é previsão (a receber ou a pagar).')}</h4><div class="fin-gw"><div class="fin-eixo"><span>${curto(max)}</span><span>${curto(max / 2)}</span><span>0</span></div><div class="fin-graf">${graf.map((g) => `<div class="fg" title="${nomeMes(g.m)}: recebido ${M.reais(g.rec)} · a receber ${M.reais(g.aRec)} · pago ${M.reais(g.pag)} · a pagar ${M.reais(g.aPag)}"><div class="fb">${col('e', g.rec, g.aRec)}${col('s', g.pag, g.aPag)}</div><small>${new Date(g.m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></div>`).join('')}</div></div>
            <div class="g-leg" style="margin-top:8px"><span><i style="background:var(--green)"></i>Recebido</span><span><i class="fin-prev-e"></i>A receber (previsto)</span><span><i style="background:var(--red)"></i>Pago</span><span><i class="fin-prev-s"></i>A pagar (previsto)</span></div></div>
          <div class="panel"><h4>🧾 Para onde foi o dinheiro ${M.hint('Só as saídas já pagas neste mês. O que ainda não foi pago aparece separado, como previsão.')}</h4>${catsP.length ? barras(catsP, 'fq-pago') : '<small style="color:var(--faint)">Nenhuma saída paga neste mês ainda.</small>'}
            ${catsA.length ? `<h4 class="fin-sub">📅 Ainda a pagar (previsto)</h4>${barras(catsA, 'fq-prev')}` : ''}</div>
        </div>
      </div>`;
    const go = (n) => { mes = somaMes(mes, n); M.render(); };
    $('#fp').onclick = () => go(-1); $('#fn').onclick = () => go(1); $('#fh').onclick = () => { mes = mesDe(M.today()); M.render(); };
    $('#fAddE').onclick = () => M.finEditar({ tipo: 'entrada', data: mes === mesDe(hoje) ? hoje : mes + '-01' });
    $('#fAddS').onclick = () => M.finEditar({ tipo: 'saida', data: mes === mesDe(hoje) ? hoje : mes + '-01' });
    $('#fCalc').onclick = () => M.calcPreco();
    $('#fCsv').onclick = (e) => { e.preventDefault(); csv(); };
    $('#fF').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filtro = b.dataset.f; SFX.play('click'); M.render(); };
    if ($('#fCliS')) $('#fCliS').onchange = (e) => { fCli = e.target.value; SFX.play('click'); M.render(); };
    v.onclick = (e) => {
      if (e.target.closest('[data-limpa]')) { filtro = ''; fCli = ''; SFX.play('click'); return M.render(); }
      if (e.target.closest('[data-atras]')) { const a = fin().filter((f) => !f.pago && f.data < hoje).sort((x, y) => x.data.localeCompare(y.data))[0]; if (a) { mes = mesDe(a.data); filtro = 'pend'; fCli = ''; M.render(); } return; }
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
  // A janela mexe numa cópia: o lançamento guardado só muda no Salvar (fechar sem salvar não altera nada).
  // `volta` devolve o que estava digitado quando a pessoa cancela uma pergunta (apagar ou mudar a série) e a janela reabre.
  const SERIE_CAMPOS = ['tipo', 'desc', 'valor', 'cat', 'forma', 'client', 'obs']; // o que pode valer também para os próximos da série
  M.finEditar = (o, volta) => {
    const novo = !o.id, orig = o;
    const f = Object.assign({ id: M.uid(), tipo: 'entrada', desc: '', valor: 0, data: M.today(), pago: false, pagoEm: '', cat: '', client: '', forma: '', serie: '', parc: '', obs: '' }, o, volta && volta.f);
    const C = M.db.clients || [];
    const rot = () => (f.tipo === 'entrada' ? ['Data / vencimento', 'Já recebi'] : ['Vencimento', 'Já paguei']);
    // linha que explica a série: até quando a conta fixa está prevista (com o botão de renovar) ou qual parcela é esta
    const serieHTML = () => {
      const S = novo ? [] : serieDe(orig); if (!S.length) return '';
      const ult = S[S.length - 1].data;
      if (orig.parc) { const [a, b] = String(orig.parc).split('/'); return `<div class="fin-serie" id="fse"><span>💳 <b>Parcela ${esc(a)} de ${esc(b || a)}</b> · a última vence em ${mmAAAA(ult)}</span></div>`; }
      return `<div class="fin-serie" id="fse"><span>🔁 <b>Conta fixa: prevista até ${mmAAAA(ult)}</b></span><button type="button" class="btn ghost sm" id="fren" style="flex:none">＋ Renovar por mais 12 meses</button><small>Para pular um mês, apague só o lançamento daquele mês (🗑️ Apagar e depois “Apagar só este”).</small></div>`;
    };
    const m = M.modal(`<div class="modal-h"><h2>${novo ? 'Novo lançamento' : 'Editar lançamento'}</h2><button class="icon-btn" id="x" title="Fechar (Esc)" aria-label="Fechar">✕</button></div><div class="modal-b">
      <div class="seg fin-tipo" id="ft"><button data-t="entrada" class="${f.tipo === 'entrada' ? 'on' : ''}">＋ Entrada</button><button data-t="saida" class="${f.tipo === 'saida' ? 'on' : ''}">− Saída</button></div>
      ${serieHTML()}
      <div class="com-mic"><input type="text" id="fd" placeholder="Descrição (ex.: Mensalidade Padaria, Adobe, DAS do MEI)" value="${esc(f.desc)}">${M.micBtn('#fd')}</div>
      <div class="row"><div class="fld"><label>Valor (R$)</label><input type="text" id="fv" inputmode="decimal" placeholder="0,00" value="${f.valor ? String(Number(f.valor).toFixed(2)).replace('.', ',') : ''}"></div>
        <div class="fld"><label id="fdtL">${rot()[0]}</label><input type="date" id="fdt" value="${f.data}"></div></div>
      <div class="row"><div class="fld"><label>Categoria</label><select id="fc"></select></div><div class="fld"><label>Forma</label><select id="ffo"><option value="">—</option>${(f.forma && !M.FORMAS.includes(f.forma) ? [f.forma].concat(M.FORMAS) : M.FORMAS).map((x) => `<option ${x === f.forma ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>
      ${C.length ? `<div class="fld"><label>Cliente</label><select id="fcl"><option value="">— nenhum —</option>${C.map((c) => `<option value="${c.id}" ${c.id === f.client ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></div>` : ''}
      ${novo ? `<div class="row"><div class="fld"><label>Repetir ${M.hint('Todo mês: cria os próximos 12 meses (bom para mensalidades e contas fixas); depois dá para renovar por mais 12 abrindo qualquer um deles. Para pular um mês, apague só o lançamento daquele mês. Parcelado: você coloca o valor total e ele divide em parcelas mensais.')}</label><select id="fr"><option value="">Não repete</option><option value="mes">Todo mês (12 meses)</option><option value="parc">Parcelado</option></select></div><div class="fld" id="fnp" hidden><label>Nº de parcelas</label><input type="number" id="fpn" min="2" max="48" value="3"></div></div>` : ''}
      <div class="cfg-row" style="border:0;padding:0"><span class="l" id="fpgL">${rot()[1]}</span>${M.sw('fpg', f.pago)}</div>
      <textarea id="fo" placeholder="Observação (opcional)" style="min-height:50px;font-family:var(--f)">${esc(f.obs || '')}</textarea>
      <div class="row" style="justify-content:space-between">${novo ? '<span></span>' : '<button class="btn danger" id="fdel" style="flex:none">🗑️ Apagar</button>'}<button class="btn" id="fok" style="flex:none">${novo ? '＋ Adicionar' : '✔ Salvar'}</button></div></div>`, { small: true });
    const catDe = { [f.tipo]: f.cat }; // categoria escolhida em cada tipo: trocar Entrada/Saída e destrocar não perde a escolha
    const cats = () => { const sel = catDe[f.tipo] || '', L = M.FIN_CAT[f.tipo]; $('#fc', m).innerHTML = (sel && !L.includes(sel) ? [sel].concat(L) : L).map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join(''); };
    cats();
    // o que está na janela agora (sem conferir nada)
    const le = () => { const x = { tipo: f.tipo, desc: $('#fd', m).value.trim(), valor: M.lerValor($('#fv', m).value), data: $('#fdt', m).value || M.today(), cat: $('#fc', m).value, forma: $('#ffo', m).value, pago: $('#fpg', m).checked, obs: $('#fo', m).value.trim() }; if ($('#fcl', m)) x.client = $('#fcl', m).value; return x; };
    const ini = (volta && volta.ini) || le(); // como a janela abriu: é a referência para saber o que a pessoa mudou
    const mexeu = () => $('#fd', m).dispatchEvent(new Event('change', { bubbles: true })); // conta como alteração para o aviso de "você não salvou"
    if (volta) { const a = le(); if (Object.keys(ini).some((k) => a[k] !== ini[k])) mexeu(); }
    $('#x', m).onclick = () => { M.closeModal(); if (M.cliAberto) M.openClient(M.cliAberto); };
    $('#fd', m).focus();
    $('#ft', m).onclick = (e) => {
      const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === f.tipo) return;
      catDe[f.tipo] = $('#fc', m).value; f.tipo = b.dataset.t; // só na cópia: vale de verdade ao salvar
      $$('#ft button', m).forEach((x) => x.classList.toggle('on', x === b)); cats();
      $('#fdtL', m).textContent = rot()[0]; $('#fpgL', m).textContent = rot()[1]; mexeu();
    };
    if ($('#fr', m)) $('#fr', m).onchange = (e) => { $('#fnp', m).hidden = e.target.value !== 'parc'; };
    const ligaSerie = () => {
      const b = $('#fren', m); if (!b) return;
      b.onclick = () => { const ate = M.finRenovar(orig, 12); if (!ate) return; M.save(); SFX.play('pop'); M.render(); $('#fse', m).outerHTML = serieHTML(); ligaSerie(); M.toast(`🔁 Conta fixa renovada até ${mmAAAA(ate)}`); };
    };
    ligaSerie();
    const fecha = () => { M.closeModal(); M.render(); if (M.cliAberto) M.openClient(M.cliAberto); };
    const ok = async () => {
      const x = le();
      if (!(x.valor > 0)) return M.falta($('#fv', m), $('#fv', m).value.trim() ? '💰 O valor precisa ser maior que zero' : '💰 Coloque o valor primeiro');
      if (novo) {
        Object.assign(f, x); f.pagoEm = f.pago ? (f.pagoEm || M.today()) : '';
        const rep = $('#fr', m) ? $('#fr', m).value : '';
        const n = rep === 'mes' ? 12 : rep === 'parc' ? Math.max(2, Math.min(48, +$('#fpn', m).value || 2)) : 1;
        const serie = n > 1 ? M.uid() : '', dia = +f.data.slice(8), ym = mesDe(f.data);
        const total = f.valor, cada = rep === 'parc' ? Math.floor((total / n) * 100) / 100 : total;
        if (!(cada > 0)) return M.falta($('#fpn', m), '💳 O valor é pequeno demais para tantas parcelas');
        let fim = f.data;
        for (let i = 0; i < n; i++) {
          fim = i ? diaNoMes(somaMes(ym, i), dia) : f.data;
          fin().push(Object.assign({}, f, { valor: rep === 'parc' && i === n - 1 ? Math.round((total - cada * (n - 1)) * 100) / 100 : cada, id: i ? M.uid() : f.id, serie, data: fim, pago: i ? false : f.pago, pagoEm: i ? '' : f.pagoEm, parc: rep === 'parc' ? `${i + 1}/${n}` : '' }));
        }
        M.save(); SFX.play('pop'); fecha();
        if (n > 1) M.toast(rep === 'mes' ? `🔁 Conta fixa lançada até ${mmAAAA(fim)}` : `💳 ${n} parcelas de ${M.reais(cada)}`);
        return;
      }
      // lançamento de série que tem próximos: o que mudou vale só para este ou também para os que vêm depois?
      const px = proximos(orig), mud = SERIE_CAMPOS.filter((k) => k in x && x[k] !== ini[k]);
      let todos = false;
      if (px.length && mud.length) {
        const r = await M.escolha(`Este lançamento faz parte de ${orig.parc ? 'um parcelamento' : 'uma conta fixa'}. A mudança vale só para este ou também para ${eProx(px.length)}?`, [{ k: 'um', t: '✔ Mudar só este' }, { k: 'todos', t: `✔ Mudar este e ${eProx(px.length)}` }], 'Mudar a série?');
        if (!r) return M.finEditar(orig, { f: x, ini }); // Cancelar: volta para a janela com o que estava digitado, sem gravar nada
        todos = r === 'todos';
      }
      const real = fin().find((y) => y.id === orig.id) || orig; // o lançamento como está no banco agora (a sincronia pode ter trocado o objeto)
      Object.assign(real, x); real.pagoEm = x.pago ? (real.pagoEm || M.today()) : '';
      if (todos) px.forEach((p) => mud.forEach((k) => { p[k] = x[k]; }));
      M.save(); SFX.play('pop'); fecha();
      if (todos) M.toast(`✔ Mudou este e ${eProx(px.length)}`);
    };
    $('#fok', m).onclick = ok; $('#fv', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if ($('#fdel', m)) $('#fdel', m).onclick = async () => {
      const px = proximos(orig); let alvo = [orig];
      if (px.length) {
        const x = le();
        const r = await M.escolha(`Este lançamento faz parte de ${orig.parc ? 'um parcelamento' : 'uma conta fixa'}. ${orig.parc ? '' : 'Para pular só este mês, apague só este. '}O que for apagado vai para a Lixeira.`, [{ k: 'um', t: '🗑️ Apagar só este', perigo: true }, { k: 'todos', t: `🗑️ Apagar este e ${eProx(px.length)}`, perigo: true }], 'Apagar da série?');
        if (!r) return M.finEditar(orig, { f: x, ini }); // Cancelar não apaga nada
        if (r === 'todos') alvo = [orig].concat(px);
      }
      alvo.forEach((x) => M.paraLixeira('fin', x));
      M.save(); SFX.play('trash'); M.closeModal(); M.render();
      M.toast(`🗑️ ${alvo.length > 1 ? alvo.length + ' lançamentos' : 'Lançamento'} para a lixeira`);
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
  // mostra o que está pendente (o mais antigo em cima) e os 2 últimos já pagos, para dar para desmarcar um engano ali mesmo
  M.finDoCliente = (c) => {
    const L = fin().filter((f) => f.client === c.id), hoje = M.today();
    const rec = L.filter((f) => f.tipo === 'entrada' && f.pago).reduce((s, f) => s + f.valor, 0);
    const aRec = L.filter((f) => f.tipo === 'entrada' && !f.pago).reduce((s, f) => s + f.valor, 0);
    const pend = L.filter((f) => !f.pago).sort((a, b) => a.data.localeCompare(b.data));
    const pagos = L.filter((f) => f.pago).sort((a, b) => (b.pagoEm || b.data).localeCompare(a.pagoEm || a.data));
    const linha = (f) => {
      const ent = f.tipo === 'entrada', late = !f.pago && f.data < hoje, nome = f.desc || (ent ? 'Entrada' : 'Saída'), marca = ent ? 'Marcar como recebido' : 'Marcar como pago';
      return `<div class="fin-row mini-row cli-fin ${f.pago ? 'ok' : ''} ${late ? 'late' : ''}" data-fin="${f.id}" title="Abrir este lançamento"><input type="checkbox" ${f.pago ? 'checked' : ''} title="${marca}" aria-label="${marca}: ${esc(nome)}">
        <span class="fd">${f.data.slice(8)}/${f.data.slice(5, 7)}/${f.data.slice(2, 4)}</span><span class="fx"><b>${esc(nome)}</b><small>${f.pago ? (ent ? 'recebido' : 'pago') : late ? '<i>atrasado</i>' : ent ? 'a receber' : 'a pagar'}${f.parc ? ' · parcela ' + esc(f.parc) : ''}${f.serie && !f.parc ? ' · 🔁 conta fixa' : ''}</small></span><span class="fv ${ent ? 'pos' : 'neg'}">${M.reais(f.valor)}</span></div>`;
    };
    return `<div class="fld fin-ano"><label>💰 Financeiro do cliente ${M.hint('Clique num lançamento para abrir e corrigir. Marque a caixinha quando receber ou pagar.')}</label>
      <div class="mini" style="margin-bottom:8px"><div class="pos">${M.reais(rec)}<small>já recebido</small></div><div>${M.reais(aRec)}<small>a receber</small></div></div>
      ${pend.slice(0, 4).concat(pagos.slice(0, 2)).map(linha).join('') || '<small style="color:var(--faint)">Nenhum lançamento ainda.</small>'}
      <div class="row" style="margin-top:8px;gap:8px"><button class="btn sm ghost" id="cFin" style="flex:none">＋ Adicionar recebimento</button>${L.length ? `<button class="btn sm ghost" id="cFinTodos" style="flex:none">📒 Ver todos os lançamentos deste cliente (${L.length})</button>` : ''}</div></div>`;
  };
  // liga os cliques dessa parte da ficha; o clientes.js chama a cada vez que redesenha a ficha
  M.finClienteLiga = (m, c, redesenha) => {
    if ($('#cFin', m)) $('#cFin', m).onclick = () => M.finEditar({ tipo: 'entrada', client: c.id, desc: 'Pagamento ' + (c.nome || ''), cat: 'Serviço / cliente' });
    if ($('#cFinTodos', m)) $('#cFinTodos', m).onclick = () => M.finVerCliente(c.id);
    $$('[data-fin]', m).forEach((row) => {
      row.onclick = (e) => {
        const f = fin().find((x) => x.id === row.dataset.fin); if (!f) return;
        if (e.target.type !== 'checkbox') return M.finEditar(f); // fechar a janela do lançamento volta para a ficha
        M.finPago(f, e.target.checked); redesenha();
      };
    });
  };
  // abre o Financeiro mostrando só os lançamentos de um cliente, de todos os meses
  M.finVerCliente = (id) => { fCli = id; filtro = ''; M.go('fin'); };
})();
