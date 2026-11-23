// Créditos: todo arquivo de imagem, som e fonte do jogo precisa estar coberto em docs/creditos.md
// (pelo nome do arquivo, pelo prefixo antes do "-" ou da numeração, ou pela pasta). Uso: node tests/creditos.js
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..'), doc = fs.readFileSync(path.join(RAIZ, 'docs', 'creditos.md'), 'utf8');
const EXT = /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|ttf|otf|woff2?)$/i;
const pastas = ['prototipo/assets', 'prototipo/icons', 'prototipo/vendor'];
const lista = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? lista(path.join(d, e.name)) : [path.join(d, e.name)]);
const sem = [];
pastas.forEach(p => lista(path.join(RAIZ, p)).filter(f => EXT.test(f)).forEach(f => {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/'), nome = path.basename(f), base = nome.replace(EXT, '');
  const prefixo = base.replace(/[-_]?\d+.*$/, '').replace(/-(400|500|600|700)$/, ''); // ChakraPetch-500 → ChakraPetch ; shaded_medal1 → shaded_medal
  const dir = path.dirname(rel) + '/';
  const coberto = doc.includes(rel) || doc.includes(nome) || doc.includes('`' + dir + '`') || doc.includes(dir + '`') || (prefixo.length >= 4 && doc.includes(prefixo));
  if (!coberto) sem.push(rel);
}));
const confirmar = (doc.match(/⚠ \*\*origem a confirmar/g) || []).length;
if (sem.length) { console.log('FALHOU: arquivos sem crédito em docs/creditos.md:\n' + sem.join('\n')); process.exit(1); }
console.log('OK: todos os arquivos de arte, som e fonte têm crédito' + (confirmar ? ` (${confirmar} com "origem a confirmar")` : ''));
