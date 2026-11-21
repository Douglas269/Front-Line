// Duelo: mede se existe estratégia dominante. Round-robin entre estratégias simples (doutrina × ataque × defesa).
// Uso: node tests/duelo-balanco.js [duelos por par]   (OVR='{"DOUT":{"fortTrinch":0.7}}' testa ajustes sem mexer no motor)
const { medir, M } = require('./duelo-estrategias.js');
const N = +(process.argv[2] || 12);
if (process.env.OVR) { const o = JSON.parse(process.env.OVR); Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') Object.keys(o[k]).forEach(j => { if (o[k][j] && typeof o[k][j] === 'object') Object.assign(M.D[k][j], o[k][j]); else M.D[k][j] = o[k][j]; }); else M.D[k] = o[k]; }); }
const r = medir(N);
console.log('Por doutrina (%):', JSON.stringify(r.porDoutrina));
console.log('Por ataque (%):', JSON.stringify(r.porAtaque));
console.log('Por postura (%):', JSON.stringify(r.porPostura));
console.log('Matriz de doutrinas (linha vence coluna, %):'); r.DOUT.forEach(a => console.log(' ', a.padEnd(11), r.DOUT.map(b => (r.cel(a, b) + '').padStart(5)).join(' ')));
console.log('Melhores:', JSON.stringify(r.rank.slice(0, 4)), 'Piores:', JSON.stringify(r.rank.slice(-3)));
