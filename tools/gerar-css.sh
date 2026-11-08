#!/usr/bin/env bash
# Gera o CSS fixo do jogo com o Tailwind (antes ele era montado no celular a cada abertura, pelo CDN).
# Rodar sempre que mudar classes no HTML ou nos arquivos de assets/js.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes tailwindcss@3.4.17 -c tools/css/tailwind.config.js -i tools/css/entrada.css -o prototipo/assets/css/tailwind.css --minify
ls -la prototipo/assets/css/tailwind.css
