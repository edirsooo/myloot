// Conexões: códigos para outros programas do computador mandarem itens ao MyLoot (rota /api/entrada).
// Também cuida do cartão de ferramenta parceira (desligado até o versao.json ligar).
(function () {
  const { esc, $ } = M;

  M.cnxSection = () => `<section class="stat so-pc" id="cnxSec"><div class="cfg-h">🤝 Conexões ${M.hint('Deixa outro programa do seu computador mandar itens para o MyLoot. Cada programa usa um código só dele, que você pode desligar ou apagar. Ele só consegue acrescentar itens: não lê nem apaga o que você guardou.')}</div><div id="cnxBox"><small style="color:var(--dim)">…</small></div></section>`;

  M.cnxBind = async () => {
    const box = $('#cnxBox'); if (!box || M.remoto) return;
    let r; try { r = await M.api('/api/conexoes'); } catch (e) { box.innerHTML = `<small style="color:var(--dim)">${esc(e.message)}</small>`; return; }
    const L = r.conexoes || [];
    const quando = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : 'nunca');
    box.innerHTML = `${L.length ? L.map((c) => `<div class="cnx" data-id="${c.id}">
        <div class="cnx-t"><b>${esc(c.nome)}</b><small>${c.recebidos || 0} ${c.recebidos === 1 ? 'item recebido' : 'itens recebidos'} · último uso: ${quando(c.ultimoUso)}</small></div>
        <code title="Código desta conexão">${esc(c.codigo.slice(0, 9))}…</code>
        <button class="btn ghost sm" data-a="copiar" style="flex:none">📋 Copiar código</button>
        ${M.sw('cnx' + c.id, c.on)}
        <button class="icon-btn" data-a="apagar" title="Apagar esta conexão">🗑️</button>
      </div>`).join('') : '<small style="color:var(--dim);display:block;margin-bottom:8px">Nenhum programa conectado ainda.</small>'}
      <div class="row" style="align-items:center;gap:8px;margin-top:8px"><input type="text" id="cnxNome" placeholder="Nome do programa (ex.: minha automação)" style="flex:2"><button class="btn ghost" id="cnxNovo" style="flex:none">＋ Gerar código de conexão</button></div>
      <small style="color:var(--faint);display:block;margin-top:8px">Endereço para o programa: <code>http://127.0.0.1:${r.porta}/api/entrada</code> · formato <code>${esc(r.formato)}</code>. Detalhes no arquivo NOTAS.md.</small>`;
    $('#cnxNovo').onclick = async () => {
      try { const c = await M.api('/api/conexoes', { method: 'POST', body: JSON.stringify({ nome: $('#cnxNome').value }) }); await navigator.clipboard.writeText(c.codigo).catch(() => {}); SFX.play('coin'); M.toast('🤝 Conexão criada. O código já está copiado.'); }
      catch (e) { M.toast('⚠️ ' + e.message); }
      M.cnxBind();
    };
    box.onclick = async (e) => {
      const linha = e.target.closest('.cnx'); if (!linha) return;
      const c = L.find((x) => x.id === linha.dataset.id), a = (e.target.closest('[data-a]') || {}).dataset;
      if (!c || !a) return;
      if (a.a === 'copiar') { try { await navigator.clipboard.writeText(c.codigo); M.toast('📋 Código copiado'); } catch (_) { M.toast('⚠️ Não deu para copiar'); } }
      if (a.a === 'apagar') { if (!(await M.confirm(`Apagar a conexão “${c.nome}”? O programa para de conseguir mandar itens.`, 'Apagar'))) return; await M.api('/api/conexoes/apagar', { method: 'POST', body: JSON.stringify({ id: c.id }) }); M.cnxBind(); }
    };
    box.onchange = async (e) => {
      const linha = e.target.closest('.cnx'); if (!linha || e.target.type !== 'checkbox') return;
      await M.api('/api/conexoes/mudar', { method: 'POST', body: JSON.stringify({ id: linha.dataset.id, on: e.target.checked }) });
      SFX.play('click');
    };
  };

  // de onde o item veio (aparece no cartão aberto)
  M.origemHTML = (it) => {
    const o = it.origem; if (!o || !o.app) return '';
    return `<div class="origem">📥 Veio de <b>${esc(o.app)}</b>${o.em ? ' em ' + new Date(o.em).toLocaleDateString('pt-BR') : ''}${o.url ? ` · <a href="${esc(o.url)}" target="_blank" rel="noopener">↗ abrir na origem</a>` : ''}</div>`;
  };

  // cartão da ferramenta parceira na tela Ferramentas: só aparece quando o versao.json ligar ("parceiro": {"ligado": true, ...})
  let parceiro = null;
  M.parceiroCarregar = async () => { try { const v = await M.api('/api/versao'); parceiro = v.parceiro && v.parceiro.ligado && v.parceiro.link ? v.parceiro : null; } catch (_) { parceiro = null; } return parceiro; };
  M.parceiroHTML = () => (!parceiro ? '' : `<a class="parceiro" href="${esc(parceiro.link)}" target="_blank" rel="noopener">
      <span class="em">${esc(parceiro.emoji || '🧲')}</span>
      <span class="tx"><b>${esc(parceiro.titulo || '')}</b><small>${esc(parceiro.texto || '')}</small></span>
      <span class="btn sm" style="flex:none">${esc(parceiro.botao || 'Conhecer')} ↗</span></a>`);
})();
