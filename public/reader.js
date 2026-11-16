// Leitor em blocos: transforma .md e .txt em cartões fáceis de ler (sem bibliotecas, tudo escapado).
(function () {
  const esc = M.esc;

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
    s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    s = s.replace(/!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }

  // devolve { html, codes } — codes são os trechos de código, para o botão Copiar
  M.md = (src) => {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const codes = [], secs = [];
    let cur = { title: '', level: 0, out: [] };
    let i = 0, meta = '';
    const push = () => { if (cur.title || cur.out.length) secs.push(cur); };

    // cabeçalho de dados (--- chave: valor ---) vira etiquetas
    if (lines[0] && lines[0].trim() === '---') {
      const end = lines.indexOf('---', 1);
      if (end > 0 && end < 40) {
        meta = lines.slice(1, end).filter((l) => l.includes(':')).map((l) => { const k = l.slice(0, l.indexOf(':')).trim(), v = l.slice(l.indexOf(':') + 1).trim().replace(/^["[]|["\]]$/g, ''); return v ? `<span class="rd-tag"><b>${esc(k)}</b> ${esc(v)}</span>` : ''; }).join('');
        i = end + 1;
      }
    }
    let para = [];
    const flush = () => { if (para.length) { cur.out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };

    while (i < lines.length) {
      const l = lines[i], t = l.trim();
      let m;
      if (/^```/.test(t)) {
        flush(); const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
        i++; codes.push(buf.join('\n'));
        cur.out.push(`<div class="rd-code"><button class="btn sm" data-code="${codes.length - 1}">📋 Copiar</button><pre>${esc(buf.join('\n'))}</pre></div>`);
        continue;
      }
      if ((m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(t))) {
        flush();
        if (m[1].length <= 2) { push(); cur = { title: m[2], level: m[1].length, out: [] }; }
        else cur.out.push(`<h4>${inline(m[2])}</h4>`);
        i++; continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); cur.out.push('<hr>'); i++; continue; }
      if (/^>/.test(t)) {
        flush(); const buf = [];
        while (i < lines.length && /^>/.test(lines[i].trim())) buf.push(lines[i++].trim().replace(/^>\s?/, ''));
        cur.out.push('<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>'); continue;
      }
      if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) && lines[i + 1].includes('-')) {
        flush();
        const row = (x) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = row(t); i += 2; const body = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) body.push(row(lines[i++]));
        cur.out.push(`<div class="rd-tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^([-*+•]|\d+[.)])\s+/.test(t)) {
        flush(); const ord = /^\d/.test(t); const items = [];
        while (i < lines.length && (/^\s*([-*+•]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
          const x = lines[i];
          if (/^\s*([-*+•]|\d+[.)])\s+/.test(x)) {
            const depth = Math.min(3, Math.floor(x.match(/^\s*/)[0].replace(/\t/g, '  ').length / 2));
            let txt = x.trim().replace(/^([-*+•]|\d+[.)])\s+/, ''), box = '';
            const c = /^\[([ xX])\]\s+/.exec(txt);
            if (c) { box = `<span class="rd-box ${c[1] === ' ' ? '' : 'on'}">${c[1] === ' ' ? '' : '✓'}</span>`; txt = txt.slice(c[0].length); }
            items.push(`<li style="margin-left:${depth * 18}px" class="${box ? 'chk' : ''} ${depth ? 'sub' : ''}">${box}<span>${inline(txt)}</span></li>`);
          } else items[items.length - 1] = items[items.length - 1].replace(/<\/span><\/li>$/, ' ' + inline(x.trim()) + '</span></li>');
          i++;
        }
        cur.out.push(`<${ord ? 'ol' : 'ul'}>${items.join('')}</${ord ? 'ol' : 'ul'}>`); continue;
      }
      if (!t) { flush(); i++; continue; }
      // texto puro: linha curta em MAIÚSCULAS ou terminada em ":" seguida de conteúdo vira subtítulo
      if (!para.length && t.length <= 60 && /[A-ZÀ-Ú]/.test(t) && t === t.toUpperCase() && !/[.!?]$/.test(t)) { cur.out.push(`<h4>${inline(t)}</h4>`); i++; continue; }
      para.push(t); i++;
    }
    flush(); push();

    const html = (meta ? `<div class="rd-meta">${meta}</div>` : '') + secs.map((s, n) =>
      `<section class="rd-b ${s.level === 1 ? 'h1' : ''}" style="--n:${n}">${s.title ? `<h3>${inline(s.title)}</h3>` : ''}${s.out.join('')}</section>`).join('');
    return { html: `<div class="reader">${html || '<p style="color:var(--faint)">Arquivo vazio.</p>'}</div>`, codes };
  };

  // janela de leitura (tela grande)
  M.openReader = async (att) => {
    let text = '';
    try {
      const buf = await (await fetch('/anexos/' + encodeURIComponent(att.file))).arrayBuffer();
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { text = new TextDecoder('windows-1252').decode(buf); }   // .txt antigo do Windows
      text = text.replace(/^﻿/, '');
    } catch (e) { return M.toast('⚠️ Não consegui abrir o arquivo.'); }
    const { html, codes } = M.md(text);
    const palavras = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el = document.createElement('div');
    el.className = 'rd-full';
    el.innerHTML = `<div class="rd-bar"><span style="font-size:20px">📖</span><b>${esc(att.name)}</b><small>${palavras} palavras · ~${Math.max(1, Math.round(palavras / 200))} min de leitura</small><span style="flex:1"></span><button class="btn sm ghost" data-a="copy">📋 Copiar tudo</button><button class="btn sm ghost" data-a="raw">{ } Ver original</button><button class="icon-btn" data-a="x" title="Fechar (Esc)">✕</button></div><div class="rd-scroll">${html}</div>`;
    document.body.appendChild(el);
    SFX.play('open');
    let raw = false;
    const close = () => { el.remove(); document.removeEventListener('keydown', key, true); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    const copy = (t) => { navigator.clipboard.writeText(t).then(() => { SFX.play('copy'); M.toast('📋 Copiado!'); }).catch(() => {}); };
    el.onclick = (e) => {
      const b = e.target.closest('[data-a],[data-code]'); if (!b) return;
      if (b.dataset.code != null) return copy(codes[+b.dataset.code]);
      if (b.dataset.a === 'x') close();
      else if (b.dataset.a === 'copy') copy(text);
      else if (b.dataset.a === 'raw') { raw = !raw; el.querySelector('.rd-scroll').innerHTML = raw ? `<div class="reader"><div class="rd-code"><pre>${esc(text)}</pre></div></div>` : html; b.textContent = raw ? '📖 Ver em blocos' : '{ } Ver original'; }
    };
  };
  M.isText = (name) => /\.(md|markdown|txt)$/i.test(name || '');
})();
