// Confere que a paleta do pixel art em JavaScript (assets/js/paleta.js) é igual à dos tokens de CSS (--px-* em assets/css/tokens.css).
// Uso: node tests/paleta.js
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..', 'prototipo', 'assets');
const css = fs.readFileSync(path.join(raiz, 'css', 'tokens.css'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'js', 'paleta.js'), 'utf8');
const FL_PAL = new Function(js + '; return FL_PAL;')();
const token = (nome) => { const m = css.match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{6})')); return m && m[1].toLowerCase(); };
const falhas = [];
const igual = (nomeCss, valor) => { const t = token(nomeCss); if (t !== String(valor).toLowerCase()) falhas.push(`--${nomeCss}: CSS ${t} ≠ JS ${valor}`); };
igual('px-contorno', FL_PAL.contorno); igual('px-farda', FL_PAL.farda); igual('px-farda-escura', FL_PAL.fardaEscura);
igual('px-farda-medico', FL_PAL.fardaMedico); igual('px-bota', FL_PAL.bota); igual('px-sangue', FL_PAL.sangue);
for (let i = 1; i <= 6; i++) { igual('px-pele-' + i, FL_PAL.pele[i]); igual('px-soldado-' + i, FL_PAL.soldado[i]); }
const cores = [FL_PAL.contorno, FL_PAL.farda, FL_PAL.fardaEscura, FL_PAL.fardaMedico, FL_PAL.bota, FL_PAL.sangue, ...Object.values(FL_PAL.pele), ...Object.values(FL_PAL.soldado)];
if (cores.length > 24) falhas.push('paleta grande demais: ' + cores.length + ' cores (limite 24)');
// todos os HTML carregam a paleta
['ponto-alpha.html', 'conquista.html', 'duelo.html'].forEach(h => { if (!/assets\/js\/paleta\.js/.test(fs.readFileSync(path.join(raiz, '..', h), 'utf8'))) falhas.push(h + ' não carrega paleta.js'); });
console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : `Paleta: CSS e JavaScript iguais (${cores.length} cores), carregada nos três modos.`);
process.exit(falhas.length ? 1 : 0);
