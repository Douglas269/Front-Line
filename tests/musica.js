// Música: rodízio de trilhas (nunca a mesma em seguida), som ligado por padrão com música desde o primeiro toque na tela inicial
// (Trincheiras) e clique de confirmação ao escolher modo. Uso: node tests/musica.js
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const f = []; let erros = 0;
  const arquivosOk = (urls) => urls.every(u => fs.existsSync(path.join(RAIZ, u.replace(/^.*?assets\//, 'assets/').split('?')[0])));
  // ---- Trincheiras (?som=1 libera o som, que em teste automático fica desligado)
  let p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'ponto-alpha.html') + '?som=1&titulo=1'); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto('file://' + path.join(RAIZ, 'ponto-alpha.html') + '?som=1&titulo=1'); await p.waitForTimeout(600);
  const antes = await p.evaluate(() => ({ mudo: isAudioMuted, ctx: !!audioCtx, tocando: !bgmWar.paused, icone: document.getElementById('ico-audio').className, titulo: !document.getElementById('tela-titulo').classList.contains('hidden') }));
  if (antes.mudo) f.push('Trincheiras deveria começar com o som ligado (com ?som=1)');
  if (!antes.icone.includes('volume-high')) f.push('ícone do som deveria mostrar ligado: ' + antes.icone);
  if (!antes.titulo) f.push('a tela de título deveria estar aberta nesse teste');
  await p.evaluate(() => { window.__sons = []; const o = FLSom.tocar; FLSom.tocar = (n) => { window.__sons.push(n); return o(n); }; });
  await p.mouse.click(195, 420); await p.waitForTimeout(900); // primeiro toque na tela de título (em lugar vazio)
  await p.click('button[onclick="jogarDoTitulo()"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = document.querySelector('.modo-card'); if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  const depois = await p.evaluate(() => ({ ctx: !!audioCtx, tocando: !bgmWar.paused && bgmWar.currentTime > 0, src: bgmWar.src, flsom: !!FLSom.ctx, loop: bgmWar.loop, loopB: bgmBattle.loop }));
  if (!depois.ctx) f.push('o primeiro toque na tela de título deveria iniciar o áudio');
  if (!depois.tocando) f.push('a música deveria tocar já no primeiro toque da tela de título: ' + JSON.stringify(depois));
  if (!depois.flsom) f.push('o clique da tela de título deveria criar o áudio dos sons de interface');
  const sons = await p.evaluate(() => window.__sons);
  if (!sons.includes('confirma')) f.push('o botão JOGAR e o cartão de modo deveriam tocar o som de confirmação: ' + sons);
  if (depois.loop || depois.loopB) f.push('as trilhas não devem ficar em loop de uma música só');
  const rod = await p.evaluate(() => { const a = bgmWar.src; bgmWar.dispatchEvent(new Event('ended')); const b2 = bgmWar.src; bgmWar.dispatchEvent(new Event('ended')); const c = bgmWar.src; const x = bgmBattle.src; bgmBattle.dispatchEvent(new Event('ended')); return { a, b2, c, x, y: bgmBattle.src, dia: [a, b2, c], mapaOk: [a, b2, c, x, bgmBattle.src] }; });
  if (rod.a === rod.b2 || rod.b2 === rod.c) f.push('o rodízio repetiu a mesma trilha em seguida: ' + JSON.stringify(rod));
  if (rod.x === rod.y) f.push('o rodízio de combate repetiu a mesma trilha');
  if (!arquivosOk(rod.mapaOk)) f.push('alguma trilha do rodízio não existe: ' + JSON.stringify(rod.mapaOk));
  // desligar fica salvo
  await p.evaluate(() => toggleAudio()); const salvo = await p.evaluate(() => localStorage.getItem('frontline-som'));
  if (salvo !== '0') f.push('desligar o som deveria ficar salvo (frontline-som=0): ' + salvo);
  await p.close();
  // ---- Conquista
  p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'conquista.html')); await p.waitForTimeout(400);
  const c = await p.evaluate(() => { const r = { loop: SOM.mapa.loop || SOM.batalha.loop }; const a = SOM.mapa.src; SOM.mapa.dispatchEvent(new Event('ended')); r.a = a; r.b = SOM.mapa.src; const x = SOM.batalha.src; SOM.batalha.dispatchEvent(new Event('ended')); r.x = x; r.y = SOM.batalha.src; return r; });
  if (c.loop) f.push('Conquista: trilhas não devem ficar em loop de uma música só');
  if (c.a === c.b || c.x === c.y) f.push('Conquista: rodízio repetiu a mesma trilha ' + JSON.stringify(c));
  if (!arquivosOk([c.a, c.b, c.x, c.y])) f.push('Conquista: trilha inexistente');
  await p.close();
  // ---- só as trilhas novas existem na pasta
  const musicas = fs.readdirSync(path.join(RAIZ, 'assets', 'music')).filter(x => x.endsWith('.mp3')).sort();
  if (musicas.length !== 4) f.push('esperava 4 trilhas em assets/music, achei ' + musicas.join(','));
  console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: som ligado por padrão, música no primeiro toque da tela inicial, rodízio de trilhas nos dois modos'); await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
