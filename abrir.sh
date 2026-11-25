#!/bin/sh
# Abre o MyLoot no Mac e no Linux: liga o servidor (se ainda não estiver ligado) e abre o navegador.
cd "$(dirname "$0")" || exit 1
URL="http://127.0.0.1:4321/"

# o Node instalado pelo site ou pelo Homebrew nem sempre está no PATH de quem abre pelo ícone
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
for d in "$HOME"/.nvm/versions/node/*/bin "$HOME"/.volta/bin; do [ -d "$d" ] && PATH="$PATH:$d"; done
export PATH

# só conta como ligado se quem responde na porta é o MyLoot
vivo() { { curl -fs -m 1 "${URL}api/ping" 2>/dev/null || wget -q -T 1 -O - "${URL}api/ping" 2>/dev/null; } | grep -q '"app":"myloot"'; }

if ! command -v node >/dev/null 2>&1; then
  echo "O MyLoot precisa do Node.js. Baixe em https://nodejs.org (versão LTS), instale e abra de novo."
  [ "$(uname)" = "Darwin" ] && osascript -e 'display alert "MyLoot" message "Instale o Node.js (nodejs.org, versão LTS) e abra de novo."' >/dev/null 2>&1
  exit 1
fi

if ! vivo; then
  nohup node server.js >"${TMPDIR:-/tmp}/myloot.log" 2>&1 &
  i=0
  while [ $i -lt 30 ]; do sleep 0.3; vivo && break; i=$((i + 1)); done
  if ! vivo; then
    echo "Não consegui ligar o MyLoot (a porta pode estar ocupada por outro programa). Veja ${TMPDIR:-/tmp}/myloot.log"
    [ "$(uname)" = "Darwin" ] && osascript -e 'display alert "MyLoot" message "Não consegui ligar o MyLoot. A porta pode estar ocupada por outro programa."' >/dev/null 2>&1
    exit 1
  fi
fi

if [ "$(uname)" = "Darwin" ]; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
else echo "Abra no navegador: $URL"
fi
