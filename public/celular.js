// Celular: seção "Usar no celular" (QR Code + código), menu de baixo, toque longo, salvar da web e app instalável.
(function () {
  const { esc, $, $$ } = M;
  M.remoto = false;
  M.sistema = '';

  M.iniciarCelular = async () => {
    try { const r = await M.api('/api/ping'); M.remoto = !!r.remoto; M.sistema = r.sistema || ''; } catch (_) {}
    document.body.classList.toggle('remoto', M.remoto);
    // app instalável (PC pelo 127.0.0.1, ou celular com https, ex.: Tailscale). No http da rede o navegador não deixa, e tudo bem.
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
    salvarDoLink();
  };

  // ----- menu de baixo (celular) -----
  // os 3 atalhos ao lado do ＋ são da pessoa (settings.bnav, em Configurações → Personalizar → Menu)
  const CURTO = { lib: 'Itens', clients: 'Clientes', fin: 'Finanças', cal: 'Agenda', tools: 'Ferram.', ach: 'Conquistas', trash: 'Lixeira' };
  const bnav = document.createElement('nav');
  bnav.id = 'bnav';
  let bnSig = '';
  const pintaBnav = () => {
    const s = (M.db && M.db.settings) || {}, esc3 = Array.isArray(s.bnav) && s.bnav.length === 3 ? s.bnav : ['home', 'lib', 'tasks'];
    const P = (id) => (M.PAGINAS || []).find((x) => x[0] === id) || ['home', '🏠', 'Início'];
    const BN = [esc3[0], esc3[1], 'novo', esc3[2], 'mais'].map((id) => (id === 'novo' ? ['novo', '＋', 'Novo'] : id === 'mais' ? ['mais', '☰', 'Mais'] : [id, P(id)[1], CURTO[id] || P(id)[2]]));
    const sig = JSON.stringify(BN); if (sig === bnSig) return; bnSig = sig;
    bnav.innerHTML = BN.map(([id, em, n]) => `<button data-b="${id}" class="${id === 'novo' ? 'novo' : ''}"><span>${em}</span><small>${esc(n)}</small></button>`).join('');
  };
  pintaBnav();
  document.body.appendChild(bnav);
  bnav.onclick = (e) => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const id = b.dataset.b; SFX.play('click');
    if (id === 'mais') { e.stopPropagation(); document.body.classList.toggle('menu'); return; }
    if (id === 'novo') return M.novoComModelo();
    M.go(id);
  };
  M.onRender = (p) => { pintaBnav(); $$('#bnav [data-b]').forEach((b) => b.classList.toggle('on', b.dataset.b === p)); };

  // ----- toque longo abre o menu do cartão (o iPhone não tem clique direito) -----
  if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))) {
    let t = 0, alvo = null, xy = null;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      alvo = e.target; const tc = e.touches[0]; xy = [tc.clientX, tc.clientY];
      t = setTimeout(() => { if (alvo) alvo.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: xy[0], clientY: xy[1] })); alvo = null; }, 550);
    }, { passive: true });
    const cancela = () => { clearTimeout(t); alvo = null; };
    document.addEventListener('touchmove', cancela, { passive: true });
    document.addEventListener('touchend', cancela, { passive: true });
  }

  // ----- salvar da web: botão no navegador do PC e "Compartilhar" do celular (app instalado) caem aqui -----
  function salvarDoLink() {
    const q = new URLSearchParams(location.search);
    if (!q.has('salvar')) return;
    const texto = q.get('text') || '';
    let url = q.get('url') || q.get('u') || '';
    if (!url) url = (texto.match(/https?:\/\/\S+/) || [''])[0];
    const titulo = q.get('title') || q.get('t') || '';
    history.replaceState(null, '', '/');
    setTimeout(() => M.salvarDaWeb({ url, titulo, texto: texto.replace(url, '').trim() }), 400);
  }
  M.salvarDaWeb = ({ url, titulo, texto }) => {
    const m = M.modal(`<div class="modal-h"><h2>📥 Salvar no MyLoot</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b">
        <input type="text" id="sT" placeholder="Título" value="${esc(titulo || '')}">
        <input type="text" id="sU" placeholder="https://…" value="${esc(url || '')}">
        ${texto ? `<textarea id="sX" style="min-height:70px;font-family:var(--f)">${esc(texto)}</textarea>` : ''}
        <div class="row" style="align-items:center"><select id="sTy">${M.TYPES.map((t) => `<option value="${t.id}" ${t.id === (url ? 'link' : 'nota') ? 'selected' : ''}>${t.em} ${t.name}</option>`).join('')}</select>
        <select id="sC"><option value="">Sem categoria</option>${M.db.categories.map((c) => `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no" style="flex:none">Cancelar</button><button class="btn" id="ok" style="flex:none">Salvar</button></div>
      </div>`, { small: true });
    $('#x', m).onclick = M.closeModal; $('#no', m).onclick = M.closeModal;
    $('#ok', m).onclick = () => {
      const u = $('#sU', m).value.trim(), x = $('#sX', m) ? $('#sX', m).value.trim() : '';
      const ty = $('#sTy', m).value;
      let label = ''; try { label = new URL(u).hostname.replace(/^www\./, ''); } catch (_) {}
      const it = M.createItem({ type: ty, title: $('#sT', m).value.trim() || label || 'Link salvo', cat: $('#sC', m).value,
        content: ty === 'link' ? u : x, desc: ty === 'link' ? x : '', links: u && ty !== 'link' ? [{ id: M.uid(), url: u, label }] : [] });
      M.closeModal(); M.toast('📥 Salvo na Biblioteca'); M.render();
      return it;
    };
  };

  // ----- Configurações → Usar no celular -----
  M.celSection = () => `<section class="stat" id="celSec"><div class="cfg-h">📱 Usar no celular</div><div id="celBox"><small style="color:var(--dim)">…</small></div></section>`;
  M.celBind = async () => {
    const box = $('#celBox'); if (!box) return;
    if (M.remoto) {
      box.innerHTML = `<p style="margin:6px 0;color:var(--dim)">Você está usando o MyLoot pelo celular. ✅<br>Para colocar na tela inicial: no Chrome, menu ⋮ → <b>Adicionar à tela inicial</b>. No iPhone (Safari): botão Compartilhar → <b>Adicionar à Tela de Início</b>.</p>
        <p style="margin:6px 0;color:var(--faint);font-size:12.5px">Algumas coisas só dão no computador: desligar, atualizar, trocar chaves da IA e das integrações, restaurar backup e abrir arquivos no PC.</p>`;
      return;
    }
    let st; try { st = await M.api('/api/rede'); } catch (e) { box.textContent = e.message; return; }
    const desenha = () => {
      if (!box.isConnected) return; // a pessoa já saiu desta tela
      box.innerHTML = `<div class="cfg-row"><span class="l">Liberar na rede Wi-Fi de casa ${M.hint('O celular precisa estar no mesmo Wi-Fi que este computador, e o MyLoot precisa estar aberto aqui. Quem não tiver o código não entra.')}</span>${M.sw('celOn', st.on)}</div>
      ${st.on ? (st.ips.length ? `<div class="cel">
          <div class="cel-qr">${M.qrSvg(st.link, 200)}</div>
          <div class="cel-tx">
            <b>1.</b> Abra a câmera do celular e aponte para o QR Code.<br>
            <b>2.</b> Ou digite no navegador do celular: <code>http://${esc(st.ips[0])}:${st.porta}</code> e use o código:
            <div class="cel-pin">${esc(st.pin.slice(0, 3))} ${esc(st.pin.slice(3))}</div>
            <b>3.</b> Para virar “app”, adicione à tela inicial (menu do navegador).
            <div class="row" style="gap:8px;margin-top:10px"><button class="btn ghost sm" id="celTroca" style="flex:none">🔄 Trocar código</button>${M.hint('Desconecta todos os celulares que já entraram. Use se alguém que não devia tiver o código.')}</div>
          </div></div>
          <small style="color:var(--faint);display:block;margin-top:8px">${M.sistema === 'win32' ? 'Se o Windows perguntar sobre o firewall, permita em <b>redes privadas</b>. ' : ''}Fora de casa? Instale o <a href="https://tailscale.com/download" target="_blank" rel="noopener">Tailscale</a> (grátis) no PC e no celular e use o endereço dele. ${st.ips.length > 1 ? 'Outros endereços deste PC: ' + st.ips.slice(1).map(esc).join(', ') : ''}</small>`
        : '<p style="color:var(--red)">Não achei este computador em nenhuma rede. Ele está conectado no Wi-Fi ou no cabo?</p>') : '<small style="color:var(--dim)">Desligado: só este computador abre o MyLoot.</small>'}`;
      $('#celOn').onchange = async (e) => {
        try { st = await M.api('/api/rede', { method: 'POST', body: JSON.stringify({ on: e.target.checked }) }); SFX.play(st.on ? 'coin' : 'click'); }
        catch (er) { M.toast('⚠️ ' + er.message); }
        setTimeout(desenha, 600);
      };
      const tr = $('#celTroca');
      if (tr) tr.onclick = async () => {
        if (!(await M.confirm('Trocar o código? Os celulares que já entraram vão precisar entrar de novo.', 'Trocar'))) return M.render();
        st = await M.api('/api/rede/trocar', { method: 'POST' }); M.render(); M.toast('🔄 Código trocado');
      };
    };
    desenha();
  };

})();
