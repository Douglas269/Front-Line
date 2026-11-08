#!/usr/bin/env bash
# Marca uma nova versão do FrontLine: troca VERSAO_JOGO no jogo e o versao.json juntos,
# e o ?v= dos arquivos de código e estilo na página (para o celular não usar uma cópia velha).
# Rodar antes de cada commit que vai para o site; quem estiver com o jogo aberto
# vai ver a tela "Nova versão" e precisa atualizar para continuar.
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-$(date -u +%Y%m%d.%H%M)}"
ARQ_VERSAO=prototipo/assets/js/06-conta.js
sed -i "s/const VERSAO_JOGO = '[^']*';/const VERSAO_JOGO = '$V';/" "$ARQ_VERSAO"
sed -i -E "s#(assets/(js|css)/[A-Za-z0-9_-]+\.(js|css))\?v=[0-9.]+#\1?v=$V#g" prototipo/ponto-alpha.html
printf '{"versao": "%s"}\n' "$V" > prototipo/versao.json
grep -q "const VERSAO_JOGO = '$V';" "$ARQ_VERSAO"
echo "Versão $V"
