#!/usr/bin/env bash
# Gera a versão web da Conquista em Godot (pasta conquista-godot/, publicada em /conquista-godot).
# Precisa do Godot 4.7.2 com os modelos de exportação Web.
# Uso: GODOT=/caminho/do/godot tools/exportar-godot-web.sh
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
rm -rf conquista-godot
mkdir -p conquista-godot
"$GODOT" --headless --path godot --import >/dev/null 2>&1 || true
"$GODOT" --headless --path godot --import >/dev/null 2>&1
"$GODOT" --headless --path godot --export-release "Web" ../conquista-godot/index.html
test -s conquista-godot/index.wasm && test -s conquista-godot/index.pck
echo "Pronto: conquista-godot/"
