#!/usr/bin/env bash
# Gera a pasta (e o .zip) para enviar ao itch.io como jogo HTML5. Não envia nada: publicar depende da conta do dono do jogo.
# Uso: tools/exportar-itch.sh [pasta-de-saida]   (padrão: dist/itch)
# O itch.io serve o jogo dentro de um subcaminho, então: index.html na raiz, só caminhos relativos e sem links para "/".
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-dist/itch}"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r prototipo/. "$OUT/"
rm -f "$OUT/sw.js"                                   # service worker não funciona dentro do iframe do itch
mv "$OUT/ponto-alpha.html" "$OUT/index.html"
# links que apontam para "/" (raiz do site) viram caminhos relativos
sed -i -E "s#location\.protocol\.startsWith\('http'\) \? '/' : 'ponto-alpha\.html'#'index.html'#g" "$OUT"/assets/js/*.js
sed -i -E "s#location\.protocol\.startsWith\('http'\) \? location\.origin \+ '/(duelo|conquista)\.html' : location\.href\.split\('\?'\)\[0\]#location.href.split('?')[0]#g" "$OUT"/assets/js/*.js
sed -i -E "s#navigator\.serviceWorker\.register\('/sw\.js'\)#Promise.reject()#g" "$OUT"/assets/js/*.js
# 'ponto-alpha.html' que sobrar nos textos/links vira index.html
sed -i "s#ponto-alpha\.html#index.html#g" "$OUT"/*.html "$OUT"/assets/js/*.js
ARQ=$(find "$OUT" -type f | wc -l); MB=$(du -sm "$OUT" | cut -f1)
echo "Pasta: $OUT ($ARQ arquivos, ${MB} MB)"
if command -v zip >/dev/null; then (cd "$OUT" && rm -f ../itch.zip && zip -qr ../itch.zip .); echo "Zip: $(dirname "$OUT")/itch.zip"; fi
