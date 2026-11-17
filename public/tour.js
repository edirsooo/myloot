// Dica "?" flutuante (nunca fica tampada) e tutorial guiado: na primeira vez em cada tela,
// destaca os pontos principais passo a passo. Dá para avançar, voltar ou pular tudo.
(function () {
  const { esc, $, $$ } = M;

  // ---------- dica "?" : uma caixinha só, presa à janela, que desvia das bordas ----------
  const Z = () => parseFloat(document.documentElement.style.zoom) || 1; // "Tamanho das letras" muda a escala da página
  const caixa = (el) => { const r = el.getBoundingClientRect(), z = Z(); return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z }; };
  const LW = () => innerWidth / Z(), LH = () => innerHeight / Z();
  const dica = document.createElement('div');
  dica.id = 'dica'; dica.hidden = true; document.body.appendChild(dica);
  const mostraDica = (h) => {
    dica.textContent = h.dataset.tip || ''; dica.hidden = false;
    const r = caixa(h), w = dica.offsetWidth, al = dica.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - al - 8;
    if (y < 8) y = r.bottom + 8;                       // sem espaço em cima: abre embaixo
    x = Math.max(8, Math.min(x, LW() - w - 8));
    dica.style.left = x + 'px'; dica.style.top = Math.max(8, Math.min(y, LH() - al - 8)) + 'px';
  };
  document.addEventListener('mouseover', (e) => { const h = e.target.closest && e.target.closest('.hint'); if (h) mostraDica(h); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.hint')) dica.hidden = true; });
  document.addEventListener('click', (e) => { const h = e.target.closest && e.target.closest('.hint'); if (h) { e.stopPropagation(); mostraDica(h); } else dica.hidden = true; }, true);
  document.addEventListener('scroll', () => { dica.hidden = true; }, true);

  // ---------- tutorial ----------
  // s: seletor (ou lista: usa o primeiro que estiver visível) · tudo: junta todos os que casarem · sem "s": cartão no centro
  M.TOURS = {
    home: [
      { s: '.hero', t: 'Seu resumo do dia', d: 'Aqui em cima ficam a data, quantas tarefas você tem para hoje e os seus números: itens guardados, tarefas abertas, nível e dias seguidos.' },
      { s: '.ring', t: 'Meta do dia', d: 'O anel enche conforme você ganha pontos (XP) concluindo tarefas e guardando itens. Se não curtir o joguinho, dá para desligar nas Configurações.' },
      { s: '.qc', t: 'Guarde qualquer coisa', d: 'Escolha Tarefa, Nota, Prompt ou Link, escreva e aperte Enter. Se colar um link, ele entende sozinho. No 🎙️ você cria falando.' },
      { s: '.home > .panel', tudo: true, t: 'Seus painéis', d: 'Para hoje, Missões do dia, Em andamento, Favoritos e Mexidos por último: o que importa agora, sem procurar.' },
      { s: '#gSide', t: 'Mapa de conexões', d: 'Cada bolinha é um item. Os que têm a mesma etiqueta, a mesma categoria ou citam um ao outro se ligam sozinhos. Passe o mouse, clique para abrir ou veja em tela cheia.' },
      { s: '#focus', t: 'Modo foco', d: 'Um timer para trabalhar sem distração. Pode fechar o navegador: quando acabar, o computador avisa.' },
      { s: ['#nav', '#bnav'], t: 'O menu', d: 'Por aqui você troca de tela. Em cada tela nova aparece um tutorial rápido como este, só na primeira vez.' },
    ],
    lib: [
      { s: '#hotbar', t: 'Tudo o que você guardou', d: 'A Biblioteca tem 6 tipos: Estudo/PDF, Prompt, Instrução, Comando, Link e Nota. Clique num tipo para ver só ele.' },
      { s: '#view .toolbar', t: 'Filtros', d: 'Filtre por texto, categoria, status, etiqueta ou só os favoritos.' },
      { s: '#views', t: 'Quatro jeitos de ver', d: 'Grade, lista, tabela ou quadro. No quadro, arraste os cartões de uma coluna para outra.' },
      { s: '#libres .card', t: 'O cartão', d: 'Clique para abrir e editar: texto, checklist, links e anexos. Clique com o botão direito (no celular, segure o dedo) para copiar, favoritar, enviar ao Notion/Trello ou mover.' },
      { t: 'Arraste arquivos', d: 'Solte um PDF, imagem ou qualquer arquivo em cima da janela e ele vira um item novo, com o arquivo anexado. Para achar tudo rápido, use Ctrl + K.' },
      { s: ['#btnNew', '#bnav .novo'], t: 'Novo item', d: 'Crie em branco ou a partir de um modelo pronto (briefing, contrato, proposta, roteiro…).' },
    ],
    tasks: [
      { s: '.tnew', t: 'Nova tarefa', d: 'Escreva e aperte Enter. Se terminar com “hoje” ou “amanhã”, a data entra sozinha.' },
      { s: '.tgroup', t: 'Separadas por prazo', d: 'Atrasadas, hoje, próximas e sem data. Concluir uma tarefa dá pontos.' },
      { s: '.task', t: 'Detalhes da tarefa', d: 'Clique no texto para editar: data, lembrete com horário (o computador avisa), repetição (todo dia, toda semana, todo mês) e o cliente.' },
    ],
    cal: [
      { s: '.cal-h', t: 'Calendário do mês', d: 'Use as setas para mudar de mês e “Hoje” para voltar.' },
      { s: '.cal', t: 'Seus dias', d: 'Clique num dia para criar uma tarefa. Arraste uma tarefa para outro dia para remarcar. Itens com data também aparecem aqui.' },
    ],
    clients: [
      { s: '#cliNovo', t: 'Seus clientes', d: 'Cadastre nome, WhatsApp, e-mail, Instagram, o quadro do Trello e a pasta do cliente no computador.' },
      { s: '#cliF', t: 'Status', d: 'Separe por Prospect, Ativo, Pausado e Encerrado.' },
      { s: '#cliV', t: 'Cartões ou funil', d: 'No funil, arraste o cliente de uma coluna para outra conforme a negociação anda.' },
      { s: '.card.cli', t: 'A ficha do cliente', d: 'Clique para abrir: atalhos de contato, tarefas, itens (briefing, contrato, proposta) e os pagamentos dele, tudo junto.' },
    ],
    fin: [
      { s: ['#fAddE', '.fin-h'], t: 'Lance o que entra e o que sai', d: 'Use ＋ Entrada e − Saída. Contas fixas podem repetir todo mês e compras podem ser parceladas.' },
      { s: '.fin-stats', t: 'O resumo do mês', d: 'Recebido, pago e saldo mostram o que já aconteceu. A receber, a pagar e a previsão mostram como o mês deve fechar.' },
      { s: '.fin-grid > .panel', t: 'Lançamentos', d: 'Marque a caixinha quando receber ou pagar. Clique na linha para editar. O que está atrasado fica com a borda vermelha.' },
      { s: '#fCalc', t: 'Quanto cobrar', d: 'A calculadora mostra o valor da sua hora e o preço de um projeto, contando custos, impostos e folgas.' },
      { s: '#fCsv', t: 'Leve para a planilha', d: 'Baixe o mês em CSV para abrir no Excel ou no Google Planilhas, ou mandar para o contador.' },
    ],
    tools: [
      { s: '#fG', t: 'Central de ferramentas', d: 'Links de IAs de imagem e vídeo e de programas gratuitos, separados por grupo.' },
      { s: '#fQ', t: 'Busque', d: 'Digite o nome ou o que você quer fazer.' },
      { s: '#fRes .card', t: 'Abra ou guarde', d: 'Abra o site ou clique em ＋ Guardar para levar o link para a sua Biblioteca.' },
    ],
    cfg: [
      { s: '#celSec', t: 'Usar no celular', d: 'Ligue a chave, aponte a câmera do celular para o QR Code e use o MyLoot no mesmo Wi-Fi.' },
      { s: '#tourSec', t: 'Tutorial', d: 'Quer ver estas explicações de novo? É só clicar aqui.' },
      { t: 'Seus dados são seus', d: 'Mais abaixo você conecta a IA, o Notion, o Trello e o Drive, baixa backup (com ou sem senha) e exporta tudo para o Obsidian.' },
    ],
  };

  let ativo = null; // { pg, passos, i, els }
  const visivel = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
  function alvo(p) {
    if (!p.s) return [];
    for (const s of [].concat(p.s)) {
      const L = (p.tudo ? $$(s) : [$(s)]).filter(visivel);
      if (L.length) return L;
    }
    return null; // tinha seletor, mas nada na tela: pula o passo
  }

  function fechar(marcar) {
    if (!ativo) return;
    const pg = ativo.pg; ativo.els.forEach((e) => e.remove()); ativo = null;
    removeEventListener('resize', pinta); document.removeEventListener('keydown', tecla, true);
    if (marcar) { const s = M.db.settings; s.tour = Object.assign({}, s.tour, { [pg]: true }); M.save(); }
  }
  function tecla(e) {
    if (!ativo) return;
    if (e.key === 'Escape') { e.stopPropagation(); fechar(true); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ir(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); ir(-1); }
  }
  function ir(d) {
    if (!ativo) return;
    let i = ativo.i + d;
    while (i >= 0 && i < ativo.passos.length && alvo(ativo.passos[i]) === null) i += d; // pula passos sem alvo
    if (i < 0) return;
    if (i >= ativo.passos.length) { fechar(true); SFX.play('coin'); return; }
    ativo.i = i; SFX.play('click');
    const L = alvo(ativo.passos[i]);
    if (L && L[0]) L[0].scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    pinta();
  }
  function pinta() {
    if (!ativo) return;
    const [, foco, card] = ativo.els, p = ativo.passos[ativo.i], L = alvo(p) || [];
    const n = ativo.passos.filter((x) => alvo(x) !== null).length, k = ativo.passos.slice(0, ativo.i + 1).filter((x) => alvo(x) !== null).length;
    let r = null;
    if (L.length) {
      const rs = L.map(caixa);
      r = { l: Math.min(...rs.map((x) => x.left)) - 6, t: Math.min(...rs.map((x) => x.top)) - 6, r: Math.max(...rs.map((x) => x.right)) + 6, b: Math.max(...rs.map((x) => x.bottom)) + 6 };
      r.l = Math.max(4, r.l); r.t = Math.max(4, r.t); r.r = Math.min(LW() - 4, r.r); r.b = Math.min(LH() - 4, r.b);
      Object.assign(foco.style, { left: r.l + 'px', top: r.t + 'px', width: r.r - r.l + 'px', height: r.b - r.t + 'px', opacity: 1 });
    } else Object.assign(foco.style, { left: LW() / 2 + 'px', top: LH() / 2 + 'px', width: '0px', height: '0px', opacity: 0 });
    card.innerHTML = `<div class="tour-n">Passo ${k} de ${n}</div><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p>
      <div class="tour-b"><button class="tour-pular" data-a="pular">Pular tutorial</button><span style="flex:1"></span>${k > 1 ? '<button class="btn ghost sm" data-a="volta">Voltar</button>' : ''}<button class="btn sm" data-a="vai">${k === n ? 'Concluir ✓' : 'Próximo →'}</button></div>`;
    // posição do cartão: embaixo do destaque; sem espaço, em cima; sem espaço nenhum (ou sem alvo), no centro
    const cw = card.offsetWidth, ch = card.offsetHeight, G = 12;
    let x, y;
    if (!r) { x = (LW() - cw) / 2; y = (LH() - ch) / 2; }
    else {
      x = Math.max(G, Math.min(r.l, LW() - cw - G));
      if (r.b + G + ch <= LH() - G) y = r.b + G;
      else if (r.t - G - ch >= G) y = r.t - G - ch;
      else if (r.r + G + cw <= LW() - G) { x = r.r + G; y = Math.max(G, Math.min(r.t, LH() - ch - G)); }
      else if (r.l - G - cw >= G) { x = r.l - G - cw; y = Math.max(G, Math.min(r.t, LH() - ch - G)); }
      else y = LH() - ch - G;
    }
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }

  M.tour = (pg) => {
    const passos = M.TOURS[pg];
    if (!passos || ativo) return;
    if (!passos.some((p) => alvo(p) !== null)) return;
    const fundo = document.createElement('div'), foco = document.createElement('div'), card = document.createElement('div');
    fundo.className = 'tour-fundo'; foco.className = 'tour-foco'; card.className = 'tour-card';
    document.body.append(fundo, foco, card);
    ativo = { pg, passos, i: -1, els: [fundo, foco, card] };
    card.onclick = (e) => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'vai') ir(1); else if (a === 'volta') ir(-1);
      else { M.db.settings.tourOff = true; fechar(true); M.toast('Tutorial pulado. Para ver de novo: Configurações → Tutorial.'); }
    };
    addEventListener('resize', pinta); document.addEventListener('keydown', tecla, true);
    ir(1);
  };

  const modalOriginal = M.modal;
  M.modal = function () {
    if (ativo) { const pg = ativo.pg; fechar(false); M.tourTalvez(pg, 1); }
    return modalOriginal.apply(this, arguments);
  };

  // começa sozinho na primeira vez em cada tela (espera fechar janelas abertas)
  let espera = 0;
  M.tourTalvez = (pg, vez) => {
    clearTimeout(espera);
    const s = M.db.settings;
    if (!M.inicioPronto || ativo || s.tourOff || (s.tour || {})[pg] || !M.TOURS[pg]) return;
    espera = setTimeout(() => {
      if (M.ui.page !== pg || ativo) return;
      if (M.modalOpen() || !$('#levelup').hidden || document.querySelector('.rd-full')) { if ((vez || 0) < 600) M.tourTalvez(pg, (vez || 0) + 1); return; }
      M.tour(pg);
    }, vez ? 2000 : 900);
  };
  const antes = M.onRender;
  let ultima = '';
  M.onRender = (p) => { if (antes) antes(p); if (p !== ultima) { ultima = p; M.tourTalvez(p); } };

  M.tourSection = () => `<section class="stat" id="tourSec"><div class="cfg-h">🎓 Tutorial</div>
    <div class="cfg-row"><span class="l">Explicações de cada tela ${M.hint('Na primeira vez em cada tela, o MyLoot mostra os pontos principais passo a passo.')}</span><button class="btn ghost sm" id="tourDeNovo" style="flex:none">▶️ Ver o tutorial de novo</button></div></section>`;
  M.tourBind = () => {
    const b = $('#tourDeNovo'); if (!b) return;
    b.onclick = () => { const s = M.db.settings; s.tour = {}; s.tourOff = false; M.save(); ultima = ''; M.go('home'); };
  };
})();
