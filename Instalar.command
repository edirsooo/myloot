#!/bin/bash
# Instalador do MyLoot para Mac: cria o app "MyLoot" na Mesa (com o ícone do baú) e abre.
cd "$(dirname "$0")" || exit 1
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  O MyLoot precisa do Node.js. Baixe em https://nodejs.org (versão LTS), instale e abra este arquivo de novo."
  echo
  read -n 1 -s -r -p "  Aperte uma tecla para fechar..."
  exit 1
fi

chmod +x abrir.sh "Abrir MyLoot.command" 2>/dev/null
# tira a marca de "baixado da internet" só desta pasta, para os atalhos abrirem sem aviso
xattr -dr com.apple.quarantine . 2>/dev/null

APP="$HOME/Desktop/MyLoot.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>MyLoot</string>
  <key>CFBundleDisplayName</key><string>MyLoot</string>
  <key>CFBundleExecutable</key><string>MyLoot</string>
  <key>CFBundleIconFile</key><string>MyLoot</string>
  <key>CFBundleIdentifier</key><string>br.com.prestesdesign.myloot</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST
printf '#!/bin/bash\nexec "%s/abrir.sh"\n' "$PWD" > "$APP/Contents/MacOS/MyLoot"
chmod +x "$APP/Contents/MacOS/MyLoot"
sips -s format icns "public/icon.png" --out "$APP/Contents/Resources/MyLoot.icns" >/dev/null 2>&1
touch "$APP"

echo
echo "  Pronto! O app \"MyLoot\" está na Mesa. Abrindo..."
./abrir.sh
sleep 2
