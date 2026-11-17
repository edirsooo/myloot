// Reportar problema: a pessoa descreve o que aconteceu e continua no formulário (ou e-mail, WhatsApp, GitHub),
// já com a versão, o sistema e os últimos erros da tela (sem itens, anexos nem chaves).
(function () {
  const { esc, $ } = M;
  const REPO = 'https://github.com/edirsooo/myloot';

  // guarda os últimos erros para ir junto no relatório
  const erros = [];
  const guarda = (t) => { t = String(t || '').slice(0, 220); if (!t) return; erros.push(new Date().toLocaleTimeString('pt-BR') + ' ' + t); if (erros.length > 8) erros.shift(); };
  window.addEventListener('error', (e) => guarda((e.message || 'erro') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '')));
  window.addEventListener('unhandledrejection', (e) => guarda('promessa: ' + ((e.reason && e.reason.message) || e.reason)));
  const toast0 = M.toast;
  M.toast = function (msg) { if (/^⚠️/.test(String(msg))) guarda(msg); return toast0.apply(this, arguments); };

  const navegador = () => {
    const u = navigator.userAgent;
    const m = u.match(/(Edg|OPR|Chrome|Firefox|Version)\/(\d+)/);
    const nome = !m ? 'outro' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Version' ? 'Safari' : m[1];
    return nome + (m ? ' ' + m[2] : '') + (/Mobi|Android|iPhone/.test(u) ? ' (celular)' : '');
  };
  const SIS = { win32: 'Windows', darwin: 'Mac', linux: 'Linux' };

  M.reportar = async () => {
    document.body.classList.remove('menu');
    let v = {}; try { v = await M.api('/api/versao'); } catch (_) {}
    const sup = v.suporte || {};
    const email = String(sup.email || '').trim(), zap = String(sup.whatsapp || '').replace(/\D/g, '');
    const form = /^https:\/\/docs\.google\.com\/forms\//.test(sup.formulario || '') ? sup.formulario : '', campos = sup.campos || {};
    const info = () => [
      'Versão: MyLoot ' + (v.versao || '?'),
      'Sistema: ' + (SIS[M.sistema] || M.sistema || '?') + (M.remoto ? ' · aberto pelo celular' : ''),
      'Navegador: ' + navegador(),
      'Tela: ' + innerWidth + 'x' + innerHeight + ' · página: ' + (M.ui.page || '?'),
      erros.length ? 'Últimos erros:\n' + erros.map((x) => '- ' + x).join('\n') : 'Últimos erros: nenhum',
    ].join('\n');
    const m = M.modal(`<div class="modal-h"><h2>🐞 Reportar um problema</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b">
        <div class="seg" id="rTipo"><button data-t="Problema" class="on">🐞 Problema</button><button data-t="Sugestão">💡 Sugestão</button><button data-t="Dúvida">❓ Dúvida</button></div>
        <textarea id="rTx" placeholder="O que aconteceu? O que você estava fazendo na hora? Se der, conte o passo a passo para o erro aparecer de novo." style="min-height:120px;font-family:var(--f)"></textarea>
        ${form ? '' : '<input type="text" id="rCt" placeholder="Seu nome ou contato (opcional, para eu te responder)">'}
        <small style="color:var(--faint)">${form ? 'Abre um formulário já preenchido: é só colocar o seu e-mail e enviar. ' : ''}Vai junto a versão do MyLoot e os últimos erros da tela. Nenhum item, anexo ou chave sua.</small>
        <div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap">
          ${form ? '<button class="btn" id="rForm" style="flex:none">📝 Continuar no formulário</button>' : `<button class="btn ghost" id="rCp" style="flex:none">📋 Copiar</button>
          <button class="btn ghost" id="rGh" style="flex:none" title="Abre uma página pública no GitHub do projeto">🐙 GitHub</button>
          ${zap ? '<button class="btn ghost" id="rZap" style="flex:none">💬 WhatsApp</button>' : ''}
          ${email ? '<button class="btn" id="rMail" style="flex:none">📧 E-mail</button>' : ''}`}
        </div>
      </div>`, { small: true });
    let tipo = 'Problema';
    $('#x', m).onclick = M.closeModal;
    $('#rTipo', m).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; m.querySelectorAll('#rTipo button').forEach((x) => x.classList.toggle('on', x === b)); SFX.play('click'); };
    const texto = () => $('#rTx', m).value.trim();
    const titulo = () => `[${tipo}] ` + (texto().split('\n')[0].slice(0, 70) || 'sem título');
    const contato = () => ($('#rCt', m) ? $('#rCt', m).value.trim() : '');
    const corpo = () => [texto() || '(sem descrição)', contato() ? '\nContato: ' + contato() : '', '\n---\n' + info()].join('\n').trim();
    const pronto = () => { if (texto()) return true; M.toast('✍️ Escreva o que aconteceu primeiro'); $('#rTx', m).focus(); return false; };
    const abrir = (u) => { window.open(u, '_blank', 'noopener'); M.toast('🙏 Valeu! Termine de enviar na janela que abriu.'); };
    if ($('#rCp', m)) $('#rCp', m).onclick = async () => { if (!pronto()) return; try { await navigator.clipboard.writeText(titulo() + '\n\n' + corpo()); M.toast('📋 Copiado'); } catch (_) { M.toast('⚠️ Não deu para copiar'); } };
    if ($('#rGh', m)) $('#rGh', m).onclick = () => { if (!pronto()) return; abrir(`${REPO}/issues/new?title=${encodeURIComponent(titulo())}&body=${encodeURIComponent(corpo())}`); };
    if (form) $('#rForm', m).onclick = () => {
      if (!pronto()) return;
      const q = new URLSearchParams({ usp: 'pp_url' });
      if (campos.tipo) q.set('entry.' + campos.tipo, tipo);
      if (campos.descricao) q.set('entry.' + campos.descricao, texto().slice(0, 1500));
      if (campos.tecnico) q.set('entry.' + campos.tecnico, info().slice(0, 1200));
      abrir(form + (form.includes('?') ? '&' : '?') + q.toString()); M.closeModal();
    };
    if ($('#rZap', m)) $('#rZap', m).onclick = () => { if (!pronto()) return; abrir(`https://wa.me/${zap}?text=${encodeURIComponent('MyLoot · ' + titulo() + '\n\n' + corpo())}`); };
    if ($('#rMail', m)) $('#rMail', m).onclick = () => { if (!pronto()) return; location.href = `mailto:${email}?subject=${encodeURIComponent('MyLoot · ' + titulo())}&body=${encodeURIComponent(corpo().slice(0, 1800))}`; M.toast('🙏 Valeu! Termine de enviar no seu e-mail.'); };
    setTimeout(() => $('#rTx', m).focus(), 50);
  };

  M.suporteSection = () => `<section class="stat"><div class="cfg-h">🐞 Ajuda e problemas</div>
    <div class="cfg-row"><span class="l">Achou um erro ou tem uma ideia? ${M.hint('Abre uma janela para você contar o que aconteceu. A versão e os últimos erros vão junto, para eu conseguir corrigir.')}</span><button class="btn ghost sm" id="cBug" style="flex:none">🐞 Reportar um problema</button></div></section>`;
  M.suporteBind = () => { const b = $('#cBug'); if (b) b.onclick = M.reportar; };
})();
