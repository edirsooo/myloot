# Tira os prints das novidades (docs/img/novidades) num servidor de TESTE com dados de exemplo, e confere as telas:
# erros de JavaScript, barra de rolagem lateral, dica "?" dentro da janela e tutorial alinhado com letras grandes.
# Uso: suba um servidor de teste (MYLOOT_PORT=4331 MYLOOT_DATA=<pasta vazia> node server.js) e rode  python _ferramentas/prints_novidades.py
import asyncio, os, sys, json
from playwright.async_api import async_playwright
URL = os.environ.get('MYLOOT_URL', 'http://127.0.0.1:4331/')
SAIDA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'img', 'novidades'); os.makedirs(SAIDA, exist_ok=True)
Z = 'await new Promise(r => setTimeout(r, %d));'

DADOS = r"""
async () => {
  SFX.play = () => {}; FX.burst = () => {}; FX.rain = () => {};
  const d = M.db, s = d.settings, hoje = M.today(), ym = hoje.slice(0, 7);
  Object.assign(s, { theme: 'dark', themeAuto: false, sounds: false, confetti: false, aiSetupDone: true, tourOff: true, tour: {}, fontScale: 1 });
  const mes = (n) => { const [y, m] = ym.split('-').map(Number); const x = new Date(y, m - 1 + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const C = (id, nome, empresa, status, o) => Object.assign({ id, nome, empresa, status, email: '', whats: '', insta: '', site: '', trello: '', pasta: '', notas: '', tags: [], created: Date.now(), updated: Date.now() }, o);
  d.clients = [
    C('c1', 'Padaria Pão Quente', 'João Ferreira', 'ativo', { whats: '(11) 98888-0001', email: 'contato@paoquente.com.br', insta: '@paoquente', trello: 'https://trello.com/b/exemplo', pasta: 'D:\\Clientes\\Pão Quente', tags: ['social-media', 'mensal'], notas: '3 posts e 5 stories por semana. Aprovação às terças.' }),
    C('c2', 'Studio Bella', 'Marina Costa', 'ativo', { whats: '(11) 97777-0002', insta: '@studiobella', site: 'studiobella.com.br', tags: ['identidade-visual'] }),
    C('c3', 'Clínica Sorriso', 'Dr. Paulo Lima', 'prospect', { whats: '(11) 96666-0003', email: 'paulo@clinicasorriso.com.br', tags: ['site'] }),
    C('c4', 'Loja Verde Vivo', 'Ana Souza', 'prospect', { insta: '@verdevivo' }),
    C('c5', 'Academia Pulse', 'Rafael Dias', 'pausado', { whats: '(11) 95555-0005', insta: '@academiapulse' }),
  ];
  d.tasks = d.tasks.filter((t) => !/^(pt|tk)/.test(t.id));
  d.tasks.push({ id: 'pt1', text: 'Postar carrossel da Padaria', date: hoje, hora: '18:00', rep: 'semana', prio: 'alta', done: false, client: 'c1', created: Date.now() },
    { id: 'pt2', text: 'Enviar proposta para a Clínica Sorriso', date: M.addDays(hoje, 1), hora: '10:00', rep: '', prio: 'media', done: false, client: 'c3', created: Date.now() },
    { id: 'pt3', text: 'Relatório mensal da Padaria', date: M.addDays(hoje, 4), hora: '', rep: 'mes', prio: 'media', done: false, client: 'c1', created: Date.now() });
  const brief = d.items.find((i) => /Briefing — Social Media/.test(i.title)); if (brief) brief.client = 'c1';
  const contr = d.items.find((i) => /Contrato — Gestão/.test(i.title)); if (contr) contr.client = 'c1';
  const F = (id, tipo, desc, valor, data, pago, cat, o) => Object.assign({ id, tipo, desc, valor, data, pago, pagoEm: pago ? data : '', cat, client: '', forma: 'PIX', serie: '', parc: '', obs: '' }, o);
  d.fin = [];
  for (let n = -5; n <= 0; n++) {
    const m = mes(n), atual = n === 0, k = 6 + n;
    d.fin.push(F('e1' + n, 'entrada', 'Mensalidade Padaria Pão Quente', 1200, m + '-05', true, 'Serviço / cliente', { client: 'c1', serie: 's1' }));
    d.fin.push(F('e2' + n, 'entrada', 'Mensalidade Studio Bella', 850 + k * 40, m + '-10', !atual || hoje.slice(8) >= '10', 'Serviço / cliente', { client: 'c2', serie: 's2' }));
    if (n > -4) d.fin.push(F('e3' + n, 'entrada', 'Projeto de identidade visual', 600 + k * 150, m + '-18', !atual, 'Serviço / cliente', { client: 'c2', forma: 'Boleto' }));
    d.fin.push(F('s1' + n, 'saida', 'Ferramentas de design (assinaturas)', 185, m + '-08', true, 'Ferramentas e assinaturas', { forma: 'Cartão', serie: 's3' }));
    d.fin.push(F('s2' + n, 'saida', 'DAS do MEI', 81.9, m + '-20', !atual, 'Impostos e taxas', { forma: 'Boleto', serie: 's4' }));
    d.fin.push(F('s3' + n, 'saida', 'Internet e celular', 159.9, m + '-12', true, 'Casa e contas', { serie: 's5' }));
    d.fin.push(F('s4' + n, 'saida', 'Anúncios (verba própria)', 150 + k * 25, m + '-15', !atual || hoje.slice(8) >= '15', 'Anúncios e marketing', { forma: 'Cartão' }));
  }
  d.fin.push(F('p1', 'saida', 'Notebook novo', 583.33, ym + '-22', false, 'Equipamentos', { forma: 'Cartão', serie: 's6', parc: '2/6' }));
  d.fin.push(F('e9', 'entrada', 'Site Clínica Sorriso (entrada 50%)', 1750, ym + '-25', false, 'Serviço / cliente', { client: 'c3' }));
  await M.api('/api/db', { method: 'PUT', body: JSON.stringify(d) });
  return [d.clients.length, d.fin.length];
}
"""

async def main():
    erros, avisos = [], []
    async with async_playwright() as p:
        nav = await p.chromium.launch(channel='chrome')
        ctx = await nav.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1.5, color_scheme='dark')
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: erros.append('JS: ' + str(e)))
        pg.on('console', lambda m: erros.append('console: ' + m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        await pg.goto(URL); await pg.wait_for_timeout(1800)
        await pg.evaluate("M.closeModal()")
        print('dados', await pg.evaluate(DADOS))
        await pg.reload(); await pg.wait_for_timeout(1500)
        E = lambda js: pg.evaluate(f"(async () => {{ {js} }})()")
        await E("SFX.play = () => {}; FX.burst = () => {}; M.closeModal();")
        async def foto(nome, sel=None, margem=14):
            arq = os.path.join(SAIDA, nome + '.png')
            if sel:
                b = await pg.locator(sel).first.bounding_box()
                clip = dict(x=max(0, b['x'] - margem), y=max(0, b['y'] - margem), width=min(1440, b['width'] + 2 * margem), height=min(900 - max(0, b['y'] - margem), b['height'] + 2 * margem))
                await pg.screenshot(path=arq, clip=clip)
            else: await pg.screenshot(path=arq)
            print('  print', nome)

        # 1) novidades da versão
        await E("M.db.settings.versaoVista = '2.3.0'; await M.mostrarNovidades();" + Z % 1600)
        await foto('01-novidades', '#overlay .modal', 26); await E("M.closeModal()")
        # 2) "usar no celular" saiu na 2.28 (sem print)
        await E("await M.api('/api/rede', { method: 'POST', body: JSON.stringify({ on: false }) });" + Z % 800)
        # 3) clientes
        await E("M.go('clients');" + Z % 600); await foto('03-clientes')
        await E("document.querySelector('#cliV [data-v=funil]').click();" + Z % 500); await foto('04-clientes-funil')
        await E("document.querySelector('#cliV [data-v=cards]').click(); M.openClient('c1');" + Z % 600); await foto('05-ficha-do-cliente')
        await E("M.closeModal()")
        # 4) financeiro
        await E("M.go('fin');" + Z % 700); await foto('06-financeiro')
        await E("M.calcPreco();" + Z % 500); await foto('07-calculadora-de-preco', '#overlay .modal', 26); await E("M.closeModal()")
        # 5) kits e dica de IA
        await E("M.ui.cat = 'c-negocio'; M.db.settings.view = 'grid'; M.go('lib');" + Z % 600); await foto('08-kit-do-negocio')
        await E("M.ui.cat = ''; const it = M.db.items.find(i => /Briefing — Social Media/.test(i.title)); M.openItem(it.id);" + Z % 500 + "document.querySelector('.dica-ia').scrollIntoView({ block: 'center' });" + Z % 400)
        await foto('09-dica-personalizar-com-ia'); await E("M.closeModal()")
        # 6) tarefas: repetir e lembrete
        await E("M.go('tasks');" + Z % 400 + "M.editTask(M.db.tasks.find(t => t.id === 'pt1'));" + Z % 500); await foto('10-tarefa-repetir-e-lembrete', '#overlay .modal', 26); await E("M.closeModal()")
        # 7) tutorial
        await E("M.db.settings.tourOff = false; M.go('home');" + Z % 600 + "M.tour('home'); document.querySelector('.tour-card [data-a=vai]').click(); document.querySelector('.tour-card [data-a=vai]').click();" + Z % 700)
        await foto('11-tutorial-guiado')

        # ---------- conferências ----------
        # tutorial com "letras grandes" (escala 1,25): o destaque tem de cair em cima do alvo
        await E("document.querySelector('.tour-card [data-a=pular]').click(); M.db.settings.tourOff = false; M.db.settings.fontScale = 1.25; M.applySettings(); M.go('home');" + Z % 500 + "M.tour('home'); document.querySelector('.tour-card [data-a=vai]').click(); document.querySelector('.tour-card [data-a=vai]').click();" + Z % 700)
        dif = await E("const a = document.querySelector('.qc').getBoundingClientRect(), f = document.querySelector('.tour-foco').getBoundingClientRect(); return [Math.round(a.left - f.left), Math.round(a.top - f.top), Math.round(f.right - a.right), Math.round(f.bottom - a.bottom)];")
        if any(abs(v) > 14 for v in dif): avisos.append(f'tutorial desalinhado com letras grandes: {dif}')
        await E("document.querySelector('.tour-card [data-a=pular]').click(); M.db.settings.fontScale = 1; M.applySettings();")
        # dica "?" perto das bordas
        await E("M.go('cfg');" + Z % 800)
        fora = await E("""const r = []; for (const h of document.querySelectorAll('#view .hint')) { h.scrollIntoView({ block: 'center' }); h.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            const d = document.querySelector('#dica').getBoundingClientRect(); if (d.left < 0 || d.top < 0 || d.right > innerWidth || d.bottom > innerHeight) r.push(h.dataset.tip.slice(0, 30)); h.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); } return r;""")
        if fora: avisos.append(f'dica fora da janela: {fora}')
        # rolagem lateral, no computador e no celular
        PAGS = ['home', 'lib', 'tasks', 'cal', 'clients', 'fin', 'tools', 'ach', 'trash', 'cfg']
        for larg, alt, nome in ((1440, 900, 'computador'), (1024, 700, 'notebook pequeno'), (390, 844, 'celular')):
            await pg.set_viewport_size({'width': larg, 'height': alt})
            for pgn in PAGS:
                sobra = await E(f"M.db.settings.view = 'grid'; M.go('{pgn}');" + Z % 350 + "const v = document.querySelector('#view'), n = document.querySelector('#nav'); return [v.scrollWidth - v.clientWidth, document.documentElement.scrollWidth - innerWidth, n.scrollWidth - n.clientWidth];")
                if any(x > 1 for x in sobra): avisos.append(f'rolagem lateral em {pgn} ({nome}): {sobra}')
        # 8) celular
        await pg.set_viewport_size({'width': 390, 'height': 844})
        await E("M.go('home');" + Z % 700); await foto('12-celular-inicio')
        await E("M.go('clients');" + Z % 500); await foto('13-celular-clientes')
        await E("M.go('fin');" + Z % 600); await foto('14-celular-financeiro')
        await nav.close()
    print('ERROS:', erros or 'nenhum'); print('AVISOS:', avisos or 'nenhum')

asyncio.run(main())
