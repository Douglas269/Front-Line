#!/usr/bin/env bash
# Marca uma nova versão do FrontLine: troca VERSAO_JOGO no jogo e o versao.json juntos.
# Rodar antes de cada commit que vai para o site; quem estiver com o jogo aberto
# vai ver a tela "Nova versão" e precisa atualizar para continuar.
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-$(date -u +%Y%m%d.%H%M)}"
sed -i "s/const VERSAO_JOGO = '[^']*';/const VERSAO_JOGO = '$V';/" prototipo/ponto-alpha.html
printf '{"versao": "%s"}\n' "$V" > prototipo/versao.json
grep -q "const VERSAO_JOGO = '$V';" prototipo/ponto-alpha.html
echo "Versão $V"
