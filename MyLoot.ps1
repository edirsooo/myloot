# MyLoot no Windows: liga o servidor (se precisar), abre a janela própria (modo app do Edge/Chrome)
# e deixa o ícone na bandeja, perto do relógio. Rodado escondido pelo MyLoot.vbs (atalho da área de trabalho).
# Fechar a janela não desliga nada; quem desliga é "Fechar MyLoot" na bandeja ou o botão em Configurações.
param(
  [int]$Porta = 0,          # padrão: MYLOOT_PORT ou 4321
  [switch]$SemServidor,     # não liga o servidor, só espera (o "Abrir MyLoot.bat" liga no próprio console)
  [switch]$Navegador        # abre no navegador desta vez, sem olhar a preferência
)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Porta) { $Porta = if ($env:MYLOOT_PORT) { [int]$env:MYLOOT_PORT } else { 4321 } }
$env:MYLOOT_PORT = "$Porta"
$url = "http://127.0.0.1:$Porta/"

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Language CSharp -TypeDefinition @'
using System; using System.Collections.Generic; using System.Text; using System.Runtime.InteropServices;
public static class MyLootJanela {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  // janelas do modo app: classe do Chromium e título que termina em "MyLoot" (aba comum termina em "- Microsoft Edge" / "- Google Chrome")
  public static List<IntPtr> Achar(uint[] pids) {
    var set = new HashSet<uint>(pids); var r = new List<IntPtr>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); if (!set.Contains(pid)) return true;
      var c = new StringBuilder(64); GetClassName(h, c, 64); if (c.ToString() != "Chrome_WidgetWin_1") return true;
      var t = new StringBuilder(256); GetWindowText(h, t, 256); var s = t.ToString().Trim();
      if (s == "MyLoot" || s.EndsWith(" MyLoot")) r.Add(h);
      return true;
    }, IntPtr.Zero);
    return r;
  }
  public static void Mostrar(IntPtr h) { if (IsIconic(h)) ShowWindow(h, 9); SetForegroundWindow(h); }
  public static void Fechar(IntPtr h) { PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero); }
}
'@

function Aviso($texto) { [System.Windows.Forms.MessageBox]::Show($texto, 'MyLoot', 'OK', 'Warning') | Out-Null }

function Pedir($caminho, $metodo = 'GET', $espera = 800) {
  try {
    $r = [System.Net.HttpWebRequest]::Create($url + $caminho.TrimStart('/'))
    $r.Method = $metodo; $r.Timeout = $espera; $r.ReadWriteTimeout = $espera; $r.Proxy = $null
    if ($metodo -ne 'GET') { $r.Headers.Add('X-MyLoot', '1'); $r.ContentLength = 0 }
    $resp = $r.GetResponse()
    $txt = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd(); $resp.Close()
    return $txt
  } catch { return $null }
}
# só conta como ligado se quem responde na porta é o MyLoot (outro programa na mesma porta não engana o atalho)
function Vivo { $t = Pedir 'api/ping'; return [bool]($t -and $t -match '"app":\s*"myloot"') }

# navegador para o modo app: Edge (vem em todo Windows), depois Chrome
function AcharNavegador {
  $c = @()
  foreach ($nome in 'msedge.exe', 'chrome.exe') {
    foreach ($raiz in 'HKCU:', 'HKLM:') {
      try { $c += (Get-ItemProperty "$raiz\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$nome" -ErrorAction Stop).'(default)' } catch {}
    }
    $pasta = if ($nome -eq 'msedge.exe') { 'Microsoft\Edge\Application' } else { 'Google\Chrome\Application' }
    foreach ($base in ${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) { if ($base) { $c += Join-Path $base "$pasta\$nome" } }
  }
  foreach ($x in $c) { if ($x -and (Test-Path -LiteralPath $x)) { return $x } }
  return $null
}

function JanelasAbertas {
  $pids = @(Get-Process msedge, chrome -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
  if (-not $pids.Count) { return @() }
  return @([MyLootJanela]::Achar([uint32[]]$pids))
}

function AbrirNoNavegador { Start-Process $url }

function AbrirJanela {
  $j = JanelasAbertas
  if ($j.Count) { [MyLootJanela]::Mostrar($j[0]); return }
  $nav = AcharNavegador
  if ($nav) { Start-Process -FilePath $nav -ArgumentList "--app=$url", '--window-size=1320,860', '--no-first-run', '--no-default-browser-check' }
  else { AbrirNoNavegador }
}

# respeita Configurações → Servidor → "Abrir em"
function Abrir {
  if ($Navegador) { AbrirNoNavegador; return }
  $modo = 'app'
  $r = Pedir 'api/janela'
  if ($r) { try { $modo = ($r | ConvertFrom-Json).modo } catch {} }
  if ($modo -eq 'navegador') { AbrirNoNavegador } else { AbrirJanela }
}

# ---------- 1. servidor ----------
if (-not (Vivo)) {
  if (-not $SemServidor) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Aviso "O MyLoot precisa do Node.js.`nBaixe em https://nodejs.org (versão LTS), instale e abra de novo."; exit 1 }
    Start-Process -FilePath $node.Source -ArgumentList "`"$dir\server.js`"" -WorkingDirectory $dir -WindowStyle Hidden
  }
  for ($i = 0; $i -lt 50 -and -not (Vivo); $i++) { Start-Sleep -Milliseconds 300 }
  if (-not (Vivo)) { Aviso "Não consegui ligar o MyLoot.`nAbra o `"Abrir MyLoot.bat`" para ver o erro."; exit 1 }
}

# ---------- 2. janela ----------
Abrir

# ---------- 3. bandeja (um ícone só por porta) ----------
$novo = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\MyLoot-Bandeja-$Porta", [ref]$novo)
if (-not $novo) { exit 0 }

$icone = New-Object System.Windows.Forms.NotifyIcon
$ico = Join-Path $dir 'MyLoot.ico'
$icone.Icon = if (Test-Path -LiteralPath $ico) { New-Object System.Drawing.Icon($ico) } else { [System.Drawing.SystemIcons]::Application }
$icone.Text = if ($Porta -eq 4321) { 'MyLoot' } else { "MyLoot (porta $Porta)" }

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$mAbrir = $menu.Items.Add('Abrir MyLoot'); $mAbrir.Font = New-Object System.Drawing.Font($mAbrir.Font, [System.Drawing.FontStyle]::Bold)
$mNav = $menu.Items.Add('Abrir no navegador')
[void]$menu.Items.Add('-')
$mSair = $menu.Items.Add('Fechar MyLoot')
$icone.ContextMenuStrip = $menu

$ctx = New-Object System.Windows.Forms.ApplicationContext
$encerrar = { $timer.Stop(); $icone.Visible = $false; $icone.Dispose(); $ctx.ExitThread() }

$mAbrir.add_Click({ AbrirJanela })
$mNav.add_Click({ AbrirNoNavegador })
# clique (ou clique duplo) com o botão esquerdo abre a janela; o direito mostra o menu
$icone.add_MouseClick({ param($s, $e) if ($e.Button -eq 'Left') { AbrirJanela } })
$mSair.add_Click({
  [void](Pedir 'api/shutdown' 'POST' 2000)
  foreach ($h in (JanelasAbertas)) { [MyLootJanela]::Fechar($h) }
  & $encerrar
})

# se o servidor sair por outro caminho (Configurações → Desligar), o ícone some sozinho;
# tolera uns segundos fora do ar, que é o tempo de reiniciar depois de uma atualização
$script:falhas = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.add_Tick({
  if (Vivo) { $script:falhas = 0 } else { $script:falhas++ }
  if ($script:falhas -ge 4) { & $encerrar }
})
$timer.Start()

$icone.Visible = $true
[System.Windows.Forms.Application]::Run($ctx)
$mutex.ReleaseMutex()
