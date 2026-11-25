# Prints das telas do site (docs/site/telas/*.webp, 1600x900) num servidor de TESTE com dados de exemplo.
# Uso: servidor de teste em 4331 com pasta de dados VAZIA (MYLOOT_PORT=4331 MYLOOT_DATA=<pasta vazia> node server.js), uma vez só por pasta,
# e depois  python _ferramentas/prints_site.py [pasta de saída]  (padrão: docs/site/telas). Depois suba TELAS_V no site.js e o ?v= das imagens no index.html.
import asyncio, os, sys, re
from playwright.async_api import async_playwright
from PIL import Image
URL = 'http://127.0.0.1:4331/'
SAIDA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'site', 'telas'); os.makedirs(SAIDA, exist_ok=True)
import getpass, socket
PESSOAL = '|'.join(re.escape(x) for x in {getpass.getuser(), socket.gethostname()} if len(x) > 2)  # nome do usuário e do computador não podem aparecer
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prints_novidades.py'), encoding='utf-8').read()
DADOS = re.search(r'DADOS = r"""(.*?)"""', src, re.S).group(1)
Z = lambda ms: f'await new Promise(r => setTimeout(r, {ms}));'

EXTRA = r"""
async () => {
  const d = M.db, hoje = M.today(), dia = (n) => M.addDays(hoje, n);
  d.tasks.push(
    { id: 'tk1', text: 'Responder os e-mails', date: hoje, hora: '', rep: 'dia', prio: 'media', done: false, created: Date.now() },
    { id: 'tk2', text: 'Reunião com a Ana', date: dia(1), hora: '14:00', rep: '', prio: 'alta', done: false, client: 'c4', created: Date.now() },
    { id: 'tk3', text: 'Ler 10 páginas', date: dia(2), hora: '', rep: 'dia', prio: 'baixa', done: false, created: Date.now() },
    { id: 'tk4', text: 'Gravar vídeo do Reels', date: dia(3), hora: '09:00', rep: '', prio: 'alta', done: false, created: Date.now() },
    { id: 'tk5', text: 'Atualizar portfólio', date: dia(-1), hora: '', rep: '', prio: 'media', done: true, doneAt: Date.now(), created: Date.now() },
    { id: 'tk6', text: 'Enviar nota fiscal', date: dia(-2), hora: '', rep: '', prio: 'media', done: true, doneAt: Date.now(), created: Date.now() });
  const log = (n) => { const o = {}; for (let i = 1; i <= n; i++) o[dia(-i)] = 1; return o; };
  d.habits = [
    { id: 'h1', em: '💧', nome: 'Beber água', freq: 'dia', dias: [], vezes: 1, alvo: 8, un: 'copos', hora: '', criado: dia(-20), log: Object.assign(log(9), { [hoje]: 5 }) },
    { id: 'h2', em: '📚', nome: 'Ler 20 minutos', freq: 'dia', dias: [], vezes: 1, alvo: 1, un: 'vez', hora: '21:00', criado: dia(-20), log: Object.assign(log(6), { [hoje]: 1 }) },
    { id: 'h3', em: '🏋️', nome: 'Treinar', freq: 'semana', dias: [1, 3, 5], vezes: 1, alvo: 1, un: 'vez', hora: '07:00', criado: dia(-20), log: log(4) },
  ];
  d.goals = [
    { id: 'g1', em: '💰', nome: 'Reserva de emergência', alvo: 10000, atual: 4600, un: 'R$', prazo: dia(120), criado: dia(-40), hist: [] },
    { id: 'g2', em: '🎬', nome: 'Publicar 30 Reels', alvo: 30, atual: 18, un: 'Reels', prazo: dia(40), criado: dia(-30), hist: [] },
  ];
  const g = d.game; g.xp = 265; g.streak = { last: hoje, count: 6 };
  for (let i = 0; i < 7; i++) g.log[dia(-i)] = { xp: [20, 35, 15, 40, 25, 50, 30][i], by: {} };
  Object.assign(g.counters, { task: 14, item: 9, focus: 3, goal: 1 });
  d.settings.nome = d.settings.nome || '';
  await M.api('/api/db', { method: 'PUT', body: JSON.stringify(d) });
  return [d.tasks.length, d.habits.length];
}
"""

async def main():
    erros, feitos = [], []
    async with async_playwright() as p:
        nav = await p.chromium.launch(channel='chrome')
        ctx = await nav.new_context(viewport={'width': 1600, 'height': 900}, device_scale_factor=1, color_scheme='dark')
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: erros.append('JS: ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        await pg.evaluate("M.closeModal && M.closeModal()")
        print('dados', await pg.evaluate(DADOS)); print('extra', await pg.evaluate(EXTRA))
        await pg.reload(); await pg.wait_for_timeout(2500)
        E = lambda js: pg.evaluate(f"(async () => {{ {js} }})()")
        await E("SFX.play = () => {}; FX.burst = () => {}; FX.rain = () => {}; M.closeModal(); const st = document.createElement('style'); st.textContent = '#pet,.pet-ola{display:none!important}'; document.head.appendChild(st);")
        async def limpa():
            await E("M.closeModal(); document.querySelectorAll('#ctx,#musPop').forEach(e => { e.hidden = true; }); document.querySelectorAll('.toast').forEach(e => e.remove()); document.activeElement && document.activeElement.blur();" + Z(250))
        async def foto(nome, js, ms=900, pos=None, manter_toast=False):
            try:
                await limpa(); await E(js + Z(ms))
                if pos: await pos()
                # nada pessoal no print: nome do computador, usuário do Windows
                await E("document.querySelectorAll('input').forEach(i => { if (RX.test(i.value)) i.value = 'Meu computador'; }); document.querySelectorAll('.toast').forEach(e => { if (!KEEP) e.remove(); });".replace('KEEP', 'true' if manter_toast else 'false').replace('RX', '/' + PESSOAL + '/i'))
                txt = await E("return document.body.innerText + [...document.querySelectorAll('input,textarea')].map(i => i.value).join(' ');")
                if re.search(PESSOAL + r'|@gmail|@hotmail|@outlook', txt, re.I): erros.append(nome + ': texto pessoal na tela')
                png = os.path.join(SAIDA, nome + '.png'); await pg.screenshot(path=png)
                Image.open(png).save(os.path.join(SAIDA, nome + '.webp'), 'WEBP', quality=84, method=6); os.replace(png, os.path.join(os.environ.get('TEMP', SAIDA), 'myloot-print-' + nome + '.png'))
                feitos.append(nome); print('ok', nome)
            except Exception as e:
                erros.append(f'{nome}: {e}'); print('ERRO', nome, e)
        cfg = lambda rx: f"M.go('cfg');{Z(700)} const b = [...document.querySelectorAll('#cfgMenu [data-s]')].find(x => /{rx}/i.test(x.textContent)); b && b.click();"
        brief = "M.db.items.find(i => /Briefing — Social Media/.test(i.title))"
        await foto('inicio', "M.go('home');", 1500)
        await foto('biblioteca', "M.ui.cat = ''; M.db.settings.view = 'grid'; M.go('lib');", 5000)
        async def digita(): await pg.keyboard.type('brief', delay=60); await pg.wait_for_timeout(700)
        await foto('busca', f"M.go('lib');{Z(500)} M.openSearch();", 500, pos=digita)
        await foto('ficha', f"M.go('lib');{Z(400)} M.openItem({brief}.id);")
        await foto('tarefas', "M.go('tasks');")
        await foto('calendario', "M.go('cal');")
        await foto('rotina', "M.go('rot');")
        await foto('foco', f"M.go('home');{Z(500)} M.focusToggle();")
        await foto('cliente', f"M.go('clients');{Z(500)} M.openClient('c4');")
        await foto('financeiro', "M.go('fin');", 1200)
        await foto('ia', f"M.go('lib');{Z(400)} const it = M.db.items.find(i => i.type === 'prompt'); M.openItem(it.id);{Z(600)} const b = [...document.querySelectorAll('#overlay button')].find(x => /Pedir à IA|IA/.test(x.textContent) && /🤖|✨/.test(x.textContent)); b && b.click();")
        await foto('ferramentas_rec', f"M.go('tools');{Z(400)} const a = document.querySelector('[data-aba=rec]'); a && a.click();")
        await foto('drive', cfg('Drive'))
        await foto('enviar', f"M.ui.cat = ''; M.ui.q = ''; M.db.settings.view = 'grid'; M.go('lib');{Z(900)} const c = document.querySelectorAll('#view [data-id]')[1]; const r = c.getBoundingClientRect(); M.itemMenu({{ preventDefault() {{}}, clientX: r.left + 150, clientY: r.top + 90 }}, M.db.items.find(i => i.id === c.dataset.id));", 600)
        await foto('conquistas', "M.go('ach');")
        await foto('mascote', cfg('Divers'))
        await foto('musica', f"M.go('home');{Z(600)} document.querySelector('#musBtn').click();")
        await foto('desfazer', f"M.go('tasks');{Z(500)} const t = [...document.querySelectorAll('#view .task, #view [data-id]')].find(x => /Responder os e-mails/.test(x.textContent)); const ck = t && t.querySelector('input[type=checkbox], .chk, [data-done], button'); ck && ck.click();", 700, manter_toast=True)
        await foto('historico', "M.hist.abrir();")
        await foto('lixeira', f"for (const it of M.db.items.filter(i => /Contrato|Roteiro de call|Debriefing/.test(i.title)).slice(0, 3)) M.paraLixeira('item', it); for (const t of M.db.tasks.filter(t => t.done).slice(0, 2)) M.paraLixeira('task', t); M.save(); M.go('trash');")
        await foto('backup', cfg('backup'))
        await foto('novidades', "M.db.settings.versaoVista = '2.28.0'; await M.mostrarNovidades();", 1800)
        await nav.close()
    print('FEITOS', len(feitos), feitos); print('ERROS', erros or 'nenhum')

asyncio.run(main())
