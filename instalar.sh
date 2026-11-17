#!/bin/sh
# Instalador do MyLoot para Linux: coloca o MyLoot no menu de aplicativos e na área de trabalho, e abre.
# Uso: sh instalar.sh   (ou dois cliques, se o seu gerenciador de arquivos rodar scripts)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "O MyLoot precisa do Node.js. Instale a versão LTS em https://nodejs.org (ou pelo gerenciador de pacotes) e rode de novo."
  exit 1
fi

chmod +x abrir.sh
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cat > "$APPS/myloot.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MyLoot
Comment=Seu inventário pessoal
Exec="$PWD/abrir.sh"
Icon=$PWD/public/icon.png
Terminal=false
Categories=Office;Utility;
EOF
chmod +x "$APPS/myloot.desktop"

DESK=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
if [ -d "$DESK" ]; then
  cp "$APPS/myloot.desktop" "$DESK/myloot.desktop"
  chmod +x "$DESK/myloot.desktop"
  gio set "$DESK/myloot.desktop" metadata::trusted true 2>/dev/null
fi

echo "Pronto! O MyLoot está no menu de aplicativos e na área de trabalho. Abrindo..."
./abrir.sh
