// Conquista: depois de pesquisar uma tropa, o jogo avisa onde criá-la e o botão "Recrutar…" mostra o que foi liberado;
// e a tropa liberada realmente pode ser recrutada e aparece no exército do jogador.
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 390, height: 844 } }); let erros = 0;
  pg.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await pg.goto('file://' + path.join(__dirname, '..', 'prototipo', 'conquista.html')); await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => {
    novoJogo(1); G.fac.jogador.moedas = 800; G.fac.jogador.aco = 50; const msgs = [], n0 = noticia; noticia = (m) => { msgs.push(m); return n0(m); };
    const antes = (() => { G.sel = { tipo: 'prov', id: G.capitalJogador }; renderPainel(); return [...document.querySelectorAll('button')].map(x => x.textContent).find(t => /Recrutar…/.test(t)); })();
    pesquisar('cav'); avancarPesquisas(100);
    G.sel = { tipo: 'prov', id: G.capitalJogador }; renderPainel();
    const depois = [...document.querySelectorAll('button')].map(x => x.textContent).find(t => /Recrutar…/.test(t));
    const ok = recrutar(G.capitalJogador, 1, 'cav');
    const temCav = G.ex.some(e => e.dono === 'jogador' && e.s.some(s => s.tipo === 'cav'));
    return { aviso: msgs.some(m => /Para criar .*Cavalaria.*Recrutar…/.test(m)), antes, depois, ok, temCav };
  });
  const falhas = [];
  if (!r.aviso) falhas.push('faltou o aviso de onde criar a cavalaria');
  if (/liberadas/.test(r.antes)) falhas.push('mostrou "liberadas" antes de pesquisar');
  if (!/liberadas: 🐎/.test(r.depois)) falhas.push('botão Recrutar… não mostra a cavalaria liberada: ' + r.depois);
  if (!r.ok || !r.temCav) falhas.push('não conseguiu recrutar cavalaria depois da pesquisa');
  console.log(falhas.length || erros ? 'FALHOU:\n' + falhas.join('\n') : 'OK: aviso, botão e recrutamento da cavalaria'); await b.close(); process.exit(falhas.length || erros ? 1 : 0);
})();
