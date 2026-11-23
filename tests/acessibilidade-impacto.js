// Acessibilidade do impacto: opção "Clarões e piscadas" (Trincheiras), "Tremor da tela" (Conquista e Duelo via FLSom),
// no máximo 3 clarões grandes por segundo e piscada de ferido com no máximo ~3 ciclos por segundo.
const path = require('path'); const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
(async () => {
  const b = await chromium.launch(); const f = []; let erros = 0;
  let p = await b.newPage(); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'ponto-alpha.html')); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} }); await p.waitForTimeout(500);
  const t = await p.evaluate(async () => {
    const r = {}; r.padraoFlashes = CONFIG.flashes;
    PARTICULAS.length = 0; for (let i = 0; i < 10; i++) emitirParticula({ x: 0, y: 0, t: 'clarao', vida: 9, r: 40, a: 0.95 });
    r.clarosGrandesEmRajada = PARTICULAS.filter(q => q.t === 'clarao').length;
    await new Promise(x => setTimeout(x, 400)); PARTICULAS.length = 0; emitirParticula({ x: 0, y: 0, t: 'clarao', vida: 9, r: 40, a: 0.95 }); r.depoisDe400ms = PARTICULAS.filter(q => q.t === 'clarao').length;
    CONFIG.flashes = false; await new Promise(x => setTimeout(x, 400)); PARTICULAS.length = 0; emitirParticula({ x: 0, y: 0, t: 'clarao', vida: 9, r: 40, a: 0.95 });
    const q = PARTICULAS.find(z => z.t === 'clarao'); r.fracoSemFlashes = q && q.a < 0.4 && q.r < 30;
    r.ligaNaTela = (() => { abrirConfig('jogo'); const ok = document.getElementById('modal-config').innerHTML.includes('Clarões e piscadas'); fecharConfig(); return ok; })();
    return r;
  });
  if (t.padraoFlashes !== true) f.push('padrão de flashes deveria ser ligado');
  if (t.clarosGrandesEmRajada !== 1) f.push('rajada de 10 clarões grandes deveria virar 1: ' + t.clarosGrandesEmRajada);
  if (t.depoisDe400ms !== 1) f.push('depois de 400 ms um novo clarão deveria passar: ' + t.depoisDe400ms);
  if (!t.fracoSemFlashes) f.push('com flashes desligados o clarão deveria ser fraco e pequeno');
  if (!t.ligaNaTela) f.push('a opção "Clarões e piscadas" não aparece nas configurações');
  await p.close();
  p = await b.newPage(); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'conquista.html')); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  const c = await p.evaluate(() => {
    const el = document.getElementById('mapaBox'), r = {};
    el.classList.remove('fl-tremendo'); FLSom.tremer(el, 4); r.treme = el.classList.contains('fl-tremendo');
    el.classList.remove('fl-tremendo'); gravarConfigConq({ tremor: false }); FLSom.tremer(el, 4); r.parado = !el.classList.contains('fl-tremendo');
    abrirConfigConq(); r.opcao = document.getElementById('configConq').innerHTML.includes('Tremor da tela'); return r;
  });
  if (!c.treme) f.push('Conquista: tremor deveria funcionar por padrão');
  if (!c.parado) f.push('Conquista: tremor desligado não deveria tremer');
  if (!c.opcao) f.push('Conquista: opção Tremor da tela não aparece');
  console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: clarões limitados a 3/s, opção Clarões e piscadas, tremor da Conquista');
  await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
