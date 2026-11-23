// Som: volume em curva quadrática, variação dos efeitos, limite de sons juntos e "duck" da música nas explosões
// (Trincheiras e Conquista). Uso: node tests/som-mixer.js
const path = require('path'); const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const f = []; let erros = 0;
  // ---- Trincheiras
  let p = await b.newPage(); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'ponto-alpha.html')); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} }); await p.waitForTimeout(500);
  const t = await p.evaluate(async () => {
    const r = {};
    r.curva = [FLSom.curva(0, 45), FLSom.curva(45, 45), FLSom.curva(90, 45)];
    isAudioMuted = false; initAudio(); await audioCtx.resume();
    CONFIG.volEfeitos = 80; aplicarVolumes(); r.efeitosPadrao = canais.efeitos.gain.value;
    CONFIG.volEfeitos = 0; aplicarVolumes(); r.efeitosMudo = canais.efeitos.gain.value;
    CONFIG.volMusica = 45; aplicarVolumes(); r.musicaPadrao = +canais.musica.gain.value.toFixed(3);
    CONFIG.volMusica = 22; aplicarVolumes(); r.musicaMeio = +canais.musica.gain.value.toFixed(3);
    r.temDuck = !!duckMusica;
    // limite de 6 sons iguais ao mesmo tempo
    let criados = 0; const cb = audioCtx.createBufferSource.bind(audioCtx); audioCtx.createBufferSource = () => { criados++; return cb(); };
    for (let i = 0; i < 20; i++) tocarSom('tiro', 1);
    r.tirosCriados = criados;
    // variação de tom e volume: vários toques não saem iguais
    const taxas = new Set(); const cb2 = audioCtx.createBufferSource; audioCtx.createBufferSource = () => { const s = cb2(); taxas.add(s.playbackRate); return s; };
    // duck: explosão grande abaixa a música e ela volta
    duckMusica.gain.value = 1; tocarSom('explosao', 1); await new Promise(r => setTimeout(r, 120)); r.duckAbaixou = duckMusica.gain.value < 0.8;
    await new Promise(r => setTimeout(r, 2500)); r.duckVoltou = duckMusica.gain.value > 0.95;
    return r;
  });
  if (t.curva[0] !== 0 || t.curva[1] !== 1 || t.curva[2] !== 4) f.push('curva quadrática errada ' + t.curva);
  if (Math.abs(t.efeitosPadrao - 1) > 1e-6) f.push('efeitos no padrão deveriam ficar como antes (1): ' + t.efeitosPadrao);
  if (t.efeitosMudo !== 0) f.push('efeitos em 0 deveriam ser mudo');
  if (Math.abs(t.musicaPadrao - 0.45) > 0.002) f.push('música no padrão deveria ficar em 0.45: ' + t.musicaPadrao);
  if (!(t.musicaMeio < 0.45 * 0.3)) f.push('música com metade do controle deveria soar bem mais baixa: ' + t.musicaMeio);
  if (!t.temDuck) f.push('Trincheiras sem canal de duck da música');
  if (t.tirosCriados > 6) f.push('limite de sons juntos não funcionou: ' + t.tirosCriados);
  if (!t.duckAbaixou) f.push('a música não abaixou na explosão');
  if (!t.duckVoltou) f.push('a música não voltou depois da explosão');
  await p.close();
  // ---- Conquista
  p = await b.newPage(); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'conquista.html')); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  const c = await p.evaluate(async () => {
    const r = {}; iniciarSom(); await SOM.ctx.resume(); SOM.ligado = true;
    r.temDuck = !!SOM.duck;
    CONFIG_CONQ.volMusica = 45; CONFIG_CONQ.volEfeitos = 80; aplicarConfigConq(); r.musica = +SOM.musica.gain.value.toFixed(3); r.efeitos = +SOM.efeitos.gain.value.toFixed(3);
    CONFIG_CONQ.volMusica = 0; CONFIG_CONQ.volEfeitos = 0; aplicarConfigConq(); r.mudo = SOM.musica.gain.value === 0 && SOM.efeitos.gain.value === 0;
    await new Promise(r => setTimeout(r, 300)); SOM.duck.gain.value = 1; som('explosao'); await new Promise(r => setTimeout(r, 120)); r.duckAbaixou = SOM.duck.gain.value < 0.8;
    return r;
  });
  if (!c.temDuck) f.push('Conquista sem canal de duck');
  if (c.musica !== 0.35 || c.efeitos !== 0.55) f.push('Conquista no padrão deveria ficar como antes: ' + JSON.stringify(c));
  if (!c.mudo) f.push('Conquista em 0 deveria ficar muda');
  if (!c.duckAbaixou) f.push('Conquista: a música não abaixou na explosão');
  console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: curva do volume, variação, limite de sons e duck da música (Trincheiras e Conquista)');
  await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
