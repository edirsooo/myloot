// Criar por voz: grava (ou recebe um arquivo de áudio), transcreve com o Whisper no próprio navegador
// e vira nota, tarefa ou vários itens organizados pela IA. No celular o áudio vai para o PC, que transcreve.
(function () {
  const { esc, $ } = M;

  // ----- motor (voz-worker.js) -----
  let worker = null, seq = 0;
  const pedidos = new Map();
  function motor() {
    if (worker) return worker;
    worker = new Worker('/voz-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      const d = e.data || {}, p = pedidos.get(d.id); if (!p) return;
      if (d.tipo === 'pronto') { pedidos.delete(d.id); p.ok(d.texto); }
      else if (d.tipo === 'erro') { pedidos.delete(d.id); p.no(new Error(d.msg)); }
      else p.aviso(d);
    };
    worker.onerror = (e) => {
      for (const p of pedidos.values()) p.no(new Error('O motor de voz não abriu (' + (e.message || 'sem internet?') + ').'));
      pedidos.clear(); worker = null;
    };
    return worker;
  }
  // áudio (webm, ogg do WhatsApp, m4a, mp3…) → amostras mono a 16 kHz
  async function pcmDe(buf) {
    let dec;
    try { dec = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(buf); }
    catch (_) { throw new Error('Não consegui ler esse áudio. Tente mp3, m4a, ogg ou wav.'); }
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * 16000)), 16000);
    const f = off.createBufferSource(); f.buffer = dec; f.connect(off.destination); f.start();
    return new Float32Array((await off.startRendering()).getChannelData(0));
  }
  M.transcrever = async (blob, aviso = () => {}) => {
    const pcm = await pcmDe(await blob.arrayBuffer());
    if (pcm.length < 8000) throw new Error('O áudio ficou curto demais.');
    const id = ++seq;
    return new Promise((ok, no) => { pedidos.set(id, { ok, no, aviso }); motor().postMessage({ id, pcm }, [pcm.buffer]); });
  };

  const titulo = (t) => { const p = String(t).split(/(?<=[.!?])\s/)[0].trim(); return (p.length > 60 ? p.slice(0, 57).replace(/\s\S*$/, '') + '…' : p) || 'Áudio'; };
  const agora = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  const arquivo = (blob) => new File([blob], 'audio-' + M.today() + '-' + Date.now().toString(36).slice(-4) + (/ogg/.test(blob.type) ? '.ogg' : /mp4|m4a|aac/.test(blob.type) ? '.m4a' : /mpeg|mp3/.test(blob.type) ? '.mp3' : /wav/.test(blob.type) ? '.wav' : '.webm'), { type: blob.type || 'audio/webm' });
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  // ----- gravador -----
  async function gravar(aoNivel) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mime = tipos.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    let ctx = null, raf = 0;
    try {
      ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const d = new Uint8Array(an.fftSize);
      const loop = () => { an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); aoNivel(Math.min(1, m / 70)); raf = requestAnimationFrame(loop); };
      loop();
    } catch (_) {}
    rec.start(250);
    return {
      parar: () => new Promise((ok) => {
        rec.onstop = () => { cancelAnimationFrame(raf); if (ctx) ctx.close().catch(() => {}); stream.getTracks().forEach((t) => t.stop()); ok(new Blob(partes, { type: rec.mimeType || 'audio/webm' })); };
        try { rec.stop(); } catch (_) { ok(new Blob(partes)); }
      }),
    };
  }
  const podeGravar = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  // ----- IA: separa a fala em itens -----
  function pedidoIA() {
    const dia = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
    return `Você recebe a transcrição de um áudio que a pessoa gravou no MyLoot (app de notas, tarefas e financeiro). Separe o que ela disse em itens. Hoje é ${M.today()} (${dia}).
Responda SÓ com JSON, sem nada em volta, neste formato:
{"itens":[{"tipo":"tarefa","titulo":"...","data":"AAAA-MM-DD ou vazio","hora":"HH:MM ou vazio"},{"tipo":"nota","titulo":"...","texto":"..."},{"tipo":"prompt","titulo":"...","texto":"..."},{"tipo":"link","titulo":"...","url":"..."},{"tipo":"entrada","titulo":"...","valor":123.45,"data":"AAAA-MM-DD","pago":true},{"tipo":"saida","titulo":"...","valor":50,"data":"AAAA-MM-DD","pago":false}]}
Regras: "tarefa" é algo a fazer (comece com verbo); datas faladas (amanhã, sexta, dia 20) viram data real; "entrada" (dinheiro que entra) e "saida" (conta, gasto) só quando houver valor em reais, e "pago" diz se já foi pago ou recebido; ideias e informações viram "nota" com o texto organizado em tópicos curtos. Não invente nada que não foi dito. Se tudo for uma coisa só, devolva um item só.`;
  }
  function lerJSON(txt) {
    const m = String(txt || '').match(/\{[\s\S]*\}/);
    if (!m) throw new Error('A IA não devolveu a lista. Tente de novo ou salve como nota.');
    const j = JSON.parse(m[0]);
    return (Array.isArray(j.itens) ? j.itens : []).filter((x) => x && x.tipo);
  }
  const EMO = { tarefa: '✅', nota: '📝', prompt: '✨', link: '🔗', entrada: '💵', saida: '💸' };
  const dinheiro = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function descreve(x) {
    const extra = x.tipo === 'tarefa' ? [x.data && M.fmtDate ? M.fmtDate(x.data) : x.data, x.hora].filter(Boolean).join(' · ')
      : (x.tipo === 'entrada' || x.tipo === 'saida') ? dinheiro(x.valor) + (x.data ? ' · ' + x.data.split('-').reverse().slice(0, 2).join('/') : '') + (x.pago ? ' · pago' : '')
      : x.tipo === 'link' ? x.url : '';
    return `${EMO[x.tipo] || '📝'} <b>${esc(x.titulo || '')}</b>${extra ? ` <small>${esc(extra)}</small>` : ''}`;
  }
  async function criar(x, audio) {
    if (x.tipo === 'tarefa') {
      const t = M.addTask(String(x.titulo || '').slice(0, 200), /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : '');
      if (t && /^\d{2}:\d{2}$/.test(x.hora || '')) t.hora = x.hora;
      return t;
    }
    if (x.tipo === 'entrada' || x.tipo === 'saida') {
      const fin = M.db.fin || (M.db.fin = []);
      const f = { id: M.uid(), tipo: x.tipo, desc: String(x.titulo || '').slice(0, 120), valor: Math.round((Number(x.valor) || 0) * 100) / 100, data: /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : M.today(), pago: !!x.pago, pagoEm: x.pago ? M.today() : '', cat: '', client: '', forma: '', serie: '', parc: '', obs: '' };
      fin.push(f); M.save(); SFX.play('coin');
      return f;
    }
    const ty = ['nota', 'prompt', 'link'].includes(x.tipo) ? x.tipo : 'nota';
    const it = M.createItem({ type: ty, title: String(x.titulo || '').slice(0, 120) || 'Áudio ' + agora(), content: ty === 'link' ? String(x.url || '') : String(x.texto || ''), cat: '' });
    if (audio) await M.attachFiles(it, [audio]);
    return it;
  }

  // ----- janela -----
  M.voz = () => {
    if (M.remoto) return vozCelular();
    document.body.classList.remove('menu');
    let rec = null, t0 = 0, relogio = 0, ultimo = null, ocupado = false;
    const m = M.modal(`<div class="modal-h"><h2>🎙️ Criar por voz</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b voz">
        <div class="voz-topo">
          <button class="voz-mic" id="vMic" aria-label="Gravar"><span>🎙️</span><i id="vNiv"></i></button>
          <div class="voz-inf"><b id="vSt">${podeGravar() ? 'Toque no microfone e fale' : 'Este navegador não deixa gravar aqui'}</b>
            <small id="vSub">Fale do jeito que você mandaria um áudio: “lembrar de ligar pro Rafael amanhã às 10 e anotar a ideia do post de sexta”.</small></div>
        </div>
        <div class="row" style="align-items:center;gap:8px;flex-wrap:wrap"><label class="btn ghost sm" style="flex:none;cursor:pointer">📎 Mandar um arquivo de áudio<input type="file" id="vArq" accept="audio/*,.ogg,.opus,.m4a,.mp3,.wav,.webm" hidden></label>
          <small style="color:var(--faint)">Serve áudio do WhatsApp, gravação do celular, mp3…</small></div>
        <div id="vRes" hidden>
          <textarea id="vTx" placeholder="O que você falou aparece aqui. Dá para corrigir antes de salvar."></textarea>
          <label class="voz-chk"><input type="checkbox" id="vGuarda"> Guardar o áudio junto (no item)</label>
          <div class="row voz-acoes"><button class="btn" id="vIA">✨ Organizar com IA</button><button class="btn ghost" id="vNota">📝 Salvar como nota</button><button class="btn ghost" id="vTar">✅ Virar tarefa</button></div>
          <div id="vLista"></div>
        </div>
        <small style="color:var(--faint)">🔒 A transcrição roda no seu computador. Na primeira vez ele baixa o motor de voz (uns 80 MB) e depois funciona rápido.</small>
      </div>`, { small: true, onClose: () => { clearInterval(relogio); if (rec) rec.parar(); } });
    $('#x', m).onclick = M.closeModal;
    const st = (t, sub) => { $('#vSt', m).textContent = t; if (sub !== undefined) $('#vSub', m).textContent = sub; };
    const mic = $('#vMic', m);

    async function processar(blob) {
      ultimo = blob; ocupado = true; mic.disabled = true;
      st('Transcrevendo…', 'Isso leva alguns segundos.');
      try {
        const txt = await M.transcrever(blob, (d) => {
          if (d.tipo === 'baixando') st(`Baixando o motor de voz… ${Math.round(d.fracao * 100)}%`, 'Só na primeira vez. Depois fica guardado no navegador.');
          else if (d.tipo === 'transcrevendo') st('Transcrevendo…' + (d.de > 1 ? ` (parte ${d.trecho} de ${d.de})` : ''), 'Isso leva alguns segundos.');
        });
        if (!M.modalOpen()) return;
        const tx = $('#vTx', m);
        tx.value = (tx.value.trim() ? tx.value.trim() + ' ' : '') + (txt || '');
        $('#vRes', m).hidden = false; $('#vLista', m).innerHTML = '';
        st(txt ? 'Pronto! Confira o texto' : 'Não entendi nada nesse áudio', txt ? 'Toque no microfone de novo para continuar falando.' : 'Tente falar mais perto do microfone.');
        SFX.play('pop');
      } catch (e) { st('⚠️ ' + e.message, 'Confira a internet (na primeira vez ele baixa o motor) e tente de novo.'); }
      finally { ocupado = false; mic.disabled = false; }
    }

    mic.onclick = async () => {
      if (ocupado) return;
      if (rec) {
        clearInterval(relogio); mic.classList.remove('on'); $('#vNiv', m).style.transform = 'scale(0)';
        const r = rec; rec = null;
        return processar(await r.parar());
      }
      if (!podeGravar()) return st('Este navegador não deixa gravar aqui', 'Use “Mandar um arquivo de áudio” ou abra o MyLoot no Chrome ou no Edge.');
      try {
        rec = await gravar((n) => { const e = $('#vNiv', m); if (e) e.style.transform = `scale(${0.4 + n * 0.9})`; });
        SFX.play('click'); mic.classList.add('on'); t0 = Date.now();
        st('Gravando 0:00 · toque para parar', 'Pode falar à vontade.');
        relogio = setInterval(() => {
          const s = (Date.now() - t0) / 1000; st('Gravando ' + fmt(s) + ' · toque para parar');
          if (s > 300) mic.click(); // 5 minutos no máximo por vez
        }, 500);
      } catch (e) { rec = null; st('⚠️ Não consegui usar o microfone', /denied|permission|NotAllowed/i.test(e.name + e.message) ? 'Libere o microfone no cadeado da barra de endereço e tente de novo.' : e.message); }
    };
    $('#vArq', m).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f && !ocupado) processar(f); };

    const texto = () => $('#vTx', m).value.trim();
    const audio = () => ($('#vGuarda', m).checked && ultimo ? arquivo(ultimo) : null);
    const fim = (msg) => { M.toast(msg); M.render(); $('#vTx', m).value = ''; $('#vRes', m).hidden = true; $('#vLista', m).innerHTML = ''; st('Toque no microfone e fale', 'Pode mandar o próximo.'); };
    $('#vNota', m).onclick = async () => { const t = texto(); if (!t) return; await criar({ tipo: 'nota', titulo: titulo(t), texto: t }, audio()); fim('📝 Nota salva'); };
    $('#vTar', m).onclick = async () => { const t = texto(); if (!t) return; await criar({ tipo: 'tarefa', titulo: t }); fim('✅ Tarefa criada'); };
    $('#vIA', m).onclick = async () => {
      const t = texto(); if (!t) return;
      const b = $('#vIA', m); b.disabled = true; b.textContent = '✨ Organizando…';
      const box = $('#vLista', m);
      try {
        const r = await M.api('/api/ai', { method: 'POST', body: JSON.stringify({ acao: 'livre', pedido: pedidoIA(), texto: t, via: M.db.settings.aiUltima || undefined }) });
        const L = lerJSON(r.texto);
        if (!L.length) throw new Error('A IA não achou nada para criar. Salve como nota.');
        box.innerHTML = `<div class="voz-lista">${L.map((x, i) => `<label><input type="checkbox" data-i="${i}" checked><span>${descreve(x)}</span></label>`).join('')}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn" id="vCriar" style="flex:none">Criar ${L.length > 1 ? 'os ' + L.length : ''} ✔</button></div>`;
        $('#vCriar', m).onclick = async () => {
          const sel = [...box.querySelectorAll('input[data-i]')].filter((c) => c.checked).map((c) => L[+c.dataset.i]);
          if (!sel.length) return;
          let au = audio();
          for (const x of sel) { await criar(x, ['nota', 'prompt'].includes(x.tipo) ? au : null); if (['nota', 'prompt'].includes(x.tipo)) au = null; }
          FX.burst && FX.burst(null, null, 30, 6);
          fim(`🎙️ ${sel.length} ${sel.length > 1 ? 'itens criados' : 'item criado'}`);
        };
      } catch (e) { box.innerHTML = `<p style="margin:0;color:var(--red)">⚠️ ${esc(e.message)}</p>`; }
      finally { b.disabled = false; b.textContent = '✨ Organizar com IA'; }
    };
  };

  // ----- celular: grava ou escolhe o áudio e manda para o PC transcrever -----
  function vozCelular() {
    document.body.classList.remove('menu');
    let rec = null;
    const m = M.modal(`<div class="modal-h"><h2>🎙️ Criar por voz</h2><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-b voz">
        <div class="voz-topo">
          ${podeGravar() ? '<button class="voz-mic" id="vMic" aria-label="Gravar"><span>🎙️</span><i id="vNiv"></i></button>' : '<label class="voz-mic" aria-label="Gravar"><span>🎙️</span><input type="file" id="vCap" accept="audio/*" capture hidden></label>'}
          <div class="voz-inf"><b id="vSt">${podeGravar() ? 'Toque no microfone e fale' : 'Toque no microfone para gravar'}</b>
            <small>O áudio vai para o seu PC, que transcreve e cria a nota. O texto aparece quando o MyLoot estiver aberto lá.</small></div>
        </div>
        <label class="btn ghost sm" style="cursor:pointer">📎 Escolher um áudio (WhatsApp, gravador…)<input type="file" id="vArq" accept="audio/*,.ogg,.opus,.m4a,.mp3" hidden></label>
      </div>`, { small: true, onClose: () => { if (rec) rec.parar(); } });
    $('#x', m).onclick = M.closeModal;
    const enviar = async (blob) => {
      $('#vSt', m).textContent = 'Enviando para o PC…';
      try {
        const it = M.createItem({ type: 'nota', title: '🎙️ Áudio de ' + agora(), content: '', cat: '' });
        it.voz = 'pendente';
        await M.attachFiles(it, [blob instanceof File ? blob : arquivo(blob)]);
        M.save(); M.closeModal(); M.render();
        M.toast('🎙️ Áudio guardado. O PC transcreve e o texto aparece no item.');
      } catch (e) { $('#vSt', m).textContent = '⚠️ ' + e.message; }
    };
    const arq = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) enviar(f); };
    $('#vArq', m).onchange = arq;
    if ($('#vCap', m)) $('#vCap', m).onchange = arq;
    const mic = $('#vMic', m);
    if (mic) mic.onclick = async () => {
      if (rec) { mic.classList.remove('on'); const r = rec; rec = null; return enviar(await r.parar()); }
      try { rec = await gravar((n) => { const e = $('#vNiv', m); if (e) e.style.transform = `scale(${0.4 + n * 0.9})`; }); mic.classList.add('on'); $('#vSt', m).textContent = 'Gravando… toque para parar'; }
      catch (e) { rec = null; $('#vSt', m).textContent = '⚠️ ' + e.message; }
    };
  }

  // ----- PC: transcreve os áudios que chegaram do celular -----
  let naFila = false;
  M.vozFila = async () => {
    if (M.remoto || naFila || !M.db) return;
    const L = M.db.items.filter((i) => i.voz === 'pendente' && (i.attachments || []).length);
    if (!L.length) return;
    naFila = true;
    try {
      for (const it of L) {
        const a = it.attachments[it.attachments.length - 1];
        try {
          const blob = await fetch('/anexos/' + encodeURIComponent(a.file)).then((r) => { if (!r.ok) throw new Error('áudio não encontrado'); return r.blob(); });
          M.toast('🎙️ Transcrevendo o áudio que veio do celular…');
          const txt = await M.transcrever(blob);
          it.content = txt || '(não deu para entender o áudio)';
          if (/^🎙️ Áudio de /.test(it.title) && txt) it.title = titulo(txt);
          it.voz = 'ok'; it.updated = Date.now(); M.save();
          M.toast('🎙️ Áudio do celular virou nota: ' + it.title);
          if (!M.modalOpen()) M.render();
        } catch (e) { it.voz = 'erro'; it.desc = 'Não consegui transcrever: ' + e.message; M.save(); }
      }
    } finally { naFila = false; }
  };
  M.aoSincronizar = () => { M.vozFila(); };
})();
