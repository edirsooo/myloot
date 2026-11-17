# Gera os PDFs dos materiais (exemplos/kit/*.pdf) com a identidade dos guias da Prestes Design:
# capa escura, Poppins, "by Prestes Design", marca d'água em todas as páginas e link clicável no rodapé.
# Uso:  python _ferramentas/pdfs.py [parte do título]     (depois roda sozinho o kits.py para ligar os PDFs aos itens)
# Precisa de: playwright (com o Chrome), pymupdf e Pillow.
import os, re, sys, html, base64, io, asyncio
from PIL import Image
import pymupdf
from playwright.async_api import async_playwright
import kits

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
SAIDA = os.path.join(RAIZ, 'exemplos', 'kit'); os.makedirs(SAIDA, exist_ok=True)
MARCA = os.path.join(AQUI, 'marca')
SITE = 'https://prestesdesign.com.br'
FONTES = r'E:\.EDIÇÃO COM IA\4 - Fontes\Poppins'
LARANJA, CIANO = '#ff7e00', '#19c2f0'

def b64(caminho): return base64.b64encode(open(caminho, 'rb').read()).decode()
def fontes_css():
    return ''.join(f"@font-face{{font-family:Poppins;font-weight:{p};src:url(data:font/ttf;base64,{b64(os.path.join(FONTES, f'Poppins-{n}.ttf'))})}}"
                   for n, p in [('Regular', 400), ('Medium', 500), ('SemiBold', 600), ('Bold', 700), ('ExtraBold', 800)])
LOGO = 'data:image/png;base64,' + b64(os.path.join(MARCA, 'prestes-logo.png'))
SIMBOLO = 'data:image/png;base64,' + b64(os.path.join(MARCA, 'prestes-simbolo.png'))
BAU = 'data:image/png;base64,' + b64(os.path.join(RAIZ, 'public', 'icon.png'))

# marca d'água: logo completo, bem claro e inclinado, no meio de cada página
def marca_dagua():
    im = Image.open(os.path.join(MARCA, 'prestes-logo.png')).convert('RGBA')
    im = im.resize((520, round(520 * im.height / im.width)), Image.LANCZOS).rotate(28, expand=True, resample=Image.BICUBIC)
    r, g, b, a = im.split(); a = a.point(lambda v: int(v * 0.075))
    buf = io.BytesIO(); Image.merge('RGBA', (r, g, b, a)).save(buf, 'PNG'); return buf.getvalue(), im.size
AGUA, AGUA_T = marca_dagua()

E = html.escape
def rico(s):  # [campo a preencher] em destaque
    return re.sub(r'\[([^\]]*)\]', lambda m: f'<span class="ph">{m.group(1).strip() or "&nbsp;" * 12}</span>', E(s))
def MAIUSC(s):
    t = re.sub(r'\[[^\]]*\]|\([^)]*\)', '', s)
    return len(re.findall(r'[A-Za-zÀ-ÿ]', t)) >= 3 and not re.search(r'[a-zà-ÿ]', t)

def corpo(it, tipo):
    L, out, i = it['conteudo'].split('\n'), [], 0
    lin = lambda n=2: '<div class="lin"></div>' * n
    while i < len(L):
        s = L[i].strip(); i += 1
        if not s: continue
        if '_____' in s:
            nomes = re.split(r'\s{2,}', L[i].strip()) if i < len(L) else ['', '']; i += 1
            out.append('<div class="sig">' + ''.join(f'<div><i></i>{E(n)}</div>' for n in nomes[:2]) + '</div>'); continue
        if s.startswith('Atenção:') or s.startswith('Dica') or s.startswith('(As informações'):
            out.append(f'<div class="nota">{rico(s)}</div>'); continue
        if ' | ' in s:
            rows = [s]
            while i < len(L) and ' | ' in L[i]: rows.append(L[i].strip()); i += 1
            out.append('<table>' + ''.join('<tr>' + ''.join(f'<{"th" if k == 0 else "td"}>{rico(c)}</{"th" if k == 0 else "td"}>' for c in r.split(' | ')) + '</tr>' for k, r in enumerate(rows)) + '</table>'); continue
        if '( )' in s:
            antes, *ops = s.split('( )')
            chips = '<div class="ops">' + ''.join(f'<span><i></i>{rico(o.strip())}</span>' for o in ops if o.strip()) + '</div>'
            mq = re.match(r'^(\d+)[.)]\s*(.*)$', antes.strip())
            if mq: out.append(f'<div class="q"><span>{mq.group(1)}</span><div><p>{rico(mq.group(2))}</p>{chips}</div></div>')
            else: out.append((f'<p class="perg">{rico(antes.strip())}</p>' if antes.strip() else '') + chips)
            continue
        if MAIUSC(s):
            out.append(f'<h2>{rico(re.sub(r"^[0-9]+[.)]\s*", "", s))}</h2>' if len(s) < 70 else f'<h1 class="tit">{rico(s)}</h1>'); continue
        if s.startswith('- '):
            its = [s[2:]]
            while i < len(L) and L[i].strip().startswith('- '): its.append(L[i].strip()[2:]); i += 1
            out.append('<ul>' + ''.join(f'<li>{rico(x)}</li>' for x in its) + '</ul>'); continue
        m = re.match(r'^(\d+\.\d+\.)\s*(.*)$', s)
        if m: out.append(f'<p class="cl"><b>{m.group(1)}</b> {rico(m.group(2))}</p>'); continue
        m = re.match(r'^([a-z]\))\s*(.*)$', s)
        if m: out.append(f'<p class="sub"><b>{m.group(1)}</b> {rico(m.group(2))}</p>'); continue
        m = re.match(r'^(\d+)[.)]\s*(.*)$', s)
        if m:
            aberta = tipo == 'form' and '___' not in m.group(2)
            out.append(f'<div class="q"><span>{m.group(1)}</span><div><p>{rico(m.group(2))}</p>{lin(2 if m.group(2) else 1) if aberta else ""}</div></div>'); continue
        if tipo == 'msgs': out.append(f'<div class="bolha">{rico(s)}</div>'); continue
        if tipo == 'form' and s.endswith(':') and len(s) < 70: out.append(f'<div class="campo"><span>{rico(s)}</span><i></i></div>'); continue
        if tipo == 'form' and s.endswith('?'): out.append(f'<p class="perg">{rico(s)}</p>{lin()}'); continue
        out.append(f'<p>{rico(s)}</p>')
    if it.get('checklist'):
        out.append('<div class="chk"><h3>Checklist</h3>' + ''.join(f'<div><i></i>{rico(c)}</div>' for c in it['checklist']) + '</div>')
    out.append(f'<div class="fim"><img src="{BAU}"><div><b>Este material faz parte do MyLoot</b>, o app gratuito da Prestes Design para guardar tudo num lugar só: clientes, tarefas, materiais e o financeiro.<br><a href="{SITE}">prestesdesign.com.br</a> · <a href="https://github.com/edirsooo/myloot">github.com/edirsooo/myloot</a></div></div>')
    return '\n'.join(out)

CSS = fontes_css() + f"""
*{{box-sizing:border-box}} html,body{{margin:0;font-family:Poppins,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.capa{{width:210mm;height:297mm;background:#090c16;color:#fff;position:relative;overflow:hidden;padding:0 20mm}}
.capa::before{{content:"";position:absolute;right:-60mm;top:-40mm;width:170mm;height:170mm;border-radius:50%;background:radial-gradient(closest-side,rgba(255,126,0,.20),transparent)}}
.capa::after{{content:"";position:absolute;left:-70mm;bottom:-70mm;width:190mm;height:190mm;border-radius:50%;background:radial-gradient(closest-side,rgba(25,194,240,.13),transparent)}}
.by{{position:absolute;right:16mm;top:11mm;font:600 9pt Poppins;color:#c9cfe6;display:flex;align-items:center;gap:6px;z-index:2;text-decoration:none}}
.by i{{width:7px;height:7px;background:{LARANJA};display:inline-block}}
.capa .simb{{position:absolute;right:-18mm;bottom:22mm;height:150mm;opacity:.10;z-index:1}}
.capa .meio{{position:absolute;left:20mm;right:20mm;top:104mm;z-index:2}}
.pil{{display:inline-block;border:1.2px solid {CIANO};color:{CIANO};border-radius:20px;padding:3px 14px;font:700 7.5pt Poppins;letter-spacing:2.2px;text-transform:uppercase}}
.capa h1{{font:800 31pt/1.12 Poppins;margin:9mm 0 6mm;letter-spacing:-.6px}} .capa h1 em{{font-style:normal;color:{CIANO}}}
.capa p{{font:400 12pt/1.6 Poppins;color:#aab2cf;max-width:135mm;margin:0}}
.capa .pe{{position:absolute;left:20mm;right:20mm;bottom:13mm;display:flex;justify-content:space-between;align-items:flex-end;font:400 8.5pt Poppins;color:#7f88a8;z-index:2}}
.capa .pe img{{height:15mm}} .capa .pe a{{color:{LARANJA};text-decoration:none;font-weight:600}}
.corpo{{color:#171a28;font:400 10.2pt/1.6 Poppins}}
h1.tit{{font:800 15pt/1.25 Poppins;margin:0 0 5mm;color:#0c1020}}
h2{{font:700 11.5pt/1.3 Poppins;margin:7mm 0 3mm;padding-left:9px;border-left:4px solid {LARANJA};color:#0c1020;break-after:avoid}}
p{{margin:0 0 2.6mm}} p.cl b,p.sub b{{color:{LARANJA}}} p.sub{{padding-left:6mm}} p.perg{{font-weight:600;margin-bottom:1.5mm;break-after:avoid}}
.ph{{background:#fff3e6;border-bottom:1.5px dashed {LARANJA};padding:0 4px;border-radius:3px;color:#a04d00;font-weight:500}}
ul{{margin:0 0 3mm;padding-left:5.5mm}} li{{margin-bottom:1.2mm}} li::marker{{color:{LARANJA}}}
.q{{display:flex;gap:3mm;margin-bottom:3mm;break-inside:avoid}} .q>span{{flex:none;width:6.5mm;height:6.5mm;border-radius:2mm;background:{LARANJA};color:#fff;font:700 8.5pt/6.5mm Poppins;text-align:center;margin-top:.4mm}}
.q>div{{flex:1}} .q p{{font-weight:600;margin-bottom:1mm}}
.lin{{border-bottom:1px solid #c5cad9;height:7.5mm}}
.campo{{display:flex;align-items:flex-end;gap:3mm;margin-bottom:2.5mm;break-inside:avoid}} .campo span{{font-weight:600;white-space:nowrap}} .campo i{{flex:1;border-bottom:1px solid #c5cad9;height:5mm}}
.ops{{display:flex;flex-wrap:wrap;gap:2mm 5mm;margin:0 0 3.5mm}} .ops span{{display:flex;align-items:center;gap:2mm}} .ops i,.chk i{{width:3.6mm;height:3.6mm;border:1.4px solid #6b7391;border-radius:1mm;flex:none;display:inline-block}}
.nota{{background:#f2f6ff;border-left:4px solid {CIANO};border-radius:0 3mm 3mm 0;padding:3mm 4mm;margin:4mm 0;font-size:9.3pt;color:#3a4160;break-inside:avoid}}
.bolha{{background:#eefbf0;border:1px solid #bfe8c6;border-radius:4mm 4mm 4mm 1mm;padding:3mm 4mm;margin:0 0 3mm;max-width:92%;break-inside:avoid}}
table{{width:100%;border-collapse:collapse;margin:0 0 4mm;font-size:9.3pt}} th,td{{border:1px solid #cfd4e2;padding:2mm 3mm;text-align:left;height:8mm}} th{{background:#fff3e6;font-weight:700}}
.chk{{border:1.5px solid {LARANJA};border-radius:4mm;padding:4mm 5mm;margin-top:6mm;break-inside:avoid}} .chk h3{{margin:0 0 2.5mm;font:700 10.5pt Poppins;color:{LARANJA}}} .chk div{{display:flex;gap:2.5mm;align-items:center;margin-bottom:1.6mm}}
.sig{{display:flex;gap:12mm;margin:14mm 0 4mm;break-inside:avoid}} .sig div{{flex:1;text-align:center;font:600 9pt Poppins}} .sig i{{display:block;border-top:1px solid #333;margin-bottom:2mm}}
.fim{{display:flex;gap:4mm;align-items:center;background:#090c16;color:#c9cfe6;border-radius:4mm;padding:4mm 5mm;margin-top:9mm;font-size:8.8pt;line-height:1.5;break-inside:avoid}}
.fim img{{width:13mm;height:13mm;border-radius:3mm;image-rendering:pixelated}} .fim b{{color:#fff}} .fim a{{color:{LARANJA};text-decoration:none;font-weight:600}}
"""

def capa_html(it, kit):
    t = it['titulo']
    a, _, b = t.partition(' — ') if ' — ' in t else t.partition(': ')
    tit = f'{E(a)}<br><em>{E(b)}</em>' if b else E(a)
    return f"""<!doctype html><meta charset="utf-8"><style>@page{{size:A4;margin:0}}{CSS}</style>
<div class="capa"><a class="by" href="{SITE}"><i></i>by Prestes Design</a><img class="simb" src="{SIMBOLO}">
<div class="meio"><span class="pil">{E(kit)}</span><h1>{tit}</h1><p>{E(it['descricao'])}</p></div>
<div class="pe"><span>Material do MyLoot · seu inventário pessoal</span><a href="{SITE}"><img src="{LOGO}"></a></div></div>"""

def corpo_html(it, tipo):
    return f'<!doctype html><meta charset="utf-8"><style>@page{{size:A4;margin:22mm 17mm 20mm}}{CSS}</style><div class="corpo">{corpo(it, tipo)}</div>'

def faixa(lado_esq, lado_dir, topo):
    return f"""<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;color:#7a8199;padding:0 17mm;display:flex;justify-content:space-between;align-items:center;{'margin-top:5mm' if topo else 'margin-bottom:4mm'}">
<span>{lado_esq}</span><span>{lado_dir}</span></div>"""

async def gerar(so=''):
    feitos = 0
    async with async_playwright() as p:
        nav = await p.chromium.launch(channel='chrome'); pg = await nav.new_page()
        for arq, pac in kits.PACOTES.items():
            kit = pac['categoria']['name']
            for it in pac['itens']:
                if so and so.lower() not in it['titulo'].lower(): continue
                tipo = kits.tipo_pdf(it['titulo'])
                await pg.set_content(capa_html(it, kit), wait_until='load')
                capa = await pg.pdf(format='A4', print_background=True, margin=dict(top='0', bottom='0', left='0', right='0'))
                await pg.set_content(corpo_html(it, tipo), wait_until='load')
                corpo_pdf = await pg.pdf(format='A4', print_background=True, display_header_footer=True, prefer_css_page_size=True,
                    header_template=faixa(E(it['titulo']), '<span style="color:#ff7e00">■</span> <b style="color:#3a4160">by Prestes Design</b>', True),
                    footer_template=faixa('<b style="color:#ff7e00">prestesdesign.com.br</b> · feito com MyLoot', '<span class="pageNumber"></span> / <span class="totalPages"></span>', False))
                doc = pymupdf.open(stream=capa, filetype='pdf'); miolo = pymupdf.open(stream=corpo_pdf, filetype='pdf')
                for pagina in miolo:   # marca d'água por baixo do texto + links clicáveis no topo e no rodapé
                    W, H = pagina.rect.width, pagina.rect.height
                    w = W * 0.82; h = w * AGUA_T[1] / AGUA_T[0]
                    pagina.insert_image(pymupdf.Rect((W - w) / 2, (H - h) / 2, (W + w) / 2, (H + h) / 2), stream=AGUA, overlay=False)
                    for r in (pymupdf.Rect(40, H - 44, 260, H - 14), pymupdf.Rect(W - 190, 10, W - 40, 40)):
                        pagina.insert_link({'kind': pymupdf.LINK_URI, 'from': r, 'uri': SITE})
                doc.insert_pdf(miolo)
                doc.set_metadata({'title': f"{it['titulo']} · MyLoot", 'author': 'Prestes Design', 'subject': it['descricao'], 'keywords': 'MyLoot, Prestes Design, ' + ', '.join(it['etiquetas']), 'creator': 'MyLoot (prestesdesign.com.br)', 'producer': 'Prestes Design'})
                destino = os.path.join(SAIDA, kits.nome_pdf(it['titulo']))
                doc.save(destino + '.novo', garbage=4, deflate=True); doc.close(); miolo.close()
                os.replace(destino + '.novo', destino)
                feitos += 1; print(f'{os.path.getsize(destino) // 1024:5d} KB  {os.path.basename(destino)}')
        await nav.close()
    print(feitos, 'PDFs em', SAIDA)

if __name__ == '__main__':
    asyncio.run(gerar(sys.argv[1] if len(sys.argv) > 1 else ''))
    kits.gravar()
