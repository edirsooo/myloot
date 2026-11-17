#!/bin/bash
# Mac: abre o MyLoot mostrando a janela com os erros (para quando algo não funciona).
cd "$(dirname "$0")" || exit 1
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
(sleep 1.5; open "http://127.0.0.1:4321/") &
node server.js
read -n 1 -s -r -p "Aperte uma tecla para fechar..."
