// Atualização do MyLoot pelo GitHub: compara versao.json local com o do repositório,
// baixa o ZIP da main e copia por cima, sem tocar em data/ (itens, anexos, chaves) nem em .git/.
// Em pasta clonada com Git, usa "git pull --ff-only".
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const REPO = 'edirsooo/myloot';
const URL_VERSAO = `https://raw.githubusercontent.com/${REPO}/main/versao.json`;
const URL_ZIP = `https://codeload.github.com/${REPO}/zip/refs/heads/main`;

function baixar(url, destino, voltas = 0) {
  return new Promise((ok, no) => {
    const rq = https.get(url, { headers: { 'User-Agent': 'MyLoot', 'Cache-Control': 'no-cache' }, timeout: 60000 }, (rs) => {
      if ([301, 302, 303, 307, 308].includes(rs.statusCode) && rs.headers.location && voltas < 5) { rs.resume(); return ok(baixar(new URL(rs.headers.location, url).href, destino, voltas + 1)); }
      if (rs.statusCode !== 200) { rs.resume(); return no(new Error('O GitHub respondeu ' + rs.statusCode + '.')); }
      if (destino) { const f = fs.createWriteStream(destino); rs.pipe(f); f.on('finish', () => f.close(() => ok(destino))); f.on('error', no); }
      else { const p = []; rs.on('data', (c) => p.push(c)); rs.on('end', () => ok(Buffer.concat(p).toString('utf8'))); }
    });
    rq.on('timeout', () => rq.destroy(new Error('Demorou demais para falar com o GitHub.')));
    rq.on('error', (e) => no(new Error(e.code === 'ENOTFOUND' ? 'Sem internet.' : e.message)));
  });
}

const num = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
function maior(a, b) { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }

function local(ROOT) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'versao.json'), 'utf8').replace(/^\uFEFF/, '')); } catch (_) { return { versao: '0.0.0' }; } }

let cache = null;
async function checar(ROOT, forcar) {
  if (cache && !forcar && Date.now() - cache.em < 50 * 60e3) return cache.r; // guarda a resposta por 50 min (o app pergunta de hora em hora)
  const loc = local(ROOT);
  let rem;
  try { rem = JSON.parse((await baixar(URL_VERSAO + '?t=' + Date.now())).replace(/^\uFEFF/, '')); } catch (e) { return { atual: loc.versao, erro: e.message }; }
  const r = { atual: loc.versao, nova: rem.versao, temNova: maior(rem.versao, loc.versao), novidades: rem.novidades || [], historico: rem.historico || {}, data: rem.data || '', git: fs.existsSync(path.join(ROOT, '.git')) };
  cache = { em: Date.now(), r };
  return r;
}

// extrai o ZIP: PowerShell no Windows; unzip ou tar (bsdtar lê .zip) no Mac e no Linux
function extrair(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const o = { windowsHide: true, timeout: 180000, stdio: 'ignore' };
  if (process.platform === 'win32') {
    return cp.execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`], o);
  }
  try { cp.execFileSync('unzip', ['-q', '-o', zip, '-d', dest], o); }
  catch (_) {
    try { cp.execFileSync('tar', ['-xf', zip, '-C', dest], o); }
    catch (e) { throw new Error('Não consegui extrair o ZIP. Instale o "unzip" (ex.: sudo apt install unzip) e tente de novo.'); }
  }
}

// copia a pasta nova por cima; nunca apaga nada e pula data/ e .git/
function copiar(de, para) {
  for (const nome of fs.readdirSync(de)) {
    if (nome === 'data' || nome === '.git') continue;
    const a = path.join(de, nome), b = path.join(para, nome);
    if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); copiar(a, b); }
    else {
      fs.copyFileSync(a, b);
      if (/\.(sh|command)$/.test(nome)) { try { fs.chmodSync(b, 0o755); } catch (_) {} } // atalhos do Mac/Linux continuam executáveis
    }
  }
}

// pasta clonada com Git (é o que as IAs fazem ao instalar): atualiza com "git pull", sem misturar com o ZIP
// sem travar o servidor (execFile assíncrono) e sem nunca pedir senha no terminal escondido
function git(ROOT, args) {
  return new Promise((ok, no) => cp.execFile('git', args, { cwd: ROOT, windowsHide: true, timeout: 120000, encoding: 'utf8', env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }) },
    (e, out, err) => (e ? no(Object.assign(e, { stderr: err })) : ok(String(out || '')))));
}
const ultimaLinha = (e) => String((e && (e.stderr || e.message)) || '').trim().split('\n').pop().slice(0, 140);
async function aplicarGit(ROOT) {
  const PEDIR = ' Peça para a sua IA: "Atualize o MyLoot nesta pasta com git pull, sem mexer na pasta data".';
  // pasta do Git sem o programa git: o ZIP sujaria a pasta e o próximo git pull recusaria para sempre
  try { await git(ROOT, ['--version']); } catch (_) { throw new Error('Esta pasta foi instalada com o Git, mas o programa git não foi encontrado.' + PEDIR); }
  let ramo = '', sujo = '';
  try { ramo = (await git(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim(); sujo = (await git(ROOT, ['status', '--porcelain', '--untracked-files=no'])).trim(); }
  catch (e) { throw new Error('O Git não conseguiu ler esta pasta (' + ultimaLinha(e) + ').' + PEDIR); }
  if (ramo !== 'main') throw new Error('Esta pasta está no ramo "' + ramo + '", não no "main", então não atualizei.' + PEDIR);
  if (sujo) throw new Error('Há arquivos do app alterados nesta pasta, então não atualizei para não apagar nada.' + PEDIR);
  try { await git(ROOT, ['pull', '--ff-only', 'origin', 'main']); }
  catch (e) { throw new Error('O "git pull" não conseguiu atualizar (' + ultimaLinha(e) + ').' + PEDIR); }
}

async function aplicar(ROOT) {
  if (fs.existsSync(path.join(ROOT, '.git'))) { await aplicarGit(ROOT); cache = null; return local(ROOT).versao; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myloot-atualizacao-'));
  const zip = path.join(tmp, 'myloot.zip');
  await baixar(URL_ZIP, zip);
  const dest = path.join(tmp, 'novo');
  extrair(zip, dest);
  const raiz = fs.readdirSync(dest).map((n) => path.join(dest, n)).find((p) => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'server.js')));
  if (!raiz) throw new Error('O pacote baixado veio estranho (sem server.js). Nada foi trocado.');
  copiar(raiz, ROOT);
  cache = null;
  return local(ROOT).versao;
}

// reabre o servidor depois de sair (a porta precisa ficar livre antes)
function reiniciar(ROOT) {
  const js = `setTimeout(()=>{require('child_process').spawn(process.execPath,['server.js'],{cwd:${JSON.stringify(ROOT)},detached:true,stdio:'ignore',windowsHide:true}).unref()},1500)`;
  cp.spawn(process.execPath, ['-e', js], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => process.exit(0), 300);
}

module.exports = { checar, aplicar, reiniciar, local };
